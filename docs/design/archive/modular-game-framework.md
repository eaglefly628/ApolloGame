# ZeroCraft Game Framework - AI 驱动的模块化游戏框架

> ⚠️ **早期愿景文档（2026-06-07 标注）。核心思想已落地，但「具体技术选型」已分叉——按此对照阅读：**
> - 已**实现**的思想：LLM 编排而非生成 · **Manifest 数据格式**(`src/assembly/manifest.ts`) · **静态校验器**(R12，组件数据 schema 校验) · **引擎无关 Ports/Adapters**(`src/services/{storage,audio,aigp}`) · **Game Manifest=组装产物**(导出/导入对称)。
> - 已**分叉/未采用**的具体方案：表现后端**不是 Cocos Creator**(实际 Canvas2D + Vite + React) · 首批不是**塔防**(实际 平台/VN/三消三游戏) · §5「塔防模块目录」、§10.3「模块市场」**未实现**。
> - "模块(module)"在实现里收敛为 **capability/atom**(`src/skills/`)。**当前真相以 `docs/workflow/SESSION-HANDOFF.md` 为准。**
> 仍被引用的概念章节（§1.1 护城河 / §4 Manifest / §6 Game Manifest / §7 校验器 / §9 Ports）保留有效；具体选型章节当历史读。

## 1. 愿景

**一句话**：用户用自然语言描述想要的游戏 → AI 从精心打磨的模块库中选择、组装、配参 → 输出一个可玩的、有品质的游戏。

**核心差异化**：LLM 是编排器（router + param filler），不是生成器。游戏质量沉淀在人工打磨的模块里，AI 只做 **选模块 → 填参数 → 解冲突**。

**类比**：
- 当前 AI 游戏 = ChatGPT 写作文（每次从零生成，质量不可控）
- ZeroCraft 框架 = 乐高 + 智能导购（积木精雕细琢，AI 帮你挑和拼）

### 1.1 护城河与突破点（最重要的战略前提）

经过对竞品和引擎 MCP 现状的调研，确立以下三条不可动摇的定位：

1. **MCP 完整度不是护城河，也不是瓶颈**。截至 2026 年，Unity 6.2 官方 MCP、Unreal 官方 MCP 预览版均已上线，社区版工具数 300+，能创建/操作 GameObject、Blueprint、Actor、材质、运行 PIE。它对所有人开放（包括引擎厂商自己、Rosebud、Astrocade、Cursor）。把差异化建立在"接入完整 MCP"上 = 薄壳，会被引擎厂商在自己地盘碾压。

2. **"一句话成游戏"的真正瓶颈是品质，不是引擎控制力**。业界已验证 LLM 直接驱动引擎只能产出"原型"，且 gameslop 游戏在 Steam 评分低 15–20%、退款高 2–3 倍。LLM 崩在数值平衡、系统耦合、手感整合——而这恰恰是**工业级模块库**预先解决、并由静态校验器锁住的部分。

3. **唯一护城河 = 工业级模块库 + 契约标准 + 静态校验器；引擎是可插拔后端**。模块用引擎无关的逻辑核心实现，写一次、复利增长；每个引擎只需实现一个十几方法的 `EnginePort` 适配器，成本恒定。引擎绑不死你，引擎厂商也无法用"官方 MCP"挤掉你——因为价值在模块层，不在 MCP 层。

> **首发后端选 Cocos Creator + 微信小游戏/Web**：休闲/小游戏/UGC 赛道 gameslop 容忍度高、迭代速度赢、TAM 已被 Astrocade/Rosebud 验证，是模块化打法最锋利的甜区。Unity/Unreal 作为后续 adapter 接入，**不一头扎进 Unreal 的画面军备红海**（那里 Epic 自己是对手）。

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
│             逻辑核心层 (Logic Core) —— 纯 TS，零引擎依赖        │
│                        ★ 护城河 ★                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │
│  │ Module │ │ Module │ │ Module │ │ Module │ ...            │
│  │ .core  │ │ .core  │ │ .core  │ │ .core  │                │
│  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘                │
│      └──────────┴────┬─────┴──────────┘                      │
│              类型化 Event Bus（确定性模拟）                     │
└────────────────────┬─────────────────────────────────────────┘
                     │ EnginePort（~十几个方法的能力接口）
        ┌────────────┼────────────┬──────────────┐
        ▼            ▼            ▼              ▼
