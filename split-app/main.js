'use strict';
// Split: clicks Roblox on monitor 2 while you play another game on a pad.
// Main process: owns the click loop, the pad gate, hotkeys and the native layer.

const { app, BrowserWindow, ipcMain, globalShortcut, screen, systemPreferences } = require('electron');
const path = require('path');
const Settings = require('./settings');

let native = null;
let nativeError = '';
try {
  if (process.platform === 'win32') native = require('./native/win');
  else if (process.platform === 'darwin') native = require('./native/mac');
  else nativeError = 'Split runs on Windows and macOS only.';
} catch (e) {
  nativeError = `Native layer failed to load: ${e.message}`;
}

const LANE_MS = 60000;   // the lanes strip shows the last minute
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

let win = null;
let settings = null;
let target = null;
let hotkeyError = '';
let pickUntil = 0;
let lastPick = null;

const run = { running: false, startedAt: 0, sent: 0, held: 0, failed: 0, lastClickAt: 0, lastError: '', warning: '' };
const events = [];       // { t, kind: 'click' | 'held' | 'fail' }
const padSegments = [];  // { from, to } spans of pad activity, to = null while still active
let pad = { supported: false, connected: false, active: false };
let lastPadActiveAt = 0;

// ---------- pad ----------
function pollPad() {
  pad = native.readPad();
  const t = now();
  const open = padSegments[padSegments.length - 1];
  if (pad.active) {
    lastPadActiveAt = t;
    if (!open || open.to !== null) padSegments.push({ from: t, to: null });
  } else if (open && open.to === null) {
    open.to = t;
  }
}

function prune() {
  const cut = now() - LANE_MS;
  while (events.length && events[0].t < cut) events.shift();
  while (padSegments.length && padSegments[0].to !== null && padSegments[0].to < cut) padSegments.shift();
}

// ---------- target ----------
async function refreshTarget() {
  if (!native) return;
  try { target = await native.findTarget(settings.get()); } catch (e) { target = null; }
}

function displayOf(t) {
  if (!t || !t.width) return null;
  let p = { x: Math.round(t.screenX + t.width / 2), y: Math.round(t.screenY + t.height / 2) };
  if (process.platform === 'win32') p = screen.screenToDipPoint(p);
  const d = screen.getDisplayNearestPoint(p);
  const all = screen.getAllDisplays();
  return { index: all.findIndex((a) => a.id === d.id) + 1, count: all.length, primary: d.id === screen.getPrimaryDisplay().id };
}

function permissionOk() {
  return process.platform !== 'darwin' || systemPreferences.isTrustedAccessibilityClient(false);
}

// ---------- the action ----------
async function act() {
  const s = settings.get();
  if (!native) throw new Error(nativeError);
  if (!permissionOk()) throw new Error('Split needs Accessibility permission');
  if (!target || !native.isAlive(target)) await refreshTarget();
  if (!target) throw new Error('Roblox window not found');
  if (target.minimized) throw new Error('Roblox is minimised, restore its window');

  const vk = s.action === 'key' ? native.keyCode(s.key) : null;
  if (s.action === 'key' && vk == null) throw new Error(`Split doesn't know the key "${s.key}"`);

  if (s.mode === 'background') {
    if (vk != null) await native.backgroundKey(target, { vk, holdMs: s.holdMs });
    else await native.backgroundClick(target, { x: s.x, y: s.y, holdMs: s.holdMs, sync: s.strictOrder });
    return { ok: true };
  }
  return native.bounce(target, { x: s.x, y: s.y, holdMs: s.holdMs, settleMs: s.settleMs, vk, restoreCursor: s.restoreCursor });
}

async function fire() {
  try {
    const r = await act();
    if (r && r.ok === false) throw new Error(r.reason);
    run.warning = (r && r.warning) || '';
    run.sent++;
    run.lastClickAt = now();
    run.lastError = '';
    events.push({ t: run.lastClickAt, kind: 'click' });
  } catch (e) {
    run.failed++;
    run.lastError = e.message;
    events.push({ t: now(), kind: 'fail' });
  }
}

// Waits while the pad is busy so a focus bounce never lands on a pad press.
async function padGate(s) {
  if (s.mode !== 'bounce' || !s.padGate || !pad.connected) return;
  const start = now();
  let counted = false;
  while (run.running && now() - lastPadActiveAt < s.padIdleMs && now() - start < s.padMaxWaitMs) {
    if (!counted) { counted = true; run.held++; events.push({ t: now(), kind: 'held' }); }
    await sleep(20);
  }
}

