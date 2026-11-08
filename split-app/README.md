# Split

Clicks Roblox on your second monitor while you play another game on a pad on your main monitor.

## Download
Grab the newest build from the **Split (latest build)** release (tag `split-latest`) on this repo:

| System | File |
|---|---|
| Windows | `Split-Setup-1.0.0.exe` (installer) or `Split-1.0.0-portable.exe` (no install) |
| Mac, Apple Silicon | `Split-1.0.0-arm64.dmg` |
| Mac, Intel | `Split-1.0.0-x64.dmg` |

The builds aren't signed with a paid certificate:
- **Windows:** SmartScreen says "Windows protected your PC" → More info → Run anyway.
- **macOS:** first open is blocked → System Settings → Privacy & Security → Open Anyway. Then allow Split under Accessibility.

## Use
1. Start Roblox on monitor 2. Split finds it within a second.
2. Hover the spot in Roblox and press **F9** (or click *Pick in 3 s* and move the mouse there).
3. Pick a mode, press **Start** or **F8**, go back to your game.

## Modes
- **Background**: sends the click straight to Roblox's window. Your game keeps focus, your mouse doesn't move. Roblox often ignores these: the target highlights but nothing clicks. If that happens, use Focus bounce.
- **Focus bounce**: brings Roblox forward for ~100 ms, clicks for real, hands focus back. Works for every click. Split waits for your pad to go quiet first, so a bounce never eats a button press. Exclusive-fullscreen games may flicker; use borderless.

The pad lane reads Xbox-style pads (XInput) on Windows. PlayStation pads show up through Steam Input or DS4Windows. macOS can't read a pad in the background, so there the gate is off.

## Safety
Split never opens, reads or injects into Roblox. It sends the same input the OS would. No admin needed.

## Build it yourself
```bash
cd split-app && npm ci && npm start
```
`npm run dist:win` / `npm run dist:mac` package it (each on its own OS). The `Build Split` GitHub workflow does both on every push.
