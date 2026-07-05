# 引擎需求池 · Requests

> 各角色（按 `docs/roles/index.md` 名录）在此提需求；Lead 读取 → 评审/裁决 → 派工 → 标记状态。**术语注（2026-07-04）：历史条目里的「PA/PB」= 早期 Game Creator（游戏创作者）代号，与现名录 PA（资产管理员）无关。**
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。
>
> **（2026-06-15 清理：本池仅保留 Game E/F/G 需求；非 F/G 条目已移除，见 git `41ace96`。）**
> **（2026-06-26 Token 清理：已结案条目（done/wontfix）正文压成一行摘要，完整论证/接线契约见各 commit。open/进行中条目保留全文。）**

---

## 待处理 / 进行中

### REQ-PA-3D公用货架 · Free Library 增公用 3D 基础素材 + 3D vendoring + 本地目录标准 · [2026-07-04] · owner 拍板 → **指派：PA（资产侧 ①②③④a）· P3D（游戏侧切换 ④b）** · status: **PA 侧 ✅ done（①②③④a·分步全绿推）；④b 转 `requests-3d.md`「REQ-3D-货架接入」待 P3D** · 类型: 架构补全（vendoring 模型的 3D 半边·真缺口）
> **PA 施工回执（2026-07-04·分步全绿推）**：① 货架备料工具 `scripts/gen-shelf-3d.mjs`——11 材质(数据型 `mat/*`)+3 基础 mesh(程序化 glb `mesh/plane|cube|sphere`·three GLTFLoader 实测可解析)+3 程序化贴图(`tex/plank_*`·usage 闭集)+1 渐变天空盒(`env/sky-gradient`·纯 Node PNG)。② `vendor-asset.mjs` 支持数据型(material 无 path·免 copy)+文件型(mesh glb/贴图)——`game-z` vendor 了 mat/mesh fixture，`vendor.test` 覆盖两路。③ 本地目录标准 `public/games/<game>/art/{textures,models,materials,env}/` 已写进 `playbooks/assets.md ⑥`。④a 程序化贴图产进货架。守护测 `src/assets/shelf-3d.test.ts`。
> **owner 愿景**：Free Library = 统一货架（2D + 公用 3D 基础素材）；每游戏开工按需 vendor 到本地美术目录，一律不直引货架。
> **现状核对（PA 2026-07-04）**：2D ✅（`vendor-asset.mjs` + 游戏本地 `art/index.json` 已通）；3D ❌——共享 `assets/index.json` 全 2D（type 仅 texture+1 sound·零 mesh/material/hdr）；程序化贴图散落 `public/textures/` 被游戏直引（=反 vendoring 例）；3D 素材各游戏自持、无公用货架。
> **四步**：① 共享 3D 货架——登记公用数据资产进 `assets/index.json`(+spec)：基础 mesh(cube/sphere/plane glb)、材质(pbr 预设降为 `type:'material'` 数据条目)、程序化贴图(gen-textures 产物登记)、天空盒(1–2 CC0 HDRI ≤2k)。② 扩 `scripts/vendor-asset.mjs` 支持 copy mesh/material/hdr 进本地并携 spec(scale/colorSpace/genCollision)+补测(现仅测过 2D)。③ 本地目录标准 `public/games/<game>/art/{textures,models,materials,env}/` 写进 `playbooks/assets.md`(PA handoff backlog #4 收口)。④a gen-textures 产物改「产进货架」而非散落。④b（P3D 域·转 `requests-3d.md`）game-z/game-d 停直引 `public/textures/` → 改从本地 `art/` vendor。
> **边界**：`MaterialSpec/MeshSpec` 已存在(不新增 schema)；渲染消费端已就绪(P3D render 半定稿)。PA 分步推、门禁全绿；碰渲染/游戏代码先知会 P3D。

### REQ-PUBLISH-创作台一键发布 · player 模式内「打包→上传 Steam」一键流水线 · [2026-07-04] · owner 口头指派 → PS 转呈（跨 PS↔PST 域） · status: **裁决完毕（Lead 2026-07-04·见文末）·PS 先行硬化契约·PST 排队接 UI** · 优先级: P2（产品体验·非阻塞） · 类型: 产品化·发行管线接入创作台（后端多已存在·主要是接线）
> **源起**：owner 2026-07-04：创作台 **player 模式**下把发布按钮/路口接好——一键打包、填自己的 Steam ID/AppID，让用户「一条流水线产出游戏」。**范围裁决（owner 当面答 PS 二选）**：① 承载面 = **创作台 player 模式（网页）**；② 深度 = **尽量一路到 Steam 上传**（能自动的自动到 steamcmd upload 为止）。
>
> **后端多已存在（接线，非造轮子）**：`steam-publisher/serve.py`（HTTP API：配置→build 裸目录→生成 VDF→steamcmd 上传·含实时日志轮询）、`scripts/dist.py`（打包菜单）、`electron-builder.yml`、平台接线（成就/云/富状态）均就绪。缺的是①把它接进 studio player 模式 UI ②一条 studio 能稳定调的发布 API。
>
> **PS 提议域切分（请 Lead 裁）**：
> - **PST 域（UI）**：player 模式内「发布」区——选游戏/平台、填 AppID/DepotID/builder 账号（=用户 Steam ID）、进度与日志展示。走 studio 现有 React 产品面（非游戏 UI 铁律范畴）。
> - **PS 域（管线契约）**：提供 studio 可调的稳定发布 API/CLI：`package(game,platforms)`→`genVDF(appId,depots)`→`upload(builder)`，带进度/日志流。由现有 `steam-publisher/serve.py` 端点收敛/硬化而来（apollo.py 转发 或 studio 直连本地端口）。= PS 施工物。
>
> **必须显式标给用户的「不能自动」三步（architect 诚实·Valve 无 API）**：① 用户自己的 $100 合作伙伴账号 + 真 AppID/DepotID；② 本机装 steamcmd + 首次缓存登录（Steam Guard 令牌需终端手输一次）；③ 上传后后台 **Set Live**（防误推线上·故意手动）。故「一路到 Steam」= 自动到 upload 为止 + 向导显式引导这三步，非黑箱全自动（细节 `steam-publisher/RELEASE-PROCESS.md`）。
>
> **请 Lead 裁**：a) 域切分是否如上（PST 接 UI / PS 供管线 API）；b) 接入形态——studio 直连 steam-publisher 本地端口 vs 经 apollo.py 转发 vs 内嵌重写；c) 派工。
>
> **Lead 裁决（2026-07-04）**：
> a) **域切分照准**——与角色卡边界严丝合缝（PST=studio 前端+apollo.py 服务面；PS=steam-publisher 管线），无需调整。
> b) **接入形态=经 apollo.py 转发**（薄代理 `/api/publish/*` → steam-publisher serve.py）。理由：①studio 前端现在只认一个后端缝（`/api/*` 相对路径），M5 Electron 打包正靠这条缝换传输层——直连第二个本地端口会破缝+引 CORS+双服务生命周期；②发布是危险面操作，收进 apollo.py 统一走已有的路径防护/审计口；③内嵌重写=造第二套管线，回驳。转发层**只透传不塞逻辑**（进度/日志流原样代理）。
> c) **派工**：PS 先行（自请照准）——serve.py 编排 API 硬化成稳定契约（`package→genVDF→upload` 三段 + 进度/日志 + 判词 token 收口）+ mock/480 冒烟；PST 随后接 player 模式发布区 UI（**「三步不能自动」必须做成显式向导页**，不许藏在文档里）；两段各自门禁绿，联调验收=Lead。P2 维持（各自接在当前核心工作之后）。status 更新 → **裁决完毕·PS 可先行**。
>
> **PS 契约硬化完成（2026-07-04·owner「可以先做」+ Lead 裁准 PS 先行）**：`serve.py` 按 Lead c) 硬化成稳定契约——**三段命名** `stage_package/stage_genvdf/stage_upload` + `plan_pipeline` 组合 + additive `POST /api/plan`；**判词 token 收口**（段判词 `ST_OK/ST_BLOCKED`、任务判词 `JOB_IDLE/RUNNING/DONE/ERROR`·`job_status()`，接进 `/api/state`+`/api/log`，消费端不 scrape 日志）；无真账号冒烟 `scripts/steam-publish-smoke.py`（480·**24 断言**·退出码门禁·自证可红·登记 testing 手册）。apollo.py 薄代理 `/api/publish/*` 透传即用。**余：apollo.py 代理（服务面域）+ PST 接向导页 UI**。详见 `finish/PS-steam-finish-list.md`。

