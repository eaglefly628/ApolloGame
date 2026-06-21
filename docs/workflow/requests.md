# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。
>
> **（2026-06-15 用户清理：本池仅保留 Game F / Game G 需求；非 F/G 条目（R9 / REQ-ARPG / REQ-C-005·006·007 / REQ-010 / BUG-002 / REQ-018）已移除，完整内容与 Lead 判定见 git 历史 commit `41ace96`。）**

---

## 待处理 / 进行中

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

> owner（2026-06-21·playtest）：「战场中的那个源泉，总变成右上角一个水滴了，变回来老版本。」——要的是**旧版底部横条**（带格子的 water bar），不要现在棋盘右上角的小水滴徽标。
>
> **定位**：是 commit `3791fcde`（"召唤源泉重做——移棋盘右上角徽标 + 源泉(水滴)图标 + 大数字"）改的 `src/games/game-g/turn-battle-screen.ts`。
> **请乙**：revert `3791fcde` 对 `turn-battle-screen.ts` 的源泉那段——恢复旧的底部 `waterBar/waterCap/waterTube/waterCellsHTML` 横条，删掉右上角 `fontBadge` 水滴。其余两文件（若有）按需保留。
> **边界**：战场屏(`turn-battle-screen.ts`)是 owner 授权乙动的，甲不越界自行 revert，仅代登记转交。改完记得 regen 受影响金图 + 走全套门禁。

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
>    - **进展（2026-06-21）**：**对决特写**侧的来源清晰已基本到位 —— ① 甲打通牌库后每张牌按 rank+suit 带自己 favor/附魔进战斗；② 另 session 补「经营·改造/附魔」**逐生肖**标注；③ 甲补**封顶30 / 擎天倍率对齐行**（明细恰好加到 ＝战力）+ **额外效果区**（平局裁定 / 战胜硬币人头留场·人面回库）。**仍缺**：非对决态（选**手牌/战区牌**悬浮）的逐项来源 —— 需 `effPowerBreak` 返回带标签逐项 + 喂 slot/hand view（甲域·待排期）。
>
> 甲并行做对应**战斗逻辑**（弃牌返源泉+不互斥 / 战胜牌回库+返还 / 放置不可重叠 / 回合流程改同步推进 / **#8 effPowerBreak 逐项标签拆解**），落地后给乙数据/钩子；乙只管战场屏表现。

---

### REQ-G-战斗逻辑批次 · [2026-06-21] · owner→甲（playtest 连发·战斗模型/AI/平衡·乙代登记） · status: **open** · 类型: 战斗逻辑（非表现·甲域）
> owner 2026-06-21 深度 playtest 连发的一批**战斗逻辑/AI/平衡**需求——均属甲（turn-combat / 战斗驱动 / 平衡），乙代登记。乙只在甲落地钩子后接「表现」（全屏通知/fx）。

1. **敌方牌库张数错**：现在敌方牌库 **61 张**；按设定应**镜像玩家**——敌也带自己的 **16 张出战牌库 + 3 张地煞 = 19 张**。请改敌方建库（现 `b = prepareArmies(...)` 的全 army → 折成 16 picks + 3 地煞·与玩家对称）。
2. **地煞=可打的牌·开销 2 源泉**：3 张地煞进敌方牌库/手牌，作为**可施放牌**，cost=2 召唤源泉（不再只是堡垒上的明牌摆设）。
3. **敌 AI 用地煞**：AI 按**情势 + 开销**判断**合理使用地煞**（攒够 2 源泉 + 局势需要时打出·非乱放）。复用/扩 `aiTakeTurn` 评分。
4. **敌方牌力按概率反算增强**：若某关敌方**胜率不足**（sim/clashDiceRoll 概率反算出会输太多），就给敌方**初始 16 张里部分牌加地支附魔**抬牌力（按需反算强度·别一刀切）。= 关卡难度旋钮·甲调。
5. **敌方回合结束=逐个/同步演出**：敌回合结束时，**行动 + 战斗逐个（或同步）演出**——牌移动→遭遇→掷命，让玩家看清过程（非瞬间结算）。甲产出**逐步状态钩子**（每步 move/clash 事件），乙接着播 fx/动画。🔗
6. **敌用地煞 → 全屏通知**（表现·乙接）：敌方打出地煞牌时，给**全屏通知**「敌人使用了地煞·XX」让玩家知道。🔗 依赖 #2/#3 的「敌方 cast 地煞」事件钩子（甲产出·乙播通知）。

---

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

> ✅ **Lead 已落表现层最小包**（`ac64e1c1`）：`Coachmark` 组件 + `src/renderer/coachmark.ts`(纯·collect/几何/SVG·7测) + `src/ui/onboarding-overlay.ts`(`mountOnboardingOverlay`·DOM·覆盖两套UI) + GameShell `UINode.anchor`。**design G 验收 PASS**：逐条对上策划案（组件全字段/data-anchor 统一/纯表现不进hash/YAGNI）。小瑕：arrow 暂未画(后补)。**逻辑层(首次/步骤/seen/点对)=游戏侧重组**→甲乙接清单 `src/games/game-g/design/DEV-CHECKLIST-onboarding.md` 用起来。


**完整策划案见 `docs/design/onboarding-coachmark-capability.md`。** 一句话：新手引导 = 数据表（步骤/锚点/文案），引擎一台固定 coachmark 渲染器解释。owner 主诉求 = **首次使用任何功能即弹教学·高亮该框·指示点哪里**，且要**引擎通用、数据驱动**（任何游戏只填数据·零手写 UI）。

**🟢 逻辑层 = 重组·无需引擎（design G 已自证可拼）**：首次检测 `not(flag(seen_x))` + `save` 持久化；步骤推进 `GameFlow{coach_steps}`；"点对才推进" `Clickable{onlyFlag}`→Signal→transition；门控其它 Clickable.onlyFlag。**这层不提需求**，游戏侧数据接线即可。

**🔧 表现层 = 真缺口·请主程实现（≥2 游戏 F+G 拉动·过弱-LLM 尺子）**：现有组件无 overlay/spotlight/tooltip，手写遮罩=游戏代码违宪 → 下沉**最小包**：
- ① `Coachmark` render-only 组件（POD·不进 hash）：`{anchor, shape:'rect'|'circle', pad?, dimColor?, dimAlpha?, text, placement?, arrow?, visibleWhen?}`。
- ② `OnboardingOverlay` 渲染器（=解释器·合宪）：读激活 Coachmark → 全屏 dim + anchor rect 处镂空 + 气泡(text+arrow) 贴 placement。DOM 优先（覆盖现有 React/手写屏）+ SVG/Canvas 出帧（headless 验收）。
- ③ **anchor 解析**：统一 `data-anchor="<key>"` 约定，`querySelector('[data-anchor=key]')`→rect。**同时覆盖 GameShell 与 game-g 手写 DOM 两套 UI**（手写屏加属性即可·零重构）。
- ④ GameShell `UINode` 加 `anchor?: string`（落 `data-anchor`）。

**确定性**：seen flags / flow step 进 hash + 存档（看过不再弹·跨端一致）；Coachmark 高亮纯表现·不进 hash·不回灌 gameplay（同 outcome-first）。
**体积**：小-中（1 render 组件 + 1 表现渲染器 + 1 DOM helper + GameShell 一字段）·不碰 sim 结算/多人。
**验收**：headless 断言流程状态机（触发→跳步→set seen→存档重载不再弹·hash 一致）；表现层出帧断言（镂空落在 anchor rect·气泡在 placement 侧）。
**回驳记录**：R-1 不另造"Tutorial 能力"（flow+flag 已覆盖）；R-3 高亮不进 hash；R-4 富文本/分支树 YAGNI。


