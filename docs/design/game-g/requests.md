# game-g 需求单（游戏域工单）

> 2026-07-15 立（owner 拍板「工单随游戏走·游戏可暂停」）：本游戏的 bug/玩法/演出/平衡工作票在此，
> 域主（程序/PE/design）自取自结，**不占主池 10 槽**（主池 `docs/workflow/requests.md` 只管引擎本身）。
> 标「控件缺口/引擎收编」的条目=引擎域候补——落地须走主池腾槽或 capgap 通道，游戏层不得自造。
> done 迁 `docs/workflow/requests-archive.md`；3D 线仍在 `docs/workflow/requests-3d.md`。

---

### NOTE-PA→game-g/PE · emoji 图标清单（456 处·待转 Image 槽）· [2026-07-16] · PA 审计产出（owner「game-g 美术盘点·出遗漏 emoji 清单」）→ **待 game-g/PE 取用** · status: **open（清单已出·转槽是 game-g/PE 域·PA 不改蓝图）** · 类型: 美术盘点·遗漏面
> **背景**：owner 盘 game-g 美术，三层现状=① 53 真美术已上（牌面 portrait）② 57 占位 SVG（needs-art·**T2 台账已有 skinKey 槽·管线可换**）③ **456 处 emoji 当图标散在 29 个 UI 文件的 LayoutNode 文本里**——这层**没被任何美术槽捕获**（emoji 是文本字形·非 Sprite/Image）→ T2 derive 抓不到、生成管线够不着。这是 owner 说的"遗漏的 svg/emoji"。
> **清单**：`docs/design/game-g/emoji-icon-inventory.md`（`node scripts/emoji-audit.mjs game-g --md` 产·**可重跑**·随转槽进度递减）。含：按 emoji（种类×次数×代表上下文×位置）+ 按文件（哪屏最多→优先）+ 逐处 file:line 明细。Top：♠♥♦♣ 花色·★ 星级·⚔💎🎴🪙🎲🛡🀄🧩⚙📖…；热点文件 hero-codex(76)/turn-battle-screen(66)/overlays(50)/game-g.tsx(38)/collection-screen(35)。
> **给 game-g/PE**：要美术化的 emoji → 把「文本里的字形」改成「带 `skinKey` 的 `Image` 控件槽」（UI 铁律·`Image.src` 走资产 key）→ 台账 `art-requirements` 重跑即纳入生成管线，之后走占位→生成→人审→替换的既有闭环。**PA 立场**：只出清单（审计），转槽=game-g/PE 域（改蓝图/HUD），不越界代改。
> **注**：清单已滤掉纯注释行/花色逻辑记号（581→456），留的是玩家可见 UI 文本里的 emoji；行尾注释里的零星 emoji 可能有极少量残留，人读无碍。
> **更新（owner 2026-07-16 拍板·省掉手转槽）**：owner 决定**不逐个手转 Image 槽**——改由 **UI 库自动「文本 emoji→美术图」渲染**（`docs/workflow/requests.md` REQ-UI-emoji图渲·指派 PUI）。PA 已出映射底座：**game-g 456 处 emoji 100% 可映射到库里 Twemoji 美术图**（直中 415 + alias ⭐等 41），映射表 `docs/design/game-g/emoji-art-mapping.md`。**→ game-g/PE 这块基本无需动手**（等 PUI 渲染层落地即整体变美术图）；只有"非 emoji 的专属美术图标"才需走 Image 槽。

### REQ-G-主将牌面「将」艺术字·顶部小浮标→牌面正中大字 · [2026-07-06] · owner R22 → **指派：程序B（turn-battle-screen.ts 牌面渲染·LayoutNode 表现）** · status: **open** · 类型: UI 表现重排（主将身份标·程序B 域·基座件已够·非新能力）
> **owner 原话**：「（关1）那两个（主将）就是敌将和我们的主将，那两个字太小了在上面，应该在牌面上还是有一些表示的——大一点的、牌面中间有个『将』字。艺术字，用那个艺术字来表示。」
> **现状**：主将身份现在只是牌顶一个 `size:8` 的小浮标 `⭐主将`/`☠敌将`（`turn-battle-screen.ts:249` 场上兵·`:336` 手牌·`y:-12` 飘在角上）——太小、不显眼。牌**正中**现在是大花色字（`:243` `size:30`）。
> **要做（程序B·turn-battle-screen.ts）**：主将牌 → 牌面**正中**摆一个**大「将」艺术字**（`font:'display'` 艺术/展示字体·基座件已支持·`render.ts:236` + 对决标题 `:400` 已在用），替掉/弱化牌顶那个 8px 小浮标。① 敌/我区分保留（我方 gold/`mine` 色·敌方 `danger`/`foe` 色·或留个小 ⭐/☠ 角标点缀·程序B 表现裁量）；② 与正中大花色字的关系由程序B 定（将字替花色 / 花字做水印衬底 / 二者叠放）——只要一眼看出「这是主将」且不糊。
> **为何是程序B·非程序A**：`general:boolean` 数据我（程序A）已产出并流到 `TurnSlotView.general`/`TurnHandCardView.general`（`:150`/`:152`）——**零逻辑改动**，纯牌面重排。`font:'display'` 艺术字是**现成基座件**（无需主程扩能力·无手写 DOM）→ 程序B 直接用 LayoutNode Label 重排即可（UI 铁律内·基座件表达得了）。
> **验收**：check-ui 过（防重叠/糊字）；关1 开局两主将牌一眼可辨（大将字）；手牌里的主将同样处理。

### REQ-G-行军FLIP误抬静止牌·敌方推进时我方前锋原地升落 · [2026-07-06] · owner R22 → **指派：程序B（turn-battle-screen.ts FLIP 行军动画）** · status: **open** · 类型: 表现 bug 修（FLIP 误判·程序B 域·非逻辑/数据）
> **owner 原话**：「敌方向我移动的时候（还没轮到我的回合），跟他下一轮会接触的（我方）牌，突然向上升了一下，又落下来了。」
> **根因（程序A 已诊断·非逻辑 bug）**：FLIP 行军块（`turn-battle-screen.ts:1000-1012`）遍历**所有** `[id^=cell-]` 格子，判据只看**屏幕坐标漂移**：`dx/dy = 旧位−新位`，`if (|dx|<0.5 && |dy|<0.5) return`（`:1003-1004`）——只要漂 ≥0.5px 就套 `g-march`。而 `g-march`/`g-march2`（`:99-114`）**不管 dx/dy 多小、恒定先抬 −54px 再落回**。敌方牌推进到与我方前锋相邻时，我方那张**静止牌**因布局回流（相邻 clash/border 高亮框出现、lane reflow）屏幕位置漂一两像素 → 被判「动了」→ 套上 g-march → **原地猛抬 54px 又落**。**数据侧无误**：`diffMoved`（`game-g.tsx:446`）只把真换了 `li:slot` 的兵放进 `justMovedIds`，静止牌不在其中；`moveOrder`/`moveDist` 也只含 justMoved 兵（`game-g.tsx:656/660`）。
> **修法（程序B·择一）**：① **把 FLIP 限定到真移动的兵**——`:1000` 遍历里，若 `u.id` 不在 `orderOf`（=justMoved 集·`:999` 从 `moveOrder` 建）则 `return` 跳过（静止牌即便屏幕漂也不套 g-march）。这是最干净的：g-march 只该给逻辑上真换格的兵。② 或收紧漂移阈值/改用逻辑位移判据（但 ① 更本质）。
> **不是程序A/不是逻辑**：掷命/移动/碰撞逻辑（turn-combat.ts）与 `justMovedIds` 数据流**均正确**·此条纯 FLIP 表现误判。
> **验收**：敌方推进相邻我方前锋时，我方静止牌**纹丝不动**（不再升落）；真移动的兵行军动画不受影响（错峰逐跳照旧）。

### REQ-UI-PlayingCard/Button 控件缺口（尺寸 + 透明底图） · [2026-07-06] · PG（game-g R21 布局重置 + owner 换背景撞见）→ **指派：PUI（src/ui/** 控件集域）** · status: **open（控件写死不透明·PG/PE 不擅改 render.ts）** · 类型: 基座控件扩能（加尺寸档 + 透明底图支持·additive）
> **① xl 尺寸档**：owner R21 要绝命对决特写忠实设计稿（`design/UI/Game G 绝命对决.dc.html`·牌 **118×142**）；现 `PlayingCard` 尺寸闭集 `PCARD_DIMS` 最大档 `lg=[82,116,18,46]` 偏小。**申请** `PCARD_DIMS` 加 `xl:[118,142,22,58]`（纯加档·零回归）。到货后 PG 把 `clash-card-m/f` `size:'lg'→'xl'` 切一行。
> **② 透明底图支持（owner 2026-07-06 换背景撞见·实图为证）**：owner 生成了**带透明色(alpha)的牌背图**放进 `PlayingCard.backArt`，但渲出来牌边不透明——根因：`renderPlayingCard` 给牌**恒画不透明底** `faceBg`（back=`linear-gradient(#b34a4a,#8c3535)`）+ `border:2px solid` 垫在图下，所以图里透明的地方**露出的是牌自己的不透明红底、不是牌后的绿呢**（非"图片格式不对"，PNG alpha 没问题）。**申请**：`PlayingCard` 加透明模式——`art`/`backArt` 为透明图时**不画 `faceBg`/`border`**（或加 `bareFace?:boolean`/`faceBg?:'transparent'` 口子），让图的 alpha 透出牌后底。同族：`hero` Button（`renderButton` 的写死投影/内高光/`cover` 裁掉透明边）也挡透明 skin——一并请 PUI 给 hero 透明 skin 干净透出。
> **为何不 PG 自己改**：`src/ui/**` = UI 基座控件集（**PUI 域**·owner 2026-07-16）；扩控件闭集走 requests（UI铁律「表达不了→requests.md 扩控件·绝不手写逃生」）。**现状已知规避**：game-g 大厅底图改走 Panel 自己的 cover 贴图（`home-felt`·已落 `fdffd8c4`）绕开 Screen 被盖；但牌面/按钮的透明只能等本单。

