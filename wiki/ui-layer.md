# UI 层约定

## 分层渲染

```html
<div id="app" style="position: relative;">
  <!-- Phaser Canvas (底层, z-index: 0) -->
  <canvas />

  <!-- React UI Overlay (顶层, z-index: 10, 透明背景) -->
  <div style="pointer-events: none;">
    <GameOverlay />
  </div>
</div>
```

- Phaser 负责精灵、动画、背景
- React 负责 UI 控件（血条、按钮、菜单、文字）
- React 覆盖在 Phaser 之上，背景透明，`pointer-events: none` 默认不拦截点击

## Template / Binding 分离

### Template (不知道游戏是什么)

纯 UI 组件，只接收通用数据，不导入任何 ECS 类型。

```typescript
// Bar.tsx — 通用进度条
interface BarProps {
  current: number;
  max: number;
  color: string;
  label?: string;
}
```

Templates 可以复用于任何游戏。

### Binding (知道 ECS Component)

连接 ECS 数据到 Template 的胶水层。

```typescript
// 把 BarDisplay 组件的数据 → 传给 <Bar /> 模板
const barDisplay = useComponent<BarDisplay>(engine, 'hero', 'BarDisplay');
<Bar current={barDisplay.current} max={barDisplay.max} color={barDisplay.color} />
```

Binding 是游戏特定的。

## React Hooks

### useEngine(blueprint)

创建 Engine，加载蓝图，启动 game loop。

```typescript
const engine = useEngine(demoBlueprint);
```

### useWorldVersion(engine)

订阅 World 的 version 变化，每 tick 触发 React re-render。

```typescript
const version = useWorldVersion(engine);
```

### useComponent<T>(engine, entityId, type)

读取指定 Entity 上的组件数据。version 变化时自动更新。

```typescript
const health = useComponent<Health>(engine, 'hero', 'Health');
```

## 设计原则

1. **ECS 不知道 React 的存在** — Engine 层零 UI 依赖
2. **React 只读 ECS 数据** — 不直接修改组件，通过 dispatch 发送 Intent
3. **Template 可独立测试** — 传 props 即可渲染，不需要 Engine
4. **Binding 是唯一耦合点** — 游戏换了组件只改 Binding，Template 不变