### REQ-E-023 · [2026-06-18] · PE（Game E 小丑牌 · 牌库扩展总纲，owner 指派陈陈飞）· 框架级 · status: **open** · 优先级: 见各子项 · 类型: 多个真缺口（整理为一份，逐项可独立落地）

**目标**：可玩小丑 **31 → 趋近 150**（catalog 元数据已全 150）。下面按「能力」拆分；**每项是独立 capability，可分别落地、分别验收**，不是一个大泥球。
**📋 主程对照用的全 150 分桶卡组清单（每能力的验收目标 + 每张效果/参数）见 `docs/game-design/game-e-joker-rollout.md`。**
**🟢 Lead 进度（2026-06-18，主程一轮走完六项）**：① countOf **done**（按 Tag 数实体，回驳字符串枚举）· ② chance **done**（种子 PRNG 概率门）· ③ held-card-score **done**（留手牌结算 pass）· ④ 自增长 **wontfix/重组**（Resource+Effect+valueFrom 覆盖，Counter 冗余）· ⑤ HandMods **done(部分)**（four_fingers/shortcut/smeared；splash/pareidolia/flower_pot 另评）· ⑥ 跨实体 **defer(P3)**（无干净最小切片，逐族待具体卡单提）。每项详见对应子项。引擎侧全绿（tsc+vitest+build）逐项推 mainbranch。**PE 可据此把对应小丑接成可玩 + 补测试。**

**判据声明（owner 2026-06-18 定）**：回驳"做成重组"的前提是——**最弱 LLM 能稳定产出那份数据**。若某组合需要一段易错的同步代码/复杂拼装（弱模型复现不了），即使理论上能重组，也**特例化下沉成干净能力/数据接口**（宣言尺子）。据此下面区分。

**⚠️ 留在游戏侧（每张小丑数据平凡、只一次性接线，PE 自己做）：**
- **更多触发时机的"改资源"类**（on_round_end 经济：Golden/Rocket/Gift Card…；on_discard：Faceless/Trading Card…；on_blind_selected）：每张数据就是 `{trigger,target,value}`，弱 LLM 可填；线性脚本发信号 + `jokerToEntities` 接这几个 trigger（一次性）。
- **条件重触发**（Hack 重触发 2/3/4/5、Sock and Buskin 重触发人头）：`PerCardRetrigger.when` 本就支持 rankIn/suit；只差 `jokerToEntities` 把"带 retrigger 条件的小丑"映射过去（小数据-shape，弱 LLM 可填）。

**↓ 真缺口，请引擎实现（陈陈飞）。每项标了体积/优先级/解锁量。**

**① `valueFrom.countOf` 计数缩放（P1 · 体积 小 · 解锁 ~12 张）**【原列"重组"，owner 按弱-LLM 尺子改为下沉】
- 解锁：Abstract(+每小丑)、Blue(+每张牌)、Joker Stencil(×每空槽)、Bootstraps(+每$5)、Swashbuckler、Stone Joker、Steel Joker…
- 缺口：`valueFrom` 只能读"具名 Resource"（REQ-013）。"每个小丑/每张牌/每个空槽 +X"若走"游戏脚本维护计数 Resource + valueFrom 读"，需一段**每次买卖/增删都同步写对**的代码 → 弱模型写不稳、数据引用一个"靠别处维护"的 id，不自洽 → 不过尺子。
- 建议：`valueFrom` 加可选 `countOf: 'jokers'|'deck_cards'|'empty_joker_slots'|'hand_cards'|…`（引擎结算时自己数对应集合的基数），`v = count × coeff`，沿用 `op:'add'/'mul'`。则小丑数据 = 自描述一行 `valueFrom:{countOf:'jokers',coeff:3}`，零游戏侧记账，弱 LLM 可填。集合枚举可扩展。
- 确定性：纯计数，无浮点。
- **Lead 落地（done，引擎侧）·【回驳"字符串集合枚举"改为「按 Tag 掩码数实体」】**：PE 的 `countOf:'jokers'|'deck_cards'|…` 字符串枚举会把 game-e 概念（jokers/deck_cards）焊进引擎=inner-platform 耦合 → 回驳。**通用原语 = `valueFrom.countOf: <Tag掩码>`**：引擎数 `Tag.flags & 掩码` 命中的实体数 × coeff（复用现成 Tag 系统，同 destroy-tagged/set-visible-tagged 寻址），游戏给自己的小丑/牌打 tag、引擎只管数。`effect-apply` 一处解析 + `countByTag` helper；纯整数计数、与遍历序无关 → 确定。测试：3 tagged→add×3=9 / mul×(2×1) / 无命中→0。全绿（tsc + 1422 vitest + build）。
  - **给 PE 的接线契约**：小丑/牌实体打 `Tag{flags}`（自定义位）→ 计分 Effect `modify-resource{ op, valueFrom:{ countOf:<同掩码>, coeff } }`。覆盖 abstract（每小丑+3倍，tag 小丑）/ blue（每张牌，tag 牌）/ steel·stone（每钢铁·石头牌，tag 增强牌）等"每个 tagged 物 ×coeff"。
  - **未纳入（不同 shape，各自单评，免 countOf 变杂烩）**：empty_joker_slots（容量−计数，需容量源）、bootstraps `$5`（资源整除）、swashbuckler（资源**求和**非计数）。真拉动各自最小提。

**② 确定性概率 roll（P1 · 体积 小-中 · 解锁 ~20 张 + Lucky 增强）**
- 解锁：Misprint(随机+0~23倍)、8 Ball、Business Card、Bloodstone(1/2 ♥ ×1.5)、Space Joker、Lucky 牌、Gros Michel 自毁…
- 缺口：`effect-apply` / `card-scoring` 没有"按概率触发"。
- 建议：Effect / PerCardRule 加可选 `chance?: { num, den }`，命中条件后再用**世界种子 PRNG**（与引擎 random 原子同源，lockstep 安全、录放一致）roll `< num/den` 才施用。一处解析改动。
- 确定性：用确定性 PRNG（按 tick/序号取数），不碰 Math.random。
- **Lead 落地（done，引擎侧）**：`Effect.chance?:{num,den}`（effect-apply）+ `PerCardRule.chance?:{num,den}`（card-scoring，逐张独立 roll）。共用 random 原子新 helper `chancePass(rng,num,den)`=`nextRandom(rng)<num/den`（推进世界 RandomSeed，lockstep/录放安全，绝不 Math.random）；无 RandomSeed→fail-closed 不施用。两系统声明 read+write RandomSeed（同 dialogue/match3 先例，无 cycle）。测试用 1/1(必中)/0/1(必不中)/无种子 不依赖 PRNG 值。全绿（tsc + 1428 vitest + build）。
  - **给 PE 的接线契约**：indep 概率小丑（space_joker/gros_michel 自毁/business_card）→ 计分 Effect 加 `chance`；per-card 概率（bloodstone 每张♥ 1/2）→ PerCardRule 加 `chance`；世界须有一个 `RandomSeed` 实体。
  - **未纳入**：misprint「随机 +0~23 倍」是**随机取值**非概率门（不同 shape），单提（小：valueFrom 随机区间 or 一个 randomValue 字段）。

