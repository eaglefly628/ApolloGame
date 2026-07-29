# Game A《掼蛋》· 游戏级工单池（工单随游戏走·不占引擎池槽）

> 规则同引擎池：Lead/owner 裁决改状态；能力缺口确认后由 GD 转 `docs/workflow/requests.md` 提 Lead。

### A-025 · [2026-07-23] · 巡检发现 · vendor.test 断言 55 条 vs 索引实有 58（owner 本地美术推送未同步测试） · status: ✅ **done（Lead 当场清·owner 2026-07-23「把红修复」在场授权）** · 优先级: **P1（阻全量测试·当日清）** · 类型: 资产对账同步（PE 域）
> 巡检实证：owner 从本地推美术（`e5db3d0e`·game-a art-02.png + index +3 条）→ `src/games/game-a/vendor.test.ts`「55 条」失败（expected 58 to be 55）。
> **✅ Lead 处置（2026-07-23·owner 在场「把它修复」授权·非自动巡检的 hands-off）**：新 3 条 = 2 真 seedream 生成（`gen/art-02`+`game-a/bg/table` 桌背 skinKey）+ **1 悬空 mock（`gen/mock/art-03`·文件 gitignored·qwen mock）**。① 删悬空 mock 条（enforce「mock 永不入库」铁律·文件本就不在库）→ index 57 条；② vendor.test 改**分解式断言**：55 vendor（vendoredFrom）+ 2 生成（generator·非 mock）=57·+「无 mock」护栏钉死（今后 mock 泄漏进 committed index 即红拦）。全量 vitest 绿。**根因**：`batchGenerate` 按设计把 mock 留本地 index 供墙预览（`art-replace.test` 钉死），但 mock 条不该随 index.json 提交（文件 gitignored→提交即悬空）——护栏已由 vendor.test「无 mock」承接。

### A-023 · 美术走索引消费（工坊替换才生效）· [2026-07-22] · owner 报（工坊替换游戏没看到·全游戏一体）→ Lead 诊断 → **PE-A** · status: ✅ PE-A 完结（索引解析接线·真机换背景验证成立·ledger-audit 孤儿归零） · 优先级: P1 · 类型: 接消费槽（REQ-ART-可消费槽铁律 option a·game-a 侧·同 game-b B-012）
> **✅ PE-A 落地（2026-07-22·本 A-023）**：新增 `art-overrides.ts`（mirror game-c）——mount 尾 `loadArtOverrides('game-a')` 异步拉 `index.json`、收 `game-a/` 命名空间 + `gen:`/`vendored`/`tags:skin` 信号的 skinKey 别名 → `registerArtOverrides` → **`render()` 热替换**；theme `art(slot)` = `artUri('game-a/'+slot, 内置回退)`（覆盖优先·真图未到零字节变化·兜底永不丢）。hud 全部 Screen 底图/图标/felt 改经 `art(slot)`（硬编码 URL 退为回退）。台账 10 接线行各带 `skinKey game-a/<slot.entity>`（与 `art()` 键对齐·工坊写回同键即命中）、13 未接行退役进 `pending`（art 在库不删）。**完工判据全绿**：① 机制成立（真机注入 `game-a/bg/menu→bg/table` 别名→菜单底图即换·截图目击）；② `ledger:audit game-a --strict` 孤儿 0（10 行全有槽）；③ tsc 0·vitest game-a 74（+art-overrides 6 测·含覆盖/回退/headless/skinKey 契约）·build 0·验收 8 绿·S5 补戳；④ 真浏览器换背景成立。**牌面 54 张仍文字面**（换整卡 SVG 需 PUI 满面贴图槽·A-024①·非本 option-a 范畴）。
> **症状**：owner 在工坊替换 game-a 美术后，游戏里没变（与 game-b 同病）。
> **根因（Lead 2026-07-22 诊断·已读码定位）**：game-a 的美术走**硬编码 URL**、绕过 art 索引/台本——`hud.ts` `BG_MENU`/`BG_TABLE`=`/games/game-a/art/bg/*.svg`（`image:` 直传）、`theme.ts` 牌面 URL 拼 `/games/game-a/art/cards/<id>.<ext>`、`MANOR_BG`（`theme.ts:18`）=宿主层程序化 CSS 渐变经 `mountHost({sceneBackground})`。工坊写回 index/台本对游戏零效果。`npm run ledger:audit game-a` 23 行全判孤儿=实证。
> **修法（REQ-ART option a·接消费槽·引擎件已 done 可直接用）**：
> - 牌面/bg 图：改成从游戏索引按 id 解析 URL——`filledSrc(index, id)`（`src/assets/asset-index.ts`）+ 现硬编码 URL 作回退（未填不炸）。需留住 parsed `AssetIndex` 下传到 hud/theme 拼 URL 处。
> - 程序化背景 `MANOR_BG`：改用 `mountHost` 的 `sceneBgSkin` 槽（`src/engine/host/mount-host.ts`·REQ-ART ② 已 done）——`sceneBgSkin: { skinKey:'game-a/scene/bg-...', imageUrl: filledSrc(index, skinKey) }`，有生成图叠图、无图回退 `MANOR_BG`（**兜底永不丢**）；台账加该背景行。
> **完工判据**：① 工坊替换某图→别名登记进 `game-a/art/index.json`→游戏即显（非破坏·带 provenance/M2.5）；② `npm run ledger:audit game-a --strict` 孤儿归零（无用行退役）；③ game-a 测零回归·门禁绿；④ 真浏览器亲验换一张牌面/背景成立。
> **边界**：game-a 游戏代码（`hud.ts`/`theme.ts`/`game-a.ts`）=PE-A 域；引擎件（`filledSrc` + `sceneBgSkin` + `ledger-audit`）已 done。
> **PE-A 首轮进展（2026-07-20·本 A-023 承接前的半程）**：已做「消费接线 + 台账诚实化」——theme 立 `ART` 槽位表、新接 7 条**渲染**槽（coin/level/tribute→Tag/Image·菜单/记牌器/复制→Button.icon·win-confetti→结算叠层·共 10/23 渲染真上屏）、`art-ledger` 每行加 `wired` 真状态。**但 Lead 诊断正确：这些仍走硬编码 URL、绕过 index**——渲染上屏≠工坊可换。本 A-023 的 `filledSrc`/`sceneBgSkin` **索引解析**=真正让「工坊替换即生效」的那半程，续做（把 ART/BG 常量的静态 URL 改成经 parsed index 按 id 解析·硬编码作回退）。

