# REQ-FLOWFIELD M1 独立复查报告（2026-08-24·判 FAIL 打回·确定性 + 判据层）

> 复查人 = Lead 派的独立复查 agent（复查人≠施工人成立·施工方=主程 session）。被审提交 `bb507744`。
> 四步铁律全走：① 独立复跑（退出码直量·不经管道）② 撤修验红带锚点命中断言 ③ 实证复现（每条「我觉得有问题」先跑出来）④ 读告警。
> 全部验证在临时 clone `<scratch>/ff-review`（`git checkout bb507744` + `npm ci`）内完成，主仓未动一字，本文件是唯一写入。

---

## 判词：FAIL（打回·确定性红线 + 判据层）

算法本体是对的，我打了一整轮没打穿：三遍管线正确、顺序无关性成立、凹形障碍夹具**真咬得住**（我另开一刀单独撤方向场的墙角检查，它照样恰红——我原本假设那是覆盖空洞，被实测推翻）、bench 数字复现、25 测 + 全量 4783 测 + tsc + 三道守卫我各自复跑全绿。

打回的理由不在算法，在**提交信息的三条头号声明经实证全部不成立**，而且三条都恰好落在「本单归主程的原因」那一栏：

| 提交信息原文 | 实测 |
|---|---|
| 「缓存是**纯记忆化不是状态通道**：键覆盖全部输入，清空只改耗时不改输出」 | ❌ **假**。同一份世界数据，只因同进程先铺过另一张同 id 的场，单位走到 x=**4.0000** 而不是 x=**3.0000** |
| 「撤『取场提到单位循环外』→ 铺场次数用例从 1 变 30000」 | ❌ **不可复现**。真撤了：**25 测全绿 exit 0**、铺场次数纹丝不动还是 1、bench 也照绿。这条卖点**没有任何机器判据咬住** |
| 「declaration-audit 的 SCC 基线加 flow-field——**没有新增环**」 | ❌ **假**。steering+path-follow+motion-apply 装配**无告警**；一加 flow-field 就打出 `检测到定序环 [steering, path-follow, flow-field]（闭环组件：Velocity）… 不保证合语义` |

三条都不是「读代码读出来的」，全是跑出来的；三条也都不会被任何门禁拦下——全量 4783 测里 `topological-sort` 的成环告警出现 **0 次**（唯一一处命中是它自己的测试文件名）。这正是「绿灯 ≠ 没话说」的教科书形状。

为了绿而绿是这套门要治的病，所以判 FAIL 而不是 CONCERNS。**P0/P1 修完（都在半小时量级）我预计直接 PASS**——不需要重做。

---

## 复跑与验红记录

### 独立复跑（退出码直量）

| 项 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 点名测试 | `npx vitest run src/skills/tier2/flow-field.test.ts` | **0** | 25 passed |
| 全量 vitest | `npx vitest run` | **0** | 504 文件 / **4783** 测 passed（与提交信息数字一致） |
| tsc | `npx tsc --noEmit` | **0** | — |
| declaration-audit | `npx vitest run src/assembly/declaration-audit.test.ts` | **0** | 4 passed |
| component-manifest | `node scripts/component-manifest-guard.mjs` | **0** | 147 = 基线 147 · PASS |
| test-hygiene | `node scripts/test-hygiene-check.mjs` | **0** | WARNINGS（仅存量白名单·非本单引入） |
| bench ④ | `npx vitest run games/game211/pathfind-scale.bench.test.ts` | **0** | 4 passed |

**门禁自陈属实**。以下所有问题都发生在门禁之外。

### 撤修验红（每轮先证明文件真被改到，再看恰好红了哪几条）

锚点命中判据 = 改后文件与原件 `diff` 非空且替换串确实存在（`assert old in s` 命中才写盘）；每轮跑完立刻 `cp` 还原并 `diff -q` 核对。

