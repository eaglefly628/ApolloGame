# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停·**编号唯一：开单前 grep 同名防重号**——2026-08-08 game108 GD-01 重号复盘）；3D 线写 `requests-3d.md`；已完结条目删除留 git 历史。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交删除条目腾槽·全文留 git 历史**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### REQ-DOKI-APPS · 「获取卡带」下沉共享接线层（`apps` 模块）· [2026-08-15] · owner 令「把 SDK 需要的都集成进去」 · **施工主体 = 本 session（本行即占锁）** · 复查 = 主程 · status: in-progress · P1 · 类型: 跨游戏共享面（🔴 按归属律本属主程·owner 直接派工故抢锁留痕）
> **实查**（协议第一步·真包 `@dokiworld/app-sdk@2.1.0` d.ts 非文档手抄）：`./apps` 就是「获取卡带」——
> `list(filter?:{capability?}) → {apps: AvailableApp[]}`（`{id,name,description?,coverUrl?,protocolVersion}`）+
> `launch({appId,input}) → {status:'completed',output}|{status:'cancelled'}` + `dispose()`。
> **回驳「九模块全塞进 game108」**：① 手册红线「只声明真用到的」（match3 多声明是反例）
> ② game108 是 Game 形态，`apps`=「App 里开 App」在 RPS 对局里没有消费位置——编排者是 Episode World
> ③ 规范 §7 五步一致 + 「未声明的扩展消息会被拒绝」。
> **正解 = 下沉共享层**：`dokiworld/` 现在只有 `game108/`、**无共享层**，第二个 app 出包会把
> `foe-card`/`checkpoint-codec`/`host-harness` 抄一遍。故建 `dokiworld/shared/`：`apps` 封成带
> 超时/降级/dispose 的薄适配 + 点名测试 + 真 `createAppsHostExtension` 假宿主目击。
> **边界**：只新增 `dokiworld/shared/**`；**不动** `dokiworld/game108/` 的 manifest 声明与接线
> （封装 ≠ 声明——谁消费仍按各 app 真用到的声明）。
> **能力已交（2026-08-15）**：`dokiworld/shared/`（新目录·首件）——
> `src/apps-gateway.mjs` `createAppsGateway(client,{declared,timeoutMs,launchTimeoutMs,onWarn})`
> + `appsDeclared(manifest)`；`tests/apps-gateway.test.mjs` 9 条 **不 mock SDK**
> （把 SDK 自己的 `createAppsHostExtension` 接在内存双工通道另一端，走真 `dokiworld-app-apps-*` 报文
> 与真校验器）；四处撤修各自即红已实跑（去掉未声明拦截 / `list` 改抛 / `cancelled` 并进 `unavailable` /
> 把 launch 超时磨平成 list 那档）。
> 手册 `dokiworld-pack.md` 已回填一行 + 共享层约定；`dokiworld/game108/` 一个字节未动（封装 ≠ 声明）。
> **三条纪律**（全来自 SDK 源码实读）：① 未声明就不发（未声明消息被拒的形态是"静默等到超时"，
> 最难查的那一类）② 降级不抛，`cancelled` 与 `unavailable` 分开报 ③ `launch` 超时一小时不是 30 秒。
>
>
> **⚖ owner 2026-08-16 判（Lead 转录·压过施工方「推荐 B」）**：**game108 当第一个消费者——结算屏加入口**。
> 打完一局结算屏出「换个游戏玩」推荐位（`apps.list` 拉列表·点了 `launch` 跳转）；game108 manifest 随真消费加 `apps` 声明（五步一致）。
> 共享层已交付 ⇒ 本单余项 = game108 结算屏接线（施工方续做·薄接线零规则·推荐位 render-only 不进 sim/hash）+ 主程复查。
>
> **后续①（🔴 主程面·随本单一起复查·不另占硬槽——池子 10 槽满）**：**`dokiworld/**` 的测试跑在没人跑的地方。**
> 实查：`scoped-gate.mjs` 全文无 `dokiworld` 字样；出包 job（`main_entry/packaging.py:_pkg_build_dokiworld_app`）
> 只 `npm ci` → `npm run build`，**不跑 `npm test`**。于是 `dokiworld/game108/tests/*`（24 条）
> 与新增的 `dokiworld/shared/tests/*`（9 条）**没有任何门在验**——写了测试而没人跑，
> 与「从来就没对过」同形（本轮 game108 AI 恒石那条的教训）。
> 建议：`scoped-gate` 改动面命中 `dokiworld/**` 时，在受影响的 app 目录追加 `npm test`
> （缺 node_modules 才 `npm ci`·同出包 job 口径）。落地前手册已写死「改这些目录必须手跑」。


