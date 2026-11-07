'use strict';
// Split renderer: draws the state the main process pushes every 100 ms.

(() => {
  const api = window.split;
  const $ = (id) => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  let state = null;

  if (!api) {
    document.body.textContent = 'Split must be opened as the desktop app.';
    return;
  }

  // ---------- views ----------
  function route() {
    const view = location.hash === '#settings' ? 'settings' : 'live';
    $('view-live').hidden = view !== 'live';
    $('view-settings').hidden = view !== 'settings';
    $('live-actions').hidden = view !== 'live';
    $('page-title').textContent = view === 'live' ? 'Live' : 'Settings';
    document.title = view === 'live' ? 'Split' : 'Split · Settings';
    if (state) setText('finding', subline(state));
    document.querySelectorAll('.rail-item').forEach((a) => {
      if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', route);
  route();

  // ---------- helpers ----------
  function duration(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    const two = (v) => String(v).padStart(2, '0');
    return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
  }
  function ago(ms) {
    if (ms < 1000) return `${(ms / 1000).toFixed(1)} s ago`;
    if (ms < 60000) return `${Math.round(ms / 1000)} s ago`;
    return `${Math.round(ms / 60000)} min ago`;
  }
  function setText(id, text) { const el = $(id); if (el.textContent !== text) el.textContent = text; }
  function fill(id, value) {
    const el = $(id);
    if (document.activeElement === el) return;
    if (el.type === 'checkbox') el.checked = !!value; else if (el.value !== String(value)) el.value = value;
  }

  // ---------- the sentence under the title ----------
  function finding(s) {
    const set = s.settings, run = s.run, t = s.target;
    if (s.nativeError) return s.nativeError;
    if (!s.permission) return 'Waiting for Accessibility permission before Split can click.';
    if (!t) return `Roblox isn't running. Start it on your second monitor and Split finds it.`;
    const where = t.display ? `display ${t.display.index}` : 'its window';
    const what = set.action === 'key' ? `pressing ${set.key.toUpperCase()} in Roblox` : 'clicking Roblox';
    if (!run.running) return `Stopped. Press Start or ${set.toggleKey} to begin ${what} on ${where}.`;
    if (run.lastError) return `Last try failed: ${run.lastError}.`;
    if (set.mode === 'bounce') {
      const held = run.held === 1 ? '1 click' : `${fmt(run.held)} clicks`;
      return s.pad.connected && set.padGate
        ? `${cap(what)} every ${fmt(set.intervalMs)} ms on ${where}. ${held} held back while your pad was busy.`
        : `${cap(what)} every ${fmt(set.intervalMs)} ms on ${where}, handing focus back after each one.`;
    }
    return `${cap(what)} every ${fmt(set.intervalMs)} ms on ${where} without touching focus.`;
  }
  function subline(s) {
    return location.hash === '#settings' ? 'Every change saves itself.' : finding(s);
  }
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);

  // ---------- lanes ----------
  function lane(svg, draw) {
    const w = Math.max(1, Math.round(svg.getBoundingClientRect().width));
    const h = 44;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    while (svg.firstChild) svg.firstChild.remove();
    for (let i = 1; i < 4; i++) {
      const g = document.createElementNS(SVGNS, 'line');
      const x = Math.round((w * i) / 4) + 0.5;
      g.setAttribute('x1', x); g.setAttribute('x2', x); g.setAttribute('y1', 0); g.setAttribute('y2', h);
      g.setAttribute('stroke', '#222224'); g.setAttribute('stroke-width', 1);
      svg.appendChild(g);
    }
    draw(w, h, (tag, attrs) => {
      const el = document.createElementNS(SVGNS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      svg.appendChild(el);
    });
  }

  function drawLanes(s) {
    const { now, windowMs, events, pad } = s.lanes;
    const start = now - windowMs;
    const xOf = (t, w) => ((t - start) / windowMs) * w;

    lane($('lane-pad'), (w, h, add) => {
      for (const p of pad) {
        const x1 = Math.max(0, xOf(p.from, w)), x2 = Math.min(w, xOf(p.to, w));
        add('rect', { x: x1, y: 12, width: Math.max(2, x2 - x1), height: h - 24, fill: '#6c6d73', rx: 1 });
      }
    });
    lane($('lane-clicks'), (w, h, add) => {
      for (const e of events) {
        const x = Math.round(xOf(e.t, w)) + 0.5;
        if (e.kind === 'held') add('circle', { cx: x, cy: 7, r: 3, fill: 'none', stroke: '#8a8c92', 'stroke-width': 1.5 });
        else add('line', { x1: x, x2: x, y1: 15, y2: h - 7, stroke: e.kind === 'fail' ? '#e5566f' : '#4a8ad6', 'stroke-width': 2 });
      }
    });
  }

  // ---------- render ----------
  function render(s) {
    state = s;
    const set = s.settings, run = s.run, t = s.target;

    setText('finding', subline(s));
    $('notice-permission').hidden = s.permission;
    $('notice-native').hidden = !s.nativeError;
    setText('native-error', s.nativeError || '');

    const runBtn = $('btn-run');
    runBtn.setAttribute('aria-pressed', String(run.running));
    setText('run-label', run.running ? 'Stop' : 'Start');
    setText('run-key', set.toggleKey);
    setText('pick-key', set.pickKey);

    setText('k-sent', fmt(run.sent));
    setText('k-held', fmt(run.held));
    setText('k-failed', fmt(run.failed));
    setText('k-uptime', run.running ? duration(run.uptimeMs) : '0:00');

    // lane labels
    let padText = 'Not connected';
    if (!s.pad.supported) padText = s.platform === 'darwin' ? 'Not read on macOS' : 'XInput not available';
    else if (s.pad.connected) padText = s.pad.active ? 'Active now' : (s.pad.idleMs == null ? 'Connected, idle' : `Quiet for ${(s.pad.idleMs / 1000).toFixed(1)} s`);
    setText('pad-status', padText);
    const sinceClick = run.lastClickAt ? s.lanes.now - run.lastClickAt : null;
    setText('click-status', run.lastError ? 'Last try failed' : sinceClick == null ? 'No clicks yet' : `Last ${ago(sinceClick)}`);
    drawLanes(s);

    // target
    const pill = $('target-pill');
    if (t && !t.minimized) { pill.textContent = 'Found'; pill.dataset.tone = 'positive'; }
    else if (t) { pill.textContent = 'Minimised'; pill.dataset.tone = 'warning'; }
    else { pill.textContent = 'Not found'; pill.dataset.tone = 'negative'; }
    setText('t-title', t ? t.title || '—' : '—');
    setText('t-display', t && t.display ? `${t.display.index} of ${t.display.count}${t.display.primary ? ', main' : ''}` : '—');
    setText('t-size', t && t.width ? `${fmt(t.width)} × ${fmt(t.height)}` : '—');
    setText('t-proc', t ? t.exe : '—');

    const win = $('preview-win'), dot = $('preview-dot');
    $('preview-empty').hidden = !!(t && t.width);
    win.hidden = !(t && t.width);
    if (t && t.width) {
      win.style.aspectRatio = `${t.width} / ${t.height}`;
      const px = (set.x / t.width) * 100, py = (set.y / t.height) * 100;
      dot.style.left = `${Math.min(100, px)}%`;
      dot.style.top = `${Math.min(100, py)}%`;
      dot.classList.toggle('is-out', set.x >= t.width || set.y >= t.height);
    }

    const pick = s.pick || {};
    const pickBtn = $('btn-pick');
    pickBtn.disabled = pick.secondsLeft > 0;
    setText('btn-pick', pick.secondsLeft > 0 ? `Move to Roblox… ${pick.secondsLeft}` : 'Pick in 3 s');
    const pickFailed = !!(pick.last && !pick.last.ok);
    $('pick-hint').hidden = pickFailed;
    $('pick-error').hidden = !pickFailed;
    if (pickFailed) setText('pick-error', `${pick.last.reason}. Hover the spot in Roblox and press ${set.pickKey}.`);

    // mode
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === set.mode)));
    const away = set.settleMs + set.holdMs + 30;
    setText('mode-desc', set.mode === 'bounce'
      ? `Brings Roblox forward for a moment, clicks for real, then hands focus back to your game. Works for every kind of click; your game is out of focus for about ${fmt(away)} ms each time.`
      : 'Sends Roblox the messages a real click makes, straight to its window. Your game keeps focus and your mouse stays put. Roblox may ignore some clicks into the 3D world this way.');
    $('sw-bounce').hidden = set.mode !== 'bounce';
    $('sw-background').hidden = set.mode !== 'background';
    $('f-key').hidden = set.action !== 'key';

    const gate = $('in-gate');
    gate.disabled = !s.pad.supported;
    let gateDesc = "Holds a click while you're pressing buttons or moving a stick.";
    if (!s.pad.supported) gateDesc = s.platform === 'darwin' ? "macOS can't read a pad in the background, so this stays off." : 'XInput is missing on this PC.';
    else if (!s.pad.connected) gateDesc = 'No pad connected. Clicks go out on time until one is.';
    setText('gate-desc', gateDesc);
    $('gate-fields').hidden = !set.padGate || !s.pad.supported;

    fill('in-x', set.x); fill('in-y', set.y);
    fill('in-action', set.action); fill('in-key', set.key);
    fill('in-interval', set.intervalMs); fill('in-hold', set.holdMs);
    fill('in-gate', set.padGate && s.pad.supported); fill('in-idle', set.padIdleMs); fill('in-maxwait', set.padMaxWaitMs);
    fill('in-strict', set.strictOrder);
    fill('in-togglekey', set.toggleKey); fill('in-pickkey', set.pickKey);
    fill('in-exe', set.exe); fill('in-class', set.windowClass);
    fill('in-settle', set.settleMs); fill('in-restore', set.restoreCursor); fill('in-ontop', set.alwaysOnTop);
    $('f-class').hidden = s.platform === 'darwin';

    const hk = $('hotkey-error');
    hk.hidden = !s.hotkeyError;
    setText('hotkey-error', s.hotkeyError || '');
  }

  // ---------- inputs ----------
  let savedTimer = 0;
  async function save(patch) {
    render(await api.update(patch));
    setText('saved', 'Saved');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => setText('saved', ''), 1500);
  }
  const bind = (id, key, read = (el) => el.value) => {
    $(id).addEventListener('change', (e) => save({ [key]: read(e.target) }));
  };
  const num = (el) => Number(el.value);
  const bool = (el) => el.checked;
  bind('in-x', 'x', num); bind('in-y', 'y', num);
  bind('in-action', 'action'); bind('in-key', 'key');
  bind('in-interval', 'intervalMs', num); bind('in-hold', 'holdMs', num);
  bind('in-gate', 'padGate', bool); bind('in-idle', 'padIdleMs', num); bind('in-maxwait', 'padMaxWaitMs', num);
  bind('in-strict', 'strictOrder', bool);
  bind('in-togglekey', 'toggleKey'); bind('in-pickkey', 'pickKey');
  bind('in-exe', 'exe'); bind('in-class', 'windowClass');
  bind('in-settle', 'settleMs', num); bind('in-restore', 'restoreCursor', bool); bind('in-ontop', 'alwaysOnTop', bool);

  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => save({ mode: b.dataset.mode })));
  $('btn-run').addEventListener('click', async () => render(await api.toggle()));
  $('btn-test').addEventListener('click', async () => render(await api.test()));
  $('btn-pick').addEventListener('click', async () => render(await api.pick()));
  $('btn-permission').addEventListener('click', async () => render(await api.askPermission()));

  window.addEventListener('resize', () => state && drawLanes(state));
  api.onState(render);
  api.getState().then(render);
})();
