# Handoff: Survivor IO — Game UI Kit

## Overview
A mobile survivor.io-style action game UI. Five screens: in-game combat HUD, level-up skill picker, lucky-wheel reward gacha, skills inventory (Active/Passive), and a victory results screen. Portrait mobile (9:16). Bright, chunky cartoon aesthetic — beveled panels, gold ribbon banners, heavy black-outlined display type, segmented bars, star ratings.

## About the Design Files
The file in this bundle (`Survivor IO UI.dc.html`) is a **design reference created in HTML** — a prototype showing intended look and behavior, **not production code to copy directly**. It's a "Design Component" wrapper; ignore the `<x-dc>` / `support.js` scaffolding.

Your task is to **recreate these designs in the target codebase's environment** (Unity uGUI, Cocos, React Native, Flutter, web canvas overlay, etc.) using its established patterns. If no environment exists yet, choose the most appropriate framework for a real-time mobile game UI and implement there. Treat the HTML as a spec for layout, measurements, colors, and copy — not as shippable markup.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and layout are specified below with exact values. Recreate the UI faithfully using the game engine's UI system. The only placeholders are sprite art (hero, boss, item icons) — swap in real game sprites where the doc notes an icon/portrait slot.

## Design Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| screen-bg-combat | `#868a92` → `#797d85` | Combat field base (top→bottom gradient) |
| road | `#787c84` w/ `#6c7078` edge insets | Ground path strips |
| menu-bg | `#2a2e35` → `#1e2127` | Menu screen backgrounds |
| panel-blue | `#6d7c8d` → `#47535f`, border `#2b333c`, top-bevel `#9fb0c0` | Lucky-wheel container |
| slate-btn | `#5c6672` → `#39424d`, border `#222a32`, bevel `#7d8794` | Pause / timer / HUD chrome |
| gold | `#ffd23f` → `#f5a623`, border `#fff`, drop `#b8730c`, stroke `#a85e08` | Primary buttons, banners |
| purple-ad | `#b45cf0` → `#8a2fd6`, drop `#5e1c96`, stroke `#4a1580` | Ad / bonus button |
| coin | radial `#fff3a0` → `#e0a11a`, border `#a06a08` | Coin icon |
| hp-red | `#f0473a` / `#c22e22` (segmented) | Boss HP bar |
| xp-orange | `#ff9a1f` / `#e07c10` (segmented) | XP bar (low level) |
| xp-green | `#7dff4d` → `#3fbf1f` | Player HP / high-level XP |
| xp-orb | radial `#c6ff6e` → `#4fa524`, ring `#2c6a1a` | Ground pickups |
| warning-red | `#ff5a4a` → `#d61f11`, stroke `#7a0000` | Attack telegraph triangle |
| accent-active | `#e0402e` (red) | Active-skill card border / "Active" tab |
| accent-passive | `#2f9fe0` (blue) | Passive-skill card border / "Passive" tab |
| parchment | `#ecd6a8` → `#dcbf88` | Victory scroll |
| parchment-tile | `#f2e2bd` → `#e2ca8f`, border `#8a6a38` | Reward tiles |
| card-wood | `#d8955a` → `#c07a3e`, row `#e0b884` → `#cf9d5f`, border `#6e4620` | Skills panel bodies/rows |
| star-on | `#ffd23f` | Filled star |
| star-off | `#15130f` | Empty star |
| star-max | `#e23b2e` | Maxed-skill single red star |
| icon-tile | `#3a4048` → `#262b32`, border `#171a1f` | Dark item slot frame |

Sprite icon placeholders use a glossy disc: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.55), transparent 45%), linear-gradient(155deg, <hueA>, <hueB>)`. Hue pairs cycle through: orange `#ff7a4d/#d63b1f`, steel `#aab6c2/#5b6b7d`, blue `#7fd0ff/#2f7fd0`, silver `#d0d6dd/#8a929c`, purple `#c9a3ff/#7b47d6`, green `#8affc0/#28a06a`, gold `#ffd36b/#e0952a`, pink `#ff9ecb/#d64f95`.

