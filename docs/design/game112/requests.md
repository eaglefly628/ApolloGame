# game112《星尾会客厅》· 需求单（游戏级·不占引擎池硬槽）

> **为什么在这里**：引擎池 `docs/workflow/requests.md` 7/10 槽·22189/25000 字符，余量不够装十条；且这批单子的下一步触发者是 **owner 的 A/B 判词**（不在池内）。**晋升规则**：owner 判 A 且 Lead/主程接单时，把条目原文搬进引擎池并抢锁（🔴 主程面）或由提需方抢锁（🟢 扩写面）。
> **A/B 摆盘不在本文重抄**：全文 `framework.md` §6；本文只记「裁决 / 归属 / 状态 / 边界」。机读投影 `capability-gaps.json`。
> **编号唯一**：开单前已 grep `REQ-112-` 全库零命中（2026-09-23）。
> 状态：`open`（待 owner 判）/ `accepted` / `in-progress` / `done` / `wontfix`。

---

## REQ-112-ENG-01 · 公共星盘 `t2-shared-pile`（GAP-112-01）
- **owner 裁决**：**wontfix（2026-09-24）**——「游戏专属规则不进引擎」→ 见 REQ-112-GAME-01
- **归属**：— · status: **wontfix** · 原文保留作实查记录
**想实现的行为**：三个公共星盘作为持久落牌区；出牌输入带目标堆；堆顶/堆深/牌库余量可被条件与判型读到；猫爪动作（换盘 / 压住一张牌 / 拨走顶牌）作为输入键或 Effect 动词。
**已经试了什么（实查留痕）**：`grep -n "PlayedHand" src/skills/tier2/card-pile.ts` → `:141` 「出牌区在同实体」、`:179-180` 「reset-then-apply…清空出牌区」；`card-play.ts:78-89` 每 tick 覆写；`effect-apply.ts:47-48` kind 闭集无改牌动词；`cardboard.ts:191-217` `CardPile` 无 deckCount 出口；牌做实体走 `queue-slots/tray` 则计分件读不到。
**卡在哪**：手牌 → 他实体持久堆 的转移不存在；堆操作动词不存在。
**边界（复查门核对用）**：`src/skills/tier2/{card-pile,shared-pile}.ts` + `src/engine/protocol/components/cardboard.ts` + `component-map.ts` 登记 + registry；不碰 card-scoring 语义；带撤修即红测试。

---

## REQ-112-ENG-02 · 判型 DSL 扩展（GAP-112-02）
- **owner 裁决**：**wontfix（2026-09-24）**——随 01 → REQ-112-GAME-01
- **归属**：— · status: **wontfix** · 原文保留作实查记录
**想实现的行为**：`HandFamily.kind` 增 `suited-set`（同 suit 任意 rank）；`HandFamily.rankCycle?: number` 让 sequence 可回绕；定第三属性（爪印）编码约定。
**实查留痕**：`hand-pattern.ts:27-32` kind 闭集；`:237-245` 线性域 1..14；`cardboard.ts:58-73` Card 二维；`poker-hand.ts:112/119` flush/straight ≥5。
**边界**：`src/skills/tier3/hand-pattern.ts` + 其测试；不改 `matchPattern` 既有族语义（掼蛋回归全绿）。

---

## REQ-112-ENG-03 · 指针跟随 + 距离/速度条件叶 `t2-pointer-follow`（GAP-112-03）
- **owner 裁决**：**撤单（2026-09-24）**——「逗猫改用视频实现，不做拖羽毛棒」。逗猫重设计后若仍需实时跟手再开新单。
- **归属**：— · status: **wontfix** · 原文保留作实查记录
**想实现的行为**：挂 `PointerFollow{playerId,smoothing}` 的实体每拍取最新 `phase:'move'` 写自身 Transform，派生 `speed.<id>` / `dwell.<id>` Resource；`ConditionExpr` 加 `distance{a,b,cmp,value}` 叶。
**实查留痕**：`queued-input.ts:96-101` move 可入队；全仓 `phase === 'move'` 仅测试命中；`keybind.ts:98` 只透传 arg；`logic.ts:78-90` 条件闭集无距离/速度；`grid-drag-square.ts:20`「拖拽中…实时流…本引擎尚无先例」。
**边界**：`src/skills/tier2/pointer-follow.ts` + `src/engine/logic` 条件叶 + 定序测试（warn 为零）+ 确定性双跑。

---