| 刀 | 锚点 | diff 行 | 退出码 | 恰红哪几条 |
|---|---|---|---|---|
| **S1** 只撤 `buildFlow` 的墙角检查（`flow-field.ts:192-196`·积分场那一遍保留） | 命中 ✔ | 6 | **1** | 1 红：`**凹形障碍不卡死**` |
| **S2** 只撤 `buildIntegration` 的墙角检查（`:165-167`） | 命中 ✔ | 4 | **1** | 1 红：`斜走不切墙角（两堵墙的对角缝不许穿过去）` |
| **S3** 方向场换成势场法（朝目标直线最近的邻格） | 命中 ✔ | 10 | **1** | 2 红：`**凹形障碍不卡死**`、`多源：两个单位各走向离自己最近的那个 goal` |
| **S6** 取场放回单位循环（`const bf = getBakedField(field)`） | 命中 ✔ | 2 | **0** | **0 红——全绿。与提交信息声称的「从 1 变 30000」相反** |
| **S7** 去掉堆 tie-break 的次键（`less` 只比积分值） | 命中 ✔ | 1 | **0** | **0 红——「全序 tie-break」这条 🔴 红线零覆盖** |

S2/S3 的验红记录**属实**，恰红在声称的那一条上。**S1 是我加的一刀**：施工方只声称「势场法那刀让凹形障碍恰红」，我另外验证了方向场那一遍的墙角检查也被同一条用例咬住——所以「斜走不切墙角只在积分场做了、方向场没做」这个怀疑**不成立**，两遍都做了（`:165-167` 与 `:192-196`），且都有测试压着。

### 实证复现（构造出来的、不是读出来的）

- **方向场墙角检查真在工作**：5×5，goal(0,0)，墙 (1,2)+(2,1)。`integ(2,2)=60`（可达）、对角邻 `integ(1,1)=14`（全场最小），若无墙角检查方向场会指 `(-1,-1)` 穿墙角；实测 `dir(2,2)=(1,0)` ✔
- **顺序无关性**：goals 三种排列 / 实体创建序整体颠倒 → `integration`、`dir`、每个单位的 `Velocity` 全部逐位相同 ✔（注：`buildIntegration` 是完整重铺的 Dijkstra，定点唯一，tie-break 在 M1 其实不承重——见 S7 与 P2-⑦）
- **积分场确为整数**：全部路径实测无浮点渗入（`buildCostField` 用 `Math.ceil` 钳到 ≥1 整数；`nv = curVal + NB_STEP[k]*nCost` 全整数加乘）。**这条声明成立。**

---

## 逐条核对

### 1. 确定性

#### 🔴 P0 —— 缓存**是**状态通道（提交信息的头号 🔴 声明为假）

根因：`fieldDigest`（`src/skills/tier2/flow-field.ts:218-228`）把 `cellSize / originX / originY / goals / cost` 用 `Math.round(x*1000)` **量化**后才入哈希，但真正消费这些值的 `cellOf`（`:72-77`，浮点除法 + `Math.floor`）和 `buildCostField`（`:88`，`Math.ceil`）吃的是**原始浮点**。于是**两个语义上不同的场共享同一个缓存键**，`getBakedField`（`:244`）会把先来那张的成品直接发给后来那张。

实证（模块级 `cache`（`:236`）跨 `World` 实例共享，所以污染跨世界、跨对局，不只是跨 tick）：

```
[A1] cost 全 1 vs 全 1.0004 → digest 都是 4x4:4220659550（同）
     但 buildCostField → [1,1,1,1] vs [2,2,2,2]（Math.ceil 差一倍地形代价）

[A3] originX 0 vs 0.0004 → digest 同
     integ(A)=[10,0,10,20]  integ(B)=[0,10,20,30]      ← 两张场本就不同
     B 走缓存 = [10,0,10,20]   B 单独跑 = [0,10,20,30]   ← 拿到的是 A 的成品

[A2w] 世界层（12×3 场·同 id 'f1'·同一段单位数据·40 tick）
      B 单独跑    = x 3.0000
      先 A 再跑 B = x 4.0000        ← 同输入不同输出，差别只是「进程里先铺过谁」
```

对 lockstep 的意义：两端只要 bake 历史不同（一端中途换过场、一端刚加入、一端跑过录像回放），同一份场数据可以铺出不同的流场 → **静默分叉**。这正是工单写「本条归主程的原因」那一栏点名要防的东西。

现存点名测试 `**缓存不是状态通道**：清空缓存后重铺，结果逐位相同`（`flow-field.test.ts:145-153`）**按构造就抓不到**——它拿同一个 `f` 对象铺两次，那条路上根本不存在两张不同的场。