### A-024 · [2026-07-20] · PE-A · 美术槽位能力缺口（4 项·挡「每条美术换了都有效果」）· status: 📝 待转报 PUI · 类型: UI 基座控件/工具缺口（PUI 域）
owner 2026-07-20 要「工作台换任一美术→游戏即时生效」。逐条接线审计（A-023）后，10/23 接上，余下有 4 类**引擎缺口**挡住接线（非游戏层能补）：
① **PlayingCard 满面贴图槽**：控件 `art` 槽只放**中央**立绘（四角点数花色仍是控件自画）——vendor 的 54 张整卡 SVG（各带自家点数版式）塞中央=双重点数。要「换整张牌面图」需控件支持**满面 art 模式**（cover 整卡·关角标）或牌背同款 `backArt` 的正面版。现状：牌面走控件文字面（合蓝本经典白扑克·观感 OK），SVG 牌库暂闲置。
> **⏬ owner 2026-07-22 裁：低优先·PUI 排期做即可**——今明版本 demo **不换牌面**（文字白扑克稳用·合蓝本）。此项非急件，PUI 有余力再补满面贴图槽；game-a 侧无待办（牌面维持现状）。
> **✅ PUI 已交 ①（2026-07-22）**：`PlayingCard.faceArt`（+`faceArtSlice` 9-slice·backArt 的正面版）——`faceUp` 时整面 cover、角标点数/中央花色全隐（关角标）、`label`/`value` 覆盖层仍在；不填=文字牌面零回归。`types.ts`+`render.ts`+catalog+`ui.md`+测试（playing-card.test.ts）。**PE-A 要换牌面时**：`faceArt=resolveAsset(牌面 key)`（sim 持 key），54 张整卡 SVG 即可上面（`art` 中央槽留给"中央剪影"用途）。②③④仍 open。
② **Badge/文字内联图标**：`Badge`（钱包/持有者）无 `icon` 槽（`Tag`/`Button` 有·已用）；`🏆` 暂大者前缀嵌在 `fmtHolder` 文字串里。要让奖杯/部分徽章图标可换→`Badge` 加 `icon`（照 `Tag.icon`），或提供「文字内联图标」原语。
③ **紧凑按钮贴皮 min-size**：`buttonSkins`（9-slice）源图 220×56·slice 16 → 对顶栏/工具条**小按钮**强制大 min-size，撑高变方 +「菜单」折行（实测回归·已撤）。要小按钮也能换皮→9-slice 支持**更小源图/可配 min** 或按钮尺寸自适应 slice。
④ **一次性事件态 fx 钩子**：`fx/play-glow`（出牌流光）/`fx/bomb`（炸弹闪光）需「本手出的是炸弹吗」这类**逐手事件态**触发叠层；现入场动效走 `LayoutNode.anim` 闭集、无自定义 SVG-fx 事件叠加位。要事件驱动 SVG 特效→补事件态 fx 叠层原语（或 timeline 消费）。
**PE 侧无干净兜底**（都属控件/工具能力）。在 PUI 出件前：牌面维持文字、徽章图标维持 emoji、小按钮维持原生 kind、fx 维持 anim；台账每条标真状态（`wired.reason`）不留幽灵槽。

### A-022 · [2026-07-20] · PE-A · ui-audit 对比度只读 `background-color` → `hero`/渐变底按钮误报「硬性低对比」假阳 · status: 📝 待转报 PUI（视觉真绿·非阻断·工具盲区）· 类型: UI 基座工具缺口（PUI 域·`tools/ui-audit.mjs`）
> **ID 让号（2026-07-20·rebase）**：本条原报 A-018，与 Lead 评审同轮工单化的 A-018（一四进贡裁决）撞号——Lead 995e6c70 先落，PE 让号改 **A-022**（hud.ts 头注内引用同步改）。
**背景（owner 2026-07-20 金按钮）**：主 CTA「开始上桌 / 入座开局」按蓝本 `main-menu-guandan.dc.html`（`color:#241009` 深墨字 + `background:linear-gradient(#f0c96a,#d3a247)` 金渐变=深字金底）复刻。闭集里唯一「深字金底」件=`Button kind:'hero'`（`render.ts:270`·金渐变底 + `t.bg0` 深墨字 + 倒角 + 流光）——**真机渲染约 8:1 高对比、清晰可读**（已截图目击 `menu-hero.png`）。贴皮路（`buttonSkins.skin`）反而 `render.ts:218` 强制 `color:#fff` 白字→浅金上失读，故弃皮用 hero kind（视觉更对蓝本）。
**盲区（`tools/ui-audit.mjs` contrast）**：对比度计算只取 computed `background-color`；`hero` 底是 `linear-gradient`（`background-color` 解析=透明）→ 工具穿透到父/页底 `bg0(#160e0a)` 深色采样 → 深墨字 vs「看不见的金底」≈ 1.05 → 误报**硬性低对比阻断**。同因：`game-b-flow` 4 处 contrast 假阳、各游戏扇形/嵌套 overlap 假阳——raw `ui-audit.mjs exit=1` 是这些复杂屏的**已知假阳常态**（`/check-ui` agent 判官豁免·非自动推门卡口；本项目推门=`scoped-gate` 不含 ui-audit）。对照：旧 `primary`（绿·`jadeWash` 半透实底）工具读得到→绿；换 hero 后**仅此一行**由绿转红（纯工具盲区·非真回归）。
**建议 PUI 修（`src/ui`/`tools` 域）**：①`render.ts` hero（及任何渐变底 kind）在 `background` 前补一层 solid `background-color:<首停色>` 兜底（视觉零变·让工具读得到金底）；或 ②`ui-audit.mjs` contrast 解析 `background-image` 渐变取首停色/主色再算比。任一即消所有渐变底 CTA 的 contrast 假阳（全牌桌/大厅通用）。**在 PUI 出件前**：视觉 1:1 优先（hero 金 CTA 真机 8:1 可读），此假阳列清单待裁·不因工具盲区把金 CTA 降格回绿（同 A-007「不降格」律）。

### A-018 · [2026-07-20] · Lead 评审 · ⚖ 规则裁决：一四局进贡口径（甲=按位末游贡/乙=按输方三游贡） · status: ⏳ **待 owner 一字裁决** · 类型: 规则口径（owner 域·阻 A-021 部分剧本）
GDD §2.3 G1 自带问号未裁（裁 ☐）；代码照字面=绝对末游进贡 → 一四局（~35% 盘）赢家搭档进贡自家头游、输家不掏（审A seed 1-400 实证 140/140）；剧本⑥（seed=4）恰把该行为钉成正确。裁甲=现状即对、GDD 消问号打勾；裁乙=session 进贡 giver 改输方最低名次 + 剧本⑥换 seed 重写 + 补一四正例剧本。详 `lead-review-2026-07-20.md` §二。

