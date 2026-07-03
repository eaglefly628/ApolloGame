# game-d 自托管字体 · 许可与来源（Font Credits）

自托管（离线·不引用运行时 CDN），Vite 打包发出，本地 `@font-face` 引用。
沿用 game-g 的自托管字体路线（见 `src/games/game-g/fonts.ts`）。

## Ma Shan Zheng（马善政 · 毛笔楷书）

- **字体族名（font-family）**：`Ma Shan Zheng`
- **文件**：`mashanzheng.woff2`
- **版权 / Copyright**：© the font authors（Ma Shan Zheng 字体作者）
- **许可 / License**：SIL Open Font License 1.1（OFL 1.1）——可自由内嵌、商用、再分发。
- **用途**：game-d 标题（Title）Logo 的中文毛笔艺术字。
- **来源 / Source**：Google Fonts — https://fonts.google.com/specimen/Ma+Shan+Zheng
  （经 css2 `text=` 精确子集接口取得：`https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&text=...`）
- **子集 / Subset**：仅保留 game-d Title 所需字形（48 个），故文件仅约 19 KB。
  覆盖字符：`骰途两名掷命者一座会改写命运的古塔开始攀单设置双同敬请期待第翠庭殿熔心晶顶层`
  + ASCII 数字 `0-9` 与空格。
- **子集校验**：`fontTools` 解析 cmap 确认 48/48 目标字形全覆盖，`骰`(U+9AB0)、`途`(U+9014)
  等均有实际轮廓（contours > 0）。
