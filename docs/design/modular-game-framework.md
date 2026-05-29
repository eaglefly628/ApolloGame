# Apollo Game Framework - AI 驱动的模块化游戏框架

## 1. 愿景

**一句话**：用户用自然语言描述想要的游戏 → AI 从精心打磨的模块库中选择、组装、配参 → 输出一个可玩的、有品质的游戏。

**核心差异化**：LLM 是编排器（router + param filler），不是生成器。游戏质量沉淀在人工打磨的模块里，AI 只做 **选模块 → 填参数 → 解冲突**。

**类比**：
- 当前 AI 游戏 = ChatGPT 写作文（每次从零生成，质量不可控）
- Apollo 框架 = 乐高 + 智能导购（积木精雕细琢，AI 帮你挑和拼）

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                     用户输入层                                │
│  "做一个中世纪塔防，有3条路线，敌人会飞"                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI 编排层 (Orchestrator)                    │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ 语义解析  │→│ 模块选择+组装 │→│ 问题驱动参数填充         │ │
│  │ (Opus)   │  │ (Opus)       │  │ (Haiku, 逐模块)        │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
│                       │                                      │
│                       ▼                                      │
│         ┌─────────────────────────┐                         │
│         │ 静态校验器 (纯代码)       │                         │
│         │ 事件闭合 / 类型兼容 /     │                         │
│         │ 依赖完整 / 参数合法       │                         │
│         └─────────────────────────┘                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ Game Manifest (JSON)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   运行时引擎层 (Runtime)                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Cocos Creator 3.x                       │   │
│  │                                                      │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │   │
│  │  │ Module │ │ Module │ │ Module │ │ Module │ ...    │   │
│  │  │ Node   │ │ Node   │ │ Node   │ │ Node   │       │   │
│  │  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘       │   │
│  │      └──────────┴──────────┴──────────┘              │   │
│  │                 Event Bus                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  目标平台：Web / 微信小游戏 / Android / iOS                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 技术选型

### 3.1 运行时引擎：Cocos Creator 3.x

| 维度 | Cocos Creator | Godot | Unity |
|------|--------------|-------|-------|
| 语言 | **TypeScript** (LLM 最熟) | GDScript (小众) | C# |
| 微信小游戏 | **原生支持** | 需适配 | 需适配 |
| 数据驱动 | **JSON 序列化场景/Prefab** | tscn 文本格式 | YAML |
| 跨平台 | Web/iOS/Android/鸿蒙 | 全平台 | 全平台 |
| 开源 | 引擎开源 | 完全开源 | 闭源 |
| AI 友好度 | **高**（TS + JSON） | 中 | 中 |

**选择 Cocos Creator 的核心理由**：
1. TypeScript = LLM 生成质量最高的语言
2. 场景/Prefab 本质是 JSON = 天然数据驱动
3. 原生微信小游戏打包 = 保留你之前的方向
4. Node-Component 架构 = 天然映射到模块系统

### 3.2 AI 编排层

| 组件 | 技术 | 说明 |
|------|------|------|
| 语义解析 + 模块选择 | Claude Opus + tool-use | 模块 manifest 直接当 tool schema |
| 逐模块填参 | Claude Haiku | 每模块独立问答，廉价高效 |
| 模块检索 | 内存向量检索 / sqlite-vec | 模块数量有限（<100），不需要重型向量库 |
| 静态校验 | 纯 TypeScript | 确定性校验，不依赖 LLM |

### 3.3 模块标准

- 参数定义：**JSON Schema**（可校验 + 可直接约束 LLM 结构化输出）
- 能力契约：自定义 manifest 格式（见第 4 节）
- 事件总线：Cocos Creator 内置 EventTarget + 类型化扩展

---

## 4. 模块 Manifest 标准

每个游戏模块必须提供一份 manifest 文件，声明自己的完整契约。

### 4.1 Manifest Schema

