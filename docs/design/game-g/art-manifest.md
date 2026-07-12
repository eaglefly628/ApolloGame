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

**结论**：要用新平台「替换」game-g 美术，得先把下表 P1/P2/P3 的程序化槽位**改接成 `art:` 引用或 ai-gen 落库**（接入步骤见 §2）。字体已是资产文件、可直接换。

---

## 1. 美术台表（全槽位）

| # | 槽位 | 用途 · 消费点 | 当前来源（文件·函数） | 类型 · 尺寸 · 数量 | 新平台替换路径 |
|---|---|---|---|---|---|
| **P1** | **英雄立绘** | 扑克牌面人像（`PlayingCard.art`）· 收藏/改造坊/牌组屏 | `portraits.ts` `heroPortraitUri(suit,era,rank,rar)` | 程序化 SVG data-URI · viewBox 120×150 · **52 张**（13×4，按 6 地域×4 花色×军衔×5 稀有 拼盔甲半身像） | ① 每张接 `art:"<名将> <时代> portrait"`（共享库有立绘则替）；或 ③ `ai-gen qwen "宋代兵圣孙武半身立绘·古风矢量"` 批产 52 张落 `art/ai/`。回退=保留 `heroPortrait` 占位（fail-soft） |
| **P2** | **3D 战力骰面** | 绝命对决 3D 骰六面数字（`Mesh3D.dieFaces`） | `clash-dice-3d.ts` `faceTex/dieFaces` | 程序化 canvas data-URL · 128×128 · 6 面/骰 × 2 骰（阵营橙/蓝·奶白骰底） | ② vendor 贴图 `tex/<骰面>` 进本地→`dieFaces.src` 引本地 key；或 ③ `ai-gen qwen "象牙骰面·战力数字·古风"`；数字面动态→建议保留程序化生成、只换**底/描边贴图** |
| **P3** | **主页/面板底纹** | 主页绿呢牌桌 + 面板衬底（`Panel.bgTexture`） | `art-textures.ts` `coinLatticeTile`→`FELT_BROCADE` | 程序化 SVG 无缝平铺 · 64×64 · 双皮换色（玄铁金/锦霞） | ② vendor 共享货架平铺贴图（如 `tex/pbr/fabric_albedo`）→`Panel.bgTexture` 引本地 key；或保留程序化（换 stroke/opacity 参数即换皮） |
| P4 | 棋盘底纹 | 战斗屏棋盘背景 | `turn-battle-screen.ts` L737 CSS 渐变 | CSS `radial/repeating-linear-gradient` · 无位图 | 保持程序化（纯 CSS·换令牌即换）；要位图纹理走 ② vendor `Panel.bgTexture` |
| P5 | 扑克牌面（点数/花色版式） | 所有 `PlayingCard`（战斗兵牌/收藏/对决特写） | 基座控件 `render.ts` `PCARD_DIMS`（**非 game-g 资产**） | 矢量绘制（控件内） · sm/md/lg | 基座控件域（主程）——尺寸缺口已提 `REQ-UI-PlayingCard-xl`；牌面美术走控件，不在 game-g 台表 |
| P6 | 花色/生肖/图标符号 | 花色符 `SUITG`、生肖 `ZOD_ICON`、UI emoji（⚔🎲🎴🃏💢💚…） | 各屏内联 Unicode 字符 | 字形（非位图·随字体渲染） | 走**字体**（P7）；要专属图标位图→③ ai-gen 或 ② vendor 图标包（`import-art-pack.mjs`），接 `Label`/`Avatar.src` |
| P7 | **界面字体** | 全 UI 文字 + 艺术字（`Label.font`：display/serif/…） | `fonts.ts` + `assets/fonts/*.woff2` | **真实资产文件** · 12 个 woff2（Silkscreen/Rajdhani/Cormorant/Noto Sans SC/Noto Serif SC/Zhi Mang Xing/Ma Shan Zheng） | **已是资产文件·可直接换**：替 `assets/fonts/` 对应 woff2 + `fonts.ts` 的 `@font-face` family/权重（OFL 授权字体·换字重走 ui-playbook Label.font 闭集） |
| P8 | 双皮色令牌 | 玄铁/锦霞两套配色（花色色/面板/描边） | `lobby-styles.ts` CSS 变量 | 色令牌（非美术资产·非裸 hex） | 非"美术资源"（是主题令牌）；换皮=改令牌值，走 ui-playbook 色库三态 |
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

---

## 3. 一句话总结

game-g 美术 = **9 个槽位**，其中 **P1 英雄立绘（52 张）· P2 骰面 · P3 底纹** 是可上新平台替换的三大块（现全程序化·需先接 `art:`/ai-gen）；**P7 字体（12 woff2）** 已是资产文件、可直接换；其余（棋盘 CSS/花色字形/色令牌/合成音）走各自基座、不占美术台。**要真替换，建议派 `asset-manager` agent 按 §2 接入。**