### REQ-S18PANEL-开发面板补 S1–S8 八关 · 控制台把「立项→对齐→生成」压成了「生成」一步 · [2026-08-16] · **owner 令**（原话：「我需要这些都有一个 S1 到 S8 的按钮，在我的开发面板上……因为我这要开发给用户用的，不能采用老路子了」） · status: **open·待派工** · 优先级: **P1** · 类型: 流程软件（面板 + 门）

> **病（owner 实撞·2026-08-16）**：用叠叠乐 Demo 走了一遍，撞出同一根因的三个症状——
> ① 生成的玩法文档/提纲**没有存盘按钮**，关掉界面就没了；
> ② 识别出 6 条引擎缺口，但**主按钮只有「生成游戏 Demo」**，缺口无处对齐；
> ③ 中间态的策划案**没有上传/建目录的入口**，够不到 `docs/design/<slug>/`。
> **一个根因**：流程板从 S1 起步，而控制台的「生成」是从 **S3 骨架**起步的——
> **S1 立项卡 / S2 能力计划在面板上根本没有落点**。
>
> **好消息：状态机不用造。** `node scripts/game-pipeline.mjs board <slug> --json` 已经把八关算全了：
> 每关 `{id,title,handbook,gate,machine,review,human,status,outOfOrder}` + 顶层 `next`。
> **面板 = 这份 JSON 的直接渲染**（八个按钮 + 每关两盏灯：机器门 / 复查门）。
>
> **缺件三条（按归属分好）**：
>
> | # | 要什么 | 归属 |
> |---|---|---|
> | ① | **S1/S2 落点端点**：`POST /api/projects {slug, brief, gdd?, gaps?}` → 建 `docs/design/<slug>/` + 落 `brief.md`/`gdd.md`/`capability-gaps.json`，并 `_ws_sessions_save(slug,…)` **把当前对话认领过去（从此不丢）**。按钮名「存为项目」 | 🟡 PST（`main_entry` 面板 + 服务） |
> | ② | **S2 机读缺口产物 + 门**：`capability-gaps.json` = `[{id,title,priority,route,state,ticket,blocks[]}]`；`S2.gate` 由 `null` 改 `gap-check`——**所有缺口 `state ≠ open`（= 已被 owner 判过 A/B）才算 S2 过**，不许带未裁决的缺口往下走 | 🔴 Lead（`scripts/game-pipeline.mjs`） |
> | ③ | **`canEnter` 认缺口**：凡 `blocks` 含本关且未 `delivered` 的缺口存在 → 拦住并列出卡在哪几条。复用现成 `priorGaps`/`reviewGaps` 机制，不新造 | 🔴 Lead（同上） |
>
> **`route` 字段是必须的**（不是装饰）：缺口要分流到不同的池——`engine`（10 硬槽）/ `requests-3d`（P3D 独立池）/ `pui`。
> 叠叠乐那 6 条里 **4 条是 3D 线**，一股脑丢引擎池会当场撑爆槽位。
>
> **边界（防加宽）**：第一版**整关阻塞**即可（有未解 P0/P1 → 该关锁）。
> 「只阻塞依赖它的那部分」要 plan 把「哪条规则依赖哪个缺口」也结构化——**YAGNI，等真被粗粒度卡烦了再说**。
> 面板也**不做**缺口的编辑/裁决 UI，缺口裁决仍走既有协议（先查 → 摆 A/B → owner 判），面板只做**展示 + 跳转到工单**。
>
> **验收**：新建一个项目 → 面板显示 S1✅ S2⚠(缺口 6) S3🔒 → 点不动 S3 且告知卡在哪几条 →
> 缺口逐条判完 → S2 门转绿 → S3 才可点。**关掉浏览器再开，策划案与对话都还在。**

<!-- REQ-DIALOGUE-剧情基础线（P1·owner 令·转型关键路径）→ **2026-08-16 关闭出池**（不占槽·同 PIPESOFT/SPECTRACE/RENDERCHECK 先例：下一步触发者不在池内）：**M1–M4 四件全 ✅ Lead 对抗性验收毕**（2026-08-10·22 例独立复跑绿 + 双破坏锚点命中：撤 neutral 降级锚→恰 3 红、撤 weight 语义→加权测红；game-i 展台 audit + 棘轮 PASS）。**余项 = M4 Sample 示范游戏**，owner 已定与「亲测约会游戏试点」合流 ⇒ **触发者 = owner 本人**，挂池子里只会占槽空等。图纸唯一真相仍在 `docs/design/dialogue-line-blueprint-2026-08.md`（派工时照它）；四件的落点与判词全文查 git 历史 grep REQ-DIALOGUE。**owner 跑完试点带回反馈即重开本条。** -->

