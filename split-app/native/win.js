'use strict';
// Windows input layer. Talks to user32 / kernel32 / xinput through koffi.
// Nothing here opens, reads or injects into the Roblox process: it only finds
// its window, posts window messages to it, or sends normal OS input.

const koffi = require('koffi');

const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

// HWND / HANDLE as plain integers so they compare and serialise easily.
// Win32 BOOL is a 4-byte int, not a C bool.
koffi.alias('BOOL', 'int');
const POINT = koffi.struct('SPLIT_POINT', { x: 'int32_t', y: 'int32_t' });
const RECT = koffi.struct('SPLIT_RECT', { left: 'int32_t', top: 'int32_t', right: 'int32_t', bottom: 'int32_t' });

const MOUSEINPUT = koffi.struct('SPLIT_MOUSEINPUT', {
  dx: 'int32_t', dy: 'int32_t', mouseData: 'uint32_t', dwFlags: 'uint32_t', time: 'uint32_t', dwExtraInfo: 'uintptr_t'
});
const KEYBDINPUT = koffi.struct('SPLIT_KEYBDINPUT', {
  wVk: 'uint16_t', wScan: 'uint16_t', dwFlags: 'uint32_t', time: 'uint32_t', dwExtraInfo: 'uintptr_t'
});
const HARDWAREINPUT = koffi.struct('SPLIT_HARDWAREINPUT', { uMsg: 'uint32_t', wParamL: 'uint16_t', wParamH: 'uint16_t' });
const INPUT = koffi.struct('SPLIT_INPUT', {
  type: 'uint32_t',
  u: koffi.union({ mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT })
});

const XINPUT_GAMEPAD = koffi.struct('SPLIT_XINPUT_GAMEPAD', {
  wButtons: 'uint16_t', bLeftTrigger: 'uint8_t', bRightTrigger: 'uint8_t',
  sThumbLX: 'int16_t', sThumbLY: 'int16_t', sThumbRX: 'int16_t', sThumbRY: 'int16_t'
});
const XINPUT_STATE = koffi.struct('SPLIT_XINPUT_STATE', { dwPacketNumber: 'uint32_t', Gamepad: XINPUT_GAMEPAD });

const FindWindowExW = user32.func('intptr_t __stdcall FindWindowExW(intptr_t parent, intptr_t after, const char16_t *cls, const char16_t *title)');
const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(intptr_t hwnd, _Out_ uint32_t *pid)');
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(intptr_t hwnd, _Out_ uint8_t *buf, int max)');
const IsWindowVisible = user32.func('BOOL __stdcall IsWindowVisible(intptr_t hwnd)');
const IsIconic = user32.func('BOOL __stdcall IsIconic(intptr_t hwnd)');
const GetClientRect = user32.func('BOOL __stdcall GetClientRect(intptr_t hwnd, _Out_ SPLIT_RECT *rect)');
const ClientToScreen = user32.func('BOOL __stdcall ClientToScreen(intptr_t hwnd, _Inout_ SPLIT_POINT *pt)');
const ScreenToClient = user32.func('BOOL __stdcall ScreenToClient(intptr_t hwnd, _Inout_ SPLIT_POINT *pt)');
const GetCursorPos = user32.func('BOOL __stdcall GetCursorPos(_Out_ SPLIT_POINT *pt)');
const SetCursorPos = user32.func('BOOL __stdcall SetCursorPos(int x, int y)');
const PostMessageW = user32.func('BOOL __stdcall PostMessageW(intptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)');
const SendMessageTimeoutW = user32.func('intptr_t __stdcall SendMessageTimeoutW(intptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam, uint32_t flags, uint32_t timeout, _Out_ uintptr_t *result)');
const SendInput = user32.func('uint32_t __stdcall SendInput(uint32_t count, SPLIT_INPUT *inputs, int size)');
const MapVirtualKeyW = user32.func('uint32_t __stdcall MapVirtualKeyW(uint32_t code, uint32_t mapType)');
const GetForegroundWindow = user32.func('intptr_t __stdcall GetForegroundWindow()');
const SetForegroundWindow = user32.func('BOOL __stdcall SetForegroundWindow(intptr_t hwnd)');
const BringWindowToTop = user32.func('BOOL __stdcall BringWindowToTop(intptr_t hwnd)');
const AttachThreadInput = user32.func('BOOL __stdcall AttachThreadInput(uint32_t attach, uint32_t to, BOOL doAttach)');
const IsWindow = user32.func('BOOL __stdcall IsWindow(intptr_t hwnd)');
const GetCurrentThreadId = kernel32.func('uint32_t __stdcall GetCurrentThreadId()');
const OpenProcess = kernel32.func('intptr_t __stdcall OpenProcess(uint32_t access, BOOL inherit, uint32_t pid)');
const CloseHandle = kernel32.func('BOOL __stdcall CloseHandle(intptr_t h)');
const QueryFullProcessImageNameW = kernel32.func('BOOL __stdcall QueryFullProcessImageNameW(intptr_t h, uint32_t flags, _Out_ uint8_t *buf, _Inout_ uint32_t *size)');

