# Essensplaner: Spezifikation

Stand: 2026-11-15. Diese Datei ist die einzige verbindliche Quelle. Wenn ein Arbeitspaket und diese Datei sich widersprechen, gilt diese Datei. Wenn etwas hier nicht geregelt ist, nicht raten: im Abschlussbericht als offene Frage nennen.

## 1. Zweck

Ein Paar (zwei Personen, kocht fast jeden Abend zu Hause) will samstags mit einem Klick einen Wochenplan bekommen: welches Gericht an welchem Tag gekocht und gegessen wird, plus Einkaufsliste. Die Rezepte selbst sind bekannt, das Problem ist die tägliche Entscheidung.

Rahmen:
- kostenlos, keine KI zur Laufzeit, kein eigener Server
- statische Webseite auf GitHub Pages (öffentliches Repo)
- geteilter Zustand für beide Handys über Firebase (Firestore)
- Einkauf in der App Bring!; Bring-Anbindung ist nice-to-have

## 2. Standardwoche

Samstag: Großeinkauf am Vormittag, abends wird nicht gekocht. Einzige Woche, die der Planer kennt:

| Slot | Kochtag | gegessen | Mindest-Haltbarkeit | darf neues Rezept sein |
|---|---|---|---|---|
| A | Sonntag | So + Mo | 1 Tag | ja |
| B | Sonntag (vorkochen) | Di + Mi | 3 Tage | nein |
| C | Donnerstag | Do + Fr | 1 Tag | ja |

- Jedes Gericht wird für 4 Portionen gekocht (2 Personen, 2 Abende).
- Donnerstag ist zusätzlich ein kleiner Nachkauf-Tag für frische Zutaten von Slot C.
- `haltbarTage` eines Rezepts = wie viele Tage nach dem Kochen es im Kühlschrank noch gut ist. Slot B wird am Sonntag gekocht und am Mittwoch zuletzt gegessen, braucht also 3.

## 3. Planungsregeln

Pro Woche werden genau 3 Gerichte gewählt (A, B, C).

- R1 Haltbarkeit: `haltbarTage` des Gerichts >= Mindest-Haltbarkeit des Slots.
- R2 Genau ein neues Rezept pro Woche, immer in Slot A oder C (zufällig welcher). Die anderen beiden Slots sind Favoriten.
- R3 Keine Wiederholung aus der Vorwoche: kein Gericht (verglichen über die Basis-ID, Varianten zählen als dasselbe Gericht), das im Plan der Vorwoche stand.
- R4 Mindestens eines der 3 Gerichte hat `protein` = `fisch` oder `gefluegel`.
- R5 Die 3 Gerichte sind verschieden (Basis-ID).

Herkunft des neuen Rezepts, in dieser Reihenfolge:
1. eigene Links mit Status offen (noch nie geplant), zufällig
2. Pool-Rezepte, die weder Favorit noch schon probiert sind, zufällig
3. irgendein Pool-Rezept, das kein Favorit ist

Favoriten = alle Rezepte mit `typ: "favorit"` in `data/recipes.json` plus alle IDs in `state.favoriten` (Pool-Rezepte oder Links, die per Button zum Favoriten wurden).

Links haben keine Zutaten- und Haltbarkeitsdaten. Sie gelten als `haltbarTage: 1` und `protein: "unbekannt"` (zählt nicht für R4).

Wenn keine gültige Kombination existiert: zuerst R3 lockern, dann R4, dann R2. Jede Lockerung erzeugt einen Hinweistext, z.B. "Regel 'keine Wiederholung aus Vorwoche' gelockert: zu wenige Favoriten". Der Planer darf nie abstürzen und liefert immer einen Plan.

Festgelegt (P8): Gelockert wird nur so weit wie nötig. Reihenfolge der Stufen: keine Lockerung, R3, R4, R3+R4, R2, R2+R3, R2+R4, R2+R3+R4. Auch bei gelockerter R3 werden pro Slot Gerichte ohne Vorwochen-Bezug bevorzugt. Hinweistexte erscheinen nur für Regeln, die im Ergebnis tatsächlich verletzt sind. `wuerfleSlot` berechnet `neuSlot` neu, wenn es bis R2 lockern musste. `uebernehmePlan` nimmt nichts zurück, solange das alte neue Rezept noch in einem Slot des neuen Plans steht.