修法（任选，都很小）：① `fieldDigest` 不量化，改哈希浮点的原始位（`Float64Array`/`DataView` 读 `getUint32` 两半）；② 或者让**消费端**先量化：把 `cellSize/originX/originY/goals/cost` 在进管线前统一归一到摘要用的同一精度，让「摘要相同 ⇒ 输入相同」重新成立。② 顺带把「cost 非整数向上取整」的边界也钉死。

#### 🔴 P1 —— 「成本与单位数无关」这条卖点没有任何判据咬住

`flow-field.test.ts:285` 的行内注释写着 `// 撤「取场提到单位循环外」→ 这里会变成 30000`，提交信息同样援引。**都不成立**：`flowFieldBakes()` 数的是**真铺场次数**，不是 `getBakedField` 的**调用次数**；调用放回单位循环后记忆化照样命中，计数纹丝不动。

```
S6（getBakedField 放回单位循环）：25 测全绿 · exit 0 · 铺场次数仍为 1
真实回归（48×48）：1000 单位 0.873 → 1.092 ms/tick ; 4000 单位 0.909 → 2.676 ms/tick（**2.9×**）
bench 也漏：S6 下 1000→0.972ms、4000→2.592ms，比值 2.67，判据是 bb ≤ a*8 → 照绿 exit 0
```

即：**src 的语义判据和 games 的形状判据两道都拦不住这个回归**，而它恰恰是施工方自陈「我自己踩过的真回归」。
修法：把判据改成量「每单位摊到的 `fieldDigest` 扫描次数」——最省事的做法是给 `getBakedField` 加一个只测试可见的**调用计数器**（同 `flowFieldBakes()` 的档，不参与判定），断言「1000 单位 30 tick → 调用 ≤30 次」。撤了 hoist 立刻变 30000，那才是提交信息描述的那条判据。

#### 🔴 P1 —— 新增了定序环，且没照抄隔壁一行就能解决的先例

```
[E3a] steering + path-follow + motion-apply          → steering → path-follow → motion-apply      （无告警）
[E3b] 上面再加 flow-field                            → steering → path-follow → flow-field → motion-apply
      stderr: [topological-sort] phase 0：检测到由**组件推断边**闭合的定序环
              [steering, path-follow, flow-field]（闭环组件：Velocity）… 按确定性平局裁决…
              **此顺序仅保证可复现、不保证合语义**
```

成因：`flow-field.ts:329` 申报 `reads: [… 'Velocity']` + `writes: ['Velocity']`，与 steering 完全同款，双向推断边闭环；而 `runsBefore` 只钉了 `['motion-apply']`（`:328`）。
**隔壁 `path-follow` 为了完全相同的原因，专门加了 `runsAfter: ['steering']`，并在 `src/skills/tier2/path-follow.ts:117-121` 写明了理由**（「两者都读+写 Velocity…钉 runsAfter:['steering'] 打破伪环」）。flow-field 没照做。

「SCC 基线只多了一个名字、没多一行」是真的，但那说的是**全库 SCC 簇**；在真实装配的世界里这是一个**新出现的告警**，落序由注册序/tier 序平局裁决而非语义。这就是 CLAUDE.md 点名的 CYCLEHAZ 形状：只告警、不改退出码、照跑。

**已经产生了可观察后果**：`spatial.ts:240` 写「与 Steering{separation} 正交：流场管『走到哪』，分离管『别挤成一坨』，**两者同时挂即可**」。实测同实体同挂 `FlowAgent` + `Steering`，平局裁决把 flow-field 排在 steering **之后**，而 flow-field 是**绝对写** `v.vx = (dx/m)*speed`（`:397-398`，不是叠加）→ steering 那一拍的输出**被整段丢弃**。文档这句话在当前落序下是错的。

修法：`runsAfter: ['steering', 'path-follow']`（未装时该 id 被忽略，安全）+ 把 `spatial.ts:240` 那句改成写死的先后语义（谁覆盖谁），或明确「同实体不要同挂」。

#### 我打了但**没打穿**的（这些声明成立）

- **整数积分**：全路径无浮点渗入 ✔
- **顺序无关**：goals 排列 / 实体序 → 逐位相同 ✔
- **零墙钟零随机**：源码级点名测试守着，我复核了正则剥注释的写法（`:166-170`）是有效的 ✔
- **重建时机由输入摘要驱动、不靠空闲调度** ✔（摘要本身的缺陷见 P0，与调度无关）

