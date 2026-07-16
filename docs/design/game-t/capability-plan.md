# 能力总览 Capability Plan — game-t《墨消》（2026-07-16·Lead 起草并评审）

## 1. 游戏一句话

竖屏水墨三消（糖果传奇-like）：`t3-match3-board` 驱动的交换消除+特殊棋子+格层目标，30 关闯关（GDD=`docs/design/game-t/gdd.md`）。

## 2. 消费的引擎能力（对照 `capability-registry` 实名）

| capability（注册名） | 用来做什么 | 状态 |
|---|---|---|
| `t3-match3-board`（含 match-resolve/match-view-sync） | 棋盘全机制：换/连/消/重力/补/连锁/特殊棋子/格层/moves/目标资源 | ✅ 现有（二期已验收） |
| `clickable` | 格子点选（选中/交换信号源） | ✅ 现有 |
| `resource-apply` | 消除产料/币、moves、jelly/blocker 目标计数结算 | ✅ 现有 |
| `event-when` + `effect-apply` | 胜负判定链（目标资源达成→胜；moves 尽→负）与关卡结算 | ✅ 现有 |
| `t3-flow`（GameFlow·PE-T 落地时选定） | 胜负流程实装形态：playing →(目标达成)victory / (moves≤0)lastcall 终步结算窗 →(窗过)defeat；onEnter 落输入闸 Flag | ✅ 现有（同属声明式解释器·替代散 EventWhen/Effect 实体，语义同上行） |
| 种子 PRNG（RandomSeed） | 一切随机（补块/洗砚·**游戏层禁裸 Math.random**） | ✅ 现有 |
| UI：LayoutNode 全套（LevelPath/Modal/Particles/flyTo/floatUp/format/stroke） | 选关长卷/结算/飘分/收集飞行/HUD | ✅ 现有（休闲批） |
| 拖拽滑动交换（输入面） | 竖屏手势换珠（点选两格可先行） | ⏳ 需下沉 → `REQ-INPUT-拖拽交换` |
| LayerCell 层视图（墨渍/冰纹瓷/砚石的覆盖格外观） | 格层状态→画面（防游戏层自写视图 system） | ⏳ 需下沉 → `REQ-M3-三期①` |
| 锦鲤（定向消除）+ 朱印二次钤印 | 后 10 关机制 | ⏳ 需下沉 → `REQ-M3-三期②③`（可后置） |
| 棋盘手感动画层（交换滑动/弹回/墨晕消除/落地弹/飞行拖尾/3D 质感） | GDD §五点五 十条硬需求（render-only） | ⏳ 需下沉 → `REQ-M3-三期④`（S3 前·视图路线 (a)canvas-tween/(b)LayoutNode 板 Lead 终裁·初判倾向 (b)） |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| 关卡表（30 行·schema=`docs/design/game-t/level-schema.md`） | 板型/色数/步数/目标/星阈/摆盘/格层/seed | `t3-match3-board` config + `event-when`/`effect-apply` 胜负链 |
| 棋子/格层外观映射 | 色→墨珠皮·特殊→卷轴/朱印/太极·层→墨渍/瓷/砚 | match-view-sync + LayerCell（三期①落地后） |
| comboTable | 4 条组合（引擎预置·本游戏照用） | t3-match3-board |
| 道具表（镇纸/洗砚） | 效果/发放/限用 | S2 落地时对照：优先用消除/重排信号重组表达；表达不了→提单（**不许游戏层自写道具解释器**） |

## 4. 申请的游戏层代码例外（逐条过审）

| 例外 | 为什么 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| （无·目标=纯数据装配） | — | 0 | ✅ 以零例外立项；PE 落地若发现表达不了的点，回本表补申请再动工 | — |
| balance-sim 脚本（GD 工具） | authoring-time 关卡验证 bot，非运行时游戏代码 | ~200（scripts/ 或 game-t 本地） | ✅ 准（工具·照 GD 白皮书 balance-sim 模式·确定性种子） | 无需偿还 |
| **编译期薄壳宿主（PE-T 2026-07-16 回表申请·已落地）**：`src/games/game-t/` = game-q 同款 mount/host（Engine 装载/画布指针入队/资源→LayoutNode HUD 投影/选关⇄关卡切换/星级 localStorage/音效 diff）+ levels 纯数据表 + schema 纯函数（字符画解析/目标推导/星级结算） | 卡带/manifest 今日表达不了：①LayoutNode UI 通路（LevelPath 长卷/HUD/结算 Modal——mountUI 只有编译宿主可调，mountManifestGame=纯画布）②30 关多世界流程与进度存档。GDD §七已预授权「manifest 表达不了→编译期路线+回本表补审」 | 实测 ~990（含 331 行测试·对标 game-q 936） | ✅ **owner 2026-07-16 session 拍板「可以有 TS 代码，但要克制」**；克制落法=规则 0 行进 TS：机制全在 t3-match3-board config + t3-flow 数据，宿主零胜负代判、零消除逻辑（走查测试为证） | REQ-M3-三期④ MatchBoardView / manifest-UI 通路落地后回评卡带化（bench 保证随之补齐） |

## 4.5 美术接入（必填）

- 皮肤槽：全部主体视觉实体（墨珠 BoardCell 视图/格层/背景/UI）带皮肤槽——BoardCell 走 match-view-sync 外观映射（Sprite/Color），UI 吃 styleset apollo-toon 主题皮。
- 台账产出：编译期游戏·照 game-q 样板写推导脚本（脚本名：`scripts/game-t-art-requirements.mjs`·GD/PE 落地时建·mergeLedger 保号）；需求稿=GDD §六（约 38 件）。
- 程序化占位仅作皮肤就绪前回退（styleset mock 同款纪律·provenance 记账）。

## 5. 确定性声明

- 随机源：引擎 RandomSeed（关卡表每关 seed 字段·补块/洗砚全走它）。
- 回放/lockstep：单机首发不开双人，但**保持 lockstep-safe**（t3-match3-board 二期已全整数+种子 PRNG）；balance-sim 依赖确定性回放——**任何游戏层非确定性=红线**。

## 6. 评审记录

- 提交人 / 日期：Lead（承 owner 2026-07-16 对话逐项拍板）
- Lead 裁决：✅ **通过**（零游戏层例外立项；条件：①S3 前 `REQ-INPUT-拖拽交换` 与 `REQ-M3-三期①` 须落地——点选交换可先行装配；②道具接线若需新解释器，回 §4 补审）
- **PE-T 落地记录（2026-07-16）**：骨架关（S3/S4 级）以**点选先行**装配完成——引擎两单（拖拽/①LayerCell/④手感层）owner 已改为「新开 session 亲自安排·池内勿动工」，按 owner 本 session 指令先行；壳形态经评（cart=library/ 不入库无法多 session 接力·builtin manifest 无 UI/多关表达）走编译期薄壳，例外已回 §4 补申请并附 owner 拍板；胜负链实装 `t3-flow`（§2 新行）。缺口台账见 `docs/design/game-t/requests.md`。