## REQ-112-ENG-04 · 触摸手势数值载荷（GAP-112-04）
- **owner 裁决**：**B·撤单（2026-09-24）**——首版只按分区判；随 03 交付后若仍需再开新单
- **归属**：— · status: **wontfix**
**想实现的行为**：`Clickable.emitPayload:true` → Signal 附 `{x,y,dx,dy,dwellTicks}`；或复用 03 的 speed/dwell Resource。
**实查留痕**：`clickable.ts:113` Signal 无坐标；`:44-46` phase 只 down/up；`queued-input.ts:45-57` drag 只起终点。

---

## REQ-112-ENG-05 · `AishePort` 扩展（GAP-112-05）——引擎能力「AI 视频生成」之一
- **owner 裁决**：**A（2026-09-24）**「要做，毕竟要跟爱诗对接」
- **归属**：🔴 主程面 `src/services/aigp` · **施工主体 = 主程 = 本 session（2026-09-24 抢锁·本行即锁）** · 复查 = 另派独立 agent（复查人≠施工人·**待派**） · status: **✅ 已交（2026-09-24·门禁全绿·已推送）·等独立复查** · P1 · 引擎池指针单 = `REQ-112-AIGP`
**想实现的行为**：`AisheGenerateOptions` 加 `referenceImages[]/characterId/firstFrame/lastFrame`；端口加 `poll(id)/cancel(id)/delete(id)`；开发期代理 `scripts/game112-aishe-proxy.mjs`（照 `game111-deepseek-proxy.mjs`：key 只在本进程·`--selftest`）。
**实查留痕**：`aishe-port.ts` 接口全文（`generate` 唯一方法·零图片字段）；`http-aishe.ts` POST 体；`aishe.test.ts`；全仓 `new HttpAishePort` 零命中、`NullAishePort` 仅 `games/game-i/game-i.ts:136`。
**边界**：`src/services/aigp/**` + 代理脚本；纪律同 `HttpNpcAgentPort` 三条（绝不抛 · 绝不碰 world · 只归一形状）。

---

## REQ-112-ENG-06 · 媒体作业链端口（GAP-112-06）——引擎能力「AI 视频生成」之二
- **owner 裁决**：**A·先立端口（2026-09-24）**「现在暂时可能会接别的组件」→ 端口形状必须与具体供应商解耦（同 NpcAgentPort/AishePort 纪律）
- **归属**：🔴 主程面 `src/services/media-job` + 产品后端（本仓外·owner 另定）· **施工主体 = 主程 = 本 session（2026-09-24 抢锁·本行即锁）** · 复查 = 另派独立 agent（**待派**） · status: **✅ 已交（2026-09-24·门禁全绿·已推送）·等独立复查** · P1 · 引擎池指针单 = `REQ-112-AIGP`
**想实现的行为**：`MediaJobPort{submit(kind,inputs),poll,cancel,delete,export}` · `MediaCachePort`（Blob·非 string KV）· 审核队列数据形状 `{jobId,catId,kind,status:'pending'|'approved'|'rejected',reason}` · Null 实现可跑 CI。
**实查留痕**：`main_entry/server.py` `/api/art/upload` 单图 dataBase64 白名单 png/webp/jpg/jpeg/glb（创作者换槽用）；`/api/assets/{matte,generate,review,autotag}` 开发期件；`services/storage` `IndexedDbKV` 只收 string；全仓无 CacheStorage/Service Worker。
**边界**：端口薄；不在游戏层写网络胶水。

---

## REQ-112-UI-07 · `Input.type:'file'` 上传控件（GAP-112-07 · 报 PUI）
- **发现**：2026-09-23 实查 `catalog.ts` Input `type` 只 `'text'|'number'`；`type="file"` 仅 `src/studio` React。
- **归属**：PUI（`src/ui/components` 域）· status: **accepted（owner 2026-09-24「需要上传」）** · P2
**建议**：`Input.type:'file'` + `accept/multiple/capture` → action 信号带文件句柄数组（进 UI 层·不进 sim）。
**当前绕法**：无（手写 DOM 违反铁律·不绕）。

---