```jsonc
{
  // === 元信息 ===
  "id": "wave_system",
  "name": "波次系统",
  "version": "1.0.0",
  "type": "system",                    // system | content | skin
  "category": "core",                  // core | combat | economy | visual | audio
  "description": "管理敌人波次的生成、间隔、难度递增",
  "tags": ["wave", "spawn", "enemy", "timing"],

  // === 依赖声明 ===
  "dependencies": {
    "required": ["map_grid", "enemy_system"],
    "optional": ["economy_system"]     // 有则增强，无则降级
  },

  // === 能力契约 ===
  "capabilities": {
    "state": {
      "currentWave": { "type": "number", "description": "当前波次编号" },
      "totalWaves": { "type": "number", "description": "总波次数" },
      "isSpawning": { "type": "boolean", "description": "是否正在出怪" },
      "waveProgress": { "type": "number", "description": "当前波进度 0-1" }
    },

    "emits": [
      {
        "event": "wave_started",
        "payload": { "waveNumber": "number", "enemyCount": "number" },
        "description": "新波次开始时触发"
      },
      {
        "event": "wave_completed",
        "payload": { "waveNumber": "number", "remainingWaves": "number" },
        "description": "当前波次所有敌人被消灭或通过时触发"
      },
      {
        "event": "all_waves_completed",
        "payload": {},
        "description": "所有波次完成时触发"
      },
      {
        "event": "enemy_spawned",
        "payload": { "enemyType": "string", "spawnPoint": "string", "pathId": "string" },
        "description": "每个敌人生成时触发"
      }
    ],

    "consumes": [
      {
        "event": "enemy_killed",
        "from": "enemy_system",
        "description": "用于追踪当前波次剩余敌人数"
      },
      {
        "event": "enemy_leaked",
        "from": "enemy_system",
        "description": "敌人到达终点，同样计入已处理数"
      }
    ],

    "queries": [
      {
        "name": "getWaveInfo",
        "params": { "waveNumber": "number" },
        "returns": { "enemies": "EnemySpawnConfig[]", "delay": "number" },
        "description": "查询指定波次的配置"
      },
      {
        "name": "getRemainingEnemies",
        "params": {},
        "returns": { "count": "number" },
        "description": "查询当前波次剩余敌人数"
      }
    ]
  },

  // === 驱动问题（AI 填参用） ===
  "questions": [
    {
      "id": "total_waves",
      "question": "游戏有多少波敌人？",
      "param_path": "config.totalWaves",
      "type": "number",
      "default": 20,
      "constraints": { "min": 5, "max": 100 }
    },
    {
      "id": "difficulty_curve",
      "question": "难度曲线是什么样的？",
      "param_path": "config.difficultyCurve",
      "type": "enum",
      "options": ["linear", "exponential", "s_curve", "plateau_spike"],
      "default": "s_curve"
    },
    {
      "id": "spawn_interval",
      "question": "每个敌人之间的生成间隔（秒）？",
      "param_path": "config.baseSpawnInterval",
      "type": "number",
      "default": 1.5,
      "constraints": { "min": 0.3, "max": 5.0 }
    },
    {
      "id": "wave_rest_time",
      "question": "波次之间的休息时间（秒）？",
      "param_path": "config.waveRestTime",
      "type": "number",
      "default": 10,
      "constraints": { "min": 3, "max": 30 }
    },
    {
      "id": "boss_waves",
      "question": "每隔多少波出一个 Boss？",
      "param_path": "config.bossInterval",
      "type": "number",
      "default": 5,
      "constraints": { "min": 0, "max": 20 }
    }
  ],

  // === 可调参数（完整 JSON Schema） ===
  "config": {
    "type": "object",
    "properties": {
      "totalWaves": { "type": "number", "default": 20 },
      "difficultyCurve": {
        "type": "string",
        "enum": ["linear", "exponential", "s_curve", "plateau_spike"],
        "default": "s_curve"
      },
      "baseSpawnInterval": { "type": "number", "default": 1.5 },
      "waveRestTime": { "type": "number", "default": 10 },
      "bossInterval": { "type": "number", "default": 5 },
      "difficultyScaling": {
        "type": "object",
        "properties": {
          "hpMultiplier": { "type": "number", "default": 1.15 },
          "speedMultiplier": { "type": "number", "default": 1.05 },
          "countMultiplier": { "type": "number", "default": 1.1 }
        }
      }
    }
  },

  // === 实现入口 ===
  "entry": {
    "component": "WaveSystem",
    "script": "modules/wave_system/WaveSystem.ts",
    "prefab": "modules/wave_system/WaveSystemNode.prefab"
  }
}
```

### 4.2 三层分离原则

每个游戏由三个正交维度组装：

| 层 | 职责 | 示例 |
|----|------|------|
| **System（机制）** | 游戏规则和逻辑 | WaveSystem, TowerSystem, EconomySystem |
| **Content（内容）** | 数据和配置 | 敌人表、塔类型表、波次配置表 |
| **Skin（美学）** | 视觉、音效、手感 | 中世纪皮肤、科幻皮肤、像素风皮肤 |

AI 编排时，三层独立选择：
```
用户: "做一个科幻塔防"
  → System: [map_grid, path_system, tower_system, enemy_system, wave_system, economy_system]
  → Content: [sci_fi_enemies, laser_towers, energy_economy]
  → Skin: [sci_fi_theme]
```