### REQ-ENGINEAUDIT-引擎全量评审落地 · 15 子系统深审（110+ 发现）· [2026-08-04] · owner 令 → **报告=唯一真相 `docs/design/engine-review-2026-08-04.md`** · status: **in-progress（P0 + 21 处已修推·门禁全绿；余 3 项见下）** · 优先级: P1（P0 已清·降档） · 类型: 引擎质量总账
> **已修并推（Lead·全部「先实证复现→修→撤修复验红」）**：批0 确定性护栏/注入面/voxel 崩溃 13 处（`0031b950d`/`3b8e2757c`/`29cf511ba`）→ **P0 lockstep 加入死锁**（`ce3903c1`·输入按 epoch 缓存·实测 A 停 2×inputDelay/B 停 inputDelay）→ 存档装配批（envelope checksum 覆盖持久化形态 · save 读档校验 fail-closed · manifest `__proto__` 拒收）→ sim 正确性批（card-pile 空出牌 · effect-apply NaN/mul 清零 · friction/ground-sense 漏过滤 Sensor=二段跳 · merge-on-place 撞名硬崩 · matrix-duel ≥3 死锁）→ owner 四裁（共用组件推断不猜+守卫 · 快照带创建序 · TS 卡带执行侧闸门）→ Sprite.anchor 真消费。
> **余下 3 项 → owner 2026-08-10 全分配**：②根因② **✅ done**（`e8a0b02c3`·150 组件运行时全集+NON_DETERMINISTIC⊆全集对账+漂移门双保险·Lead 双轮破坏亲验）。③Q1 **✅ done**（audit 进推送门只扫改动游戏+React屏/DOM逃生红旗进棘轮（存量灌基线可见豁免）+墙钟建议档+capgap CLI 断链修复（写落 `.zerocraft/`·CLAUDE.md 旧路径同步正）+pick-list 决策树·Lead 撤修亲验恰 2 红·三方剔除项确认未代裁）。**只剩①根因①** 🔴 主程亲做·**spec 已按深审证据扩充**（三方对账：申报 reads/writes vs 实际 getComponent/setComponent vs 相位落桶 + 成环告警棘轮——A1 探针4/5 实证：相位错位 acceptance 全绿纯靠注册序巧合、告警每趟 12~58 条无人收割）。
> **📌 根因① 上线时必然命中的第一条（主程 2026-08-07 自陈·别让它随游戏工单归档丢掉）**：
> `t2-matrix-duel` 的结算系统自 `e3a568fb`（REQ-108-ENG-01）起**在运行期读 `Resource`**（`resolveDamage` 取缩放源），
> 而系统 `reads` 里**没有申报**，且 `matrix-duel.test.ts` 还断言 `settle.reads).not.toContain('Resource')` 替这个不诚实背书。
> **是我那次扩写造成的**（此前它确实不读 Resource）。**实测**：诚实补上申报会当场闭合环
> `[resource-apply, self-rule, matrix-duel]`（闭环组件 Resource/ResourceModify），而 CYCLEHAZ B 之后**只告警不抛**。
> ⇒ **⚖ owner 2026-08-16 判 C：根治——`ResourceModify` 加 `op:'set'`**（结算清零改 set 即不必读 Resource·环根本不形成·matrix-duel 撤不诚实断言改诚实申报）。🔴 全库最核心写入面=主程亲做专项（本条内跟踪·不另占槽）：spec=① `ResourceModify` 加可选 `op:'set'|'add'`（缺省 'add'=存量零变）② effect-apply/消费面接 set 语义+点名测试 ③ matrix-duel 结算改 set+申报诚实化+撤背书断言 ④ 全量门禁+验收剧本全绿。原三选项留档：~~A 诚实申报~~（每个含这三系统的世界常驻一条环告警）·
> **B 维持现状记债**（守卫一上线就报它）· **C 给 `ResourceModify` 加 `op:'set'`**（清零就不必读 Resource，
> 但那是全库最核心的写入面、影响每一款游戏，须另开单）。判词与实测原文见 `docs/design/game108/review/REQ-108-ENG-04-05-06.md` §五。

> **已转派/已裁**：UI 契约批→PUI（已完结）· 渲染专项→P3D（`REQ-3D-RENDERHYG` 在 3D 池）· **根因④ 受信执行环境→owner 2026-08-05 令搁置**（未理解·待重讲后再定）。

<!-- REQ-UICONTRACT-UI 契约批（P1·引擎评审 §6⑨）已完结：PUI 三条（modalClose/comboClick 补 ActionSink 回退 · 键控锚点改 firstContentAnchor · 动效扫描抽 initDynamics 幂等且 mount/update 各扫一次）+ Lead item④（Sprite.anchorX/Y 抽 spriteAnchorOffset 纯函数真消费）全部落地。Lead 对抗性验收 PASS：6 例守卫独立复跑绿·撤 update 侧 initDynamics 实测转红 2 例·撤 item④ 修复转红 2 例。P2/P3 尾巴（bindings 不递归 node props / layout-solver 忽略 cols / typewriter+emoji 掉字 / apollo-kit 像素字体退化 / onboarding 缩放错位…）按报告 §5 原文另清·不占槽。全文查 git 历史。 -->

