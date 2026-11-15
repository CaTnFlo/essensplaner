import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SLOTS, erzeugeRng, naechsterSonntag, kandidaten, planeWoche, wuerfleSlot,
  setzeSlot, pruefePlan, uebernehmePlan, anzeigeName,
} from "../js/planner.js";

const recipes = JSON.parse(readFileSync(new URL("./fixtures/planer-rezepte.json", import.meta.url), "utf8")).rezepte;
const byId = Object.fromEntries(recipes.map((r) => [r.id, r]));
const favIds = new Set(recipes.filter((r) => r.typ === "favorit").map((r) => r.id));
const leer = () => ({ version: 1, aktuellerPlan: null, verlauf: [], favoriten: [], probiert: [], links: [] });
const HEUTE = new Date(2026, 10, 18, 12, 0, 0); // Mittwoch -> Woche ab 2026-11-22
const SEEDS = Array.from({ length: 500 }, (_, i) => i + 1);

const eintrag = (id, variante = null) => ({ quelle: "rezept", id, variante });
const planMit = (wocheAb, a, b, c, neuSlot = null) => ({
  wocheAb, erstellt: "2026-11-01T00:00:00.000Z", neuSlot,
  slots: { A: eintrag(a), B: eintrag(b), C: eintrag(c) },
});
const vorwoche = () => planMit("2026-11-15", "nudel-baukasten", "ofengemuese", "lasagne");
const stateMitVorwoche = () => ({ ...leer(), aktuellerPlan: vorwoche() });
const plane = (seed, state = leer(), rez = recipes) => planeWoche({ recipes: rez, state, heute: HEUTE, rng: erzeugeRng(seed) });
const ids = (plan) => ["A", "B", "C"].map((s) => plan.slots[s].id);
const proteine = (plan) => ids(plan).map((id) => byId[id]?.protein ?? "unbekannt");
const neuSlotsVon = (plan) => ["A", "B", "C"].filter((s) => !favIds.has(plan.slots[s].id));

test("SLOTS entspricht SPEC 2", () => {
  assert.deepEqual(SLOTS.A, { kochtag: "So", isstTage: ["So", "Mo"], minHaltbar: 1, neuErlaubt: true });
  assert.equal(SLOTS.B.minHaltbar, 3);
  assert.equal(SLOTS.B.neuErlaubt, false);
  assert.equal(SLOTS.C.kochtag, "Do");
});

