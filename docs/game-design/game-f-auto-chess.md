# Game F：《像素三分天下》自走棋（Pixel Three Kingdoms Auto-Chess）开发设计

> 📌 **版本说明（2026-06-10 落库 mainbranch）**：本稿是 2026-06-09 的设计基线（自设计分支落库，原文未动）。
> **对局流转/数值以《[game-f-flow-spec.md](./game-f-flow-spec.md)》为准**（2026-06-10 策划按真实金铲铲研究修订）；
> 本稿的能力映射（§3）、架构评审/三缺口（§6）、回驳清单（§7）、阶段路线（§8）**仍然有效**。

> 负责人：（待指派 PF / Game Creator）
> 定位：引擎验证游戏 —— 压测「**经济/抽卡（离散）+ 封闭竞技场多对多自动战斗（连续）**」两条维度的**数据化**，
> 并第一次正面压测引擎的「**实体寻址（self / set）**」轴。
> 参考：金铲铲之战 / 云顶之弈（TFT）。复刻对象 = TFT 的核心战斗 + 经济 + 羁绊。
> 美术：像素风三国（itch.io 通用古代士兵包换色分势力；详见 §10）。

> ⛔ 先读最高原则 `docs/design/data-driven-manifesto.md`：**游戏是数据，不是代码。**
> 本游戏的逻辑（自动战斗、经济、抽卡、羁绊、流程）必须是**引擎 capability**（现成的用、缺的提需求下沉），
> 游戏目录里只有**数据**（英雄 Prefab / 势力职业表 / 经济曲线 / 锦囊 / 流程）。不写游戏专属 system、不手写战斗 UI。
>
> 尺子：「最弱的 LLM 能不能也产出一模一样的数据？」每个英雄都是一组组件、每条羁绊都是一行 `{trait, threshold, signal}` → 能 → 数据接口。

---

## 〇、立项判断（Lead 评审结论先行）

**接受立项，但路线与 Gemini 提案有三处实质修正。** 把结论摆前面，理由见 §6/§7。

1. **品类与引擎是高度契合的降维。** 自走棋的战斗半边 = **Game D（暗黑切片）的数据，减去玩家操控、加一支镜像敌队**。`aggro+steering+hitbox+caster+over-time+mortal` 已在 Game D 跑通验证。阶段流程 = 新落地的 `flow`（REQ-020）。商店 = 新落地的 `card-pile`（REQ-017）。经济 = Game E 已证的纯数据 banded。**MVP-0 可零新增 capability、纯数据落地。**

2. **单人优先 = 顺手拆掉引擎当前最吓人的未验证风险。** `SESSION-HANDOFF` 标注「物理浮点跨端确定性未在真双端验证（🟠）」。**单人自走棋没有对手客户端，不需要跨端 lockstep**，只需**同机**确定性（快照/回放/hash）——这块引擎是扎实的。所以「失败重试 = 从 PreparationPhase 快照恢复」天然成立，且把品类建在引擎的强项上。**建议单人 PvE 优先，PvP/联机押后。**

3. **Gemini 说「唯一难点是 `trait-counter`」——这是漏判。** 真正**最先撞上**的缺口，是整条 `Condition→Event→Effect→Caster` 逻辑链**只能寻址全局单例**（gold / 当前阶段），**无法寻址「本实体自己的 mana / 自己的冷却 / 触发自己的大招」**。一旦棋盘上出现**重复棋子**（自走棋的命脉——三个赵云合一个二星赵云），「自身蓝满→放自身大招」会**串台/错触**。`trait-counter` 是更晚（羁绊阶段）才撞上的**集合读**缺口；它还有个被 Gemini 完全没提的孪生缺口——**集合写**（把羁绊光环施加到一群单位）。三者同根：见 §6。

> 一句话总览：**MVP-0 不要一行新代码；但这个品类的"定义性玩法"（合体/羁绊）会逼引擎补上一条清晰的"实体寻址"轴——self、set-read、set-write。这条轴是这个立项给引擎的真正价值，也是真正的工作量。**

---

## 一、游戏概要

玩家在**备战阶段**用金币从**商店**抽英雄、上阵、排位、合成升星、配羁绊；在**战斗阶段**棋子**全自动**寻敌、走位、普攻攒蓝、放大招互砍；**结算阶段**按存活判胜负、扣血、给经济，循环抬难度。爽点在**构筑**（势力×职业的羁绊矩阵 + 升星 + 装备 + 锦囊微操），战斗本身零操作、靠通用战斗能力**涌现**。

