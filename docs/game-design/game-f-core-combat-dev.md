# Game F 核心战斗 · 程序开发交接单(v1 实现单)

> 主策划 ｜ 2026-06-13 ｜ **给主程/程序员 session 的 v1 开发单**。目标:先把**核心战斗闭环**跑出来,经济深化/多人/市场/天梯**全部后置**。
> 配套设计:`game-f-cards-and-decks.md`(卡牌哲学)、`game-f-deck-spec.md`(10 套牌组 + D0 结论)、`game-f-auto-chess.md`(战斗映射基线)、`game-f-flow-spec.md`(数值真相)。
> ⛔ 宪法照旧:**游戏=数据**。本单要程序员做的,几乎全是**数据装配 + 一个薄加载器**;新引擎能力只有两个**已入池的可选缺口**(F-061/062),且 **v1 不依赖它们**。

---

## 〇、v1 范围(只做这些,别多做)

**做**:单机一条命,**载入牌组 → 备战买武将 → 自动打太阁守军波次 → 结算(扣血/给钱/算贡献)→ 多波循环 → 岛陷落出结果**。
**不做(后置)**:三人联机 / 掷点分卡 / 交易市场 / 天梯 / 经济深化 / 局外收藏组牌。
**首发牌组**:「**虎豹铁骑**」(`game-f-deck-spec.md` §1)——全 ✅复用、**零缺口依赖**,是验证闭环的最简基线。

---

## 一、复用清单(已 done,**严禁重写**)

| 能力 | 状态 | 用途 |
|---|---|---|
| 战斗涌现链 `aggro+steering+hitbox+caster+over-time+mortal` | done(MVP-0) | 全自动战斗本体 |
| 六角棋盘 + A* 寻路(REQ-F-024~028) | done | 布阵 + 走位 |
| 多回合 `round_flow` + 单回合 `flow`(REQ-020/F-032/033) | done | 备战→战斗→结算→下一波循环 |
| 商店 `card-pile`(REQ-017) | done | 备战抽武将 |
| banded 经济(Game E 已证) | done | 发钱/利息/连胜 |
| `group-count`(REQ-022) | done | 连携/职业/势力计数→越阈值信号 |
| `self-rule` + `spawn` 动作(REQ-021 @299b498) | done | 自身蓝满放自身大招 / 按表生成单位 |
| hitbox `scaleByResource` 全局系数(REQ-F-047) | done | 全队统一 buff 的承载 |
| `Zone` 胜负判定 + 状态同步打包层(@8060cb9) | done | 存活判定 / 后续多人镜像底层 |

> **结论:核心战斗的"零件"全在货架上。** v1 的工作量 = 把它们按下面 5 个任务**装配成数据** + 写一个薄"牌组加载器"。

---

## 二、新建任务清单(v1,给程序员逐条)

| # | 任务 | 做什么 | 复用 | 验收 |
|---|---|---|---|---|
| **T1** | 太阁 PvE 对手装配 | 关卡表数据(每波=太阁 prefab 列表 + 落点)+ Combat 开始按表 `spawn` 敌波 | `round_flow` + `spawn`(REQ-021) | 玩家阵 vs 太阁波自动开打、可分胜负 |
| **T2** | **牌组加载器**(唯一新逻辑) | 输入 Build 牌组数组 → Run 开始**物化成规则实体**(商店权重 / group-count / 全局 buff 资源 / banded / spawn 规则) | 全部下游能力已 done | 装「虎豹铁骑」→ 商店魏国变多 + 魏骑越多全队攻越高(scaleByResource 生效) |
| **T3** | 贡献度计量(单机 scaffold) | 对太阁造成伤害/击杀 → 累加 `contribution` 资源;击杀归属读 `Signal.source` | `Signal.source`(REQ-021 域) | 一局结束 `contribution` 数值正确 |
| **T4** | 岛屿进度条 | 单机的攻岛进度资源,每波贡献累加,满则 Run 结束 | banded / 资源 | 清完关卡表 → Run 正常结束出结果 |
| **T5** | 首发牌组「虎豹铁骑」全数据落地 | 5 张卡 + 太阁前 2 波,纯数据 | `game-f-deck-spec.md` §1 | 能用它从头打到尾一局 |

> **T2 牌组加载器是唯一"新代码"**,而且它不发明能力——只是"读牌组数据 → addComponent 出对应的 EventWhen/Effect/group-count/CardPile 权重实体"。最弱 LLM 也能产出牌组数据 → 符合宪法。

---

## 三、过程图:对局流程(Run → Round → Phase)

