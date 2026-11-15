import { aenderung, anwenden, rueckgaengigChange } from "./state-change.js";
import { icon } from "./icons.js";
import { installPlanDrag } from "./plan-drag.js";
// UI, Navigation, Events (SPEC 6, 7). Planungslogik liegt in planner.js / shopping.js / bring.js.
import { SLOTS, erzeugeRng, planeWoche, wuerfleSlot, setzeSlot, pruefePlan, uebernehmePlan, anzeigeName, kandidaten, tauscheSlots, planeMitWunsch, wunschGrund, filterKandidaten } from "./planner.js";
import { einkaufsliste } from "./shopping.js";
import { bringLink, rezeptSeitenPfad, bringWochenLink } from "./bring.js?v=20261115-6";
import { firebaseConfig } from "./firebase-config.js";

const KEY_HAUSHALT = "essensplaner-haushalt";
const KEY_LOKAL = "essensplaner-lokal";
const TAGE = { So: "Sonntag", Do: "Donnerstag" };
const KATEGORIE_NAMEN = {
  "obst-gemuese": "Obst und Gemüse",
  "fleisch-fisch": "Fleisch und Fisch",
  kuehlregal: "Kühlregal",
  backwaren: "Backwaren",
  tiefkuehl: "Tiefkühl",
  vorrat: "Vorrat",
  gewuerze: "Gewürze",
};
const PROTEIN_BADGE = { fisch: "Fisch", gefluegel: "Geflügel" };
const svg = (pfade) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${pfade}</svg>`;
const TAB_ICONS = {
  // Kalender
  woche: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  // Einkaufskorb
  einkauf: svg('<path d="M3 10h18l-2 10H5z"/><path d="M8 10l4-6 4 6M9 14v3M15 14v3"/>'),
  // Buch
  rezepte: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M19 19v2H6"/>'),
};

const root = document.getElementById("app");
const statusEl = document.getElementById("status");

let recipes = [];
let store = null;
let state = null;
let haushaltId = null;
let lokalHinweis = "";
let modus = "lokal"; // "lokal" | "firebase"
let verbindungsFehler = "";
const FEHLER_TEXT = "Keine Verbindung zum Haushalt. Stimmt die Haushalts-ID?";
const ui = { tab: "woche", aendern: null, hinweise: [], poolOffen: false, einkauf: "samstag" };

// ---------- Hilfen ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const lies = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const schreibe = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* Speicher gesperrt: App läuft trotzdem */
  }
};

let pending = null, saving = false, undo = null, savedState = null;
let sheet = null, sheetTrigger = null, sheetTriggerSelector = null, sheetHistory = false, cancelDrag = () => {};
let inputMethod = 'pointer';
document.addEventListener('pointerdown', () => {
  inputMethod = 'pointer'; document.documentElement?.setAttribute('data-input', 'pointer');
}, true);
document.addEventListener('keydown', e => {
  if (['Tab','Enter',' ','ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.key)) {
    inputMethod = 'keyboard'; document.documentElement?.setAttribute('data-input', 'keyboard');
  }
}, true);
let toastTimer;
function toast(text) {
  statusEl.textContent = text;
  if (undo && /neu geplant$/.test(text)) statusEl.insertAdjacentHTML?.('beforeend', ' <button class="btn" data-action="undo">Rückgängig</button>');
  statusEl.classList.add("zeigen");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (statusEl.contains?.(document.activeElement)) return;
    statusEl.classList.remove("zeigen"); statusEl.textContent = text;
  }, 2200);
}

async function kopiere(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* selectable fallback below */ }
    ta.remove();
    if (!ok) { oeffneSheet('copy'); sheet.text = text; zeichneSheet(); return; }
  }
  toast("Kopiert");
}

const rezeptVon = (id) => recipes.find((r) => r.id === id);
const linkVon = (id) => (state.links ?? []).find((l) => l.id === id);
const favSet = () => new Set(state.favoriten ?? []);
const istFavorit = (id) => favSet().has(id) || rezeptVon(id)?.typ === "favorit";

function datumKurz(iso) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}
function wochentagKurz(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date(y, m - 1, d).getDay()];
}
const heuteIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function fmtMenge(m) {
  return m == null ? "" : m.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}
function postenText(p) {
  return [fmtMenge(p.menge), p.einheit, p.name].filter(Boolean).join(" ");
}

// Eintrag für ein Rezept ohne gewählte Variante (Rezepte-Tab, Ändern-Liste): zufällige Optionen.
function eintragFuer(k, rng) {
  if (k.quelle === "link") return { quelle: "link", id: k.id, variante: null };
  const r = rezeptVon(k.id);
  let variante = null;
  if (r?.variantenGruppen?.length) {
    variante = {};
    for (const g of r.variantenGruppen) {
      variante[g.id] = g.optionen[Math.floor(rng() * g.optionen.length)].id;
    }
  }
  return { quelle: "rezept", id: k.id, variante };
}

function rezeptUrl(eintrag) {
  if (eintrag.quelle === "link") return sichereLinkUrl(linkVon(eintrag.id)?.url);
  return new URL(rezeptSeitenPfad(eintrag, recipes), location.href).href;
}
function bringUrl(eintrag) {
  const url = rezeptUrl(eintrag);
  if (!url) return null;
  if (eintrag.quelle === 'link') return bringLink(url);
  // Separate import URL prevents a previously cached full-ingredient import.
  const importUrl = new URL(url); importUrl.searchParams.set('bring', 'ohne-vorrat');
  return bringLink(importUrl.href);
}

// Auch gespeicherte Links sind Eingaben: HTML-Escaping prüft kein URL-Protokoll.
function sichereLinkUrl(wert) {
  if (typeof wert !== "string" || !wert.startsWith("https://")) return null;
  try {
    const url = new URL(wert);
    return url.protocol === "https:" && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

function externerLink(url, text, label = text) {
  if (!url) return `<button class="btn" disabled title="Ungültiger Rezept-Link" aria-label="${esc(label)}: ungültiger Rezept-Link">${esc(text)}</button>`;
  return `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${esc(label)}">${esc(text)}</a>`;
}

// Rezept-Eintrag ohne Variantenwahl, nur für Links zur Rezeptseite im Rezepte-Tab.
function standardEintrag(r) {
  const variante = r.variantenGruppen?.length
    ? Object.fromEntries(r.variantenGruppen.map((g) => [g.id, g.optionen[0].id]))
    : null;
  return { quelle: "rezept", id: r.id, variante };
}