### 2. 正确性 —— 边界与坏数据（全部 P2，但都「静默」）

```
cols=-4 / rows=-1        → THROW RangeError: Invalid typed array length（引擎当场崩）
cols=1e6 rows=1e6        → THROW Array buffer allocation failed
goals 缺失               → THROW field.goals is not iterable
cols=3.5 rows=3          → 不崩，但 n=10.5 → 场半张，其余静默 UNREACHABLE
goals=[]                 → 全 UNREACHABLE，全体停车，零留痕
blocked 短于 cols×rows   → 缺的部分静默当「可走」        （len=2 / n=9 实测：只有 idx1 生效）
cost    短于 cols×rows   → 缺的部分静默当「代价 1」
cost=0                   → 钳成 1（可走）——但 :57 的注释写「0 = 不可走」，两处口径相反
cost=Infinity            → 变成 0 = 墙（与 cost=0 的处理正好反过来）
cellSize=0               → 全场 UNREACHABLE，全体停车，零留痕
cost=6e6 × 40 格         → 第 36 格起累计超 2^31-1，静默饱和成 UNREACHABLE → 单位停住，零留痕
```

`src/assembly/validate-manifest.ts:81` 只查 number/boolean **类型**、不查范围，所以负 cols 能一路走到 `new Int32Array(-16)`。宪法尺子说这两个组件要「最弱 LLM 也能填」——那就得对填错的值有个说法。**至少**：`cols/rows` 非正整数、`cellSize<=0`、`goals` 缺失、`blocked/cost` 长度不等于 `cols*rows` → 走 `appendTrace(…, 'reject', …)` 并整场降级成「全体停车」，别崩也别静默走错。

`UNREACHABLE` 本身的处理是对的：孤岛格 = `(0,0)` 停、不乱指方向（`:186`），goal 落墙里/图外该源失效其余源照铺（`:142`），都有测试。

多场同 id 的处理也是对的：按实体 id 排序取首张 + `reject` 留痕（`:344-350`），实测取到 `fA` ✔。`fieldId` 指向不存在的场 → 停 + 留痕 ✔。

### 3. 性能与判据诚实性

**把计时挪到 `games/game211/` 是合规的，不是「挪到没人拦的地方」**——我核了：`scripts/test-hygiene-check.mjs` 的 `ROOT = 'src'`（只扫 src），`games/game211/**` 在 vitest 快车道 include 内、不在 DEEP_GLOBS 排除里，`scoped-gate` 碰引擎面判 full → `vitest run` 会跑到它。**真正的问题是挪过去之后判据蒸发了**：`pathfind-scale.bench.test.ts` 里唯一的数值断言是 `expect(bb).toBeLessThanOrEqual(a * 8)`（4000 单位不超过 1000 单位的 8 倍）——8 倍的余量宽到 S6 那种 2.9× 的真回归都能大摇大摆走过去（实测走过去了）。**工单写死的 M1 判据「1000 单位铺场 ≤2ms、查表 ≤0.1ms/tick」在全仓没有任何一处被断言，只被 `console.info` 打出来。**

bench 数字复跑（同机·出厂那一份）：

| 项 | 提交信息 | 我复跑 | 判 |
|---|---|---|---|
| 铺场 576 格 | 0.27ms | 0.13ms | ✔ |
| 铺场 2304 格 | 0.55ms | **0.55ms** | ✔ |
| 铺场 9216 格 | 4.43ms | 2.66ms | ✔（更快） |
| 铺场 36864 格 | 13.1ms | 11.80ms | ✔ |
| 1000 单位/tick | 0.62ms | 0.83ms（另一轮 0.34ms） | ✔ 同量级 |
| 4000 单位/tick | 1.10ms | 1.15ms | ✔ |

**数字本身诚实**，我没抓到修饰。但两条口径问题：