### REQ-QA-发行测试假信心修 · mock-steam 排序 / achievements 幂等 断言补全 · [2026-07-04] · 主程（测试意义性复核撞到）→ **发行工程师（PS）域** · status: **✅ done（PS 2026-07-04·两处断言补全 + 自证红·门禁全绿）** · 优先级: P2（小·非阻塞·但属「假信心」测试=比没测更糟） · 类型: 测试正确性修（断言没验测试名声称的行为）
> **✅ 完工（PS 2026-07-04）**：① `mock-steam.test.ts` 排行榜——给 `leaderboard` 事件补 `board` 快照（经既有 `onEvent` 通道观测·不碰 SteamBridge 契约/不耦合 LS key），断言乱序上传 30/90/60 后榜单 `[90,60,30]` 降序 + 严格非递增。② `achievements.test.ts` 幂等——改为 toast 计数：同端口再解锁 + 跨持久化二次端口解锁，均断言仍恰 1 个 toast（旧断言只验 `isAvailable` 常量）。**验收自证**：临时去 mock 排序 → ① 红（`[30,90,60]≠[90,60,30]`）；临时去幂等守卫 → ② 红（`expected 2 to be 1`）；恢复后 tsc + vitest(2245) + build 全绿。边界内（仅两 `*.test.ts` + mock 事件补 `board` 字段）。
> **源起**：主程 2026-07-04 全库测试意义性复核（4 子代理分片精查）发现两条**「假信心」测试**——测试名声称测了某行为，但断言根本没验它，被测逻辑改错也照绿。均在 `src/services/platform`（PS 域），故派 PS 修（Lead 出诊断 spec，PS 施工）。
>
> **① `src/services/platform/mock-steam.test.ts:22-30`**：测试名意在「排行榜高分在前」，body 只 `uploadLeaderboardScore` 三个分数、**从未断言返回/查询的榜单是降序**。→ mock 若升序或不排序都不会红。
> - **修复须证**：上传三个乱序分数后，查询榜单，断言**按分数降序**（高分 index 更靠前）；至少断言「更高分不会排在更低分之后」。若 mock 当前实现未真排序，一并把排序补上（这才是被测行为）。
>
> **② `src/services/platform/achievements.test.ts:28-30`**：声称验「toast 幂等」，实际只断言 `port2.isAvailable() === true`（一个 mock 常量），**幂等从未被检查**。
> - **修复须证**：对同一成就 `unlock` 两次，断言 **toast/解锁只触发一次**（数 toast 调用次数，或验解锁集合幂等/已解锁不再回调）。
>
> **验收门槛**：改完两处断言在「故意打断被测行为」时**真会红**（PS 自证：临时把 mock 排序去掉 / 幂等去掉 → 测试应红）；tsc+vitest+build 全绿直推 mainbranch。**边界**：只动这两个 `*.test.ts`（必要时连带补 mock 的真实排序/幂等实现·仍在 PS 平台域内），不外溢。


## 已结案条目 → 全文见 `requests-archive.md`

> 所有 done/wontfix/作废 条目（含裁决理由与完工摘要）已归档到 `requests-archive.md`；查旧单先 grep 它。本池只留活跃 open/in-progress/排队 条目（防每读付历史 token·owner 2026-07-04 token 底盘优化）。

### REQ-UI-锚定与绑定层 · UI 声明化二期（REQ-ARCH-ANCHOR 历史欠账收账） · [2026-07-04] · owner 亲派 → **指派：UI 程序员（owner 直辖·UI 库域授权施工·Lead 图纸+验收）** · status: **open（①锚定立即施工·②绑定设计稿先行）** · 优先级: **P1（弱 LLM 产完整游戏的最大单一杠杆·底座终审 🔴#3）** · 类型: 引擎 UI 库能力（render-only）
> **owner 2026-07-04**：「UI 锚定点加绑定层，派给 UI 程序员做，我让 UI 程序员查。」出处：底座终审 `docs/design/base-capability-review-2026-07-03.md §二🔴#3 + §四.3`（锚定与绑定**分两步**·锚定先行）。
> **要消灭的病（现状证据）**：game-g 战场徽标/VS 连线/胜负挂牌全靠手写 `getElementById('u-'+id)` + `getBoundingClientRect` + `createElement`（`game-g.tsx:372/411-413/440`）——正是 audit 红旗 createElement×27 的一大来源；每个游戏都会再犯，因为**引擎没给「把浮层钉在活动目标上」的数据说法**。
>
> **① 锚定（立即施工·范围收窄）——spec（Lead 图纸）**：
> 1. **锚源契约**：渲染层给每个实体 DOM 节点盖统一锚标（如 `data-entity-anchor="<entityId>"`·引擎渲染器出，非游戏自造 `u-<id>`）；LayoutNode 控件沿用既有 `anchor` 键位（引导锚与浮层锚同一注册表，语义不混：引导=spotlight，浮层=定位基准）。
> 2. **浮层控件（闭集新成员）**：`Float{ anchorTo:{kind:'entity'|'node', id, at?:'center'|'top'|'bottom'|'left'|'right', offset?:{x,y}}, children, ttlTicks? }`——引擎渲染循环每帧读目标 live rect 定位（纯表现·不进 sim/hash）；目标消失→浮层随之隐藏（不悬空、不报错）。
> 3. **连线控件**：`Connector{ from:anchorRef, to:anchorRef, style:令牌闭集(实线/虚线/箭头), label? }`——「谁打谁」连线的数据说法。
> 4. **红线**：render-only（sim/Condition 绝不读浮层位置）；定位计算不进 lockstep hash；样式走令牌不收 raw hex；控件进 component 闭集 + catalog + 校验器同步。
> 5. **测试与消费自证**：控件级点名测试（锚定/偏移/目标消失回收）+ `/check-ui` 过 + **game-i 展示台加一个锚定 demo 页**（活范例铁律）；game-g 战场替换由甲/程序B 随战斗 UI 批消费（不在本单强做，但本单落地后其红旗 DOM 有了退路）。
>
> **② 绑定层（设计稿先行·不许直接开写）**：目标=LayoutNode 属性可声明绑定世界状态（如 `text:{bind:'resource:gold', format:'金 {v}'}`·闭集表达式：resource/flag/stringVariable+格式化，**不是**自由表达式语言），让弱 LLM 不写 TS builder 也能交付活 UI。**约束**：必须与创作台 UI 生成（PST）共审设计——绑定词汇会直接进生成 prompt 词汇表；先交 ≤2 页设计稿（绑定语法闭集+更新时机+与现有 visibleWhen/tween 的关系）给 Lead 审，过审才施工。
> 门禁全绿直推；①②各自独立提交；完工标 ✅ 待 Lead 对抗性验收（真浏览器 demo 必查）。

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

### REQ-G-战斗公平与顺序回合 · [2026-06-28] · owner 试玩反馈 → 战斗 sim 域（turn-combat.ts·design G 重扫） · status: **open（核心模型+平衡·非 PG lane·PG 仅评判转交）** · 类型: 核心玩法调整（owner 拍板·待战斗/design G 评估实现）
> owner 试玩第一关后三条反馈，均落 `turn-combat.ts`（战斗 session 文件）+ 影响平衡（boss-config 目标通关率按现基线调）。PG 核实现状 + 评判，转交战斗/主程/design G：
>
> **① 起始资源不公平**：现 `MANA_START=6`（玩家 A 起手 6 源泉），敌 B `mana=0`（其回合 +1=1）；`OPENING_HAND=3` **只给 A 摸**（game-g.tsx:318），B 无扑克手牌（仅可施放地煞）。→ **owner 要：双方都 3 源泉 + 双方都摸 3 手牌**。（改 `MANA_START` 6→3 区间 + caller/init 给 B 也摸 OPENING_HAND + B 起始源泉对称。）
>   - PG 评：A 现在「先手 + 资源更多」= 双重优势（教学关 98% 靠它保送）。改 3+3 更公平，但 A 仍有**先手优势**——真公平或许要给 B 一点补偿（B 起始源泉略高 / 后手补正）。这是 design G 的平衡活。
>
> **② 回合改顺序制（核心模型翻转）**：现 `advanceBoth` = 双方兵线**同时**推进（注释：owner 2026-06-21 为 PvP 定的同步模型·替原「只推 active 方」）。→ **owner 要：我放完牌→结束回合→我方推进/攻击；敌放完牌→敌方推进/攻击**（只推 active 方·交替·看得清）。= 回退到「只推 active 方」的顺序推进。
>   - PG 评：可读性确实是同步模型的硬伤（owner「两个一起行动看不清」）。但这是**核心模型翻转**：影响 PvP 地基（当初为 PvP 同步而设）、AI 节奏、战斗 golden、且**改变平衡**。需战斗 session 重构推进阶段 + design G 重扫。
>
> **④ 掷命对决·战力来源必须透明（owner 反复要求·一直未达成 = doc24 A4「3D-READ」）**：对决时显示的有效战力 `P_eff`，玩家**必须看得见每一分从哪来**——底盘点数 + 地支附魔（**具体哪张生肖牌 +X**）+ 天罡（**具体哪张天罡 +X**）+ 士气 + 卦象 + 干预，逐项带来源标签拆解。需 `clash-resolve`/`pEff` 暴露 breakdown（每项 {source, label, delta}）→ `turn-battle-screen` 对决特写渲明细。**非黑箱·这是核心读感**。
> **⑤ 战胜方回库完全返还源泉**：战胜方单位「回库」(cycle) 时**完全返还其源泉消耗**（不打折）。`turn-combat`/`clash-resolve` 经济规则。⚠ 先确认「回库」语义（胜者退回牌库循环？ vs 现「胜者留场续攻」），再定返还点。
> **⑥ 战场单位 hover 看不到信息**：鼠标放到场上兵牌时，看不到该牌的**人物简介 + 当前加成拆解**（地支/天罡/士气/卦象各 +X 来源）。`turn-battle-screen` 给场上兵加 hover 词条（英雄列传简介 + buff 来源拆解·与 ④ 同源数据）。**复用引擎现成能力**：`Tooltip.block`（PG 大厅牌墙已用·grid 不塌）+ 词条 bubble + 视口边界定位（PG 刚下沉）——战斗屏直接套，不必重造。
> **连带**：①②⑤ 改经济/通关率 → boss-config §〇 目标曲线（98/87/75/70/65%）须 design G 用 `simulate-balance.ts` 重扫定稿。
> **PG 边界**：①②④⑤ 全在 `turn-combat.ts`/`clash-resolve.ts`/`turn-battle-screen.ts`/`game-g.tsx 战斗驱动`（战斗域）。PG（大厅/UI）不动战斗逻辑。owner 若要 PG 接手战斗这部分，需显式移交战斗文件归属（战斗 session 已近收尾）。