test("erzeugeRng: gleicher Seed gleiche Folge, Werte in [0,1)", () => {
  const a = erzeugeRng(42), b = erzeugeRng(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(erzeugeRng(1)(), erzeugeRng(2)());
});

test("gleicher Seed, gleiche Eingabe -> identischer Plan", () => {
  for (const seed of [1, 7, 99]) assert.deepEqual(plane(seed), plane(seed));
  const verschieden = new Set(SEEDS.slice(0, 30).map((s) => JSON.stringify(plane(s).plan.slots)));
  assert.ok(verschieden.size > 5);
});

test("Plan-Grundform: wocheAb ist der nächste Sonntag", () => {
  const { plan } = plane(1);
  assert.equal(plan.wocheAb, "2026-11-22");
  assert.deepEqual(Object.keys(plan.slots), ["A", "B", "C"]);
});

test("500 Seeds: Slot B hat immer haltbarTage >= 3", () => {
  for (const seed of SEEDS) assert.ok(byId[plane(seed).plan.slots.B.id].haltbarTage >= 3, `Seed ${seed}`);
});

test("500 Seeds: genau ein neues Rezept, immer in neuSlot (A oder C), beide kommen vor", () => {
  const gesehen = new Set();
  for (const seed of SEEDS) {
    const { plan, hinweise } = plane(seed);
    assert.deepEqual(hinweise, []);
    assert.deepEqual(neuSlotsVon(plan), [plan.neuSlot], `Seed ${seed}`);
    assert.ok(["A", "C"].includes(plan.neuSlot));
    gesehen.add(plan.neuSlot);
  }
  assert.deepEqual([...gesehen].sort(), ["A", "C"]);
});

test("500 Seeds mit Vorwoche: keine Basis-ID der Vorwoche im Plan", () => {
  const sperre = new Set(["nudel-baukasten", "ofengemuese", "lasagne"]);
  for (const seed of SEEDS) {
    const { plan, hinweise } = plane(seed, stateMitVorwoche());
    assert.deepEqual(hinweise, []);
    for (const id of ids(plan)) assert.ok(!sperre.has(id), `Seed ${seed}: ${id}`);
  }
});

test("Vorwoche nur im Verlauf wird erkannt; gleiche oder spätere Woche zählt nicht", () => {
  const imVerlauf = { ...leer(), verlauf: [vorwoche()] };
  for (const seed of SEEDS.slice(0, 50)) assert.ok(!ids(plane(seed, imVerlauf).plan).includes("lasagne"));
  const gleicheWoche = { ...leer(), aktuellerPlan: { ...vorwoche(), wocheAb: "2026-11-22" } };
  const kamVor = new Set(SEEDS.slice(0, 200).flatMap((s) => ids(plane(s, gleicheWoche).plan)));
  assert.ok(kamVor.has("lasagne") || kamVor.has("nudel-baukasten"));
});

test("Vorwoche: der jüngste Plan zählt, nicht ältere", () => {
  const alt = planMit("2026-11-01", "curry", "chili-con-carne", "lachs-spinat-nudeln");
  const state = { ...leer(), aktuellerPlan: vorwoche(), verlauf: [alt] };
  const kam = new Set(SEEDS.slice(0, 200).flatMap((s) => ids(plane(s, state).plan)));
  assert.ok(kam.has("curry") && kam.has("chili-con-carne"));
});

test("500 Seeds: R4 erfüllt (mit und ohne Vorwoche)", () => {
  for (const state of [leer(), stateMitVorwoche()]) {
    for (const seed of SEEDS) {
      const p = proteine(plane(seed, state).plan);
      assert.ok(p.includes("fisch") || p.includes("gefluegel"), `Seed ${seed}: ${p}`);
    }
  }
});

test("500 Seeds: R5 verschiedene Gerichte, pruefePlan meldet nichts", () => {
  for (const seed of SEEDS) {
    const { plan } = plane(seed, stateMitVorwoche());
    assert.equal(new Set(ids(plan)).size, 3);
    assert.deepEqual(pruefePlan({ plan, recipes, state: stateMitVorwoche() }), []);
  }
});

test("Varianten: pro Gruppe genau eine gültige Option", () => {
  let gesehen = 0;
  for (const seed of SEEDS) {
    const { plan } = plane(seed);
    for (const s of ["A", "B", "C"]) {
      const e = plan.slots[s], r = byId[e.id];
      if (r.variantenGruppen.length) {
        gesehen++;
        assert.deepEqual(Object.keys(e.variante), r.variantenGruppen.map((g) => g.id));
        for (const g of r.variantenGruppen) assert.ok(g.optionen.some((o) => o.id === e.variante[g.id]));
      } else assert.equal(e.variante, null);
    }
  }
  assert.ok(gesehen > 0);
});

test("offener Link: ist immer das neue Rezept; Link mit geplantAm wird nicht gewählt", () => {
  const state = {
    ...leer(),
    links: [
      { id: "link-1", titel: "Gnocchi-Pfanne", url: "https://example.org/g", hinzugefuegt: "2026-11-01", geplantAm: null },
      { id: "link-2", titel: "Altes Ding", url: "https://example.org/a", hinzugefuegt: "2026-10-01", geplantAm: "2026-11-08" },
    ],
  };
  for (const seed of SEEDS) {
    const { plan } = plane(seed, state);
    const neu = plan.slots[plan.neuSlot];
    assert.deepEqual([neu.quelle, neu.id], ["link", "link-1"]);
    assert.ok(!ids(plan).includes("link-2"));
  }
});

test("nur benutzter Link vorhanden: wird nie gewählt, Pool springt ein", () => {
  const state = { ...leer(), links: [{ id: "link-2", titel: "x", url: "https://example.org", hinzugefuegt: "2026-10-01", geplantAm: "2026-11-08" }] };
  for (const seed of SEEDS.slice(0, 100)) {
    const { plan } = plane(seed, state);
    assert.ok(!ids(plan).includes("link-2"));
    assert.equal(byId[plan.slots[plan.neuSlot].id].typ, "pool");
  }
});

test("Pool: nicht probierte vor probierten; Favoriten nie neu", () => {
  const poolIds = recipes.filter((r) => r.typ === "pool").map((r) => r.id);
  const state = { ...leer(), probiert: poolIds.slice(1) };
  for (const seed of SEEDS) {
    const { plan } = plane(seed, state);
    assert.equal(plan.slots[plan.neuSlot].id, poolIds[0]);
  }
  const alleProbiert = { ...leer(), probiert: poolIds };
  const neu = new Set(SEEDS.map((s) => { const { plan } = plane(s, alleProbiert); return plan.slots[plan.neuSlot].id; }));
  assert.ok(neu.size > 1);
  for (const id of neu) assert.ok(poolIds.includes(id) && !favIds.has(id));
});

test("Pool-Rezept in state.favoriten gilt als Favorit", () => {
  const state = { ...leer(), favoriten: ["forelle-kartoffeln"] };
  const k = kandidaten(recipes, state).find((x) => x.id === "forelle-kartoffeln");
  assert.equal(k.istFavorit, true);
  assert.equal(k.istNeuKandidat, false);
  let alsFavorit = 0;
  for (const seed of SEEDS) {
    const { plan } = plane(seed, state);
    assert.notEqual(plan.slots[plan.neuSlot].id, "forelle-kartoffeln");
    if (ids(plan).includes("forelle-kartoffeln")) alsFavorit++;
  }
  // haltbarTage 2: nur in einem Slot ohne Slot B möglich
  assert.ok(alsFavorit > 0);
});

test("Link in state.favoriten gilt als Favorit, nicht als neu", () => {
  const state = { ...leer(), favoriten: ["link-9"], links: [{ id: "link-9", titel: "Fav-Link", url: "https://example.org", hinzugefuegt: "2026-10-01", geplantAm: "2026-11-01" }] };
  const k = kandidaten(recipes, state).find((x) => x.id === "link-9");
  assert.deepEqual([k.quelle, k.istFavorit, k.istNeuKandidat, k.haltbarTage, k.protein], ["link", true, false, 1, "unbekannt"]);
});

test("kandidaten: Priorität und Felder", () => {
  const state = {
    ...leer(), probiert: ["lachs-ofen"],
    links: [{ id: "link-1", titel: "L", url: "https://example.org", hinzugefuegt: "2026-11-01", geplantAm: null }],
  };
  const k = Object.fromEntries(kandidaten(recipes, state).map((x) => [x.id, x]));
  assert.equal(k["link-1"].prioritaet, 1);
  assert.equal(k["forelle-kartoffeln"].prioritaet, 2);
  assert.equal(k["lachs-ofen"].prioritaet, 3);
  assert.equal(k["lasagne"].prioritaet, 0);
  assert.deepEqual(Object.keys(k["lasagne"]).sort(), ["haltbarTage", "id", "istFavorit", "istNeuKandidat", "name", "prioritaet", "protein", "quelle"]);
});

test("nur 2 Favoriten und Vorwoche: Plan trotzdem, Hinweis 'gelockert', kein Fehler", () => {
  const wenig = recipes.filter((r) => r.typ === "pool" || ["lasagne", "lachs-spinat-nudeln"].includes(r.id));
  const state = { ...leer(), aktuellerPlan: planMit("2026-11-15", "lasagne", "lachs-spinat-nudeln", "rind-wok") };
  for (const seed of SEEDS.slice(0, 100)) {
    const { plan, hinweise } = plane(seed, state, wenig);
    assert.ok(hinweise.some((h) => h.includes("gelockert")), `Seed ${seed}`);
    assert.ok(hinweise[0].includes("Vorwoche"));
    for (const s of ["A", "B", "C"]) assert.ok(plan.slots[s]);
    assert.ok(byId[plan.slots.B.id].haltbarTage >= 3);
  }
});

test("nur 2 Favoriten ohne Vorwoche: kein Hinweis nötig", () => {
  const wenig = recipes.filter((r) => r.typ === "pool" || ["lasagne", "lachs-spinat-nudeln"].includes(r.id));
  assert.deepEqual(plane(1, leer(), wenig).hinweise, []);
});

test("extreme Fälle stürzen nicht ab: 1 Favorit, kein Favorit, keine Rezepte", () => {
  const pool = recipes.filter((r) => r.typ === "pool");
  const eins = recipes.filter((r) => r.id === "lasagne");
  for (const rez of [[...eins, ...pool.slice(0, 1)], pool, eins, []]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { plan, hinweise } = plane(seed, stateMitVorwoche(), rez);
      assert.ok(plan.wocheAb);
      if (rez.length < 3) assert.ok(hinweise.some((h) => h.includes("gelockert")));
    }
  }
  const { plan } = plane(1, leer(), []);
  assert.deepEqual(plan.slots, { A: null, B: null, C: null });
  assert.deepEqual(pruefePlan({ plan, recipes: [], state: leer() }), []);
});