- **「铺场 ≤2ms」达标（2304 格 0.55ms）✔；「查表 ≤0.1ms/tick」不达标**——实测 1000 单位每 tick 0.33~0.97ms（多轮），**3~10 倍于判据**。提交信息给铺场那条明确标了「M1 判据 ≤2ms」作对照，给每 tick 那条**只报数字、不提判据**。拆开看：ECS `query` + 1000 个字符串 id 的 `.sort()` 就吃掉 0.11ms/tick（`:335`），缓存命中路径的 `fieldDigest` 只占 0.0015ms。这条要么承认没达标、要么把判据口径改清楚（「查表」是否含 ECS 查询与排序），**别两头不认领**。
- **「比参考实现慢 2× 是因为八邻域」是个托词，而且是**把自己说差了**的托词。** 同文件 ② 段参考实现（四邻域·单源·无地形代价·Float64）vs ④ 段真能力（八邻域）：

  | 尺寸 | ② 参考 | ④ 真能力 | 真相 |
  |---|---|---|---|
  | 24×24 | 0.91ms | **0.13ms** | 真能力快 **7×** |
  | 48×48 | 1.28ms | **0.55ms** | 真能力快 **2.3×** |
  | 96×96 | 2.50ms | 2.66ms | 持平 |
  | 192×192 | 7.21ms | 11.80ms | 真能力慢 **1.64×**（不是 2×） |

  我把真能力的 `NEIGHBORS` 砍成四邻域再量（锚点命中·量完还原）：192×192 → **8.36ms**（八邻域 11.02ms）。**八邻域只解释 1.32×**，剩下 1.16× 是别的开销；而边数比实测确为 **1.97**（八邻域 7812 次松弛 vs 四邻域 3968 次，32×32）——**边数翻倍 ≠ 耗时翻倍**。四个尺寸里三个真能力更快或持平，「同尺寸慢约 2× 属预期」这句话在数据面前站不住。删掉它比留着好。

- **CACHE_MAX=8 是个悬崖不是斜坡**（`:235` + `:250-253` 的 FIFO 淘汰「最早插入」而非 LRU）：

```
8 张场 · 20 tick → 累计铺场   8 次（理想 8）
9 张场 · 20 tick → 累计铺场 180 次（理想 9）—— 每 tick 每场全重铺，命中率归零
```

  多阵营 + 多占领点的 RTS 里 9 张场不是奇景。注释「8 场也够」是拍脑袋。修法：改 LRU（命中时 `delete` + `set` 重新插到队尾，两行），或按场数自适应上限。

### 4. 契约与接线

- **`reads`/`writes` 申报 = 真实访问 ✔**：`world.query('FlowAgent','Transform')`、`queryEntities('FlowField')`、`getComponent(Velocity/Status)`、`addComponent(Velocity)` —— 全部在申报内，`declaration-audit` 复跑绿。`reads` 含 `Velocity` 是必要的（缺省时先 add 再改），但**这正是新环的来源**，所以对策不是删申报而是补 `runsAfter`（见 P1）。
- **`runsBefore` 在真实世界里生效 ✔**：跑了三种装配打印实际执行序，`flow-field` 每次都在 `motion-apply` 之前（最小世界 `flow-field → motion-apply`；混装 `steering → path-follow → flow-field → motion-apply`）。**但那个位置是平局裁决出来的，不是申报出来的**（同上）。
- **组件字段是不是纯数据**：`FlowField`/`FlowAgent` 全是数字、字符串、数组、`{x,y}` 列表 —— 符合宪法尺子 ✔。唯一别扭是 `blocked/cost/goals` 在 `describe.fields` 里都申报成 `type:'string'`（`:299-302`），这是本仓复杂字段的既有占位约定（`validate-manifest.ts:17` 写明了），不算本单的问题。
- **`los` 的处理**：字段摆着不报错，挂了 `DebugTrace` 才在 trace 留一条 reject（`:359`）。我的判断是**够了**——真正给作者看的信号是 `describe.fields.los` 里那句「M2 未实现·M1 忽略」，那个是不挂调试组件也能看到的。但那条 trace **每 tick 都发一次**（不是只发一次），见下。
- **trace 密度超标**：实测最坏一 tick **5 条**（dupes / los / noField / offGrid / commit），CLAUDE.md 的密度规格是「每 system 每 tick ≤3 条」。且 `los` 与 `dupes` 这类**静态配置类**的 reject 天然每 tick 复读。建议：静态类只在场摘要变化时发一次。

---

## 问题清单

### P0（必修·确定性红线）