### Typography
- **Display / numbers / banners**: `Luckiest Guy` (Google Fonts). Uppercase for banners. Always with a black stroke: `-webkit-text-stroke: 3–4px <dark>; paint-order: stroke fill; color:#fff`. Dark stroke color varies by context (`#1b2026` on HUD, `#a85e08` on gold banners, `#7a0f08` on red banners).
- **Body / descriptions / labels**: `Baloo 2`, weights 600–800.
- Sizes: banner title 25–27px; screen buttons 24–26px; HUD counters 17–19px; timer 22px; card titles 13px; card body 12px; small labels 11–13px.

### Spacing / Radius / Shadow
- Screen content frame: **400 × 711 px** (design canvas), 34px corner radius, inside a 12px dark bezel (`#0e1013`→`#05060a`, 46px radius).
- Panel radius 16–20px; card radius 14px; tile/slot radius 9–12px; button radius 12px.
- Bevel pattern: `box-shadow: inset 0 2px 0 <light>, inset 0 -3px 0 <dark>` on raised tiles; `inset 0 3px 0 <light>` on panels.
- Chunky button drop: `box-shadow: 0 5px 0 <darker>, 0 7px 10px rgba(0,0,0,.4)`.
- Panel drop: `0 6px 12px rgba(0,0,0,.4)`.

## Screens / Views

### 1. Combat HUD
- **Purpose**: Live gameplay overlay. Player fights waves + boss; single-joystick control.
- **Layout**: Full-bleed game field (gradient base + cross-shaped road strips + scattered XP orbs). HUD anchored to edges over the field.
- **Components**:
  - **Top bar** (top:12, sides:12, space-between): Pause button (46px slate rounded square, two 6×20 white bars). Timer chevron badge (118×42, `clip-path: polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)`, slate) reading `02:00`. Right stack: coin row (26px coin + `120`), skull row (💀 + `387`).
  - **Boss HP bar** (top:66): 34px red boss-face icon (two red dot eyes) + full-width segmented red bar (`repeating-linear-gradient(90deg,#f0473a 0 15px,#c22e22 15px 17px)`), 20px tall, dark track, inset shadow.
  - **Milestone bar** (top:100, inset 52px): 8px dark track, 34% gold fill, rotated gold diamond node at fill end, two dark marker chips, red boss chip at far right.
  - **Boss sprite** (top:150, centered): 130×120 icon slot, red `21` damage number top-right.
  - **Attack telegraph**: 74px-wide vertical red gradient beam from boss down; red rounded warning triangle (60×56, `clip-path: polygon(50% 6%,96% 92%,4% 92%)`, white `!`, `warn` pulse animation 1s) above the hero.
  - **Hero group** (top:352, centered): 120px translucent blue dodge-aura circle, 60px hero icon slot inside, 52×9 green segmented HP bar below.
  - **Joystick** (bottom:70, centered): 130px translucent ring (`rgba(30,34,40,.28)`, 3px `rgba(255,255,255,.28)` border), 58px dark knob (`radial-gradient(circle at 40% 35%,#3a3f47,#1c1f25)`).

### 2. Level Up (Choose Skill)
- **Purpose**: On level-up, pick one of three skill upgrades.
- **Layout**: Menu bg. Top HUD row (pause / `00:44` timer / 💀 `62`). Full-width orange segmented XP bar (`Lv 4` right-aligned). Centered gold ribbon banner "CHOOSE SKILL" (300×52, folded ends via clip-path). Row of three cards, 12px gap.
- **Card** (112px wide, 4px accent border, 14px radius): colored title tab (26px, accent bg, white name), green `New` / gold `Level up` status label, 64px glossy icon disc, description text (`Baloo 2` 12px `#4a3316`), row of 5 stars (16px clip-path polygon).
  - Card 1 **Mjolnir** — red `#e0402e`, "New", "Throws a lightning on 1 random target area", 1/5 stars.
  - Card 2 **Hermes's Wings** — blue `#2f9fe0`, "New", "Bullet flight speed +10%", 1/5.
  - Card 3 **Gold bar** — blue, "Level up", "Gold gain +12%", 2/5.

