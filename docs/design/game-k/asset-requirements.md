# game-k《Zombie Slots》资产需求规格表（对美术自动生成管线）

> **⚠ 只读视图（需求真相合一）**：机读真相 = `public/games/game-k/art/art-ledger.json`
> （美术平台 GET /api/art/ledger?slug=game-k 读此·「⚡一键全量」按行 `prompt` 生成）。
> **勿手改本文当真相**——改提示词去美术平台按编号改，或改台账行；重跑推导脚本 append-only 合并。
> 推导脚本：`npx vite-node scripts/game-k-art-requirements.mjs`。

## 0. Lead 判读（CORE RULE）

1. **接受·非回驳**：老虎机符号=主体视觉实体，必须有皮肤槽才可换皮（art-pipeline 红线「禁纯色块/无槽=生成线白搭」）。game-k 初版**只有程序化 canvas 美术、零皮肤槽**=欠账，本表补齐。
2. **符号=视觉实体**：10 个符号（5 低分字牌 + 3 僵尸角色 + 百搭 + 分散）各一皮肤槽 `k/sym-<key>`。现状=`art.ts` 程序化占位（迪士尼+次表面散射），皮肤就绪即换装、零资产照跑（fail-soft·同 game-q chooseRenderMode）。
3. **HUD 照旧 LayoutNode**（不入美术生成·图标用 emoji/字形）；转轴框/中奖高亮保程序化（随主题令牌走·不逐帧生成）。

## 1. 管线接线（编译期游戏线·同 game-q）

- **皮肤槽**：`theme.ts` 每符号 `skin:'k/sym-<key>'`；渲染层 `art.ts` fail-soft——`registerSkin(id,img)` 就绪贴真图，否则贴程序化烘焙图。
- **加载**：`game-k.ts` mount 拉 `/games/game-k/art/index.json` → 按 skinKey 匹配符号 → 载图 registerSkin。无 index/404 → 程序化照旧。
- **写回=登记别名**（非改蓝图）：平台生成物按 skinKey 登记进 `public/games/game-k/art/index.json`，就绪自动换装。**蓝图/玩法零改动**。

## 2. 统一风格锚（一致性·`STYLE` 前缀注入每条 prompt）

- **stylePack**：迪士尼亲和 × 次表面散射（Disney appeal + subsurface scattering glow）。
- **stylePrompt 前缀**：`2D game slot symbol icon, Disney-style character appeal, big expressive eyes, rounded friendly silhouette, subsurface scattering glow, soft translucent glowing undead flesh, warm inner light bleeding through, cool rim light, gooey highlights, centered, transparent background, high contrast, clean render,`
- **调色板**：毒绿 `#5ef08a` · 腐紫 `#b45ef0` · 骨白 `#eafff0` · 琥珀 `#ffd166` · 血 `#ff6b6b` · 生化黄绿 `#b6f03a`。
- **统一负向**：`text, watermark, signature, realistic gore, photorealistic, muted colors, cluttered, drop shadow, background scenery, extra limbs`。

## 3. 规格

- 每符号 **1024² PNG·透明底·usage:sprite·wrap:clamp·srgb**；显示足印 120×120（转轴格内居中）。
- 编号 **art-01..art-10**（append-only·墓碑保号）；完整提示词见台账行 `prompt`（人读清单见 `art-list.md`）。
