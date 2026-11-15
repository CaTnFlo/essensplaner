// Bring!-Link und Rezeptseiten-Pfad (SPEC 5.3). Kein DOM, kein Netzwerk.

export function bringLink(rezeptUrl) {
  return `https://api.getbring.com/rest/bringrecipes/deeplink?url=${encodeURIComponent(rezeptUrl)}&source=web`;
}

// Für Links gibt es keine eigene Seite: null.
// Reihenfolge der Optionen = Schlüsselreihenfolge von eintrag.variante (entspricht der Gruppenreihenfolge).
export function rezeptSeitenPfad(eintrag) {
  if (eintrag.quelle === "link") return null;
  const optionen = Object.values(eintrag.variante ?? {});
  return optionen.length ? `rezepte/${eintrag.id}--${optionen.join("-")}.html` : `rezepte/${eintrag.id}.html`;
}