Die Lockerung bei R2 (letzte Stufe) wählt die drei Slots frei aus Favoriten und neuen Rezepten, Favoriten bevorzugt. `neuSlot` ist dann nur gesetzt, wenn genau ein neues Rezept in A oder C landet.

Varianten: Hat ein Rezept `variantenGruppen`, wird pro Gruppe zufällig eine Option gewählt.

Zufall: Alle Zufallsentscheidungen laufen über eine übergebene Funktion `rng()` (liefert [0,1)). Gleicher Seed ergibt gleichen Plan.

## 4. Datenmodell

### 4.1 `data/recipes.json`

```json
{
  "version": 1,
  "rezepte": [
    {
      "id": "lasagne",
      "name": "Lasagne Bolognese",
      "typ": "favorit",
      "protein": "hack",
      "haltbarTage": 3,
      "portionen": 4,
      "dauerMin": 75,
      "airfryer": false,
      "tags": ["ofen"],
      "zutaten": [
        { "name": "Rinderhack", "menge": 500, "einheit": "g", "kategorie": "fleisch-fisch", "frisch": true, "vorrat": false }
      ],
      "schritte": ["Zwiebel und Möhre fein würfeln.", "..."],
      "variantenGruppen": []
    }
  ]
}
```

Feldregeln (der Validator prüft alle):
- `id`: kebab-case, `^[a-z0-9]+(-[a-z0-9]+)*$`, eindeutig über alle Rezepte
- `name`: Deutsch, nicht leer
- `typ`: `favorit` | `pool`
- `protein`: `fisch` | `gefluegel` | `hack` | `rind` | `schwein` | `vegetarisch`
- `haltbarTage`: Ganzzahl 1 bis 4
- `portionen`: immer 4
- `dauerMin`: Ganzzahl 10 bis 180 (aktive + passive Zeit)
- `airfryer`: boolean (true, wenn der Airfryer ein zentraler Teil der Zubereitung ist)
- `tags`: Array aus `ofen`, `pfanne`, `topf`, `airfryer`, `schnell` (<= 30 min), `scharf`
  - Der Validator lehnt `schnell` bei `dauerMin > 30` ab. Rezepte bis 30 Minuten müssen den Tag nicht tragen.
- `zutaten`: mindestens 3 Einträge, Mengen für 4 Portionen
  - `name`: Singular oder übliche Handelsbezeichnung, deutsch ("Paprika rot", "Kokosmilch")
  - `menge`: Zahl > 0 oder `null` (nur bei "nach Geschmack")
  - `einheit`: `g` | `ml` | `Stück` | `EL` | `TL` | `Prise` | `Bund` | `Dose` | `Packung` | `Zehe` | `null` (nur wenn `menge` null)
  - `kategorie`: `obst-gemuese` | `fleisch-fisch` | `kuehlregal` | `backwaren` | `vorrat` | `gewuerze` | `tiefkuehl`
  - `frisch`: true, wenn die Zutat ab Samstag gekauft keine 5 Tage hält (Fisch, Fleisch, Hack, frische Kräuter, Blattspinat, Pilze, Salat, Beeren). Sonst false.
  - `vorrat`: true für Dinge, die man meist zu Hause hat (Salz, Pfeffer, Öl, Gewürze, Mehl, Zucker, Brühe). Sonst false.
- `schritte`: 3 bis 12 kurze Sätze
- `variantenGruppen` (optional, leer erlaubt): `[{ "id": "beilage", "name": "Beilage", "optionen": [{ "id": "brokkoli", "name": "Brokkoli", "zutaten": [ ... ] }] }]`. IDs kebab-case. Optionen haben mindestens eine Zutat.

Anzeigename einer Variante: `<name> (<Optionsname 1>, <Optionsname 2>)`, z.B. "Nudeln mit Hähnchen (Brokkoli, Sahnesoße)".

### 4.2 Lieblingsgerichte (typ `favorit`)

Diese Werte sind festgelegt. Zutaten und Schritte werden in P2 ergänzt.

