// Bring!-Link und Rezeptseiten-Pfad (SPEC 5.3). Kein DOM, kein Netzwerk.

export function bringLink(rezeptUrl) {
  return `https://api.getbring.com/rest/bringrecipes/deeplink?url=${encodeURIComponent(rezeptUrl)}&source=web`;
}

// Für Links gibt es keine eigene Seite: null.
// Ohne recipes: Reihenfolge der Optionen = Schlüsselreihenfolge von eintrag.variante.
// Mit recipes (P6b Frage 3): Reihenfolge der variantenGruppen des Rezepts, unabhängig von der Schlüsselreihenfolge.
// Gruppen, die in eintrag.variante fehlen, werden übersprungen.
export function rezeptSeitenPfad(eintrag, recipes = null) {
  if (eintrag.quelle === "link") return null;
  const variante = eintrag.variante ?? {};
  const rezept = recipes ? recipes.find((r) => r.id === eintrag.id) : null;
  const optionen = rezept
    ? (rezept.variantenGruppen ?? []).filter((g) => variante[g.id] != null).map((g) => variante[g.id])
    : Object.values(variante);
  return optionen.length ? `rezepte/${eintrag.id}--${optionen.join("-")}.html` : `rezepte/${eintrag.id}.html`;
}

// Merge both shopping days, keeping unlike units separate and pantry staples out.
export function gesamtEinkauf(liste) {
  const items = new Map();
  for (const p of [...liste.samstag, ...liste.donnerstag]) {
    if (p.vorrat) continue;
    const key = `${p.name.trim().toLowerCase()}|${p.einheit ?? ''}`;
    const old = items.get(key);
    if (!old) items.set(key, {...p});
    else if (p.menge != null) old.menge = Math.round(((old.menge ?? 0) + p.menge) * 100) / 100;
  }
  return [...items.values()];
}

export function bringWochenLink(plan) {
  const entries = ['A','B','C'].map(s=>plan.slots?.[s]).filter(e=>e && e.quelle !== 'link')
    .map(e=>({id:e.id,variante:e.variante ?? {}}));
  if (!entries.length) return null;
  const url = new URL('https://essensplaner-bring.flo2-duell.workers.dev/einkauf');
  url.searchParams.set('gerichte',JSON.stringify(entries));
  return bringLink(url.href);
}