<!-- REQ-STATUSSET-资源见底置状态位（game107 带出）→ **owner 2026-08-05 令废除出池**：107 尚未开工·无现役游戏被阻塞·不该占引擎硬槽。**spec 原文完整降级存 `docs/design/game107/requests.md`**（不占槽），107 真开工时先按核心规则重核「能否用现有闭集重组」再决定升回。 -->

<!-- REQ-CARTART-卡带美术存储归位（P1·PST 提·owner 选方案 b-full）→ **2026-08-06 Lead 追认越界·结案出池**：两处跨域改动（`scripts/art-replace.mjs` 写盘落点 + `scripts/art-ledger-guard.mjs` 发现口径/台账根）**均予追认**——改法正确（都收敛到单一真相 `artRoot`，没有另起一套口径）、面最小、与 Python 侧 `paths.py::art_root` 同源。**追认时实证撞出并已修一处真 bug**：`art-replace.mjs` `fill` 的「无台账」错误分支把 `ROOT` 写成了 `root`（`run()` 内无该绑定）→ 撞上无台账的游戏不是干净报错退出而是 **ReferenceError 崩栈**；已修 + 补 2 例子进程 CLI 守卫（原 47 例单测全走导出函数，够不着 CLI 分支）·撤修复实测转红 1 例。复验：cartridge-art-smoke 18/18 · art-ledger-guard WARN(exit 2·gate allowExit 内·两条死账为既有存量) · scoped-gate scope=full 全绿。**留尾不占槽**：①`pipeline.json` 仍落 `public/games/<slug>/`（不在 art/ 下·消费方是生产板另一条线）②JS `artRoot` 用 `existsSync` 而 Py `art_root` 用 `.is_dir()`——`library/<slug>` 若是文件则两边分叉；判定不可达（需手工在 library 下造同名文件），记债不修。图纸全文 `docs/design/cartridge-art-storage-2026-08.md`。 -->

### REQ-ARTGUARD-黑户判据认索引记账 · 62/65「黑户」是假阳·把判词钉死在 WARN · [2026-08-06] · PST 提（owner 认可）· status: **open（待 Lead 裁 + 派工·守卫属 Lead 独占域）** · 优先级: P2 · 类型: 守卫判据修正
> **实证（非推测·2026-08-06 实跑）**：全仓 65 个黑户里，**62 个在各游戏 `art/index.json` 有完整来源登记**——game-a 的 55 张是 CC0 vendored 扑克（`license:"Public Domain"`·`source:"notpeter/Vector-Playing-Cards"`·`provenance.pulledFrom` 精确到源 URL·`status:filled`，游戏正靠 `cardAssetId()→索引` 消费），game-103 的 4 个 fx 同样三件齐，game-c 的 1 个有 provenance。**真正无账的只有 3 个**（game101 superpowers faceset·索引里也没有·已落 `docs/design/game101/requests.md`）。
> **根因**：`blackHouseholdFiles()` 只拿 `art-ledger.json` 的 servedPath 做 covered 集，**完全不读 `art/index.json`**。于是"记账在资产索引、不在需求台账"的合法 vendored 资产被永久判成黑户 → 判词长期钉死 WARN、**真信号被 62 条噪声淹没**；且这 65 条已全部写进棘轮基线 `scripts/art-ledger-baseline.json`（game-a:57/game-103:4/game101:3/game-c:1），等于把噪声固化了。
> **建议判据（Lead 裁）**：文件不算黑户当满足其一——① 被台账行 servedPath 覆盖（现规则不变）；② 在该游戏 `art/index.json` 有 `path` 命中的条目**且有来源登记**（`provenance` 对象存在 **或** `license`+`source` 齐）。落地后同步**瘦身基线**只留真黑户（棘轮只紧不松）。
> **明确不做**：给 55 张扑克逐张编台账号——违背 owner「一行=一种素材」去重原则，它们不是 55 个独立美术需求而是一副成套 vendored 牌面。
> **⚠ 追加实证（2026-08-06 owner 实战踩坑带出·同一守卫的第二处构造性假阳）**：`SKIP_DIR_PREFIXES = ['orig','ai/pending']` **不含 `gen/mock`**。而 mock 产物按设计**永远不上台账**（「mock 永不写回·不登别名·不可 approve」是手册红线）且已被 `.gitignore` 挡在仓外——**它必然、永久地被判成黑户**，判据与设计直接打架。owner 在 game108 点单槽重生成、无 key 回退 mock 后，资产浏览器把 `/games/game108/art/gen/mock/art-15.png` 标成「⚠ 黑户」并提示「拖入登记补建 provenance」——**照做就等于把 mock 钉进游戏**（手册明令的事故形态）。故本单加一项：`SKIP_DIR_PREFIXES` 补 `gen/mock`；浏览器对 mock 命名空间应显「⚙ MOCK 预览物·不可登记」而非黑户+登记指引。
> **需 Lead 权衡的取舍**：认索引记账 = 把"记账可信度"下放给 index.json（与台账同信任级）。好处是判词恢复可用；代价是伪造索引条目也能过——但那与伪造台账行同级，且需留下 license/source 痕迹。另：`SKIP_DIR_PREFIXES` 已含 `orig`/`ai/pending`，备份目录不是新假阳源（已核）。
> **验收**：改后全仓黑户从 65 → 3（且这 3 个正是 game101 那单要清的）；判词随之可回 PASS。

