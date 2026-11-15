import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as planner from "../js/planner.js";
import * as shopping from "../js/shopping.js";
import * as bring from "../js/bring.js";

// Execute the actual UI handlers without a browser dependency. Imports are supplied
// below; init waits on a pending fetch. DOM output is captured as HTML and status.
const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8")
  .replace(/^import .* from .*;\n/gm, "");
function app() {
  const root = { innerHTML: "" };
  const status = { textContent: "", classList: { add() {}, remove() {} } };
  const events = {};
  const context = vm.createContext({
    ...planner, ...shopping, ...bring, URL, structuredClone,
    firebaseConfig: {}, console: { error() {} },
    location: { href: "https://example.org/essensplaner/" },
    document: {
      getElementById: id => id === "app" ? root : status,
      addEventListener: (name, callback) => { events[name] = callback; },
    },
    fetch: () => new Promise(() => {}), setTimeout: () => 0, clearTimeout() {},
  });
  vm.runInContext(source, context);
  context.fixture = {
    version: 1, verlauf: [], favoriten: [], probiert: [],
    links: [{ id: "link-test", titel: '<img src=x onerror=alert(1)>', url: "javascript:alert(1)", geplantAm: null }],
    aktuellerPlan: { wocheAb: "2026-11-15", neuSlot: "A", slots: {
      A: { quelle: "link", id: "link-test", variante: null }, B: null, C: null,
    } },
  };
  vm.runInContext("state = structuredClone(fixture)", context);
  return { context, root, status, events, run: code => vm.runInContext(code, context) };
}

test("gespeicherte unsichere URLs sind in allen Tabs und Bring deaktiviert; Titel bleiben Text", () => {
  const ui = app();
  for (const url of ["javascript:alert(1)", "data:text/html,test", "http://example.org", "//example.org", "https://", "https://\njavascript:alert(1)"]) {
    ui.context.url = url;
    ui.run("state.links[0].url = url");
    for (const tab of ["woche", "einkauf", "rezepte"]) {
      ui.context.tab = tab;
      ui.run("ui.tab = tab; render()");
      assert.doesNotMatch(ui.root.innerHTML, /<a\b[^>]*href=/, `${tab}: ${url}`);
      assert.match(ui.root.innerHTML, /disabled title="Ungültiger Rezept-Link"/);
      assert.doesNotMatch(ui.root.innerHTML, /<img\b/);
      assert.match(ui.root.innerHTML, /&lt;img/);
    }
  }
});

test("gültige HTTPS-Links bleiben mit Query und Fragment nutzbar", () => {
  const ui = app();
  const url = "https://example.org/rezept?a=1&b=2#zutaten";
  ui.context.url = url;
  assert.equal(ui.run("sichereLinkUrl(url)"), url);
  ui.run("state.links[0].url = url; render()");
  assert.match(ui.root.innerHTML, /href="https:\/\/example.org\/rezept\?a=1&amp;b=2#zutaten"/);
  assert.ok(ui.root.innerHTML.includes(encodeURIComponent(url)));
});

for (const failure of [false, true]) {
  test(`Link-Formular meldet den tatsächlichen Speicherstatus (${failure ? "Fehler" : "Erfolg"})`, async () => {
    const ui = app();
    let saved;
    ui.context.testStore = { speichern: async state => {
      if (failure) throw new Error("Test: quota exceeded");
      saved = state;
    } };
    ui.run("store = testStore");
    ui.events.submit({
      preventDefault() {},
      target: { id: "link-form", querySelector: selector => ({ value: selector === "#link-titel" ? "Testgericht" : "https://example.org/rezept" }) },
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ui.status.textContent, failure ? "Speichern fehlgeschlagen" : "Link hinzugefügt");
    if (!failure) assert.equal(saved.links.at(-1).titel, "Testgericht");
  });
}

test("fehlgeschlagene lokale Datenübernahme meldet keinen Erfolg", async () => {
  const ui = app();
  ui.context.localStorage = { getItem: () => JSON.stringify(ui.context.fixture) };
  ui.context.testStore = { speichern: async () => { throw new Error("Test: permission denied"); } };
  ui.run('store = testStore; modus = "firebase"');
  ui.events.click({ target: { closest: () => ({ dataset: { action: "lokalUebernehmen" } }) } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.status.textContent, "Speichern fehlgeschlagen");
  assert.match(ui.root.innerHTML, /Keine Verbindung zum Haushalt/);
});
