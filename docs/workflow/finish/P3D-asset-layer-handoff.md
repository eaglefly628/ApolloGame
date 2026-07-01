# P3D 交流/交接 · 统一 Asset 层（REQ-Resource ②③）契约 + 跨界授权

> **Lead → P3D · 2026-07-01。** owner 2026-06-30 拍板 REQ-Resource（3D 资产走 2D 贴图同款 Asset 路线）、2026-07-01 **授权 P3D 跨界落引擎核心 `src/assets`**（同 NavMesh / model-loader / 3D 碰撞授权先例）。
> 本文 = Lead 定的**引擎核心契约**（`spec` 闭集 schema + 全类型桥接设计 + Material3D 消费端），P3D 照此实现；跨 2D/3D 的核心改动**合并前 Lead review**。
> **这是契约也是交流**：schema 是我按数据驱动尺子定的，但 3D 消费端上下文你最深——**动手前若发现哪条与 3D 现实不合，先回我改契约，别硬凑。**
>
> 依据评审：`docs/workflow/requests.md` REQ-Resource 裁决 + `docs/design/asset-pipeline-review.md`（你的 review·准确·已逐条硬验）。

---

## 0. 代码边界（本工作流·配 `P3D-game-z-handoff.md §0.1`）

| 标记 | 范围 | 谁 |
|---|---|---|
| ✅ **P3D 独占** | `src/renderer/three/**`（`material.ts`/`surface-tex.ts` 等）·`src/games/game-z/**` | P3D 自由改 |
| 🔶 **共享·改前知会** | `src/engine/protocol/components/render.ts` 的 **render-only 3D 组件**（`Material3D` 加 map 字段=此列） | P3D 改·知会 Lead |
| 🔓 **本单跨界授权**（owner 2026-07-01） | `src/assets/{asset-index,asset-types,pbr-materials}.ts` | **P3D 实现·合并前 Lead review**（照本契约 schema） |
| 🔒 **Lead 独占** | `src/assets` 的 `spec` 闭集 schema **设计权**（本文 §2）· 其余 `src/{engine,skills,assembly}` | Lead |

**红线（复诵·每步校）**：① 资产 = render-only 表现层·sim 只持 `key` 不进 hash；② 导入选项/材质/贴图用途**全是闭集数据**（弱 LLM 尺子·绝不开自由代码/自由 CSS 口子）；③ 增量·向后兼容（现有 2D texture 路径 + 无 usage/colorSpace 的旧条目照跑）；④ **不引入新 `Resource` 类型**（撞 sim `Resource` 组件）·沿用 `Asset*` 命名。

---

## 1. 现状锚点（已核·别推倒）

- `AssetIndexEntry`（`asset-index.ts:28`）：`id/type/status/path/spec?(freeform Record)/category/tags/source/license/style/provenance`。`AssetType` 已列全 7 型。
- `registerAssetIndex`（`asset-index.ts`）：**`e.type!=='texture' 即 continue`** → 只桥 texture，建 `TextureDescriptor|AtlasDescriptor|SpriteSheetDescriptor`。
- mesh：game-z `registerManifest(GAME_Z_ASSETS)`（`ModelDescriptor{kind:'model'}`）**绕索引**。
- `Material3D`（`render.ts:200`）：`preset/color/roughness/metalness/emissive/surface(程序化)` ——**无 map 字段**。
- `buildPbrMaterial(def: PbrMaterialDef, surface?)`（`three/material.ts`）：预设→`MeshStandardMaterial`；`surface` 在场→`buildSurfaceMaps` 程序化 normal/roughness 挂上。`pbrSig` 是重建签名。

---

## 2. 引擎核心契约（Lead 定·P3D 实现）

### 2.1 `AssetIndexEntry.spec` → 按 `type` 判别的闭集（替 freeform·注册期校验）

只给**有消费者的类型**定（texture/mesh/material）；sound/font/video 保持占位不动（YAGNI）。