| id | name | protein | haltbarTage | Hinweise |
|---|---|---|---|---|
| `lachs-spinat-nudeln` | Lachs-Spinat-Nudeln | fisch | 1 | leichte Soße mit Kochsahne 15 % oder Frischkäse, Zitrone, Knoblauch |
| `lasagne` | Lasagne Bolognese | hack | 3 | klassisch, Ofen |
| `curry` | Hähnchen-Curry mit Reis | gefluegel | 3 | Kokosmilch, Paprika, Zucchini, Currypaste, Reis |
| `hack-brokkoli-auflauf` | Hack-Brokkoli-Auflauf | hack | 3 | mit Nudeln, Käse überbacken |
| `chili-con-carne` | Chili con carne | hack | 3 | Kidneybohnen, Mais, Paprika, Reis dazu |
| `nudel-baukasten` | Nudeln mit Hähnchen | gefluegel | 1 | Gruppe `beilage`: brokkoli, bohnen, blumenkohl, pilze. Gruppe `sosse`: sahne (Sahnesoße), tomate (Tomatensoße) |
| `ofengemuese` | Ofengemüse mit Kartoffeln und Süßkartoffeln | vegetarisch | 1 | Basis: Kartoffeln, Süßkartoffeln, Pilze, Paprika, Zucchini. Gruppe `dazu`: steak (Grillsteak), ofenkaese (Ofenkäse), beides (Grillsteak und Ofenkäse). Tag `ofen` |

### 4.3 Rezept-Pool (typ `pool`)

Genau 30 Rezepte, keine Dubletten zu den Favoriten. Vorgaben:
- gesund und frisch: in jedem Rezept frisches Gemüse; nichts frittiert; keine Fix-Tüten, Fertigsoßen oder Fertigteige; Sahne oder viel Käse in höchstens 5 Rezepten
- Zutaten aus einem normalen deutschen Supermarkt
- Protein-Mix: mindestens 10 `gefluegel`, mindestens 5 `fisch`, höchstens 6 `hack`, mindestens 3 `rind` oder `schwein`, höchstens 4 `vegetarisch`
- mindestens 8 mit `airfryer: true`
- mindestens 10 mit `haltbarTage` >= 3
- mindestens 20 mit `dauerMin` <= 60
- keine `variantenGruppen`

### 4.4 Zustand (`State`)

Ein Objekt, für beide Personen geteilt:

```js
{
  version: 1,
  aktuellerPlan: Plan | null,
  verlauf: Plan[],          // ältere Pläne, neuester zuletzt, max. 8
  favoriten: string[],      // zusätzliche Favoriten: Pool-IDs oder Link-IDs
  probiert: string[],       // Pool-IDs, die schon als neues Rezept geplant wurden
  links: Link[]
}
// Link
{ id: "link-<zeitstempel>", titel: "Gnocchi-Pfanne", url: "https://...", hinzugefuegt: "2026-11-15", geplantAm: null | "2026-11-22" }
// Plan
{ wocheAb: "2026-11-22", erstellt: "<ISO-Zeitpunkt>", neuSlot: "A" | "B" | "C" | null, probiertHinzugefuegt: true | false,
  slots: { A: SlotEintrag, B: SlotEintrag, C: SlotEintrag } }
// SlotEintrag
{ quelle: "rezept", id: "nudel-baukasten", variante: { "beilage": "brokkoli", "sosse": "sahne" } }
{ quelle: "rezept", id: "lasagne", variante: null }
{ quelle: "link", id: "link-1731661234567", variante: null }
```

`wocheAb` ist immer ein Sonntag: der nächste Sonntag ab heute, heute eingeschlossen.

