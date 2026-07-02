# 架构总览

> ⚠ **历史文档（口径已过期）**：原子数/能力数/游戏清单/测试数以机读真相为准（`docs/llm-onboarding.md` §0）。本文仅存考古价值，新 session/新 LLM 勿以此为教材。
>
> 🛠 **渲染口径更正（2026-07-02·覆盖本文下方所有 "Phaser" 字样）**：Phaser **从未接线**（全 git 历史零 `import phaser`），依赖已删。真实渲染分两层——**前端 = 引擎自研 `collectRenderables(world)→Renderable[]`**（引擎无关·抽数据·确定性·可 node 测）；**后端 = 可替换 `RendererBackend{init,sync,destroy}`**：`CanvasRenderer`(Canvas2D·2D 游戏)、`ThreeRenderer`(three.js·WebGL·3D 出口 D+G)、`AsciiRenderer`/`frameSvg`(无头测试)。**UI/HUD 另走** `ui/components` 的 LayoutNode→`mountUI`(DOM)。下方 "Renderer=Phaser / Phaser Canvas 同步" 均以此更正为准。

## 五层架构

```
┌─ Editor Layer ──────────────────────────────────────────────┐
│  Component Agent (AI 对话)  │  Visual Node Editor  │  Params│
├─ Presentation Layer ────────────────────────────────────────┤
│  ┌─ UI Overlay (React DOM) ───┐  ┌─ Game Canvas (Phaser) ─┐│
│  │ 血条, 按钮, 状态提示, 飘字 │  │ 精灵, 动画, 特效, 背景 ││
│  └────────────────────────────┘  └─────────────────────────┘│
├─ Renderer Bridge ───────────────────────────────────────────┤
│  ECS Component ←→ Phaser/React 单向同步                     │
├─ Engine Layer (纯 TS, 零外部依赖) ──────────────────────────┤
│  World │ Systems (拓扑排序) │ Atom Skills │ Manifests       │
├─ Protocol Layer ────────────────────────────────────────────┤
│  Component Vocabulary (Resource / Event / Intent / Render / │
│  Marker / Config)                                           │
└─────────────────────────────────────────────────────────────┘
```

## 层间约束

| 层 | 可依赖 | 不可依赖 |
|----|--------|---------|
| Protocol | 无 | 任何上层 |
| Engine | Protocol | Renderer, UI, Editor |
| Renderer Bridge | Engine, Protocol | UI, Editor |
| Presentation | Engine, Renderer Bridge | Editor |
| Editor | 所有下层 | — |

## 数据流方向

```
外部输入 (键盘/AI/网络)
  ↓
Intent/Event 组件挂到 Entity
  ↓
ECS tick → 拓扑排序执行 Systems
  ↓
Resource 组件更新 (Health, Mana, ...)
  ↓
Render 组件更新 (BarDisplay, AnimationState, ...)
  ↓
Renderer Bridge → Phaser Canvas 同步
React Overlay → DOM 更新
```

## 技术栈

| 层 | 技术 |
|----|------|
| Engine | TypeScript (纯，零依赖) |
| Renderer | 自研 `collectRenderables` + 可替换后端：Canvas2D · three.js(3D) · Ascii/SVG(无头)。**非 Phaser** |
| UI/HUD | `ui/components` LayoutNode → DOM（React 仅壳层/透视器） |
| Build | Vite 5 |
| Test | Vitest 2 |
