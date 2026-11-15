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