Plan übernehmen (`uebernehmePlan`):
- Hat der alte `aktuellerPlan` dasselbe `wocheAb`, wird er ersetzt (nicht in den Verlauf).
- Sonst wandert der alte Plan ans Ende von `verlauf`; `verlauf` wird auf die letzten 8 gekürzt.
- Ist das neue Rezept ein Link, bekommt der Link `geplantAm = wocheAb`. Ist es ein Pool-Rezept, kommt seine ID in `probiert` (ohne Dubletten).
- Die Vorwoche für R3 ist der jüngste Plan mit `wocheAb` kleiner als das neue `wocheAb` (aus `aktuellerPlan` oder `verlauf`).
- `probiertHinzugefuegt` ist `true`, wenn die Pool-ID des neuen Rezepts in diesem Aufruf neu in `probiert` aufgenommen wurde, sonst `false`. Fehlt das Feld (alte Pläne), gilt `false`. Bleibt dasselbe neue Rezept, bleibt der Wert erhalten.
- Ersetzt der neue Plan den aktuellen Plan derselben Woche und ist das neue Rezept ein anderes, wird das alte zurückgenommen, bevor der neue Plan übernommen wird: War es ein Link mit `geplantAm` = `wocheAb`, wird `geplantAm` auf `null` gesetzt. War es ein Pool-Rezept mit `probiertHinzugefuegt: true`, wird seine ID aus `probiert` entfernt. Bei anderer Woche passiert das nicht.

## 5. Module und Schnittstellen

Reines JavaScript als ES-Module, kein Build-Schritt, keine npm-Abhängigkeiten. Tests mit `node --test` (Node >= 20).

```
index.html
manifest.webmanifest
icons/icon-192.png, icons/icon-512.png, icons/icon.svg
css/app.css
js/app.js              UI, Navigation, Events
js/planner.js          reine Planungslogik (kein DOM, kein fetch)
js/shopping.js         reine Einkaufslisten-Logik
js/bring.js            Bring-Link bauen
js/store-local.js      Speicher im Browser (Entwicklung, Fallback)
js/store-firebase.js   Speicher in Firestore
js/firebase-config.js  öffentliche Firebase-Web-Konfiguration
data/recipes.json
rezepte/*.html         generierte Rezeptseiten (nicht von Hand bearbeiten)
scripts/validate-recipes.mjs
scripts/build-pages.mjs
tests/*.test.mjs
firestore.rules        Vorlage mit Platzhalter
SPEC.md, arbeitspakete/, README.md
```

### 5.1 `js/planner.js`

```js
export const SLOTS = {
  A: { kochtag: "So", isstTage: ["So", "Mo"], minHaltbar: 1, neuErlaubt: true },
  B: { kochtag: "So", isstTage: ["Di", "Mi"], minHaltbar: 3, neuErlaubt: false },
  C: { kochtag: "Do", isstTage: ["Do", "Fr"], minHaltbar: 1, neuErlaubt: true },
};
export function erzeugeRng(seed)                       // mulberry32, liefert () => [0,1)
export function naechsterSonntag(heute)                // Date -> "YYYY-MM-DD" (lokale Zeit)
export function kandidaten(recipes, state)             // -> Kandidat[]
// Kandidat: { quelle, id, name, haltbarTage, protein, istFavorit, istNeuKandidat, prioritaet }
export function planeWoche({ recipes, state, heute, rng })          // -> { plan, hinweise: string[] }
export function wuerfleSlot({ recipes, state, plan, slot, rng })    // -> { plan, hinweise }
export function planeMitWunsch({ recipes, state, heute, rng, wunsch, erhalten }) // -> { plan | null, hinweise }
export function tauscheSlots(plan, von, nach)                       // -> cloned plan; rejects unknown slots
export function filterKandidaten({ recipes, state, slot, suche, filter, aktuell })
export function setzeSlot(plan, slot, eintrag)                      // -> neuer Plan (unverändertes Original)
export function pruefePlan({ plan, recipes, state })                // -> string[] Regelverstöße, leer = ok
export function uebernehmePlan(state, plan)                         // -> neuer State
export function anzeigeName(eintrag, recipes, state)                // -> string
```

`recipes` ist das Array `rezepte` aus `recipes.json`. Alle Funktionen sind rein: keine Mutation der Eingaben.

`wuerfleSlot`: Die anderen beiden Slots bleiben. Ist der Slot `plan.neuSlot`, kommt wieder ein neues Rezept (Herkunftsreihenfolge aus Abschnitt 3), sonst ein Favorit. R1, R3, R4, R5 gelten unter Berücksichtigung der anderen Slots, Lockerung wie in Abschnitt 3. Das bisherige Gericht in diesem Slot wird nur gewählt, wenn es keine andere Möglichkeit gibt.

