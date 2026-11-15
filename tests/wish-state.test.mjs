import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planeWoche, planeMitWunsch, tauscheSlots, uebernehmePlan, erzeugeRng, filterKandidaten, wuerfleSlot } from '../js/planner.js';
import { aenderung, anwenden, rueckgaengigChange } from '../js/state-change.js';
import { einkaufsliste } from '../js/shopping.js';
const recipes = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url))).rezepte;
const empty = () => ({ version: 1, aktuellerPlan: null, verlauf: [], favoriten: [], probiert: [], links: [] });
const heute = new Date('2026-11-15T12:00:00Z');
const entry = id => ({ quelle: 'rezept', id, variante: null });
const plan = () => planeWoche({ recipes, state: empty(), heute, rng: erzeugeRng(42) }).plan;

test('wish is fixed across seeds, respects storage, uniqueness and new quota', () => {
  for (const [id, slot] of [['lasagne','B'], ['lachs-spinat-nudeln','A'], ['haehnchen-fajitas','C']]) {
    for (let seed=1; seed<=50; seed++) {
      const wunsch = { slot, eintrag: entry(id) };
      const result = planeMitWunsch({ recipes, state: empty(), heute, rng: erzeugeRng(seed), wunsch });
      assert.ok(result.plan); assert.deepEqual(result.plan.slots[slot], wunsch.eintrag);
      assert.equal(new Set(Object.values(result.plan.slots).map(x => x.id)).size, 3);
      assert.ok(recipes.find(r => r.id === result.plan.slots.B.id).haltbarTage >= 3);
      assert.notEqual(result.plan.neuSlot, null);
    }
  }
});
test('impossible wish does not produce a fallback plan; new wish in B is rejected', () => {
  const state = empty();
  assert.equal(planeMitWunsch({ recipes: [], state, heute, rng: erzeugeRng(1), wunsch: { slot:'A', eintrag:entry('gone') } }).plan, null);
  const fresh = recipes.find(r => r.typ !== 'favorit');
  assert.equal(planeMitWunsch({ recipes, state, heute, rng: erzeugeRng(1), wunsch: { slot:'B', eintrag:entry(fresh.id) } }).plan, null);
});
test('existing compatible dishes and variants survive wish application', () => {
  const p = plan(), state = uebernehmePlan(empty(), p);
  const slot = 'A';
  const result = planeMitWunsch({ recipes, state, heute, rng: erzeugeRng(2), wunsch: {slot, eintrag:p.slots[slot]}, erhalten:true });
  assert.deepEqual(result.plan.slots, p.slots);
});
test('swaps are immutable, move variants and markers, allow empty targets and reject invalid IDs', () => {
  const p = plan(); p.neuSlot = 'A'; p.wunsch = {slot:'A',eintrag:structuredClone(p.slots.A)};
  p.slots.A.variante = { a:'one' }; p.slots.B.variante = { b:'two' };
  const original = structuredClone(p), swapped = tauscheSlots(p, 'A','B');
  assert.deepEqual(p, original); assert.deepEqual(swapped.slots.B, p.slots.A); assert.deepEqual(swapped.slots.A, p.slots.B);
  assert.equal(swapped.neuSlot,'B'); assert.equal(swapped.wunsch.slot,'B');
  assert.deepEqual(tauscheSlots(p,'A','A'),p);
  p.slots.C = null; assert.equal(tauscheSlots(p,'A','C').slots.A,null);
  for (const id of ['Z','__proto__',null]) assert.throws(() => tauscheSlots(p,id,'A'));
});
test('new recipe provenance survives repeated swaps and is rolled back after replacement', () => {
  let state = uebernehmePlan(empty(), plan());
  const id = state.aktuellerPlan.slots[state.aktuellerPlan.neuSlot].id;
  for (const [a,b] of [['A','B'],['B','C'],['C','A']]) state = uebernehmePlan(state, tauscheSlots(state.aktuellerPlan,a,b));
  assert.equal(state.aktuellerPlan.probiertHinzugefuegt,true);
  const p = structuredClone(state.aktuellerPlan); p.slots[p.neuSlot] = entry('lasagne'); p.neuSlot = null;
  state = uebernehmePlan(state,p); assert.ok(!state.probiert.includes(id));
});
test('filters use duration metadata, OR protein and unknown-link exclusion', () => {
  const state = empty(); state.links.push({id:'l',titel:'Link',geplantAm:null});
  assert.ok(!filterKandidaten({ recipes, state, filter:['kurz'] }).some(x=>x.id==='l'));
  assert.ok(filterKandidaten({ recipes, state, filter:['fisch','gefluegel'] }).every(x=>['fisch','gefluegel'].includes(x.protein)));
  const pool = recipes.find(r=>r.typ!=='favorit'); state.probiert.push(pool.id);
  assert.ok(!filterKandidaten({recipes,state,filter:['neu']}).some(x=>x.id===pool.id));
  assert.ok(filterKandidaten({recipes,state}).some(x=>x.id===pool.id));
});
test('fresh ingredients follow movements into and out of Thursday slot', () => {
  const p = { wocheAb:'2026-11-15',slots:{ A:entry('lachs-spinat-nudeln'),B:entry('lasagne'),C:entry('haehnchen-fajitas') } };
  const moved = tauscheSlots(p,'A','C');
  const a = einkaufsliste({plan:p,recipes,state:empty()}), b = einkaufsliste({plan:moved,recipes,state:empty()});
  assert.notDeepEqual(a.donnerstag,b.donnerstag);
  assert.deepEqual(einkaufsliste({plan:tauscheSlots(moved,'C','A'),recipes,state:empty()}),a);
});
test('concurrent favorite and link changes merge; stale plan and stale undo fail', () => {
  const base = empty(), planned = uebernehmePlan(base,plan());
  const partner = structuredClone(base); partner.favoriten.push('partner'); partner.links.push({id:'l',titel:'Partner',geplantAm:null});
  const live = anwenden(base,aenderung(base,partner));
  const committed = anwenden(live,aenderung(base,planned));
  assert.deepEqual(committed.favoriten,['partner']); assert.equal(committed.links[0].titel,'Partner');
  assert.throws(()=>anwenden(committed,aenderung(base,planned)), /inzwischen/);
  const feedback = structuredClone(committed); feedback.favoriten.push('feedback'); feedback.links[0].titel='Edited';
  const updated = anwenden(committed,aenderung(committed,feedback));
  const undo = anwenden(updated,rueckgaengigChange(base,committed,updated));
  assert.equal(undo.aktuellerPlan,null); assert.deepEqual(undo.favoriten,['partner','feedback']); assert.equal(undo.links[0].titel,'Edited');
  const moved = structuredClone(committed); moved.aktuellerPlan=tauscheSlots(moved.aktuellerPlan,'A','B');
  const remote = anwenden(committed,aenderung(committed,moved));
  assert.throws(()=>rueckgaengigChange(base,committed,remote),/inzwischen/);
});
test('a deleted link cannot be resurrected by a stale plan draft', () => {
  const base=empty(); base.links=[{id:'l',titel:'Link',geplantAm:null}];
  const planned=structuredClone(base); planned.aktuellerPlan={wocheAb:'2026-11-15',neuSlot:'A',slots:{A:{quelle:'link',id:'l',variante:null},B:null,C:null}}; planned.links[0].geplantAm='2026-11-15';
  const remote=structuredClone(base); remote.links=[];
  assert.throws(()=>anwenden(remote,aenderung(base,planned)),/inzwischen/);
});
test('undo does not remove unrelated provenance merged during the original commit', () => {
  const base=empty(), intended=uebernehmePlan(base,plan());
  const partner=structuredClone(base); partner.probiert=['partner-tried'];
  const after=anwenden(partner,aenderung(base,intended));
  const restored=anwenden(after,rueckgaengigChange(base,after,after,intended));
  assert.deepEqual(restored.probiert,['partner-tried']);
});
test('link provenance survives swaps and undo, while unrelated link edits remain', () => {
  const base=empty(); base.links=[{id:'l',titel:'Link',geplantAm:null}];
  const p=plan(); p.slots.A={quelle:'link',id:'l',variante:null}; p.neuSlot='A';
  let state=uebernehmePlan(base,p);
  state=uebernehmePlan(state,tauscheSlots(state.aktuellerPlan,'A','B'));
  state=uebernehmePlan(state,tauscheSlots(state.aktuellerPlan,'B','C'));
  assert.equal(state.links[0].geplantAm,p.wocheAb);
  const next=structuredClone(state.aktuellerPlan); next.slots.C=entry('lasagne'); next.neuSlot=null;
  const intended=uebernehmePlan(state,next), committed=anwenden(state,aenderung(state,intended));
  assert.equal(committed.links[0].geplantAm,null);
  const partner=structuredClone(committed); partner.links[0].titel='New title';
  const restored=anwenden(partner,rueckgaengigChange(state,committed,partner,intended));
  assert.equal(restored.links[0].geplantAm,p.wocheAb); assert.equal(restored.links[0].titel,'New title');
});
test('rerolling a manually moved new recipe in B keeps storage safe and provenance correct', () => {
  let state=uebernehmePlan(empty(),plan());
  state=uebernehmePlan(state,tauscheSlots(state.aktuellerPlan,state.aktuellerPlan.neuSlot,'B'));
  const old=state.aktuellerPlan.slots.B.id;
  const result=wuerfleSlot({recipes,state,plan:state.aktuellerPlan,slot:'B',rng:erzeugeRng(4)});
  assert.ok(recipes.find(r=>r.id===result.plan.slots.B.id).haltbarTage>=3);
  state=uebernehmePlan(state,result.plan);
  if(old!==state.aktuellerPlan.slots.B.id) assert.ok(!state.probiert.includes(old));
});
test('wish replanning relaxes previous-week exclusion without dropping the wish', () => {
 const state=empty();state.verlauf=[{wocheAb:'2026-11-08',slots:{A:entry('lasagne')}}];
 const result=planeMitWunsch({recipes,state,heute,rng:erzeugeRng(3),wunsch:{slot:'B',eintrag:entry('lasagne')}});
 assert.equal(result.plan.slots.B.id,'lasagne');assert.ok(result.hinweise.some(x=>x.includes('Vorwoche')));
});
test('applying the same wish preserves the currently planned new link',()=>{
 const base=empty();base.links=[{id:'l',titel:'Link',geplantAm:null}];
 const p={wocheAb:'2026-11-15',neuSlot:'C',slots:{A:entry('lachs-spinat-nudeln'),B:entry('lasagne'),C:{quelle:'link',id:'l',variante:null}},wunsch:{slot:'B',eintrag:entry('lasagne')}};
 const state=uebernehmePlan(base,p);
 const result=planeMitWunsch({recipes,state,heute,rng:erzeugeRng(1),wunsch:p.wunsch,erhalten:true});
 assert.deepEqual(result.plan.slots,p.slots);
});
