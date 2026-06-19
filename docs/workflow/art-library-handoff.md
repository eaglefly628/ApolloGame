# 美术库 · 工作交接（art library handoff）

> 给接手的美术库 session。记录当前库状态、导入能力、约束、待办。最后更新：本会话（Claude，美术库程序员）。

## 1. 库现状（按来源 / 风格 / 许可）

**项目索引 `assets/index.json`：共 20019 项**（另有 DCSS 货架 `assets/FreeArtLib/index.json` ~4892 项，CC0 像素，预先存在）。

> 2026-06-19 更新：tabler/phosphor/mdi 三套已由采样 1000 → **拉全**（见 §7 待办 3 已办）。

| 来源 | 数量 | 风格 style | 类目 category | 许可 | 形态 |
|---|---|---|---|---|---|
| game-icons | 4239 | `cartoon.flat` | icon.ui（+ `playing-card` 57） | CC BY 3.0 | SVG 单色奇幻线/填充 |
| twemoji | 1725 | `cartoon.flat` | `emoji` | CC BY 4.0 | PNG 72×72 **彩色**，全带标签可搜 |
| tabler | 5093 | `cartoon.flat` | icon.ui | MIT | SVG 细描线（**全集** outline） |
| phosphor | 1512 | `cartoon.flat` | icon.ui | MIT | SVG 圆润（**全集** regular 权重） |
| mdi | 7447 | `cartoon.flat` | icon.ui | Apache-2.0 | SVG 填充（**全集**） |
| DCSS FreeArtLib | 4892 | `pixel`（默认） | 各 slot | CC0 | PNG 32×32 像素 |

**风格覆盖**：`pixel` ✓（DCSS）｜`cartoon.flat` ✓（5 套，含彩色 twemoji）｜**`cartoon.ink`（水墨）/ `cartoon.western` / `cartoon.anime` = 仍 0**（源被网络挡，见 §4）。

## 2. 风格轴 + 数据模型（已落地）
- `src/assets/artlib.ts`：`ArtStyle` 类型 + `STYLE_TAXONOMY`（pixel / cartoon.ink/western/anime/flat；写实暂不收）+ `assetStyle/styleGroup`。
- `src/assets/asset-index.ts`：`AssetIndexEntry.style?` 字段（导入器写入）。
- `src/assets/library.ts`：`LibraryRecord.style` + `queryLibrary` 按 `style`/`styleGroup` 过滤；分类法加了 `playing-card`(扑克牌)、`emoji`(彩色表情)。
- `src/assets/import/sniff.ts`：加了 **SVG** 识别（viewBox 取尺寸）。

## 3. 导入器（数据驱动，加包=加一条配置）
- **`scripts/import-art-pack.mjs`**（SVG 包，codeload 整包→解压→sniff→盖 style/license/source→并进 index）。
  - 用法：`node scripts/import-art-pack.mjs <pack> <limit>`，已配 `game-icons/tabler/phosphor/mdi`。
  - pack 字段：`subdir`(只取子目录) / `flatId`(id=前缀/名，无作者层) / `sample:'even'`(均匀采样) / `categoryRules`(按名归类，如扑克牌)。
  - **拉更多**：tabler/phosphor/mdi 已拉全（5093/1512/7447，2026-06-19）；game-icons 已全量 4239。复放：`node scripts/import-art-pack.mjs <pack> 100000`（幂等，按 id 去重覆盖）。
- **`scripts/import-emoji.mjs`**（Twemoji 图 + gemoji 名表→可搜彩色表情）。用法 `node scripts/import-emoji.mjs <cap> [useful]`。已全量（1725）。
- **预览**：用 `@resvg/resvg-js`（`npm i --no-save` 临时装，**不是项目依赖**）把 SVG/PNG 拼网格 PNG；或 `scripts/contact-sheet.mjs`（仅吃 8-bit PNG）。

## 4. 网络约束（关键）
- 本环境出口是**白名单代理**：仅 **GitHub 可达**（`raw.githubusercontent.com` / `codeload.github.com`）。
- **被挡(403 `host_not_allowed`)**：kenney.nl、opengameart.org、itch.io、wikimedia、大都会/史密森博物馆、**api.github.com**。
- 改网络策略需**新建环境/新 session**才生效（运行中的容器按旧白名单）。
- **GitHub MCP 搜索**（`search_repositories`/`search_code`）本会话 **502/408 不可用** → 没法关键字盲搜发现新仓库；恢复后可搜 pixel/tileset/cc0 等词找像素/游戏美术系列。

## 5. 策展映射（数据 handoff，纯引用现有资产）
- `assets/curated/game-g-icons.json`：Game G《翻命扑克》41 个能力图标 → game-icons id + 建议主题色 tint（单色 SVG 渲染时染色）。**接线在 Game G 的 game 层 session**。
- `assets/curated/zodiac.json`：十二生肖 → twemoji 全身动物 id（彩色统一）。
- `assets/curated/search-aliases.json`（2026-06-19）：**检索别名层** = `token → [同义词/上位概念/中文]`。导入器只把图标文件名拆词当 tag（`sword→[sword]`），搜不到 `剑`/`weapon`/`blade`。本表在 `library.ts` 运行时按 token 命中并入 tags（`expandAliases()`，**不入 index.json**：省体积、改即生效，同 `artlib-tags.ts` 思路）。`AssetLibrary.tsx` 自动 fetch 应用。**扩词只改这一个 JSON**，无需重跑导入器。实测：剑→42、weapon→160、金币/心/设置 均命中。
  - 为什么不做像素匹配/全量 VLM：单色矢量图标像素扫描只得"颜色/形状"事实、说不出含义；这批图标**名字本就准**，全量 AI 看图多是复述名字、性价比低。AI 视觉留作下一步**按需**用于①名实校验出嫌疑单 ②打"用途/场景"高层标签（沿用 DCSS `tags-vision.json` 模式，产 `assets/curated/icons-tags-vision.json`）。

## 6. Studio 编辑器（本会话前半段，另一条线）
- `src/studio/categorize.ts`：按组件类型签名给实体派「域」(单位/棋盘/经济/UI…) + 搜索 + 「能配啥」schema 清单。
- `src/studio/StudioInspector.tsx`：接了全部游戏(含 game-f/d)、域分类导航、默认折叠树、点选实体→预览框聚光高亮、修了 game-f 预览缩放。
- Phase-B（把游戏配置做成内容表来编辑）**未做**，需 PE/Lead。

## 7. 待办 / 下一步
1. **水墨 / 卡通角色 / 像素游戏美术系列**（最缺）：2026-06-19 复核——网络（OGA/itch/Kenney/api.github 全 403）与 GitHub MCP 搜索（502，走被挡的 api.github）**仍双双不可用**。用户已选路径 ② **自己下载上传**：素材落进 `assets/<风格>/` 后，跑 `src/assets/import/sniff.ts` 同源逻辑或导入器补 index 条目（盖 style/license/source/provenance）。扑克牌面用户拟用 Canva 出图。
2. GitHub MCP 搜索恢复后，关键字捞像素/tileset 系列（本会话仍 502）。
3. ~~tabler/phosphor/mdi 调大 limit 拉全~~ ✅ 已办（2026-06-19，5093/1512/7447，全绿推送）。
4. 把 `game-g-icons.json` 接进 Game G 渲染（game 层）。
5. 纪律：分支 `claude/mainbranch`，每次 `fetch→rebase→push`；tsc+vitest+build 全绿才推；提交署名 `Claude <noreply@anthropic.com>`、信息以 session URL 结尾。
