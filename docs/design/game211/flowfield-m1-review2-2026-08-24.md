# REQ-FLOWFIELD M1 独立复查报告 · 第二轮（2026-08-24·判 **CONCERNS**·可合入·两条须落账）

> 复查人 = Lead 派的独立复查 agent（复查人≠施工人成立·施工方=主程 session）。被审提交 **`c3cd18f5`**。
> 上一轮判 FAIL（报告 `flowfield-m1-review-2026-08-24.md`），本轮验「三条修得对不对」+「修的过程有没有引进新问题」。
> 四步铁律全走：① 独立复跑（退出码直量·不经管道）② 撤修验红**带锚点命中断言**（`assert old in s` 命中才写盘·跑完 `diff` 核对还原）
> ③ 实证复现（每条结论先跑出来）④ 读告警。
> 全部验证在临时 clone `<scratch>/ff-review2`（`c3cd18f5` + `npm ci`）与对照 clone `<scratch>/ff-old`（`bb507744`·共享 node_modules）内完成。
> **主仓零改动**（`git status --porcelain` 空），本文件是唯一写入。

---

## 判词：CONCERNS（**不是 FAIL**·三条打回项已真修·合入无阻，两条须落账）

三条打回项**逐条撤修验红全部恰中**，都不是读代码读出来的，是跑出来的：

| 上一轮打回 | 本轮实证 | 判 |
|---|---|---|
| ① P0 缓存是状态通道（`Math.round(x*1000)` 量化别名） | 0.0004 那对场现在 `bakes=2`、返回**两个不同对象**；把比对退回量化口径 → **恰红 2 条** | ✅ 真修 |
| ② P1「与单位数无关」零判据 | 真把取场写回单位循环 → **exit 1**，红在 `lookups` 那条：`{bakes:1, lookups:30030}` vs 期望 `30` | ✅ 真修 |
| ③ P1 新增定序环 | 真撤 `runsAfter` → **exit 1**，红在 `warns` 那条，抓到的**就是** `[topological-sort] … 定序环 [steering, path-follow, flow-field]（闭环组件：Velocity）` 原文 | ✅ 真修 |

判 CONCERNS 而不是 PASS，只为两条——**都不碰确定性红线，都是性能/证据口径**：

1. **修的过程引进了一个可测量的性能悬崖**：缓存键从 `id|摘要` 改成 **`id` 单键**后，
   「同 id 不同内容的两张场并存」从 **2 次铺场** 变成 **每次取场都重铺**。192×192 实测
   **3.87 ms/tick（旧）→ 26.08 ms/tick（新）= 6.7×**，命中率归零。**讽刺的是施工方自己新增的
   「跨世界不串味」测试正好坐在这个形状上**（20 tick / 40 次取场 / 40 次铺场），却没有任何断言提它。
2. **「跨世界不串味」这条新测试不能当 P0 的证据**——我把它原样搬到 `bb507744`（有缺陷的那一版）上跑，
   **它照样绿**（`left.vx=-1 right.vx=1 · bakes=2`）。提交信息把它列进「补三测」当修复证据是**过度声称**，
   与上一轮被打回的病同种（只是这次实质对了、只错在证据归属）。真正咬住 P0 的是 0.0004 那条。

**没打穿的我逐条写在最后一节**，不为显严格而挑刺。

---

## 一、独立复跑（退出码直量·不经管道）

| 项 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 点名测试 | `npx vitest run src/skills/tier2/flow-field.test.ts` | **0** | **28 passed**（25 → 28·+3 与提交信息一致） |
| 全量门禁 | `node scripts/scoped-gate.mjs --run` | **0** | `scope=full`·`✅ 门禁全绿` |
| ├ audit:game211 | | | **AUDIT: PASS** · **RATCHET: PASS** |
| ├ engine-random | | | **WARNINGS**（仅 lockstep demo peerId 那条存量批注·非本单引入） |
| ├ test-hygiene | | | **WARNINGS**（🔴 硬违规: 无·存量白名单） |
| ├ tsc | | | 静默通过 |
| ├ vitest:full | | | **504 文件 / 4786 测 passed**（4783 → 4786·+3） |
| ├ build / docs-ref / context-budget / decouple-check | | | PASS |
| └ art-ledger-guard | | | **WARN**（存量） |

