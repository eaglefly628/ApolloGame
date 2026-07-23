# 配置表结构与默认数值（Config Schema）

> 数据驱动落地文档。所有玩法内容走这些配置表，逻辑层只读表、不硬编码。
> 格式以 JSON 描述，实现层（Phaser/Unity 皆可）按此结构加载。默认数值供 M1 原型直接使用，后续在此基础上调平衡。

---

## 1. 玩家配置 `player.json`

```json
{
  "maxHp": 100,
  "moveSpeed": 200,
  "hpRegen": 0,
  "pickupRadius": 80,
  "invincibilityFrame": 0.5,
  "critRate": 0.0,
  "critDamage": 1.5,
  "weaponSlots": 6,
  "passiveSlots": 6
}
```

## 2. 武器配置 `weapons.json`

每把武器含基础属性与 1–5 级成长表，以及进化指向。

```json
[
  {
    "id": "kunai",
    "name": "飞镖",
    "type": "ranged",
    "targeting": "nearest",
    "base": { "damage": 12, "cooldown": 1.0, "amount": 1, "speed": 500, "pierce": 1, "area": 1.0 },
    "levels": [
      { "level": 2, "damage": 4 },
      { "level": 3, "amount": 1 },
      { "level": 4, "cooldown": -0.15 },
      { "level": 5, "pierce": 1, "damage": 6 }
    ],
    "evolvesTo": "kunai_evo",
    "evoPassive": "blade_manual"
  },
  {
    "id": "boomerang",
    "name": "回旋镖",
    "type": "ranged",
    "targeting": "nearest",
    "base": { "damage": 18, "cooldown": 1.6, "amount": 1, "speed": 350, "pierce": 3, "area": 1.0 },
    "evolvesTo": "boomerang_evo",
    "evoPassive": "wind_charm"
  },
  {
    "id": "orbit",
    "name": "护盾环",
    "type": "melee",
    "targeting": "self_orbit",
    "base": { "damage": 10, "cooldown": 0.3, "amount": 2, "area": 1.0, "duration": 999 },
    "evolvesTo": "orbit_evo",
    "evoPassive": "energy_core"
  },
  {
    "id": "shockwave",
    "name": "冲击波",
    "type": "melee",
    "targeting": "self_aoe",
    "base": { "damage": 20, "cooldown": 2.5, "area": 1.2, "knockback": 120 },
    "evolvesTo": "shockwave_evo",
    "evoPassive": "gravity_rune"
  },
  {
    "id": "laser",
    "name": "激光",
    "type": "ranged",
    "targeting": "nearest_line",
    "base": { "damage": 35, "cooldown": 2.2, "amount": 1, "pierce": 99, "area": 1.0 },
    "evolvesTo": "laser_evo",
    "evoPassive": "prism"
  }
]
```

**进化武器**（`weapons_evo.json`，结构同上，`damage/amount` 大幅提升 + 附加机制 flag）：

```json
[
  { "id": "kunai_evo",     "name": "万镖穿心", "type": "ranged", "targeting": "nearest",     "base": { "damage": 30, "cooldown": 0.4, "amount": 3, "speed": 650, "pierce": 99, "homing": true } },
  { "id": "boomerang_evo", "name": "无限回环", "type": "ranged", "targeting": "orbit_fly",  "base": { "damage": 40, "cooldown": 0.0, "amount": 4, "pierce": 99 } },
  { "id": "orbit_evo",     "name": "恒星轨道", "type": "melee",  "targeting": "self_orbit", "base": { "damage": 28, "cooldown": 0.2, "amount": 5, "area": 1.6, "burn": 5 } },
  { "id": "shockwave_evo", "name": "黑洞脉冲", "type": "melee",  "targeting": "self_aoe",   "base": { "damage": 55, "cooldown": 2.0, "area": 2.0, "pull": 200 } },
  { "id": "laser_evo",     "name": "死亡射线", "type": "ranged", "targeting": "fan",        "base": { "damage": 70, "cooldown": 1.8, "amount": 5, "pierce": 99 } }
]
```

## 3. 被动配置 `passives.json`

```json
[
  { "id": "blade_manual", "name": "锋刃手册", "stat": "damageMul",   "perLevel": 0.08, "maxLevel": 5 },
  { "id": "wind_charm",   "name": "疾风护符", "stat": "cooldownMul", "perLevel": -0.06, "maxLevel": 5 },
  { "id": "energy_core",  "name": "能量核心", "stat": "areaMul",     "perLevel": 0.10, "maxLevel": 5 },
  { "id": "gravity_rune", "name": "重力符文", "stat": "knockbackMul","perLevel": 0.08, "maxLevel": 5 },
  { "id": "prism",        "name": "棱镜",     "stat": "amountAdd",   "perLevel": 1,    "maxLevel": 4 },
  { "id": "vitality",     "name": "生命护心", "stat": "maxHpMul",    "perLevel": 0.15, "maxLevel": 5 },
  { "id": "boots",        "name": "疾行靴",   "stat": "moveSpeedMul","perLevel": 0.08, "maxLevel": 5 },
  { "id": "magnet",       "name": "磁石",     "stat": "pickupMul",   "perLevel": 0.25, "maxLevel": 5 }
]
```

