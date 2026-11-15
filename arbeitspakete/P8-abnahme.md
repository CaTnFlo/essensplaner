# P8 Abnahme

Modell: Opus. Voraussetzung: P1 bis P7 gemergt, App läuft auf GitHub Pages.

## Ziel
Unabhängig prüfen, ob das Ergebnis der SPEC entspricht. Nicht den Berichten der Pakete glauben, sondern selbst nachsehen. Kleine Fehler direkt beheben und in einem eigenen Commit `P8: Korrekturen` sammeln; größere als Liste zurückgeben.

## Prüfschritte
1. Definition of Done aus SPEC 9 Punkt für Punkt ausführen.
2. Code-Review gegen SPEC 3 und 5: Regeln R1 bis R5, Herkunftsreihenfolge, Lockerungsstufen, `uebernehmePlan`, Einkaufsaufteilung. Testen die Tests wirklich, was sie behaupten (keine leeren oder immer wahren Asserts)?
3. Daten: `node scripts/validate-recipes.mjs --voll`. Stichprobe von 8 Pool-Rezepten und allen 7 Favoriten auf Plausibilität: Mengen für 4 Portionen, gesund, keine Fertigprodukte, `frisch` und `vorrat` richtig.
4. Simulation: 52 Wochen hintereinander planen (Skript, nicht committen). Zählen, wie oft jeder Favorit drankommt, wie oft Regeln gelockert wurden, ob Pool-Rezepte sich vor Erschöpfung wiederholen.
5. Bring: Eine Rezeptseite auf GitHub Pages mit dem Integration-Check von Bring prüfen (https://getbring.com/en/integration-check) und den Link aus `bringLink` einmal auf dem Handy öffnen. Ergebnis dokumentieren: Funktioniert er, wie gut werden Zutaten erkannt? Falls nicht: Alternative vorschlagen (z.B. nur "Liste kopieren").
6. Sicherheit: keine Haushalts-ID im Repo und in der Git-Historie, `firestore.rules` entspricht SPEC 7, kein `Math.random` in der Logik.
7. UI auf 375 px in hell und dunkel nach der Abnahmeliste aus P6.

## Bericht
- Gesamturteil: abnahmefähig ja/nein
- Je Prüfschritt: Ergebnis, Belege (Befehl und Ausgabe oder Datei:Zeile)
- Behobene Fehler
- Offene Fehler, nach Schwere sortiert
- Ergebnis der Simulation in einer kleinen Tabelle
