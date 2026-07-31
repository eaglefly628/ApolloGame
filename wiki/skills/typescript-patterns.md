# TypeScript 模式知识

> 覆盖：游戏开发中的 TS 类型模式、性能注意、工具链

## 核心原则

- TypeScript 的类型系统是编译时的 — 运行时零开销，放心用复杂类型。
- 游戏热路径（tick 循环）里避免产生垃圾对象 — TS 不改变 JS 的 GC 行为。
- 类型是文档：好的类型定义比注释更准确，且编译器强制执行。

## 判别联合（Discriminated Union）

ZeroCraft 组件的核心模式：用 `type` 字段区分组件种类。

```typescript
// 每个 Component 用 readonly type 做判别符
interface Transform extends Component { readonly type: 'Transform'; x: number; y: number; }
interface Velocity extends Component { readonly type: 'Velocity'; vx: number; vy: number; }
type AnyComponent = Transform | Velocity | ...;

// 类型守卫自动收窄
function handle(c: AnyComponent) {
  if (c.type === 'Transform') { /* c 自动是 Transform */ }
}
```

## Branded Type（品牌类型）

给原始类型加标签，防止混用：

```typescript
type EntityId = number & { readonly __brand: 'EntityId' };
type Tick = number & { readonly __brand: 'Tick' };
// EntityId 和 Tick 都是 number，但不能互相赋值
```

- ZeroCraft 的 EntityId 用此模式，防止把 tick 编号误当实体 ID。

## 泛型组件查询

```typescript
function getComponent<T extends Component>(entity: Entity, type: T['type']): T | undefined;
// 调用时自动推断返回类型
const t = getComponent<Transform>(e, 'Transform'); // t: Transform | undefined
```

## const 断言与字面量类型

```typescript
const KEYMAP = { ArrowUp: 'jump', ArrowLeft: 'left' } as const;
// typeof KEYMAP = { readonly ArrowUp: 'jump'; readonly ArrowLeft: 'left' }
// 值的类型是字面量 'jump' | 'left'，不是宽泛的 string
```

- Assembly 蓝图中的配置用 `as const` 锁定，防止手滑改错值。

## 类型守卫（Type Guard）

```typescript
function isTransform(c: Component): c is Transform {
  return c.type === 'Transform';
}
// 过滤数组时自动收窄类型
const transforms = components.filter(isTransform); // Transform[]
```

## Readonly 与 Immutability

- 组件的 `type` 字段用 `readonly` — 防止运行时修改判别符。
- 配置型组件整体用 `Readonly<T>` — 编译时阻止意外修改。
- 注意：Readonly 是浅层的。深层不可变用 `DeepReadonly` 或运行时 `Object.freeze`。

## 性能相关 TS 模式

### 避免热路径中创建对象
```typescript
// ❌ 每 tick 创建新对象
function getVelocity(): { vx: number; vy: number } { return { vx: 1, vy: 2 }; }

// ✅ 复用预分配对象
const _tempVec = { vx: 0, vy: 0 };
function getVelocity(): { vx: number; vy: number } { _tempVec.vx = 1; _tempVec.vy = 2; return _tempVec; }
```

### 数组预分配
```typescript
// ❌ 动态 push
const results: Entity[] = [];
for (...) results.push(e);

// ✅ 已知上限时预分配
const results = new Array<Entity>(maxCount);
let count = 0;
for (...) results[count++] = e;
```

### Map vs Object
- 键是动态字符串/数字 → 用 `Map`（哈希性能好、有 size、迭代顺序确定）。
- 键是固定字符串集合 → 用 plain object（V8 隐藏类优化）。
- ZeroCraft 的 World 用 `Map<EntityId, Map<string, Component>>` — 正确选择。

## 工具链

| 工具 | 用途 | ZeroCraft 配置 |
|------|------|------------|
| **tsc** | 类型检查 | `tsc --noEmit`，只做检查不输出 |
| **Vite** | 开发/构建 | esbuild 转译 TS（不做类型检查，快） |
| **vitest** | 测试 | 原生 TS 支持，不需要额外配置 |
| **tsconfig paths** | 路径别名 | `@renderer/*`, `@net/*` 等别名 |

## 严格模式检查清单

确保 tsconfig.json 开启：
- `strict: true` — 包含以下所有
- `noUncheckedIndexedAccess` — 数组/Map 取值可能 undefined
- `exactOptionalProperties` — 可选属性不能显式赋 undefined
- `noUnusedLocals` / `noUnusedParameters` — 清除死代码

## 常见陷阱

- `as` 类型断言不是类型转换 — 它骗编译器，运行时不做任何事。滥用 `as` 等于关类型安全。
- enum 编译出的 JS 很丑且有运行时开销 — 用 `as const` 对象 + 字面量联合代替。
- 接口（interface）可以被扩展/合并，类型别名（type）不行 — 组件定义用 interface。
- `!` 非空断言隐藏 bug — 尽量用条件检查或 optional chaining。

## 前沿技术

- **TypeScript 5.x 装饰器**：stage 3 标准装饰器，可用于 System 注册（`@system('motion-apply')`）。
- **using 声明 (Explicit Resource Management)**：TS 5.2+，自动释放资源，适合渲染上下文/音频上下文管理。
- **satisfies 运算符**：检查类型但保留窄类型推断，适合 Assembly 蓝图配置验证。

## 参考来源

- ZeroCraft src/engine/core/types.ts — EntityId branded type、Component 判别联合
- ZeroCraft src/engine/protocol/components.ts — 26 个组件接口的 TS 模式
- TypeScript Handbook — 官方判别联合与类型守卫文档