### A-019 · [2026-07-20] · Lead 评审 · PE-A 领单包①（P1/P2 施工·不依赖 A-018） · status: ✅ PE-A 完结（2026-07-20·四件全落·门禁绿） · 类型: 玩法/UI 修缮（PE 域）
① **扇牌真碰撞布局修**：27 张满手时 a-hand-24~26 压进操作按钮区（hud.ts:391-395/653-656·12 处牌vs非牌重叠·最大 ~3000px²）——缩 HAND_STEP / 左移 HAND_CENTER_X / 操作区下移三选一；**禁止**用 allowOverlap 掩盖（ui.md 铁律）。② **宗师读牌二选一**：peeks 从未进 AI 决策（session:217-233 算了没人吃·仅 HUD 显示「会读牌」=不实告知）——真消费（AiTurnInput 加 peek·注意剧本走位漂移照 A-013 先例与 GD 对 seed）或撤文案撤字段。③ 过期注释更新：session:443-450 + ai.ts:159-162 的「A-008 缺口兜底」改「防御性复核·引擎 REQ-HANDPAT `214fc846` 已保证 ⊆ 合法集」。④ UI 冻结后重跑 S4/S5 gate 补戳。详 review §三/§四。
> **✅ PE-A 落地（2026-07-20·本轮）**：① `HAND_STEP` 34→25 + `HAND_CENTER_X` 600→556（**布局修·非 allowOverlap**）→ ui-audit 复测牌vs按钮/立绘/工具重叠**归零**（残留仅座前 tray↔谁大箭头=祖孙嵌套·与基线同）；真机截图目击。② 选**真消费**：`AiTurnInput.peekedOpp`（L4 本座偷看的对手牌码）→ `chooseTurn` 读到对手 premium(K/A/级牌/王)→`bb-aggression`+12（抢先倒牌·「会读牌」由此为真·记牌保真度=黑板初值·A-021 引擎口径）；点名单测 + 假绿自查（删 +12 转红已核）。**零剧本漂移**（验收全走 L1 无 peek·default tier 实证 l1；S4 gate 验收 8 场景仍绿）——故无需与 GD 对 seed。③ session/ai.ts 四处「A-008 缺口兜底」注释改「防御性复核·引擎 `214fc846` 已保证 ⊆ 合法集·幂等」。④ S4 gate（walkthrough 68 测+验收 8 场景绿）+ S5 gate（AUDIT+RATCHET PASS）重跑补戳 exit=0·gameHash `655c1f76`（S2/S3 复查门 stale 属 A-020/A-021 范畴·--out-of-order 记账放行）。tsc 0·vitest game-a 68·build 0。

### A-020 · [2026-07-20] · Lead 评审 · PE-A 领单包②（记账诚实·半小时账房活） · status: ✅ PE-A 完结（2026-07-20·三件全落） · 类型: 文档对账（PE 域）
① capability-plan §2：modifier-stack/event-when/effect-apply/timeline/tween 实测零消费——从「✅ 消费」降级为「未消费·偿还计划」；card-pile 标注「骨架占位·真手牌态在 session」。② §4 行数记账实测更新（过程化码 ~1160 vs 预估 450·A-004 债线 419 过时）。③ 稿件降格四处补列清单（表情气泡死参/SC-5 生涯统计折叠/进贡 Modal→文字/记牌器 Drawer→Modal——接线或明记 deferred）。详 review §四。
> **✅ PE-A 落地（2026-07-20·本轮）**：① capability-plan §2 加诚实校正块 + 逐行降级——`modifier-stack`/`event-when`/`effect-apply`/`timeline`/`tween` 实测 0 引用（grep 实证·`tween` 那 1 命中=`justify:'between'` 假匹配）标「⚠ 未消费·偿还计划」；`t2-card-pile` 标「⚠ 骨架占位·影子态（蓝图装 5 份·真发牌在 `session.hands[]`）」。② §4 加行数实测块：session 571/ai 261/host(game-a) 423=**过程化码 ~1255**（预估 490·~2.6×·hud 919+rules 161=数据不计）；A-004 债线 419 标过时·超支债随 b/c 同构下沉偿还·诚实记账不洗白（超支主因=掼蛋规则复杂 + 结算散码可下沉）。③ ui-scene-design §14 加稿件降格清单：席位表情气泡（死参·deferred）/SC-5 生涯统计（折叠·deferred）/进贡 Modal→文字横幅（accepted·规则自动无选择空间）/记牌器 Drawer→Modal（accepted·闭集浮层等价·核码 `a-p-counter-modal`）。纯文档·门禁文档守卫绿。

### A-021 · [2026-07-20] · Lead 评审 · GD-A：brief 记牌口径认账 + 剧本缺口补写 · status: 📋 open 待领（剧本部分衔接 A-018 裁决） · 类型: 设计对账+验收剧本（GD 域）
① brief §5「4 档靠记牌分档」未实现（AI_TIERS.memory=死标签·真差异=三策略开关）——补记牌消费设计（REQ-BT 裁决：记牌保真度=黑板初值）交 PE，或 brief 改口认账。② 剧本缺口：一四进贡正例（待 A-018）；抗贡正例（输方真持双大王）；双下抗贡；抗贡+1倍/天王炸+1倍彩头倍率（现零测试）；停 A 重打闭环。详 review §三/§四。

### A-017 · [2026-07-18] · PE-A · 入场动效闭集缺「从右/可配方向」变体 → 座前出牌无法按入座方向全向飞入 · status: 📝 待转引擎池报 PUI（游戏层已近似·非阻断）· 类型: UI 基座动效缺口（PUI 域）
> **ID 让号（2026-07-20·rebase）**：本条原报 A-015，与 GD-A 同轮占用的 A-015（经济翻改）/A-016（衣橱）撞号——origin 先落，PE 让号改 **A-017**（hud.ts/ui-scene-design.md 内引用同步改）。
**owner 需求（2026-07-18）**：座前出牌动效「根据入桌方向动态调整更漂亮」——各座出的牌从**自己的方向**飞入桌心（partner 顶→下落、hero 底→上飞、west 左→右入、east 右→左入）。
**根因（引擎 `src/ui/components/server.ts` 关键帧闭集）**：一次性入场 `ANIM_PRESETS` 只有 `fadeIn/slideUp(下→上)/pop/dealIn(上→下)/flyIn(左→右)/shake/popOut`——**无「从右→左」变体、也无 `from` 方向参**。故 east（右座）没有对味的入场式。
**游戏层已近似（`hud.ts TRAY_ANIM`）**：hero=`slideUp`（底/手上飞出）、partner=`dealIn`（顶落）、west=`flyIn`（左入）、east=`dealIn`（顶落·**将就**·from-right 缺）；per-card `animDelay` 阶梯=错落入盘手感。
**建议引擎修（PUI 裁）**：给一次性入场加**方向参**（`anim:'slideIn'` + `from:'top'|'bottom'|'left'|'right'`），或补 `flyInRight`/`dropIn` 等变体——让「按方向飞入」通用可配（所有牌桌/棋类游戏通用）。在 PUI 出件前 east 用 dealIn 将就。

