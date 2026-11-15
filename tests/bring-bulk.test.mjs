import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gesamtEinkauf,bringWochenLink} from '../js/bring.js';
import worker,{importRecipe} from '../worker/index.mjs';
import catalog from '../data/recipes.json' with {type:'json'};

test('bulk shopping merges days but not units and excludes pantry',()=>{
 const p={name:'Tomaten',menge:2,einheit:'Stück'};
 const list=gesamtEinkauf({samstag:[p,{name:'Salz',vorrat:true}],donnerstag:[{...p,menge:3},{...p,menge:400,einheit:'g'}]});
 assert.equal(list.length,2);assert.equal(list[0].menge,5);assert.equal(list[1].menge,400);assert.equal(p.menge,2);
});
const entries=catalog.rezepte.slice(0,3).map(r=>({id:r.id,variante:Object.fromEntries((r.variantenGruppen??[]).map(g=>[g.id,g.optionen[0].id]))}));
test('bulk link excludes household state and external links',()=>{
 const url=bringWochenLink({household:'private',slots:{A:{...entries[0],quelle:'rezept'},B:{quelle:'link',id:'private-link'}}});
 const target=new URL(new URL(url).searchParams.get('url'));
 assert.deepEqual(JSON.parse(target.searchParams.get('gerichte')),[entries[0]]);
 assert.equal(bringWochenLink({slots:{A:{quelle:'link'}}}),null);
});
test('worker returns public recipe markup and validates input',async()=>{
 const raw=JSON.stringify(entries);
 const recipe=importRecipe(raw);
 assert.ok(recipe.recipeIngredient.length>3);
 assert.ok(!recipe.recipeIngredient.some(p=>/Salz|Olivenöl/.test(p)));
 const response=await worker.fetch(new Request('https://example.com/einkauf?gerichte='+encodeURIComponent(raw)));
 assert.equal(response.status,200);assert.match(await response.text(),/application\/ld\+json/);
 for(const value of ['null','[]','{}','[{},{}]',JSON.stringify([{id:'missing'}]),JSON.stringify([...entries,...entries])]) {
  const res=await worker.fetch(new Request('https://example.com/einkauf?gerichte='+encodeURIComponent(value)));
  assert.equal(res.status,400);
 }
 assert.equal((await worker.fetch(new Request('https://example.com/no'))).status,404);
});
test('every catalog variant imports, unknown variants reject',()=>{
 for(const recipe of catalog.rezepte){
  const combinations=(recipe.variantenGruppen??[]).reduce((all,g)=>all.flatMap(v=>g.optionen.map(o=>({...v,[g.id]:o.id}))),[{}]);
  for(const variante of combinations)assert.ok(importRecipe(JSON.stringify([{id:recipe.id,variante}])).recipeIngredient.length);
 }
 assert.throws(()=>importRecipe(JSON.stringify([{id:entries[0].id,variante:{unknown:'x'}}])));
});