### REQ-S3CLICK-骨架关加「点击打穿」机器门 · [2026-08-07] · owner 判 **A** · status: **in-progress** · **施工主体 = 策划 session（本行即占锁）** · 复查 = 楚晨 · 优先级: P1 · 类型: 流程门

- **病**：S3 骨架关全程**一次都不点**（机器门 = manifest + 装载 + 空跑 2 拍 + 渲染探针）。
  于是「按钮画得好看但点了没反应」能一路绿着过 S3——game108 实测踩到两发，都不报错：
  ① 宿主自搓 rAF 圈直接 `world.tick()`，绕过 `Engine.step()` 里注入输入那一句 ⇒ 队列一直填、没人取；
  ② `props.bind` 没跑 `resolveBindings` ⇒ 进度条永远画在 0，文字却是对的。
  **单测绿（自己往队列塞）+ 渲染探针绿（只画图），只有真点才露馅。**
- **同病史**：owner 2026-07-17「**绿门不可玩**」复盘的药方是给 S4 加验收剧本，
  **S3 这层的洞当时没补** ⇒ 同一个病换个位置又犯。
- **界**：S3 问「信号打得穿吗」（点一下世界动没动）；S4 问「规则对吗」（打穿之后赢的是不是该赢的）。
  接线断了属于骨架，不属于玩法——推给 S4 发现的话，验收剧本跑不动时分不清是规则错还是线没通，排查成本翻倍。
- **做法**（owner 判 A·最小断言）：S3 门追加通用点击探针——扫活体 DOM 的 `[data-action]` 控件逐个点，
  断言 ① 至少有一个点完 DOM 真的变了 ② 全程零控制台 error。**不验玩法、不需要 AI、不需要结算闭环。**
- **不回溯**（owner 2026-08-07 明示）：现存游戏进**可见的**豁免名单（照 `pipeline-registry-guard`
  的 `LEGACY_NO_BOARD` 先例·名单带理由·非静默跳过），**新游戏受检**。
- **边界**（复查门核对用）：`scripts/click-probe.mjs`（新）+ `scripts/game-pipeline.mjs` 的 S3 门读码一处
  + 其单测。**不碰**别的阶段门、不碰渲染探针、不改任何游戏。

