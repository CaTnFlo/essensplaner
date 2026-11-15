# P6 Oberfläche im lokalen Modus

Modell: Sonnet. Voraussetzung: P4 gemergt. Echte Daten aus P2 sind hilfreich, sonst mit der Fixture aus P4 testen.

## Ziel
Die komplette App aus SPEC 6, gespeichert im Browser über `store-local.js`. Firebase kommt erst in P7; die App muss aber schon über die Speicher-Schnittstelle aus SPEC 5.5 arbeiten, damit P7 nur das Modul tauscht.

## Lies zuerst
SPEC 4.4, 5, 6. Die Exporte von `js/planner.js`, `js/shopping.js`, `js/bring.js`.

## Dateien
- `index.html`, `css/app.css`, `js/app.js`
- `js/store-local.js`
- `js/firebase-config.js` (Platzhalter: `export const firebaseConfig = { apiKey: "" };`)
- `manifest.webmanifest`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png` (schlichtes Icon, z.B. Teller oder Topf; PNG mit einem kleinen Node-Skript oder `sips` aus dem SVG erzeugen, das Skript nicht committen)

## Aufgabe
1. `app.js` lädt `data/recipes.json` per `fetch`, erstellt den Store, abonniert Änderungen und rendert neu, wenn sich der State ändert.
2. Jede Aktion (planen, würfeln, ändern, Favorit, Link hinzufügen/löschen) baut einen neuen State mit den Funktionen aus `planner.js` und ruft `speichern` auf. Keine Planungslogik in `app.js` duplizieren.
3. Zufall: `erzeugeRng(Date.now())`.
4. Startbildschirm aus SPEC 7 schon jetzt bauen (Eingabefeld Haushalts-ID, Button "Lokal ausprobieren"). Eine eingegebene ID nur speichern; ohne Firebase-Konfiguration weiter im lokalen Modus mit Hinweis.
5. Barrierearm: echte `<button>`-Elemente, Labels an Eingabefeldern, ausreichende Kontraste, Touch-Ziele mindestens 44 px.

## Abnahme
Lokal mit `python3 -m http.server 8000` im Repo-Ordner, Browser auf 375 px Breite:
- "Woche planen" erzeugt 3 Karten A, B, C mit richtigen Koch- und Esstagen
- "Neu würfeln" ändert nur diese Karte; "Ändern" zeigt nur Kandidaten, die R1 erfüllen
- Manuelle Wahl, die eine Regel bricht, zeigt den Hinweis aus `pruefePlan`
- "Hat geschmeckt" macht das neue Rezept zum Favoriten (sichtbar im Tab Rezepte)
- Einkauf zeigt Samstag und Donnerstag getrennt, "Liste kopieren" kopiert Text
- "Zu Bring" öffnet einen Link der Form aus SPEC 5.3
- Link hinzufügen, danach "Woche neu planen": der Link ist das neue Rezept
- Neu laden: Zustand bleibt erhalten
- Dunkelmodus lesbar
- Keine Fehler in der Browser-Konsole
- `node --test tests/*.test.mjs` weiterhin grün
Im Bericht Screenshots oder eine kurze Beschreibung je Punkt.

## Nicht tun
Kein Firebase-Code, keine Änderung an `planner.js`, `shopping.js`, `bring.js` (Fehler darin im Bericht melden statt selbst umbauen).