test("wuerfleSlot: ändert nur den gewünschten Slot und hält die Regeln", () => {
  const state = stateMitVorwoche();
  for (const seed of SEEDS.slice(0, 150)) {
    const { plan } = plane(seed, state);
    for (const slot of ["A", "B", "C"]) {
      const res = wuerfleSlot({ recipes, state, plan, slot, rng: erzeugeRng(seed + 1000) });
      for (const s of ["A", "B", "C"]) {
        if (s !== slot) assert.deepEqual(res.plan.slots[s], plan.slots[s]);
      }
      assert.notEqual(res.plan.slots[slot].id, plan.slots[slot].id, `Seed ${seed} Slot ${slot}`);
      if (res.hinweise.length) {
        // Gelockert nur, wenn es sonst keine Alternative gab
        assert.ok(res.hinweise.every((h) => h.includes("gelockert")));
      } else {
        assert.deepEqual(pruefePlan({ plan: res.plan, recipes, state }), [], `Seed ${seed} Slot ${slot}`);
      }
      assert.equal(res.plan.neuSlot, plan.neuSlot);
      if (!res.hinweise.length) assert.deepEqual(neuSlotsVon(res.plan), [plan.neuSlot]);
    }
  }
});

test("wuerfleSlot ist deterministisch und mutiert die Eingabe nicht", () => {
  const { plan } = plane(3);
  const kopie = structuredClone(plan);
  const a = wuerfleSlot({ recipes, state: leer(), plan, slot: "B", rng: erzeugeRng(5) });
  const b = wuerfleSlot({ recipes, state: leer(), plan, slot: "B", rng: erzeugeRng(5) });
  assert.deepEqual(a, b);
  assert.deepEqual(plan, kopie);
});

