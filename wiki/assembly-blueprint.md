# Assembly 蓝图

## 什么是 Assembly

Assembly（组装蓝图）定义一个**可运行的游戏世界**：

1. 需要加载哪些 Atom Skill
2. 有哪些 Entity
3. 每个 Entity 上有哪些 Component（及初始值）

## 结构

```typescript
interface WorldBlueprint {
  capabilities: CapabilityDefinition[];
  entities: Record<string, EntityBlueprint>;
}

interface EntityBlueprint {
  [componentType: string]: Omit<Component, 'type'>;
}
```

## 示例

```typescript
import { keyInputCapability } from '@atom-skills/key-input/index.js';
import { healthCapability } from '@atom-skills/health/index.js';
import { statusBarCapability } from '@atom-skills/status-bar/index.js';

export const demoBlueprint: WorldBlueprint = {
  capabilities: [keyInputCapability, healthCapability, statusBarCapability],

  entities: {
    hero: {
      Health: { current: 100, max: 100 },
      KeyboardListener: {},
      StatusBarSource: {
        sourceComponent: 'Health',
        label: 'HP',
        highColor: '#22c55e',
        midColor: '#eab308',
        lowColor: '#ef4444',
        lowThreshold: 0.3,
        midThreshold: 0.6,
      },
    },
  },
};
```

## 加载过程

```
Engine.load(blueprint)
  │
  ├─ 1. 遍历 capabilities → 注册所有 Systems 到 World
  │     └─ World 自动拓扑排序
  │
  ├─ 2. 遍历 entities → 创建 Entity
  │     └─ 遍历 components → addComponent (自动加 type 字段)
  │
  └─ 3. 就绪, 等待 start()
```

## 设计意图

- Assembly 是**声明式**的，不包含逻辑
- LLM 可以根据用户描述生成 Assembly
- Component Agent 引导用户填写 Entity 参数
- 编辑器可视化编辑 Assembly
