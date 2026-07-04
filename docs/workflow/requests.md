# 引擎需求池 · Requests

> 各角色（按 `docs/roles/index.md` 名录）在此提需求；Lead 读取 → 评审/裁决 → 派工 → 标记状态。**术语注（2026-07-04）：历史条目里的「PA/PB」= 早期 Game Creator（游戏创作者）代号，与现名录 PA（资产管理员）无关。**
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。
>
> **（2026-06-15 清理：本池仅保留 Game E/F/G 需求；非 F/G 条目已移除，见 git `41ace96`。）**
> **（2026-06-26 Token 清理：已结案条目（done/wontfix）正文压成一行摘要，完整论证/接线契约见各 commit。open/进行中条目保留全文。）**

---

## 待处理 / 进行中

### REQ-PUBLISH-创作台一键发布 · player 模式内「打包→上传 Steam」一键流水线 · [2026-07-04] · owner 口头指派 → PS 转呈（跨 PS↔PST 域） · status: **open（待 Lead 裁域切分 + 派工）** · 优先级: P2（产品体验·非阻塞） · 类型: 产品化·发行管线接入创作台（后端多已存在·主要是接线）
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
> **请 Lead 裁**：a) 域切分是否如上（PST 接 UI / PS 供管线 API）；b) 接入形态——studio 直连 steam-publisher 本地端口 vs 经 apollo.py 转发 vs 内嵌重写；c) 派工。**PS 可先起步**：把 `serve.py` 编排 API 硬化成稳定契约 + 补冒烟测（无真账号用 480 + mock 跑通编排），等 PST 接 UI。

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


## 已归档条目索引（2026-07-03 归档手术 · 全文见 `requests-archive.md`）

