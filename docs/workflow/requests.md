# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。
>
> **（2026-06-15 清理：本池仅保留 Game E/F/G 需求；非 F/G 条目已移除，见 git `41ace96`。）**
> **（2026-06-26 Token 清理：已结案条目（done/wontfix）正文压成一行摘要，完整论证/接线契约见各 commit。open/进行中条目保留全文。）**

---

## 待处理 / 进行中

### REQ-UI-G收藏卡 · [2026-06-26] · PG 同步（UI 库域·game-g 收藏页逐页对齐撞到的缺口） · status: **open（PG→主程·owner「撞到新撞点同步给我接着补」）** · 类型: 真能力缺口（尺子已过·不可重组）

> game-g 收藏页对齐 Designer comp（`UI/Game G 收藏·牌谱.html`）+ 原版管线时，撞到 2 个 LayoutNode 表达不了、不可重组的缺口：
> ① **PlayingCard 悬停翻面 / 双面 reveal**：原版 `.pcard-wrap:hover` 时 front→back scaleX 横向翻转，露出英雄列传（名/朝代/简介）。引擎 PlayingCard 仅静态 `faceUp`、无悬停翻转、无「正面=牌面 / 背面=信息子树」。Tooltip 只弹气泡不翻卡、faceUp 静态——均不可重组表达。建议：PlayingCard 加 `flipOnHover` + `back:LayoutNode`（背面渲子树·同 `Tooltip.bubble` 思路），或新 `FlipCard` 控件。
> ② **响应式卡宽 + grid 固定列数**：原版 `hero-grid6 = repeat(6,1fr)` 6 列、卡填满 1fr 单元格。引擎 PlayingCard 固定宽(sm/md/lg)、Panel grid 只 `auto-fill(minmax)` → 既不能严格 N 列、卡也不随格宽伸缩 → 排不出「6 列填满」版式。建议：① `LayoutConstraints` grid `cols:N`（固定列数·覆盖 auto-fill）；② PlayingCard `fluid`（充满父格·替代固定档）。
> PG 侧已做近似（grid minCol 122 + size lg → ~6 列大卡），但卡不填满、无翻面；需此 2 能力才能真·一模一样。

### REQ-STEAM · [2026-06-25] · 本 session 认领（平台轨·Steam 发行） · status: **in-progress（owner 指派·独立轨）** · 类型: 平台服务（非游戏数据）

> **owner（junbai.li）2026-06-25 拍板：Steam 发行作为独立平台轨，由本 session 接管全部事项。** 工作清单见 `finish/PS-steam-finish-list.md`。
>
> **车道**：落点 `electron/`（壳内 steamworks.js 绑定）+ `src/services/platform/`（`SteamworksPlatformPort` 实体）+ `src/services/storage/`（Steam Cloud）+ `scripts/`（depot/上传）。**`PlatformPort` 接口契约不改**（已稳定），只加适配器实体；web/dev 仍走 `NullPlatformPort`。
>
> **与 PG/Lead 边界**：PG（game-g）只消费 PlatformPort，不碰 SDK/壳/管线；服务层原属 Lead 域，经 owner 指派由本 session 实现，登记周知避免撞车。
>
> **选型（已定）**：Electron（沿用，不引入 Tauri）+ steamworks.js（仅壳内）。测试用 480(SpaceWar) appid，待 owner 提供真 appid（$100 入门费）替换。
>
> **阶段**：P0 依赖+init 自检 → P1 成就/统计 → P2 云存档 → P3 富状态/排行榜 → P4 depot/上传管线。联机(Steam Networking)依赖 REQ-010 浮点→定点，殿后。

### REQ-UI-Gemini评审 · [2026-06-26] · Lead 评审（UI 库域·外部 Gemini code review 收敛） · status: **部分 done（C2/C3 已实现）· 余回驳/记录** · 类型: 架构评审收敛

> 外部 Gemini review 7 条，Lead 以宣言尺子收敛：✅ **C2**(样式注入硬化·`num()`+anim 白名单·XSS 测) + **C3**(焦点丢失·`patchFocusedInput` 就地覆写不重建) 已实现。🟡 **A2**(bind fast-path) 记录待用例。❌ 回驳 **A1**(弃 CSS flex 改 JS 绝对定位=倒退)、**A3**(FSM 承载手势·时序态已在解释器·YAGNI)、**C1**(拆判别联合类型·毁数据契约)、**C4**(actionArg Record·现做法更干净)。详情见 git。

### REQ-UI-数字补间 / 富文本 · [2026-06-23] · Lead 登记（UI 库域） · status: **✅ done（owner 2026-06-25「都做完不要等·早晚需求」·下沉为 Label.tween / Label.spans）** · 类型: 真能力缺口下沉（manifesto 尺子已过）

> `LabelProps.tween:{from,to,ms?,decimals?}`（数字滚动·easeOutCubic·render-only）+ `LabelProps.spans:[{text,color?,bold?}]`（多段着色）。折进 Label 不新建控件。验收 `label-tween-spans.test.ts`。3D/SVG/hex/WorldFollower 回驳（见迁移指南 §4）。详情见 git。

### REQ-UI-3缺口（变换/动画/拖放） · [2026-06-23] · Lead 主导（UI 库域·跨游戏重构前置） · status: **✅ done（声明式下沉·game-i 同提交）** · 类型: 真能力缺口下沉（manifesto §4 评审通过）

> 三游戏(E/F/G)数据驱动 UI 重构缺口收敛到 3 个声明式字段并下沉(`src/ui/components`)：`LayoutConstraints.rotate/scale`(CSS transform·扇形手牌)、`anim/animMs/animDelay`(具名入场关键帧·发牌)、`draggable/dropZone`(HTML5 拖放·放牌落子)。验证 `dnd-transform-anim.test.ts` + game-i 第5页。② 回驳归 renderer/世界层(浮动血条/逐帧精灵/hex/SVG斜梯/命令式计分时间轴)；③ 假缺口(多选≤N/牌面渲染=重组)。详情见 git。

### BUG-G-掌机黑屏 · [2026-06-22] · owner→甲（cartridge/战斗屏域·owner 直派 bug 修） · status: **🟡 已修（zoom·`c5608bbc`）· 待真机烧版验证** · 类型: 弱 GPU 渲染回归

> owner 报新烧 cartridge 包「APOLLO OS 绿字开机条 + 黑屏」、同代码 Mac 正常。掌机 = `build:cartridge`（`dist-cartridge`·base `./`·直挂 game-g 无 launcher）·弱 GPU webview。
> **穷尽定位**：非 JS 崩溃——cartridge 真产物无头(happy-dom)挂 game-g 零报错·大厅/战斗 DOM 全渲(605KB)·tsc/vitest1664/build:cartridge 全绿 → 弱 GPU 合成失败。
> **根因**：闪烁修(`7634b027`)把战斗屏首帧烤成 transform:scale 单合成图层·弱 GPU 合成整屏图层失败→黑（旧两段绘制 CPU 先画可见帧＝"闪烁"）。
> **修(`c5608bbc`)**：战斗屏 1340×858 适配 transform:scale → **CSS zoom**（CPU 布局缩放·不合成图层·消闪烁·Mac 等价·zoom 不支持也只裁切不黑＝fail-safe）。
> **待 owner 真机验**。若仍黑次候选：① `cartridge-entry.ts` 整屏 `#game-root` opacity 渐变；② 战斗浮层 backdrop-filter。详见 `SESSION-HANDOFF.md §0`。