---

## 5. 塔防模块目录（预研首批）

### 5.1 核心模块（Core Systems）

#### `map_grid` - 地图网格系统
- **职责**：定义游戏区域、格子类型（可建造/不可建造/路径/障碍）、地图尺寸
- **State**：gridWidth, gridHeight, cells[][], buildableCount
- **Emits**：`cell_changed`, `map_loaded`
- **Consumes**：无（基础模块）
- **关键问题**：地图尺寸？格子形状（方/六角）？地形类型有哪些？

#### `path_system` - 路径系统
- **职责**：敌人行进路线定义，支持多路径、分支、交汇
- **State**：paths[], activePathCount
- **Emits**：`path_completed`（敌人走完路径）
- **Consumes**：`map_loaded` from map_grid
- **依赖**：map_grid
- **关键问题**：几条路线？路线是否交叉？是否有分支？

#### `wave_system` - 波次系统
- **职责**：敌人波次管理、出怪时机、难度递增
- **State**：currentWave, totalWaves, isSpawning
- **Emits**：`wave_started`, `wave_completed`, `all_waves_completed`, `enemy_spawned`
- **Consumes**：`enemy_killed`, `enemy_leaked` from enemy_system
- **依赖**：map_grid, enemy_system
- **关键问题**：总波数？难度曲线？Boss 间隔？

#### `economy_system` - 经济系统
- **职责**：货币管理、收入来源、消费扣除
- **State**：gold, income, totalEarned, totalSpent
- **Emits**：`gold_changed`, `insufficient_gold`, `income_tick`
- **Consumes**：`enemy_killed`（击杀奖励）, `tower_placed`（扣费）, `tower_upgraded`（扣费）
- **关键问题**：初始金币？击杀奖励方式？是否有利息机制？

### 5.2 战斗模块（Combat Systems）

#### `tower_system` - 塔防御系统
- **职责**：塔的放置、瞄准、攻击、升级
- **State**：towers[], selectedTower, towerTypes[]
- **Emits**：`tower_placed`, `tower_upgraded`, `tower_sold`, `tower_attacked`
- **Consumes**：`gold_changed` from economy_system, `cell_changed` from map_grid
- **依赖**：map_grid, economy_system
- **关键问题**：有几种塔？瞄准策略（最近/最前/最强）？最高几级？

#### `enemy_system` - 敌人系统
- **职责**：敌人实体管理、生命值、移动、特殊能力
- **State**：activeEnemies[], totalKilled, totalLeaked
- **Emits**：`enemy_killed`, `enemy_leaked`, `enemy_damaged`, `enemy_ability_used`
- **Consumes**：`tower_attacked` from tower_system, `enemy_spawned` from wave_system
- **依赖**：path_system
- **关键问题**：敌人类型？是否有飞行单位？是否有特殊能力（加速/隐身/分裂）？

#### `projectile_system` - 弹道系统
- **职责**：子弹/技能特效的飞行、碰撞检测、伤害结算
- **State**：activeProjectiles[]
- **Emits**：`projectile_hit`, `projectile_expired`
- **Consumes**：`tower_attacked` from tower_system
- **依赖**：tower_system, enemy_system
- **关键问题**：弹道类型（直线/抛物线/追踪）？是否有 AOE？

### 5.3 辅助模块（Support Systems）

#### `life_system` - 生命/基地系统
- **职责**：玩家生命值管理，敌人泄漏扣血，胜负判定
- **State**：lives, maxLives, isGameOver
- **Emits**：`life_lost`, `game_over`, `game_victory`
- **Consumes**：`enemy_leaked` from enemy_system, `all_waves_completed` from wave_system
- **关键问题**：初始生命？每泄漏一个敌人扣多少？

### 5.4 模块依赖图

```
                    map_grid
                   ↙        ↘
           path_system    tower_system ←── economy_system
               ↓              ↓                  ↑
          enemy_system ──→ projectile_system      │
               ↓              │                   │
          wave_system         │                   │
               ↓              ↓                   │
          life_system ←───── (events) ────────────┘
```

---

## 6. Game Manifest（游戏组装产物）

AI 编排器的最终输出是一份 Game Manifest JSON，运行时引擎直接加载：

