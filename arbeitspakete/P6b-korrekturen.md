# P6b Korrekturen aus OFFENE-FRAGEN.md

Modell: Sonnet. Voraussetzung: P6 gemergt. Läuft vor P7 (P7 ändert ebenfalls `js/app.js`, deshalb nicht parallel).

## Ziel
Die 7 offenen Fragen aus `OFFENE-FRAGEN.md` sind entschieden. Drei davon brauchen Code-Änderungen (Fragen 2, 3, 7), die anderen werden nur in der SPEC festgehalten.

## Entscheidungen
| # | Entscheidung |
|---|---|
| 1 | So lassen. `uebernehmePlan` bekommt keine `recipes`. |
| 2 | Ersetzt ein Plan den aktuellen derselben Woche, werden die Spuren des verworfenen neuen Rezepts zurückgenommen (Details unten). |
| 3 | `rezeptSeitenPfad(eintrag, recipes)` bekommt einen optionalen zweiten Parameter und sortiert die Optionen nach der Gruppenreihenfolge des Rezepts. |
| 4 | So lassen: `rezeptSeitenPfad` liefert für Links `null`. |
| 5 | So lassen, wie in `OFFENE-FRAGEN.md` Punkt 5 beschrieben. |
| 6 | So lassen: Plan bleibt unverändert, Hinweis "Keine andere Möglichkeit gefunden". |
| 7 | Einheitlicher Testbefehl: `node --test tests/*.test.mjs` (läuft unter Node 20 bis 24). |

## Lies zuerst
`SPEC.md` 4.4, 5.1, 5.3, 9. `OFFENE-FRAGEN.md`. In `js/planner.js` die Funktion `uebernehmePlan`, `js/bring.js` komplett, in `js/app.js` die Aufrufe von `rezeptSeitenPfad`, in `scripts/build-pages.mjs` den Aufruf von `rezeptSeitenPfad`.

## Dateien
- `js/planner.js` (nur `uebernehmePlan`)
- `js/bring.js`
- `js/app.js` (nur die zwei Aufrufe von `rezeptSeitenPfad`)
- `scripts/build-pages.mjs` (nur der Aufruf von `rezeptSeitenPfad`)
- `tests/planner.test.mjs`, `tests/bring.test.mjs`
- `SPEC.md`, `README.md`, `OFFENE-FRAGEN.md`
- `arbeitspakete/P1-grundgeruest.md` bis `P8-abnahme.md` (nur den Testbefehl)
- `arbeitspakete/P6b-korrekturen.md` (diese Datei) und `arbeitspakete/README.md` (neue Zeile P6b in der Übersicht, schon geändert); beide uncommittet vorhanden, mit committen

## Aufgabe

### Frage 2: verworfenes neues Rezept zurücknehmen
1. Neues Feld im Plan: `probiertHinzugefuegt: boolean`. `uebernehmePlan` setzt es auf `true`, wenn es die Pool-ID des neuen Rezepts in diesem Aufruf neu in `probiert` aufgenommen hat, sonst `false`.
2. Hat der alte `aktuellerPlan` dasselbe `wocheAb` wie der neue Plan, und unterscheidet sich das neue Rezept des alten Plans (Slot `alterPlan.neuSlot`, verglichen über `quelle` und `id`) vom neuen Rezept des neuen Plans:
   - War es ein Link und steht dessen `geplantAm` noch auf `alterPlan.wocheAb`: `geplantAm = null`.
   - War es ein Pool-Rezept und `alterPlan.probiertHinzugefuegt === true`: die ID wieder aus `probiert` entfernen.
3. Erst danach den neuen Plan wie bisher übernehmen. Ist es dasselbe neue Rezept, bleibt alles, wie es ist.
4. Wichtig für `wuerfleSlot` auf dem Neu-Slot: Die App ruft danach `uebernehmePlan` mit demselben `wocheAb` auf. Genau dieser Fall soll den weggewürfelten Link wieder freigeben.
5. Pläne ohne das Feld (alte Daten) gelten als `probiertHinzugefuegt: false`.