```ts
// texture —— usage/colorSpace 是真实贴图关键元数据
interface TextureSpec {
  usage?: 'albedo'|'normal'|'roughness'|'metalness'|'ao'|'orm'|'emissive'|'sprite'; // 缺省 'sprite'
  colorSpace?: 'srgb'|'linear';   // 缺省按 usage 推：albedo/emissive/sprite→srgb·normal/roughness/metalness/ao/orm→linear
  wrap?: 'clamp'|'repeat';        // 缺省：sprite=clamp·材质贴图=repeat
  tiling?: number;                // UV 重复次数（材质平铺）
  // 既有 frames?(atlas)/sheet?(sprite-sheet)/width/height 保留兼容
}
interface MeshSpec { scale?: number; genCollision?: 'none'|'box'|'hull'; } // genCollision 接 Collider3D（后期）
interface MaterialSpec {           // 材质 = 引 texture key 的数据资产（预设降级为「内置材质资源」）
  preset?: string; color?: number; roughness?: number; metalness?: number; emissive?: number;
  map?: string; normalMap?: string; roughnessMap?: string; aoMap?: string; // = texture 资产 id
}
```

- **闭集校验**放 `parseAssetIndex`：`usage`/`colorSpace`/`wrap`/`genCollision` 非法枚举 → 构建期抛错（同现有 sheet 校验套路）。
- **colorSpace 缺省推导规则必须实现**（防「法线图误设 sRGB 渲染错」经典坑·又让作者少填）：省略时按 `usage` 推。
- **向后兼容**：旧 texture 条目无 `usage`/`colorSpace` → 视作 `sprite`/`srgb`（现行为不变）。

### 2.2 `registerAssetIndex` 桥接全类型（不再只 texture）

- **texture**（改）：读 `spec.usage/colorSpace` → 传给描述符（`TextureDescriptor` 加 `colorSpace?`），加载时 `tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace`（linear）。
- **mesh**（新）：`e.type==='mesh' && filled` → 建 `ModelDescriptor{kind:'model', key:e.id, src:baseUrl+path, scale:spec.scale}` → `manager.register`。**收编 game-z 手写 manifest**：模型条目搬进 `index.json`（进统一溯源/许可/检索·现 fox.glb 只在 CREDITS）；game-z 改为不再散调 `registerManifest`（或让它从 index 派生）。
- **material**（可后置到 Phase 4）：`e.type==='material'` → 解析成材质资源供 `resolvePbr` 读。**Phase 1 不需要**——① 的 `Material3D.map` 直接引 **texture** key，材质本身暂不必进索引。

### 2.3 `Material3D` 消费端（Phase 1·你现在就做）

- `Material3D` 加 render-only 字段（🔶 知会 Lead）：`map?: string; normalMap?: string; roughnessMap?: string; aoMap?: string;`（= texture 资产 id）。
- `buildPbrMaterial` 扩：拿到 AssetManager（渲染器传入·当前签名没有→加参数）→ 对每个 map key `manager.get(key)` 取 `THREE.Texture` → **按该 texture 条目的 `spec.colorSpace` 设色彩空间**（albedo=SRGB·normal/roughness/ao=linear/NoColorSpace）→ 挂 `m.map/normalMap/roughnessMap/aoMap`。
- **贴图 vs 程序化 surface 共存**：显式 map 存在 → 用图（override 对应的程序化通道）；缺省 → 回退 `surface`/纯色（现行为）。
- **`pbrSig` 扩**：把 4 个 map key 纳入签名（map 变 → 重建 mesh）。

---

## 3. 分期 + 归属 + 验收

| 期 | 内容 | 谁 | 验收 |
|---|---|---|---|
| **①** 材质贴图消费端（§2.3） | `Material3D.map…` + 渲染器按 colorSpace 取图 | **P3D·现在做** | game-z 放 1-2 张真实贴图（配 usage/colorSpace 数据）→ 物件 `Material3D{map:'…albedo',normalMap:'…normal'}` 正确渲染（法线线性·不偏色）·与程序化 surface 并存·tsc+vitest+build 绿 |
| **②** `registerAssetIndex` 桥 mesh + 收编 manifest（§2.2） | P3D 跨界·**Lead review** | 模型进 `index.json`·game-z 不再散 `registerManifest`·渲染无回归 |
| **③** `spec` 闭集 schema + 校验（§2.1） | P3D 跨界·**Lead review** | 非法 usage/colorSpace 构建期抛错·旧条目兼容·`asset-index.test` 补例 |
| **④** 材质成索引资产 / sound·font | 按需·后置 | — |

