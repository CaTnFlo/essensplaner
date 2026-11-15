# P4 Planer-, Einkaufs- und Bring-Logik

Modell: Sonnet. Voraussetzung: P1. Arbeitet mit Test-Fixtures, nicht mit den echten Daten.

## Ziel
Die reinen Logik-Module aus SPEC 5.1 bis 5.3 mit vollständigen Tests. Kein DOM, kein `fetch`, kein `localStorage`.

## Lies zuerst
SPEC Abschnitte 2, 3, 4.4, 5.1, 5.2, 5.3.

## Dateien
- `js/planner.js`
- `js/shopping.js`
- `js/bring.js`
- `tests/planner.test.mjs`, `tests/shopping.test.mjs`, `tests/bring.test.mjs`
- `tests/fixtures/planer-rezepte.json` (eigene Fixture: mindestens 7 Favoriten mit denselben Protein- und Haltbarkeitswerten wie SPEC 4.2, davon einer mit 2 Variantengruppen, plus 8 Pool-Rezepte)

## Aufgabe
1. Alle Exporte aus 5.1 bis 5.3 mit genau diesen Namen und Signaturen.
2. `planeWoche`: Vorgehen, das die Regeln garantiert:
   - `neuSlot` zufällig A oder C
   - neues Rezept nach der Herkunftsreihenfolge aus SPEC 3
   - die anderen Slots aus den Favoriten, zufällig, mit R1, R3, R4, R5
   - bis zu 200 Zufallsversuche; wenn keiner gültig ist, Lockerungsstufen aus SPEC 3 der Reihe nach, mit Hinweistext
3. `naechsterSonntag` rechnet in lokaler Zeit, kein UTC-Versatz.
4. Kein `Math.random()` in diesen Modulen, nur das übergebene `rng`.

## Pflicht-Testfälle
- Gleicher Seed, gleiche Eingabe -> identischer Plan (tiefer Vergleich, `erstellt` ausgenommen oder per Parameter fixiert)
- Über 500 Seeds: Slot B hat immer `haltbarTage` >= 3
- Über 500 Seeds: genau ein neues Rezept, immer in `neuSlot`, `neuSlot` ist A oder C, beide kommen vor
- Über 500 Seeds mit gesetzter Vorwoche: keine Basis-ID der Vorwoche im Plan
- Über 500 Seeds: R4 erfüllt
- Offener Link vorhanden -> neues Rezept ist immer der Link; Link mit `geplantAm` wird nicht gewählt
- Pool: nicht probierte Rezepte werden vor probierten gewählt; Favoriten nie als neues Rezept
- Pool-Rezept in `state.favoriten` gilt als Favorit
- Nur 2 Favoriten in der Fixture -> Plan wird trotzdem erstellt, Hinweis enthält "gelockert", kein Fehler
- `wuerfleSlot` ändert nur den gewünschten Slot und hält die Regeln
- `pruefePlan` meldet je einen Verstoß gegen R1, R3, R4, R5 in passend gebauten Plänen; gültiger Plan -> leeres Array
- `naechsterSonntag`: 2026-11-18 (Mi) -> "2026-11-22", 2026-11-21 (Sa) -> "2026-11-22", 2026-11-22 (So) -> "2026-11-22"
- `uebernehmePlan`: gleiche Woche ersetzt ohne Verlauf; neue Woche schiebt in den Verlauf; Verlauf max. 8; Link bekommt `geplantAm`; Pool-ID landet einmal in `probiert`; Eingabe-State bleibt unverändert
- `einkaufsliste`: Aufteilung Samstag/Donnerstag nach SPEC 5.2, Summieren gleicher Zutaten, getrennt bei anderer Einheit, Variantenzutaten enthalten, Sortierung, Links in `links`
- `bringLink` kodiert die URL korrekt; `rezeptSeitenPfad` für Rezept ohne und mit Varianten

## Abnahme
- `node --test tests/` grün
- `grep -n "Math.random" js/planner.js js/shopping.js js/bring.js` findet nichts
- `grep -nE "document|window|localStorage|fetch\(" js/planner.js js/shopping.js js/bring.js` findet nichts

## Nicht tun
Keine UI, keine Änderung an `data/recipes.json` oder am Validator.
