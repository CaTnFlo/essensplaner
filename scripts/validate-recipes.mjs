#!/usr/bin/env node
// Validator für data/recipes.json gegen SPEC 4.1 bis 4.3.
// Aufruf: node scripts/validate-recipes.mjs [pfad] [--voll]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TYPEN = ["favorit", "pool"];
const PROTEINE = ["fisch", "gefluegel", "hack", "rind", "schwein", "vegetarisch"];
const TAGS = ["ofen", "pfanne", "topf", "airfryer", "schnell", "scharf"];
const EINHEITEN = ["g", "ml", "Stück", "EL", "TL", "Prise", "Bund", "Dose", "Packung", "Zehe"];
const KATEGORIEN = ["obst-gemuese", "fleisch-fisch", "kuehlregal", "backwaren", "vorrat", "gewuerze", "tiefkuehl"];

// SPEC 4.2: festgelegte Favoriten
const FAVORITEN = {
  "lachs-spinat-nudeln": { protein: "fisch", haltbarTage: 1, gruppen: {} },
  lasagne: { protein: "hack", haltbarTage: 3, gruppen: {} },
  curry: { protein: "gefluegel", haltbarTage: 3, gruppen: {} },
  "hack-brokkoli-auflauf": { protein: "hack", haltbarTage: 3, gruppen: {} },
  "chili-con-carne": { protein: "hack", haltbarTage: 3, gruppen: {} },
  "nudel-baukasten": {
    protein: "gefluegel",
    haltbarTage: 1,
    gruppen: {
      beilage: ["brokkoli", "bohnen", "blumenkohl", "pilze"],
      sosse: ["sahne", "tomate"],
    },
  },
  ofengemuese: {
    protein: "vegetarisch",
    haltbarTage: 1,
    gruppen: { dazu: ["steak", "ofenkaese", "beides"] },
  },
};

const istObjekt = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const istGanzzahl = (x) => Number.isInteger(x);
const anzeige = (v) => (typeof v === "string" ? `"${v}"` : JSON.stringify(v));

function pruefeZutat(z, pfad, fehler) {
  if (!istObjekt(z)) {
    fehler.push(`${pfad}: muss ein Objekt sein`);
    return;
  }
  if (typeof z.name !== "string" || z.name.trim() === "") fehler.push(`${pfad}.name: muss ein nicht leerer Text sein`);
  const mengeOk = z.menge === null || (typeof z.menge === "number" && Number.isFinite(z.menge) && z.menge > 0);
  if (!mengeOk) fehler.push(`${pfad}.menge: ${anzeige(z.menge)} muss eine Zahl > 0 oder null sein`);
  if (z.einheit === null) {
    if (z.menge !== null && mengeOk) fehler.push(`${pfad}.einheit: darf nur null sein, wenn menge null ist`);
  } else if (!EINHEITEN.includes(z.einheit)) {
    fehler.push(`${pfad}.einheit: ${anzeige(z.einheit)} ist keine erlaubte Einheit`);
  } else if (z.menge === null) {
    fehler.push(`${pfad}.einheit: muss null sein, wenn menge null ist`);
  }
  if (!KATEGORIEN.includes(z.kategorie)) fehler.push(`${pfad}.kategorie: ${anzeige(z.kategorie)} ist keine erlaubte Kategorie`);
  if (typeof z.frisch !== "boolean") fehler.push(`${pfad}.frisch: muss boolean sein`);
  if (typeof z.vorrat !== "boolean") fehler.push(`${pfad}.vorrat: muss boolean sein`);
}

