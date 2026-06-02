# Apollo Engine — Technical Design Document v1

> **目标**：用自然语言描述 → AI 组装游戏逻辑 → Phaser 渲染画面 → 可玩游戏
>
> **MVP 验收**：一个 Phaser 渲染的回合制战斗 Demo，4 个自描述 Capability 端到端运行

---

## 1. 系统全景

```
┌─ Editor Layer (Phase 3) ─────────────────────────────────────┐
│  Component Agent (AI 对话)  │  Visual Node Editor  │  Params │
├─ Presentation Layer ─────────────────────────────────────────┤
│  ┌─ UI Overlay (React DOM) ────┐  ┌─ Game Canvas (Phaser) ─┐│
│  │ 血条, 按钮, 回合提示, 飘字  │  │ 精灵, 动画, 特效, 背景 ││
│  └─────────────────────────────┘  └─────────────────────────┘│
├─ Renderer Bridge ────────────────────────────────────────────┤
│  ECS Component ←→ Phaser DisplayObject 单向同步              │
│  Transform → sprite.position                                 │
│  AnimState → sprite.play('attack')                           │
│  VisualEffect → camera.shake() / sprite.flash()              │
├─ Engine Layer (纯 TS, 零外部依赖) ───────────────────────────┤
│  World │ Systems (拓扑排序) │ Capabilities │ Manifests       │
├─ Protocol Layer ─────────────────────────────────────────────┤
│  Component Vocabulary (Resource / Event / Intent / Render / Marker / Config) │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 目录结构

```
apollo/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html                        # 入口 HTML
│
├── src/
│   ├── engine/                       # ★ 零外部依赖，纯 TypeScript
│   │   ├── core/
│   │   │   ├── types.ts              #   EntityId, Component, IWorld, SystemDeclaration
│   │   │   ├── world.ts              #   World 类 (ECS 存储 + 拓扑排序 + tick)
│   │   │   └── define-capability.ts  #   defineCapability() 工厂函数
│   │   │
│   │   ├── protocol/
│   │   │   ├── components.ts         #   Component 语义词汇表 (全部类型定义)
│   │   │   └── manifest.ts           #   CapabilityManifest / LogicCapability 类型
│   │   │
│   │   ├── capabilities/
│   │   │   ├── health.cap.ts         #   生命值 — 自描述 Capability
│   │   │   ├── combat.cap.ts         #   战斗/伤害 — 自描述 Capability
│   │   │   ├── turn.cap.ts           #   回合制 — 自描述 Capability
│   │   │   └── render-bridge.cap.ts  #   渲染桥接 — 自描述 Capability
│   │   │
│   │   └── registry/
│   │       └── build-registry.ts     #   扫描所有 Capability → 生成 registry.json
│   │
│   ├── renderer/                     # ★ Phaser 渲染后端
│   │   ├── phaser-backend.ts         #   RendererBackend 接口 + Phaser 实现
│   │   ├── sprite-sync.ts            #   ECS Sprite/Transform → Phaser Sprite 同步
│   │   ├── anim-sync.ts              #   ECS AnimationState → Phaser Animation 同步
│   │   ├── effect-sync.ts            #   ECS VisualEffect → Phaser Tween/Camera 同步
│   │   └── asset-manifest.ts         #   素材清单 (texture keys → file paths)
│   │
│   ├── ui/                           # ★ React UI Overlay
│   │   ├── hooks/
│   │   │   ├── use-engine.ts         #   创建 Engine, 驱动 tick, 触发 React re-render
│   │   │   └── use-component.ts      #   useComponent<Health>(entityId, 'Health')
│   │   ├── templates/
│   │   │   ├── Bar.tsx               #   通用进度条 (不知道 HP/MP, 只画 current/max)
│   │   │   ├── ActionButton.tsx      #   通用按钮 (label, icon, onClick, disabled)
│   │   │   └── TextBanner.tsx        #   文字横幅 (回合提示, 战斗日志)
│   │   ├── bindings/
│   │   │   ├── HealthBinding.tsx     #   Health → Bar
│   │   │   ├── AttackBinding.tsx     #   onClick → dispatch(AttackIntent)
│   │   │   └── TurnBinding.tsx       #   TurnState → TextBanner
│   │   └── GameOverlay.tsx           #   组合所有 Binding 的顶层组件
│   │
│   ├── assembly/
│   │   └── demo.world.ts            #   万象竞技场 Demo 蓝图
│   │
│   ├── runtime/
│   │   └── engine.ts                 #   Engine 类: load(blueprint) + start() + stop()
│   │
│   └── main.tsx                      #   入口: 创建 Engine + 挂载 React
│
├── public/
│   └── assets/                       # 素材 (Kenney.nl 免费像素素材)
│       ├── hero-idle.png
│       ├── hero-attack.png
│       ├── dragon-idle.png
│       ├── dragon-hit.png
│       └── arena-bg.png
│
├── .apollo/
│   └── registry.json                 # 构建产物: 所有 Capability 的描述索引 (LLM 读这个)
│
└── tests/
    ├── engine/
    │   ├── world.test.ts             # World 类单元测试
    │   └── topo-sort.test.ts         # 拓扑排序测试
    └── capabilities/
        ├── health.test.ts            # Health 无头测试
        └── combat.test.ts            # Combat 无头测试