1. **`fieldDigest` 的量化让缓存变成状态通道** —— `flow-field.ts:218-228` 与消费端 `:72-77`/`:88` 口径不一致，两张不同的场撞同一个键。世界层已复现「先跑 A 再跑 B」≠「只跑 B」（x=4.0000 vs 3.0000）。lockstep 静默分叉风险。修法见上（哈希原始浮点位，或让消费端量化到同一精度）。**并且补一条真能抓到它的测试**：现存 `:145-153` 那条按构造抓不到。

### P1（必修）

2. **「成本与单位数无关」零判据** —— `flow-field.test.ts:285` 的行内注释与提交信息声称的验红结果不可复现（S6 全绿 exit 0·铺场次数仍为 1），bench 的 `bb ≤ a*8` 也漏（实测 2.9× 回归照过）。改成数 `getBakedField` **调用次数**。
3. **新增定序环未按先例钉死** —— `flow-field.ts:328` 只有 `runsBefore:['motion-apply']`，缺 `runsAfter:['steering','path-follow']`（先例与理由：`path-follow.ts:117-121`）。装配告警实测已出现；提交信息的「没有新增环」需更正。
4. **`spatial.ts:240` 的「与 Steering{separation} 正交·两者同时挂即可」与实现相反** —— flow-field 绝对写 Velocity（`:397-398`）且在平局裁决下排在 steering 之后，steering 那一拍输出被整段丢弃。修文档或修语义，二选一。

### P2（应修·可与上面同批）

5. 坏数据崩溃/静默：`cols/rows` 非正整数 → `RangeError`；`goals` 缺失 → `TypeError`；`blocked/cost` 长度不匹配 / `cellSize<=0` / 大 cost 积分饱和 → 静默走错或全体停车且零留痕。至少补 reject 留痕 + 整场降级。
6. `cost` 语义两处口径相反：`:57` 注释说「0 = 不可走」，`:88` 实际把 0 钳成 1（可走）；而 `Infinity` 反倒变成墙。
7. **「(积分值, 格索引) 全序 tie-break」这条 🔴 声明零覆盖** —— S7 撤掉次键，25 测全绿。M1 不吃亏（完整重铺的 Dijkstra 定点唯一，tie-break 其实不承重），但 **M3 分块增量重铺会承重**，那时候没测试就晚了。要么现在补一条（对称多源图上比对「不同插入序 → 同结果」），要么在文件头把「M1 阶段不承重」写明，别当红线挂着。
8. `CACHE_MAX=8` 的 FIFO 淘汰在 9 张场时命中率归零（20 tick 180 次铺场）。改 LRU 两行的事。
9. trace 密度最坏 5 条/tick（规格 ≤3），且 `los`/`dupes` 这类静态配置 reject 每 tick 复读。
10. 提交信息「比参考实现慢 2× 是因为八邻域」删掉或改写 —— 四个尺寸里三个真能力更快或持平，砍成四邻域实测只差 1.32×。这句话把自己说差了。
11. M1 判据「查表 ≤0.1ms/tick」实测 0.33~0.97ms 未达标，且提交信息只报数不对照（同一段里铺场那条却对照了「M1 判据 ≤2ms」）。要么认，要么把判据口径改清楚。

---

## 流程账

- **归属判对了**：这单确实是 🔴（新增 system + 确定性 + lockstep + 定序），归主程无误。P0 那条恰好就是「不在 spec 也不在 review 清单里、动手才撞出来」的那类。
- **施工方的验红记录 5 条里 2 条属实（S2/S3）、1 条不可复现（S6）**，另有 2 条（斜走墙角、CC 定身）我没逐一复跑但 S2 已覆盖前者。**建议在工单里把 S6 那条标注为「记录不实·已由 2026-08-24 复查复测为全绿」**，不要留在库里当后人参考。
- **「门禁全绿 exit 0」属实**，我逐项复跑核对了退出码。但本轮 11 条问题**没有一条**是门禁能发现的——全量 4783 测里 `topological-sort` 成环告警出现 0 次，因为**没有任何测试把 steering 和 flow-field 装进同一个世界**。这是「读告警」这一步的一个新形状：**告警不出现，不代表没有告警——可能只是没人组装到那个配置**。以后碰「新 system + 共享写面」的单子，复查必须**手动组装真实世界**打执行序，不能等告警自己冒出来。
- 本轮全部验证在临时 clone 内完成，主仓零改动（`git status --porcelain` 空），唯一写入是本文件。