### REQ-G-复查尾巴三件 · Lead review 2026-07-04 批产出（程序A/B 点名必读） · [2026-07-04] · 主程 → **程序A（①③）· 程序B（②）** · status: open · 优先级: P1 · 类型: 复查落地（owner 拍板「把三条尾巴给程序员A和B落地」）
> **① 程序A·对折下限=3 落码**：owner 定案在 `REQ-G-掷骰核两bug ①`（spec/验算已写死·`Math.max(0)→3` 一行+测试）——当前代码停在临时版 `P_MIN=1`（`clash-resolve.ts:31`），定案未落。落完该单标 done。
> **② 程序B·红旗 DOM 增量清偿名单**：本批新增 5 处手写 DOM 全在 `game-g.tsx`（斩击两半/斩线/胜者戴冠/交战 cue 覆层×2·git diff 42e264d1..HEAD 可点行）。处置：**登记在此=「REQ-UI-锚定 落地后第一批切换 Float/Connector」名单**，锚定件上线前不强拆（owner 迭代速度优先）；**但即日起新增**浮层/连线/特效手写 DOM，提交信息必须挂缺口单号——红旗棘轮（REQ-QA-红旗棘轮·施工中）上线后由门禁强制「只降不升」。
> **③ 程序A·战斗 bug 核对清单逐条回报**：`REQ-G-战斗bug核对清单` 仍挂「待程序A 回报 fixed/未修」——逐条回报后 design G 才能重跑 sim + owner 重玩新流，别让链路断在回报这步。

### REQ-CAP-改掷RollMod下沉 · 引擎 dice 核收编 game-g RollMods 先例（天罡②/game-d/英雄牌共用） · [2026-07-04] · 主程（天罡原生重构 ② 架构裁决派生） · status: **排队（指派：Opus·xhigh·战斗核稳后随虚胖清算一波做·不阻塞战斗迭代）** · 类型: 引擎 capability 扩展（正确性关键·确定性）
> **裁决更新（2026-07-04·与 `e780156a` 空中相遇）**：程序A 已在 game-g 落了掷骰系（`clash-resolve.ts` 的 `RollMods{bonus,floor,twice}` 纯函数核+确定性测试）——**形状合格·不打回**（数据行+纯函数，正是易迁形）。本单由"新建"改**"收编先例"**：引擎 `t2-dice` 吸收 RollMods 闭集（字段名对齐先例·补 `autoWinIfStronger`/铁骰语义入 opposedRoll）→ game-g 切换消费引擎核、删本地副本 → game-d/英雄牌复用。这也是宪法「游戏先证明、引擎再收编」的标准路径，撞车成本≈0。
> **spec（Lead 图纸）**：`src/skills/tier2/dice.ts` 族加 **`RollMod` 闭集**（数据行，非钩子函数）：`{kind:'bonus',value}`（掷后加值）/ `{kind:'floor',min}`（掷值下界钳）/ `{kind:'advantage'}`（掷两次取高）/ `{kind:'autoWinIfStronger'}`（我方战力≥敌免掷直接胜·仅 opposedRoll 语境）。约束：①纯函数核（`applyRollMods(roll, mods, rng)` + opposedRoll 接 `mods` 参数）·确定性（advantage 的第二掷从同一 RNG 流序取·顺序固定）；②闭集进 registry describe/examples；③逐 kind 点名测试 + 组合序测试（bonus+floor 先 bonus 后 floor·文档钉死）；④不改 DicePool/RolledDice 既有语义（向后兼容）。消费方：game-g 天罡②（鬼手/磐石/灌铅骰/铁骰）· game-d 骰途改掷类 · 英雄专属牌改掷层（未来扩）。门禁全绿直推。

### REQ-G-即时法术/功能牌（对场上牌使用·补策略深度） · [2026-06-29] · owner 试玩后设计反思 → 战斗/design G 域 · status: **open（大方向·owner 说「先记录·暂不实现」）** · 类型: 核心玩法扩展（新通用能力·非重组）
> **owner 观察**：现在**没有一张牌是「针对场上局面、主动打出去影响某个目标」**的——天罡全是「打出后整场被动加成」，地煞是 Boss 专属被动。缺「即时·指定目标·改变战场」的牌。owner 直觉：**「功能牌 > 战斗牌」**才是好玩的深度来源（纯拼战力天花板低）。owner「先暂时这样吧」→ **只记录·暂不实现**。
>
> **PG/Lead 评判（CORE RULE）**：
> - **能重组现有能力表达吗？→ 不能**。天罡=build/cast 后**全局被动修正**，无「选目标 + 即时生效」这套；地煞 Boss 专属。→ **真缺口·该下沉成新通用能力**（不是加几张硬编码牌）。
> - **它同时补三个洞**：① 掷命过程**零 agency**（现在开打就只剩战力+骰子·玩家插不上手）；② **counter-play**（看局面出牌·而非战前定死）；③ **功能牌生态**（把重心从「谁战力高」挪向「谁会用工具创造局面」= 自走棋→战棋的关键一步）。
> - **数据驱动方案**：做「即时法术牌」**闭集** = `目标 × 效果` 两枚举拼数据·解释器固定在引擎（确定性/可仿真/可回放）·游戏层只写 `{target, effect, value}`：
>   - **target**（闭集）：敌前锋 / 我某兵 / 某一路 / 全场某花色 …
>   - **effect**（闭集）：斩杀 / +战力 / 调动到另一路 / 驱散士气 / 强加疲劳战损（接 v2 战损）/ 净化 …
>   - 最弱 LLM 也只填这三个字段 → 尺子过关。
> - **YAGNI/风险**：这是**大件**（选目标交互 + 效果系统 + AI 会用 + 平衡 + UI）。别一次铺满——**最小闭集起步：3 张即时法术**（斩前锋 / 增援一路 / 强加战损）验手感，再扩。
> - **与「功能牌>战斗牌」重心转移**：更大方向（重定义核心玩法重心），值得专门设计，不在本条一次做完。
> - **和 v2 战损协同**：owner 说过天罡要能跟战损结合 → 「强加战损/减免战损」正好是第一批功能牌 + 天罡的共用效果原语。

### BUG-G-掌机黑屏 · [2026-06-22] · owner→甲（cartridge/战斗屏域·owner 直派 bug 修） · status: **🟡 已修（zoom·`c5608bbc`）· 待真机烧版验证** · 类型: 弱 GPU 渲染回归

> owner 报新烧 cartridge 包「ZEROCRAFT OS 绿字开机条 + 黑屏」、同代码 Mac 正常。掌机 = `build:cartridge`（`dist-cartridge`·base `./`·直挂 game-g 无 launcher）·弱 GPU webview。
> **穷尽定位**：非 JS 崩溃——cartridge 真产物无头(happy-dom)挂 game-g 零报错·大厅/战斗 DOM 全渲(605KB)·tsc/vitest1664/build:cartridge 全绿 → 弱 GPU 合成失败。
> **根因**：闪烁修(`7634b027`)把战斗屏首帧烤成 transform:scale 单合成图层·弱 GPU 合成整屏图层失败→黑（旧两段绘制 CPU 先画可见帧＝"闪烁"）。
> **修(`c5608bbc`)**：战斗屏 1340×858 适配 transform:scale → **CSS zoom**（CPU 布局缩放·不合成图层·消闪烁·Mac 等价·zoom 不支持也只裁切不黑＝fail-safe）。
> **待 owner 真机验**。若仍黑次候选：① `cartridge-entry.ts` 整屏 `#game-root` opacity 渐变；② 战斗浮层 backdrop-filter。详见 `SESSION-HANDOFF.md §0`。

---

### REQ-G-Player-AI · [2026-06-21→升级 2026-07-03] · design G → 程序A（引擎域·AI） · Game G · status: **in-progress（owner 2026-07-03 拍板做终极版·design G 派子代理施工）** · 优先级: **P0-TOP（sim 唯一解锁点·压过数值线一切）** · 类型: 真缺口（**owner 明确豁免数据驱动·单独开发·复杂**）· 规格: `design/player-ai-spec.md §二·五`

> **owner 2026-07-03 升级**：实测确认「贪心 AI 不行·sim 没意义」→ **必须建终极版 Player-AI**，「用更复杂的高级版·**推演敌人未来**的东西·再做决策」。→ 从"三档"升级为**前向推演搜索（expectimax）**（`player-ai-spec §二·五`）：克隆局面 → 试候选动作 → **调现成 Boss AI 推演敌人应对** → N 步展开 → `rollWinProb` 算 EV → argmax E[P(赢)]。七组件骨架见规格。**这是 sim 说人话的唯一前置·最高优先。**

> **owner 拍板**：「玩家 AI 是我们游戏**非常独特的一部分**，必须**单独开发**。我**不觉得是数据驱动的**——**尽其所能写复杂点**。」这是唯一明确豁免"数据驱动宣言"的代码（理由见规格 §六：它是引擎侧确定性决策器·像掷命解算器一样属"固定解释器"·不是要产出的游戏数据）。
> **问题**：现 sim 的"玩家"是贪心脚本（天罡>最便宜部署>抽），只会无脑铺场→ sim WR **手感不准**（关1 显示 96% 是"菜 BossAI + 蠢玩家"双重失真）。
> **派甲（P0）**：手写一个**搜索 + 局面评估型**的强玩家 AI（**非** if-else 堆叠·**非**数据驱动）：
> - 决策架构：枚举合法动作 → N 步前瞻（掷命用 logistic **期望胜率**算 EV·不掷骰）→ `evalState()` 评估 → 回溯选最优；高 skill 叠**多回合规划层**。
> - 评估函数特征：破家进度/三路力量差(非线性·奖励集中)/推进位置/连携潜力/源泉续航/主将安全/Boss 明牌威胁折算。
> - 高手战术：**田忌赛马·集中突破**、连携规划、部署费用曲线、掷命预报择战、续航轮换、天罡择时、针对 Boss 明牌 counter。
> - **三档玩家心智（owner 2026-06-23·质变非调参·详规格 §五）**：**初级**=贪心「看哪空往哪放」(skill1·N=0)；**中级**=「看哪路弱就往那路堆兵 + 叠 buff」(skill3·N=1·单步评估找软肋集中)；**高级**=「有策略：打不过的路用拖延战术拖住·精算自己胜算·不追求满血过关」(skill5·N=3~4·全规划层·**目标函数=最大化 P(赢)·非血量**)。
> - **高级档灵魂**（owner 重点）：优化**胜率**不优化血量——算出净赢路径就敢让路/弃子/亏家血；打不赢的路最小代价拖延、把资源砸到算得赢的路集中破家。
> - **它只用合法可见信息**（看不到 Boss 手牌·与 Boss-AI 的信息不对称互补）。sim 同时报初/中/高三条 WR（验难度对不同水平的坡度）。
> **验收**：① skill1≈老贪心(回归)；② skill5 在纯镜像(Boss-AI 也修好)下 ≈50%(两 AI 旗鼓相当·公平底层成立)；③ 接 3 明牌地煞能把 skill5 玩家标到各关 targetWR（关1 ~70%）。
> **与 REQ-G-Boss-AI 的关系**：两套独立智能·**都做完** sim WR 才可信（Boss 靠多看·玩家靠多算）。design G 用 skill5 高手当基准重标整条曲线。

