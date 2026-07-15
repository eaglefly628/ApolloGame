# 测试与验收线手册（接线图）

> 行业知识见 `wiki/skills/testing.md`（建测试体系/定准则才读）；本手册只回答「在 Apollo 测 X 用哪个基座件」。全员适用，交付前必过。

## 做 X → 用什么

| 要测什么 | 基座件 | 判定 |
|---|---|---|
| 纯逻辑 / capability 语义 | vitest（`src/**/*.test.ts`） | 退出码 0 |
| capability 注册完整性 | `src/assembly/registry-guard.test.ts`（漏注册即红·计数下限防空 glob 假绿） | vitest 内 |
| 确定性 / 回放 / 性能 | ApolloBench（`src/bench/`·双跑同 hash）·单 manifest 走 `scripts/bench-manifest.mjs` | hash 一致 |
| 数值平衡 | `scripts/game-d-balance-sim.mjs` · `src/games/game-g/simulate-balance.ts`（N=500 胜率扫描） | 胜率∈目标带 |
| UI 卫生 | `/check-ui` 技能 + validateLayoutNode | issue 归零 |
| 真浏览器旅程 | playwright-core e2e（`scripts/studio-*-e2e.mjs` 模式·chromium=/opt/pw-browsers） | 脚本退出码 |
| 产品线冒烟 | `scripts/*-smoke.py`（library / studio / **steam 发行编排**·后者 `steam-publish-smoke.py` 无真账号用 480 验 VDF/命令/plan · **AI 生成人审门** `art-review-smoke.py` 全链 generate→pending→approve/reject + provenance 硬校验 · **美术替换工作流** `art-replace-smoke.py` 全链 derive→batch(mock)→replace(parseManifest 零 error)+断点续跑+编号稳定·进程内 API·快照恢复零污染） | 退出码 |
| 游戏体检 | `node scripts/game-skill-audit.mjs <game>` | 零红旗 |
| 系统调度积木稳定性 | `npx vite-node scripts/system-graph-audit.mjs [capId…]`（悬空定序边/重复 system id/Tarjan 切最小 SCC+破环建议·`src/assembly/system-graph.test.ts` 守硬不变量） | `SYSTEM-GRAPH: PASS` |
| 共同零件（组件）清单漂移 | `node scripts/component-manifest-guard.mjs`（扫全部 `readonly type:'X'` 对比冻结基线·加/改名/删组件须同提交 `--update`·`scripts/component-manifest-guard.test.mjs` 守门） | `COMPONENT-MANIFEST: PASS` |
| 3D 截图对拍 | `scripts/shoot-game.mjs`（P3D harness） | 人审（像素断言升级=REQ-3D-像素断言·排队） |
| 视觉里程碑验收 / 出货 | `docs/playbooks/visual-scorecard.md`（8 维评分卡）→ **落账进流程板** `game-pipeline.mjs scorecard`（任一维 0=S7 红灯） | 全维 ≥2 = premium |
| 阶段复查（三门制·复查人≠施工人） | `game-pipeline.mjs checklist <SN>` → 对抗核证 → `review --verdict --note --by`（`docs/playbooks/review-gates.md`） | PASS/CONCERNS/FAIL |

## 红线（一体适用）

- **门禁=退出码**：`tsc + vitest + build` 全 0 才推；rebase 带进新提交必须重跑；禁 `vitest | grep` 吞失败码。
- **测试代码三禁**：真实时间等待（墙钟 sleep/setTimeout）、外部 IO 直连、无种子随机——FAIL 级，用信号/mock/种子 PRNG 替代（fake timers 合法）。
- **复现=seed+tick**：bug 复现优先给种子 + tick 序列/replay 文件（确定性引擎的强项）；文字步骤是降级方案。
- **缺基线判黄不判绿**：sim 缺目标带、bench 缺 prior、AC 不可测 → CONCERNS / MANUAL CHECK 交 owner；绝不默认过、绝不编造目标值。
- **存档/回放改动必测边界**：旧版本档载入（save-port migrate 链）+ 损坏档优雅拒绝（`CorruptSaveError` 基座已给）。
- **冒烟脚本 fail-fast**：前置缺失（无 build/无 manifest）立即非零退出 + 指出补救命令，禁静默跳过造假绿。
- **凭证探针（TGS 吸收·owner 2026-07-06 批）**：任何「无 key/无环境所以跳过」的回执必须附探针输出（缺哪个 env、调用返回什么）——空口 skip 不采信，视同未测。
- **红旗棘轮（只降不升·进门禁）**：8 款游戏的裸随机/innerHTML/createElement 计数以 `scripts/audit-baseline.json` 为机读基线，任一超基线 → `scripts/game-skill-audit.mjs` 打 `RATCHET: FAIL` + 退出码 1，`scripts/audit-ratchet.test.mjs` 在 vitest 里守着。降基线是还债仪式（消灭红旗必须同提交改 baseline）；抬基线唯一合法姿势=给该游戏条目挂 `reason:"REQ-xxx"` 缺口单号。

## 验收纪律（Lead / 判官侧）

- 代理自报全绿不算数：**独立复跑 + 对抗性 diff 复核**；UI 里程碑必须真浏览器旅程。
- **偏差三分法**：diff 偏离 spec → INTENTIONAL（记录准许）/ ERROR（打回）/ OUT OF SCOPE（回改 spec/手册），分类写进工单——不许默默接受"实现替代了图纸"。
- 靶向回归先行：改 capability 先跑受影响游戏的 smoke+sim 子集定位，全量留给推前门禁。
- 判词用闭集 token（PASS / CONCERNS / FAIL；工单态 BLOCKED=等外部动作 / NEEDS WORK=可自补），理由带 `file:line` 与实数，禁套话。
- 新语义无点名测试不关单：工单关账前核对「本条新语义有无点名断言」，缺口列测试名不笼统"补测试"。

## 查不到怎么办

- 新测试形态（soak 长跑、视觉回归、多跑 flakiness 统计等）本手册没有 → `docs/workflow/requests.md` 提缺口等裁决，**绝不自造 harness**。