> 说明：clone 里 `c3cd18f5` 就是 `origin/claude/mainbranch` 顶，scoped-gate 判 `none`。
> 我把 `refs/remotes/origin/claude/mainbranch` 倒回 `75ffcaea` 才逼出真实 scope（`full`·6 文件·碰引擎面）再跑。
> **第一次跑我自己把 build 跑红了**（跑到一半删了自己的探针 `__cyc3.test.ts` → `TS6053 File not found`）——
> 记在这里是因为「绿灯要能复现」：清干净工作树重跑，`GATE EXIT=0`。

**门禁自陈属实。以下所有问题都在门禁之外。**

---

## 二、撤修验红（三刀锚点全中·每刀跑完立刻还原并 `diff -q` 核对）

| 刀 | 锚点 | 退出码 | 恰红哪几条 |
|---|---|---|---|
| **S1** `sameInputs` 的 `Object.is` 换回 `Math.round(n*1000)` 量化（复刻原缺陷） | 命中 ✔ | **1** | 2 红：`**缓存不许别名**：两张只差 0.0004 的场必须各铺各的`、`精确比对逐字段成立` |
| **S2** `const bf = baked.get(a.fieldId)!` → `getBakedField(field)`（取场写回单位循环） | 命中 ✔ | **1** | 1 红：`**成本与单位数无关**` —— `expected { bakes: 1, lookups: 30030 } to deeply equal { bakes: 1, lookups: 30 }` |
| **S3** 删掉 `runsAfter: ['steering','path-follow']`（`flow-field.ts:380`） | 命中 ✔ | **1** | 2 红：`runsAfter` 元数据那条 + `与 steering/path-follow 同装：零成环告警`，后者捕获文本**逐字**是 topological-sort 的成环告警 |
| **S2b**（我加的一刀·判据够不够）把同样 O(格数) 的扫描放回单位循环但**绕开 `getBakedField`**（逐单位跑一遍 `snapshotOf`+`sameInputs`） | 命中 ✔ | **0** | **0 红·28 测全绿** |

三刀都恰红在声称的那一条上，**上一轮 S6 那种「声称红实际全绿」的情况这次没有复现**。

**S3 的一个细节值得单独记**：撤掉 `runsAfter` 后，`expect(order).toEqual([...])` 那条断言**没红**——
平局裁决碰巧还是排出 `steering → path-follow → flow-field → motion-apply`。
**真正咬住的是 `expect(warns.filter(/定序环/)).toEqual([])` 这条**。也就是说：这条测试是靠**读告警**成立的，
不是靠读执行序——正是上一轮流程账要的那个形状。

### `console.warn/error` 劫持在 vitest 里可靠吗（专门查了）

可靠。三条依据：① `vite.config.ts:128` 的 `test` 段**没有** `sequence.concurrent`，测试文件内默认串行，
不存在同 worker 内两条测试同时劫持；② vitest 默认按文件隔离 worker + 独立模块注册表，跨文件不互串
（也因此 `flow-field.ts` 的模块级 `cache` 在测试里是每文件一份）；③ `try/finally` 覆盖了 `w.addSystem`/`w.tick`/
两条 `expect`，`console.warn = origWarn; console.error = origErr` 在 `finally` 里，断言失败也能还原。
`await import('./steering.js')` 在劫持**之前**，模块装载期的输出不会被吞。
**并且我不是靠读代码下的这个结论——S3 撤修真红了，说明这条通路确实通。**

---

## 三、逐条验修（含上一轮那些实证的原样重跑）

### ① P0 缓存别名 —— 真修

`flow-field.ts:214-266`：`fieldDigest` 删掉，改成缓存条目存 `InputSnapshot`（`:232 snapshotOf`·深拷贝 goals/blocked/cost）
+ 命中前 `sameInputs`（`:243`·`Object.is` 逐字段逐元素）。

我把上一轮的实证逐条重跑，并补了几个上一轮没问的边界：