### A-016 · [2026-07-20] · GD-A · 衣橱 UI（收藏册网格清单 + 本 run 战况）· status: 📝 待转报 PUI（缺库存/收藏控件）· 类型: UI 基座缺口（PUI 域）
GDD §4.3 衣橱=点开查看「几套几件·谁的·价值·等级·集套进度」+ 本 run 各角色当前档。需 **LayoutNode 网格清单/收藏卡控件**（每格=一件收藏：立绘缩图+原主+档名+价值星级）。现闭集若无「网格库存/收藏格」控件→报 PUI 扩控件（照纸牌类刚需·参 A-007 叠层诉求）。**禁手写 DOM/innerHTML**；表达不了列清单等 PUI 裁决，不自造逃生。入口＝角色头像/衣橱按钮（SC-7b 扩展）。

### A-015 · [2026-07-20] · GD-A · 【大改】经济翻改：金钱→服饰经济（衣服=筹码+收藏）· status: 📝 待 Lead 复审 GDD v2 + capability-plan 复审后交 PE · 类型: 玩法系统重写（PE 域·需 capability-plan 过审）
owner 2026-07-20 拍板（GDD v2 §3+§4 重写）：**废除金钱**，衣服=唯一筹码单位 + 可收藏资产。改动面：
- **规则**（GDD §3 C1~C7）：脱衣=衣贡（盘末·从外到内脱·双上3/一三2/一四1 件·彩头多脱1·封顶4）；脱下每件转入赢队衣橱（标签 原主/档/价值）；底线档不再脱→记耻辱点；过 A 仍唯一 run 终局（不改胜负结构）。
- **数值**（GDD §4）：衣服价值表（档1盛→档5底线=5→1 分）；对局档 ×1/×5/×20 放大收藏价值；无带入/荷包/破产扣钱。
- **引擎改**（PE 域·`guandan-session.ts`）：删 `wallets`/money settlement；加 服饰阶梯态（每座当前档）/脱衣结算/衣橱收藏集（持久）/耻辱点。**确定性不破**（全种子·walkthrough 双跑）。
- **⚠ capability-plan 复审先行（防绕引擎·CLAUDE.md 铁律）**：衣橱=**库存/收藏系统**，PE **不得游戏层手写**——先查 `wiki/skills/index.md` 有无现成 inventory/collection capability 可复用，真缺口走 Lead 下沉裁决，再动工。plan 未过审不写系统代码。
- **acceptance 随改**（GD 域·PE 落投影后）：现 ①/③ 断言的 `result_pay`/`wallet_hero`（金钱）失效 → 换新投影 `dress_lost_this_round`/`wardrobe_count`/`collected_value`/`shame_points`/各座 `dress_tier`（tribute1 已由 A-010 落地）。GD 待 PE 落地后重写经济类断言 + 加脱衣/收藏剧本；并借机采纳 A-013 长期建议（分支断言迁 walkthrough·acceptance 留稳健式）。
- 关联既有：C7 内容红线沿用 A-006；牌贡（§2.3·不动）与衣贡（新）术语分立。

### A-014 · [2026-07-18] · PE-A · Tabs/Modal 同级切页时容器随活跃页高度「跳大小」→ 应固定容器尺寸 + 录 UI 检查目录规则 · status: 📝 待转引擎池报 PUI（纯 UI 基座·游戏层无干净兜底）· 类型: UI 基座缺口 + 手册规则（PUI 域）
**owner 实证（2026-07-18）**：主菜单进「设置·规则」菜单，切「出牌日志 / 规则说明 / 设置」三页签时，Modal **变大小**（还带居中重定位的位移）——owner 报「原来做纸牌时也这样切大小·游戏里其实用得很少·很不显著」。
**根因（引擎 `src/ui/components/server.ts switchTab` + Modal 居中）**：`switchTab` 切页用 `pg.style.display = 'block'/'none'`——**容器高 = 当前活跃页高**；三页内容高不同 → 切页即变高；Modal 居中 → 高一变、整体尺寸+位置一起跳。
**建议引擎修（PUI 域·src/ui Tabs/Modal）**：`renderTabs` 给页容器**预留最高页高度**（所有页都渲染·`min-height = max(各页 scrollHeight)`·非活跃页 `display:none` 只是不可见但仍占位测高），或 Modal 内容区**固定高 + 页内 `overflow:auto` 滚动**。目标：**切页只换内容、容器尺寸/位置不变**。（游戏层无干净兜底——Panel 固定高会裁掉长日志页·滚动/测高属 Tabs 组件职责。）
**owner 要录的 UI 检查目录规则（PUI 落 `docs/playbooks/ui.md` / check-ui / ui-playbook）**：
> **「同级 Tab / Segmented 切换不得改变容器尺寸」**——切页预留最高页高度、内容超出走页内滚动；面板/弹层切页时**尺寸与位置保持不变**，不得「跳大小 / 重定位」。（做 Tabs/分段切换的 UI 时自检此条。）
**附**：owner 明确此为 UI-设计级修复 + 手册规则（非 game-a 专属）——本条按「缺控件/UI 基座缺口走 requests 报 PUI」铁律转 PUI，PE 不擅改 `src/ui/**` 与 UI 手册。