// ---------- Zustand ändern ----------

async function setze(neuerState, hinweise = [], options = {}) {
  if (saving || pending) return false;
  const base = structuredClone(state);
  pending = { change: aenderung(base, neuerState), hinweise, options, before: base };
  return speicherePending();
}
async function speicherePending() {
  if (!pending || saving) return false;
  const job = pending;
  saving = true;
  state = job.change.next;
  ui.hinweise = job.hinweise;
  render(); zeichneSave();
  try {
    const result = await store.speichern(state, job.change);
    const committed = result ?? anwenden(savedState ?? job.before, job.change);
    const newer = (savedState?.changeSequence ?? 0) > (committed.changeSequence ?? 0);
    state = newer ? structuredClone(savedState) : committed;
    savedState = structuredClone(state);
    const planChanged = JSON.stringify(job.before.aktuellerPlan) !== JSON.stringify(state.aktuellerPlan);
    if (planChanged) undo = job.options.undo && state.planRevision === committed.planRevision ? { before: job.before, after: structuredClone(state), intended: job.change.next } : null;
    pending = null; saving = false;
    render(); zeichneSave();
    if (job.options.close) schliesseSheet();
    else if (sheet && ['menu','details'].includes(sheet.type)) zeichneSheet();
    clearTimeout(toastTimer); statusEl.classList.remove('zeigen'); statusEl.textContent = '';
    if (job.options.message) toast(job.options.message);
    return true;
  } catch (e) {
    console.error(e); saving = false;
    pending.error = e.name === "Konflikt" ? e.message : "Bitte prüfe die Verbindung und den verfügbaren Gerätespeicher und versuche es erneut.";
    render(); zeichneSave();
    toast("Speichern fehlgeschlagen");
    return false;
  }
}
function zeichneSave() {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.innerHTML = pending ? saving ? 'Wird gespeichert…' :
    `<strong>Nicht gespeichert</strong><p>Deine Änderungen sind noch hier.</p><p>${esc(pending.error)}</p>
     <button class="btn" data-action="retry">Erneut versuchen</button>
     <button class="btn" data-action="discard">Änderung verwerfen</button>` : '';
  const modalStatus = document.getElementById('sheet-save');
  if (modalStatus) modalStatus.innerHTML = el.innerHTML;
}

const rng = () => erzeugeRng(Date.now());

async function planen() {
  const wish = state.aktuellerPlan?.wunsch;
  const result = wish ? planeMitWunsch({ recipes, state, heute: new Date(), rng: rng(), wunsch: wish }) :
    planeWoche({ recipes, state, heute: new Date(), rng: rng() });
  if (!result.plan) return toast(result.hinweise.join(' '));
  return setze(uebernehmePlan(state, result.plan), result.hinweise,
    { undo: true, message: wish ? '2 Gerichte neu geplant' : 'Woche neu geplant', close: true });
}
async function verschiebe(von, nach) {
  const plan = tauscheSlots(state.aktuellerPlan, von, nach);
  const ok = await setze(uebernehmePlan(state, plan), [], { close: true, message: `Gericht nach ${SLOTS[nach].isstTage.join(' + ')} verschoben` });
  if (ok) document.querySelector(`[data-action="details"][data-slot="${nach}"]`)?.focus();
}

const aktionen = {
  tab: (el) => {
    ui.tab = el.dataset.tab;
    ui.aendern = null;
    render();
    window.scrollTo(0, 0);
  },
  planen,
  neuplanen: () => {
    return planen();
  },
  wuerfeln: (el) => {
    if (state.aktuellerPlan.wunsch?.slot === el.dataset.slot) return oeffneSheet("wish");
    const { plan, hinweise } = wuerfleSlot({ recipes, state, plan: state.aktuellerPlan, slot: el.dataset.slot, rng: rng() });
    return setze(uebernehmePlan(state, plan), hinweise, { close: true });
  },
  aendern: (el) => oeffneSheet(state.aktuellerPlan.wunsch?.slot === el.dataset.slot ? 'wish' : 'replace', el.dataset.slot),
  wish: () => oeffneSheet('wish'),
  details: el => oeffneSheet('details', el.dataset.slot),
  menu: el => oeffneSheet('menu', el.dataset.slot),
  weekmenu: () => oeffneSheet('weekmenu'),
  move: el => oeffneSheet('move', el.dataset.slot),
  destination: el => verschiebe(sheet.slot, el.dataset.slot),
  close: () => schliesseSheet(),
  shoppingday: el => { ui.einkauf = el.dataset.day; render(); },
  retry: () => speicherePending(),
  discard: () => { pending = null; state = structuredClone(savedState ?? state); render(); zeichneSave(); },
  reconnect: () => reconnect(),
  undo: async () => {
    if (!undo) return;
    try {
      const change = rueckgaengigChange(undo.before, undo.after, state, undo.intended);
      await setze(anwenden(state, change), [], { close: true, message: 'Vorheriger Plan wiederhergestellt' });
    } catch (e) { undo = null; toast(e.message); render(); }
  },
  filter: el => {
    const key = el.dataset.filter;
    if (sheet.filter.includes(key)) sheet.filter = sheet.filter.filter(x => x !== key);
    else { if (['neu','favoriten'].includes(key)) sheet.filter = sheet.filter.filter(x => !['neu','favoriten'].includes(x)); sheet.filter.push(key); }
    zeichneErgebnisse();
  },
  resetfilter: () => { sheet.filter = []; sheet.suche = ''; document.getElementById('sheet-search').value = ''; zeichneErgebnisse(); },
  selectwish: el => {
    const k = kandidaten(recipes, state).find(k => k.id === el.dataset.id && k.quelle === el.dataset.quelle);
    if (!k) return;
    sheet.eintrag = eintragFuer(k, rng()); sheet.preview = null; zeichneWunsch(); zeichneErgebnisse();
  },
  wishday: el => { sheet.day = el.dataset.day; sheet.preview = null; zeichneWunsch(); },
  applywish: () => uebernehmeWunsch(),
  releasewish: () => {
    const plan = structuredClone(state.aktuellerPlan); delete plan.wunsch;
    return setze(uebernehmePlan(state, plan), [], { close: true, message: 'Wunsch gelöst. Dein Gericht bleibt im Plan.' });
  },
  waehle: (el) => {
    const k = kandidaten(recipes, state).find((x) => x.quelle === el.dataset.quelle && x.id === el.dataset.id);
    if (!k || k.haltbarTage < SLOTS[el.dataset.slot].minHaltbar) return;
    if (state.aktuellerPlan.wunsch?.slot === el.dataset.slot) return oeffneSheet("wish");
    const plan = setzeSlot(state.aktuellerPlan, el.dataset.slot, eintragFuer(k, rng()));
    return setze(uebernehmePlan(state, plan), [], { close: true });
  },
  geschmeckt: (el) => {
    const id = state.aktuellerPlan.slots[el.dataset.slot].id;
    const neu = structuredClone(state);
    neu.favoriten = [...new Set([...(neu.favoriten ?? []), id])];
    return setze(neu, ui.hinweise);
  },
  favorit: (el) => {
    const id = el.dataset.id;
    const neu = structuredClone(state);
    const set = new Set(neu.favoriten ?? []);
    set.has(id) ? set.delete(id) : set.add(id);
    neu.favoriten = [...set];
    return setze(neu, ui.hinweise);
  },
  linkloeschen: (el) => {
    const id = el.dataset.id;
    const imPlan = Object.values(state.aktuellerPlan?.slots ?? {}).some((e) => e?.id === id);
    if (imPlan) return toast("Der Link ist im aktuellen Plan. Erst Woche neu planen.");
    if (!confirm(`Link „${linkVon(id)?.titel ?? ""}“ löschen?`)) return;
    const neu = structuredClone(state);
    neu.links = neu.links.filter((l) => l.id !== id);
    neu.favoriten = (neu.favoriten ?? []).filter((f) => f !== id);
    return setze(neu, ui.hinweise);
  },
  kopieren: (el) => {
    const liste = einkaufsliste({ plan: state.aktuellerPlan, recipes, state })[el.dataset.liste];
    return kopiere(liste.map(postenText).join("\n"));
  },
  einladung: () => kopiere(`${location.origin}${location.pathname}#haushalt=${haushaltId}`),
};

