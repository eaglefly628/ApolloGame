# Game F · v1 实装数据包 ·「虎豹铁骑」(照填 T2/T5)

> 主策划 ｜ 2026-06-13 ｜ ① 的玩家侧实装数据。配 `game-f-core-combat-dev.md` 的 **T2(牌组加载器)/T5(首发牌组)**;太阁侧(T1)见 `game-f-taikou-roster.md` §六/§七。
> ⛔ 全是数据。最弱 LLM 也能产出每一行 `{id, op, target, value}` → 符合宪法。数值=首版待平衡。

---

## 一、Tag 约定(与 roster §五一致)

- 队伍:`TEAM_A`(玩家)/ `TEAM_C`(太阁)。势力:`WEI=1<<3`。职业:`WARRIOR/TACTICIAN/ARCHER/ASSASSIN`。
- **兵种(数据约定,无引擎改动)**:`CAVALRY=1<<11` / `INFANTRY=1<<12`。**「魏骑」= `WEI & CAVALRY` 双位**。

---

## 二、「虎豹铁骑」牌组 = 5 张 Build 卡(T5 照填 + T2 加载器输入)

> 牌组数据 = 一个卡数组。加载器(T2)在 Run 开始把每张卡**物化成规则实体**(列在「物化为」)。

```jsonc
// deck_hubao —— 虎豹铁骑(魏·速攻);初始势力出生点建议 WEI(顺风)
{
  "id": "deck_hubao", "name": "虎豹铁骑", "style": "魏·速攻", "faction": "WEI",
  "cards": [ "hubao_ling", "sugong_ling", "muping", "tujin", "planet_wei" ]
}
```

| 卡码 | 名 | 类型 | 效果(首版) | 物化为(加载器产) | 判定 |
|---|---|---|---|---|---|
| `hubao_ling` ⭐ | 虎豹骑令 | Build | 每有 1 魏骑·全骑 atk +8% | **group-count**{countMask: WEI\|CAVALRY, write:`buf_wei`, perUnit:0.08, 开战锁存} → `buf_wei` 进全军魏骑 strike 的 `scaleByResource` | ✅ |
| `sugong_ling` | 速攻令 | Build | 前 3 回合·全军 atk +15% | **EventWhen**{when: `round` ≤3} → Effect 写 `buf_early`=1.15(否则 1.0) | ✅ |
| `muping` | 募兵 | Build | 商店魏国权重 ×1.6 | card-pile.deck **预配权重牌袋**(WEI 武将占比↑,烘进洗牌) | ✅ |
| `tujin` | 铁骑突阵 | Build | 魏骑移动速度 +20% | 魏骑用 **steering 模板变体**(speed×1.2)——per-unit 走模板,非活系数 | 🟡重组 |
| `planet_wei` | 星球·魏 | 星球 | 魏羁绊全档阈值 −1(更易触发) | group-count 的魏档位阈值 −1 | ✅ |

> **加载器关键约定(给 T2)**:多张 Build 卡对**同一类单位**的 atk 加成,**聚合进该单位 strike 的单一 buff 资源**(如 `buf_wei` 与 `buf_early` 由加载器相乘/累加进一个 `buf_wei_total`),hitbox 只读一个 `scaleByResource` → 不碰"hitbox 读多源活系数"的缺口。**这是 v1 全队 buff 能纯数据落地的关键技巧。**

---

## 三、魏武将可买池(T5;备战商店刷这些,够撑起魏骑连携)

> 普攻 = `Timer{loop,duration=间隔}` → 信号 → caster@target → strike hitbox{amount=atk, targetMask=TEAM_C, **scaleByResource:`buf_wei_total`**(魏骑)}。大招 = `EventWhen{mana≥100,self}`(REQ-021)→ caster → 技能 hitbox。

| 武将码 | 名 | 费 | hp | atk | 间隔s | 射程 | 职业·兵种 | 大招(mana 满) | 是魏骑? |
|---|---|---|---|---|---|---|---|---|---|
| `xiahoudun` | 夏侯惇 | 2 | 650 | 65 | 0.9 | 1 | WAR·CAV | 拔矢啖睛:自身回血+斩前排 | ✔ |
| `zhangliao` | 张辽 | 3 | 600 | 70 | 0.9 | 1 | WAR·CAV | 突骑冲阵:冲到最远敌 AoE | ✔ |
| `xuhuang` | 徐晃 | 2 | 620 | 62 | 1.0 | 1 | WAR·CAV | 长驱直入:贯穿直线伤害 | ✔ |
| `zhanghe` | 张郃 | 3 | 600 | 60 | 0.9 | 2 | WAR·CAV | 巧变:换位扰敌 | ✔ |
| `dianwei` | 典韦 | 4 | 750 | 65 | 1.0 | 1 | WAR·INF | 古之恶来:范围猛击 | ✘(步) |
| `xuchu` | 许褚 | 3 | 800 | 58 | 1.1 | 1 | WAR·INF | 虎痴:自身减伤狂攻 | ✘(步) |
| `caocao` | 曹操 | 5 | 700 | 60 | 1.0 | 2 | WAR·TAC | 奸雄:全军 buff(羁绊核心) | ✘(帅) |