> - REQ-UI-web字体加载（数据化）+ 第3字体槽 + Label ink 令牌 · [2026-07-02] · P3D（game-d 对齐 Cloud Design 撞到·全 app 受益） → 主程（UI 库域） · status: **✅ done（主程 2026-07-02·①机制下沉 + ③令牌落地·②已存→回驳；剩 vendor woff2 数据活）** · 类型: 真能力缺口（3 项·尺子已过·不可重组）
> - REQ-寻路 · [2026-06-28] · owner→Lead 直派（引擎域·Lead 登记） · status: **✅ done（主程 2026-06-28·`astar.test.ts`+`pathfind.test.ts`）** · 类型: 真能力缺口下沉（连续自由空间寻路）
> - REQ-UI-G战斗手牌 · [2026-06-27] · GA（game-g·战斗 UI 数据驱动重构撞到） · status: **✅ 已裁（① 效果半边=`layout.fx` 下沉·done；② 牌面信息层=主程 via REQ-UI-G棋枰 裁决回驳新抽象→格内兵牌/手牌用 PlayingCard+私货皮·随 play-field 现状豁免·保持 bespoke）** · 类型: 真能力缺口下沉（① done / ② 回驳-豁免）
> - REQ-UI-容器可点 · [2026-06-28] · GA（game-g 棋枰数据化重写·阶段②需） · status: **✅ done（主程 2026-06-28·接受·`Panel.action`+`actionArg`·`panel-action-fade-keyframes.test.ts`）** · 类型: 真能力缺口（容器无 action）
> - REQ-UI-fx源泉消退 · [2026-06-28] · GA（game-g 棋枰数据化重写·阶段④需·owner 点名可做） · status: **✅ done（主程 2026-06-28·接受·fx kind `'fade'`·`panel-action-fade-keyframes.test.ts`）** · 类型: 真能力下沉（fx 闭集补 kind）
> - REQ-UI-容器描边形 · [2026-06-28] · GA（game-g 棋枰数据化重写·阶段②城堡/格框撞） · status: **✅ done（主程 2026-06-28·owner 插播优先·三字段全接受·`panel-edge-radius-dashed.test.ts`）** · 类型: 真能力缺口（Panel 边框表达力·闭集补字段）
> - REQ-UI-fx控件叠层 · [2026-06-28] · GA（game-g·接 REQ-FX 给战斗 HUD 补 fx 时撞到） · status: **✅ 已裁（主程 2026-06-28·①误诊-驳 / ②done 导出 `ensureUiKeyframes`）** · 类型: 真能力缺口（fx 叠层未通达自渲染控件）
> - REQ-UI-Label字阶裸数字 · [2026-06-28] · PG 实现（**owner 当面授权 PG 直接改引擎此一处·非常规**） · status: **✅ done（PG 2026-06-28·`label-size-number.test.ts`）** · 类型: 真能力缺口（curated 字阶太粗·不可重组）
> - REQ-UI-G收藏卡 · [2026-06-26] · PG 同步（UI 库域·game-g 收藏页逐页对齐撞到的缺口） · status: **✅ done（主程 2026-06-26·①② 均下沉·`collection-card.test.ts`）** · 类型: 真能力缺口（尺子已过·不可重组）
> - REQ-UI-G大厅审尺寸/卡内布局 · [2026-06-27] · PG 同步（UI 库域·owner 大厅人肉审批量） · status: **✅ 已评审（主程·①接受 ②③④⑤回驳-已覆盖·裁决见末尾「REQ-UI-G牌组保真批」+ `tag-size-card-overlay.test.ts`）** · 类型: 混合（1 真缺口 + 4 已覆盖）
> - REQ-UI-G流光底纹 · [2026-06-26] · PG 同步（UI 库域·主页质感对齐撞到） · status: **✅ done（主程·①layout.sheen ②PlayingCard.backPattern ③Panel.pattern·`sheen-pattern-bigtext.test.ts`）** · 类型: 真能力缺口（通用质感·不可重组）
> - REQ-UI-Label大号字 · [2026-06-26] · PG 同步（UI 库域·主页比例对齐撞到） · status: **✅ done（主程·Label.size xxl=28/xxxl=34）** · 类型: 真能力缺口（档位不足）
> - REQ-UI-Tabs每页签锚点 · [2026-06-26] · PG 同步（UI 库域·新手指导接线撞到） · status: **✅ done（主程 2026-06-26·`tabs[i].anchor` → nav 按钮 data-anchor·`tabs-anchor.test.ts`）** · 类型: 真能力缺口（不可重组）
> - REQ-UI-数字补间 / 富文本 · [2026-06-23] · Lead 登记（UI 库域） · status: **✅ done（owner 2026-06-25「都做完不要等·早晚需求」·下沉为 Label.tween / Label.spans）** · 类型: 真能力缺口下沉（manifesto 尺子已过）
> - REQ-UI-3缺口（变换/动画/拖放） · [2026-06-23] · Lead 主导（UI 库域·跨游戏重构前置） · status: **✅ done（声明式下沉·game-i 同提交）** · 类型: 真能力缺口下沉（manifesto §4 评审通过）
> - REQ-G-退役旧战斗核 · [2026-06-22] · owner→game-g 甲（combat 域 · 主程评审登记） · status: **✅ done（甲·5 步全清·单一真相·`8c6c2751`/`a0970248`/`d91221a3`）** · 类型: 技术债清理（双核/双屏并存 → 单一真相）
> - REQ-ARCH-MENU-DSL · [2026-06-21] · 框架级（PG-乙 转呈 · owner 拍板「提主程评」）· status: **✅ 主程裁决 2026-06-26：B 方案能力已就绪（LayoutNode + ActionSink 信号绑定·本 session 落地）·见下「主程裁决」** · 类型: 通用能力（已下沉·非单游戏 DSL）
> - REQ-LAUNCHER-EXIT · [2026-06-21] · program G 乙（owner→乙·实属 launcher 域·转交主程）· status: **✅ done（主程·launcher 部分）：返回收进齿轮菜单 `GameOverlayMenu` + `mount(el,{exit})` 退出钩子契约（game-g 经 {exit} 自接·故不为它叠返回钮）。game-g 设置菜单接退出项=乙** · 类型: 启动器 UX + 退出钩子
> - REQ-G-卦象结算加减 · [2026-06-21] · owner→甲（Game G·结算逻辑） · status: **✅ done（甲·`settleTurn` 战利品按今日卦象±·确定性·大吉+2…大凶−2·夹≥0）** · 类型: 战斗逻辑（结算期·甲域）
> - REQ-E-023 · [2026-06-18] · PE（Game E 小丑牌 · 牌库扩展总纲）· 框架级 · status: **⑥ 仅余 open（①②③⑤ done · ④ wontfix）** · 类型: 多个真缺口（逐项独立）
> - REQ-023 · [2026-06-09] · 主程4（Game F）· status: **wontfix（2026-06-15·重组覆盖）** · 类型: group-effect 集合写
> - REQ-F-064 · [2026-06-15] · game-f（Boss 技能）· status: **wontfix / done-covered（2026-06-15）** · 类型: 现有能力重组（非缺口）
> - PG-乙→甲 · [2026-06-21] · Game G · status: **✅ done（并入 REQ-G-退役旧战斗核·`a0970248`/`8c6c2751`）** · 类型: 战斗段死代码清理
> - REQ-G-战斗结构 · [2026-06-21] · design G → 甲 · Game G · status: **✅ 核心已实现（战胜硬币 50/50 + 3D + 玩家亲掷/AI自动）；stayPMul/续航门 随天罡地煞重设计再落** · 类型: 真缺口（结构性）
> - REQ-UI-fontPixel令牌 · [2026-06-27] · PI（game-i 展示台）→ 主程（引擎 UI 域）· status: **✅ done（主程·SHELL+Apollo 基座补 fontPixel 令牌·`font-pixel-default.test.ts`）** · 优先级: P3 · 类型: 令牌补全（小·非结构）
> - REQ-UI-引导可演示性 · [2026-06-27] · PI（game-i 展示台）→ 主程（引导/Overlay 域）· status: **✅ 已答（主程·非缺口·见下答复）** · 优先级: P3 · 类型: 问询（可演示性·非缺口）
> - REQ-FX-战斗特效抽象 · [2026-06-27] · owner → 主程（UI 库域 + 架构） · status: **✅ done（主程·两正交特效库·防开关爆炸）** · 类型: 真能力下沉 + 架构定调
> - REQ-UI-BUG-style属性引号截断 · [2026-06-28] · PI → 主程（UI 库域·render.ts 序列化） · status: **✅ done（主程 2026-07-01·根因=主题字体名双引号在 style="" 提前闭合属性→字体名一律单引号·修 9 处字体栈·`theme-font-quote-safe.test.ts`）** · 类型: 渲染正确性 bug（击穿已发特性）
> - REQ-UI-BUG-fx与绝对定位不兼容 · [2026-06-28] · PI → 主程（UI 库域·render.ts/layoutStyle） · status: **✅ done（主程 2026-07-01·x/y 在场时剥掉 fx 的 position:relative·absolute 赢·`ui-bugfix-fx-toggle-slider.test.ts`）** · 类型: 两 render-only 特性不组合
> - REQ-UI-BUG-Toggle视觉点击不更新 · [2026-06-30] · P3D（game-z 调试面板实测） → 主程（UI 库域·server.ts reconcile 焦点保护） · status: **✅ done（主程 2026-07-01·焦点保护只认文本控件·checkbox/radio 放行重建·`ui-bugfix-fx-toggle-slider.test.ts`）** · 类型: 渲染正确性 bug（控件视觉与状态脱节）
> - REQ-UI-BUG-Slider回调偶发undefined · [2026-06-30] · P3D（game-z 调试面板实测） → 主程（UI 库域·server.ts dispatch） · status: **✅ done（主程 2026-07-01·根因=dispatch 同绑 click+change·值控件非 change 事件不派发·`ui-bugfix-fx-toggle-slider.test.ts`）** · 类型: 健壮性 bug（脏值入回调）
> - REQ-Resource · 引擎底层统一资源(Resource)层：3D 资产走 2D 贴图同款资产管理路线 · [2026-06-30] · owner → 主程/Lead（引擎核心资产层域·跨 2D/3D） · status: **✅ Lead 评审通过（接受·扩现有 Asset 层非新建·归属 hybrid·A/B 定 B + 钉死共享契约消返工·2026-07-01）** · 类型: 引擎底层架构（资产管理统一）
> - REQ-UI-骰途逐像素 · LayoutNode 补 3 项通用能力（毛玻璃 / 衬线字体槽 / Image 透明度）· [2026-07-01] · P3D（game-d）→ 主程 · status: **✅ done（主程 2026-07-01·3 项全接受实现·`panel-glass-serif-opacity.test.ts`）** · 类型: UI 库闭集扩容（下沉成通用控件能力）
> - REQ-APOLLO-PROMPT-去手抄词汇表 · apollo.py 生成 prompt 改为全依赖自动 catalog · [2026-07-02] · 主程 → **指派：Opus** · status: **✅ 完成（2026-07-02）** · 类型: 防漂移收口
> - REQ-STUDIO-M0-库地基 · 创作台 v1（本地网页版）用户游戏库后端 · [2026-07-02] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-02）** · 类型: 产品化·新增（不碰引擎核）
> - REQ-STUDIO-M1-卡带架接库 · 创作台 v1 前端：玩家模式 + 数据卡带运行器 · [2026-07-02] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-02·Opus·返修后）** · 类型: 产品化·前端（不碰引擎）
> - REQ-STUDIO-M2-创作向导与迭代回路 · 创作台 v1 灵魂件：说一句创意→卡带 + 对话式修改 · [2026-07-02] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-02·Opus）** · 类型: 产品化（apollo.py+前端，不碰引擎）
> - REQ-STUDIO-M3M4-设置页与体检 · 创作台 v1 收尾：BYO key 设置 + 卡带体检 · [2026-07-02] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-02·Opus）** · 类型: 产品化（apollo.py+前端，不碰引擎）
> - REQ-PLAYBOOKS-十线手册 · 按 playbooks/index.md 起草各生产线接线图手册 · [2026-07-03] · 主程 → **指派：Opus** · status: **✅ done（Opus 2026-07-03）** · 类型: 文档（工作流基建）
> - REQ-STUDIO-DESIGN-设计先行创作流 · 创作台主工作流升级：讨论→分解→对齐→定稿→原型 · [2026-07-03] · 主程 → **指派：Opus** · status: ✅ **done（2026-07-03·Opus）** · 类型: 产品化（apollo.py+前端，不碰引擎）
> - REQ-CAP-三件下沉 · modifier-stack / timeline / save-port（owner 2026-07-03 全批）· 主程出图 → **指派：Opus** · status: ✅ **done（2026-07-03·Opus·三件各自提交全绿直推）** · 类型: 引擎 capability 下沉（正确性关键）
> - REQ-ARCH-SAVE · [2026-06-21] · program G 乙 · **作废（主程清池 2026-07-03）**：已被 save 端口下沉取代（302b196f·2026-07-03）
> - LEAD→PG · [2026-06-18] · Game G（Mesh3D 可选迁移）· **作废（主程清池 2026-07-03）**：超两周无认领·owner 清池令（可选迁移·game-g 自决·无动静）
> - REQ-024 · [2026-06-21] · PA · Game A · **作废（主程清池 2026-07-03）**：消费方游戏已删除（game-a）
> - REQ-F-062 · [2026-06-13] · 主策划（Game F）· **冻结（主程清池 2026-07-03）**：随 game-f 判决重开（owner 2026-06-25 冻结令）
> - LEAD→PF · [2026-06-14] · Game F · **冻结（主程清池 2026-07-03）**：随 game-f 判决重开（owner 2026-06-25 冻结令）
> - BUG-G-源泉徽标 · [2026-06-21] · owner→game-g 乙 · status: **done（乙回滚）** · 归档 2026-07-03（表现回滚·已结）
> - REQ-ARCH-COACH · [2026-06-21] · design G · status: **done（表现层·Lead `ac64e1c1`·验收 PASS）** · 归档 2026-07-03
> - REQ-E-022 · [2026-06-18] · PE · status: **done（引擎+接线 2026-06-18）** · 归档 2026-07-03（poker-eval isFlush/isStraight 派生事实）
> - REQ-E-021 · [2026-06-18] · PE · status: **done（引擎侧 2026-06-18）** · 归档 2026-07-03（Card.mods/retrigger per-card 附魔）
> - REQ-F-065 · [2026-06-17] · 策划 PF · status: **done（引擎侧 2026-06-17）** · 归档 2026-07-03（scaleByResource per-unit 异质缩放）
> - REQ-F-061 · [2026-06-13] · 主策划 · status: **done（2026-06-13）** · 归档 2026-07-03（Hitbox hp 条件门+处决）
> - REQ-UI-G牌组保真批（5 条）· [2026-06-27] · PG · status: **已评审·结案（1 接受 4 回驳·Tag.size+Tooltip.block）** · 归档 2026-07-03
> - REQ-UI-Gemini评审 · [2026-06-26] · Lead 评审 · status: **结案（C2/C3 done·余回驳/备案）** · 归档 2026-07-04（清池复核）
> - REQ-025 · [2026-06-25] · PA · 双人合作平台跳跃 · **作废（主程清池复核 2026-07-04）**：无立项消费方·新游戏先过 capability-plan 重提
> - REQ-G-诅咒地煞 · [2026-06-21] · design G → 甲 · **作废（主程清池复核 2026-07-04）**：被 REQ-G-地煞新op #4 同族参数化吸收（owner 暂缓原判保留）
> - REQ-G-说明同步 · [2026-06-21] · design G → 乙 · **作废重开（主程清池复核 2026-07-04）**：战斗模型大改中·doc26 将重写·收口后按新版重开一次做对
> - REQ-UI-Label深色令牌(ink) · [2026-07-01] · P3D → 主程 · status: **✅ done（随 web字体批 2026-07-02 落地·2026-07-04 结案归档；game-d 切换活并入 REQ-GAMED）** · 类型: UI 库闭集扩容
> - REQ-G-Boss-AI · [2026-06-21] · design G → 甲 · status: **✅ 实装+sim验证（2026-06-23）·结案归档 2026-07-04（活尾由 Player-AI 单 + design G 标定线接管）** · 类型: 真缺口（已闭合）
> - REQ-BASE-引擎卫生三件（tray 补注册+守护测试 / Card3D 清遗 / view.ts 死码删）· [2026-07-03] · 主程 → 指派：Opus · status: **✅ done（2026-07-03·Opus）** · 归档 2026-07-04（自粘连行拆出）

