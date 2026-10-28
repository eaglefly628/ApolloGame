# 体素 / 低多边形美术库 · 方向评估（2026-10-28·⚖ 待 owner 定方向）

> owner 要求：写实不适合我们（重资产），要 Roblox / Minecraft / 低多边形这类风格；问有没有免费网站，或者能否用 Codex + Blender 做一套**自己风格**的 3D 美术库；同时要能做**人物拼接**（换头、换身、换装）和世界拼装。
> 口径：先对引擎实查现有能力，能用数据表达的不去下载或生成文件。

## 一、关键发现：这种风格引擎已经能直接用数据画出来

| 已有能力（已核代码） | 出处 | 用在体素 / 低多边形上 |
|---|---|---|
| 3D 图元：box / sphere / cylinder / cone / capsule / torus，纯色、可分面着色 | `Mesh3D`（`src/engine/protocol/components/render.ts`） | 方块、树干、树冠、石头、屋顶、栅栏…… |
| 体素方块程序化贴图：草 / 石 / 晶纹，顶面网格、侧墙纹、饰条 | `Mesh3D.voxelTex`（同上） | Minecraft 式地块与墙体 |
| 实例化绘制：同签名的方块合成一次绘制 | `src/renderer/three/batches.ts`（W1-A） | 成千上万块的大世界不卡 |
| 卡通着色、描边、雾、泛光、暗角 | `Material3D` / `Post3D` / `Fog3D` | 统一风格 |
| 多实体模板（一棵树 = 树干 + 树冠） | `PrefabLibrary` / `PrefabTemplate.entities`（`src/engine/protocol/components/spawn.ts`） | 可复用的「积木件」 |
| 骨骼挂点：实体挂到骨骼上 | `Attach3D{ parentId, bone }` | Roblox 式方块人：每个身体部件是一块方块，挂到骨骼上 |
| 一套动作套任意身材 + 2445 个动作 | M1 + 动画库 | 方块人直接用整个动画库 |

**含义**：体素 / 低多边形的「美术库」可以首先是一份**数据库**：一个个积木件就是一组带颜色和尺寸的图元模板，不是模型文件。这最符合「游戏 = 数据」：最弱的模型也能产出一棵「圆柱 + 圆锥」的树；文件为零、体积为零、风格由我们的调色板（风格令牌）统一，没有任何版权问题。

## 二、三条路线对比

| | A · 引擎原生数据积木库（推荐作核心） | B · Codex + Blender 脚本生成自有低多边形库（推荐作补充） | C · 下载免费 CC0 体素 / 方块素材（推荐作参考与填充） |
|---|---|---|---|
| 做法 | 积木件 = `PrefabTemplate`（图元 + 体素贴图 + 调色板变量）；方块人 = 隐藏网格的标准骨架 + 挂在骨骼上的方块部件 | 在 Blender 里写参数化生成脚本（树、石、房、道具），一个脚本出一类、改参数出变体，导出低多边形 GLB；脚本入库，产物可重生成 | KayKit Block Bits（58 个方块模块）、Kenney Blocky Characters / Voxel Pack、Fuzzy Man Studios 363 个 `.vox` 模型（CC0）、padadu Voxel Fantasy Bundle（CC0）等 |
| 风格 | 完全我们自己的，统一 | 我们自己的 | 别人的，多家混用会拼贴 |
| 产出量 | 靠数据组合，AI 可批量写 | 靠脚本参数，批量快 | 现成即用 |
| 适合的东西 | 方块世界、几何感强的物件、方块人 | 圆润有机的形状（弯树、动物、细节道具），图元拼不出来的 | 起步参考、快速填充 |
| 代价 | 可能要补 1–2 个小能力（§三） | 每类物件写一个生成脚本；本机要有 Blender（Codex 执行） | 下载要在你本机做；`.vox` 需要导入器（仓库里没有） |
| 版权 | 无 | 无（脚本和产物都是我们的） | CC0 可进公开仓库；CC-BY / CC-BY-SA 需署名或传染，入库要记许可 |

**Lead 推荐：A 为核心，B 补形状，C 只取 CC0 作参考与填充。** 不选写实素材。

## 三、走 A 需要先实查的三处（方向定了我再查，按缺口协议报 A/B）

1. **多部件模板在 3D 里的相对位置**：`PrefabTemplate` 能装多个实体，但展开时是否把每个部件按 3D 相对坐标（`Transform3D`）放到生成点，尚未核实。
2. **方块人**：`Attach3D` 需要一个带骨骼的模型实体做父；能否用「标准骨架 + 隐藏网格」做父、方块部件挂上去随动画走，需要一个用例实证。如果成立，人物拼接（换头、换身、换配件、换颜色）就是纯数据。
3. **`.vox` 导入**（只在走 C 且要用 MagicaVoxel 素材时）：仓库没有 `.vox` 读取，需要一个转换工具。

## 四、建议的第一步（小而能看见）

做一个**风格样张**：用引擎原生图元 + 体素贴图拼一小块场景（地块、两棵树、一座小屋、一个方块人播放一个待机动作），截图给 owner 定风格。不下载、不生成文件，只用现有能力；样张里用不出来的地方，正好就是 §三 要补的。

## 来源

- [KayKit Block Bits（itch.io）](https://kaylousberg.itch.io/block-bits)
- [KayKit Bits Bundle 1（CC0 说明）](https://kaylousberg.itch.io/bits-bundle-1)
- [Kenney Blocky Characters（OpenGameArt，CC0）](https://opengameart.org/content/blocky-characters)
- [Kenney Voxel Pack（OpenGameArt，CC0）](https://opengameart.org/content/voxel-pack)
- [Kenney Block Pack](https://kenney-assets.itch.io/block-pack)
- [Fuzzy Man Studios Voxel Art（363 个 .vox，CC0）](https://fuzzymanstudios.itch.io/voxel-art)
- [padadu Voxel Fantasy Bundle（CC0）](https://padadu.itch.io/voxel-models-fantasybundle)
- [Modular bathroom voxel art（OpenGameArt，CC0）](https://opengameart.org/content/modular-bathroom-voxel-art)
- [VeryLowPoly Free Basic Voxel Assets（CC-BY 4.0）](https://verylowpoly.itch.io/free-basic-voxel-assets)
- [Blender Python 程序化生成入门](https://hamy.xyz/blog/blender-procedural-generation-python)
- [Infinigen 资产生成器结构（参考）](https://infinigen.cs.princeton.edu/docs/latest/ImplementingAssets.html)
- [Procedural Content Generation for Games（Apress）](https://www.oreilly.com/library/view/procedural-content-generation/9798868817878/)
