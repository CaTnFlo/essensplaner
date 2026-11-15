import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baueSeiten } from "../scripts/build-pages.mjs";
import { rezeptSeitenPfad } from "../js/bring.js";

const lade = (pfad) => JSON.parse(readFileSync(new URL(pfad, import.meta.url), "utf8"));
const echt = () => lade("../data/recipes.json");
const skript = new URL("../scripts/build-pages.mjs", import.meta.url).pathname;

const ldJson = (html) => {
  const m = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
  assert.ok(m, "JSON-LD-Block fehlt");
  return m[1];
};

const minimal = (overrides = {}) => ({
  id: "test-rezept",
  name: "Test",
  typ: "favorit",
  protein: "hack",
  haltbarTage: 1,
  portionen: 4,
  dauerMin: 30,
  airfryer: false,
  tags: [],
  zutaten: [{ name: "Mehl", menge: 1.5, einheit: "EL", kategorie: "vorrat", frisch: false, vorrat: true }],
  schritte: ["Schritt eins."],
  variantenGruppen: [],
  ...overrides,
});

test("Anzahl Seiten = Rezepte ohne Varianten + Summe der Kombinationen", () => {
  const daten = echt();
  const erwartet = daten.rezepte.reduce((summe, r) => {
    const gruppen = r.variantenGruppen ?? [];
    return summe + (gruppen.length ? gruppen.reduce((p, g) => p * g.optionen.length, 1) : 1);
  }, 0);
  assert.equal(baueSeiten(daten).length, erwartet);
});

test("Dateinamen stimmen mit rezeptSeitenPfad überein und sind eindeutig", () => {
  const daten = echt();
  const namen = baueSeiten(daten).map((s) => s.dateiname);
  assert.equal(new Set(namen).size, namen.length);
  const r = daten.rezepte.find((x) => x.id === "nudel-baukasten");
  const erwartet = new Set(
    r.variantenGruppen[0].optionen.flatMap((b) =>
      r.variantenGruppen[1].optionen.map((s) => rezeptSeitenPfad({ quelle: "rezept", id: r.id, variante: { beilage: b.id, sosse: s.id } }).replace("rezepte/", "")),
    ),
  );
  assert.deepEqual(new Set(namen.filter((n) => n.startsWith("nudel-baukasten--"))), erwartet);
});

test("JSON-LD jeder Seite: parsebar, Recipe, Zutaten, Portionen, Zeit", () => {
  for (const { dateiname, html } of baueSeiten(echt())) {
    const ld = JSON.parse(ldJson(html));
    assert.equal(ld["@type"], "Recipe", dateiname);
    assert.ok(ld.recipeIngredient.length > 0, dateiname);
    assert.equal(ld.recipeYield, "4 Portionen", dateiname);
    assert.match(ld.totalTime, /^PT\d+M$/, dateiname);
  }
});

test("Varianten: Titel und Zutaten aus Basis plus Optionen", () => {
  const seiten = baueSeiten(echt()).filter((s) => s.dateiname.startsWith("nudel-baukasten--"));
  assert.equal(seiten.length, 8);
  const brokkoliSahne = seiten.find((s) => s.dateiname === "nudel-baukasten--brokkoli-sahne.html");
  const ld = JSON.parse(ldJson(brokkoliSahne.html));
  assert.match(ld.name, /^.+ \(Brokkoli, Sahnesoße\)$/);
  assert.ok(ld.recipeIngredient.some((z) => z.includes("Brokkoli")));
});

test("Mengen: Komma statt Punkt, ohne unnötige Nachkommastellen, null nur Name", () => {
  const [seite] = baueSeiten({ rezepte: [minimal({
    zutaten: [
      { name: "Mehl", menge: 1.5, einheit: "EL", kategorie: "vorrat", frisch: false, vorrat: true },
      { name: "Milch", menge: 500, einheit: "ml", kategorie: "kuehlregal", frisch: false, vorrat: false },
      { name: "Salz", menge: null, einheit: null, kategorie: "gewuerze", frisch: false, vorrat: true },
    ],
  })] });
  const ld = JSON.parse(ldJson(seite.html));
  assert.deepEqual(ld.recipeIngredient, ["1,5 EL Mehl", "500 ml Milch", "Salz"]);
  assert.ok(seite.html.includes("<li>1,5 EL Mehl</li>"));
});

test("HTML-Sonderzeichen werden escaped, </ im JSON-LD entschärft", () => {
  const [seite] = baueSeiten({ rezepte: [minimal({
    name: 'Tom & "Jerry" <b>x</b>',
    schritte: ["Gib </script><script>alert(1)</script> dazu."],
  })] });
  assert.ok(seite.html.includes("<title>Tom &amp; &quot;Jerry&quot; &lt;b&gt;x&lt;/b&gt;</title>"));
  assert.ok(!seite.html.includes("<b>x</b>"));
  const block = ldJson(seite.html);
  assert.ok(!block.includes("</"), "rohes </ im JSON-LD");
  assert.equal(JSON.parse(block).recipeInstructions[0].text, "Gib </script><script>alert(1)</script> dazu.");
});

test("Seite verlinkt CSS und Zurück-Link zum Plan", () => {
  const { html } = baueSeiten(echt())[0];
  assert.ok(html.includes('href="../css/rezept.css"'));
  assert.ok(html.includes('<a href="../index.html">Zurück zum Plan</a>'));
});

test("zweiter Lauf des Skripts ändert nichts", () => {
  const ziel = mkdtempSync(join(tmpdir(), "rezepte-"));
  try {
    const eingabe = new URL("../data/recipes.json", import.meta.url).pathname;
    const aufruf = () => spawnSync("node", [skript, eingabe, ziel], { encoding: "utf8" });
    assert.equal(aufruf().status, 0);
    const erster = Object.fromEntries(readdirSync(ziel).map((f) => [f, readFileSync(join(ziel, f), "utf8")]));
    assert.equal(aufruf().status, 0);
    const zweiter = Object.fromEntries(readdirSync(ziel).map((f) => [f, readFileSync(join(ziel, f), "utf8")]));
    assert.deepEqual(zweiter, erster);
  } finally {
    rmSync(ziel, { recursive: true, force: true });
  }
});

test("kollidierende Varianten-Dateinamen brechen ab, bevor vorhandene Seiten gelöscht werden", () => {
  const dir = mkdtempSync(join(tmpdir(), "rezepte-kollision-"));
  try {
    const r = echt().rezepte.find(r => r.typ === "favorit");
    const option = id => ({ id, name: id, zutaten: [r.zutaten[0]] });
    r.variantenGruppen = [
      { id: "eins", name: "Eins", optionen: [option("a-b"), option("a")] },
      { id: "zwei", name: "Zwei", optionen: [option("c"), option("b-c")] },
    ];
    const input = join(dir, "input.json");
    const output = join(dir, "pages");
    mkdirSync(output);
    writeFileSync(input, JSON.stringify({ version: 1, rezepte: [r] }));
    writeFileSync(join(output, "existing.html"), "Keep this page");
    const result = spawnSync("node", [skript, input, output], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /denselben Dateinamen/);
    assert.deepEqual(readdirSync(output), ["existing.html"]);
    assert.equal(readFileSync(join(output, "existing.html"), "utf8"), "Keep this page");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