function pruefeRezept(r, pfad, fehler) {
  if (!istObjekt(r)) {
    fehler.push(`${pfad}: muss ein Objekt sein`);
    return;
  }
  const p = typeof r.id === "string" && r.id !== "" ? r.id : pfad;

  if (typeof r.id !== "string" || !KEBAB.test(r.id)) fehler.push(`${p}.id: ${anzeige(r.id)} ist nicht kebab-case`);
  if (typeof r.name !== "string" || r.name.trim() === "") fehler.push(`${p}.name: muss ein nicht leerer Text sein`);
  if (!TYPEN.includes(r.typ)) fehler.push(`${p}.typ: ${anzeige(r.typ)} ist kein erlaubter Typ (favorit | pool)`);
  if (!PROTEINE.includes(r.protein)) fehler.push(`${p}.protein: ${anzeige(r.protein)} ist kein erlaubtes Protein`);
  if (!istGanzzahl(r.haltbarTage) || r.haltbarTage < 1 || r.haltbarTage > 4)
    fehler.push(`${p}.haltbarTage: ${anzeige(r.haltbarTage)} muss eine Ganzzahl von 1 bis 4 sein`);
  if (r.portionen !== 4) fehler.push(`${p}.portionen: ${anzeige(r.portionen)} muss 4 sein`);
  if (!istGanzzahl(r.dauerMin) || r.dauerMin < 10 || r.dauerMin > 180)
    fehler.push(`${p}.dauerMin: ${anzeige(r.dauerMin)} muss eine Ganzzahl von 10 bis 180 sein`);
  if (typeof r.airfryer !== "boolean") fehler.push(`${p}.airfryer: muss boolean sein`);

  if (!Array.isArray(r.tags)) {
    fehler.push(`${p}.tags: muss ein Array sein`);
  } else {
    r.tags.forEach((t, i) => {
      if (!TAGS.includes(t)) fehler.push(`${p}.tags[${i}]: ${anzeige(t)} ist kein erlaubter Tag`);
      if (t === "schnell" && r.dauerMin > 30) fehler.push(`${p}.tags[${i}]: schnell ist nur bei dauerMin <= 30 erlaubt`);
    });
  }

  if (!Array.isArray(r.zutaten) || r.zutaten.length < 3) {
    fehler.push(`${p}.zutaten: mindestens 3 Einträge nötig`);
  }
  if (Array.isArray(r.zutaten)) r.zutaten.forEach((z, i) => pruefeZutat(z, `${p}.zutaten[${i}]`, fehler));

  if (!Array.isArray(r.schritte) || r.schritte.length < 3 || r.schritte.length > 12) {
    fehler.push(`${p}.schritte: 3 bis 12 Einträge nötig`);
  }
  if (Array.isArray(r.schritte)) {
    r.schritte.forEach((s, i) => {
      if (typeof s !== "string" || s.trim() === "") fehler.push(`${p}.schritte[${i}]: muss ein nicht leerer Text sein`);
    });
  }

  if (r.variantenGruppen !== undefined) {
    if (!Array.isArray(r.variantenGruppen)) {
      fehler.push(`${p}.variantenGruppen: muss ein Array sein`);
    } else {
      const gruppenIds = new Set();
      r.variantenGruppen.forEach((g, gi) => {
        const gp = `${p}.variantenGruppen[${gi}]`;
        if (!istObjekt(g)) {
          fehler.push(`${gp}: muss ein Objekt sein`);
          return;
        }
        if (typeof g.id !== "string" || !KEBAB.test(g.id)) fehler.push(`${gp}.id: ${anzeige(g.id)} ist nicht kebab-case`);
        else if (gruppenIds.has(g.id)) fehler.push(`${gp}.id: ${anzeige(g.id)} kommt mehrfach vor`);
        else gruppenIds.add(g.id);
        if (typeof g.name !== "string" || g.name.trim() === "") fehler.push(`${gp}.name: muss ein nicht leerer Text sein`);
        if (!Array.isArray(g.optionen) || g.optionen.length === 0) {
          fehler.push(`${gp}.optionen: mindestens eine Option nötig`);
          return;
        }
        const optIds = new Set();
        g.optionen.forEach((o, oi) => {
          const op = `${gp}.optionen[${oi}]`;
          if (!istObjekt(o)) {
            fehler.push(`${op}: muss ein Objekt sein`);
            return;
          }
          if (typeof o.id !== "string" || !KEBAB.test(o.id)) fehler.push(`${op}.id: ${anzeige(o.id)} ist nicht kebab-case`);
          else if (optIds.has(o.id)) fehler.push(`${op}.id: ${anzeige(o.id)} kommt in der Gruppe mehrfach vor`);
          else optIds.add(o.id);
          if (typeof o.name !== "string" || o.name.trim() === "") fehler.push(`${op}.name: muss ein nicht leerer Text sein`);
          if (!Array.isArray(o.zutaten) || o.zutaten.length < 1) {
            fehler.push(`${op}.zutaten: mindestens 1 Eintrag nötig`);
          } else {
            o.zutaten.forEach((z, zi) => pruefeZutat(z, `${op}.zutaten[${zi}]`, fehler));
          }
        });
      });
    }
  }
}