test("wuerfleSlot: neuer Slot bekommt wieder ein neues Rezept (offene Links zuerst)", () => {
  const state = {
    ...leer(),
    links: [
      { id: "link-1", titel: "A", url: "https://example.org/1", hinzugefuegt: "2026-11-01", geplantAm: null },
      { id: "link-2", titel: "B", url: "https://example.org/2", hinzugefuegt: "2026-11-01", geplantAm: null },
    ],
  };
  const { plan } = plane(11, state);
  const alt = plan.slots[plan.neuSlot].id;
  const res = wuerfleSlot({ recipes, state, plan, slot: plan.neuSlot, rng: erzeugeRng(1) });
  const neu = res.plan.slots[plan.neuSlot];
  assert.equal(neu.quelle, "link");
  assert.notEqual(neu.id, alt);
});

test("wuerfleSlot ohne Alternative: Plan bleibt, Hinweis", () => {
  const nur = recipes.filter((r) => ["lasagne", "curry", "lachs-ofen"].includes(r.id));
  const { plan } = plane(2, leer(), nur);
  const slot = plan.neuSlot === "A" ? "C" : "A"; // Favorit-Slot; nur 3 Favoriten, alle verbraucht
  const res = wuerfleSlot({ recipes: nur, state: leer(), plan, slot, rng: erzeugeRng(1) });
  assert.deepEqual(res.plan, plan);
  assert.ok(res.hinweise.some((h) => h.startsWith("Keine andere Möglichkeit gefunden")));
});

test("pruefePlan: gültiger Plan -> leeres Array", () => {
  const plan = planMit("2026-11-22", "lachs-spinat-nudeln", "lasagne", "nudel-baukasten");
  assert.deepEqual(pruefePlan({ plan, recipes, state: leer() }), []);
});

test("pruefePlan: je ein Verstoß gegen R1, R3, R4, R5", () => {
  const p = (plan, state = leer()) => pruefePlan({ plan, recipes, state });

  const r1 = p(planMit("2026-11-22", "curry", "lachs-spinat-nudeln", "nudel-baukasten"));
  assert.equal(r1.length, 1);
  assert.match(r1[0], /Haltbarkeit/);

  const r3 = p(planMit("2026-11-22", "lachs-spinat-nudeln", "lasagne", "nudel-baukasten"), stateMitVorwoche());
  assert.equal(r3.length, 2); // nudel-baukasten und lasagne waren in der Vorwoche
  const r3eins = p(planMit("2026-11-22", "lachs-spinat-nudeln", "curry", "nudel-baukasten"), { ...leer(), aktuellerPlan: planMit("2026-11-15", "chili-con-carne", "lasagne", "nudel-baukasten") });
  assert.equal(r3eins.length, 1);
  assert.match(r3eins[0], /Vorwoche/);

  const r4 = p(planMit("2026-11-22", "hack-brokkoli-auflauf", "lasagne", "chili-con-carne"));
  assert.equal(r4.length, 1);
  assert.match(r4[0], /Fisch oder Geflügel/);

  const r5 = p(planMit("2026-11-22", "lasagne", "lasagne", "lachs-spinat-nudeln"));
  assert.equal(r5.length, 1);
  assert.match(r5[0], /mehrfach/);
});