### REQ-G-退役旧战斗核 · [2026-06-22] · owner→game-g 甲（combat 域 · 主程评审登记） · status: **✅ done（甲·5 步全清·单一真相·`8c6c2751`/`a0970248`/`d91221a3`）** · 类型: 技术债清理（双核/双屏并存 → 单一真相）

> doc24 实时→回合制大转向后双核/双屏并存。甲 5 步全清：抽共享类型切断 `turn-combat→live-combat` 依赖 → 删旧出征路 `showMatch()` + live 胶水 → 删 `live-combat.ts` → 删旧 `battle-screen*`(乙协同) → 唯一真相 `turn-combat`+`turn-battle-screen`+`clash-resolve`。turnHash 不漂移·门禁全绿。详情见 git。

### REQ-ARCH-MENU-DSL · [2026-06-21] · 框架级（PG-乙 转呈 · owner 拍板「提主程评」）· status: **open（待主程评判）** · 类型: 可能的通用能力缺口（带 YAGNI 警告）

> **缘起**：owner review `lobby-screen.ts` 的 `onClick` —— 一条 ~60 分支的 `else if (act === 'x') { … }` 链，质疑「为什么不用一张表映射、而写条件跳转代码？以后想数据驱动改写还容易吗？真要这样应让引擎提供能力去填数据」。乙作架构评审，结论转呈主程。

**乙的判定（带理由，供主程决策）：**

1. **现状定性**：这段在 `src/games/game-g/lobby-screen.ts` 的**菜单胶水层**，非数据驱动战斗引擎。宣言最咬人处是**战斗**（确定性/公平/可回放）；菜单 chrome 性质不同。但 owner 直觉对——这是「逻辑跳转代码」。

2. **必须分清两种改法（价值天差地别）：**
   - **A. 分发表（闭包 `Record<string,(k)=>void>`）**：纯**可读性**重构。⚠️ **不是数据驱动**——值是函数、仍是代码，过不了宣言尺子「最弱 LLM 能产出一模一样的数据吗？」。把 else-if 换成闭包表就自称数据驱动 = 自欺。
   - **B. 声明式菜单 / 动作绑定 DSL**：菜单结构 + 动作都变**数据**，由引擎一台通用解释器消费。**这才是真数据驱动**（owner 说的「引擎提供能力填数据」），但是**大工程 · 属主程域**。

3. **YAGNI 警告（乙的回驳意见）**：为**单个游戏的大厅**造一套菜单 DSL 引擎，是过度设计风险区（参照 REQ-F 商店「避模板化 DSL 腐烂」的前车之鉴）。菜单里**大半动作已半数据化**（`setTab(k)`/`setSub(k)`/`pickCard(k)` 都拿 `data-k` 泛型处理），真正「一支独立逻辑」的没那么多。**只有当多个游戏都需要数据定义菜单时，这个通用能力才划算**——否则建议 rule-of-three 未到、暂不造。

**请主程裁决**：
- (a) 是否值得在引擎出「声明式 UI 节点 + 动作绑定」通用能力（类似 GameShell 的延伸）？还是判 YAGNI、暂挂？
- (b) 若暂不上 DSL：菜单 chrome 是否就**接受为表现层胶水**（数据驱动火力集中战斗），乙是否可自行做 A（闭包分发表）只为可读性——明确它**不算**数据驱动达标？
- owner 已选「提主程 REQ-ARCH」路径（未选「现在就重构」/「维持现状」），故乙不擅自动 onClick，等主程结论。

### REQ-LAUNCHER-EXIT · [2026-06-21] · program G 乙（owner→乙·实属 launcher 域·转交主程）· status: **open** · 类型: 启动器 UX + 退出钩子

> owner 2026-06-21（playtest game-g）：「右上角那个『返回主界面/返回卡带』——返回整个大游戏卡带界面的那个统一返回钮——不要摆在那，应该收进游戏自己的设置菜单里当『退出』。」
>
> **定性**：那是 **`src/launcher.tsx` 的统一返回钮**（所有游戏共用·launcher chrome），不属任何单个游戏 → **不是 game-g 能从自己代码里搬的**。乙不越界动 launcher。请主程/launcher-owner：
> 1. **把统一「返回主菜单/卡带」从悬浮角落收起**（或保留但弱化），UX 上不再常驻挡在游戏画面上。
> 2. **给游戏暴露一个退出钩子**：`mount(container, { onExit?: () => void })` 之类（或全局事件 `dispatchEvent('game-exit')`），让游戏能在**自己的设置菜单**里放一个「退出 → 返回卡带」按钮、调它卸载回 launcher。
> 3. 落地后**乙接线**：game-g 设置(⚙)菜单加「退出游戏（返回主菜单）」→ 调 onExit。
> **边界**：纯 launcher/shell UX + 一个回调契约·不碰游戏 sim。

---

### BUG-G-源泉徽标 · [2026-06-21] · owner→game-g 乙（甲代登记·勿越界）· status: **done（乙回滚·见下方 commit）** · 类型: 表现回滚

> owner playtest：战场源泉变成右上角水滴，要回旧版底部横条 water bar。乙 revert `3791fcde` 对 `turn-battle-screen.ts` 的源泉段(恢复 waterBar/waterCap/waterTube·删 fontBadge)。详情见 git。

---

### REQ-G-战场UI批次 · [2026-06-21] · owner→game-g 乙（甲代登记·战场屏 owner 授权乙动）· status: **open ⚠️ owner 二次催办（2026-06-21 playtest：1/3/6/9 仍看不到·请乙优先）** · 类型: 表现层一批（playtest 连发）

