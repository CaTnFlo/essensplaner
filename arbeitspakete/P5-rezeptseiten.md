# P5 Rezeptseiten-Generator

Modell: Haiku. Voraussetzung: P2 und P3 gemergt (für die echten Seiten; das Skript selbst lässt sich auch mit der Fixture bauen).

## Ziel
Ein Skript, das aus `data/recipes.json` statische Rezeptseiten mit schema.org-JSON-LD erzeugt. Bring liest diese Seiten beim Import.

## Lies zuerst
SPEC 4.1 und 5.4. Für den Dateinamen bei Varianten: `rezeptSeitenPfad` in `js/bring.js` (falls P4 schon da ist, exakt dasselbe Schema verwenden).

## Dateien
- `scripts/build-pages.mjs`
- `tests/build-pages.test.mjs`
- `rezepte/*.html` (generiert, mit committen)
- `css/rezept.css` (schlichtes, gut lesbares Layout, hell und dunkel)

## Aufgabe
1. `node scripts/build-pages.mjs [eingabe] [ausgabeordner]`, Standard `data/recipes.json` und `rezepte/`. Exportiert `baueSeiten(daten) -> { dateiname, html }[]` für Tests.
2. Seiten nach SPEC 5.4. Bei Varianten: alle Kombinationen (Kreuzprodukt der Gruppen). Titel = Anzeigename der Variante aus SPEC 4.1. Zutaten = Basis plus Optionen.
3. HTML-Sonderzeichen in Texten escapen. Im JSON-LD `JSON.stringify` nutzen und `</` als `<\/` schreiben.
4. Mengen ohne unnötige Nachkommastellen ("1,5 EL" mit Komma in der Anzeige, im JSON-LD ebenfalls deutsch formatiert).
5. Seite verlinkt `../css/rezept.css` und hat oben einen Link "Zurück zum Plan" auf `../index.html`.

## Abnahme
- `node scripts/build-pages.mjs` läuft ohne Fehler, zweiter Lauf ändert nichts (`git status` sauber nach erneutem Lauf)
- Anzahl Dateien = Anzahl Rezepte ohne Varianten + Summe der Kombinationen (mit den echten Daten: 5 + 8 + 3 + 30 = 46)
- Test: JSON-LD jeder Seite ist parsebares JSON mit `@type: "Recipe"`, `recipeIngredient` nicht leer, `recipeYield` "4 Portionen"
- `node --test tests/*.test.mjs` grün

## Nicht tun
Keine Änderungen an `data/recipes.json`, keine JavaScript-Logik in den Rezeptseiten.
