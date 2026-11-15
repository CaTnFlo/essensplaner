import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validiere } from "../scripts/validate-recipes.mjs";

const lade = (pfad) => JSON.parse(readFileSync(new URL(pfad, import.meta.url), "utf8"));
const gueltig = () => lade("./fixtures/recipes-gueltig.json");
const ungueltig = () => lade("./fixtures/recipes-ungueltig.json");
const skript = new URL("../scripts/validate-recipes.mjs", import.meta.url).pathname;
const lauf = (...args) => spawnSync("node", [skript, ...args], { encoding: "utf8" });
const fix = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

test("gültige Fixture hat keine Fehler", () => {
  assert.deepEqual(validiere(gueltig()), []);
});

test("leere Rezeptliste ist gültig", () => {
  assert.deepEqual(validiere({ version: 1, rezepte: [] }), []);
});

test("falsche Version und fehlendes Array werden gemeldet", () => {
  assert.ok(validiere({ version: 2, rezepte: [] }).some((f) => f.startsWith("version:")));
  assert.ok(validiere({ version: 1 }).some((f) => f.startsWith("rezepte:")));
});

test("unerlaubte Einheit nennt Rezept-ID und Feld", () => {
  const f = validiere(ungueltig());
  assert.ok(f.includes('fall-einheit.zutaten[0].einheit: "gramm" ist keine erlaubte Einheit'));
});

test("ID nicht kebab-case", () => {
  assert.ok(validiere(ungueltig()).some((f) => f.includes("Fall_ID.id") && f.includes("kebab-case")));
});

test("doppelte Rezept-ID", () => {
  assert.ok(validiere(ungueltig()).some((f) => f.startsWith("fall-doppelt.id") && f.includes("mehrfach")));
});

test("Enums und Bereiche (typ, protein, haltbarTage, portionen, dauerMin, airfryer, tags)", () => {
  const f = validiere(ungueltig()).filter((x) => x.startsWith("fall-bereiche."));
  for (const feld of ["typ", "protein", "haltbarTage", "portionen", "dauerMin", "airfryer", "tags[0]"]) {
    assert.ok(f.some((x) => x.startsWith(`fall-bereiche.${feld}:`)), `Fehler für ${feld} fehlt`);
  }
});

test("zu wenige Zutaten und Schritte", () => {
  const f = validiere(ungueltig());
  assert.ok(f.some((x) => x.startsWith("fall-zutaten.zutaten:")));
  assert.ok(f.some((x) => x.startsWith("fall-zutaten.schritte:")));
});

test("Tag schnell ist bei 30 Minuten erlaubt und oberhalb davon ungültig", () => {
  const d = gueltig();
  const r = d.rezepte[0];
  r.tags = ["schnell"];
  r.dauerMin = 30;
  assert.deepEqual(validiere(d), []);
  r.dauerMin = 31;
  assert.ok(validiere(d).some(f => f.startsWith(`${r.id}.tags[0]:`) && f.includes("dauerMin <= 30")));
  r.tags = [];
  assert.deepEqual(validiere(d), []);
});

test("einheit ist genau dann null, wenn menge null ist", () => {
  const f = validiere(ungueltig());
  assert.ok(f.some((x) => x.startsWith("fall-menge-einheit.zutaten[0].einheit:")));
  assert.ok(f.some((x) => x.startsWith("fall-menge-einheit.zutaten[1].einheit:")));
  assert.ok(f.some((x) => x.startsWith("fall-menge-einheit.zutaten[2].menge:")));
  assert.ok(f.some((x) => x.startsWith("fall-menge-einheit.zutaten[2].kategorie:")));
  assert.ok(f.some((x) => x.startsWith("fall-menge-einheit.zutaten[2].frisch:")));
});

test("Options-IDs je Gruppe eindeutig, Optionen brauchen Zutaten", () => {
  const f = validiere(ungueltig());
  assert.ok(f.some((x) => x.includes("fall-varianten.variantenGruppen[0].optionen[1].id") && x.includes("mehrfach")));
  assert.ok(f.some((x) => x.includes("fall-varianten.variantenGruppen[0].optionen[1].zutaten")));
});

test("ohne --voll werden Vollständigkeitsregeln übersprungen, mit --voll nicht", () => {
  const d = gueltig();
  assert.deepEqual(validiere(d), []);
  const voll = validiere(d, { voll: true });
  assert.ok(voll.some((x) => x.startsWith("curry:") && x.includes("Favorit fehlt")));
  assert.ok(voll.some((x) => x.startsWith("Pool:") && x.includes("genau 30")));
});

test("--voll prüft protein und haltbarTage der Favoriten", () => {
  const d = gueltig();
  d.rezepte.find((r) => r.id === "lasagne").haltbarTage = 2;
  d.rezepte.find((r) => r.id === "lasagne").protein = "rind";
  const f = validiere(d, { voll: true });
  assert.ok(f.some((x) => x.startsWith("lasagne.haltbarTage:")));
  assert.ok(f.some((x) => x.startsWith("lasagne.protein:")));
});

test("--voll prüft Variantengruppen und Options-IDs", () => {
  const d = gueltig();
  d.rezepte.find((r) => r.id === "nudel-baukasten").variantenGruppen[0].optionen.pop();
  const f = validiere(d, { voll: true });
  assert.ok(f.some((x) => x.startsWith("nudel-baukasten.variantenGruppen[beilage].optionen:")));
});

test("Skript: Exit-Codes und Ausgabe", () => {
  const ok = lauf(fix("recipes-gueltig.json"));
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /^OK: 3 Rezepte \(2 Favoriten, 1 Pool\)/);
  const bad = lauf(fix("recipes-ungueltig.json"));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /fall-einheit\.zutaten\[0\]\.einheit/);
  assert.equal(lauf(fix("recipes-gueltig.json"), "--voll").status, 1);
});