**一句话**：花钱抽英雄、拼羁绊、自动开打，过一关赚钱再构筑 —— 一局自走棋。

三条支柱：

1. **主玩法 · 自动战斗（涌现层）**：棋子 = 一组组件（阵营/势力/职业 Tag + hp/mana Resource + Perception 索敌 + Steering 走位 + 普攻/大招 = 信号→caster→hitbox）。战斗整段无业务代码，由通用能力涌现。
2. **核心玩法 · 经济与抽卡（离散层）**：回合发钱 + 利息 + 连胜连败；商店刷 5 张随机英雄；买 = 扣钱进备战席；三连合成升星。
3. **构筑玩法 · 羁绊与锦囊（规则层）**：场上同势力/职业达阈值 → 全队光环（吸血/护盾/法强）；锦囊（消耗品）战斗中一次性微操干预（火烧连营 / 群体增益）。

---

## 二、核心循环（用 `flow` 表达，流程=数据）

> ⚠️ **本节已被超越**：下面的三态循环是设计期最简骨架。真实金铲铲的对局结构（局→阶段→回合三层、回合种类、经济/伤害/升星数值）
> 已按实际游戏研究定稿于 **`game-f-flow-spec.md`**，开发以那份为准。本节保留作为"流程=数据"形态的最初论证。

整局流程是**一份 `GameFlow` 数据**（`flow` capability，REQ-020，读如线性瀑布脚本），不是流程代码：

```
┌──────────────────────────────────────────────────────────────────────────┐
│  一关 = 备战 → 战斗 → 结算，循环抬难度（单人 PvE：敌队由关卡数据生成）          │
│                                                                            │
│   ┌──────────────┐      ┌───────────────┐      ┌──────────────────┐         │
│   │ Preparation  │─────▶│   Combat      │─────▶│   Resolution     │──┐      │
│   │ 发钱/利息/连胜 │ Ready │ 全自动战斗     │ 一方  │ 判胜负→扣血/给钱  │  │      │
│   │ 商店抽卡/买/合成│ 信号  │ aggro+steering │ 存活=0│ 淘汰判定→下一关   │  │      │
│   │ 排兵布阵      │      │ 普攻攒蓝/放大招 │      │                  │  │      │
│   └──────────────┘      └───────────────┘      └──────────────────┘  │      │
│          ▲                                                            │      │
│          └────────────────────  player_hp > 0 ?  ◀────────────────────┘      │
│                                  否 → GameOver                                │
└──────────────────────────────────────────────────────────────────────────┘
```

`GameFlow`（数据骨架，`when` 复用 `ConditionExpr`，动作 = `set-flag/set-state/modify-resource`）：

```jsonc
"GameFlow": {
  "id": "run_loop", "current": "prep", "entered": false,
  "states": [
    { "id": "prep",
      "onEnter": [
        { "kind": "modify-resource", "targetId": "gold", "op": "add", "value": 5 }  // 基础发钱（利息/连胜见 §4，用 banded EventWhen 叠加）
      ],
      "transitions": [ { "when": { "kind": "flag", "id": "ready" }, "to": "combat",
                        "do": [ { "kind": "set-flag", "targetId": "in_combat", "value": true } ] } ] },

    { "id": "combat",
      // 胜负：竞技场矩形里某队存活=0。用 Zone 数「敌队还有没有人」(count≥1→flag)，flag 落 false=打完。见 §5。
      "transitions": [
        { "when": { "kind": "flag", "id": "enemies_present", "equals": false }, "to": "resolution",
          "do": [ { "kind": "set-flag", "targetId": "won_round", "value": true } ] },
        { "when": { "kind": "flag", "id": "allies_present",  "equals": false }, "to": "resolution",
          "do": [ { "kind": "set-flag", "targetId": "won_round", "value": false } ] } ] },

    { "id": "resolution",
      "onEnter": [
        // 输了：玩家扣血（赢了走另一条 banded effect，略）。player_hp 是全局单例 Resource，可直接寻址。
        { "kind": "modify-resource", "targetId": "player_hp", "op": "add", "value": -1 } ],
      "transitions": [
        { "when": { "kind": "resource", "id": "player_hp", "cmp": "lte", "value": 0 }, "to": "gameover" },
        { "when": { "kind": "always" }, "to": "prep",
          "do": [ { "kind": "set-flag", "targetId": "ready", "value": false },
                  { "kind": "set-flag", "targetId": "in_combat", "value": false } ] } ] },

    { "id": "gameover", "onEnter": [ { "kind": "set-flag", "targetId": "run_over", "value": true } ] }
  ]
}
```