## 4. 敌人配置 `enemies.json`

```json
[
  { "id": "shambler", "name": "蹒跚者", "hp": 20,  "speed": 60,  "damage": 8,  "size": 24, "behavior": "chase",   "expDrop": "blue",  "knockbackResist": 0 },
  { "id": "runner",   "name": "疾行者", "hp": 15,  "speed": 130, "damage": 10, "size": 20, "behavior": "chase",   "expDrop": "blue",  "knockbackResist": 0 },
  { "id": "brute",    "name": "胖子",   "hp": 120, "speed": 45,  "damage": 14, "size": 48, "behavior": "chase",   "expDrop": "green", "knockbackResist": 0.8 },
  { "id": "bomber",   "name": "爆裂者", "hp": 18,  "speed": 80,  "damage": 25, "size": 26, "behavior": "explode", "expDrop": "blue",  "explodeRadius": 80 },
  { "id": "elite",    "name": "精英",   "hp": 800, "speed": 70,  "damage": 20, "size": 60, "behavior": "chase",   "expDrop": "gold",  "dropsChest": true },
  { "id": "boss",     "name": "首领",   "hp": 12000,"speed": 65, "damage": 40, "size": 120,"behavior": "boss",    "expDrop": "gold",  "phases": 3 }
]
```

**难度系数（时间驱动，分钟为单位）**：

```json
{
  "hpGrowthPerMin": 0.08,
  "damageGrowthPerMin": 0.05,
  "spawnRateGrowthPerMin": 0.12,
  "recalcEverySec": 30
}
```
> 实际 HP = `base × (1 + hpGrowthPerMin × minute)`，其余同理。

## 5. 波次表 `waves.json`

时间轴事件驱动。`t` 为局内秒数。

```json
[
  { "t": 0,   "type": "spawn", "enemy": "shambler", "rate": 1.5, "cap": 40 },
  { "t": 60,  "type": "spawn", "enemy": "runner",   "rate": 1.0, "cap": 60 },
  { "t": 90,  "type": "swarm", "enemy": "shambler", "count": 40 },
  { "t": 120, "type": "spawn", "enemy": "brute",    "rate": 0.3, "cap": 80 },
  { "t": 180, "type": "elite", "enemy": "elite",    "count": 1 },
  { "t": 210, "type": "spawn", "enemy": "bomber",   "rate": 0.5, "cap": 100 },
  { "t": 270, "type": "swarm", "enemy": "runner",   "count": 60 },
  { "t": 360, "type": "elite", "enemy": "elite",    "count": 2 },
  { "t": 540, "type": "elite", "enemy": "elite",    "count": 3 },
  { "t": 720, "type": "elite", "enemy": "elite",    "count": 4 },
  { "t": 900, "type": "boss",  "enemy": "boss",     "count": 1 }
]
```
> `rate` = 每秒生成数；`cap` = 同屏该类敌人上限。`t:900`（15:00）Boss，击杀=胜利。

## 6. 掉落与经验 `drops.json`

```json
{
  "expGems": { "blue": 1, "green": 5, "gold": 20 },
  "expToNext": "5 + level * 10",
  "itemDropRates": { "heal": 0.02, "magnet": 0.01, "bomb": 0.01 },
  "chestRolls": { "min": 1, "max": 5 }
}
```

## 7. 局外元进度 `meta.json`（M4）

```json
[
  { "id": "atk",     "name": "基础攻击", "perLevel": 0.02, "maxLevel": 20, "costBase": 100, "costMul": 1.3 },
  { "id": "hp",      "name": "基础生命", "perLevel": 0.05, "maxLevel": 20, "costBase": 100, "costMul": 1.3 },
  { "id": "speed",   "name": "移速",     "perLevel": 0.01, "maxLevel": 10, "costBase": 150, "costMul": 1.4 },
  { "id": "pickup",  "name": "拾取半径", "perLevel": 0.05, "maxLevel": 10, "costBase": 120, "costMul": 1.3 },
  { "id": "goldBonus","name": "金币加成","perLevel": 0.05, "maxLevel": 10, "costBase": 200, "costMul": 1.5 },
  { "id": "revive",  "name": "复活",     "perLevel": 1,    "maxLevel": 2,  "costBase": 2000,"costMul": 3.0 }
]
```

## 8. 升级三选一逻辑（伪代码）

```
function rollThreeChoices():
    pool = []
    for w in ownedWeapons where w.level < 5:      pool += upgrade(w)
    for p in ownedPassives where p.level < maxLevel: pool += upgrade(p)
    if weaponSlots not full:  pool += newWeaponCandidates()
    if passiveSlots not full: pool += newPassiveCandidates()
    if pool empty:            pool += [heal, gold]   // 兜底
    return weightedPick(pool, 3, noDuplicate=true)

// 进化检查：每次开宝箱 / 每次升级后
function checkEvolution():
    for w in ownedWeapons:
        if w.level == 5 and hasPassive(w.evoPassive):
            replace(w, w.evolvesTo)
```

---

*配套：`00-claude-designer-brief.md`、`02-core-gameplay-GDD.md`。数值均为 M1 原型起点，进入 M3/M5 后按功率曲线锚点迭代。*