**③ 逐张「手牌内」结算 pass（P1 · 体积 中 · 解锁 ~10 张 + 钢铁/黄金牌）**
- 解锁：Baron(留手 K ×1.5)、Shoot the Moon(留手 Q +13)、Mime、Raised Fist、以及 REQ-E-021 边界外的 **Steel(留手×1.5) / Gold(回合末留手 +$)** 牌增强。
- 缺口：`card-scoring` 只遍历**出的牌**；手牌里"留着不打"的牌没有结算入口。
- 建议：新增 `HeldCardScore` pass —— 出牌结算时另遍历**未出的手牌**，套 `Card.mods`(held 类) + PerCardRule(held 类)。与现有逐张 pass 同构、同纪律（迭代=引擎、规则=数据）。
- **Lead 落地（done，引擎侧）**：新增 `HeldHand{cards}` 组件（PlayedHand 兄弟件，装配层填"未出的手牌"）+ card-score-pass 在出牌循环后**同 execute 内追加留手循环**（复用 lookup/rules/rng/trace，**零新系统/零新调度边**——独立系统会与 card-pile/resource-apply 经 RandomSeed/Resource RMW 成环，故并入）。`Card.mods[].held?` + `PerCardRule.held?` 标记：留手循环套 held 标记的，出牌循环跳过 held（互不双算）。复用 matchPerCardWhen/applyToResource/chancePass（held 规则也可带 ② chance，如 reserved_parking）。测试：held 规则/mod 对留手牌生效 + 出牌 pass 跳 held。全绿。
  - **给 PE 的接线契约**：装配层每次结算填 `HeldHand.cards`=手里没出的牌；Baron=`PerCardRule{when:rankIn[13],op:mul,mult,1.5,held:true}`；Steel=`Card.mods:[{op:mul,target:mult,value:1.5,held:true}]`。
  - **未纳入**：Mime（留手牌**重触发**）需 held 版 retrigger，单提；Gold「回合末留手 +$」属 G 组（on_round_end 触发，游戏侧）。

**④ 小丑「自增长」可变状态（P2 · 体积 中-大 · 解锁 ~25 张）**
- 解锁：Ride the Bus(连续无人头 +1/手)、Green Joker(+1/手 −1/弃)、Obelisk、Supernova、Square、Runner、Red Card、Ice Cream/Popcorn(递减)…
- 缺口：Effect 是无状态数据；这些要一个**随触发累加、按条件重置**的 per-joker 计数。
- 建议：per-joker `Counter{ id, value }` 组件 + 声明式更新规则 `on: signal, delta, resetWhen?`；计分时用 `valueFrom{ resourceId: 该 counter }`（已有）读出。引擎只做"按规则累加/重置 + 暴露为可读值"。
- 确定性：纯整数累加，状态进快照/关键帧。
- **Lead 裁决（wontfix / 重组覆盖 —— `Counter` 组件冗余，回驳）**：per-joker 自增长计数 = **一个 `Resource`（计数本体，进快照）+ `Effect{onSignal, kind:'modify-resource', op:'add', value:±delta}`（每手/每弃累加）+ `Condition→Event→Effect{op:'set', value:0}`（按条件重置）+ 计分 `valueFrom{resourceId:该计数}`（读出）** —— 全是现成能力（effect-apply modify-resource on signal、condition+event-when、REQ-013 valueFrom），`Counter{on,delta,resetWhen}` 只是它们的语法糖。
  - **为何与 ① 区别对待（① 下沉、④ 回驳）**：① 的"每次买卖手动维护计数 Resource"是**易错同步代码**（弱模型写不稳）→ 才下沉；④ 的"每手/每弃发个信号 → 声明式 +delta"是**干净声明数据**（游戏本就为回合流程发 hand_played/discard 信号），过弱-LLM 尺子——同 Bull(REQ-013 valueFrom)、REQ-017「card-pile+State+condition+effect 全数据回合流·零新能力」的已立范式。加 `Counter` = 为糖拓宽引擎，撞防臃肿红线。
  - **等价数据写法**：Green Joker = `Resource gj=0` + `Effect{onSignal:'hand_played',op:add,value:1}` + `Effect{onSignal:'discard',op:add,value:-1}` + `Effect{onSignal:'score',targetId:'mult',op:add,valueFrom:{resourceId:'gj'}}`；Supernova/Ice Cream 同形（起始值+每手 ±）；多个自增长小丑各给唯一计数 id。
  - **真缺口（另评，非本项）**：个别**重置/累加条件**——Ride the Bus「含人头」、Obelisk「最常打牌型」——是 poker-eval **派生事实**缺口（同 isFlush/isStraight 族），归 ⑤ 逐个评；计数机制本身不缺。

**⑤ 被动改判型规则（P2 · 体积 中 · 解锁 ~8 张）**
- 解锁：Four Fingers(4 张成顺/同花)、Shortcut(带空顺)、Splash(每张都计分)、Pareidolia(全算人头)、Smeared(红/黑各算同花)、Oops! All 6s(概率翻倍)。
- 缺口：`poker-eval` / `card-scoring` 判型与"哪些牌计分"是写死规则。
- 建议：`PokerHand` 读一组可选规则修饰 Flag（fourFlush/fourStraight/allScore/facesWild/suitMerge…），由小丑置位。**只读 flag 改判定，不引入新牌型。**
- **Lead 落地（done 部分，引擎侧）**：`evaluateHand(cards, mods?)` 加 `HandMods{fourFlush,fourStraight,gappedStraight,suitMerge}`；`isStraightRanks(ranks, need?, maxStep?)`（1 参数向后兼容，game-g 复用不破）。`PokerHand.handMods?:{fourFlushFlag,fourStraightFlag,gappedStraightFlag,suitMergeFlag}`（各=Flag.id），poker-eval 读 Flag → 构建 mods → 判型。**只读 flag 改阈值/合并，零新牌型**；缺省（无 flag）行为完全不变（57+7 测试证）。覆盖 **four_fingers / shortcut / smeared**。全绿。
  - **给 PE 的接线契约**：被动小丑用 set-flag Effect 置 `mod_*` Flag；PokerHand 配 `handMods:{fourFlushFlag:'mod_four_fingers',...}`。
  - **未纳入（另评）**：Splash（每张都计分）需改 `scoringCardIndices`（card-scoring 侧，非 evaluateHand），单提；Pareidolia（全算人头）改 per-card「is face」匹配（card-scoring matchPerCardWhen 侧）；Flower Pot（四种花色 ×3）= 新派生事实「花色种数」（同 rankMaxCount 族，countOf 不覆盖花色种类）；Photograph（首张人头）需「首个匹配」谓词。逐个真拉动再评。

