# 3D 世界积木库 · 来源调研（2026-10-27）

> owner 设想：像任天堂马里奥世界 / 马里奥制造那样，用大量**统一风格的基础 3D 物件**拼出世界，配合动画库让人物和场景融成一体；积木库填满之时，就是能用它创造世界之时。本文调研「像 Mixamo 之于动画」那样的公开 3D 美术库来源。
> 价格、许可以各站当前页面为准；下列信息取自 2026-10 可查到的公开页面（链接见文末）。

## 一、结论先说

1. **风格统一是第一约束，不是数量**：混用多家积木会一眼「拼贴感」。建议**选一家当主风格**，其余只作补充，并统一用引擎的 toon 着色 + 描边 + 风格令牌调色压到同一观感（`Material3D` 的 `shading:'toon'`、`outline` 已有）。
2. **首选三家 CC0**（可商用、免署名、可以进公开仓库，这是相对 Mixamo 的最大优势）：
   - **KayKit**（Kay Lousberg）：圆润、粗壮、明快，**最接近任天堂观感**；有平台跳跃积木（关卡方块、拾取物、开关）、城市、中世纪、地牢、小游戏合集，角色带骨骼与动画。**推荐作主风格。**
   - **Kenney**：数量最大、种类最全（平台、城市、城堡、自然、家具、赛车、太空……），干净的几何风；Platformer Kit 约 150 个文件，4.0 版加了带动画角色。**推荐作补充**（种类兜底）。
   - **Quaternius**：约 80 个主题包、1100+ 模型（glTF/GLB、FBX），自然 / 奇幻道具大包、大量带动画角色。**推荐作补充**（自然与角色）。
3. **缺件用 AI 补**：主风格里没有的物件，用 Tripo 以主风格物件为参考图生成，并带风格令牌（这正是待你判的 GAP-AIFLOW-REFS 那条接缝）。
4. **积木库要像动画库一样「入库」**：统一格式、自动量尺寸 / 吸附格、碰撞、分类标签，才谈得上「用它拼世界」。这一步要先对现有能力实查再报 A/B（§四），本文不裁。

## 二、来源对比

| 来源 | 规模 | 风格 | 许可 | 能否进公开仓库 | 建议 |
|---|---|---|---|---|---|
| **KayKit**（itch.io / 官网） | 多个主题包；平台包 120 个独立模型（含换色 370 个） | 圆润卡通、明快，统一配色贴图 | **CC0**（请勿原样转卖） | ✅ | **主风格** |
| **Kenney**（kenney.nl） | 数十个 3D 包；平台包约 150 文件 | 干净几何、平涂 | **CC0** | ✅ | 补充：种类兜底 |
| **Quaternius**（quaternius.com） | 约 80 包、1100+ 模型 | 低多边形风格化；自然大包、奇幻道具大包 | **CC0**（部分包另有付费的 Source 版） | ✅ | 补充：自然、角色 |
| **Poly Pizza**（poly.pizza） | 1 万+ 低多边形模型，有 API | 各作者不一 | **CC0 与 CC-BY 混合**，需逐个看 | CC0 ✅ / CC-BY 需署名 | 零散补件，入库时记许可 |
| Sketchfab / OpenGameArt | 海量 | 各作者不一 | 逐个许可 | 视许可 | 偶尔补件 |
| **Synty POLYGON**（付费） | 极大，统一低多边形风格 | 统一 | 商业 EULA；通常禁止原样再分发 | ❌ 只能放私有库 | 备选；网页版会把模型文件下发给玩家，是否算再分发要书面问 Synty |
| **Fab**（Epic，付费 + 每两周免费） | 大 | 不一 | Fab Standard License：可用于任何引擎 | 再分发需看条款 | 备选 |
| Poly Haven / ambientCG | 大 | **写实** | CC0 | ✅ | 不做积木；只取 HDRI 天空 / 材质 |

## 三、怎么接进我们的库

- 仓库里已有导入器与 vendor 工具（`scripts/vendor-asset.mjs`，Kenney UI 包就是这么进来的），但目前 3D 网格只有 15 个（`assets/index.json` 中 `type:'mesh'`）。
- 云端会话访问 kenney.nl、itch.io 等站点曾被网络策略挡（`docs/workflow/art-library-handoff.md`），下载要像 Mixamo 一样在你本机由 Codex 执行；**CC0 的可以提交进仓库**，只取 GLB，注意仓库体积（大包分批，必要时 Git LFS）。
- 三家的角色都自带各自骨架：要接入动画库，按 M2 的 `skin-ingest` 改名到 `apollo-humanoid-v1`（每个来源一张改名表），之后由 M1 共用整个动画库。

## 四、下一步（需要你先点头再查）

「拼世界」本身可能涉及三件事，**都要先对现有能力实查，再按缺口协议报 A/B**：

1. **积木入库**：统一 GLB、量包围盒、定吸附格、生成碰撞、分类标签（类比 M2）。
2. **拼装数据**：「哪块积木放在哪一格」的关卡数据 → 引擎实例化（现有 E5 是从 Blender 场景导入；是否已有网格放置能力待查）。
3. **AI 拼场景**：从关键图或文字描述生成拼装数据，复用积木库与盲审。

建议先做一件小事验证风格：从 KayKit 平台包、Kenney 平台包、Quaternius 自然包各取 5 个物件，放进同一场景，用 toon + 描边 + 风格令牌渲染截图对比，再定主风格。

## 来源

- [KayKit Platformer Pack（itch.io）](https://kaylousberg.itch.io/kaykit-platformer)
- [KayKit City Builder Bits（itch.io）](https://kaylousberg.itch.io/city-builder-bits)
- [KayKit Mini-Game Variety Pack](https://kaylousberg.itch.io/kay-kit-mini-game-variety-pack)
- [KayKit Dungeon Pack 1.0（OpenGameArt）](https://opengameart.org/content/kaykit-dungeon-pack-10)
- [KayKit Medieval Builder Pack（OpenGameArt）](https://opengameart.org/content/kaykit-medieval-builder-pack-10)
- [Kenney Platformer Kit](https://kenney.nl/assets/platformer-kit)
- [Kenney Platformer Kit（itch.io）](https://kenney-assets.itch.io/platformer-kit)
- [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html)
- [Best Free 3D Model Sites for Games (2026)](https://app.cinevva.com/guides/free-3d-model-sites)
- [Poly Pizza API（第三方说明）](https://skills.sh/editframe/skills/poly-pizza-api)
- [Poly Pizza 上传规范](https://poly.pizza/docs/uploading)
- [Fab 发布公告（Epic）](https://www.unrealengine.com/en-US/blog/fab-epics-new-unified-content-marketplace-launches-today)
- [Fab 免费资产与 Standard License（CG Channel）](https://www.cgchannel.com/2024/11/epic-games-to-share-new-free-assets-on-fab-every-two-weeks)
- [Synty POLYGON（Unity Asset Store 列表）](https://assetstore.unity.com/packages/3d/environments/polygon-starter-pack-art-by-synty-156819)
