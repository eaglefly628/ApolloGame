# game-q《Neon Siege》美术生成单（完整·可直接喂管线）

> 2D 俯视塔防的全部美术需求。每条=**已拼好的完整英文提示词**（copy 即用）+ 尺寸 + spec + 优先级。
> 生成器：`node scripts/ai-gen.mjs qwen "<提示词>" --game game-q --id <编号>`（wanx·1024² PNG）。
> 统一负向提示词（每条都带）：
> `text, watermark, signature, people, hands, 3/4 view, isometric, perspective, realistic photo, muted colors, cluttered, drop shadow, background scenery`
> 调色板：青 #33c2e8/#38bdf8 · 品红 #f472b6 · 玉绿 #2fbf87 · 敌粉红 #ff5c7a · 敌琥珀 #ffd23f · 敌紫 #c084fc · 金 #fbbf24 · 暗底 #05080f
> 现状：game-q 全程序化（Shape/Color）→ 生成后给对应 body 加 `Sprite:{textureKey:'art:<编号>'}`（保留 Shape 作碰撞+占位·fail-soft）。

---

## A. 演员精灵（P0·6 张核心 + pad）· 1024²·透明底·usage:sprite·wrap:clamp

**q-spr-01 · 脉冲塔 tower_pulse** · 显示 44×44 · 优先 **P0**
```
top-down 2D game sprite, neon synthwave sci-fi, Tron-like, dark background, emissive glowing edges, clean vector shapes, high contrast, centered, transparent background, neon defense tower, cyan #38bdf8 glowing hexagonal turret with a bright glowing core, symmetrical, viewed directly from above
```

**q-spr-02 · 轨道炮 tower_cannon** · 显示 52×52 · 优先 **P0**
```
top-down 2D game sprite, neon synthwave sci-fi, Tron-like, dark background, emissive glowing edges, clean vector shapes, high contrast, centered, transparent background, heavy rail cannon turret, magenta #f472b6 glowing, twin energy barrels, bulky armored base, symmetrical, viewed directly from above
```

**q-spr-03 · 基础敌 enemy_basic** · 显示 30×30 · 优先 **P0**
```
top-down 2D game sprite, neon synthwave sci-fi, Tron-like, dark background, emissive glowing edges, clean vector shapes, high contrast, centered, transparent background, small hostile drone enemy, round pink-red #ff5c7a glowing orb with a darker core, simple, viewed directly from above
```

**q-spr-04 · 快速敌 enemy_fast** · 显示 26×26 · 优先 **P0**
```
top-down 2D game sprite, neon synthwave sci-fi, Tron-like, dark background, emissive glowing edges, clean vector shapes, high contrast, centered, transparent background, fast scout enemy drone, amber #ffd23f glowing diamond dart shape, sleek and pointed, viewed directly from above
```

**q-spr-05 · 重装敌 enemy_tank** · 显示 38×38 · 优先 **P0**
```
top-down 2D game sprite, neon synthwave sci-fi, Tron-like, dark background, emissive glowing edges, clean vector shapes, high contrast, centered, transparent background, heavy tank enemy drone, purple #c084fc glowing hexagonal armored hull, chunky and bulky, viewed directly from above
```

**q-spr-06 · 大本营 base** · 显示 64×128（竖·方图里居中竖构图·两侧透明） · 优先 **P0**
```
top-down 2D game sprite, neon synthwave sci-fi, Tron-like, dark background, emissive glowing edges, clean vector shapes, high contrast, centered, transparent background, energy core home base, jade-green #2fbf87 glowing reactor structure, hexagonal, imposing, tall vertical structure, viewed directly from above
```

**q-spr-07 · 建造位 pad** · 显示 46×46 · 优先 P1
```
top-down 2D game sprite, neon synthwave sci-fi, Tron-like, dark background, emissive glowing edges, clean vector shapes, high contrast, centered, transparent background, circular build pad platform, dark hexagon with cyan #33c2e8 glowing rim and a bright center node, viewed directly from above
```

---

## B. 场景精灵（P1）

**q-spr-10 · 地板 field-bg** · 960×560 显示（gen 1024²·裁中心 or adapter 加 size 参）· **不透明**·usage:sprite·wrap:repeat · 优先 P1
> 地板**不画路**——车道由程序化 Shape 叠其上（随主题色换皮）。
```
top-down 2D game background, neon synthwave sci-fi arena floor, dark navy, faint cyan #33c2e8 tech grid, subtle circuit etching, even flat lighting, seamless, no path, no road, no characters, no buildings
```