function pruefeVollstaendigkeit(rezepte, fehler) {
  const nachId = new Map(rezepte.filter((r) => istObjekt(r)).map((r) => [r.id, r]));
  const favoriten = rezepte.filter((r) => istObjekt(r) && r.typ === "favorit");
  const pool = rezepte.filter((r) => istObjekt(r) && r.typ === "pool");

  // 4.2 Favoriten
  for (const [id, soll] of Object.entries(FAVORITEN)) {
    const r = nachId.get(id);
    if (!r) {
      fehler.push(`${id}: Favorit fehlt (SPEC 4.2)`);
      continue;
    }
    if (r.typ !== "favorit") fehler.push(`${id}.typ: muss "favorit" sein`);
    if (r.protein !== soll.protein) fehler.push(`${id}.protein: ${anzeige(r.protein)} statt "${soll.protein}"`);
    if (r.haltbarTage !== soll.haltbarTage) fehler.push(`${id}.haltbarTage: ${anzeige(r.haltbarTage)} statt ${soll.haltbarTage}`);
    const ist = Array.isArray(r.variantenGruppen) ? r.variantenGruppen : [];
    const istIds = ist.map((g) => g?.id);
    const sollIds = Object.keys(soll.gruppen);
    for (const gid of sollIds) {
      const g = ist.find((x) => x?.id === gid);
      if (!g) {
        fehler.push(`${id}.variantenGruppen: Gruppe "${gid}" fehlt`);
        continue;
      }
      const optIst = (Array.isArray(g.optionen) ? g.optionen : []).map((o) => o?.id);
      const optSoll = soll.gruppen[gid];
      if (optIst.length !== optSoll.length || optSoll.some((o, i) => optIst[i] !== o))
        fehler.push(`${id}.variantenGruppen[${gid}].optionen: [${optIst.join(", ")}] statt [${optSoll.join(", ")}]`);
    }
    for (const gid of istIds) {
      if (!sollIds.includes(gid)) fehler.push(`${id}.variantenGruppen: unerwartete Gruppe ${anzeige(gid)}`);
    }
  }
  for (const r of favoriten) {
    if (!(r.id in FAVORITEN)) fehler.push(`${r.id}: unerwarteter Favorit, SPEC 4.2 legt genau 7 fest`);
  }

  // 4.3 Pool
  const zaehle = (fn) => pool.filter(fn).length;
  const q = (ok, text) => ok || fehler.push(`Pool: ${text}`);
  q(pool.length === 30, `genau 30 Rezepte nötig, gefunden ${pool.length}`);
  q(zaehle((r) => r.protein === "gefluegel") >= 10, `mindestens 10 gefluegel nötig, gefunden ${zaehle((r) => r.protein === "gefluegel")}`);
  q(zaehle((r) => r.protein === "fisch") >= 5, `mindestens 5 fisch nötig, gefunden ${zaehle((r) => r.protein === "fisch")}`);
  q(zaehle((r) => r.protein === "hack") <= 6, `höchstens 6 hack erlaubt, gefunden ${zaehle((r) => r.protein === "hack")}`);
  q(
    zaehle((r) => r.protein === "rind" || r.protein === "schwein") >= 3,
    `mindestens 3 rind oder schwein nötig, gefunden ${zaehle((r) => r.protein === "rind" || r.protein === "schwein")}`,
  );
  q(zaehle((r) => r.protein === "vegetarisch") <= 4, `höchstens 4 vegetarisch erlaubt, gefunden ${zaehle((r) => r.protein === "vegetarisch")}`);
  q(zaehle((r) => r.airfryer === true) >= 8, `mindestens 8 mit airfryer: true nötig, gefunden ${zaehle((r) => r.airfryer === true)}`);
  q(zaehle((r) => r.haltbarTage >= 3) >= 10, `mindestens 10 mit haltbarTage >= 3 nötig, gefunden ${zaehle((r) => r.haltbarTage >= 3)}`);
  q(zaehle((r) => r.dauerMin <= 60) >= 20, `mindestens 20 mit dauerMin <= 60 nötig, gefunden ${zaehle((r) => r.dauerMin <= 60)}`);
  for (const r of pool) {
    if (Array.isArray(r.variantenGruppen) && r.variantenGruppen.length > 0)
      fehler.push(`${r.id}.variantenGruppen: Pool-Rezepte dürfen keine Varianten haben`);
  }
}

/** Prüft die geparsten Daten. Leeres Array = gültig. */
export function validiere(daten, { voll = false } = {}) {
  const fehler = [];
  if (!istObjekt(daten)) return ["Wurzel: muss ein Objekt sein"];
  if (daten.version !== 1) fehler.push(`version: ${anzeige(daten.version)} muss 1 sein`);
  if (!Array.isArray(daten.rezepte)) {
    fehler.push("rezepte: muss ein Array sein");
    return fehler;
  }

  const gesehen = new Set();
  daten.rezepte.forEach((r, i) => {
    pruefeRezept(r, `rezepte[${i}]`, fehler);
    if (istObjekt(r) && typeof r.id === "string") {
      if (gesehen.has(r.id)) fehler.push(`${r.id}.id: ID kommt mehrfach vor`);
      gesehen.add(r.id);
    }
  });

  if (voll) pruefeVollstaendigkeit(daten.rezepte, fehler);
  return fehler;
}

function main() {
  const args = process.argv.slice(2);
  const voll = args.includes("--voll");
  const pfad = args.find((a) => !a.startsWith("--")) ?? "data/recipes.json";

  let daten;
  try {
    daten = JSON.parse(readFileSync(pfad, "utf8"));
  } catch (e) {
    console.error(`${pfad}: ${e.message}`);
    process.exit(1);
  }

  const fehler = validiere(daten, { voll });
  if (fehler.length > 0) {
    console.error(fehler.join("\n"));
    process.exit(1);
  }
  const rezepte = daten.rezepte;
  const f = rezepte.filter((r) => r.typ === "favorit").length;
  console.log(`OK: ${rezepte.length} Rezepte (${f} Favoriten, ${rezepte.length - f} Pool)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