async function loop() {
  while (run.running) {
    const started = now();
    const s = settings.get();
    await padGate(s);
    if (!run.running) break;
    await fire();
    const until = started + s.intervalMs;
    while (run.running && now() < until) await sleep(Math.min(50, until - now()));
  }
}

function toggle() {
  if (run.running) { run.running = false; return false; }
  Object.assign(run, { running: true, startedAt: now(), sent: 0, held: 0, failed: 0, lastError: '', warning: '' });
  events.length = 0;
  loop();
  return true;
}

// Reads the cursor over Roblox and stores it as the click point.
async function pickNow() {
  pickUntil = 0;
  await refreshTarget();
  if (!target) { lastPick = { ok: false, reason: 'Roblox window not found' }; return lastPick; }
  const c = native.cursorInTarget(target);
  if (c.x < 0 || c.y < 0 || c.x >= target.width || c.y >= target.height) {
    lastPick = { ok: false, reason: 'The cursor was not over the Roblox game area' };
    return lastPick;
  }
  settings.update({ x: c.x, y: c.y });
  lastPick = { ok: true, x: c.x, y: c.y, at: now() };
  return lastPick;
}

// ---------- hotkeys ----------
function registerHotkeys() {
  globalShortcut.unregisterAll();
  const s = settings.get();
  const failed = [];
  for (const [key, fn] of [[s.toggleKey, toggle], [s.pickKey, pickNow]]) {
    try { if (!globalShortcut.register(key, fn)) failed.push(key); } catch (_) { failed.push(key); }
  }
  hotkeyError = failed.length ? `Couldn't register ${failed.join(' and ')}. Another app may own it, or the name is wrong.` : '';
}

// ---------- state for the window ----------
function snapshot() {
  prune();
  const t = now();
  return {
    platform: process.platform,
    nativeError,
    permission: permissionOk(),
    hotkeyError,
    settings: settings.get(),
    run: { ...run, uptimeMs: run.running ? t - run.startedAt : 0 },
    target: target ? { ...target, display: displayOf(target) } : null,
    pad: { ...pad, idleMs: lastPadActiveAt ? t - lastPadActiveAt : null },
    pick: { secondsLeft: pickUntil ? Math.max(0, Math.ceil((pickUntil - t) / 1000)) : 0, last: lastPick },
    lanes: {
      now: t,
      windowMs: LANE_MS,
      events: events.slice(),
      pad: padSegments.map((p) => ({ from: p.from, to: p.to === null ? t : p.to }))
    }
  };
}

function createWindow() {
  const s = settings.get();
  win = new BrowserWindow({
    width: 1180, height: 820, minWidth: 760, minHeight: 560,
    backgroundColor: '#171719',
    title: 'Split',
    autoHideMenuBar: true,
    alwaysOnTop: s.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(async () => {
    settings = Settings.create(app.getPath('userData'));

    ipcMain.handle('state:get', () => snapshot());
    ipcMain.handle('settings:update', (_e, patch) => {
      const before = settings.get();
      const next = settings.update(patch || {});
      if (before.toggleKey !== next.toggleKey || before.pickKey !== next.pickKey) registerHotkeys();
      if (before.exe !== next.exe || before.windowClass !== next.windowClass) refreshTarget();
      if (win && before.alwaysOnTop !== next.alwaysOnTop) win.setAlwaysOnTop(next.alwaysOnTop);
      return snapshot();
    });
    ipcMain.handle('run:toggle', () => { toggle(); return snapshot(); });
    ipcMain.handle('run:test', async () => { await fire(); return snapshot(); });
    ipcMain.handle('target:pick', async () => {
      // A 3 s countdown so you can move the mouse onto Roblox after clicking the button.
      pickUntil = now() + 3000;
      await sleep(3000);
      await pickNow();
      return snapshot();
    });
    ipcMain.handle('mac:permission', () => {
      if (process.platform === 'darwin') systemPreferences.isTrustedAccessibilityClient(true);
      return snapshot();
    });

    if (native) {
      registerHotkeys();
      await refreshTarget();
      setInterval(refreshTarget, process.platform === 'darwin' ? 2000 : 1000);
      if (native.readPad().supported) setInterval(pollPad, 16);
    }
    setInterval(() => { if (win && !win.isDestroyed()) win.webContents.send('state', snapshot()); }, 100);

    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });

  app.on('will-quit', () => { run.running = false; globalShortcut.unregisterAll(); });
  app.on('window-all-closed', () => app.quit());
}
