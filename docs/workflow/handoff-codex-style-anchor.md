# Codex 派工单 · 低多边形风格比选样张（2026-10-28）

> 派工：owner（裁定：选一种低多边形风格作锚，再按它扩展；见 `docs/design/ai-pipeline/lowpoly-style-anchor.md`）。施工：Codex，在 owner 本机执行（云端会话访问不到这些素材站）。产物是截图与记录，供 owner 定锚；本单不做入库与扩展。

## 指令全文

```text
你是 ApolloGame 引擎仓的 Codex。本单：下载三家 CC0 低多边形素材的样本，在我们的引擎里用同一机位、同一灯光渲染并排截图，给 owner 选风格锚。

【0. 先读】AGENTS.md → CLAUDE.md；docs/design/ai-pipeline/lowpoly-style-anchor.md；docs/design/ai-pipeline/world-kit-research-2026-10-27.md。

【1. 下载（本机 ~/ApolloAssets/style-candidates/<家族>/<包名>/，暂不进仓库）】
- KayKit：Block Bits、Platformer、City Builder Bits 或 Medieval Builder、一个带骨骼角色包（如 Adventurers）。
- Quaternius：Stylized Nature MegaKit（免费 Standard 版）、一个带动画角色包。
- Kenney：Platformer Kit、Blocky Characters。
- 每个包保存原始许可文件；逐包核对许可确为 CC0（以包内许可文件或作者页为准），不是 CC0 的不用并在回复里写明。只取 glTF/GLB，没有就用包内 FBX 经既有 Blender 作业转换。

【2. 选样】每家取同一组：地块 / 地面 1–2 件、树 2 件、石 1 件、房屋或建筑 1 件、道具 2 件、角色 1 个。

【3. 渲染（引擎内，不写游戏层代码入库）】
- 用 M3 动画预览台或临时本机页面加载 GLB，走引擎同一渲染器；三家用同一相机、同一灯光、同一地面与背景各拍一张全景，另拍一张「不开 / 开卡通着色与描边」对比。
- 角色：若骨架能按 docs/workflow/motion-production-line.md §2 改名表对上 apollo-humanoid-v1，再拍一张它播放动画库待机动作；对不上就写明差在哪。
- 输出到 ~/ApolloAssets/style-candidates/sheets/：每家 2 张、混排 1 张（三家物件放同一场景，看混用效果）。

【4. 记录（可入库，只含文字与截图，不含模型）】
- docs/design/ai-pipeline/style-candidates-2026-10.md：每家所用包名、版本、许可原文出处、物件数、面数范围、贴图方式（共用图集 / 纯色）、角色骨架能否对上标准骨架；截图可另存仓库 docs/design/ai-pipeline/style-candidates/（PNG，每张不超过 1 MB）。
- 推送前 node scripts/scoped-gate.mjs --run，核退出码为 0。

【规则】模型文件不进仓库（定锚后另开入库单）；不签人门；不改引擎代码；只提交自己的文件。

【完工回复】截图位置、每家许可核对结论、角色能否接动画库、你观察到的风格差异；然后停下，等 owner 定锚。
```