**⑥ 跨实体效果：复制 / 改牌 / 改其它小丑（P3 · 体积 大 · 解锁 ~15 张）**
- 解锁：Blueprint(复制右侧小丑)、Brainstorm(复制最左)、Invisible Joker(2 回合后卖出复制一个随机小丑)、DNA(复制出的牌进牌库)、Vampire(吸附魔)、Midas Mask(人头→黄金)、Hologram…
- 缺口：小丑只能改全局 Resource；不能读/写**别的实体**（其它小丑/牌库的牌）。
- 建议：先做**只读复制**（一个小丑"引用"另一个小丑的 Effect 列表，结算时一并跑）——比"运行时改牌库"小且确定。改牌库/吸附魔留到后面单评。**体积大、确定性最难，建议最后做。**
- **Lead 裁决（defer / 暂不下沉 —— 不整包做，待具体卡逐族单提）**：⑥ 没有"干净的最小切片"，每个最小版都拖进一类抗数据化的东西 → 整包下沉 = mini 规则引擎 = inner-platform，撞防臃肿头号红线。逐族说明：
  - **复制相邻小丑（Blueprint/Brainstorm）**：要小丑**排序/相邻**（game-e 概念，每回合算"右邻是谁"= 代码、过不了弱-LLM 尺子）+ **effect 复制+上下文重放**。无干净通用形。
  - **改牌库/改牌（DNA/Hiker/Midas/Marble/Certificate）**：运行时**改别的实体数据**（往牌库加牌、给某张牌永久 +mods）——确定性最难（快照/录放/定序），且"加哪张/改哪张"的寻址抗数据化。
  - **吸附魔/毁其它小丑（Vampire/Ceremonial Dagger/Madness）**：跨实体**读取+移除**——同上，更重。
  - **个别其实是别的能力**：baseball_card「每个 uncommon 小丑 ×1.5」是**连乘**（非 ① 的 count×coeff 加性），单独评；Invisible Joker 涉及"卖出"经济触发（G 组）。
  - **路径**：留 `open(deferred, P3)`。真要做时**按族逐个最小 REQ**（先"只读复制"族——需先有干净的小丑排序数据接口；再"改牌库"族——需先定运行时牌库变更的快照/确定性契约），各由具体卡拉动、附弱-LLM 尺子证明，不一次性塞。其余 5 项（①done/②done/③done/④wontfix/⑤done）已闭合，⑥ 不阻塞它们。

**落地节奏建议**：① countOf（最小、先解锁一批）→ ② 概率 → ③ 手牌内（顺带补全 REQ-E-021 的 steel/gold 一条线）→ ④ 自增长 → ⑤ 规则修饰 → ⑥ 跨实体。每项落一项，PE 跟着把对应小丑从 catalog 接成可玩并加测试。PE 同时并行做留在游戏侧的两项（更多触发 / 条件重触发），不等引擎。

---

### REQ-E-022 · [2026-06-18] · PE（Game E 小丑牌 · 真实牌库扩充拉动）· 框架级 · status: **done（引擎侧 + 游戏侧接线 2026-06-18）** · 优先级: 中 · 类型: 真缺口（poker-eval 缺 isFlush/isStraight 派生事实）

> **落地**：引擎侧 `PokerHand.isStraightFlag?/isFlushFlag?`（poker-eval `setFlag` 写 evald.isStraight/isFlush）。游戏侧接线：blueprint 加 `F_STRAIGHT/F_FLUSH` Flag 实体 + PokerHand 配置指向它们，`containsCondition` 补 straight/flush 分支；STARTER_JOKERS 加 Crazy/Droll/Devious/Crafty/The Order/The Tribe（可玩 25→31）。headless 测试证「打同花 → Crafty +80 筹码」端到端生效。全绿（tsc + 1418 vitest + build）。

**标题**：`poker-eval` 暴露 `isFlush` / `isStraight`（含 `isStraightFlush`）派生事实 —— 与现有 `rankMaxCount`/`pairCount` 同类

- **拉动（真实）**：可玩小丑只有 25 张（已 14→25）。下一批官方 common 卡在「含顺子 / 含同花」条件上打不出：
  **Crazy(顺+12倍) / Droll(同花+10倍) / Devious(顺+100筹) / Crafty(同花+80筹) / The Order(顺×3) / The Tribe(同花×2)** —— 6 张核心 common，全因引擎读不到"这手是否含顺/含同花"而无法成数据。
- **已经试了什么 / 卡在哪**：游戏侧 `containsCondition`（`blueprint.ts`）已能用 `rankMaxCount≥2/≥3/≥4`、`pairCount≥2` 表达"含对子/三条/四条/两对"（REQ-011 派生事实）；但 **poker-eval 不写 isFlush/isStraight**，所以 `containsCondition('straight'|'flush')` 直接 `throw`。这正是 REQ-011 当时留的口（注释明说"需补 isFlush/isStraight 等派生事实"）。
- **建议方案（最小、与现有派生事实同构）**：`PokerHand` 配置加可选 `isFlushResource?` / `isStraightResource?`（缺省不写，零迁移）；`poker-eval` 在判型时本就算了 flush/straight（`isStraightRanks` 已导出），把布尔写成 0/1 Resource（与 `rankMaxCountResource` 同一套写法）。游戏侧 `containsCondition` 读它 → 上述 6 张变纯数据。
  - 含同花 = flush/straight-flush/flush-house/flush-five 任一；含顺子 = straight/straight-flush。poker-eval 判型已知，直接投影。
- **可复用性**：任何"按牌型门控"的卡牌游戏都要（与 rankMaxCount/pairCount 同级的基础派生事实），非 Game E 专属。
- **边界**：只加这两个（可选带 isStraightFlush）派生事实；不引入新计分、不动定序。
- **交付后游戏侧接线（PE）**：`containsCondition` 补 straight/flush 分支 → STARTER_JOKERS 加这 6 张（catalog id 已在）。可玩数 25→31。

**关于"真实的牌库"（全 150）—— 路线图（Lead 按价值排期，逐个单提，不一次性塞）**：catalog 150 张元数据已全；可执行的随能力解锁。除本 REQ 外仍缺：
- **随机/概率**（Misprint/8 Ball/Bloodstone…）：需确定性概率 roll（lockstep 安全）。
- **计数缩放**（Joker Stencil ×空槽 / Abstract +每小丑 / Blue +每张牌…）：valueFrom 读"实体/牌库计数"。
- **自增长**（Ride the Bus / Green Joker / Obelisk…）：跨回合可变 joker 状态 + 触发时累加。
- **别的触发时机**（on_discard / on_round_end / on_blind_selected）：需这些信号（on_round_end 数据已有、jokerToEntities 暂跳过）。
- **改其它实体**（Blueprint 复制右侧 / DNA 复制牌 / Brainstorm…）：joker 读写 joker / 改牌库。
- **条件重触发**（Mime / Sock and Buskin / Hack / Dusk…）：PerCardRetrigger 按 when 条件（现仅按 index）。

→ 本次只请裁决 **isFlush/isStraight**（最小、解锁 6 张、与 REQ-011 同纪律）。其余等真实拉动逐个评。

---

### REQ-E-021 · [2026-06-18] · PE（Game E 小丑牌 · 卡牌附魔/buff 拉动）· 框架级 · status: **done（引擎侧，2026-06-18，Lead）** · 优先级: 中 · 类型: 真缺口（逐张计分读不到「牌自带的修正」）

**标题**：`card-scoring` 逐张 pass 读取「牌自带的内禀修正」（per-card 附魔/buff）—— Card 携带 mods，迭代时套用

- **想实现（游戏行为）**：Balatro 的卡牌**附魔**——版式（foil +50筹码 / holo +10倍率 / poly ×1.5倍率）、增强（bonus +30c / mult +4m / glass ×2m / stone +50c）、红蜡封（该牌重触发）。本质：**一张特定的牌身上带着持久修正，在它计分时生效**——一个 per-card buff 系统。
- **已经试了什么 / 为何回驳「不加能力」的重组**：唯一的纯游戏侧路子是出牌时按附魔牌**落在出牌序列里的下标**临时注入 `PerCardRule{when:{index,eq}}`、tick 完移除。**这是牵强的**：
  - `PerCardRule`/`PerCardRetrigger` 的 `when` 只认 **suit/rank/index**（设计给**小丑规则**——扫描全手的外部规则，如"每张♦+3m"）；附魔是**某张牌的身份内禀**，不是位置/花色规则。
  - 用位置规则模拟身份附魔 → 游戏层每出一手都要**重新推算"我那张 foil 落在第几位"再注入规则**，这段绑定逻辑是**代码、每次动作重跑** → 过不了"最弱 LLM 一致产出数据"的尺子。错抽象（拿规则引擎模拟属性系统）。