---

### REQ-G-地煞原生战力重构 · [2026-07-01] · design G → 甲（引擎域·disha） · Game G · status: **→ 转策划（owner 2026-07-04：设计/数值归策划先定；owner 亦会另提单。落定后若需新 disha 能力再回甲下沉）** · 优先级: **P1（承接新掷战力骰核）** · 类型: 重构（win%→原生确定战力/规则）· 规格: `design/disha-native-power-redesign.md`

> **背景**：owner 2026-07-01 把对决核改成**各自掷战力骰**（`[1,战力]` 比大小·vision doc §7）。现 15 张地煞仍是 win% 经 `dishaEdge=edge/5` 折算的**临时 hack**——在掷战力骰下 **+1战力 边际胜率 ≈ 1/(2P)·非常数**，edge/5 只在 P≈10 对·别处失真。owner：「所有地煞需重新设计成数值正确的行为。」
> **design G 已出 effect 设计**（规格逐张 review 15 张）：一律弃 win%·改三种原生落点——**A. +战力**（抬掷骰范围·大多数）/ **B. 改掷算子**（mul/add·爆发型·待改掷层）/ **C. 规则**（firstStrike/noRout/多命/homeHp/周期/开局排阵·已是规则）。
> **派甲重构 `disha.ts` DishaFx**：
> 1. **删** `allWinPct/generalWinPct/phalanx*Pct/eliteMidWinPct/flankYouWinPct/firstStrikeWinPct/winStreakPer(%)/batteryWinPct` 等 **win% 字段** → 换 **`*Power`（+战力）** 或规则字段（见规格 §二逐张映射）。
> 2. **退役** `dishaEdge = bossEdge/EDGE_TO_POWER` 折算路 → 直接 `bb.pEff += Σ地煞战力`（进战力拆解·明牌·不暗改）。
> 3. **两处公平清理**：`swarm`(大军压境)/`maneuver`(机动调度) 现是 `bonusMana`（偷源泉·owner 已禁）→ swarm 换 `startFormation` 明牌人海、maneuver 换 疾行(speed2)/改掷（见规格 §三）。
> **数值**：规格给的是**方向性起始值**·design G 待「思考型玩家仿真台 + loader + 两 AI」落地后重扫定稿（现贪心玩家 + edge/5 旧值全作废）。**先落原生行为骨架·数值后标。**
> **与掷战力骰的交互**：`winstreak`（每胜+战力）对冲疲劳对折（项羽越战越勇）；`firstStrike`（平局判胜）在低战力场景比 +战力更值。
> **补（owner 2026-07-01）**：地煞不必全 +战力·**部分可用乘法(%)** —— 基础战力高的兵（霸王/近卫）用 `×1.2/×1.5` 能给"奇怪 build"留 emergent 空间。加法=稳定保底·乘法=随基础放大。乘法过防爆炸红线（乘不叠·夹CAP）。详规格 §一。

---

### REQ-G-英雄专属战术牌+改掷层 · [2026-07-01] · design G → 甲（引擎域·改掷解释器） · Game G · status: **→ 转策划（owner 2026-07-04：卡设计/数值/开放问题归策划先定；owner 亦会另提单）。⚠️ 架构口径：改掷层「解释器」本身是引擎侧能力·归甲建，等策划把「哪些牌·改成什么值」的闭集 spec 定稿后回甲下沉——现设计阶段在策划** · 优先级: **P1（"战斗操作做到极致"主线·大工程）** · 类型: 真缺口→通用数据能力（改掷解释器）· 规格: `design/hero-signature-cards.md` + `game-g-clash-fate-roll-vision.md §2.2/§2.3`

> **owner 2026-07-01**：扩展天罡 → **战斗中可打出的英雄专属战术牌**（对牌/对英雄单体使用·如拿破仑望远镜/亚历山大成名物件/孙子兵法）。**收集这些牌组才有意义**。"这两条线在做，一个是**把战斗操作做到极致**"——本系统是那条线的核心载体。
> **CORE RULE 评判**：真·体验缺口（战斗中无操作=看戏·重组不掉）；**不新增第4套牌**（owner 明说"扩展天罡"）→ 天罡长子类型：通用天罡 + **英雄专属牌（单体定向·战斗中打）**；**数据驱动过关**——每张 = `{hero,target,timing,effect:{op,value}}`·复用改掷(mul/add)/+战力/规则词汇·**零 per-hero 代码**。
> **⭐ 操作模型（owner 2026-07-01 拍板·修订 vision §2.2 的"每场掷前窗口"）**：**自走棋式·掷时零选择**。玩家**只在自己回合**做战术决策；战斗结算像自走棋、那一刻不加操作；掷骰要有**仪式感**（两骰同屏亲手掷·看双方掷值）但**不弹选择框**。→ **改掷层不需要"每场对决的交互窗口"**（省一大坨繁琐 UI·一并解决 vision §8#1）。
> **派甲（分步·先地基·按新操作模型）**：
> 1. **回合内预挂**：玩家回合把改掷算子/专属牌**挂到某 unit/lane**（仿 `castIds` 记在兵/路上）。这是**唯一决策点**。
> 2. **结算自动应用**：`resolveClash` 掷时**自动读取已挂算子**应用（`applyRollMods` `mul/add`）→ 双方各掷 `[1,战力]` 比大小·**零交互**。**resolveClash 已留 TODO 插入点。**
> 3. **护栏**（§2.3）：乘不叠 / 每场限张 N=2 / 掷后夹 `ROLL_CAP=60`。
> 4. **掷后重掷 = 极稀有·做成预挂自动触发**（"若此掷落败自动重掷1次"·掷时仍无需点）·全局仅此一类。
> 5. **通用定向**：卡带 `target`（self-unit/enemy-hero/any-unit/lane）→ 引擎选目标 + 应用算子。AI 同权在自己回合预挂（§5）。
> 6. **与地煞合流建议**：做成**玩家专属牌 + Boss 地煞共用**的通用解释器（同 `{target,op,value}` + 都"回合内定·结算自动应用"）→ 一次实装两边都吃（与 `REQ-G-地煞原生战力重构` 合并）。
> **已拍板**：buff自己+debuff敌方都支持·必须拥有英雄才有其牌·不占天罡loadout·须封顶数量+带弊端。**仍待 design G/owner**：数量上限值·单体/群体·统一词汇表 → design G 定后出首批英雄牌数据。**先实装地基·数据后填。**

---

### REQ-G-掷骰仪式按赌注缩放 · [2026-07-01] · design G → 程序B（表现/演出·程序A 供数据） · Game G · status: **延后 TODO（owner「先感受原始满仪式心流·再做跳过」）** · 优先级: P3 · 类型: 演出规则（非新数值）· 规格: `design/theory-numbers-and-flow.md §4.1.2`

> **背景**：owner 追问「掷骰零操作·还要亲手掷·是不是掩耳盗铃？」→ design 结论：掷骰=**结算仪式**(诚实·非假操作)·但**仪式必须配得上赌注**·否则每次为杂兵亲手掷=真空洞真繁琐。
> **派甲/乙（演出分级·非改数值）**：
> 1. **关键遭遇**（可能破家 / 折损己方 carry / 胜率 ~35-70% 悬念区）→ **完整两骰·亲手掷·满仪式特写**。
> 2. **无关小遭遇**（悬殊胜率·如预报 ≥90%/≤10% · 或杂兵挡路）→ **自动结算·一闪而过·不弹亲手掷钮**。
> 3. **一次推进多场遭遇** → 只给**最关键那场**满仪式·其余自动批量结算。
> **判据**：`clashOdds` 落在悬念带 + 该遭遇是否触及大本营/carry → 决定"满仪式 vs 自动"。阈值 design G 用 sim/试玩标。
> **为何重要**：同一掷骰机制·配得上=扑克翻河牌·配不上=老虎机折磨。这条是"决策观赏分离"不塌成空洞的**唯一护栏**。

---

### REQ-G-战斗心流实装(总) · [2026-07-01] · design G → 程序A(逻辑)+程序B(表现) · Game G · status: open · 优先级: **P0（owner 派·先做 Phase 1 可玩里程碑）** · 规格: `design/IMPL-PLAN-combat-flow.md`

> **团队（owner 2026-07-01）**：**程序A**（原"甲"）=逻辑·**程序B**=表现/演出。以后 game-g 派单按 A/B 分工。
> **owner 2026-07-01「把这套东西落成策划案·让程序员实现」**。已收敛成一份分期实装策划案（含决策台账·程序A/B 一扇门看全）。
> **Phase 1（先做·owner 试玩找感觉）= 原始满仪式心流**：① 战斗常量对齐（起手源泉4·关1 homeHp3）② 主将命数参数化（关1=3命）③ 破家善后=回库 ④ **⭐满仪式掷骰演出**（两骰同屏·亲手掷·掷时零操作·执命仪式）⑤(可选)开局排阵静守。**验收=owner 玩关1 判"决策前置+掷骰执命有仪式感+节奏对"。**
> Phase 2 招牌层（地煞原生重构+startFormation）· Phase 3 专属牌/改掷层 · Phase 4 数值对齐（design G+Player-AI）。
> **本 REQ 统辖已拆的子 REQ**（起手源泉/主将命数/破家善后/开局排阵/地煞原生/专属牌+改掷层/掷骰缩放）——按策划案 Phase 顺序做。**先节奏后对齐·先 Phase 1。**

