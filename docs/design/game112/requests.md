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

## REQ-112-ENG-05 · `AishePort` 扩展（GAP-112-05）
- **owner 裁决**：⬜ 待判（§6 ⑤·推荐 A）
- **归属**：🔴 主程面 `src/services/aigp` · status: **open** · P1 · 不锁 S4（Loop-2 前须交）
**想实现的行为**：`AisheGenerateOptions` 加 `referenceImages[]/characterId/firstFrame/lastFrame`；端口加 `poll(id)/cancel(id)/delete(id)`；开发期代理 `scripts/game112-aishe-proxy.mjs`（照 `game111-deepseek-proxy.mjs`：key 只在本进程·`--selftest`）。
**实查留痕**：`aishe-port.ts` 接口全文（`generate` 唯一方法·零图片字段）；`http-aishe.ts` POST 体；`aishe.test.ts`；全仓 `new HttpAishePort` 零命中、`NullAishePort` 仅 `games/game-i/game-i.ts:136`。
**边界**：`src/services/aigp/**` + 代理脚本；纪律同 `HttpNpcAgentPort` 三条（绝不抛 · 绝不碰 world · 只归一形状）。

---

## REQ-112-ENG-06 · 媒体作业链端口（GAP-112-06）
- **owner 裁决**：⬜ 待判（§6 ⑥·推荐 A 端口先立·真后端 owner 另定）
- **归属**：🔴 主程面 `src/services/media-job` + 产品后端（本仓外）· status: **open** · P1 · 不锁 S4
**想实现的行为**：`MediaJobPort{submit(kind,inputs),poll,cancel,delete,export}` · `MediaCachePort`（Blob·非 string KV）· 审核队列数据形状 `{jobId,catId,kind,status:'pending'|'approved'|'rejected',reason}` · Null 实现可跑 CI。
**实查留痕**：`main_entry/server.py` `/api/art/upload` 单图 dataBase64 白名单 png/webp/jpg/jpeg/glb（创作者换槽用）；`/api/assets/{matte,generate,review,autotag}` 开发期件；`services/storage` `IndexedDbKV` 只收 string；全仓无 CacheStorage/Service Worker。
**边界**：端口薄；不在游戏层写网络胶水。

---

## REQ-112-UI-07 · `Input.type:'file'` 上传控件（GAP-112-07 · 报 PUI）
- **发现**：2026-09-23 实查 `catalog.ts` Input `type` 只 `'text'|'number'`；`type="file"` 仅 `src/studio` React。
- **归属**：PUI（`src/ui/components` 域）· status: **open** · P2 · 不锁关
**建议**：`Input.type:'file'` + `accept/multiple/capture` → action 信号带文件句柄数组（进 UI 层·不进 sim）。
**当前绕法**：无（手写 DOM 违反铁律·不绕）。

---

## REQ-112-ENG-08 · 片段→alpha 序列帧转换管线 + `video`/`prerendered-sequence` 桥接（GAP-112-08）
- **owner 裁决**：⬜ 待判（§6 ⑧·推荐 **A 作 Loop-1 基线**）
- **归属**：🟢 资产面扩写（`registerAssetIndex` 桥接 = 主程 review；转换脚本 = PST/资产管线 · 提需方可写）· status: **open** · **P2（2026-09-24 降）**——逗猫改视频后「猫活在画布层」不再是硬需求；若 ⑩ 能做到换片不黑帧，本条可撤
**想实现的行为**：服务侧作业 `clip → 逐帧 matte → 图集(webp/png) + manifest{fps,count,anchor,hitZones}` 入库为 `prerendered-sequence`；`registerAssetIndex` 桥接该 kind 到 `Sprite.textureKey` 图集；`CLIP_CATALOG` 直接映射 `t2-anim-state` clip 表。
**实查留痕**：`asset-index.ts:15` AssetType 含 `video`、`:265-296` 只桥 texture/mesh；`asset-types.ts` `prerendered-sequence`；`anim-state.ts` clip `{sheet,from,count,fps,loop}`；`/api/assets/matte` 单张。
**边界**：`src/assets/**` 桥接 + `scripts/` 转换脚本 + 体积/帧率基准数据（Loop-1 复查用）。

---

## REQ-112-ENG-09 · VideoActor（GAP-112-09）
- **owner 裁决**：⬜ 待判（§6 ⑨·推荐 **B 延后**）
- **归属**：🔴 主程面（renderer + host + 组件协议 + determinism）· status: **open** · P2 · 不锁关
**实查留痕**：`mount-host.ts` 分层无视频槽；`canvas-renderer.ts` 无遮罩/视频纹理；`render.ts:1015` `<video>` `background:#000`；`server.ts:850-866` 无 ended。

---

## REQ-112-UI-10 · `Video.onEnded/bind/fit` + catalog 补 `muted`（GAP-112-10 · 报 PUI）
- **发现**：`types.ts:642` `VideoProps` 无事件/bind；catalog `:173-181` 漏登 `muted`；改 `src` 整元素重建。
- **归属**：PUI · status: **open** · **P1（2026-09-24 升）**——逗猫改视频后，猫的画面 = `Video` 控件按状态换片，「播完发信号 + src 按状态绑定 + 换片不黑帧」是猫画面的基本件；⑧⑨ 是否还要，取决于本条能做到哪一步
**建议**：`onEnded: action`（进 UI 层）· `bind`（同 Image）· `fit`；`visibleWhen` 切换时保留 DOM 的可选项。

---

## REQ-112-GAME-01 · 星爪牌规则核（游戏层·原 ENG-01/02 的去向）
- **owner 裁决**：2026-09-24「游戏专属规则直接在游戏逻辑里实现」
- **归属**：PE-112 `games/game112/starclaw-rules.ts` · status: **🟡 待 owner 对牌规**（2026-09-24：「星爪牌还没完全设计，要仔细对一下」）· S3 骨架只留牌局接口位，规则核等牌规定稿后做 · 记债（`capability-plan.md` §4 例外④）
**做什么**：纯函数确定性模块——三星盘公共堆 · 目标堆出牌 · 猫爪动作（换盘/压牌/拨顶）· 组合计分（同色任意/月相循环/成对/三连/爪印）· 胜负；随机只吃传入 seed（`seededShuffle`）；状态经 Resource/Flag 投影给 UI/AI/条件；成对/三连/同色三连仍调 `t3-hand-pattern.matchPattern`。
**边界**：零 DOM · 零 `Math.random` · 不写 system（由宿主会话驱动在输入点调用）· 测试 ≥30 含撤修锚点。先例 `games/game-c/holdem-eval.ts`。
**偿还**：第三个游戏出现同形「公共堆」需求再议下沉。

---

## 定项问询（owner 一并判）
- **§5 竖切三环**：Loop-0（主厅静态 + 星爪牌 + 星砂/杂货铺 + 一段回忆）零媒体缺口先跑 S4 → Loop-1 逗猫 + 序列帧猫 → Loop-2 上传/生成。⬜ 准 ⬜ 按 GDD §16.1 一次到位。
- **名字**：立项卡暂用工作名《星尾会客厅》（GDD 🟡）。