`pruefePlan` meldet Verstöße gegen R1, R3, R4, R5 als kurze deutsche Sätze. Wird nach manuellen Änderungen in der UI angezeigt, blockiert aber nichts.

Festgelegt (P6b):
- `uebernehmePlan` bekommt keine `recipes`. Das neue Rezept erkennt die Funktion über `neuSlot` und `quelle`. Wird per "Ändern" ein Favorit in den Neu-Slot gesetzt, landet seine ID trotzdem in `probiert`. Das ist harmlos.
- `wuerfleSlot` ohne Alternative: Der Plan bleibt unverändert, Hinweis "Keine andere Möglichkeit gefunden". Der Button wird nicht deaktiviert.

### 5.2 `js/shopping.js`

```js
export function einkaufsliste({ plan, recipes, state })
// -> { samstag: Posten[], donnerstag: Posten[], links: { titel, url }[] }
// Posten: { name, menge, einheit, kategorie, vorrat, rezepte: string[] }
```
- Samstag: alle Zutaten von A und B, dazu alle Zutaten von C mit `frisch: false`.
- Donnerstag: Zutaten von C mit `frisch: true`.
- Varianten: Basis-Zutaten plus Zutaten der gewählten Optionen.
- Zusammenfassen: gleicher Name (getrimmt, ohne Groß/Klein) und gleiche Einheit werden addiert. Gleicher Name mit anderer Einheit bleibt getrennt. `menge: null` bleibt null.
- Sortierung: nach Kategorie in der Reihenfolge `obst-gemuese`, `fleisch-fisch`, `kuehlregal`, `backwaren`, `tiefkuehl`, `vorrat`, `gewuerze`, innerhalb alphabetisch. Posten mit `vorrat: true` ans Ende.
- Links-Rezepte erscheinen nicht als Zutaten, sondern in `links`.

### 5.3 `js/bring.js`

```js
export function bringLink(rezeptUrl)
// -> "https://api.getbring.com/rest/bringrecipes/deeplink?url=<encodeURIComponent(rezeptUrl)>&source=web"
export function rezeptSeitenPfad(eintrag, recipes = null)   // -> "rezepte/lasagne.html" oder "rezepte/nudel-baukasten--brokkoli-sahne.html"
```
Für Rezepte ist `rezeptUrl` die absolute URL der Rezeptseite (`new URL(rezeptSeitenPfad(e), location.href)`), für Links die Link-URL selbst. Ob Bring diesen Link noch annimmt, ist unbestätigt und wird in P8 geprüft.

Festgelegt (P6b): Mit `recipes` (die Rezeptliste) werden die Optionen in der Reihenfolge der `variantenGruppen` des Rezepts gelesen, unabhängig von der Schlüsselreihenfolge von `variante`. Gruppen, die in `variante` fehlen, werden übersprungen. Ohne `recipes` oder bei unbekannter ID gilt die Schlüsselreihenfolge. Die Dateinamen bleiben gleich. Für Links liefert die Funktion `null`; SPEC sieht dafür keine Seite vor, die App zeigt dann die Link-URL.

### 5.4 Rezeptseiten `rezepte/*.html`

Erzeugt durch `node scripts/build-pages.mjs` aus `data/recipes.json`.
- Eine Seite pro Rezept ohne Varianten: `rezepte/<id>.html`
- Bei Varianten eine Seite pro Kombination: `rezepte/<id>--<option1>-<option2>.html` (Optionen in der Reihenfolge der Gruppen)
- Inhalt: Titel, Portionen, Dauer, Zutatenliste, Schritte, Link zurück zur App
- Im `<head>` ein `<script type="application/ld+json">` mit schema.org `Recipe`: `name`, `recipeYield` ("4 Portionen"), `totalTime` (ISO 8601, z.B. "PT75M"), `recipeIngredient` (Strings wie "500 g Rinderhack", bei `menge: null` nur der Name), `recipeInstructions` (Array aus `HowToStep` mit `text`)
- Das Skript löscht vorher alle `.html` in `rezepte/` und schreibt sie neu. Es ist idempotent.
- Vor dem Löschen prüft das Skript die erzeugten Dateinamen auf Kollisionen zwischen Variantenkombinationen. Bei einer Kollision bricht es mit Fehler ab und lässt die vorhandenen Seiten unverändert.

