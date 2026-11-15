# Arbeitspakete

Jedes Paket läuft in einem eigenen Chat. Der Chat bekommt nur das Repo, `SPEC.md` und seine Paketdatei. Kontext aus der Planungsrunde gibt es dort nicht, deshalb steht alles Nötige in der SPEC.

## Reihenfolge

| Paket | Modell | braucht | parallel möglich mit |
|---|---|---|---|
| P1 Grundgerüst und Validator | Sonnet | nichts | |
| P2 Lieblingsgerichte als Daten | Haiku | P1 | P3, P4 |
| P3 Rezept-Pool (30 Rezepte) | Haiku | P1 | P2, P4 |
| P4 Planer-, Einkaufs- und Bring-Logik | Sonnet | P1 | P2, P3 |
| P5 Rezeptseiten-Generator | Haiku | P2, P3 | P6 |
| P6 Oberfläche im lokalen Modus | Sonnet | P4 (P2 für echte Daten) | P5 |
| P6b Korrekturen aus offenen Fragen | Sonnet | P6 | M1 |
| M1 GitHub Pages und Firebase einrichten | du selbst | P1 | alles ab P2 |
| P7 Firebase-Anbindung | Sonnet | P6b, M1 | |
| P8 Abnahme | Opus | alles | |

Parallele Pakete ändern nie dieselben Dateien. Wenn zwei Pakete parallel laufen, jeweils in einem eigenen Branch oder Worktree arbeiten und nacheinander mergen.

## Start-Prompt für einen Paket-Chat

```text
Arbeite im Repo <Pfad zum lokalen Klon>. Lies zuerst SPEC.md und arbeitspakete/README.md, dann arbeitspakete/<Paketdatei>. Führe genau dieses Paket aus und halte dich an die Regeln für alle Pakete. Am Ende: Abnahmekriterien selbst prüfen, committen, Abschlussbericht im vorgegebenen Format.
```

## Regeln für alle Pakete

1. Nur die Dateien anlegen oder ändern, die im Paket unter "Dateien" stehen. Braucht es eine weitere Datei, im Bericht begründen.
2. Keine npm-Pakete, kein Build-Tool, kein Framework. Node >= 20 und Browser-Standard reichen.
3. Nichts erfinden, was die SPEC offenlässt. Unklarheiten als offene Frage in den Bericht.
4. Vor dem Commit alle Abnahmebefehle des Pakets ausführen. Sind sie rot, nicht committen, sondern reparieren oder im Bericht melden.
5. Commit-Nachricht: `P<n>: <kurze Beschreibung>`.
6. Keine Geheimnisse ins Repo (keine Haushalts-ID, keine Passwörter).
7. Kein Dash als Satzzeichen in deutschen UI-Texten, normale deutsche Anführungszeichen.

## Format Abschlussbericht

```text
Paket: P<n>
Status: fertig | teilweise | blockiert
Geänderte Dateien: ...
Abnahme: <Befehl> -> <Ergebnis>, je Kriterium eine Zeile
Abweichungen von der SPEC: keine | ...
Offene Fragen: keine | ...
```