test("pruefePlan: Varianten zählen als dasselbe Gericht (R5, R3)", () => {
  const plan = {
    wocheAb: "2026-11-22", erstellt: "x", neuSlot: null,
    slots: {
      A: eintrag("nudel-baukasten", { beilage: "brokkoli", sosse: "sahne" }),
      B: eintrag("lasagne"),
      C: eintrag("nudel-baukasten", { beilage: "bohnen", sosse: "tomate" }),
    },
  };
  const m = pruefePlan({ plan, recipes, state: leer() });
  assert.equal(m.length, 1);
  assert.match(m[0], /mehrfach/);
  const vor = { ...leer(), aktuellerPlan: planMit("2026-11-15", "nudel-baukasten", "curry", "chili-con-carne") };
  assert.ok(pruefePlan({ plan, recipes, state: vor }).some((x) => x.includes("Vorwoche")));
});

test("pruefePlan: Link zählt als haltbarTage 1 und protein unbekannt", () => {
  const state = { ...leer(), links: [{ id: "link-1", titel: "Gnocchi", url: "https://example.org", hinzugefuegt: "2026-11-01", geplantAm: null }] };
  const plan = { wocheAb: "2026-11-22", erstellt: "x", neuSlot: "A", slots: { A: eintrag("lasagne"), B: { quelle: "link", id: "link-1", variante: null }, C: eintrag("chili-con-carne") } };
  const m = pruefePlan({ plan, recipes, state });
  assert.ok(m.some((x) => x.includes("Haltbarkeit") && x.includes("Gnocchi")));
  assert.ok(m.some((x) => x.includes("Fisch oder Geflügel")));
});

test("naechsterSonntag: lokale Zeit", () => {
  assert.equal(naechsterSonntag(new Date(2026, 10, 18)), "2026-11-22");
  assert.equal(naechsterSonntag(new Date(2026, 10, 21)), "2026-11-22");
  assert.equal(naechsterSonntag(new Date(2026, 10, 22)), "2026-11-22");
  assert.equal(naechsterSonntag(new Date(2026, 10, 22, 0, 5)), "2026-11-22");
  assert.equal(naechsterSonntag(new Date(2026, 10, 22, 23, 59)), "2026-11-22");
  assert.equal(naechsterSonntag(new Date(2026, 10, 23)), "2026-11-29");
  assert.equal(naechsterSonntag(new Date(2026, 11, 30)), "2027-01-03");
  assert.equal(naechsterSonntag(new Date(2026, 2, 25, 23, 30)), "2026-03-29"); // Zeitumstellung
});

test("setzeSlot: neuer Plan, Original unverändert", () => {
  const plan = planMit("2026-11-22", "lachs-spinat-nudeln", "lasagne", "nudel-baukasten", "A");
  const kopie = structuredClone(plan);
  const e = eintrag("curry");
  const neu = setzeSlot(plan, "B", e);
  assert.deepEqual(plan, kopie);
  assert.equal(neu.slots.B.id, "curry");
  assert.equal(neu.slots.A.id, "lachs-spinat-nudeln");
  e.id = "x";
  assert.equal(neu.slots.B.id, "curry");
});

test("anzeigeName: ohne und mit Varianten, Link", () => {
  const state = { ...leer(), links: [{ id: "link-1", titel: "Gnocchi-Pfanne", url: "https://example.org", hinzugefuegt: "2026-11-01", geplantAm: null }] };
  assert.equal(anzeigeName(eintrag("lasagne"), recipes, state), "Lasagne Bolognese");
  assert.equal(anzeigeName(eintrag("nudel-baukasten", { beilage: "brokkoli", sosse: "sahne" }), recipes, state), "Nudeln mit Hähnchen (Brokkoli, Sahnesoße)");
  assert.equal(anzeigeName(eintrag("ofengemuese", { dazu: "beides" }), recipes, state), "Ofengemüse mit Kartoffeln und Süßkartoffeln (Grillsteak und Ofenkäse)");
  assert.equal(anzeigeName({ quelle: "link", id: "link-1", variante: null }, recipes, state), "Gnocchi-Pfanne");
});