```
[Run 开始]
  │ 载入 Build 牌组(5–8 卡)+ 选初始势力
  │ → T2 牌组加载器:每张卡 → 规则实体(商店权重/group-count/全局buff/banded/spawn)
  ▼
┌──────────────── Round 循环(round_flow,已 done)──────────────────┐
│  [备战 Prep]                                                      │
│    商店(card-pile)刷 5 武将  ← 牌组偏置权重(T2)                  │
│    买 / 合成升星 / hex 布阵                                       │
│    玩家 ready ──┐                                                 │
│                 ▼  ready 信号                                     │
│  [战斗 Combat]  ← T1 太阁守军波次按关卡表 spawn                   │
│    全自动涌现战斗链(见 §四 程序流程图)                          │
│    牌组 Build 效果生效(全局 buff 资源 + scaleByResource)         │
│    T3 贡献度:对太阁伤害/击杀 → 累加 contribution                 │
│                 │  某方存活=0(Zone present flag)                │
│                 ▼                                                 │
│  [结算 Resolution]                                                │
│    判胜负 → 扣 player_hp / 给金(banded)/ 连胜                    │
│    (Boss 波掉宝箱 = 战利 Run 牌;v1 单机直取,掷点后置)           │
│    T4 岛屿进度 += 本波贡献                                        │
│                 │  player_hp>0 且 岛未陷?                        │
│        ┌── 是 ──┴── 下一 Round(抬难度/下一波太阁)──┐            │
│        │                                            └──(回 Prep) │
│        └── 否 ↓                                                   │
└──────────────────────────────────────────────────────────────────┘
  ▼
[Run 结束]  岛陷落 → 出贡献度结果(v1 单机=自己的分;多人=岛主排名,后置)
            或 player_hp=0 → GameOver
```

---

## 四、程序流程图:战斗 per-tick ECS 系统管线(确定性定序)

```
每 tick(确定性 tick 循环):
  ① aggro            Perception → 最近敌(nearestByTag)→ Relation(target)
       │ runsBefore motion-apply
  ② steering         朝 target seek 到 stopRange(haltStatusMask 冻结则停)
  ③ grid-move / motion-apply + collision-resolve   六角 A* 走位 + 收尾
  ④ Timer(loop)      攻速到点 → 普攻信号; EventWhen(mana≥100,self)→ 大招信号
       │ (REQ-021 self 域:各棋子触发"自己的"信号,不串台)
  ⑤ caster(at:target) 信号 → 在目标身上展开 hitbox 模板(普攻盒/技能盒)
  ⑥ trigger-zone     伤害区 ∩ 目标 → Trigger{zone,other}(AoE=N 个 Trigger)
       │ runsAfter
  ⑦ hitbox           读 Trigger:targetMask(阵营)+ requireMask(状态)门 →
                     伤害 = amount + fracOfMax,× scaleByResource(全局系数,= 牌组buff入口)→
                     ResourceModify(local) + 置/清 Status + 挂 OverTime(DoT/定时)
       │ runsBefore resource-apply, over-time
  ⑧ over-time        DoT / 定时状态 tick
  ⑨ resource-apply   结算 ResourceModify → 改 target.hp(逐目标,累加不丢)
  ⑩ mortal           hp≤0 → DestroyRequest + dropTemplate(招降标记/碎片)
                     ↑ T3 贡献归属:读致死 Signal.source → 记该玩家 contribution
  ⑪ zone-occupancy   统计存活 → present flag(enemies/allies)
  ⑫ flow             读 flag==false → Combat → Resolution 相位转移
```

> 精确 `runsAfter/runsBefore` 以各 capability 定义为准(hitbox 已声明 runsAfter trigger-zone、runsBefore resource-apply/over-time;aggro runsBefore motion-apply)。以上为逻辑执行序。

---

## 五、数据流图:牌组 → 战斗偏置(T2 的本质)

```
Build 牌组数据 [卡码 …]
   │ T2 牌组加载器(Run 开始物化一次)
   ├─ 商店偏置卡 ──▶ 预配权重牌袋(card-pile.deck 洗入更多某势力)
   ├─ 连携/职业卡 ─▶ group-count 实体(开战锁存计数 → 越阈值信号)
   ├─ 全队 buff 卡 ─▶ 全局 buff 资源实体  ◀── hitbox.scaleByResource 读它
   ├─ 经济卡 ──────▶ banded EventWhen → Effect(gold)
   └─ 招降/铺场卡 ─▶ self-rule spawn 规则
   ──────────────────────────────────────────────
   缺口卡(v1 不选):白衣·斩杀 = REQ-F-061  ｜  绕后 = REQ-F-062
```

---

## 六、不阻塞声明 + 验收

- **两个缺口 REQ-F-061(hp条件伤害/处决)、REQ-F-062(aggro索敌策略)只服务特定牌组(白衣/绕后),v1 用「虎豹铁骑」完全不碰**。主程可**并行**评估这两个 REQ,不阻塞核心战斗 v1。
- **v1 整体验收**:装「虎豹铁骑」→ 备战买魏骑布阵 → 自动打太阁前 2 波 → 结算扣血/给金/记贡献 → 多波循环 → 岛陷落出结果;**vitest 确定性 hash 绿 + 离线看帧**(对齐 Game D `render-frame.ts`,不口嗨画面对)。
- **太阁守军的具体阵容/技能数据**:我正在出 `game-f-taikou-roster.md`(第二步),T1 的关卡表填它即可;v1 先用前 2 波最简杂兵起步,不等全 roster。

> 复诵:核心战斗零件全在货架上;v1 = 5 个装配任务 + 一个薄牌组加载器,纯数据为主,零缺口依赖。先把这条闭环跑绿,再谈太阁全谱 / 经济 / 多人 / 市场。