### A-013 · [2026-07-18] · PE-A · 验收剧本耦合 AI 出牌线 → AI 改良后 4 剧本种子漂离目标分支（已重选 seed 修复·长期建议迁单测）· status: ✅ PE 已重选 seed 全绿（附长期建议交 GD-A）· 类型: 验收剧本健壮性（GD-A 域）
**背景**：owner 2026-07-18 报「AI 把四张7拆成两对出、先甩对2（先出大的后出小的）·难度低也不能乱出牌」——PE 按掼蛋策略（web 校准）改 AI：**不拆炸弹**（`ai.pickLead`/`chooseTurn` 应对全程护炸·80局35701手实测 0 拆炸）+ **先出小牌·保留大牌**（不先领 K/A/级牌 premium）。
**副作用**：①③④⑤⑥⑦⑧ 用 `play-round`/`play-run` **全自动打**，落到哪个名次/进贡/过A分支**取决于 AI 出牌线**（+种子 PRNG 消耗步数）。AI 一改，旧 seed 漂离目标分支 → 01/06/07/08 断言值过期变红（sim 结算/进贡/升级**逻辑本身没坏**·walkthrough 单测 forceRanking 全绿印证=纯 fixture 陈旧）。
**PE 已修（本轮·重选 seed 命中各分支·非弱化断言·分支真被走到）**：01 单下→`seed 16`（hero 头游·进大王）、06 抗贡→`seed 4`（次盘应贡方双大王·head=partner）、07 双下→`seed 2`（一队一二·两王进贡 16/15·顺带落 A-010 次贡断言）、08 我方过A→`seed 1`。8 剧本全绿。README 表 + 头注同步更新，逐条头注写明「AI 改良重选 seed」。
**长期建议（交 GD-A·非阻断）**：这些「分支验证」剧本**天然脆**——每次 AI 调参都得追 seed。建议把抗贡/双下/过A 等**规则分支断言迁到 walkthrough 单测**（`guandan-session.test.ts` 的 `forceRanking` 能直接摆名次·与 AI 完全解耦），acceptance 只保留 ②式「显式出牌驱动」的稳健剧本。这样引擎/AI 谁改都不必追种子。（问责定性=剧本设计耦合·不问谁改的 AI。）
> **⚠ 第二次命中（2026-07-20·本轮已修）**：owner 续报「提示出牌不应拆我的牌型」→ PE 给 `hint`/AI 加**不拆 ≥3 同点组**（`preferNoSplit`）——又一次改确定性出牌线，01/03/06/08 再漂。**PE 二次重钉（保机制·非弱化）**：01→`seed 47`（首盘 hero 先出·hero 头游·**跨队**一三单下·进末游最大 ♠A）、03→`seed 3`（对方连续双上 2→5→8·断言值不变）、06→`seed 7`（次盘应贡方双大王免贡·上盘头游 west 先出）、08→`seed 1` 不变仅**放宽** `level_theirs` 上界 13→14（对方亦冲到 A 级14 但未过·「未过 A」由 run_won+winner=team0 判定·非靠对方停低级；lte 14 仍守不得越 A 上限>14）。8 剧本全绿·S4 gate 乱序重跑 exit=0。
> **顺带修隐患（adapter·PE 域·纯读投影）**：剧本①「还贡 ≤10」旧钉 `tribute0_return`（=code=suit*100+rank）——仅当还♠牌(suit0)才碰巧 ≤10，还 ♥5(code105) 会误判 >10。加 `tribute0_return_rank`/`tribute1_return_rank`（`codeRank`·点数），①改钉 `tribute0_return_rank lte 10`（suit 无关·真查点数）+ 保留 `tribute0_return eq 2`（确定性钉码）。**长期建议再重申**：第二次追种子印证「脆」非偶发·GD-A 迁 walkthrough 单测的价值随每轮 AI 调参递增。

### A-012 · [2026-07-18] · PE-A · UI reconciler 换「根节点 id」时静默 no-op → 跨屏切换死机 · status: ✅ 已转引擎池 **REQ-UIRECON-换根重挂**（Lead 2026-07-18·指派 PUI·P1）· 类型: UI 基座 bug（PUI 域）
**根因（引擎 `src/ui/components/server.ts reconcileNode`）**：`update(newRoot)` 把新树最小化打补丁到 host——`reconcileNode` 起手 `const el = uiFindById(scope, newN.id); if (!el) return;`。当**新根 id ≠ 旧根 id**（如牌桌 `a-play` → 结算 `a-result`）时，host 里只有旧根元素、找不到新 id → **直接 return，屏一动不动**；且 `curRoot=newRoot` 已推进 → 之后每次 `update` 都拿新 id 找不到、永久 no-op（含菜单开合的 render）。
**owner 实证（2026-07-18·多次报「死机」）**：某盘 AI 走光结算（如队友双下），`render()` 成功跑 `ui.update(buildResult(...))`（`render完 phase=settled` 已打日志）却**不切结算屏**，牌桌卡在「🏆X 暂大 Y 应对中…」旧帧；CSS 动画（合成线程）照跑=牌在抖，但点☰菜单也 no-op（同一 render 路径）→ 看着像死循环，实为 reconciler 换根静默失败。浏览器插桩复现：`render完 phase=settled` 后屏仍 `#a-felt` 在场、`#a-result` 不出。
**建议引擎修（PUI 裁）**：`update()` 在 `curRoot.id !== newRoot.id` 时走**整根重挂**（`uiFindById(host, curRoot.id)?.outerHTML = renderNode(newRoot)`，同「换皮」分支已有的路径），而非交给按新 id 寻元素的 `reconcileNode`（它天然处理不了根自身的 id 变化——子节点换 id 由父的 `uiChildKeysSame` 兜住，根无父可兜）。
**游戏层已兜底（本提交·`game-a.ts paint()`）**：宿主自记 `mountedRootId`，跨屏（根 id 变）teardown+`mountUI` 重挂、同屏才 `update` 走 reconcile。回归护栏 `host-transition.test.ts`（happy-dom·驱动整盘 AI 至结算·断言 a-play→a-result 转屏）。引擎修好后此兜底可退（保留亦无害）。

### A-011 · [2026-07-18] · PE-A · 弹簧箭头缺 scale 弹跳动效 + Float 静态 audit 摆不准 · status: ✅ 已转引擎池 **REQ-UIAUDIT-叠层与动效**（与 A-007 并单·Lead 2026-07-18·指派 PUI·P2）· 类型: UI 基座缺口（PUI 域）
牌桌重设计（owner 2026-07-18）要「弹簧箭头指谁大」——箭头像弹簧一样**放缩弹跳**。UI 基座动效闭集只有
`float(上下平移弹)/pop(一次性缩放)/pulse(透明度)/spin/glow`，**无常驻 scale 弹簧**。现用 `Float`(锚定暂大者座前
小牌桌) + 子层 `anim:'float'`(上下弹跳) + `glow`(呼吸光) **近似**，已达「活的箭头指向」效果。**报 PUI 两诉求**：
(a) 加一档常驻 `anim:'bounce'`/`'springScale'`（scale 0.9↔1.1 缓入缓出循环·注意力指示器通用·非新增轴）；
(b) `Float`(及锚定件)位置靠 JS 活取 rect，**静态 ui-audit 摆在 0,0** → 误报与桌面元素重叠（本次 `a-p-bigarrow ⨉
a-tray/a-felt`）——同 A-007 扇形/light 牌盲区，建议 ui-audit 对 Float/Connector 锚定件豁免重叠判定（或 LayoutNode
出 `data-allow-overlap` 字段·A-007 也需它）。**在 PUI 出件前**：箭头用 float+glow 近似（视觉达标），此二盲区列清单待裁。

