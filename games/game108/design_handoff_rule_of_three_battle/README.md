# Handoff: 拳律 Rule of Three — 横版对局屏 (Landscape Battle Screen)

## Overview

Single-screen battle UI for game108《拳律 Rule of Three》— rock-paper-scissors where **charging is public**. Each round runs three timed phases (T1 蓄力 3s → T2 出招 3s → T3 对决 2s) plus a 1s settle (T4).

Core loop: tap a hand to add +1 charge layer (max 3, publicly visible to the opponent) → throw any hand (not necessarily the charged one — this is the bluff vector) → RPS beats-relation decides the winner, charge level decides damage (10 / 20 / 30 / 40). A thrown hand resets to 0; an unthrown hand keeps its charge. Both players have 100 HP; a fully-charged hit is 40% of a health bar.

The design's whole job: make **"where the opponent is storing power"** the thing the player stares at. Six charge slots (three per side) are on screen at all times.

## About the Design Files

The files in `design/` are **design references created in HTML** — a prototype showing intended look and behaviour, not production code to copy. The task is to **recreate this design in the game's own UI environment**.

Important: this game's UI is a **closed-set, data-driven widget system** (panels, buttons, text, progress bars, badges, tags, images, particles, avatars, portrait slots, connectors, anchored overlays), not free HTML/CSS. Everything in this design was drawn to map onto that widget set. Where the HTML uses SVG to draw the hands, the shipped version should use **replaceable texture assets** (see Assets).

`design/battle-screen.dc.html` opens directly in a browser (it loads `support.js` from the same folder). Use it as the interactive source of truth: the toolbar at the top switches between the four phases plus the endgame panel, and toggles the percentage-annotation overlay.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, layout percentages and phase states. Recreate pixel-proportionally at 1920×1080 and scale. Exceptions, all called out below: the six hand shapes are vector stand-ins for real texture art, and the background scene is a simple gradient/shape composition standing in for a painted 青草地 backdrop.

---

## Canvas

**1920 × 1080, 16:9, landscape.** All coordinates below are given in absolute px on that canvas, with the canvas-percentage equivalent in parentheses. The whole stage scales uniformly to fit the viewport (`transform: scale()` on a fixed 1920×1080 root).

Vertical bands:

| Band | y (px) | y (%) |
|---|---|---|
| ① Top bar | 0 – 97 | 0 – 9% |
| Play field (hands) | 150 – 790 | 13.9 – 73.1% |
| ⑤⑥⑦ Bottom bar | 800 – 1080 | 74 – 100% |

---

## Screens / Views

There is **one screen** with five states: T1, T2, T3, T4 and the endgame overlay.

### ① Top bar (y 0–97)

Background `linear-gradient(180deg, rgba(24,17,12,.86), rgba(24,17,12,.62))`, bottom border `4px solid #3F2B1E`. Horizontal flex, `padding: 0 18px`, `gap: 14px`.

| # | Element | Width | Content | Spec |
|---|---|---|---|---|
| 1 | Your identity plate | 230px block | 「你」 | bg `#23B5A0`, border `4px #3F2B1E`, radius 10, padding `4px 16px`, 30px ZCOOL KuaiLe, text `#08312C`, shadow `0 4px 0 #14776A`. Followed by a 34×34 skin swatch `#F9E2C8`, radius 8, border 3px. |
| 2 | Your HP | 290px | bar + number | Track 22px tall, `#2B211A`, border `3px #3F2B1E`, radius 999. Fill `linear-gradient(180deg,#5FE8CD,#1F9C89)`, width = HP%. Number 38px Fredoka 700 `#7DEFD6`, `/100` at 15px `#8C7A68`. |
| 3 | Round + phase + timer | flex:1, centred | 「第 N 回合」· ring · phase chip | Round 26px `#E8D9C2`. Ring 78×78 `conic-gradient(<accent> <pct*3.6>deg, rgba(255,255,255,.14) 0)` with a 60px `#1B1410` disc holding the seconds (24px Fredoka 700) and 「秒」(10px `#8C7A68`). Phase chip 34px on `#FFC93C`, border `5px #3F2B1E`, radius 12, padding `2px 26px`, shadow `0 5px 0 rgba(0,0,0,.4)`. |
| 4 | Opponent HP | 290px, right-aligned | mirror of #2 | Fill `linear-gradient(180deg,#FF9A8A,#D0342B)`, right-anchored (bar drains toward the outside edge). Number `#FF9A8A`. |
| 5 | Opponent identity plate | 230px | 「赌徒」 | bg `#E0483F`, text `#FFF2EC`, shadow `0 4px 0 #94261F`; 34×34 skin swatch `#F0A468`. |
| 6 | Settings gear | 52×52 at (1848, 112) | ⚙ | `#FFF6E2` disc, border `4px #3F2B1E`, shadow `0 4px 0 rgba(0,0,0,.3)`. Deliberately small. |

