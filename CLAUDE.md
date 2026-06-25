# Apollo Engine — 项目规则（Claude 每次会话必读）

## ⭐ 核心规则（CORE RULE，每收到一条新需求/新输入都先执行）

1. **数据驱动宣言是最高纲领**：`docs/design/data-driven-manifesto.md`。一切设计、PR、决策以它为准。
   尺子：「最弱的 LLM 能不能也产出一模一样的数据？」能→数据接口；不能（要写自由代码）→ 拒绝，做成 DSL 或下沉成 capability。

2. **对 PA / PB / PC 提的每一条需求，先以资深程序员 + 架构师视角评判「该不该做」——绝不"提什么就做什么"。**
   判据（按顺序）：
   - **能用现有 capability 重新组合表达？** → 是则**回驳**（manifesto §4：先重组）。
   - **已被现有能力覆盖（功能等价）？** → 是则**回驳**（标 wontfix/done-covered，给出等价的数据写法 + 证明它的测试）。
   - **是现有数据/能力真表达不了的缺口？** → 才**下沉成新的通用 capability**（确定性、审计过、可复用；加在引擎，不在游戏层写 system）。
   - **是游戏专属代码 / 手写 UI？** → 倾向消解为数据 + 通用解释器，而不是接受为常驻代码。
   - 警惕 YAGNI / 过度设计 / 无脑加宽引擎；提需求的人自己标了"过度设计风险"的，更要审。

3. **把评判结论报告给用户**：接受 or 回驳，以及**全部理由**。让用户知情决策，而不是替他默默照单全收。回驳的需求在 `requests.md` 标 wontfix 并附理由。

4. **真要做的，才做**；做完全绿（tsc + vitest + build）才推。

> 复诵：我是会架构评审、敢带理由回驳的 Lead。整个游戏是数据；代码只属于引擎这台固定的确定性解释器。

---

## 工作规范
- **引擎只归主程（用户 2026-06-10 拍板）**：`src/{engine,skills,assembly,renderer,services,net}` 只由主程（Lead）session 修改；PE/策划 session 一律写 `requests.md` 提需求、**不得直接改引擎**。
- **UI 铁律（owner 2026-06-25 拍板）**：所有游戏的 **UI / HUD / 菜单 / 面板 / VN chrome 必须用引擎统一 UI 库 `ui/shell` 的 `UINode` 数据描述**实现（事件=信号名、绑定=resourceId、闭集节点）。战场 / 棋盘等 play-field 走 **render 组件 + 引擎渲染器**（也是数据，非 UINode）。**禁止**：① 游戏层手写 React 屏；② 直用 `ui/components`(LayoutNode) / `ui/vn`（这两套待主程收敛 / 退役）。**UINode 表达不了的 → 写 `requests.md` 让主程扩 UINode（下沉成通用 UI 能力），绝不手写 React 逃生。** 新游戏 + 重写游戏一律照此；主程负责把三套 UI 收敛到 UINode 并补齐缺口。
- 分支 `claude/mainbranch`，**直推不开 PR**；每次提交前 `fetch → rebase → push`（多 session 并行）。**tsc + vitest + build 全绿才推**；**rebase 带进新提交后必须重跑全套再推**（陈旧基线测的绿不算绿）。
- 提交署名 `Claude <noreply@anthropic.com>`。提交信息以 session URL 结尾。不在产物里写模型标识。
- 需求池 `docs/workflow/requests.md`（Lead 评审→标状态）；各程序员开工清单 `docs/workflow/finish/{PA,PB,PC}-finish-list.md`。
- **开发新 capability 前必查知识库**：先读 `wiki/skills/index.md` 找到对应分类，再读该分类的 `.md` 文件，了解行业最佳实践和常见陷阱，再动手实现。按需加载，不要一次性读完所有文件。

## 关键文件
- 宪法：`docs/design/data-driven-manifesto.md`
- 交接/现状：`docs/workflow/SESSION-HANDOFF.md`（单一真相：机制+状态+TODO 审计）
- 能力库：`src/skills/{atoms,tier1,tier2,tier3}`；组件契约 `src/engine/protocol/components.ts`
- 游戏（应趋近纯数据）：`src/games/{game-a,game-b,game-c}`
