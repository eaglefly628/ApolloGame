# 架构总览

> ⚠ **历史文档（口径已过期）**：原子数/能力数/游戏清单/测试数以机读真相为准（`docs/llm-onboarding.md` §0）。本文仅存考古价值，新 session/新 LLM 勿以此为教材。

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
| Renderer | Phaser 3 |
| UI | React 18 |
| Build | Vite 5 |
| Test | Vitest 2 |
