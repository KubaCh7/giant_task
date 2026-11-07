# Roblox background clicker (AHK v2)

Clicks (or presses a key) in an unfocused Roblox window on your second monitor.
Hardware cursor and foreground window are never touched.

## Use
1. Install AutoHotkey **v2**. Run `RobloxBgClicker.ahk` normally (no admin).
2. Hover over the target spot in Roblox, press **F9**. Coordinates are set and copied
   to clipboard; paste them into `CLICK_X` / `CLICK_Y` to make them permanent.
3. Press **F10** for a single test click. If it registers, press **F8** to start/stop.
4. Go back to your main game. Ctrl+F8 exits.

Change hotkeys in the CONFIG block (`TOGGLE_KEY`, `PICK_KEY`, `TEST_KEY`, `EXIT_KEY`).

## If clicks don't register
| Try | Change |
|---|---|
| Longer hold | `HOLD_MS := 100` |
| Strict ordering | `MODE := 2` |
| Action bound to a key (E, Space, 1) | `MODE := 3`, set `FALLBACK_KEY` |

Real limit: Roblox reads some input (3D world / camera clicks, some tool
activations) through Raw Input (`WM_INPUT`), which only the OS can generate
for the focused window. No message trick from outside fixes that.
GUI buttons and most tool clicks work with the focus spoof; world clicks may not.

Bulletproof fallback: give Roblox its own session where it *is* foreground,
e.g. a Hyper-V VM with GPU partitioning, then run any normal clicker inside it.

## Admin / UIPI / Hyperion
- Roblox runs at medium integrity, so the script does **not** need admin. UIPI only
  blocks messages from a lower to a higher integrity process. Don't run Roblox as admin.
- The script only posts window messages from a separate process. It does not open,
  read, inject into or hook `RobloxPlayerBeta.exe`. DLL injection / input hooking
  inside Roblox is exactly what Hyperion detects (= ban), so it's deliberately not here.
- Some Roblox games ban AFK automation in their own rules. That's on you.
