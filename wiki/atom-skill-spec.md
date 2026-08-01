# Atom Skill 规范

## 什么是 Atom Skill

Atom Skill 是 ZeroCraft Preview 的**最小可组合逻辑单元**。

每个 Atom Skill：
- 独立一个目录
- 有自己的 README 文档
- 通过 `defineCapability()` 定义
- 包含**自描述信息** (describe) + **数据合约** (components) + **配置参数** (config) + **系统逻辑** (systems)

## 目录结构

```
src/atom-skills/
├── <skill-name>/
│   ├── README.md       ← 人类可读文档：功能、数据流、组件表、配置表、依赖关系
│   └── index.ts        ← defineCapability() + 组件接口定义 + System 实现
```

## defineCapability() 结构

```typescript
export const mySkillCapability = defineCapability({
  // 唯一标识
  id: 'my-skill',
  version: '0.1.0',

  // ① LLM / Agent 读这里理解能力
  describe: {
    name: '技能名称',
    summary: '一句话说明做什么',
    semantic: ['标签1', '标签2'],        // 语义标签
    whenToUse: '什么时候该用这个',
    examples: ['适用场景1', '适用场景2'],
  },

  // ② 数据合约 (引擎 + LLM 都读)
  components: {
    provides: {                            // 我定义的组件 + 完整 Schema
      MyComponent: {
        category: 'resource',              // resource | event | intent | marker | config | render
        describe: '这个组件做什么',
        fields: {
          fieldName: { type: 'number', describe: '字段说明' },
        },
      },
    },
    reads:     ['SomeOtherComponent'],   // 我读取的 (组件名)
    writes:    ['MyComponent'],          // 我写入的
    consumes:  ['SomeEvent'],            // 我读后删除的 (一次性事件)
  },

  // ③ 可调参数 (Agent 据此提问, 编辑器据此渲染控件)
  config: {
    paramName: {
      type: 'number',                   // number | string | boolean | select
      default: 42,
      describe: 'LLM 读的参数描述',
      question: 'Agent 问用户的原话？',
      ui: {
        control: 'slider',              // slider | toggle | chips | input
        min: 0, max: 100, step: 1,
      },
    },
  },

  // ④ System 逻辑
  systems: [
    {
      id: 'my-skill.process',
      reads: ['SomeOtherComponent'],
      writes: ['MyComponent'],
      consumes: ['SomeEvent'],
      execute(world) {
        // 实际逻辑
      },
    },
  ],
});
```

## 四个消费者

同一个 `defineCapability()` 定义服务四个消费者：

| 消费者 | 读取什么 |
|--------|---------|
| **引擎** | `systems[].execute()` — 运行时执行逻辑 |
| **LLM** | `describe` + `components` — 理解能力做什么、读写哪些数据 |
| **Component Agent** | `config[].question` — 向用户提问填参 |
| **编辑器 UI** | `config[].ui` — 渲染 slider/toggle/chips 控件 |

## README 模板

每个 Atom Skill 的 README 应包含：

1. **ID 和语义类型**
2. **功能描述** — 用自然语言说明做什么
3. **数据流图** — ASCII 描述 input → system → output
4. **组件表** — 列出所有组件、语义类型、字段说明
5. **配置表** — 可调参数、类型、默认值
6. **依赖关系** — 读取谁、被谁消费
7. **复用场景** (如适用) — 说明如何用于不同场景

## 命名约定

- 目录名：`kebab-case`，动词或名词（如 `key-input`, `status-bar`, `health`）
- Capability ID：与目录名一致
- System ID：`<skill-id>.<action>`（如 `health.apply`, `status-bar.sync`）
- 组件名：`PascalCase`（如 `Health`, `StatusBarSource`, `BarDisplay`）

## 组合性保证

- 新增 Atom Skill **不修改已有 Skill 的代码**
- 通过 `reads/writes/consumes` 声明，引擎自动推导执行顺序
- 同一组件可被多个 Skill 读取，但只应由一个 Skill 写入（单一写入者原则）
