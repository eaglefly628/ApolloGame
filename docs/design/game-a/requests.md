# Game A《掼蛋》· 游戏级工单池（工单随游戏走·不占引擎池槽）

> 规则同引擎池：Lead/owner 裁决改状态；能力缺口确认后由 GD 转 `docs/workflow/requests.md` 提 Lead。

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

### A-001 · [2026-07-17] · GD-A · 角色卡统一标准依赖 · status: ⏳ 等 owner 发放 · 类型: 外部依赖
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

### A-008 · [2026-07-18] · PE-A · t3-hand-pattern：逢人配令 legalResponses 返回「规范判读压不过目标」的歧义应对 · status: ✅ 已转引擎池 **REQ-HANDPAT-歧义自洽**（Lead 2026-07-18·已派工 Opus·P1）· 类型: 引擎能力缺口（Lead 域）
**根因（引擎 `src/skills/tier3/hand-pattern.ts`）**：一手含逢人配的牌可有**多种家族判读**，`legalResponses` 用「意图家族」枚举应对并以该家族比 `beatsMatch(play, target)`；但 `act`/`legalCheck`/`beats` 用 `matchPattern` 取**最强判读**——当最强判读落到另一个普通型家族时，跨家族压不过原墩，于是 `legalResponses` 声称能压、`act` 却判非法。**实证**（打 5·♥5=逢人配）：当前墩=钢板 JJJ-QQQ；应对 QQ+KK+两♥5 逢人配 → `legalResponses` 当**钢板 QQQ-KKK**（rank13·压过）返回，但 `matchPattern` 判成**三连对 Q-K-A**（rank14·更强），三连对≠钢板跨普通型 → `beats=false` → `legalCheck` 拒。后果：提示按钮给「打不出去的牌」（owner 2026-07-18 报的现象之一）、AI 空过。
**建议引擎修（Lead 裁）**：`legalResponses` 生成每个 play 后，用**规范 `matchPattern(play.cards)` 自洽复核**——仅当规范判读确能压 target（或领出时规范判读=非空）才纳入返回集；即让 legalResponses 的承诺与 act/beats 的判读口径一致。（或反向：`beats`/`legalCheck` 接受「任一判读能压」——但那要改判定语义，风险更大，倾向前者。）
**游戏层已兜底（本提交·非侵入·用引擎自身 `beats` 复核）**：`guandan-session.legalBeats()` + `ai.chooseTurn` 对应对候选加 `filter(m => beats(m.cards, target, cfg))`——只留 act 真会收的那批，提示/AI 出牌恒合法（回归测试：`应对滤掉「规范判读压不过」的歧义牌`）。引擎修好后此兜底可退（保留亦无害·幂等）。

### A-007 · [2026-07-17] · PE-A · S5 牌桌屏 ui-audit 对纸牌扇形的两处盲区（重叠 + 角标对比）· status: ✅ 已并入引擎池 **REQ-UIAUDIT-叠层与动效**（Lead 2026-07-18）· 类型: UI 基座工具缺口（PUI 域·非阻断）
S5 牌桌屏 1:1 复刻 owner 钦定稿 `guandan-lite-mockup.html`（可读 React 版·2026-07-17 替换·椭圆felt桌/席位环/中央墩/**U 弧扇形手牌**/信息条/立绘框/glass 操作区全 LayoutNode 闭集·夜宴皮 GAME_A_THEME）。稿的手牌=大弧扇形（`translateX(中心偏移)+translateY(U弧+lift)+rotate`）——**per-card 垂直弧 flex 流式表达不了**（`layout` 只有统一 `margin`·无 `marginTop`），只能绝对定位逐张 x/y/rotate。因此 `ui-audit` 报两类**盲区**（非真 bug）：①**58 处重叠**=扇形叠放（27 张手牌必叠·纸牌意图叠层·蓝本亦叠）；②**33 处角标「低对比」**=`PlayingCard face:'light'`（稿钦定经典白扑克牌）红♥♦角标（红字白底 3.68·扑克本色）+ 叠放被遮角标（1.15·采样到相邻牌深边）。**曾试 flex 流式规避重叠→手牌变平叠一堆·丢 U 弧·不达 1:1**，故按 owner「我需要 1:1 复刻」+ Claude Design 稿铁律（差异列清单不悄悄降格）**取绝对定位弧形**。**报 PUI 两诉求**：(a) **LayoutNode 暴露「意图叠层」标记字段**（→渲染 `data-allow-overlap`·ui-audit 第 83 行已支持该属性豁免）——供扇形手牌/牌堆/绝对定位叠放，是纸牌类游戏的基座刚需；(b) ui-audit contrast 对 `PlayingCard` 角标 span 豁免（按牌面底色判·非采样背景）。**在 PUI 加字段前**：视觉 1:1 优先（用 light 白牌 + 绝对定位 U 弧），此二盲区列清单待裁·门禁走 tsc+vitest+build+game-skill-audit（红旗零 RATCHET PASS）；牌面/弧形不因工具盲区降格。