### A-009 · [2026-07-18] · PE-A · 修 RoundResult.levelUp 派生字段（GD-A 验收剧本①「已知偏差」交办）· status: ✅ 已修 · 类型: 玩法 bug（PE 域）
GD-A 在 acceptance/README「已知偏差」+ 剧本①头注报：`RoundResult.levelUp` 仅双上算对，一三/一四胜恒报 `0`（表达式 `x - x` 退化）——级牌实际推进无误(levels 权威)，仅展示派生计数错。**已修**(`guandan-session.ts settleRound`)：捕获 `levelBefore`，`levelUp = levels[winnersTeam] - levelBefore`——双上+3/一三+2/一四+1/打A局=0/封顶取实增(12+3→14=+2)全对。点名单测 `结算 levelUp=实际级数增量`（guandan-session.test.ts）钉死。
→ **GD-A 可回收**：剧本①现可加回 `{ "res": "result_level_up", "eq": 1 }`（一四 +1）断言（README 已预告）。剧本=GD 域·由 GD 改；PE 不动剧本，此条仅知会修复到位。

### A-010 · [2026-07-18] · GD-A · 验收薄适配增 `tribute1_*` 投影（双下次贡机读断言）· status: ✅ PE 已落（`acceptance-adapter.ts`·待 GD 回收 ⑦ 断言）· 类型: 验收投影缺口（PE 域）
GD-A「节奏和逻辑」轮加双下剧本 `07-double-down-tribute`（G2）——现薄适配 `acceptance-adapter.ts` 只投影 `tribute0_*`（大贡），双下的「**次者(小王)归二游 partner**」半句无机读标量可断。**请 PE 加**（照 tribute0_* 同款·纯读 `s.tributes[1]`）：`res tribute1_card`、`sv tribute1_from`/`tribute1_to`。落地后 GD 在 ⑦ 加 `{ "sv":"tribute1_to","eq":"partner" }` + `{ "res":"tribute1_card","eq":15 }`（seed 8 实测：east→partner 进小王15）。当前 ⑦ 已钉「双进贡·大者(大王16)归头游·进大贡者先出」，次贡半句待此投影补齐。零规则判断=纯搬运，不碰规则真相。
> **✅ PE 落地（2026-07-18·本轮）**：`acceptance-adapter.ts` 加纯读镜像 `res tribute1_card`/`tribute1_return` + `sv tribute1_from`/`tribute1_to`（照 tribute0_* 同款·读 `s.tributes[1]`·零规则）。seed 8 实测复核：`tribute_count=2`、`tribute0` west→hero 大王16、`tribute1` east→partner 小王15——与 GD-A 预告值一致。**GD-A 可回收**：⑦ 现可加 `{ "sv":"tribute1_from","eq":"east" }`、`{ "sv":"tribute1_to","eq":"partner" }`、`{ "res":"tribute1_card","eq":15 }` 钉死次贡半句（剧本=GD 域·PE 不动·此条仅知会投影到位）。

### A-001 · [2026-07-17] · GD-A · 角色卡统一标准依赖 · status: ✅ 标准已发放（owner 2026-07-18·平台 CharacterDraft）→ 引擎桥 **REQ-CHARCARD** 施工中·落地后 adapter 对齐 · 类型: 外部依赖
主角角色卡数据结构由 owner 统一下发（**07-17 四轮：后面再发**）。当前按**最小集 `{name, avatar(头像)}`** 设计适配层（立绘/年龄/性格=扩展位——主角服饰罚视觉先以计数+头像框占位）；标准落地后内置人设卡×3 按同一结构迁移。**S3 前不阻塞**（占位规格已在 ui-scene-design §5）。

### A-002 · [2026-07-17] · GD-A · 掼蛋牌型判定/压制比较 能力缺口预判 · status: ✅ 已转引擎池 **REQ-GUANDAN-牌型**（07-17·owner 清池授权） · 类型: 能力缺口候选
判型（含三连对/钢板/炸弹族/同花顺/天王炸）+压制序+级牌逢人配。先裁 `t3-poker-hand rankingTable(wild)` 可否重组表达；不能则申请下沉。**禁游戏层自写判型解释器。**（Lead 裁决 07-17·A-S1 条件②：**下沉通用 `t3-hand-pattern`**·spec Lead 亲笔·随 S2 节奏。）

### A-003 · [2026-07-17] · GD-A · 行为树 AI 能力缺口预判 · status: ✅ 已转引擎池 **REQ-BT-行为树**（07-17·owner 清池授权） · 类型: 能力缺口候选
owner 意向 BT。GD 方案：BT 纯数据树+通用解释器（外层策略）+候选估值表（内层出牌）；若 Lead 判「策略表+condition/flow 重组已够」则从其裁决。记牌/偷看=数据配置，全种子确定性。（裁决落地 07-17：**引擎已交付 `t2-behavior-tree`**（`0c021546`）——S2 plan 实名消费。）

### A-004 · [2026-07-17] · GD-A · 四家轮转盘间流程 能力对照 · status: **✅ 结案（Lead 对照结论·2026-07-17·随 S4 复查落档）** · 类型: 能力对照
墩→圈→盘→进贡/还贡→升级 的状态机。先对照现有 `flow`/`event-when` 表达力，不够再提。
> **⚖ Lead 对照结论**：`flow` **能**表达盘/run 粗粒度生命周期（dealing→playing→settle→run-check·flag/resource 守卫转移——有平行施工变体实证可行·约 189 行宿主即可收墩圈轮转）；**不能**自然表达逐座墩圈轮转与进贡矩阵（事件形状不合·硬塞=数据造假）。落地版取**线性过程化 session 脚本**形态（照 game-e session.ts 先例·规则语义全在引擎 hand-pattern/BT/数据表，脚本只做顺序编排）——Lead 准许该形态（见 capability-plan §4① 裁决补正），**代价记债**：编排脚本 419 行 > 例外①预估 200 行，偿还计划照旧=b（麻将）/c（德州）牌桌轮转同构攒齐后下沉通用 `turn-flow`/`table-session` capability（b S4 已开工·c 有 betting-engine——同构证据在快速积累，此债优先级会自然上浮）。