**Countdown ring** — accent is `#FFC93C` normally and switches to `#FF5A45` when under one third remaining; the phase chip and the seconds number switch with it. This is a hard requirement: the player must know how long they have left to act.

### ③ The two hands (the subject)

- **Left hand = you, right hand = opponent. Never swapped.**
- Each hand occupies a **640 × 640 box**: left box at `left: 250, top: 150` (13.0–46.4% × 13.9–73.1%); right box mirrored at `right: 250`.
- **Single palm measures 366 × 476 px = 19.1% × 44.1% of canvas**, palm centre lands at y ≈ 47%. This is slightly narrower than the brief's 22.4% × 45.4% — the knuckle capsules extend toward the centreline, so the two hands plus forearms still fill the intended span, and the palm centre stays fixed across all three gestures.
- **Forearms** are separate pieces: `430 × 158 px` bars flush to the left/right screen edges at `top: 420` (x 0–22.4% and 77.6–100%, y 38.9–53.5%). They tuck **behind** the hand and are cut off by the screen edge. No shoulders, no bodies.
- **Colour separation is the identity cue.** You: cream skin `#FFF3E2 → #FBE4CB → #EFCDA9` with outline `#6B4A3A`. Opponent: orange skin `#FDBC86 → #F79F62 → #E9834A` with outline `#B5501A`. The outline colour alone must be enough to tell whose hand is whose at a glance.
- Outline weight 15px in the 700-unit viewBox (≈ 13.7px on canvas). Every hand carries a white highlight ellipse at ~45% opacity (34% on the orange hand) on the upper-left of the palm.
- Drop shadow on each hand: `0 16px 16px rgba(0,0,0,.22)`.

Three gestures × two colourways = **6 hand assets**. The right side's colourway must be swappable — five opponents ship later (复读机 / 莽夫 / 戏子 / 赌徒 / 拳律大师) and only the palette changes, not the geometry.

### ④ Centreline zone (x 883–1037, 46–54%)

Empty by default — literally the gap between the two hands.

**Rule slab** at `left: 883, top: 172`, width 154. Panel `#6D6257`, border `5px #3F2B1E`, radius 12, `inset 0 3px 0 rgba(255,255,255,.22)` + `0 6px 0 rgba(0,0,0,.3)`. Header 「判定表」15px `#F2E6D2`, then three 24px rows 石›剪 / 剪›布 / 布›石 with the `›` in `#FFC93C`. Caption chip below: 「道具可凿裂重刻」11px on `rgba(255,255,255,.7)`. Items can rewrite this table in-match (e.g. invert the whole ring) — that rewrite needs a "chiselled and re-carved" treatment.

**Result banner** (T3/T4 only) — a centred column at `left: 460, top: 392`, width 1000, `animation: pop .35s cubic-bezier(.2,1.4,.4,1)`:
1. Verdict chip 「布 › 石」— 52px, `#FFF8E7` on `#8E44AD`, border `6px #3F2B1E`, radius 999, padding `2px 40px`.
2. **Damage number** — Fredoka 700, `line-height: .86`, colour `#FFC93C` when you win / `#FF6A58` when you're hit, `text-shadow: 0 5px 0 #3F2B1E, 0 0 34px rgba(255,201,60,.6)`.
3. Result line 「你赢了这回合」— 38px `#FFF8E7` on `rgba(24,17,12,.86)` pill, border `6px #3F2B1E`, padding `6px 40px`.