> 关键：流程里读写的 `gold / player_hp / ready / 阶段` 全是**全局单例**——`flow`/`event-when`/`condition` 按全局 id 索引，**对单例完美**。问题只出在「每个棋子各自的 mana/cooldown」这种**多份同名**资源上（§6 Gap A）。

---

## 三、数据映射：自走棋机制 → Apollo 现有能力（复用清单）

| 自走棋机制 | Apollo 能力（现成） | 形态 | 证据/备注 |
|---|---|---|---|
| 英雄个体 | `Prefab`（Tag+Resource+Perception+Steering+EventWhen+Caster 组装） | 数据 | = Game D `enemy()` 的超集 |
| 阵营 / 势力 / 职业 | `Tag.flags` 位掩码（队伍\|势力\|职业 全 OR 进一个 32 位字段） | 数据 | hitbox.targetMask / aggro.targetTag 已消费 Tag |
| 索敌 | `aggro`（`Perception{targetTag,sightRadius}` → `Relation{kind:'target'}`） | 数据 | Game D 已验证；目标死自动重选最近 |
| 走位互砍 | `steering{mode:'seek',speed,stopRange,haltStatusMask}` + `motion-apply` + `collision-resolve` | 数据 | Game D 怪追英雄即此 |
| 普攻（攻速冷却） | `Timer{loop}` → 信号 → `caster{at:'target'}` → 普攻 hitbox 模板 | 数据 | 见 §5；⚠️信号寻址见 §6 |
| 攒蓝 / 大招 | `EventWhen{when:mana≥100,mode:'edge'}` → 信号 → `caster` → 技能模板 → `Effect` mana 清零 | 数据 | ⚠️ 自身 mana 寻址见 §6 |
| 伤害 / 真伤 / 燃烧 / 冰冻 / 护盾 | `hitbox{amount/fracOfMax/targetMask/requireMask/setMask/clearMask/dot*}` + `over-time` | 数据 | Game D 冰冻/碎冰/灼烧三技能即此 |
| 死亡 / 淘汰 | `mortal{resource:'hp',atOrBelow:0,dropTemplate?}` | 数据 | Game D 已验证 |
| 玩家血量 / 扣血 | 全局单例 `Resource{id:'player_hp'}` + `flow`/`Effect` modify-resource | 数据 | 单例，寻址无歧义 |
| 阶段流程 备战→战斗→结算 | `flow`（`GameFlow` 声明式状态机，REQ-020） | 数据 | §2 |
| 胜负判定（一方存活=0） | `Zone{requiredTag:TEAM,count:1,outFlag}` + `flow` 转移读 flag==false | 数据 | 不需要 trait-counter，见 §5 |
| 经济 发钱/利息/连胜 | banded `EventWhen→Effect`（每档加固定值） | 数据 | Game E 已证「每\$5生\$1上限\$5」 |
| 商店 发5张/买/弃/刷新 | `card-pile{owner,deck,hand,handSize}` + `craft-recipe` 扣钱 | 数据 | REQ-017；⚠️等级加权概率是残余小缺口 §7 |
| 锦囊（AoE/DoT/治疗/护盾族） | 输入命令(tick+世界坐标) → 信号 → `caster{at:'pointer'}` → 生成 zone+hitbox+over-time 实体 | 数据 | = Game D「点地放火」；lockstep 安全（caster 绝不读相机） |
| 失败重试 | `World.snapshot()/restore()`（引擎特性），数据命令触发 | 引擎 | 单人同机确定性已扎实 |
| 多 PRNG 隔离（地图/商店/战斗） | 多个 `RandomSeed` 实体 | 数据 | 原则接受；选种接线细节押后 §7 |

**复用结论：上表除两行带 ⚠️/残余缺口外，全部是今天的引擎能直接跑的纯数据。** 这就是为什么 **MVP-0 零新代码**（§8）。

---

## 四、数据模板（按真实 schema 写，可直接照填）

### 4.1 Tag 位语义（数据约定，本游戏自有命名空间）

```ts
// 队伍
TEAM_A = 1<<0;  TEAM_B = 1<<1;
// 势力
SHU = 1<<2;  WEI = 1<<3;  WU = 1<<4;  QUN = 1<<5;
// 职业
WARRIOR = 1<<6;  TACTICIAN = 1<<7;  ARCHER = 1<<8;  ASSASSIN = 1<<9;
// 技能区/掉落
ZONE_FLAG = 1<<10;
// 状态（Status.flags，独立命名空间，hitbox setMask/clearMask + steering haltStatusMask 消费）
ST_BURNING = 1<<0;  ST_FROZEN = 1<<1;  ST_SHIELDED = 1<<2;
```