### 3. Lucky Wheel
- **Purpose**: Slot-machine reward spin.
- **Layout**: Dark menu bg. Top HUD row (pause / `02:01` / coin `120` / 💀 `388`). Gold banner "LUCKY WHEEL" (320×52). Blue beveled panel (344px) containing a **5×5 grid** (7px gap): 16 perimeter item slots (dark frame + glossy hue disc) with the center **3×3 = hero portrait slot** (blue). Coin counter pill (`0`) below the grid. Two buttons: gold **SPIN** (150×58) and purple **Spin +1** (150×58, `▶ AD` badge, "Next ad: + 2 skills" caption).
  - Grid slot positions (row,col, 1-indexed): top row (1,1)…(1,5); right (2–4,5); bottom (5,5)…(5,1); left (4–2,1). Portrait spans `grid-column:2/5; grid-row:2/5`.

### 4. Skills (Active / Passive)
- **Purpose**: Inventory of owned skills and their rank.
- **Layout**: Dark menu bg, vertical scroll. Two wood-textured panels stacked.
  - **Active panel**: red `#e0402e` 4px border, red "Active" pill tab overlapping top edge. 2-col grid of 6 rows; each row = 34px icon tile + star rank. One entry is **maxed** → single 22px red star instead of a star row.
  - **Passive panel**: blue `#2f9fe0` border, blue "Passive" tab, same 2-col × 3-row grid, star ranks.
- Star ranks shown (Active): 4/5, 5/5, 1/5, MAX, 4/5, 2/5. (Passive): 1/5, 2/5, 1/5, 1/5, 2/5, 4/5.

### 5. Victory
- **Purpose**: Stage-clear results + rewards.
- **Layout**: Dark bg. Top HUD row (pause / `06:03` / coin `768` / 💀 `4500`). Centered **parchment scroll** (300px, 5px red `#d6432c` border): red "VICTORY" ribbon overlapping top, "Chapter 1" subtitle (`Baloo 2` 800 20px `#5a3a1c`), gold "ALL CLEAR!" ribbon, two stat pills (💀 4500, coin 768). Inner wood tray (`#b89a6a`) holds two reward grids: top row of 4 parchment tiles (first shows `Lv 1`, others `x1`), bottom row of 3 blue-bordered round tiles (`x2`, `x5768`, `x1000`). Big gold **OK** button (180×56) below the scroll.

## Interactions & Behavior
- **Tab switcher** (prototype-only, above the phone): selects which screen is shown; not part of the game. In the real game these are separate states/scenes.
- **Combat**: joystick drives move/attack/dodge; warning triangle pulses (`@keyframes warn`: scale 1→1.12, opacity 1→.6, 1s infinite). Boss/player HP bars deplete live. Damage floaters rise + fade.
- **Level Up**: game pauses; tapping a card applies the upgrade and resumes. Cards should scale-in on appear.
- **Lucky Wheel**: SPIN animates a highlight cycling the 16 perimeter slots, decelerating to a winner; Spin +1 plays a rewarded ad first. Coin counter animates.
- **Victory**: horns/confetti burst (in reference art), reward tiles pop in sequentially with gold particles; OK returns to map.
- **Button feedback**: press = translate down by the 5px drop-shadow amount (chunky press), light click SFX.

## State Management
- `screen` / game state: `combat | levelup | wheel | skills | victory`.
- Combat: `timer`, `coins`, `kills`, `bossHp`, `playerHp`, `xp`, `level`, `milestoneProgress`, joystick vector.
- Level Up: three offered skill choices (name, type, isNew, statDelta, currentStars).
- Wheel: `spinCount`, `coins`, wheel result index, ad availability.
- Skills: owned skills list with `{type: active|passive, stars, maxed}`.
- Victory: `chapter`, `kills`, `coins`, reward list `{icon, qty}`.

## Assets
- **Fonts**: Google Fonts — `Luckiest Guy`, `Baloo 2` (weights 500/600/700/800). Swap for licensed game fonts of the same character (rounded chunky display + rounded bold body) if bundling.
- **Sprites (to supply)**: hero portrait, boss, and all item/skill icons are placeholder slots in the prototype (glossy discs / image-slots). Provide real game sprite art at those positions.
- **Icons**: skull/coin are emoji placeholders in the prototype — replace with sprite icons.
- No third-party brand assets used.

## Files
- `Survivor IO UI.dc.html` — all five screens in one file, switchable via the top tab bar. Combat is the default. Logic (screen state + data arrays) is in the component's logic class near the bottom.
