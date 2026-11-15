import { anwenden } from "./state-change.js";
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
    async speichern(state, change) {
      const write = () => {
        const next = change ? anwenden(lies(), change) : state;
        localStorage.setItem(SCHLUESSEL, JSON.stringify(next));
        return next;
      };
      return globalThis.navigator?.locks ? navigator.locks.request(SCHLUESSEL, write) : write();
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
