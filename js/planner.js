// Reine Planungslogik (SPEC 3, 4.4, 5.1). Kein DOM, kein Netzwerk, kein Speicher.
// Zufall nur über die übergebene Funktion rng().

export const SLOTS = {
  A: { kochtag: "So", isstTage: ["So", "Mo"], minHaltbar: 1, neuErlaubt: true },
  B: { kochtag: "So", isstTage: ["Di", "Mi"], minHaltbar: 3, neuErlaubt: false },
  C: { kochtag: "Do", isstTage: ["Do", "Fr"], minHaltbar: 1, neuErlaubt: true },
};

const SLOT_IDS = ["A", "B", "C"];
const R4_PROTEIN = ["fisch", "gefluegel"];
const VERSUCHE = 200;

// Lockerungsstufen aus SPEC 3: zuerst R3, dann R4, dann R2.
const STUFEN = [{}, { r3: true }, { r3: true, r4: true }, { r3: true, r4: true, r2: true }];
const HINWEIS = {
  r3: "Regel 'keine Wiederholung aus Vorwoche' gelockert: zu wenige Favoriten",
  r4: "Regel 'mindestens ein Fisch- oder Geflügelgericht' gelockert: keine passende Kombination",
  r2: "Regel 'genau ein neues Rezept' gelockert: keine passende Kombination",
  r1: "Regeln 'Haltbarkeit' und 'verschiedene Gerichte' gelockert: zu wenige Rezepte",
};

// ---------- Zufall und Datum ----------

export function erzeugeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wahl = (liste, rng) => liste[Math.floor(rng() * liste.length)];

const pad = (n) => String(n).padStart(2, "0");

