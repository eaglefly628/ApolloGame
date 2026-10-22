# Review 单 · `REQ-GROUND-TELEPORT` 贴地角色显式传送/复活

> 施工主体：Claude（锁 c9d16b0c·2026-10-21）。owner 判 **A**（主干代码 review 带出：贴地角色无法传送/原地复活）。
> 复查人 ≠ 施工人：下面每条都请自己复跑，本单是导航不是证据。

| | |
|---|---|
| 工单 | `docs/workflow/requests.md` · REQ-GROUND-TELEPORT（🔴 碰确定性/快照 hash·主程口径） |
| 契约 | `docs/design/ai-pipeline/ground-walking.md`「显式传送」节 |
| 改动面（引擎） | `src/engine/protocol/components/ground.ts` · `src/skills/tier2/ground-walk-3d.ts`(+test) · `src/assembly/ground-walkers.ts`(+test) · `component-map.ts` · 两份生成物 · `declaration-audit.test.ts` 相位基线一行 |
| 同提交顺修（门禁存量红） | `games/game113/guide-art.ts` 相对越界 import → 包别名；`tools/spritegen-export.test.mjs`（原生 node:test）移出 vitest、由 `scoped-gate` 面旗 `spritegenTest` 原生跑 |

## 一、做了什么

1. 新意图组件 `GroundTeleport3D{x,y}`（平面 Transform 米坐标·挂 walker 自身·category intent）。
2. 新系统 `ground-teleport-3d`：Input(-20)·显式 `runsBefore: ['ground-init-3d']`·`consumes` 该意图。目标点（加 Collider offset）在 walker 自己的 surface 上有支撑 → 写 `Transform.x/y`、`baseY`、整份覆盖 `GroundContact3D`（accepted=目标）；否则整体拒收，本系统零写入，意图照样消费，trace 记 `reject`。
3. 装载期 `validateGroundWalkers`：意图须同实体有 `GroundWalker3D`、字段闭集 `{type,x,y}`、有限数、在坐标预算内，否则原子拒收。
4. 不变：裸写 Transform 仍按整段行走回滚（测试里显式钉住了这条反例）；不吸附最近点、不改 Velocity、不换 surface。

## 二、请逐条核

| # | 核什么 | 怎么自己验 | 我的自陈 |
|---|---|---|---|
| 1 | 跨洞到高台生效、之后不被拉回 | `npx vitest run src/skills/tier2/ground-walk-3d.test.ts -t "relocates across a hole"` | 同一用例先证裸写 x=2.5 被拉回 0.5，再挂意图 → x=2.5·baseY=3·accepted 25000/30000，3 拍静止不回弹，再走 0.1 正常 |
| 2 | 先于 motion，同拍从目标起走 | `-t "applies before motion"` | 目标 2.5 + vx .1 → 本拍 2.6 |
| 3 | 拒收 = 零写入（含系统刚跑完那一刻） | `-t "rejects unsupported"` | 洞内/岛外/负/NaN/2e6 五种：`onSystemEnd(ground-teleport-3d)` 时刻与拍末状态都与拍前逐字相同，意图已消费，有 reject trace |
| 4 | 非 walker 上的意图 | `-t "non-walker"` | 实体不动、无 GroundContact3D、意图消费、trace 点名 |
| 5 | 初始无支撑者可救回 | `-t "rescues an unsupported spawn"` | supported false → 传送后 true，并恢复正常行走 |
| 6 | offset 口径 | `-t "collider offset"` | Transform 精确等于目标；采样点 = 目标+offset |
| 7 | 晚挂意图一拍延迟（确定性） | `-t "waits one tick"` | Update 相位挂的意图下一拍 Input 生效，挂起期间组件仍在世界里 |
| 8 | hash/快照/trace | `-t "equal per-tick hashes"` | 双世界逐拍 hash 等（一侧开 trace）；带挂起意图的快照+order 恢复后 6 拍 hash 逐拍等 |
| 9 | 定序零新 WARN | `-t "strict ordering"`（四组合·`softCycle:'throw'`·断言 console.warn 为空）+ `src/assembly/declaration-audit.test.ts` | teleport < init < motion；相位基线只新增 `ground-teleport-3d` 一名；SCC 基线不变 |
| 10 | 装载校验 | `npx vitest run src/assembly/ground-walkers.test.ts` | 合法意图经 Engine.load 首拍生效；孤儿/多字段/字符串/Infinity/超预算 5 种各按点名报错拒收 |

## 三、撤修验红（施工方已跑·请自选再撤）

| 撤法 | 结果（锚点） |
|---|---|
| S1 系统 execute 改空 | 8 红，全部是 teleport 用例 + 装载首拍用例 |
| S2 删 `runsBefore` | `[topological-sort] phase -20 … 定序环 [ground-init-3d, ground-teleport-3d]（闭环组件：Collider3D, GroundContact3D, Transform）` |
| S3 把 Transform 写入挪到支撑检查前（部分写入） | 恰 1 红 `rejects unsupported…`：`expected '[{"type":"Transform","x":1.5…' to be '…"x":0.5…'`。**首轮这刀没咬住**——拍末状态会被同拍 ground-pre 回滚掩盖；已把断言加到 `onSystemEnd(ground-teleport-3d)` 时刻，再撤即红 |
| S4 装载校验分支改 `if (false)` | 恰 1 红 `accepts an authored GroundTeleport3D…` |

### 追加：定向变异复查（施工后自查·撤修验红之外的第二轮）

对 `applyGroundTeleports` / `validGroundTeleport` 做 10 个定向变异（隔离 worktree，跑 `ground-walk-3d.test.ts` + `ground-walkers.test.ts`）。首轮 **5 个存活**，说明原测试有洞：

