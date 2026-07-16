# Game G · 美术台表（Art Manifest）— 按新开发平台「美术资源替换」方法列

> **产出人**：PG（程序B）· 2026-07-06 · owner「把美术资源替换功能用新平台方法、把美术台表列出来」
> **方法依据（手册）**：`docs/playbooks/assets.md` — 统一 Asset 数据路线（`art:` 引用 / `assetKey` / `index.json`）。
> 新平台替换四条通道：
> 1. **`art:` 引用 → `resolveArtRefs`**（`src/assembly/resolve-art-refs.ts`）：槽位写 `"art:<查询串>"`，加载前用 `rankRecords` 确定性解析成共享库真实 id（同库同排序·所见即所选·可审计）。
> 2. **vendor** `node scripts/vendor-asset.mjs <shared-id> game-g [--as <local-id>]`：从共享货架 copy 进本地 `public/games/game-g/art/`，本地 `art/index.json` 消费（不直引货架）。
> 3. **AI 文本生成** `node scripts/ai-gen.mjs <tripo|qwen> "<prompt>" --game game-g [--mock]`：Tripo=文本→3D glb · Qwen=文本→2D png，落 `art/ai/` 带 provenance。
> 4. **保持程序化**（现状）：SVG/canvas/CSS 生成 data-URI = 也是「数据」，换图=换生成参数，manifesto 合规。
> **购物单机制**：`deriveAssetIndex`（`src/assembly/derive-asset-index.ts`）扫蓝图 `assetKey` 字段自动生成——**game-g 现无 `assetKey`/`art:` 共享引用**（见下），故本表为**人工审计版**。

---

## 0. 现状裁定（先看这条）

**game-g 目前完全没接资产平台**：
- ❌ 无本地美术目录 `public/games/game-g/art/`，无本地 `art/index.json`。
- ❌ 无一处 `art:` 共享库引用、无 `assetKey` 字段 → `deriveAssetIndex` 对它导出空购物单。
- ✅ 美术**全程序化**（SVG/canvas/CSS 生成 data-URI）——manifesto 合规（art=数据），但**不可被现有 vendor/ai-gen 平台"替换"**，因为槽位吃的是**函数产物**、不是**资产 id**。
- ✅ **唯一真实资产文件** = 字体 ×12 `.woff2`（`src/games/game-g/assets/fonts/`，Vite 打包·本地 `@font-face`）。
- ⚠️ **补漏（owner 2026-07-06 指出）：整个大厅/页面「底图·背板」漏在初版台账外**——就是全部大厅 UI 垫在最底下的那张背景。现状=纯 CSS 色/渐变（`.ggl-root{background:#0c0a08}` + 各 Screen `bg:var(--paper)` 渐变），**不是美术数据、是程序描述**，所以想「把底图那页画面换成一张图」时它不在台账上。已补为下表 **P0**。好消息：基座 `Screen` 控件**本就支持整图背景**（`props.image` = cover 整图 / `bgTexture` = 平铺 / `blur`），换图是数据活、无需扩控件。

**结论**：要用新平台「替换」game-g 美术，得先把下表 P1/P2/P3 的程序化槽位**改接成 `art:` 引用或 ai-gen 落库**（接入步骤见 §2）。字体已是资产文件、可直接换。

---

## 1. 美术台表（全槽位）