┌─────────────┐┌──────────┐┌───────────┐┌──────────────┐
│ Cocos Adapter││Unity    ││Unreal     ││ Web Adapter   │
│ (首发,TS直接)││Adapter   ││Adapter    ││               │
│             ││(via MCP) ││(via MCP)  ││               │
└─────────────┘└──────────┘└───────────┘└──────────────┘
   表现/渲染/音效/输入 —— 每引擎一份薄适配，成本恒定
        │
        ▼
  目标平台：微信小游戏 / Web（首发） · Android / iOS / PC（后续）
```

> 引擎只是**可插拔的表现后端**：逻辑核心不依赖任何引擎，引擎仅通过 `EnginePort` 提供渲染、音效、输入等能力。详见第 9 节。

---

## 3. 技术选型

### 3.1 首发表现后端：Cocos Creator 3.x

> 注意：引擎是**可插拔后端**而非核心绑定（见第 1.1、第 9 节）。下表说明的是"为什么首发选 Cocos"，而非"为什么绑定 Cocos"。

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

输出 Game Manifest JSON → 逻辑核心加载并校验 → 绑定当前目标引擎的 Adapter → 可玩。

---

## 9. 引擎无关架构：逻辑核心 + 表现适配

> 这是整个框架的命门。它决定了模块库能否跨引擎复利、不被任何引擎绑死。
> **核心原则：核心实现放纯逻辑，引擎只做表现后端。**

### 9.1 切分原则（Ports & Adapters / 六边形架构）

每个模块沿一条缝切成两半，**绝不**把游戏规则写进引擎组件：

```
┌─────────────────────────────────────┐
│  逻辑核心 (core.ts) —— 纯 TS，零引擎依赖   │  ← 护城河，写一次，跨引擎复用
│  规则 / 状态 / 数值 / 事件流 / 平衡 / 目标选择 │
└──────────────────┬──────────────────┘
                   │  EnginePort（能力接口，很小）