> ⚠️ **owner 2026-06-21 二次反馈**：这版仍**看不到敌方源泉数(1)、双方牌库剩余(3)、Boss 3 张地煞+悬停说明(6)**；开销角标(2)是个 `★N` 数字**挡住了牌面字**、且没画成水滴；买不起的牌没暗掉也没提示(9)。owner 明确**仍归乙**做（甲问过是否接手·owner 选乙）。**数据全就绪**，请乙优先收这几条。
>
> owner 2026-06-21 playtest 连发的一批**战场屏(`turn-battle-screen.ts`)表现需求**，归乙。带 🔗 的依赖甲的战斗逻辑钩子（甲并行做，落地后乙接数据）：
>
> 1. **敌方源泉数**：右上角（蓝条已乙回滚✓）显示**敌方(AI)的源泉数量**。
> 2. **每张牌开销=源泉滴数**（⚠️owner 二次催·现有 `★N` 数字**挡住了牌面字**）：把 cost 画成 **N 颗小水滴**（1/2/3 滴·0 不画），**位置别盖住牌面 rank/名字**。✅ 数据已就绪：放牌按 rank 收 0/1/2/3·`PokerCard.cost` 已上卡 + `buildTurnBattleView` 已读 `c.cost`（costPill 在 `turn-battle-screen.ts` handCard·gang 牌用 CAST_COST 同理）。**乙把 `★N` 角标换成水滴图标 + 挪到不挡字的位置即可。**
> 3. **双方牌库剩余**（⚠️owner 二次催·敌我都要）：显示**我方 + 敌方**牌库还剩多少张可抽（读 `tb.a.pokerDeck.length` / `tb.b.pokerDeck.length`·天罡库同理）。
> 4. **结束回合钮**移到**右下角·牌组最右·正方形显眼**位。⚠️ 同步：① `data-anchor="combat-end"` 跟着移（甲 battle-coach 锚点名不变·乙只搬 DOM 位置）；② 新手引导该步高亮会自动跟到新位置。
> 5. **动画**：弃牌→返回牌堆动画；战胜的牌→光荣回牌库动画；源泉**流入蓝条**动画。🔗 依赖甲：弃牌回库 + 战胜牌回库 + 源泉返还的**状态钩子**（甲在 turn-combat/驱动里产出，乙播特效）。
> 6. **敌方头像/地煞**：头像下挂**3 张地煞牌**·标「用没用/效果」；**鼠标悬停头像即显**（不用点）Boss 名 / 地煞详情 / 牌组剩余。
> 7. **敌我配色更分明**（owner 嫌现在不明显·乙 已做边框/水印可在此调色）：**我方=红框 + 略红的红底**；**敌方=黑框 + 灰底**。
> 8. **掷命骰** · 甲做 · status: **🅿️ 备案注销·搁置（owner 2026-06-21：「这个备案先注销注释掉·没想通这个表现·先做战力来源清晰」）**
>    - **旧方案(10颗d10浮层)owner 否决 → 已回退**。否决理由：① 全屏浮层**盖住了原战力明细特写**；② 骰子**反推安排**（`sum` 对齐既定 aWins）→「明显不是随机·太假」。已删 `dice-roll.ts` + `clashDiceRoll`，`playPerf` 回退原特写。
>    - **两颗 d6 加胜率新方案 = 搁置**（owner 2026-06-21 当面：表现没想通、觉得"不够高级" → **先注销/注释这个备案**，结算公式不动）。**改为先做「战力来源清晰」**（见本批 #10 + 已落地：clash 特写补 封顶/擎天对齐行 + 额外效果区）。掷骰子表现晚点再议。
> 9. **源泉不够的牌：暗掉 + 提示**（⚠️owner 二次催）：手牌里**当前源泉买不起的牌**（`card.cost > tb.a.mana`）→ **置灰/降透明·不可选**（别让玩家白点）；玩家若点了 → 浮提示「**源泉不足**」。数据已就绪（`buildTurnBattleView` 有 `b.a.mana` + 每张 `c.cost`）：给 `TurnHandCardView` 加个 `affordable` 标 + 不可选样式即可。
> 10. 🔗 **选牌看加成来源**（owner 2026-06-21 复提·"上次实现的"）：在战场选一张战区牌/手牌时，浮层要显示这张牌**加成的来源拆解**——来自哪些**天罡**(锋矢/虎符/寡兵/同花魁…逐项)、来自哪些**附魔**。
>    - 乙调研结论（如实报告 owner）：当前 `cardTip` 只拿到 `u.buff` 一个**聚合数**（=经营/养成·**含附魔但已按牌组均势摊平**），战斗里 `myBias` 用的是**牌组平均 favor**、不是单张牌自带附魔；天罡/士气加成是**对决时**经 `effPowerBreak` 现算（返回 `{pEff,shift,tg}`，**tg 只是个总数·无逐项标签**）。
>    - 所以「单张牌的附魔来源」诚实地**给不出**（combat 不按张携带附魔）；要做到 owner 想要的逐项来源，需 **甲** 把 `effPowerBreak` 改成**返回带标签的逐项拆解**（如 clash `bonusMine: [label,val][]` 那样·但按 unit），并把它**喂进 slot/hand view**（非对决态也算）。
>    - 乙可接的诚实版（落地后）：浮层显示「天罡(法术)逐项 + 养成(全局·含附魔均势·标注非单张)」；**附魔逐张**则需甲先改 combat 为**按张携带 favor/附魔**（即 #5 的"重写战斗模型"·owner 之前 AskUserQuestion 选了"Something else"·实属本条·待 owner 在"诚实全局版 vs 甲重写按张版"间拍板）。
>    - **进展（2026-06-21）**：**对决特写**侧的来源清晰已基本到位 —— ① 甲打通牌库后每张牌按 rank+suit 带自己 favor/附魔进战斗；② 另 session 补「经营·改造/附魔」**逐生肖**标注；③ 甲补**封顶30 / 擎天倍率对齐行**（明细恰好加到 ＝战力）+ **额外效果区**（平局裁定 / 战胜硬币人头留场·人面回库）。**仍缺**：非对决态（选**手牌/战区牌**悬浮）的逐项来源 —— 需 `effPowerBreak` 返回带标签逐项 + 喂 slot/hand view（甲域）。
>    - **★ owner 2026-06-21 再强调（非常重要）**：「对战时数据来源要清晰·我需要知道打的时候你加的那些东西来自哪里」。→ 对决态已落地（见进展③）。
>    - **✅ owner 2026-06-21 拍板「对决特写这版就够」**：非对决态（平时悬浮看牌）逐项来源**暂不做**（done-covered by 对决态明细）。本条 #10 结案——如后续要悬浮版再开新条（届时 combat 已按张携带 favor/附魔·阻塞已解·可直接做）。
>
> 甲并行做对应**战斗逻辑**（弃牌返源泉+不互斥 / 战胜牌回库+返还 / 放置不可重叠 / 回合流程改同步推进 / **#8 effPowerBreak 逐项标签拆解**），落地后给乙数据/钩子；乙只管战场屏表现。

---

### REQ-G-战斗逻辑批次 · [2026-06-21] · owner→甲（playtest 连发·战斗模型/AI/平衡·乙代登记） · status: **#2/#3/#6 done（owner 派单他 session·混合方案·全套门禁绿）；#4 转交策划；#1 暂缓待 owner 数据；#5 甲 active** · 类型: 战斗逻辑（非表现·甲域）
> owner 2026-06-21 深度 playtest 连发的一批**战斗逻辑/AI/平衡**需求——均属甲（turn-combat / 战斗驱动 / 平衡），乙代登记。乙只在甲落地钩子后接「表现」（全屏通知/fx）。
> **owner 2026-06-21 分工调整（多轮）**：#4 牌力概率反算 → **转交策划**；#1 敌方牌库镜像 → **暂缓**（owner 数据将出·出后甲直接接数据更新建库）；**甲当前只做 #5 敌回合逐步演出钩子**。
>
> **✅ #2/#3/#6 落地（owner 2026-06-21 直接派单·选「混合」+「先做功能·平衡后续单独调」）**：
> - **数据/能力（disha.ts）**：`DISHA_NAME`(id→招牌名) + `DISHA_PLAYABLE`(可施放集) + `splitDisha(ids)→{passive,playable}`。**混合判据**：「打出→整场持续加成」型转可打牌（斯巴达方阵/死战不退/伙伴骑兵/长枪方阵/连环船/挟天子/近卫军/破釜沉舟/霸王之勇/九战九捷，10 张）；**开局/定时/经济/地形结构型留 Boss 被动**（温泉关死守 homeHp/大军压境·机动调度 +源泉/大炮兵定时/锤砧地形夹击，5 张）。每关 ≥1 可施放（含关1：方阵+死战不退）。
> - **#2 地煞可打 cost2（turn-combat.ts）**：新 `DishaHandCard{kind:'disha'}` + `DISHA_COST=2` + `castDisha()`（打出→该 fx 并入 `dishaB` 整场生效·与天罡共用 cast 互斥锁）；init `splitDisha`：被动聚合进 dishaB、可施放进 Boss 起手手牌。
> - **#3 AI 用地煞**：`aiTakeTurn` 加 `scoreDisha`（攒够 2 源泉 + 场上有兵才高分·空场不急）→ Boss 择机打出；`aiTakeTurn` 现**返回打出的地煞 id 列表**（caller 据此通知）。
> - **#6 全屏通知（game-g.tsx·乙表现）**：AI 回合拿 `usedDisha` → 逐张 `showBanner('敌人使用地煞 · XX', 1500)`（串行·复用现成 banner）+ 战斗日志记。
> - **门禁**：tsc 0 · vitest 1703 全绿（disha.test 改 4 例对齐混合模型 + 加 1 例验可施放路+AI 用 → 12 例）· build 0。
> - **⚠️ 留给后续（#4 一并）**：可施放地煞改成「打出才生效」后，关1-5 现有平衡（原按地煞全程常驻标定）会偏弱 → 归 #4 概率反算重标定，**本次未动 sim**（owner 拍板：先做功能）。