### REQ-PA-文档一致性五件 · PA 自查清单 Lead 裁决 · [2026-07-04] · PA 提报 → 主程裁决 → **指派：PA（施工 ①②④⑤）** · status: **裁决完毕·③ Lead 已亲改·①②④⑤ 待 PA** · 类型: 防漂移整改（PA 自查·全收）
> **Lead 裁决（2026-07-04·五条全收·PA 报告质量嘉奖——含自曝，正是要的审计文化）**：
> ① `docs/design/art-library-tags.md` 数字陈旧（4761 vs 实际 4892）· ② `art-library-handoff.md` 顶部总数自漂（29818 vs 30588）——**病根=手抄会动的数字**（机读真相铁律）。修法不是改数字：**改为「快照 YYYY-MM-DD」标注 + 一句「实时数以 `FreeArtLib/index.json` 为准」**；分类占比等分析性数字保留但一律挂快照日期。
> ③ 「PA」双义（asset-flow 的 PA=游戏创作者 vs 名录 PA=资产管理员）——**Lead 已亲改三处**：requests.md 池头术语注、asset-flow.md 标题与导语、CLAUDE.md 核心规则 2 措辞；历史条目不追改（池头注兜底）。
> ④ `docs/playbooks/assets.md` 缺批量入库线——**接受回填**（手册铁律：手册对产出负全责）：加一行「批量灌入共享货架 → `scripts/import-art-pack.mjs` / `import-emoji.mjs` → 登记 FreeArtLib index」+ 指向 PA handoff 细节。
> ⑤ `import-art-pack.mjs` 头注「仅 GitHub 可达」过时——PA 域脚本注释，顺手改（属 PA 例行维护，非「写代码」红线范畴）。
> 附思考：①② 这类数字漂移 docs-ref-guard 管不了（它只核路径）；**先用「快照标注」约定治本**，若再犯 ≥2 次，再议给 art 文档加核数脚本（数字 vs index.json 计数），现在不建（YAGNI）。

