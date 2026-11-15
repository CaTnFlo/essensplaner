# P1 Grundgerüst und Validator

Modell: Sonnet. Voraussetzung: leeres Repo mit `SPEC.md` und `arbeitspakete/`.

## Ziel
Ordnerstruktur aus SPEC Abschnitt 5 anlegen und einen Validator bauen, der `data/recipes.json` gegen SPEC 4.1 bis 4.3 prüft. Alle späteren Pakete prüfen ihre Daten damit.

## Lies zuerst
SPEC Abschnitte 4.1, 4.2, 4.3, 5.

## Dateien
- `README.md` (kurz: Zweck, lokal starten mit `python3 -m http.server 8000`, Tests mit `node --test tests/*.test.mjs`, Verweis auf SPEC)
- `.gitignore` (`.DS_Store`, `node_modules/`)
- `data/recipes.json` mit `{"version": 1, "rezepte": []}`
- `scripts/validate-recipes.mjs`
- `tests/validate.test.mjs`
- `tests/fixtures/recipes-gueltig.json` (3 kleine gültige Rezepte: ein Favorit mit Varianten, ein Favorit ohne, ein Pool-Rezept)
- `tests/fixtures/recipes-ungueltig.json` (mindestens 6 Fehlerfälle)
- `firestore.rules` (Inhalt wörtlich aus SPEC 7)
- leere Platzhalter: `rezepte/.gitkeep`, `icons/.gitkeep`

## Aufgabe
1. `scripts/validate-recipes.mjs [pfad]`: Standardpfad `data/recipes.json`. Exportiert zusätzlich `validiere(daten) -> string[]` (Fehlermeldungen, leer = gültig), damit Tests es importieren können. Beim Aufruf als Skript: Fehler zeilenweise ausgeben, Exit-Code 1 bei Fehlern, sonst "OK: <n> Rezepte (<f> Favoriten, <p> Pool)" und Exit 0.
2. Prüfen: alle Feldregeln aus 4.1 (Typen, Enums, Bereiche, Muster, Eindeutigkeit der IDs, Options-IDs eindeutig je Gruppe, `einheit` null genau dann wenn `menge` null).
3. Mit Flag `--voll` zusätzlich prüfen:
   - die 7 Favoriten aus 4.2 existieren mit genau den dort festgelegten `id`, `protein`, `haltbarTage` und Variantengruppen samt Options-IDs
   - die Pool-Quoten aus 4.3 (genau 30, Protein-Mix, Airfryer, Haltbarkeit, Dauer, keine Varianten)
   Ohne `--voll` werden diese Vollständigkeitsregeln übersprungen (damit P2 und P3 einzeln prüfbar sind).
4. Fehlermeldungen nennen Rezept-ID und Feld, z.B. `lasagne.zutaten[2].einheit: "gramm" ist keine erlaubte Einheit`.

## Abnahme
- `node scripts/validate-recipes.mjs tests/fixtures/recipes-gueltig.json` -> Exit 0
- `node scripts/validate-recipes.mjs tests/fixtures/recipes-ungueltig.json` -> Exit 1, jeder Fehlerfall erscheint
- `node scripts/validate-recipes.mjs` -> Exit 0 (leere Liste ist gültig)
- `node --test tests/*.test.mjs` grün, mindestens 8 Testfälle

## Nicht tun
Keine UI, keine Planer-Logik, keine echten Rezepte.
