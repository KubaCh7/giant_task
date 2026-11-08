'use strict';
const fs = require('fs');
const path = require('path');

const isMac = process.platform === 'darwin';

const DEFAULTS = {
  mode: 'bounce',            // 'bounce' (real click, focus handed back) | 'background' (window messages, Roblox often ignores the click)
  action: 'click',           // 'click' | 'key'
  key: 'e',                  // key for action 'key'
  x: 500, y: 500,            // click point in Roblox's own coordinates (0,0 = top-left of the game area)
  intervalMs: 500,
  holdMs: 35,
  strictOrder: false,        // background: SendMessageTimeout instead of PostMessage
  settleMs: isMac ? 120 : 40, // bounce: wait after Roblox comes forward
  restoreCursor: true,
  padGate: true,
  padIdleMs: 300,
  padMaxWaitMs: 3000,
  toggleKey: 'F8',
  pickKey: 'F9',
  exe: isMac ? 'RobloxPlayer' : 'RobloxPlayerBeta.exe',
  windowClass: 'WINDOWSCLIENT',
  alwaysOnTop: false
};

const LIMITS = {
  x: [0, 16000], y: [0, 16000],
  intervalMs: [40, 600000], holdMs: [10, 1000], settleMs: [10, 1000],
  padIdleMs: [0, 10000], padMaxWaitMs: [0, 60000]
};

function clean(input) {
  const out = {};
  for (const [k, def] of Object.entries(DEFAULTS)) {
    if (!(k in input)) continue;
    let v = input[k];
    if (typeof def === 'number') {
      v = Math.round(Number(v));
      if (!Number.isFinite(v)) continue;
      const [lo, hi] = LIMITS[k] || [-Infinity, Infinity];
      v = Math.min(hi, Math.max(lo, v));
    } else if (typeof def === 'boolean') {
      v = !!v;
    } else {
      v = String(v).slice(0, 64);
    }
    if (k === 'mode' && !['background', 'bounce'].includes(v)) continue;
    if (k === 'action' && !['click', 'key'].includes(v)) continue;
    out[k] = v;
  }
  return out;
}

function create(dir) {
  const file = path.join(dir, 'settings.json');
  let data = { ...DEFAULTS };
  try { data = { ...DEFAULTS, ...clean(JSON.parse(fs.readFileSync(file, 'utf8'))) }; } catch (_) { /* first run */ }
  return {
    get: () => ({ ...data }),
    update(patch) {
      data = { ...data, ...clean(patch) };
      try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (_) { /* read-only disk: keep in memory */ }
      return { ...data };
    }
  };
}

module.exports = { create, DEFAULTS };