| 变异 | 首轮 | 原因 | 补测后 |
|---|---|---|---|
| T2 不校验 walker 步高单位 | 存活 | 没有「非法 walker 传送」用例 | 杀（rejects… `invalid walker units`） |
| T3 采样不加 Collider offset | 存活 | 同拍 ground-final 在连续坡上从错误接受点走到正确点，拍末自愈把错误掩盖 | 杀（在 `onSystemEnd(ground-teleport-3d)` 时刻断言 accepted 30000） |
| T4 不写 baseY | 存活 | 同拍 ground-pre 重采高覆盖 | 杀（同上时刻断言 baseY） |
| T8 不校验 trigger/非法 body | 存活 | 没有「trigger body 传送」用例 | 杀（`trigger body`） |
| T10 去掉缺 surface 守卫 | 存活 | 采样照样抛错，只是理由不同 | 杀（拒收理由逐条点名 `missing ground surface`） |
| T1/T5/T6/T9 | 杀 | — | 杀 |
| T7 不按 id 排序处理意图 | 存活 | 各实体意图互不影响，只改 trace 文本顺序；sim 等价 | 记为等价变异 |

教训：本能力的拍末状态会被同拍 pre/final「自愈」，只看拍末断言会放过写错的中间值——系统自身契约要在它刚跑完的时刻断言。

## 四、请重点判的三处

1. **落相位 Input、晚挂意图延迟一拍**。好处：motion 之前就到位，同拍走路从目标点起；不碰 Update 里那串 runsAfter。代价：Update/Commit 产生的传送下一拍才生效。另一条路是在 `ground-pre-3d` 里也消费，但那会让同一意图有两个消费点，并碰 Update 定序。请核这个取舍。
2. **拒收不停速**。连续行走被拒时 final 会把速度清零；传送被拒时我选择什么都不写（"整体拒收"更好推理，也不和 walker 本拍的正常行走打架）。如果你认为应该和行走拒收对齐也停速，我改。
3. **意图不带 surfaceId**。传送只能在 walker 当前 surface 内；跨 surface 要先改 `GroundWalker3D.surfaceId` 再传送。YAGNI，没有现役消费者。

## 五、门禁

- 全量计划：`audit:game113 → inert-comp:game113 → eslint → depcruise → skill-shape-guard → sim-dom-fence → tsc → vitest:full → build → docs-ref → context-budget → art-ledger-guard`。
- 除两步 game113 专属外全部按退出码通过（施工 HEAD `fcbfe2f7`）：eslint 0 · depcruise 0（施工前主干此步为红：game113 相对越界）· skill-shape 0 · sim-dom 0 · tsc 0 · **vitest 全量 661/661 文件·7043/7043 用例**（施工前主干 2 文件红：depcruise-fence 绿腿 + spritegen NoSuite）· build 0 · docs-ref 0 · context-budget 0 · art-ledger 2（存量死账·allowExit 放行档）。
- 读告警：全量输出 `topological-sort` 仅 2 行，均为既有夹具环 `[L, P]`；无任何 ground/teleport 相关 WARN。
- 两步 game113 专属是存量红：只要改动面碰 game113 就会被拉进门。本次只改它一行 import。**修改前主干隔离 worktree 对照**：`game-skill-audit game113` 输出逐字相同（RATCHET FAIL·React 屏×16·createElement×3·引擎同形手写×13·无基线）；`inert-component-guard game113` 输出逐字相同（无 blueprint.ts → 用法退出 2）。零新伤；豁免或返工归 game113 自身，不在本单。
- 门禁当场咬住一处施工遗漏并已同提交补上：新增组件须 `component-manifest-guard --update` 更新共同零件基线（161→162）。

## 独立复查判词（Claude · 2026-10-22 · 非施工会话）· **PASS（结案）**

| 铁律 | 复查方做了什么 | 结果 |
|---|---|---|
| ① 独立复跑 | `ground-walk-3d.test.ts` + `ground-walkers.test.ts` + `declaration-audit.test.ts`；全量门禁（主干 `ce807e7f`） | 34/34；全量 7226/7226，eslint/depcruise/tsc/build/docs-ref/context-budget 全 0 |
| ② 撤修验红（自选，不同于施工方 S1–S4 与 T1–T10） | G1 `transform.x = intent.x; transform.y = intent.y;` → 漏写平面 y | 2 例红（collider offset 精确目标 · 装载首拍） |
| | G2 传送分支（第 103 行）`supported: true` → `false` | 5 例红（跨洞 · 同拍先于 motion · 救回无支撑出生 · 双世界 hash/快照 · 装载首拍） |
| | G3 装载闭集 `Object.keys(teleport).some(…)` → `false` | 1 例红（装载拒收畸形意图） |
| | 恢复后 30/30，工作树干净 | — |
| ③ 实证 | 读 `applyGroundTeleports`：全部校验与采样在任何写入之前；按 id 排序处理；拒收不写任何字段 | 与契约一致 |
| ④ 读告警 | 全量日志 `topological-sort` 共 2 行，均为既有夹具环 `[L, P]` | 无 ground/teleport 相关告警 |

**对第四节三处设计判断的意见（Lead）**：
1. 落 Input 相位、晚挂意图延迟一拍——**认可**。确定性清楚，不碰 Update 的 runsAfter 链；需要同拍生效的场景目前没有消费者。
2. 拒收不停速——**认可**。「整体拒收 = 零写入」最好推理，也避免与本拍正常行走的拒收逻辑耦合。
3. 意图不带 surfaceId——**认可**（YAGNI）。跨 surface 先改 `GroundWalker3D.surfaceId` 再传送，契约文档已写明。