> **①不依赖②③**（骑成熟 texture-key 路径）→ 已为你钉死两个共享契约点（见 §4）·零返工·现在就落。②③ 动核心索引·合并前 Lead review。

## 4. 已钉死的两个契约点（①即用·不会变）

1. **texture `spec.usage`**=`'albedo'|'normal'|'roughness'|'metalness'|'ao'|'orm'|'emissive'|'sprite'` + **`spec.colorSpace`**=`'srgb'|'linear'`（缺省按 usage 推）。
2. **`Material3D.map/normalMap/roughnessMap/aoMap`**（=texture 资产 id·字段名照 THREE 标准）。

## 4.5 ① 完成回执（P3D 2026-07-01·知会 Lead）

> **① 材质贴图消费端已落**（照 §2.3/§4 契约·全绿）：
> - `Material3D` 加 `map/normalMap/roughnessMap/aoMap`(=texture 资产 id·THREE 标准名)。
> - `buildPbrMaterial(def, surface?, maps?)` + `PbrMaps` 类型：挂真实贴图·**显式贴图覆盖程序化 surface**·有 albedo 图 → 基色置白(免二次染色·PBR 惯例)·真实法线 normalScale=1。`pbrSig` 纳入 4 map key。
> - 渲染器 `resolvePbrMaps`/`pbrMapTexture`：按 key 从 AssetManager 取整图 THREE.Texture·**色彩空间按材质槽位定**（map→sRGB·normal/roughness/ao→NoColorSpace 线性）·RepeatWrapping·缓存·就绪态并入 mesh mode（异步贴图就绪后自动重建挂上）。
> - **demo**：`game-z` 加 `DioramaLoader`（分发 loader·model→字节 / 贴图→图·补 ModelAssetLoader 只吃 model 的缺）+ 自产程序化木板贴图 `public/textures/plank_{albedo,normal}.png`（`scripts/gen-textures.mjs`·确定性·无许可/网络依赖）+ `plank-crate`（`Material3D{map,normalMap}`）。截图见木板纹理上盒（tex 计数 +2·纹理已挂）。
> - 测试 `material.test`(4·pbrSig 含 map key·贴图挂载 + 白基·显式覆盖程序化·无图不变)。tsc+vitest(1984)+build 全绿。
> - **①用的两个契约点(texture 色彩空间按槽位·Material3D map 字段名)与契约一致·零返工。** ①经 manifest 走成熟 texture-key 路径·不依赖 ②③。
> - **schema 反馈（§5 要的）**：契约无坑·照做即通。**唯一提醒**：①的 colorSpace 靠**材质槽位**推（map=sRGB·normalMap=线性）·自足正确；②③ 落 `spec.colorSpace` 后应让「index 显式 colorSpace」优先于槽位默认（供特殊情况覆盖）。
> - **下一步**：②③（收编 mesh 进索引 + spec 闭集 schema）动核心索引·我按契约实现完 **回 Lead review** 再合并。要我接着做 ②③ 吗？

## 4.6 ②③ 完成回执（P3D 2026-07-01·**跨界·请 Lead review 再合并**）

