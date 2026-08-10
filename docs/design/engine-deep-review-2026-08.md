# 引擎底层深审战役（owner 2026-08-10 令·三轨全选·派工唯一真相）

> owner 原话：「做一下底层隐形的一些真实的回顾」——三个选项（地基实证复审 / 清 8/4 余账 / 108 引擎变更总审）**全选**。
> 「真实」的口径 = **每条结论都是跑出来的，不是读出来的**（2026-08-06 复查铁律：一轮五处错无一处靠读码发现）。

## 证据标准（三轨通用·不达标 = 没审过）

1. **每条结论附命令 + 输出**：说「护住了」要贴哪个守卫咬的红；说「裸奔」要贴破坏后全绿的证据。
2. **破坏性探针带锚点命中断言**：预告哪条测试该红，跑完核对是不是恰好那条红（防「全绿只是没改到文件」假象）。
3. **隔离施工**：探针要改代码（临时破坏），**绝不碰共享工作树**——各自 `git worktree add <scratchpad>/probe-XX HEAD` + 软链 node_modules（本 session 已验证的配方）。
4. **退出码不经管道量**；深车道文件（`vite.config.ts` DEEP_GLOBS 排除表）须 `ZEROCRAFT_DEEP=1` 点名跑。
5. **读告警**：stderr 的 WARN/成环告警不改退出码——绿灯不等于没话说，逐条收割入账。

## 轨 A · 引擎地基实证复审（确定性/定序相位/快照/lockstep/存档）

| 探针组 | 不变量 | 锚点 | 交付 |
|---|---|---|---|
| A1 确定性+定序 | 同 seed 同轨（worldHash）；NON_DETERMINISTIC 名单失效面；topological-sort 成环告警面；Update/Commit 相位错位有没有守卫 | `src/net/determinism.ts`·`src/engine/core` 定序·`src/skills/tier2/matrix-duel*` | 证据表：不变量→破坏→哪个守卫咬→护住/裸奔 |
| A2 lockstep+存档 | 存档 roundtrip 后同轨；envelope checksum fail-closed；manifest `__proto__` 拒收；lockstep 输入 epoch 缓存（8/4 P0 修）撤修验红 | `src/services/save/`·`src/services/storage/save-system*`·`src/net/lockstep-platformer.test.ts`·`src/net/fixed-step.ts` | 同上 |

裸奔项按路由开单：引擎面进引擎池（满槽则降级挂本档）、游戏面进该游戏 requests。

## 轨 B · 清 8/4 大评审余账（spec = `engine-review-2026-08-04.md`）

| 项 | 内容 | 归属 | 排程 |
|---|---|---|---|
| 根因② 运行时组件全集基准 | 扩 `scripts/build-component-map.mjs` 出运行时可枚举全集清单 → 解锁 NON_DETERMINISTIC ⊆ 全集对账测试（+ 后续装配校验/catalog 共用的可信来源） | 派工（隔离 worktree·Lead 终审） | **先行**（A1 的名单失效探针正好给它当验收对照） |
| 根因① reads/writes 申报对账守卫 + §3.1 补齐 13 处 | 定序契约=🔴 只归主程 | **Lead 主程亲做** | 等 A1 定序探针结果回来再动（守卫设计要吃它的证据） |
| Q1 消费路径 | dump-catalog 分档 + capgap 断链 + audit 进推送门三条 regex + pick-list 决策树 + 清 game102 实况红旗 | 派工（低成本小活） | 等根因② 落地后（避免门禁接线面双头） |

## 轨 C · 108 引擎变更总审

对象 = **为 108 下沉/带出的引擎面变更**（约 2026-08-05 起：MATRIXDUEL 两相拆分、CYCLEHAZ B、EVIDENCE_DIRS/PIPEHASH、ARTTOOL-01/02、WAITUNTIL、ENG-01~08 系列……以 git log 实扫为准，不凭这份手抄清单）。逐笔过：改了什么／测试盖住没／欠了什么债（登记了吗）／告警面有没有没读的。另做一次**全量告警收割**：隔离树跑深车道全套 + 门禁，stderr 里每条 WARN 分类「已有工单 / 无主」，无主的开单。

## 汇口

三轨证据全回 → Lead 终审（独立复跑抽样）→ 裸奔/欠债分级开单 → 向 owner 交一份「地基体检报告」：哪些面**实证护住**、哪些面**裸奔已开单**、哪些债**明知不修**（附理由）。

---

# 体检结果（2026-08-10·四路证据全回·Lead 终审毕）

> 终审方式：B2 施工件 Lead 全程亲验（独立复跑 + 双轮破坏各恰锚点红，含一次「我的破坏不合契约形态」的假绿教训——`readonly type:` 才是组件契约稳定形态）；A1/A2/C 的开单级结论逐条抽验（读码/复跑坐实），原始证据见各探针报告（本 session 记录）。

