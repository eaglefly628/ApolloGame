# Skill 行为 Spec · check-ui

> 对象：`.claude/skills/check-ui/SKILL.md` · 类型：技能 · 起卡日期：2026-07-04
> 移植注：源自 CCGS skill-test-spec 七段骨架，ZeroCraft 化（判词=工具退出码·无交互审批）。

## Summary（这件零件做什么）

输入=一棵刚建/改的 2D `LayoutNode` UI（HUD/菜单/面板/VN chrome）。流程：按序建（选闭集控件 `src/ui/components/catalog.ts` → 抄 `src/games/game-i/` 范例 → 组合不逃生）→ 交付前过「防重叠/对比度/透明度/布局卫生」四关 → 跑两个机械门禁：`npx vitest run src/ui/components`（`validateLayoutNode` 零 issue）+ `node tools/ui-audit.mjs tools/audits/<页面>.audit.ts`（overlap+对比度）。产出=一份归零的 UI + 门禁绿。**判词非命名 token，靠工具退出码**：ui-audit `0`=过 / `1`=有重叠或对比<3.0 / `2`=用法错。不合格必须回改坐标/配色到归零，不等 owner 挑错。

## 静态断言（结构·不需 fixture）

- [x] frontmatter 含 `name`、`description`（+`when_to_use`；触发写清「凡碰 src/ui/components 的 LayoutNode/game UI 屏/HUD → 交付前用它自检」）
- [x] 有明确的阶段/步骤结构（≥2 节：「建 UI 时按序」+「四关自检」+「机械门禁」）
- [ ] 判词属闭集（无散文式结论）——**现状缺口**：无命名判词（PASS/CONCERNS/FAIL）；仅靠退出码 + 「零 issue / 归零才算过」二元判定
- [x] 危险/越域操作有域约束声明（「永不手写 React / 自由 CSS·DOM」·「handler 不塞业务逻辑」·「写世界只经 action 信号」·表达不了→`docs/workflow/requests.md` 扩控件）
- [x] 有下一步交接（权威手册 `docs/design/ui-playbook.md`；不合格→回炉改到归零）

## 测例（5 原型·失败路径必测）

### Case 1 · Happy Path
**Fixture**：`src/games/game-i/mmo-hud.ts` 的 `buildMmoHud()` + `tools/audits/mmo-hud.audit.ts` · **输入**：`npx vitest run src/ui/components` 后 `node tools/ui-audit.mjs tools/audits/mmo-hud.audit.ts` ·
**期望**：1. validateLayoutNode 断言零 issue 2. ui-audit 无容差外相交、无对比<3.0 → 退出码 0
**断言**：- [ ] validate 零 issue - [ ] ui-audit 退出码=0（判词=退出码 0）

### Case 2 · 失败路径（前置缺失 fail-fast）
`node tools/ui-audit.mjs` 不带 audit 参数（或指向不存在的 `.audit.ts`）→ 立即停、打 Usage、退出码 2；**不半跑、不产残果**（`tools/ui-audit.mjs:35`）。

### Case 3 · 幂等重入（目标已存在）
UI 已过审、无坐标/配色改动 → 重跑 validate + ui-audit 仍零 issue / 退出码 0（纯只读检查天然幂等，验证而非重建，不改任何节点）。

### Case 4 · 边界（最容易糊：脑补尺寸摆坐标）
两个绝对定位 `x/y` 节点的**实测包围盒**相交（padding 撑宽：声明 256 实测 274）→ ui-audit 报重叠、退出码 1、列出相交节点。**修法=先渲一次量真实尺寸**，不脑补。

### Case 5 · 判词降级（部分过）
validateLayoutNode 零 issue 但 ui-audit 有一处对比<3.0（如亮底放 `dim` 灰字）→ 整体退出码 1、列低对比节点名。**现状缺口**：无 PASS WITH WARNINGS 中间档，一处不过即整体回炉（二元）。

## Protocol Compliance

- [x] 域边界：只碰 `src/ui/components` LayoutNode / game UI 屏；写世界经 action 信号；表达不了→requests.md 扩控件
- [~] 判词闭集 + 理由带 file:line/实数：ui-audit 报相交坐标 + 对比实数，但**无命名判词 token**（靠退出码）
- [~] 无法机验的项：对比度「过 daylight 亮主题再看一遍」有人工照妖镜环节（`tools/audits/mmo-daylight.audit.ts` 半自动，肉眼终审无法纯机验）

## Coverage Notes（诚实声明没测什么）

- 无命名判词 token：pass/fail 完全靠工具退出码 + 「归零」表述，spec 无法断言某个 token 字符串。
- 无判词降级中间档（二元 0/1），Case 5 编码的是「一处不过即整体回炉」现状。
- 「过 daylight 主题肉眼再看」这步无法纯机器验证，只能标 MANUAL。
- 本 skill 不写文件，故无「域内产物落点」类断言可测。