### 4.2 英雄 Prefab 示例 —— 赵云（蜀·猛将，近战，蓝满放「七进七出」）

```jsonc
// PrefabLibrary.templates["zhao_yun"] —— 一个英雄 = 一组组件（纯数据）
{ "entities": { "unit": {
  "Transform": { "x": 0, "y": 0, "rotation": 0, "scaleX": 1, "scaleY": 1 },
  "Velocity":  { "vx": 0, "vy": 0, "angular": 0 },
  "Shape":     { "kind": "box", "width": 16, "height": 16 },
  "Mass":      { "value": 1 },
  "Tag":       { "flags": "TEAM_A | SHU | WARRIOR" },          // 上阵时按队伍换位
  "Resource":  { "id": "hp",   "current": 700, "min": 0, "max": 700 },
  // ⚠️ MVP-0：mana 用「每英雄唯一 id」规避实体本地寻址缺口（§6 Gap A）；重复棋子需下沉后改回 'mana'
  "Resource2": { "id": "mana_zhaoyun", "current": 0, "min": 0, "max": 100 },
  "Perception":{ "targetTag": "TEAM_B", "sightRadius": 0 },     // 0=无限视野
  "Steering":  { "mode": "seek", "speed": 1, "stopRange": 18, "haltStatusMask": "ST_FROZEN" },
  "Mortal":    { "resource": "hp", "atOrBelow": 0 },
  // 普攻：loop Timer 周期产信号（详见 §5）
  "Timer":     { "id": "atk_cd_zhaoyun", "elapsed": 0, "duration": 45, "loop": true },
  // 蓝满放大招：自身 mana 越 100 → 发大招信号（edge 一次）
  "EventWhen": { "signal": "ult_zhaoyun", "mode": "edge",
                 "when": { "kind": "resource", "id": "mana_zhaoyun", "cmp": "gte", "value": 100 } },
  "Sprite":    { "textureKey": "hero_zhaoyun", "anchorX": 0.5, "anchorY": 0.5, "zOrder": 4 },
  "AnimState": { "clips": { "walk": {"from":0,"count":4,"fps":6,"loop":true}, "idle": {"from":0,"count":1,"fps":1,"loop":false}, "attack": {"from":4,"count":2,"fps":5,"loop":true} },
                 "moveClip":"walk","idleClip":"idle","attackClip":"attack","current":"idle","elapsed":0 },
  "Facing":    { "mode": "target" }
} } }
```

> 注：引擎「一实体一组件类型」。同实体两份 Resource（hp / mana）在装配层是两条组件记录——按现有写法用不同组件键承载（如 Game 内的装配辅助），或拆成「单位本体 + 蓝条挂件」两实体。MVP 落地时按 game-d 的 `as EntityBlueprint` 装配风格处理。

### 4.3 技能模板 —— 七进七出（赵云大招，索敌 AoE 真伤）

```jsonc
// PrefabLibrary.templates["skill_zhaoyun"]
{ "entities": { "area": {
  "Transform": { "x": 0, "y": 0, "rotation": 0, "scaleX": 1, "scaleY": 1 },
  "Shape":     { "kind": "box", "width": 90, "height": 90 },
  "Sensor":    {},
  "Tag":       { "flags": "ZONE_FLAG" },
  "Hitbox":    { "resource": "hp", "fracOfMax": 0.18, "targetMask": "TEAM_B" },  // 范围 18% 最大生命真伤
  "Timer":     { "id": "life", "elapsed": 0, "duration": 2, "loop": false },     // 瞬时自毁
  "Sprite":    { "textureKey": "fx_dragon_strike", "anchorX": 0.5, "anchorY": 0.5, "zOrder": 6 }
} } }
```

释放接线（数据，三个独立实体）：

```jsonc
// 1) 攒蓝：普攻命中→加蓝（与普攻同信号挂 Effect；MVP 简化为 loop Timer 每拍加蓝）
"FillMana_zhaoyun": { "Effect": { "onSignal": "atk_zhaoyun", "kind": "modify-resource", "targetId": "mana_zhaoyun", "op": "add", "value": 12 } },
// 2) 大招：EventWhen 发的 ult_zhaoyun → caster 索敌展开技能区
"Cast_zhaoyun":     { "Caster": { "onSignal": "ult_zhaoyun", "template": "skill_zhaoyun", "at": "target", "targetTag": "TEAM_B", "originEntity": "<赵云实体>" } },
// 3) 清蓝：放完归零
"Drain_zhaoyun":    { "Effect": { "onSignal": "ult_zhaoyun", "kind": "modify-resource", "targetId": "mana_zhaoyun", "op": "set", "value": 0 } }
```

