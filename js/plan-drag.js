// Only handles consume touch gestures. Cards retain native page scrolling.
export function installPlanDrag({ root, revision, move, announce }) {
  let drag = null, timer, frame, suppressClickUntil = 0;
  const cleanup = () => {
    if (drag?.active) suppressClickUntil = Date.now() + 500;
    clearTimeout(timer); cancelAnimationFrame(frame);
    document.querySelector('.drag-copy')?.remove();
    root.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    drag = null;
  };
  const cancel = () => { if (drag?.active) announce('Verschieben abgebrochen.'); cleanup(); };
  const tick = () => {
    if (!drag?.active) return;
    if (revision() !== drag.revision) { announce('Der Plan wurde inzwischen geändert.'); cleanup(); return; }
    const delta = drag.y < 100 ? -9 : drag.y > innerHeight - 150 ? 9 : 0;
    if (delta) window.scrollBy(0, delta);
    root.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    const target = document.elementFromPoint(drag.x, drag.y)?.closest('[data-plan-slot]');
    drag.to = target?.dataset.planSlot; target?.classList.add('drop-target');
    frame = requestAnimationFrame(tick);
  };
  root.addEventListener('click', e => {
    if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  root.addEventListener('pointerdown', e => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || e.button !== 0) return;
    cleanup();
    drag = { id: e.pointerId, from: handle.dataset.drag, x: e.clientX, y: e.clientY, revision: revision(), handle };
    handle.setPointerCapture(e.pointerId);
    timer = setTimeout(() => {
      if (!drag) return;
      drag.active = true;
      const copy = handle.closest('[data-plan-slot]').cloneNode(true);
      copy.classList.add('drag-copy'); copy.setAttribute('aria-hidden', 'true'); copy.inert = true;
      copy.style.width = `${handle.closest('[data-plan-slot]').getBoundingClientRect().width}px`;
      copy.style.left = '0'; copy.style.top = '0';
      copy.style.transform = `translate(${drag.x - 120}px, ${drag.y - 30}px)`;
      document.body.append(copy); drag.copy = copy; tick();
    }, 300);
  });
  root.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) return cleanup();
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active) return;
    e.preventDefault();
    drag.copy.style.transform = `translate(${drag.x - 120}px, ${drag.y - 30}px)`;
    root.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-plan-slot]');
    drag.to = target?.dataset.planSlot;
    target?.classList.add('drop-target');
  });
  root.addEventListener('pointerup', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const current = drag; cleanup();
    if (current.active && current.to && current.to !== current.from && current.revision === revision()) move(current.from, current.to);
  });
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('lostpointercapture', cancel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cancel(); });
  return cancel;
}