test("uebernehmePlan: gleiche Woche ersetzt ohne Verlauf", () => {
  const alt = planMit("2026-11-22", "lasagne", "curry", "lachs-spinat-nudeln", "C");
  const state = { ...leer(), aktuellerPlan: alt, verlauf: [vorwoche()] };
  const neu = planMit("2026-11-22", "chili-con-carne", "curry", "nudel-baukasten", "A");
  const res = uebernehmePlan(state, neu);
  assert.deepEqual(res.aktuellerPlan, { ...neu, probiertHinzugefuegt: true });
  assert.equal(res.verlauf.length, 1);
});

test("uebernehmePlan: neue Woche schiebt in den Verlauf, max. 8", () => {
  let state = leer();
  for (let i = 0; i < 12; i++) {
    const wocheAb = new Date(Date.UTC(2026, 8, 6 + 7 * i)).toISOString().slice(0, 10);
    state = uebernehmePlan(state, planMit(wocheAb, "lasagne", "curry", "lachs-spinat-nudeln"));
  }
  assert.equal(state.verlauf.length, 8);
  assert.equal(state.aktuellerPlan.wocheAb, "2026-11-22");
  assert.equal(state.verlauf.at(-1).wocheAb, "2026-11-15");
  assert.equal(state.verlauf[0].wocheAb, "2026-09-27");
});

test("uebernehmePlan: Link bekommt geplantAm", () => {
  const state = { ...leer(), links: [{ id: "link-1", titel: "G", url: "https://example.org", hinzugefuegt: "2026-11-01", geplantAm: null }, { id: "link-2", titel: "H", url: "https://example.org", hinzugefuegt: "2026-11-01", geplantAm: null }] };
  const plan = { ...planMit("2026-11-22", "lasagne", "curry", "lachs-spinat-nudeln", "A"), slots: { A: { quelle: "link", id: "link-1", variante: null }, B: eintrag("curry"), C: eintrag("lachs-spinat-nudeln") } };
  const res = uebernehmePlan(state, plan);
  assert.equal(res.links[0].geplantAm, "2026-11-22");
  assert.equal(res.links[1].geplantAm, null);
  assert.deepEqual(res.probiert, []);
});

test("uebernehmePlan: Pool-ID landet einmal in probiert", () => {
  const plan = planMit("2026-11-22", "lasagne", "curry", "lachs-ofen", "C");
  const einmal = uebernehmePlan(leer(), plan);
  assert.deepEqual(einmal.probiert, ["lachs-ofen"]);
  const zweimal = uebernehmePlan(einmal, plan);
  assert.deepEqual(zweimal.probiert, ["lachs-ofen"]);
  const andere = uebernehmePlan(zweimal, planMit("2026-11-29", "lasagne", "curry", "rind-wok", "C"));
  assert.deepEqual(andere.probiert, ["lachs-ofen", "rind-wok"]);
});

test("Eingaben werden nie verändert (eingefroren)", () => {
  const frieren = (o) => { Object.values(o).forEach((v) => v && typeof v === "object" && frieren(v)); return Object.freeze(o); };
  const rez = frieren(structuredClone(recipes));
  const state = frieren({ ...structuredClone(stateMitVorwoche()), links: [{ id: "link-1", titel: "G", url: "https://example.org", hinzugefuegt: "2026-11-01", geplantAm: null }] });
  const heute = new Date(2026, 10, 18);
  const { plan } = planeWoche({ recipes: rez, state, heute, rng: erzeugeRng(4) });
  frieren(plan);
  wuerfleSlot({ recipes: rez, state, plan, slot: "B", rng: erzeugeRng(4) });
  setzeSlot(plan, "A", eintrag("curry"));
  pruefePlan({ plan, recipes: rez, state });
  uebernehmePlan(state, plan);
  kandidaten(rez, state);
});

// ---------- P6b Frage 2: verworfenes neues Rezept zurücknehmen ----------

const LINK = (id) => ({ id, titel: `Link ${id}`, url: "https://example.org", hinzugefuegt: "2026-11-01", geplantAm: null });
const linkEintrag = (id) => ({ quelle: "link", id, variante: null });
const planNeu = (wocheAb, neuSlot, neu, extra = {}) => {
  const p = planMit(wocheAb, "lasagne", "curry", "lachs-spinat-nudeln", neuSlot);
  p.slots[neuSlot] = neu;
  return { ...p, ...extra };
};

