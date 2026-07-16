# Apollo 风格库（house-style 共享美术库）· 结构图纸（草案 2026-07-16·Lead·待 owner 拍板）

> owner 2026-07-16 提出：给所有游戏建**一个指定美术风格的共享库**——含 UI、特效、3D 简单拓扑与样例，用文生图一次性建库、逐个生成；像迪士尼/Subway 系——多游戏共享一种美术风格。先串结构，key 配好后慢慢生成，再用 UI 库展示游戏对齐。
> Lead 评判：**接受**。不发明新系统——全部由既有底座重组（宪法 §4 先重组），新增件只有三个。

## 0. 一句话结构

**共享货架里立一个「styleset」策展命名空间 + 一本库级机读台账 + 一个引擎级风格包**；文生图逐行填库（复用 art-replace 全链），游戏 vendor 消费（复用 vendoring 架构），game-i 换皮对齐（复用 PUI 展示台）。

## 一、站在什么底座上（全部已在主干）

| 已有件 | 出处 | 在本方案中的角色 |
|---|---|---|
| 共享货架 + vendoring（游戏不直引共享库·copy 进本地带溯源） | `assets/index.json`·`scripts/vendor-asset.mjs`·PA 交接档 §1⑤ | 库的存放与消费契约 |
| 美术台账模式 + mergeLedger 保号 | `scripts/art-replace.mjs`·retro §四 | 库台账直接复用同一行结构与保号机制 |
| 风格包 + 每游戏风格锚拼 prompt | `scripts/style-packs.mjs`·`dialectPrompt` | 风格锚的单一真相位（房屋风格=一个引擎级风格包） |
| 文生图批量链（生成→登记→写回→人审→还原） | retro §五 | 生产流水线原封复用，只换目标 |
| spec 闭集 schema（Texture/Mesh/MaterialSpec） | `src/assets/asset-index.ts` | 库条目的元数据契约 |
| UITheme 主题级皮槽（buttonSkins·一 kind 一皮全游戏换） | `docs/playbooks/ui.md` 换皮行 | UI 面的消费端 |
| 公用 3D 货架生成器 | `scripts/gen-shelf-3d.mjs` | 3D 面的占位/程序化基线 |
| game-i 展示台 + 换皮下拉（PUI 域） | `src/games/game-i/**` | 对齐验收场 |

## 二、三个新增件（本图纸的全部增量）

1. **styleset 命名空间**：`assets/styleset/<style-id>/{ui,fx,3d,examples}/`，条目登记进共享 `index.json`，provenance 带 `styleset:<style-id>`。游戏一律 vendor 进本地目录消费（hermetic 不破）。
2. **库级台账** `assets/styleset/<style-id>/style-ledger.json`：与游戏台账同行结构（no/kind/slot/query/prompt/spec/status/gen/provenance），mode:`library`；配 spec 脚本 styleset-ledger.mjs（拟新增·照 game-g 脚本形状·走同一 mergeLedger 保号——**改清单重跑不丢已生成行**）。首版清单分四区（行数 owner 拍板，建议首批 ≤120 行）：
   - **ui/**：按钮四 kind 皮（9-slice）、面板框/边饰、图标集（功能闭集一批）、进度条/滑轨皮、字体装饰底、通用背景板 2-3 张;
   - **fx/**：打击/爆炸/闪光/烟尘 sprite sheet、粒子贴图（confetti/coins/stars 对齐 Particles kind 闭集）、环形光效;
   - **3d/**：低模 props 一批（拓扑简单·可换贴图）、trim 贴图集、天空盒 1-2 套、地面贴花（对齐 Decal3D 闭集）;
   - **examples/**：每区 1-2 个拼装样例数据（LayoutNode/Material3D 引用库 key 的现成写法·给弱 LLM 抄）。
3. **引擎级风格包**（房屋风格的单一真相）：`style-packs.mjs` 加 `<style-id>` 条目——stylePrompt 风格锚全文 + 调色板 + refImage 槽位。**各游戏台账/库台账的风格锚一律引用它，不再各自手抄**（防风格锚本身漂移——retro §二 事故 1 的同型病）。风格定义（锚文案/参考图）= owner 亲自拍板供给。

## 三、生产流水线（key 配好后）

```
owner 定风格（风格包条目+参考图）
→ styleset-ledger.mjs 产/更台账（保号）
→ 工坊台账墙选 styleset（素材屏复用·PST 接线）
→ ⚡逐行/批量文生图（qwen 或新 adapter·断点续跑·人审门·provenance 硬字段）
→ 登记共享 index.json（styleset 命名空间）
→ asset-reconcile 对账
```
前置硬条件（retro §五）：①目标服务 adapter（Seedance/NanoBanana 若中选需照 qwen 形状新写）②真 key e2e 首验 ③**行规格执行**（生成后缩放/校验到 spec w/h——库里图标 128 与背景 1024 混布，此件从"补件"升为**必做**）④refImage 接线（风格一致性靠它，库场景权重高）。

## 四、消费与对齐

- **对齐场=game-i（回驳建新游戏）**：owner 说"再建一个 UI 库的游戏"——game-i 就是这个游戏（PUI 域·换皮下拉现成）。做法：styleset 皮进一个新 UITheme 条目 + gallery 各段吃库资产，换皮下拉切到「styleset·<名>」即全景对齐验收（/check-ui + 截图）。不新开游戏、不占产能。
- **各游戏换装**：vendor 库条目进本地目录 → UITheme.buttonSkins/背景板/图标接 key → 游戏台账里对应行标 replaced（provenance 指 styleset 来源）。games 出口（D+G）逐个来，不强推。

## 五、分期与派工（owner 拍板后开单·requests.md 走正常槽位）

| 期 | 内容 | 谁 | 备注 |
|---|---|---|---|
| M0 结构 | styleset 目录/索引规范 + styleset-ledger.mjs + 风格包条目占位 + mock 填充全链跑通 | **PA**（主）+ Lead 出台账清单 spec | 零真图·零 key·先把账立起来 |
| M1 试产 | 真 key 后挑 20 行试产（含 ui/fx/3d 各若干）·验风格一致性/规格执行 | PA + PST（工坊接线） | adapter/规格执行/refImage 三前置在此关验收 |
| M2 建库 | 全台账铺开生成 + 人审 + 对账 | owner 生成·PA 守账 | 花费可见性（P2）建议此前上壳 |
| M3 对齐 | game-i styleset 主题 + 样例段 | **PUI** | 对齐验收=换皮下拉全景走查 |
| M4 换装 | D/G 出口游戏 vendor 换装 | 各 PE + PA | 逐游戏、各自台账记账 |

## 六、红线（防这个库自己漂移）

- 风格锚单一真相在风格包，**任何台账/文档不手抄锚全文**（引用 style-id）；
- 库台账=机读真相，行数/状态不进任何手抄文档（本文也只写"建议 ≤120 行"这类拍板参数）；
- 所有入库条目 provenance 硬字段缺一拒登（既有门·不新造）；
- examples 必须是**可跑数据**（进 game-i 或测试消费），不许只截图——防"手册说的≠运行时真相"（retro §三 语义漂移）。