### 5.5 Speicher

Beide Speicher-Module exportieren dieselbe Schnittstelle:

```js
export async function erstelleStore(optionen)
// -> { laden(): Promise<State>, speichern(state, change): Promise<State>, abonnieren(callback): () => void }
```
- `laden` liefert einen leeren State (`aktuellerPlan: null`, leere Arrays), wenn noch nichts gespeichert ist.
- Erfolgsmeldungen für hinzugefügte Links und übernommene lokale Daten erscheinen erst nach erfolgreichem Speichern. Bei einem Fehler bleibt die Fehlermeldung sichtbar und wird nicht durch eine Erfolgsmeldung ersetzt.
- `abonnieren` ruft den Callback bei jeder Änderung von außen mit dem neuen State auf (bei Firebase über `onSnapshot`). Gibt eine Abmelde-Funktion zurück.
- `store-local.js`: `localStorage`-Schlüssel `essensplaner-state`. `abonnieren` reagiert auf das `storage`-Event.
- `store-firebase.js`: siehe Abschnitt 7.

`app.js` wählt Firebase, wenn `js/firebase-config.js` eine `apiKey` enthält und eine Haushalts-ID bekannt ist, sonst den lokalen Speicher und zeigt dann oben den Hinweis "Lokaler Modus: nur auf diesem Gerät gespeichert".

## 6. Oberfläche

Deutsch, mobil zuerst (360, 393 und 412 px breit müssen sauber aussehen), helles und dunkles Farbschema über `prefers-color-scheme`. Keine Frameworks, keine externen Schriften. Als Homescreen-App installierbar (`manifest.webmanifest`, `display: standalone`, Icons).

Navigation unten (bleibt beim Scrollen sichtbar) mit drei Tabs, jeweils mit eigenem Icon: Woche (Kalender), Einkauf (Korb), Rezepte (Buch). Akzentfarbe Orange.

### 6.1 Week

The heading is “Deine Woche” with the week's date underneath. Three cards show
So + Mo, Di + Mi and Do + Fr, with separate cooking instructions. The title opens
details; one menu contains replacement, reroll, Bring and movement. The new recipe
keeps “Hat geschmeckt”. Optional wishes, replanning and undo follow sections 11–12.
Replacement uses a searchable, filtered modal and commits through `setzeSlot`.
Warnings remain visible below the cards. Recipe links open in a new tab.

### 6.2 Shopping

Saturday and Thursday selectors show one list at a time. Ingredients are grouped
by category; amount and name share a row. Expanding a row reveals source recipes.
Only pantry-flagged ingredients start in the collapsed pantry section. Copy uses
the selected day's list and supplies a text fallback on failure. Per-dish Bring
links follow the ingredients; external recipes retain “Zutaten siehe Rezept”.

### 6.3 Rezepte
- Liste aller Favoriten, darunter alle Pool-Rezepte (zugeklappt) und eigene Links.
- Bei Pool-Rezepten und Links: Schalter "Favorit".
- Formular "Rezept-Link hinzufügen": Titel, URL (muss mit `https://` beginnen). Neue Links haben `geplantAm: null`.
- HTTPS-URLs werden auch beim Anzeigen gespeicherter Links geprüft. Ungültige URLs aus dem State deaktivieren die zugehörigen Rezept- und Bring-Aktionen in allen Tabs. Titel bleiben HTML-escaped.
- Links löschen möglich (mit Bestätigung).
- Bereich "Haushalt": zeigt, ob Firebase verbunden ist; Button "Einladungslink kopieren" (siehe 7).

## 7. Firebase

