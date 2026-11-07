; =============================================================================
;  RobloxBgClicker.ahk  (AutoHotkey v2)
;  Background left-clicks / key presses into an UNFOCUSED Roblox window.
;  - Never moves your hardware cursor (no MouseMove / Click / SendInput).
;  - Never steals focus (no WinActivate / SetForegroundWindow).
;  - Talks to the Roblox window only through its message queue.
;
;  Hotkeys (defaults, change in CONFIG):
;    F8        start / stop clicking
;    F9        pick coordinates: hover over the spot in Roblox, press F9
;    F10       fire ONE test click (to check if the current MODE works)
;    Ctrl+F8   exit script
; =============================================================================
#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

; ============================ CONFIG ========================================
; Click position, in CLIENT coordinates of the Roblox window
; (0,0 = top-left corner of the game area, NOT of your monitor).
; Easiest way: run the script, hover over the target in Roblox, press F9.
; It shows the X/Y and copies a ready line to the clipboard; paste it here.
CLICK_X := 500
CLICK_Y := 500

INTERVAL_MS := 200   ; time between clicks (ms). 200 = 5 clicks/sec.
HOLD_MS     := 50    ; how long the button stays "down" (ms).
                     ; Keep >= 34 so Roblox sees it for 2+ frames at 60 fps.
                     ; If clicks still drop, try 80-120.

; 1 = PostMessage mouse click + focus spoof   (default, try this first)
; 2 = SendMessageTimeout mouse click + focus spoof (strict ordering)
; 3 = keyboard fallback: presses FALLBACK_KEY instead of clicking
MODE := 1

FALLBACK_KEY := "e"  ; key for MODE 3, AHK key name: "e", "Space", "1", "Enter"...

TOGGLE_KEY := "F8"   ; AHK hotkey syntax: "F8", "^F7" (Ctrl+F7), "!x" (Alt+X)...
PICK_KEY   := "F9"
TEST_KEY   := "F10"
EXIT_KEY   := "^F8"

ROBLOX_WIN := "ahk_exe RobloxPlayerBeta.exe ahk_class WINDOWSCLIENT"
; ===========================================================================

; Win32 messages
WM_ACTIVATE    := 0x0006
WM_SETFOCUS    := 0x0007
WM_ACTIVATEAPP := 0x001C
WM_NCACTIVATE  := 0x0086
WM_KEYDOWN     := 0x0100
WM_KEYUP       := 0x0101
WM_MOUSEMOVE   := 0x0200
WM_LBUTTONDOWN := 0x0201
WM_LBUTTONUP   := 0x0202
MK_LBUTTON     := 0x0001
WA_ACTIVE      := 1

; Per-monitor DPI awareness so F9 coordinates match what Roblox sees,
; even when your two monitors use different scaling (100% / 125% / 150%).
DllCall("SetThreadDpiAwarenessContext", "Ptr", -4, "Ptr")

global running := false

Hotkey(TOGGLE_KEY, ToggleClicker)
Hotkey(PICK_KEY, PickCoords)
Hotkey(TEST_KEY, (*) => DoAction())
Hotkey(EXIT_KEY, (*) => ExitApp())

ShowTip("Roblox BG clicker loaded  |  MODE " MODE "  |  " TOGGLE_KEY " start/stop, " PICK_KEY " pick X/Y")

; ---------------------------------------------------------------------------
ToggleClicker(*) {
    global running
    running := !running
    if running {
        SetTimer(DoAction, INTERVAL_MS)
        ShowTip("Clicker ON  (" CLICK_X ", " CLICK_Y ")  MODE " MODE)
        SoundBeep(1200, 60)
    } else {
        SetTimer(DoAction, 0)
        ShowTip("Clicker OFF")
        SoundBeep(600, 60)
    }
}

DoAction() {
    hwnd := WinExist(ROBLOX_WIN)
    if !hwnd {
        ShowTip("Roblox window not found (" ROBLOX_WIN ")")
        return
    }
    switch MODE {
        case 1: MouseClickBg(hwnd, CLICK_X, CLICK_Y, false)
        case 2: MouseClickBg(hwnd, CLICK_X, CLICK_Y, true)
        case 3: KeyPressBg(hwnd, FALLBACK_KEY)
        default: ShowTip("Bad MODE: " MODE)
    }
}