### REQ-G-满仪式掷骰演出（掷骰执命·心流核心） · [2026-07-03] · design G → 程序B（表现/演出·程序A 供数据） · Game G · status: open · 优先级: **P0（Phase 1 里程碑·让 owner 感受心流）** · 规格: `design/theory-numbers-and-flow.md §4.1` + `IMPL-PLAN-combat-flow.md P1.4b`

> **owner 2026-07-03 派**（Phase 1 表现半边·逻辑半边程序A 在做）。目标：把对决那一下做成**「掷骰执命」满仪式**——owner 玩关1 时"决策全前置 → 亲手掷骰 → 看命运翻"的心流成立。
> **设计支柱（`theory §4`·别违）**：**操作全前置·掷骰纯仪式·掷时零操作**。掷骰=结算仪式（诚实·非技巧检定）；亲手掷给**节奏能动（何时揭晓）+ 归属感 + 翻命主题**·不给结果控制。
> **⚠ 先审后补（别重做已完成的）**：✅ `clash-dice-3d.ts`+`syncDice3D`（`4daf7280`·引擎 ThreeRenderer 3D 双骰旋转+粒子·当前装饰旋转不落真实面）；✅ 一步步阵亡/对折演出（`f6e88a2e`）；✅ 掷值文本+预报%（vision impl）。
> **要补齐的"满仪式"缺口（对照 `theory §4.1` 审·缺则补）**：
> 1. **亲手掷的节奏能动**：进特写 → **玩家点「掷命」钮才揭晓**（非自动滚完）——掌控"何时面对命运"。
> 2. **掷前信息**：显双方 `[1,P]` 战力范围 + `clashOdds` 真实预报%（非 100/0）。
> 3. **3D 骰落真实面（打磨）**：双骰停在各自 `rollA/rollB` 那一面 → 揭晓大者胜。
> 4. **节拍连贯**：掷前(范围+预报)→亲手掷→双骰落值揭晓→一步步阵亡/对折→收场。**全程掷时零操作**。
> **A/B 接口**（程序A 在 `lastClash`/`clashLog` 出）：`ea/eb`(=[1,P]上界)、`clashOdds`、`rollA/rollB`、`aWins`、阵亡、疲劳 `wins`。**程序B 只读播演出·不改结果**。
> **铁律**：走引擎 3D/UI 基座（别绕手写 CSS 3D）；动手前查 `docs/playbooks/index.md`；碰 LayoutNode 交付前跑 `check-ui`；演出层不动 rng/turnHash。
> **不含**：悬殊跳过提示（`REQ-G-掷骰仪式按赌注缩放`·延后 TODO）。
> **验收**：owner 玩关1 → "决策回合内做完·**亲手掷骰有执命仪式感**·掷前看清范围/赢面·节拍连贯"。
>
> **★ owner 2026-07-03 追加·战场阵亡/胜利 VFX（关键·别在结算框播·"我看不清楚"）**：阵亡/胜利演出**全在真实场上兵位**（锚 `u-<id>`）播——**不在特写/结算框里**（被盖住看不清）。三拍：
> 1. **败者**：战场原地被**一刀斩击特效切成两半**消失（要"被切成两半"的一刀·非淡出/小撕裂）。
> 2. **胜者**：战场**原地翻一圈**（翻命主题·翻完落回原位）+ **头顶戴一个特效/冠** → **留在场上**。
> 3. **战损/耐力对折**：从胜者**头顶飘字移出**（如「战力 −N · 对折」/「耐力减半」·上飘淡出）。
> **现状可复用**：`game-g.tsx` 已有 `playGhost`(tear/glory/fatigue·锚 `u-<id>`·`g-tear/g-glory/g-pin/g-exitlabel` 关键帧) 雏形 → **升级**：tear→"一刀两断"斩击（可加斩线特效 + 上下两半分离）· 新增胜者 spin+冠 · 飘字上飘。确保**3D 骰/特写收场后**才演或**与场上兵同屏不被盖**。
> **A/B 数据（程序A 已出·无需程序A 新增）**：`loser/winner id`、`aWins`、`warLoss`、`wins/winStreak`、`lastStand`、`winStays` 全在 `lastClash`。程序B 只读播。

### REQ-G-碰撞才战斗（clash 触发改「落点踩敌」）+ 胜者~~推进占据~~守原位 · [2026-07-03] · owner → 程序A(逻辑)+程序B(表现) · Game G · status: **逻辑 done ／ 胜者推进 owner 2026-07-04 推翻→「守原位不追击」done（程序B 授权直改战斗核）** · 优先级: P1 · 类型: 战斗核触发规则修正
> **owner 2026-07-04 推翻「赢了推进占腾出格」**：改**胜者守原位·不追击**——赢＝守住/敌离场·前进交回下回合正常行军（`resolveClash` 删 `wf.slot=腾出格`）。连带：胜者滑入克隆演出(advanceSlide)退役、clash-settle 四拍→三拍(斩→标→收)、turn-combat.test 改断言「赢守原位停 5·下回合正常补进 6」。tsc+vitest(206·flow-walk 满局 ~5s 收敛)+build 绿。**⚠平衡连带**：胜者不再瞬推 → 破阵变慢(赢了原地磨到 WIN_CAP 回库)·design G 关1 曲线或需复核。
> **程序B done（2026-07-04·表现层克隆版）**：斩→进→标 三拍定序（`clash-settle` timeline：slay 斩败者 → **advance 胜者克隆从「敌前一格」滑进「敌腾出格」** → survivor 对折/徽标 → resume）。① 顺带修「谁打谁提示演一半棋盘闪跳」：`resolveClash` 掷骰前就把胜负/前进/斩杀全落定 → `move:settle` 那次板面重渲会让败者凭空消失/胜者跳格；加 `perfPending` 门**压掉有对决排队时的板面重渲**，棋盘保持「两兵贴身对峙」到掷骰特写盖上，闪跳藏到全屏特写背后。② 胜者前进=`advanceSlide()` 克隆位移（exitCaps 旧位→真兵腾出格位·滑时暂隐真兵·落定复现·守原位/光荣回库跳过）。纯表现·不动 tb/rng/turnHash·headless 自动 no-op·turnmatch 冒烟测走真对决序列全绿。
> **余（数据驱动真前进·归「必程序」）**：现在滑的是**克隆**、真兵在全屏特写背后已归位——肉眼无差但非「数据驱动真前进」。要真兵真滑，需**程序A 把 `resolveClash` 拆成「掷骰(消费 rng·定胜负)」+「应用结果(前进+斩杀)」两半**，让结果应用延到掷骰演出之后（碰 rng 消费时序=turnHash·须带确定性回归测护改）。拆完程序B 把 `advanceSlide` 的克隆换成真兵 FLIP + 衔接。
> **原始记录 ↓**
> **owner 2026-07-03**：clash 触发从「前锋相邻 gap≤1 即战」改成**碰撞才战**——牌移动时**这一步的落点格里有敌人才打**；落点是空格只走位不打（→ 玩家可**确定预测**「这步会不会撞」）。胜后（owner 选 A）：停敌前一格·**赢了推进占据敌人腾出的格**。
> **程序A 已实装（logic·done·本 session）**：① `advanceSideMove`——前锋自然落点(`slot+dir*speed`)踩到/越过敌前锋才 `pending` 掷命（守军 hold/主将 pin/过门兵不撞）；实际移动仍封顶在敌前一格。② `resolveClash`——胜者留场则 `wf.slot = 敌腾出格`（守军「赢守原位」`!hold` 除外·满连胜光荣回库除外）。测试锁定（落点空走位·踩敌才战·赢了前进）。tsc+vitest+build 全绿。
> **程序B 待做（表演·owner「一个单独的表演过程」）**：碰撞掷命毕的**生死+前进演出**——① 败者场上阵亡（斩两半·见上条 VFX）；② **胜者从「敌前一格」滑入「敌腾出的格」的前进动画**（逻辑瞬时改 `slot`→程序B 补插值滑动；旧位=敌前一格·新位=`lastClash` 后的场上兵 slot）。与掷骰特写收场衔接·全在真实场上兵位(锚 `u-<id>`)。