- **卡在哪（引擎做不到的点）**：`Card = {suit, rank}`（`components/cardboard.ts:45`）**没有承载内禀修正的槽**；`card-scoring`（`tier3/card-scoring.ts`）的逐张循环已经**逐张拿到了 `c`**，但只累加 `baseChipsByRank[c.rank]` + 套外部 `PerCardRule`，**读不到"这张牌自带的修正"**。
- **建议方案（最小、与现有循环同构）**：
  1. `Card` 加可选 `mods?: Array<{ op:'add'|'mul'; target:string; value:number }>`（target=Resource id，如 chips/mult/money）。card-scoring 逐张循环里，在 baseChips 之后、按序套用 `c.mods`（与 baseChips 同一 `repeats` 重触发循环内，自然吃 retrigger），emit `appendScoreEvent(trace, 'percard-mod', …)`（UI 演出复用现有回放）。
  2. `Card` 加可选 `retrigger?: number`（红蜡封）：并进现有 `repeats = 1 + Σ…`（与 `PerCardRetrigger` 同算），让该牌连同其上 mods/小丑一起重复。
  - 版式/增强全是数据：foil=`{add,chips,50}`、holo=`{add,mult,10}`、poly=`{mul,mult,1.5}`、bonus=`{add,chips,30}`、mult=`{add,mult,4}`、glass=`{mul,mult,2}`、stone=`{add,chips,50}`。弱 LLM 可照填。
- **边界（守住，不外扩）**：① 只做**计分牌的内禀 mods + 内禀 retrigger**；② **不做**手牌内（held-in-hand）触发（steel/gold/blue/purple 蜡封那类——从手牌而非出牌结算，是另一条触发线，单提）；③ 不引入伤害分型/重定向/身份版 PerCardRule 匹配。
- **可复用性（非 Game E 专属）**：「实体携带修正、在被处理时套用」是通用 buff 原语——卡牌符文/装备词条/牌面状态跨卡牌游戏复用；与 REQ-F-061（命中那刻读目标 hp 做门）同类——都是**迭代/结算循环缺一处"读被处理对象的数据"**。
- **交付后游戏侧接线（PE，非引擎）**：数据 `Card`（`deck.ts`）带 `enchant` 字段 → `toEngineCard` 把它映射成引擎 `Card.mods/retrigger`；附魔**来源**用塔罗牌/卡包商店项（纯游戏侧数据 + 表现），给某张牌盖章。视觉徽标（角标/描边）游戏侧做。
- **请 Lead/主程裁决**：是否 ACCEPT 为 card-scoring 的最小扩展（同 REQ-F-061 纪律：迭代循环补"读被处理对象数据"）。
- **Lead 评判 + 落地（2026-06-18，引擎侧 done）**：核实 PE 全部论点属实（`Card={suit,rank}` 无槽 `cardboard.ts:45`；`PerCardRule/Retrigger.when` 只认 suit/rank/index 非身份 `card-scoring.ts:29`；模拟附魔需每手重算下标注规则=代码、过不了尺子）→ **真缺口，ACCEPT**。与 REQ-F-061/F-065 同纪律（结算循环补"读被处理对象自身的数据"）。
- **架构裁决（用户问：要不要扩成通用「Buff」抽象）→ 不扩，按窄做**：F-061/F-065/E-021 看着像一个东西，但**生效语境不同**（计分/伤害/命中各在自己循环）；统一 Buff 必逼出 trigger/context 规则引擎 = inner-platform 腐烂源、弱 LLM 更难一致产出、跨系统耦合、固化。正解：**语境=循环本身（隐式）**，各能力就地读相关数据；共性只收在小 shape `{op,target,value}`（PerCardRule/Effect 已用、Card.mods 复用）= 词汇复用非框架。真正跨语境、共享叠加/时长、≥2 游戏拉动时再议（现非）。
- **落地**：`Card.mods?: {op:'add'|'mul',target,value}[]` + `Card.retrigger?: number`（`cardboard.ts`）；`card-scoring` 逐张循环在 baseChips 后、`PerCardRule` 前按序套 `c.mods`，`repeats += c.retrigger`（连同 mods/小丑重复），emit `percard-mod` trace（UI 回放复用）。零迁移。测试：foil 异质 + 无 mods 不变 + add 先于 mul + 红蜡封重复。全绿（tsc + 1394 vitest + build）。
- **给 PE 的接线**：数据 `Card.enchant` → `toEngineCard` 映射成 `Card.mods/retrigger`；附魔来源(塔罗/卡包)、视觉徽标 = 游戏侧。

---

### REQ-F-065 · [2026-06-17] · 策划 PF（装备系统 atk 生效 · owner 2026-06-17 钦定路A）· 框架级 · status: **done（引擎侧，2026-06-17，Lead）** · 优先级: 中（装备武器线唯一阻塞）

**标题**：`scaleByResource` 支持「施法者本地资源」寻址（per-caster scaling），表达逐单位异质缩放

- **拉动（真实，已核代码）**：Game F 装备系统——武将拖装备（武器 +atk），**每个单位装备不同 → atk 加成异质**。现 `strike_${h.id}` 模板 `amount=finalAtk(h)` 是 build 期常量，星级靠预建模板族切换；伤害的 `scaleByResource`（hitbox.ts `findResourceById`）只查**全局**资源 → **无法逐单位缩放 atk**。HP 已能 live 生效（deploy override 写本单位 Resource），atk 不能。
- **想实现**：让 `scaleByResource`（或新增 `scaleByCasterResource`）解析时**先查施法者/spawn 源实体的本地资源，未命中再回退全局**（一处解析改动）。则：每将一个 per-unit 资源 `eq_atk`（deploy override 连续精确写），strike 按施法者 `eq_atk` 缩放 → 装备 atk 连续生效。
- **与 REQ-023 区别（不重复）**：REQ-023(group-effect) 被 wontfix 是因**同质**羁绊光环可走"全局 buff 资源 + 各单位读全局"重组；但它明确留口「**各单位状态异质、全局共享值表达不了**才下沉」。装备 atk 正是异质（每将不同装备不同加成），全局 buff 资源表达不了 → 命中该留口。
- **额外收益（manifesto 论据）**：现星级用"预建模板族 `_s{star}`"模拟逐单位缩放本身是 smell；此能力一并能让星级改用 per-unit 资源缩放，**退掉模板族爆炸**，净简化引擎而非加宽。
- **owner 决策**：2026-06-17 owner 在「路A(下沉小能力·连续精确·推荐) vs 路B(桶化模板·零引擎但量化+模板膨胀)」中**钦定路A**。
- **确定性**：deploy 拍写 per-unit `eq_atk`（构建快照 + 镜像关键帧均捕获，同 HP override 路径，安全）；纯整数/定点，回放不破。
- **交付后游戏侧接线（Program F，非引擎）**：deploy override 写 `eq_atk = Σ装备atk`；strike 模板 `scaleByResource: 'eq_atk'`（与全局 dmg_scale 叠乘）。
- **Lead 评判 + 落地（2026-06-17，引擎侧 done）**：缺口属实（异质 per-unit 缩放，全局 scaleByResource 表达不了，正中 REQ-023 留口；退星级/装备模板族 = 净简化）→ **ACCEPT**。**但原提案"scaleByResource 查施法者本地"漏了前提**：spawn 出的 strike 命中那刻**没有施法者实体链**（`PrefabOrigin`/`SpawnRequest` 只带 `originHex` 格、不带 source 实体）。故先补**源 threading**，再做本地解析：
  - `SpawnRequest.source` / `PrefabOrigin.source`（新 POD 字段）；`caster`(=`originEntity ?? 自身`) 与 `self-rule`(普攻=自身) 盖章 → `prefab` 转记到每个展开实体。
  - `hitbox.ts` 新 `findScaleResource`：`scaleByResource` **先查施法者本地**（源实体自身 + 其**同次展开的复合兄弟**，同 `templateId+seq`——因一实体一 Resource、main 占 hp，故 eq_atk 必在兄弟子件上）→ **未命中回退全局**（dmg_scale 等行为不变、零迁移）。
  - 测试：异质两将(eq_atk 3/5)同 amount 出不同伤 + 源自身快路 + 无 source 回退全局。全绿（tsc + 1375 vitest + build）。