### 4.4 经济（banded，纯数据；Game E 已证此形态）

利息「每持有 10 金 +1，上限 +5」**不是数学缺口**——拆成 5 条 banded `EventWhen→Effect`，天然封顶（只有 5 档）：

```jsonc
// 结算阶段进入时触发一次（与 flow resolution.onEnter 同拍；mode:level 仅在 in_resolution 为真时算）
"Interest_b1": { "EventWhen": { "signal": "give_interest", "mode": "edge", "when": { "kind": "and", "of": [ {"kind":"flag","id":"in_resolution"}, {"kind":"resource","id":"gold","cmp":"gte","value":10} ] } } },
"Interest_b2": { "EventWhen": { "signal": "give_interest", "mode": "edge", "when": { "kind": "and", "of": [ {"kind":"flag","id":"in_resolution"}, {"kind":"resource","id":"gold","cmp":"gte","value":20} ] } } },
// … b3(≥30) b4(≥40) b5(≥50) …
"DoInterest":  { "Effect": { "onSignal": "give_interest", "kind": "modify-resource", "targetId": "gold", "op": "add", "value": 1 } }
// 5 档各发一次 give_interest → 同名信号在场即 +1 ×命中档数 → floor(gold/10) 封顶 5。最弱 LLM 也能填这 5 行。
```

连胜/连败同理：`win_streak` 资源累加，banded 给金；对方结果到来时 `Effect set 0` 清零。

### 4.5 商店（`card-pile`，REQ-017）

```jsonc
// 商店 = 一个牌库 + 5 个槽：deck 预洗好的英雄码数组，handSize=5。买=play 该下标（移出 hand）+ craft-recipe 扣钱。
"Shop": {
  "CardPile":   { "owner": "p1", "deck": [ /* 用 Shop-RNG 预洗好的英雄码 */ ], "hand": [], "handSize": 5 },
  "PlayedHand": { "owner": "p1" }   // 选购的英雄落到这里 → 装配层据码展开对应英雄 Prefab 进备战席
}
"Buy": { "CraftRecipe": { "onSignal": "buy_slot", "costs": [ { "id": "gold", "amount": 3 } ] } }  // 扣钱与选购同拍原子
```

> `card-pile` 覆盖「发牌/选/弃/补」全流程且确定性。**残余缺口**：TFT 的「等级越高越易出高费卡」加权概率——`card-pile` 是顺序抽预洗牌库，加权得**烘进洗牌**。MVP 用固定赔率（按等级预置不同权重的牌袋数据）即可，无需新代码；动态等级加权押后 §7。

---

## 五、自动战斗机制细节（关键接线，避免踩坑）

- **两队对冲**：A 队单位 `Perception.targetTag=TEAM_B`，B 队反之。`aggro` 写 `Relation(target)` → `steering` seek 到 `stopRange` 贴脸 → `motion`/`collision` 收尾。目标死了 `aggro` 自动重选最近敌人。**= Game D 怪追英雄，乘以两队。**

- **普攻不靠几何判距**：`caster{at:'target'}` 直接把伤害**生成在目标身上**——所以 MVP**不需要**「攻击距离 gate」。单位走到 `stopRange` 贴脸只是表现；普攻链 = `Timer{loop,duration=攻速}` → 产 `atk_*` 信号 → `caster` 展开普攻 hitbox 模板（小盒，targetMask=敌队）。攻速 = Timer.duration。远程 vs 近战的差异 = `stopRange` 大小 + hitbox 生成位置，**纯数据调**。

- **胜负判定用 `Zone` 不用 `trait-counter`**：竞技场放两个 Zone——
  `Zone{requiredTag:TEAM_B, count:1, minX..maxX=竞技场, outFlag:"enemies_present"}` 与同款 `allies_present`。
  某队存活=0 → 对应 flag 落 `false` → `flow` 的 combat 转移命中（§2）。Zone 是「≥阈值」语义，「存活=0」= 「`present` flag == false」，`flow`/`condition` 支持 `equals:false`，**无需新增**。

- **冰冻定身**：`hitbox.setMask=ST_FROZEN`+`statusDuration` → `over-time` 定时解冻；`steering.haltStatusMask=ST_FROZEN` 被冻则停。Game D 原样。

