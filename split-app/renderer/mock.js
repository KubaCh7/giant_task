'use strict';
// Browser-only demo of the main process, used to preview and inspect the UI
// outside Electron. Loaded in the app too, but does nothing there (window.split
// already exists) or without ?demo in the URL.
(() => {
  if (window.split || !/[?&]demo/.test(location.search)) return;
  const empty = /demo=empty/.test(location.search);

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const settings = {
    mode: 'bounce', action: 'click', key: 'e', x: 1184, y: 642, intervalMs: 500, holdMs: 35, strictOrder: false,
    settleMs: 40, restoreCursor: true, padGate: true, padIdleMs: 400, padMaxWaitMs: 3000,
    toggleKey: 'F8', pickKey: 'F9', exe: 'RobloxPlayerBeta.exe', windowClass: 'WINDOWSCLIENT', alwaysOnTop: false
  };
  const target = empty ? null : {
    id: 3346, pid: 18244, exe: 'RobloxPlayerBeta.exe', title: 'Roblox', minimized: false,
    width: 1920, height: 1080, screenX: 2560, screenY: 0, display: { index: 2, count: 2, primary: false }
  };

  // Simulate the click loop and the pad for the session so every count comes from the events.
  const t0 = Date.now() - 252000;
  const run = { running: !empty, startedAt: t0, sent: 0, held: 0, failed: 0, lastClickAt: 0, lastError: '', warning: '' };
  const events = [];
  const pads = [];
  let simT = t0, nextPad = t0 + 900, padUntil = 0, lastPadActive = 0;

  function padActiveAt(t) { return pads.some((p) => p.from <= t && t <= p.to); }
  function step(until) {
    while (simT < until) {
      while (nextPad < simT + 200) {               // bursts of pad input, like a fight or a run
        const len = 300 + rand() * 2200;
        pads.push({ from: nextPad, to: nextPad + len });
        nextPad += len + 1500 + rand() * 6000;
      }
      let t = simT;
      if (padActiveAt(t) || t - lastPadEnd(t) < settings.padIdleMs) {
        run.held++; events.push({ t, kind: 'held' });
        const start = t;
        while ((padActiveAt(t) || t - lastPadEnd(t) < settings.padIdleMs) && t - start < settings.padMaxWaitMs) t += 20;
      }
      run.sent++; run.lastClickAt = t; events.push({ t, kind: 'click' });
      simT = Math.max(t, simT + settings.intervalMs);
    }
  }
  function lastPadEnd(t) { let e = 0; for (const p of pads) if (p.to <= t && p.to > e) e = p.to; return e; }

  function snapshot() {
    const now = Date.now();
    if (run.running && target) step(now);
    const cut = now - 60000;
    const active = padActiveAt(now);
    if (active) lastPadActive = now;
    const end = lastPadEnd(now);
    return {
      platform: 'win32', nativeError: '', permission: true, hotkeyError: '', update: { ...update },
      settings: { ...settings },
      run: { ...run, uptimeMs: run.running ? now - run.startedAt : 0 },
      target,
      pad: { supported: true, connected: true, active, idleMs: active ? 0 : (end ? now - end : null) },
      pick: { secondsLeft: 0, last: null },
      lanes: {
        now, windowMs: 60000,
        events: events.filter((e) => e.t >= cut && e.t <= now),
        pad: pads.filter((p) => p.to >= cut && p.from <= now).map((p) => ({ from: p.from, to: Math.min(p.to, now) }))
      }
    };
  }

  const update = { state: /update=available/.test(location.search) ? 'available' : 'idle', message: 'A newer build of Split is out.', url: '' };
  const listeners = [];
  setInterval(() => { const s = snapshot(); listeners.forEach((fn) => fn(s)); }, 100);
  window.split = {
    getState: async () => snapshot(),
    update: async (patch) => { Object.assign(settings, patch); return snapshot(); },
    toggle: async () => { run.running = !run.running; return snapshot(); },
    test: async () => snapshot(),
    pick: async () => snapshot(),
    askPermission: async () => snapshot(),
    checkUpdate: async () => { Object.assign(update, { state: 'current', message: 'You have the latest build.' }); return snapshot(); },
    openUpdate: async () => snapshot(),
    onState: (fn) => { listeners.push(fn); return () => {}; }
  };
})();
