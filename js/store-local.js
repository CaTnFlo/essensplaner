// Lokaler Speicher im Browser (SPEC 5.5). Gleiche Schnittstelle wie store-firebase.js.

const SCHLUESSEL = "essensplaner-state";

export function leererState() {
  return { version: 1, aktuellerPlan: null, verlauf: [], favoriten: [], probiert: [], links: [] };
}

function lies() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return leererState();
    return { ...leererState(), ...JSON.parse(roh) };
  } catch {
    return leererState();
  }
}

export async function erstelleStore() {
  return {
    async laden() {
      return lies();
    },
    async speichern(state) {
      localStorage.setItem(SCHLUESSEL, JSON.stringify(state));
    },
    abonnieren(callback) {
      const handler = (e) => {
        if (e.key === SCHLUESSEL || e.key === null) callback(lies());
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}