## REQ-112-ENG-08 · 片段→alpha 序列帧转换管线（GAP-112-08）
- **owner 裁决**：**不单独立（2026-09-24）**——序列帧只是播放能力的内部实现选项，折叠进 REQ-112-ENG-11；下文实查原文保留供主程做 11 时参考
- **归属**：🟢 资产面扩写（`registerAssetIndex` 桥接 = 主程 review；转换脚本 = PST/资产管线 · 提需方可写）· status: **wontfix（折叠进 REQ-112-ENG-11·2026-09-24）**
**想实现的行为**：服务侧作业 `clip → 逐帧 matte → 图集(webp/png) + manifest{fps,count,anchor,hitZones}` 入库为 `prerendered-sequence`；`registerAssetIndex` 桥接该 kind 到 `Sprite.textureKey` 图集；`CLIP_CATALOG` 直接映射 `t2-anim-state` clip 表。
**实查留痕**：`asset-index.ts:15` AssetType 含 `video`、`:265-296` 只桥 texture/mesh；`asset-types.ts` `prerendered-sequence`；`anim-state.ts` clip `{sheet,from,count,fps,loop}`；`/api/assets/matte` 单张。
**边界**：`src/assets/**` 桥接 + `scripts/` 转换脚本 + 体积/帧率基准数据（Loop-1 复查用）。

---

## REQ-112-ENG-09 · VideoActor（GAP-112-09）
- **owner 裁决**：**合并进 REQ-112-ENG-11（2026-09-24）**；实查原文保留
- **归属**：🔴 主程面 · status: **wontfix（合并进 REQ-112-ENG-11）**
**实查留痕**：`mount-host.ts` 分层无视频槽；`canvas-renderer.ts` 无遮罩/视频纹理；`render.ts:1015` `<video>` `background:#000`；`server.ts:850-866` 无 ended。

---

## REQ-112-UI-10 · `Video.onEnded/bind/fit` + catalog 补 `muted`（GAP-112-10 · 报 PUI）
- **owner 裁决**：**合并进 REQ-112-ENG-11（2026-09-24）**——作为该能力的 UI 面由 PUI 协作；实查原文保留
- **发现**：`types.ts:642` `VideoProps` 无事件/bind；catalog `:173-181` 漏登 `muted`；改 `src` 整元素重建。
- **归属**：PUI 协作 · status: **wontfix（合并进 REQ-112-ENG-11·作为其 UI 面）**
**建议**：`onEnded: action`（进 UI 层）· `bind`（同 Image）· `fit`；`visibleWhen` 切换时保留 DOM 的可选项。

---

## REQ-112-GAME-01 · 星爪牌规则核（游戏层·原 ENG-01/02 的去向）
- **owner 裁决**：2026-09-24「游戏专属规则直接在游戏逻辑里实现」
- **归属**：PE-112 `games/game112/starclaw-rules.ts` · status: **🟡 待 owner 对牌规**（2026-09-24：「星爪牌还没完全设计，要仔细对一下」）· S3 骨架只留牌局接口位，规则核等牌规定稿后做 · 记债（`capability-plan.md` §4 例外④）
**做什么**：纯函数确定性模块——三星盘公共堆 · 目标堆出牌 · 猫爪动作（换盘/压牌/拨顶）· 组合计分（同色任意/月相循环/成对/三连/爪印）· 胜负；随机只吃传入 seed（`seededShuffle`）；状态经 Resource/Flag 投影给 UI/AI/条件；成对/三连/同色三连仍调 `t3-hand-pattern.matchPattern`。
**边界**：零 DOM · 零 `Math.random` · 不写 system（由宿主会话驱动在输入点调用）· 测试 ≥30 含撤修锚点。先例 `games/game-c/holdem-eval.ts`。
**偿还**：第三个游戏出现同形「公共堆」需求再议下沉。

---

## REQ-112-ENG-11 · 引擎能力「内嵌 AI 视频播放」（GAP-112-11 · owner 2026-09-24 立·合并 ⑧⑨⑩）
- **owner 裁决**：**A（2026-09-24）**「把 AI 生成视频的播放列成引擎缺失的能力补全」——与「AI 视频生成」（05+06）成对的两款引擎能力
- **归属**：🔴 主程面（renderer / host / 组件协议 / determinism）**+ PUI 面一并由主程做**（owner 2026-09-24 当面授权跨域：「你这个当成你作为主程自己去实现吧」+ 追问确认「授权我直接动」·事后由 PUI 复查）· **施工主体 = 主程 = 本 session（2026-09-24 抢锁·本行即锁）** · 复查 = 另派独立 agent（复查人≠施工人·**待派**·UI 面另请 PUI 过目） · status: **in-progress** · P1 · 引擎池指针单 = `REQ-112-VIDEOPLAY`
**想实现的行为**（游戏侧只给数据，不写播放器）：
1. 片段目录 = 数据：`{clipKey, state, ticks, poseIn, poseOut, loop, fallbackClipKey, review}`（`framework.md` §2 `CLIP_CATALOG`）。
2. 按 sim 的 `State{fsmId}` 选片（同 `t2-anim-state` 的 clip 表口径）；播放进度/结束**不进 sim**，结束信号只进 UI 层。
3. 预载下一候选片 · 换片不黑帧（首尾中性姿势对齐）· 缓存已就绪片（Blob 级，配合 06 的 MediaCachePort）。
4. 缺片回退链：个性片 → 通用片 → 基础活照片 → 静态图 + fx 微动；断网时链尾必达。
5. 叠层：可放在场景背景之上、被前景遮挡；透明/遮罩为可选高级项。
6. 内部实现（`<video>` 元素 / 序列帧图集 / 两者混合）由主程定，游戏不感知。
**实查留痕**：`types.ts:642` VideoProps 无事件/bind；`render.ts:1015` 改 src 整元素重建 + `background:#000`；`server.ts:850-866` 无 ended；`mount-host.ts` 无视频层；`canvas-renderer.ts` 无视频纹理/遮罩；`anim-state.ts` clip 表可借形状；`asset-index.ts:15` AssetType 已含 `video` 未桥接。
**边界**：`src/renderer/**` + `src/engine/host/**` + `src/ui/components/{video,catalog,render,server}` + `determinism.ts` 登记；带断网回退测试与换片不黑帧目击。