| 探针 | 结果 | 判 |
|---|---|---|
| `originX` 0 vs 0.0004（同 id `same`） | `bakes=2` · 返回**两个不同对象** | ✅ 别名消失 |
| `cost` 全 1 vs 全 1.0004（同 id） | `bakes=2` | ✅ |
| **`goals` 数组原地改** `goals[0].x = 0.5` | **重铺 ✔**（`snapshotOf` 深拷贝了 goal 对象，不是存引用）·`dir` 确实变了 | ✅ |
| **`goals` 原地 `push`** | 重铺 ✔ | ✅ |
| **`blocked` 原地改** `blocked[5]=1` | 重铺 ✔ | ✅ |
| `blocked` 换 `Int8Array`（同值） | **不重铺**（`Array.from` + 逐元素 `Object.is` ⇒ 认值不认结构） | ✅ 语义正确 |
| `NaN` 坐标：改成 NaN | 重铺 ✔；`NaN → NaN` **不重铺**（`Object.is(NaN,NaN)=true`·同输入同输出 ⇒ 命中是对的） | ✅ |
| `-0` vs `0` | **重铺**（`Object.is(-0,0)=false`）。语义上两者算术等价 ⇒ 这是一次**多余重铺**，方向偏保守、不产生别名 | ✅ 安全侧 |
| `Infinity` 坐标 | 重铺 ✔ | ✅ |
| `blocked: []` → `blocked: undefined` | **重铺**（`snapshotOf` 用真值判断，`[]` 是真值 ⇒ 一有一无判不同）。同样是多余重铺、不是别名 | ✅ 安全侧 |
| `los: false → true` | **不重铺** | ✅ M1 `los` 不参与铺场 ⇒ 不重铺是**对的**（见下方留的坑） |

**`los` 留的坑（P3·现在不是 bug，M2 会变成 bug）**：`sameInputs` 有意不比 `los`，因为 M1 铺场不消费它。
M2 一旦让 `los` 影响铺场，忘了往 `sameInputs` 里加一行就是**同一类别名重回来**——而那时候
`0.0004` 那条测试抓不到它。建议现在就在 `:243` 上方留一行「**字段进铺场管线 = 必须同步进 sameInputs**」的写死约束。

**世界层重跑说明**：我按上一轮 `originX` 0/0.0004 的 12×3 世界重跑，两边都停 `x=11.5000`——
不是「修没生效」，是**我这次的夹具本身不判别**（goal `x=11.5`、`originX` 只偏 0.0004，`Math.floor(11.4996)` 仍是同一格 ⇒ 两张场铺出来本就同）。
决定性的证据是缓存层的 `bakes=2` + 两个不同对象 + S1 撤修恰红，不是那个位移数字。**这条我按实测说，不硬凑上一轮的数**。

### ② `flowFieldLookups()` 当判据 —— 真修，但**判据是「点」不是「面」**

`flow-field.ts:283-286` 新增 `lookups` 计数（与 `bakes` 分家）；`flow-field.test.ts:352-353`
断言 `{bakes:1, lookups:30}`。S2 撤修 → `lookups=30030`（30 拍 × 1000 单位 + 30 次外提）**恰红**。
上一轮那条「不可复现的验红记录」这次**可复现**。

**够不够？不够，只咬住了这一个回归、没咬住这一类**。S2b 实证：把**完全同量级**的
O(格数) 扫描（整份 `snapshotOf` + `sameInputs`）塞回单位循环里、只是不经过 `getBakedField`——
**28 测全绿 exit 0**。计数器天然只数经过自己的调用。
类级别的判据仍然只有 bench 那条 `expect(bb).toBeLessThanOrEqual(a * 8)`，**8 倍的余量本轮没动**
（上一轮实测 2.9× 的真回归从它底下大摇大摆走过去）。
→ 建议：`lookups` 保留（它对**这条**回归有效且成本为零），另把 bench 那条余量从 `a*8` 收到能咬住 2× 的档，
或按工单原判据（1000 单位 ≤0.1ms/tick）写死——**别让「与单位数无关」这句卖点只靠一个调用计数器背**。

### ③ `runsAfter` 与新增的装配序测试 —— 真修，但**绿的范围比提交信息说的窄**