### REQ-QA-测试审计强化三件 · audit 分层判词 / bench p99+delta / 测试代码体检 · [2026-07-04] · 主程（CCGS 深读采纳·见 reference §八） · status: **✅ done（Opus 2026-07-04·门禁全绿 tsc/vitest 303f-2231t/build 均 0）** · 类型: 质量工具强化
> **spec（Lead 图纸）**：① `scripts/game-skill-audit.mjs` 输出分层：**红=已破不变量**（裸 Math.random/innerHTML/自写解释器）·**黄=缺失防线**（零测试/零能力接入/未登记），末行判词 token `AUDIT: PASS|WARNINGS|FAIL` + 对应退出码（0/0/1）。② ApolloBench 帧时轴补 **p99/max 判定**（均值绿尖峰红=CONCERNS·超标帧按帧号点名）+ 同场景 **prior 结果留档做 delta 回归行**（改善也记录）。③ 新脚本 `scripts/test-hygiene-check.mjs`：扫全部 `*.test.ts` 的真时间等待（墙钟 setTimeout/sleep/Date.now）、外部 IO（真 fetch/http）、裸 Math.random；**白名单放行有意用例**（fake timers/mock 合法）；判词 token+退出码。准则出处 `docs/playbooks/testing.md` 红线节。门禁全绿直推；涉 `src/bench`（主程域）按本 spec 施工不越范围。
>
> **✅ 完工摘要（Opus 2026-07-04）**：
> - **① `scripts/game-skill-audit.mjs`**：三层分类——🔴红（裸 Math.random/innerHTML/createElement 手写 DOM，进判词）· 🟡黄（零能力接入/零测试，进判词）· ⚠建议（既有 nakedFill 裸 bg 色，非红线·不进判词·不改退出码，予以保留）。末行 `AUDIT: PASS|WARNINGS|FAIL`；退出码 红→1、黄/绿→0。判词=任一红→FAIL / 无红有黄→WARNINGS / 全清→PASS。**「自写解释器」为人审项（capability-plan 评审）——合法小枚举 switch 与真绕引擎解释器无法可靠 regex 分辨（见 game-e/jokers.ts 经济结算 switch），不列自动红旗以免误报，已在脚本头注明。** 当前全库判词=FAIL（8 款游戏均有 createElement 等既有欠账·符合 engine-llm-readiness-review 记录，工具如实点名）。
> - **② ApolloBench 帧时轴**（`src/bench/apollo-bench.ts` 加纯函数 `computeFrameStats/measureFrameTime/frameTimeDelta` + `run-bench.ts` 接线）：墙钟测量每 tick，报 mean/p99/max，**均值绿而 p99/max 尖峰超预算（默认 1000/60ms）→ CONCERNS 并按帧号点名**；prior 留档 `bench-results/frame-times.json`（**gitignore**·墙钟按机器波动不入库），次跑出 **Δmean/Δp99/Δmax 回归行**（↑退化/↓改善/≈持平·改善也记录）。**确定性 hash 逻辑与五轴打分完全未动**（帧时独立墙钟维度·不进 total/退出码）。判词样例：`PASS game-f — mean 0.41ms · p99 1.77ms · max 2.20ms`；`Δp99 ↓改善 2.75ms → 1.77ms (-35.8%)`。
> - **③ 新 `scripts/test-hygiene-check.mjs`**：扫全部 `src/**/*.test.ts` 三禁（真时间等待/外部 IO/裸随机），白名单顶部数组注理由；自动豁免 fake timers·mock fetch。末行 `HYGIENE: PASS|WARNINGS|FAIL`+退出码（硬违规→1）。**存量违规清单**：仅 2 处裸 Math.random——(a) `src/skills/tier3/roster-round.integration.test.ts:258` 只作唯一实体 id、非测随机 → **顺手改确定性单调计数器 `reqSeq++`**（已修）；(b) `src/debug/debug.test.ts:70` 故意非确定的 test-flaky capability（被测对象就是 Math.random 制造的非确定，用于验 Recorder 抓非确定回放）→ **白名单放行**（换种子=去掉被测特性）。无真时间等待/外部 IO 违规。首跑收口=WARNINGS（仅 1 白名单例外）。
> - **点名测试**：`src/bench/apollo-bench.frame.test.ts`（7 例·合成数组测 p99/max 判定·尖峰点名·delta 三向·空输入·真引擎 measure）；roster 修改由既有 12 例覆盖仍绿。三工具均自证运行输出见上。