```

---

## 3. Engine Core 设计

### 3.1 核心类型 (`engine/core/types.ts`)

```typescript
export type EntityId = string;
export type ComponentType = string;

// ─── Component 基础接口 ───
export interface Component {
  readonly type: ComponentType;
}

// ─── System 声明 (拓扑排序的依据) ───
export interface SystemDeclaration {
  readonly id: string;
  readonly reads: ComponentType[];
  readonly writes: ComponentType[];
  readonly consumes: ComponentType[];    // 读完后删除 (一次性事件)
  execute(world: IWorld): void;
}

// ─── World 公开接口 ───
export interface IWorld {
  // Entity 操作
  createEntity(id: EntityId): void;
  destroyEntity(id: EntityId): void;
  getAllEntities(): EntityId[];

  // Component 操作
  addComponent(entityId: EntityId, component: Component): void;
  removeComponent(entityId: EntityId, type: ComponentType): void;
  getComponent<T extends Component>(entityId: EntityId, type: ComponentType): T | undefined;
  hasComponent(entityId: EntityId, type: ComponentType): boolean;

  // 查询
  query(...types: ComponentType[]): Array<[EntityId, Map<ComponentType, Component>]>;

  // 外部输入
  dispatch(component: Component & { entityId: EntityId }): void;
}

// ─── 渲染后端接口 ───
export interface RendererBackend {
  init(container: HTMLElement): void;
  sync(world: IWorld): void;
  destroy(): void;
}
```

### 3.2 World 类 (`engine/core/world.ts`)

```
World
├── entities: Map<EntityId, Map<ComponentType, Component>>
├── systems: SystemDeclaration[]          ← 注册后自动拓扑排序
├── pendingDispatches: DispatchEntry[]    ← 外部输入队列
├── version: number                       ← 每 tick +1, 触发 React re-render
│
├── addSystem(system): void               ← 加入后重新排序
├── tick(): void                          ← apply dispatches → run systems → version++
└── toposort(): void                      ← Kahn's algorithm, 按 reads/writes 推导顺序
```

**拓扑排序规则：**
- System A `writes` ComponentX，System B `reads` ComponentX → A 排在 B 前面
- System A `consumes` ComponentX → A 排在所有 `reads` ComponentX 的 System 后面
- 循环依赖 → 抛错，阻止加载

### 3.3 自描述 Capability (`engine/core/define-capability.ts`)

```typescript
export interface CapabilityDefinition {
  id: string;
  version: string;