### REQ-G-Boss写死明牌天罡 · [2026-06-28] · PG → 战斗/loader 域 · status: **open（UI 侧已亮明牌·待战斗侧写死对齐）** · 类型: 配置对齐（boss-config-1-5 §五·五 + §七·#1）
> **背景**：按策划 `boss-config-1-5.md` 重配关1-5「明牌 counter-pick」（设计称「核心乐趣」）。**PG 已落 UI/数据侧**：`StageCampaign` 加 `deckTheme/bossTiangang/counterTip`，主页 Boss 情报 + 战役页亮出「⚡明牌天罡 + 🎯克制提示」（关1=旗手·不屈 / 铺场快攻绕开耐久…，关2-5 同 §五·五 表）。
> **缺口（战斗/loader 域·非 PG lane）**：`level.ts` 的 `boss.tiangang` 当前仍是**随机 12 张**（`bossTiangang`），与 UI 亮的明牌不一致 → 玩家「照明牌配克制」会落空。请战斗/loader 把 `boss.tiangang` 按 boss-config §五·五 **写死 ≤5**（张数随关爬 2/3/3/4/5），id 对照：关1 `bannerman,unyield` / 关2 `tigertally,bannerman,bedrock` / 关3 `tigertally,flow,twinblade` / 关4 `arrowhead,tripod,tigertally,relay` / 关5 `atlas,leaddice,irondice,tigertally,arrowhead`。
> 接好后「看明牌→配克制→碾过去」闭环成立·design G 再纳入 Boss 天罡重扫平衡（§七 备注）。

### REQ-UI-G棋枰 · [2026-06-27] · GA（game-g·战斗 UI 重构路②评估·请 Lead/owner 裁决形态） · status: **🔁 owner 2026-06-28 推翻豁免·拍板「激进全量重写为数据驱动 LayoutNode·缺能力开给主程」（GA 重评：x/y 绝对定位+rotate+现有控件可重组·不需新引擎原语·见下「GA 重评 2026-06-28」）** · 类型: 形态裁决 → 转 全量数据化重写