### REQ-DOCS-指针守护脚本 · 角色卡/手册/白皮书引用的路径·脚本名·agent 名自动核真 · [2026-07-04] · 主程（CCGS 参考 §七 裁决） · status: **✅ done（2026-07-04·Opus 施工·全套门禁绿）** · 类型: 防口径漂移基建
> 源起：CCGS skill 测试框架思想采纳（`wiki/skills/reference-claude-game-studios.md §七`）——工作流零件也要可测。capability 层已有 `registry-guard.test.ts`，文档层缺同款。
> **spec（Lead 图纸）**：`scripts/docs-ref-guard.mjs` 进 vitest：扫 `docs/roles/**` + `docs/playbooks/**` 里的 ①反引号包裹的 `docs/`/`src/`/`scripts/` 路径（存在性）②`scripts/*.mjs|py|sh` 脚本名（存在性）③agent 名（对照 `.claude/agents/*.md`）。白名单机制放行有意的示例路径（如模板占位符）。红=指哪个文件哪一行断了。本次角色卡验收人肉核了 58 处，固化成机器活。
>
> **✅ 完工（Opus 2026-07-04）**：
> - **落点**：`scripts/docs-ref-guard.mjs`（守护脚本·纯 node/fs·`node scripts/docs-ref-guard.mjs` 直跑）+ `scripts/docs-ref-guard.test.mjs`（4 例行为契约·含失败路径·随 `npx vitest run` 跑）。判词 `DOCS-REF: PASS|FAIL` + 退出码；红行格式 `<file>:<line>  \`<ref>\`  → <原因>`。
> - **扫描面（比 spec 略扩）**：`docs/roles/** + docs/playbooks/** + docs/qa/**`（qa 层 2026-07-04 新立·同属工作流零件文档，一并纳入）。检 ①路径引用前缀 `docs/`·`src/`·`scripts/`·`wiki/`·`.claude/`（存在性，含 `.claude/agents|skills` 路径=agent/技能存在性兜底）②agent/技能裸名近似拼写（对照 `.claude/agents/*.md` 去 .md + `.claude/skills/*/` 目录名，编辑距离=1 报错字/改名残留，精确命中放行）。修饰剥离：`path:line`、空格分隔的 `§x`/`L76`、`path/**`·`foo-*.mjs` glob、`src/{a,b}` 花括号展开、`a·b` 中点连写。
> - **白名单**：**0 条**。占位符（含 `<` `>` `YYYY` `xxx` `[category]`）走自动规则放行；显式白名单数组（顶部·带理由字段）当前为空——现 3 树内全部真路径引用都实指存在文件，无「规范外的有意示例路径」需登记。
> - **断链发现清单（本单主要价值）**：**0 处真断链**——264 路径引用全部命中真文件、agent/技能名近似检测 0 命中。首跑唯一红点 `src/{engine 非 assets,skills,games 逻辑}`（`docs/qa/specs/asset-manager.md:8`）经核**非断链**：是散文里花括号未闭合的口语化标注、非真路径 → 修的是**检测器**（未闭合花括号 fragment 略过），未动文档。另修正初版误判：`scripts/dist.py`·`scripts/*-smoke.py`·`scripts/studio-*` 等一度被当「CCGS 侧示例·Apollo 无此文件」入白名单，实测这些 `.py` 脚本**真实存在**（早前 `ls *.mjs` 过滤漏看）→ 已移出白名单、由存在性检查自然放行。**留给 Lead 裁的项：无**。
> - **门禁**：`tsc --noEmit` 0 · `vitest run` 0（302 files / 2228 tests）· `npm run build` 0。

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