- Firestore, ein Dokument pro Haushalt: `haushalte/{haushaltId}`, Inhalt = State plus `aktualisiert` (Server-Zeitstempel).
- Anmeldung: Firebase Anonymous Auth (`signInAnonymously`). Kein Google-Login, kein Passwort.
- Zugriffsschutz über eine geheime Haushalts-ID (32 Hex-Zeichen). Sie steht nie im Repo.
  - Die App liest sie aus dem URL-Fragment `#haushalt=<id>`, speichert sie in `localStorage` (`essensplaner-haushalt`) und entfernt das Fragment per `history.replaceState`.
  - Ohne ID zeigt die App einen Startbildschirm mit Eingabefeld "Haushalts-ID einfügen" und Button "Lokal ausprobieren". (Auf iPhones hat die Homescreen-App einen eigenen Speicher, deshalb muss die Eingabe direkt in der App möglich sein.)
  - "Einladungslink kopieren" erzeugt `<App-URL>#haushalt=<id>`.
- `firestore.rules` im Repo:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /haushalte/{haushaltId} {
      allow read, write: if request.auth != null && haushaltId == 'HAUSHALTS_ID_HIER_EINSETZEN';
    }
  }
}
```
  Die echte ID wird nur in der Firebase-Konsole eingetragen.
- Firebase-SDK als ES-Module von `https://www.gstatic.com/firebasejs/<feste Version>/...`, eine feste Versionsnummer, nie "latest".
- Concurrent changes use Firestore transactions and field-level merging. Stale plan revisions fail rather than overwrite a newer plan; see section 11.
- `js/firebase-config.js` enthält die öffentliche Web-Konfiguration (`apiKey`, `authDomain`, `projectId`, `appId`). Das ist bei Firebase üblich und kein Geheimnis; der Schutz liegt in den Regeln.

## 8. Nicht im Umfang (Version 1)

- Tage frei markieren, Gäste, andere Portionsgrößen
- Nährwerte, Kalorien
- Automatisches Befüllen von Bring ohne Klick (inoffizielle API)
- Push-Benachrichtigungen, Erinnerungen
- Offline-Modus über Service Worker
- KI-Vorschläge

## 9. Definition of Done (gesamt)

- `node scripts/validate-recipes.mjs` meldet 0 Fehler
- `node --test tests/*.test.mjs` grün
- `node scripts/build-pages.mjs` erzeugt für jedes Rezept und jede Variantenkombination genau eine Seite mit gültigem JSON-LD
- App läuft lokal (`python3 -m http.server 8000`) im lokalen Modus und auf GitHub Pages mit Firebase
- Zwei Browser mit derselben Haushalts-ID sehen Änderungen des anderen innerhalb weniger Sekunden
- Bring-Import einer Rezeptseite manuell geprüft (Ergebnis in P8 dokumentiert)


## 11. Weekly wish, movement and concurrent writes (15 November 2026)

The approved UI contract is `docs/mockups/README.md`; colors are defined in
`docs/mockups/palette.json`. This section describes implemented behavior.

A plan may contain `wunsch: { slot, eintrag, manuell? }`. There is at most one
shared wish. Initial placement checks storage compatibility and permits a new
recipe only in A or C. “Tag egal” assigns a compatible slot once. Applying a wish
to an existing plan prefers unchanged entries, including their variants, within
the strictest feasible rule tier. The preview lists changed slots. Replanning
keeps the exact wish entry and assigned slot. A wish counts toward the new-recipe
quota; the R3/R4/R2 relaxation order from section 3 remains. Wish planning never
uses the emergency fallback that violates storage or distinctness. No feasible
combination leaves the saved plan untouched. Releasing a wish removes only its
constraint. Wishes belong to the plan rather than a separate user preference.

`tauscheSlots` exchanges complete entries, moves `neuSlot` and the wish with the
entry, accepts empty destinations and rejects unknown slot identifiers. A same-slot
operation is a no-op. A manually moved new recipe may therefore have `neuSlot: B`,
while automatic initial placement remains A/C only. Manual wishes carry `manuell`
so replanning does not silently relocate a manually placed dish; existing rule
warnings remain visible. Movement and replacement pass through `uebernehmePlan`,
which keeps and reverses tried/link provenance. Shopping is derived from the
resulting slots, including fresh ingredients crossing C.