`flow-field.ts:380` 加 `runsAfter: ['steering','path-follow']`（照抄 `path-follow.ts:121` 的先例，注释写明了理由）；
`flow-field.test.ts:58` 把四件装进同一个世界跑一拍、断言零成环告警 + 执行序。S3 撤修恰红（见上）。

**我另外扫了「加一件会不会塌」**（基线 4 件 + 逐个加入其余 67 个 capability，各跑一拍读告警）：

| 装配 | `c3cd18f5` | 对照 `bb507744` |
|---|---|---|
| 基线 4 件 | **告警 0** | 告警 1（`[steering, path-follow, flow-field]`） |
| +`t1-accel-apply` | 告警 1 · SCC `[steering, path-follow, flow-field, accel-apply]` | 同 SCC |
| +`t2-hitbox` | 告警 1 · SCC `[flow-field, motion-apply, hitbox]`（3 员） | SCC `[steering, path-follow, flow-field, motion-apply, hitbox]`（5 员） |
| +`t2-merge-on-place` / +`t2-bounce-relay` | 告警 1 · SCC 各 5 / 4 员 | 各 5 / 5 员 |
| 「像 RTS」装配（4 件 + aggro + pull-anchor + over-time + hitbox） | 告警 1 · SCC `[flow-field, motion-apply, over-time, hitbox]`（4 员） | SCC 6 员 |
| 全 71 个 capability 全装 | 告警 3 条（phase0 一个 **40 员**巨环 + 两条存量） | **逐字相同**（3 条·同 40 员） |

判读：**这是严格改进，不是回归**——每个装配的 SCC 都变小了或消失了，没有一个变大；
全装那三条告警新旧**逐字一致**（含 `[anim-state, match-view-sync]`、`[bounds-clamp, facing]` 两条存量）。
但提交信息那句「**实测告警归零**」的成立范围是**那四件的最小世界**；
只要装上 `hitbox`/`accel-apply`/`over-time`/`bounce-relay` 中任何一件，flow-field 就重新落进一个会打告警的 SCC。
这不是本单挖的坑（那些环是 `motion-apply ↔ hitbox` 这类存量 RMW 对），但**那句话该加个范围限定**。

**顺带打出来一条给 Lead 的存量账（不归本单·新旧完全一致）**：全 71 件装同一个世界时，
phase 0 结出一个 **40 员**巨 SCC，平局裁决**违反了环上的显式申报**——实测
`motion-apply` 落在 **index 0**（而 `steering`/`flow-field`/`path-follow` 都申报了 `runsBefore:['motion-apply']`），
`path-follow`=44 排在 `flow-field`=27 **之后**（违反新加的 `runsAfter:['path-follow']`）。
告警文案里那句「已服从既有 runsAfter/runsBefore」在这个规模下与实况不符。
新旧提交的数字**逐位相同**，所以与本单无关，但值得单开一单查 `topological-sort` 在大 SCC 下对显式边的处理。

---

## 四、修的过程引进的新问题（本轮重点）

### 🔴 N1（P2·性能悬崖·**须落账**）单键缓存 ⇒ 同 id 多场并存时命中率归零

`flow-field.ts:287-296`：键从 `${field.id}|${fieldDigest(field)}` 变成 **`field.id` 单键**。
后果：同 id 但内容不同的两张场并存 ⇒ 互相顶掉对方的槽，**每次取场都重铺**。

同机 A/B（同一份探针分别在 `c3cd18f5` 与 `bb507744` 上跑·各带 warm-up）：

| 场尺寸 | `bb507744`（旧·`id|摘要` 键） | `c3cd18f5`（新·`id` 单键） | 倍数 |
|---|---|---|---|
| 48×48 | 0.42 ms/tick · **bakes=2** | 1.36 ms/tick · **bakes=40** | 3.2× |
| 96×96 | 0.75 ms/tick · bakes=2 | 6.24 ms/tick · bakes=40 | 8.3× |
| **192×192** | **3.87 ms/tick** · bakes=2 | **26.08 ms/tick** · bakes=40 | **6.7×** |

（形状 = 两张同 id 不同内容的场并存，每 tick 各取一次，跑 20 tick。）