- **给 PF 的接线契约**：① `eq_atk` 作 per-unit Resource 放在**棋子复合体的某个子件**（与 strike 的 `source`=棋子 main 同 `templateId+seq`；main 已占 hp），deploy override 连续写；② strike `scaleByResource:'eq_atk'`。**注意单 `scaleByResource` 只乘一项**——要 per-unit × 全局 dmg_scale 同乘，把 dmg_scale 折进 eq_atk（写时含团队系数），或单提"多段缩放"我再评（非本次最小下沉）。

---

### REQ-023 · [2026-06-09] · 主程4（Game F 拉动）· 框架级 · status: **wontfix（2026-06-15 结案 · 重组覆盖）** · 优先级: 低

**标题**：`group-effect` —— 把效果 fan-out 到一组实体（集合写）

- **想实现**：羁绊光环——"3 战士羁绊 → 所有战士 +10 攻"。
- **建议**：`GroupEffect{ filter, action }` 把 action 施给每个匹配实体。
- **Lead 裁决（不 greenlit）**：多数逐单位羁绊光环可用 **group-count（数羁绊层数）→ 写一个全局 buff 资源 → 各单位 stat/hitbox 读该全局 buff** 重组绕过，不必逐单位 fan-out。只有"各单位状态异质、必须逐个写、全局共享值表达不了"的羁绊时才下沉。待真实拉动再评估。

---

### REQ-F-061 · [2026-06-13] · 主策划（Game F 卡牌系统 D0 拉动）· 框架级 · status: **done**（2026-06-13，Lead）· 优先级: 中 · 类型: 真缺口（hitbox 缺血量条件门 + 处决）

**标题**：hp-条件伤害 / 处决（斩杀 / 残血加伤 / 狂暴）

- **想实现**：对 hp<X% 目标加伤/处决——玩家卡牌「白衣/攻心/渡江」+ 太阁 Boss 谦信/真田/立花/半藏（`game-f-deck-spec.md` §牌组10、`game-f-taikou-roster.md` §六）。
- **卡在哪**：`src/skills/tier2/hitbox.ts` 过滤只有 targetMask(Tag)/requireMask(Status)；伤害只有 amount+fracOfMax，**无「读目标当前 hp 比例做条件门」**。血量是连续 Resource 烘不成 Status；condition/event-when 是触发层，管不到命中那刻目标血量 → 真缺口。
- **建议**：`Hitbox` 加只读门 `requireHpFracBelow?`/`requireHpFracAbove?`（读 target current/max），不满足跳过；处决 `executeBelow?` 命中即清 0。**只读 hp 比例做 gate，不引入伤害分型/重定向**（守草船借箭回驳边界）。倍率走 REQ-012 mul、动态值走 REQ-013 valueFrom（均 done）。
- **Lead 评判（ACCEPT·已落地）**：真缺口核实——hitbox 结算循环只有 Tag/Status 门，命中那刻读不到目标 hp 比例；C→E→E 是触发层，够不到命中那刻目标血量。是**通用战斗原语**（处决/残血加伤跨 ARPG/自走棋复用，与 `fracOfMax`/`requireMask` 同类），数据**扁平**弱 LLM 可填——不是臃肿配置。落地：`Hitbox.requireHpFracBelow?/requireHpFracAbove?/executeBelow?`（乘法比较保确定性、缺省零迁移），`hitbox.ts` 加「②.5 血量门/处决」+ 3 守护测。关羽斩杀 = `Hitbox{ amount, targetMask:ENEMY, executeBelow:0.15 }`；残血加伤 = 第二个 `requireHpFracBelow` 门的打击区（重组）。

---

### REQ-F-062 · [2026-06-13] · 主策划（Game F 卡牌系统 D0 拉动）· 框架级 · status: **open（Lead 打回细化，暂不实现——见评判）** · 优先级: 低-中 · 类型: 真缺口（aggro 索敌策略不可选，只能最近）

**标题**：aggro 索敌策略（最远 / 最高威胁 / 最低血，非只最近）

- **想实现**：刺客绕后锁后排、狙击锁最高威胁、嘲讽——玩家卡牌「绕后奇袭」+ 太阁 Boss 政宗/岛津。
- **卡在哪**：`src/skills/tier3/aggro.ts` 写死 `nearestByTag`；`Perception` 只有 targetTag/sightRadius，**无策略字段**，数据层无开关。
- **建议**：`Perception.policy?: 'nearest'|'farthest'|'highestStat'|'lowestHp'`（缺省 nearest，向后兼容）+ spatial-query 加对应变体（沿用 id tie-break 保确定性）。不改语义、不动定序。
- **Lead 评判（打回细化，暂不实现）**：① 核心 policy enum（nearest/farthest/lowestHp）确是真缺口（`aggro.ts` 写死 nearest、`Perception` 无策略字段）；但 ② **「嘲讽」不属本能力**——嘲讽是**目标侧**强制他人改指向，`Perception.policy`（攻击者侧）实现不了张飞嘲讽，混入是误判，须另案（目标侧机制）；③ **「最高威胁 highestStat」欠定义**——项目无"威胁"Resource，缺 stat 来源字段；④ **未被真实数据拉动**——关羽斩杀/张飞嘲讽仅在设计稿 HTML，实装数据零引用。按「不为想象需求拓宽引擎」（REQ-023 同纪律）**暂不实现**；待真实单位钉死具体策略需求，再落 nearest/farthest/lowestHp（嘲讽另案）。

---

### LEAD→PF · [2026-06-14] · Game F · status: **open** · 类型: 去腐交办（game-f 由「程序」变回「数据」；游戏侧执行）

**背景（Lead review 实测，跨游戏对比）**：game-f 不是"被描述成数据的游戏"，是一段 TS 程序——非测试码 **2658 行**、生成器构造（`for/map/Math/…spread`）**56 处**、**两段脉冲标记 114 个（其余 5 游戏合计 0）**、EventWhen×39 / Effect×115 / Flag×78（对照 game-b：0 / 6 / 5）。过不了"最弱 LLM 一致产出"尺子。**病灶单一、是"在数据里编程"，非架构问题**——`game-b` 已证纯数据可行。