```jsonc
{
  "game": {
    "id": "medieval_td_001",
    "name": "中世纪塔防",
    "description": "3条路线的经典中世纪塔防，含飞行单位和Boss波",
    "version": "1.0.0"
  },

  // 激活的模块及其配置
  "modules": {
    "map_grid": {
      "config": {
        "gridWidth": 15,
        "gridHeight": 10,
        "cellShape": "square",
        "terrainTypes": ["grass", "stone", "water"]
      }
    },
    "path_system": {
      "config": {
        "pathCount": 3,
        "allowCrossing": false,
        "allowBranching": false
      }
    },
    "wave_system": {
      "config": {
        "totalWaves": 30,
        "difficultyCurve": "s_curve",
        "baseSpawnInterval": 1.2,
        "waveRestTime": 12,
        "bossInterval": 5
      }
    },
    "tower_system": {
      "config": {
        "maxTowerLevel": 3,
        "targetingStrategies": ["nearest", "first", "strongest"],
        "defaultStrategy": "first"
      }
    },
    "enemy_system": {
      "config": {
        "hasFlying": true,
        "hasAbilities": true,
        "abilityTypes": ["stealth", "split"]
      }
    },
    "projectile_system": {
      "config": {
        "projectileTypes": ["arrow", "magic_bolt", "catapult_stone"],
        "hasAOE": true
      }
    },
    "economy_system": {
      "config": {
        "startingGold": 200,
        "killRewardType": "fixed",
        "baseKillReward": 10,
        "hasInterest": false
      }
    },
    "life_system": {
      "config": {
        "maxLives": 20,
        "damagePerLeak": 1
      }
    }
  },

  // 内容配置（具体的塔/敌人数据）
  "content": {
    "towers": [
      {
        "id": "archer_tower",
        "name": "弓箭塔",
        "cost": 50,
        "damage": 10,
        "range": 3.0,
        "attackSpeed": 1.0,
        "projectileType": "arrow",
        "targeting": "first",
        "canHitFlying": true,
        "upgrades": [
          { "level": 2, "cost": 40, "damageBonus": 8, "rangeBonus": 0.5 },
          { "level": 3, "cost": 80, "damageBonus": 15, "rangeBonus": 1.0 }
        ]
      },
      {
        "id": "magic_tower",
        "name": "法师塔",
        "cost": 100,
        "damage": 25,
        "range": 2.5,
        "attackSpeed": 0.5,
        "projectileType": "magic_bolt",
        "targeting": "strongest",
        "canHitFlying": true,
        "aoeRadius": 1.0,
        "upgrades": [
          { "level": 2, "cost": 80, "damageBonus": 20, "aoeBonus": 0.5 },
          { "level": 3, "cost": 150, "damageBonus": 35, "aoeBonus": 0.5 }
        ]
      }
    ],
    "enemies": [
      {
        "id": "footman",
        "name": "步兵",
        "hp": 50,
        "speed": 1.0,
        "reward": 10,
        "flying": false,
        "abilities": []
      },
      {
        "id": "bat",
        "name": "蝙蝠",
        "hp": 30,
        "speed": 1.5,
        "reward": 15,
        "flying": true,
        "abilities": []
      },
      {
        "id": "rogue",
        "name": "刺客",
        "hp": 40,
        "speed": 1.2,
        "reward": 20,
        "flying": false,
        "abilities": ["stealth"]
      }
    ]
  },

  // 皮肤/主题
  "skin": {
    "theme": "medieval",
    "assetBundle": "skins/medieval"
  }
}
```

---

## 7. 静态校验器规则

在 Game Manifest 交给运行时之前，校验器执行以下检查（纯代码，不依赖 LLM）：

### 7.1 依赖完整性
- 所有模块的 `dependencies.required` 必须在 `modules` 中存在
- 缺失依赖 → 报错并列出缺失项

### 7.2 事件供需闭合
- 每个模块 `consumes` 的事件，必须有某个已激活模块 `emits` 该事件
- 未满足的 consume → 警告（降级运行）或报错（必需事件）

### 7.3 参数合法性
- 每个模块 config 必须通过其 JSON Schema 校验
- 数值范围、枚举值、必填项

### 7.4 内容引用完整性
- towers[].projectileType 必须在 projectile_system 支持的类型中
- enemies[].abilities 必须在 enemy_system 配置的 abilityTypes 中
- wave 配置引用的 enemyType 必须在 enemies[] 中存在

### 7.5 逻辑一致性
- 如果 enemy_system.hasFlying = true，tower_system 中至少一种塔 canHitFlying = true
- economy_system 的 startingGold 必须 >= 最便宜的塔的 cost（否则开局卡死）
- life_system.maxLives > 0

---

## 8. AI 编排流程详细设计

### 8.1 Step 1: 语义解析（Opus）

**输入**：用户自然语言
**输出**：结构化意图

