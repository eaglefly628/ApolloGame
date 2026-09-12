# ApolloGame / ZeroCraft —— 给**非 Claude** 编码 agent 的入口（Codex 等按约定读本文件）

> 本文件是**指路牌，不是规则副本**。规则只有一份真相 `CLAUDE.md`（团队自己的复盘把「同一纪律三处口径」
> 列为缺陷，见 `docs/workflow/agent-team-overview.md` §3）。**先读 `CLAUDE.md`，再读本文**——
> 本文只说非 Claude agent 最容易漏、且漏了会真出事的那几条。

## 0. 五条硬约束（漏一条就会被打回）

1. **分支**：唯一工作 + push 目录 = `claude/mainbranch`。Claude 侧有 SessionStart 钩子强切，
   **你没有这个钩子**——开工第一件事自己核 `git branch --show-current`。不开 PR，直推。
2. **推送前门禁必须全绿**：`node scripts/scoped-gate.mjs --run`，**用退出码判**（别 `| grep` 吞掉失败码）。
   它按改动面自动缩范围（纯文档只跑文档守卫，碰引擎跑全量）。**没跑门禁的提交视同未完成。**
3. **提交署名**：信息末尾带 `Co-Authored-By:` 与你的会话/来源链接。没有来源的提交无法追溯，
   出事时没人知道该问谁（现状：仓里已有一笔无署名提交）。
4. **抢锁再动手**：工单在 `docs/workflow/requests.md`（引擎）或 `docs/design/<game>/requests.md`（游戏）。
   **开工第一个动作**是把该条目的「施工主体」改成你并推一次——那一行就是锁。
   没抢锁就动手 = 双头同单（仓里出过事故，因此立的规矩）。
5. **共享工作树**：提交前 `git status` 只提自己的文件；**绝不 stash / 挪动他人在途改动**。
   要跑隔离验证就另开临时 clone。

## 1. 这个仓的一条宪法（不懂它会写出被全盘回驳的代码）

**游戏 = 数据，代码 = 引擎**。尺子：「最弱的 LLM 能不能产出同样的数据？」
能 → 做成数据接口；不能（要写自由代码）→ **不许在游戏层写**，改成 DSL 或下沉成引擎 capability。

- 宪法全文 `docs/design/data-driven-manifesto.md`
- 接引擎的唯一入口 `docs/llm-onboarding.md`
- **硬红线**（出货不豁免）：游戏层禁裸 `Math.random`（用引擎种子 PRNG）· 禁手写 DOM/innerHTML（走 LayoutNode 数据）· 禁零测试

## 2. 动手前先查，别自造

| 你要做什么 | 先读哪 |
|---|---|
| 任何生产任务（UI/特效/3D/寻路/战斗/卡牌/随机/资产/存档…） | `docs/playbooks/index.md` 找对应线手册——**查得到必须用基座件；查不到提工单等裁决，绝不自造** |
| 「这个玩法用哪个件」 | `docs/playbooks/pick-list.md` |
| 有哪些能力（机读真相） | `src/assembly/capability-registry.ts` |
| 谁负责哪块、写权限边界 | `docs/workflow/agent-team-overview.md` §1 |
| 上一棒交接到哪 | `docs/workflow/SESSION-HANDOFF.md` |

## 3. 域边界（越界改动会被回退）

3D 渲染线 + `games/game-z/**` 归 P3D；UI 基座 `src/ui/**` + `games/game-i/**` 归 PUI。
**不是你的域就别改**，缺件走 requests.md 报给对应角色。
`src/{engine,skills,assembly}` 碰**定序 / 确定性与快照 hash / lockstep / 存档 / 新增 system**
的改动只归主程（LEAD）——这类坑不在 spec 也不在 review 清单里，是动手才撞出来的。**拿不准按只归主程走。**

## 4. 交付的定义

清单空 + 门禁绿 + 已推送，**缺一即未完成**。
只有两种合法的中途交回：① 需要 owner 裁 A/B 的缺口决策 ② 复查门（复查人 ≠ 施工人）。
其余「我接着做 X」写在结尾 = X 没做——发消息即终止回合。
