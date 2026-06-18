# Session 交接 · 引擎主程/Lead（2026-06-18）

> 你接手 Apollo Engine 的**引擎主程/Lead**。先读最高纲领 `docs/design/data-driven-manifesto.md` 与 `CLAUDE.md`，再读本文。
> 本文 = 上一任 Lead 本 session 的全部决策 + 现状 + 残留 TODO + **新战略方向**。

---

## 0. 操作规则（钉死，必须继承）

1. **只动引擎**：`src/{engine,skills,assembly,renderer,services,net,ui,runtime}`。**不碰游戏本身**（game-a..g 的数据/玩法/手写层）——那是各游戏 program 的 lane。
2. **每条需求先评判，绝不"提什么做什么"**：能现有 capability 重组/已覆盖 → **回驳**（给等价数据写法）；确属表达不了的真缺口 → 才**下沉成通用 capability**。**防臃肿是头号红线**（rule-of-three、不为想象需求拓宽）。
3. **分支 `claude/mainbranch` 直推**；每次 `fetch → rebase → 重跑全套 → push`；**tsc + vitest + build 全绿才推**（陈旧基线的绿不算绿，rebase 带进代码必重跑）；署名 `Claude <noreply@anthropic.com>`，提交信息以 session URL 结尾，**产物里不写模型标识**。远端多 session 并行很活跃，push 常被拒 → rebase 重试（docs-only 增量可只过 tsc）。

---

## 1. 本 session 推进 mainbranch 的引擎工作（全绿已推）

| 主题 | 落地 |
|---|---|
| **通用 3D 渲染后端**（⭐ 与下方新方向直接相关） | `src/renderer/three-renderer.ts`（`ThreeRenderer implements RendererBackend`，消费**共享 `Renderable`**：Shape/Sprite/Color/Text→3D、Transform+zOrder→位姿、相机自适配）+ `three-projection.ts`（纯 2D→3D 映射，node 可测）。**刻意不进 `@renderer` barrel**（three ~150KB 不污染 2D bundle）。**为什么 SVG 不 PNG**：node 无 GL → 看帧用 SVG。 |
| **SVG 帧投影 + 视觉回归** | `src/renderer/frame-svg.ts`（`collectRenderables → SVG 一帧`，无 DOM/GL、确定、可版本控制/浏览器看/可 diff）+ game-f `toMatchFileSnapshot` golden（`__frames__/*.svg`）。 |
| **Loop B 全路径回归**（截图回归工作流） | `src/runtime/fullpath-probe.ts`：无头确定性「点遍声明按钮」探针（`collectButtons` 枚举信号 → fire → tick → 断言 no-throw / no-NaN(`scanNonFinite`) / 两遍 hash 一致）+ **BFS 状态图爬**（`crawlStates`：snapshot/restore 分支、stateKey 去重、`expand` 把连续态当叶、maxStates/maxDepth 双闸、报错附复现路径）。game-f 实测全绿。 |
| **REQ-F-065**（per-caster scaleByResource） | **源 threading**：`SpawnRequest.source`/`PrefabOrigin.source`（caster=originEntity、self-rule=自身 盖章 → prefab 转记）；`hitbox.ts` `findScaleResource`：scaleByResource **先查施法者本地**（源 + 同次展开复合兄弟，同 templateId+seq）→ **未命中回退全局**（零迁移）。装备 atk 异质缩放 + 退星级模板族的引擎前置。 |
| **REQ-E-021**（卡牌附魔 = per-card buff） | `Card.mods?:{op,target,value}[]` + `Card.retrigger?`（`cardboard.ts`）；`card-scoring` 逐张循环：baseChips 后、PerCardRule 前按序套 `c.mods`，`repeats += c.retrigger`，`percard-mod` trace。**窄实现，非 Buff 元系统**。 |
| **requests.md 清理** | 用户清成 **F/G-only**（非 F/G 移至 git 历史 `41ace96`）。后续新进的非 F/G 单（如 REQ-E-021）按 merit 评 + 标范围。 |

**另在分支 `claude/festive-planck-9gnv8q`（`a4ba515`，未并 mainbranch）**：`@engine/math` = REQ-010 定点数 Q16.16 + RNG 下沉 + **确定性浮点子集** + determinism-lint + 贡献/last-hit 评判（REQ-F-063 草案）。**并不并见下方「确定性简化」——桌面垂直下定点数非紧急。**