**Damage number size scales with the value**: `fontSize = 56 + damage × 2.1` px. So -10 → 77px, -20 → 98px, -30 → 119px, -40 → 140px. A 40 is four tenths of a health bar and must not look like a 10.

### ⑥ Charge slots — opponent (top-right compact strip)

Anchored at `right: 112, top: 110`, width 620. Plate `rgba(24,17,12,.62)`, border `3px #E0483F`, radius 14, padding `7px 10px`, `backdrop-filter: blur(2px)`. Left label 「赌徒/蓄力」19px `#FF9A8A`, then three equal chips.

Each chip: bg `rgba(255,246,226,.94)`, border `3px #3F2B1E`, radius 9, padding `5px 9px`, `gap: 7px` — hand icon 28×34, three pips (`flex:1`, 9px tall, radius 3, border 2px; filled `#E0483F`, empty `rgba(63,43,30,.18)`), reading `n/3` at 19px Fredoka 700 `#5D4A3A`.

**Full (3/3) is a state change, not a number change**: the whole chip switches to `linear-gradient(180deg,#FFE9A8,#FFD45E)` and the reading goes `#A8720B`.

**Threat line** below the strip (T1/T2 only): 「⚠ 他攒满了一手石 · 被打中要掉四成血」— 21px `#FFF2EC` on `#E0483F` pill, border `4px #3F2B1E`, the gesture name in `#FFC93C`.

> **Deviation from the brief, deliberate and owner-approved.** §2.4 requires the opponent's slots to carry *no less* visual weight than the player's. This design does the opposite — the player's slots are the heavy element and the opponent's are a compact strip — at the owner's explicit request. The opponent strip retains the full-charge gold state and the threat banner so the read is still unmissable. Flag if you want this rebalanced.

### ⑤ Move cards (bottom bar, left)

Three cards, 186px wide, full bar height, `gap: 12px`. Card: `#FFF6E2`, border `5px #3F2B1E`, radius 16, shadow `0 7px 0 rgba(0,0,0,.4)`.

- Colour strip across the top (20px text, white, `text-shadow: 0 2px 0 rgba(0,0,0,.3)`, bottom border `4px #3F2B1E`): 石 `#2F7FD0`, 布 `#31A83F`, 剪 `#C8214F`.
- Icon 96×104 centred, `drop-shadow(0 4px 4px rgba(0,0,0,.18))`.
- Subtitle strip at the bottom: `rgba(63,43,30,.08)`, top border `3px rgba(63,43,30,.25)`, 22px (26px in T2).

**Same three keys, different meaning per phase:**

| Phase | Meaning | Subtitle |
|---|---|---|
| T1 蓄力 | +1 layer to this hand | 「蓄力 → 20」(damage after this layer lands) |
| T2 出招 | throw this hand | 「打 30」(damage if thrown now) |
| T3 / T4 | not clickable | 「本回合不可点」, greyed |

- **A slot already at 3/3 disables its card in T1**: bg `#CFC3B0`, opacity .62, `cursor: not-allowed`, subtitle 「已满 · 点不动」, and a `#E0483F` 「满」badge at the top-right corner.
- **Submitted state** (T2, after tapping): `outline: 6px solid #FFC93C`, card translates down 5px, shadow collapses to `0 2px 0 #C9932A`, and a `#FFC93C` 「已提交」badge appears. There are two seconds of dead air between submitting and the reveal — this state has to carry them.

### ⑥ Charge slots — yours (bottom bar, centre, the heavy element)

Container `flex: 1`, bg `rgba(35,181,160,.16)`, border `5px #23B5A0`, radius 18, padding `10px 14px`, `gap: 12px`. Left label 「我的/蓄力」27px `#7DEFD6` in a 46px column.

