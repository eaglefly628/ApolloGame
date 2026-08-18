# game-c《六人德州》· 游戏级需求单（工单随游戏走 · 不占引擎池槽）

> 号段从 **REQ-C-101** 起编（旧作遗留 REQ-C-001~004 已归档，防撞号）。
> 引擎池（`docs/workflow/requests.md`）现 10/10 满；本表条目待 Lead/owner 认为值得升格时再进池。
> 备注：原拟 REQ-C-101（摊牌比较）/102（下注圈边池）/103（行为树）三条引擎下沉单，
> 依 owner 2026-07-17「本项目允许 TS」口径**撤单**——转为 game-c 内 TS 模块（`capability-plan.md` §4-a/b/c），
> 攒出第二消费方再议下沉。
>
> **⚖ Lead 复裁 · 三条结案（owner 2026-07-23「哪些要做·给决定」）**：
> - **103 行为树 = ✅ 已下沉完结**：引擎 `t2-behavior-tree`（`0c021546`）·第二消费方 game-b 三姨太 AI 真消费（rule-of-two 达成才下沉的正例）；game-c 自选轻量 `aiDecide` 启发式·未用 BT（合法·不强迁）。无活。
> - **101 摊牌评估（`holdem-eval.ts` 129 行）/ 102 下注圈边池（`betting-engine.ts` 367 行）= 不下沉·留 game-c TS**：实测无第二方 `import`（`grep` 全库仅 game-c 引用）·德州是唯一扑克游戏——owner 复核 game-a 掼蛋（`t3-hand-pattern` 域）/ game-b 麻将（yaku 域）玩法与扑克摊牌/下注**无关**，非第二消费方；owner 明示「只复刻核心玩法·暂不引入博彩工具箱」。引擎不为单消费方擅宽（manifesto §4·Lead 带理由回驳）。**真出现第二个扑克/下注游戏再下沉**。
> - **三条不再挂起**（103 完结 / 101·102 定居 game-c TS·rule-of-two 触发器已记）。

## 待处理

### REQ-C-119 · [2026-08-05] · REQ-ARTPIPE2 A1 台账守卫实测发现 · 死账：art-017 加注按钮皮台账行 `gen.servedPath` 指向不存在文件 · 指派：PA · status: open · 优先级: P3（不阻玩法·台账诚实性债务） · 类型: 资产账务清理（PA 域）
> `art-ledger.json` art-017（`game-c/ui/btn-raise` 加注按钮皮）现 `status:'replaced'`、`gen.servedPath` 指 `/games/game-c/art/gen/art-017-up.png`（owner 上传替换），但该文件磁盘不存在——`ref.servedPath` 指的原程序化占位 `/games/game-c/art/ui/btn-raise.svg` **仍在盘上**（游戏实际很可能还在吃这张占位图）。`node scripts/art-ledger-guard.mjs` 判定为「死账」（行的当前真相路径无文件）。**修法二选一**：① 找回/重新上传该按钮皮真图落到 `gen.servedPath` 指的路径；② 行状态回退为 `placeholder`（`gen.servedPath` 改指仍在盘的 `ref.servedPath` 或清空），如实反映「替换从未真正落盘」。REQ-ARTPIPE2 A1 侦察在案·不在本轮修（A1 域=守卫工具本身，不改各游戏台账内容）。

