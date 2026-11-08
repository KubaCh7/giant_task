'use strict';
// macOS input layer. CoreGraphics events through koffi, window info through
// System Events (osascript). Needs Accessibility permission for Split.

const koffi = require('koffi');
const { execFile } = require('child_process');

const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
const cf = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');

const CGPoint = koffi.struct('SPLIT_CGPoint', { x: 'double', y: 'double' });
const CGEventCreateMouseEvent = cg.func('void *CGEventCreateMouseEvent(void *source, uint32_t type, SPLIT_CGPoint pos, uint32_t button)');
const CGEventCreateKeyboardEvent = cg.func('void *CGEventCreateKeyboardEvent(void *source, uint16_t key, bool down)');
const CGEventPostToPid = cg.func('void CGEventPostToPid(int32_t pid, void *event)');
const CGEventPost = cg.func('void CGEventPost(uint32_t tap, void *event)');
const CGEventCreate = cg.func('void *CGEventCreate(void *source)');
const CGEventGetLocation = cg.func('SPLIT_CGPoint CGEventGetLocation(void *event)');
const CGWarpMouseCursorPosition = cg.func('int32_t CGWarpMouseCursorPosition(SPLIT_CGPoint p)');
const CFRelease = cf.func('void CFRelease(void *ref)');

const kCGHIDEventTap = 0;
const kCGEventLeftMouseDown = 1, kCGEventLeftMouseUp = 2, kCGEventMouseMoved = 5;
const kCGMouseButtonLeft = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args, timeout = 1500) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout }, (err, out) => resolve(err ? '' : String(out).trim()));
  });
}
const osa = (script) => run('osascript', ['-e', script]);

let cache = null; // last bounds lookup, osascript is slow so it is refreshed by the main loop only

async function findTarget({ exe }) {
  const name = String(exe || 'RobloxPlayer').replace(/\.exe$/i, '').replace(/Beta$/, '');
  const pid = Number((await run('pgrep', ['-x', name])).split('\n')[0]);
  if (!pid) { cache = null; return null; }
  const out = await osa(`tell application "System Events" to tell (first process whose unix id is ${pid}) to get {position, size, name} of window 1`);
  const parts = out.split(',').map((s) => s.trim());
  if (parts.length < 4) {
    cache = { id: pid, pid, exe: name, title: name, minimized: true, width: 0, height: 0, screenX: 0, screenY: 0 };
    return cache;
  }
  const [x, y, w, h] = parts.slice(0, 4).map(Number);
  cache = { id: pid, pid, exe: name, title: parts.slice(4).join(', ') || name, minimized: false, width: w, height: h, screenX: x, screenY: y };
  return cache;
}

function isAlive(target) { return !!target && !!cache && cache.pid === target.pid; }

function cursor() {
  const ev = CGEventCreate(null);
  const p = CGEventGetLocation(ev);
  CFRelease(ev);
  return p;
}

function cursorInTarget(target) {
  const p = cursor();
  return { x: Math.round(p.x - target.screenX), y: Math.round(p.y - target.screenY), screenX: p.x, screenY: p.y };
}

function post(pid, ev) {
  if (pid) CGEventPostToPid(pid, ev); else CGEventPost(kCGHIDEventTap, ev);
  CFRelease(ev);
}

async function clickAt(pid, pos, holdMs) {
  post(pid, CGEventCreateMouseEvent(null, kCGEventMouseMoved, pos, kCGMouseButtonLeft));
  await sleep(17);
  post(pid, CGEventCreateMouseEvent(null, kCGEventLeftMouseDown, pos, kCGMouseButtonLeft));
  await sleep(holdMs);
  post(pid, CGEventCreateMouseEvent(null, kCGEventLeftMouseUp, pos, kCGMouseButtonLeft));
}

async function keyAt(pid, code, holdMs) {
  post(pid, CGEventCreateKeyboardEvent(null, code, true));
  await sleep(holdMs);
  post(pid, CGEventCreateKeyboardEvent(null, code, false));
}

// Background: events addressed to the Roblox process only. Best effort on macOS.
async function backgroundClick(target, { x, y, holdMs }) {
  await clickAt(target.pid, { x: target.screenX + x, y: target.screenY + y }, holdMs);
}
async function backgroundKey(target, { vk, holdMs }) {
  await keyAt(target.pid, vk, holdMs);
}

// Bounce: bring Roblox forward, real click, give the previous app focus back.
async function bounce(target, { x, y, holdMs, settleMs, vk, restoreCursor }) {
  const prev = Number(await osa('tell application "System Events" to get unix id of first process whose frontmost is true'));
  const before = cursor();
  await osa(`tell application "System Events" to set frontmost of (first process whose unix id is ${target.pid}) to true`);
  await sleep(settleMs);
  if (vk != null) await keyAt(0, vk, holdMs);
  else await clickAt(0, { x: target.screenX + x, y: target.screenY + y }, holdMs);
  await sleep(12);
  if (restoreCursor && vk == null) CGWarpMouseCursorPosition(before); // back before the game regains focus
  if (prev && prev !== target.pid) {
    await osa(`tell application "System Events" to set frontmost of (first process whose unix id is ${prev}) to true`);
  }
  return { ok: true };
}

// No background pad reading on macOS (no XInput); the gate is Windows-only.
function readPad() { return { supported: false, connected: false, active: false }; }

// macOS virtual key codes (ANSI layout).
const KEYS = {
  a: 0, s: 1, d: 2, f: 3, h: 4, g: 5, z: 6, x: 7, c: 8, v: 9, b: 11, q: 12, w: 13, e: 14, r: 15, y: 16, t: 17,
  1: 18, 2: 19, 3: 20, 4: 21, 6: 22, 5: 23, 9: 25, 7: 26, 8: 28, 0: 29, o: 31, u: 32, i: 34, p: 35, l: 37, j: 38,
  k: 40, n: 45, m: 46, Enter: 36, Tab: 48, Space: 49
};
function keyCode(name) {
  const k = String(name || '').trim();
  const v = KEYS[k.length === 1 ? k.toLowerCase() : k];
  return v === undefined ? null : v;
}

module.exports = {
  platform: 'darwin',
  findTarget, isAlive, cursorInTarget, backgroundClick, backgroundKey, bounce, readPad, keyCode,
  needsPermission: () => true
};