test("uebernehmePlan: gleiche Woche, anderes neues Rezept -> alter Link wieder offen", () => {
  const alt = planNeu("2026-11-22", "C", linkEintrag("link-1"));
  const state = { ...leer(), links: [LINK("link-1")] };
  const mitAlt = uebernehmePlan(state, alt);
  assert.equal(mitAlt.links[0].geplantAm, "2026-11-22");
  const neu = planNeu("2026-11-22", "A", eintrag("chili-con-carne"));
  const res = uebernehmePlan(mitAlt, neu);
  assert.equal(res.links[0].geplantAm, null);
});

test("uebernehmePlan: gleiche Woche, beide Pläne mit demselben Link -> geplantAm bleibt", () => {
  const state = { ...leer(), links: [LINK("link-1")] };
  const alt = uebernehmePlan(state, planNeu("2026-11-22", "C", linkEintrag("link-1")));
  const res = uebernehmePlan(alt, planNeu("2026-11-22", "C", linkEintrag("link-1")));
  assert.equal(res.links[0].geplantAm, "2026-11-22");
});

test("uebernehmePlan: gleiche Woche, altes Pool-Rezept mit probiertHinzugefuegt true -> aus probiert entfernt", () => {
  const alt = uebernehmePlan(leer(), planNeu("2026-11-22", "C", eintrag("lachs-ofen")));
  assert.deepEqual(alt.probiert, ["lachs-ofen"]);
  const res = uebernehmePlan(alt, planNeu("2026-11-22", "A", eintrag("chili-con-carne")));
  assert.deepEqual(res.probiert, ["chili-con-carne"]);
});

test("uebernehmePlan: gleiche Woche, altes Pool-Rezept mit probiertHinzugefuegt false -> bleibt in probiert", () => {
  const state = { ...leer(), probiert: ["lachs-ofen"] };
  const alt = uebernehmePlan(state, planNeu("2026-11-22", "C", eintrag("lachs-ofen")));
  assert.equal(alt.aktuellerPlan.probiertHinzugefuegt, false);
  const res = uebernehmePlan(alt, planNeu("2026-11-22", "A", eintrag("chili-con-carne")));
  assert.ok(res.probiert.includes("lachs-ofen"));
});

test("uebernehmePlan: gleiche Woche, dasselbe neue Rezept nochmal -> probiert-Herkunft bleibt erhalten", () => {
  const alt = uebernehmePlan(leer(), planNeu("2026-11-22", "C", eintrag("lachs-ofen")));
  const again = uebernehmePlan(alt, planNeu("2026-11-22", "C", eintrag("lachs-ofen")));
  assert.equal(again.aktuellerPlan.probiertHinzugefuegt, true);
  const res = uebernehmePlan(again, planNeu("2026-11-22", "A", eintrag("chili-con-carne")));
  assert.deepEqual(res.probiert, ["chili-con-carne"]);
});

test("uebernehmePlan: andere Woche -> nichts wird zurückgenommen", () => {
  const state = { ...leer(), links: [LINK("link-1")] };
  const alt = uebernehmePlan(state, planNeu("2026-11-15", "C", linkEintrag("link-1")));
  assert.equal(alt.links[0].geplantAm, "2026-11-15");
  const res = uebernehmePlan(alt, planNeu("2026-11-22", "A", eintrag("chili-con-carne")));
  assert.equal(res.links[0].geplantAm, "2026-11-15");
  assert.equal(res.verlauf.length, 1);
  const pool = uebernehmePlan(leer(), planNeu("2026-11-15", "C", eintrag("lachs-ofen")));
  const pool2 = uebernehmePlan(pool, planNeu("2026-11-22", "A", eintrag("chili-con-carne")));
  assert.deepEqual(pool2.probiert, ["lachs-ofen", "chili-con-carne"]);
});

test("uebernehmePlan: alter Plan ohne Feld probiertHinzugefuegt -> kein Fehler, Pool-ID bleibt", () => {
  const state = { ...leer(), probiert: ["lachs-ofen"], aktuellerPlan: planNeu("2026-11-22", "C", eintrag("lachs-ofen")) };
  assert.equal("probiertHinzugefuegt" in state.aktuellerPlan, false);
  const res = uebernehmePlan(state, planNeu("2026-11-22", "A", eintrag("chili-con-carne")));
  assert.ok(res.probiert.includes("lachs-ofen"));
});

// ---------- P8: Lockerung nur so weit wie nötig ----------