; ---------------------------------------------------------------------------
; Make Roblox *believe* it is the active window, without actually activating
; it. Roblox ignores mouse buttons while its internal "focused" flag is off;
; these are the same messages Windows sends on a real Alt+Tab into the game.
; Re-sent every tick because your real game may trigger a real deactivate.
SpoofFocus(hwnd, sync) {
    Msg(hwnd, WM_ACTIVATEAPP, 1, 0, sync)
    Msg(hwnd, WM_NCACTIVATE,  1, 0, sync)
    Msg(hwnd, WM_ACTIVATE,    WA_ACTIVE, 0, sync)
    Msg(hwnd, WM_SETFOCUS,    0, 0, sync)
}

; Full, "legal-looking" click sequence:
;   move (no buttons) -> down (MK_LBUTTON) -> hold -> move (MK_LBUTTON) -> up
; The game polls input once per frame, so down and up must be separated by
; at least one or two frames or the engine collapses them into nothing.
MouseClickBg(hwnd, x, y, sync) {
    lp := MakeLParam(x, y)
    SpoofFocus(hwnd, sync)
    Sleep(10)
    Msg(hwnd, WM_MOUSEMOVE,   0,          lp, sync)
    Sleep(17)                                  ; ~1 frame: let it register hover
    Msg(hwnd, WM_LBUTTONDOWN, MK_LBUTTON, lp, sync)
    Sleep(HOLD_MS)                             ; button held across frames
    Msg(hwnd, WM_MOUSEMOVE,   MK_LBUTTON, lp, sync)
    Msg(hwnd, WM_LBUTTONUP,   0,          lp, sync)
}

; Keyboard fallback with properly built lParam (scan code, repeat count,
; previous-state and transition bits) so it looks like a real key event.
KeyPressBg(hwnd, keyName) {
    vk := GetKeyVK(keyName)
    if !vk {
        ShowTip("Unknown FALLBACK_KEY: " keyName)
        return
    }
    sc := DllCall("MapVirtualKeyW", "UInt", vk, "UInt", 0, "UInt")
    lpDown := 1 | (sc << 16)                        ; repeat=1, scan code
    lpUp   := 1 | (sc << 16) | (1 << 30) | (1 << 31) ; + prev-down + released
    SpoofFocus(hwnd, false)
    Sleep(10)
    Msg(hwnd, WM_KEYDOWN, vk, lpDown, false)
    Sleep(HOLD_MS)
    Msg(hwnd, WM_KEYUP,   vk, lpUp,   false)
}

; ---------------------------------------------------------------------------
; sync=false -> PostMessage (async, never blocks this script)
; sync=true  -> SendMessageTimeout (waits until Roblox processed it, 100 ms max,
;               aborts if Roblox is hung so the script never freezes)
Msg(hwnd, msg, wParam, lParam, sync) {
    if sync {
        return DllCall("SendMessageTimeoutW", "Ptr", hwnd, "UInt", msg
            , "UPtr", wParam, "Ptr", lParam
            , "UInt", 0x0002, "UInt", 100, "Ptr*", &res := 0)   ; SMTO_ABORTIFHUNG
    }
    return DllCall("PostMessageW", "Ptr", hwnd, "UInt", msg, "UPtr", wParam, "Ptr", lParam)
}

MakeLParam(x, y) => ((y & 0xFFFF) << 16) | (x & 0xFFFF)

; F9: convert current cursor position to Roblox client coordinates.
PickCoords(*) {
    global CLICK_X, CLICK_Y
    hwnd := WinExist(ROBLOX_WIN)
    if !hwnd {
        ShowTip("Roblox window not found")
        return
    }
    CoordMode("Mouse", "Screen")
    MouseGetPos(&sx, &sy)
    pt := Buffer(8)
    NumPut("Int", sx, "Int", sy, pt)
    DllCall("ScreenToClient", "Ptr", hwnd, "Ptr", pt)
    CLICK_X := NumGet(pt, 0, "Int")
    CLICK_Y := NumGet(pt, 4, "Int")
    A_Clipboard := "CLICK_X := " CLICK_X "`nCLICK_Y := " CLICK_Y
    ShowTip("Target set: X=" CLICK_X "  Y=" CLICK_Y "  (copied to clipboard, active until reload)")
}

ShowTip(text) {
    ToolTip(text)
    SetTimer(() => ToolTip(), -2000)
}