1. ⏸ **[暂缓·owner 2026-06-21：数据将出·出后甲直接更新]** **敌方牌库张数错**：现在敌方牌库 **61 张**；按设定应**镜像玩家**——敌也带自己的 **16 张出战牌库 + 3 张地煞 = 19 张**。改敌方建库（现 `b = prepareArmies(...)` 的全 army → 折成 16 picks + 3 地煞·与玩家对称）。等 owner 推出 16+3 数据后接上即可。
2. 🔀 **[转交他人·owner 2026-06-21·不在甲单子]** **地煞=可打的牌·开销 2 源泉**：3 张地煞进敌方牌库/手牌，作为**可施放牌**，cost=2 召唤源泉（不再只是堡垒上的明牌摆设）。
3. 🔀 **[转交他人·owner 2026-06-21·不在甲单子]** **敌 AI 用地煞**：AI 按**情势 + 开销**判断**合理使用地煞**（攒够 2 源泉 + 局势需要时打出·非乱放）。复用/扩 `aiTakeTurn` 评分。
4. 🔀 **[转交策划·owner 2026-06-21·不在甲单子]** **敌方牌力按概率反算增强**：若某关敌方**胜率不足**就给敌方**初始 16 张里部分牌加地支附魔**抬牌力（按需反算强度）。= 关卡难度旋钮·**策划调数据**。
5. ▶ **[甲 active·owner「你看一下怎么做」]** **敌方回合结束=逐个/同步演出**：敌回合结束时，**行动 + 战斗逐个（或同步）演出**——牌移动→遭遇→掷命，让玩家看清过程（非瞬间结算）。甲产出**逐步状态钩子**（每步 move/clash 事件），乙接着播 fx/动画。🔗
6. 🔀 **[转交他人·owner 2026-06-21·不在甲单子]** **敌用地煞 → 全屏通知**（表现）：敌方打出地煞牌时，给**全屏通知**「敌人使用了地煞·XX」让玩家知道。🔗 依赖 #2/#3 的「敌方 cast 地煞」事件钩子。
7. ✅ **[BUG·已修·甲 2026-06-21·乙搜定根因]** **死战不退(lastStand)主将退格 → slot 碰撞 → 后方兵被画面吃掉**（playtest 报「我胜了但敌人没消失·它后面那格的人消失了·黑桃3 没消失」）：
   - 根因位置：`turn-combat.ts` `resolveClash` ~L339-341。我胜 + 敌前锋是**主将** + `dishaB.lastStandGeneral`（关1 地煞·首负不亡）+ 未用过 → 主将不死、`q.shift()` 后 `u.slot = min(SLOTS-1, u.slot+1)` 再 `push + sort`，**没检查 slot+1 是否已被身后兵占用** → 两兵同 slot。
   - 后果：`turn-battle-screen.ts buildTurnBattleView` 的 `bySlot.set(u.slot, …)`（~L562-563）**同 slot 后写覆盖** → 后方那张牌从棋盘消失；败北主将（黑桃3）反留场 → 玩家看到「赢了敌人没消失·它后面的人消失了」。
   - **甲修（终版·级联后挤 + 全屏通知 + 特写正名）**：① 退格改**整列后挤填空**（非换位）——主将退 1 格**仍居本列最前**，避免换位让主将"看着退了两格"（owner 复报「依然在场上·后退了两格」根因=换位 leapfrog）；后方全满到 Boss 家则原地残喘；确定无 RNG·一格一兵。② **全屏通知**（owner 2026-06-21「死战不退激活需要全屏通知」）：`ClashEvent.lastStand` 标记 → 驱动 `showBanner('🛡 死战不退·敌主将首负不亡')`。③ **特写正名**：败者死战不退 → 显「🛡 死战不退·退守」金标，替误导的「反面·阵亡」。回归测试 `disha.test BUG#7`：a0@4/b0@5主将/b1@6 → 胜后断言无同 slot + 主将仍最前(b0.slot<b1.slot) + lastClash.lastStand。gate 全绿(1710)。

---

### REQ-G-卦象结算加减 · [2026-06-21] · owner→甲（Game G·结算逻辑） · status: **✅ done（甲·`settleTurn` 战利品按今日卦象±·确定性·大吉+2…大凶−2·夹≥0）** · 类型: 战斗逻辑（结算期·甲域）
> 一局结算按今日卦象 ±战利品(大吉+2…大凶−2·夹≥0)·确定性进 hash·`settleTurn`。详情见 git。
### REQ-ARCH-SAVE · [2026-06-21] · program G 乙（owner 2026-06-21 钦定 · 存档持久化 + 云存档服务）· 框架级 · status: **open** · 优先级: 中 · 类型: 真缺口（持久化/同步=易错基础设施·过弱-LLM 尺子·≥多游戏拉动）

> owner 2026-06-21：「开一个 REQ 给主程——游戏的存档任务 + 云服务存储任务。」「开了本地一个 Save 目录，打完包以后也有地方可以存。」

**现状（game-g 自证缺口）**：game-g 自己手搓存档——`game-g.tsx` 里 `SAVE_KEY='gameG-save-v1'` + `localStorage.setItem(key, JSON.stringify(save))` / `loadSave()` 手写迁移清洗；音效/BGM 另用 `gg_sfx_muted`/`gg_bgm_*` 散键。**问题**：① 每个游戏各自重造 save/load/迁移/序列化（重复、易错——版本迁移、并发写、损坏兜底是典型弱-LLM 写不稳的代码）；② 只 localStorage = 单设备单浏览器，清缓存即丢、无跨端、无账号、打包成桌面/原生后**没有统一的落盘位置**；③ 明文可改、无校验。**按宣言尺子**：存档持久化 + 云同步 = 确定性接口能表达的**通用基础设施**，不该住游戏层 → 下沉成引擎/服务能力。

**请主程实现（两部分·可分批）：**

**① `SavePort`（本地存档抽象·先做·解 owner「本地 Save 目录」）**
- 统一存档服务：游戏只**声明 schema + 调 save/load**（数据接口·弱-LLM 可填），后端可换：web=localStorage/IndexedDB · 打包桌面(Electron/Tauri)=应用数据目录的存档文件 · 原生=平台沙盒。**同一份游戏代码、换后端不改游戏**。
- 内建：`schemaVersion` + **声明式迁移链**（v1→v2→…·每步纯函数·游戏给迁移表数据，引擎跑）、损坏/缺字段 fail-safe 回默认、原子写（防写一半损坏）、多槽位（multi-slot/多周目）。
- 命名空间：每游戏一个 namespace（`game-g` 下含 save + 设置如 sfx/bgm·收敛散键）。
- **确定性/可测**：save→load 往返等值；迁移链 headless 断言（旧档→新档→hash 一致·= REQ-ARCH-COACH 的 seen 往返同纪律）；后端用可注入的 storage adapter（test 给内存实现）。

