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