Three slots, `flex: 1` each. Slot: `#FFF6E2`, border `5px #3F2B1E`, radius 16, shadow `0 6px 0 rgba(0,0,0,.4)`, padding `12px 16px`, column with `gap: 12px`:
- Row: icon 56×62 · name 26px 「石 石头」+ 「现在打 20」16px Fredoka `#7A6553` · reading `n/3` 38px Fredoka 700 `#5D4A3A`, min-width 78px, right-aligned.
- Pip row: three bars, `flex: 1`, 20px tall, radius 6, border `3px #3F2B1E`; filled `#23B5A0`, empty `rgba(63,43,30,.18)`.

**Full (3/3)**: whole slot becomes `linear-gradient(180deg,#FFE9A8,#FFD45E)`, pips go `#FFC93C`, reading `#A8720B`, and the slot runs the `glow` pulse (below).

### ⑦ Smoke button (bottom bar, right)

270px wide, `#FFF6E2`, border `5px #3F2B1E`, radius 16, shadow `0 7px 0 rgba(0,0,0,.4)`. Centred column: 💨 at 52px, 「烟雾 ×2」at 27px, sub-line 14px `#7A6553`.

- Available: 「遮蔽我方三槽 2 回合」
- Unavailable (T3/T4, or charges exhausted, or already active): bg `#CFC3B0`, opacity .6, sub 「对决中不可用」

Spending one charge hides **your** three slots from the opponent for 2 rounds; you still charge normally. While active it needs an explicit "currently masked" treatment on the opponent's view of your slots.

### ⑦ Endgame overlay

Full-screen `rgba(16,11,8,.78)`. Panel 840px wide, `linear-gradient(180deg,#FFF6E2,#F4E2C4)`, border `9px #3F2B1E`, radius 28, padding `44px 56px`, shadow `0 20px 0 rgba(0,0,0,.35)`, `animation: pop .4s`.

- Title 「你赢了」96px `#23B5A0`, `text-shadow: 0 6px 0 #3F2B1E`.
- Two stats separated by a 3px `#D8C3A2` rule: 「7 回合」/「30 剩余血量」— numbers 52px Fredoka 700 `#3F2B1E`, labels 18px `#7A6553`.
- 「再来一局」button — `#FFC93C`, border `6px #3F2B1E`, radius 18, padding `14px 60px`, 44px text, shadow `0 8px 0 #C9932A`.

**The bottom bar is removed entirely in this state** (`showHud = false`). The previous version left the match keys lit but inert — a dead end. Do not reproduce that.

---

## Interactions & Behavior

### Phase table

| Phase | Duration | Hands | Cards | Slots |
|---|---|---|---|---|
| T1 蓄力 | 3s | idle fist, static | charge keys, live subtitles | both sides tick live |
| T2 出招 | 3s | **shaking** (see below) | throw keys; submitted state after tap | frozen |
| T3 对决 | 2s | open into the actual gesture and push toward the centre | disabled, greyed | frozen |
| T4 结算 | 1s | hold the revealed gesture | disabled | thrown hand resets to 0; HP lands |

### Animations

**1. Entry (伸入)** — hands extend in from the left and right edges as a horizontal push. Not a fade, not a pop.

**2. Shake (摇拳, T2) — the rhythm of the game, not decoration.**
```
3 beats × 200ms = 600ms per cycle, 5 cycles fill the 3s phase
translateY: 0 → −34px → +6px → −22px → 0    (canvas −3.1% / +0.6%)
rotate:     −9° → +4° → −6° → +3° → −9°
scale:      1 → 1.06 → .97 → 1.04 → 1
transform-origin: outer edge (left for you, right for the opponent)
easing: ease-in-out
```
The right hand runs the same curve with **rotation negated** (mirrored phase). Both hands land back on the idle pose.

> **Engine gap `REQ-108-UI-02`.** The current animation vocabulary has 上下浮动, 缩放脉冲, 自旋 and 入场平移, but no *looping rotate + scale wobble*, and one element can only carry one animation. This design needs both on the same element. Ticket is filed; the design is drawn to requirement, not to the current engine.

**3. Reveal (出招)** — after the shake settles, the hand opens into the actual gesture and holds. In the prototype: `translateX ±26px, .28s cubic-bezier(.2,1.4,.4,1)`.