> **②③ 已实现·全绿**（tsc 0 / vitest 1991·276 files / build OK）。改动集中在 `src/assets/{asset-index,asset-types}.ts`（🔓 授权跨界）+ 渲染/game-z（✅ 独占）。
>
> **③ spec 闭集 schema + 校验**（`asset-index.ts`）：
> - 新增闭集常量 + 类型：`TEXTURE_USAGES/COLOR_SPACES/TEXTURE_WRAPS/MESH_COLLISIONS` + `TextureSpec/MeshSpec/MaterialSpec`。
> - `validateSpec(type, spec, …)` 挂进 `parseAssetIndex`：按 type 校验 `usage/colorSpace/wrap/genCollision` 闭集枚举 + `tiling/scale/color…` 类型 → **非法值构建期抛错**（同现有 sheet 校验套路）。
> - `deriveColorSpace(usage)` + `textureSpecOf(spec)`：colorSpace 缺省按 usage 推（albedo/emissive/sprite→srgb·normal/roughness/metalness/ao/orm→linear）；显式 `spec.colorSpace` 覆盖。
> - **向后兼容**（红线③）：只校验**已定义语义字段**的值；旧 freeform 键（format/transparent/frames/sheet/width/height…）一律容忍 → 真实 `assets/index.json`（~3 万项）自检测试仍通过。
>
> **② registerAssetIndex 桥接 mesh + texture colorSpace**（`asset-index.ts` + `asset-types.ts`）：
> - `TextureDescriptor` 加 `colorSpace?`（由 spec 派生）；整图 texture 分支写入。**渲染消费端**（`three-renderer.pbrMapTexture`）改为 **index 显式 colorSpace 优先于槽位默认**——闭合 §4.5 我提的那个 loop（特殊贴图可数据覆盖）。
> - 新增 `mesh` 分支：`filled mesh` → `ModelDescriptor{kind:'model'}` 注册（渲染线取字节自解析 glTF）。
> - **material/sound/… 暂不桥接**（登记在索引·后续增量·Phase 4）。
>
> **收编 game-z manifest**（`game-z/assets.ts` + `game-z.ts`）：`GAME_Z_ASSETS`(裸 manifest 数组) → `GAME_Z_INDEX`(经 `parseAssetIndex` 的 `AssetIndex` 数据·带 type/status/spec.usage/溯源/许可)；`registerManifest` → `registerAssetIndex`。模型 + 贴图统一走桥接路径·colorSpace 自动派生（albedo→sRGB·normal→linear）。
>
> **⚠️ 一处对契约的偏离·请 Lead 裁**（§5「与 3D 现实不合先回你」）：契约 §2.2 原话是「模型条目**搬进 `index.json`**（共享）」。我**没并入**那份 ~3 万项的共享 `assets/index.json`，而是让 **game-z 自持一份 `AssetIndex` 数据**，理由两条：
> 1. **物理路径**：game-z 模型/贴图在 `public/{models,textures}/`（站点根），共享 `assets/index.json` 服务于 `/assets/` 树、其 baseUrl=`/assets/` 与绝对 path 拼不出正确 src（`/assets//models/duck.glb`）。
> 2. **架构分层**：游戏专属资产 ≠ 共享美术货架（那 3 万项是 devicon/立绘等项目库）；混入会污染检索/体积。game-z 自持索引**仍走同一套 `registerAssetIndex` 桥接路径**（契约的真实意图——统一 Asset 路线——已达成），只是数据分文件持有。
> 若你坚持要物理并入共享 index，我再改（需先把 glb 挪进 `public/assets/models/` 或让 registerAssetIndex 支持每条目 baseUrl override）——但我判断分文件更干净。**等你拍。**
>
> **✅ owner 2026-07-01 拍板：我的偏离即正解**——共享库不被游戏直接引用，游戏只引自己的本地库；要用共享库资源就 copy 进本地目录（vendoring·hermetic）。故「收编 manifest」= 每游戏自持 `AssetIndex`，不并入共享 index。另立 **REQ-Resource ⑤ vendoring skill**（共享库→游戏本地 copy 工具·`scripts/`·非 `src/skills`）为 real gap·**Lead 判 YAGNI 待消费者再做**（当前零游戏消费共享货架）。详见 `requests.md` REQ-Resource ★★。
>
> **测试**：`asset-index.test` +9 例（deriveColorSpace/textureSpecOf/非法 usage·colorSpace·wrap·genCollision 抛错/旧条目兼容/mesh 桥接/texture colorSpace 派生）。

## 5. 检查点（回 Lead）
- 动 §2.1/§2.2（核心索引）前：贴 schema 差异/疑问回 Lead（若与 3D 现实不合就改契约）。
- ②③ 实现完：Lead review 再合并主干。
- ① 是你独立域·做完知会即可（顺带反馈 schema 有没有坑）。

## 6. 参考
- 评审裁决：`requests.md` REQ-Resource。
- review 全文：`docs/design/asset-pipeline-review.md`。
- 锚点：`src/assets/asset-index.ts`(registerAssetIndex/AssetIndexEntry) · `src/renderer/three/material.ts`(buildPbrMaterial/pbrSig) · `src/assets/asset-types.ts`(ModelDescriptor).