**② `CloudSavePort`（云存档服务·后做·解「云服务存储」）**
- 账号/登录 → 服务器存档为真相、本地为缓存（offline-first：本地先写、联网同步）。
- 冲突解决：版本号/时间戳 last-write-wins 起步，预留 merge 钩子；跨设备拉取、防丢。
- 与 ① 同一 `SavePort` 接口，云只是又一后端（游戏侧零改·只在有账号时透明启用）。
- 需后端/鉴权——**这块要 owner 定服务形态**（自建/BaaS/厂商），可能独立于纯前端引擎，建议 ② 待 ① 落地 + owner 定后端再排。

**边界/纪律**：纯持久化+同步基础设施·**不进 sim hash、不回灌 gameplay**（存档是 IO 边缘·同 audio port 先例）；游戏侧仍是「声明数据 + 调接口」，零手写序列化/迁移/网络。**验收**：① save/load 往返 + 迁移链 + 多后端 adapter（含打包后落盘）headless 断言；② 云同步离线→上线一致性 + 冲突用例。
**乙侧接线（落地后）**：game-g 把现有 `loadSave/persist/freshSave` + 散落设置键迁到 `SavePort`（一次性·零功能回归）。

---

### REQ-ARCH-COACH · [2026-06-21] · design G（owner 2026-06-21 钦定 · 引擎通用新手引导）· 框架级 · status: **done（表现层·Lead `ac64e1c1`·design G 验收 PASS 2026-06-21）** · 优先级: 中 · 类型: 真缺口（仅表现层）+ 重组（逻辑层·无需引擎）

> 新手引导 = 数据表(步骤/锚点/文案)，引擎固定 coachmark 渲染器解释。✅ Lead 落表现层最小包(`ac64e1c1`)：`Coachmark` render-only 组件 + `renderer/coachmark.ts`(纯·7测) + `ui/onboarding-overlay.ts`(DOM·覆盖两套UI) + GameShell `UINode.anchor`(`data-anchor`)。逻辑层(首次/步骤/seen/点对)=游戏侧重组(flow+flag+save)，不提需求。完整案 `docs/design/onboarding-coachmark-capability.md` + 清单 `game-g/design/DEV-CHECKLIST-onboarding.md`。详情见 git。


### REQ-E-023 · [2026-06-18] · PE（Game E 小丑牌 · 牌库扩展总纲）· 框架级 · status: **⑥ 仅余 open（①②③⑤ done · ④ wontfix）** · 类型: 多个真缺口（逐项独立）

> 目标：可玩小丑 31 → 趋近 150（catalog 150 已全）。六能力拆分，详见 `docs/game-design/game-e-joker-rollout.md` + git 历史。
> **进度**：① countOf（按 Tag 掩码数实体）**done** · ② 确定性概率 roll（chancePass）**done** · ③ 留手牌结算 pass（HeldHand）**done** · ④ 自增长 **wontfix/重组**（Resource+Effect+valueFrom 覆盖·Counter 冗余）· ⑤ HandMods（four_fingers/shortcut/smeared）**done 部分** · ⑥ 跨实体复制/改牌 **defer(P3)**。
> **⑥ 仍 open（唯一未闭合）**：无干净最小切片（小丑排序/相邻、运行时改牌库 = 抗数据化），整包下沉=inner-platform，撞防臃肿红线。真要做按族逐个最小 REQ（先"只读复制"族需干净小丑排序接口；再"改牌库"族需运行时牌库变更的快照/确定性契约），各附弱-LLM 尺子证明，不一次性塞。①②③⑤已闭合不阻塞⑥。

---

### REQ-E-022 · [2026-06-18] · PE（Game E 小丑牌）· status: **done（引擎+接线 2026-06-18）** · 类型: 真缺口（poker-eval 缺 isFlush/isStraight 派生事实）

> `PokerHand.isStraightFlag?/isFlushFlag?` 派生事实（同 rankMaxCount 族）→ 解锁 Crazy/Droll/Devious/Crafty/The Order/The Tribe（可玩 25→31）。详情见 git。

---

### REQ-E-021 · [2026-06-18] · PE（Game E 小丑牌）· status: **done（引擎侧 2026-06-18）** · 类型: 真缺口（逐张计分读不到「牌自带的修正」）

> `Card.mods?:{op,target,value}[]` + `Card.retrigger?`（per-card 附魔/红蜡封）；card-scoring 逐张循环套用。架构裁决：不扩成通用 Buff 抽象（语境=循环本身·避 inner-platform）。详情见 git。

---

### REQ-F-065 · [2026-06-17] · 策划 PF（装备 atk·owner 钦定路A）· status: **done（引擎侧 2026-06-17）** · 类型: 真缺口（per-unit 异质缩放）

> `scaleByResource` 先查施法者本地资源再回退全局（补 `SpawnRequest/PrefabOrigin.source` 源 threading）→ 装备 atk 逐单位异质生效、退星级模板族爆炸。详情见 git。

---

### REQ-023 · [2026-06-09] · 主程4（Game F）· status: **wontfix（2026-06-15·重组覆盖）** · 类型: group-effect 集合写

> 羁绊光环可用 group-count→全局 buff 资源→各单位读 重组绕过；仅"各单位异质、全局值表达不了"才下沉（→ 后由 REQ-F-065 命中该留口）。详情见 git。

---

### REQ-F-061 · [2026-06-13] · 主策划（Game F）· status: **done（2026-06-13）** · 类型: 真缺口（hitbox 缺血量条件门+处决）

> `Hitbox.requireHpFracBelow?/requireHpFracAbove?/executeBelow?`（命中那刻读目标 hp 比例做 gate/斩杀·乘法比较保确定性·零迁移）。详情见 git。

---

### REQ-F-062 · [2026-06-13] · 主策划（Game F 卡牌系统 D0 拉动）· 框架级 · status: **open（Lead 打回细化，暂不实现——见评判）** · 优先级: 低-中 · 类型: 真缺口（aggro 索敌策略不可选，只能最近）

**标题**：aggro 索敌策略（最远 / 最高威胁 / 最低血，非只最近）

- **想实现**：刺客绕后锁后排、狙击锁最高威胁、嘲讽——玩家卡牌「绕后奇袭」+ 太阁 Boss 政宗/岛津。
- **卡在哪**：`src/skills/tier3/aggro.ts` 写死 `nearestByTag`；`Perception` 只有 targetTag/sightRadius，**无策略字段**，数据层无开关。
- **建议**：`Perception.policy?: 'nearest'|'farthest'|'highestStat'|'lowestHp'`（缺省 nearest，向后兼容）+ spatial-query 加对应变体（沿用 id tie-break 保确定性）。不改语义、不动定序。
- **Lead 评判（打回细化，暂不实现）**：① 核心 policy enum（nearest/farthest/lowestHp）确是真缺口（`aggro.ts` 写死 nearest、`Perception` 无策略字段）；但 ② **「嘲讽」不属本能力**——嘲讽是**目标侧**强制他人改指向，`Perception.policy`（攻击者侧）实现不了张飞嘲讽，混入是误判，须另案（目标侧机制）；③ **「最高威胁 highestStat」欠定义**——项目无"威胁"Resource，缺 stat 来源字段；④ **未被真实数据拉动**——关羽斩杀/张飞嘲讽仅在设计稿 HTML，实装数据零引用。按「不为想象需求拓宽引擎」（REQ-023 同纪律）**暂不实现**；待真实单位钉死具体策略需求，再落 nearest/farthest/lowestHp（嘲讽另案）。

---

### LEAD→PF · [2026-06-14] · Game F · status: **⏸ 大部 done·余暂挂（game-f 暂停开发）** · 类型: 去腐交办（game-f 程序→数据）

