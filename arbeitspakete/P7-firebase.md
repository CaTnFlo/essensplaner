# P7 Firebase-Anbindung

Modell: Sonnet. Voraussetzung: P6 gemergt, M1 erledigt, `firebaseConfig` liegt vor.

## Ziel
Geteilter Zustand für beide Handys über Firestore, nach SPEC 5.5 und 7.

## Lies zuerst
SPEC 5.5 und 7. `js/store-local.js` als Vorbild für die Schnittstelle. Den Teil von `js/app.js`, der den Store erstellt.

## Dateien
- `js/store-firebase.js`
- `js/firebase-config.js` (echte öffentliche Web-Konfiguration eintragen)
- `js/app.js` (nur Store-Auswahl, Haushalts-ID aus URL-Fragment, Einladungslink, Verbindungsstatus im Bereich "Haushalt")

## Aufgabe
1. Firebase-SDK (App, Auth, Firestore) als ES-Module von gstatic mit einer festen, aktuellen Versionsnummer laden.
2. `erstelleStore({ haushaltId })`: `signInAnonymously`, dann Dokument `haushalte/{haushaltId}`. `laden` liefert leeren State, wenn das Dokument fehlt. `speichern` schreibt den kompletten State plus `aktualisiert: serverTimestamp()`. `abonnieren` über `onSnapshot`.
3. Fehler (keine Berechtigung, offline) als verständlichen deutschen Text in der App anzeigen, z.B. "Keine Verbindung zum Haushalt. Stimmt die Haushalts-ID?". Nie stillschweigend in den lokalen Modus wechseln.
4. Haushalts-ID-Handling genau nach SPEC 7 (Fragment lesen, speichern, Fragment entfernen, Eingabefeld, Einladungslink).
5. Optional, nur wenn einfach: Button "Lokale Daten in Haushalt übernehmen", falls im lokalen Modus schon ein Plan existiert.

## Abnahme
- Ohne Haushalts-ID: Startbildschirm, lokaler Modus funktioniert wie in P6
- Mit falscher ID: verständliche Fehlermeldung, kein Absturz
- Mit richtiger ID (du testest das, nicht der Agent) in zwei Browsern: Plan in Browser 1 erstellen, erscheint in Browser 2 nach wenigen Sekunden; "Neu würfeln" in Browser 2 erscheint in Browser 1
- `grep -rn "<haushalts-id>"` über das Repo findet die echte ID nicht (prüfst du selbst)
- `node --test tests/` grün
- Nach dem Push läuft die App unter der GitHub-Pages-URL

## Nicht tun
Keine Änderung an Planer-Logik oder UI-Layout. Haushalts-ID nicht erfragen, nicht loggen, nicht committen.
