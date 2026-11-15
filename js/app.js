// UI, Navigation, Events (SPEC 6, 7). Planungslogik liegt in planner.js / shopping.js / bring.js.
import { SLOTS, erzeugeRng, planeWoche, wuerfleSlot, setzeSlot, pruefePlan, uebernehmePlan, anzeigeName, kandidaten } from "./planner.js";
import { einkaufsliste } from "./shopping.js";
import { bringLink, rezeptSeitenPfad } from "./bring.js";
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
const ui = { tab: "woche", aendern: null, hinweise: [], poolOffen: false };

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

let toastTimer;
function toast(text) {
  statusEl.textContent = text;
  statusEl.classList.add("zeigen");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => statusEl.classList.remove("zeigen"), 2200);
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
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) return toast("Kopieren nicht möglich");
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
  if (eintrag.quelle === "link") return linkVon(eintrag.id)?.url ?? "#";
  return new URL(rezeptSeitenPfad(eintrag, recipes), location.href).href;
}
function bringUrl(eintrag) {
  return bringLink(rezeptUrl(eintrag));
}

// Rezept-Eintrag ohne Variantenwahl, nur für Links zur Rezeptseite im Rezepte-Tab.
function standardEintrag(r) {
  const variante = r.variantenGruppen?.length
    ? Object.fromEntries(r.variantenGruppen.map((g) => [g.id, g.optionen[0].id]))
    : null;
  return { quelle: "rezept", id: r.id, variante };
}

// ---------- Zustand ändern ----------

async function setze(neuerState, hinweise = []) {
  state = neuerState;
  ui.hinweise = hinweise;
  ui.aendern = null;
  render();
  try {
    await store.speichern(state);
    if (modus === "firebase" && verbindungsFehler) {
      verbindungsFehler = "";
      render();
    }
  } catch (e) {
    console.error(e);
    if (modus === "firebase") {
      verbindungsFehler = FEHLER_TEXT;
      render();
    }
    toast("Speichern fehlgeschlagen");
  }
}

const rng = () => erzeugeRng(Date.now());

function planen() {
  const { plan, hinweise } = planeWoche({ recipes, state, heute: new Date(), rng: rng() });
  return setze(uebernehmePlan(state, plan), hinweise);
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
    if (confirm("Aktuellen Plan ersetzen?")) planen();
  },
  wuerfeln: (el) => {
    const { plan, hinweise } = wuerfleSlot({ recipes, state, plan: state.aktuellerPlan, slot: el.dataset.slot, rng: rng() });
    return setze(uebernehmePlan(state, plan), hinweise);
  },
  aendern: (el) => {
    ui.aendern = ui.aendern === el.dataset.slot ? null : el.dataset.slot;
    render();
  },
  waehle: (el) => {
    const k = kandidaten(recipes, state).find((x) => x.quelle === el.dataset.quelle && x.id === el.dataset.id);
    if (!k) return;
    const plan = setzeSlot(state.aktuellerPlan, el.dataset.slot, eintragFuer(k, rng()));
    return setze(uebernehmePlan(state, plan), []);
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
  const eintrag = plan.slots[slot];
  const cfg = SLOTS[slot];
  const ist = cfg.isstTage.join(" + ");
  const kochen = `${TAGE[cfg.kochtag]} ${slot === "B" ? "vorkochen" : "kochen"} · ${ist}`;
  if (!eintrag) return `<section class="card"><p class="tag">${esc(kochen)}</p><h3>Kein Gericht</h3></section>`;

  const name = anzeigeName(eintrag, recipes, state);
  const r = eintrag.quelle === "rezept" ? rezeptVon(eintrag.id) : null;
  const istNeu = plan.neuSlot === slot;
  const badges = [];
  if (istNeu) badges.push('<li class="badge neu">Neu</li>');
  if (r && PROTEIN_BADGE[r.protein]) badges.push(`<li class="badge">${PROTEIN_BADGE[r.protein]}</li>`);
  if (r?.airfryer) badges.push('<li class="badge">Airfryer</li>');
  if (r) badges.push(`<li class="badge">${r.dauerMin} Min.</li>`);
  if (eintrag.quelle === "link") badges.push('<li class="badge">Eigener Link</li>');

  const fav = istFavorit(eintrag.id);
  const geschmeckt = istNeu
    ? fav
      ? '<p class="small muted" style="margin:8px 0 0">Ist jetzt Favorit</p>'
      : `<button class="btn" data-action="geschmeckt" data-slot="${slot}">Hat geschmeckt</button>`
    : "";

  let auswahl = "";
  if (ui.aendern === slot) {
    const gueltig = kandidaten(recipes, state)
      .filter((k) => k.haltbarTage >= cfg.minHaltbar && k.id !== eintrag.id)
      .sort((a, b) => Number(b.istFavorit) - Number(a.istFavorit) || a.name.localeCompare(b.name, "de"));
    auswahl = `<ul class="auswahl" aria-label="Kandidaten für Slot ${slot}">${gueltig
      .map(
        (k) => `<li><button data-action="waehle" data-slot="${slot}" data-quelle="${k.quelle}" data-id="${esc(k.id)}">
          <span>${esc(k.name)}</span><span class="small muted">${k.istFavorit ? "Favorit" : k.quelle === "link" ? "Link" : "Pool"}</span></button></li>`,
      )
      .join("")}</ul>`;
  }

  return `<section class="card" aria-label="Slot ${slot}">
    <p class="tag">${esc(kochen)}</p>
    <h3>${esc(name)}</h3>
    <ul class="badges">${badges.join("")}</ul>
    <div class="row">
      <button class="btn" data-action="wuerfeln" data-slot="${slot}">Neu würfeln</button>
      <button class="btn" data-action="aendern" data-slot="${slot}" aria-expanded="${ui.aendern === slot}">Ändern</button>
      <a class="btn" href="${esc(bringUrl(eintrag))}" target="_blank" rel="noopener">Zu Bring</a>
      <a class="btn" href="${esc(rezeptUrl(eintrag))}" target="_blank" rel="noopener">Rezept</a>
      ${geschmeckt}
    </div>
    ${auswahl}
  </section>`;
}

