# 场景管理模块知识

> 覆盖：场景切换、关卡加载、游戏状态机、过渡动画

## 核心原则

- 游戏在宏观上是一个状态机：Loading → Menu → Playing → Paused → GameOver → Menu。
- 场景切换 = 清空当前 World + 加载新的 Assembly 蓝图。
- 过渡期间引擎必须有明确状态 — 不能在"半清空半加载"的状态下 tick。

## 游戏状态机

```
┌──────┐  start   ┌─────────┐  play   ┌─────────┐
│ Boot │────────→│  Menu   │───────→│ Playing │
└──────┘         └─────────┘        └────┬────┘
                      ↑                   │ pause
                      │ resume     ┌──────▼──────┐
                      └────────────│   Paused    │
                                   └─────────────┘
                 ┌─────────┐  retry  ┌───────────┐
                 │  Menu   │←────────│ Game Over │
                 └─────────┘         └───────────┘
```

- 每个状态对应一组行为：Playing 时 tick 运行，Paused 时 tick 暂停但 UI 响应。
- 状态切换通过 Engine 层 API：`engine.loadScene(blueprint)`, `engine.pause()`, `engine.resume()`。

## 场景加载流程

1. **触发**：玩家点"开始游戏" / 到达关卡出口 / 死亡后重试。
2. **过渡开始**：播放遮罩动画（黑幕淡入），禁止输入。
3. **卸载**：清空当前 World 所有实体和组件。
4. **加载**：执行新场景的 Assembly 蓝图，创建所有实体。
5. **初始化**：预热 System（空间索引重建、音频预加载）。
6. **过渡结束**：遮罩淡出，恢复输入，开始 tick。

## 关卡设计数据

- 关卡 = Assembly 蓝图 + 关卡特定配置（重力值、边界、敌人布局）。
- 数据驱动：关卡信息存在 JSON 里，不硬编码。

```typescript
interface LevelConfig {
  id: string;
  blueprint: AssemblyBlueprint;
  gravity: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  nextLevel: string | null;
}
```

- 关卡选择画面读取所有 LevelConfig 的元信息（名称、缩略图、是否解锁）。

## 过渡动画

| 类型 | 实现 | 适合场景 |
|------|------|---------|
| 黑幕淡入淡出 | CSS opacity 过渡 | 通用 |
| 圆形收缩（iris wipe） | Canvas clip path 动画 | 复古风 |
| 像素化溶解 | shader 或 Canvas 像素操作 | 像素游戏 |
| 滑入滑出 | CSS transform 或 Canvas 偏移 | 横版关卡 |

- 过渡动画在 UI 层做（React/CSS），不在 ECS 里 — 过渡时 ECS 已暂停。

## 场景栈（Scene Stack）

- 暂停菜单叠在游戏场景上面 — 游戏场景不卸载，只暂停。
- 场景栈：`[Playing, PauseMenu]`，顶层接收输入，底层只渲染不 tick。
- 弹栈：关闭暂停菜单 → 恢复 Playing 的 tick。
- 适合：暂停、背包、商店等不需要卸载主场景的叠加界面。

## 持久实体

- 场景切换时某些实体不销毁：玩家角色、全局音乐、分数。
- 标记方式：给持久实体加 Tag.flags 的 persistent 位。
- 场景卸载时跳过 persistent 实体。

## 常见陷阱

- 场景切换时忘记清理事件监听（keyboard listener、timer）→ 内存泄漏。
- 异步加载资源时玩家快速切场景 → 旧场景的资源回调写入新场景。用 abort controller。
- 关卡数据直接存在代码里 → 不可热更新。存 JSON，运行时 fetch。
- 过渡动画期间允许输入 → 玩家在加载中触发了操作。过渡期间禁止输入。

## 前沿技术

- **View Transitions API**：浏览器原生页面过渡，可用于菜单 ↔ 游戏的切换动画。
- **OffscreenCanvas**：在 Worker 线程预渲染下一关的首帧，加载完成时无缝切换。
- **Streaming Assembly**：大关卡分块加载，先加载可见区域，玩家移动时加载新区域。

## 参考来源

- Unity SceneManager — 场景加载/卸载的行业标准 API 设计
- Godot SceneTree — 场景栈 + 节点持久化的参考实现
- ZeroCraft runtime/engine.ts — 当前 start/stop/load 接口
