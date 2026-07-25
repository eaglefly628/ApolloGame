# game-103《幸存者》美术素材台本（art spec sheet）

> 供后续 AIGEN / 画师按图生产。每个 art 槽 = 一条台本。槽 id 对齐 `public/games/game-103/art/index.json`，
> 引擎按 `Sprite.textureKey` 直接取图 → **只换 art 文件 + index 条目即换装，无需改代码**。
>
> **统一风格锚**：bright chunky cartoon（Survivor.io 风）—— 明亮饱和 · 圆润 · 厚黑描边 · glossy 高光（radial 高光 + linear 双色相底）· **俯视 / 半侧俯视 2D** · **透明底 PNG**。详见 `docs/design/game-103/survivor-io-ui-kit-handoff.md`（Design Tokens / glossy-disc 配方）。
>
> **关键渲染事实（画师必读）**：game-103 用 `CanvasRenderer`，它对**已就绪的 Sprite 贴图按原样 drawImage 绘制，不做 tint 乘色**（`Color.tint` 只作用于几何占位块）。所以**颜色必须烘进图片本身**，不要交给运行时染色。下方各槽已给出目标烘入色。
>
> **引擎已支持的动画**：`t2-anim-state` 序列帧 + `Sprite.spec.sheet` 精灵表格式（横条 `frameWidth×frameHeight`，`columns`/`count`）。子弹 fx 已用此机制（DCSS 6 帧 / 3 帧横条）。敌人「会走路」= 同一机制出 walk 序列帧横条。

---

## 0. 现状与本次交付（Part A 已做）

| 槽 | 交付前 | 本次(Part A) | 说明 |
|---|---|---|---|
| `103/player` | 程序化 glossy 蓝盘 SVG | 保留 | 已上style，够用到真美术 |
| `103/enemy-shambler` | 程序化 glossy 红blob SVG | **换** 可爱 emoji 👾(1f47e.png) | 预上色·可爱·量大弱怪 |
| `103/enemy-runner` | 缺→占位色块 | **换** 可爱 emoji 👻(1f47b.png) | 飘行感 |
| `103/enemy-brute` | 缺→占位色块 | **换** 可爱 emoji 👹(1f479.png) | 红鬼·壮 |
| `103/enemy-archer` | 缺→占位色块 | **换** 可爱 emoji 👺(1f47a.png) | 天狗·远程辨识 |
| `103/enemy-boss` | 缺→占位色块 | **换** 可爱 emoji 🐉(1f409.png) | 龙·Boss |
| `103/gem-green` | 缺→占位色块 | **补** glossy 绿珠 | 与 gem-blue 同款 |
| `103/gem-gold` | 缺→占位色块 | **补** glossy 金珠 | 与 gem-blue 同款 |
| `103/proj-kunai` | glossy 飞镖 SVG | 保留 | — |
| `103/fx-*`(6) | DCSS 动画帧 | 保留(勿动) | 子弹动画已就绪 |
| `103/proj-{shock,laser,boom,orbit,pet}` · `103/enemy-bolt` | 缺→占位色块 | 未补 | 抽象/形态待真美术·见下 |

Part A 换入的 5 敌人为 **可爱 emoji PNG**（twemoji · CC-BY-4.0 · 72×72 透明底 · 预上色，无需烘色/染色，CanvasRenderer 原样 drawImage 即正确）。诚实定位：**这是「可爱 + 统一 + 好辨识」的过渡皮，非终稿**——emoji 是**单帧静态**，无逐帧动作。真正的观感升级（尤其 owner 要的「会走的怪」）必须靠下方 Part B 生产。共享库无「非像素 + 会走路的卡通怪序列帧」，故过渡阶段止于静态 emoji。

---

## 1. 玩家