<!-- REQ-108-ENG-07（我 2026-08-08 开的「全局条件→扣指定一侧血」引擎缺口单）**已撤销·不占槽**：
     ① 编号撞车——该号早被「结算门下的 intent 生命周期」占用（我开单时只 grep 了本文件，没扫 gdd.md）；
     ② 举证经主程实查**证伪**并回驳 wontfix——`t2-self-rule` 的 `whenGlobal`（全局 id 求值）+ `do`（施于自身）
        两头都有，等价数据写法与证明测试见 `src/skills/tier2/self-rule.test.ts`「罚血形态·回驳证明」3 例。
     2026-08-08 已按该写法接线完成（game108 罚血真扣血·验收剧本 12/12 绿）。全文查 git 历史与
     `docs/design/game108/requests.md` 的回驳单。**教训：开单编号前扫全套 docs/design/<game>/*.md，不只扫 requests。** -->

### REQ-UIFX-2D 表现件补齐：**UI 层粒子对位 3D** + **液面件** · [2026-08-08] · owner 令（game108 设计定稿 v3 带出） → **指派：PUI**（`src/ui/**` 是 PUI 域） · status: **open** · 优先级: P1 · 类型: UI 基座扩件（render-only）

**起因**：Claude Design 给 game108 的 v3 定稿里有两样表现，**闭集里现在做不了**。
owner 2026-08-08 判词：「这是个偏美术的东西…粒子拖尾以前我们在 3D 里面实现过，所以应该是能做的…
**我也不希望你用它的这个每一帧换新皮的锁死的方法**。」——即：**不许游戏层每帧生成新贴图绕过去**，
该由渲染器承担的动画就交给渲染器，游戏只给静态数据。

#### ① 先查（实查·留原文）

| 查了什么 | 结论 | 出处 |
|---|---|---|
| UI 闭集 `Particles` | **只有 4 个预设 kind**（confetti/coins/stars/sparkle）+ `count` + `loop` + `follow:'cursor'`。**没有颜色、没有方向/目标、没有尺寸、没有拖尾** | `src/ui/components/types.ts:377-386` |
| 同件的自述 | 「UI 层发射器（**世界层对等件=Vfx3D**）」 | 同上 :375 |
| 世界层 `Vfx3D` | **已经是 Niagara-lite 闭集发射器**：`rate/lifetime/shape(point\|cone\|sphere)/coneAngle/speed/gravity/drag/attractor/size/sizeCurve/color/colorGradient/blend` | `protocol/components/render.ts:494-521` |
| 3D 拖尾 | **已有 `Trail3D`**：`segments/width/color/minDist/fade/blend` | 同上 :526-534 |
| UI 闭集里有没有液面/波纹/按父圆角裁剪 | **一个都没有**（`liquid`/`wave`/`clipChildren`/`overflow` 全库零命中） | `types.ts` 全文 grep |
| `ProgressBar` | 已有 `value/max/tone/shape('bar'\|'ring')/size/bind` —— **形态轴已经开着**，加一档是同族扩写不是新件 | `types.ts:362-372` |

**⇒ 不是「能不能」的问题，是「3D 有、UI 层没有」。** owner 说的「3D 里实现过」经查属实，
UI 层那个同名件只是个四预设的门面。

#### ② 要补的两件（都是 render-only·不进 sim/hash）

**A · `Particles` 扩写到与 `Vfx3D` 对位**（**主项**）
定稿要的原文：「14 颗射出，直径 12–30 六档，芯白 → 牌色 → 牌色 75% 径向渐变，外挂 26px 同色光晕 + 5px 白描边；
先向上窜 90px 再俯冲，飞行 600ms、每颗错开 36ms；落点一记 200×130 的同色落地光晕」+「**加拖尾**」。
缺的轴（照 `Vfx3D` 的既有命名，别另起一套）：
- `color` / `colorGradient`（现在粒子色写死在预设里）
- `size` + 尺寸分档（定稿要六档 12–30）
- **方向与目标**：`shape:'cone'` + `coneAngle`，以及**飞向某个 LayoutNode**（可复用已有的锚引用
  `AnchorRef{kind:'node',id}`——`layout.flyTo` 已经在用同一套寻址，别新造第三套）
- **拖尾**：对位 `Trail3D` 的 `segments/width/fade/blend`
- `gravity` / `drag`（定稿的「先窜上去再俯冲」= 初速 + 重力，不是手写关键帧）

**B · 液面件 = `ProgressBar` 加 `shape:'liquid'`**（**同族扩写·不新增控件**）
定稿要的原文：「水面是**两条错频的椭圆脊**叠加：主脊 20px scaleY 1↔.5 且左右荡 ±3%（900ms），
副脊 16px 白 55% 反向荡（1250ms）——两条不同步才有晃动感，单条只会像呼吸。
整杯水挂 `rt3-slosh`：以杯底为轴 ±1.6° 摇（1300ms）。另有 **3 颗气泡**（16/11/20px，白 60–75%）
从底往上窜 210px，周期 1.5/1.8/2.1s 错开发。」
建议字段（沿用该件既有口径）：`shape:'liquid'` + `radius`（按盒圆角裁）+ `fillColor` + `wave?:boolean` + `bubbles?:number`。
**游戏只给一个标量 `value`**（水位）——四段过冲的曲线 game108 已经算好了（`POUR_KEYS`），
不需要引擎管；引擎只管「把这个水位画成会晃的水面 + 气泡」。

#### ③ 为什么不能在游戏层解决（= owner 那句「不许每帧换新皮」的技术面）

现在的注水是把水面**烤进卡皮的 SVG**（闭集控件没有"按父圆角裁剪"，只能这么做）。
要让水面逐帧形变，就得**每帧生成一张新 data-URI** ⇒ `mountUI` 判定 props 变了 ⇒
**整屏面板 outerHTML 全量重建 + `<img>` PNG 重新请求**——2026-08-07 实测踩过，
表现是**网络永远闲不下来、`networkidle` 直接超时**，真渲染探针跑不完。
所以这不是"偷懒不做"，是那条路本身有害。

#### ④ 边界（复查门核对用）

`src/ui/components/types.ts`（两处 props）+ `server.ts` 的渲染胶水 + 其单测 + game-i 展示台一格。
**不碰**任何游戏；game108 接上后把 `self-check/S5-design-v3-alignment.md` 的偏差 #1/#2 划掉。

#### ⑤ 同族小项（PUI 一并判·不做也不阻塞）

- `Label.tween` 期间**字号同步缩放**（定稿：伤害跳数时字号 .82 → 1）——现在 tween 只管数值。
- 一个 **steps 节拍**的 `anim`（定稿：罚血「−1」印章每秒跳一下 `steps(1,end)`）。

<!-- REQ-WAITUNTIL-验收剧本条件等待（P1·owner 2026-08-09 判 A·game108 复盘第五缺口）已完结：剧本步骤加 `{"waitUntil":[断言…],cap:N}`——断言复用 expect 闭集零新词表·先查后拍·封顶 FAIL 带已等拍数·waitedTicks 入 trace（同 seed 同轨连它一起比）·裸 tick 仍合法。主程施工（🔴 共享 harness）：schema+runner+13 例守卫·深车道点名跑绿（37 过·2 红=game-103 缺 adapter+game102 剧本漂移，经 HEAD 隔离 worktree 复跑坐实为存量且各有在案工单）·双撤修验红锚点命中（AND 语义反转→「多断言 AND 语义」红·撤 cap 校验→「cap 必填」红）。手册口径入 testing.md 验收剧本节；game108 迁移=REQ-108-GD-03（游戏自治·非强制）。spec 与判词全文查 git 历史。 -->

<!-- REQ-DEEPREVIEW-引擎底层深审战役（P1·owner 2026-08-10 令三轨全选）已完结：四路证据全回·Lead 终审毕。**体检报告全文 = `docs/design/engine-deep-review-2026-08.md` 体检结果节**（实证护住 6 面 / 裸奔 6 项已开单：REQ-GUARDGATE/DESYNC/SAVEORDER+根因① spec 扩充+3D 池 G211 单 / 记债 5 笔附理由）。战果：根因② 全集基准合入 e8a0b02c3（A1 探针当验收对照·当日闭环幽灵名裸奔）；RandomSeed.sequence NaN 潜伏 bug 直接修（撤修验红在案）；108 变更 38 笔逐笔过账体系判定=转的。余下施工挂 REQ-ENGINEAUDIT（根因①主程/Q1 已派）。 -->

### REQ-DESYNC-lockstep 分歧要大声报告 · [2026-08-10] · 深审 A2 发现①（Lead 读码坐实） · status: open · 归属: 🔴 主程（lockstep 面） · 优先级: P1 · 类型: 联机可靠性
> **病**（实证：双端 60/60 拍 hash 全分叉、零报警、照跑）：hash 报文照发照收，但唯一消费点是 `lockstep-tab.ts` `view().inSync` 显示位；且 `peerHashAt.get(simTick)` **缺对端数据默认 true**——领先一拍的那端永远看不见分叉；UI 只画一行「对齐中」。
> **做法**：① 缺数据不得默认 true（三态或对最近可比拍判定）② 首次确认分叉一次性大声报告（console.error + 事件信号，供上层拦截/停机/重同步决策）③ 显示侧把「分叉」与「对齐中」分开画。**边界**：`src/net/lockstep-tab.ts` + `mp-client.ts` 显示 + 点名测试（含「领先端也能看见分叉」断言）。

### REQ-SAVEORDER-存档 order 段入指纹 fail-closed · [2026-08-10] · 深审 A2 发现②（Lead 读码坐实） · status: open · 归属: 🔴 主程（存档面） · 优先级: P2 · 类型: 存档完整性
> **病**（实证：order 整段反转→带病加载零报错）：`save-system.ts` `load()` 只验 `hashSnapshot(data.snapshot)`；`data.order` 未入指纹直通 `world.restore`，而 order 决定 restore 后的 query 序——序敏感世界静默变行为，canonical hash 抓不到。
> **做法**：`meta.hash` 输入并入 order（或另加 order 指纹）·fail-closed；**旧档兼容**：无 order 的旧档仍可读（现行退回键序语义不动），带 order 的必验。**边界**：`src/services/storage/save-system.ts`（必要时 envelope 同步）+ 点名测试（order 篡改必拒 + 旧档仍读）。

### REQ-GUARDGATE-引擎面守卫接线批 · 禁裸随机静态守卫 + hygiene 修红接门 · [2026-08-10] · 深审 A1 探针2/顺手发现（Lead 复跑坐实） · status: open · 指派: 可派工（守卫属 Lead 域·Lead review） · 优先级: P1 · 类型: 门禁基建
> **病**（实证）：① 往 matrix-duel 结算插 `Math.random()`——game-skill-audit 只扫 `games/`、门禁无引擎层随机扫描步，被咬全靠碰巧存在的精确数值断言；② `test-hygiene-check.mjs` 在 HEAD 即 FAIL（`src/runtime/engine.loop-stop.test.ts:25` [time-wait] 用 `performance.now()`）且未接进 scoped-gate 任何 scope——红着也拦不了推送。
> **做法**：① 新静态守卫：引擎面（`src/{engine,skills,assembly,net,services}` 非测试文件）禁裸 `Math.random`（白名单 = `atoms/random` 实现文件），接 scoped-gate；② 修掉 loop-stop.test 的墙钟违规 + hygiene 接门。**边界**：新守卫脚本 + `scoped-gate.mjs` 接线 + `engine.loop-stop.test.ts` 一处 + 各点名测试③（2026-08-11 追加·ARTPAR 复查裁定）`art-replace-smoke.py` 纳入门禁——碰美术面（`scripts/art-replace*`/`main_entry/art_*`）时跑（PST 实证：三处假红漏检一整天）。

### REQ-ARTPROMPT-提示词编辑被忽略 · UI 改词存 query 而生成读 prompt · [2026-08-11] · PST 复查 P1（Lead 复核属实）+ owner 提示词精简旧请求合并 · status: open · 归属: Lead（`art-replace.mjs`·与 rowIdentity 身份耦合须谨慎） · 优先级: P1 · 类型: 美术工具正确性
> **病**（PST 实证复现）：`dialectPrompt` 主体优先级 `row.prompt` > `query+desc`，而 `resetRow` 只改 `row.query` 不动 `row.prompt`，面板又预填 `r.prompt || r.query`——人改了字、存进 query、生成仍用旧 prompt = **「改了没反应」**（owner 最恨的一类）。
> **做法（设计时并办）**：① resetRow 语义修正——用户编辑文本应成为生效主体（动 prompt 还是清 prompt 落回 query+desc·须先定 query 的身份职责边界——`rowIdentity` 三级回退里 query 是末级身份键，改身份≠改提示词要拆开）；② 顺办 owner 的「提示词精简」（subject 从 query+desc 收敛）。**边界**：`scripts/art-replace.mjs`（resetRow/dialectPrompt）+ `ArtLedgerPanel.tsx` 预填口径 + 点名测试。

<!-- REQ-DOKIPACK-DokiWorld 出包线（P1·owner 2026-08-12 令「以后产物都往这里打包」）首件已完结出池：手册 docs/playbooks/dokiworld-pack.md + 规范快照 docs/design/dokiworld/ 在档=常备产线；game108 首包 ✅ Lead 终审 PASS——dokiworld/game108/（manifest 生成器§5 逐条校验·SDK 薄接线零规则·toGameResult 纯函数=血差线性投影与验收剧本同口径·12 测独立复跑绿·施工方 outcome 反转验红+Lead 钳位破坏恰中边界测·无宿主等待屏与 createAppHost 真握手挂载双目击截图在档）。game108 加 setWorldObserver 只读观察口（照 setCard 形态·render-only）。**下一步触发者=owner**：整目录复制/PR 到 dokiworld-apps 仓 + 真宿主跑一遍（§12 末项·本仓无那边推送权）。**记债**：引擎两条站点绝对资产约定（/games/<slug>/art·/ui-fonts）在 iframe 子路径下逃包，现由打包层改写+复制资产兜住——「资产 URL 基准可配置」是引擎缺口候选,下个游戏出包再撞就立单下沉。后续游戏照手册,World 形态等首个剧情向产物。 -->

### 📦 3D 渲染线需求 → 已移至 `docs/workflow/requests-3d.md`（owner 2026-06-28 立独立池）

> Mesh3D/Transform3D/Camera3D/Sky3D/Model3D/Light3D/Post3D 等 **3D 盒庭渲染线 + Game Z** 的需求 / 工单（含 `REQ-3D-W1高效引擎`·实例化绘制、`REQ-3D-Model导入`·glTF）**全部移至 [`requests-3d.md`](./requests-3d.md)**。新 3D 需求进那里、不进本文件；本文件留通用 UI 库 / 其它游戏需求。

## 已结案条目 → 查 git 历史（owner 2026-08-03 拍板删除归档层·`git log --oneline --grep=REQ-XXX` 或按提交信息 grep·随时可恢复）

## 需求模板（复制这段填写·先确认：游戏级工单请写该游戏的 `docs/design/<game>/requests.md`，此处只收引擎级）

```
### [YYYY-MM-DD] · [提出人角色] · status: open
- 想实现的行为：
- 已经试了什么（哪些能力 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案（可选）· 边界（本单允许触碰的文件范围·复查门核对用）：
```

---