Each successful plan mutation receives a UUID `planRevision`; every write also
receives `revision` and an increasing `changeSequence`. The sequence distinguishes
a buffered older listener event from a newer update when a write finishes. Storage takes a field-level change with its base and intended
state. Firestore uses `runTransaction` to reapply that change to the latest document.
Favorite and tried additions/removals merge by identity. Link edits merge by field;
conflicting fields, deleted links and stale plan revisions fail instead of replacing
newer data. Local tabs use the Web Locks API when available and storage events.
Browsers without Web Locks have no cross-tab atomicity guarantee.

Successful replanning offers one-step undo until the next plan mutation. The undo
control stays in the week screen and menu after transient feedback disappears.
It restores the previous plan, wish and only the planning provenance changed by
that operation. Favorites, other links and unrelated tried entries survive. A
partner plan revision invalidates undo and cancels a move or drag. Failed saves
retain the intended change in memory, with persistent retry/discard controls;
this is not reload persistence. Retry still checks the original plan revision.
Write success never clears a listener failure. Reconnect preserves current form
and sheet drafts; initial load failures still use the existing start recovery.

## 12. Mobile interaction contract (15 November 2026)

Woche, Einkauf and Rezepte use fixed bottom navigation with safe-area padding.
Week cards separate eating days from the cooking instruction. Their title opens
a detail sheet, and the overflow menu contains replacement, reroll, Bring and
movement. The new recipe retains “Hat geschmeckt”. A 300 ms hold on the dedicated
handle starts pointer movement; the card body keeps native scrolling. Cancellation,
outside release and lost capture do not save. The destination sheet offers the
same movement function for keyboard and assistive technology.

Replacement filters enforce R1 before search. Favorites are first, the current
entry is excluded, and status filters are mutually exclusive. “Neu” excludes tried
pool recipes and planned non-favorite links. Duration is numeric, protein filters
use OR within that pair and AND with other filters. Unknown link metadata never
matches duration/appliance/protein filters. Selection commits via `setzeSlot` and
`uebernehmePlan`. Modal dialogs contain focus; Escape, close and browser Back cancel
without applying drafts and restore the trigger. Search and wish drafts remain
outside the rerendered app shell. Replacement results have their own scroll area.

Shopping has Saturday/Thursday selectors. Copy uses the selected day and provides
a selectable text fallback after clipboard failure. Ingredient groups start open,
source recipe names are disclosed per row, and only items carrying the pantry
flag start in the collapsed pantry section. Bring actions follow the ingredients.
Recipe titles take a full row with actions below; link input, selection and focus
survive household updates.

Controls are at least 48 by 48 CSS pixels. The shared neutral palette supports both
themes, reduced motion and enlarged text. Primary orange buttons use 20 px or larger
bold light labels; small text uses the separate accent token. Physical iPhone and
Samsung checks and live Firebase verification are release checks, not claims made
by browser emulation or the transaction transport tests.

## 13. Live feedback refinements (15 November 2026)

Day headings use neutral pill backgrounds; protein and appliance metadata retain
badge styling. Action sheets group plan changes separately from recipe/shopping
actions, with local icons and rounded group containers.

A pointer opening focuses the sheet heading rather than the close button. Pointer
interaction suppresses button focus outlines within the sheet and native tap
flashes; keyboard navigation immediately restores visible focus. Focus containment,
Escape, Back and trigger restoration remain intact.

A tap that starts and ends on the backdrop closes the sheet. Dragging its grip or
non-interactive header downward by at least 80 px also closes it. A shorter or
cancelled gesture resets the sheet position. Content gestures retain native
scrolling. All dismissal paths discard unapplied drafts without saving. The grip
also works as a named close button for keyboard and assistive technology.

Recipe-page JSON-LD exports only ingredients with `vorrat: false` to Bring. The
visible recipe still includes every cooking ingredient, including pantry staples.
This applies to base and variant ingredients. Category `vorrat` alone is not a
reason to exclude rice, pasta or other shopping ingredients. Fresh herbs retain
their existing non-pantry classification. Catalog Bring URLs include
`?bring=ohne-vorrat` to distinguish them from earlier full-ingredient import URLs.
External user-supplied recipe URLs remain external; their ingredient metadata is
not under this app's control.
