# UI 系统模块知识

> 覆盖：游戏 UI 架构、HUD、菜单、对话框、React 与 ECS 集成

## 核心原则

- 游戏 UI 和 ECS 是两个世界：ECS 管逻辑，UI 只做展示 + 收集输入。
- 数据流向：ECS → UI 单向投影（显示血量），UI → ECS 通过 Action 组件（玩家点了按钮）。
- 游戏 UI 不等于 Web UI — 游戏 UI 要 60fps 响应、视觉反馈即时、不能有布局抖动。

## 架构：React Overlay 模式

ZeroCraft 当前方案：Canvas 画游戏，React DOM 叠加在上方做 UI。

```
┌──────────────────────────┐
│  React DOM (z-index: 10) │  ← 血条、菜单、对话框
│  pointerEvents: none     │
├──────────────────────────┤
│  Canvas (z-index: 0)     │  ← 游戏世界渲染
└──────────────────────────┘
```

- 优点：React 的组件化/状态管理做 UI 很成熟。
- 缺点：DOM 更新和 Canvas 渲染不完全同步，可能有 1 帧延迟。
- UI 层默认 `pointerEvents: none`，需要交互的元素单独开 `pointerEvents: auto`。

## 数据桥接：useWorldVersion

```typescript
function useWorldVersion(engine: Engine): number {
  // 每 tick 递增的 version，触发 React 重渲染
  // UI 组件读 engine.world 的最新状态
}
```

- 不要用 useEffect + setInterval 轮询 — 用引擎 tick 驱动。
- 不要在 hook 里写 world — 只读。

## HUD（头显信息）

| 元素 | 数据来源 | 更新频率 |
|------|---------|---------|
| 血条 | Resource { id: 'hp' } | 受伤时 |
| 分数 | Resource { id: 'score' } | 得分时 |
| 小地图 | 所有实体 Transform | 每帧 |
| 技能冷却 | Timer { id: 'skill_cd' } | 每帧 |
| 帧率/调试 | engine.stats | 每帧 |

- 血条动画：当前值 lerp 到目标值，视觉上有"掉血"过渡。
- 低血量警告：current/max < 0.2 时血条变红 + 屏幕边缘泛红。

## 菜单系统

- 游戏状态机控制菜单显隐：State { fsmId: 'game', current: 'menu' | 'playing' | 'paused' }。
- 暂停菜单：engine.pause() 停止 tick，UI 层显示暂停界面。
- 菜单导航：键盘用方向键 + 确认键，触屏用点击。不要只支持鼠标。

## 对话框

- 打字机效果：每帧显示一个字符，用 Timer 控制速度。
- 选项分支：显示 2-4 个选项按钮，点击后写入 Action 组件。
- 跳过动画：点击/确认键立即显示全部文字。
- 立绘联动：对话时切换角色立绘表情（State 组件驱动）。

## 背包/物品栏

- 网格布局：固定 slot 数量，每个 slot 绑定一个实体的组件数据。
- 拖拽：HTML5 Drag and Drop 或自定义 pointer 事件。
- 排序/筛选：前端 UI 层做，不影响 ECS 数据顺序。

## 伤害数字（UI 层实现）

两种方案：
1. **ECS 实体方案**：spawn 带 Text + Velocity + Lifetime 的实体，渲染层画。
2. **纯 UI 方案**：React 组件接收 damage 事件，用 CSS animation 做飘字。

- 方案 1 确定性好（录像可重放），方案 2 视觉效果更丰富（CSS 缓动）。

## 响应式布局

- 游戏画布固定逻辑分辨率（640×400），CSS transform 缩放适配屏幕。
- UI 元素用百分比/viewport 单位定位，不用固定像素。
- 微信小游戏：用 `wx.getSystemInfoSync()` 获取安全区域，避开刘海/圆角。

## 常见陷阱

- React 重渲染过频：每 tick 更新所有 UI 组件很贵。用 `React.memo` + 浅比较，只更新变化的部分。
- 字体加载：自定义字体未加载完就渲染 → 文字闪烁。用 `document.fonts.ready` 等待。
- 触屏穿透：UI 按钮点击后事件穿透到 Canvas → 角色也动了。`stopPropagation`。
- 不要用 innerHTML 渲染玩家输入的文本 — XSS 风险。用 textContent 或 React 的自动转义。

## 前沿技术

- **CSS Houdini (Paint Worklet)**：用 JS 画自定义 CSS 背景，适合程序化 UI 装饰（能量条纹理、动态边框）。
- **View Transitions API**：场景切换时的原生过渡动画，替代手写 fade/slide。
- **Popover API**：原生弹出层管理，适合工具提示、物品详情浮窗。
- **anchor() CSS**：元素锚定定位，适合跟随游戏实体的 UI（血条浮在角色头上）。

## 参考来源

- ZeroCraft src/ui/GameOverlay.tsx — 当前 React Overlay 实现
- ZeroCraft src/ui/hooks/use-engine.ts — useWorldVersion 桥接 hook
- React 官方文档 — 组件化 UI 的最佳实践