┌──────────────────┴──────────────────┐
│  表现绑定 (adapter.*.ts) —— 每引擎一份，很薄 │  ← 每个引擎实现一次
│  渲染 / 动画 / 音效 / 输入 / 粒子        │
└─────────────────────────────────────┘
```

成本结构：
- **逻辑核心 + 模块库**：写一次，越堆越厚，复利增长。
- **引擎适配**：每引擎一份薄 `EnginePort` 实现，恒定且很小。

**为什么塔防是验证这条缝的最佳题材**：塔防是网格/路径制、确定性模拟。射程判断、目标选择、寻路全部在逻辑侧的网格上计算，**根本不需要引擎的物理/碰撞系统**。引擎被降级成"哑渲染器"——只画状态、放音效、收点击，不参与任何游戏规则。这条缝天然干净。

**这条缝会变脏的地方**（远期再处理）：当玩法本身依赖引擎物理时（紧手感平台跳跃、布娃娃、载具）。对策：把确定性物理库（Rapier/Box2D）编进逻辑核心，物理也归逻辑算；引擎仍只渲染。

### 9.2 EnginePort —— 引擎需要实现的全部能力

整个引擎适配只需实现以下接口（塔防场景约 6 组、十几个方法）：

```typescript
// 这就是"隐形抽象层"。逻辑核心只通过它与引擎对话。
interface EnginePort {
  view: {
    spawn(entityId: string, visualType: string, pos: Vec2): void;  // 在某位置创建一个可视实体
    update(entityId: string, pos: Vec2, rot: number): void;        // 更新位置/朝向
    destroy(entityId: string): void;
    playAnim(entityId: string, anim: string): void;
  };
  audio: { play(soundId: string): void; stop(soundId: string): void; };
  vfx:   { emit(effectId: string, pos: Vec2): void; };
  input: { onTap(cb: (cell: GridPos) => void): void; };
  time:  { onTick(cb: (dt: number) => void): void; };  // 引擎驱动主循环，注入 dt
  asset: { preload(bundleId: string): Promise<void>; };
}
```

- **Cocos Adapter**：直接用 TS 实现，`view.spawn` → 实例化 Prefab；`time.onTick` → 挂到 `update()`。
- **Unity / Unreal Adapter**：通过官方 MCP 实现，`view.spawn` → MCP 创建 GameObject / Actor。
- **逻辑核心永远不 import 任何引擎 API**，只持有一个 `EnginePort` 引用。

### 9.3 模块目录结构（修正后）

每个模块 = 纯逻辑核心 + 按需的多引擎适配 + manifest：

```
modules/
├── map_grid/
│   ├── manifest.json          # 模块 manifest（能力契约）
│   ├── core.ts                # ★ 纯逻辑：网格状态、可建造判定（零引擎依赖）
│   ├── adapters/
│   │   ├── cocos.ts           # Cocos 表现绑定（薄）
│   │   ├── unity.ts           # Unity 表现绑定（via MCP，薄）
│   │   └── unreal.ts          # Unreal 表现绑定（via MCP，薄）
│   └── content/
│       └── default_maps.json
├── wave_system/
│   ├── manifest.json
│   ├── core.ts                # ★ 纯逻辑：波次时序、难度递增、出怪
│   ├── adapters/
│   │   └── cocos.ts           # 首发只需 Cocos
│   └── content/
│       └── default_waves.json
└── ...
```

> 三层模型与这条缝的对应：**System（机制）+ Content（数据）落在逻辑核心（纯）；Skin（美学/手感/juice）落在引擎侧 Adapter。** 手感与特效时序留给引擎发挥，不泄漏进逻辑核心。

### 9.4 事件总线（引擎无关）

事件总线属于逻辑核心层，**不依赖** Cocos `EventTarget`，纯 TS 实现以保证跨引擎一致：

```typescript
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

### 9.5 运行时加载流程

```
1. 解析 Game Manifest JSON
2. 校验模块依赖和事件闭合（第 7 节，纯逻辑）
3. 按依赖顺序实例化各模块的 core.ts，注入 config
4. 绑定当前目标引擎的 EnginePort 实现（Cocos / Unity / Unreal）
5. 各模块 core 通过 EnginePort.view.spawn 等创建表现实体
6. 注册各模块的事件监听
7. 加载 Content 数据（塔/敌人/波次表）+ Skin 资源包（经 EnginePort.asset）
8. EnginePort.time.onTick 驱动主循环 → 开始游戏
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

- [x] 战略定位与突破点（护城河 = 模块库；引擎 = 可插拔后端）
- [x] 架构总览文档
- [x] 模块 Manifest Schema 标准定义
- [x] 塔防题材 8 个核心模块定义（含能力契约）
- [x] Game Manifest 示例（完整可读）
- [x] 静态校验器规则定义
- [x] AI 编排流程设计
- [x] 引擎无关架构（逻辑核心 + EnginePort + 多引擎 Adapter）
- [x] 泛化路径规划

**下一步（如果推进到原型）**：
1. 实现引擎无关的逻辑核心运行时：纯 TS 事件总线 + 模块加载器 + `EnginePort` 接口
2. 实现 Game Manifest 解析 + 静态校验器（纯逻辑，可脱离引擎单测）
3. 实现 map_grid + path_system 两个最基础模块的 `core.ts`（确定性、可单测）
4. 实现首个 Cocos Adapter，验证 `EnginePort` 能把逻辑核心渲染出来
5. 一个可运行的最小塔防 demo（微信小游戏 / Web）
6. （验证后）实现 Unity Adapter via MCP，证明同一逻辑核心可切换后端
