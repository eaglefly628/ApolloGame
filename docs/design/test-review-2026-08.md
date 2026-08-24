# 全库测试大扫除（owner 2026-08-22 令：全面 review·移除无用·补确保性测试）

> 方法：七路只读评审（同一把房规尺子：①恒真/断言自造数据 ②重复覆盖须点名更强者 ③mock 掉被测物 ④「两种实现都能过」；
> 禁删清单=撤修验红锚点/回驳证明/契约/守卫/棘轮/计数下限/钉 bug 回归）→ **Lead 逐条实证删除候选后才动刀** →
> 四路施工（W 告警收编 / X 门禁补牙 / Y 服务与游戏层 / Z 装配与空间）+ Lead 亲修 net 面 → 撤修验红 → 全量门禁+慢车道对数。
> 评审读了 **527 个测试文件**（含 219 个专职域/冻结面只报告不动手）；慢车道基线（清理前）= **4941 例·4939 绿·2 处在案红**（game-103 SBUG-01·game102 ADAPTER·均有工单）。

## 一、评审捞出的两个真 bug（都已修·撤修验红各恰中）

1. **hashSnapshot canonical 键位裸拼 → 真实 hash 碰撞**（`src/net/determinism.ts`）：实体 id 含 `|;` 即可伪造多实体结构——实证两个不同快照 hash 双双 `82653c9e`（desync 假绿+存档篡改假绿面；SAVEORDER 当年记档「威胁模型外」，但数据驱动世界 id 由数据侧生成，分隔符入 id 属可达事故）。**修**=键含该层结构字符才 JSON.stringify（干净键原样→全库既有 canonical 逐字节不变·prefab id 的 `#/:` 不受扰·golden 锚 `e5341c34` 在测钉死旧档兼容）。回归钉 5 例（碰撞封死×2·golden 兼容·组件级该变必变·嵌套键序不该变必不变）。
2. **state-sync 旧 keyframe 无条件覆盖镜像 → 乱序信道状态回卷**（`src/net/state-sync.ts:217`）：迟到/重发的旧关键帧把盟友镜像拽回旧状态。**修**=`held.tick >= packet.tick` 即忽略。回归钉：先到 t3→迟到 t0 忽略→同 tick 重发幂等。

另 X 路对照实证一枚**存量 bug**：pipeline-smoke.py 硬编码旧台账路径（CARTART 挪位后一直红着没人看见）→ 已入 REQ-GATESMOKE ④。

## 二、删除（全部经 Lead 实证：恒真=读码证明·重复=更强者点名在案）

| 域 | 删了什么 | 判据 |
|---|---|---|
| atoms | flag「component shape」整段 4 测 + 6 条裸 World-API 重复；tag 位运算恒真 1 测；transform 8 条裸 World-API 重复（metadata/roundtrip 契约保留） | 恒真（断言自构字面量·零被测代码）/ 重复（world-index remove-readd/destroy 重建/随机序列对拍=严格更强） |
| tier2 | launch「无目标+无 fallbackDir」与「无目标→fizzle」逐字段重复（断言真子集）；self-rule 复制粘贴双行删一；matrix-duel 工厂恒 defined 行 | 重复 / 恒真 |
| net/bench | net.test 恒真 forEach 下标行+误导注释；bench verdict 类型闭集恒真行（Z） | 恒真 |
| scripts | pipeline-smoke 恒真占位三行；ui-walkthrough-probe「假信心自查」对照恒真两行（X） | 恒真 |
| 专职域 | 只转单不动手（见 §五） | — |

一揽子未删（Lead 裁）：17 处各 atom「stores and reads back」模板测——兼作类型字面量唯一运行时触点，删除收益小，留。

## 三、加固（弱断言 → 真咬合）