**交办（全部游戏侧；引擎已备齐，Lead 不为此加任何能力）**：
1. **blueprint.ts → 纯数据 manifest**：照 `game-b`（`data/game-b.manifest.json` + 85 行薄 loader `parseManifest`，零工厂/闭包）把 `buildGameFBlueprint()` 的生成器（`band/visSwap/chrome/makeRoundFlow` + 循环 + 算术）展平成 JSON 实体表；算出来的值（CD_TICKS / income 档 / hp 计算）直接写定值。
2. **采用 GameShell（已落地 `@ui/shell`）**：DOM 壳层写成一份 `GAME_F_UI: UILayout` 数据（stat/bar/button→signal/tabs），**删** 697 行手写 `game-f.tsx` 壳 + canvas 隐形按钮 + DOM 假点击桥（x=2000）。
3. **商店两段脉冲（shop_marks→shop_marks2 等 114 个）→ 由 GameShell 数据 UI 取代**：面板不再靠多拍 destroy/重铺脉冲，改 GameShell 按 `CardPile.hand` 声明式渲染 → 脉冲标记清零。
4. **valueFrom 经济链（10 处）保留**（合法跨游戏能力，game-e 亦用），不必动。

**边界**：纯游戏侧。引擎该有的都有（manifest loader=game-b 证、valueFrom、flow、prefab、GameShell）。**Lead 明确回驳"把 game-f 脉冲下沉成引擎能力"**——脉冲 114 vs 全员 0 = 一个游戏的特有玩法，下沉会把 game-f 的臃肿注入共享引擎 = 腐蚀架构（同 REQ-F-062 / REQ-023 纪律）。

**验收**：blueprint 生成器构造 → ~0（展平为数据/JSON）；脉冲标记 → ~0；`game-f.tsx` 收敛成 ~30 行薄 mount（如 `game-b.tsx`）；过"最弱 LLM 能照填吗"尺子；tsc + vitest + build 全绿。

**Lead 裁决（2026-06-14 复核 PF 回报）**
- ✅ **band/visSwap/chrome 展平：验证通过**——调用/定义 →0、片0 快照守证 **byte 等价**、引擎零污染、1160 绿。真收益，收下。
- ⛔ **回驳"字面化 makeRoundFlow/templatesFor"（修正本交办原措辞）**：二者是**薄确定性展开器**（`makeRoundFlow`=pacing 配置；`templatesFor`=roster 数据→prefab + 阵营选择），与 game-b 的 `manifest.json + 85 行 loader` **同类**——**"数据驱动 ≠ 零函数"**，判据是"内容扁平 + 展开器薄/固定/确定"。硬字面化会砸 36 处测试快进 + 多阵营，得不偿失。**保留为"扁平数据 + 薄展开"。** PF 这条线划对了。
- ✅ **③ 解锁：Lead 已给 GameShell 加通用 `image` 节点**（静态 src / 绑 StringVar 动态 src；rule-of-three 远超：VN 立绘/换装/卡牌/商店；**非 game-f 脉冲下沉**）。商店=**固定 3 槽** → 3×(`image`+`stat`+`button`) 即可，**不需 `list`**（避模板化 DSL 腐烂高风险区，YAGNI 暂不加；真有干净跨游戏拉动再议）。**棋盘拖拽/点将台留 canvas（drag-place 能力），不归 GameShell。**
- **修订验收**：band/visSwap/chrome→0 ✅已达；makeRoundFlow/templatesFor 保留（不计入"生成器构造"目标）；脉冲清零 = PF 用 GameShell（HUD/tabs/buttons 用现有节点 + 商店用新 `image`）重写壳层 + 退役假点击桥。**引擎侧到此为止（image 已加，不再为 game-f 加任何能力）。**

**进度 + owner 裁决（2026-06-15，Program F 记账）**
- ✅ **脉冲清零**：商店两段脉冲（shop_marks/shop_marks2）+ 大卡模板 + 占位框全删，114→0（商店改 GameShell `image` shop_face / 后被 owner 调整，见下）。
- ✅ **band/visSwap/chrome 展平**（Lead 已确认）。
- ✅ **派生去腐（顺手）**：商店卡/名牌从 ROSTER 派生，删手抄 `HEROES`/`HERO_NAMES`（「加英雄=一条 HeroSpec」，过尺子）。
- ⛔ **②「game-f.tsx → 完整 GameShell / ~30 行 mount」= owner-overridden，标 wontfix（暂）**：owner（2026-06-15 真机复核）**明确撤掉 GameShell 与 canvas 并存**（报「棋盘下方堆出第二套点将台/主公卡」重复 bug），**钦定保留手写 DOM HUD**（主公信息卡复位左下角、右栏改盟友布阵预览）。GameShell 蓝本（`GAME_F_UI`）保留作数据壳层参考 + 测试，但**不在局内并存渲染**。
  - → **designer-loop「去腐 T-F4 硬优先」与 owner 决定冲突 → 以 owner 为准、暂挂**。若 owner 日后要全 GameShell 化（需 GameShell 长出 modal/drag-slot/动态 list 等通用节点，属 Lead），再重启。
- 余项（非 owner-blocked，按 Lead 裁继续）：blueprint→manifest 全量展平（大、低优先；makeRoundFlow/templatesFor 按 Lead 保留）。

---

### REQ-F-064 · [2026-06-15] · game-f（Boss 技能拉动，经用户转 Lead）· 框架级 · status: **wontfix / done-covered（2026-06-15 结案）** · 类型: 现有能力重组（非缺口）

**标题**：太阁 Boss 技能（信长全军 buff / 秀吉·本愿寺援军 spawn / 真田自残血加伤 等）

game-f 报「多数需新引擎能力」。Lead 实测：**三个已点名技能全部现有能力可表达 → 回驳；引擎冻结成立**。等价数据写法：
1. **信长·全军 buff** = `group-count`/触发信号 → `Effect{modify-resource dmg_scale_boss, valueFrom}` → 全 Boss 方 `Hitbox.scaleByResource` 读它。**game-f 自己已实装同款**（`decks.ts` synergy/threshold/round-buff 写 `dmg_scale_a`，`combat.ts:27` hitbox 读），Boss 版对称。
2. **秀吉·本愿寺援军 spawn** = Boss 技能信号 → `Caster{onSignal, template:'honganji_*', at:'self'}` → `SpawnRequest` → `prefab` 展开援军队。`caster.ts` 自陈「信号→生成桥…召唤」，示例含召唤/掉落。
3. **真田·自残血加伤**（注意：自身 hp，**非** F-061 的目标 hp）= `Condition(自身 hp < 阈值=frac×已知 maxhp)` → `Event`→`Signal` → `Effect{modify-resource dmg_scale_sanada}` → 其 `Hitbox.scaleByResource` 读它（Condition→Event→Effect + scaleByResource 重组）。

**流程纠正**：笼统「多数需新能力」不达需求模板「试了什么/卡在哪」的标准 → 一律回驳。某技能数据**确实**表达不了（如需连续反比血量、阈值+valueFrom 线性都不够）就**单提那一个**附失败重组，逐个评。

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

### PG-乙→甲 · [2026-06-21] · Game G · status: **open（转交甲·owner 拍板"留给甲砸"）** · 类型: 战斗段死代码清理

> owner 把一份 game-g.tsx「三套战斗血脉地图」review 转给乙。涉及的全是**甲的战斗段/文件**，按 甲/乙 正交铁律乙不碰；登记于此交甲，owner 已同意由甲清。

