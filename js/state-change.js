// Field-level changes are reapplied inside the Firestore transaction. Never write
// a stale whole-document snapshot over another household member's edits.
const gleich = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export class Konflikt extends Error {
  constructor() { super('Der Plan wurde inzwischen geändert. Bitte erneut auswählen.'); this.name = 'Konflikt'; }
}
export function aenderung(base, next) {
  return { base: structuredClone(base), next: structuredClone(next), id: crypto.randomUUID() };
}
export function anwenden(aktuell, change) {
  const { base, next, id } = change;
  const out = structuredClone(aktuell);
  const planChanged = !gleich(base.aktuellerPlan, next.aktuellerPlan);
  if (planChanged && (aktuell.planRevision ?? null) !== (base.planRevision ?? null)) throw new Konflikt();
  if (planChanged && !gleich(aktuell.aktuellerPlan, base.aktuellerPlan)) throw new Konflikt();
  for (const key of ['aktuellerPlan', 'verlauf']) {
    if (!gleich(base[key], next[key])) {
      if (!gleich(aktuell[key], base[key])) throw new Konflikt();
      out[key] = structuredClone(next[key]);
    }
  }
  for (const key of ['favoriten', 'probiert']) {
    const before = new Set(base[key] ?? []), after = new Set(next[key] ?? []);
    const result = new Set(aktuell[key] ?? []);
    for (const item of before) if (!after.has(item) && !(key === 'probiert' && (aktuell.favoriten ?? []).includes(item))) result.delete(item);
    for (const item of after) if (!before.has(item)) result.add(item);
    out[key] = [...result];
  }
  out.links = structuredClone(aktuell.links ?? []);
  for (const old of base.links ?? []) {
    const item = (next.links ?? []).find(x => x.id === old.id);
    const index = out.links.findIndex(x => x.id === old.id);
    if (gleich(old, item)) continue;
    if (index < 0) throw new Konflikt();
    if (!item) {
      if (!gleich(out.links[index], old)) throw new Konflikt();
      if (Object.values(out.aktuellerPlan?.slots ?? {}).some(x => x?.id === old.id)) throw new Konflikt();
      out.links.splice(index, 1);
    } else for (const key of Object.keys(item)) {
      if (gleich(old[key], item[key])) continue;
      if (!gleich(out.links[index][key], old[key])) throw new Konflikt();
      out.links[index][key] = structuredClone(item[key]);
    }
  }
  for (const item of next.links ?? []) if (!(base.links ?? []).some(x => x.id === item.id)) {
    if (out.links.some(x => x.id === item.id)) throw new Konflikt();
    out.links.push(structuredClone(item));
  }
  out.changeSequence = (aktuell.changeSequence ?? 0) + 1;
  out.revision = id;
  if (planChanged) out.planRevision = id;
  return out;
}
export function rueckgaengigChange(before, after, aktuell, intended = after) {
  if ((aktuell.planRevision ?? null) !== (after.planRevision ?? null)) throw new Konflikt();
  // Invert only fields changed by planning, not unrelated favorites or link data.
  const ownAdded = (intended.probiert ?? []).filter(id => !(before.probiert ?? []).includes(id));
  const ownRemoved = (before.probiert ?? []).filter(id => !(intended.probiert ?? []).includes(id));
  const restoredTried = [...new Set([...(after.probiert ?? []).filter(id => !ownAdded.includes(id)), ...ownRemoved])];
  const inverse = { ...structuredClone(after), aktuellerPlan: structuredClone(before.aktuellerPlan),
    verlauf: structuredClone(before.verlauf ?? []), probiert: restoredTried,
    links: (after.links ?? []).map(link => {
      const old = (before.links ?? []).find(x => x.id === link.id);
      const changed = (intended.links ?? []).find(x => x.id === link.id);
      return old && changed && old.geplantAm !== changed.geplantAm ? { ...link, geplantAm: old.geplantAm } : link;
    }) };
  return aenderung(after, inverse);
}