- **撞环告警收编族（W·12 文件 15 用例）**：`not.toThrow` 对 warn-only 推断环不设防（ENG-03 形状）→ 全族加 warn spy 断零 `[topological-sort]`/`Circular`。双演练：断言翻转恰红 + 注入假告警恰被捕。Z 路演练 A 更给出铁证：注入 RMW 环时旧 not.toThrow 纹丝不动、新断言恰红。
- **门禁接线层补牙（X·scripts 13 文件+1 新建）**：scoped-gate 七面旗↔步总对账+slowLane 正向+docs-only 计划逐步钉死；art-ledger-guard 退出码矩阵 0/1/2 CLI 三腿（曾可 1↔2 对调全绿=新黑户以 WARN 放行）；test-hygiene-check 从全库零自测→种违例真红；engine-random/context-budget/decouple 三守卫 CLI 红腿；slow-lane subjects 存在性下限；art-replace CLI 腿去真仓化（ART_REPLACE_ROOT 注入·缺省钉死不变）。
- **装配/空间（Z·7 文件）**：system-graph 101 能力逐个零告警；registry AMBIGUOUS 防空转（点名 BoardCell）；cycle-tiebreak 环签名基线（成员+闭环组件抄实测·新环即红）；aabb-tree query(box) 随机对拍+clear 语义（种「跳右子树」bug 恰 3 红）；navmesh 精确边数公式（八向 11×11=420）；contact3d 法线方向。
- **net 面（Lead 亲施）**：orderCommands 全序+同 playerId 到达序钉死；FixedStepClock 三边界（封顶清积压/负帧钳 0/非整除 600 帧不漂）；state-sync 首发关键帧升格 hash 相等；World.restore version 单调（撤 world.ts 那行 version++ 即红——派生缓存作废承重线此前零测试）。
- **tier2/tier3 语义钉（Lead 亲施）**：aggro 等距 tie-break 恒取 id 小者·反序创建同布置同选（确定性承重）；dialogue 拒收路径两条（越界 index 停原地·请求消费不残留；line 节点收 Choose no-op）；block-grid 同拍双意图恰一单成交不双花；card-scoring RNG 消耗契约（无 chance 0 roll·chance 在场含 1/1 逐张恰一 roll——roll 次数漂移=lockstep turnHash 漂移，钉死）；launch 零向量不产 NaN×2；craft-recipe 同拍双配方争余额不透支（现契约=eid 序实测钉死）；effect-apply order 并列用不可交换算子钉 eid 序（原并列测试两个 add 可交换=任何顺序都绿）。

## 四、Y 路（服务与游戏层·27 条全落·Lead 抽核 55 例复跑绿）

- **B-014 清账**：game-b 死断言（else 恒真）重写为必和局面直断（canTsumo/自摸结算/kyotaku=0）·工单同提交出池。
- **假确定性重写**：game-c chip3d「同 seed 同枚数」（枚数=参数纯函数·裸 Math.random 也绿）→ 同 seed 双引擎逐 chip (vx,vy,vz,avy) 序列相同 + 异 seed 必不同。
- **持久化坏路**：LocalStorageSavePort 坏 JSON 槽/坏索引/索引写失败回滚三面 + steam-cloud save 侧回滚（新槽删孤档·旧槽还原 v1）——此前全部只测正路。
- **⚔ 对抗性输入补齐**（各游戏按手册清单）：game-a 非当前座/同拍双 act·game-b 碰窗连点与关窗后 call·game-c gameover 后全动作 no-op·game-e 三条拒绝路径·game102 弹库耗尽连点同 hash·game-103 输入脚本双跑同 hash。
- **三处「与假设不符」按真实行为钉现状**（不改游戏逻辑·注释在案）：game-e `play([99])` 空手计分仍耗一手；game-c pawn 闸是 eliminated/典空而非相位；**game-103 sim 层终局后 pick 无闸（HUD 层挡）**——日后加闸按新语义改写。
- 撤修验红三轮（撤 discard 闸/撤 callWindow 清窗/撤 steam 回滚）各恰中锚点。

## 五、转单（专职域/延后项·全部有名有主）

- **REQ-NETGAPS**（引擎池·主程）：lockstep 乱序信道测试·epoch 淘汰测试·lockstep hash order 盲区 canary——时间驱动 harness 写差即 flaky，不硬塞本轮。
- **REQ-GATESMOKE**（引擎池·主程）：14/18 冒烟不在门·py 冒烟 harness 无自证·dokiworld witness 不在门·pipeline-smoke 旧路径存量 bug。
- **REQ-3D-TESTGAPS**（3D 池·P3D）：dispose 面零覆盖·melee 物理写回闸口 hash 流·slg bench 墙钟出门·turn-combat 条件断言·game211↔game-g 22 文件 fork 重复面裁决。
- **REQ-I-测试大扫除PUI包**（game-i 池·PUI）：emotion-art 恒真·换皮不带 host 工件·动效重播语义未定义等六项。
- **REQ-D-测试最薄面**（game-d 池·P3D）：全游戏仅 68 行单测·无 walkthrough·无双跑·⚔ 零覆盖（出口游戏最薄）。
- **F3**（UPBACKUP 尾·PST·在案）：art-backup-smoke 补覆盖式夹具。

## 六、终数对账

- 快车道推送门禁：`scoped-gate --run` **scope=full 全绿**（退出码 0 直取·art-ledger WARN 为在案存量）。
- 慢车道：清理前 **4941 例·4939 绿·2 在案红** → 清理后 **4971 例·4969 绿·2 红**——红恰为同两处在案（game-103 SBUG-01·game102 ADAPTER·各有工单），零新伤。
- 净账：删无用测试 ~30 条（恒真/重复/假确定性）·新增确保性 ~60 条（真 bug 回归钉/告警收编/门禁红腿/对抗输入/边界不变量）。
- 复查纪律：删除候选 100% Lead 实证后动刀；四路施工各带撤修验红演练（合计 10 轮·全部锚点命中）；Lead 对 W/X/Y/Z 交付各抽核独立复跑（59+15+33+55 例绿）；tsc 0。