| # | 槽位 | 用途 · 消费点 | 当前来源（文件·函数） | 类型 · 尺寸 · 数量 | 新平台替换路径 |
|---|---|---|---|---|---|
| **P0** | **大厅/页面底图（背板）** ⭐owner 要换的就是这张 | 全部大厅 UI 垫底的那张背景（福袋/面板/导航全铺在它上面）· 所有 Screen(home/campaign/collection/craft/deck) + 大厅根 `.ggl-root` | `.ggl-root{background:#0c0a08}`(`lobby-styles.ts:29`·`lobby-dd.ts:153` 挂 class) + 各 Screen `bg:GG_LOBBY_THEME.pageBg`=`var(--paper)` 渐变(`ui-theme.ts`) | **程序化 CSS 纯色/渐变 · 零位图 · 全屏** | **基座 `Screen` 已支持整图背景**：`Screen.props.image='<本地 art url>'`(cover 整图) 指向 vendor/ai-gen 落库的一张全屏背景图；`.ggl-root` 底色改透明/同图让其透出。**⚠ 上层面板需半透明(glass)才看得见这张底图**（呼应 owner「主页改半透明」）——见 §2.6 |
| P0b | 战斗屏底 | 战斗画框最底（`ggt-outer`） | `turn-battle-screen.ts` mount `background:#0c0a08` | 程序化纯色 · 全屏 | 同 P0：要换图给战斗画框外层设 `background:url(...)`（另有棋盘底纹 P4） |
| **P1** | **英雄立绘** | 扑克牌面人像（`PlayingCard.art`）· 收藏/改造坊/牌组屏 | `portraits.ts` `heroPortraitUri(suit,era,rank,rar)` | 程序化 SVG data-URI · viewBox 120×150 · **52 张**（13×4，按 6 地域×4 花色×军衔×5 稀有 拼盔甲半身像） | ① 每张接 `art:"<名将> <时代> portrait"`（共享库有立绘则替）；或 ③ `ai-gen qwen "宋代兵圣孙武半身立绘·古风矢量"` 批产 52 张落 `art/ai/`。回退=保留 `heroPortrait` 占位（fail-soft） |
| **P2** | **3D 战力骰面** | 绝命对决 3D 骰六面数字（`Mesh3D.dieFaces`） | `clash-dice-3d.ts` `faceTex/dieFaces` | 程序化 canvas data-URL · 128×128 · 6 面/骰 × 2 骰（阵营橙/蓝·奶白骰底） | ② vendor 贴图 `tex/<骰面>` 进本地→`dieFaces.src` 引本地 key；或 ③ `ai-gen qwen "象牙骰面·战力数字·古风"`；数字面动态→建议保留程序化生成、只换**底/描边贴图** |
| **P3** | **主页/面板底纹** | 主页绿呢牌桌 + 面板衬底（`Panel.bgTexture`） | `art-textures.ts` `coinLatticeTile`→`FELT_BROCADE` | 程序化 SVG 无缝平铺 · 64×64 · 双皮换色（玄铁金/锦霞） | ② vendor 共享货架平铺贴图（如 `tex/pbr/fabric_albedo`）→`Panel.bgTexture` 引本地 key；或保留程序化（换 stroke/opacity 参数即换皮） |
| P4 | 棋盘底纹 | 战斗屏棋盘背景 | `turn-battle-screen.ts` L737 CSS 渐变 | CSS `radial/repeating-linear-gradient` · 无位图 | 保持程序化（纯 CSS·换令牌即换）；要位图纹理走 ② vendor `Panel.bgTexture` |
| P5 | 扑克牌面（点数/花色版式） | 所有 `PlayingCard`（战斗兵牌/收藏/对决特写） | 基座控件 `render.ts` `PCARD_DIMS`（**非 game-g 资产**） | 矢量绘制（控件内） · sm/md/lg | 基座控件域（主程）——尺寸缺口已提 `REQ-UI-PlayingCard-xl`；牌面美术走控件，不在 game-g 台表 |
| P6 | 花色/生肖/图标符号 | 花色符 `SUITG`、生肖 `ZOD_ICON`、UI emoji（⚔🎲🎴🃏💢💚…） | 各屏内联 Unicode 字符 | 字形（非位图·随字体渲染） | 走**字体**（P7）；要专属图标位图→③ ai-gen 或 ② vendor 图标包（`import-art-pack.mjs`），接 `Label`/`Avatar.src` |
| P7 | **界面字体** | 全 UI 文字 + 艺术字（`Label.font`：display/serif/…） | `fonts.ts` + `assets/fonts/*.woff2` | **真实资产文件** · 12 个 woff2（Silkscreen/Rajdhani/Cormorant/Noto Sans SC/Noto Serif SC/Zhi Mang Xing/Ma Shan Zheng） | **已是资产文件·可直接换**：替 `assets/fonts/` 对应 woff2 + `fonts.ts` 的 `@font-face` family/权重（OFL 授权字体·换字重走 ui-playbook Label.font 闭集） |
| P8 | 双皮色令牌（**非底图**） | 玄铁/锦霞两套配色（花色色/面板/描边/`--paper`）——注：`--paper` 也喂 P0 底图的渐变色 | `lobby-styles.ts` CSS 变量 | 色令牌（非美术资产·非裸 hex） | 换皮=改令牌值，走 ui-playbook 色库三态。**它是"配色"不是"底图图片"**——要换成一张画走 P0 的 `Screen.image` |
| P9 | 音频 | SFX/BGM | `SynthAudioPort`（合成·audio.md 正样例） | 程序合成（非文件·非美术） | 非美术台；要真实音频文件走 `playbooks/audio.md` |

