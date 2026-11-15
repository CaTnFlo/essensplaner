// Run with a local HTTP server and Playwright available via PLAYWRIGHT_MODULE.
// Browser emulation is not a physical-phone or production-Firebase check.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}) });
const base = process.env.TEST_URL || 'http://127.0.0.1:8876';
const output = process.env.TEST_OUTPUT || '/tmp/meal-ui-evidence'; await mkdir(output,{recursive:true});
const report = [], errors = [];
const ctx = await browser.newContext({ viewport:{width:393,height:852},isMobile:true,hasTouch:true });
await ctx.addInitScript(()=>{
 localStorage.setItem('essensplaner-lokal','1');
 const original=Storage.prototype.setItem;
 Storage.prototype.setItem=function(k,v){ if(window.failWrites && k==='essensplaner-state') throw new Error('Test write failure'); return original.call(this,k,v); };
});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error' && !m.text().includes('Test write failure')) errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`)});
const read = () => page.evaluate(()=>JSON.parse(localStorage.getItem('essensplaner-state')));
const settle = () => page.waitForFunction(()=>!document.querySelector('#save-status')?.textContent.includes('Wird gespeichert'));
const click = async selector => { await page.locator(selector).click(); await settle(); };
const close = async()=>{await page.getByRole('button',{name:'Schließen',exact:true}).click(); await page.waitForTimeout(80);};
const shot = async name => {await page.screenshot({path:`${output}/${name}.png`,fullPage:true}); report.push(name);};
await page.goto(base); await click('[data-action="planen"]');
const original=(await read()).aktuellerPlan;
await click('[data-action="wish"]'); await page.locator('#sheet-search').fill('Lasagne');
await click('[data-action="selectwish"]'); await click('[data-day="B"]'); await click('[data-action="applywish"]');
await page.waitForFunction(()=>!document.querySelector('#sheet'));
let pinned=(await read()).aktuellerPlan; assert.equal(pinned.wunsch.slot,'B');
await click('[data-action="neuplanen"]'); assert.deepEqual((await read()).aktuellerPlan.slots.B,pinned.slots.B);
await click('main [data-action="undo"]'); assert.deepEqual((await read()).aktuellerPlan,pinned);
assert.equal(await page.locator('#status').textContent(),'Vorheriger Plan wiederhergestellt');
// Wish dismisses without changing shared state, Escape and browser Back.
await click('[data-action="wish"]'); await click('[data-day="A"]'); await page.keyboard.press('Escape'); await page.waitForTimeout(80);
assert.deepEqual((await read()).aktuellerPlan,pinned);
await click('[data-action="wish"]'); await page.goBack(); await page.waitForTimeout(80); assert.equal(await page.locator('dialog').count(),0);
// Replacement filter semantics and keyboard containment.
await click('[data-action="menu"][data-slot="A"]'); await click('[data-action="aendern"]');
await page.locator('#sheet-search').fill('no-result-xyz'); assert.equal(await page.locator('[data-action="waehle"]').count(),0);
await click('[data-action="resetfilter"]'); await click('[data-filter="favoriten"]'); await click('[data-filter="neu"]');
assert.equal(await page.locator('[data-filter="favoriten"]').getAttribute('aria-pressed'),'false');
for(let i=0;i<20;i++) await page.keyboard.press('Tab');
assert.ok(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));
await close();
// A partner's plan update cancels move and invalidates undo, retaining link input.
const partner=await ctx.newPage(); await partner.goto(base); await partner.locator('.card').first().waitFor();
await click('[data-action="neuplanen"]'); assert.equal(await page.locator('main [data-action="undo"]').count(),1);
await click('[data-action="menu"][data-slot="A"]'); await click('#sheet [data-action="move"]');
await partner.locator('[data-action="neuplanen"]').click();
await page.waitForFunction(()=>!document.querySelector('dialog')); assert.equal(await page.locator('main [data-action="undo"]').count(),0);
await click('[data-tab="rezepte"]'); await page.locator('#link-titel').fill('Mein Entwurf'); await page.locator('#link-url').fill('https://example.org/rezept');
await page.locator('#link-titel').focus(); await page.locator('#link-titel').evaluate(el=>el.setSelectionRange(3,7));
await partner.locator('[data-action="neuplanen"]').click(); await page.waitForTimeout(150);
assert.equal(await page.locator('#link-titel').inputValue(),'Mein Entwurf');
assert.equal(await page.evaluate(()=>document.activeElement.id),'link-titel');
assert.equal(await page.locator('#link-titel').evaluate(el=>el.selectionStart),3);
// Write failure is persistent, retry commits against latest state.
await page.evaluate(()=>window.failWrites=true); await page.locator('#link-form button').click();
await page.getByText('Nicht gespeichert',{exact:true}).waitFor(); await shot('save-error');
await page.evaluate(()=>window.failWrites=false); await click('[data-action="retry"]');
assert.ok((await read()).links.some(l=>l.titel==='Mein Entwurf'));
// Shopping tab controls active list; pantry starts collapsed and row reveals source.
await click('[data-tab="einkauf"]'); await click('[data-day="donnerstag"]');
assert.equal(await page.locator('[data-action="kopieren"]').getAttribute('data-liste'),'donnerstag');
await click('[data-day="samstag"]');
if(await page.locator('.pantry').count()) assert.equal(await page.locator('.pantry').getAttribute('open'),null);
await page.locator('.posten summary').first().click(); assert.equal(await page.locator('.posten details[open]').count(),1);
// Clipboard fallback offers usable selectable text.
await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied')}},configurable:true}); document.execCommand=()=>false;});
await click('[data-action="kopieren"]'); assert.ok((await page.locator('textarea').inputValue()).length>10); await close();
// Releasing a wish changes only the constraint; Tag egal assigns once.
await click('[data-tab="woche"]'); let releaseBefore=(await read()).aktuellerPlan;
await click('[data-action="wish"]'); await click('[data-action="releasewish"]');
assert.deepEqual((await read()).aktuellerPlan.slots,releaseBefore.slots); assert.equal((await read()).aktuellerPlan.wunsch,undefined);
await click('[data-action="wish"]'); await page.locator('#sheet-search').fill('Lasagne'); await click('[data-action="selectwish"]');
await click('[data-action="wishday"][data-day=""]'); await click('[data-action="applywish"]');
const assigned=(await read()).aktuellerPlan.wunsch;await click('[data-action="neuplanen"]');assert.deepEqual((await read()).aktuellerPlan.wunsch,assigned);
// Pinned replacement routes to the wish dialog; closing restores the trigger.
await click(`[data-action="menu"][data-slot="${assigned.slot}"]`);await click('#sheet [data-action="aendern"]');assert.equal(await page.locator('#sheet-title').textContent(),'Wunschgericht');await close();
assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'menu');
// All requested widths, both themes and desktop. Capture each touched screen/sheet.
for(const width of [360,393,412,1920]) for(const theme of ['light','dark']) {
 await page.setViewportSize({width,height:width===1920?1080:852}); await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
 for(const tab of ['woche','einkauf','rezepte']) {
  await click(`[data-tab="${tab}"]`); await page.evaluate(()=>scrollTo(0,0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${tab} overflow`);
  const small=await page.locator('button,a.btn,input,summary').evaluateAll(els=>els.filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.width<47.9||r.height<47.9}).map(el=>el.outerHTML));
  assert.deepEqual(small,[],`${width} ${tab} undersized targets`);
  if(tab==='einkauf') {
   const bulk=page.getByRole('link',{name:'Alles zu Bring hinzufügen',exact:true});
   assert.equal(await bulk.count(),1);
   assert.equal(new URL(await bulk.getAttribute('href')).hostname,'api.getbring.com');
   const columns=await page.locator('.posten:not(.vorrat) summary').evaluateAll(els=>els.filter(el=>el.getClientRects().length).map(el=>[el.querySelector('.amount').getBoundingClientRect().left,el.querySelector('.unit').getBoundingClientRect().left]));
   if(columns.length) for(const row of columns) assert.deepEqual(row,columns[0],`${width} aligned quantity and unit columns`);
  }
  await shot(`${width}-${theme}-${tab}`);
 }
 await click('[data-tab="woche"]'); await click('[data-action="wish"]'); await page.locator('#sheet-search').fill('Lasagne'); await shot(`${width}-${theme}-wish`); await close();
 await click(`[data-action="menu"][data-slot="${assigned.slot==='A'?'C':'A'}"]`); await click('[data-action="aendern"]'); await shot(`${width}-${theme}-replace`); await close();
}
await page.setViewportSize({width:360,height:852}); await page.addStyleTag({content:'html { font-size:200%; }'});
for(const tab of ['woche','einkauf','rezepte']) { await click(`[data-tab="${tab}"]`); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`200% ${tab}`); await shot(`200-percent-${tab}`); }
// Keyboard-sized viewport keeps modal close/apply reachable by scrolling.
await click('[data-tab="woche"]'); await click('[data-action="wish"]');
await page.setViewportSize({width:360,height:400});
await page.locator('[data-action="applywish"]').scrollIntoViewIfNeeded();
const applyBox=await page.locator('[data-action="applywish"]').boundingBox();assert.ok(applyBox.y>=0 && applyBox.y+applyBox.height<=401);
await close();
// Standalone recipe views share the palette and have a working return link.
for(const theme of ['light','dark']) {
 await page.emulateMedia({colorScheme:theme});await page.setViewportSize({width:393,height:852});await page.goto(`${base}/rezepte/lasagne.html`);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),theme==='dark'?'rgb(18, 18, 20)':'rgb(245, 246, 247)');
 await shot(`recipe-${theme}`);await page.locator('.kopf a').click();await page.locator('.nav').waitFor();
}
assert.deepEqual(errors,[]);
await writeFile(`${output}/report.json`,JSON.stringify({status:'PASS',screenshots:report,consoleErrors:errors},null,2));
console.log(`PASS: wish, replan, undo, modal, filters, two-page synchronization, drafts, retry, shopping, clipboard; ${report.length} screenshots`);
await browser.close();
