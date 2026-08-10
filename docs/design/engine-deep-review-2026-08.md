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