### A-101 · S4 玩法关施工记录（领工声明·Lead 复查代录·2026-07-17） · status: 施工记录
> **记账缘由（问责定性=制度刚立没接住·不问人）**：S4 落地提交 `d1c2934f`（PE-A session `01Wa2igGxHXZ9w9PmPUyeVAK`）未先写领工声明——「复查基准=领工声明」铁律当日刚由 review-gates 回填（`b305672d`），施工与立律赛跑。Lead 复查时按**提交自带域注+全文件清单**代录边界并逐一核对：`src/games/game-a/**`（guandan-session/ai/hud/game-a+双测试）+ `tools/audits/game-a-{play,result}.audit.ts`（PUI 域·域注知会·照 game-t 先例）+ `public/games/game-a/pipeline.json`——**零声明外文件**。后续 S5-S8 施工按铁律先写声明再动工。
> **并发撞车记录**：Lead 派工的 S4 施工代理与 PE-A session 平行施工同关——PE-A 版先落地且功能更全（含进贡/还贡/抗贡 G1-G4），代理版未推送（并发纪律：不覆盖已落地工作），其「flow 粗粒度重组」设计洞见已收进 A-004 对照结论。**派工流程教训记档**：同关派工前先查在施 session，避免双工。

### A-005 · [2026-07-17] · GD-A · 生产板无法为零代码新立项开卡 · status: ✅ 结案（Lead 裁决 2026-07-18：明文「板自 S3 起」·手册已回填；design 态开卡=YAGNI 暂不做，真撞上再提） · 类型: 生产线工具缺口
`game-pipeline.mjs detectForm` 只认 library/public 的 manifest.json 或 `src/games/<slug>/` 目录——但按八阶段设计 S1 立项卡/S2 plan **先于** S3 骨架，零代码新游戏开不了板、立项卡无处落。本项目权宜：S1 内容备于 `brief.md` §7，S2 过审后随骨架由 CLI 补落卡。建议 Lead 裁：detectForm 增认 `docs/design/<slug>/`（design 态）或明文「板自 S3 起」。（按问责定性=手册/工具缺陷记录，不问谁绕。）

### A-006 · [2026-07-17] · GD-A · 内容分级与平台合规跟踪（服饰罚要素） · status: 📌 长期跟踪 · 类型: 治理
owner 07-17 追加服饰罚玩法（输盘方姨太脱一件·立绘阶梯呈现）。既定约束：①角色全员成年（硬线·角色卡年龄字段+成熟体型）②服饰阶梯含非裸露底线档、到底转金钱罚（硬线·露骨内容不做）③平台定位=出海成人向单机（Steam 成人分级+年龄门；移动双端/中国大陆不可发——owner 知情决策记录在案）。S6 美术、S7 品质、PS 发行各阶段复核本条。（07-17 三轮拍板：发行=**先自玩/内部**——本条降为潜在项，将来上架前重启复核。）

### A-S1 · S1 立项 Lead 复核判词（owner 四轮交办·2026-07-17） · status: **✅ 通过（记档签·CLI signoff 待壳+板就绪补落）**
> **判 PASS**：brief 八条拍板全记档、GD 评判仪式完整（复用面实名对照/缺口预判走池不自造/「原神」误听排为版权红线/内容红线三条硬约束+平台风险 A-006 知情跟踪）、AI 分档含公平告知（宗师读牌 UI 明示）、记牌器不开天眼、场景档控件词汇全闭集且台账槽位已预命名。**条件**：①S2=GDD+capability-plan 成文过审前不写任何游戏层代码（brief §7 已自认）；②两张引擎前置单裁决已在案——`REQ-GUANDAN-牌型`（下沉通用 t3-hand-pattern·spec Lead 亲笔·随 S2 节奏）与 `REQ-BT-行为树`（设计先行）；③台账建行补 spec{w,h} 消费分辨率 + 底线档逐张过内容红线复核（characters.md 已诺）。
> **⚠ 跨游戏会审升级（a×b×c 三案人设）**：三个 GD 各自发明了一套姨太——a=沈玉薇/林曼笙/顾念念（现代中文名）、b=绫/莉世/小夜（和风日文名）、c=五位未命名——而三款游戏共享局外经济（金钱/衣着带进带出）。**Lead 建议案供 owner 定**：全局一个「姨太人设库」（人物二次元锚共用），**c 的"选五个"即从 a+b 已有六位中选五**（零新增人设·只补 vegas 场景服装差分）；a/b 各用其三位（名字风格差异=同一人在不同局的称谓/装束，或 owner 直接钦定统一名单）。三 GD 会审提案报 owner 终字。

> **⚖ owner 终字（2026-07-17）**：三套人设**各自独立，不统一**——A-S1 里的 a×b×c 人设会审项**销案**；game-c 五位由 GD-C 按共享二次元人物锚自设五案（"选五个"=出五个人设即可）。人物美术锚仍三游戏共用 `sakura-nijigen`（省的是风格一致性，不是人设本身）。

### A-008 · [2026-07-18] · PE-A · t3-hand-pattern：逢人配令 legalResponses 返回「规范判读压不过目标」的歧义应对 · status: ✅ 引擎已修（REQ-HANDPAT done `214fc846`·Lead 验收 PASS·兜底 filter 可退=PE-A 自裁·幂等保留亦无害）· 类型: 引擎能力缺口（Lead 域）
**根因（引擎 `src/skills/tier3/hand-pattern.ts`）**：一手含逢人配的牌可有**多种家族判读**，`legalResponses` 用「意图家族」枚举应对并以该家族比 `beatsMatch(play, target)`；但 `act`/`legalCheck`/`beats` 用 `matchPattern` 取**最强判读**——当最强判读落到另一个普通型家族时，跨家族压不过原墩，于是 `legalResponses` 声称能压、`act` 却判非法。**实证**（打 5·♥5=逢人配）：当前墩=钢板 JJJ-QQQ；应对 QQ+KK+两♥5 逢人配 → `legalResponses` 当**钢板 QQQ-KKK**（rank13·压过）返回，但 `matchPattern` 判成**三连对 Q-K-A**（rank14·更强），三连对≠钢板跨普通型 → `beats=false` → `legalCheck` 拒。后果：提示按钮给「打不出去的牌」（owner 2026-07-18 报的现象之一）、AI 空过。
**建议引擎修（Lead 裁）**：`legalResponses` 生成每个 play 后，用**规范 `matchPattern(play.cards)` 自洽复核**——仅当规范判读确能压 target（或领出时规范判读=非空）才纳入返回集；即让 legalResponses 的承诺与 act/beats 的判读口径一致。（或反向：`beats`/`legalCheck` 接受「任一判读能压」——但那要改判定语义，风险更大，倾向前者。）
**游戏层已兜底（本提交·非侵入·用引擎自身 `beats` 复核）**：`guandan-session.legalBeats()` + `ai.chooseTurn` 对应对候选加 `filter(m => beats(m.cards, target, cfg))`——只留 act 真会收的那批，提示/AI 出牌恒合法（回归测试：`应对滤掉「规范判读压不过」的歧义牌`）。引擎修好后此兜底可退（保留亦无害·幂等）。

