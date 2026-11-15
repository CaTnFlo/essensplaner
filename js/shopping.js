// Reine Einkaufslisten-Logik (SPEC 5.2). Kein DOM, kein Netzwerk.

const KATEGORIEN = ["obst-gemuese", "fleisch-fisch", "kuehlregal", "backwaren", "tiefkuehl", "vorrat", "gewuerze"];

function zutatenVon(eintrag, recipes) {
  const r = recipes.find((x) => x.id === eintrag.id);
  if (!r) return [];
  const zutaten = [...(r.zutaten ?? [])];
  for (const g of r.variantenGruppen ?? []) {
    const opt = (g.optionen ?? []).find((o) => o.id === eintrag.variante?.[g.id]);
    if (opt) zutaten.push(...(opt.zutaten ?? []));
  }
  return zutaten.map((z) => ({ z, rezept: r.name }));
}

function zusammenfassen(quellen) {
  const map = new Map();
  for (const { z, rezept } of quellen) {
    const name = z.name.trim();
    const schluessel = `${name.toLowerCase()}|${z.einheit ?? ""}`;
    const vorhanden = map.get(schluessel);
    if (!vorhanden) {
      map.set(schluessel, { name, menge: z.menge ?? null, einheit: z.einheit ?? null, kategorie: z.kategorie, vorrat: !!z.vorrat, rezepte: [rezept] });
      continue;
    }
    if (z.menge != null) vorhanden.menge = Math.round(((vorhanden.menge ?? 0) + z.menge) * 100) / 100;
    if (!vorhanden.rezepte.includes(rezept)) vorhanden.rezepte.push(rezept);
  }
  const rang = (k) => {
    const i = KATEGORIEN.indexOf(k);
    return i === -1 ? KATEGORIEN.length : i;
  };
  return [...map.values()].sort(
    (a, b) => Number(a.vorrat) - Number(b.vorrat) || rang(a.kategorie) - rang(b.kategorie) || a.name.localeCompare(b.name, "de"),
  );
}

export function einkaufsliste({ plan, recipes, state }) {
  const samstag = [];
  const donnerstag = [];
  const links = [];
  for (const slot of ["A", "B", "C"]) {
    const e = plan.slots?.[slot];
    if (!e) continue;
    if (e.quelle === "link") {
      const l = (state.links ?? []).find((x) => x.id === e.id);
      if (l) links.push({ titel: l.titel, url: l.url });
      continue;
    }
    for (const q of zutatenVon(e, recipes)) {
      (slot === "C" && q.z.frisch ? donnerstag : samstag).push(q);
    }
  }
  return { samstag: zusammenfassen(samstag), donnerstag: zusammenfassen(donnerstag), links };
}
