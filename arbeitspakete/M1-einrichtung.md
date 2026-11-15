# M1 GitHub Pages und Firebase einrichten (machst du selbst)

Dauer etwa 20 Minuten. Kann jederzeit nach P1 passieren.

## GitHub
1. Neues **öffentliches** Repo anlegen, z.B. `essensplaner`, und lokal klonen. `SPEC.md` und den Ordner `arbeitspakete/` hineinlegen und committen.
2. Repo > Settings > Pages: Source "Deploy from a branch", Branch `main`, Ordner `/ (root)`.
3. Die App-URL ist dann `https://<dein-github-name>.github.io/essensplaner/`.

## Firebase
1. https://console.firebase.google.com: Projekt anlegen (Google Analytics aus).
2. Projektübersicht > Web-App hinzufügen (`</>`), Name "Essensplaner", Hosting **nicht** aktivieren. Die angezeigte `firebaseConfig` kopieren (für P7).
3. Build > Authentication > Get started > Sign-in method: **Anonym** aktivieren.
4. Authentication > Settings > Autorisierte Domains: `<dein-github-name>.github.io` hinzufügen.
5. Build > Firestore Database > Datenbank erstellen: Region `europe-west3 (Frankfurt)`, Produktionsmodus.
6. Haushalts-ID erzeugen, im Terminal:
   ```bash
   openssl rand -hex 16
   ```
   Die ID sicher aufheben (z.B. Passwortmanager). Sie kommt nie ins Repo.
7. Firestore > Regeln: Inhalt von `firestore.rules` aus dem Repo einfügen, `HAUSHALTS_ID_HIER_EINSETZEN` durch deine ID ersetzen, veröffentlichen.

## An P7 übergeben
Nur die `firebaseConfig` (die ist öffentlich). Die Haushalts-ID gibst du keinem Agenten, die tippst du am Ende selbst in die App.
