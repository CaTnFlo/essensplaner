import { anwenden } from "./state-change.js";
// Speicher in Firestore (SPEC 5.5 und 7). Gleiche Schnittstelle wie store-local.js.
// Fehler werden geworfen bzw. an den Fehler-Callback gemeldet, nie stillschweigend geschluckt.

const SDK = "https://www.gstatic.com/firebasejs/11.10.0";

function leererState() {
  return { version: 1, aktuellerPlan: null, verlauf: [], favoriten: [], probiert: [], links: [] };
}

function ausDokument(daten) {
  const { aktualisiert, ...rest } = daten ?? {};
  return { ...leererState(), ...rest };
}

export async function erstelleStore({ haushaltId, config }) {
  const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config);
  const auth = getAuth(app);
  await signInAnonymously(auth);
  const ref = fs.doc(fs.getFirestore(app), "haushalte", haushaltId);

  return {
    async laden() {
      const snap = await fs.getDoc(ref);
      return snap.exists() ? ausDokument(snap.data()) : leererState();
    },
    async speichern(state, change) {
      if (!change) throw new Error("Änderungsbasis fehlt");
      return fs.runTransaction(fs.getFirestore(app), async transaction => {
        const snapshot = await transaction.get(ref);
        const next = anwenden(snapshot.exists() ? ausDokument(snapshot.data()) : leererState(), change);
        const daten = JSON.parse(JSON.stringify(next));
        transaction.set(ref, { ...daten, aktualisiert: fs.serverTimestamp() });
        return next;
      });
    },
    abonnieren(callback, fehlerCallback) {
      return fs.onSnapshot(
        ref,
        (snap) => {
          // Eigene, noch nicht bestätigte Schreibvorgänge nicht zurückspielen (verhindert Flackern).
          if (snap.metadata.hasPendingWrites) return;
          callback(snap.exists() ? ausDokument(snap.data()) : leererState());
        },
        (e) => fehlerCallback?.(e),
      );
    },
  };
}