```json
{
  "genre": "tower_defense",
  "theme": "medieval",
  "features": ["multiple_paths", "flying_enemies", "boss_waves"],
  "constraints": ["path_count:3"],
  "mood": "classic"
}
```

### 8.2 Step 2: 模块选择（Opus + tool-use）

将每个模块 manifest 的 `id + description + tags` 注册为 Claude tool。Opus 通过 tool-use 选择模块组合。

**关键设计**：模块 manifest 直接就是 tool schema，不需要额外的映射层。

### 8.3 Step 3: 问题驱动填参（Haiku，逐模块）

对每个被选中的模块，取其 `questions[]`，由 Haiku 根据用户原始描述 + 上下文填充参数。

**降级策略**：如果 LLM 无法确定某参数，使用 manifest 中的 `default` 值。

### 8.4 Step 4: 静态校验

运行第 7 节的校验规则。失败则将错误反馈给 Opus 重新调整。

### 8.5 Step 5: 组装 + 加载

输出 Game Manifest JSON → Cocos Creator 运行时加载 → 可玩。

---

## 9. Cocos Creator 集成方案

### 9.1 模块 → Cocos 组件映射

每个 Apollo 模块对应一个 Cocos **Prefab + Component**：

```
modules/
├── map_grid/
│   ├── manifest.json          # 模块 manifest
│   ├── MapGridSystem.ts       # Cocos Component（游戏逻辑）
│   ├── MapGridNode.prefab     # Cocos Prefab（场景节点）
│   └── content/               # 可选内容数据
│       └── default_maps.json
├── wave_system/
│   ├── manifest.json
│   ├── WaveSystem.ts
│   ├── WaveSystemNode.prefab
│   └── content/
│       └── default_waves.json
└── ...
```

### 9.2 事件总线

基于 Cocos Creator 的 `EventTarget` 扩展类型化事件总线：

```typescript
// 框架提供的类型化事件总线
interface GameEventBus {
  emit<T extends keyof GameEvents>(event: T, payload: GameEvents[T]): void;
  on<T extends keyof GameEvents>(event: T, handler: (payload: GameEvents[T]) => void): void;
  off<T extends keyof GameEvents>(event: T, handler: Function): void;
}

// 事件类型由已激活模块的 manifest 在加载时自动注册
type GameEvents = {
  wave_started: { waveNumber: number; enemyCount: number };
  wave_completed: { waveNumber: number; remainingWaves: number };
  enemy_killed: { enemyId: string; reward: number };
  enemy_leaked: { enemyId: string; damage: number };
  tower_placed: { towerId: string; cost: number; cell: [number, number] };
  // ... 根据激活模块动态生成
};
```

### 9.3 运行时加载流程

```
1. 解析 Game Manifest JSON
2. 校验模块依赖和事件闭合
3. 按依赖顺序加载模块 Prefab
4. 将 config 注入各模块 Component
5. 注册各模块的事件监听
6. 加载 Content 数据（塔/敌人/波次表）
7. 加载 Skin 资源包
8. 初始化完成 → 开始游戏
```

---

## 10. 模块扩展性：从塔防到泛化

当塔防模块体系验证成功后，泛化路径：

### 10.1 可复用模块（跨题材）
- `economy_system` → 任何有货币的游戏
- `life_system` → 任何有生命值的游戏
- `wave_system` → Roguelike 的楼层、生存游戏的波次

### 10.2 新题材 = 新模块集
- **Roguelike**：新增 `dungeon_generator`, `inventory_system`, `skill_tree`, `fog_of_war`
- **卡牌**：新增 `deck_system`, `hand_system`, `card_effect_engine`, `turn_manager`
- **生存**：新增 `crafting_system`, `day_night_cycle`, `hunger_system`

### 10.3 模块市场（远期）
- 第三方开发者贡献模块
- 每个模块必须通过 manifest 标准校验
- 自动化测试：模块在标准 harness 中能否正常 emit/consume

---

## 11. 预研验收标准

本轮预研（设计文档级）的交付物：

- [x] 架构总览文档
- [x] 模块 Manifest Schema 标准定义
- [x] 塔防题材 8 个核心模块定义（含能力契约）
- [x] Game Manifest 示例（完整可读）
- [x] 静态校验器规则定义
- [x] AI 编排流程设计
- [x] Cocos Creator 集成方案
- [x] 泛化路径规划

**下一步（如果推进到原型）**：
1. 初始化 Cocos Creator 3.x 项目
2. 实现事件总线 + 模块加载器
3. 实现 map_grid + path_system 两个最基础模块
4. 实现 Game Manifest 解析 + 校验器
5. 一个可运行的最小塔防 demo