---

## 2. 关键裁决（继承这些判断，别推翻重来）

- **「数据驱动 ≠ 零函数」**：game-b（manifest + 薄 loader）是范本；薄确定性展开器（makeRoundFlow/templatesFor）保留、不字面化。
- **「读被处理对象的内禀数据」是一条复发模式，但不抽成框架**：REQ-F-061（命中读目标 hp）/ F-065（缩放读施法者资源）/ E-021（计分读牌 mods）看着像一个东西，但**生效语境不同**（命中/伤害/计分各在自己循环）。**用户问"要不要做通用 Buff 抽象"→ 裁定不做**：统一 Buff 必逼出 trigger/context 规则引擎 = inner-platform 腐烂源、弱 LLM 更难一致产出、跨系统耦合。**正解：语境=循环本身（隐式），各能力就地读；共性只复用小 shape `{op,target,value}`（词汇复用，非框架）。**
- **唯一一个真·原子缺口（且半成品）= 因果/source 线**：`SpawnRequest.source` 已加（F-065）；**`ResourceModify` 仍不带 cause** → "谁打的/谁计分/谁拥有"（REQ-F-063 岛主/贡献）表达不了。**组合不可约**（必须在变更那刻穿进去）。**等 F-063 真拉动再补全**（`ResourceModify.source?` / 统一事件 `cause`）；现不建（防臃肿）。
- **GameShell/UILayout**：故意不加 list/grid/modal（模板化 DSL 腐烂高风险，YAGNI）。
- **game-f owner 钦定保留手写 DOM HUD**（GameShell+canvas 并存出重复 bug）；`GAME_F_UI` 留作数据壳 + 测试用（Loop B 的按钮枚举源）。

---

## 3. ⭐ 新战略方向（用户 2026-06-18 拍板，按此调整后续评判尺子）

### 3.1 引擎偏向**桌面/卡牌/桌游垂直**——但**不冻结** action
- 用户：现在做的几个**以桌面游戏为主**，引擎会偏向这个垂直；**不想设计 action 动作 + 真·角色动画**（绑定骨骼/走攻击循环那种）。
- **但明确：暂不把 action 能力标"冻结/legacy"**——原样留着，垂直分类后面**还有更多考量**。
- **边界划准（别误伤）**：砍的是 **action 战斗 + 真·角色动画**；**留** presentation 的 juice（**翻牌/滑子/计分迸裂/高亮**，走 `tween`/表现层——桌游照样要手感）。
- **架构红利（已分析）**：桌面=**离散整数回合** → **lockstep 确定性变平凡、跨端天然一致**；本 session 啃了一整段的**浮点确定性命门（F-057 探针 / REQ-010 定点数 / mirror-vs-lockstep）对核心作废**。故 **festive-planck 的定点数非紧急**（action 游戏才需）；并不并由用户定，倾向**先不并**（RNG 下沉那块无害可单摘）。纲领「整个游戏是数据」在桌面上**真的可达**（抗数据化的恰是 action/动画那块）。

### 3.2 ⭐⭐ 标准指令：**方向漂移预警**（Lead 行为，必须执行）
> **以后任何把引擎往「非桌面 / action / 实时战斗 / 真角色动画」方向扩的需求或活,先 `AskUserQuestion` 主动预警用户"这方向对不对、是否偏离桌面垂直",得到确认再动。** 不要默默照做。这是用户钉死的护栏。

---

## 4. ⭐ 新 session 主攻：**3D 物件即数据**（表现层的「另一种描述方法」）

**用户意图（2026-06-18，两条消息合并）**：把 **Three.js / 3D / 「3D JSON」/ WebGL** 作为**表现层的另一种描述方法**;**不是整个场景都 3D，而是「一些物件」用 3D**(2D 场景里摆几张 3D 牌/棋子)。**看 game-g 已实现的 3D，把其中泛/简单的 3D 渲染抽到引擎表现层。**

