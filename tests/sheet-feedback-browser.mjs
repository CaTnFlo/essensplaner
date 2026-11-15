import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const context=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
await context.addInitScript(()=>localStorage.setItem('essensplaner-lokal','1'));
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.TEST_URL||'http://127.0.0.1:8876');await page.locator('[data-action="planen"]').click();await page.waitForFunction(()=>!document.querySelector('#save-status').textContent.includes('Wird gespeichert'));
const read=()=>page.evaluate(()=>localStorage.getItem('essensplaner-state'));
const before=await read();
const open=async()=>{await page.locator('[data-action="menu"][data-slot="A"]').tap();await page.locator('dialog[open]').waitFor();};
const waitClose=async()=>{await page.waitForFunction(()=>!document.querySelector('dialog'));await page.waitForTimeout(100);};
await open();
assert.equal(await page.locator('.sheet-actions').count(),2);
assert.ok(await page.locator('.sheet-actions button svg').count()>=3);
assert.equal(await page.locator('.day-badge').count(),3);
assert.equal(await page.getByRole('button',{name:'Schließen',exact:true}).evaluate(el=>getComputedStyle(el).webkitTapHighlightColor),'rgba(0, 0, 0, 0)');
await page.screenshot({path:'/tmp/meal-menu-light.png'});
// Backdrop dismisses without changing the plan.
let r=await page.locator('dialog').boundingBox();assert.ok(r.y>0);await page.touchscreen.tap(20,r.y/2);await waitClose();assert.equal(await read(),before);
// Repeated touch opening does not leave focus styling on close.
await open();await page.getByRole('button',{name:'Schließen',exact:true}).tap();await waitClose();await open();
assert.equal(await page.getByRole('button',{name:'Schließen',exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle),'none');
// Keyboard remains visibly focused and contained.
await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));
assert.notEqual(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none');await page.keyboard.press('Escape');await waitClose();
// Downward swipe on grip via actual touch pointer input.
await open();const grip=await page.locator('.sheet-grip').boundingBox();const cdp=await context.newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:grip.y+24}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y:grip.y+130}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await waitClose();assert.equal(await read(),before);
// Short swipe snaps back, no accidental click-dismiss.
await open();r=await page.locator('.sheet-grip').boundingBox();
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:r.y+24}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y:r.y+54}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
assert.equal(await page.locator('dialog[open]').count(),1);assert.equal(await page.locator('dialog').evaluate(el=>el.style.transform),'');
await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'/tmp/meal-menu-dark.png'});await page.keyboard.press('Escape');await waitClose();
// Draft discarded on backdrop dismissal; content scroll is not sheet dragging.
await page.locator('[data-action="wish"]').tap();await page.locator('#sheet-search').fill('lasagne');
const body=page.locator('.sheet-body');await body.evaluate(el=>el.scrollTop=200);assert.equal(await page.locator('dialog').evaluate(el=>el.style.transform),'');
r=await page.locator('dialog').boundingBox();await page.touchscreen.tap(10,Math.max(2,r.y/2));await waitClose();assert.equal(await read(),before);
assert.deepEqual(errors,[]);console.log('PASS: day badges, grouped icons, touch focus, keyboard focus, backdrop, swipe and short-swipe cancellation');await browser.close();
