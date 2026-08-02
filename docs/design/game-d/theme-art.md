# 主题美术系统 · game-d《骰途》(ThemeArt)

> owner 2026-07-06「要做很多肉鸽关卡·美术上需要主题性的设计」。为**规模化的主题辨识度**建的**数据驱动主题系统**——
> 一层（Act）= 一个主题 = 一行数据；全由现有渲染能力解释，**加一个主题关卡 = 加一行**（不写代码）。

## 为什么是"一行数据"（数据驱动宣言尺子）

一个主题的全套外观 = 一组**预设 + 颜色 + 表面纹**（`ThemeArt`）。过"最弱 LLM 也能照抄产出一样的数据吗？"——**能**（照着填 hex 与 preset 枚举即可）→ 合格的数据接口，不是虚胖的"数据表 + 游戏层自写解释器"。解释器**全是现成引擎能力**，游戏层零新增系统代码。

## 数据结构（`games/game-d/rooms.ts`）

```
ThemeArt {
  floor  : Mat        // 地盘材质
  struct : Mat        // 围墙（基座/走廊/火炬柱由它压暗派生）
  bright : Mat        // 亮件（火盆碗珠 / 门楣·可 emissive 自发光）
  ring   : number     // 命运之环主色
  sky    : {top,bottom,env}                       // 天穹渐变 + IBL 强度
  light  : {sun,sunI, amb,ambI, fill,fillI}       // 主/环境/补光 色+强
  dust   : [c0,c1,c2] // 战场鼠标尘埃渐变（起/中/末）
  glow   : number     // 火盆 / 门符文光色
}
Mat = { preset:'matte|steel|iron|gold|copper', color?, surface?{pattern,tiles,normal,rough}, emissive?, emissiveIntensity? }
```

`Mat` = 现有 `Material3D` 能力的子集（`src/assets/pbr-materials.ts` 闭集预设）。

## 谁解释每个字段（全现成能力·零新系统）

| 字段 | 消费的引擎能力 | 落点 |
|---|---|---|
| `floor/struct/bright` | `Material3D`（PBR·render-only） | `genRoom` 挂到地/墙/基座/门楣/火盆 |
| `ring` | `Material3D`（steel 染色） + `Anim3D`（多轴变速自转） | `metalRing` |
| `sky` | `Sky3D`（渐变穹 + env IBL） | `applyArenaTheme`（game-d.ts） |
| `light` | `Light3D`（directional/ambient） | `applyArenaTheme` |
| `dust` | `Vfx3D`（colorGradient） | `spawnArenaDust` |
| `glow` | `Glow3D`（加性光晕） | `cornerBraziers` / 门符文 |

`applyArenaTheme()` 在 `beginRoom`（跨层推进）+ `setMood(false)`（进盒庭）时调 → **换层即换整套氛围**。

## 现有 4 主题（`ACTS[].art`）

| 层 | 地盘 | 墙 | 亮件 | 氛围 |
|---|---|---|---|---|
| 翠庭 | 绿草地(matte+noise) | 苔痕石(matte+bumps) | 暖砂石 | 暖阳·花粉尘 |
| 古殿 | 冷石板 | 青石墙 | 抛光银(steel) | 苍蓝·青焰·冷尘 |
| 熔心 | 黑玄武岩 | 焦岩墙 | **熔浆自发光**(emissive) | 炽红·暗穹·余烬尘 |
| 晶顶 | 冰晶地 | 冰晶反光(steel) | **紫晶自发光**(emissive) | 霜白·亮穹·紫辉尘 |

## 加一个新主题（配方）

1. 在 `ACTS` 末尾加一行：占位色（floorTop/wall/accent…）+ 一个 `art:{…}`（照上表填 `Mat`/sky/light/dust/glow）。
2. 完。`genRoom`/`applyArenaTheme`/`spawnArenaDust` 自动按 `index→act` 取用；无需改任何代码。

## 后续可插的增量（同一批字段·不改架构）

- **真实贴图 / AI 生成美术**：`Mat` 支持 `map/normalMap/…`（Material3D 已有字段）→ 把程序化 `surface` 换成真实/AI 贴图 key，走资源线登记，**接同一 `floor/struct/bright` 字段**，架构不动。
- **专属道具装饰**：给 `ThemeArt` 加一个 `props?: Ent[]`（数据摆放的主题道具：冰晶柱/岩浆池/水晶簇…），`genRoom` spread 进去——仍是数据。
- **skyTone 精修**：`beginRoom` 现固定 `skyArt(act,'warm')`；可加 `art.skyTone` 让熔心/晶顶取 `'dark'` 背景图。