### REQ-G-修正栈迁移并虚胖清算 · 天罡/地煞迁 t2-modifier-stack + 空头卡实装 · [2026-07-03] · 主程 → **指派：甲（game-g 战斗域）** · status: **① 迁移 done（程序A 2026-07-04）／ ② 空头卡清零 → 转策划全审（owner 2026-07-04「让策划都看一遍」）**
> owner 2026-07-03 拍板：不打断当前核心工作，完成后照本单施工。**一单双得**：P0 产品 bug（18/36 天罡零效果、141/156 地煞纯文案=玩家买到空头卡，评审 §六.1）+ 新能力首战 dogfood。
>
> **✅ part① 迁移 done（程序A 2026-07-04·3 提交）**：地煞 `aggregateDisha`（disha.ts）+ 天罡 `tengangFxOf`（game-g-build.ts）两套自写逐字段聚合循环**全删**，改走引擎 `t2-modifier-stack` 的 `aggregateModifiers`（保函数名+DishaFx/TengangFx 结构→调用方全不动）。行编码：地煞 `dishaRows`（DISHA_SPECS×DISHA_MERGE→行）、天罡 `TENGANG_ROWS` 描述子（op 词汇仍闭集一处）。**逐卡对照守护测试**：独立 oracle(旧循环语义) 跨全单卡/两两对/全集/各关阵容逐字段一致→零漂移。门禁 tsc+vitest(2251)+build 全绿。**空头卡·擎天 atlas 已修**（数据 filter:'highest' 旧 handler 只认 scope:'highestRank'→长期 no-op→现复活 powerMulHighest=1.5）。
>
> **② 空头卡清零 → 转策划全审（owner 2026-07-04·程序A 供诊断）**：诊断实测 **35 张天罡里 15 张零效果·且改造坊真在卖**。擎天已修（1）。剩 **14 张现有 TengangFx 字段表达不了 + 参数全游戏无处消费**——请策划逐卡定「gate 未解锁 / 下沉新能力实装 / 摘除」：
>   - **擒王** capturektg（`morale:killGeneralRout` 斩敌主将→溃散·无字段）
>   - **tempo 4**：疾行 swiftmarch(`advance`) / 泥沼 mire(`slow enemy`) / 抢滩 beachhead(`jumpToMid`) / 铁索 ironchain(`slow all`)（移动调度类·无字段）
>   - **lane 3**：驰援 rush(`reinforce`) / 舍车 discard2(`sacrifice`) / 调虎 lurefoe(`forceMigrate`)（换路/牺牲类·无字段）
>   - **arcane 印记 6**：斩首印 markdecap / 将魂印 markmorale / 铺场印 markswarm / 田忌印 marktianji / 双锋印 marksamerank / 铁律印 markodds（流派印记`mark`·另一套系统·现无消费）
>   - **★擎天平衡**：atlas 此前静默失效、design G 是在其失效前提下调的关卡数值→复活后「最强一张+50%」生效→请 design G 用 sim 回扫受影响关卡重标。
>   - 出处诊断：`tengangFxOf([card])===NO_TENGANG` 即空头；params 无消费点经全库 grep 证（campaign-data 的 `kind:'tempo'/'lane'` 仅 boss 招式文案·非这些天罡）。**注：spec 原写「18/36」，实测天罡池 35 张(城门令退役后)、空头 15 张。**
> **spec（Lead 图纸）**：① 天罡 TENGANG_OPS 18 已实装 op + 地煞 DISHA_SPECS/DISHA_MERGE 迁移为 `ModifierSource` 行数据 + `aggregateModifiers` 纯函数核消费（夹具已证全覆盖，见 `src/skills/tier2/modifier-stack.test.ts`）；删 game-g-build.ts/disha.ts 两套自写解释器（tengangFxOf/aggregateDisha）。② 未实装的 18 张天罡（tempo/lane/arcane/擒王）与地煞文案：**能用 ModifierSource+现有字段表达的实装之，表达不了的从卡池摘除或标注未解锁**——出货前空头卡清零是硬标准。③ 概率门/顺序交织类效果按聚合栈边界文档留在原路径（modifier-stack.ts 头注）。④ 迁移前后战斗结算数值必须逐用例一致（现有 28 个测试文件全绿 + 天罡/地煞逐张对照测试）；`node scripts/game-skill-audit.mjs game-g` 能力接入面应 +1。门禁全绿直推。
> 两个小瑕疵顺手带掉：modifier-stack describe 里 floor=下限钳语义写明白；同字段混用 or+数值算子的静默忽略加一行 warning 或文档。

### REQ-G-演出迁时间线 · game-g 演出编排迁 t3-timeline · [2026-07-03] · 主程 → **指派：程序A** · status: **部分落地（程序B 已迁演出拍·owner 2026-07-03 应急派 B 先做）/ 余骨架退役待 A**
> `t3-timeline` 已下沉（tick 制确定性 cue 调度器·skip 终态一致已测钉死），正是为 game-g.tsx:433-533 那 ~300 行手写演出编排（banner→cue→掷骰→结算时序）而生。
> **spec（Lead 图纸）**：① 演出时序改 `Timeline` 数据（cue 闭集：signal/flag/resource/spawn），advancePerf/playPerf 手写状态机退役；表现层（浮层/动画）订阅 timeline 发的信号自行演。② 跳过演出（玩家加速）走 `skipOnSignal`（确定性快进，勿自写跳帧）。③ 战斗心流 Phase 新增的演出节拍直接用 Timeline 表达，别再扩手写编排。④ 参照 registry 条目 examples 与 `docs/playbooks/events-logic.md` 演出时序节。门禁全绿直推。
>
> **【交接·程序B 已代做部分 · 2026-07-03 · owner 应急派 B 当场先做·请转记 A 账/A 接手余下】**
> owner 要"看清战斗 + 用 timeline 不手写"，当场派程序B 先落地（本 REQ 原指派 A）。**程序B 已交（全绿·已推 main·commit 见 git log game-g）**：
> - **宿主底座**：`games/game-g/battle-timeline.ts` —— game-g 侧 t3-timeline 宿主（起只跑 timeline capability 的 World·逐帧 pump·把 cue 信号交表现层订阅自演）。支持并发多条 timeline + `delay(ticks,cb)`（单 cue timeline·替 setTimeout）。含并发/清理/复用测试（`battle-timeline.test.ts`）。
> - **已迁上 timeline 的演出拍**：① 战后生死（clash:slay 斩→survivor 对折→resume 续场）；② 行军慢放清标记（move:settle·连带修 760ms 打断 1.25s 动画的 bug）；③ 演出横幅 `showBanner` + 战前锚场 cue `showClashCue` 的延时 → `battleTl.delay`。表现层订阅信号自演（playGhost/浮层），回调不塞自由时序。
> - **UI 延时是否提新引擎能力**：程序B 评判**回驳**——manifesto §4「延时 N→回调」已被 `t3-timeline` 单 cue / `Timer` 原子覆盖，不新增；消费现成的（记此账避免 A 重提）。
> **A 接手余下（结构级·B 未动）**：`perfQueue/playPerf/advancePerf` **整套回合骨架退役** → 一整回合编排成主 `Timeline`（玩家门控点用点击桥接/skipOnSignal），advancePerf/playPerf 手写状态机删除。B 侧订阅模式已铺好（战后段即样板）可复用。**故意留 setTimeout 的三处**（非演出拍·别硬迁）：`flash` 提示条(需即时取消)、`startThinking`(有意随机时长)、`doClashRoll` 数字滚(多帧 tick·宜 Label.tween 另议)。
> **另·战斗核越界记账**：斯巴达方阵「改真·每兵+战力」（`turn-combat.ts` phalanxPower·本属 A 战斗域）owner 当场明授权 B 改·已交全绿——请 A 知悉该 sim 改动（每兵吃方阵总加成略增·owner 已拍板）。

> 【衔接备忘 2026-07-03】P3D 的 game-d 接线单（REQ-GAMED：dice-roll 接入/detectPattern 真替换/per-run 种子/打回三条）同样为**排队态**——接现 3D 渲染线核心工作完成后开工，优先级由 owner 调度。
---

### REQ-G-战功系统 · [2026-07-03] · design G → 程序A(逻辑·钩子+modifier)·save(save-port)·程序B(收藏屏可视) · Game G · status: **排队（收藏打磨·核心战斗稳后开工）** · 优先级: P2 · 类型: 真缺口→下沉通用"老兵/资历里程碑"能力 · 规格: `design/veteran-merit-战功.md`

> **owner 2026-07-03**：战功系统——每张收藏牌隐藏累计"战场战胜次数"(kills·增收藏属性)；**kills≥108 → 战力永久+1**（108=天罡36+地煞72=水浒星宿·非拍脑袋）。
> **CORE RULE**：接受·收藏情感钩子 + "用出来的强"养成轴（区别地支/deckBias 的货币养成）。**数据驱动·不写专属码**——三块现成拼：① 每牌持久 `kills` Resource（存档·`services/save`）② `resolveClash` 胜者 kills++ 事件钩子（小·确定性）③ 满108→+1战力 复用 `t2-modifier-stack`（`{target:战力,op:add,value:1,gate:kills≥108}`）。= 通用"任意牌·累计任意事件·到阈值触发修正"系统。
> **决策（owner OK）**：战场HUD不显·收藏界面可看；先单里程碑108(阶梯后续可选)；仅玩家收藏牌累计(Boss每关新16牌不累)。
> **平衡**：慢(108杀≈25-35场/牌)+小(+1战力)=温和creep·sim当一档养成favor建模·真奖励是荣誉/收藏故事。
> **排队**：与战斗核正交·排核心(动作模型/AOE/经济/玩家AI)拍死后开工·别往正动的地基加零件。

