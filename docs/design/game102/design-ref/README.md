# Handoff: Pixel Pour (色流工坊) — game102

## Overview
Pixel Pour is a casual mobile puzzle game. The player selects a paint canister and taps
cells on a pixel-art board to "pour" color and progressively reveal a picture (garden with
pig characters). The bundle covers four screens: **Level Select**, **Gameplay (对局)**,
**Level Clear / Settlement**, and **Fail / Revive**. Gameplay is the primary, most detailed
screen and the one reproduced 1:1 from the client's reference screenshot.

## About the Design Files
The files in this bundle are **design references authored in HTML** (a single Design-Component
prototype, `Pixel Pour.dc.html`, plus cropped art assets). They demonstrate the intended look
and behavior — they are **not production code to ship as-is**. The task is to **recreate these
designs in the target game/app environment** using its established patterns (e.g. Unity/Cocos
for a real game client, or React/React-Native for a web/hybrid build). If no environment exists
yet, pick the most appropriate stack and implement there. The custom `<sc-for>`/`<sc-if>`
template tags and the `DCLogic` class are prototype-runtime constructs — reimplement their
intent (lists, conditionals, component state) idiomatically.

## Fidelity
**High-fidelity** for the Gameplay screen: it is a pixel-accurate reconstruction of the
reference. Exact colors, positions, and sizes are given below in a fixed **650 × 1424** design
space (the reference screenshot's native resolution). The Select / Settle / Fail screens are
**mid-fidelity** — correct style, palette, and content, but layout is flexible.

## Coordinate System (Gameplay)
All gameplay coordinates below are in a **650 wide × 1424 tall** stage (matches the source
screenshot 1:1). In the prototype this stage is absolutely positioned and uniformly scaled to
fit an iPhone screen of **390 × 844** logical px:
`scale = 844 / 1424 ≈ 0.5927`, anchored top-center. Reproduce by authoring at 650×1424 and
scaling to the device screen, OR by converting every value with the device's own scale factor.

---

## Screens / Views

### 1. Gameplay (对局) — primary, hi-fi
**Purpose:** Player pours paint to reveal the pixel picture; win by revealing all cells before
canisters run out.

**Background:** vertical gradient `#5b6488 → #4c5578`.

**HUD (top):**
- **Settings gear** — circle, `left:44 top:42 size:74×74`, radial red `#ff6a6a→#d1332f`,
  border `4px #ffffff2e`, drop shadow `0 6px 0 #9e2320, 0 9px 14px rgba(0,0,0,.4)`, ⚙️ glyph 34px.
- **Level pill** — `left:225 top:48 size:200×56`, radius 28, same red gradient/border/shadow,
  font Baloo 2 800, 30px, white, text-shadow `0 2px 0 rgba(0,0,0,.25)`. Copy: `Level 934`.
- **Coin** — circle `left:448 top:50 size:60×60`, radial gold `#ffe98a→#f2b21e`, border `3px #d99a12`.
- **Coin count** — `left:512 top:54 w:76` centered, Baloo 2 800, 42px, white. Copy: `90`.
- **Plus button** — `left:594 top:58 size:48×48`, radius 12, gold gradient, border `2px #d99a12`,
  text `+` `#7a4b00` 34px.

**Pipe track (double-rail rounded tube):** container `left:15 top:118 size:620×758`, radius 66,
gradient `#c6cfee→#8891b8 52%→#5c6590`, shadow `0 12px 26px rgba(0,0,0,.42),
inset 0 3px 5px rgba(255,255,255,.65), inset 0 -8px 14px rgba(0,0,0,.32)`. Nested rings:
- groove: `inset:13` radius 56, `#4a5379`, `inset 0 3px 7px rgba(0,0,0,.45)`
- inner rail: `inset:22` radius 48, gradient `#c2cbe8→#7e88b0 55%→#5a6390`
- track floor: `inset:40` radius 38, `#3b4468`, `inset 0 4px 12px rgba(0,0,0,.5)`

**Flow arrows** (color `#9aa4cd`, 22px, weight 800) show conveyor direction around the loop:
- top edge `‹` (pointing left): row at `left:150 top:196 w:350`, space-between, 6 glyphs
- left edge `⌄` (down): column at `left:62 top:280 h:440`, 6 glyphs
- bottom edge `›` (right): row at `left:150 top:792 w:350`, 6 glyphs
- right edge `⌃` (up): column at `left:574 top:280 h:440`, 6 glyphs

**Spring feeder (track START):** bottom-left, two ribbed blocks
(`repeating-linear-gradient(180deg,#eef2ff 0 4px,#909bc6 4px 8px)`, border `#6f79a4`):
small `left:-2 top:690 34×58`, main `left:-6 top:788 40×82`.

**Picture window:** `left:93 top:248 size:467×512`, radius 12, overflow hidden, bg `#1a1c2e`,
`inset 0 0 0 3px rgba(0,0,0,.4)`.
- Background image `assets/board_picture.png`, `center / cover` — the target pixel art.
- Overlay grid on top: CSS grid **9 columns × 8 rows** (= 72 cells), gap 3px, padding 3px.
  - **Unrevealed cell:** radius 4, `background: rgba(8,10,22,.16)` (translucent veil so the
    colorful art stays visible), `inset 0 1px 2px rgba(255,255,255,.1), inset 0 -2px 3px rgba(0,0,0,.4)`, clickable.
  - **Revealed cell:** radius 4, `background: rgba(255,255,255,.06)`,
    `inset 0 3px 4px rgba(255,255,255,.55), inset 0 -3px 4px rgba(0,0,0,.22)`, plays `reveal` keyframe (below).
- Floating score popup anchored center; see Interactions.

**Progress counter:** `left:30 top:884`, Baloo 2 800, 44px, white, `text-shadow 0 3px 3px rgba(0,0,0,.45)`.
Shows `<revealed>/<total>` (e.g. `0/72`). Reference art shows `5/5` — it is a live counter.

**Standby slots (×5):** each `top:956 size:104×80`, radius 18, `#333a5c`, border `3px #262b45`,
`inset 0 3px 6px rgba(0,0,0,.45)`; `left = 40 + i*118` (i=0..4).

**Supply — 12 individual canisters (3 rows × 4 columns):**
Column left positions `[104, 218, 332, 446]`, each canister `104×118`, art `center/contain`.
- **Front row (interactive):** `top:1040`, `z-index:5`, full opacity. Colors L→R:
  green, black, red, green. Each shows its baked `20` art plus a **×count badge**
  (`bottom:-6 right:0`, pill `#161826e0`, Baloo 2 800 22px white; turns `#ff6a76` when empty).
  Selected canister: gold ring `left:-6 top:-6 116×132` radius 20, border `5px #ffd54a`,
  glow `0 0 20px rgba(255,213,74,.6)`, and image gains `drop-shadow(0 0 13px rgba(255,213,74,.95))`.
- **Mid row (reserve, decorative):** `top:1150`, opacity 0.62, `z-index:3`. Colors: green, green, orange, yellow.
- **Back row (reserve, decorative):** `top:1248`, opacity 0.34, `z-index:1`. Colors: red, yellow, orange, black.
  The back row is partially hidden behind the action bar (peeks ~half).

**Action bar (bottom):** full-width red panel `left:0 bottom:0 size:650×118`,
gradient `#e0433f→#c22f2c`, top border `4px #ff7a76`, shadow `0 -5px 16px rgba(0,0,0,.35)`, `z-index:6`.
4 circular buttons (`z-index:7`, on top of the bar) at center-x `[94, 250, 404, 555]`,
`top:1316 size:86×86`, radial `#ff8a86→#d1332f`, border `4px #ffffff45`,
`0 5px 0 #9e2320, inset 0 3px 4px rgba(255,255,255,.4)`. Icons L→R: 🃏 card, 👆 hint, 🔄 shuffle, 🐹 helper (38px).
Each has a green **+ badge** bottom-right: `36×36` circle, radial `#7ee27e→#3aa03a`, border `3px #fff`, `+` 26px white.

### 2. Level Select (选关) — mid-fi
Vertical climbing path of level nodes (newest/highest on top). Top bar: coin `🪙 2,480` and lives
`❤️ 5` pills (`#231d45`, border `#3a3268`, radius 999). Title block: kicker `PIXEL POUR`
(letter-spacing .34em, `#8a7fc4`) + wordmark `色流工坊` (Baloo 2 800, 30px, gradient text
`#4fc3ff→#ffd54a`). Each node: rounded card (`linear-gradient(150deg,#2b2455,#231d45)`, border
`#4a3f80`, radius 20), 58×58 medal tile with emoji, title, 3-star row (filled `#ffd54a`, empty
`#3a3268`); locked nodes dim + 🔒. Nodes alternate left/right alignment. Footer hint text.

### 3. Level Clear / Settlement (结算) — mid-fi
Centered card on radial `#2c2460→#141026`. Confetti falling (16 strips, colors
`#4fc3ff #5ee8a0 #ffd54a #ff5d6c #ff9d4d`, `confetti` keyframe). Card `linear-gradient(180deg,#2b2455,#231d45)`,
border `#3a3268`, radius 26. Kicker `LEVEL CLEAR`, headline `通关啦！` (gradient `#ffd54a→#ff9d4d`),
118×118 picture thumbnail, 3 big stars (middle larger, `pop` keyframe), two stat tiles
(🪙 `+<coins>` gold, 🏆 `<score>` green `#5ee8a0`), message line, and buttons: `重来` (secondary)
and `下一关 →` (green `#5ee8a0→#2fa86a`, `0 5px 0 #22794c`).

### 4. Fail / Revive (续命) — mid-fi
Grayscale picture thumbnail (top), heading `就差一点点…😣`, bottom sheet card. Primary CTA
`📺 看广告复活` (gold `#ffd54a→#ff9d4d`, `0 5px 0 #c47a10`). Secondary row: `💎 $6.99 续命`
(outline green) and `放弃` (muted). Toast line for feedback.

---

## Interactions & Behavior
- **Select paint:** tap a front-row canister → sets `activeCan` (0–3), shows gold ring.
- **Pour:** tap an unrevealed board cell → if the active canister count > 0, reveal that cell
  (`reveal` animation), decrement that canister's count by 1, `score += 50`, spawn a floating
  `+50` popup. If the active canister is empty, spawn a red `颜料用完了!` popup and do nothing.
- **Win:** when all 72 cells are revealed → after 460ms go to Settlement. Stars by paint left:
  `≥12 → 3★`, `≥5 → 2★`, else `1★`. Reward coins `= stars * 30`.
- **Lose:** if total paint across all 4 front canisters hits 0 while cells remain → after 500ms go to Fail.
- **Revive** (ad or pay): +8 to every canister, return to Gameplay.
- **Settlement buttons:** 重来 restarts level; 下一关 advances (clamped to last level).
- **Action-bar buttons:** currently show a toast (stub power-ups).
- **Navigation:** gear/level pill → back to Select. A dev-only bottom nav (选关/对局/结算/续命)
  jumps between screens; **remove for production.**

### Animations (keyframes)
- `reveal`: `0%{scale(1.35);opacity:0} 60%{scale(.92)} 100%{scale(1);opacity:1}` — 0.35s ease (cell reveal).
- `floatup`: rises ~110px and fades over 1s ease (score popup). Popup font Baloo 2 800, 40px
  white with `-webkit-text-stroke:1.5px rgba(0,0,0,.35)`; error variant 30px `#ff5d6c`.
- `pop`: `0%{scale(.2)} 60%{scale(1.2)} 100%{scale(1)}` (stars).
- `bob`: gentle ±7px Y (select-screen medals).
- `confetti`: translateY 0→520 + rotate 680deg, fade out.

## State Management
- `screen`: `'select' | 'game' | 'settle' | 'fail'`
- `levelIndex` (int), `unlocked` (int), `starMap` ({levelIndex: stars})
- `cols=9`, `rows=8`, `reveal`: boolean[72]
- `cans`: `{green:20, black:20, red:20, green2:20}` (front-row counts; two greens are distinct ids)
- `activeCan`: canister id, default `'green'`
- `score` (int), `coins` (int, start 90), `stars` (int)
- `lastFloat` ({id,text,bad?}) transient popup, `toast` transient message

## Design Tokens
**Colors**
- Bg slate: `#5b6488`, `#4c5578`, `#3b4468`, `#333a5c`, `#262b45`
- Tube metallic: `#c6cfee`, `#8891b8`, `#5c6590`, `#4a5379`, `#3b4468`
- Red (buttons/bar): `#ff8a86`, `#ff6a6a`, `#e0433f`, `#d1332f`, `#c22f2c`, `#9e2320`, `#ff7a76`
- Gold/coin: `#ffe98a`, `#ffd54a`, `#f2b21e`, `#d99a12`, `#ff9d4d`
- Green (success/badge): `#7ee27e`, `#5ee8a0`, `#3aa03a`, `#2fa86a`, `#22794c`
- Accents: `#4fc3ff` (links/cyan), `#ff5d6c` (error), text `#ece8ff / #b7add9 / #8a7fc4`
- Flow arrows: `#9aa4cd`
- Board veil: `rgba(8,10,22,.16)` unrevealed; picture bg `#1a1c2e`

**Type:** Baloo 2 (600/700/800) for numerals & headings; Fredoka for body/UI; PingFang SC /
Microsoft YaHei fallback for Chinese.

**Radius:** cells 4; picture 12; slots 18; cards 20–26; tube 38–66; pills 999.

**Default link color:** `a {color:#4fc3ff}`, `a:hover {#7ad4ff}`.

## Assets
Cropped from the client's reference screenshot (`uploads/...jpg`). Ship real production art in the
final build; these are placeholders that match the reference exactly.
- `assets/board_picture.png` — target pixel-art picture (garden + pig characters).
- `assets/can_green.png`, `can_black.png`, `can_red.png`, `can_orange.png`, `can_yellow.png`
  — single canister sprites (each with a baked `20` label).
- `assets/col_*.png`, `assets/buttons_bar.png`, `assets/gear.png` — earlier crops kept for reference.

## Files
- `Pixel Pour.dc.html` — the full interactive prototype (all four screens + logic).
- `assets/` — art crops listed above.
- Emoji glyphs (⚙️ 🃏 👆 🔄 🐹 🪙 🏆 ❤️ 💎 📺) are placeholders; swap for real icons in production.
