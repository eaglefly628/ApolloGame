# 序列化与存档模块知识

> 覆盖：存档/读档、状态快照、JSON 序列化、schema 版本迁移

## 核心原则

- 游戏存档 = World 的完整快照：所有实体 + 所有组件的当前值。
- 序列化只存数据（Component），不存逻辑（System）— System 由 Assembly 蓝图恢复。
- 存档格式必须有版本号 — 游戏更新后旧存档要能迁移。

## 序列化策略

### JSON 序列化（当前推荐）
- 优点：可读、可调试、前端原生支持。
- 缺点：体积大、解析慢。
- ZeroCraft 组件都是 plain object，`JSON.stringify` 直接可用。
- 注意：EntityId 如果是 number 需确保 JSON 不丢精度。

### 结构化克隆（structuredClone）
- 浏览器原生深拷贝，支持 Map/Set/ArrayBuffer。
- 适合内存快照（undo/redo、确定性回放的 checkpoint）。
- 不能持久化到文件 — 只用于运行时。

### 二进制序列化（进阶）
- MessagePack / Protocol Buffers / FlatBuffers。
- 体积小 3-5 倍，解析快 10 倍+。
- 适合：存档大（RPG/策略）、网络传输（减少带宽）。
- FlatBuffers 零拷贝读取 — 适合超大存档。

## 存档结构

```
{
  version: 2,                    // schema 版本
  timestamp: 1717400000,
  world: {
    tick: 12345,
    seed: { seed: 42, sequence: 789 },
    entities: [
      { id: 1, components: [ { type: 'Transform', x: 100, y: 200, ... }, ... ] },
      ...
    ]
  }
}
```

## Schema 版本迁移

- 每个版本写一个迁移函数：`migrate_v1_to_v2(save)`。
- 链式迁移：v1 → v2 → v3，每步只处理一个版本差。
- 新增组件：迁移时补默认值。删除组件：迁移时忽略。字段改名：迁移时映射。
- 永远不要删除迁移函数 — 玩家可能拿着 v1 的存档回来。

## 存档槽位

- 多存档：save_1.json, save_2.json, auto_save.json。
- 自动存档：每 N 个周期/场景切换时自动保存。
- 存档预览：存档文件里带一份摘要（角色名、进度、时间戳）用于 UI 列表展示。

## Web 环境持久化

| 方案 | 容量 | 特点 |
|------|------|------|
| localStorage | 5-10 MB | 同步、最简单、阻塞主线程 |
| IndexedDB | 数百 MB+ | 异步、支持二进制、需要封装 |
| File System Access API | 无限制 | 用户选择文件、桌面端体验 |
| Cloud Save | 取决于后端 | 跨设备同步、需要登录 |

- 微信小游戏：用 `wx.setStorage` / `wx.getStorage`，上限 10MB。
- 建议：小存档用 localStorage，大存档用 IndexedDB。

## 确定性回放存档

- 不存 World 快照，只存初始状态 + 每 tick 的输入序列。
- 回放时重跑所有 tick — 存档极小，但加载慢（要重跑）。
- 适合：格斗/竞技游戏的录像系统。
- ZeroCraft 的 debug/recorder.ts 已有此模式的基础实现。

## 常见陷阱

- 循环引用：Entity A 的 Relation 指向 B，B 指向 A。JSON.stringify 会崩。用 EntityId 引用，不要存对象引用。
- 存档时机：不要在 tick 中间存 — 只在 tick 结束时存，保证状态一致。
- localStorage 是同步的：大存档会冻结 UI。超过 1MB 就该用 IndexedDB。
- 敏感数据：不要把服务端校验的数值（充值货币）存在客户端 — 会被篡改。

## 前沿技术

- **Automerge / Yjs**：CRDT 库，支持多端协同编辑同一份存档（联机存档同步）。
- **SQLite on WASM (sql.js)**：在浏览器里跑 SQLite，适合复杂查询的存档（RPG 的背包/任务系统）。
- **Incremental snapshot**：只存变化的组件，不存完整世界。适合实时自动存档。

## 参考来源

- ZeroCraft debug/recorder.ts — 确定性回放录制的现有实现
- FlatBuffers — Google 的零拷贝序列化，适合大存档
- IndexedDB API — 浏览器端大容量异步存储
