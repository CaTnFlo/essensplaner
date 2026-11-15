import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const context=await browser.newContext({viewport:{width:393,height:852}});
await context.addInitScript(()=>localStorage.setItem('essensplaner-lokal','1'));
const page=await context.newPage();await page.goto(process.env.TEST_URL||'http://127.0.0.1:8876');
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('essensplaner-state')));
const settle=()=>page.waitForFunction(()=>!document.querySelector('#save-status')?.textContent.includes('Wird gespeichert'));
await page.locator('[data-action="planen"]').click();await settle();
const before=await saved();
const handle=page.locator('#app [data-drag="A"]');await handle.scrollIntoViewIfNeeded();
let box=await handle.boundingBox();await page.mouse.move(box.x+24,box.y+24);await page.mouse.down();await page.waitForTimeout(350);
assert.equal(await page.locator('.drag-copy').count(),1);
let target=await page.locator('[data-plan-slot="B"]').boundingBox();await page.mouse.move(target.x+60,target.y+50);await page.mouse.up();await settle();
const moved=await saved();assert.deepEqual(moved.aktuellerPlan.slots.B,before.aktuellerPlan.slots.A);assert.deepEqual(moved.aktuellerPlan.slots.A,before.aktuellerPlan.slots.B);
assert.equal(await page.locator('dialog').count(),0);
// Escape and pointer cancellation never save, and do not open the click fallback.
await page.waitForTimeout(550);await page.locator('#app [data-drag="A"]').scrollIntoViewIfNeeded();box=await page.locator('#app [data-drag="A"]').boundingBox();
await page.mouse.move(box.x+24,box.y+24);await page.mouse.down();await page.waitForTimeout(350);await page.keyboard.press('Escape');await page.mouse.up();
assert.deepEqual(await saved(),moved);assert.equal(await page.locator('dialog').count(),0);
await page.waitForTimeout(550);await page.mouse.down();await page.waitForTimeout(350);
await page.locator('#app [data-drag="A"]').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();assert.deepEqual(await saved(),moved);
// Edge scrolling is active while held; outside release changes nothing.
await page.waitForTimeout(550);await page.locator('#app [data-drag="A"]').scrollIntoViewIfNeeded();box=await page.locator('#app [data-drag="A"]').boundingBox();
await page.mouse.move(box.x+24,box.y+24);await page.mouse.down();await page.waitForTimeout(350);await page.mouse.move(2,810);const y=await page.evaluate(()=>scrollY);await page.waitForTimeout(250);
assert.ok(await page.evaluate(()=>scrollY)>y);await page.mouse.up();assert.deepEqual(await saved(),moved);
// Keyboard fallback calls the same swap and focuses the moved dish.
await page.waitForTimeout(550);await page.locator('#app [data-drag="A"]').focus();await page.keyboard.press('Enter');
await page.locator('[data-action="destination"][data-slot="C"]').click();await settle();
assert.deepEqual((await saved()).aktuellerPlan.slots.C,moved.aktuellerPlan.slots.A);
assert.equal(await page.evaluate(()=>document.activeElement.dataset.slot),'C');
console.log('PASS: long press, swap, Escape, pointercancel, edge scroll, outside release, keyboard move and focus');await browser.close();