### REQ-G-天罡原生重构 · [2026-07-04] · design G → 程序A(TENGANG_OPS/改掷层)·程序B(AOE演出+点路UI) · Game G · status: **进行中（程序A）：片A 锋矢 ✅ / 片B 掷骰系改掷层 ✅ / 片C 擒王 ✅ + 选路 5 op ✅(疾行/泥沼/铁索/驰援/舍车·cd08de2c) / 抢滩 待GD细节 / 片D 退役 待 / 片E AOE 待 / 点路UI 待程序B** · 优先级: **P1（核心大改后天罡大面积失效·出货前空头卡清零）** · 规格: `design/tiangang-native-redesign.md`
> **✅ 片C 选路 op done（程序A 2026-07-04·cd08de2c·策划定案 0bde67dc 落地）**：`castTengangAt(b,side,handIdx,lane)` + `tengangTargetKind(id)`(own-lane/enemy-lane/global/null·供 B 点路 UI)。疾行=我该路整列即时+1格 / 泥沼=敌该路本回合不推进(lane skip) / 铁索=敌全军 speed−1 持2回合(global 倒计时+speedPen) / 驰援=该路+2固定援兵(战力3) / 舍车=弃该路回库+另两路+8战力(快照)。castTengang 拒选路天罡；tiangang-data 文案对齐即时语义+discard2 8。测试 7 例。**⬜ 抢滩(beachhead·jumpToMid) 策划未给细节**(§四·补只定 5 个)·待 GD 补。**点路 UI 归程序B**：选中选路天罡→按 tengangTargetKind 高亮可选路(own/enemy)→点路→调 castTengangAt(global 铁索无需选)。程序A 已挂 dev `__ggDebug.castAt(id,lane)` 供免 UI 测。
> **✅ 顺带 新手引导天罡（owner 2026-07-04·55a11062）**：freshSave 默认牌组塞虎符+鬼手 + 空 loadout 兜底 → 修「开局没天罡·抽不到」。
> **✅ 片A（§四.4·程序A 2026-07-04）**：锋矢 arrowhead `filter:'front'` 旧描述子没认→误落全军+4·修成只前锋。**✅ 片B（§四.1+2·程序A 2026-07-04）**：掷骰系改掷层——鬼手改掷+2/磐石掷下界+2/灌铅骰掷两次取高/铁骰占优必胜；clash-resolve 加 `rollWithMods`+`rollDist`+`rollWinProbMods`(mods 全零逐字等于旧 rollWinProb)；删 logistic 死字段 winFloor/kHard/noUpset·加 rollBonus/rollFloor/rollTwice/autoWinGE；接进 resolveClash(实掷+占优必胜短路)/clashOdds(预报)/resolveClashEV(AI EV)→预报与 AI 都反映改掷；tiangang-data kind 'odds'→'roll'。测试全绿(2261)。
> **⚠️ 片C 目标机制（owner 2026-07-04 裁：走玩家选路·否决自动目标）**：§四.3 的 6 个 op 里 **4 个需玩家「选哪一路」**——疾行(该路 speed+1)/泥沼(敌该路减速)/驰援(指定路+2兵)/舍车(弃一路补两路)。**owner 拍板：不能自动选·必须玩家选路。** → 需**选路机制**：程序A 出 `castTengangAt(b,side,handIdx,lane)` + 每路效果应用（即时型驰援/舍车 + 持久每路型疾行/泥沼→需 per-lane 状态）；程序B 出**点路 UI**（选中目标类天罡→高亮可选路→玩家点路→施放）。**A+B 协同·另立选路子任务。**
> **✅ 擒王 done（程序A 2026-07-04·f0832bcd·无目标 op）**：斩敌主将→该路敌全溃（clash 钩子·TengangFx killGeneralRout·测试绿）。**⬜ 铁索（敌全军减速·无目标·需 slow 机制）+ 4 个目标 op（待选路机制）待续。**
> **✅ GD 补细节完毕（owner 对齐 2026-07-04·见 `REQ-G-天罡目标op机制对齐` 答复 + tiangang-native-redesign §四·补）**：时长=混合（疾行/泥沼/驰援/舍车即时·仅铁索持久N=2回合→**程序A 不必全建 laneFx·只铁索一个全局倒计时**）；疾行=我该路即时+1格；泥沼=敌该路本回合不推进；铁索=敌全军speed−1(下限1)持续2回合；驰援=+2固定援兵(战力3无将·落部署格·不掏牌库)；舍车=弃一路回库+另两路当前兵各+X战力(快照烙兵身·+X起标8待sim)。**片C 解锁·程序A 可开工。**
> **调试功能（owner 2026-07-04·顺带）**：程序A 已交逻辑钩子 `debugGrantTengang`/`debugAddMana` + dev 控制台全局 `__ggDebug`（.grant(id)/.mana(n)/.list()·战斗屏控制台即用·测新天罡/无限操作）。**正规「调试菜单」可视 UI 归程序B**（见 REQ-G-调试菜单）。

### REQ-G-调试菜单（战斗屏·dev 工具）· [2026-07-04] · owner → 程序B（表现·程序A 供逻辑钩子·已足）· Game G · status: open · 优先级: P2 · 类型: dev 工具 UI
> **owner 2026-07-04**：战斗中要一个**调试菜单**——① 直接**召唤一张天罡到我手牌**（选卡）；② **加源泉**（无限操作）。用来测新天罡（改掷系/AOE…）。
> **A/B 接口（程序A 已出·无需程序A 新增）**：`debugGrantTengang(b,'a',id)` 授召天罡到手牌 · `debugAddMana(b,'a',n)` 加源泉（turn-combat.ts）。战斗屏已挂 dev 全局 `__ggDebug`（.grant/.mana/.list）可控制台即用——程序B 把它做成**可视菜单**（战斗屏一角 dev-only 按钮 → 弹天罡列表 `GAME_G_TIANGANGS` 点选召唤 + 「源泉+10」按钮 · 调 `debugGrantTengang`/`debugAddMana` 后 `mounted.update()`）。dev 工具·可 gate 在调试开关后·非出货玩家 UI。
> **建议**：调试菜单用 LayoutNode 浮层（UI 铁律）；若嫌 dev 工具走正规 UI 太重，与 owner 确认可否简化。

> **owner 2026-07-04**：「重新设计天罡吧，都失效了。」——战斗核大改（掷战力骰 + 原生战力 + 三行为自由混 + 机关门退役）后，35 张天罡大面积失效：odds 概率系 4 张锚已退役 logistic 胜率模型、~14 张零效果（op 不在 `TENGANG_OPS`）、含 6 张流派印记空头卡。本档 = 逐张 review + 原生重设计（同 `disha-native-power-redesign` 原则·GD 出数据·程序A 落地）。
> **与 REQ-G-修正栈迁移并虚胖清算 的关系**：那单是「把已实装 op 迁 t2-modifier-stack + 空头卡实装」的**通用清算**；本单是**天罡专项的原生语义重设计**（改掷层是新落点·超出纯 modifier 栈）——两单同域·建议**合批做**（先按本档定语义，再照修正栈迁移单落 ModifierSource + 改掷钩子）。
> **程序A（逻辑）**：
> 1. **杀死机制**：删 `odds:winFloor/kHard/noUpset` + `TengangFx` 对应字段（logistic 残留·掷战力骰下无意义）。
> 2. **掷骰系新落点**（改掷层·resolveClash 的 rollDie 侧钩子）：`鬼手`改掷+2 / `磐石`掷下界+2（掷 `[3,P]` 非 `[1,P]`）/ `灌铅骰`掷两次取高 / `铁骰`占优必胜（我前锋战力≥敌→免掷直接胜）。
> 3. **实装零效果 op** 进 `TENGANG_OPS`：`killGeneralRout`(擒王·斩敌主将→该路敌全溃) / `advance`(疾行·speed+1) / `slow`(泥沼·铁索) / `jumpToMid`(抢滩) / `reinforce`(驰援) / `sacrifice`(舍车·弃一路→另两路各+10)。
> 4. **修 bug**：`arrowhead` 锋矢 front-only——现 `filter:'front'` 落到 else=全军+4，应只前锋（程序A 加 `powerFront` 或修 scope 判断）。
> 5. **退役**：`lurefoe` 调虎（强制敌迁路=换路概念·随机关门整套退役同源不合时宜）；6 张 arcane 流派印记标未解锁/摘出货池（待流派体系定稿另开·防玩家买空头传说）。
> **程序B（表现·可选·随 AOE 批）**：AOE 天罡范围削的场上演出（一路/一片红边）走 `t3-timeline`。
> **新增 AOE 天罡类**（owner「连携的对立面」）：`aoePower` 多目标 op（`{op:'aoePower',target:'enemy-lane',value:-X,span?:N}`）+ 首批 2-3 张（火攻`firestorm`/齐射`volley`/塌方`quagmire`·数值 GD 待 sim 标）——**与地煞未来 op 池同思路的新"多目标瞄准形状"**。
> **GD 回环**：程序A 落地后 GD 用 balance-sim 复核各天罡强度（尤其掷骰系边际 + AOE 数值 + `flow`川流在自由混+换牌下的连抽连打交互）。
> **顺序**：先 ①②③④⑤（修活现有 35→存活+实装+退役）· AOE(⑥) 与「连携对立面」一批做 · 流派印记(J) 待流派体系定稿另开。
> **Lead 架构注（2026-07-04·防「修正栈三套」重演）**：② 掷骰系四语义（改掷+2 / 掷下界钳 / 优势取高 / 占优免掷）是**通用 RollMod 原型**，不是天罡私有——game-d 骰途、英雄专属牌改掷层都会要同一族。**裁：先下沉引擎 dice 核（REQ-CAP-改掷RollMod·见新单），程序A 在 game-g 只写数据行消费；禁止在 resolveClash 里写四个 if。**这批也是未来改掷解释器的第一批真实用例——最小核先立，英雄牌 spec 定稿后再扩。①③④⑤ 照单开工不受阻。
> **注（与 `e780156a` 空中相遇）**：程序A 已按纯函数+数据行落了 game-g 版（形状合格·Lead 验过不打回）；收编时序见 REQ-CAP-改掷RollMod 更新。

---

### REQ-G-掷骰核两bug·对折下限0 + 鬼手改掷显示缺失（571条战局log实锤）· [2026-07-04] · owner playtest → 程序A(clash/rollWithMods)+程序B(掷骰读数) · Game G · status: open · 优先级: **P1（战斗核可读性+数学正确性·教学关面目全非的一部分）** · 类型: 逻辑bug(对折下限) + 可读性bug(改掷显示)
> **owner 2026-07-04 关1 全程 log（31回合/571条）复盘挖出**。GD 已核 turn-combat.ts 定性。
> **① 对折无下限→战力打到 0·掷骰区间退化 `[1~0]`（逻辑bug）**：`:321` `mul = champMul * 0.5^wins`、`:343` `Math.max(0,…)` → 连胜对折 + 士气/溃散惩罚可把有效战力压到 **0**（log T14 下路：`连胜2·战力已对折 = 0 → 掷战力骰 [1~0] = 3`）。`[1~0]` 是非法掷骰区间。**待修（owner 2026-07-04 拍板：对折下限 = 3·"最多折到3")**：有效战力最终钳**下限 3**——把 `:311` clamp 的下界（现 `Math.max(0,…)`）改为 **`Math.max(3, …)`**，任何在场兵最低都能掷 `[1~3]`。**边角须知（程序A/owner）**：底战力本就 <3 的弱卡会被抬到 3（轻微·等于"任何兵至少有 [1~3] 一搏"·可接受）；若 owner 要"只挡对折、不抬弱卡"，改成 `Math.max(Math.min(3, 底战力), halved)`——现取简单版（绝对下限3）。**验算**：强兵17 win1→8 win2→4（均>3不触底）；中兵7 win2→1.75 触底抬到 3 → 仍能被 fresh 兵(5-14)车轮磨死（保"弱兵磨强兵"设计意图）。下限3 只在 2 连胜的中低兵触发·干净杀掉 [1~0]。
> **② 鬼手「改掷+2」没显示进掷骰区间（可读性bug·机制其实正常）**：`:461` `rollWithMods(ea, rng, clashMods(tengangA))` 给实掷值加 `鬼手 rollBonus(+2)`，但读数串显示的区间 `[1~ea]` **不含 +2** → log 出现 `[1~1]=3`/`[1~7]=8`/`[1~3]=5`（掷值超上界·看着像作弊）。**片B 掷骰系机制是对的**（鬼手确实让你多掷 2），**问题只在显示**。**待修（程序B/程序A 供数据）**：掷骰读数把改掷显式化——如 `[1~7] 鬼手改掷+2 → 掷 8`，或直接显示 `[1+2 ~ 7+2]`。同族：磐石(掷下界)、灌铅骰(掷两次取高) 也要在读数里显式化，否则玩家看不懂掷骰系天罡。
> **附·movement bug 传染证据**（并入 `REQ-G-突深边角` 参考）：越界 slot 9 会跨回合残留——T7 `7S:8→9`（越界）→ T8 `7S:9→8`（从非法格走回）。证明位置腐坏非一帧、会传染到后续推进。
> **附·占位deck 验收点**（并入 `REQ-G-Boss写死明牌天罡`·**2026-07-05 更正**）：主将=**3♠ 是对的**（列奥尼达 codex 真身·boss-config §一.144·勿改 A♠）；须核的是——**主将强化 +16→战力20 太强**（balance·可调）+ 敌杂兵养成/玩家养成回 boss-config 公平口径（关1 bossFavorBias 应=0）。

