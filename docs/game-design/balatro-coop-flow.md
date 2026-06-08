# 对垒小丑 · 合作 vs Boss —— 流程图（给 PE）

> Mermaid 图，GitHub / 支持 Mermaid 的 Markdown 里直接渲染成图。配套策划案：`balatro-coop-vs-boss.md`。

## 1. 玩法流程（一拍循环 = 核心玩法）
```mermaid
flowchart TD
  A(["阶段开始：Boss 满血 + 亮意图"]) --> B{"新节拍"}
  B --> C["种子RNG 翻『共振目标』+ 共享随机事件"]
  C --> D["select 相：倒计时启动 / 双方各自『秘密』选牌（盘面全公开）"]
  D --> E{"两人都锁 或 超时?"}
  E -->|否| D
  E -->|是| F["同时翻开"]
  F --> G["pokerHand 认牌型 → chips × mult"]
  G --> H{"分工共鸣：互补命中?（如 1同花+1顺子）"}
  H -->|命中| I["掷『暴击骰』×2/3/5（只上行）"]
  H -->|哑火| J["合并伤害 → 砸 boss_hp"]
  I --> J
  J --> K["补牌"]
  K --> L{"Boss HP 归零?"}
  L -->|是| M(["阶段清 → 下一更硬阶段"])
  L -->|否| N{"出牌额度耗尽?"}
  N -->|否| B
  N -->|是| O(["Boss 发难 → 团队受创 / 失败判定"])
```

## 2. 开发流程（数据驱动 · 给实现）
```mermaid
flowchart TD
  S(["策划案 balatro-coop-vs-boss.md"]) --> G{"每块机制：现有 capability 能组合?"}
  G -->|"能（~90%）"| D["写成『数据』(manifest entities)"]
  G -->|"真缺口"| C["下沉通用 capability：先读 wiki/skills → defineCapability → 单测 → 注册"]
  C --> D
  D --> K["加 1 个小契约：Beat/Resonance 上下文暴露给 condition 读（数据契约，非新能力）"]
  K --> L["parseManifest → engine.load → tick 跑起来"]
  L --> V1{"tsc + vitest + build 全绿?"}
  V1 -->|否| D
  V1 -->|是| V2["ApolloBench 跑分 + 种子RNG 双跑同 hash（determinism）"]
  V2 --> P{"试玩切片：盲选分工 + 随机暴击 爽不爽?"}
  P -->|不好玩| T["调旋钮：倒计时 / 分工歧义 / RNG 强度"]
  T --> D
  P -->|好玩| N(["叠 Boss / 小丑 / 商店 → 加合作 lockstep → 联机"])
```

## 3. 系统数据流（一眼看懂架构）
```mermaid
flowchart LR
  subgraph M["数据 Manifest（纯 JSON）"]
    E["entities：卡 / 玩家区 / Boss / Beat / 小丑 / 共鸣牌"]
    CA["capabilities：pokerHand · condition · effect-apply · RandomSeed · clickable …"]
  end
  M --> P["parseManifest（+ R12 校验 + 资产校验）"]
  P --> W["World（ECS）"]
  W -->|"tick（确定性）"| SYS["Systems = 引擎（只解释数据，不含游戏专属代码）"]
  SYS --> HASH["hashSnapshot → lockstep 双端同步"]
  SYS --> UI["CanvasRenderer 薄层（卡/区/Boss = 实体 + Clickable）"]
```

## 给 PE 的三条红线
1. **游戏 = 数据**：新牌种（Echo/Pact/Relay/…）是 **manifest 数据**，不是新 system；唯一引擎改动 = 第 2 图里那个"小契约"。
2. **随机必种子化**（同一 `RandomSeed` 源）→ 否则联机两端分叉。
3. **先验切片再扩**：先把"盲选分工 + 随机暴击"那一拍做出来试玩（第 1 图的循环 + 第 7 节数据清单），好玩了再叠 Boss/联机。
