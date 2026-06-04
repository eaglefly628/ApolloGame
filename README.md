# Apollo Engine

> 工作目录(本地 clone)叫 `MemBrain`；GitHub 远端仓库是 `eaglefly628/ApolloGame`。两者不一致属正常。

> 工作目录(本地 clone)叫 `MemBrain`；GitHub 远端仓库是 `eaglefly628/ApolloGame`。两者不一致属正常。

数据驱动的原子化 ECS 游戏引擎：26 个核心原子 skill + Tier 1-4 涌现层，确定性 tick 循环，
可替换渲染后端，内置 debug / record-replay + 美术资产系统。

所有 skill 集中在 `src/skills/{atoms,tier1,tier2,tier3,tier4}`（见 `src/skills/README.md`）；
美术资产（表现层、不进确定性 sim）在 `src/assets/`。

## 快速开始

需要 **Node ≥ 18**。

```bash
npm install          # 先装依赖（必须）
npm run dev          # 前端开发服务器
```

终端会打印 `➜  Local:   http://localhost:5173/`，**用浏览器打开这个地址**，会看到三个彩色形状在画布上持续运动。
（`npm run dev` 会一直运行、不返回命令行，这是正常的——它是个服务器。停止按 `Ctrl+C`。）

> ⚠️ **不要用 `node src/main.tsx` 直接跑。** `main.tsx` 是浏览器入口（含 JSX 与
> `document` / `createRoot` 等 DOM API），Node 不认 `.tsx` 也没有 DOM。
> 前端一律 `npm run dev`；想在终端跑纯逻辑用 `npm run demo`。

## 命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 前端开发服务器（浏览器，HMR）→ http://localhost:5173/ |
| `npm run demo` | 无头跑引擎：ASCII 可视化 + skill 协作日志 + record/replay 校验 |
| `npm run test` | 全部单测（vitest，152 passed） |
| `npm run build` | 类型检查 + 生产构建 → `dist/` |
| `npm run preview` | 预览生产构建（build 之后） |
| `npx tsc --noEmit` | 仅类型检查 |

## 项目结构

```
src/
  engine/        ECS 内核（World / 类型 / 拓扑排序 / defineCapability）+ protocol 共享组件契约
  atom-skills/   26 个核心原子 skill（transform / velocity / resource / overlap-detect / ...）
  tier1/         Tier 1 涌现系统（motion-apply / lifetime）
  renderer/      collectRenderables + AsciiRenderer（无头）+ CanvasRenderer（浏览器）
  debug/         Tracer（skill 协作日志）+ Recorder / Replayer（确定性录制回放）
  runtime/       Engine（加载蓝图 + 循环 + 渲染后端）
  assembly/      蓝图：playground（浏览器场景）/ demo（生命周期演示）
  ui/            React overlay
wiki/, docs/     设计文档与原子周期表
```

## 验证

```bash
npx tsc --noEmit   # 类型检查，exit 0
npm run test       # 152 passed / 29 files
npm run build      # 构建通过 → dist/
npm run demo       # 引擎无头自检
```