---

## 2. 接入新平台的步骤（要真替换时按此做）

> **归属**：资产接线 = **PA（`asset-manager` agent / `resource-manager` 技能）主导**；game-g 侧消费点改接 = PG/PE。本表只列清单，实际接入建议派 PA。

1. **建本地美术目录**：`public/games/game-g/art/{textures,models,ai}/` + `public/games/game-g/art/index.json`（站点绝对路径·`baseUrl ''`）；游戏侧 `registerAssetIndex(parseAssetIndex(local))`。
2. **P1 立绘上平台**（最大块·52 张）：
   - a. 走 ai-gen：`for` 每张名将跑 `ai-gen qwen "<name> <era> 古风半身立绘" --game game-g --id portrait-<id> --mock`（本环境 mock·真调等放宽网络 session + DashScope key）。
   - b. 或走 `art:` 引用：`heroPortraitUri(...)` → `"art:<name> portrait"`，加载前 `resolveArtRefs` 解析（需共享库先有立绘）。
   - c. 消费点改一行：`collection/craft/deck-screen` 的 `art: heroPortraitUri(...)` → `art: 'art:portrait-'+h.id` 或本地 key。**回退保留** `heroPortrait` 占位（解析失败 fail-soft）。
3. **P2/P3 贴图上平台**：`vendor-asset.mjs` 从 §⑦ 货架 copy（如 `tex/pbr/fabric_*`）→ 本地引；骰数字面保留程序化、只换底贴图。
4. **P7 字体**：直接替 `assets/fonts/` woff2 + `fonts.ts` family（已是文件·无需接平台）。
5. **验收**：`node scripts/game-skill-audit.mjs game-g`（不新增裸随机/innerHTML/createElement 红旗）+ 载入不炸（fail-soft）+ `/check-ui`。

### 2.6 P0 底图换成一张画（owner「把底图那页画面换掉」+「主页改半透明」合并流程）

底图现在是纯 CSS 色/渐变，要换成一张背景**图**、并让上层大厅 UI 透出这张图：
1. **落一张全屏背景图进本地库**：`ai-gen qwen "命运牌桌大厅背景·古风·暗金" --game game-g --id lobby-bg --mock`（或 vendor 现成图）→ `art/index.json` 得 `lobby-bg`。
2. **底图接图**（数据活·基座已支持）：各大厅 Screen 加 `props.image = <lobby-bg url>`（cover 整图；`bgTexture` 走平铺·`blur` 可选磨砂）；`.ggl-root{background:#0c0a08}` 改透明或同色让图透出。
3. **上层面板半透明**（不然背景图被面板不透明底盖住·= owner「主页改半透明」）：把大厅面板底从不透明改 `glass`（磨砂）或 rgba 半透明——**⚠ 走 `/check-ui` 透明度关**（浮层/弹窗内容区仍要实底兜底对比度·别把正文糊在背景图上）。
4. 验收：`/check-ui`（透明度/对比度）+ 真机看背景图透出、正文仍读得清。
> 归属：P0 底图接图 + 面板半透明 = **PG/PE（大厅 UI 域·本人可做）**；背景图资产生成/入库 = PA。

---

## 3. 一句话总结

game-g 美术 = **10 个槽位**，最关键的 **P0 大厅/页面底图（背板）**=owner 想换成一张画的那张，现状纯 CSS 色/渐变（漏在初版台账外·已补），基座 `Screen.image` 本就支持整图、换图是数据活（+ 上层面板半透明才透得出）；其余可换大块=**P1 英雄立绘(52 张)/P2 骰面/P3 底纹**（现全程序化·需接 `art:`/ai-gen）；**P7 字体(12 woff2)** 已是文件、可直接换；棋盘 CSS/花色字形/色令牌/合成音走各自基座、不占美术台。**要真替换，底图+面板半透明本人可做，立绘/贴图资产入库派 `asset-manager` agent。**
