import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { einkaufsliste } from "../js/shopping.js";

const z = (name, menge, einheit, kategorie, frisch = false, vorrat = false) => ({ name, menge, einheit, kategorie, frisch, vorrat });
const rez = (id, name, zutaten, variantenGruppen = []) => ({ id, name, typ: "favorit", protein: "hack", haltbarTage: 3, portionen: 4, dauerMin: 30, airfryer: false, tags: [], zutaten, schritte: [], variantenGruppen });
const eintrag = (id, variante = null) => ({ quelle: "rezept", id, variante });
const state = { version: 1, aktuellerPlan: null, verlauf: [], favoriten: [], probiert: [], links: [{ id: "link-1", titel: "Gnocchi-Pfanne", url: "https://example.org/gnocchi", hinzugefuegt: "2026-11-01", geplantAm: null }] };
const plan = (a, b, c) => ({ wocheAb: "2026-11-22", erstellt: "x", neuSlot: null, slots: { A: a, B: b, C: c } });

const recipes = [
  rez("a", "Gericht A", [z("Rinderhack", 500, "g", "fleisch-fisch", true), z("Zwiebel", 2, "Stück", "obst-gemuese"), z("Salz", null, null, "gewuerze", false, true)]),
  rez("b", "Gericht B", [z("Rinderhack", 250, "g", "fleisch-fisch", true), z(" zwiebel ", 1, "Stück", "obst-gemuese"), z("Zwiebel", 1, "Bund", "obst-gemuese"), z("Salz", null, null, "gewuerze", false, true)]),
  rez("c", "Gericht C", [z("Lachsfilet", 4, "Stück", "fleisch-fisch", true), z("Reis", 300, "g", "vorrat"), z("Dill", 1, "Bund", "obst-gemuese", true), z("Zwiebel", 1, "Stück", "obst-gemuese")]),
];
const nach = (liste, name, einheit) => liste.find((p) => p.name.toLowerCase() === name.toLowerCase() && p.einheit === einheit);

test("Aufteilung: Samstag = A + B + haltbare C, Donnerstag = frische C", () => {
  const r = einkaufsliste({ plan: plan(eintrag("a"), eintrag("b"), eintrag("c")), recipes, state });
  assert.ok(nach(r.samstag, "Rinderhack", "g"));
  assert.ok(nach(r.samstag, "Reis", "g"));
  assert.ok(nach(r.samstag, "Zwiebel", "Stück"));
  assert.ok(!nach(r.samstag, "Lachsfilet", "Stück"));
  assert.ok(!nach(r.samstag, "Dill", "Bund") || nach(r.samstag, "Dill", "Bund").rezepte.every((n) => n !== "Gericht C"));
  assert.deepEqual(r.donnerstag.map((p) => p.name).sort(), ["Dill", "Lachsfilet"]);
  assert.deepEqual(r.links, []);
});

test("frische Zutaten von A und B gehen am Samstag auf die Liste", () => {
  const r = einkaufsliste({ plan: plan(eintrag("a"), eintrag("b"), eintrag("c")), recipes, state });
  assert.equal(nach(r.samstag, "Rinderhack", "g").menge, 750);
  assert.ok(!r.donnerstag.some((p) => p.name === "Rinderhack"));
});

test("Summieren: gleicher Name (getrimmt, ohne Groß/Klein) und Einheit; Rezeptnamen gesammelt", () => {
  const r = einkaufsliste({ plan: plan(eintrag("a"), eintrag("b"), eintrag("c")), recipes, state });
  const zw = nach(r.samstag, "zwiebel", "Stück");
  assert.equal(zw.menge, 2 + 1 + 1);
  assert.equal(zw.name, "Zwiebel");
  assert.deepEqual(zw.rezepte, ["Gericht A", "Gericht B", "Gericht C"]);
});

test("andere Einheit bleibt getrennt", () => {
  const r = einkaufsliste({ plan: plan(eintrag("a"), eintrag("b"), eintrag("c")), recipes, state });
  assert.equal(r.samstag.filter((p) => p.name.toLowerCase() === "zwiebel").length, 2);
  assert.equal(nach(r.samstag, "Zwiebel", "Bund").menge, 1);
});

test("menge null bleibt null", () => {
  const r = einkaufsliste({ plan: plan(eintrag("a"), eintrag("b"), eintrag("c")), recipes, state });
  const salz = nach(r.samstag, "Salz", null);
  assert.equal(salz.menge, null);
  assert.deepEqual(salz.rezepte, ["Gericht A", "Gericht B"]);
});

test("Posten-Felder", () => {
  const r = einkaufsliste({ plan: plan(eintrag("a"), eintrag("b"), eintrag("c")), recipes, state });
  assert.deepEqual(Object.keys(r.samstag[0]).sort(), ["einheit", "kategorie", "menge", "name", "rezepte", "vorrat"]);
  assert.equal(nach(r.samstag, "Salz", null).vorrat, true);
  assert.equal(nach(r.samstag, "Salz", null).kategorie, "gewuerze");
});