---

## REQ-112-ENG-12 · `effect-apply` schema 文案与实现不一致（报主程·P3·文档级）
- **发现**：S3 复查（S3-reviewer-agent 2026-09-24）——`src/skills/tier2/effect-apply.ts:34` schema 写「tagMask：批量 kind（destroy-tagged/…）」，而 `:238` 实现 `destroy-tagged` 读的是 `Number(ef.value)`；`logic.ts:143` 注释与实现一致（value=掩码）。game112 首版照 schema 填 `tagMask` 撞红（`blueprint.ts` fx-offline-ack）。
- **归属**：🔴 主程面（`src/skills/tier2`）· status: **open** · P3
**建议**：二选一——schema 文案改成「destroy-tagged 掩码走 value；tagMask 仅 set-flag-tagged/set-visible-tagged」，或实现改成 `tagMask ?? value` 兼容。**当前绕法**：game112 按实现填 `value`（已注释）。

---

## REQ-112-UI-11 · 主厅「隐藏/显示 UI」壳层钮（menu-flow §1.3）· status: **wontfix（重组·2026-09-24）**
- **理由**：缺口裁决协议第①步实查（复查 r4 指正）——`src/ui/components/bindings.ts:83-128` `visibleWhen` 已能按世界 Flag 剔整棵子树；不是壳层缺口。
- **等价数据写法**：`world-data.ts` `STAGE_ONLY_FLAG='ui.stageOnly'` + `ui.hide`/`ui.show` 两把 key → `Effect set-flag`；`ui.ts` 主厅各块 `visibleWhen:'!ui.stageOnly'`、猫画面层「显示界面」钮 `visibleWhen:'ui.stageOnly'`；宿主渲染前 `resolveBindings(tree, { flag })`。零新控件。
- **证明测试**：`games/game112/ui.test.ts`「沉浸模式」（Flag 开/关 → 树里有无导航/动作/显示界面钮）+ `scripts/game112-playthrough.mjs` 真点「只看它」/「显示界面」（`self-check/shots/S4-play-13-hall-stage-only.png`）。
- 引擎池 `REQ-UI-STAGEMODE` 同日撤回（不占槽）。

---

## REQ-112-GAME-02 · 敏感章节「播放前控制层」（GDD §2.3 · 游戏层·GD-112 自领）
- **发现**：S4 对齐单第 16 行——章节数据 `sensitive` 位 + 回忆廊徽标已有，但「播放前给跳过 / 静音 / 今天只想陪它坐坐」的三选一层没有屏可验（首章 `sensitive:false`）。
- **归属**：GD-112 · status: **open** · 随第一个 `sensitive:true` 章节落地（Loop-1）
**做法**：纯数据——`memory.read` 命中敏感章节时先出 `dialog(kind:'choice')` + `choiceList`（三项：继续看 / 静音看 / 今天只想陪它坐坐→回主厅），**零新控件**；claude-design 稿 §12 已含此屏。

---

## 定项问询（owner 一并判）
- **§5 竖切三环**：Loop-0（主厅静态 + 星爪牌 + 星砂/杂货铺 + 一段回忆）零媒体缺口先跑 S4 → Loop-1 逗猫 + 序列帧猫 → Loop-2 上传/生成。⬜ 准 ⬜ 按 GDD §16.1 一次到位。
- **名字**：立项卡暂用工作名《星尾会客厅》（GDD 🟡）。