> v1 商店给这 7 个(经 `muping` 加权后魏占多)即可让「虎豹铁骑」成型:堆 4+ 魏骑触发 `hubao_ling`,夏侯惇/张辽当核心。曹操作魏羁绊催化。

---

## 四、牌组加载器(T2)语义小结

```
Run 开始,读 deck_hubao.cards:
  hubao_ling  → 造 group-count 实体(数 WEI&CAVALRY → 写 buf_wei)
  sugong_ling → 造 EventWhen(round≤3 → 写 buf_early)
  muping      → 改 card-pile.deck 权重(WEI ×1.6)
  tujin       → 标记:魏骑装配用 speed×1.2 的 steering 变体
  planet_wei  → 魏羁绊阈值 −1
  ── 加载器把 buf_wei × buf_early 聚合进 buf_wei_total ──
  魏骑 strike.hitbox.scaleByResource = "buf_wei_total"   ← 全队 buff 入口(单资源)
```

---

## 五、v1 验收(照这条走查)

1. 装 `deck_hubao` → 备战商店明显多魏(`muping` 生效)。
2. 上 4+ 魏骑 → 开战 `buf_wei_total` > 1,魏骑伤害随魏骑数上升(`hubao_ling` 生效)。
3. 前 3 回合伤害更高(`sugong_ling`)。
4. 打 `game-f-taikou-roster.md` 九州 **W1→W2** → 结算扣血/给金/记 `contribution` → 进度条累加。
5. vitest 确定性 hash 绿。

## 六、实装核验(对真实代码)+ buff 精确构造配方(§二简写以本节为准)

**已核四个能力的真实签名(2026-06-13):**
- `card-pile{owner, deck(预洗牌码 number[]), hand, handSize}` → 募兵「预配权重牌袋」**写法正确**(把更多魏码烘进 deck)。
- `self-rule{when(读自身组件), do:[{kind:set-flag|modify-resource|set-state|destroy|spawn, op?,value?,template?,at?}], once?}` → 招降/铺场/「万军取首·张飞击杀回蓝」**写法正确**(spawn 发 SpawnRequest;self 条件读自身)。
- `effect-apply`:`Effect{op:'add'|'mul'|'set', order, valueFrom:{resourceId,coeff?,timesResourceId?}}` —— 有序结算 + 动态值,**够拼 buff 倍率**。
- 🔴 **修正**:`group-count{countResource, requiredTag(含齐 ALL-bits 语义)}` **每 tick 把"数量" set 进 countResource**,**无** `perUnit`、**无锁存**、**不直接产 buff**。§二「虎豹骑令」那行的一步写法作废,改用下面配方。

**buf 精确构造配方(给 T2,照这个拼):**
```
① 计数:  GroupCount{ countResource:'wei_cav_count', requiredTag: WEI|CAVALRY }   // 每tick set 魏骑数
② 转倍率(每tick信号 'buff_tick'=一个 loop Timer 驱动,两 Effect 按 order 结算):
     Effect{ onSignal:'buff_tick', target:'buf_wei', op:'set', value:1,                      order:0 }
     Effect{ onSignal:'buff_tick', target:'buf_wei', op:'add',
             valueFrom:{ resourceId:'wei_cav_count', coeff:0.08 },                            order:1 }
     → buf_wei = 1 + 0.08 × 魏骑数        (虎豹骑令)
③ 速攻令同法:  EventWhen{ when: round ≤3 } → buf_early = 1.15,否则 1.0
④ 聚合成单一 scaleByResource(用 valueFrom.timesResourceId 两资源相乘):
     Effect{ target:'buf_wei_total', op:'set', valueFrom:{ resourceId:'buf_wei', timesResourceId:'buf_early' } }
     → buf_wei_total = buf_wei × buf_early
⑤ 魏骑 strike.hitbox.scaleByResource = 'buf_wei_total'     // hitbox 只读一个资源(已核 §REQ-F-047)
```
- **注**:用 **live 每-tick 计数**(非开战锁存)——魏骑中途阵亡 buff 会随之降,MVP 可接受;TFT 式「开战锁存」是后续 refinement(给 group-count 加一个"仅 prep→combat 那拍刷新"的门,届时评估)。
- **这套(group-count 计 → 有序 Effect 转倍率 → timesResourceId 聚合 → 单一 scaleByResource)就是"全队 buff 纯数据落地"的真实配方**,已逐能力核验可行,零新缺口。

---

> 复诵:虎豹铁骑 5 卡 + 7 魏武将 + buff 构造配方(§六,已对真实代码核验),全纯数据、零缺口依赖。T1 填 roster 九州 W1–W2,T5 填本包,T2 照 §六配方 → v1 闭环不 block。
