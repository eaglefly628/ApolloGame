# game-k《Zombie Slots》资产需求规格表（完整 BOM · 对美术自动生成管线）

> **⚠ 只读视图（需求真相合一）**：机读真相 = `public/games/game-k/art/art-ledger.json`（26 项·平台 GET /api/art/ledger?slug=game-k 读此·「⚡一键全量」按行 `prompt` 生成）。
> **勿手改本文当真相**——改提示词去美术平台按编号改，或改台账行；重跑推导脚本 `npx vite-node scripts/game-k-art-requirements.mjs` append-only 合并。
> 风格包 = **disney-supercell（迪士尼×Supercell）**·owner 点题。人读提示词清单见 `art-list.md`。

## 0. Lead 判读（CORE RULE）

1. **接受·非回驳**：老虎机不止 10 张符号牌——完整 BOM 含背景/机台/UI/横幅/特效。初版只有程序化占位、且只声明了 10 符号=欠账，本表补齐为 **26 项完整 BOM**。
2. **全部 fail-soft 有槽**（禁虚胖/禁纯色块）：每项都有宿主消费槽，真图就绪即用、否则程序化/CSS 占位，**游戏始终可玩**（撤 mock 教训：噪声占位不入库）。

## 1. 完整 BOM（26 项 · 6 类）

| 类 | 数量 | 皮肤槽 | 消费槽（宿主 fail-soft） |
|---|---|---|---|
| **符号** | 10 | `k/sym-{t,j,q,k,a,dog,girl,doc,wild,scat}` | `art.ts` drawSymbol（真图盖过程序化烘焙图） |
| **背景** | 2 | `k/bg-main` · `k/bg-free` | `game-k.ts` drawFrame 铺满 scene（freespins 切血月变体·否则 CSS STAGE_BG） |
| **机台/底板/面板** | 3 | `k/reel-frame` · `k/sym-tile` · `k/hud-panel` | 机台框罩网格 / 符号底板衬每格 / HUD 条 `Panel.bgTexture` |
| **品牌/特效** | 2 | `k/logo` · `k/coin` | 顶栏 `Image`（替文字标题） / 中奖金币迸溅粒子（否则画金圆） |
| **中奖横幅** | 4 | `k/banner-{big,mega,zombie,free}` | 浮层 `Image` 大横幅（否则文字标题） |
| **按钮** | 5 | `k/btn-{spin,plus,minus,mute,info}` | LayoutNode `Button.skin`（否则主题色按钮） |

## 2. 管线接线（编译期游戏线·同 game-j/game-m）

- **皮肤槽**：符号 `theme.SYMBOLS[].skin`；非符号 `theme.CHROME_ART[]`。渲染层 `art.ts`/`game-k.ts`/`hud.ts` 全 fail-soft。
- **加载**：`game-k.ts` mount 拉 `/games/game-k/art/index.json` → 按 skinKey 匹配 → 载图（符号 registerSkin·chrome 存 CHROME_IMG·URL 供 LayoutNode）。无 index/404 → 占位照旧。
- **写回=登记别名**（非改蓝图/代码）：平台生成物按 skinKey 登记进 `index.json`，就绪自动换装。**蓝图/玩法零改动**。

## 3. 统一风格锚（风格包 disney-supercell 驱动）

- **stylePack**：`disney-supercell`（迪士尼动画质感 × Supercell 手游打磨：厚涂立体卡通·糖果饱和·圆润·干净厚白描边·手游图标级）。
- **游戏锚（artStyle.stylePrompt）**：`unified spooky-cute zombie slot game set, glossy premium mobile game art, all pieces belong to the same polished set`。
- **调色**：毒绿 `#5ef08a` · 腐紫 `#b45ef0` · 骨白 `#eafff0` · 琥珀 `#ffd166` · 血 `#ff6b6b`。
- 提示词=**主体 subject**（风格交给风格包·不手拼风格词）；完整逐行见 `art-list.md` / 台账 `prompt`。

## 4. 占位真图（工作流「placeholder=库内真图」）

- 平台缩略图只认真图（台账 `gen.servedPath`）·纯程序化占位无图片 → 平台只显示色块 swatch、看不到「替换前长啥样」。故**符号程序化美术烘焙成 PNG 占位真图**：
  - `node scripts/game-k-bake-placeholders.mjs`（headless 渲染 art.ts drawSymbol → 每符号一张 256² PNG）→ `public/games/game-k/art/placeholder/sym-*.png`；
  - 登记进 `index.json`（游戏 loader 加载·观感不变）+ 回填台账符号行 `status=placeholder` + `gen.servedPath`（平台即显示真实图标·仍标「占位」待替换）。
- **符号 10 项 = 占位（有真图缩略图）**；**chrome 16 项 = 待配（当前 CSS/主题占位·无独立图·平台显示色块/🎨）**——需真图时一键全量生成。
- 一键全量 / 单槽重生成 → 生成物按 skinKey 登记覆盖 index.json → 游戏 + 平台同步换装。**蓝图/玩法零改动**。

## 5. 规格

- sprite/texture：透明底 PNG·usage:sprite/texture·wrap:clamp；bg：满幅不透明。显示足印见台账 `spec`。
- 编号 **art-01..26**（append-only·墓碑保号）。第一遍 mock smoke（工作流 §六.1）：`game-k-art-requirements.mjs --gen`（落 scratch·**不入库**）。真图 = 带 key/放宽网络 session 一键全量。