test("R3 nur für Slot B nötig: Favoriten-Slot A/C nimmt trotzdem kein Vorwochengericht", () => {
  // B-taugliche Favoriten (haltbarTage >= 3): nur lasagne und curry, beide in der Vorwoche -> R3 muss für B gelockert werden.
  // Für A/C sind lachs-spinat-nudeln und ofengemuese frei, nudel-baukasten stand in der Vorwoche.
  const rez = recipes.filter((r) => r.typ === "pool" || ["lasagne", "curry", "lachs-spinat-nudeln", "nudel-baukasten", "ofengemuese"].includes(r.id));
  const state = { ...leer(), aktuellerPlan: planMit("2026-11-15", "nudel-baukasten", "lasagne", "curry") };
  for (const seed of SEEDS.slice(0, 200)) {
    const { plan, hinweise } = plane(seed, state, rez);
    const favSlot = plan.neuSlot === "A" ? "C" : "A";
    assert.notEqual(plan.slots[favSlot].id, "nudel-baukasten", `Seed ${seed}`);
    assert.deepEqual(hinweise, ["Regel 'keine Wiederholung aus Vorwoche' gelockert: zu wenige Favoriten"], `Seed ${seed}`);
  }
});

test("nur R2 unlösbar (alle Rezepte Favoriten): R3 und R4 bleiben erfüllt, nur R2-Hinweis", () => {
  const state = { ...leer(), favoriten: recipes.filter((r) => r.typ === "pool").map((r) => r.id), aktuellerPlan: vorwoche() };
  for (const seed of SEEDS.slice(0, 200)) {
    const { plan, hinweise } = plane(seed, state);
    assert.deepEqual(pruefePlan({ plan, recipes, state }), [], `Seed ${seed}`);
    assert.deepEqual(hinweise, ["Regel 'genau ein neues Rezept' gelockert: keine passende Kombination"], `Seed ${seed}`);
    assert.equal(plan.neuSlot, null);
  }
});

test("Lockerungsreihenfolge: R4 wird erst gelockert, wenn es ohne nicht geht, Hinweis passt zum Plan", () => {
  // Kein Fisch und kein Geflügel vorhanden: R4 ist unlösbar, R3 nicht.
  const rez = recipes.filter((r) => !["fisch", "gefluegel"].includes(r.protein));
  for (const seed of SEEDS.slice(0, 100)) {
    const { plan, hinweise } = plane(seed, leer(), rez);
    assert.deepEqual(hinweise, ["Regel 'mindestens ein Fisch- oder Geflügelgericht' gelockert: keine passende Kombination"]);
    assert.ok(plan.neuSlot === "A" || plan.neuSlot === "C");
  }
});

test("wuerfleSlot bis R2 gelockert: neuSlot wird neu berechnet, Favorit landet nicht in probiert", () => {
  // Alle Pool-Rezepte außer lachs-ofen sind Favoriten; lachs-ofen steht im Neu-Slot C. Neu würfeln findet kein neues Rezept.
  const state = { ...leer(), favoriten: recipes.filter((r) => r.typ === "pool" && r.id !== "lachs-ofen").map((r) => r.id) };
  const plan = planMit("2026-11-22", "nudel-baukasten", "lasagne", "lachs-ofen", "C");
  const vorher = uebernehmePlan(state, plan);
  assert.ok(vorher.probiert.includes("lachs-ofen"));
  const res = wuerfleSlot({ recipes, state: vorher, plan: vorher.aktuellerPlan, slot: "C", rng: erzeugeRng(3) });
  assert.notEqual(res.plan.slots.C.id, "lachs-ofen");
  assert.equal(res.plan.neuSlot, null);
  assert.ok(res.hinweise.includes("Regel 'genau ein neues Rezept' gelockert: keine passende Kombination"));
  const nachher = uebernehmePlan(vorher, res.plan);
  assert.ok(!nachher.probiert.includes(res.plan.slots.C.id));
  assert.ok(!nachher.probiert.includes("lachs-ofen"), "verworfenes neues Rezept wird zurückgenommen");
});

test("uebernehmePlan: altes neues Rezept steht noch im Plan -> nichts zurücknehmen", () => {
  const link = { id: "link-1", titel: "L", url: "https://example.org", hinzugefuegt: "2026-11-01", geplantAm: null };
  const plan = { ...planMit("2026-11-22", "x", "lasagne", "curry", "A"), slots: { A: { quelle: "link", id: "link-1", variante: null }, B: eintrag("lasagne"), C: eintrag("curry") } };
  const s1 = uebernehmePlan({ ...leer(), links: [link] }, plan);
  assert.equal(s1.links[0].geplantAm, "2026-11-22");
  const s2 = uebernehmePlan(s1, { ...s1.aktuellerPlan, neuSlot: null });
  assert.equal(s2.links[0].geplantAm, "2026-11-22");
});