- **性能注记**：`aggro` 的 `nearestByTag` 是 O(N²) 全扫，`hitbox` 每拍 overlap，`World.query` 全表扫 + 每拍分配（`SESSION-HANDOFF` 标 🟠 性能债）。**MVP 棋盘控制在每边 ~6–12 个单位**，量级安全；大棋盘 / 满屏 DoT 会压到这条债——届时再谈 archetype/索引。

---

## 六、⭐ 架构评审：品类暴露的真缺口 = 一条「实体寻址」轴（manifesto §4 下沉纪律）

**这是本设计最重要的一节，也是 Lead 对 Gemini 提案的核心修正。**

前 5 个游戏，逻辑链（`Condition→Event→Effect→Caster`）只需要寻址**全局单例**（gold / score / 阶段 / 好感）+ 每实体的**物理**（hp 经 resource-apply 本地路由、mortal 本地读）。**从没有过「很多个结构相同的实体，各自需要‘对自己’做条件判断/触发/施效」的场景。** 自走棋第一次把这条轴压满。三个缺口同根：

### Gap A —— 「self 寻址」：实体本地的条件/信号/施效（**最先撞上，MVP-1 即需，Gemini 漏判**）→ 已立 **REQ-021**

- **现象（读侧）**：`event-when` 的 `when` 用 `buildConditionLookup` 按**全局 id**索引 `Resource`（`condition.ts:23-44`，同 id 取第一份）。于是「单位 U 的 `EventWhen{when: mana≥100}`」里的 `mana` 解析成**世界里第一份 mana**，不是 U 的。多个同名 mana → 串台。
- **现象（写侧）**：`caster` 收集**全局信号名集合**（`caster.ts:89-94`），任一单位发 `cast_attack`，**所有**监听该名的 caster 一起触发；`effect-apply`/`craft-recipe` 同理按全局名/全局 id。
- **为什么 Game D 没暴露**：Game D 只有 1 个英雄、每技能唯一信号名、单例资源，永远撞不上。
- **MVP-0 如何规避**：用**一组互不相同的英雄**，每英雄**唯一 id**（`mana_zhaoyun`、`atk_zhaoyun`、`ult_zhaoyun`…）。把「很多个相同」退化成「几个不同的单例」，现有链就够 → **零新代码**（§8）。
- **何时必须还债**：**重复棋子 / 三星合体**——自走棋的命脉。3 个赵云共享 `mana_zhaoyun` → 全局索引里互相串。唯一 id 无法烘进**共享 Prefab 模板**（同模板展开的实例必然同名）。
- **能否纯数据重组绕过？** 不能：模板化的重复实例必然同 id/同信号，数据层无法给运行时实例发唯一名。→ **真缺口，须下沉。**
- **下沉草案（小、通用、利好所有游戏）**：给 `event-when` / `caster` / `effect-apply` / `craft-recipe` 增一个**实体本地**开关——
  - 读侧：`EventWhen{ scope:'self' }` → `when` 的叶子先在**本实体**找同 id 组件，找不到再回退全局。
  - 写侧：`Caster`/`Effect` 匹配信号时认 `Signal.source`（`event-when` 已经盖了 `source=eid`，`caster` 只是没读），`scope:'self'` 只响应**本实体/本源**的信号。
  - 本质 = 「一个实体用自己的条件，触发自己的效果」，是**普适**能力（不止自走棋）。审计/确定性都简单。
- **优先级**：**高**（任何重复棋子都需要），但**晚于 MVP-0**。

### Gap B —— 「set 读」：`group-count`（羁绊计数，Phase 3，Gemini 正确点名）→ 已立 **REQ-022**

- **现象**：`Condition` 只能对**单实体**叶子比较，无法对**一组实体**求统计（「场上几个蜀？几个刺客？」）。
- **能否用 `Zone` 重组？** 部分能、但不够：`Zone` 数的是**实时位置**落在矩形内的实体（战斗中单位四散移动 → 计数闪烁）、且只给**布尔**（≥阈值）。羁绊需要 ① 按**阵容归属**（`Relation`/owner，与位置解耦，**战斗开始那一拍锁定**）计数；② 拿到**数值**计数（群雄「越少越强」要真实数字、UI 要显示「2/6」）。Zone 两者都给不了。
- **结论**：`trait-counter`（按 tag+归属计数 → 越阈值发信号 + 写 count 资源，**战斗开始拍触发一次并锁存**，不是每帧）是合法下沉。**先例**：Balatro 的 `poker-hand`/`pattern-score` 就是这个形状（对一手牌做集合评估）。Gemini 提案里「每帧执行 trait-counter」是**错的**——羁绊应在备战→战斗那一拍**算一次并锁存**（TFT 语义：开战锁定，中途死人不掉羁绊），既对又省。

