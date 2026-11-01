# ZeroCraft 引擎编辑器 · AI 原生 · 2026-11-01

> 状态：E1 已施工（见 §5）。创作平台首屏已换成本编辑器；旧版创作台保持兼容、一键可回。

## 1. owner 定调（2026-11-01）

- **形态学 Unity / Unreal，开发方式不学**：项目选择页 → 编辑器（资产树、场景层级、预览、属性、日志）。人用它**看懂、指认、验收**；**开发一律 AI 原生**。
- 项目结构判 **B**：编辑器侧索引 `project.json`，**引擎与 manifest 格式一字不动**。运行时真需要按关卡切换时再议 A（manifest schema 2）。
- 手工权限判 **乙**：人可在属性面板调**标量数值**；结构改动（增删实体/组件/控件、换类型）只走 AI。人改与 AI 改进**同一条改动记录**，AI 读得到。
- 目标用户（暂定）：**有创作能力的策划**。
- 老游戏**不迁移、只保兼容**；新流程一律用 **`new<n>`** 编号建新游戏，不为老游戏做适配性改动。

## 2. 核心交互：选中即上下文

Unity 的核心动作是「拖一下」；这里是「**选中这个 → 告诉 AI 改它**」。资产树、层级、属性面板里的当前选中，实时拼成给 AI 的上下文（`selectionContext`）：项目、资产 id 与文件、实体、字段。人负责指认，AI 负责动手。

## 3. 项目索引 `project.json`

一张 `new<n>` 项目 = 一张普通库卡带 `library/new<n>/`，入口场景就是 `manifest.json`，所以既有运行器、AI 对话、版本历史、美术台账照常可用。`project.json` 在其上加一层资产索引：

```json
{ "schema": 1, "id": "new1", "name": "雨夜猫咖", "entry": "scenes/main",
  "assets": [
    { "id": "scenes/main",   "type": "scene", "name": "主关卡", "path": "manifest.json" },
    { "id": "ui/hud",        "type": "ui",    "path": "ui/hud.json" },
    { "id": "data/tuning",   "type": "table", "path": "data/tuning.json" },
    { "id": "docs/overview", "type": "doc",   "path": "design/overview.md" },
    { "id": "motion/walk",   "type": "motion", "ref": { "platform": "motion", "id": "<clip id>" } }
  ] }
```

- 类型闭集：`scene`（manifest）· `ui`（LayoutNode）· `table`（JSON 数据表）· `doc`（.md）为**项目内文件**；`image` · `model` · `motion` · `audio` 可用 `ref` 指向外部平台/资产库（不复制素材）。
- 树形 = id 的 `/` 前缀（不另存文件夹表·免两份真相）。
- 校验：前端 `src/studio/editor/project-model.ts::validateProject`；后端只放行**已登记**且过同一套相对路径规则的文件。
- 关卡即使是一屏 UI，也是一条 `ui` 资产，与场景同等管理。

## 4. 编辑器布局

| 区域 | 内容 |
|---|---|
| 顶栏 | 项目名 · ▶/⏸ 预览 · ⟲ 重开 · 动画平台 / 3D 资产平台（`PlatformLauncher`）· 旧版创作台 |
| 左上 · 项目 | 资产树 |
| 左下 · 层级 | 场景 = 实体（标模板 / 展开数）；UI 屏 = 控件树 |
| 中 · 预览 | 场景 = 引擎真跑（`ManifestPreview`）；UI 屏 = `mountUI` 真渲染（house 主题 `apolloOnyx`）；文档/数据表 = 只读文本；外部引用 = 「在独立平台中打开」（动作直达 `/library/?clip=`） |
| 右上 · 属性 | 字段摊平；标量可调（乙），结构只读；UI 控件的 `type`/`id` 只读 |
| 右下 · AI 助手 | 显示当前指认上下文；发出需求；「应用 AI 的改动」→ 过引擎真校验后落盘并记入改动记录 |
| 底 · 改动记录 | 人 + AI 同一条流 |

本编辑器是创作平台**产品壳**，沿用 SHELL + React（同 `DesignStudio` 例外）；游戏自己的 UI 屏一律 LayoutNode 真渲染。

## 5. 分阶段

- **E1（已施工·2026-11-01）**
  - `main_entry/editor_projects.py`：项目列表、建 `new<n>`（骨架 = 两个场景 + HUD + 数值表 + 设计总览）、读已登记文件、乙档手调（只改已有标量、类型不变、UI 结构键拒收）、AI 改动记账、改动记录。测试 `main_entry/test_editor_projects.py`。
  - `src/studio/editor/`：`project-model.ts`（索引校验/树/层级/摊平/手调解析/指认上下文）· `EditorApp.tsx`（Hub + 编辑器）· `editor-api.ts` · `app-route.ts`（首屏路由）。测试三份。
  - `src/launcher.tsx`：首屏缺省进编辑器；`?legacy=1` 或旧版自己的深链参数（`game`/`from`/`bare`/`mode`）直进旧版；旧版里加「✦ 引擎编辑器（新）」回跳。
- **E2**：AI 写入通道覆盖全部资产类型（现阶段 AI 只能直接改入口场景 `manifest.json`，对其它资产只给文字建议）；AI 新增/删除资产时同步改 `project.json`。
- **E3**：底栏加 DebugTrace（只读重建「为什么是这个结果」）；确定性时间轴（逐帧单步、拖动、同局重放）。
- **E4**：场景视图内点选实体（与层级同步）；外部资产（动作/3D）的缩略预览。

## 6. 风险与边界

- AI 写入现阶段只覆盖入口场景：界面已明示，不假装能改其它资产。
- 首屏换成编辑器会改变 owner 原有打开习惯：旧版一键可回，所有旧深链参数原样进旧版。
- `new<n>` 编号按库目录现有最大号 +1；不回收删除过的编号。