**现状真相**：`onPlay → startBattle() → showTurnMatch()`（回合制·**活**·turn-combat.ts + turn-battle-screen.ts）。两条 UI 不到达的**死路**：
- **实时血脉**：`showMatch()`（game-g.tsx L577–810·~234 行）+ 16 个实时常量（`LIVE_STEP_MS/RENDER_MS/POINTS_MAX`… L27–51）+ helpers（`buildBattleViewLive/snapLivePos/armyToDeploys/canDrawFrom/clashToView/BattleControl/NO_CONTROL`）+ import（L1 battle-screen / L4 live-combat）。续命测试：`battle-screen.{frame,click}.test.ts`、`live-combat.test.ts`。
- **Engine 血脉**：`buildGameGMatch()`（blueprint.ts）UI 从不 import；续命测试 `game-g.test.ts`（~1028 行 oracle）；`game-g.tsx` L12 注释"出征打一关(buildGameGMatch)"已过时。

**活的·勿碰**：`showTurnMatch`(L457–574)、`showLobby/showBetween`、`settleTurn`、`aggregateTengang/tengangFxOf`、`seededShuffleArr`(L255–260)、`clashToTurnView`，及 turn-combat/turn-battle-screen/lobby-screen/level/disha 全目录。

**建议**：甲确认清除时机后，整体砍实时血脉（~280 行 + 16 常量 + 3 测试文件）+ Engine 血脉占位（含 L12 注释），并给顶部 import/常量/helper **加分区注释**隔离三代实现。**乙不动**（战斗段=甲地盘）。

---

### REQ-G-战斗结构 · [2026-06-21] · design G → 甲（引擎域） · Game G · status: **✅ 核心已实现（甲·战胜硬币 50/50 + 3D 表现 + 玩家亲掷/AI自动）；调参钩子(stayPMul/续航门)随后续天罡地煞重设计再落** · 优先级: **P0** · 类型: 真缺口（结构性·非数值）

> **★ owner 拍板 + design G 原型验证通过：掷命胜者「掷人头·留场续攻」。完整契约 `doc24 §4.2`。**
>
> **甲已落地（2026-06-21·commit 战胜硬币）**：`resolveClash` 加 `winStays = nextRandom(b.rng) < 0.5`（种子化·可回放）；**人头=留场续战 / 人面=回牌库+返还半费**；`coin-flip.ts` CSS-3D 抛掷表现，**我方亲手点掷·AI 自动掷**，挂战力明细特写之后（不盖明细）。owner 当面口径=纯硬币 50/50、AI 同样。
> **本次按 owner「后面会重新设计天罡/地煞做数值平衡」暂缓的（原 doc24 §4.2 细则）**：① `stayPMul`（天罡/地煞调留场概率·死战不退上调） ② 续航门（`staminaLeft>1` 才可留、留场 `staminaLeft−1`） ③ `CLASH_WIN_STAY_P` 可调常量。→ 并入后续「天罡/地煞重设计」批次随平衡一起标定。
>
> **甲实现要点**：
> 1. `turn-combat.ts` 加 `CLASH_WIN_STAY_P = 0.5`（tunable）。
> 2. `resolveClash`（当前 L345-353「无条件回库」）→ 胜者掷确定性币：`nextRandom(b.rng) < P_eff && wf.staminaLeft > 1 ? 留场续攻(staminaLeft−1·保持前锋位·下回合继续推进) : 回库(返半费·现行奖励)`。
> 3. `P_eff = clamp(CLASH_WIN_STAY_P × (该侧 fx.stayPMul ?? 1), 0, 1)`；`TengangFx`/`DishaFx` 加 `stayPMul`（死战不退/督战 → 上调或锁 1）；aggregate 填、天罡/地煞数据写。
> 4. 向后兼容：`CLASH_WIN_STAY_P=0` 退化为当前"必回库"（测试可锚）。
> 5. （可选·后续）`CLASH_STAY_P_K`：留场概率随掷命余量上调（强牌更能续推·owner「让强牌就有概率往前推」），先 k=0。
>
> **design G 原型实测（临时 patch resolveClash·已撤·N=300·关1·新手deckBias=3+5铜地支+虎符旗手）——证明数值终于可标定**：
>
> | 留场 P（玩家/Boss） | bossDelta 0 | bossDelta +12 | bossDelta +18 |
> |---|---|---|---|
> | 0 / 0（=当前模型） | 100% | 100% | 100%（**全免疫·复现 bug**） |
> | 0.5 / 0.5 | 96.3% | 95.0% | 93.3% |
> | 0.5 / **0.75**（owner 授权守将） | 94.7% | 92.0% | 89.0% |
> | 0.5 / 1.0（死战不退·列奥尼达本命） | 87.7% | 82.0% | 78.3% |
>
> → **WR 终于随 留场P + bossDelta 移动**；关1 列奥尼达=温泉关死守=守将留场 P≈1.0（死战不退地煞）+ bossDelta ~+12 → 新手 ~80% ≈ targetWR。**owner 授权守将 75% 收到**：单独 0.75 仍 ~92%（偏易），配死战不退(→1.0)+牌力才压到 80%。
>
> **同时（§六派甲·独立）**：level loader/sim 接 **16写死 pokerDeck + ≤5 tiangang + dishaScale**（当前仍跑旧 54张+favorBias+12随机天罡）→ 否则标定的不是真 Boss·上表为旧模型·方向性。
>
> **甲实现「人头留场续攻」+ 接 16写死模型 后 → design G 重跑 sim·扫 P+dishaScale 收敛各关 §四 targetWR·回填关卡配置。**
>
> ---
> **（以下为根因记录·供甲背景）** 读 `turn-combat.ts`·结构·非数字：
> 1. `resolveClash` L345-353：掷命后胜者立即「光荣回牌库」离场（owner 6-21 改）→ 每次遭遇双方前锋都清空 → 没一方能维持推进（赢了也走）。
> 2. `advanceColumnToBase` L368-383：空路白送 chip（某路只一方有兵 → 直接破家·不掷命）。
> 3. 贪心玩家吞吐 > Boss AI → Boss 覆盖不全三路 → 玩家走空路破家。
> 4. 合流 → 胜负由占路/到家先后决定·牌力几乎不参与；源泉堆 20+ → 按点数收费咬不动。**「人头留场续攻」让赢家(尤其强牌)能持续推进/反推 → Boss 终于能攒攻势 → 牌力决定胜负·数值可标定。**

---

### REQ-G-诅咒地煞 · [2026-06-21] · design G → 甲（引擎域） · Game G · status: open · 优先级: P1（关5/终章难度·非阻塞） · 类型: 真缺口（周期性 disha op·可下沉）

> **owner 提**：Boss 新被动「诅咒」——**每 N 回合（默认 3）一次，把玩家场上随机一张兵返还牌库 或 退回起点格**（周期骚扰·打断铺场推进）。
> **评判（design G）**：现有 disha 词汇表达不了（真缺口）；但与现有 `batteryEveryTurns`（大炮兵·每N回合压一路）**同构**——周期触发机制甲已有 → 加同类新 op 即可，**不是新引擎子系统**。
> **数据形**：`{ kind:'curse', op:'bounceUnit', everyTurns:3, mode:'toDeck'|'toStart', pick:'random' }`。
> **派甲**：① `DishaFx` 加 `curseEveryTurns`/`curseMode`；② 推进/AI 回合按 `turn % everyTurns === 0` 触发（仿 `batteryLane`），用 `b.rng` 选牌（确定性·进 turnHash）；③ `aggregateDisha` 填；④ design G 把数据写进 disha-pack（关5 项羽/终章·**不配关3/4——它们实测已过难·见 doc27 §3.5**）。
> **配套（已覆盖·提醒甲）**：「每 Boss 招牌地煞=被动·掷命时全屏亮『XX 发作』」= 已在 `REQ-G-战斗逻辑批次·敌用地煞全屏通知`，本需求复用之。