### REQ-G-战斗bug核对清单（owner playtest 一轮汇总·程序A 回报修没修）· [2026-07-04] · owner+design G → 程序A · Game G · status: **待程序A 逐条回报 fixed/未修** · 优先级: P1 · 类型: bug 核对（owner 已口头推过一部分·避免重复/漏修）
> owner 2026-07-04：「有些 bug 我已推给你们了，请再核一遍是否已修。」design G 把这轮 571条 关1 log 挖出的战斗 bug 汇成一张清单，**请程序A 逐条标 ✅已修 / 🔧在修 / ⬜未动**，避免重复派工或漏修：
> 1. **突深边角·敌新兵反向传送+越界 slot**（`REQ-G-突深边角`）——玩家打穿贴敌家时 `6S:6→8/7S:8→9`(slot9越界)·且跨回合残留。
> 2. **对折下限=3**（`REQ-G-掷骰核两bug ①`·owner 拍板）——clamp `Math.max(0)→Math.max(3)`·杀 `[1~0]` 非法区间。
> 3. **鬼手改掷+2 没显示进掷骰区间**（`REQ-G-掷骰核两bug ②`）——`[1~1]=3` 看着像作弊·机制正常只是读数缺改掷。同族磐石/灌铅骰读数一并显式化。
> 4. **~~主将挂错3♠~~ → design G 撤回误报（2026-07-05）**：**3♠ = 列奥尼达 codex 真身·是对的**（boss-config §一.144 明注「config 标 A♠·但以 codex 真身为准」·曹操=5♣/项羽=9♦同理）。**程序A 勿把主将改成 A♠**（会破 codex 一致性）。真问题仅二：**(a) hero 强化 +16→主将战力20 墙太强**（playtest 中路堵 ~10回合·balance·可调·design G sim 标）；**(b) 杂兵养成-2/我+1 不对称**需核是否合 boss-config 公平口径（关1 应 bossFavorBias=0）。接 16牌组loader 时按此校准（`REQ-G-Boss写死明牌天罡`）。
> 5. **Boss AI 随机误选幅度过大**（新记·未单独立单）——ε 探索让 Boss 拿 2.8分抽牌压过 15.9分部署→整局 0 源泉、从不打出手里 8S/JS/KS·显得弱智而非"弱"。**请程序A 判断**：这是有意教学关降智还是噪声过大？建议降 ε 或改"保守但理性"(少动作·别选低分动作)。若需 design G 定 Boss 强度目标再回环。
> 6. **源泉无上限·可累积超10**（owner 2026-07-04 报·新bug）——`turn-combat.ts:654/657` `mana += manaGain(turn)` 无 `Math.min` 封顶→无处可花时源泉一路涨（log T28 我8→T31 我15）。**owner 拍板：源泉最多累积到 10**。待修：`mana = Math.min(MANA_CAP=10, mana + manaGain)`（双方对称·a/b 同）。**注**：封顶后满10再+=0=浪费→正是 owner「源泉→战力直接施法」备选想法(源泉 sink)要解决的（见 design G 讨论·另议是否加 sink 让满前能花掉）。
> **回报后**：design G 据 fixed 状态重跑 sim + owner 重玩新流。

### REQ-G-关1开局过载重标（敌开局5兵+战19墙碾压·owner playtest 被打爆）· [2026-07-05] · owner playtest → design G(数值spec) + 程序A(garrison分档/hero强化) · Game G · status: open · 优先级: **P1（关1教学关不可玩·压垮性开局）** · 类型: 平衡重标（多系统叠加过载·战斗核改后没重估）
> **owner 2026-07-05 两局连续被中路墙+开局兵海磨死**。GD 查开局机制定性：**三套给敌方加兵的系统叠加、且改战斗核后没重估** → 敌开局5兵+主将战19墙 vs 玩家空场（教学关压垮性）。
> **过载来源（各自"合理"·叠加要命）**：
> 1. `OPENING_HAND=3`（双方对称·公平·不动）。
> 2. `startFormation` 关1=2守军（REQ-G-开局排阵·owner·保留但见下）。
> 3. **`BOSS_GARRISON_MANA=3` 开局布防·免费额外线·强制铺满三路**（turn-combat.ts:839·owner 2026-06-29 定于旧战斗模型·**只给Boss不给玩家的不对称白送**·掷战力骰核下没重估）。
> 4. **主将+16 强化 → 3♠战力19 墙**（占位hero强化·`REQ-G-Boss写死明牌天罡` 已flag·中路堵~10回合打不动）。
> **叠加后果（playtest 实录）**：敌开局5兵压场→玩家主将丢中路撞stack秒死→**士气-4整路残整局**→敌连胜snowball破家。
> **GD 修法spec（数值·design G sim 标·程序A 落值）**：
> 1. **`BOSS_GARRISON_MANA` 按关分档**：关1=**0或1**（教学关不白送免费线）·后段关再爬。**owner 拍档位**（GD 倾向关1=0·纯靠startFormation 2守军 + 主将 立面·先教干净盘面）。
> 2. **主将 hero 强化按关分档**：关1 主将战力压到 **~12**（非19·别做打不动墙）·接16牌组loader 时校准（并入 `REQ-G-Boss写死明牌天罡`）。
> 3. **士气-4 主将阵亡**（`ROUT_PTS=4`·per-lane 永久）：关1 减轻或改可恢复（并入 `iteration-backlog-strategy-depth §二` 疲劳恢复批·这局证明它是压垮一环）。
> **GD 回环**：程序A 落 garrison 分档 + hero 分档后 → design G 用 sim 重标关1 到 ~70%（现被开局过载压到远低）。**注**：疲劳恢复模型程序A 已部分实装（log「疲劳40%·休整可回」）·现利好赢方(Boss)·需 design G 连带 sim 复核恢复参数别助长 snowball。

### REQ-G-主将阵亡士气重构·永久诅咒→临时震荡（owner 2026-07-05 拍板逻辑修正）· [2026-07-05] · owner+design G → 程序A · Game G · status: open · 优先级: **P1（机制逻辑不通+死亡螺旋·压垮关1的一环）** · 类型: 机制重构（非纯数值·现模型逻辑错）
> **owner 2026-07-05 两条约束**：① 「新放的兵没见过主将阵亡·凭什么减4」→ 新部署兵不该吃惩罚；② 「永久负buff 会让人不想把这种兵放上去/抽到」→ 不能永久烙卡。
> **现状（bug级逻辑错）**：`turn-combat.ts:323/327/403` — 主将某路阵亡→`lane.aGenDead/bGenDead` **永久标记**→该路**所有兵(含之后新放的)每次 clash 都吃 −ROUT_PTS(4)**。= 永久路诅咒 + 死亡螺旋 + 惩罚"使用主将"(反设计·尤其要走将领中心)。
> **v2 模型（owner 拍板·design G 收口）**：
> | 状态 | 效果 | 逻辑 |
> |---|---|---|
> | 主将在场 | 该路友军 **+MORALE_PTS(2)**（光环·live） | 主将坐镇 |
> | 主将阵亡·**当时在场**的兵 | **−X·随回合衰减·N回合归0** | 目击者短暂崩·会恢复 |
> | 阵亡后**新部署**的兵 | **0**（无光环无惩罚） | 没见过·中性·可重建 |
> **三铁律**：① **不永久**（N回合衰减回0·临时战场状态）② **不烙卡**（兵离场/回库时震荡不跟进牌库·重抽是干净的·玩家不躲它）③ **新兵免疫**（只烙主将阵亡"当时在场"的兵·那条路可用新兵重建回0→死亡螺旋消失）。
> **实现建议（程序A）**：删"永久 aGenDead 驱动 live −4"；改为主将阵亡瞬间给**当时在场友军**各盖一个 `moraleShock{until: turn+N}`（per-unit 战场态字段·非卡持久 buff·离场即清·绝不写 pokerDeck）；clash 士气计算：`主将在→+2 / 有活跃shock→−X(可按剩余回合衰减) / 否则→0`。turnHash 回归照绿。
> **数值**：**X=2~3、N=2~3**（owner 觉 −4 夸张→往 −2/−3 靠）·design G sim 标。
> **GD 回环**：落地后并入关1 重标 sim（此项是"失将不再滚雪球"的关键·配合疲劳恢复模型一起复核）。

