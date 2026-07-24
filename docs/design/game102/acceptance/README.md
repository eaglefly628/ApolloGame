# game102《色流工坊 / Pixel Pour》· 验收剧本包（S4 裁判 · REQ-ACCEPT）

> 作者=GD（懂规则方）。剧本=**纯数据**，harness 驱动**真引擎**（manifest World）逐步对账，
> 断言只读**机读态**（Resource / Flag / StringVar·**不读 DOM**）。PE 落薄适配器
> `src/games/game102/acceptance-adapter.ts`（纯接线零规则·把动作→引擎 action 信号、把机读态→下表投影），
> **不得改本目录剧本**；剧本写错=GD 改 + 记录。规则真相=`docs/design/game102/gdd.md` + 接线细则 `pe-handoff.md §3`。

跑：`npx vite-node scripts/acceptance-run.mjs --game game102`（进 vitest `scripts/acceptance.test.mjs`·推送门禁自动咬）。

## 动作词表（steps.do · harness → 引擎 action 信号）
| 动作 | 语义 |
|---|---|
| `tapSupply:<color>` | 点补给区该色 → 生成色炮上传送带（= 1 个 move）|
| `tapSupply:rainbow` / `tapSupply:chain` | 部署已强制激活的**自动特殊炮**（彩虹/连锁·须先 `grant`）|
| `useSpecial:laser` | 激活**激光炮**手动瞄准态（须先 `grant`）|
| `aim:col:<i>` / `aim:row:<i>` | 瞄准态下选中该列/行并发射激光 |
| `tapSlot:<i>` | 点第 i 个待命槽 → 该炮重装满弹药回传送带 |
| `tick:<n>` | 推进 n tick（让传送带移动 + 发射/消除结算完成）|

> **特殊炮强制激活**：关卡 `grant` 字段（如 `"grant": {"rainbow":1,"chain":1,"laser":1}`）在本局把特殊炮追加进补给区特殊炮区（= authoring 侧 `grant()`·spec special-cannons.md §0）。

> 「fast 连发」= 同一 step 内多个 `tapSupply`（同 tick·落在 BURST_WINDOW 内）→ 触发突破态。

## 机读态词表（steps.expect · PE 适配器必须投影）
| 键 | 类型 | 含义 |
|---|---|---|
| `remain.<color>` | Resource | 该色剩余像素块数 |
| `remain.total` | Resource | 剩余像素块总数 |
| `keys` | Resource | 已收集钥匙数 |
| `doorOpen` | Flag | 宝箱门是否已开 |
| `score` / `combo` | Resource | 得分 / 当前连击 |
| `conveyor.count` | Resource | 传送带在带色炮数 |
| `tray.count` | Resource | 待命槽占用数 |
| `flow` | StringVar | `playing` / `victory` / `defeat` |

> 断言只读上表；`>0` 类宽松断言写成 `{"score":">0"}`（harness 支持 `=`/`>`/`>=`/`<` 前缀·缺省 `=`）。

## 剧本清单（5 份 · S4 门要 ≥3）
| 文件 | seed | 查什么（依据） | 对抗目标（改坏什么会红）|
|---|---|---|---|
| `01-basic-clear` | 20101 | 自动同色连喷消色 + 清空判定（§3.2）| 去同色过滤 / launch 不触发 → remain 不降 |
| `02-ammo-tray-redeploy` | 20102 | 弹尽入槽 + 点槽重装复用（§3.3）| 弹尽不入槽 / 复用不装满 → 第二步 remain 不归零 |
| `03-keys-open-door` | 20103 | 钥匙收集 → 集齐开门 → 过关（§3.4）| 钥匙不计数 / 门不判达标 → doorOpen/victory 不成立 |
| `04-burst-over-cap` | 20104 | 快连突破容量 5→10（§3.5）| 突破态不切容量 → conveyor.count 被卡在 5 |
| `05-out-of-moves-defeat` | 20105 | 限额用尽仍有像素 → 判负（§3.5）| 负判缺失 → flow 不为 defeat |
| `06-rainbow-any-color` | 20106 | 彩虹炮命中**任意色**（special-cannons §1）| matchAny 失效 → 异色 remain 不降 |
| `07-chain-flood` | 20107 | 连锁炮一发清**连通同色区**（§2）| 去 flood 传播 → 只清命中 1 格·remain 剩一片 |
| `08-laser-line-manual` | 20108 | 激光**手动瞄准**清整列同色（§3）| aim/清列失效 → 该列同色不归零 |

- 全部用固定 seed（种子 PRNG 保同轨）；断言取**聚合计数**（`remain.<color>`）而非具体格，规避「多同色目标随机选中」的非确定性。
- 每份剧本头注列「对抗目标」——改坏对应被测逻辑时哪条断言会变红（假信心自查）。
- **变异测试留痕**：PE/复查在 S4 对每份剧本对应逻辑做定点变异，须精确打红目标剧本、还原后全绿（断言有牙·非常量）。

## 与八阶段的关系
- 这 5 份是 **S4 玩法关机器门**的一部分（walkthrough vitest 绿 **+ 本剧本 conformance 绿**）。
- 剧本作者=GD·harness 驱动真引擎·PE 只写适配器不改剧本（验收剧本循环律·CLAUDE.md）。