### `103/player` — 玩家英雄
- **用途/语义**：俯视主角，屏上恒居中，尺寸小（游戏内约 26×26 显示）。
- **风格**：bright cartoon 俯视英雄·蓝色系(#4aa8ff)·圆润·厚描边·glossy。
- **画布**：128×128（俯视 / 半侧俯视）。
- **动画**：**需要**。walk 4–6 帧循环（脚步/披风摆动）；建议再出 hit 1 帧(受击泛白) + idle 微呼吸 2 帧。横条 `128×N`。
- **配色/烘入**：主蓝 `#4aa8ff`，高光内芯 `#9fd0ff`，深描边 `#16324f`。
- **参考**：Survivor.io 主角、Vampire Survivors 角色。

---

## 2. 敌人（5 种 · 「会动的怪」= P0）

> 各敌 `Sprite.textureKey = <skin>`，theme 里带 `tint`（几何占位用色，非乘图）。真美术**把色烘进图**，tint 供极端回退。Boss 在 theme 里放大 scale。

### `103/enemy-shambler` — 蹒跚者（丧尸 / 软泥群怪）
- **语义**：最基础群怪，成群缓慢逼近。数量最多 → 剪影要在小尺寸下秒辨。
- **画布**：96×96。**动画**：walk 4 帧（左右摇摆蹒跚）+ death 3 帧（瘫软/融化）。
- **配色**：主 `#ff4d5e`(红) · 内亮 `#ff9aa6` · 深描边暗红。
- **参考**：Survivor.io 丧尸群。当前过渡皮 = 👾 emoji(1f47e)。

### `103/enemy-runner` — 疾行者（快速冲刺怪）
- **语义**：移速快、体型瘦小，突进型威胁。剪影要有「前倾冲刺」动势。
- **画布**：96×96。**动画**：run 4–6 帧（大幅摆臂迈腿·比 shambler 快）+ death 3 帧。
- **配色**：主 `#ff9a1f`(橙) · 内亮 `#ffd6a0` · 深描边暗棕。
- **参考**：Survivor.io 冲刺小怪。当前过渡皮 = 👻 emoji(1f47b)。

### `103/enemy-brute` — 蛮兵（高血肉盾）
- **语义**：大体型、慢、高血量肉盾。剪影厚重宽肩，与 runner 形成体型对比。
- **画布**：128×128（比小怪大一圈）。**动画**：walk 4 帧（沉重踏步）+ death 3 帧（倒地）+ 可选 telegraph 2 帧（举手预警）。
- **配色**：主 `#c9a3ff`(浅紫) · 内亮 `#e6ccff` · 深描边深紫。
- **参考**：survivor 精英壮汉。当前过渡皮 = 👹 emoji(1f479)。

### `103/enemy-archer` — 射手（远程放弹）
- **语义**：远程站桩放 `enemy-bolt`。剪影带弓/持械识别特征。
- **画布**：96×96。**动画**：walk 4 帧 + **attack/draw 3 帧**（拉弓→放）+ death 3 帧。
- **配色**：主 `#b07bff`(紫) · 内亮 `#e6ccff` · 深描边深紫。
- **参考**：survivor 远程兵。当前过渡皮 = 👺 emoji(1f47a)。

### `103/enemy-boss` — 首领（大型 Boss）
- **语义**：阶段 Boss，体型远大于杂兵，需威慑感 + 独立血条搭配（HUD 已有 boss HP 条）。
- **画布**：256×256。**动画**：idle 4 帧（呼吸/浮动）+ walk/move 4–6 帧 + attack 3–4 帧 + death 4–6 帧（夸张倒地/爆散）。
- **配色**：主 `#ff4d5e`(红) + **金描边/王冠点缀 `#ffd23f`**（与红色小怪拉开层级）· 内亮 `#ffd6a0`。
- **参考**：Survivor.io 章节 Boss。当前过渡皮 = 🐉 emoji(1f409)。

### `103/enemy-bolt` — 敌方子弹（射手用）
- **语义**：archer 放出的横向飞弹。小、醒目、与玩家子弹配色区分（敌=暖警示色）。
- **画布**：48×48 或横条动画。**动画**：可选 3–4 帧脉动/拖尾。
- **配色**：警示橙红 `#ff5a4a`，白亮核 + 拖尾。
- **参考**：现有 `proj-kunai` 反色暖调版；或复用 DCSS fx 机制出一条敌弹序列。

---

## 3. 经验宝石（3 档 · 掉落拾取）

> 三档同形不同色 + 体型，玩家一眼判价值。已是 glossy 发光圆珠风（与 `gem-blue` 统一），真美术可加更强脉动辉光。

### `103/gem-blue` — 蓝宝珠（低值 value 2）
- **画布**：64×64。**动画**：可选 idle 辉光脉动 2–4 帧。**配色**：`#4aa8ff` glossy + 外发光环。

### `103/gem-green` — 绿宝珠（中值 value 8）
- **画布**：64×64。**配色**：`#7dff4d` glossy + 绿辉光。略大于蓝。

### `103/gem-gold` — 金宝珠（高值 value 30）
- **画布**：64×64。**配色**：`#ffd23f` glossy + 金辉光。最大 + 最亮，建议 4 帧闪烁强调稀有。

---

## 4. 子弹 / 武器投射物

> 子弹**动画序列**已由 DCSS FreeArtLib 供给（`103/fx-*`，6 帧 / 3 帧横条，勿动）。theme `SHOOT_FX` 把武器映射到这些 fx。下列 `proj-*` 静态皮为**无 fx 映射时的回退槽**，多数当前回退占位色块。

- **`103/proj-kunai`**（已有 glossy 飞镖 SVG，保留）：直线穿透飞镖，白亮弹体 + 蓝描边 + 拖尾。128×64 横向。
- **`103/proj-shock`**（缺）：近身 nova 冲击波环。语义=范围爆。建议**环状扩散 3–4 帧**，青蓝 `#7fd0ff`。
- **`103/proj-laser`**（缺）：高速横扫光束。语义=beam。建议细长光束 + 首尾亮闪，红 `#ff5a4a`。
- **`103/proj-boom`**（缺）：回旋镖。旋转 4 帧，金 `#ffd23f`。
- **`103/proj-orbit`**（缺）：环绕光球。glossy 小球，绿 `#7dff4d`，可 2 帧呼吸。
- **`103/proj-pet`**（缺）：宠物随从。小型 cartoon 随从(自带朝向)，紫 `#c9a3ff`，walk 4 帧。
- **fx（保留·勿动）**：`103/fx-magic_dart`(6) · `fx-searing_ray`(6) · `fx-flame`(3) · `fx-sting`(3) · `fx-sandblast`(3) · `fx-gold_sparkles`(3)。均 32×32 横条·srgb。

---

## 5. 命中特效（可选 · 增强打击感）

- **hit-spark**：命中敌人时的小爆闪。3–4 帧，白→黄。32×32 横条。
- **death-puff**：敌人死亡烟尘/血花。3–5 帧。48×48。
- **levelup-burst**：升级金光爆发。可复用 `fx-gold_sparkles` 或单出。
- **pickup-flash**：拾取宝石微闪。2 帧。

> 均走 `t2-anim-state` 序列帧机制。非必需，属打磨层。

---

## 6. 地面 / 背景

- **combat-field bg**：竖屏 9:16，灰渐变基底 `#868a92 → #797d85`（design token）。当前由几何网格线(`gridv/gridh`)构成，非贴图。
- **road / 地砖（可选）**：若要贴图化地面，出**可平铺 tile**（`spec.wrap:'repeat'` + `tiling`），暖灰路面 `#787c84`，边缘内嵌 `#6c7078`。俯视无缝 256×256。
- 备注：地面贴图化为**可选升级**，当前几何网格已够灰盒；优先级低于敌人动画。

---

## 生产优先级

| 级 | 内容 | 理由 |
|---|---|---|
| **P0** | **5 敌人 walk 序列帧**（shambler/runner/brute/archer/boss）+ death 3 帧 | owner 明确要「会动的怪」·最直接决定战斗观感·当前全是静态剪影 |
| **P0** | Boss 全套(idle/move/attack/death) | Boss 是关卡高潮·静态剪影撑不住 |
| P1 | 玩家 walk / hit 序列帧 | 主角恒在屏中央·动起来提升代入 |
| P1 | 3 宝石辉光脉动 + archer attack 帧 | 打磨拾取反馈与远程识别 |
| P2 | proj-{shock/laser/boom/orbit/pet} 静态皮 + enemy-bolt | 多数已被 DCSS fx 覆盖·回退槽补齐即可 |
| P2 | 命中/死亡/升级特效 | 打击感打磨层 |
| P3 | 地面/road 可平铺贴图 | 几何网格已够用·锦上添花 |

## 引擎已支持（画师产出对接口径）

- **精灵表格式**：横条排列，一行 N 帧。index 条目 `spec.sheet = { frameWidth, frameHeight, columns, count }`（现 fx 用 32×32×6/×3）。敌人 walk 建议 `64×64` 或 `96×96` 每帧，横条 `frameWidth×count` 宽。
- **命名动画 / 状态机**：`t2-anim-state` 驱动 idle/walk/attack/death 切换（帧率 `fps`）。theme `SHOOT_FX` 是「武器→fx 序列」映射先例，敌人可同法建「敌种→动画」映射。
- **透明底**：所有 sprite 用透明 PNG（或 SVG）。
- **换装零改码**：产出后落 `public/games/game-103/art/`，在 `index.json` 加/改 `filled` 条目（`spec.usage:'sprite'`，动画填 `spec.sheet`），游戏自动生效。
- **许可**：仅收 CC0 / 自产 / 明确授权；来源与作者写进条目 `license` + `provenance`（当前敌人过渡皮 = twemoji CC-BY-4.0·须保留署名）。