test("Kommazahlen werden ohne Rundungsfehler addiert", () => {
  const rs = [rez("x", "X", [z("Öl", 0.1, "EL", "vorrat"), z("Y", 1, "g", "vorrat"), z("Z", 1, "g", "vorrat")]), rez("y", "Y", [z("Öl", 0.2, "EL", "vorrat"), z("Y", 1, "g", "vorrat"), z("Z", 1, "g", "vorrat")])];
  const r = einkaufsliste({ plan: plan(eintrag("x"), eintrag("y"), null), recipes: rs, state });
  assert.equal(nach(r.samstag, "Öl", "EL").menge, 0.3);
});

test("Variantenzutaten sind enthalten (Basis + gewählte Optionen)", () => {
  const fix = JSON.parse(readFileSync(new URL("./fixtures/planer-rezepte.json", import.meta.url), "utf8")).rezepte;
  const e = eintrag("nudel-baukasten", { beilage: "bohnen", sosse: "tomate" });
  const r = einkaufsliste({ plan: plan(e, eintrag("lasagne"), null), recipes: fix, state });
  const namen = r.samstag.map((p) => p.name);
  assert.ok(namen.includes("Grüne Bohnen"));
  assert.ok(namen.includes("Passierte Tomaten"));
  assert.ok(namen.includes("Hähnchenbrust"));
  assert.ok(!namen.includes("Brokkoli"));
  assert.ok(!namen.includes("Kochsahne 15 %"));
});

test("Variante in Slot C: frische Optionszutat geht auf Donnerstag", () => {
  const fix = JSON.parse(readFileSync(new URL("./fixtures/planer-rezepte.json", import.meta.url), "utf8")).rezepte;
  const e = eintrag("nudel-baukasten", { beilage: "pilze", sosse: "sahne" });
  const r = einkaufsliste({ plan: plan(eintrag("lasagne"), eintrag("curry"), e), recipes: fix, state });
  assert.deepEqual(r.donnerstag.map((p) => p.name).sort(), ["Champignons", "Hähnchenbrust"]);
  assert.ok(r.samstag.some((p) => p.name === "Kochsahne 15 %"));
});

test("Sortierung: Kategorie-Reihenfolge, alphabetisch, Vorrat ans Ende", () => {
  const rs = [rez("s", "S", [
    z("Zimt", 1, "TL", "gewuerze", false, true),
    z("Mehl", 100, "g", "vorrat", false, true),
    z("Brot", 1, "Stück", "backwaren"),
    z("Erbsen", 200, "g", "tiefkuehl"),
    z("Joghurt", 1, "Packung", "kuehlregal"),
    z("Zucchini", 1, "Stück", "obst-gemuese"),
    z("Apfel", 2, "Stück", "obst-gemuese"),
    z("Lachs", 4, "Stück", "fleisch-fisch"),
    z("Basilikum", 1, "Bund", "obst-gemuese"),
    z("Reis", 1, "Packung", "vorrat"),
    z("Pfeffer", null, null, "gewuerze", false, true),
  ])];
  const r = einkaufsliste({ plan: plan(eintrag("s"), null, null), recipes: rs, state });
  assert.deepEqual(r.samstag.map((p) => p.name), ["Apfel", "Basilikum", "Zucchini", "Lachs", "Joghurt", "Brot", "Erbsen", "Reis", "Mehl", "Pfeffer", "Zimt"]);
});

test("Links stehen in links, nicht als Zutaten", () => {
  const p = plan(eintrag("a"), eintrag("b"), { quelle: "link", id: "link-1", variante: null });
  const r = einkaufsliste({ plan: p, recipes, state });
  assert.deepEqual(r.links, [{ titel: "Gnocchi-Pfanne", url: "https://example.org/gnocchi" }]);
  assert.deepEqual(r.donnerstag, []);
  assert.ok(!r.samstag.some((x) => x.name.includes("Gnocchi")));
});

test("Link in Slot A: Zutaten von B und C weiter korrekt", () => {
  const p = plan({ quelle: "link", id: "link-1", variante: null }, eintrag("b"), eintrag("c"));
  const r = einkaufsliste({ plan: p, recipes, state });
  assert.equal(r.links.length, 1);
  assert.equal(nach(r.samstag, "Rinderhack", "g").menge, 250);
  assert.equal(r.donnerstag.length, 2);
});

test("Eingaben werden nicht verändert", () => {
  const frieren = (o) => { Object.values(o).forEach((v) => v && typeof v === "object" && frieren(v)); return Object.freeze(o); };
  einkaufsliste({ plan: frieren(plan(eintrag("a"), eintrag("b"), eintrag("c"))), recipes: frieren(structuredClone(recipes)), state: frieren(structuredClone(state)) });
});