### Gap C —— 「set 写」：羁绊光环的**施加**（Phase 3，与 B 同时撞上，Gemini 完全没提）→ 已立 **REQ-023（评估中/倾向先重组）**

- **现象**：就算 `trait-counter` 发了 `sig_shu_3`，效果「**所有**蜀国单位 +15% 吸血」要落到**一群**单位上。`effect-apply` 只能改**一个** `targetEntity` 或**一个**全局 id 资源——**没有对一组查询结果 fan-out 的原语**。
- **两条路**：(a) 下沉 `group-effect`（query → 对每个命中实体施效）的**集合写**能力；(b) 把羁绊建模成**全局 stat 资源**，让战斗能力去读（要求 hitbox/steering 等读全局 stat——也是引擎改动）。
- **诚实结论**：**逐单位羁绊光环不是免费的**，Phase 3 必须做一次明确的引擎抉择。这正是 Gemini 乐观估计掩盖的成本。
- **建议**：Phase 3 先下沉**窄的** `trait-counter`（集合读）；施加侧**优先**走「全局 stat + 能力读全局」的羁绊（已有 effect-apply 全局路由可改全局值），把**逐单位 fan-out** 推到「真有羁绊非它不可」时再下沉通用 `group-effect`。**不为想象中的需求提前拓宽引擎（YAGNI，CLAUDE.md 警示）。**

> **三缺口一句话**：self（Gap A / REQ-021）、set-read（Gap B / REQ-022）、set-write（Gap C / REQ-023）。**这条「实体寻址轴」就是这个立项给引擎的真正增量**——不是散点功能，是一条连贯的、所有未来「军团 / 编队 / 群体 buff」品类都会用到的词汇。三条已抽象为引擎级需求入池 `docs/workflow/requests.md`，交主程评估/开发。

---

## 七、回驳 / 暂缓清单（带理由，manifesto §4 重组优先 + YAGNI）

| 提案项 | 裁决 | 理由 |
|---|---|---|
| 锦囊·**草船借箭**（远程物理伤害转法力，3 秒） | **MVP 砍，暂不下沉** | 需「伤害分型」+「按目标状态把伤害重定向到另一资源」。`hitbox` 既无伤害类型、也无条件重定向。是长尾**单卡**，为它拓宽引擎违背 YAGNI。要做先下沉「typed-damage + redirect」通用能力，不为一卡开洞。 |
| 锦囊·**调虎离山**（区域击退/排斥） | **MVP 砍，暂不下沉** | 需「区域→速度冲量」。`hitbox` 只改资源/状态，无击退原语；不可纯数据重组。单卡，押后；要做下沉小 `impulse` 能力。 |
| **单人 Roguelike DAG 地图**（杀戮尖塔式 MapGraph） | **暂缓到 Phase 4** | 可纯数据重组：`StringVar currentNode` + `clickable` 选点 + `condition→effect` 路由载入遭遇。数据管线略啰嗦但可行，**不必现在下沉 `graph-nav`**。MVP 用线性关卡序列即可。 |
| **Boss Intent 预告**（读条危险区） | **暂缓** | 可重组：`State`(决策)+`Timer`(读条)+`Zone`/`Sprite`(预警区)+`condition→hitbox`(读条满)。**不提前做一等公民 `Intent` 组件**。 |
| **遗物/天赋**（局外成长） | **部分接受 / 部分暂缓** | 改**全局**资源的遗物（如「全局吸血 stat +10%」）今天就能 `effect-apply` 纯数据做 → **接受**。逐友军 fan-out 的（太平要术「友军死→全体回血」）撞 Gap C → **暂缓**到那条轴下沉后。 |
| 「**每帧**跑 trait-counter」 | **改设计** | 羁绊应**开战那一拍算一次并锁存**（TFT 语义 + 省 N² 全扫），不是每帧。见 §6 Gap B。 |
| **PvP / 共享卡池 / 联机** | **暂缓** | 跨端浮点确定性引擎未验证（🟠）。单人只需同机确定性（已扎实）。先单人把品类跑透，押后 PvP。 |

---

## 八、分阶段路线（按"还几次债"切，MVP-0 零新代码）