### REQ-G-对决3D骰·掷前静止+投掷后加速减速停定值 · [2026-07-06] · owner R22 → **指派：P3D（3D 骰竞技 clash-dice-3d.ts）** · status: **open** · 类型: 3D 表现修（引擎 ThreeRenderer 骰动画·P3D 独占域）
> **owner 原话**：「对决旋转的时候，一开始那个你没掷的色子是不该在那里疯狂旋转的，应该是我摁了投掷以后，它有一个线性的加速度开始旋转，然后快结束的时候，线性的加速度停下来到我们已经决定好的那个数字上。」
> **现状缺陷**：对决弹层一打开、**还没掷**（`revealed===false`）时 3D 骰就在疯狂自转（当前 `clash-die3d-${s}` 锚点上挂了 `fx:[{kind:'pulse',...}]` 常驻脉冲·`turn-battle-screen.ts:427`，加上 clash-dice-3d 的 idle 翻滚）——观感像「骰子自己在乱转」，不符「等我掷」的期待。
> **要做（P3D·clash-dice-3d.ts + 引擎 Anim3D）**：① **掷前静止**——弹层出现、未按投掷时 3D 骰**保持不转/极缓待机**（去掉/弱化常驻疯转）。② **投掷后加速→减速→停定值**——玩家按「投掷」后：先**线性加速**旋转起来 → 临近结束**线性减速** → **停在已定掷值**（`rollMine`/`rollFoe`·上游 `resolveClash` 早已定死，骰面须最终落在这个数，不得与胜负读数矛盾）。整条动画是**表现**·不改任何 sim/hash（掷值确定性上游已定·骰只演出）。
> **接线锚点**：驱动侧 `game-g.tsx doClashRoll` 触发掷、`cv.rollMine/rollFoe` 是已定终值；3D 骰锚点 `clash-die3d-m/f`（`turn-battle-screen.ts:416-436`）。**掷前/掷后两相**由 `revealed` 切（现已有），P3D 只需把「掷后」的加速-减速-落面动画做进 clash-dice-3d，并让「掷前」不再疯转。
> **边界**：pulse 常驻 fx 若要撤/换是 `turn-battle-screen.ts`（程序B 域）一行事——P3D 若需程序B 配合撤 pulse，走下条 REQ-G-对决特写 里知会程序B；3D 骰本体动画 = P3D 独占。
> **⏫ R22 追加细化（owner 2026-07-06·同一件事的完整表演脚本·并入本单）**：owner 原话：「决战时那骰子一开始就在不规则运动（=同上·掷前该静止）。我掷骰子以后，应该有个特效：从我掷骰子这个地方，**粒子飞到那个骰子上**，然后**触发**骰子的运动；骰子从一个运动曲线、**从慢到快、再从快回到慢、停下来**，出现我们需要的点数。敌人的投掷也一样，他**自己去启动**它投出来，**两个不同步、各投各的**。」拆成三条实装：
> - **③ 投掷粒子引信（P3D·Vfx3D / 或 2D 覆盖粒子）**：按「投掷」→ 从**掷骰触发点**（投掷按钮/该侧牌位）**发一束粒子飞到该侧 3D 骰**→ 粒子命中即**触发**骰子起转（视觉因果：是我的掷把骰子"点着"的·非骰子自转）。若做成 3D 场景粒子=P3D Vfx3D；若做 2D 覆盖层粒子=程序B（与 P3D 对齐命中时刻→起转）。**谁做由 P3D/程序B 认领时定**，默认 P3D 随骰特效一起做。
> - **④ 运动曲线 = 慢→快→慢（缓入缓出 ease-in-out·非匀速）**：把 ②「线性加速→减速」精化为 owner 要的 **S 曲线**：起转**由慢渐快**（粒子命中后加速）→ 中段最快 → **由快渐慢**收尾 → **精准停在已定掷值**（`rollMine`/`rollFoe`）。cubic-bezier ease-in-out 观感。
> - **⑤ 两骰各投各的·不同步（异步独立）**：我方骰由**我方投掷**启动、敌方骰由**敌方（AI）投掷**启动，**互不同步**（非一按俩一起转）——各有各的粒子引信 + 各自 S 曲线 + 各自落定。接线：`game-g.tsx doClashRoll` 现或是"一次掷双方"，需拆成**双侧独立触发**（我方按钮触发我侧；敌方由 AI/驱动择时触发敌侧）→ 这条**跨 P3D(动画)＋程序B/驱动(触发时序)**，两边对齐"每侧独立 roll 事件"契约（掷值仍上游 `resolveClash` 定死·只是演出时序分开）。

### REQ-G-对决特写三栏布局错位·按设计稿原始比例对齐 · [2026-07-06] · owner R21/R22 → **指派：程序B（turn-battle-screen.ts clashNode·LayoutNode 表现）** · status: **open** · 类型: UI 表现修（三栏对决特写布局·程序B 域·非引擎）
> **owner 原话**：「那个对决画面完全错位了，我让你按比例去调整，按照我原始比例去调整，你现在搞得都错位了，你再重新仔细地review，自己截图自己看。」+ 复盘：「第二把打开时候好像又对齐了一些」（=首开错位·再开对齐 → **测量时序** bug：首次渲染时牌/锚点还没布局完就量了位置）。
> **要做（程序B·turn-battle-screen.ts + game-g.tsx 挂载侧）**：① **忠实设计稿原始比例**——三栏（左·我方加成明细 ｜ 中·双牌+战力骰竞技+判定 ｜ 右·敌方加成明细）严格照 `design/UI/Game G 绝命对决.dc.html` 的原始比例/尺寸对齐（牌 118×142 走 `REQ-UI-PlayingCard-xl尺寸` 到货的 xl 档；侧栏 246px 已按稿）。② **修首开错位（测量时序）**——3D 骰锚点覆盖用 `getBoundingClientRect` 量位（`game-g.tsx` clash cue 段），**首帧牌未布局完就量 → 位置偏**；再开因已布局好而对齐。需改成**布局完成后再量**（下一帧/layout-ready 回调/`requestAnimationFrame`）或用稳定的相对定位，令**首开即对齐**。③ 配合上条：撤/弱化掷前 3D 骰锚点上的常驻 `pulse` fx（`turn-battle-screen.ts:427`）——掷前不该脉冲疯闪（改由 P3D 的掷后动画驱动）。
> **不是程序A/不是逻辑**：掷值/胜负/各自掷战力骰逻辑（`resolveClash`·rollMine/rollFoe）**原封不动**·此条纯表现重排+测量时序修。
> **协作**：与上条 REQ-G-对决3D骰（P3D）同屏协作——**程序B 管三栏布局 + 锚点测量时序 + 撤 pulse；P3D 管 3D 骰掷后加速减速动画**。二人对齐锚点 id 契约（`clash-die3d-m/f`）勿动。

### REQ-G-FAST_RANKS 速度分档·「敌K走两步我A走一步」不一致 · [2026-07-06] · owner R22 → **指派：design G（数值·哪些牌算快）** · status: **open** · 类型: 数值裁定（哪些军衔=快·speed 分档表·design G 域）
> **owner 原话**：「我方的老K可以走两步，我方的A为什么只能走一步？」
> **现状（程序A 核对）**：`turn-combat.ts` `FAST_RANKS = new Set(['★','王','JOKER','K'])`·`unitSpeed(rank)= FAST_RANKS.has(rank) ? 2 : 1`——只有 ★/王/JOKER/**K** 算快走 2 步；**A 不在快表里只走 1 步**。但 A 点数(14) > K(13)——「更强的 A 反而更慢」直觉相悖，owner 觉得不一致。
> **要 design G 裁**：**speed 分档该怎么定？** 选项举例（design G 拍板·数值口径）：① A 也进快表（★/王/JOKER/A/K 都快）；② 按点数阈值定快（如 ≥13 或 ≥14 算快）；③ 快慢与点数解耦、另立一套「机动性」语义（如只有真·骑兵类牌快）。**要一套自洽、能对玩家解释的规则**（别让「谁快」看着随机）。
> **落地分工**：design G 定表 → 程序A 把 `FAST_RANKS`/`unitSpeed` 按裁定值改（纯改数据集合·非架构）。**注**：这是**移动步数**语义（`unitSpeed`），与战力/掷骰无关；确认 design G 想动的是「一回合走几步」这条。

### REQ-G-兵线互穿march进虚空·游戏无法结束（P0游戏级·owner playtest 30回合不终）· [2026-07-06] · owner playtest → 程序A(turn-combat 移动/破家几何) · Game G · status: open · 优先级: **P0（游戏级·关卡无法结束=不可玩·压过一切平衡）** · 类型: 逻辑bug（几何/破家条件·突深边角深层版）
> **owner 2026-07-06 535条log实录**：双方兵在同一路**互相穿过对方、march 出界进虚空**——我方兵到 **slot 18**、敌方兵到 **-4**（棋盘只有 0-8），谁也不撞谁、谁也不破家，**30回合游戏结束不了**。这才是"战斗路径太长"的真相：不是长，是**被 bug 变成无限长**。
> **根因（GD trace）**：破家 `advanceColumnToBase`（"无敌·向对家推进"）**只在该路无敌兵时触发**；但两军前锋**互穿后**，该路**双方都还有兵**（各在两端·我@18/敌@-4）→ 永远走 `advanceColumnVsFoe`（clamp 到敌前锋）而非破家路径；而敌前锋已在你身后 → clamp 失效 → 两边一路 march 到 ±∞·永不破家·永不再撞。**win 条件（homeB≤0 / homeA≤0）永远够不到。**
> **为何现在必现**（owner 2026-07-06 改「胜者守原位·不追击」+ 兵仍每回合自动推进）：胜者不再占腾出格、但仍自动前进 → 兵**滑过**彼此成为常态 → 互穿→出界→无限march。旧「突深边角」单只补了单侧突深；此为**双侧互穿**的更严重版·整个碰撞/破家几何在"互穿"下崩。
> **程序A 待修（spec·GD 报缺·代码归程序A）**：① **兵越过 goal（我 slot>8 / 敌 slot<0）必须触发破家离场**（不论该路是否还有敌兵）——破家判据改「按每兵是否越 goal」逐兵结算·别用「整路无敌」当门。② **互穿几何**：两前锋一旦交错（我方 slot ≥ 敌方 slot），要么判碰撞掷命、要么各自继续奔各自的 goal 破家——**绝不能 clamp 到身后的敌前锋**。③ 加**互穿/出界回归测试**（双方前锋交错后·断言无 slot 越界、每兵越 goal 即破家离场、有限回合内分胜负）。④ turnHash 变=有意·更新。
> **GD 附注**：此 bug 直接造成 owner「30回合不知在玩什么」的空转。**修它是关1可玩的前置**（比任何平衡都优先）。它也暴露"胜者守原位+自动推进"的几何没想清——见下方核心循环讨论。