**现状勘察（已做）**：
- `game-g/three-renderer.ts`(364 行)= **通用基建**(Scene/PerspectiveCamera/DirectionalLight/BoxGeometry/fitCamera/mesh 同步)**揉** game-g 专属(`makeCard`/`faceTexture`/`backTexture` 牌面纹理 + `pairKey/side/clash/抛飞/翻面` 对战编排)。
- `Card3D`(render-only,`render.ts:25`:frontTint/backTint/width/height + side/pairKey + rank/suit)= **「3D 物件即数据」的种子**——一张牌用 render 数据描述、渲成 3D 薄盒。
- 我**已抽**通用 `src/renderer/three-renderer.ts`(消费共享 `Renderable`)+ `three-projection.ts`。

**该做的(目标形态)**:
1. **把 `Card3D` 泛化成 render-only「3D 物件」表现 primitive**——如 `Mesh3D`/`Object3D`(几何=box/plane/extrude + 尺寸 + 正/反面材质/纹理 key + 可选翻面=Transform.rotation→mesh 旋转)。**任意实体挂上它即被引擎 ThreeRenderer 渲成一个 3D 物件,与 2D `Renderable` **同场混排**(per-object opt-in 3D,不是整场景 3D)。**这就是用户要的「一些物件 3D」。**
2. **「3D JSON」= 这些 3D 物件的数据描述**(类比 `UILayout` 之于 2D UI;`Object3D` 之于 3D 物件)。游戏**描述** 3D 物件,引擎**解释**渲染——**不再每游戏手写 Three.js**(game-g 那 364 行就是这个反模式)。
3. **边界**:① **纯表现**,只读 world、不写 sim、不进 hash(同所有渲染器);② game-g 的**牌面纹理 + 抛飞/相撞编排留 game-g**(它的私货 juice),只抽**通用几何/材质/翻面**;③ node 无 GL → 单测走 `three-projection` 纯函数 + (可选)给 3D 物件加一条 `frame-svg` 的等距/正交投影,无头也能"看帧"。
4. **rule-of-three**:目前 game-g 一个 3D 消费者;但「per-object 3D 物件」是桌游通用(3D 牌/骰子/棋子),且**消费共享 Renderable/新 Object3D 数据**→ 任意游戏可用,不绑 game-g。先做**最小**(box/plane + 双面材质 + 翻面),不要一上来做骨骼/动画/导入 glTF(那是 action 方向,触发 §3.2 预警)。

---

## 5. 现状（SHA / 分支 / 池子）
- **mainbranch HEAD = `20848c3`**（REQ-E-021）。工作树干净。
- **`claude/festive-planck-9gnv8q` = `a4ba515`**：`@engine/math`（定点/RNG/浮点子集）+ REQ-F-063 草案，**未并 mainbranch**，待用户定（桌面垂直下非紧急）。
- `requests.md` = F/G-only + REQ-E-021(done)/REQ-F-065(done) + REQ-F-057/062/LEAD→PF(open) + REQ-023(wontfix)。

## 6. 残留 TODO（排序）
1. 🟢⭐ **3D 物件即数据**（§4，新 session 主攻）：泛化 Card3D→`Object3D` render primitive + 引擎 ThreeRenderer 混排 + 「3D JSON」描述 + 纯表现/无头可测。先最小。
2. 🟡 **方向漂移预警**（§3.2）：常驻执行，任何 action/非桌面扩展先 `AskUserQuestion`。
3. 🟡 **festive-planck `@engine/math` 并不并**：用户定；桌面垂直下定点数非紧急，倾向先不并（RNG 下沉可单摘）。
4. 🟡 **因果/source 线补全**（`ResourceModify.source`）：等 REQ-F-063（岛主/贡献）真拉动再动。
5. 🟢 Loop B 扩展（BFS 逻辑 stateKey 收紧去重 / 钉 golden finalHash）；Loop A（LLM 看 SVG 帧→评→改数据）；真·浏览器 PNG（Playwright，需带浏览器环境，本容器跑不了）。
6. 🟢 game-d(ARPG)/game-f(实时自走棋战斗)= 偏 action,**暂不冻结**(用户),但属 §3.2 漂移观察对象。

---

> 复诵：我是会架构评审、敢带理由回驳的 Lead。整个游戏是数据；代码只属于引擎这台固定的确定性解释器。**防臃肿 = 不为一个游戏的私货、也不为一个漂亮的抽象往共享引擎堆能力。** 引擎偏桌面垂直(不冻结 action),**任何往 action/非桌面扩的活先预警用户**。新 session 主攻:**把 3D 物件做成数据描述,从 game-g 抽通用、混排进 2D 表现层。**
