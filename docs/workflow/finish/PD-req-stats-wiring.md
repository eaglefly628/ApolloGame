# 对齐需求 → Programmer D：把 `stats.effective` 接进战斗消费侧

> Lead 出 spec，D 实现。背景：① `stats` 能力（`@skills/tier2/stats`）已落地——`Stats{base,mods,effective}`，
> `stat-apply` 每帧重算 `effective=(base+Σadd)×Πmul`。但目前**没有消费者读 effective**，所以"装备/buff/光环/boon
> 改攻击/移速/血上限"还没真生效。本文把三个消费接线讲清，让属性修正端到端跑通。
>
> **总原则**：`effective` 是有效属性的**唯一真相**，消费者读它（不读 base、不自己折算）。装备/buff = 往 `mods`
> 按 source 增删条目（纯数据），次帧 effective 自动反映。引擎共享，本文涉及的文件你都可改（含我的 stats.ts）。
> **定序铁律**：`stat-apply` 必须在所有消费者**之前**跑（effective 当帧新鲜）。我已可在 stats.ts 加
> `runsBefore:['steering','hitbox','launch','mortal']`（你确认要哪些我加，或你直接加）。

---

## 协议改动汇总（先对齐契约，再动手）

1. **`Stats` 加可选 `resourceMax?: Record<stat, resourceId>`**（接线②用）：stat-apply 把 `effective[stat]` 同步进
   **同实体** `Resource(resourceId).max`（并把 current 钳进新上限）。例：`resourceMax:{ maxHp:"hp" }`。
2. **`Hitbox` 加可选 `damageStat?: string` + `attackerId?: EntityId`**（接线③用）：命中伤害 ×= 攻击者
   `effective[damageStat]`（缺省乘子 1）。`attackerId` 缺省 = hitbox 自身实体（自身光环/近战），projectile 由 caster/prefab 注入。
3. **`SpawnRequest` 加可选 `attacker?: EntityId`**（接线③ Phase B 用）：caster 把施法者 id 放进去，prefab 展开时
   盖到生成体的 `Hitbox.attackerId`，把"谁打的"一路带到飞弹身上。

> 这三个都是**可选字段**，不破任何现有数据/测试（不填 = 旧行为）。

---

## 接线①：moveSpeed → steering（最易，先做）· 文件 `@skills/tier2/steering.ts`（你的）

- **改**：算速度时优先用 effective.moveSpeed：
  ```ts
  const eff = world.getComponent<Stats>(id, 'Stats')?.effective;
  const speed = eff?.moveSpeed ?? s.speed;   // 有 Stats 用 effective，否则退回静态 speed（无回归）
  ```
  用 `speed` 替 `s.speed` 写 Velocity。`reads` 加 `'Stats'`。
- **效果**：急速 buff `{stat:'moveSpeed', mul:1.5, source:'haste'}`、减速 `{mul:0.5}` 直接生效。
- **验收测试**（game-d 或 steering.test）：英雄 base.moveSpeed=2 + 减速 mod ×0.5 → 追逐速度模长 = 1。

## 接线②：maxHp → Resource.max（易）· 文件 `@skills/tier2/stats.ts`（我的，你可改）

- **改 stat-apply**：算完 effective 后，若 `Stats.resourceMax` 存在，遍历它把 `effective[stat]` 写进同实体
  `Resource(resourceId).max`；`current = min(current, max)`（缩上限时不超）。
- **效果**：戒指 `{stat:'maxHp', add:50, source:'ring'}` → hp 上限 100→150；卸下 → 150→100（current 钳回）。
- **验收**：英雄 base.maxHp=100 + Resource(hp){current:100,max:100} + resourceMax:{maxHp:'hp'}；push +50 mod →
  次帧 Resource.max=150；滤除 → 100 且 current 钳到 100。

## 接线③：attack → hitbox 伤害（meatier，分两阶段）· 文件 `hitbox.ts`(你的)/`caster.ts`(你的)/`prefab.ts`(我的)

**Phase A — 自身光环/近战（零穿线，先做）**：hitbox 命中算伤害时：
```ts
let mul = 1;
if (hb.damageStat) {
  const atkId = hb.attackerId ?? trig.zone;          // 缺省=伤害区自身（自身光环/近战挂在攻击者身上）
  const eff = world.getComponent<Stats>(atkId, 'Stats')?.effective;
  mul = eff?.[hb.damageStat] ?? 1;
}
dmg = Math.floor(dmg * mul);                          // 在现有 amount/fracOfMax 之后乘攻击系数
```
- 适用：玩家身上的近战/光环伤害区（attackerId 省略即读玩家自己的 Stats）。
- **验收**：攻击者 effective.attack=2，Hitbox{amount:10, damageStat:'attack'} 命中 → 扣 20。

**Phase B — 投射物/远程（穿线攻击者）**：
- caster 生成时把施法者放进 SpawnRequest.attacker（caster 已有 `originEntity`，直接用它）。
- prefab 展开时：若生成体有 Hitbox 且 SpawnRequest.attacker 存在 → 盖 `Hitbox.attackerId = attacker`。
- 这样飞弹/陨石的伤害也按施法者 attack 缩放。
- **验收**：英雄 effective.attack=2 → caster 放 flame（模板 Hitbox{amount:10,damageStat:'attack'}）→ 敌人扣 20。

---

## game-d 装配验收（端到端，纯数据证明属性修正闭环）
在 game-d 给英雄挂 `Stats{ base:{maxHp:100, attack:1, moveSpeed:2}, mods:[], effective:{}, resourceMax:{maxHp:'hp'} }`，
然后用数据证明三条：
1. **戴戒指**（push `{maxHp,add:50}` + `{attack,mul:1.5}`）→ hp 上限 +50、技能伤害 ×1.5。
2. **急速 buff**（push `{moveSpeed,mul:1.5}`）→ 追逐更快。
3. **卸下/buff 到期**（按 source 滤 mods，或用 over-time 定时滤）→ 次帧全复原。
> 装备/buff 的"增删 mods"可由 effect/caster/拾取信号驱动（后续），本验收先手注 mods 数据即可。

## 守则
- 消费者只读 `effective`，绝不读 base / 不自己折算（单一真相）。
- 一切是数据：装备/光环/boon = 往 mods 增删条目；零游戏专属代码。
- 改动全程 `tsc + vitest + build` 全绿才推；碰我的 stats.ts/prefab.ts 前 fetch+merge。
- 有歧义（如 attack 当乘子 vs 加值、damageStat 命名）回我对齐，别闷头定死伤害公式。