export function naechsterSonntag(heute) {
  const d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------- Kandidaten ----------

export function kandidaten(recipes, state) {
  const fav = new Set(state.favoriten ?? []);
  const probiert = new Set(state.probiert ?? []);
  const liste = [];
  for (const r of recipes) {
    const istFavorit = r.typ === "favorit" || fav.has(r.id);
    liste.push({
      quelle: "rezept",
      id: r.id,
      name: r.name,
      haltbarTage: r.haltbarTage,
      protein: r.protein,
      istFavorit,
      istNeuKandidat: !istFavorit,
      prioritaet: istFavorit ? 0 : probiert.has(r.id) ? 3 : 2,
    });
  }
  for (const l of state.links ?? []) {
    const istFavorit = fav.has(l.id);
    const offen = l.geplantAm == null;
    liste.push({
      quelle: "link",
      id: l.id,
      name: l.titel,
      haltbarTage: 1,
      protein: "unbekannt",
      istFavorit,
      istNeuKandidat: !istFavorit && offen,
      prioritaet: istFavorit ? 0 : offen ? 1 : null,
    });
  }
  return liste;
}

function eintragInfo(e, recipes, state) {
  if (!e) return null;
  if (e.quelle === "link") {
    const l = (state.links ?? []).find((x) => x.id === e.id);
    return { id: e.id, name: l ? l.titel : e.id, haltbarTage: 1, protein: "unbekannt" };
  }
  const r = recipes.find((x) => x.id === e.id);
  return {
    id: e.id,
    name: r ? r.name : e.id,
    haltbarTage: r ? r.haltbarTage : 1,
    protein: r ? r.protein : "unbekannt",
  };
}

export function anzeigeName(eintrag, recipes, state) {
  if (eintrag.quelle === "link") {
    const l = (state.links ?? []).find((x) => x.id === eintrag.id);
    return l ? l.titel : eintrag.id;
  }
  const r = recipes.find((x) => x.id === eintrag.id);
  if (!r) return eintrag.id;
  const teile = [];
  for (const g of r.variantenGruppen ?? []) {
    const opt = (g.optionen ?? []).find((o) => o.id === eintrag.variante?.[g.id]);
    if (opt) teile.push(opt.name);
  }
  return teile.length ? `${r.name} (${teile.join(", ")})` : r.name;
}

// ---------- Regeln ----------

// Basis-IDs des jüngsten Plans vor wocheAb (aus aktuellerPlan oder verlauf).
function vorwocheIds(state, wocheAb) {
  const plaene = [state.aktuellerPlan, ...(state.verlauf ?? [])].filter((p) => p && p.wocheAb < wocheAb);
  if (!plaene.length) return new Set();
  const jung = plaene.reduce((a, b) => (b.wocheAb > a.wocheAb ? b : a));
  return new Set(Object.values(jung.slots ?? {}).filter(Boolean).map((e) => e.id));
}

const hatProtein = (items) => SLOT_IDS.some((s) => items[s] && R4_PROTEIN.includes(items[s].protein));

function verstoesse(items, vorIds) {
  const v = { r1: [], r3: [], r4: !hatProtein(items), r5: [] };
  const gesehen = new Set();
  for (const s of SLOT_IDS) {
    const k = items[s];
    if (!k) continue;
    if (k.haltbarTage < SLOTS[s].minHaltbar) v.r1.push(s);
    if (vorIds.has(k.id)) v.r3.push(s);
    if (gesehen.has(k.id)) v.r5.push(s);
    gesehen.add(k.id);
  }
  return v;
}

const tage = (n) => `${n} ${n === 1 ? "Tag" : "Tage"}`;

export function pruefePlan({ plan, recipes, state }) {
  const items = {};
  for (const s of SLOT_IDS) items[s] = eintragInfo(plan.slots?.[s], recipes, state);
  const v = verstoesse(items, vorwocheIds(state, plan.wocheAb));
  const meldungen = [];
  for (const s of v.r1) {
    meldungen.push(`Haltbarkeit: ${items[s].name} (Slot ${s}) hält nur ${tage(items[s].haltbarTage)}, nötig sind ${tage(SLOTS[s].minHaltbar)}.`);
  }
  for (const s of v.r3) meldungen.push(`Vorwoche: ${items[s].name} (Slot ${s}) gab es schon in der Vorwoche.`);
  if (v.r4 && SLOT_IDS.some((s) => items[s])) meldungen.push("Protein: Kein Gericht mit Fisch oder Geflügel in dieser Woche.");
  for (const s of v.r5) meldungen.push(`Doppelt: ${items[s].name} (Slot ${s}) kommt mehrfach vor.`);
  return meldungen;
}

function hinweiseFuer(stufe, vorIds) {
  return ["r3", "r4", "r2"].filter((k) => stufe[k] && (k !== "r3" || vorIds.size > 0)).map((k) => HINWEIS[k]);
}

// ---------- Planen ----------

function waehleNeu(pool, rng) {
  if (!pool.length) return null;
  const beste = Math.min(...pool.map((k) => k.prioritaet));
  return wahl(pool.filter((k) => k.prioritaet === beste), rng);
}

function baueEintrag(k, recipes, rng) {
  if (!k) return null;
  const r = k.quelle === "rezept" ? recipes.find((x) => x.id === k.id) : null;
  let variante = null;
  if (r && r.variantenGruppen?.length) {
    variante = {};
    for (const g of r.variantenGruppen) if (g.optionen?.length) variante[g.id] = wahl(g.optionen, rng).id;
  }
  return { quelle: k.quelle, id: k.id, variante };
}

function planeVersuch(kands, vorIds, stufe, rng) {
  const items = {};
  const benutzt = new Set();
  const ok = (k, s) => k.haltbarTage >= SLOTS[s].minHaltbar && !benutzt.has(k.id) && (stufe.r3 || !vorIds.has(k.id));
  const setze = (s, k) => {
    items[s] = k;
    benutzt.add(k.id);
  };
  let neuSlot = null;
  if (!stufe.r2) {
    neuSlot = rng() < 0.5 ? "A" : "C";
    const neu = waehleNeu(kands.filter((k) => k.istNeuKandidat && ok(k, neuSlot)), rng);
    if (!neu) return null;
    setze(neuSlot, neu);
    for (const s of ["B", neuSlot === "A" ? "C" : "A"]) {
      const pool = kands.filter((k) => k.istFavorit && ok(k, s));
      if (!pool.length) return null;
      setze(s, wahl(pool, rng));
    }
  } else {
    for (const s of ["B", "A", "C"]) {
      const pool = kands.filter((k) => (k.istFavorit || k.istNeuKandidat) && ok(k, s));
      const favs = pool.filter((k) => k.istFavorit);
      const aus = favs.length ? favs : pool;
      if (!aus.length) return null;
      setze(s, wahl(aus, rng));
    }
    const neue = SLOT_IDS.filter((s) => items[s].istNeuKandidat);
    neuSlot = neue.length === 1 && neue[0] !== "B" ? neue[0] : null;
  }
  if (!stufe.r4 && !hatProtein(items)) return null;
  return { items, neuSlot };
}

// Letzter Ausweg: irgendwie 3 Slots füllen, ohne abzustürzen.
function notfall(kands, rng) {
  const items = {};
  const benutzt = new Set();
  for (const s of ["B", "A", "C"]) {
    const brauchbar = kands.filter((k) => k.istFavorit || k.istNeuKandidat);
    const frei = brauchbar.filter((k) => !benutzt.has(k.id));
    let pool = frei.filter((k) => k.haltbarTage >= SLOTS[s].minHaltbar);
    if (!pool.length) pool = frei;
    if (!pool.length) pool = brauchbar;
    if (!pool.length) pool = kands;
    items[s] = pool.length ? wahl(pool, rng) : null;
    if (items[s]) benutzt.add(items[s].id);
  }
  return items;
}

export function planeWoche({ recipes, state, heute, rng }) {
  const wocheAb = naechsterSonntag(heute);
  const kands = kandidaten(recipes, state);
  const vorIds = vorwocheIds(state, wocheAb);
  const baue = (items, neuSlot, hinweise) => {
    const slots = {};
    for (const s of SLOT_IDS) slots[s] = baueEintrag(items[s], recipes, rng);
    return { plan: { wocheAb, erstellt: heute.toISOString(), neuSlot, slots }, hinweise };
  };

  for (const stufe of STUFEN) {
    if (stufe.r3 && !stufe.r4 && vorIds.size === 0) continue; // R3 lockern bringt ohne Vorwoche nichts
    for (let i = 0; i < VERSUCHE; i++) {
      const v = planeVersuch(kands, vorIds, stufe, rng);
      if (v) return baue(v.items, v.neuSlot, hinweiseFuer(stufe, vorIds));
    }
  }
  const items = notfall(kands, rng);
  const hinweise = [...hinweiseFuer(STUFEN[3], vorIds), HINWEIS.r1];
  if (SLOT_IDS.some((s) => !items[s])) hinweise.push("Zu wenige Rezepte vorhanden: Plan ist unvollständig");
  return baue(items, null, hinweise);
}

export function wuerfleSlot({ recipes, state, plan, slot, rng }) {
  const kands = kandidaten(recipes, state);
  const vorIds = vorwocheIds(state, plan.wocheAb);
  const aktuell = plan.slots[slot];
  const andere = SLOT_IDS.filter((s) => s !== slot)
    .map((s) => eintragInfo(plan.slots[s], recipes, state))
    .filter(Boolean);
  const benutzt = new Set(andere.map((i) => i.id));
  const andereProtein = andere.some((i) => R4_PROTEIN.includes(i.protein));
  const neuGewuenscht = plan.neuSlot === slot;

  for (const stufe of STUFEN) {
    if (stufe.r3 && !stufe.r4 && vorIds.size === 0) continue;
    let pool = kands.filter((k) => {
      if (benutzt.has(k.id) || k.id === aktuell?.id) return false;
      if (k.haltbarTage < SLOTS[slot].minHaltbar) return false;
      if (!stufe.r3 && vorIds.has(k.id)) return false;
      if (!stufe.r4 && !andereProtein && !R4_PROTEIN.includes(k.protein)) return false;
      if (stufe.r2) return k.istFavorit || k.istNeuKandidat;
      return neuGewuenscht ? k.istNeuKandidat : k.istFavorit;
    });
    if (neuGewuenscht && !stufe.r2 && pool.length) {
      const beste = Math.min(...pool.map((k) => k.prioritaet));
      pool = pool.filter((k) => k.prioritaet === beste);
    }
    if (pool.length) {
      const eintrag = baueEintrag(wahl(pool, rng), recipes, rng);
      return { plan: setzeSlot(plan, slot, eintrag), hinweise: hinweiseFuer(stufe, vorIds) };
    }
  }
  return { plan: structuredClone(plan), hinweise: ["Keine andere Möglichkeit gefunden: das bisherige Gericht bleibt"] };
}

export function setzeSlot(plan, slot, eintrag) {
  const kopie = structuredClone(plan);
  kopie.slots[slot] = structuredClone(eintrag);
  return kopie;
}

// ---------- Zustand ----------

export function uebernehmePlan(state, plan) {
  const neu = structuredClone(state);
  const p = structuredClone(plan);
  neu.verlauf ??= [];
  neu.probiert ??= [];
  neu.links ??= [];
  if (neu.aktuellerPlan && neu.aktuellerPlan.wocheAb !== p.wocheAb) {
    neu.verlauf = [...neu.verlauf, neu.aktuellerPlan].slice(-8);
  }
  neu.aktuellerPlan = p;
  const eintrag = p.neuSlot ? p.slots[p.neuSlot] : null;
  if (eintrag?.quelle === "link") {
    const link = neu.links.find((l) => l.id === eintrag.id);
    if (link) link.geplantAm = p.wocheAb;
  } else if (eintrag?.quelle === "rezept" && !neu.probiert.includes(eintrag.id)) {
    neu.probiert.push(eintrag.id);
  }
  return neu;
}