### REQ-GAMED-数据驱动迁移 · game-d《骰途》从手写 sim 迁成能力驱动（体检整改）· [2026-07-02] · P3D（game-d owner）→ 主程（引擎能力域） · status: **部分自办 + 缺口待主程** · 类型: 架构整改（数据驱动收口）· 设计 `docs/design/game-d/data-driven-migration.md`
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

### REQ-G-谁打谁·战前锚场 + 战后场上标结果（对决可读性）· [2026-07-03] · owner → 程序B（表现·程序A 供数据·已足） · Game G · status: open · 优先级: P1 · 类型: 演出可读性（非新数值）
> **owner 2026-07-03**：「现在看不清楚谁要打谁就开始了」+「结算完以后，把击退/结果标在牌型展示上·我知道谁打了谁」。现状 `showClashCue`（game-g.tsx:395）是**全屏 VS 弹窗**闪 ~2s——脱离真实棋盘、看不出是场上**哪两枚**在打；结算结果也只进特写框（owner 反复说「结算框看不清」）。
> **程序A 判断（本 session）**：这是纯**表现/演出**，逻辑侧数据已全出、无需程序A 新增——`advanceMovePhase` 返回的 `pending` 路 id = 战前哪几路要掷命、每路前锋两枚可由 `colOf(lane, a/b)[0]` 取；`lastClash`/`clashLog` 出 `a/b`(含 `id`)、`aWins`、`winStays`、`loserVacatedSlot`（胜者推进后的 slot 即在场上兵位上）。程序B 只读播、不改结果。
> **程序B 待做**：
> ① **战前·锚在真实棋盘**（替/补全屏弹窗）：移动相滑到位后，对每条 `pending` 路把**将交战的两枚场上兵**（锚 `u-<id>`）高亮/描边 + 二者之间画连线或悬「VS」标（我橙敌蓝·沿用 cue 配色），让 owner 一眼看出是**场上哪对**要打，再切/叠掷骰特写。全屏 VS 可保留作二级强调，但主可读性锚在场上。
> ② **战后·结果标在牌上**：掷命结算毕，胜者牌上钉「胜·推进/戴冠」、败者「斩/败」标（与 REQ-G-满仪式 §战场阵亡/胜利 VFX 同族·同一批做）；被击退/推进用场上滑动位移表达（见上条 REQ-G-碰撞才战斗 §程序B②）。标记短暂驻留可回看，不塞进结算框。
> **A/B 接口**：全在 `pending`(战前路 id) + `lastClash`/`clashLog`(战后 a/b/id/aWins/winStays/slot)。程序B 不需程序A 改逻辑。

