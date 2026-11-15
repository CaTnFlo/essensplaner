# Essensplaner

Wochenplaner für zwei Personen: mit einem Klick drei Gerichte pro Woche plus Einkaufsliste. Statische Seite (GitHub Pages), geteilter Zustand über Firestore, keine KI zur Laufzeit.

Verbindliche Spezifikation: [SPEC.md](SPEC.md). Arbeitspakete: [arbeitspakete/](arbeitspakete/).

## Lokal starten

```bash
python3 -m http.server 8000
```

## Tests

```bash
node --test tests/*.test.mjs
```

Läuft unter Node 20 bis 24. `node --test tests/` (mit Ordner) bricht ab Node 24 ab, deshalb der Dateiname mit Muster.

## Rezepte prüfen

```bash
node scripts/validate-recipes.mjs          # data/recipes.json, ohne Vollständigkeitsregeln
node scripts/validate-recipes.mjs --voll   # zusätzlich 7 Favoriten und 30 Pool-Rezepte
```

## Bring weekly import

`worker/index.mjs` serves public Recipe JSON-LD for at most three catalog recipes at `/einkauf?gerichte=...`. It uses the same shopping aggregation as the app, excludes pantry ingredients and combines quantities across both shopping days. Only recipe IDs and selected variants are transmitted; household IDs and saved household state are not used or stored. External recipe links remain separate because their ingredients are unavailable.

Deploy the Worker with `wrangler deploy` after catalog or aggregation changes, before deploying the frontend through GitHub Pages. The frontend endpoint is in `js/bring.js`. Bring parses the page using its [official web integration](https://sites.google.com/getbring.com/bring-import-dev-guide/web-to-app-integration).

For frontend releases, bump the `v=` asset version in `index.html`, the token imports in both CSS files and changed JavaScript module imports. GitHub Pages serves assets with a ten-minute cache lifetime.