// ---------- Rendern: Woche ----------

function slotKarte(slot, plan) {
  const e = plan.slots[slot], cfg = SLOTS[slot];
  const r = e?.quelle === 'rezept' ? rezeptVon(e.id) : null;
  const name = e ? anzeigeName(e, recipes, state) : 'Kein Gericht';
  const wish = plan.wunsch?.slot === slot;
  return `<section class="card" data-plan-slot="${slot}" aria-label="${cfg.isstTage.join(' + ')}">
    <div class="card-heading"><h2 class="day-badge">${icon('calendar')}${cfg.isstTage.join(' + ')}</h2>
      ${wish ? `<span class="pin">${icon('pin')}Dein Wunsch</span>` : plan.neuSlot === slot ? `<span class="badge neu">${icon('star')}Neu</span>` : ''}
      <button class="btn icon-button" data-action="menu" data-slot="${slot}" aria-label="Aktionen für ${cfg.isstTage.join(' + ')}">${icon('more')}</button></div>
    <button class="recipe-title" data-action="details" data-slot="${slot}" ${!e ? 'disabled' : ''}>${esc(name)}</button>
    <div class="metadata">${icon('clock')}${r ? `${r.dauerMin} Min.` : 'Keine Zeitangabe'}
      ${r?.protein && PROTEIN_BADGE[r.protein] ? `<span>${icon(r.protein === "fisch" ? "fish" : "bird")}${PROTEIN_BADGE[r.protein]}</span>` : ''}${r?.airfryer ? `<span>${icon('pot')}Airfryer</span>` : ''}</div>
    <div class="preparation"><p>${TAGE[cfg.kochtag]} ${slot === 'B' ? 'vorkochen' : 'kochen'}</p>
      <button class="btn drag-handle" data-drag="${slot}" data-action="move" data-slot="${slot}" aria-label="${esc(name)} verschieben">${icon('move')}</button></div>
  </section>`;
}
function renderWoche() {
  const plan = state.aktuellerPlan;
  const header = `<div class="page-heading"><h1>Deine Woche</h1><button class="btn icon-button" data-action="weekmenu" aria-label="Wochenaktionen">${icon('more')}</button></div>`;
  if (!plan) return `${header}<p class="muted">Noch kein Plan. Ein Klick, und die Woche steht.</p>
    <button class="btn wish-action" data-action="wish">${icon('pin')}Wunschgericht</button>
    <button class="btn primary big" data-action="planen">Woche planen</button>`;
  const meldungen = [...new Set([...ui.hinweise, ...pruefePlan({ plan, recipes, state })])];
  return `${header}<p class="week-date">Ab ${wochentagKurz(plan.wocheAb)}, ${datumKurz(plan.wocheAb)}</p>
    <button class="btn wish-action" data-action="wish">${icon('pin')}${plan.wunsch ? 'Wunsch ändern' : 'Wunschgericht'}</button>
    ${['A','B','C'].map(s => slotKarte(s, plan)).join('')}
    ${meldungen.length ? `<div class="hinweise" role="status"><ul>${meldungen.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
    <button class="btn primary big" data-action="neuplanen">${icon('shuffle')}${plan.wunsch ? '2 Gerichte neu planen' : 'Woche neu planen'}</button>
    ${plan.wunsch ? `<p class="wish-note">${esc(anzeigeName(plan.wunsch.eintrag, recipes, state))} bleibt gesetzt.</p>` : ''}
    ${undo ? '<div class="undo-status" role="status">Plan gespeichert. <button class="btn" data-action="undo">Rückgängig</button></div>' : ''}`;
}

// ---------- Rendern: Einkauf ----------

function abschnitt(titel, key, posten) {
  if (!posten.length) return `<h2>${esc(titel)}</h2><p class="muted">Nichts zu kaufen.</p>`;
  const normal = posten.filter((p) => !p.vorrat);
  const vorrat = posten.filter((p) => p.vorrat);
  const gruppen = [];
  for (const p of normal) {
    let g = gruppen.find((x) => x.k === p.kategorie);
    if (!g) gruppen.push((g = { k: p.kategorie, items: [] }));
    g.items.push(p);
  }
  const zeile = (p) =>
    `<li><details><summary><span>${esc(p.name)}</span><span class="amount">${esc(fmtMenge(p.menge))}</span><span class="unit">${esc(p.einheit ?? "")}</span></summary><p class="rezepte">${esc(p.rezepte.join(", "))}</p></details></li>`;
  return `<h2>${esc(titel)}</h2>
    <button class="btn" data-action="kopieren" data-liste="${key}">Liste kopieren</button>
    ${gruppen.map((g) => `<h3 class="kategorie">${icon("box")}${esc(KATEGORIE_NAMEN[g.k] ?? g.k)}</h3><ul class="posten">${g.items.map(zeile).join("")}</ul>`).join("")}
    ${vorrat.length ? `<details class="pantry"><summary>Habt ihr wahrscheinlich da</summary><ul class="posten vorrat">${vorrat.map(zeile).join("")}</ul></details>` : ""}`;
}

function renderEinkauf() {
  const plan = state.aktuellerPlan;
  if (!plan) return `<h1>Einkauf</h1><p class="muted">Erst eine Woche planen, dann erscheint hier die Liste.</p>`;
  const liste = einkaufsliste({ plan, recipes, state });
  const gerichte = ["A", "B", "C"]
    .filter((s) => plan.slots[s])
    .map((s) => {
      const e = plan.slots[s];
      return `<li><span class="name">${esc(anzeigeName(e, recipes, state))}</span>
        ${externerLink(bringUrl(e), "Zu Bring", `${anzeigeName(e, recipes, state)} zu Bring`)}</li>`;
    })
    .join("");
  const links = liste.links.length
    ? `<h2>Eigene Rezepte</h2><ul class="liste">${liste.links
        .map((l) => `<li><span class="name">${esc(l.titel)}<br><span class="small muted">Zutaten siehe Rezept</span></span>
          ${externerLink(sichereLinkUrl(l.url), "Rezept")}</li>`)
        .join("")}</ul>`
    : "";
  const bulkUrl = bringWochenLink(plan);
  return `<h1>Einkauf</h1>
    <div class="shopping-tabs" aria-label="Einkaufstag">${['samstag','donnerstag'].map(day => `<button class="btn" data-action="shoppingday" data-day="${day}" aria-pressed="${ui.einkauf === day}">${icon('calendar')}${day === 'samstag' ? 'Samstag' : 'Donnerstag'}${ui.einkauf === day ? '<span aria-hidden="true">✓</span>' : ''}</button>`).join('')}</div>
    ${abschnitt(ui.einkauf === 'samstag' ? 'Samstag' : 'Donnerstag', ui.einkauf, liste[ui.einkauf])}
    ${links}<h2>Zu Bring hinzufügen</h2>
${bulkUrl ? `<div class="bring-all">${externerLink(bulkUrl, "Alles zu Bring hinzufügen").replace('class="btn"','class="btn primary"')}<p class="small muted">Ganze Woche · ohne Vorräte${liste.links.length ? '. Eigene Rezeptlinks bitte separat hinzufügen.' : ''}</p></div>` : ''}
    <ul class="liste">${gerichte}</ul>`;
}

// ---------- Rendern: Rezepte ----------

function rezeptZeile(r) {
  const eigenerFav = r.typ === "favorit";
  const fav = istFavorit(r.id);
  const schalter = eigenerFav
    ? ""
    : `<button class="btn" data-action="favorit" data-id="${esc(r.id)}" aria-pressed="${fav}">Favorit</button>`;
  return `<li><span class="name">${esc(r.name)}<br><span class="small muted">${r.dauerMin} Min.</span></span>
    <a class="btn" href="${esc(rezeptSeitenPfad(standardEintrag(r), recipes))}" target="_blank" rel="noopener" aria-label="${esc(r.name)}: Rezept">Rezept</a>${schalter}</li>`;
}

function linkZeile(l) {
  const fav = favSet().has(l.id);
  return `<li><span class="name">${esc(l.titel)}<br><span class="small muted">${l.geplantAm ? "schon geplant" : "noch offen"}</span></span>
    ${externerLink(sichereLinkUrl(l.url), "Rezept", `${l.titel}: Rezept`)}
    <button class="btn" data-action="favorit" data-id="${esc(l.id)}" aria-pressed="${fav}">Favorit</button>
    <button class="btn danger" data-action="linkloeschen" data-id="${esc(l.id)}" aria-label="${esc(l.titel)} löschen">Löschen</button></li>`;
}

function renderRezepte() {
  const favRezepte = recipes.filter((r) => istFavorit(r.id));
  const favLinks = (state.links ?? []).filter((l) => favSet().has(l.id));
  const pool = recipes.filter((r) => !istFavorit(r.id));
  const links = (state.links ?? []).filter((l) => !favSet().has(l.id));
  let haushalt;
  if (modus === "firebase") {
    const status = verbindungsFehler ? esc(verbindungsFehler) : "Mit dem Haushalt verbunden.";
    const lokalPlan = ladeLokalenState()?.aktuellerPlan;
    const uebernehmen = lokalPlan && !state.aktuellerPlan
      ? '<button class="btn" data-action="lokalUebernehmen">Lokale Daten in Haushalt übernehmen</button>'
      : "";
    haushalt = `<p>${status}</p><button class="btn" data-action="einladung">Einladungslink kopieren</button>${uebernehmen}
      <button class="btn" data-action="haushaltWechseln">Haushalts-ID ändern</button>`;
  } else {
    haushalt = `<p>Firebase ist nicht verbunden. Die Daten liegen nur auf diesem Gerät.${haushaltId ? ` ${esc(lokalHinweis)}` : ""}</p>`;
  }
  return `<h1>Rezepte</h1>
    <h2>Favoriten</h2>
    <ul class="liste">${favRezepte.map(rezeptZeile).join("")}${favLinks.map(linkZeile).join("")}</ul>
    <details id="pool" ${ui.poolOffen ? "open" : ""}><summary>Pool-Rezepte (${pool.length})</summary>
      <ul class="liste">${pool.map(rezeptZeile).join("")}</ul></details>
    <h2>Eigene Links</h2>
    ${links.length ? `<ul class="liste">${links.map(linkZeile).join("")}</ul>` : '<p class="muted">Keine weiteren Links.</p>'}
    <h2>Rezept-Link hinzufügen</h2>
    <form id="link-form" novalidate>
      <div class="feld"><label for="link-titel">Titel</label><input id="link-titel" type="text" autocomplete="off"></div>
      <div class="feld"><label for="link-url">URL (https://…)</label><input id="link-url" type="url" inputmode="url" autocomplete="off" placeholder="https://"></div>
      <p class="fehler" id="link-fehler" role="alert"></p>
      <button class="btn primary" type="submit">Link hinzufügen</button>
    </form>
    <h2>Haushalt</h2>${haushalt}`;
}

// ---------- Rendern: Gesamt ----------

function render() {
  if (!state) return;
  const inputs = [...(root.querySelectorAll?.('input') ?? [])].map(el => ({ id: el.id, value: el.value, start: el.selectionStart, end: el.selectionEnd }));
  const focused = document.activeElement?.id;
  const scroll = globalThis.scrollY ?? 0;
  const inhalt = { woche: renderWoche, einkauf: renderEinkauf, rezepte: renderRezepte }[ui.tab]();
  const tab = (id, label) =>
    `<button data-action="tab" data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}>${TAB_ICONS[id]}<span>${label}</span></button>`;
  let banner = "";
  if (modus === "lokal") {
    banner = `<p class="banner" role="note">Lokaler Modus: nur auf diesem Gerät gespeichert${lokalHinweis ? `. ${esc(lokalHinweis)}` : ""}</p>`;
  } else if (verbindungsFehler) {
    banner = `<div class="banner" role="alert">Aktualisierung unterbrochen. ${esc(verbindungsFehler)}<button class="btn" data-action="reconnect">Neu verbinden</button></div>`;
  }
  root.innerHTML = `<nav class="nav" aria-label="Hauptnavigation">${tab("woche", "Woche")}${tab("einkauf", "Einkauf")}${tab("rezepte", "Rezepte")}</nav>
    ${banner}<main>${inhalt}<div id="save-status" role="status" aria-live="polite"></div></main>`;
  for (const input of inputs) {
    const el = document.getElementById(input.id);
    if (el && 'value' in el) { el.value = input.value; if (focused === input.id) { el.focus(); try { el.setSelectionRange(input.start, input.end); } catch {} } }
  }
  globalThis.window?.scrollTo?.(0, scroll);
  zeichneSave();
}

function renderStart(fehler = "") {
  root.innerHTML = `<main class="start">
    <h1>Essensplaner</h1>
    <p class="muted">Wochenplan und Einkaufsliste für zwei.</p>
    <form id="start-form" novalidate>
      <div class="feld"><label for="haushalt-id">Haushalts-ID einfügen</label>
        <input id="haushalt-id" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      <p class="fehler" id="start-fehler" role="alert">${esc(fehler)}</p>
      <button class="btn primary big" type="submit">Weiter mit Haushalts-ID</button>
    </form>
    <p class="muted" style="margin:24px 0 8px">Oder erst mal ohne gemeinsamen Haushalt:</p>
    <button class="btn big" data-action="lokal">Lokal ausprobieren</button>
  </main>`;
}

// ---------- Start ----------

function leseHaushaltId() {
  const m = location.hash.match(/haushalt=([0-9a-fA-F]{32})/);
  if (m) {
    schreibe(KEY_HAUSHALT, m[1].toLowerCase());
    history.replaceState(null, "", location.pathname + location.search);
  }
  return lies(KEY_HAUSHALT);
}

function ladeLokalenState() {
  try {
    const roh = localStorage.getItem("essensplaner-state");
    return roh ? JSON.parse(roh) : null;
  } catch {
    return null;
  }
}

// Kein stillschweigender Wechsel in den lokalen Modus: Fehler von Firebase werden angezeigt.
async function waehleStore() {
  if (firebaseConfig.apiKey && haushaltId) {
    const modul = await import("./store-firebase.js");
    modus = "firebase";
    return modul.erstelleStore({ haushaltId, config: firebaseConfig });
  }
  modus = "lokal";
  if (haushaltId) lokalHinweis = "Haushalts-ID gespeichert, Firebase ist noch nicht eingerichtet.";
  const { erstelleStore } = await import("./store-local.js");
  return erstelleStore();
}

function renderVerbindungsfehler() {
  root.innerHTML = `<main class="start">
    <h1>Essensplaner</h1>
    <p class="fehler" role="alert">${esc(FEHLER_TEXT)}</p>
    <button class="btn primary big" data-action="nochmal">Nochmal versuchen</button>
    <button class="btn big" data-action="haushaltWechseln">Andere Haushalts-ID eingeben</button>
  </main>`;
}

let abmelden = null;

async function starte() {
  abmelden?.();
  abmelden = null;
  verbindungsFehler = "";
  try {
    store = await waehleStore();
    state = await store.laden();
  } catch (e) {
    console.error(e);
    if (modus === "firebase") return renderVerbindungsfehler();
    throw e;
  }
  savedState = structuredClone(state);
  abonnieren();
  render();
}

function abonnieren() {
  abmelden = store.abonnieren(neu => {
    const changed = JSON.stringify(neu.aktuellerPlan) !== JSON.stringify(savedState?.aktuellerPlan);
    savedState = structuredClone(neu);
    if (pending) return; // retry rebases inside transaction; never lose the unsaved change
    state = neu;
    if (changed) {
      cancelDrag();
      if (sheet?.type === 'move') { schliesseSheet(); toast('Der Plan wurde inzwischen geändert.'); }
      if (undo && undo.after.planRevision !== neu.planRevision) { undo = null; toast('Der Plan wurde inzwischen geändert.'); }
    }
    render();
    if (sheet?.type === 'replace' || sheet?.type === 'wish') { zeichneErgebnisse(); if (sheet.type === 'wish') zeichneWunsch(); }
  }, e => { console.error(e); verbindungsFehler = FEHLER_TEXT; render(); });
}
async function reconnect() {
  abmelden?.();
  try {
    const neu = await store.laden();
    if (!pending && (neu.planRevision ?? null) !== (state.planRevision ?? null)) {
      cancelDrag(); undo = null;
      if (sheet?.type === 'move') schliesseSheet();
      toast('Der Plan wurde inzwischen geändert.');
    }
    savedState = structuredClone(neu);
    if (!pending) state = neu;
    verbindungsFehler = ''; abonnieren(); render();
  } catch (e) { verbindungsFehler = FEHLER_TEXT; render(); }
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  if (el.disabled) return;
  if ((saving || pending) && !['retry','discard','close','tab','reconnect'].includes(el.dataset.action)) return;

  if (el.dataset.action === "lokal") {
    schreibe(KEY_LOKAL, "1");
    return starte();
  }
  if (el.dataset.action === "nochmal") return starte();
  if (el.dataset.action === "haushaltWechseln") {
    abmelden?.();
    abmelden = null;
    try {
      localStorage.removeItem(KEY_HAUSHALT);
    } catch {
      /* egal */
    }
    haushaltId = null;
    return renderStart();
  }
  if (el.dataset.action === "lokalUebernehmen") {
    const lokal = ladeLokalenState();
    if (lokal?.aktuellerPlan) setze({ ...state, ...lokal }, ui.hinweise).then((ok) => { if (ok) toast("Lokale Daten übernommen"); });
    return;
  }
  aktionen[el.dataset.action]?.(el);
});

document.addEventListener("toggle", (e) => {
  if (e.target.id === "pool") ui.poolOffen = e.target.open;
}, true);

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "start-form") {
    const id = e.target.querySelector("#haushalt-id").value.trim().toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(id)) return renderStart("Die Haushalts-ID hat 32 Zeichen (0-9, a-f).");
    schreibe(KEY_HAUSHALT, id);
    haushaltId = id;
    return starte();
  }
  if (e.target.id === "link-form") {
    const titel = e.target.querySelector("#link-titel").value.trim();
    const url = e.target.querySelector("#link-url").value.trim();
    const fehler = document.getElementById("link-fehler");
    const gueltig = sichereLinkUrl(url) !== null;
    if (!titel) return (fehler.textContent = "Bitte einen Titel eingeben.");
    if (!gueltig) return (fehler.textContent = "Die URL muss mit https:// beginnen.");
    if (saving || pending) return;
    const neu = structuredClone(state);
    neu.links = [...(neu.links ?? []), { id: `link-${Date.now()}`, titel, url, hinzugefuegt: heuteIso(), geplantAm: null }];
    setze(neu, ui.hinweise).then((ok) => { if (ok) toast("Link hinzugefügt"); });
  }
});

(async function init() {
  try {
    const res = await fetch("data/recipes.json");
    recipes = (await res.json()).rezepte;
  } catch (e) {
    root.innerHTML = '<main><h1>Essensplaner</h1><p role="alert">Rezepte konnten nicht geladen werden. Bitte die Seite über einen Webserver öffnen.</p></main>';
    console.error(e);
    return;
  }
  haushaltId = leseHaushaltId();
  if (!haushaltId && lies(KEY_LOKAL) !== "1") return renderStart();
  starte();
})();

// The dialog is outside the rerendered app: remote events cannot erase drafts,
// focus, selection or sheet scroll. Native showModal supplies focus containment.
let sheetScrollLock = null;
function lockSheetScroll() {
  if (sheetScrollLock) return;
  sheetScrollLock = { x: window.scrollX, y: window.scrollY, bodyStyle: document.body.getAttribute("style") };
  Object.assign(document.body.style, { position: "fixed", top: `-${sheetScrollLock.y}px`, left: `-${sheetScrollLock.x}px`, width: "100%", overflow: "hidden" });
}
function unlockSheetScroll() {
  if (!sheetScrollLock) return;
  const { x, y, bodyStyle } = sheetScrollLock;
  sheetScrollLock = null;
  if (bodyStyle === null) document.body.removeAttribute("style");
  else document.body.setAttribute("style", bodyStyle);
  window.scrollTo(x, y);
}
function oeffneSheet(type, slot) {
  const existing = document.getElementById('sheet');
  if (existing) { existing.close(); existing.remove(); }
  else {
    lockSheetScroll();
    sheetTrigger = document.activeElement;
    sheetTriggerSelector = focusSelector(sheetTrigger);
    history.pushState({ mealSheet: true }, ''); sheetHistory = true;
  }
  sheet = { type, slot, suche: '', filter: [], day: state.aktuellerPlan?.wunsch?.slot ?? '',
    eintrag: structuredClone(state.aktuellerPlan?.wunsch?.eintrag ?? null), revision: state.planRevision };
  const dialog = document.createElement('dialog'); dialog.id = 'sheet';
  dialog.setAttribute('aria-labelledby', 'sheet-title'); dialog.dataset.kind = type;
  dialog.addEventListener('cancel', e => { e.preventDefault(); schliesseSheet(); });
  installSheetDismiss(dialog);
  document.body.append(dialog); zeichneSheet(); dialog.showModal(); passeSheetHoeheAn();
  dialog.querySelector(inputMethod === 'keyboard' ? '.sheet-heading [data-action="close"]' : '#sheet-title')?.focus({preventScroll:true});
}
function schliesseSheet(fromBack = false) {
  const dialog = document.getElementById('sheet');
  dialog?.close(); dialog?.remove(); sheet = null;
  unlockSheetScroll();
  if (sheetHistory && !fromBack) history.back();
  sheetHistory = false;
  if (sheetTrigger?.isConnected) sheetTrigger.focus({preventScroll:true});
  else (sheetTriggerSelector && document.querySelector(sheetTriggerSelector) || document.querySelector('[data-action="wish"]'))?.focus({preventScroll:true});
}
globalThis.window?.addEventListener('popstate', () => { if (sheet) schliesseSheet(true); });
function zeichneSheet() {
  if (!sheet) return;
  const { type, slot } = sheet;
  const label = slot ? SLOTS[slot].isstTage.join(' + ') : '';
  const entry = state.aktuellerPlan?.slots[slot];
  const title = { wish: 'Wunschgericht', replace: `Gericht für ${label} ändern`, menu: `Gericht für ${label}`,
    details: entry ? anzeigeName(entry, recipes, state) : 'Gericht', move: 'Gericht verschieben', weekmenu: 'Deine Woche', copy: 'Liste kopieren' }[type];
  let content = '';
  if (['wish','replace'].includes(type)) {
    content = `<label for="sheet-search">Gericht suchen</label><input id="sheet-search" type="search" value="${esc(sheet.suche)}" autocomplete="off">
      <div class="filters">${[['favoriten','Favoriten'],['neu','Neu'],['kurz','Bis 30 Min.'],['airfryer','Airfryer'],['fisch','Fisch'],['gefluegel','Geflügel']].map(([id,text]) => `<button class="btn" data-action="filter" data-filter="${id}" aria-pressed="false">${text}<span class="selected-mark" aria-hidden="true"> ✓</span></button>`).join('')}</div>
      <div id="wish-values"></div><p id="result-count" role="status" aria-live="polite"></p><button class="btn" data-action="resetfilter">Filter zurücksetzen</button><ul class="auswahl" id="sheet-results"></ul>`;
  } else if (['menu','details'].includes(type) && entry) {
    content = `<p class="muted">${slot === 'B' ? 'Sonntag vorkochen' : `${TAGE[SLOTS[slot].kochtag]} kochen`} · Vier Portionen</p>
      <h3 class="menu-label">Plan anpassen</h3><div class="sheet-actions">
      <button class="btn" data-action="aendern" data-slot="${slot}">${icon('calendar')}<span>Gericht ändern</span></button>
      <button class="btn" data-action="wuerfeln" data-slot="${slot}">${icon('shuffle')}<span>Neu würfeln</span></button>
      <button class="btn" data-action="move" data-slot="${slot}">${icon('move')}<span>Verschieben</span></button></div>
      <h3 class="menu-label">Rezept und Einkauf</h3><div class="sheet-actions">
      ${menuLink(rezeptUrl(entry), TAB_ICONS.rezepte, 'Rezept öffnen')}
      ${menuLink(bringUrl(entry), TAB_ICONS.einkauf, 'Zu Bring')}
      ${state.aktuellerPlan.neuSlot === slot ? istFavorit(entry.id) ? '<p class="menu-note">Ist jetzt Favorit</p>' : `<button class="btn" data-action="geschmeckt" data-slot="${slot}">${icon('star')}<span>Hat geschmeckt</span></button>` : ''}</div>`;
  } else if (type === 'menu' && !entry) {
    content = `<button class="btn" data-action="aendern" data-slot="${slot}">Gericht auswählen</button>`;
  } else if (type === 'move') {
    content = `<div class="sheet-actions">${Object.keys(SLOTS).filter(s => s !== slot).map(s => `<button class="btn" data-action="destination" data-slot="${s}">${icon('move')}${state.aktuellerPlan.slots[s] ? 'Mit' : 'Nach'} ${SLOTS[s].isstTage.join(' + ')} ${state.aktuellerPlan.slots[s] ? 'tauschen' : 'verschieben'}</button>`).join('')}</div>`;
  } else if (type === 'weekmenu') {
    content = `<div class="sheet-actions"><button class="btn" data-action="wish">${icon("pin")}${state.aktuellerPlan?.wunsch ? 'Wunsch ändern' : 'Wunschgericht'}</button>
      <button class="btn" data-action="planen">${icon("shuffle")}${state.aktuellerPlan?.wunsch ? '2 Gerichte neu planen' : 'Woche planen'}</button>${undo ? '<button class="btn" data-action="undo">Rückgängig</button>' : ''}</div>`;
  } else if (type === 'copy') content = `<p>Kopieren nicht möglich. Du kannst den Text hier markieren und kopieren.</p><textarea readonly aria-label="Einkaufsliste">${esc(sheet.text)}</textarea>`;
  document.getElementById('sheet').innerHTML = `<button class="sheet-grip" data-action="close" aria-label="Bottomsheet schließen"><span></span></button><header class="sheet-heading"><h2 id="sheet-title" tabindex="-1">${esc(title)}</h2><button class="btn icon-button" data-action="close" aria-label="Schließen">${icon('x')}</button></header><div class="sheet-body">${content}</div><footer id="sheet-footer"></footer><div id="sheet-save" role="status"></div>`;
  if (['wish','replace'].includes(type)) {
    document.getElementById('sheet-search').addEventListener('input', e => { sheet.suche = e.target.value; zeichneErgebnisse(); });
    zeichneErgebnisse(); if (type === 'wish') zeichneWunsch();
  }
  zeichneSave();
}
function zeichneErgebnisse() {
  if (!sheet || !['wish','replace'].includes(sheet.type)) return;
  const results = filterKandidaten({ recipes, state, slot: sheet.type === 'replace' ? sheet.slot : null,
    suche: sheet.suche, filter: sheet.filter, aktuell: sheet.type === 'replace' ? state.aktuellerPlan?.slots[sheet.slot]?.id : null });
  document.getElementById('result-count').textContent = `${results.length} Gerichte`;
  document.querySelectorAll('[data-filter]').forEach(el => el.setAttribute('aria-pressed', String(sheet.filter.includes(el.dataset.filter))));
  stableHTML('sheet-results', results.map(k => {
    const r = k.quelle === 'rezept' ? rezeptVon(k.id) : null;
    const selected = sheet.type === 'wish' && sheet.eintrag?.id === k.id;
    const neu = !k.istFavorit && (k.quelle === 'rezept' ? !(state.probiert ?? []).includes(k.id) : k.istNeuKandidat);
    return `<li><button data-action="${sheet.type === 'wish' ? 'selectwish' : 'waehle'}" data-slot="${sheet.slot ?? ''}" data-quelle="${k.quelle}" data-id="${esc(k.id)}" ${sheet.type === 'wish' ? `aria-pressed="${selected}"` : ''}>
      <span><strong>${esc(k.name)}${selected ? ' ✓' : ''}</strong><span class="candidate-meta">${r ? `${r.dauerMin} Min.` : 'Keine Zeitangabe'}${k.istFavorit ? ' · Favorit' : neu ? ' · Neu' : ''}${r?.airfryer ? ' · Airfryer' : ''}${PROTEIN_BADGE[r?.protein] ? ` · ${PROTEIN_BADGE[r.protein]}` : ''}</span></span></button></li>`;
  }).join('') || '<li><p>Keine passenden Gerichte. Suche leeren oder Filter zurücksetzen.</p></li>');
}
function wunschVorschlag() {
  if (!sheet.eintrag) return null;
  const k = kandidaten(recipes, state).find(k => k.id === sheet.eintrag.id && k.quelle === sheet.eintrag.quelle);
  const days = sheet.day ? [sheet.day] : ['A','B','C'];
  let result;
  for (const slot of days) {
    if (wunschGrund(k, slot)) continue;
    result = planeMitWunsch({ recipes, state, heute: new Date(), rng: erzeugeRng(42),
      wunsch: { slot, eintrag: sheet.eintrag }, erhalten: !!state.aktuellerPlan });
    if (result.plan) return result;
  }
  return result ?? { plan: null, hinweise: ['Kein passender Plan. Bitte Wunschgericht oder Tag ändern.'] };
}
function zeichneWunsch() {
  if (sheet?.type !== 'wish') return;
  const k = kandidaten(recipes, state).find(k => k.id === sheet.eintrag?.id && k.quelle === sheet.eintrag?.quelle);
  const result = wunschVorschlag(); sheet.preview = result; sheet.previewRevision = state.planRevision;
  const affected = result?.plan && state.aktuellerPlan ? Object.keys(SLOTS).filter(s => JSON.stringify(result.plan.slots[s]) !== JSON.stringify(state.aktuellerPlan.slots[s])) : [];
  stableHTML('wish-values', `<h3>${sheet.eintrag ? esc(anzeigeName(sheet.eintrag, recipes, state)) : 'Wähle dein Wunschgericht'}</h3>
    <div class="wish-days">${['','A','B','C'].map(day => {
      const reason = day && k ? wunschGrund(k, day) : '';
      return `<div><button class="btn" data-action="wishday" data-day="${day}" aria-pressed="${sheet.day === day}" ${reason ? 'disabled' : ''}>${icon('calendar')}${day ? SLOTS[day].isstTage.join(' + ') : 'Tag egal'}${sheet.day === day ? ' ✓' : ''}</button>${reason ? `<small>${esc(reason)}</small>` : ''}</div>`;
    }).join('')}</div>${affected.length ? `<p class="muted">Wird geändert: ${affected.map(s => SLOTS[s].isstTage.join(' + ')).join(', ')}.</p>` : ''}
    ${result && !result.plan ? `<p class="fehler">${esc(result.hinweise.join(' '))}</p>` : ''}`);
  document.getElementById('sheet-footer').innerHTML = `<button class="btn primary big" data-action="applywish" ${!result?.plan ? 'disabled' : ''}>${state.aktuellerPlan ? 'Wunsch übernehmen' : 'Woche damit planen'}</button>
    ${state.aktuellerPlan?.wunsch ? '<button class="btn" data-action="releasewish">Wunsch lösen</button>' : ''}`;
}
function uebernehmeWunsch() {
  if (!sheet?.preview?.plan) return;
  if (sheet.previewRevision !== state.planRevision) { zeichneWunsch(); return toast('Der Plan wurde inzwischen geändert. Bitte Vorschau prüfen.'); }
  const { plan, hinweise } = sheet.preview;
  return setze(uebernehmePlan(state, plan), hinweise, { close: true, message: 'Wunsch gespeichert' });
}
if (root.addEventListener) cancelDrag = installPlanDrag({ root, revision: () => state?.planRevision,
  move: (from, to) => { if (!pending && !saving) verschiebe(from, to); }, announce: toast });

function passeSheetHoeheAn() {
  const dialog = document.getElementById('sheet');
  if (dialog && window.visualViewport) dialog.style.maxHeight = `${Math.floor(window.visualViewport.height * .94)}px`;
}
globalThis.window?.visualViewport?.addEventListener('resize', passeSheetHoeheAn);

function focusSelector(el) {
  if (!el) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (!el.dataset?.action) return null;
  return ['action','slot','id','quelle','filter','day'].filter(key => el.dataset[key] !== undefined)
    .map(key => `[data-${key}="${CSS.escape(el.dataset[key])}"]`).join('');
}
function stableHTML(id, html) {
  const target = document.getElementById(id);
  if (target.innerHTML === html) return;
  const focused = target.contains(document.activeElement) ? focusSelector(document.activeElement) : null;
  const top = target.scrollTop;
  target.innerHTML = html; target.scrollTop = top;
  if (focused) (target.querySelector(focused) ?? document.getElementById('sheet-search'))?.focus({preventScroll:true});
}

function menuLink(url, glyph, text) {
  const link = externerLink(url, text);
  return link.replace(`>${esc(text)}</`, `>${glyph}<span>${esc(text)}</span></`);
}

// Dismiss only gestures starting on the backdrop or the sheet's dedicated head.
// Body touches keep native scrolling, including when the list is already at top.
function installSheetDismiss(dialog) {
  let outsideStart = false, gesture = null, swallowedClick = false;
  const outside = e => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  const reset = () => { if (gesture) dialog.style.transform = ''; gesture = null; };
  dialog.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;
    outsideStart = e.target === dialog && outside(e);
    if (outsideStart) return;
    const grip = e.target.closest('.sheet-grip');
    const head = e.target.closest('.sheet-heading');
    if (!grip && (!head || e.target.closest('button,a,input'))) return;
    gesture = { id:e.pointerId, x:e.clientX, y:e.clientY, distance:0, grip:!!grip };
    dialog.setPointerCapture(e.pointerId);
  });
  dialog.addEventListener('pointermove', e => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const dy = e.clientY - gesture.y, dx = Math.abs(e.clientX - gesture.x);
    gesture.distance = Math.max(0, dy);
    if (dy > 8 && dy > dx) {
      e.preventDefault(); dialog.style.transform = `translateY(${dy}px)`;
    }
  });
  dialog.addEventListener('pointerup', e => {
    if (outsideStart && e.target === dialog && outside(e)) {
      outsideStart = false; swallowedClick = true; e.preventDefault();
      // Removing the modal during pointerup must not send its click to a button below.
      const pointerId = e.pointerId;
      const swallow = click => {
        if (click.pointerId !== pointerId) return;
        click.preventDefault(); click.stopImmediatePropagation();
        document.removeEventListener('click', swallow, true);
      };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 400);
      schliesseSheet(); return;
    }
    outsideStart = false;
    if (!gesture || e.pointerId !== gesture.id) return;
    const distance = gesture.distance, dx = Math.abs(e.clientX - gesture.x), grip = gesture.grip;
    swallowedClick = distance > 8;
    reset();
    if ((distance >= 80 && distance > dx) || (grip && distance < 8 && dx < 8)) { e.preventDefault(); schliesseSheet(); }
  });
  dialog.addEventListener('pointercancel', () => { outsideStart = false; swallowedClick = true; reset(); });
  dialog.addEventListener('lostpointercapture', reset);
  dialog.addEventListener('click', e => {
    if (swallowedClick) { swallowedClick = false; e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
}