let XInputGetState = null;
for (const dll of ['xinput1_4.dll', 'xinput9_1_0.dll', 'xinput1_3.dll']) {
  try {
    XInputGetState = koffi.load(dll).func('uint32_t __stdcall XInputGetState(uint32_t index, _Out_ SPLIT_XINPUT_STATE *state)');
    break;
  } catch (_) { /* try the next one */ }
}

// Win32 constants
const WM_ACTIVATE = 0x0006, WM_SETFOCUS = 0x0007, WM_ACTIVATEAPP = 0x001C, WM_NCACTIVATE = 0x0086;
const WM_KEYDOWN = 0x0100, WM_KEYUP = 0x0101;
const WM_MOUSEMOVE = 0x0200, WM_LBUTTONDOWN = 0x0201, WM_LBUTTONUP = 0x0202, MK_LBUTTON = 0x0001;
const SMTO_ABORTIFHUNG = 0x0002;
const INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
const MOUSEEVENTF_LEFTDOWN = 0x0002, MOUSEEVENTF_LEFTUP = 0x0004;
const KEYEVENTF_KEYUP = 0x0002, KEYEVENTF_SCANCODE = 0x0008;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const XINPUT_DEADZONE_LEFT = 7849, XINPUT_DEADZONE_RIGHT = 8689, XINPUT_TRIGGER_THRESHOLD = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lparam = (x, y) => ((y & 0xFFFF) << 16) | (x & 0xFFFF);

function processName(pid) {
  const h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
  if (!h) return '';
  try {
    const buf = Buffer.alloc(1040);
    const size = [520];
    if (!QueryFullProcessImageNameW(h, 0, buf, size)) return '';
    const full = buf.toString('utf16le', 0, size[0] * 2);
    return full.split('\\').pop();
  } finally {
    CloseHandle(h);
  }
}

function windowTitle(hwnd) {
  const buf = Buffer.alloc(512);
  const n = GetWindowTextW(hwnd, buf, 256);
  return n > 0 ? buf.toString('utf16le', 0, n * 2) : '';
}

// Finds the Roblox client: top-level window of the given class owned by the given exe.
function findTarget({ exe, windowClass }) {
  const want = String(exe || '').toLowerCase();
  let hwnd = 0;
  for (let guard = 0; guard < 64; guard++) {
    hwnd = FindWindowExW(0, hwnd, windowClass, null);
    if (!hwnd) return null;
    if (!IsWindowVisible(hwnd)) continue;
    const pid = [0];
    GetWindowThreadProcessId(hwnd, pid);
    const name = processName(pid[0]);
    if (!want || name.toLowerCase() === want) return describe(hwnd, pid[0], name);
  }
  return null;
}

function describe(hwnd, pid, exe) {
  const rect = {};
  GetClientRect(hwnd, rect);
  const origin = { x: 0, y: 0 };
  ClientToScreen(hwnd, origin);
  return {
    id: hwnd,
    pid,
    exe,
    title: windowTitle(hwnd),
    minimized: !!IsIconic(hwnd),
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    screenX: origin.x,
    screenY: origin.y
  };
}

function isAlive(target) {
  return !!target && !!IsWindow(target.id);
}

// Cursor position converted to the target's client coordinates (physical pixels).
function cursorInTarget(target) {
  const p = {};
  GetCursorPos(p);
  const pt = { x: p.x, y: p.y };
  ScreenToClient(target.id, pt);
  return { x: pt.x, y: pt.y, screenX: p.x, screenY: p.y };
}

// ---------- background mode: window messages only ----------
function msg(hwnd, m, w, l, sync) {
  if (sync) return SendMessageTimeoutW(hwnd, m, w, l, SMTO_ABORTIFHUNG, 100, [0]);
  return !!PostMessageW(hwnd, m, w, l);
}

// Same messages Windows sends on a real Alt+Tab into the window, so Roblox's own
// "am I active" flag flips on without the window actually taking focus.
function spoofFocus(hwnd, sync) {
  msg(hwnd, WM_ACTIVATEAPP, 1, 0, sync);
  msg(hwnd, WM_NCACTIVATE, 1, 0, sync);
  msg(hwnd, WM_ACTIVATE, 1, 0, sync);
  msg(hwnd, WM_SETFOCUS, 0, 0, sync);
}

async function backgroundClick(target, { x, y, holdMs, sync }) {
  const h = target.id, lp = lparam(x, y);
  spoofFocus(h, sync);
  await sleep(10);
  msg(h, WM_MOUSEMOVE, 0, lp, sync);
  await sleep(17); // one frame of hover before the press
  msg(h, WM_LBUTTONDOWN, MK_LBUTTON, lp, sync);
  await sleep(holdMs); // held across frames so the engine's per-frame poll sees it
  msg(h, WM_MOUSEMOVE, MK_LBUTTON, lp, sync);
  msg(h, WM_LBUTTONUP, 0, lp, sync);
}