**4. Full-charge glow** — on a 3/3 slot:
```
@keyframes glow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,201,60,.9), 0 6px 0 #3F2B1E }
                  50%     { box-shadow: 0 0 0 12px rgba(255,201,60,0), 0 6px 0 #3F2B1E } }
duration 1.4s, ease-out, infinite
```

**5. Banner pop** — `scale(.4) opacity 0 → scale(1.12) at 60% → scale(1)`, `.35s cubic-bezier(.2,1.4,.4,1)`.

### Rules the UI has to enforce

- Card is disabled in T1 when its slot is already 3/3 — the tap must do nothing and look like it does nothing.
- All three cards are disabled in T3/T4.
- The thrown hand's slot resets to 0 in T4; the unthrown hand keeps its charge.
- Damage = `10 + layers × 10` (10 / 20 / 30 / 40).
- Beats: 石 > 剪 > 布 > 石. Charge level only decides how much a win hits for.
- Tie: no damage either side, banner reads 「平局 · 双方都不掉血」.
- The endgame overlay removes the match controls.

---

## State Management

```
phase        : 't1' | 't2' | 't3' | 't4' | 'end'
round        : int
timer        : float seconds remaining in phase
youHp/oppHp  : 0–100
youSlots     : { rock, paper, scissors } → 0–3
oppSlots     : { rock, paper, scissors } → 0–3   (masked while smoke is active)
submitted    : 'rock' | 'paper' | 'scissors' | null   (cleared each round)
youThrow/oppThrow : revealed in T3
smokeCharges : int (starts at 2)
smokeActive  : rounds remaining
result       : { verdict, text, damage, win } | null
```

Transitions are purely timer-driven: T1(3s) → T2(3s) → T3(2s) → T4(1s) → T1 of the next round, until either HP hits 0 → `end`.

---

## Design Tokens

**Colours**

| Token | Hex | Use |
|---|---|---|
| ink | `#3F2B1E` | every outline, every border |
| cream | `#FFF6E2` | card / slot / button faces |
| gold | `#FFC93C` | phase chip, full-charge, submitted, primary CTA |
| gold-deep | `#C9932A` / `#A8720B` | gold shadow / gold-on-cream text |
| danger | `#FF5A45` | timer under one third |
| you-accent | `#23B5A0` | your identity, HP, slot border, pips |
| you-accent-lt | `#7DEFD6` | your HP number, labels |
| you-accent-dk | `#14776A` / `#08312C` | plate shadow / plate text |
| opp-accent | `#E0483F` | opponent identity, HP, slot border, threat |
| opp-accent-lt | `#FF9A8A` | opponent HP number, labels |
| opp-accent-dk | `#94261F` | plate shadow |
| verdict | `#8E44AD` | verdict chip |
| card-rock | `#2F7FD0` | 石 card strip |
| card-paper | `#31A83F` | 布 card strip |
| card-scissors | `#C8214F` | 剪 card strip |
| skin-you | `#FFF3E2 → #FBE4CB → #EFCDA9` | your hand, outline `#6B4A3A` |
| skin-opp | `#FDBC86 → #F79F62 → #E9834A` | opponent hand, outline `#B5501A` |
| hud-plate | `rgba(24,17,12,.86 → .62)` | top bar / bottom bar |
| body-text | `#E8D9C2` / `#7A6553` / `#8C7A68` | primary / secondary / tertiary |

Scene: sky `#5FC2EE → #9FDCF7 → #D9F1FF`; hills `#6FB84E`, `#63AC46`; grass `#8CCF55 → #77BD45` with `repeating-linear-gradient(102deg, rgba(255,255,255,.09) 0 46px, transparent 46px 108px)`.

**Typography**