| 阶段 | 内容 | 新增 capability | 数据/代码 |
|---|---|---|---|
| **MVP-0** | 一组**互不相同**的 6–8 英雄、两队、`flow` 阶段机（备战买人→战斗自动互砍→结算扣血/淘汰）、`aggro+steering+普攻+蓝满大招+over-time+mortal`、`Zone` 判胜负、banded 经济、`card-pile` 固定赔率商店 | **0** | **100% 数据** |
| **Phase 1** | 装备（`effect-apply` 改单位资源）、锦囊（AoE/DoT/治疗/护盾族 = 命令→caster→生成）、更多英雄、站位 | **0** | 数据 |
| **Phase 2** | **下沉 Gap A（实体本地寻址）** → 解锁**重复棋子 + 三星合体**（合成 = `card-pile`/`craft` 三合一升级 Prefab）；可选商店动态等级加权 | **1（实体本地寻址）** | 数据 + 一次引擎下沉 |
| **Phase 3** | **下沉 Gap B（`trait-counter`）+ 决策 Gap C（施加路径）** → **羁绊系统**（势力/职业矩阵光环） | **1–2** | 数据 + 引擎抉择 |
| **Phase 4（可选）** | 单人 Roguelike 元层：StS 风 DAG 地图（重组或下沉 `graph-nav`）、Boss Intent 预告（重组）、遗物（全局型先上，fan-out 型待 Gap C） | 0–1 | 数据为主 |

> **MVP-0 直接命中用户提的闭环**：「买人 → 上场 → 走到对面互砍 → 血扣完死」。它证明**金铲铲核心 = Game D 的数据重组**，且不写一行新引擎代码。

---

## 九、确定性 / 风险注记（最高强度自审）

- ✅ **单人 = 绕开引擎最大未验证风险**：无对手客户端 → 不需跨端 lockstep；同机快照/回放/hash 已扎实 → 「失败重试从备战快照恢复 + 同 seed 同结果」天然成立。
- 🟠 **性能债**：N² 索敌 + 每拍 overlap + `World.query` 全扫。MVP 控小棋盘（每边 ≤12）。
- 🟠 **多 PRNG 隔离**：地图/商店/战斗各一个 `RandomSeed`，防 S/L 漏洞 + 战斗暴击不污染商店序列。Phase 2 接线（哪个能力读哪个种子需小约定）。
- 🔴 **仍没在真浏览器看过一帧**（引擎级 🔴）。MVP-0 验收靠 vitest 确定性 + 离线看帧（对齐 Game D `render-frame.ts`），不口嗨「画面对」。

---

## 十、美术（像素三国，简述，不喧宾夺主）

像素风是小团队明智解：UI/立绘/棋子/棋盘统一风格。换色分势力（红=蜀/蓝=魏/绿=吴）。

- **itch.io**：搜 `retro RPG sprite` / `tactics character` / `strategy pixel art`（Slynyrd / Szadi art / Cainos）。
- **OpenGameArt.org**：搜 `Three Kingdoms` / `Dynasty`（免费开源）。
- **AI 生成 + Aseprite 后处理**：生成立绘/图标 → Aseprite 降阶切片，适配引擎 `Sprite`/`SpriteSheet`/`Frame`。
- 落地走引擎现有**资产流程（R9 TBF 清单）**，先占位方块（同 Game D），真资产后补。**美术不阻塞 MVP-0 逻辑闭环。**

---

## 十一、MVP-0 验收清单（全绿才算跑通）

1. `flow` 阶段机：备战→战斗→结算→备战 循环，`player_hp` 归零进 gameover（vitest）。
2. 两队各 3 单位对冲：30–60 tick 后一队存活=0，`Zone` flag 落 false 触发结算（vitest）。
3. 普攻攒蓝 → 蓝满 `EventWhen(edge)` 发大招信号 → `caster` 展开技能区 → `hitbox` 扣血 → mana 清零（vitest，单英雄唯一 id）。
4. 经济：banded 利息封顶 5、连胜清零正确（vitest）。
5. 商店：`card-pile` 发 5 张、`buy_slot` 信号 + `craft-recipe` 扣钱、补牌（vitest）。
6. **确定性**：同 seed 跑两遍 `engine.hash()` 全等（vitest，对齐各游戏首测）。
7. 离线看帧：`vite-node` 渲一帧确认棋子/技能区位置合理（对齐 Game D）。

> 复诵：**整个自走棋是数据；代码只在 MVP-0 之后、为"实体寻址轴"下沉那几次，且加在引擎。** 战斗的每一拍都从通用能力涌现，不写一个游戏 system。