function renderWoche() {
  const plan = state.aktuellerPlan;
  if (!plan) {
    return `<h1>Woche</h1><p class="muted">Noch kein Plan. Ein Klick, und die Woche steht.</p>
      <button class="btn primary big" data-action="planen">Woche planen</button>`;
  }
  const meldungen = [...ui.hinweise, ...pruefePlan({ plan, recipes, state })];
  const kasten = meldungen.length
    ? `<div class="hinweise" role="status"><ul>${meldungen.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>`
    : "";
  return `<h1>Woche ab ${wochentagKurz(plan.wocheAb)}, ${datumKurz(plan.wocheAb)}</h1>
    ${["A", "B", "C"].map((s) => slotKarte(s, plan)).join("")}
    ${kasten}
    <button class="btn big" data-action="neuplanen">Woche neu planen</button>`;
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
    `<li>${esc(postenText(p))}<span class="rezepte">${esc(p.rezepte.join(", "))}</span></li>`;
  return `<h2>${esc(titel)}</h2>
    <button class="btn" data-action="kopieren" data-liste="${key}">Liste kopieren</button>
    ${gruppen.map((g) => `<p class="kategorie">${esc(KATEGORIE_NAMEN[g.k] ?? g.k)}</p><ul class="posten">${g.items.map(zeile).join("")}</ul>`).join("")}
    ${vorrat.length ? `<p class="kategorie">Habt ihr wahrscheinlich da</p><ul class="posten vorrat">${vorrat.map(zeile).join("")}</ul>` : ""}`;
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
        <a class="btn" href="${esc(bringUrl(e))}" target="_blank" rel="noopener" aria-label="${esc(anzeigeName(e, recipes, state))} zu Bring">Zu Bring</a></li>`;
    })
    .join("");
  const links = liste.links.length
    ? `<h2>Eigene Rezepte</h2><ul class="liste">${liste.links
        .map((l) => `<li><span class="name">${esc(l.titel)}<br><span class="small muted">Zutaten siehe Rezept</span></span>
          <a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">Rezept</a></li>`)
        .join("")}</ul>`
    : "";
  return `<h1>Einkauf</h1>
    <h2>Gerichte</h2><ul class="liste">${gerichte}</ul>
    ${abschnitt("Samstag (Großeinkauf)", "samstag", liste.samstag)}
    ${abschnitt("Donnerstag (Nachkauf)", "donnerstag", liste.donnerstag)}
    ${links}`;
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
    <a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener" aria-label="${esc(l.titel)}: Rezept">Rezept</a>
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
  const inhalt = { woche: renderWoche, einkauf: renderEinkauf, rezepte: renderRezepte }[ui.tab]();
  const tab = (id, label) => `<button data-action="tab" data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}>${label}</button>`;
  let banner = "";
  if (modus === "lokal") {
    banner = `<p class="banner" role="note">Lokaler Modus: nur auf diesem Gerät gespeichert${lokalHinweis ? `. ${esc(lokalHinweis)}` : ""}</p>`;
  } else if (verbindungsFehler) {
    banner = `<p class="banner" role="alert">${esc(verbindungsFehler)}</p>`;
  }
  root.innerHTML = `${banner}<main>${inhalt}</main>
    <nav class="nav" aria-label="Hauptnavigation">${tab("woche", "Woche")}${tab("einkauf", "Einkauf")}${tab("rezepte", "Rezepte")}</nav>`;
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
  abmelden = store.abonnieren(
    (neu) => {
      state = neu;
      if (verbindungsFehler) verbindungsFehler = "";
      render();
    },
    (e) => {
      console.error(e);
      verbindungsFehler = FEHLER_TEXT;
      render();
    },
  );
  render();
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
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
    if (lokal?.aktuellerPlan) setze({ ...state, ...lokal }, ui.hinweise).then(() => toast("Lokale Daten übernommen"));
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
    let gueltig = false;
    try {
      gueltig = url.startsWith("https://") && !!new URL(url).hostname;
    } catch {
      /* ungültig */
    }
    if (!titel) return (fehler.textContent = "Bitte einen Titel eingeben.");
    if (!gueltig) return (fehler.textContent = "Die URL muss mit https:// beginnen.");
    const neu = structuredClone(state);
    neu.links = [...(neu.links ?? []), { id: `link-${Date.now()}`, titel, url, hinzugefuegt: heuteIso(), geplantAm: null }];
    setze(neu, ui.hinweise).then(() => toast("Link hinzugefügt"));
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
