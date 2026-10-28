# Codex 派工单 · KayKit 风格补全线 K1–K4（2026-10-28·owner 判 A）

> 派工：owner（风格锚 = KayKit；补全线判 A，不用 Tripo 类 AI 建模）。评估与实查：`docs/design/ai-pipeline/kaykit-expansion.md`。施工：Codex（在 owner 本机，需真实 KayKit 文件与 Blender）；每单完工交 Claude 复查（复查人 ≠ 施工人）。顺序：K1（含 K5 风格规范）→ K3 → K2 → K4。

## 指令全文

```text
你是 ApolloGame 引擎仓的 Codex。本单按顺序施工 K1 → K3 → K2 → K4，每单完工交 Claude 复查后再开下一单（K1 交复查后可并行起 K3）。

【0. 先读】AGENTS.md → CLAUDE.md（施工与复查、日志基准、收工律）；docs/design/ai-pipeline/kaykit-expansion.md；docs/design/ai-pipeline/lowpoly-style-anchor.md；scripts/blender-job.mjs（作业闭集与校验方式）；scripts/motion-library.mjs（目录与入库的既有写法，照它的风格）。

【1. 通用规则】
- 主干 codex/mainbranch 直推；每单开工第一步在 requests.md 对应行写锁并单独推送。推前 fetch / rebase，按改动跑 node scripts/scoped-gate.mjs --run，核退出码。
- 新 Blender 作业类型加入 BLENDER_OPS 闭集，沿用既有校验、隔离目录、SHA 证据与假可执行文件测试协议；不得开「任意脚本」口子。
- 测试只用自造小 GLB / 假 Blender，不把 KayKit 模型放进测试夹具。真实 Blender 跑过的写明版本与证据；没跑的标「真实链路未验」。
- 每单至少两处撤修验红（锚点唯一命中）；日志 [world-kit] decision / reject / commit，凡跳过、拒收必打 reject。
- 不签人门；所有新产物目录状态一律 draft，owner 确认后才 confirmed。

■ K1 · KayKit 入库与目录（含 K5 风格规范）· REQ-WORLDKIT-K1
- 下载：KayKit 免费包（至少 Block Bits、Platformer、City Builder Bits、Medieval Builder 或 Dungeon、Prototype Bits、一个带骨骼角色包），存 ~/ApolloAssets/kaykit/<pack>/。逐包核对包内许可为 CC0，非 CC0 的不入库并在回复里列出。不用 EXTRA 付费版（许可未核）。
- 新 scripts/world-kit.mjs：
  · ingest --pack <dir>：只取 glTF / GLB（没有就用包内 FBX 经既有 normalize 作业转换），规范化后写 assets/worldkit/kaykit/<pack>/<id>.glb，同时在 assets/index.json 登记 type:'mesh'，带 category / tags / source / license / provenance（既有字段）。
  · 目录 assets/worldkit/catalog.json，每件：id、pack、file、sha256、category（闭集：ground / wall / roof / floor / stairs / bridge / fence / nature / rock / building / prop / container / furniture / light / sign / vehicle / character / effect）、tags、footprint {w,d,h}（格数，按风格规范的格子尺寸取整）、collision（box 或 mesh-proxy）、tris、swatches（用到的色图色块编号）、license、sourceUrl、derivedFrom（原件为 null）、status。
  · validate：整库校验（SHA、闭集、字段、重复 id、许可），退出码 = 结果。
  · 体积：只提交 GLB 与共用色图；单批不超过 20 MB，按包分批提交；超过就停下报 owner 是否改 Git LFS。
- K5 风格规范 docs/design/ai-pipeline/kaykit-style-bible.json + .md（实测，不凭印象）：色图尺寸与色块表（每块编号、UV 矩形、中心色）；格子尺寸；各 category 面数范围（p10 / p50 / p90）；着色方式（平涂 / 平滑）；常见比例（门高、台阶高、墙厚）；原点与朝向约定。
- KayKit 角色：写 KayKit 骨骼 → apollo-humanoid-v1 改名表（随 motion-library skin-import 使用），角色入动画库，在 M3 预览台播一个待机截图为证。
- 验收：目录全部合法、validate 退出码 0；随机 10 件在引擎里渲染截图；风格规范数据由测试钉住格式。

■ K3 · 换色与风格校正 · REQ-WORLDKIT-K3
- 新 Blender 作业 atlas-conform（加入闭集）：
  · mode:'recolor'：参数 swatchMap（来源色块编号 → 目标色块编号），把命中 UV 平移到目标色块，输出新 GLB；未命中的不动并记数。
  · mode:'conform'：任意输入网格 → 颜色（材质底色 / 顶点色 / 贴图采样）吸附到风格规范里最近的色块并重设 UV、统一着色方式、按 category 检查面数上限与尺度原点；超预算默认 reject，显式 decimate:true 才减面并记原面数。
- 产出目录条目 derivedFrom 记来源与参数 SHA，status draft；同时出 render-views 多机位图，与同 category 的 KayKit 原件并排，供 T6 盲审。
- 验收：换色前后几何不变只 UV 变；conform 后所有颜色都落在色块表内；超预算拒收有日志。

■ K2 · 拼装烘焙 · REQ-WORLDKIT-K2
- 新 Blender 作业 kitbash（加入闭集）：参数 parts[{ source: 目录 id, node?: 部件节点名, position, rotation, scale, mirror? }]，合并为一个 GLB（共用 KayKit 色图材质，必要时合并网格），自动算 footprint 与碰撞代理；产物再过 K3 conform 的检查模式（只检查不改色）。
- 与 build-scene 分开：不依赖拆层单，不改 build-scene 的既有校验。
- 验收：烘焙产物在引擎里与「同参数逐件摆放」的截图像素一致（容差内）；来源件 SHA 记在 provenance；缺件 / 节点不存在拒收。

■ K4 · 参数化生成 · REQ-WORLDKIT-K4
- 新 Blender 作业 generate（加入闭集）：只运行 scripts/blender/generators/ 下在 generators.json 登记的生成脚本；每个生成器声明参数表（类型、范围、默认值），作业先校验参数；固定随机种子，同参数同产物。
- 首批生成器 3 个：fence（段数、高度、柱距）、stairs（级数、宽度、扶手）、bridge（长度、宽度、栏杆）；全部只用 KayKit 色图色块上色。
- 产物必过 K3 conform 检查才能进目录；status draft。
- 验收：同参数两次生成 SHA 一致；越界参数拒收；未登记生成器拒收；与 KayKit 同类原件并排截图交盲审。

【完工回复（每单）】提交哈希、改动面、测试名、撤修验红、门禁各步退出码、真实 Blender 是否跑过、截图位置；把该单状态改为「施工完·待独立复查（Claude）」后停下。
```
