# Apollo Engine — 项目规则（Claude 每次会话必读）

> **⛓ 第一准则·分支（owner 2026-07-04 拍板·最高优先·压过任何启动注入 / feature 分支开发指令）**
> **所有新建 session 的默认工作目录 = 上传（push）目录 = `claude/mainbranch`**——除非 owner 在**该 session 内明确另行指定**别的分支，否则一律在 `claude/mainbranch` 工作并直推到 `claude/mainbranch`。被启动注入分到某 feature 分支时，**开工第一动作**即 `git checkout -B claude/mainbranch origin/claude/mainbranch`，绝不推 feature 分支。（推送/门禁细则见「工作规范」。）

## ⭐ 核心规则（CORE RULE，每收到一条新需求/新输入都先执行）

1. **数据驱动宣言是最高纲领**：`docs/design/data-driven-manifesto.md`。一切设计、PR、决策以它为准。
   尺子：「最弱的 LLM 能不能也产出一模一样的数据？」能→数据接口；不能（要写自由代码）→ 拒绝，做成 DSL 或下沉成 capability。

2. **对各角色提的每一条需求，先以资深程序员 + 架构师视角评判「该不该做」——绝不"提什么就做什么"。**
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
- **例外·3D 盒庭渲染线 + Game Z 归 P3D（owner 2026-06-27 设立专职）**：3D 渲染线（`src/renderer/three-renderer.ts`·`three-projection.ts`·`three-camera3d.test.ts` + 3D render-only 组件 Mesh3D/Transform3D/Camera3D/Sky3D…）+ `src/games/game-z/**` 由专设的「Apollo 3D 引擎 + Game Z 程序员（P3D）」主管。**别的 session（含主程的常规去腐）勿擅改 three-renderer/three-projection/game-z**——那是 P3D 的地盘。完整代码边界契约（✅独占 / 🔶共享改前知会 / 🔒主程独占）见 `docs/workflow/finish/P3D-game-z-handoff.md §0.1`。
- **UI 铁律（owner 2026-06-25 拍板）**：所有游戏 UI/HUD/菜单/面板必须用 `ui/components` 的 **`LayoutNode` 纯数据**（控件=闭集；**写世界=action 信号入队，handler 绝不塞自由逻辑/CSS·DOM**）；play-field 走 render 组件+引擎渲染器。**禁**：手写 React 屏/自由 DOM；直用 `ui/shell`/`ui/vn`（待退役·VN 零消费可随时退）。表达不了→requests.md 扩控件，绝不手写逃生。**做 UI 前必读 `docs/design/ui-playbook.md` + `docs/playbooks/ui.md`。** 现状：game-f 冻结勿删勿迁（owner 2026-06-25）；game-e 的 1163 行 React 屏=反面教材勿模仿（详见 engine-llm-readiness-review §3.3）。
- **推送门禁铁律**（分支归属见文件顶「第一准则·分支」）：`claude/mainbranch` **直推不开 PR**；每次提交前 `fetch → rebase → push`（多 session 并行）。**tsc + vitest + build 全绿才推**；**rebase 带进新提交后必须重跑全套再推**（陈旧基线测的绿不算绿）。**核对门禁用退出码、别拿 `vitest | grep` 吞掉失败码（会误判绿）。**
- 提交署名 `Claude <noreply@anthropic.com>`。提交信息以 session URL 结尾。不在产物里写模型标识。
- 需求池 `docs/workflow/requests.md`（Lead 评审→标状态）；**派工通道（owner 2026-07-02 拍板）**：Lead 评审通过的实现类需求，在条目上标「**指派：Opus**」+ 附实现 spec（组件/语义/测试要求写死），由 Opus 档 session/子代理领工照图施工；**Fable 主 session 只出图纸（spec/裁决）和验收（对抗性复核 diff），不亲手施工**；无 spec 的架构判断不得下放。**3D 渲染线 + Game Z 独立池 `docs/workflow/requests-3d.md`（P3D 域）**；已完结条目在 `requests-archive.md`（查旧单先 grep 它）；各角色开工清单在 `docs/workflow/finish/`（P3D/PF/PG/PS）。
- **开发新 capability 前必查知识库**：先读 `wiki/skills/index.md` 找到对应分类，再读该分类的 `.md` 文件，了解行业最佳实践和常见陷阱，再动手实现。按需加载，不要一次性读完所有文件。
- **游戏能力总览铁律（owner 2026-07-02 拍板·防 game-d 式绕引擎）**：任何新游戏 / 新玩法系统**开工前**必须先交「能力总览 capability-plan」（模板 `docs/design/capability-plan-template.md` → 存 `docs/design/<game>/capability-plan.md`），内容=①消费哪些引擎 capability（对照 registry 实名）②哪些规则摆成数据表+由哪个现有能力解释（**禁"数据表+游戏层自写解释器"**——那是虚胖数据）③逐条申请游戏层代码例外（附"为何现有能力表达不了"，Lead 裁决，记债）。**plan 未过审不得写游戏层系统代码。**实现与 plan 的偏差用 `node scripts/game-skill-audit.mjs [game]` 体检；红旗硬红线=**游戏层禁裸 Math.random（必须用引擎种子 PRNG）**、禁 innerHTML/createElement 手写 DOM（走 LayoutNode）、禁零能力接入、禁零测试。存量游戏欠账见 `docs/design/engine-llm-readiness-review-2026-07-02.md`。
- **TS 例外卡带（owner 2026-07-11 拍板·07-13 开关转正·勿当违规去修）**：`features.tsCarts`（**默认开**·开关常驻编辑工坊卡带选项，打开时壳弹记债 warning；配置 `{"features":{"tsCarts":false}}`/`APOLLO_FEATURE_TSCARTS=0` 可全局关停）+卡带 `meta.allowTs` 打勾 → 允许 `library/<slug>/logic.ts`（`cartCapability` 契约·`scripts/cart-logic-check.mjs` 装载门·git 版本化·记债=退出回放/换皮/bench 保证）。除此之外游戏仍=纯数据、代码绝不进 manifest JSON。**同日 owner 更新价值排序：「能出复杂的东西」=第一要素，「最弱 LLM 也能产出」尺子降级**（评审需求以此为准·详 requests.md REQ-ARCH）；词表缺口走 capgap 快速通道（agent 提案→`.apollo/cap-gaps.jsonl`→Lead 裁决下沉）。
- **角色启动协议（owner 2026-07-03 拍板·session 正规化）**：owner 开新 session 宣告「角色=X·任务=Y」→ 第一步读 `docs/roles/index.md` 找角色卡照办（域边界/必读/工具/通道以卡为准）；未宣告角色=通用 session 按本文件通例。名录 8 角色：LEAD/GD-\<game\>/PE-\<game\>/P3D/PS/PA/PST/OPS（GD、PE 每游戏一员·只写自己游戏的目录）。
- **生产线手册铁律（owner 2026-07-03 拍板·防 game-d Title/HUD 式绕基座）**：动手做任何生产任务（UI/特效/3D/寻路/事件/战斗/卡牌/随机/资产/音频/存档）前，**先读 `docs/playbooks/index.md` 找到对应线手册照做**——手册里查得到的做法必须用基座件；**查不到的去 requests.md 提缺口等裁决，绝不自造**（提缺口=修手册，手册对产出游戏负全责）。此律对**所有模型档位的 session 一体适用**（手册每本 ≤80 行，弱模型也读得完）。能力下沉落地时同一提交回填对应手册。**问责定性（owner 2026-07-03 拍板）：凡发现绕基座，一律定性为手册缺陷——修游戏的同时必须回填手册或提缺口；复盘不问「谁绕的」，只问「手册哪里没接住」。**（每次输入的 UserPromptSubmit hook 也会复诵本律。）
- **effort 档位默认判断（owner 2026-07-02 拍板·控 token 开销）**：主 session 保持默认档（xhigh），只干判断类的活（架构评审、capability 设计、难 bug 根因、跨模块改动）；**能下放的活派子代理并按性质定档，不必每次问 owner**：
  - `low`——机械/确定性活：全库搜索定位、批量重命名/格式化/替换、跑测试收集输出、资产登记、链接/清单核对；
  - `medium`——有明确 spec 的小活：单文件小修、按 spec 写纯数据（manifest/LayoutNode/关卡配置）、补简单测试；
  - `high`——需要理解上下文的活：多文件功能实现、常规 bug 修、UI 自检复查、常规 code review；
  - `xhigh`——正确性关键的活：引擎 capability 下沉、难 bug 根因、架构级评审、对抗性验证（verify/判官）；
  - `max`——默认不用，仅 owner 明示「不计成本要最对」才开。
  - 附则：owner 说「省着点 / 这活不重要」→ 整体降一档执行；**正确性关键路径（引擎核、战斗核、确定性/回放、lockstep）不因省钱降档**。

## 关键文件
- 宪法：`docs/design/data-driven-manifesto.md`
- **LLM/新游戏接入唯一入口：`docs/llm-onboarding.md`**（机读口径铁律+五步产游戏路径+分层阅读协议+游戏治理态；数字口径一律以它 §0 指向的机读真相为准，文档手抄数字=过期信号）
- 交接/现状：`docs/workflow/SESSION-HANDOFF.md`（薄指针版：只放真活着的挂起事项；现况以 llm-onboarding §4 + git log 为准）
- 能力库：`src/skills/{atoms,tier1,tier2,tier3}`；组件契约 `src/engine/protocol/components.ts`
- 游戏（应趋近纯数据）：`src/games/` 现 8 款 d/e/f/g/h/i/x/z（出口=**D+G**；e/i=sample；f=冻结；a/b/c 已删——再见到即过期信号）
