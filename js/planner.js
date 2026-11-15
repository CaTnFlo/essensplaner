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

// Lockerungsstufen aus SPEC 3: zuerst R3, dann R4, dann R2. Es wird immer nur so wenig
// wie nötig gelockert: R4 allein vor R3+R4, R2 allein vor R2 mit weiteren Regeln.
const STUFEN = [
  {},
  { r3: true },
  { r4: true },
  { r3: true, r4: true },
  { r2: true },
  { r2: true, r3: true },
  { r2: true, r4: true },
  { r2: true, r3: true, r4: true },
];
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

// Hinweise nur für Regeln, die im Ergebnis tatsächlich verletzt sind.
// items: { A, B, C } mit Kandidaten- oder Info-Objekten; neuOk: R2 im Ergebnis erfüllt.
function hinweiseFuer(items, vorIds, neuOk) {
  const h = [];
  if (SLOT_IDS.some((s) => items[s] && vorIds.has(items[s].id))) h.push(HINWEIS.r3);
  if (SLOT_IDS.some((s) => items[s]) && !hatProtein(items)) h.push(HINWEIS.r4);
  if (!neuOk) h.push(HINWEIS.r2);
  return h;
}

// Bei gelockerter R3 trotzdem Gerichte ohne Vorwochen-Bezug bevorzugen, wenn es welche gibt.
function bevorzuge(pool, stufe, vorIds) {
  if (!stufe.r3) return pool;
  const frisch = pool.filter((k) => !vorIds.has(k.id));
  return frisch.length ? frisch : pool;
}

// SPEC 3: neuSlot ist nur gesetzt, wenn genau ein neues Rezept in A oder C liegt.
function neuSlotAus(istNeu) {
  const neue = SLOT_IDS.filter((s) => istNeu[s]);
  return neue.length === 1 && neue[0] !== "B" ? neue[0] : null;
}