> game-f 曾是"在数据里编程"(2658 行·生成器 56 处·脉冲标记 114)。去腐进度：
> - ✅ 脉冲清零(114→0)、band/visSwap/chrome 展平(byte 等价)、商店卡/名牌从 ROSTER 派生。
> - ⛔ makeRoundFlow/templatesFor 字面化 **回驳**(薄确定性展开器·"数据驱动≠零函数")；脉冲下沉成引擎能力 **回驳**(单游戏臃肿勿注入共享引擎)。
> - ⛔ ②「game-f.tsx→完整 GameShell」**owner-overridden 暂挂**(撤 GameShell/canvas 并存·保留手写 DOM HUD)；`GAME_F_UI` 蓝本留作参考。Lead 已加通用 GameShell `image` 节点(非 game-f 下沉)。
> - 余 blueprint→manifest 全量展平(低优先)。game-f 暂停 → 整体搁置。详情见 git。

---

### REQ-F-064 · [2026-06-15] · game-f（Boss 技能）· status: **wontfix / done-covered（2026-06-15）** · 类型: 现有能力重组（非缺口）

> 信长全军 buff = group-count→dmg_scale→hitbox 读；秀吉援军 = Caster→prefab；真田自残血加伤 = Condition(自身 hp)→Effect→scaleByResource。三技能均现有能力可表达 → 回驳。详情见 git。

---

### LEAD→PG · [2026-06-18] · Game G · status: **open（可选迁移，game-g 自决）** · 类型: 通用能力已就绪 → 可选去腐

**能力已落 mainbranch（`f78ee97`）**：render-only **`Mesh3D`** 通用「3D 物件即数据」原语 —— `shape:box|plane` + 尺寸 + `frontTint/backTint/edgeTint` + `flipAxis`（翻面复用 `Transform.rotation`）。引擎通用 `ThreeRenderer` 即可把它渲成真盒/薄片、翻面、与 2D `Renderable` 同场混排；`frame-svg` 翻面感知正交投影（无头 golden）。纯表现、不进 sim/hash。

**可选交办（game-g 自决，不强制）**：`game-g/three-renderer.ts`（364 行）里**通用的那半**（Scene/相机/灯光/BoxGeometry/mesh 同步/相机自适配）可改为复用引擎 `Mesh3D`/`ThreeRenderer`——把牌**描述成 `Mesh3D` 数据**，删掉手写 Three.js 基建，趋近「游戏是数据」。**边界（务必守）**：game-g 的**牌面纹理（faceTexture/backTexture）+ 抛飞/相撞/逐路揭晓编排（pairKey/side/clash/marchScreenPos）= 你的私货 juice，留 game-g**，不下沉。即「通用几何/材质/翻面用引擎，专属皮与编排自己叠」。

**为何标可选**：现 `Card3D` 工作正常，迁移收益=减手写 Three.js（非 bug 修复）；且 Lead 不替 game-g 改游戏渲染（lane 红线）→ 由 program G 自评取舍。

---

### REQ-024 · [2026-06-21] · PA · Game A · status: open · 优先级: P2 · 类型: 真缺口（effect 无法驱动"已存在实体"的物理动作）

**标题**：`effect` 缺"施加冲量 / 注入动作" —— 协作里"A 命令 B 原地起跳 / 被弹射 / 被推一格"组合不出

- **想实现的游戏行为**：双人切换协作解谜中，A 对另一角色 B 下指令让 B 做出**物理动作**（原地起跳越缝、被机关弹射、被推一格）。蹲下/待命（`effect set-state`）、开火（`caster`→`prefab`+`launch` spawn 新弹体）都已能纯数据做；差的只是"让一个**已存在**的实体获得速度/冲量/动作"。
- **已经试了什么**：`keybind`(键→Signal) → `effect-apply`(targetEntity:B)。但 `effect.kind` 仅 set-flag/modify-resource/set-state/set-sensor/set-visible(-tagged)/destroy(-tagged)/reset-timer —— **无一能写 Velocity 或注入 Action**。`jump` 能力要 `Action{name:'jump'}`+`Grounded`，却没有"信号→给某实体挂 Action"的数据通路；`launch` 是自带组件的投射物机制、且 effect 不能"加组件"；`caster` 只能 spawn 新实体、不改 B。
- **卡在哪 / 缺什么**：信号无法对**已存在**实体施加速度/冲量/动作 → "命令 B 真起跳/被推/被弹"表达不了。（纯展示可用 set-state 换"跳跃姿势"顶替，但无真实位移。）
- **建议方案**：`effect` 增 kind **`apply-impulse`**（对 `targetEntity` 的 `Velocity` 叠加 `{vx?,vy?}`，可 valueFrom 资源）或 **`inject-action`**（给 `targetEntity` 挂 `Action{name,value}`，复用 jump 等既有消费者）。最小、与 jump/launch/velocity 链对齐；"信号→现有实体动起来"一通百通（命令 B、机关弹射、击退）。
- **优先级 P2**：协作"指令 B 物理动作"的通用前置；**不阻塞当前**（蹲下/待命/开火/单人切换都不需要它）。按"落地不口头"back up 入池。

---

### REQ-025 · [2026-06-25] · PA · 双人合作平台跳跃（上100层/冲100米）· status: open · 优先级: P1 · 类型: 真缺口（effect 无法改碰撞体 Shape + 命令模型无蹲下输入）

**标题**：缺"蹲下钻缝"能力 —— `effect` 写不了 `Shape`、命令模型没有蹲下输入

- **想实现的游戏行为**：双人闯关里角色**蹲下**缩小碰撞体，钻过低矮缝隙/在低天花板下通行（合作解谜常用：A 蹲下当矮台阶 / B 蹲身钻过 A 撑开的缝）。这是用户点名要的技能之一。
- **已经试了什么**：① 动画/姿势用 `set-state`→`AnimState` clip="crouch" 可做（纯表现，OK）。② 但要真正"钻低缝"必须**缩小碰撞箱高度**。全库只有 `gauge` 在运行时写 `Shape.width`（血条专用、按 Resource 比例、每帧覆写，不能复用）；`effect-apply` 的 `writes` 是 Flag/Resource/State/Sensor/Visibility/Destroy/Timer/RandomSeed —— **没有 `Shape`**；`Effect.kind` 也无写 Shape 的项。`Transform.scaleY` 能改但碰撞读 `Shape.height` 不读缩放（facing 正是靠这点：scaleX 不影响碰撞）→ 缩 sprite 不缩碰撞箱。③ 命令模型 `Command.move{dx,dy}+jump`（commands.ts）**没有蹲下输入**，KeyMap 也无。
- **卡在哪 / 缺什么**：没有"信号/状态 → 改某实体 `Shape.height`"的数据通路；也没有蹲下这个输入意图。
- **建议方案**：① `effect-apply` 增 `Effect.kind:'set-shape'`（写 `targetEntity` 的 `Shape.height/width/radius`，把 `Shape` 加进 effect-apply 的 writes）——与 `set-sensor` 同类、整数字段、确定性安全。蹲下即纯数据：蹲键→condition→ 两个 Effect（`set-state "crouch"` 给动画 + `set-shape height:15` 缩碰撞）；松开复原 height:30。② 命令模型/KeyMap 加"蹲下"意图（或约定 `dy:1`=蹲下，让数据逻辑读）。**一个注意点**：低天花板下松开蹲下会把人顶穿——只在头顶净空时才复原（用 sensor/overlap 条件判，纯数据可表达，非第二个引擎特性）。
- **优先级 P1**：上100层/冲100米的"蹲下"技能前置。**不阻塞主体**（爬塔用 boost 当协作核心；蹲下能力到位后再接）。按"落地不口头"back up 入池。