### Frage 3: Reihenfolge der Varianten
1. Signatur: `rezeptSeitenPfad(eintrag, recipes = null)`.
2. Mit `recipes`: das Rezept mit `eintrag.id` suchen und die Options-IDs in der Reihenfolge von `variantenGruppen` aus `eintrag.variante` lesen. Fehlt eine Gruppe in `eintrag.variante`, diese Gruppe überspringen.
3. Ohne `recipes` oder wenn das Rezept nicht gefunden wird: bisheriges Verhalten (Schlüsselreihenfolge).
4. `js/app.js` und `scripts/build-pages.mjs` übergeben die Rezepte. Die erzeugten Dateinamen dürfen sich nicht ändern.

### Frage 7: Testbefehl
Überall `node --test tests/` und das nackte `node --test` durch `node --test tests/*.test.mjs` ersetzen: `README.md` (inkl. der Erklärzeile zu Node-Versionen), `SPEC.md` (Abschnitt 5 und 9), alle Paketdateien.

### Dokumentation
- `SPEC.md`: Feld `probiertHinzugefuegt` in 4.4 beim Plan ergänzen, die Regel aus Frage 2 bei "Plan übernehmen" ergänzen, neue Signatur von `rezeptSeitenPfad` in 5.3, Entscheidungen 4, 5 und 6 an passender Stelle in 3 bzw. 5.1 und 5.3 festhalten.
- `OFFENE-FRAGEN.md`: Abschnitt P4 durch "Alle Fragen in P6b entschieden und in SPEC.md übernommen." ersetzen. Die Datei bleibt als Sammelstelle bestehen.

## Pflicht-Testfälle (neu)
- Gleiche Woche, alter Plan hatte Link L als neues Rezept, neuer Plan hat anderes neues Rezept -> `L.geplantAm === null`
- Gleiche Woche, beide Pläne haben denselben Link L -> `L.geplantAm` bleibt gesetzt
- Gleiche Woche, alter Plan hatte Pool-Rezept P mit `probiertHinzugefuegt: true`, neuer Plan anderes -> P nicht mehr in `probiert`
- Gleiche Woche, alter Plan hatte P mit `probiertHinzugefuegt: false` (P stand schon vorher in `probiert`) -> P bleibt in `probiert`
- Andere Woche -> nichts wird zurückgenommen
- Alter Plan ohne Feld `probiertHinzugefuegt` -> kein Fehler, P bleibt
- `rezeptSeitenPfad` mit `recipes` und Variante mit umgekehrter Schlüsselreihenfolge (`{ sosse: "sahne", beilage: "brokkoli" }`) -> `rezepte/nudel-baukasten--brokkoli-sahne.html`
- `rezeptSeitenPfad` ohne `recipes` -> Verhalten wie bisher
- Bestehende Tests bleiben grün

## Abnahme
- `node --test tests/*.test.mjs` grün
- `node scripts/validate-recipes.mjs --voll` -> OK
- `node scripts/build-pages.mjs`, danach `git status rezepte/` ohne Änderungen (Dateinamen und Inhalte gleich)
- `grep -rn "node --test" *.md arbeitspakete/*.md` zeigt nur noch Zeilen mit `node --test tests/*.test.mjs` (Ausnahme: diese Paketdatei, die den alten Befehl beschreibt)
- Lokal mit `python3 -m http.server 8000`: Woche planen, Neu-Slot würfeln, im Tab Rezepte ist der weggewürfelte Link wieder offen; "Rezept" und "Zu Bring" beim Nudel-Baukasten öffnen eine existierende Seite
- Commit-Nachricht: `P6b: Korrekturen aus offenen Fragen`

## Nicht tun
Keine weiteren Änderungen an Planungsregeln, UI oder Daten. Kein Firebase-Code.