  // ① LLM 读这块来理解能力
  describe: {
    summary: string;            // 一句话说明
    semantic: string[];         // 语义标签: ['resource', 'health']
    whenToUse: string;          // 什么时候该用这个 Capability
    examples: string[];         // 适用实体示例
  };

  // ② 数据合约 (引擎 + LLM 都读)
  components: {
    provides: ComponentType[];  // 我定义的 Component 类型
    reads: ComponentType[];     // 我读取的
    writes: ComponentType[];    // 我写入的
    consumes: ComponentType[];  // 我读后删除的
  };

  // ③ 可调参数 (Component Agent 据此提问, 编辑器据此渲染控件)
  config: Record<string, {
    type: 'number' | 'string' | 'boolean' | 'select';
    default: unknown;
    describe: string;           // LLM 读的描述
    question: string;           // Agent 问用户的原话
    ui: {
      control: 'slider' | 'toggle' | 'chips' | 'input';
      min?: number;
      max?: number;
      options?: string[];
    };
  }>;

  // ④ System 逻辑
  systems: SystemDeclaration[];
}

export function defineCapability(def: CapabilityDefinition): CapabilityDefinition {
  return Object.freeze(def);
}
```

---

## 4. Component 语义词汇表 (`engine/protocol/components.ts`)

### 4.1 Resource (有 current/max 的数值)

```typescript
interface Health extends Component {
  type: 'Health';
  current: number;
  max: number;
}

interface Shield extends Component {
  type: 'Shield';
  current: number;
  max: number;
}
```

### 4.2 Event (一次性, 被 consume 后消失)

```typescript
interface DamageEvent extends Component {
  type: 'DamageEvent';
  amount: number;
  damageType: 'physical' | 'magical';
  source: EntityId;
}

interface HealEvent extends Component {
  type: 'HealEvent';
  amount: number;
  source: EntityId;
}
```

### 4.3 Intent (从外部输入, 被 System 转化为 Event)

```typescript
interface AttackIntent extends Component {
  type: 'AttackIntent';
  target: EntityId;
}

interface DefendIntent extends Component {
  type: 'DefendIntent';
}
```

### 4.4 Marker (存在即有意义)

```typescript
interface Dead extends Component { type: 'Dead'; }
interface Defending extends Component { type: 'Defending'; }
interface CurrentTurn extends Component { type: 'CurrentTurn'; }
```

### 4.5 Config (长期存在, 描述实体属性)

```typescript
interface CombatStats extends Component {
  type: 'CombatStats';
  attack: number;
  defense: number;
}

interface TurnOrder extends Component {
  type: 'TurnOrder';
  order: number;   // 0 = 先手
}
```

### 4.6 Render (驱动 Phaser 渲染)

```typescript
interface Sprite extends Component {
  type: 'Sprite';
  textureKey: string;       // Phaser texture key
  anchorX: number;
  anchorY: number;
}

