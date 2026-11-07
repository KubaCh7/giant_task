# Split

Clicks Roblox on your second monitor while you play another game on a pad on your main monitor.

<p>
  <a href="https://github.com/KubaCh7/giant_task/releases/download/split-latest/Split-Setup-1.0.0.exe"><img alt="Download for Windows" src="https://img.shields.io/badge/Download-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white"></a>
  <a href="https://github.com/KubaCh7/giant_task/releases/download/split-latest/Split-1.0.0-arm64.dmg"><img alt="Download for Mac (Apple Silicon)" src="https://img.shields.io/badge/Download-Mac%20(M1%2FM2%2FM3)-000000?style=for-the-badge&logo=apple&logoColor=white"></a>
  <a href="https://github.com/KubaCh7/giant_task/releases/download/split-latest/Split-1.0.0-x64.dmg"><img alt="Download for Mac (Intel)" src="https://img.shields.io/badge/Download-Mac%20(Intel)-555555?style=for-the-badge&logo=apple&logoColor=white"></a>
</p>

No install on Windows: [Split-1.0.0-portable.exe](https://github.com/KubaCh7/giant_task/releases/download/split-latest/Split-1.0.0-portable.exe). All files: [Releases](https://github.com/KubaCh7/giant_task/releases/tag/split-latest).

## First launch
The builds aren't signed with a paid certificate, so you get a warning once:
- **Windows:** "Windows protected your PC" → More info → Run anyway.
- **Mac:** System Settings → Privacy & Security → Open Anyway, then allow Split under Accessibility.

## How to use
1. Start Roblox on monitor 2. Split finds it within a second.
2. Hover the spot in Roblox and press **F9** to set the click point.
3. Pick a mode, press **F8** (or Start), go back to your game.

## Modes
- **Background:** sends the click straight to Roblox's window. Your game keeps focus and your mouse stays put. Works on buttons and menus, may be ignored in the 3D world.
- **Focus bounce:** brings Roblox forward for about 100 ms, clicks for real, hands focus back. Works for every click. Waits for your pad to go quiet first, so it never eats a button press. Use borderless, not exclusive fullscreen.

The pad check reads Xbox-style pads on Windows (PlayStation pads work through Steam Input or DS4Windows). It doesn't work on Mac.

## Safety
Split never opens, reads or injects into Roblox. It sends the same input the OS would. No admin needed.

---
Source is in [`split-app/`](split-app/). An older AutoHotkey script is in [`roblox-bg-clicker/`](roblox-bg-clicker/).