### REQ-G-修正栈迁移并虚胖清算 · 天罡/地煞迁 t2-modifier-stack + 空头卡实装 · [2026-07-03] · 主程 → **指派：甲（game-g 战斗域）· 排队：接战斗心流 Phase 工作完成后开工** · status: **排队中**
> owner 2026-07-03 拍板：不打断当前核心工作，完成后照本单施工。**一单双得**：P0 产品 bug（18/36 天罡零效果、141/156 地煞纯文案=玩家买到空头卡，评审 §六.1）+ 新能力首战 dogfood。
> **spec（Lead 图纸）**：① 天罡 TENGANG_OPS 18 已实装 op + 地煞 DISHA_SPECS/DISHA_MERGE 迁移为 `ModifierSource` 行数据 + `aggregateModifiers` 纯函数核消费（夹具已证全覆盖，见 `src/skills/tier2/modifier-stack.test.ts`）；删 game-g-build.ts/disha.ts 两套自写解释器（tengangFxOf/aggregateDisha）。② 未实装的 18 张天罡（tempo/lane/arcane/擒王）与地煞文案：**能用 ModifierSource+现有字段表达的实装之，表达不了的从卡池摘除或标注未解锁**——出货前空头卡清零是硬标准。③ 概率门/顺序交织类效果按聚合栈边界文档留在原路径（modifier-stack.ts 头注）。④ 迁移前后战斗结算数值必须逐用例一致（现有 28 个测试文件全绿 + 天罡/地煞逐张对照测试）；`node scripts/game-skill-audit.mjs game-g` 能力接入面应 +1。门禁全绿直推。
> 两个小瑕疵顺手带掉：modifier-stack describe 里 floor=下限钳语义写明白；同字段混用 or+数值算子的静默忽略加一行 warning 或文档。

### REQ-G-演出迁时间线 · game-g 演出编排迁 t3-timeline · [2026-07-03] · 主程 → **指派：程序A · 排队：接战斗心流 Phase 工作完成后（与其自然衔接）** · status: **排队中**
> `t3-timeline` 已下沉（tick 制确定性 cue 调度器·skip 终态一致已测钉死），正是为 game-g.tsx:433-533 那 ~300 行手写演出编排（banner→cue→掷骰→结算时序）而生。
> **spec（Lead 图纸）**：① 演出时序改 `Timeline` 数据（cue 闭集：signal/flag/resource/spawn），advancePerf/playPerf 手写状态机退役；表现层（浮层/动画）订阅 timeline 发的信号自行演。② 跳过演出（玩家加速）走 `skipOnSignal`（确定性快进，勿自写跳帧）。③ 战斗心流 Phase 新增的演出节拍直接用 Timeline 表达，别再扩手写编排。④ 参照 registry 条目 examples 与 `docs/playbooks/events-logic.md` 演出时序节。门禁全绿直推。

> 【衔接备忘 2026-07-03】P3D 的 game-d 接线单（REQ-GAMED：dice-roll 接入/detectPattern 真替换/per-run 种子/打回三条）同样为**排队态**——接现 3D 渲染线核心工作完成后开工，优先级由 owner 调度。
---

### REQ-G-动作模型-三行为自由 · [2026-07-03] · design G → 程序A(逻辑+AI)+程序B(UI) · Game G · status: **逻辑+AI done（程序A 2026-07-04 核实：大类互斥退役·canAct 仅看费用·turn-combat.ts:129-131；swapCard 换牌硬帽1次+免费已实装+测试覆盖 turn-combat.test.ts:50-66；player-ai.ts 已枚举 swap 枢纽 line 117/172-179）／ 程序B 四选一→三行为自由混 UI open** · 优先级: **P0（owner 拍板·核心回合模型改·压 sim/标定）** · 规格: `design/24-turn-based-combat-model.md §二`
> **注（2026-07-04 程序A）**：`discardCard`(弃牌返0.5源泉) 仍在（game-g.tsx:594 玩家UI + player-ai 标 `void`未进搜索）——这**不是**本单要退役的"免费纯弃牌"(那个已被 swap 取代)，是另一条 0.5 返费续航微操，是否保留/进 AI 搜索归 design G 裁决。

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