interface Transform extends Component {
  type: 'Transform';
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

interface AnimationState extends Component {
  type: 'AnimationState';
  current: string;          // 'idle' | 'attack' | 'hit' | 'die'
  loop: boolean;
  speed: number;
}

interface VisualEffect extends Component {
  type: 'VisualEffect';
  effect: 'shake' | 'flash' | 'tint';
  duration: number;
  intensity: number;
}
```

---

## 5. Capability 详细设计

### 5.1 health.cap.ts

```
defineCapability({
  id: 'health',
  describe: { summary: '生命值系统。处理伤害/治疗事件，管理 current/max。' },
  components: {
    provides:  ['Health'],
    reads:     ['DamageEvent', 'HealEvent'],
    writes:    ['Health'],
    consumes:  ['DamageEvent', 'HealEvent'],
  },
  config: {
    maxHealth: { question: '最大生命值？', ui: { control: 'slider', min: 10, max: 2000 } }
  },
  systems: [
    {
      id: 'health.apply',
      reads: ['Health', 'DamageEvent', 'HealEvent'],
      writes: ['Health', 'Dead'],
      consumes: ['DamageEvent', 'HealEvent'],
      execute(world) {
        // 1. 处理 DamageEvent → Health.current -= amount
        // 2. 处理 HealEvent  → Health.current += amount (cap at max)
        // 3. Health.current <= 0 → 挂 Dead marker
      }
    }
  ]
})
```

### 5.2 combat.cap.ts

```
defineCapability({
  id: 'combat',
  describe: { summary: '战斗系统。将 AttackIntent 转化为 DamageEvent。' },
  components: {
    provides:  ['DamageEvent', 'CombatStats', 'AttackIntent'],
    reads:     ['AttackIntent', 'CombatStats', 'Defending'],
    writes:    ['DamageEvent'],
    consumes:  ['AttackIntent'],
  },
  config: {
    baseAttack:  { question: '基础攻击力？', ui: { control: 'slider', min: 5, max: 100 } },
    baseDefense: { question: '基础防御力？', ui: { control: 'slider', min: 0, max: 50 } }
  },
  systems: [
    {
      id: 'combat.resolve',
      reads: ['AttackIntent', 'CombatStats', 'Defending'],
      writes: ['DamageEvent'],
      consumes: ['AttackIntent'],
      execute(world) {
        // 1. 找有 AttackIntent 的实体
        // 2. 读攻击者 CombatStats.attack
        // 3. 读目标 CombatStats.defense + Defending 状态
        // 4. damage = attack - defense * (defending ? 2 : 1)
        // 5. 在目标实体上挂 DamageEvent
        // 6. 删攻击者的 AttackIntent
      }
    }
  ]
})
```

### 5.3 turn.cap.ts

```
defineCapability({
  id: 'turn',
  describe: { summary: '回合制系统。管理行动顺序和 AI 决策。' },
  components: {
    provides:  ['TurnState', 'CurrentTurn', 'TurnOrder'],
    reads:     ['Dead', 'Health', 'CombatStats'],
    writes:    ['TurnState', 'CurrentTurn', 'AttackIntent', 'DefendIntent'],
    consumes:  [],
  },
  config: {
    firstTurn:  { question: '谁先手？', ui: { control: 'chips', options: ['玩家', 'Boss', '随机'] } },
    aiStrategy: { question: 'Boss 策略？', ui: { control: 'chips', options: ['纯攻击', '攻防混合'] } }
  },
  systems: [
    {
      id: 'turn.advance',
      reads: ['TurnState', 'CurrentTurn', 'TurnOrder', 'Dead'],
      writes: ['TurnState', 'CurrentTurn'],
      consumes: [],
      execute(world) {
        // 当没有 AttackIntent/DefendIntent 待处理时:
        // 1. 移除当前实体的 CurrentTurn
        // 2. 找下一个存活实体 (按 TurnOrder)
        // 3. 挂 CurrentTurn marker
        // 4. TurnState.round++ (如果轮完一圈)
      }
    },
    {
      id: 'turn.ai-decision',
      reads: ['CurrentTurn', 'CombatStats', 'Health'],
      writes: ['AttackIntent', 'DefendIntent'],
      consumes: [],
      execute(world) {
        // 如果 CurrentTurn 实体有 AIController:
        // 按策略决定 AttackIntent 或 DefendIntent
      }
    }
  ]
})
```

### 5.4 render-bridge.cap.ts

```
defineCapability({
  id: 'render-bridge',
  describe: { summary: '渲染桥接。读取游戏状态，写入渲染指令。' },
  components: {
    provides:  ['AnimationState', 'VisualEffect'],
    reads:     ['Health', 'Dead', 'DamageEvent', 'AttackIntent',
                'DefendIntent', 'CurrentTurn', 'CombatStats'],
    writes:    ['AnimationState', 'VisualEffect'],
    consumes:  [],
  },
  systems: [
    {
      id: 'render-bridge.sync',
      reads: ['Health', 'Dead', 'DamageEvent', 'AttackIntent', 'Defending', 'CurrentTurn'],
      writes: ['AnimationState', 'VisualEffect'],
      consumes: [],
      execute(world) {
        // 状态 → 动画映射:
        //   AttackIntent 存在     → AnimationState.current = 'attack'
        //   DamageEvent 存在      → AnimationState.current = 'hit'
        //                           VisualEffect = { effect: 'shake' }
        //   Dead                  → AnimationState.current = 'die'
        //   Defending             → AnimationState.current = 'defend'
        //   默认                  → AnimationState.current = 'idle'
        //
        //   Health < 30%          → VisualEffect = { effect: 'tint', red }
      }
    }
  ]
})
```

---

## 6. 拓扑排序结果

引擎自动推导的 System 执行顺序：

```
tick()
  │
  ├─ 1. turn.advance          writes: [CurrentTurn, TurnState]
  ├─ 2. turn.ai-decision      writes: [AttackIntent, DefendIntent]  reads: [CurrentTurn]
  │                                    ↑ 依赖 CurrentTurn → 排在 turn.advance 后面
  ├─ 3. combat.resolve         reads: [AttackIntent]  writes: [DamageEvent]
  │                                    ↑ 依赖 AttackIntent → 排在 turn.ai-decision 后面
  ├─ 4. health.apply           reads: [DamageEvent]  writes: [Health, Dead]
  │                                    ↑ 依赖 DamageEvent → 排在 combat.resolve 后面
  └─ 5. render-bridge.sync     reads: [Health, Dead, DamageEvent, ...]
                                       ↑ 依赖 Health, Dead → 排在最后
```

**新增 Shield Capability 时：**
- `shield.absorb`: reads [DamageEvent, Shield], writes [DamageEvent, Shield]
- 自动插入到 `combat.resolve` 和 `health.apply` 之间
- **零改动已有代码**

---

## 7. Renderer Bridge 设计 (`renderer/phaser-backend.ts`)

### 7.1 接口

```typescript
interface RendererBackend {
  init(container: HTMLElement): void;
  sync(world: IWorld): void;           // 每帧调用, ECS → Phaser 同步
  destroy(): void;
  getCanvas(): HTMLCanvasElement;       // 给 React overlay 定位用
}
```

### 7.2 Phaser 实现

```
PhaserBackend
├── game: Phaser.Game
├── scene: BattleScene (唯一 Scene)
├── sprites: Map<EntityId, Phaser.GameObjects.Sprite>
├── tweens: Map<EntityId, Phaser.Tweens.Tween>
│
├── init(container)
│   └── 创建 Phaser.Game, 挂到 container
│
├── sync(world)
│   ├── 遍历 world.query('Sprite', 'Transform')
│   │   └── 创建/更新 Phaser Sprite 的 position, scale, rotation
│   ├── 遍历 world.query('AnimationState')
│   │   └── sprite.play(anim.current) if changed
│   ├── 遍历 world.query('VisualEffect')
│   │   └── 触发 Phaser tween: shake / flash / tint
│   └── 清理: 已销毁 Entity 的 Sprite 移除
│
└── destroy()
    └── game.destroy()
```

### 7.3 Phaser 的使用边界

```
我们用 Phaser 的:
  ✓ Sprite / Image 显示
  ✓ Animation 播放 (sprite sheet)
  ✓ Tween 系统 (抖动, 闪烁, 缩放)
  ✓ Camera (背景滚动, 震屏)
  ✓ Loader (加载素材)

我们不用 Phaser 的:
  ✗ Scene 管理 (只用一个 Scene)
  ✗ Physics (回合制不需要)
  ✗ Input (React 处理)
  ✗ GameObject 逻辑 (ECS 处理)
  ✗ Timer/Event (ECS 处理)
```

---

## 8. React UI Overlay 设计

### 8.1 分层渲染

```html
<div id="app" style="position: relative;">
  <!-- Phaser Canvas (底层) -->
  <canvas id="phaser-canvas" style="position: absolute; z-index: 0;" />

