#!/usr/bin/env node
// Erzeugt statische Rezeptseiten mit schema.org-JSON-LD aus data/recipes.json (SPEC 5.4).
// Aufruf: node scripts/build-pages.mjs [eingabe] [ausgabeordner]

import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rezeptSeitenPfad } from "../js/bring.js";
import { validiere } from "./validate-recipes.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// 1,5 statt 1.5; keine unnötigen Nachkommastellen.
const menge = (x) => String(Math.round(x * 100) / 100).replace(".", ",");

const zutatText = (z) => (z.menge === null ? z.name : `${menge(z.menge)} ${z.einheit} ${z.name}`);

// Kreuzprodukt aller Gruppen. Ohne Gruppen: genau eine leere Kombination.
function kombinationen(gruppen) {
  return gruppen.reduce(
    (acc, g) => acc.flatMap((teil) => g.optionen.map((o) => [...teil, { gruppe: g, option: o }])),
    [[]],
  );
}

function jsonLd({ titel, portionen, dauerMin, zutaten, schritte }) {
  const obj = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: titel,
    recipeYield: `${portionen} Portionen`,
    totalTime: `PT${dauerMin}M`,
    recipeIngredient: zutaten.map(zutatText),
    recipeInstructions: schritte.map((text) => ({ "@type": "HowToStep", text })),
  };
  // "</" nie wörtlich im Script-Block; "<\/" ist gültiges JSON.
  return JSON.stringify(obj, null, 2).replace(/<\//g, "<\\/");
}

function seite(werte) {
  const { titel, portionen, dauerMin, zutaten, schritte } = werte;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<link rel="stylesheet" href="../css/rezept.css">
<link rel="icon" href="../icons/icon.svg" type="image/svg+xml">
<script type="application/ld+json">
${jsonLd(werte)}
</script>
</head>
<body>
<header class="kopf"><a href="../index.html">Zurück zum Plan</a></header>
<main>
<h1>${esc(titel)}</h1>
<p class="meta">${esc(portionen)} Portionen · ${esc(dauerMin)} Min.</p>
<h2>Zutaten</h2>
<ul class="zutaten">
${zutaten.map((z) => `<li>${esc(zutatText(z))}</li>`).join("\n")}
</ul>
<h2>Zubereitung</h2>
<ol class="schritte">
${schritte.map((s) => `<li>${esc(s)}</li>`).join("\n")}
</ol>
</main>
</body>
</html>
`;
}

// Erzeugt { dateiname, html } für jede Seite (Rezept ohne Varianten bzw. jede Kombination).
export function baueSeiten(daten) {
  const seiten = [];
  const dateinamen = new Set();
  for (const r of daten.rezepte) {
    for (const kombi of kombinationen(r.variantenGruppen ?? [])) {
      const variante = Object.fromEntries(kombi.map(({ gruppe, option }) => [gruppe.id, option.id]));
      const titel = kombi.length
        ? `${r.name} (${kombi.map(({ option }) => option.name).join(", ")})`
        : r.name;
      const zutaten = [...r.zutaten, ...kombi.flatMap(({ option }) => option.zutaten)];
      const dateiname = basename(rezeptSeitenPfad({ quelle: "rezept", id: r.id, variante }, daten.rezepte));
      if (dateinamen.has(dateiname)) throw new Error(`Mehrere Rezeptvarianten erzeugen denselben Dateinamen: ${dateiname}`);
      dateinamen.add(dateiname);
      seiten.push({
        dateiname,
        html: seite({
          titel,
          portionen: r.portionen,
          dauerMin: r.dauerMin,
          zutaten,
          schritte: r.schritte,
        }),
      });
    }
  }
  return seiten;
}

function main(argv) {
  const eingabe = resolve(argv[0] ?? join(ROOT, "data/recipes.json"));
  const ausgabe = resolve(argv[1] ?? join(ROOT, "rezepte"));

  const daten = JSON.parse(readFileSync(eingabe, "utf8"));
  const fehler = validiere(daten);
  if (fehler.length) {
    console.error(fehler.join("\n"));
    process.exit(1);
  }

  const seiten = baueSeiten(daten);

  mkdirSync(ausgabe, { recursive: true });
  for (const datei of readdirSync(ausgabe)) {
    if (datei.endsWith(".html")) unlinkSync(join(ausgabe, datei));
  }
  for (const { dateiname, html } of seiten) {
    writeFileSync(join(ausgabe, dateiname), html, "utf8");
  }
  console.log(`${seiten.length} Seiten nach ${ausgabe} geschrieben`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
