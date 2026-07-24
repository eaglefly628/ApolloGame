# game-103 · Solo Survivor IO 机制融合清单（owner 拍板：照单全收）

> 2026-07-23 · GD-103 · 来源=Solo Survivor IO 完整攻略（Legendary Labs·同属吸血鬼幸存者变体）。
> **owner 2026-07-23 拍板：照单全收**——本攻略全部机制纳入设计。本文=融合总表（机制→落点→能力→里程碑）；内容真相回填 `gdd.md`，能力归属回填 `capability-plan.md`，新缺口进 `requests.md`。
> IP：仅取机制，命名一律原创化。

## 1. 融合总表（全部机制 · 逐条落点）

| # | 攻略机制 | 我们的落点 | 消费能力 | 里程碑 | 状态 |
|---|---|---|---|---|---|
| 1 | 单摇杆 move/attack/evade | 走位=摇杆·攻击=自动·evade=走位 | input-capture/motion | M1 | ✅已有 |
| 2 | 升级 or 宝箱出技能 | 三选一 + 宝箱 | dice-roll+draft(E1) | M2 | ✅已有 |
| 3 | 星级满→进化(>2×) | 武器 lv5+被动→进化(2.5–4×) | merge-rule/event-when(E2) | M2 | ✅已有 |
| 4 | 技能两类：伤害/功用（AoE/单体子类） | 武器(伤害·AoE/单体/穿透) + 被动(功用) | caster/prefab/modifier-stack | M2 | ✅已有 |
| 5 | **经验加成技能**(长线投资·加速升级) | 新增被动「经验加成 +12%」 | modifier-stack | M2 | 🆕已折 gdd |
| 6 | 清关=固定击杀数·系统动态调频 | **击杀数通关模式**(与 15min 双轨) + 动态刷频 | counter/event-when+spawn-director(E3) | M3 | 🆕已折 gdd |
| 7 | 敌不全近战·发射弹幕/神风 | 神风=爆裂者(已有)·**新增远程敌**(向玩家射弹) | enemy 挂 caster+launch | M3 | 🆕已折 gdd |
| 8 | **爆炸诱饵/假身**(引怪自残) | 新增功用武器「诱饵」(放置·吸怪·爆) | prefab+aggro 重定向(E4b) | M3 | 🆕已折 gdd |
| 9 | 迷你 Boss(大体型·高伤·kiting) | 精英=迷你 Boss·kiting 走位 | aggro+steering+hitbox | M3 | ✅已有(强化) |
| 10 | **被动伤害：宠物/弹射/环刃** | 环刃=护盾环(已有)·**新增宠物(随从自动打)+弹射(跳弹)** | prefab+aggro+caster / launch 弹射 | M3–M4 | 🆕已折 gdd |
| 11 | Boss：Charge(红光预警·可躲)+Basic(远程·磨血) | Boss 攻击模式(charge/basic)+掉血包 | caster+launch+telegraph+over-time | M3 | 🆕已折 gdd |
| 12 | 宝箱自选(3 选)·看广告加成 | 宝箱三选(已有)·广告=商业化(记·非核心) | dice-roll | M2 | ✅/记 |
| 13 | RNG：重要敌后掉转盘·稀有几率 | 精英/Boss 掉宝箱(已有) | dice-roll | M2 | ✅已有 |
| 14 | 选择心态：即战力 vs 长线 vs 爆发 | 三选一张力(经验被动=长线) | — | M2 | ✅已有(强化) |
| 15 | **地形战术：障碍/高低地/隘口** | **场地障碍物**(掩体·卡位·隘口聚怪) | bounds/collision+pathfind | M4 | 🆕已折 gdd |
| 16 | **物品交互：稀有物=宝藏 or 陷阱(反制怪)** | **场景可交互物**(增益宝箱 / 可引爆陷阱) | hitbox/trigger-zone+overlap | M4 | 🆕已折 gdd |
| 17 | 战利品含护甲蓝图/武器/金/经验 | **护甲蓝图/装备 meta**(局外养成扩展) | modifier-stack(局外) | M4+ | 🆕已折 gdd |
| 18 | 主动+被动伤害均衡(各极大化 1) | 设计原则：build 建议 1 主武 + 1 被动流 | — | 设计原则 | 🆕已折 gdd |
| 19 | 音效线索(脚步/吼叫/预警) | 音频设计(走 audio.md) | audio | M5 | 记 |
| 20 | 每日挑战 / 社区 / 休息提示 / 关卡精通 | live-ops/运营层 | — | 出核心范围 | 记·非核心 |