const ueberspringen = (stufe, vorIds) => stufe.r3 && vorIds.size === 0; // ohne Vorwoche bringt R3 lockern nichts

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
    const neu = waehleNeu(bevorzuge(kands.filter((k) => k.istNeuKandidat && ok(k, neuSlot)), stufe, vorIds), rng);
    if (!neu) return null;
    setze(neuSlot, neu);
    for (const s of ["B", neuSlot === "A" ? "C" : "A"]) {
      const pool = bevorzuge(kands.filter((k) => k.istFavorit && ok(k, s)), stufe, vorIds);
      if (!pool.length) return null;
      setze(s, wahl(pool, rng));
    }
  } else {
    for (const s of ["B", "A", "C"]) {
      const pool = bevorzuge(kands.filter((k) => (k.istFavorit || k.istNeuKandidat) && ok(k, s)), stufe, vorIds);
      const favs = pool.filter((k) => k.istFavorit);
      const aus = favs.length ? favs : pool;
      if (!aus.length) return null;
      setze(s, wahl(aus, rng));
    }
    neuSlot = neuSlotAus(Object.fromEntries(SLOT_IDS.map((s) => [s, items[s].istNeuKandidat])));
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
    if (ueberspringen(stufe, vorIds)) continue;
    for (let i = 0; i < VERSUCHE; i++) {
      const v = planeVersuch(kands, vorIds, stufe, rng);
      if (v) return baue(v.items, v.neuSlot, hinweiseFuer(v.items, vorIds, v.neuSlot !== null));
    }
  }
  const items = notfall(kands, rng);
  const hinweise = [...hinweiseFuer(items, vorIds, false), HINWEIS.r1];
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

  const kandVon = (e) => e && kands.find((k) => k.quelle === e.quelle && k.id === e.id);

  for (const stufe of STUFEN) {
    if (ueberspringen(stufe, vorIds)) continue;
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
    pool = bevorzuge(pool, stufe, vorIds);
    if (pool.length) {
      const k = wahl(pool, rng);
      const neu = setzeSlot(plan, slot, baueEintrag(k, recipes, rng));
      const items = {};
      for (const s of SLOT_IDS) items[s] = s === slot ? k : eintragInfo(plan.slots[s], recipes, state);
      if (stufe.r2) {
        neu.neuSlot = neuSlotAus(Object.fromEntries(SLOT_IDS.map((s) => [s, s === slot ? k.istNeuKandidat : !!kandVon(plan.slots[s])?.istNeuKandidat])));
      }
      return { plan: neu, hinweise: hinweiseFuer(items, vorIds, !stufe.r2 || neu.neuSlot !== null) };
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

// SPEC 4.4 / P6b Frage 2: Ersetzt ein Plan den aktuellen derselben Woche, wird das
// neue Rezept des alten Plans zurückgenommen, wenn der neue Plan ein anderes hat.
export function uebernehmePlan(state, plan) {
  const neu = structuredClone(state);
  const p = structuredClone(plan);
  neu.verlauf ??= [];
  neu.probiert ??= [];
  neu.links ??= [];
  const alt = neu.aktuellerPlan;
  const neuEintrag = (pl) => (pl?.neuSlot ? pl.slots?.[pl.neuSlot] ?? null : null);
  const altNeu = alt && alt.wocheAb === p.wocheAb ? neuEintrag(alt) : null;
  const neuNeu = neuEintrag(p);
  const dasselbe = !!altNeu && !!neuNeu && altNeu.quelle === neuNeu.quelle && altNeu.id === neuNeu.id;
  // Steht das alte neue Rezept noch in irgendeinem Slot des neuen Plans, wird nichts zurückgenommen.
  const nochImPlan = !!altNeu && SLOT_IDS.some((s) => p.slots?.[s]?.quelle === altNeu.quelle && p.slots?.[s]?.id === altNeu.id);

  if (alt && alt.wocheAb !== p.wocheAb) {
    neu.verlauf = [...neu.verlauf, alt].slice(-8);
  } else if (altNeu && !dasselbe && !nochImPlan) {
    if (altNeu.quelle === "link") {
      const link = neu.links.find((l) => l.id === altNeu.id);
      if (link && link.geplantAm === alt.wocheAb) link.geplantAm = null;
    } else if (alt.probiertHinzugefuegt === true) {
      neu.probiert = neu.probiert.filter((id) => id !== altNeu.id);
    }
  }

  neu.aktuellerPlan = p;
  const eintrag = neuNeu;
  p.probiertHinzugefuegt = false;
  if (eintrag?.quelle === "link") {
    const link = neu.links.find((l) => l.id === eintrag.id);
    if (link) link.geplantAm = p.wocheAb;
  } else if (eintrag?.quelle === "rezept") {
    if (!neu.probiert.includes(eintrag.id)) {
      neu.probiert.push(eintrag.id);
      p.probiertHinzugefuegt = true;
    } else if (dasselbe) {
      // Gleiches neues Rezept wie vorher: Herkunft des alten Plans bleibt erhalten.
      p.probiertHinzugefuegt = alt.probiertHinzugefuegt === true;
    }
  }
  return neu;
}


// Manual movement preserves the complete entry, variants, new marker and wish.
export function tauscheSlots(plan, von, nach) {
  if (!SLOT_IDS.includes(von) || !SLOT_IDS.includes(nach)) throw new Error("Ungültiger Slot");
  const neu = structuredClone(plan);
  if (von === nach) return neu;
  [neu.slots[von], neu.slots[nach]] = [neu.slots[nach] ?? null, neu.slots[von] ?? null];
  if (neu.neuSlot === von) neu.neuSlot = nach;
  else if (neu.neuSlot === nach) neu.neuSlot = von;
  if (neu.wunsch?.slot === von) { neu.wunsch.slot = nach; neu.wunsch.manuell = true; }
  else if (neu.wunsch?.slot === nach) { neu.wunsch.slot = von; neu.wunsch.manuell = true; }
  return neu;
}

export function wunschGrund(k, slot) {
  if (!k) return "Bitte ein Gericht wählen.";
  if (!SLOT_IDS.includes(slot)) return "Ungültiger Tag.";
  if (k.haltbarTage < SLOTS[slot].minHaltbar) return "Braucht mindestens drei Tage Haltbarkeit.";
  if (!k.istFavorit && slot === "B") return "Neue Gerichte werden Sonntag oder Donnerstag gekocht.";
  return "";
}

// Exhaustive search: a small catalog allows proving that the strictest feasible
// relaxation was used, rather than failing a wish because random attempts ran out.
export function planeMitWunsch({ recipes, state, heute, rng, wunsch, erhalten = false }) {
  const alt = state.aktuellerPlan;
  const wocheAb = erhalten && alt ? alt.wocheAb : naechsterSonntag(heute);
  const ks = kandidaten(recipes, state).map(k => {
    const currentNew = alt?.neuSlot && alt.slots[alt.neuSlot];
    return erhalten && currentNew?.quelle === 'link' && k.quelle === 'link' && currentNew.id === k.id && !k.istFavorit
      ? { ...k, istNeuKandidat: true, prioritaet: 1 } : k;
  });
  const k = ks.find(x => x.id === wunsch.eintrag.id && x.quelle === wunsch.eintrag.quelle);
  const slot = wunsch.slot;
  // An explicitly moved wish may stay in B; automatic initial assignment may not.
  const manuell = alt?.wunsch?.slot === slot && alt.wunsch.eintrag.id === k?.id && alt.wunsch.manuell;
  const grund = wunschGrund(k, slot);
  if (grund && !manuell) return { plan: null, hinweise: [grund] };
  if (!k) return { plan: null, hinweise: ["Das Wunschgericht ist nicht mehr verfügbar."] };
  const vorIds = vorwocheIds(state, wocheAb);
  const frei = SLOT_IDS.filter(s => s !== slot);
  for (const stufe of STUFEN) {
    let beste = null, score = -Infinity, gleich = 0;
    for (const a of ks) for (const b of ks) {
      const items = { [slot]: k, [frei[0]]: a, [frei[1]]: b };
      if (new Set([k.id, a.id, b.id]).size !== 3) continue;
      if (SLOT_IDS.some(s => items[s].haltbarTage < SLOTS[s].minHaltbar && !(s === slot && manuell))) continue;
      if ([a, b].some(x => !x.istFavorit && !x.istNeuKandidat)) continue;
      if (!stufe.r3 && SLOT_IDS.some(s => vorIds.has(items[s].id))) continue;
      if (!stufe.r4 && !hatProtein(items)) continue;
      const neue = SLOT_IDS.filter(s => !items[s].istFavorit);
      if (!stufe.r2 && (neue.length !== 1 || (neue[0] === "B" && !manuell))) continue;
      if (neue.includes("B") && !(slot === "B" && manuell)) continue;
      const neuSlot = neue.length === 1 ? neue[0] : null;
      const behalten = frei.filter(s => alt?.slots[s]?.id === items[s].id).length;
      const prioritaet = [a,b].reduce((n,x) => n + (x.prioritaet ?? 5), 0);
      const wert = (erhalten ? behalten * 100 : 0) - prioritaet;
      if (wert > score) { score = wert; gleich = 0; }
      if (wert === score && rng() < 1 / ++gleich) beste = { items, neuSlot };
    }
    if (beste) {
      const slots = Object.fromEntries(SLOT_IDS.map(s => [s,
        s === slot ? structuredClone(wunsch.eintrag) :
          erhalten && alt?.slots[s]?.id === beste.items[s].id ? structuredClone(alt.slots[s]) : baueEintrag(beste.items[s], recipes, rng)]));
      return { plan: { wocheAb, erstellt: heute.toISOString(), slots, neuSlot: beste.neuSlot,
        wunsch: structuredClone(wunsch) }, hinweise: hinweiseFuer(beste.items, vorIds, beste.neuSlot !== null) };
    }
  }
  return { plan: null, hinweise: ["Kein passender Plan. Bitte Wunschgericht oder Tag ändern."] };
}

export function filterKandidaten({ recipes, state, slot, suche = "", filter = [], aktuell }) {
  return kandidaten(recipes, state).filter(k => {
    if (slot && k.haltbarTage < SLOTS[slot].minHaltbar) return false;
    if (k.id === aktuell || !k.name.toLocaleLowerCase("de").includes(suche.toLocaleLowerCase("de"))) return false;
    const r = k.quelle === "rezept" ? recipes.find(r => r.id === k.id) : null;
    if (filter.includes("favoriten") && !k.istFavorit) return false;
    if (filter.includes("neu") && (k.istFavorit || (k.quelle === "rezept" ? (state.probiert ?? []).includes(k.id) : !k.istNeuKandidat))) return false;
    if (filter.includes("kurz") && !(r?.dauerMin <= 30)) return false;
    if (filter.includes("airfryer") && r?.airfryer !== true) return false;
    const protein = filter.filter(x => R4_PROTEIN.includes(x));
    return !protein.length || protein.includes(r?.protein);
  }).sort((a,b) => Number(b.istFavorit) - Number(a.istFavorit) || a.name.localeCompare(b.name, "de"));
}