---

### REQ-026 · [2026-06-26] · PA · game-h 你造我塔/是男人就X层 · status: open · 优先级: P1(rope/spring) P2(conveyor/respawn) · 类型: 真缺口（想象力机关 = effect 写不了 Velocity/Transform、无双体约束）

**标题**：缺"会动的平台个性"与"双体绳索"——参考 NS-SHAFT(平台有个性) + Pico Park(身体当机关) 的灵魂机关当前组合不出

参考有想象力的纵向跳跃游戏后，最出彩的几样机关都卡在同一类引擎缺口（effect 只能改 flag/resource/state/sensor/visible/destroy/timer，**写不了 Velocity / Transform**；也无双实体约束）：

- **弹簧/起跳台（NS-SHAFT 之魂·P1）**：踩上去被弹得很高 → 跨越普通跳够不到的大缺口。需"接触/信号 → 给该实体 `Velocity.vy = -大值`"。建议 `effect.kind:'apply-impulse'`（写 Velocity，可叠加）或一个 `Spring` 组件（contact→给踩它的实体设 vy）。
- **传送带（P2）**：站上去被持续推向一侧。需"站立其上 → 每帧 `Velocity.vx += k`"。建议 `Conveyor{vx}` 组件（ground-sense 命中→加速）。
- **绳索/拴绳（Pico Park 之魂·P1）**：两名玩家被绳拴住——一个坠落另一个可拉住、可借绳荡过缺口、限制别走太散。需**双实体距离约束**（`Tether{a,b,maxLen}` + 一个约束求解 system，确定性）。这是双人游戏最大的想象力来源。
- **坠落重生/检查点（"是男人"紧张感·P2）**：掉出底部/碰危险 → 传回上一个检查点。需"信号 → 设某实体 `Transform.x/y`"（`effect.kind:'teleport'` 或 `Respawn{to}`）。配合"底部追命危险区"(zone→已可扣血)成立硬核基调。

**已试/为何组合不出**：召唤台(plate→set-sensor)、相位/踩碎(timer+set-sensor)、踩头借力(REQ-003)、危险扣血(zone→modify-resource) 都能纯数据做（game-h 已用召唤台做出"你造我塔"二重奏）；但上面四样都要"改 Velocity/Transform"或"双体约束"，现有 effect/组件表达不了。

**优先级**：rope + spring 先做（P1，立刻把 game-h 从"配合解谜"升级到"想象力满格"）；conveyor/respawn 次之（P2）。**不阻塞当前**（game-h 召唤二重奏版已可玩可测）。落地不口头入池。

---

## 需求模板（复制这段填写）

```
### [YYYY-MM-DD] · [提出人 PA/PB] · [游戏名] · status: open
- 想实现的游戏行为：
- 已经试了什么（哪些原子 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案 / 伪代码 / 补丁（可选）：
- 最小复现（若是 bug）：
```

---

### PG-乙→甲 · [2026-06-21] · Game G · status: **✅ done（并入 REQ-G-退役旧战斗核·`a0970248`/`8c6c2751`）** · 类型: 战斗段死代码清理

> game-g.tsx 旧实时血脉（showMatch/live-combat/battle-screen）+ Engine 血脉（buildGameGMatch）已随退役旧核全删。详情见 git。

---

### REQ-G-战斗结构 · [2026-06-21] · design G → 甲 · Game G · status: **✅ 核心已实现（战胜硬币 50/50 + 3D + 玩家亲掷/AI自动）；stayPMul/续航门 随天罡地煞重设计再落** · 类型: 真缺口（结构性）

> 掷命胜者「人头=留场续攻 / 人面=回牌库+返半费」(`resolveClash` 种子化硬币·`coin-flip.ts` CSS-3D)。调参钩子(stayPMul/续航门/CLASH_WIN_STAY_P)并入后续天罡/地煞重设计批次随平衡标定。完整契约 doc24 §4.2 + boss-config-1-5.md。详情见 git。

---

### REQ-G-诅咒地煞 · [2026-06-21] · design G → 甲 · Game G · status: **⏸ 暂缓（owner：诅咒先不做·关5 改用 bossFavorBias/bonusMana 杠杆）** · 优先级: P3（备案）

> Boss 被动「诅咒」(每 N 回合 bounce 玩家随机兵)：真缺口但与 `batteryEveryTurns` 同构、可加同类新 op。备案暂不实现。数据形 `{kind:'curse',op:'bounceUnit',everyTurns,mode,pick}`；接入清单见 `boss-config-1-5.md §七`。

---

### REQ-G-Boss牌面板 · [2026-06-21] · design G → 甲（战斗屏域） · Game G · status: open · 优先级: P2（明牌可破核心体验·非阻塞战斗逻辑） · 类型: 表现层（数据已在·纯渲染）

> **owner 2026-06-21**：「Boss 5 张天罡也要这样去抽和摸；我们应该能看到他的手牌和天罡牌，但现在没地方看。」+「在他地煞牌下面放一个微小的牌组，手点上去就放大看具体哪几张·是缩小 scale 过的小牌。」
> **评判（design G）**：纯**表现层**——数据全在（`TurnBattle.b`：`pokerDeck/tengangDeck/hand/castIds` + 关卡 16牌组+5天罡明牌）；**无引擎/数据缺口**，只差战斗屏渲染（甲地盘）。机制侧已对：Boss 天罡同玩家从 `tengangDeck` **抽/摸再打**（`drawCard('b','tengang')`→`castTengang`·花源泉·非免费）→ 面板只"看牌"不改机制。
> **派甲（doc24 §九 已补规范）**：① 顶部 Boss 牌面板：3 地煞（明牌·在途）**之下**放 scale 过的 **mini-deck**（16扑克+5天罡 loadout·明牌 counter-pick 靶）；② 点/悬停 **放大**成可读网格看清具体哪几张（小尺寸=设计·放大解决可读）；③ Boss **手牌+已打天罡可见**（数量+内容·明牌哲学）。乙不碰（战斗屏=甲）。
> **🌫 暗牌/迷雾态（owner 2026-06-21 追加·未来）**：面板留一个**隐藏态**——Boss 带 `fog`（迷雾）地煞时 mini-deck/手牌翻背面·不可放大（玩家看不清·AI 本有全信息）。**`fog` 已在 disha-pack 设计（关17+）**·不是新能力。**关1-5 全明牌不加 fog**（明牌可破=核心）；fog 留后期/Ascension。

---

### REQ-G-说明同步 · [2026-06-21] · design G → 乙（菜单/帮助屏域） · Game G · status: open · 优先级: P2（玩家可见·信息已过期） · 类型: 表现层（文案同步·数据已在 doc26）

> **owner 2026-06-21「更新下游戏说明」**。design G 已更新设计源 `doc26 玩法手册`；**但游戏内帮助中心文案是 `lobby-overlays.ts · helpBox` 写死的（乙域）·已过期** → 派乙照 doc26 同步：
> 1. **掷命对决**（helpBox 中级 L31）补 **🪙 战胜硬币（留场续攻）**：赢一场后抛币——**人面=留场乘胜追击 / 字面=回牌库+返半费**（你按钮亲掷·敌方自动·投掷后才揭晓）。
> 2. **❗事实错误（helpBox 高级 L48）**：「Boss 库=**12 随机天罡**+3 地煞」→ 改 **「16 扑克 + 5 天罡 + 3 地煞」（写死·与你 16+5 对称）**。
> 3. 补 **👁 Boss 牌面板**：战场顶部能看 Boss 的 3 地煞 + **5 天罡明牌 + 缩略牌组（点开放大看 16 兵牌）+ 手牌**（明牌可破=counter-pick 核心）；后期「迷雾」地煞会盖暗。
> 4. **放牌按点数收费**（中级 L30）可补一句：2-4 免费 / 5-7=1 / 8-10=2 / JQKA=3。
> **乙只改 helpBox 文案**（菜单屏域）；战斗屏面板本身=甲（`REQ-G-Boss牌面板`）。doc26 为准。