**可达性**：单个 World 内**安全**——`:397-401` 按实体 id 排序取同 id 首张、其余走 `reject`，
所以一个世界里每个 id 只会被取一次。要踩到必须**同进程 ≥2 个 World 用同一个场 id**：
lockstep 影子世界 / 录像回放与实时并跑 / 客户端预测 / 一进程多局。**模块级 `cache` 本来就是跨 World 共享的**
（上一轮 P0 也点了这一点），而 `id: 'f1'` 是全库测试与 bench 的缺省值。
**施工方新增的 `flow-field.test.ts:216「跨世界不串味」正是这个形状**——它 20 次取场 40 次全 miss，
测试本身没有任何断言看得见这件事。

不是确定性问题（结果照样正确），所以我判 P2 不判 P0。修法一行级：
**哈希做分桶、精确比对做正确性**（标准 hash-map 姿势）——键回到 `id|摘要`（摘要用来分桶，别名不再要命，
因为命中后仍走 `sameInputs` 精确比对），或者每个 id 留 K 个槽。这样 P0 的修复一点不丢，悬崖也没了。

### 🟡 N2（P3·须改口）`跨世界不串味` 不能当 P0 的证据

我把 `flow-field.test.ts:216` 那条原样搬到 `bb507744`（缺陷版）上跑：
`[OLD] left.vx=-1 right.vx=1 bakes=2 ⇒ 旧实现也通过`。
原因很直白：旧键是 `id|摘要`，两个世界的 `goals` 不同 ⇒ 摘要不同 ⇒ 本来就是两个缓存条目。
**这条测试对旧缺陷零判别力。**

它不是废测试——**在新的单键设计下它是必要的护栏**（键里没有内容了，全靠 `sameInputs`）。
但提交信息与 `requests.md` 把它并列进「补三测（0.0004 别名 / 逐字段比对 / **跨世界不串味**）」当 P0 修复证据，
是过度声称。**改口即可**：P0 的证据是 0.0004 那条（S1 撤修恰红），这条是新键设计的护栏。

### 🟢 N3（不是问题·反而更便宜）`sameInputs` 比旧摘要**快 3 倍**

我原本怀疑「每 tick 每场 O(格数) 逐元素比对会不会比哈希更贵」。**实测相反**——
旧版的 `fieldDigest` 同样是 O(格数) 一遍扫描，而且每次 `getBakedField` 都要算（还要拼字符串键）：

| 场尺寸 | 新·命中路径（`Map.get` + `sameInputs`） | 旧·`fieldDigest` 一次 | 铺场一次 |
|---|---|---|---|
| 48×48 (2304 格) | **0.0176 ms** | 0.0472 ms | 0.66 ms |
| 96×96 (9216 格) | **0.0652 ms** | 0.1901 ms | 2.70 ms |
| 192×192 (36864 格) | **0.2584 ms** | 0.8360 ms | 11.74 ms |

**「省下来的又吃回去」不成立**：命中路径便宜了 2.7~3.2×，而且是**提前退出**的（第一个不等的字段就 return false，
摘要必须扫完）。48×48（工单判据那档）命中开销 0.018 ms/tick，可忽略。
192×192 的 0.258 ms/tick 相对工单「查表 ≤0.1ms/tick」仍超，但那是上一轮就记的存量账，且比旧版更接近达标。

### 🟢 N4（P3·可接受·记一笔）快照深拷贝的内存

`snapshotOf` 每次重铺多拷一份 `blocked`+`cost`（JS number 数组·8 B/元素）：

- 192×192 每张场快照 **0.563 MB**；8 张并存 **4.50 MB**（`node --expose-gc` 实测）。
- 对照 baked 成品本身（`Int32Array×2` + `Int8Array×2` = 368 KB/张）——**快照比成品还大 1.5×**。
- 48×48：36 KB/张，可忽略。
- 拷贝的**时间**成本 = 铺场的 1.8%（48×48）/ 3.0%（192×192），不构成问题。

结论：M1 尺度可接受。要压就把快照存成 `Int32Array`/`Float64Array`（省 2×+），或与 N1 一起改。
**但在 N1 那个悬崖里这两份拷贝是每 tick 重新分配的** —— GC 压力与 N1 同生同灭，修了 N1 就没了。

---

## 五、上一轮没打穿、这一轮补上的

### ✅ 组件注释改口后是不是实况 —— **实测：是**

`spatial.ts:240-245` 改成「同挂 Steering 会被整段覆盖（含 separation）」。真跑：
同实体同挂 `FlowAgent` + `Steering{mode:'seek', separation:{radius:3, weight:5}}`，A/B 两个单位挤在一起：

```
只挂 Steering:      A=(-0.9856, 0.1689)  B=(0.9918, 0.1278)   ← separation 把 A/B 推开，vx 反号
同挂 Flow+Steering: A=( 0.7071, 0.7071)  B=(0.7071, 0.7071)   ← 逐位相同 = 分离被整段吞掉
执行序 = steering → flow-field → motion-apply
```

**文档现在写的是实况**（`:450` `v.vx = (dx/m)*a.speed` 是绝对写、且排在 steering 之后）。
上一轮 P1-④ 那条 ✅ 已闭。

### ⚠ `los:true` 的 trace 留痕 —— 痕在，但**密度仍超标**（存量 P2·本轮没修也没被要求修）

挂 `DebugTrace` 真跑（一张 `los:true` 的场 + 一张同 id 重复场 + 一个错 fieldId 单位 + 一个网格外单位·3 tick）：

```
t0 [reject] 1 张同 id 的场被忽略
t0 [reject] 场 f1 的 los 被忽略（视线优化属 M2·M1 未实现）
t0 [reject] 1 个单位找不到自己的场 → 停
t0 [reject] 1 个单位在网格外 → 停
t0 [commit] 写 Velocity：1 走 / 0 停
… t1 / t2 逐字复读
```

- **`los` 那条痕确实出现了 ✔**，`break` 保证每 tick 至多一条 ✔；
- 但它**每 tick 复读**（3 tick = 3 条），且最坏一 tick **5 条**，超 CLAUDE.md 的「每 system 每 tick ≤3 条」。
- 这是上一轮 P2-⑨ 原样留存（`los`/`dupes` 这类**静态配置**类 reject 天然每 tick 复读）。
  修法仍是那句：静态类只在场快照变化时发一次——**现在有 `sameInputs` 了，这件事比上一轮更好做**。

### 📝 两处口径已过期的注释（P3）

摘要删了，但两处还在讲摘要：
- `flow-field.ts:27`（文件头）「**重建时机确定**：由**输入摘要**驱动」
- `flow-field.ts:405`「`getBakedField` 要算**输入摘要**，那是 O(格数) 的一遍扫描」

内容上都还对（重建判据仍是输入驱动、仍是 O(格数)），但「摘要」这个词在文件里已经没有对应物。
**这正是上一轮 `spatial.ts:240` 被打回的同一种病的轻症**，顺手改成「输入快照逐字段比对」即可。

### 🟢 `CACHE_MAX` 的淘汰改动（多了 `oldest !== field.id`）—— 构造 9~20 张场验过，不自杀

`:295 if (oldest !== undefined && oldest !== field.id) cache.delete(oldest)`。
实测（20 张不同 id 依次插入后回头取）：**最后 8 张命中 8/8、最早 8 张命中 0/8** ⇒ 容量确实稳在 8，
**既没自杀也没无限增长**。同 id 连改 100 次 → `bakes=100`、槽位稳定。
分析上这个新判断其实**不可达**（`set` 之后 `field.id` 永远是最新插入的那个，容量只可能在插新键时到 9，
那时 `oldest` 必然不是它），属防御性死代码——**无害，我没把它算成问题**。

### ⚪ 上一轮的存量 P2 本轮**未修**（也不在本轮受托范围内，只登记）

- **9 张场的 FIFO 悬崖**照旧：实测 9 张场 20 tick → **bakes=180**（理想 9）；12 张 → 240。改 LRU 两行的事。
- `cost=0` 钳成 1 与 `:57` 注释「0 = 不可走」口径相反；`Infinity` 反而变墙。
- 坏数据（负 `cols`、缺 `goals`、长度不匹配、`cellSize<=0`、大 cost 饱和）仍崩或静默。
- 「(积分值, 格索引) 全序 tie-break」仍零覆盖（M1 不承重·M3 会承重）。
- bench 的 `bb ≤ a*8` 余量未收（见 ② 的判据讨论）。

---

## 六、我打了但**没打穿**的（说清楚，别让这份报告显得比它更强）

- **算法本体本轮没重打**：`c3cd18f5` 的 diff 完全没碰三遍管线（`buildCostField`/`buildIntegration`/`buildFlow`），
  只动了缓存段、`runsAfter` 一行、注释与测试。上一轮已把墙角检查（两遍都有）、势场法对拍、顺序无关性、
  整数积分逐条打过且**没打穿**，本轮不重复背。
- **多 World 真实并跑的确定性**：N1 是性能问题，我验的是「结果照样正确」（`bakes` 分开、两个世界方向相反 ✔），
  但我**没有**去构造一个真 lockstep 双端跑 hash 对拍。要彻底钉死「模块级缓存跨 World 共享不影响 hash」，
  该有一条 `hashSnapshot` 级别的对拍测试，现在没有。
- **`runsAfter` 在真实游戏装配下的落序**：我扫了「基线 + 一件」和一个我自己拼的「像 RTS」装配，
  **没有**去 game211 的真实 assembly 里打执行序（M1 阶段 game211 还没有成型 assembly）。
  第三节那条 40 员巨 SCC 是「全装」的极端，未必是任何真实游戏的形状。
- **`build`/`docs-ref` 等守卫我只看退出码与摘要**，没有逐条核对它们各自的基线文件是否与改动一致
  （`audit-baseline.json` 那条「game211 裸 Math.random 8 → 0 记得同提交降基线」是**上一个提交**留下的还债提醒，
  不是本提交引入，我没替它做判断）。

---

## 七、要施工方做的（按优先级）

1. **N1 · 同 id 多场缓存悬崖**（P2）——键回到 `id|摘要` **但命中后仍走 `sameInputs`**（哈希分桶 + 精确比对），
   或每 id 留 K 槽。P0 的修一点不丢，6.7× 的悬崖消失。**或者** owner 判「同进程多 World 同 id 不支持」并写死在文件头 + `requests.md`——
   但那样得同时把 `flow-field.test.ts:216` 那条测试的注释改掉，因为它现在正演示这个不被支持的形状。
2. **N2 · 改口**（P3）——提交信息 / `requests.md` 里把「跨世界不串味」从「P0 修复证据」挪到「新键设计的护栏」；
   P0 的证据是 0.0004 那条。
3. **③ 的范围限定**（P3）——「实测告警归零」加一句「在 steering+path-follow+flow-field+motion-apply 这一配置下；
   装上 hitbox/accel-apply/over-time/bounce-relay 后仍会落进存量 RMW 环（SCC 已比修前更小）」。
4. **两处过期注释**（P3）——`flow-field.ts:27` 与 `:405` 的「输入摘要」改成「输入快照逐字段比对」。
5. **`sameInputs` 的写死约束**（P3）——`:243` 上方加一行「字段一旦进铺场管线，必须同步进本函数」，把 `los` 那个坑钉住。
6. ② 的判据面（P2·可与后续分期一起）——bench 的 `a*8` 余量收紧，或把工单的 `≤0.1ms/tick` 真断言起来。

---

## 流程账

- **本轮撤修验红 4 刀（S1/S2/S3 + 我加的 S2b）锚点全中，三条打回项全部恰红**。
  与上一轮相比，施工方这次的验红自陈**可复现**——上一轮的 S6「声称 1→30000 实际全绿」那种情况没有再出现。
- **本轮抓到的两条（N1/N2）依然没有一条是门禁能发现的**：全量 4786 测绿、`scoped-gate --run` exit 0。
  N1 是性能悬崖（没有任何测试量它），N2 是「测试绿，但它在旧代码上也绿」——
  **「这条测试能红」和「它对目标缺陷有判别力」是两件事**，后者只能拿旧版跑一遍来证。
  建议把这一条加进 review 清单：**新增的「回归测试」要在被修的那一版上跑一遍，看它是不是真的会红**。
- 本轮全部验证在临时 clone 内完成（`<scratch>/ff-review2` @ `c3cd18f5`、`<scratch>/ff-old` @ `bb507744`），
  主仓 `git status --porcelain` 空，唯一写入是本文件。
