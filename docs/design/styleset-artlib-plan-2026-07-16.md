# ZeroCraft 风格库（house-style 共享美术库）· 结构图纸（2026-07-16·Lead·**owner 已拍板开 M0**）

> **owner 拍板（2026-07-16·两次）**：新建全类型风格库，风格=**迪士尼（圆润亲和）× Supercell（厚底唇糖果 3D 钮·高饱和）× 中国水墨（纸纹/笔触边/墨青朱砂）三合一混风**。**范围：不是换颜色——从形状（UI 异形/按钮贴图/3D 拓扑）到贴图全形态换装**；整套 UI 演示（game-i）全量对齐；其他颜色风格适当收敛（摘牌减量）。**并且不等真 key：先用现有手段（程序化皮/主题/3D 效果令牌）出全面可视版（M0.5），真 key 后按台账逐行换真图。**
> **Lead·IP 红线**：风格锚与生成 prompt 用**描述性词**（圆润卡通/大轮廓/软两调阴影/暖饱和…），不写受商标保护的厂牌词、不生成知名角色形象；owner 若坚持用厂牌词须另行拍板担险。style-id=`apollo-toon`（对外名 owner 后定）。

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
| game-i 展示台 + 换皮下拉（PUI 域） | `games/game-i/**` | 对齐验收场 |

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

## 六、首批台账清单 spec v1（M0·Lead 图纸）

- **风格锚 v2（混风定稿·进风格包·owner 后续可配参考图精修·refImage 槽留位）**：
  `rounded cartoon fantasy meets Chinese ink-wash painting: chunky glossy game buttons with thick bottom lip, bold clean silhouettes, friendly exaggerated proportions, soft two-tone shading, warm saturated colors accented with ink black, rice-paper texture, jade and vermilion, subtle ink-brush stroke edges, high readability, game asset, no text, no watermark`（sprite 类行加 transparent background）。调色板基准 8 色（PA 定稿微调）：宣纸 #F6F0E2 / 墨 #2C2C34 / 黛青 #345C68 / 竹青 #55B08E / 朱砂 #D8503F / 缃金 #EBB54D / 天青 #7FC4D8 / 藕紫 #8A5A7A。
- **清单分区（约 72 行·行规格 spec{w,h,transparent} 按台账既有字段）**：
  - **ui/ ≈40 行**：按钮皮 4 kind×9-slice（源 96×96·slice 24·**形状=圆胖厚底唇**，非现皮描边替换）；面板框 9-slice 2 款；功能图标 24 枚（128×128 透明·play/pause/settings/close/back/coin/gem/heart/star/lock/check/cross/arrow×4/bag/shop/trophy/info/sound×2/plus/minus）；进度条皮 2 件（256×64·槽+填充）；滑轨+钮 2 件；背景板 3 张（1024×1024·lobby/menu/dim）；标题装饰底 2（512×128）。
  - **fx/ ≈12 行**：hit burst / explosion / smoke puff 帧图集（512×512·4×4）；sparkle/star/coin/confetti 粒子贴图各 128×128 透明（对齐 Particles kind 闭集）；ring glow 256；trail 64×256。
  - **3d/ ≈20 行**：低模 props 12 件（kind:mesh·Tripo 文本→glb·**拓扑=圆润夸张比例**·crate/barrel/tree/rock/coin/gem/chest/fence/lamp/bush/sign/platform-tile）；trim 贴图 2 张（512）；天空盒 1 套；地面贴花 3（对齐 Decal3D 闭集）。
  - **examples 不进台账**（非生成物）：可跑数据样例（主菜单屏/HUD 条/商店卡 LayoutNode + Material3D 2 例 + 粒子接线 1 例）= M3 交付、进 game-i。
- **M0 交付边界（PA·零 key·mock）**：styleset 目录 + styleset-ledger.mjs（走 art-replace 的 mergeLedger 保号·mode:library·**不改 art-replace.mjs 本体**）+ 风格包 `apollo-toon` 条目 + mock 填充跑通（texture 行=确定性程序化占位·gen/mock 分域防覆盖真图；mesh 行=mock glb 占位）+ 登记共享 index.json（provenance 硬字段+styleset 标）+ asset-reconcile 对 styleset PASS + 测试 + `docs/playbooks/assets.md` 回填一行。batch 真生成接链=M1（届时 PA+PST 会审 art-replace 的 styleset 目标扩展）。
- **M0.5 现装可视版（PUI·先行·owner 点名"先用现有手段生成全面替换"）**：新 UITheme `apollo-toon`（全 token：混风调色板/字体/面板纸纹底+墨边/按钮四 kind **程序化 data-URI 皮**——圆胖厚底唇高光糖果钮+笔触边，配异形 shape 令牌与 press3d/tilt3d/z 3D 效果令牌·全走既有闭集**零新控件**）+ 程序化水墨背景板；game-i 换皮下拉接入并置顶，整套 gallery 段在新主题下走查一致；**收敛**：主题选单摘牌到 2-3 个（保默认 + apollo-toon + 至多 1 深色；隐藏不删码）。验收=/check-ui 全过 + 真浏览器多 tab 截图。程序化皮=占位真相：台账行 status 保 needs-art，真 key 后逐行文生图替换（M2），错觉记账（provenance:procedural）。

## 七、红线（防这个库自己漂移）

- 风格锚单一真相在风格包，**任何台账/文档不手抄锚全文**（引用 style-id）；
- 库台账=机读真相，行数/状态不进任何手抄文档（本文也只写"建议 ≤120 行"这类拍板参数）；
- 所有入库条目 provenance 硬字段缺一拒登（既有门·不新造）；
- examples 必须是**可跑数据**（进 game-i 或测试消费），不许只截图——防"手册说的≠运行时真相"（retro §三 语义漂移）。
