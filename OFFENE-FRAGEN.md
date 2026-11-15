# Offene Fragen

Sammelstelle für Punkte, die SPEC.md offenlässt. Jede Frage mit Paket, aktuellem Verhalten und Entscheidungsbedarf. Wird eine Frage geklärt, in SPEC.md übernehmen und hier streichen.

## P4 Planer-, Einkaufs- und Bring-Logik

1. **Neues Rezept in `uebernehmePlan` erkennen.**
   Die Funktion bekommt keine Rezepte und erkennt das neue Rezept nur über `plan.neuSlot` und `quelle`. Hat jemand den Neu-Slot per "Ändern" auf einen Favoriten gesetzt, landet dessen ID trotzdem in `probiert`.
   Entscheidung: Signatur um `recipes` erweitern, oder so lassen (harmlos, da Favoriten nie als neu gewählt werden)?

2. **Gleiche Woche neu übernommen.**
   Ersetzt ein Plan den aktuellen derselben Woche, bleibt `geplantAm` des alten Links gesetzt und die ID des alten Pool-Rezepts in `probiert`. Ein verworfener Link kommt dann nie wieder als neues Rezept dran.
   Entscheidung: beim Ersetzen zurücksetzen? Für `probiert` unklar, ob die ID schon vorher dort stand.

3. **`rezeptSeitenPfad`: Reihenfolge der Optionen.**
   Die Funktion kennt die Rezepte nicht und nimmt die Schlüsselreihenfolge von `eintrag.variante`. Gibt Firestore Map-Schlüssel alphabetisch zurück, kann das von der Gruppenreihenfolge in `build-pages.mjs` abweichen (bei den Lieblingsgerichten passt beides).
   Entscheidung: optionalen zweiten Parameter `recipes` ergänzen, oder Gruppen-IDs immer alphabetisch benennen?

4. **`rezeptSeitenPfad` für Links.** Gibt `null` zurück, SPEC regelt es nicht.

5. **Lockerung bei R2.** Genauer Sinn der Lockerung ist nicht festgelegt. Umgesetzt: Slots dürfen aus Favoriten und neuen Rezepten frei gewählt werden, Favoriten bevorzugt. `neuSlot` ist nur gesetzt, wenn genau ein neues Rezept in A oder C landet.

6. **`wuerfleSlot` ohne Alternative.** Der Plan bleibt unverändert, Hinweis "Keine andere Möglichkeit gefunden". Alternativ könnte die UI den Button dann deaktivieren.

7. **Testbefehl.** `node --test tests/` bricht unter Node 24 ab (Verzeichnis wird als Modul geladen). `node --test tests/*.test.mjs` läuft. Abnahmebefehle in P8 und README anpassen?
