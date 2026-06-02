# Apollo Engine Wiki

> AI-native 游戏框架——用自然语言设计游戏，AI 组装逻辑，引擎驱动运行。

## 目录

- [架构总览](./architecture.md) — 五层架构、数据流、核心理念
- [Atom Skill 规范](./atom-skill-spec.md) — 什么是 Atom Skill、如何定义、文件结构
- [ECS 引擎核心](./ecs-engine.md) — World、Component、System、拓扑排序
- [组件语义词汇表](./component-vocabulary.md) — 6 种语义类型及接口约定
- [Assembly 蓝图](./assembly-blueprint.md) — 如何组装 Atom Skill 和 Entity
- [UI 层约定](./ui-layer.md) — Template / Binding 分离、React overlay 模式

## 快速上手

```bash
npm install
npm run dev        # 启动开发服务器
# 打开浏览器 → 按 ↑/W 加血, ↓/S 减血
```

## 核心理念

1. **Atom Skill 是最小可组合单元** — 每个 skill 独立目录、独立文档、独立系统
2. **自描述优先** — `defineCapability()` 一个文件服务四个消费者（引擎、LLM、Agent、编辑器）
3. **数据驱动排序** — System 的 reads/writes/consumes 声明决定执行顺序，无需手动排
4. **表现与逻辑分离** — ECS 不知道 Phaser/React 的存在，渲染层只读 ECS 数据
