# ARPG 战斗能力缺口（暗黑1/2 + Hades 对标）—— Lead 评审 + 排期

> 背景：Programmer D 的 ARPG 切片机制已通（aggro/steering/hitbox/over-time/mortal/caster/prefab）。
> 对标暗黑1/2/Hades 后，这些游戏 80% 花样收敛到几个底层原语。地图(tilemap+寻路)已派 D 做。
> 本文列剩余 3 块，每条标清：**新能力 vs 扩展 vs 可数据组合**、为什么、优先级。

---

## ① 属性修正系统（stat modifiers）—— ✅ 新能力，最高复利【本程实现】

- **是什么**：实体的有效属性 = `基础值 + Σ加值 ×Π乘值`，加/乘来自**具名来源**（装备/buff/光环/天赋/boon）。
- **为什么是真缺口**：`Resource` 是平值，没有"基础+修正"分层。暗黑**词缀**、Hades **boon/Heat**、**光环/诅咒**、**天赋树**——全是"某来源临时/永久改有效攻防速暴击"。现在表达不了 `+15% 攻击`、`戴戒指 maxHP+50`、`光环内 +20% 移速`。
- **判定**：**真通用 capability**（确定性、可复用、非游戏专属）。做对它，装备/buff/光环/天赋/boon 全变数据组合 → 复利最高。
- **落地形态**：`Stats{ base:Record<stat,number>, mods:Modifier[], effective:Record<stat,number> }` 一个组件装多 stat（绕开"一实体一组件"R14 墙）；`Modifier{stat,add?,mul?,source}`；系统每 tick 折算 `effective`。**加/去 mod 按 source**（装备→push、卸下→按 source 滤除）。
- **消费侧（与 D 协调，本程不碰其文件）**：hitbox 伤害读攻击者 `effective.attack`、steering 读 `effective.speed`、maxHP 同步 `Resource.max`。本程只下沉**原语 + 测试**；消费接线交 D（steering/caster 是他的）或下程协调。

## ② 飞弹（projectile）—— ⚠️ 一半回驳：追踪弹用 steering，真缺口=直线弹【本程实现 launch】

- **回驳的一半**：**追踪弹（homing，火球咬着目标飞）= D 的 `steering`(mode:seek) + aggro 已覆盖**。给飞弹实体挂 Steering+Perception 即持续追踪，**不需要新能力**。
- **真缺口**：**直线弹/抛射（fire-and-forget：发射瞬间定方向，之后直飞）**。`steering` 是**持续**重定向（会一直拐向目标），表达不了"朝发射时刻的方向直飞"。暗黑火球/冰矛/弹幕多是这种。
- **判定**：**新能力 `launch`**（一次性：解算方向→写一次 Velocity→自删 Launch，之后交 motion-apply 直飞）。小、单一职责，复用 spatial-query 的 nearestByTag 做"朝最近敌人发射"。
- **落地形态**：`Launch{ speed, toward:'target'|'dir', targetMask?, dirX?,dirY? }`；system runsBefore motion-apply：解方向→`Velocity=dir*speed`→`removeComponent('Launch')`。飞弹 = prefab 模板{Transform,Shape,Sensor,Tag(ZONE),Hitbox,Velocity,Launch,Timer(life)}，caster 生成即自发射。**caster 不用动**（D 注释里的 v1.1 朝向注入可不做了，用 launch 解耦解决）。

## ④ 击退 + 无敌帧（combat feel）—— 便宜的小扩展【本程列出，未实现，待排期】

- **击退**：hitbox 命中时给目标一个**冲量**（沿命中法线或施法者→目标方向的 Velocity 增量）。暗黑/Hades 都有击退/击飞。→ **扩 hitbox**（加 `knockback?:number` 字段 + 写目标 Velocity），小。
- **无敌帧/闪避/格挡**：hitbox 加 **`excludeMask`**（目标 Status 含此位则跳过伤害）。Hades 冲刺 i-frames、暗黑格挡全靠它。hitbox 已有 `requireMask`(必须含)，对称补 `excludeMask`(必须不含)，**极小**。
- **判定**：均为 **hitbox 扩展**（非新能力）。hitbox 现是 D 在维护，**这两条建议交 D 一并做**（他改 hitbox 顺手），或本程下沉前与他对齐，避免撞车。

---

## 不是引擎缺口（别建，避免过度设计）
- **HUD**：屏幕血/蓝/计分 = `@ui` StatPanel/Bar 读 Resource（已覆盖），D 组装。仅"怪头顶世界空间血条"是小渲染器活。
- **VFX**：多半美术。引擎 `prefab+Frame/animation+Tween+Color+lifetime` 已能做特效实体；高密度粒子发射器 YAGNI。
- **数据组合即可**：升级/XP(resource+event-when+effect)、刷怪波(timer→signal→caster)、蓝耗(craft-recipe)、Boss 阶段(state+condition)、拾取(trigger-zone→effect)、光环(hitbox 区+hierarchy 跟随+over-time)、Hades 房间三选一(dialogue 的 choice 节点)。

## 优先级
**① 属性修正 ≫ ② 直线弹 > ④ 击退/i-frames(便宜) > ③ tilemap/寻路(D 在做)。** 本程实现 ①②（原语+测试），④ 交 D，③ D 进行中。