async function backgroundKey(target, { vk, holdMs }) {
  const h = target.id;
  const sc = MapVirtualKeyW(vk, 0);
  const down = 1 | (sc << 16);
  const up = (1 | (sc << 16) | (1 << 30) | (1 << 31)) >>> 0;
  spoofFocus(h, false);
  await sleep(10);
  msg(h, WM_KEYDOWN, vk, down, false);
  await sleep(holdMs);
  msg(h, WM_KEYUP, vk, up, false);
}

// ---------- focus bounce mode: real OS input, then hand focus back ----------
function forceForeground(hwnd) {
  if (!hwnd || !IsWindow(hwnd)) return false;
  if (GetForegroundWindow() === hwnd) return true;
  const me = GetCurrentThreadId();
  const fg = GetForegroundWindow();
  const fgThread = fg ? GetWindowThreadProcessId(fg, [0]) : 0;
  const attached = fgThread && fgThread !== me ? AttachThreadInput(me, fgThread, 1) : 0;
  BringWindowToTop(hwnd);
  SetForegroundWindow(hwnd);
  if (attached) AttachThreadInput(me, fgThread, 0);
  return GetForegroundWindow() === hwnd;
}

function mouseButton(flags) {
  return { type: INPUT_MOUSE, u: { mi: { dx: 0, dy: 0, mouseData: 0, dwFlags: flags, time: 0, dwExtraInfo: 0 } } };
}

function keyEvent(vk, up) {
  const sc = MapVirtualKeyW(vk, 0);
  return { type: INPUT_KEYBOARD, u: { ki: { wVk: 0, wScan: sc, dwFlags: KEYEVENTF_SCANCODE | (up ? KEYEVENTF_KEYUP : 0), time: 0, dwExtraInfo: 0 } } };
}

async function bounce(target, { x, y, holdMs, settleMs, vk, restoreCursor }) {
  const previous = GetForegroundWindow();
  const cursor = {};
  GetCursorPos(cursor);
  const pt = { x, y };
  ClientToScreen(target.id, pt);

  if (!forceForeground(target.id)) {
    return { ok: false, reason: 'Windows refused to bring Roblox forward' };
  }
  await sleep(settleMs); // Roblox needs a frame or two to accept input after activation
  try {
    if (vk != null) {
      SendInput(1, [keyEvent(vk, false)], koffi.sizeof(INPUT));
      await sleep(holdMs);
      SendInput(1, [keyEvent(vk, true)], koffi.sizeof(INPUT));
    } else {
      SetCursorPos(pt.x, pt.y);
      await sleep(8);
      SendInput(1, [mouseButton(MOUSEEVENTF_LEFTDOWN)], koffi.sizeof(INPUT));
      await sleep(holdMs);
      SendInput(1, [mouseButton(MOUSEEVENTF_LEFTUP)], koffi.sizeof(INPUT));
    }
    await sleep(12);
  } finally {
    let back = true;
    if (previous && previous !== target.id) back = forceForeground(previous);
    if (restoreCursor && vk == null) SetCursorPos(cursor.x, cursor.y);
    if (!back) return { ok: true, warning: 'Could not hand focus back to your game (is it running as admin?)' };
  }
  return { ok: true };
}

// ---------- pad ----------
// Returns { connected, active } for the first connected XInput pad.
function readPad() {
  if (!XInputGetState) return { supported: false, connected: false, active: false };
  for (let i = 0; i < 4; i++) {
    const s = {};
    if (XInputGetState(i, s) !== 0) continue;
    const g = s.Gamepad;
    const stick = (x, y, dz) => Math.hypot(x, y) > dz;
    const active = g.wButtons !== 0
      || g.bLeftTrigger > XINPUT_TRIGGER_THRESHOLD || g.bRightTrigger > XINPUT_TRIGGER_THRESHOLD
      || stick(g.sThumbLX, g.sThumbLY, XINPUT_DEADZONE_LEFT)
      || stick(g.sThumbRX, g.sThumbRY, XINPUT_DEADZONE_RIGHT);
    return { supported: true, connected: true, index: i, active };
  }
  return { supported: true, connected: false, active: false };
}

// Virtual-key codes for the key names the app offers.
function keyCode(name) {
  const k = String(name || '').trim();
  if (/^[a-z0-9]$/i.test(k)) return k.toUpperCase().charCodeAt(0);
  const table = { Space: 0x20, Enter: 0x0D, Tab: 0x09, Shift: 0x10, Ctrl: 0x11, Alt: 0x12 };
  if (table[k]) return table[k];
  const f = /^F([1-9]|1[0-2])$/.exec(k);
  return f ? 0x6F + Number(f[1]) : null;
}

module.exports = {
  platform: 'win32',
  findTarget, isAlive, cursorInTarget, backgroundClick, backgroundKey, bounce, readPad, keyCode,
  needsPermission: () => false
};
