# P3 Rezept-Pool (30 Rezepte)

Modell: Haiku (wenn die Qualität nicht passt: Sonnet). Voraussetzung: P1.

## Ziel
30 neue Rezepte als `typ: "pool"` in `data/recipes.json` eintragen. Aus ihnen wählt der Planer jede Woche ein neues Rezept, wenn keine eigenen Links offen sind.

## Lies zuerst
SPEC 4.1 und 4.3. Die Favoriten aus 4.2, damit keine Dubletten entstehen.

## Wer isst das
Zwei Erwachsene, essen gern Fleisch, wollen trotzdem gesund und frisch kochen. Mögen Curry, Aufläufe, Nudelgerichte, Ofengemüse, Lachs. Haben einen Airfryer. Kochen für 2 Abende auf einmal.

## Dateien
- `data/recipes.json` (nur Einträge mit `typ: "pool"` hinzufügen; Favoriten nicht anfassen)

## Aufgabe
1. Zuerst eine Liste mit 30 Gerichtnamen samt `protein`, `haltbarTage`, `airfryer`, `dauerMin` aufstellen und gegen alle Quoten aus 4.3 zählen. Erst wenn die Liste passt, die vollständigen Einträge schreiben.
2. Abwechslung: verschiedene Küchen (deutsch, mediterran, asiatisch, orientalisch, mexikanisch), verschiedene Beilagen (Reis, Kartoffeln, Bulgur, Couscous, Nudeln, Brot), keine zwei fast gleichen Gerichte.
3. Kein Gericht, das einem Favoriten zu ähnlich ist (also kein weiteres Hähnchen-Curry, keine weitere Lasagne, kein weiteres Chili).
4. Mengen für 4 Portionen, `frisch`/`vorrat` nach 4.1.

## Abnahme
- `node scripts/validate-recipes.mjs` -> Exit 0
- `node scripts/validate-recipes.mjs --voll` meldet keine Pool-Fehler (Favoriten-Fehler sind ok, falls P2 noch nicht gemergt ist)
- Im Bericht eine Tabelle: Name, Protein, haltbarTage, airfryer, dauerMin, plus die gezählten Quoten

## Nicht tun
Keine `variantenGruppen`, keine Fertigprodukte, nichts Frittiertes.
