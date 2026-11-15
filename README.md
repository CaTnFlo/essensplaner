# Essensplaner

Wochenplaner für zwei Personen: mit einem Klick drei Gerichte pro Woche plus Einkaufsliste. Statische Seite (GitHub Pages), geteilter Zustand über Firestore, keine KI zur Laufzeit.

Verbindliche Spezifikation: [SPEC.md](SPEC.md). Arbeitspakete: [arbeitspakete/](arbeitspakete/).

## Lokal starten

```bash
python3 -m http.server 8000
```

## Tests

```bash
node --test
```

`node --test tests/` (mit Ordner) funktioniert nur bis Node 22; ab Node 24 findet `node --test` die Tests in `tests/` selbst.

## Rezepte prüfen

```bash
node scripts/validate-recipes.mjs          # data/recipes.json, ohne Vollständigkeitsregeln
node scripts/validate-recipes.mjs --voll   # zusätzlich 7 Favoriten und 30 Pool-Rezepte
```