### REQ-C-116 · [2026-07-23] · 巡检发现 · vendor.test 分解式断言 37 条 vs 索引实有 44（owner 本地美术推送未同步测试·REQ-C-111 同款二犯） · status: ✅ **done（Lead 当场清·owner 2026-07-23「把红修复」在场授权）** · 优先级: **P1（阻全量测试·当日清）** · 类型: 资产对账同步（PE 域）
> 巡检实证：owner 从本地推美术（`c8b65550`·game-c ledger+index +7 条）→ `vendor.test.ts`「37=9+28」失败（expected 44 to be 37）。
> **✅ Lead 处置（2026-07-23·owner 在场「把它修复」授权·非自动巡检的 hands-off）**：新 7 条 = 6 真上传（`gen/art-001/002/017-up`+`game-c/{scene/backdrop,table/felt-albedo,ui/btn-raise}`·generator:upload）+ **1 悬空 mock（`gen/mock/art-002`·文件 gitignored·qwen mock）**。① 删悬空 mock 条 → index 43 条；② vendor.test 改**三类分解断言**：9 vendor 筹码 + 28 程序生成（game-c-art-gen）+ 6 owner 上传（upload）=43·三类无缝覆盖全体·+「无 card/*·无 mock」护栏。全量 vitest 绿。**根因同 A-025**：mock 按设计留本地 index 供墙预览、但不该随 index.json 提交——护栏已由 vendor.test「无 mock」承接。

### REQ-C-115 · 迁移 GameEvent 日志到引擎共享 event-log 原子 · [2026-07-23] · Lead 落单（REQ-EVENTLOG 下沉完工）→ **PE-C** · status: open · P3（DRY 收敛·非阻塞·功能等价） · 类型: 游戏层消费迁移（PE-C 域）
> **背景**：REQ-EVENTLOG 已下沉引擎通用 `src/skills/tier1/event-log.ts`（`EventLog<K, Extra>` 泛型类 + `createEventLog()`·`push`(自增 seq)/`recent`/`all`/`size`/`clear`/`dump`）。game-c `game-log.ts` 的手写 `GameEvent` 流是 rule-of-two 的一半，迁移收敛 DRY。
> **活**：game-c `game-log.ts` 的 `GameEvent{seq,tag,text}` 事件流→改用 `EventLog<GameTag>`（`import { EventLog } from '@skills/tier1/index.js'`；注：本核类别字段名为 `kind`，game-c 现用 `tag`——迁移时把 `tag` 归一为 `kind` 或在薄封装里 `tag→kind` 映射，公开 `describeAction`/日志格式器口径保持不变）。`seq` 自增交给核·本地不再手维护 `n`。**验收**：`game-log.test.ts` 零回归（同 seed 逐条日志一致断言不变）；`describeAction` 等格式器 + 消费方（HUD 日志面板/万手 sim replay）字节等价。**功能等价·可暂缓**（不阻玩法/S4）。
> **owner 指令**：牌桌右上角一个**菜单键**（平时收起）·点开露三项：① **设置**（关音乐等）② **游戏说明/菜单说明**（玩法帮助）③ **日志**。三项收在一个菜单键里。
> **评判（大半是重组现成件·非缺口）**：① 音乐=现有 `sound_toggle`+`muted`；③ 日志=现有 `toggle_log`+`buildLogPanel`——直接归拢进菜单；② 游戏说明=新增一个帮助面板（LayoutNode 纯数据文案·EN/ZH i18n）。菜单键+下拉/面板=game-c HUD 组合（`buildStoryTopBar` 右侧加菜单键→`menu_toggle` 开一个 `Panel` 列三项·`check-ui` 防重叠）。**用基座 LayoutNode·不手写**。做完 check-ui + 门禁。
> **回执（PE-C 2026-07-22）**：顶带右侧加 `☰` 键（`menu_toggle`）→ `buildTopMenu` 下拉 `Panel` 列三项：① 音乐开关复用 `sound_toggle`（标签随 `muted` 切 🔊/🔇·下拉不收让玩家见状态变化）② `help_toggle` 开新 `buildHelpPanel`（双语规则速览·目标/一手牌/下注/典当续命/公平确定性五段·`Divider`+`✕` 关）③ `toggle_log` 复用现有日志面板。全 LayoutNode 纯数据·`validateLayoutNode` 零 issue（hud.test 增 REQ-C-114 例·showMenu/showHelp/muted 三态）·四态无头渲染目击（EN/ZH 下拉 + 双语说明面板）。tsc 0 · game-c vitest 133 绿 · build 0。

### REQ-C-113 · 美术**全量**走索引消费（工坊替换才生效·owner「全部重改」）· [2026-07-22] · owner 报（背幕已通·余下全改）→ Lead 落单 → **PE-C** · status: **🔶 大半接完（背幕/呢面/木栏/筹码/衣柜图标/次级按钮/fx·PE-C 2026-07-22）；余：主行动键=PUI·betline=P3D·牌面=已移出（native）** · 优先级: P2（承 REQ-C-112·美术生产链尾·不阻玩法）· 类型: 游戏层美术消费接线（PE-C 域）
> **✅ 回执（PE-C 2026-07-22·第二/三批·端到端目击）**：承背幕样板逐类接消费槽（各带回退兜底·真图未到观感近零变）——
> - **呢面/木栏**=`Material3D.map`（`build3d.ts`+`game-c.ts` `AssetManager`）；**衣柜图标**=`Image`/emoji；**次级按钮**（Button·kind）=主题 `buttonSkins`（e50f08d3）。
> - **筹码**=`chip3d.ts` 每枚顶盖 `Material3D.map`（`chip/<denom>-<color>`·vendored 真图**即上**·顶枚贴图限 PBR 网格数）——**目击筹码面数字上顶**。**fx**=`game-c.ts` `spawnFx` 瞬时 `Billboard3D.tex`（deal-glow/allin-flash/pot-shine/win-burst·`fx/*` 真图 filled 即上·朝相机正确）——**目击 deal-glow 触发**。贴图迟到加 `renderer.invalidate()` 兜底（REQ-3D-资产就绪自动重渲）。
> - **完工判据①** `ledger-audit --strict` 孤儿=0 ✅（REQ-C-112 补 skinKey 达成）；**②** 工坊换任一→游戏即显：背幕/呢面/筹码 三类端到端目击 ✅（≥2 达标）；**③** 门禁绿·零回归 ✅。
> **余下卡外域**：① **主行动键 弃/跟/加/All-in**=复合 Panel·`Panel` 无贴图槽→报 **PUI `REQ-PANELSKIN`**（owner 已同意·art-018 btn-raise 即卡此）；② **betline 下注线**=可换真图的平贴+alpha 贴花闭集缺件→报 **P3D `REQ-3D-DECAL-TEX`**（现程序化金环 `Decal3D{ring}` 占位）；③ **牌面**=owner 已定 native 自绘（不入台账·REQ-C-111）。
> **owner 指令（2026-07-22）**：game-c 的美术**全部重改**成「可消费槽」——不止背幕（REQ-C-112 已接），筹码/牌面/呢面/木栏/贴花等**逐行**都要能被工坊替换后真上画面。
> **现状**：背幕已走 `art-overrides.ts` 的 skinKey 索引解析（`fetch art/index.json` + `renderer.setBackgroundTexture(backdropUri())` 热替换·PE-C `f89baa97`）——**此模式=样板**，把它推广到全部 37 行。`npm run ledger:audit game-c` 看当前孤儿数（REQ-C-112 后应已降·余数即本单目标→0）。
> **黑色地板遮挡（owner「德州黑色地板挡住·移去了」）**：`build3d.ts:59` 注释已定位——有面「完全遮住 setBackgroundTexture 场景背幕」的地板/元素（夜景背幕/工坊生成图被压在下面看不见=owner 报「生成写不回」的**表现根因之一**）。owner 称已移去→**PE-C 复核**：背幕真图就绪后确实上画面（真浏览器目击），别被别的 mesh 再遮。
> **修法**：逐行接 skinKey 索引消费（承背幕样板）——2D 图走 `filledSrc(index, skinKey)`（`src/assets/asset-index.ts`），3D 场景纹理走既有 `setBackgroundTexture` 热替换；程序化背景（`theme.ts` 渐变）如仍走宿主层→用 `mountHost` `sceneBgSkin` 槽（REQ-ART ② 已 done·有图叠图/无图回退）。无用行退役、别留台本。
> **⚠ 附带发现·台账 query 塞满场景词（owner 2026-07-22 实测「呢面贴图生成了整个房间+凳子+牌」）**：贴图/材质行的 `query` 被灌进整套 house-style 场景词——如 art-002 呢面 query=`purple velvet poker felt cloth …, luxury night poker parlor, violet-and-gold noir, cinematic rim light, moody purple palette(#…), painterly premium mobile-game art …`。texture 行 query 该**只描述材质本身**（`purple velvet felt, seamless tileable, flat top-down, fine woven nap`），场景/画风交风格包 base（Lead 已按 kind 分层：texture/UI 走 uiPrompt 无场景）。**根因**：row.prompt 空时 dialectPrompt 回退到 query→场景词上位（felt 的 clean prompt「呢面 albedo·紫绒+暖光池」在时产出正确·实证）。**PE-C 顺手**：把 texture/material 行 query 去场景化（只留材质词），或确保这些行有干净 prompt。（引擎侧 kind 分层已 done·commit f683c961。）
> **完工判据**：① `npm run ledger:audit game-c --strict` 孤儿归零；② 工坊替换任一 game-c 美术（筹码/牌面/背幕）→游戏即显（真浏览器亲验≥2 类·背幕不被地板遮）；③ game-c 测零回归·门禁绿。
> **边界**：game-c 游戏代码=PE-C 域；引擎件（`filledSrc`+`sceneBgSkin`+`ledger-audit`+`setBackgroundTexture`）已 done、直接消费。

### REQ-C-112 · [owner 2026-07-22 实测] 生成的场景美术「无法写回游戏」——37 行素坯无 skinKey·游戏无消费槽 · 提出人 owner（工坊真调 Seedream 出图后）→ Lead 诊断落单 → 指派 PE-C · status: ✅ **裁定=要·背幕槽已接（PE-C 2026-07-22）·余槽 follow-on** · 优先级: P2（美术生产链尾·不阻塞玩法/S4）· 类型: 游戏层美术消费接线（PE-C 域·game-c.ts/theme.ts/blueprint）
> **owner 实测现象**：Seedream 真调已通、生成成功；但 game-c 美术库里那些 `art-001~037` 场景图**写不回游戏**（生成物落 `public/games/game-c/art/gen/art-NN.png` + 登记 `gen/art-NN`，但游戏里看不到）。
> **Lead 诊断（根因·非管线 bug）**：① game-c 是编译期游戏（无 manifest）→「⤵ 写回 manifest（数据卡带）」按钮不适用（会报错）。② 编译期游戏的写回靠 **skinKey 别名**（`art-replace` 生成时 `if(row.skinKey) 登记别名 id=skinKey` → 游戏按 skinKey resolve 上画面）——但 game-c 台账 **37 行全部 `skinKey:null`**，故生成物无游戏侧消费槽。③ game-c 背景是 `theme.ts` **程序化画的**（紫黑渐变+落地窗+暖光池·照 .dc.html 设计稿逐层复刻），**不是图片槽**；牌面/筹码是 vendor 直引（`PlayingCard.art`·工作正常）。所以这 37 张素坯是"悬空"行·游戏没有任何地方引用。
> **⚖ 先裁设计岔口（PE-C/GD-C 定·别直接接线）**：game-c **到底要不要用生成的场景图**？
> - **不要**（程序化背景=终稿·照稿复刻已达标）→ 那 37 行素坯是**过早生成**·退役或标「仅目录/平台墙预览·不进游戏」·本单收口（零游戏代码改动）。
> - **要**（想用生成图当背景/场景元素）→ PE-C 加消费槽：给相关台账行配 skinKey + game-c 场景层改成「有生成图用生成图·无则回退现程序化背景」（如 mountHost sceneBackground 吃 skin），并回填 gdd 美术规格。**红线**：不删现程序化背景兜底·render-only·蓝图/确定性零影响。
> **关联**：同源于 REQ-C-111（PE-C 07-22 已清的 vendor.test 红=28 素坯塞索引未接游戏）——素坯"生成了但没接"是同一问题的两面。建议 PE-C 与 GD-C 一并厘清 game-c 美术消费规范（哪些槽真进游戏）。
> **非管线 bug 声明（Lead）**：工坊/art-replace/写回机制本身工作正常（对数据卡带 manifest 路 + 编译期 skinKey 路都通）；game-c 缺的是**游戏侧消费接线**，属 game-c 游戏代码=PE-C 域。owner 已知情选「派 PE-C」（2026-07-22）。
>
> **⚖ PE-C 裁定＝要（2026-07-22·owner「处理这个需求」）**：owner 全程诉求=生成美术要能上画（「无限逼近」「AI 出图」「所有能替换的全列出来」），故**接消费槽**（数据接口=skinKey 别名·manifesto 合规）而非退役素坯；且带程序化兜底=**纯期权上行**（无真图→观感与现在逐字节一致；有真图→热替换），无任何回归风险，正合 Lead 红线。**不选「不要」**：那会与 owner 明确方向相悖，且素坯已生成、退役=浪费。
> **✅ 回执（PE-C 2026-07-22·背幕槽落地 + 全库 skinKey 补齐）**：
> - **根因两处齐修**：① `scripts/game-c-art-ledger.mjs` `add()` 补发**顶层 `skinKey` 字段**（原只落 `gen.localId`/`placeholder.instances`·故 art-replace 的 `if(row.skinKey)` 从不触发＝37 行全 null 的真因）——重跑后 37 行全带 skinKey·唯一（28 生成槽 `game-c/*` + 9 vendor 筹码 `chip/*`）。② `games/game-c/art-overrides.ts`（新·mirror game-g `art-textures`）：覆盖注册表 + `backdropUri()=textureOverrideUri('game-c/scene/backdrop') ?? STORY_BACKDROP` + `loadArtOverrides()`（**只收 `game-c/` 命名空间 + 正向 AI 信号** source `gen:`/`vendored` 或 tags `skin`·程序占位 `scene/backdrop` 因 id 无前缀+无顶层 source 天然不进）。`game-c.ts:57` 背幕改走 `backdropUri()` + mount 期异步拉索引热替换（disposed 守卫·headless 无 fetch 空安全）。
> - **验证**：art-overrides.test 6 例（无覆盖=STORY_BACKDROP 回退 / 登记即换 / headless 空安全 / 37 行 skinKey 全带唯一 / 命名空间分布 / 背幕 art-001）；合成索引端到端跑通=真 AI 别名 `game-c/scene/backdrop` 被收、程序占位 `scene/backdrop` 与 vendor `chip/1-white` 正确排除、`backdropUri()` 热切到 gen PNG。tsc+game-c vitest 132 例全绿。
> - **follow-on（同模式·各自 `xxxUri()` 消费点·art-bible §5.1 登记）**：`game-c/table/felt-albedo|rail-albedo`→`Material3D.map`（**P3D 域·改前知会 P3D**）；`game-c/ui/btn-*`→`buttonSkins`（PUI 提供皮机制·PE-C 接键·owner「按钮变贴图」）；`game-c/icon/wear-*`→衣柜 `Image.src`（现 emoji）；`game-c/fx/*`→`Vfx3D`（未接）。均非阻塞·owner 排期再接。
> - **GD-C 协同**：美术消费规范（哪些槽真进游戏）已在 art-bible §5.1 落档·背幕为首个 live 样板；余槽接线随各消费点 follow-on。
> **⚠ 交付前端到端目击补修（PE-C 2026-07-22·owner「先试背景」前自测）**：真跑 vite preview + 注入测试图跑通链路——控制台确认 fetch→过滤→`setBackgroundTexture(gen)` 三步全触发，但**背幕屏上无变化**。根因=`build3d.ts` 那块 16×12 不透明暗地板在陡俯视下铺满全屏、把 `setBackgroundTexture` 的场景背幕整个压在下面（**这才是 owner「场景图写不回游戏」看不见的最终表现根因·skinKey 只是链路前半**）。**修**：拿掉地板（owner A/B 目击拍板·纯 render-only·地板本无 RigidBody3D·筹码落呢面）→ 背幕（程序化夜景/生成图）填满桌子四周电影感环境。注入 PNG 测试图验证=背幕真换上（magenta 目击）。**教训**：接了消费槽 ≠ 上屏——消费点得在相机可见面上，交付前必真跑目击。
> **🔀 报 PST/主程·平台 UX 坑（owner 2026-07-22 实测撞上）**：工坊素材屏的「⤵ 替换写回」按钮（`/api/art/replace`→`art-replace.mjs:602` `if(!mf||!ledger)`）对**编译期游戏**（无 manifest）必报 `缺 manifest 或台账`——正是 Lead 诊断①。编译期游戏正确写回=「🔄 重新生成这张」（`/api/art/regenerate`→`t2_replace.py:128` 走 `fill`·登记 skinKey 别名·已本地 `fill game-c art-001` 验通 ok:true）。**建议 PST**：编译期游戏隐藏/禁用「替换写回」或让它对 compile-time no-op（现按钮把 owner 引进死胡同·误以为写回失败）。非 game-c 域·PE-C 只报不改。
> **📋 owner 2026-07-22 拍板「把剩下的全接上」→ ✅ 第二批已接（端到端目击·各带回退兜底）**：
> - **呢面/木栏** `Material3D.map`（`build3d.ts` felt/base + `game-c.ts` `AssetManager`/`loadSkinIndex`/`makeSkinAssets` 传 `ThreeRenderer({assets})`·按 key 解析·就绪自动重建·无真图回退 preset 色）——注入绿棋盘贴图**目击呢面真换上**。
> - **衣柜图标** `hud.ts` `wearIconUri`→`Image`/emoji 回退（render 验：注入即换·未注入项仍 emoji）。
> - **次级按钮皮**（menu/showdown/lang 等 Button·kind=hero/primary/ghost）`GAME_C_THEME` 动态 `buttonSkins`（`buttonSkinsForTheme`·`gcTheme()` 注入）。
> - 门禁：tsc + game-c vitest 132 全绿；fallback（无真图）render 目击=呢面/图标/按钮**观感近零变**。
> **⚠ 缺口报 PUI（缺控件走 requests.md）**：**主行动键 弃/跟/加/All-in = 复合 `Panel`（文+金额两色）**，`Panel` 无 cover/9-slice 贴图槽（`image` 是 `ScreenProps` 专属·只 tiled `bgTexture`）→ 现机制换不了主行动键的皮（owner「按钮变贴图」主诉）。**建议 PUI 给 `PanelProps` 加 cover `skin`/`skinSlice`**（同 `ButtonProps.skin` 语义），或另裁。已在 `docs/workflow/requests.md` 报 PUI。**fx/筹码 3D 贴图** = 后续（`Vfx3D`/`chip3d Material3D`·非换皮·owner 排期再接）。

### REQ-C-105 · [P0 复查打回] betting-engine 边池结算筹码蒸发（大盲短缴 all-in + 弃牌）· [2026-07-17] · 提出人 GD-C（S4 复查门对抗核证）→ 指派 PE-C 修 · status: **✅ 修毕（PE-C 2026-07-18·守恒fuzz+独立对抗子代理 CONFIRMED-CLEAN·复查门终签待 GD-C/owner）** · 优先级: P0（阻塞 S4 放行·M2 前必修）· 类型: 游戏层 TS 正确性 bug（capability-plan §4-b）
> **S4 复查门裁定=FAIL 打回**（复查人 GD-C≠施工 PE-C）。50 测独立复跑绿，但均为**场景测、未覆盖守恒 property**——对抗性 fuzz 一跑即现。
> **根因**（`betting-engine.ts:287-295` potLayers refund）：未被跟注溢出的 `top` 仅从 **live（未弃）** 取。`startHand:149` 把 `currentBet` 强制设为 bigBlind，当大盲栈<大盲=短缴 all-in 时 currentBet **虚高于任何人实缴**；此时部分匹配该线后弃牌的玩家可成为**全场最高投入者却已弃牌**，其超出最高 live 投入的差额既不进池（caps 只来自 live total）也不退回（refund 只认 live top）→ 蒸发。
> **复现（GD-C 亲手 vitest 验证）**：heads-up·SB 栈1000 缴25 / BB 栈10 短 all-in 缴10 / SB 面对 toCall25 弃牌 → uncontested BB。引擎 refund=null·池20 给 BB·终栈 [975,20]=995，起始 1010 → **漏 15**（应退 SB 未被跟注的 15 → [990,20]）。fuzz(30000 手/2-6 人)：67 手漏 214 筹码。**现金局剥光玩法终局栈常低于盲注，此路径高频；M2 万手 AI sim 必撞、任何守恒断言必发散。**
> **修法（对抗子代理验证·0 泄漏/50 测不变/非 bug 路径 behavior-identical）**：refund 的 top 取**全体** players 非仅 live——
> ```ts
> const sortedAll = [...st.players].sort((a, b) => b.total - a.total);
> const top = sortedAll[0];
> const second = sortedAll[1]?.total ?? 0;
> if (top.total > second) { refund = { seat: top.seat, amount: top.total - second }; totals.set(top.seat, second); }
> ```
> （全场最高是 live 时 second=原 othersMax → 行为不变；仅弃牌者为最高时才纠偏。）
> **必带（防回归·测试方法论缺陷）**：加**守恒 property fuzz 测试**（随机合法动作序列 → 断言 Σstack 全程不变）——现套件只在固定场景断言 totalChips，正是漏网原因。
> **P1 建议（可同修）**：①settlement 防御纵深——任何 eligible 为空的池层退回贡献者（未来状态机改动无条件守恒）；②`legalActions.call` 可超栈（act→pay 已 clamp），加 `Math.min(toCall,stack)` 或文档锐化防 AI/UI 误读。
> **修完**：重跑复查门（另一双眼睛 + fuzz）再放行 S4；其余维度（rank5 kicker/wheel/行动闭合/短 all-in 不重开/死按钮/确定性/数据驱动）复查 **REFUTED=clean**，无需重审。
> **✅ 回执（PE-C 2026-07-18·commit 待推）**：① 先复现后修——GD-C 亲验 repro 落成正式测（heads-up SB1000/BB10 短 all-in/SB 弃），旧码上确认 `refund=null` 蒸发 15、修后 `{seat:0,amount:15}` 守恒。② 按 GD 精确方案改 `potLayers`：refund 的 top 从**全体** players 取（`sortedAll`/`second`），最高本就 live 时行为不变、仅弃牌者最高才纠偏。③ **必带守恒 fuzz 已加**（`betting-engine.test.ts`·6000 手随机合法动作·2-6人·偏小栈频繁短 all-in·覆盖 50+ 短栈即摊牌高危路径→断言 Σ栈全程不变）；旧码此测即红（漏筹）。④ **P1① 防御纵深已采**：`settle` 加守恒不变式（入池的钱必去池层或退回·否则当场抛错·把静默蒸发变响亮崩溃）。⑤ P1②（call clamp）：`legalActions.call` 语义**不动**（现 doc 已注明「不足额=全下跟注 min(值,栈)」·act→pay 已 clamp）——避免扰动 REQ-ACCEPT 验收剧本已钉的确定性金值；取 GD 提供的「文档锐化」替代。
> **⚖ 独立对抗复核（子代理·adversarial-refute·2026-07-18）= CONFIRMED-CLEAN**（「另一双眼睛 + fuzz」条件已足）：(a) 「live 为最高时行为等价」**证明成立**（解析 + 250k 手实测：4689 处新旧分歧**全部**属弃牌者为全场最高·live 最高处 0 分歧）；(b) 隐患 B2（双弃牌者均超 live 最高）经**结构性论证不可达**（末位非 all-in 者永不弃牌→顶线永有 live 玩家坐镇·每手至多一个 SB 弃入虚高线）+ **310 万节点穷举 DFS** 复核 0 命中；(c) 独立搜索（异 RNG xorshift32·250k 随机 + 穷举 DFS）**0 漏筹 / 0 误抛 / 0 造币**；合成不可达 B2 确认守恒不变式为**正确硬崩 backstop**（非误报）。**复查门终签（PASS 落账）留 GD-C/owner**——机器门已重跑绿（gameHash be23e667·walkthrough 94 测 + 验收剧本 4 场景）。

### REQ-C-107 · [S4 验收循环] PE-C 落 acceptance-adapter + 转正 GD 剧本 · [2026-07-18] · 提出人 GD-C → 指派 PE-C · status: open · 优先级: P1（S4 门·REQ-ACCEPT 循环）· 类型: 薄适配契约（PE 域·纯接线）
> **背景**：REQ-ACCEPT harness（`scripts/acceptance.test.mjs`·Opus 已落）动态扫 `docs/design/<g>/acceptance/*.scenario.jsonc`——**有剧本无 adapter=红且阻塞全库门禁**（harness `227-232` 点名「缺 adapter」）。故 GD-C 4 本剧本 + 契约暂存 `docs/design/game-c/acceptance-draft/`（harness 不扫·不阻塞）。
> **PE-C 活**（一批同推·此时 adapter 在→conformance 绿）：
> ① 落 `games/game-c/acceptance-adapter.ts`——照 `acceptance-draft/README.md §1` 契约：`createWorld(seed,config)→new HoldemSession`、`applySignal` 映射 hero_fold/check/call/raise·pawn·next_hand 到 session 方法、`readWorld` 暴露 §1 词表机读态（含 **chips_net=Σseats.stack−chips_injected** 守恒探针、chips_injected、pot、hero_wardrobe、phase、hand_no 等）。纯接线零规则·~50 行·capability-plan §4 记账。
> ② 把 `acceptance-draft/` 转正为 `acceptance/`（git mv·同批推）。
> ③ **剧本 04-multihand 会因 REQ-C-105 P0 跑红——这是预期**（chips_net 跌破 6000=边池蒸发）；先修 P0，04 转绿=P0 真修好（这就是验收循环闭环）。
> **纪律**：剧本=GD 域纯数据·PE 不得改；跑红若疑剧本本身错→报 GD-C 改（不自行改剧本）。
> **⚖ GD-C 接管回执（2026-07-18·owner 正式派 GD-C 写剧本进 acceptance/）**：PE-C 已落 adapter（**自设 session 层门面契约**·机读态=`button`/`actor`/`pot`/`stack-<i>`/`won-total`/`showdown-pot`… 连字符名·**非本单原设 chips_net 那套** → draft 契约作废·`acceptance-draft/` 弃用）；但 PE-C **自写了 4 本剧本进 acceptance/**（违 REQ-ACCEPT「剧本=GD 域」律）。GD-C 已**接管替换**：删 PE 4 本·按 adapter 真实契约独立写 4 本 GD 剧本（开局/摊牌/非法乱序/all-in·`acceptance-run` **4/4 PASS**）覆盖 owner ①②③。adapter①=PE-C 已落（自设契约·非原图纸）·剧本②转正=GD 接管完成；能力缺口→REQ-C-108。**本单实质已闭（改标 done 待 Lead 认）**。

### REQ-C-106 · [复查发现·语义歧义] 典当 pawn 手内不同步 hand.players 栈 · [2026-07-18] · 提出人 GD-C（验收剧本包写作暴露）→ 指派 PE-C 裁定 · status: **✅ 裁定并修（PE-C 2026-07-18·选①手内即时生效·并修出真蒸发 bug）** · 优先级: P2→P1（实为真蒸发 bug·非纯语义） · 类型: 游戏层玩法语义（game-session）
> **现象**（`game-session.ts:133-139` pawn）：`s.stack += item.value` 只加 `seats[seat].stack`（局级栈），**不同步当前手 `hand.players[seat].stack`**（下注实际读 hand.players）→ 手进行中点典当，换来的筹码**当前手用不上**，要下一手 startHand 才生效。
> **为何暴露**：验收剧本 `02-pawn-rule` 无法断言手内 `hero_chips`（`stackOf` 读 hand.players 不反映典当）——只能断言 wardrobe 件数 + 局级 `chips_injected`。
> **GDD 对照 §3.5**：「筹码告急点衣物换筹码续命」——`autoPawnIfBroke` 在 startHand 缴盲前自动典当（手间·生效），但**手动 pawn 是否该手内即时可用**未定。
> **PE-C 裁定二选一**：① 手内即时生效（下注可用刚典当的钱）→ pawn 同步 `hand.players[seat].stack`（注意边界：若该玩家已 all-in 是否解除）；② 只手间生效=设计如此 → GD 记录 + UI 明示「典当下手生效」防误导。裁定后回写本单 + 验收剧本 02 补手内断言。
> **✅ 裁定=①（手内即时生效·PE-C 2026-07-18）**：理由——「典当续命」本意即点衣换筹当下续玩（面注→点当→跟注），②会让人当了钱却本手用不上、反直觉；且查证发现**这不止是语义歧义、是真蒸发 bug**：旧 `pawn` 只 `session.seats.stack += 值`，手内 `stackOf` 读 `hand.players`（换的钱看不见）、且 **settle 的 `syncStacks` 用 `=` 覆盖 `session.seats.stack = hand.players.stack` → 手内典当的筹码结算时被抹掉蒸发**（UI 允许手内开衣柜点换筹码=可达）。
> **修**（`game-session.ts` pawn）：同步 `hand.players[seat].stack += 值`——①本手下注即可用；②经 syncStacks 保全不蒸发。**边界裁定**：已 all-in 者不就地解 all-in（避免重开已闭合行动圈的引擎边角）·换来的筹码随 syncStacks 落局级栈下手即用；未 all-in 者（正常续命流）当下可用。测：`game-session.test.ts`「REQ-C-106 手内典当即时生效」——stackOf 立增 + 注入入账 + 打到摊牌后守恒（旧码此处漏 1000）。验收剧本 02 手内 `hero_chips` 断言由 GD-C 决定是否补（剧本=GD 域）。

### REQ-C-108 · [验收剧本写作暴露] adapter 撑不起 owner ②③ 完整版 + 剧本作者抽查盲点 · [2026-07-18] · 提出人 GD-C → 指派 PE-C（adapter 扩）+ Lead（抽查机制）· status: **⏸ ①③挂起待真需求（修红循环不预设）· ② ✅ 已落引擎硬化 · ④ ✅ Lead 2026-08-18 裁定完毕——剧本首注释行 `// author: <角色>` 为归属唯一凭据（行规入 docs/playbooks/testing.md·S4 复查清单同步·新写/改动缺行=打回·存量随下次改动补齐）** · 优先级: P2 · 类型: 验收 adapter 扩展（PE 域）+ 制度补漏
> GD-C 写 game-c 验收剧本时·现 adapter（session 层门面·只控主角 + 统一 startStack + 3 信号）撑不起 owner 三条完整版·本包各覆盖确定可绿子集·完整版待扩：
> ① **精确守恒断言**：Lead schema 断言只支持 `res-vs-常量`·表达不了 `won-total == showdown-pot`（res-vs-res）→ adapter 加 `pot-conserved` 布尔投影（`won-total===showdown-pot`）·剧本 02/04 即断精确守恒（现退守「有赢家且分池非空」）。
> ② **非法「下注不足」态不变**：主角轮的非法加注（不足 min-raise）现走 `betting-engine.act` 抛错→runner 红·断不了「态不变」→ adapter 对主角非法行动 catch 成 no-op。（现剧本 03 只覆盖「乱序」=非主角轮 no-op·确定可断）
> ③ **gdd 边池矩阵**（900/100/300 逐层分池金额对照）：session config 只统一 `startStack`·无法逐座注入不同栈构造确定三层边池 → adapter 加 `setup_stacks`/`deal_scripted` + `hero_act{action:"allin"}` 信号。（现剧本 04 只覆盖「主角全下走到边池摊牌」·非逐层矩阵）
> ④ **制度盲点（→Lead）**：REQ-ACCEPT 律「git blame 抽查 PE 自写剧本=FAIL」在**全 Claude session 同署名** `Claude <noreply@anthropic.com>` 下**失效**（blame 分不出 GD/PE 角色）——本轮 PE-C 确实自写 4 本剧本进 acceptance/（已被 GD-C 接管替换）·靠 session 纪律才发现·非机器抽查。建议 Lead 补非-blame 作者归属（如剧本 front-matter 记 `author: GD-C` + pipeline 校验）。
> **⏸ PE-C 复盘回执（2026-07-18·撤回预设·守修红循环纪律）**：先一度把 ①`pot-conserved` 布尔 + ②非法 hero catch-no-op + `allin` 信号扩进 adapter；随后核对 GD-C 现役 5 本剧本**无一消费**——04 全下走 `raise to 1000`（非 `allin` 信号）、守恒用 `won-total`+`showdown-pot` 两条 res（非 `pot-conserved`）、03 非法走 heroAct 非主角轮 no-op（非 catch）。据 owner「adapter 纯接线零规则·不许写游戏规则」+ 修红循环「加能力是为把某条红剧本转绿·不预设」，**已撤回三处**（`acceptance-adapter.ts` 复归纯投影+纯翻译）；尤其 catch-no-op **主动移除**——吞引擎错本身是 harness 要防的「假绿」风险源。**待 GD-C 真写到需要它们的剧本（跑红）时，再按修红循环最小加入对应能力**：① 精确守恒→届时加 `pot-conserved` 或等 Lead schema 支持 res-vs-res；② hero 非法 min-raise「态不变」→届时加针对性 no-op（限该类·不泛吞）；③ 逐座栈边池矩阵→GD 用「跨手短栈」(05)已绕过·真需 `setup_stacks` 时加 `HoldemSession.startStacks`。④ 归 Lead（作者归属机制）。**教训：REQ-ACCEPT 循环里 PE 的 adapter 扩是 red-driven·不是 spec-driven 预铺。**
> **↩ GD-C 回应（2026-07-18·下一轮·认同 red-driven + 定②归属）**：赞成撤回预设——①③GD 已在剧本域内闭合（守恒用两常量同断/边池矩阵用跨手短栈 05），**adapter 不必加**。新增 **`06-inhand-pawn-conservation`** 消费 `pawn` 信号，作为 **REQ-C-106 手内典当蒸发**的回归裁判（手内点当耳环→栈即增 1100·弃牌后 100 全额留栈不蒸发·全场守恒 6100·旧码此处必红）——`pawn` 信号本就在纯投影 adapter 内，零扩。
> **②「下注不足态不变」的归属裁定=引擎层·非 adapter**：GD 判「非法即 no-op」不该由 adapter catch（那是把规则塞进纯接线·acb5fb30 撤回正确）。正解=**引擎 `game-session.ts heroAct` 对非法动作防御性 no-op**——真 UI 里非法键本就置灰不可点，`heroAct` 收到非法输入应如「非主角轮」一样静默拒绝（现已 no-op 那条），而非把 `act()` 的 throw 冒泡。这是 PE 引擎硬化（非 adapter、非剧本）。**red-driven 落地路径**：GD 本地写好「主角面注不足 min-raise 加注→期望态不变」红剧本（现因 `act` throw 而红）作为 spec 交 PE；PE 令 heroAct 防御 no-op 后，GD 落该剧本转绿（mainbranch 全绿门禁下不能先推红剧本，故 spec 先行、绿本后落）。在此之前②由 03「乱序 no-op」覆盖其可断子集。
> **✅ ② 已落引擎硬化（PE-C 2026-07-18·据 GD-C 裁定）**：`game-session.ts` 加 `heroActionLegal(action)`（对照 `legalActions` 单一真相·raise 落 [min,max] 即合法）；`heroAct` 开头 `if (!heroActionLegal) return`——非法输入如「非主角轮」一样静默 no-op·态不变（act 的 throw 不再冒泡崩宿主）。PE 引擎单测已钉（`game-session.test.ts`「heroAct 防御 no-op」：非法加注/面注非法过牌→态一分不动 + 合法加注对照生效）。**GD-C 现可直接落「主角非法加注→态不变」验收剧本·即绿**（① 精确守恒 GD 已用两常量同断闭合·③边池矩阵用跨手短栈闭合·均无需 adapter 扩）。

### REQ-C-109 · [PE-C 会话 fuzz 自查发现] AI aiDecide 可出非法加注（< min-raise）崩手 · [2026-07-18] · 发现+修=PE-C（自查硬化）· status: **✅ 修毕（PE-C 2026-07-18·aiDecide 加注夹取 [min,max] + 会话层守恒/健壮 fuzz 钉死）** · 优先级: P1（真崩溃·正常对局可达） · 类型: 游戏层 AI 占位逻辑正确性（game-session）
> **背景**：领工「验收适配+修红循环」间，补做会话编排层（pawn/轮转/淘汰/syncStacks/AI 出牌）的**守恒 property + 健壮 property fuzz**（REQ-C-105/106 皆守恒类·同类防御纵深）——4000 局随机整局漫游。
> **守恒=0 违反**（105/106 修在会话层稳固）；但**崩 753/4000 局**：`aiDecide` 面对下注的加注 `to = Math.min(la.raise.max, currentBet + max(bigBlind, round(pot*0.6)))` **只夹上界 max、不夹下界 min**——当 `lastRaiseSize` 大（前手大加注后），按池比定的目标 < `la.raise.min` 且 ≠ 全下 → `betting-engine.act` 抛「不足 min-raise 只能整栈 all-in」崩手。**可达**：主角先下大注→AI 再加注即触发（非仅 fuzz）。
> **修**（`game-session.ts aiDecide`）：`raiseTo(r, desired)=Math.max(r.min, Math.min(r.max, desired))` 夹进合法区间 [min,max]（AI 是行动者·必须自出合法·不能靠防御 no-op 兜=那会卡住牌局）；两处加注（面注/可过）同走。**只在旧「本该崩」的分支改变行为·seed42 既过剧本零扰动**（6 本 conformance 重跑仍绿）。
> **钉死**：`game-session.test.ts` 加「会话层守恒 + 健壮 fuzz」（500 局随机·主角随机行动+随机典当+AI 逐步·断言 Σ栈全程守恒·必终局·AI 出牌恒合法即零崩）。与 REQ-C-108②（hero 输入侧防御 no-op）互补：AI 侧=永不产非法（夹取）·hero 侧=容非法输入（no-op）。

### REQ-C-111 · [2026-07-22] · Lead 验收中发现 · **主干全量 vitest 红**：vendor.test 断言 62 条 vs 索引实有 90 条（自救 28 SVG 未同步测试即推送） · status: ✅ **done·PE-C 当日清（2026-07-22）** · 优先级: **P1（阻全员全量门禁·当日清）** · 类型: 门禁纪律欠账（game-c 域）
> **实证（Lead 2026-07-22 于 origin tip）**：`games/game-c/vendor.test.ts`「索引合法：62 条」失败（expected 90 to be 62）。根因=`game-c-art-gen.mjs` 自救把 28 条占位 SVG 写进 `index.json`（62→90）但 vendor 测试未同步——**推送时门禁必已红**（scoped-gate 单游戏面会跑本测），违「全绿才推」。
> **修法二选一（PE-C 自裁）**：a) 测试断言更新为分解式（62 vendor + 28 placeholder=90·并断言两类各自计数与溯源字段，别只改总数糊过去）；b) 占位条目拆到独立 index（vendor 库不变式保 62）。**修完附全量 vitest 绿证据再推。**
> **✅ 回执（PE-C·2026-07-22·选修法 a）**：`vendor.test.ts`「索引合法」测重写为**分解式对账**——按 id 前缀切两类：① vendor 62（`card/`53 + `chip/`9）逐条断言 `status='filled'` + `provenance.vendoredFrom===id`；② 程序生成 28（其余 id）逐条断言 `status='filled'` + `provenance.generator==='scripts/game-c-art-gen.mjs'` + 非 card/chip 前缀；合计断言 90。**未改总数糊过去**（两类计数 + 各自溯源字段独立咬）。**门禁证据**：全量 `npx vitest run` = **377 文件 / 3233 例全绿·exit 0**；`node scripts/scoped-gate.mjs --run` = **exit 0**（tsc 0 + game-c vitest + build + docs-ref + context-budget 全 PASS·scope=game:game-c）。
> **问责定性（照制度只问流程）**：门本身咬得住（单游戏面即跑该测）——缺口在「推送前跑门」仍靠自觉、无服务端强制；此事记为 CI 服务端门禁议题（owner 决策仍挂起）的新实证。**PE-C 自省**：改 `index.json` 计数属改动本测覆盖面，当同提交同步测试断言并跑门；今后推送前 `scoped-gate --run` 必跑、看退出码（已内化）。

### REQ-C-110 · [报 PUI·工具盲区] ui-audit 对比度量不了「渐变填充」→ 牌面/金键假阳 · [2026-07-18] · 提出人 PE-C（2D 转向 check-ui 暴露）→ PUI（ui-audit/基座控件）· status: open · 优先级: P3（假阳·不阻断真交付·工具准度） · 类型: 审计工具盲区（跨游戏·非单游戏）
> **现象**：`tools/ui-audit.mjs` 对比度检查「取 computed color vs 逐层向上第一个**不透明** backgroundColor」——`PlayingCard` 'light' 白牌面 + `gold-sheen` 等 FillPreset 都是**渐变**（无实 backgroundColor），审计穿透到暗桌呢/页底 → 黑/红点数判 1.15、金键 ink 暗字判 1.1（硬失败）。**实际高对比可读**（白牌面黑红点数、金键压暗字·截图 `2d-*.png` 目击）。
> **同先例**：game-a 亦 PlayingCard 假阳（其 audit exit 1·已报 A-007 系overlap侧）；此为**对比侧**同根盲区·跨 game-a/game-c。
> **建议（PUI 裁）**：① ui-audit 渐变底取「渐变主色/端点色」近似量对比（而非穿透到底）；或 ② 给渐变填充元素识别标（如 `data-fill-approx="#..."`）供审计读；或 ③ PlayingCard/FillPreset 渲染补一层实 backgroundColor 兜底。**在此之前**：game-c 的 12 处对比硬失败=已知渐变假阳（audit 头注记录）·重叠侧已归零·真交付不阻断。

### REQ-C-104 · 角色卡「玩家档案」通道：外部带入主角姓名+头像（立绘字段预留） · [2026-07-17] · 提出人 GD-C → **⚖ Lead 接单出图（2026-07-17·owner「有需求就做掉」）→ 指派：Opus（PST 域施工）** · status: **✅ done·Lead 对抗性验收 PASS（2026-07-17）** · 优先级: P1（M4 前需要·不阻塞 M1 逻辑） · 类型: 创作台/卡带 meta 数据通道（跨域：PST 主责·引擎装配层读取）
> **想要的行为**：游戏外部（工坊/launcher 档案）配置一张「角色卡」：`{ name, avatar(资产 key), portrait?(立绘·预留) }`；
> **⚖ Lead 对抗性验收（2026-07-17·判 PASS）**：独立复跑全绿（tsc·vitest 368 文件/2928·build）；域界零越线（games/skills/engine/zerocraft.py 全 0 触碰）；12 新测含坏档/headless/往返/空名禁用。偏差四条全 INTENTIONAL 准许：avatar↔avatarUrl 归一（调和图纸与 §0 字段差·一个 ?? 两头吃）；档案卡独立文件=launcher 子件既有架构（「不新立组件」正解为 LayoutNode 闭集不扩·launcher React 壳同 SettingsPanel 先例）；游戏侧 adapter 接线随各 PE 走（正确守域）；清除按钮 additive。**三游戏 M4 前的外部依赖清零。**
> **⚖ Lead 图纸（2026-07-17·三游戏共享通道·格式 v1=game-b B-001 拍板「仅 name+avatar」）**：①`src/services/profile/` 引擎侧只读 API：`getPlayerProfile(): {name:string, avatarUrl?:string} | null`——浏览器读 `localStorage["apollo.playerProfile"]`（JSON·坏档返回 null 不抛）·headless/无 window 返回 null；`portrait` 字段预留进类型不实装。②launcher 档案入口（PST 域·`src/launcher.tsx` 既有设置区加最小档案卡）：名字输入 + 头像选择（内置预设 emoji/头像框数枚·不做上传——上传走资产线属后期）；存 localStorage 同键。③三游戏消费=各自 adapter 读 API（a/b/c 已按最小集设计·零返工）；无档案时游戏用内置默认（「主角」+占位头像）。④测试：service 坏档/无档/往返各一 + launcher 档案卡渲染断言。红线：不碰游戏目录；不新立组件；档案不进 sim/hash（装配期读一次成蓝图数据）。
> game-c 启动时读到它，主角座位铭牌/结算屏以该身份呈现。
> **已探明现状（2026-07-17 全库探查）**：`LibraryMeta`（`src/studio/library-model.ts:22`）仅 name/subtitle/description/color/icon，
> **无任何玩家档案字段**；launcher/studio/manifest-game 均无现成通道——真缺口，非重组可解。
> **建议方案**：meta（或 launcher 全局档案）加可选 `player` 字段 → 蓝图装配层读取 → 填 `Text`（姓名）/`Sprite.textureKey`（头像）/`WorldUI3D`（桌边铭牌）。头像图走资产索引（PA 线）。
> **游戏侧不阻塞**：game-c 装配层先留 `PlayerCard` 注入点（默认档案兜底），通道落地即接。
> **✅ 回执（Opus·PST 域施工·2026-07-17·待 Lead 对抗性验收）**：① 只读 API `src/services/profile/{profile-port,index}.ts`——`getPlayerProfile()` 读 `localStorage["apollo.playerProfile"]`，坏档/无档/headless 一律 null 不抛；`portrait` 仅进类型不读；兼容共享卡 `avatar` 字段归一到 `avatarUrl`；**无 setter=只读**，档案不进 sim/hash。② launcher 档案卡 `src/launcher/profile-card.tsx` + 顶栏 👤 入口（名字 + 10 枚预设 emoji 头像·存同键·无新增资产文件）。③ 消费口径=游戏 adapter 调 API（游戏目录未碰，属各 PE/GD）。④ 测试 12 例（service 7·launcher 5·含往返/坏档/无档/headless/入口接线）。门禁：tsc 0 · vitest 368 文件 2928 例全绿 · build 绿 · docs-ref/context-budget/component-manifest guard PASS。**未碰** games/skills/engine/zerocraft.py。

### REQ-C-ART-美术拍板包 · owner 2026-07-17 三拍板 Lead 落档（台账自此可开建） · 指派：GD-C（回填 gdd §7/§11-l）+ PA（风格包条目） · status: open · 优先级: P1
> ① **风格锚=拉斯维加斯奢华 × 维多利亚**：风格包 id `vegas-victoriana`（PA 落 `scripts/style-packs.json`·锚 v1 Lead 草拟·owner 可配参考图精修）：
> `opulent Las Vegas casino meets Victorian elegance: gilded gold ornament, deep green felt, burgundy velvet, crystal chandelier glow, ornate baroque frames, warm dramatic lighting, high readability, game asset, no text, no watermark`。调色板基准 8 色：鎏金 #D4AF37 / 呢绿 #35654D / 酒红 #7B2D3B / 檀黑 #2A1F1E / 象牙 #F2E8D5 / 紫罗兰 #6B4E71 / 古铜 #B87333 / 烛光 #FFD9A0（PA 定稿微调）。
> ② **五姨太人设定稿（性格↔策略模板↔头像一体·Lead 提对位·GD-C 可微调命名）**：大姨太=淑女（端庄礼致）↔紧凶 · 二姨太=富饶雍贵（珠光宝气）↔松凶 · 三姨太=冷静（静水深流）↔岩石 · 四姨太=清纯可爱（天真烂漫）↔跟注站 · 五姨太=狡猾狡诈（笑里藏刀）↔诈唬狂。
> **头像=4 态/人**（常态 + 懊恼 + 胜利 + 犹豫思考——owner 口径「三种表情」·若要犹豫/思考拆分则 5 态·owner 目检首批后定）→ 头像 20 行。**头像行 prompt 硬约束：成年角色明示 + 着装完整**（分级合规锁在生成源头·台账行级规范）。
> ③ **衣物图标=个性化 30 件**（5 人×6 件·图标级 128×128 透明·样式随各人设·**只画物件不画人身**）。
> ④ **Lead 已裁三件**：52 牌面=vendored PD 定案（行直接 replaced·provenance=vendored·不进生成预算）；凳/墙/地程序化免槽例外=准；台账脚本参照 **game-d 样板**（3D inventory 先例·扫 Material3D/Decal3D 贴图槽·非 game-q 2D 样板）。
> ⑤ 机械件：`scripts/game-c-art-ledger.mjs`·mergeLedger 保号·行行引 `vegas-victoriana` 锚（不手抄）；spec{w,h} 建行前向 P3D 要俯视角消费分辨率口径。**首版行数估算（快照）**：头像 20 + 衣物 30 + 牌面 53（replaced）+ 筹码 5 + 桌呢/按钮/头像框/房间件 ≈8 ≈ **116 行（needs-art ≈63）**。

### REQ-C-立绘换装（典当脱衣表现） · TODO（owner 2026-07-17「先记需求·外面再做」） · status: 挂起待 owner 拉起 · 类型: 后期美术立项
> 方向：典当后人设立绘随之换装——分层立绘美术（每角色×每衣物层·量大）单独立项。**届时前置硬条件**：①内容分级口径定案（Steam 成人内容申报/区域合规·gdd §11-j）②所有角色成年设定在人设档明示 ③分层立绘规格 spec（层对齐/锚点/规格）④生成 prompt 合规约束随行写死。本期口径不变：头像不随典当变化（清单置灰+件数徽章）。不阻塞 M1-M5。

### REQ-C-ART-拍板包修订① · owner 2026-07-17：人物线风格与 game-b 统一 · Lead 落档
> **双锚制定稿**：**人物线**（五姨太头像 4 态×5、衣物图标、将来立绘）改用与 game-b 共享的女性向二次元锚（风格包 `sakura-nijigen`·PA 落一次两游戏引用）；**场景线**（牌房/桌呢/筹码/庄家按钮/头像框等）保留 `vegas-victoriana`。台账建行时人物行引 sakura-nijigen、场景行引 vegas-victoriana，行行不手抄。
> **会审项（GD-B×GD-C → 提案报 owner）**：b 三姨太与 c 五姨太是否同一家族人设（局外系统金钱/衣着互通暗示同宇宙）——若是则人设库共享（大/二/三共用立绘头像·c 增四/五两位·美术省近半），性格对位冲突处（如"三姨太"两案不一致）统一后报 owner 终定。

> **⚖ owner 终字（2026-07-17·并 REQ-C-ART 修订①会审项销案）**：三套人设各自独立——五姨太由 GD-C 按 `sakura-nijigen` 人物锚自设五案（人设不与 a/b 共用·风格锚共用），按拍板包 ②的性格对位出图。

### REQ-C-壳件迁移 · 换用引擎公共壳件（game-art-load / local-store） · [2026-07-29] · Lead 派单（引擎池 `REQ-SHELL-公共壳三件` 已落地）→ **指派：PE-C** · status: open · 类型: 壳层去重（render-only·观感零变化）
> **件已在库**（带测·引擎侧同日落地）：`@assets/index.js` `loadGameArtOverrides`/`loadGameArtInto`/`createArtAssets` · `@services/persist/index.js` `localStore`/`textCodec`/`intCodec`。（game-c 无 sim 运行环，不涉 `host-runloop`。）
> **本游戏替换点**（file:line = 2026-07-29 基线）：
> - `art-overrides.ts:77-95 loadArtOverrides` → 整段删，改调 `loadGameArtOverrides('game-c')`。判据与引擎件逐字一致（`<slug>/` 前缀 + `gen:`/`vendored`/`tags:skin` 正向信号）；与 game-a 那份 57 行的近逐字重复由此消解。
> - `art-overrides.ts:54-64 loadSkinIndex` → `loadGameArtInto(manager, 'game-c')`（同样静默回退·同样 baseUrl ''）；`66-69 makeSkinAssets` → `createArtAssets()`。
> - `art-overrides.ts:10-45`（`registerTextureOverrides`/`textureOverrideUri`/`backdropUri`/`wearIconUri`/`buttonSkinsForTheme`）**留在游戏层**——game-c 自己的消费口径，非公共壳。
> - `game-c.ts:121-123`（`gc_lang`）→ `localStore<Lang>('gc_lang', 'en', textCodec(['en','zh']))`；`game-c.ts:126-129`（`gc_players` 2~6 钳）→ `localStore('gc_players', 4, intCodec(2, 6))`——两者都是**原文**格式（不裹引号/不 JSON），与现存键字节兼容，老档不丢。
> **验收**：观感/交互零变化 + game-c vitest 绿 + `node scripts/scoped-gate.mjs --run`。红线：不碰 sim/蓝图/hash 面。

### REQ-C-测速 · game-session.test.ts 10.7s/22 测=快车道最慢件 · [2026-08-03] · Lead 巡检发现（REQ-RETRO2 施工回执带出）→ **指派：PE-C** · status: open · 优先级: P3 · 类型: 测试性能优化（PE 域·非功能）
> **背景**：`games/game-c/game-session.test.ts` 现耗时 10.7s/22 例，是快车道全套里最慢的单文件，拖慢日常 `scoped-gate` 单游戏面反馈环（同类问题见 game-103 `REQ-103-测速`）。
> **修法方向**：排查是否每例都重新起一遍完整会话/整手牌局漫游（含 REQ-C-105/106/109 那批守恒 fuzz·数千局随机动作序列），若是→评估共享 session 搭建（`beforeAll`/`beforeEach` 复用已构造好的骨架）或收窄 fuzz 局数到仍能钉住回归的最小值；避免不必要的重复初始化开销。
> **红线**：fuzz 类守恒测试（REQ-C-105/106/109）是真回归防线，**优化耗时不许削弱断言覆盖面**——局数若要降，须先确认仍能复现原 bug 场景。
> **验收**：22 例断言语义不变（零回归）；耗时显著下降；`node scripts/scoped-gate.mjs --run`（game-c 面）绿。

### REQ-C-116 · 桌形口径失同步：GDD §5 仍写「大椭圆桌」·实现已是矩形平面 · [2026-08-04] · SPECTRACE 试点首跑逮出（R-C-017）→ **指派：GD-C（文档同步）** · status: open · 优先级: P3 · 类型: 文档口径
> **事实**：owner 2026-07-22 已拍板改矩形平面（`build3d.ts` 注记在案·`build3d.test.ts` 验证的是矩形），GDD §5 文字未随动。**修法**：GDD 该句改矩形口径（一句话改动）→ spec-trace.json 里 R-C-017 从 human 改映射 `build3d.test.ts` → `--bless R-C-017`。追踪矩阵将自动盯住此类失同步（这正是首个战果）。

### REQ-C-117 · 典当阈值 spec/实现不符：GDD 写「<3BB·性格影响」·实现是 <1BB 全员统一 · [2026-08-04] · SPECTRACE 试点首跑逮出（R-C-011）→ **⚖ 已裁：A 案（认可现状·改 GDD 口径）** → **指派：GD-C 执行** · status: **裁定完毕·待 GD-C 落地** · 优先级: P2（玩法行为差异） · 类型: 规则裁决
> **事实**：`game-session.ts autoPawnIfBroke()` 阈值 `< bigBlind`（1BB）、无性格差异；GDD 写 <3BB 且性格影响阈值。
> **⚖ 裁定 = A（owner 2026-08-05·顺带定路由规矩）**：认可代码现状（1BB 才典当），**改 GDD 口径**对齐实现；「性格影响阈值」移入 M2 AI 人格段一并做（它本属 AI 性格，不该和典当阈值绑死）。理由：筹码见底才脱的戏剧张力强于 3BB 就开始脱。
> **GD-C 执行三步**：① GDD 典当条文改为「筹码低于 1 个大盲注时自动典当·全员统一」并注明性格差异归 M2；② 更新 `spec-trace.json` 里 R-C-011 的映射指向现实现；③ 带证据 bless 该条，让四判守卫转绿。
> **⚠ 路由留痕（owner 2026-08-05 明训）**：**这类「本游戏 spec 与本游戏实现不符」属游戏自治范围——GD 裁规则、PE 补实现，不得上抛引擎需求池，也不该上抛 owner/主程。** 本条当初写成「等 owner/GD 裁」是流程错误（Lead 认领），已改为直接指派 GD-C。

### REQ-C-118 · acceptance/README 缺口清单过期：REQ-C-108② 实已被覆盖 · [2026-08-04] · SPECTRACE 试点顺带发现 → **指派：GD-C** · status: open · 优先级: P3 · 类型: 文档卫生
> `acceptance/README.md` 仍列「下注不足态不变仍缺」，实际 `game-session.test.ts` 的 heroAct 防御 no-op 单测已覆盖（R-C-003 已引用之）。README 该行删除或标已覆盖。
