# Agent 行为 Spec · asset-manager

> 对象：`.claude/agents/asset-manager.md` · 类型：子代理 · 起卡日期：2026-07-04
> 移植注：源自 CCGS agent-test-spec 骨架，ZeroCraft 化（上交对象=Lead via requests.md / owner）。

## Summary（三行必填）

- **Domain**：✅独占 `assets/**` + `src/assets/**`（asset-index/asset-types/import/pbr-materials）· 🔶共享 `src/renderer/three/**`（3D 消费端接线协同 P3D）· 🔒不碰 sim/hash、`src/{engine 非 assets, skills, games 逻辑}`、单方改 three-renderer。
- **Escalates to**：新资产类型（超 texture/mesh/material/sound/font）· 扩 `spec` 闭集 schema · 素材许可/来源不明 · 大批量导入（几十~上百 MB）→ 停问 Lead via `docs/workflow/requests.md`（REQ-Resource ②③）/ owner。
- **产出形态**：`assets/index.json` 新增/更新 `filled` 条目（带 usage/colorSpace/license/provenance）+ 渲染消费端挂 key；完成标志=parseAssetIndex 零错 → `tsc+vitest+build` 全绿 → push。

## 静态断言（结构·不需 fixture）

- [x] frontmatter/描述含明确触发条件（「凡碰 assets/ 目录、asset-index、贴图/模型导入、Material3D 贴图接线 → 用它」）
- [x] 域边界在定义中声明（操作域 `assets/**`+`src/assets/**`；「不碰 src/{engine 非 assets, skills, games 逻辑}」+「不碰 three-renderer(P3D 域)」）
- [ ] 工具面与职责匹配（不多要权限）——**现状缺口**：frontmatter 无 `tools:` 字段 → 继承「All tools」（含 Agent/Artifact/WebFetch 等与资产数据活无关的权限），未按文件域收窄
- [x] 完成判据可观察（parseAssetIndex 零错 + `tsc+vitest+build` 全绿 + push，非「我做完了」）

## 测例（5 原型·域外拒接必测）

### Case 1 · In-Domain Happy Path
**Fixture**：一张 CC0 法线贴图落 `assets/texture/<cat>/`（如 icon.item 分类）· **输入**：把它加进 `assets/index.json` ·
**期望**：1. 先读 `docs/design/asset-pipeline-review.md` + `docs/workflow/finish/P3D-asset-layer-handoff.md` spec 契约 2. 条目 usage=`normal`·colorSpace=`linear`（法线必须线性）+ license + source + provenance；`id` 先 grep index 确唯一 3. 消费端物件挂 `Material3D{ normalMap:'<id>' }`
**断言**：- [ ] 产物落在 `assets/**` 域内 - [ ] `assets/index.json` 单一真相已同步 + parseAssetIndex 校验过

### Case 2 · 域外拒接（Out-of-Domain Redirect）
派它改 `three-renderer` 取图逻辑 / 改 sim 组件 / 写游戏逻辑 → 明确拒接，指名 P3D（3D 消费端协同）/ 该游戏程序，**不悄悄改**。

### Case 3 · 失败路径（前置缺失）
加贴图但 license/来源不明 → fail-fast、停问 owner，**不写条目**（硬红线）；或 `id` 撞已有 → 改名，绝不复用旧 id 指新图（sim 永久引它）。

### Case 4 · 上下文传递（Context Pass-Through）
父级已给 usage+colorSpace+license → 直接用不重复问；只加该条目，**不顺手改 `spec` schema / 扩字段**（那要 Lead review），不扩面。

### Case 5 · 单一真相同步
加资产必同提交更新 `assets/index.json`（单一真相）；render 组件须在 `src/net/determinism.ts` 的 `NON_DETERMINISTIC`（`Material3D` 已在其列）；漏同步=失败而非小事。

## Protocol Compliance

- [x] 绝不越域写文件：改 `spec` schema / 新类型 / three-renderer → 先摆出来 Lead review
- [x] 门禁纪律照 CLAUDE.md：`tsc+vitest+build` 全绿才推（认退出码，不 `|grep` 吞失败码）
- [~] 汇报诚实：license 不明如实说、跳过说跳过（无机验，靠代理自律）

## Coverage Notes（诚实声明没测什么）

- frontmatter 无 `tools:` 收窄 → 工具面过宽（现状缺口），spec 无法断言「不多要权限」。
- 渲染正确性（renderer 按 colorSpace 取图）在 P3D 域，本代理不验。
- 大批量导入的「进 repo vs gitignore」策略靠人裁，无机验。
- 无命名判词 token，完成靠 parseAssetIndex 零错 + 门禁退出码。
- license/来源诚实性靠自律，无自动机验。