## 2. 新增内容明细（回填 gdd 对应表）

- **被动 +1**：经验加成（+12%拾取·长线·§五）。
- **武器 +3**：宠物随从（随身自动攻）、弹射跳弹（碰敌反弹连锁）、爆炸诱饵（放置吸怪自爆·功用）。→ 首发武器由 5 扩到 8。
- **敌人 +1**：远程射手（保持距离射弹·打破"纯近战被追"·M3 引入）。
- **场地**：障碍物层（掩体/隘口/高低地·M4）+ 可交互物（增益/陷阱·M4）。
- **通关模式**：击杀数达标通关（与 15min 时限双轨·系统按进度动态调刷频）。
- **Boss**：charge(红光预警)+basic(远程磨血)+掉血包。
- **meta**：护甲蓝图/装备养成（局外·M4+）。
- **设计原则**：鼓励"1 主动武器流 + 1 被动流"极大化（三选一权衡的北极星）。

## 3. 新能力缺口（照单全收后·涉及引擎的照实报 Lead）

> **前情**：`REQ-SURVIVOR编排` 已 Lead 裁决 ✅ done（E1 draft-offer + E3 spawn-director 已下沉；E2/E4 回驳走重组；game-103 可开工）。
> 玩法全收 ≠ 引擎照做——以下**融合新机制**的能力仍走「先重组再下沉」，属 **M3–M4 内容**（非 M1 阻塞）：真薄缺口在 M3 临近时走 **capgap 快速通道**（`.apollo/cap-gaps.jsonl`→Lead 裁）或另开小 REQ，别挂已闭的单。

| 机制 | 现有能力覆盖？ | 缺口 |
|---|---|---|
| 远程敌射弹 | 敌挂 `t3-caster`+`t2-launch`（同武器路）✅ | 无·重组即可 |
| 宠物随从 | `t3-prefab` 生成 + `t3-aggro` 索敌 + `t2-steering` 跟随 ✅ | 疑无·核"跟随主人"是否要小件 |
| 弹射跳弹 | `t2-launch` 有·**碰敌反弹改向**是否覆盖待核 | 疑薄缺口·核 launch 是否支持 bounce |
| 爆炸诱饵(吸怪) | `t3-prefab` 放置 + 敌 `t3-aggro` **重定向到诱饵** | 薄缺口·aggro 目标可否临时改指诱饵 |
| 障碍/隘口寻路 | `t2-pathfind`(NavGraph 绕障) + `t2-bounds-clamp` ✅ | 无·重组即可(敌改 pathfind) |
| 可交互物/陷阱 | `t2-trigger-zone`+`t2-hitbox`+`overlap-detect` ✅ | 无·重组即可 |
| 击杀数通关+动态调频 | 计数=`Resource`/flag + `t2-event-when` 门 + spawn-director(E3) | 并入 E3 |
| Boss charge 红光预警 | telegraph(预警区)=`t2-hitbox` 延迟触发 or 新 telegraph 件待核 | 薄缺口·核预警区表达 |

> GD 立场同前：倾向重组·真薄缺口才下沉；裁决权交 Lead。**这些属 M3–M4 内容缺口**，M1–M2 起步不受影响（核心武器/敌/三选一/波次已具能力）。

## 4. 出核心范围（记录·不做进原型）

广告变现 / 每日挑战 / 社区 / 休息提示 / 关卡精通 live-ops——运营层，核心原型不做；作为上线后 backlog 记此。护甲蓝图 meta 收进 M4+ 养成（非原型必需）。

---

*内容真相=`gdd.md`；能力=`capability-plan.md`；缺口=`requests.md REQ-SURVIVOR编排`。*
