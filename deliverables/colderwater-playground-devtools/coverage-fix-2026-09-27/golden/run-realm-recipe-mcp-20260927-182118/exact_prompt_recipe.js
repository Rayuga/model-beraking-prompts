async (page) => {
  const context = page.context();
  const state = context.__cwAuthoredRealmProbe ||= {ids: new WeakMap(), next: 1};
  const facts = [];
  for (const frame of page.frames()) {
    if (!state.ids.has(frame)) state.ids.set(frame, state.next++);
    try {
      const visible = await frame.locator('#dispatch-mark').isVisible();
      const authored = await frame.evaluate(() => ({
        assigned: typeof globalThis.oldGlobal === 'string' && globalThis.oldGlobal === 'do-not-carry',
        absent: typeof globalThis.oldGlobal === 'undefined',
        marker: document.getElementById('dispatch-mark')?.textContent ?? null
      }));
      facts.push({realm: state.ids.get(frame), visible, ...authored});
    } catch { facts.push({realm: state.ids.get(frame), unavailable: true}); }
  }
  return facts;
}