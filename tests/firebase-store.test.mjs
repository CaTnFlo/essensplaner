import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {anwenden,aenderung} from '../js/state-change.js';

// Exercises the production adapter with an optimistic transaction transport.
// This proves conflict/retry handling, not live Firestore rules or connectivity.
test('Firebase adapter retries concurrent transactions against the latest document', async()=>{
 let document={version:1,aktuellerPlan:null,verlauf:[],favoriten:[],probiert:[],links:[]}, revision=0, retries=0;
 const fs={doc:()=>({}),getFirestore:()=>({}),serverTimestamp:()=>0,
  runTransaction:async(db,callback)=>{
   for(let i=0;i<10;i++){
    const start=revision, snapshot=structuredClone(document); let proposed;
    const value=await callback({get:async()=>({exists:()=>true,data:()=>snapshot}),set:(ref,data)=>{proposed=data;}});
    await new Promise(r=>setImmediate(r));
    if(revision!==start){retries++;continue;}
    document=proposed;revision++;return value;
   }
   throw Error('retry limit');
  }};
 const modules=[{initializeApp:()=>({})},{getAuth:()=>({}),signInAnonymously:async()=>{}},fs];
 const source=readFileSync(new URL('../js/store-firebase.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export async function','async function').replace(/import\(`\$\{SDK\}\/firebase-[^`]+`\)/g,()=>`Promise.resolve(modules.shift())`);
 const context=vm.createContext({anwenden,modules,JSON});vm.runInContext(source,context);
 const store=await vm.runInContext('erstelleStore({haushaltId:"test",config:{}})',context);
 const base=structuredClone(document), one=structuredClone(base),two=structuredClone(base);
 one.favoriten=['one'];two.links=[{id:'two',titel:'Two',geplantAm:null}];
 await Promise.all([store.speichern(one,aenderung(base,one)),store.speichern(two,aenderung(base,two))]);
 assert.ok(retries>0);assert.deepEqual(document.favoriten,['one']);assert.equal(document.links[0].id,'two');
 const x=structuredClone(document),a=structuredClone(x),b=structuredClone(x);
 a.aktuellerPlan={slots:{A:{id:'a'}}};b.aktuellerPlan={slots:{A:{id:'b'}}};
 const results=await Promise.allSettled([store.speichern(a,aenderung(x,a)),store.speichern(b,aenderung(x,b))]);
 assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