**q-spr-11 · 出生门 spawn_portal** · 显示 40×40 · 透明底 · 优先 P1
```
top-down 2D game sprite, neon synthwave sci-fi, Tron-like, dark background, emissive glowing edges, clean vector shapes, high contrast, centered, transparent background, glowing teleport portal, swirling pink-red #ff5c7a energy ring, radial, viewed directly from above
```

---

## C. UI 美术（P1–P2·LayoutNode Image/Avatar 的 src）· 透明底·usage:sprite

**q-ui-02a · 生命图标** · 优先 P1
```
flat game UI icon, neon synthwave, glowing, single icon, centered, transparent background, simple, high contrast, heart shield icon, jade-green #2fbf87
```
**q-ui-02b · 金币图标** · 优先 P1
```
flat game UI icon, neon synthwave, glowing, single icon, centered, transparent background, simple, high contrast, hexagon coin icon, gold #fbbf24
```
**q-ui-02c · 波次图标** · 优先 P1
```
flat game UI icon, neon synthwave, glowing, single icon, centered, transparent background, simple, high contrast, two crossed energy swords icon, cyan #33c2e8
```
**q-ui-03a · 脉冲塔买钮缩略** · 优先 P1
```
flat game UI icon, neon synthwave, glowing, single icon, centered, transparent background, simple, high contrast, pulse tower icon, cyan #38bdf8 spire turret
```
**q-ui-03b · 轨道炮买钮缩略** · 优先 P1
```
flat game UI icon, neon synthwave, glowing, single icon, centered, transparent background, simple, high contrast, rail cannon icon, magenta #f472b6 turret
```
**q-ui-05a · 胜利徽标**（无文字） · 优先 P2
```
flat game emblem, neon synthwave, transparent background, centered, jade-green #2fbf87 laurel wreath with a radiant energy burst, no text, no letters
```
**q-ui-05b · 失败徽标**（无文字） · 优先 P2
```
flat game emblem, neon synthwave, transparent background, centered, cracked broken red #ff5c7a energy core, ominous, no text, no letters
```
**q-ui-04 · HUD 面板纹**（可平铺·不透明） · usage:sprite·wrap:repeat · 优先 P2
```
seamless tileable dark sci-fi HUD panel texture, thin cyan #33c2e8 glowing trim, neon synthwave, no text
```
> **标题 logo 不生成**（wanx 糊字）——保留现 display 艺术字「NEON SIEGE」。

---

## D. 特效精灵（P3·可选·默认保留程序化淡出·不生成）

> 现命中闪/死亡爆闪=Shape 圆 + Tween 淡出（塔/敌主题色驱动·换皮随调色板成套）。要更炸才上帧表：

**q-spr-20 · 命中火花帧表**（4 帧横排·透明底） · 优先 P3
```
top-down 2D VFX sprite sheet, 4 frames in a horizontal row, cyan #33c2e8 energy impact spark burst animation, additive glow, transparent background, neon synthwave
```
**q-spr-21 · 死亡爆炸帧表**（6 帧横排·透明底） · 优先 P3
```
top-down 2D VFX sprite sheet, 6 frames in a horizontal row, explosion burst dispersing outward, additive glow, transparent background, neon synthwave
```

---

## E. 音频（冲刺后·纲领已压后 B 件·非图像·此为音效设计描述）

**q-aud-01 · SFX ×6**（现 synth 兜底可用）· 冲刺后
- build 建塔：short bright synth "power-up" chime, rising
- fire 开火：short electric zap / laser pulse
- hit 命中：crisp digital tick / impact blip
- death 死亡：small glitchy synth explosion
- win 胜利：ascending arpeggio synth fanfare
- lose 失败：descending detuned synth drone

**q-aud-02 · BGM**（无·冲刺后）
- looping synthwave / darksynth track, driving arpeggio, ~110bpm, tense but cool

---

## 汇总

| 优先 | 条目 | 件数 | 管线 |
|---|---|---|---|
| **P0** | q-spr-01..06（两塔+三敌+大本营） | **6** | wanx |
| P1 | q-spr-07,10,11 · q-ui-02a/b/c · q-ui-03a/b | 8 | wanx |
| P2 | q-ui-04,05a,05b | 3 | wanx |
| P3（可选） | q-spr-20,21（特效帧表） | 2 | wanx |
| 冲刺后 | q-aud-01,02 | — | 文本→音频 |
| 保留程序化（0 生成） | 车道 · 命中闪 · 死亡爆闪 · HUD 主体 | 0 | 引擎/主题色 |

**最小真皮化 = 6 张（P0）**。全量含 UI/特效 ≈ 19 张 wanx 图 + 音频（冲刺后）。换皮 = 换风格前缀重跑同一批。