> **★ GA 重评（2026-06-28·能力长进后重新评估·owner 拍板激进重写）**：主程当初「豁免」是按「play-field→canvas/ECS 渲染器」框架（impedance mismatch）；但主程自己澄清「铁律要数据驱动·非必须栅格化」。本次重构期间 LayoutNode 长出关键能力 → **棋枰可纯数据驱动 DOM 重组，不需新引擎原语**：
> - 解锁点：`LayoutConstraints.x/y`=**绝对定位**（render.ts L76·position:absolute）+ `rotate` + `Panel 自带 position:relative`（定位上下文）+ 控件集（`cols` 网格 / `PlayingCard` / `Versus` / `CoinFlip` / `fx` / `Tooltip.block` / `Image` / `anim`）。
> - 逐元素：三路×9 格=Panel grid cols:9；格内兵牌=PlayingCard + x/y 绝对叠 Label(战力/生肖×3/将水印)；斜梯=x/y+rotate 细长 Panel + bgScroll 流动；门钮=Button；城堡/血灯=Panel 组+rotate:45 菱形；掷命特写=Versus+CoinFlip+Label 明细；forecast/落点/clash 环=x/y 叠+fx pulse；hover=Tooltip.block。
> - **rule-of-three 闸不卡**：这是游戏层填数据（重组）·非加引擎能力。
> **owner 拍板**：激进推进·全部数据化落地·缺的能力开给主程做。
>
> **GA 分阶段执行（每段独立全绿可回退）**：① 掷命对决特写(Versus/CoinFlip·无缺口·试点) → ② 棋盘骨架(grid+格+门·需 Panel.action) → ③ 兵牌信息层(PlayingCard+x/y 叠·纯重组) → ④ 斜梯/城堡/源泉(rotate 重组 + 源泉 drain fx)。
>
> **撞到/将撞到的真缺口（已拆成下列 REQ 开给主程并行）**：`REQ-UI-容器可点`(Panel.action·②需) · `REQ-UI-fx源泉消退`(④需) · `REQ-UI-容器描边形`(Panel 边框色/圆角/虚线·②城堡+格框需·新撞)。其余用现有能力重组。
>
> **★ GA 阶段②执行记录（2026-06-28·部分落地 + 新撞缺口）**：
> - ✅ **血灯 hpGem 已数据化**：旋转菱形宝石 → `Label '◆'/'◇'`（亮=`danger` 血红+磷光 / 灭=`dim`）。菱形字符天然即斜方宝石、避开 Panel「圆角恒 10px·小件压不出方钻」坑。最弱 LLM 只填 ◆/◇+令牌。两军大本营血灯均已切（`hpRowNode`）·全绿。
> - 🩹 **顺手修潜伏色 bug**：`GG_BATTLE_THEME` 的 `danger`/`ok` 原桥到 `var(--heart)`/`var(--club)`（大厅令牌·战斗 `THEMES` 集里**未定义** → 红/绿失效）；改桥到战斗自有的 `var(--danger)`(#ff5d62 正是血灯红)/`var(--hp)`。同时修好阶段①掷命特写里 ok/danger 文字色（之前也踩这坑）。
> - 🩹 **补阶段①漏改的测试选择器**：掷命钮迁数据驱动后挂 `data-action`，但 `flow-walk.test.ts`/`game-g.turnmatch.test.ts` 仍查旧 `[data-act="clash-roll/ok"]` → 驱动不动掷命、对局 160 回合不收场（flow-walk 此前一直挂红·非本次引入·已确认 clean tree 也红）。改双挂 `[data-act=...],[data-action=...]` 兼容。（live 委托读 `dataset.act ?? dataset.action`·线上一直 OK·仅测试桩失配。）
> - ⛔ **城堡 fortBase + 格子 chrome 暂保 bespoke·等 `REQ-UI-容器描边形`**：初评「Panel 组+rotate 可重组」低估了 Panel 边框是**令牌专用**（no 阵营橙/蓝描边、no 金边界格、no 虚线放牌区）+ **圆角恒 10px**（城垛/盾压不出形）。硬塞要么大量 hack `bg` 渐变（违「最弱 LLM 同数据」）要么失真。→ 拆出 `REQ-UI-容器描边形` 开给主程·到货再切城堡/格框。兵牌信息层=阶段③(PlayingCard+x/y·另算)。

### 📦 3D 渲染线需求 → 已移至 `docs/workflow/requests-3d.md`（owner 2026-06-28 立独立池）

> Mesh3D/Transform3D/Camera3D/Sky3D/Model3D/Light3D/Post3D 等 **3D 盒庭渲染线 + Game Z** 的需求 / 工单（含 `REQ-3D-W1高效引擎`·实例化绘制、`REQ-3D-Model导入`·glTF）**全部移至 [`requests-3d.md`](./requests-3d.md)**。新 3D 需求进那里、不进本文件；本文件留通用 UI 库 / 其它游戏需求。

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

### BUG-G-掌机黑屏 · [2026-06-22] · owner→甲（cartridge/战斗屏域·owner 直派 bug 修） · status: **🟡 已修（zoom·`c5608bbc`）· 待真机烧版验证** · 类型: 弱 GPU 渲染回归

> owner 报新烧 cartridge 包「APOLLO OS 绿字开机条 + 黑屏」、同代码 Mac 正常。掌机 = `build:cartridge`（`dist-cartridge`·base `./`·直挂 game-g 无 launcher）·弱 GPU webview。
> **穷尽定位**：非 JS 崩溃——cartridge 真产物无头(happy-dom)挂 game-g 零报错·大厅/战斗 DOM 全渲(605KB)·tsc/vitest1664/build:cartridge 全绿 → 弱 GPU 合成失败。
> **根因**：闪烁修(`7634b027`)把战斗屏首帧烤成 transform:scale 单合成图层·弱 GPU 合成整屏图层失败→黑（旧两段绘制 CPU 先画可见帧＝"闪烁"）。
> **修(`c5608bbc`)**：战斗屏 1340×858 适配 transform:scale → **CSS zoom**（CPU 布局缩放·不合成图层·消闪烁·Mac 等价·zoom 不支持也只裁切不黑＝fail-safe）。
> **待 owner 真机验**。若仍黑次候选：① `cartridge-entry.ts` 整屏 `#game-root` opacity 渐变；② 战斗浮层 backdrop-filter。详见 `SESSION-HANDOFF.md §0`。

---

### REQ-G-战场UI批次 · [2026-06-21] · owner→game-g 乙（甲代登记·战场屏 owner 授权乙动）· status: **open ⚠️ owner 二次催办（2026-06-21 playtest：1/3/6/9 仍看不到·请乙优先）** · 类型: 表现层一批（playtest 连发）
> 【Lead 注 2026-07-04】战斗屏正被心流重构重塑（IMPL-PLAN-combat-flow·三行为/碰撞才战斗/满仪式）——乙开工前先与该线核对，已被吸收的项勿重复做；owner 催办的 1/3/6/9 仍优先。

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

### REQ-026 · [2026-06-26] · PA · game-h 你造我塔/是男人就X层 · status: **⏸ 暂缓/搁置（owner 2026-07-04 拍板先移出活跃池·暂不下沉评估）** · 优先级: P1(rope/spring) P2(conveyor/respawn) · 类型: 真缺口（想象力机关 = effect 写不了 Velocity/Transform、无双体约束）
> 【Lead 注 2026-07-04】owner 指示先搁置本条（暂不做弹簧/绳索/传送带/重生的引擎下沉评估）。记录与下方分析全保留；要重启时按现有拆解（P1 rope+spring 先做）直接接续，无需重提。game-h 现「召唤二重奏版」可玩可测，本条不阻塞。

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

### REQ-G-Boss牌面板 · [2026-06-21] · design G → 甲（战斗屏域） · Game G · status: open · 优先级: P2（明牌可破核心体验·非阻塞战斗逻辑） · 类型: 表现层（数据已在·纯渲染）

> **owner 2026-06-21**：「Boss 5 张天罡也要这样去抽和摸；我们应该能看到他的手牌和天罡牌，但现在没地方看。」+「在他地煞牌下面放一个微小的牌组，手点上去就放大看具体哪几张·是缩小 scale 过的小牌。」
> **评判（design G）**：纯**表现层**——数据全在（`TurnBattle.b`：`pokerDeck/tengangDeck/hand/castIds` + 关卡 16牌组+5天罡明牌）；**无引擎/数据缺口**，只差战斗屏渲染（甲地盘）。机制侧已对：Boss 天罡同玩家从 `tengangDeck` **抽/摸再打**（`drawCard('b','tengang')`→`castTengang`·花源泉·非免费）→ 面板只"看牌"不改机制。
> **派甲（doc24 §九 已补规范）**：① 顶部 Boss 牌面板：3 地煞（明牌·在途）**之下**放 scale 过的 **mini-deck**（16扑克+5天罡 loadout·明牌 counter-pick 靶）；② 点/悬停 **放大**成可读网格看清具体哪几张（小尺寸=设计·放大解决可读）；③ Boss **手牌+已打天罡可见**（数量+内容·明牌哲学）。乙不碰（战斗屏=甲）。
> **🌫 暗牌/迷雾态（owner 2026-06-21 追加·未来）**：面板留一个**隐藏态**——Boss 带 `fog`（迷雾）地煞时 mini-deck/手牌翻背面·不可放大（玩家看不清·AI 本有全信息）。**`fog` 已在 disha-pack 设计（关17+）**·不是新能力。**关1-5 全明牌不加 fog**（明牌可破=核心）；fog 留后期/Ascension。

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

---

### REQ-GAMED-数据驱动迁移 · game-d《骰途》从手写 sim 迁成能力驱动（体检整改）· [2026-07-02] · P3D（game-d owner）→ 主程（引擎能力域） · status: **裁决完毕+能力已下沉（dice-roll/wild 已落·6-suit flush 契约测试已钉 `poker-hand.test.ts:404`）·game-d 接线=P3D 排队中** · 类型: 架构整改（数据驱动收口）· 设计 `docs/design/game-d/data-driven-migration.md`
>
> 体检核实属实：game-d 战斗/状态全手写 `S` 对象 + 纯函数，`capabilities:[]`、`Math.random()` 绕种子随机、手写 `loadoutPattern` 重造 poker-hand、双人假、0 测试。目标：照 game-e/game-f 迁成 blueprint（components + capabilities + signals + keybinds）+ 薄 session 编排。~80% 复用现有能力（poker-hand/card-scoring/effect-apply/event-when/mortal/flow/keybind/random）。
>
> **我方已自办（无新引擎工作·门禁绿 + 测试·本 session）**：① 种子化随机 + **run-seed 开局生成**（`RandomSeed`+`nextRandom` 替 `Math.random`·每局不同可出货·待接存档持久化）；② **仅展示函数** `loadoutPattern` 复用 `poker-hand`——**⚠️ 真轮子是战斗路径 `combat.ts detectPattern`（含百搭顶点/顶色·evaluateHand 无通配），此债未还**，待 §2 wild capability 后真替；先给 `detectPattern` 上全牌型行为测试作护栏；③ `game-d-sim.test.ts`(21 例)。
>
> **真缺口 → 请主程下沉成 capability（细节见设计文档 §真缺口）**：
> 1. **`dice-roll` capability（主缺口·最优先）**：读 `DicePool` + `RandomSeed`(+`LockMask` 只重掷未锁)·`Update` 相位写 `RolledDice`（早于 poker-eval）。现无「掷一个声明的骰池」的能力；poker-hand 只消费已填好的 `PlayedHand`。
> 2. **wild/百搭**：`evaluateHand` 无通配 → 扩 poker-hand wild 参数，或 dice-roll 归一化 wild。
> 3. **元素敏感对子**：敌「对子」=同元素+同值联合，poker-hand 按值 或 按花色单计 → 加 pairCount 变体或小 `dice-pattern`。
> 4. **敌反制禁骰**：`discardHighLow`（结算前禁 N 颗）无能力 → 数据化「结算前骰过滤」`DiceCounter{kind}`。
> 5. **6 色同花确认**：poker-hand flush 对 suit int 泛用（6 元素可跑），但 HandType/handMods 是扑克花色形 → 请主程确认复用 `isFlushFlag` 表 6 色同花是否在契约内，否则 `dice-pattern`。
> 6. **双人 co-op（netcode 缺口）**：真双人=lockstep 联机（种子已就绪，缺 netcode/房间/角色）。落地前双人按钮不该假装单机=双人。
>
> **主程填 1–5 后**：我把 `S` 迁成组件、规则迁成能力+数据、UI handlers 改信号、房间推进改 `flow`。6（netcode）另立框架级需求。
>
> **Lead 裁决（2026-07-02·主程·逐条核过引擎源码）** · status 更新: **裁决完毕——2 准 / 1 并入 / 1 回驳 / 1 确认在契约内 / 1 另立**：
> 1. **dice-roll capability：✅ 准（P0）**。真缺口核实（registry 78 项无任何骰 sim）。范围收窄 = 读 `DicePool`+`RandomSeed`(+`LockMask` 重掷未锁) → `Update` 相位写 `RolledDice`（早于 poker-eval）；**#4 并入本能力**做数据化 post-roll 过滤参数（`{kind:'banHighest'|'banLowest',n}`，由 foe 数据驱动）。设计约束：确定性、组件进闭集 component-map、**与 game-g 战力骰/对掷+平局阶梯一并规划成同一个骰能力族**（评审报告 §五 P0 项），防止两次下沉出两套不协调的骰能力。
> 2. **poker-hand wild：✅ 准**——核实 `poker-hand.ts` 确无通配。做成 `HandMods` 参数扩展（**非新能力**）；wild 求最优=小规模确定性枚举。**回驳"在 dice-roll 里归一化 wild"路线**：归一化即求解器，放错层——wild 的最优语义属于牌型评估。受益方还有 game-e（82 张未实装小丑含 wild 类），一次扩两家用。
> 3. **元素敏感对子：❌ 回驳（重组可表达）**——`pairCount` 已存在（`poker-hand.ts:182`），无需"加变体"。「同元素+同值」联合对子 = **复合 rank 编码**（`rank = element*16 + value`）后 `rankCounts`/`pairCount` 直接就是联合计数；同一手要再判顺子/纯值对子，就按原 value 编码**再跑一次 evaluateHand**——两次调用是数据重组，不是引擎缺口。等价写法已给，照此接线。
> 4. **敌反制禁骰：🔶 并入 #1**，不单立能力（防碎能力化）。
> 5. **6 色同花：✅ 确认在契约内**——`Card.suit` 是无约束 int（`cardboard.ts:46`），flush 按任意 suit 计数（`poker-hand.ts:86-100`），6 元素直接跑；schema describe 里的 "suit:0..3" 是文档不是枚举约束。**注意勿与 `suitMerge` 混用**（其红黑归并硬编码 4 花色，`poker-hand.ts:96`）。条件：主程会补一条 6-suit flush 契约测试进 poker-hand.test 钉死此契约。
> 6. **co-op netcode：⏫ 另立框架级需求**——与 game-f 多人（传输 REQ-018 + N 端 lockstep）**合并成一条 net 基建线**，一次建、两个游戏用；排期 owner 拍板。过渡要求照准且限期：**双人按钮先诚实标注（P3D 自己域内，立即可做）**。
>
> **附·整改复审打回三条（Lead 复核 188fbbf1，owner 已知情）**：① 种子写死 `20260702` 且无 run-seed 注入路径 → 每局骰运相同，**出货级 bug**：改为开局生成 run-seed、随存档保存；② "复用 poker-hand" 只替了展示用 `loadoutPattern`，**战斗路径 `detectPattern`（combat.ts:103）原封未动**且零测试——要么真替、要么先补测试，禁止两套并存长期化；③ 提交信息勿超售实际完成范围（会误导后续 session 的债务判断）。
>
> **主程下沉完成（2026-07-02·引擎域·门禁 tsc+vitest+build 三绿）**：**#1 ✅** `dice-roll` capability（`t2-dice-roll`）—— `DicePool`+`RandomSeed`(+`locked` 只重掷未锁) → Update 相位写 `RolledDice`；**#4 ✅ 已并入**（`DicePool.ban:{kind:'banHighest'|'banLowest',n}`，掷后标 `banned` 不移出、保下标对齐）；骰能力族纯函数 `opposedRoll(rng,pA,pB,tiePolicy)`（对掷平局阶梯 rollerWins/defenderWins/reroll）+ `rollDicePool`/`applyBanFilter` 下沉 `src/skills/tier2/dice.ts`（非 capability，先例 hex.ts）。**#2 ✅** poker-hand wild —— `Card.wild?:boolean`（内禀于牌、经 PlayedHand 自动流经 poker-eval，无新配置；裁量：不用 `HandMods.wildIndices`，因 poker-eval 无逐牌 flag 源、wild 是出牌内禀属性），`evaluateHand` 小规模确定性枚举求最优牌型（紧候选集+可重复组合，无 wild 逐字节等价旧行为）。**#5 ✅ 测试钉死** —— 6-suit flush 契约 + `suitMerge` 仅 4 花色语义（6-suit 禁用）契约用例进 `poker-hand.test.ts`。新增测试 24 例（dice 16 + dice-roll 8）+ poker 12 例。**#3/#6 不在本次范围**（元素对子=重组、netcode=另立）。**→ P3D 可开始接线**（game-d 把 `S` 迁组件、`RolledDice`→`PlayedHand` 映射、禁骰/wild 走数据；勿改 `src/skills`/`src/assembly` 引擎域）。
> 【Lead 追加 2026-07-04】顺手带一行活：`game-d.ts` `gd-start-t` 的 TODO(REQ-UI-ink) 切 `color:'ink'`（ink 令牌已落地·原单已结案归档 2026-07-04）。

### REQ-G-地煞新op-v3 · [2026-06-21] · design G → 甲（引擎域） · Game G · status: open · 优先级: P2（关11-52 特色·非阻塞·有降级兜底） · 类型: 真缺口（通用 op·下沉）

> 关11-52 想象力设计提了 ~38 个新 op，design G 收敛成 8 个通用原语 + 优先级清单（详 `design/disha-op-vocab-v3.md`）。**每条都有现有 op 降级映射 → sim 现在能跑·不阻塞。** 甲择优实装高杠杆通用 op（覆盖最多关·复用最大）：
> 1. 🥇 `terrain.laneLock`/`chokepoint`（棋盘几何改写·一个 op 给 N 关地形特色·李舜臣窄海峡）。
> 2. 🥇 `phase.cycle`（Boss 周期切换 fx 组·一关多形态·武田风林火山）。
> 3. 🥈 `aura.invulnerable{everyTurns,dur}` + `rally.revive`（周期无敌/复生·终章）。
> 4. 🥈 `control.disarm`/`sever`（点杀玩家最强牌/废连携）+ v2 freeze/intimidate。
> 5. 🥉 `offense.breakthrough`/`jumpAdvance`（胜后连推/跳格）+ 已设计 deepDecay。
> 6. 🥉 v2 四件（extraAction/freeze/intimidate/withdrawRefundMul·见 REQ-G-地煞新op）。
> 长尾(mirage/minefield/volleyRelay…)先用降级映射上线。实装后 design G 用真地煞重跑 sim 定稿。

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

### REQ-G-起手源泉 · [2026-06-23] · design G → 甲（引擎域·常量） · Game G · status: ✅ **done（`MANA_START=4` 已落 turn-combat.ts:24·2026-07-04 回标）** · 优先级: P1 · 类型: 已覆盖（纯常量调值·非新能力）

> **owner 2026-06-23**：起手源泉 6 太高（玩家一上来铺满·开局没张力）→ 改 **4**·**双方对称**（玩家和 Boss 都起手 4）。
> **派甲（一行改）**：`turn-combat.ts` `MANA_START = 6` → `MANA_START = 4`（`MANA_PER_TURN=1` 不变·双方同源·sim 经 `initTurnBattle` 自动继承）。
> **无新能力**——只调常量。design G 在 4 源泉 + 两 AI 落地后重标 WR 曲线。

---

### REQ-G-主将命数参数化 · [2026-06-23] · design G → 甲（引擎域·地煞参数） · Game G · status: ✅ **done（`lastStandGeneral` 整数命已落·turn-combat.ts:399·2026-07-04 回标）** · 优先级: P1 · 类型: 已覆盖 + 小泛化（布尔→整数）

> **owner 2026-06-23**：关1 列奥尼达有"温泉关"属性 → **主将战败 3 次才退场**（噱头 + 教学：玩家学会"避开主将路·田忌赛马打别路破家"）。
> **现状**：`disha.ts` `lastStandGeneral: boolean`（=主将硬编码 **2 命**·首负残喘退1格不亡）。
> **派甲（小泛化·不是新能力）**：把 `lastStandGeneral` 从 `boolean` 改成 **命数 `number`**（`lastStandGeneral: 0|n`·n=主将战败几次才退）；`laststand` spec → `{ lastStandGeneral: 3 }`（关1 列奥尼达）。**老的 true 等价 2**（兼容）。明牌·玩家可见可破·不偷。
> **为何不是新 capability**：现有 op 已表达"主将多命"·只是把写死的 2 提成参数·属 manifesto §4「已覆盖+参数化」·不新增能力面。

---

### REQ-G-破家善后 · [2026-06-23] · design G → 甲（引擎域·战斗逻辑） · Game G · status: ✅ **done（`advanceColumnToBase` 破家后回牌库+返半费·turn-combat.ts:470-473·2026-07-04 回标）** · 优先级: P1 · 类型: 逻辑缺口补全（已覆盖·复用现成回库路径·非新能力）· 规格: `design/24-turn-based-combat-model.md §4.2.6`

> **owner 2026-06-23 提的逻辑缺口**：一支兵攻进敌大本营、扣掉 1 格血后**怎么处理·原本没交代**。现行 `advanceColumnToBase`(L397-413) 是 `splice` 掉 = **凭空消失**。
> **owner 裁决**：**回牌库**（不消失·可再抽再上）。① 逻辑更顺（破家是大功·不该蒸发·班师回库）；② **不能留场续打**（大本营不是兵·没敌前锋可对决·留场=白嫖每回合砸家·破坏平衡）。
> **派甲（小改·复用现成）**：`advanceColumnToBase` 把"扣血后 splice 丢弃"改成**走 §4.2 掷命「人面·回库」分支**——`pokerDeck.push({该兵})` + `mana += (cost??0)/2`（**直接复用 `resolveClash` L378-382 那段回库逻辑·别另写**）。
> **为何非新能力**：回库+半返路径已存在（掷命人面分支）·这里只是让"破家"也走同一条善后·把"消失"替成"回库"。属 manifesto §4 已覆盖。
> **效果**：3 血大本营 = 至少 3 次独立破门突破（强牌可反复抽出再冲·每次冲完回库 → "持续攻城"节奏·非一兵无限砸穿）·吻合 homeHp=3 持久围攻设计。
> **开放旋钮**：破家半费返还若 sim 显示攻城经济过快·可单独清零（只回库不返费）。先按"与人面一致"实装·sim 再裁。

---

### REQ-G-开局排阵 · [2026-06-23] · design G → 甲（引擎域·init） · Game G · status: ✅ **done（`boss.startFormation` 数据能力 + `hold` 静守已落·turn-combat.ts:90/113 + level.ts·2026-07-04 回标；关1 守军 8♠/9♥ 摆隘口。张数/摆位数值仍归 design G 用 sim 标）** · 优先级: P1 · 类型: 真缺口（开局摆兵·当前不可表达）→ 下沉成数据能力 `boss.startFormation`

> **owner 2026-06-23**：提难度的公平办法——与其给 Boss **偷加源泉**（已禁·不公平），不如让 Boss **开局就有 N 张牌排好在场上**。**明牌**（玩家开局看得见这堵墙·可绕可针对）→ 公平·可破。专治"守势 boss 开局攒不出场面、威胁不到玩家"。
> **CORE RULE 评判**：① 能组合现有能力？**否**——当前两军开局空场、兵只能回合内 `deployUnit` 入场·没有"开局已在场"的表达。② 已覆盖？**否**——`thermopylae` 的"隘口守军"只是抽象 `nearBasePower +1` buff·不是真卡。③ **真缺口 → 下沉成通用数据能力**（确定性·可复用·明牌·审计过）。
> **下沉能力**：`boss.startFormation: [{rank,suit,lane,slot?}]`（数据·写在 boss 配置）。派甲在 `initTurnBattle` 末尾按列表把这些卡**直接放到 Boss 侧对应 lane/slot**（复用 `deployUnit` 的落位逻辑·或直接 push 进 `lane.b`+设 slot）·**不花源泉**（开局既定·明牌）。纯数据驱动·零 per-boss 代码·任何 boss 可用。
> **顺带做实"隘口守军"**：关1 列奥尼达 `startFormation = [8♠@lane?slot8, 9♥@slot7]`（2 张守军排隘口）→ 把原抽象 buff 换成场上看得见的两张墙兵（更直观·契合"300死守隘口"幻想）。
> **关1 取 2 张**（教学关·一点开局压力）；后续关爬 3-4。**design G 用 sim 标张数 + 定每个 boss 摆哪些卡哪条路。**
> **公平边界**：仅"开局明牌摆兵"·玩家看得见、可绕可counter（对应玩家的 out-prepare）。**不是**偷源泉/暗数值。玩家侧不需要对称开局排阵（玩家的对称优势=counter-pick）。
>
> **★ 守军行为 = 静守不动（owner 2026-06-23 拍板·重要契约）**：开局排阵兵默认**静态死守**（守势 boss 本色·非攻势抢先一波）。甲实装这 4 条：
> 1. **不前压**：`advanceBoth` 跳过守军·它不向玩家家推进·守在原 slot。
> 2. **不自动冲家**：堵反直觉 bug——`advanceColumnToBase`（某路只 Boss 兵时自动行军砸玩家家·L397-413）**对守军不触发**。守军是防御单位·绝不主动冲锋。
> 3. **接触才交战**：仅玩家兵推到守军相邻格 → 正常 `resolveClash`；玩家不进这路则守军一直静守。
> 4. **赢了守原位**：守军赢掷命后**不走留场前推·继续守原位不追击**（死守语义）。
> **实现建议**：给 `TurnUnit` 加 `hold?: boolean`（startFormation 守军置 true）→ advance/advanceColumnToBase/留场前推三处都 `if (u.hold) continue/skip`。**YAGNI**：当前只需 hold（守势）；将来若有攻势 boss 要"前压排阵兵"再加 advance 模式·现在不做。
> **「看得见≠会动」**（owner 点的细节）：守军是玩家"打/绕"的**情报**·不是逼近威胁。这正是守势难度的公平来源——你看得见、可避，但想破它家就得啃过这堵墙。

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

### REQ-G-碰撞才战斗（clash 触发改「落点踩敌」）+ 胜者推进占据 · [2026-07-03] · owner → 程序A(逻辑·已做)+程序B(表现) · Game G · status: **逻辑 done（程序A）/ 表演 open（程序B）** · 优先级: P1 · 类型: 战斗核触发规则修正
> **owner 2026-07-03**：clash 触发从「前锋相邻 gap≤1 即战」改成**碰撞才战**——牌移动时**这一步的落点格里有敌人才打**；落点是空格只走位不打（→ 玩家可**确定预测**「这步会不会撞」）。胜后（owner 选 A）：停敌前一格·**赢了推进占据敌人腾出的格**。
> **程序A 已实装（logic·done·本 session）**：① `advanceSideMove`——前锋自然落点(`slot+dir*speed`)踩到/越过敌前锋才 `pending` 掷命（守军 hold/主将 pin/过门兵不撞）；实际移动仍封顶在敌前一格。② `resolveClash`——胜者留场则 `wf.slot = 敌腾出格`（守军「赢守原位」`!hold` 除外·满连胜光荣回库除外）。测试锁定（落点空走位·踩敌才战·赢了前进）。tsc+vitest+build 全绿。
> **程序B 待做（表演·owner「一个单独的表演过程」）**：碰撞掷命毕的**生死+前进演出**——① 败者场上阵亡（斩两半·见上条 VFX）；② **胜者从「敌前一格」滑入「敌腾出的格」的前进动画**（逻辑瞬时改 `slot`→程序B 补插值滑动；旧位=敌前一格·新位=`lastClash` 后的场上兵 slot）。与掷骰特写收场衔接·全在真实场上兵位(锚 `u-<id>`)。

### REQ-G-谁打谁·战前锚场 + 战后场上标结果（对决可读性）· [2026-07-03] · owner → 程序B（表现·程序A 供数据·已足） · Game G · status: **①战前锚场 done + ②战后驻留徽标 done（2026-07-04）· 余：胜者滑入推进动画归 REQ-G-碰撞才战斗②** · 优先级: P1 · 类型: 演出可读性（非新数值）
> **程序B done（2026-07-04）**：① 战前锚场——`showClashCue` 已改板载锚点(环 `#u-<a.id>`/`#u-<b.id>` + 连线 + VS + 路名·我橙敌蓝·走 t3-timeline)，看清场上哪对要打（前 session 落地·commit 见 git log）。② 战后驻留徽标——留场胜者头顶飘现「⚔胜·连胜N」徽标锚真实兵位(`#u-<id>` 实时屏幕矩形)·**驻留 ~3s 再淡出**(补足旧对折飘字仅 1s 太快看不清·owner「可回看」)；纯 DOM 覆层·不动 tb/rng/turnHash·不churn golden。斩标(败者)走 tear VFX(同族·瞬时·败者已离场无牌可钉)。**余**：胜者「敌前一格→敌腾出格」的滑入推进位移动画——需在掷骰特写期间保持胜者显示在旧格(model/view 分离)·风险较高·归口到 `REQ-G-碰撞才战斗 §程序B②` 一并做。
> **owner 2026-07-03**：「现在看不清楚谁要打谁就开始了」+「结算完以后，把击退/结果标在牌型展示上·我知道谁打了谁」。现状 `showClashCue`（game-g.tsx:395）是**全屏 VS 弹窗**闪 ~2s——脱离真实棋盘、看不出是场上**哪两枚**在打；结算结果也只进特写框（owner 反复说「结算框看不清」）。
> **程序A 判断（本 session）**：这是纯**表现/演出**，逻辑侧数据已全出、无需程序A 新增——`advanceMovePhase` 返回的 `pending` 路 id = 战前哪几路要掷命、每路前锋两枚可由 `colOf(lane, a/b)[0]` 取；`lastClash`/`clashLog` 出 `a/b`(含 `id`)、`aWins`、`winStays`、`loserVacatedSlot`（胜者推进后的 slot 即在场上兵位上）。程序B 只读播、不改结果。
> **程序B 待做**：
> ① **战前·锚在真实棋盘**（替/补全屏弹窗）：移动相滑到位后，对每条 `pending` 路把**将交战的两枚场上兵**（锚 `u-<id>`）高亮/描边 + 二者之间画连线或悬「VS」标（我橙敌蓝·沿用 cue 配色），让 owner 一眼看出是**场上哪对**要打，再切/叠掷骰特写。全屏 VS 可保留作二级强调，但主可读性锚在场上。
> ② **战后·结果标在牌上**：掷命结算毕，胜者牌上钉「胜·推进/戴冠」、败者「斩/败」标（与 REQ-G-满仪式 §战场阵亡/胜利 VFX 同族·同一批做）；被击退/推进用场上滑动位移表达（见上条 REQ-G-碰撞才战斗 §程序B②）。标记短暂驻留可回看，不塞进结算框。
> **A/B 接口**：全在 `pending`(战前路 id) + `lastClash`/`clashLog`(战后 a/b/id/aWins/winStays/slot)。程序B 不需程序A 改逻辑。

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
> - **宿主底座**：`src/games/game-g/battle-timeline.ts` —— game-g 侧 t3-timeline 宿主（起只跑 timeline capability 的 World·逐帧 pump·把 cue 信号交表现层订阅自演）。支持并发多条 timeline + `delay(ticks,cb)`（单 cue timeline·替 setTimeout）。含并发/清理/复用测试（`battle-timeline.test.ts`）。
> - **已迁上 timeline 的演出拍**：① 战后生死（clash:slay 斩→survivor 对折→resume 续场）；② 行军慢放清标记（move:settle·连带修 760ms 打断 1.25s 动画的 bug）；③ 演出横幅 `showBanner` + 战前锚场 cue `showClashCue` 的延时 → `battleTl.delay`。表现层订阅信号自演（playGhost/浮层），回调不塞自由时序。
> - **UI 延时是否提新引擎能力**：程序B 评判**回驳**——manifesto §4「延时 N→回调」已被 `t3-timeline` 单 cue / `Timer` 原子覆盖，不新增；消费现成的（记此账避免 A 重提）。
> **A 接手余下（结构级·B 未动）**：`perfQueue/playPerf/advancePerf` **整套回合骨架退役** → 一整回合编排成主 `Timeline`（玩家门控点用点击桥接/skipOnSignal），advancePerf/playPerf 手写状态机删除。B 侧订阅模式已铺好（战后段即样板）可复用。**故意留 setTimeout 的三处**（非演出拍·别硬迁）：`flash` 提示条(需即时取消)、`startThinking`(有意随机时长)、`doClashRoll` 数字滚(多帧 tick·宜 Label.tween 另议)。
> **另·战斗核越界记账**：斯巴达方阵「改真·每兵+战力」（`turn-combat.ts` phalanxPower·本属 A 战斗域）owner 当场明授权 B 改·已交全绿——请 A 知悉该 sim 改动（每兵吃方阵总加成略增·owner 已拍板）。

> 【衔接备忘 2026-07-03】P3D 的 game-d 接线单（REQ-GAMED：dice-roll 接入/detectPattern 真替换/per-run 种子/打回三条）同样为**排队态**——接现 3D 渲染线核心工作完成后开工，优先级由 owner 调度。
---

### REQ-G-动作模型-三行为自由 · [2026-07-03] · design G → 程序A(逻辑+AI)+程序B(UI) · Game G · status: **逻辑+AI done ／ 程序B 三行为 UI done（2026-07-04）** · 优先级: **P0（owner 拍板·核心回合模型改·压 sim/标定）** · 规格: `design/24-turn-based-combat-model.md §二`
> **注（2026-07-04 程序A）**：`discardCard`(弃牌返0.5源泉) 仍在（game-g.tsx:594 玩家UI + player-ai 标 `void`未进搜索）——这**不是**本单要退役的"免费纯弃牌"(那个已被 swap 取代)，是另一条 0.5 返费续航微操，是否保留/进 AI 搜索归 design G 裁决。
> **程序B done（2026-07-04·三行为 UI）**：动作菜单 4 键 → **抽/打/换 三区**（顶钮 grid cols=3·互不互斥·不再据 actionTaken 置灰）；点开哪个 → 右侧子菜单二选一各显源泉开销（抽扑克/抽天罡 各 💧1 · 部署扑克 💧按点/打天罡 💧1 · 补扑克/补天罡 免费）。换牌=选补牌库→点手里1张→弃并随机补1张(免费·1/回合·用尽后顶钮/子钮置灰·再点提示已用尽)。走 LayoutNode 底座(Button 闭集·label 内嵌开销文案·零手写 CSS/DOM)；battle-coach 文案/锚点同步(打天罡=combat-cast·部署扑克=combat-deploy·未点开回退顶钮)；旧四选一互斥+纯弃牌 UI 退役。tsc+vitest(183)+build 全绿·playwright 四态截图验收。`discardCard` 玩家 UI 入口本次由「换」取代移除(逻辑导出留存待 design G 裁 AI 侧)。

> **owner 2026-07-03**：四选一 + 「放牌⊥打天罡」互斥限制太多、策略性一般 → 改 **三行为（抽/打/换）· 互不互斥 · 源泉唯一门**（源泉本就稀缺=天然闸·不必再叠动作互斥）。
> **程序A（逻辑）**：
> 1. **去掉动作大类互斥**：`canAct`/`actionTaken` 退役"本回合只能一类"锁——`抽(天罡/扑克)`、`打(天罡/部署扑克)` 一回合内**任意混、只要 `mana≥cost`**；攒源泉留后手照旧。
> 2. **换牌 = 新动作**：选中手牌 1 张 → 弃 + 从选定牌库(天罡/扑克)**随机补 1 张** → **`SWAP_PER_TURN=1`（硬帽·破无限churn死循环）· `SWAP_COST=0`（免费）**。旧"免费纯弃牌"退役（被换取代）。
> 3. **更新终极 Player-AI 动作枚举**（`player-ai.ts`）：候选动作集 = 抽/打自由混 + 换(1/回合) → 前向搜索按新合法动作枚举（这直接改变 sim 胜率·见下）。
> 4. 确定性：turnHash 回归照绿（换牌消费 rng 抽替换牌·顺序固定）。
> **程序B（表现/UI·走引擎 UI 基座·别手写）**：动作菜单从 4 键 → **抽 / 打 / 换 三区**：点抽/打 → 右侧子菜单高亮（抽天罡·抽扑克 / 打天罡·部署扑克）**各显源泉开销**；换牌 = 选中一张手牌触发（1/回合·免费·用完置灰）。查 `docs/playbooks/index.md` UI 线 + 交付前 `check-ui`。
> **未来（不现做·记池）**：换牌成本可由 Boss 地煞按关加税/上锁（`swapTax`/`swapLock`·明牌杠杆·见 `disha-native-power-redesign §三·五`）。
> ⚠ **design G 重算连带**：动作模型变 → 现关1 调参曲线（贪心11%→终极51%·~70%@bossDelta−8）**作废**；程序A 更新 AI 枚举后 **design G 用终极 AI 重扫关1 标定**。玩家自由度↑ → 大概率更强 → 关1 胜率上移。

> 【程序B 附注 2026-07-03】我原拟提「通用 Timeline 演出组件」——rebase 发现**主程已下沉 `t3-timeline`**（上条 REQ-G-演出迁时间线 + tick 制确定性 cue 调度器）→ 我的请求**冗余撤回**。game-g 战斗清晰度演出（移动 g-march 浮起落下已落地 + 待做的战前配对高亮/战后斩·冠场上 VFX）**改走 `t3-timeline`**（owner「用 timeline 底座·不手写」）——与 REQ-G-演出迁时间线（指派程序A）自然衔接，我这边表现层订阅 timeline 信号自演。

---

### REQ-G-退役机关门 + Boss自由混 · [2026-07-03] · design G → 程序A(逻辑+AI)·程序B(删门UI) · Game G · status: **逻辑 done（程序A 2026-07-04 核实：门整套已删·turnHash 无 g 段·城门令出池 36→35·aiDecide 已同规则自由混无门决策·Boss 无换牌·player-ai 无门枚举·turn-combat/turnmatch 20 测绿）／ 程序B 删门UI open ／ **design G 关1重标 ✅ done（2026-07-04·核变后 bossDelta=0 稳在 73.5% 通关/95.5% 单场·对称改没偏心公平点·见 boss-config §一末「✅✅ 核心大改后重标」）·终扫待 loader 接 16写死牌组** · 优先级: **P0（owner 拍板·地基清理·解锁关1对称标定）** · 规格: `design/24-turn-based-combat-model.md §三` + `balance-philosophy-fairness.md §五`
> **程序B 待清（门 UI 死引用·2026-07-04 程序A 巡出）**：`turn-battle-screen.ts:705`（放牌后翻门 toast）+ `:789`（deploy sub-label「放完可点机关门翻门调度」）· `overlays.ts:35/41`（帮助文案「可顺手开关机关门 / 机关门换路」）· `sound.ts:14-15`（`gateOpen`/`gateClose` 死音效定义）· `campaign-data.ts:80` 注释（无害）。逻辑侧已无门·这些仅残留表现文案/死音效·程序B 一并清。

> **owner 2026-07-03 两条**：① **机关门/换路整套退役**（不给乐趣·高复杂度低价值·旧实时CR遗留）；② **Boss 也一开始就自由混**（对称同规则·Boss 无换牌·难度只来自明牌 kit·不靠给 Boss 降规则）。
> **程序A（逻辑）**：
> 1. **砍机关门整套**：删 `turn-combat.ts` 的 `GATES`/`gatesOpen`/`gateMove`/`toggleGate`/`tryGate` + `advanceBoth` 里门分流(diverted) + `deployUnit` 的 `gateToggle` 参数 + `turnHash` 的 `g<gates>` 段；**天罡「城门令」从 36 池摘除**（或标退役·`game-g-build`/天罡数据）；AI(`aiDecide`) 去掉开/关门决策；`player-ai.ts` 去掉门相关枚举。清理相关测试/golden（有意行为改变·报告说明）。
> 2. **Boss 也自由混**：`aiDecide`/`aiTakeTurn` 去掉"每回合单大类"的稳定基线限制（你上轮注释标的开关）→ **Boss 与玩家同规则自由混 抽/打**。**Boss 无换牌**（换牌是玩家专属 QoL·别给 Boss）。
> 3. **确定性**：turnHash 回归照绿（删门段是有意改变·更新断言）。
> **程序B**：删战斗屏的机关门 UI（门钮/门态渲染）。
> ⚠ **design G 连带**：Boss 自由混后关1 公平配置从 54%→~14%（Boss kit 值 ~36 分）→ **design G 用"双方自由混"重跑·把关1 Boss kit（布防 4→2静守 + 地煞 + 牌力偏置）减弱到玩家 ~70%**（教学关本就该弱·见 `balance-philosophy-fairness §五`）。**程序A 改完 → design G 标定。**
> **✅ design G 标定回填（2026-07-04）**：实测**对称核变没把公平点推离 70%**——`bossDelta=0` 时终极 AI 通关 **73.5%**（≈70% 目标）·无需减弱 Boss kit。原估「Boss 自由混→14%」是**旧口径误判**（那 14% 是 sim 的 Boss暗箱强牌 bug 所致·已由 `f9727ae5` 修·非 Boss 自由混本身）。**遗留待 owner 拍**：贪心真新手通关仅 24%（5战全胜复利·单场 78%）→ 关1 是否该 5 战 / 目标是否改按单场量（详 boss-config §一）。

---

### REQ-G-战功系统 · [2026-07-03] · design G → 程序A(逻辑·钩子+modifier)·save(save-port)·程序B(收藏屏可视) · Game G · status: **排队（收藏打磨·核心战斗稳后开工）** · 优先级: P2 · 类型: 真缺口→下沉通用"老兵/资历里程碑"能力 · 规格: `design/veteran-merit-战功.md`

> **owner 2026-07-03**：战功系统——每张收藏牌隐藏累计"战场战胜次数"(kills·增收藏属性)；**kills≥108 → 战力永久+1**（108=天罡36+地煞72=水浒星宿·非拍脑袋）。
> **CORE RULE**：接受·收藏情感钩子 + "用出来的强"养成轴（区别地支/deckBias 的货币养成）。**数据驱动·不写专属码**——三块现成拼：① 每牌持久 `kills` Resource（存档·`services/save`）② `resolveClash` 胜者 kills++ 事件钩子（小·确定性）③ 满108→+1战力 复用 `t2-modifier-stack`（`{target:战力,op:add,value:1,gate:kills≥108}`）。= 通用"任意牌·累计任意事件·到阈值触发修正"系统。
> **决策（owner OK）**：战场HUD不显·收藏界面可看；先单里程碑108(阶梯后续可选)；仅玩家收藏牌累计(Boss每关新16牌不累)。
> **平衡**：慢(108杀≈25-35场/牌)+小(+1战力)=温和creep·sim当一档养成favor建模·真奖励是荣誉/收藏故事。
> **排队**：与战斗核正交·排核心(动作模型/AOE/经济/玩家AI)拍死后开工·别往正动的地基加零件。

---

### REQ-G-天罡原生重构 · [2026-07-04] · design G → 程序A(TENGANG_OPS/改掷层)·程序B(AOE演出) · Game G · status: **进行中（程序A）：片A 锋矢修 ✅ / 片B 掷骰系改掷层 ✅ / 片C 零效果op 部分·⚠见目标机制 / 片D 退役 待 / 片E AOE 待** · 优先级: **P1（核心大改后天罡大面积失效·出货前空头卡清零）** · 规格: `design/tiangang-native-redesign.md`
> **✅ 片A（§四.4·程序A 2026-07-04）**：锋矢 arrowhead `filter:'front'` 旧描述子没认→误落全军+4·修成只前锋。**✅ 片B（§四.1+2·程序A 2026-07-04）**：掷骰系改掷层——鬼手改掷+2/磐石掷下界+2/灌铅骰掷两次取高/铁骰占优必胜；clash-resolve 加 `rollWithMods`+`rollDist`+`rollWinProbMods`(mods 全零逐字等于旧 rollWinProb)；删 logistic 死字段 winFloor/kHard/noUpset·加 rollBonus/rollFloor/rollTwice/autoWinGE；接进 resolveClash(实掷+占优必胜短路)/clashOdds(预报)/resolveClashEV(AI EV)→预报与 AI 都反映改掷；tiangang-data kind 'odds'→'roll'。测试全绿(2261)。
> **⚠️ 片C 目标机制（owner 2026-07-04 裁：走玩家选路·否决自动目标）**：§四.3 的 6 个 op 里 **4 个需玩家「选哪一路」**——疾行(该路 speed+1)/泥沼(敌该路减速)/驰援(指定路+2兵)/舍车(弃一路补两路)。**owner 拍板：不能自动选·必须玩家选路。** → 需**选路机制**：程序A 出 `castTengangAt(b,side,handIdx,lane)` + 每路效果应用（即时型驰援/舍车 + 持久每路型疾行/泥沼→需 per-lane 状态）；程序B 出**点路 UI**（选中目标类天罡→高亮可选路→玩家点路→施放）。**A+B 协同·另立选路子任务。**
> **✅ 擒王 done（程序A 2026-07-04·f0832bcd·无目标 op）**：斩敌主将→该路敌全溃（clash 钩子·TengangFx killGeneralRout·测试绿）。**⬜ 铁索（敌全军减速·无目标·需 slow 机制）+ 4 个目标 op（待选路机制）待续。**
> **✅ GD 补细节完毕（owner 对齐 2026-07-04·见 `REQ-G-天罡目标op机制对齐` 答复 + tiangang-native-redesign §四·补）**：时长=混合（疾行/泥沼/驰援/舍车即时·仅铁索持久N=2回合→**程序A 不必全建 laneFx·只铁索一个全局倒计时**）；疾行=我该路即时+1格；泥沼=敌该路本回合不推进；铁索=敌全军speed−1(下限1)持续2回合；驰援=+2固定援兵(战力3无将·落部署格·不掏牌库)；舍车=弃一路回库+另两路当前兵各+X战力(快照烙兵身·+X起标8待sim)。**片C 解锁·程序A 可开工。**
> **调试功能（owner 2026-07-04·顺带）**：程序A 已交逻辑钩子 `debugGrantTengang`/`debugAddMana` + dev 控制台全局 `__ggDebug`（.grant(id)/.mana(n)/.list()·战斗屏控制台即用·测新天罡/无限操作）。**正规「调试菜单」可视 UI 归程序B**（见 REQ-G-调试菜单）。

### REQ-G-天罡目标op机制对齐（程序A → design G·施工前必答）· [2026-07-04] · 程序A → design G · Game G · status: **✅ 已答（design G + owner 对齐 2026-07-04·定案入 `design/tiangang-native-redesign.md §四·补`）** · 优先级: **P1（阻塞天罡原生重构 片C 的 5 个 op）** · 规格补充: `design/tiangang-native-redesign.md §四.3 + §四·补`
> **✅ design G 答复（owner 对齐 2026-07-04·5 op 机制/数值全钉死·详见 tiangang-native-redesign §四·补）**：
> - **时长模型 = 混合**（owner 拍板）：**疾行/泥沼/驰援/舍车 = 即时一次性**（无持久状态·契合"操作前置·掷骰执命"哲学·消掉 laneFx 状态机·更确定性防雪球）；**仅铁索 = 持久**（epic 全军减速墙·带 N 回合全局倒计时·单值非每路状态）。**叠加**：即时类天然叠加棋盘封顶·无需 cap；铁索刷新时长不叠深。
> - **① 疾行**：我该路兵即时 +1格推进（epic 可 +2）。**② 泥沼**：敌该路本回合不推进（跳过 advance·单路即时）。**③ 铁索**：敌全军 speed−1（下限1）持续 N=2回合（param·epic）。**④ 驰援**：指定路 +2 固定援兵（战力3·无将·无buff·落部署格·只花天罡cost·不掏牌库·不额外源泉；兵数/战力 param）。**⑤ 舍车**：弃一路→**回牌库**（复用人面/破家回库·非销毁）+ 另两路当前兵各 +X战力（施放瞬间快照·烙兵身·永久随兵·不需 laneFx）；**+X 起标 +8·待 GD sim**。
> - **程序A 可开工片C**：`castTengangAt(b,side,handIdx,lane)` 即时类立即应用 + 铁索全局倒计时 fx；点路 UI 归程序B。数值（舍车+X/驰援体量/铁索N）落地后 GD sim 复核。
> **背景**：天罡原生重构 §四.3 的 5 个 op 设计意图是高层文案，**机制/数值未钉死 → 程序A 无法确定性实装**（否则=模糊数据/我替策划拍脑袋）。owner 2026-07-04 已定「目标类走玩家选路·不自动」。请 design G 逐条拍板（每条给了工程建议·选一个或改）：
>
> **通用问题（先定·影响状态设计）**：
> - **持续时长**：这些效果是 **①本回合限** / **②持续 N 回合** / **③整局持久**？（程序A 建议：疾行/泥沼=整局持久按路挂；驰援/舍车=即时一次性。混合最合理。）
> - **叠加**：同一路施两张疾行 → 叠加(speed+2) 还是不叠(封顶+1)？（建议：叠加但设上限·防爆炸。）
>
> **① 疾行 swiftmarch（该路 speed+1·抢攻）**：
> - speed+1 作用于**该路现有兵 + 后续入场兵**（按路挂）还是只当前兵？（建议：按路挂·现有+后续都吃。）
> - speed 机制已在（`unit.speed`）→ 直接给该路 units speed+1。**要 design G 确认：+1 够不够抢攻·还是要+2。**
>
> **② 泥沼 mire（敌该路减速）/ 铁索 ironchain（敌全军减速·epic）**：
> - 「减速」= **①speed−1（下限 1·永远能走 1 格）** / **②隔回合推进（该路敌每两回合才动一次）**？（建议：①speed−1 更简单可控·②隔回合更狠但要计回合状态。）design G 定哪种 + 泥沼(单路)/铁索(全军) 数值同不同。
>
> **③ 驰援 rush（指定路凭空+2兵）**：
> - +2 兵是**什么兵**？(a) 固定低值援兵(如 rank 3·无 buff·无 general)　(b) 从我牌库顶抽 2 张即时上场　(c) 定义一种"援兵"token(固定战力)。（建议：(a) 固定援兵最可控·不掏牌库不破经济。）
> - 落在哪个格？（建议：我方部署格 slot 0 起·同 deployUnit 落位。）花不花额外源泉？（建议：只花天罡本身 cost·凭空=不额外。）
>
> **④ 舍车 discard2（弃一路·另两路各+10战力·田忌）**：
> - 「弃一路」= 那路我方兵 **①回牌库(可再抽再上·同破家/人面回库)** / **②销毁(彻底移除)**？（建议：①回库·符合"舍"非"毁"·且经济友好。）
> - 「另两路+10战力」= 作用于**两路现有兵**还是**含后续入场**？持久还是本场？（建议：按路挂持久·现有+后续都 +10·与疾行同状态模型。）
>
> **答完后 → 程序A 落地**：`castTengangAt(b,side,handIdx,lane)` + per-lane 效果状态（`laneFx`）；铁索(无目标)可先做。点路 UI 归程序B（另接）。

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
