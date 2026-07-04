# Skill 行为 Spec · resource-manager

> 对象：`.claude/skills/resource-manager/SKILL.md` · 类型：技能 · 起卡日期：2026-07-04
> 移植注：源自 CCGS skill-test-spec 骨架，Apollo 化（判词=门禁退出码 + parseAssetIndex 注册期抛错）。

## Summary（这件零件做什么）

输入=一个资产管理需求（vendor 共享库资源进游戏本地目录 / 加材质数据资产 / 填贴图·网格 spec 闭集元数据）。流程走统一 Asset 数据路线：①`node scripts/vendor-asset.mjs <shared-id> <game> [--as <local-id>]` 把 `assets/index.json` 的 filled 条目 copy 进 `public/games/<game>/art/` + upsert 本地 `index.json`（带 spec+license+`provenance.vendoredFrom`）；②材质=`type:'material'` 免文件、数据全在 `spec`（引 texture key）；③texture/mesh 的 `spec` 闭集枚举（usage/colorSpace/wrap/genCollision）。产出=可被 `registerAssetIndex(parseAssetIndex(...))` 消费的本地索引。**判词非命名 token**：靠 parseAssetIndex 注册期校验（填错闭集直接抛错）+ 门禁 `tsc+vitest+build` 退出码全绿。

## 静态断言（结构·不需 fixture）

- [x] frontmatter 含 `name`、`description`（触发写清「凡涉及引擎资产库/资源目录/材质/真实贴图导入 → 用此技能」）
- [ ] frontmatter 含 `when_to_use` ——**现状缺口**：无该字段（check-ui 有），触发仅落在 description 内
- [x] 有明确的阶段/步骤结构（≥2 节：§1 Vendor / §2 材质 / §3 spec 元数据 / 边界纪律）
- [ ] 判词属闭集 ——**现状缺口**：无命名判词；靠 parseAssetIndex 抛错 + 门禁退出码硬失败
- [x] 危险/越域操作有域约束声明（三条红线 + 「`src/assets/**` 引擎核心跨界改动 Lead review」+「3D 资产需求进 `docs/workflow/requests-3d.md`」+「别引入新 `Resource` 类型」）
- [x] 有下一步交接（契约/进度 `docs/workflow/finish/P3D-asset-layer-handoff.md`；自检 `src/games/game-z/vendor.test.ts`）

## 测例（5 原型·失败路径必测）

### Case 1 · Happy Path（vendor）
**Fixture**：`assets/index.json` 含 filled 条目 `devicon/aarch64-original` · **输入**：`node scripts/vendor-asset.mjs devicon/aarch64-original game-z --as tex/chip` ·
**期望**：1. 源 svg copy 进 `public/games/game-z/art/devicon/aarch64-original.svg` 2. upsert `public/games/game-z/art/index.json`：条目携 spec + license + `provenance.vendoredFrom:'devicon/aarch64-original'`
**断言**：- [ ] 本地 index 有该条目 - [ ] parseAssetIndex 校验通过（对照真先例 `vendor.test.ts` 的 `tex/vendor-demo`）

### Case 2 · 失败路径（前置缺失 fail-fast）
vendor 一个不存在 / 仍 `tbf` 未 filled 的 shared id（或缺 `<game>` 参数）→ 脚本立即停、报错，**不写残缺本地 index**、不产半成品。

### Case 3 · 幂等重入（目标已存在）
同 `--as` local-id 已 vendor 过 → 脚本 upsert 同一条目（幂等，不产重复项、不破坏已有 provenance）；本地 index 条目数不因重跑膨胀。

### Case 4 · 边界（最容易糊：spec 闭集元数据）
加 texture 条目 usage=`normal` 但省略 colorSpace → parseAssetIndex 按 usage 自动推 `linear`（法线/粗糙必须线性，误填 srgb 会渲染偏色）。material 资产 `type:'material'` 免 path、`spec.map` 引 texture key。**断言**：- [ ] normal 推得 colorSpace=linear。

### Case 5 · 判词降级（部分过）
vendor 成功但门禁 `npx vitest run` 某测红 → 整体退出码非 0、不推，列失败测名。**现状缺口**：无 PASS WITH WARNINGS 中间档，任一门禁不过即整体不合格。

## Protocol Compliance

- [x] 域边界：只写资产数据 + 游戏本地 `art/index.json`；扩 `spec` schema 字段→Lead review；3D→requests-3d.md
- [~] 判词闭集 + 理由：靠 parseAssetIndex 抛错 + 门禁退出码，**无命名判词 token**
- [~] 无法机验：素材 license / 来源核实为人工判断（skill 未内建机验）

## Coverage Notes（诚实声明没测什么）

- 无命名判词，pass/fail 靠 parseAssetIndex 抛错 + 门禁退出码。
- vendor 脚本的幂等（Case 3）是脚本保证，skill 本身未内建幂等校验。
- 材质渲染正确性（renderer 按 colorSpace 取图 / applyMaterialRef）在 `src/renderer/three/**`=P3D 域，本 skill 不覆盖。
- 素材 license/来源核实无机验，只能标 MANUAL。