### A-007 · [2026-07-17] · PE-A · S5 牌桌屏 ui-audit 对纸牌扇形的两处盲区（重叠 + 角标对比）· status: ✅ 已并入引擎池 **REQ-UIAUDIT-叠层与动效**（Lead 2026-07-18）；**本条两诉求 PUI 已交付**（2026-07-18·`3b21ee04`·待 PE-A 消费复验）· 类型: UI 基座工具缺口（PUI 域·非阻断）
> **PUI 交付 A-007（2026-07-18·`3b21ee04`）**：(a) 新 `layout.allowOverlap:true`（render-only）→ 渲染 `data-allow-overlap` → ui-audit 重叠豁免（`types.ts`+`render.ts` renderNode 属性块·同 draggable/anchor 一脉）——**扇形手牌逐张标 `allowOverlap:true` 即消 58 处重叠盲区**；(b) `PlayingCard` 根自动挂 `data-audit-skip-contrast`（牌面红黑花色=定色语义原语·不吃 WCAG）+ ui-audit 对 `[data-audit-skip-contrast]` 内文字免对比 → **33 处角标假阳自动消，游戏零手动标**。测试 `src/ui/components/card-overlap-audit.test.ts`（6 例）+ 手册 `ui.md` 回填·端到端验证（3 张叠放红角标牌→0 重叠 0 对比）。**PE-A 消费**：手牌卡加 `layout.allowOverlap:true`；角标豁免无需改游戏（自动生效）；改后重跑 `/check-ui` 两盲区应归零。**注**：A-011 的 Float/Connector 锚定件重叠豁免可复用 `allowOverlap`（Float 件加该字段即可）；A-011 的常驻 scale 弹簧 anim 仍在 REQ-UIAUDIT 单内待做。
S5 牌桌屏 1:1 复刻 owner 钦定稿 `guandan-lite-mockup.html`（可读 React 版·2026-07-17 替换·椭圆felt桌/席位环/中央墩/**U 弧扇形手牌**/信息条/立绘框/glass 操作区全 LayoutNode 闭集·夜宴皮 GAME_A_THEME）。稿的手牌=大弧扇形（`translateX(中心偏移)+translateY(U弧+lift)+rotate`）——**per-card 垂直弧 flex 流式表达不了**（`layout` 只有统一 `margin`·无 `marginTop`），只能绝对定位逐张 x/y/rotate。因此 `ui-audit` 报两类**盲区**（非真 bug）：①**58 处重叠**=扇形叠放（27 张手牌必叠·纸牌意图叠层·蓝本亦叠）；②**33 处角标「低对比」**=`PlayingCard face:'light'`（稿钦定经典白扑克牌）红♥♦角标（红字白底 3.68·扑克本色）+ 叠放被遮角标（1.15·采样到相邻牌深边）。**曾试 flex 流式规避重叠→手牌变平叠一堆·丢 U 弧·不达 1:1**，故按 owner「我需要 1:1 复刻」+ Claude Design 稿铁律（差异列清单不悄悄降格）**取绝对定位弧形**。**报 PUI 两诉求**：(a) **LayoutNode 暴露「意图叠层」标记字段**（→渲染 `data-allow-overlap`·ui-audit 第 83 行已支持该属性豁免）——供扇形手牌/牌堆/绝对定位叠放，是纸牌类游戏的基座刚需；(b) ui-audit contrast 对 `PlayingCard` 角标 span 豁免（按牌面底色判·非采样背景）。**在 PUI 加字段前**：视觉 1:1 优先（用 light 白牌 + 绝对定位 U 弧），此二盲区列清单待裁·门禁走 tsc+vitest+build+game-skill-audit（红旗零 RATCHET PASS）；牌面/弧形不因工具盲区降格。

### REQ-A-壳件迁移 · 换用引擎公共壳件（game-art-load / local-store） · [2026-07-29] · Lead 派单（引擎池 `REQ-SHELL-公共壳三件` 已落地）→ **指派：PE-A** · status: open · 类型: 壳层去重（render-only·观感零变化）
> **件已在库**（带测·引擎侧同日落地）：`@assets/index.js` `loadGameArtOverrides`/`pickArtOverrides`/`loadGameArtInto`/`createArtAssets` · `@services/persist/index.js` `localStore`/`textCodec`。（game-a 无 sim 运行环，不涉 `host-runloop`。）
> **本游戏替换点**（file:line = 2026-07-29 基线）：
> - `art-overrides.ts:39-57 loadArtOverrides` → 整段删，改 `export const loadArtOverrides = (slug = 'game-a') => loadGameArtOverrides(slug);`（或调用点直接调引擎件）。**判据完全一致**（`<slug>/` 前缀 + `source` 以 `gen:`/`vendored` 开头或 `tags` 含 `skin`），引擎件已带这批筛选的点名测试；与 game-c 那份 95 行近逐字重复由此消解。
> - `art-overrides.ts:9-31`（`registerArtOverrides`/`artUri`/`artOverride` 覆盖注册表）**留在游戏层**——那是 game-a 自己的消费口径，不属公共壳。
> - `game-a.ts:64-66`（`ga_lang` 语言持久）→ `localStore<Lang>('ga_lang', 'zh', textCodec(['zh','en']))`——原文枚举串（不裹引号），与现有 `getItem(k) === 'en'` 写法字节兼容，老玩家语言偏好不丢。
> **验收**：观感/交互零变化 + game-a vitest 绿 + `node scripts/scoped-gate.mjs --run`。红线：不碰 sim/蓝图/hash 面。
