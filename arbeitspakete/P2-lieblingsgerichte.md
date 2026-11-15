# P2 Lieblingsgerichte als Daten

Modell: Haiku. Voraussetzung: P1.

## Ziel
Die 7 Lieblingsgerichte aus SPEC 4.2 vollständig in `data/recipes.json` eintragen: Zutaten mit Mengen für 4 Portionen und kurze Schritte.

## Lies zuerst
SPEC 4.1 und 4.2. Ein Beispiel für gültige Daten steht in `tests/fixtures/recipes-gueltig.json`.

## Dateien
- `data/recipes.json` (nur Einträge mit `typ: "favorit"` hinzufügen; vorhandene Pool-Einträge nicht anfassen)

## Aufgabe
1. Für jedes Gericht aus der Tabelle in 4.2 einen Eintrag anlegen. `id`, `name`, `protein`, `haltbarTage`, Gruppen und Options-IDs exakt wie in der Tabelle.
2. Zutaten realistisch für 4 Portionen (2 Personen, 2 Abende), gesund gekocht: wenig Fett, keine Fertigprodukte, Kochsahne 15 % statt Sahne 30 %, wo Sahne vorkommt.
3. `frisch` und `vorrat` exakt nach den Definitionen in 4.1 setzen.
4. `nudel-baukasten`: Basis = Nudeln, Hähnchenbrust, Zwiebel, Knoblauch, Öl, Salz, Pfeffer. Gruppe `beilage` (Name "Beilage"): Optionen `brokkoli` "Brokkoli", `bohnen` "grüne Bohnen", `blumenkohl` "Blumenkohl", `pilze` "Champignons". Gruppe `sosse` (Name "Soße"): `sahne` "Sahnesoße" (Kochsahne, Brühe, Parmesan), `tomate` "Tomatensoße" (passierte Tomaten, Tomatenmark, Oregano).
5. `ofengemuese`: Gruppe `dazu` (Name "Dazu"): `steak` "Grillsteak" (4 Rumpsteaks à ca. 200 g), `ofenkaese` "Ofenkäse" (4 Ofenkäse à ca. 125 g), `beides` "Grillsteak und Ofenkäse" (2 Rumpsteaks und 2 Ofenkäse). Mengen gelten für 4 Portionen, also 2 Abende.
6. `dauerMin`, `airfryer`, `tags` sinnvoll setzen. `airfryer: true` nur, wenn der Airfryer zentral ist.

## Abnahme
- `node scripts/validate-recipes.mjs` -> Exit 0
- `node --test tests/*.test.mjs` grün
- Jedes der 7 Gerichte vorhanden, Tabellenwerte aus 4.2 unverändert (Validator mit `--voll` darf nur noch Pool-Fehler melden)

## Nicht tun
Keine Pool-Rezepte anlegen, keine Felder erfinden, die nicht in 4.1 stehen.