### REQ-G-退役机关门 + Boss自由混 · [2026-07-03] · design G → 程序A(逻辑+AI)·程序B(删门UI) · Game G · status: **逻辑 done（程序A 2026-07-04 核实：门整套已删·turnHash 无 g 段·城门令出池 36→35·aiDecide 已同规则自由混无门决策·Boss 无换牌·player-ai 无门枚举·turn-combat/turnmatch 20 测绿）／ 程序B 删门UI open ／ design G 关1重标 open** · 优先级: **P0（owner 拍板·地基清理·解锁关1对称标定）** · 规格: `design/24-turn-based-combat-model.md §三` + `balance-philosophy-fairness.md §五`
> **程序B 待清（门 UI 死引用·2026-07-04 程序A 巡出）**：`turn-battle-screen.ts:705`（放牌后翻门 toast）+ `:789`（deploy sub-label「放完可点机关门翻门调度」）· `overlays.ts:35/41`（帮助文案「可顺手开关机关门 / 机关门换路」）· `sound.ts:14-15`（`gateOpen`/`gateClose` 死音效定义）· `campaign-data.ts:80` 注释（无害）。逻辑侧已无门·这些仅残留表现文案/死音效·程序B 一并清。

> **owner 2026-07-03 两条**：① **机关门/换路整套退役**（不给乐趣·高复杂度低价值·旧实时CR遗留）；② **Boss 也一开始就自由混**（对称同规则·Boss 无换牌·难度只来自明牌 kit·不靠给 Boss 降规则）。
> **程序A（逻辑）**：
> 1. **砍机关门整套**：删 `turn-combat.ts` 的 `GATES`/`gatesOpen`/`gateMove`/`toggleGate`/`tryGate` + `advanceBoth` 里门分流(diverted) + `deployUnit` 的 `gateToggle` 参数 + `turnHash` 的 `g<gates>` 段；**天罡「城门令」从 36 池摘除**（或标退役·`game-g-build`/天罡数据）；AI(`aiDecide`) 去掉开/关门决策；`player-ai.ts` 去掉门相关枚举。清理相关测试/golden（有意行为改变·报告说明）。
> 2. **Boss 也自由混**：`aiDecide`/`aiTakeTurn` 去掉"每回合单大类"的稳定基线限制（你上轮注释标的开关）→ **Boss 与玩家同规则自由混 抽/打**。**Boss 无换牌**（换牌是玩家专属 QoL·别给 Boss）。
> 3. **确定性**：turnHash 回归照绿（删门段是有意改变·更新断言）。
> **程序B**：删战斗屏的机关门 UI（门钮/门态渲染）。
> ⚠ **design G 连带**：Boss 自由混后关1 公平配置从 54%→~14%（Boss kit 值 ~36 分）→ **design G 用"双方自由混"重跑·把关1 Boss kit（布防 4→2静守 + 地煞 + 牌力偏置）减弱到玩家 ~70%**（教学关本就该弱·见 `balance-philosophy-fairness §五`）。**程序A 改完 → design G 标定。**

---

### REQ-G-战功系统 · [2026-07-03] · design G → 程序A(逻辑·钩子+modifier)·save(save-port)·程序B(收藏屏可视) · Game G · status: **排队（收藏打磨·核心战斗稳后开工）** · 优先级: P2 · 类型: 真缺口→下沉通用"老兵/资历里程碑"能力 · 规格: `design/veteran-merit-战功.md`

> **owner 2026-07-03**：战功系统——每张收藏牌隐藏累计"战场战胜次数"(kills·增收藏属性)；**kills≥108 → 战力永久+1**（108=天罡36+地煞72=水浒星宿·非拍脑袋）。
> **CORE RULE**：接受·收藏情感钩子 + "用出来的强"养成轴（区别地支/deckBias 的货币养成）。**数据驱动·不写专属码**——三块现成拼：① 每牌持久 `kills` Resource（存档·`services/save`）② `resolveClash` 胜者 kills++ 事件钩子（小·确定性）③ 满108→+1战力 复用 `t2-modifier-stack`（`{target:战力,op:add,value:1,gate:kills≥108}`）。= 通用"任意牌·累计任意事件·到阈值触发修正"系统。
> **决策（owner OK）**：战场HUD不显·收藏界面可看；先单里程碑108(阶梯后续可选)；仅玩家收藏牌累计(Boss每关新16牌不累)。
> **平衡**：慢(108杀≈25-35场/牌)+小(+1战力)=温和creep·sim当一档养成favor建模·真奖励是荣誉/收藏故事。
> **排队**：与战斗核正交·排核心(动作模型/AOE/经济/玩家AI)拍死后开工·别往正动的地基加零件。