---

### REQ-G-地煞新op · [2026-06-21] · design G → 甲（引擎域） · Game G · status: open · 优先级: P2（丰富前10-20关·非阻塞） · 类型: 真缺口（4 个新 Boss disha op·下沉）

> owner 头脑风暴一批 Boss 被动 Buff。design G 评判：7 条里 4 条已覆盖（泉水翻倍=bonusMana / 城堡血=homeHp / 急行军=tempo advance / 隐形=fog），**3 条半是真缺口 → 下沉 4 个新 op**。完整规格见 `design/disha-op-vocab-v2.md §二`。
> **派甲（DishaFx 扩字段·确定性·仿现有 batteryEveryTurns/resolveClash 钩子·无新子系统）**：
> 1. `{kind:economy, op:withdrawRefundMul, value:1.5}` —— Boss 胜者回库返还花费 ×value（默认0.5）。改 `resolveClash` 回库行（仅 Boss 侧）。
> 2. `{kind:action, op:extraAction, value:1}` —— Boss 每回合多 1 类互斥动作（破四选一·**仅 Boss**）。`aiTakeTurn` 放宽 actionTaken 锁到 1+value 类。
> 3. `{kind:control, op:freeze, everyTurns:N}` —— 每 N 回合冻玩家本回合 1 类动作。仿 batteryEveryTurns。
> 4. `{kind:control, op:intimidate, everyTurns:N}` —— 每 N 回合吓退玩家某路前锋 1 张（退场/回库·b.rng 选·确定性）。**与暂缓的 REQ-G-诅咒地煞(bounce) 同族**·甲可一并参数化实现（mode: bounce回起点/库 vs intimidate吓退）。
> 落地后 design G 把这些织进关6-20 地煞组合 + sim 标定。当前 lore/disha 重写子代理用现有词汇·不阻塞。

---

### REQ-I-展示台升格 · [2026-06-25] · owner（火车上头脑风暴）→ Lead（引擎/展示台域）· Game I · status: **进行中（Lead）** · 类型: 方向 + 真需求若干 · 优先级: P2

> **owner 意图**：把 game-i 从「UI/声音测试场」**升格为「引擎底座能力展示台 / sample 画廊」**——每个底座能力一个 canonical 活样例，作为活文档 + 回归面 + 迁移参照；以后标准代码下沉到这层当 sample。页面**重组为 Hub + 模块**（落地点几个大模块入口：UI / 声音 / 输入 / 动画 / 渲染3D…，点进去出现该块）。
>
> **Lead 评判（CORE RULE）**：接受方向（强对纲领：样例即「这能力真能数据驱动」的证明）。逐项核底座现状——多数是**组合现有 capability**，非新写引擎：
> | 模块 | 底座现状 | 判定 |
> |---|---|---|
> | UI / 声音 | 已是数据样例（mountUI / Web Audio 胶水） | ✓ 已在 |
> | 输入 | `atoms/input-capture`(RawInput)、`atoms/action-map`、`components/input.ts`(KeyBinding/Action) | ✓ 组合现有 → **本轮已做** |
> | 精灵/帧动画 | `atoms/sprite`、`atoms/frame`、`tier1/tween`、`tier1/animation` | ✓ 组合现有（走 renderer 表面·非 mountUI） |
> | 寻路 | `tier2/grid-move`、`tier2/hex`（game-f 在用） | ✓ 组合现有（走 renderer 表面） |
> | 渲染 3D | `renderer/three-renderer`、`three-projection` | ✓ 已具备 |
> | 视频 | 仅 `services/aigp`(AI 生成端口)+`assets`(资源索引)，**无播放渲染能力** | **deferred（真需求·待触发）** |
>
> **纪律**：能力永远在引擎（确定性解释器），样例永远是数据 + 薄宿主胶水（运行时职责），**绝不在游戏层写 bespoke system**；每样例保持「最弱 LLM 能照抄」纯度，**不许长成 mini-game**。分两类样例：**UI 数据样例（mountUI）** vs **渲染/仿真样例（renderer + skills）**，别混。
>
> **视频改判**：owner 明确「以后跟爱诗 AI 合作 + 开场视频要用」→ 不是 wontfix，是 **deferred 的底层真需求**：等真游戏拉动（要播放/渲染视频）再下沉成 capability，先放着不为凑 demo 提前建（避免 YAGNI）。
>
> **已落地（Lead）**：
> - **Hub + 模块重组**：落地积木墙（Card grid·点块进各模块）+ 顶栏返回；mod-ui 套现有 5 UI 子 tab。
> - **🎮 输入底座**：`input-lab.ts`（KeyBinding[] 纯数据 + resolveSignal/applyRawInput 纯函数 + LayoutNode 视图）+ 宿主 bindInputPad 监听胶水；10 测。
> - **✨ 精灵动画**：`anim-lab.ts`（tween 蓝图·4 形状）+ 渲染舞台宿主 syncStage（Engine+CanvasRenderer 挂 #sim-stage·幂等·换皮/退出拆建）；3 测 + Chromium 截图验证。
> - **🧠 游戏 AI（索敌+寻路）**：`ai-lab.ts`（aggro Perception→Relation 锁玩家 + grid-move hex A* 逐格逼近·到相邻停 的纯蓝图）；3 测 + 截图（5 敌从四周寻路合围玩家）。
> - **🧊 3D 渲染**：`three-lab.ts`（Mesh3D 翻面卡/翻滚立方/倾转面 + tween 转 rotation）+ ThreeRenderer 后端（syncStage 按 backend 选 canvas/three）；3 测 + 截图（SwiftShader WebGL 真 3D）。
> - **四根底座支柱**（owner 2026-06-25「先把这 4 档落地」）——全 Canvas、纯蓝图、零专属 system、各带测试 + Chromium 截图：
>   - **🟢 运动与碰撞**（physics-lab）：motion-apply + overlap-detect + **collision-resolve**（按 Mass 推开=真碰撞响应；勘探误判为「无响应」，实测存在）。
>   - **⚔️ 战斗结算**（combat-lab）：弹道(Sensor+Hitbox) → overlap → trigger-zone → hitbox 扣血/灼烧 DoT → mortal → destroy（照搬 game-d 写法）。
>   - **🎆 生成与寿命**（spawn-lab）：Timer(loop)→event-when→caster→prefab 周期生成粒子 + Tween 淡出 + lifetime 自毁。
>   - **🔀 状态机**（fsm-lab）：自由计时器 → event-when（timer 阈值）→ effect-apply（set-state + set-visible）idle→alert→flee→循环（reset-timer 按 targetEntity 定位）。
> 全部「组合现成能力（蓝图 capabilities+entities）」，**零专属 system**。展示台现 10 块全亮。tsc+vitest(1758)+build 全绿。
> **TODO**：序列帧 spritesheet 动画（需真实贴图资产·待资产接入）；视频模块（deferred·爱诗 AI/开场视频拉动再下沉）；Hub 积木异形/点阵底纹（待 owner 拍样式·必要时下沉 renderer 背景/异形布局能力）。