  <!-- React UI Overlay (顶层, 透明背景) -->
  <div id="ui-overlay" style="position: absolute; z-index: 10; pointer-events: none;">
    <GameOverlay />
  </div>
</div>
```

### 8.2 核心 Hook

```typescript
// use-engine.ts
function useEngine(blueprint: WorldBlueprint): { world: IWorld; version: number } {
  // 1. 创建 Engine + World
  // 2. 加载 blueprint (capabilities + entities)
  // 3. 创建 PhaserBackend
  // 4. 启动 game loop:
  //    requestAnimationFrame → world.tick() → backend.sync(world) → setVersion(v+1)
  // 5. 返回 world + version (version 变化触发 React re-render)
}

// use-component.ts
function useComponent<T extends Component>(
  world: IWorld, entityId: EntityId, type: ComponentType
): T | undefined {
  // 每次 version 变化时重新读取
}
```

### 8.3 Template → Binding 分离

```
Templates (不知道游戏是什么):
  Bar       → { current, max, color, label }
  ActionButton → { label, icon, onClick, disabled }
  TextBanner → { text, variant }

Bindings (知道 ECS Component):
  HealthBinding → 读 Health → <Bar current={hp.current} max={hp.max} color="green" label="HP" />
  AttackBinding → <ActionButton label="攻击" onClick={() => dispatch(AttackIntent)} disabled={!myTurn} />
  TurnBinding   → 读 TurnState → <TextBanner text={`第 ${round} 回合`} />
```

---

## 9. Assembly 蓝图 (`assembly/demo.world.ts`)

```typescript
export const demoWorld: WorldBlueprint = {
  capabilities: ['health', 'combat', 'turn', 'render-bridge'],

  entities: {
    hero: {
      Health:         { current: 100, max: 100 },
      CombatStats:    { attack: 15, defense: 5 },
      TurnOrder:      { order: 0 },
      Sprite:         { textureKey: 'hero', anchorX: 0.5, anchorY: 1 },
      Transform:      { x: 160, y: 220, scaleX: 1, scaleY: 1, rotation: 0 },
      AnimationState: { current: 'idle', loop: true, speed: 1 },
    },
    dragon: {
      Health:         { current: 500, max: 500 },
      CombatStats:    { attack: 25, defense: 10 },
      TurnOrder:      { order: 1 },
      AIController:   { strategy: 'mixed' },
      Sprite:         { textureKey: 'dragon', anchorX: 0.5, anchorY: 1 },
      Transform:      { x: 480, y: 220, scaleX: -1, scaleY: 1, rotation: 0 },
      AnimationState: { current: 'idle', loop: true, speed: 1 },
    },
    arena: {
      Sprite:         { textureKey: 'arena-bg', anchorX: 0, anchorY: 0 },
      Transform:      { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    },
  },

  turn: { firstTurn: 'hero' },
};
```

---

## 10. Registry 构建 (`.apollo/registry.json`)

由 `build-registry.ts` 扫描所有 `*.cap.ts` 自动生成：

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-06-01T00:00:00Z",

  "capabilities": {
    "health": {
      "describe": { "summary": "生命值系统...", "semantic": ["resource", "health"] },
      "components": { "provides": ["Health"], "reads": ["DamageEvent"], ... },
      "config": { "maxHealth": { "question": "最大生命值？", ... } },
      "sourceHash": "a3f9c2..."
    },
    "combat": { ... },
    "turn": { ... },
    "render-bridge": { ... }
  },

  "components": {
    "Health":       { "category": "resource", "definedBy": "health", "fields": { "current": "number", "max": "number" } },
    "DamageEvent":  { "category": "event",    "definedBy": "combat", "fields": { "amount": "number", "damageType": "string" } },
    "AttackIntent": { "category": "intent",   "definedBy": "combat", "fields": { "target": "EntityId" } },
    "Dead":         { "category": "marker",   "definedBy": "health", "fields": {} },
    "Sprite":       { "category": "render",   "definedBy": "render-bridge", "fields": { "textureKey": "string" } }
  },

  "systemOrder": [
    "turn.advance",
    "turn.ai-decision",
    "combat.resolve",
    "health.apply",
    "render-bridge.sync"
  ]
}
```

**用途：**
- LLM 读此文件理解现有能力 → 生成新 Capability 或 Assembly
- Component Agent 读 `config.*.question` → 向用户提问
- 编辑器读 `config.*.ui` → 渲染参数控件
- `sourceHash` 用于漂移检测 (`apollo sync`)

---

## 11. 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| Engine | TypeScript (纯，零依赖) | 5.4+ |
| Renderer | Phaser 3 | 3.80+ |
| UI | React | 18+ |
| Build | Vite | 5+ |
| Test | Vitest | 2+ |
| Assets | Kenney.nl 免费像素素材 | — |
| Package | pnpm | 9+ |

---

## 12. 开发阶段

### Step 1 — ECS 骨架 + 静态渲染 (目标: 能看到画面)

- [ ] Engine core: World, 拓扑排序, defineCapability
- [ ] 4 个 Capability 定义 (describe + components + config + systems)
- [ ] Phaser Backend: 加载素材, 显示精灵, idle 动画
- [ ] React: 血条 + 攻击按钮 (未连接)
- [ ] Assembly: demo.world.ts 加载
- [ ] 验收: 打开浏览器看到勇士和恶龙站在竞技场里

### Step 2 — 战斗可玩 (目标: 能打一场)

- [ ] health.apply system 实现
- [ ] combat.resolve system 实现
- [ ] turn 系统实现 (玩家/AI 交替)
- [ ] render-bridge: 攻击动画, 受击抖动, 死亡效果
- [ ] React: 攻击/防御按钮连接 ECS dispatch
- [ ] 验收: 点攻击 → 动画 → 血条变化 → 轮到 Boss → Boss 反击 → 循环

### Step 3 — 自描述闭环 (目标: registry 可用)

- [ ] build-registry.ts 实现
- [ ] 生成 .apollo/registry.json
- [ ] sourceHash 漂移检测
- [ ] 新增 shield.cap.ts 验证组合性 (不改已有代码)
- [ ] 验收: shield 加入后自动排在 combat 和 health 之间

### Step 4 — 打磨 (目标: 可演示)

- [ ] UI 美化 (主题 CSS)
- [ ] 战斗日志/叙事文字
- [ ] 音效 (Phaser audio)
- [ ] 胜负判定 + 结算画面
- [ ] 验收: 一个完整可玩的战斗 demo, 可以给投资人演示

---

## 13. 关键设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 渲染引擎 | Phaser 3 | TS 原生、侵入低、Web 主流、可换 |
| ECS vs OOP | ECS | AI 可读、可组合、可拓扑排序 |
| Descriptor 位置 | 内联在 Capability 文件 | 单一真相源，不会跟代码脱节 |
| Registry 格式 | JSON 文件 | MVP 够用，以后可换向量数据库 |
| UI 方案 | React DOM overlay | 不侵入 Phaser，可独立迭代 |
| 状态同步方向 | ECS → Phaser (单向) | Phaser 只是画笔，不持有状态 |
| 资产来源 | 免费素材 / AI 离线生成 | 零美术成本，专注架构验证 |
| 微信适配 | 预留 RendererBackend 接口 | 以后换 Cocos Backend |