- Chinese / display: **ZCOOL KuaiLe** (站酷快乐体) — a cartoon Chinese face. Everything reads in it except numerals.
- Numerals / Latin: **Fredoka** 500/600/700 — HP, timer, damage, `n/3`, minor captions.
- Scale on the 1920×1080 canvas: 96 (endgame title) · 52 (verdict, endgame stats) · 44 (CTA) · 38 (HP, slot reading, result line) · 34 (phase chip) · 30 (identity plates) · 27–26 (labels, slot names) · 24 (rule table) · 22–21 (card subtitle, threat) · 19–15 (secondary) · 14–10 (captions). Damage number is dynamic, 77–140px.
- Nothing on this screen goes below 10px on the 1920 canvas — but see the brief's floor of 24px for slide text; here the smallest live-readable element is the 15px rule-slab header.

**Radii** 999 (pills) · 28 (endgame panel) · 18 (my-slot container, CTA) · 16 (cards, my slots, smoke) · 14 (opponent strip) · 12 (phase chip, rule slab) · 9–10 (opponent chips, HP swatch) · 6 (my pips) · 3 (opponent pips)

**Borders** 9px (endgame panel) · 6px (verdict chip, CTA, submitted outline) · 5px (cards, slots, smoke, rule slab) · 4px (identity plates, threat, gear) · 3px (opponent chips, HP track)

**Shadows** — flat cartoon offsets, never blurred: `0 8px 0 #C9932A` (CTA) · `0 7px 0 rgba(0,0,0,.4)` (cards, smoke) · `0 6px 0 rgba(0,0,0,.4)` (my slots) · `0 5px 0 rgba(0,0,0,.35)` (phase chip, threat) · `0 4px 0` (identity plates, gear) · `0 20px 0 rgba(0,0,0,.35)` (endgame panel).

---

## Assets

### Shipped in this bundle

`design/hands/icon_rock.png` · `icon_paper.png` · `icon_scissors.png` — front-facing hand icons (~195×236, 218×245, 162×236 px, transparent PNG). Used at 96×104 on the move cards, 56×62 on your charge slots, 28×34 on the opponent strip. These were cut from the owner's own reference art.

### To be produced

**6 hand textures = 3 gestures × 2 colourways.** Export at **1280×1280 @2x**, naming `hand_{rock|paper|scissors}_{L|R}.png`.

- On canvas each drops into a **640×640 box**; left box at `left: 250, top: 150`, right box mirrored at `right: 250`.
- Palm reads **366×476 px** on canvas (19.1% × 44.1%), palm centre at **34% / 53% of the box** = y ≈ 47% of canvas. **The palm centre must not move between gestures** — the swap has to look like the same hand changing shape, not a different sprite.
- Fingers extend toward the centreline; the wrist edge sits at the box's outer side.
- **Forearms are a separate piece** (430×158 on canvas, `top: 420`, flush to the screen edge) and must not be baked into the hand texture — the hand box moves during the shake, the forearm doesn't.
- Colourway is the swappable axis (palm and forearm share one palette). Five opponents ship later; only the palette changes.
- **Shake intermediate frames**: if the engine can't do the transform wobble, supply the mid-frames of the 3-beat cycle as sprites.

**Background.** The prototype's 青青草地 scene (sky gradient, two hill ellipses, striped grass, scattered flowers, a small bush) is a stand-in for painted art. Brief: a date-spot meadow, bright and warm. It must not compete with the hands for attention — keep values light and contrast low behind the hand silhouettes.

**Fonts.** ZCOOL KuaiLe and Fredoka are loaded from Google Fonts in the prototype. Bundle them locally for the game build, or substitute the project's own cartoon Chinese face + rounded numeral face.

---

## Files

```
design_handoff_rule_of_three_battle/
├── README.md                        ← this file
├── design/
│   ├── battle-screen.dc.html        ← the prototype; open in a browser
│   ├── support.js                   ← runtime the prototype needs (do not port)
│   ├── original-brief.md            ← the owner's original commission
│   └── hands/                       ← the three hand icons, transparent PNG
└── screens/
    ├── T1-charge.png
    ├── T2-strike.png
    ├── T3-duel.png
    ├── T4-settle.png
    ├── endgame.png
    └── annotations.png              ← the percentage-annotation overlay
```

In the prototype, the toolbar above the stage switches phases and toggles the annotation layer. Both are review scaffolding and are not part of the game screen.