## 一 · 实证护住（破坏后守卫恰锚点红）

- **同 seed 同轨**：game108 真世界 700 拍逐拍 hash 全等；异 seed 分歧仅在 PRNG 自身状态（A1）。
- **存档三道防线**：存读往返同轨；envelope/快照单字节改坏即拒（fail-closed·撤修恰 4+1 条红）；`__proto__` 拒收（撤修恰 2 条红）（A2）。
- **lockstep 加入死锁 P0 修复**仍有守卫：撤修恰 1 条红、失败签名与当年死锁逐字吻合。⚠ 守卫深度=1（唯一防线在 lockstep-tab 错峰用例·登记性提示）（A2）。
- **CYCLEHAZ 平局裁决**自身有点名测试；ENG-06×ENG-02 交叉缺陷处置 = 缺口裁决协议教科书样本（C）。
- **NON_DETERMINISTIC 幽灵名裸奔 → 当日闭环**：A1 实证「加假名全库零咬」；轨 B 根因② 全集基准 + 对账守卫合入（`e8a0b02c3`·150 组件·漂移门双保险），Lead 亲测假名即红并报名。
- **RandomSeed.sequence 缺省 NaN**：A1 疑点 → Lead 实证 + 直接修（`?? 0`·撤修验红 `expected NaN to be 1` 在案·本提交）。

## 二 · 裸奔已开单

| 裸奔面 | 实证 | 工单 |
|---|---|---|
| 引擎层裸 Math.random 零守卫 | 往 matrix-duel 结算插真随机：audit PASS·门禁无此步·被咬全靠碰巧的精确数值断言（A1 探针2） | `REQ-GUARDGATE` ① |
| test-hygiene-check HEAD 即红且未接门禁 | Lead 复跑 exit 1（loop-stop.test.ts:25 [time-wait]）·scoped-gate 零接线 | `REQ-GUARDGATE` ② |
| desync 只有显示级检测 + 领先端盲区 | 60/60 拍分叉双端零报警；`lockstep-tab.ts` `inSync` 缺对端数据**默认 true**（Lead 读码坐实）（A2 发现①） | `REQ-DESYNC` |
| 存档 `order` 段不入指纹 | `load()` hash 只盖 snapshot；order 反转带病加载零报错；order 决定 restore 后 query 序（A2 发现②·Lead 读码坐实） | `REQ-SAVEORDER` |
| 相位错位无机制守卫 + 成环告警无人收割 | 把宣告系统挪错相位：单测靠**手写申报断言**咬、acceptance 12/12 全绿纯靠注册序巧合；告警每趟 12~58 条只进 stderr（A1 探针4/5） | 并入**根因①** spec（主程亲做·三方对账：申报 reads/writes vs 实际访问 vs 相位落桶 + 成环告警棘轮） |
| game211 三项硬红线且无工单池文件 | 裸 Math.random×8 + innerHTML×29 + createElement×34·致 audit-ratchet 深车道红；`docs/design/game211/` 不存在（C·Lead 坐实） | `requests-3d.md` `REQ-3D-G211-HARDLINE` |

## 三 · 记债明知不修（owner 要升格立单说一声）

- **build chunk >500KB**（three-renderer 874KB / index 751KB / catalog 697KB）：长期存量、非 108 引入、无用户可感影响证据；动分包牵渲染/加载路径，收益不明。
- **ComponentDataMap 编译期闭集自身过期**（缺 DebugTrace/PhysicsWorld3D/BlockGrid）：运行时真相源已另立（根因②），编译期表补齐属低危尾巴。
- **工具脚本无独立测试**：`cjk-art-font-vendor.py`（问世至今零测）+ game108 六件 `game108-*.mjs`（自身即验证器·被间接覆盖）——不受门禁保护，改坏无回归网，知情使用。
- **matrix-duel「瞬时门+改主意」边界无剧本**（ENG-07 自陈尾巴·game108 域自治）。
- **流程教训**（不立规则,记档）：PIPEHASH 自我失效环分 3 轮才收敛、前两轮无登记——同类问题**第一次出现即登记**；lockstep P0 守卫深度=1,动错峰用例须格外小心。

## 108 变更总审结论（轨 C·38 笔核心提交逐笔过账）

体系是转的：38 笔里 36 笔有点名测试或真机验证、债务登记率高；缺口裁决协议在最难的交叉缺陷上走了全程。两类系统性小盲区（工具脚本无测·见上）与一处流程留痕断档（PIPEHASH 三轮）已入债表。全量告警收割 5 类中 5 条已有工单、2 条无主（已开单,见上表）。
