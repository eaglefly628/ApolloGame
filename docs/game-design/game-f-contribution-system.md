# Game F · 贡献度 / 攻岛 / 排名系统设计(喂 T3/T4)

> 主策划 ｜ 2026-06-13 ｜ 这是「**怎么赢**」的系统。配 `game-f-core-combat-dev.md` 的 **T3(贡献度计量)/T4(岛屿进度)**;胜负规则承 `game-f-cards-and-decks.md`(贡献度元循环)。
> ⛔ 几乎全是数据 + 复用 `Signal.source`;排名/岛主/天梯 LP = 服务层(不进 ECS)。

---

## 〇、三个量(先定义清楚,别混)

| 量 | 谁的 | 作用 | 归属 |
|---|---|---|---|
| **岛屿进度** | 共享(单机=一人) | 三人合力凿;满 = 岛陷落 = Run 结束 | ECS 资源 `island_progress` |
| **个人贡献** | 各自 | 决定排名;`contribution_<owner>` | ECS 资源(按 owner) |
| **名次 → 岛主** | 结算 | Run 结束按个人贡献排序,第一 = 岛主 | 服务/结算层 |

> 核心:**合作把岛打下来(岛屿进度),但竞争谁贡献最大(岛主)**——co-opetition 的数值化身。

---

## 一、贡献度怎么算(公式 = 数据)

```
对某太阁单位的一次有效操作 → 贡献累加:
  contribution += 伤害量 × 该太阁的 contribution_weight
  + (若为补刀 last-hit)额外 last_hit_bonus × contribution_weight
  + (可选)收编该太阁 → recruit_bonus
```

- **基础**:对太阁造成的伤害累加(伤害来源经 `Signal.source` 归属到施害玩家)。
- **last-hit(抢人头)**:补到最后一刀额外加成 → 制造「抢太阁人头」博弈。
- **收编奖励**(可选):鼓励「以战养战」降将流。

### ⭐ anti-snowball:贡献权重「后置」(防早早锁定岛主)
> 这是保证「三人全程紧绷」的主杠杆(在 `game-f-deck-spec.md`/cards 反复强调,这里钉成数据):

**每个太阁码带一个 `contribution_weight`**,序盘低、终盘极高:

| 段 | 例 | contribution_weight(首版待平衡) |
|---|---|---|
| 滩头杂兵 | `ash_yari` | 1 |
| 国人众部将 | `saito`/`hojo` | 5 |
| 天守 Boss | `nobunaga`/`kenshin` | 40 |

→ **岛主到「终盘抢 Boss 那一刻」才定**,序盘领先不保险,全程有翻盘希望。一条数据(权重曲线)调出整局悬念节奏。

---

## 二、岛屿进度模型(T4)

- `island_progress` 资源,`max = Σ 所有波太阁的 island_value`。
- 每杀一个太阁 → `island_progress += island_value`(可与 contribution_weight 同源或独立)。
- **满 → flow 触发 Run 结束(岛陷落)**。
- **v1 简化**:不做独立进度条,直接「**清完关卡表最后一波(天守 Boss 死)= 岛陷落 = 切片结束**」;v1 只打到九州 W2,清完即结束。完整进度条留多人/完整关卡。

---

## 三、kill-attribution(归属)= 复用 `Signal.source`(非新引擎缺口)

- 伤害经 hitbox → `ResourceModify`;施害链由 `event-when` 盖 `source=eid`(REQ-021 域;F-058 批用过 `@signal-source`)。施害实体属于哪个玩家(owner)→ 记 `contribution_<owner>`。
- **归属链已有,只需「按 owner 聚合到 contribution 资源」的接线**(数据 + Effect modify-resource)。
- ⚠️ **唯一待核**:`mortal` 致死那一击能否拿到「致死来源」做 **last-hit** 归属。若 `mortal` 不暴露致死 source → 是**小接线/小缺口**(候选 REQ:`mortal` 记录/暴露 last-damage-source)。
  - **v1 不受影响**:单机只有一个玩家,贡献 = 对太阁总伤害,**无需 per-player 归属**;last-hit 归属是**多人才需要**的,届时再核这条小缺口。

---

## 四、排名 / 岛主(服务·结算层,非 ECS)

- Run 结束 → 读各玩家 `contribution_<owner>` → 排序 → 岛主 + 名次。
- **v1(单机)**:只有自己,contribution = 一个分数(成就感 + 天梯 LP 输入)。
- **多人(后置)**:三份 contribution → 比较 → 岛主 → 天梯 LP 按名次(`game-f-economy-market.md` §三)+ 掷点分卡按贡献(§二)。

---

## 五、分层落地(T3/T4 照走)

| 阶段 | 内容 | 缺口 |
|---|---|---|
| **v1(T3/T4 scaffold)** | `contribution` 资源累加对太阁伤害 × 权重 + 清完关卡表 = 结束 + 出分 | **零**(全复用) |
| 多人 | per-owner contribution + last-hit 归属 + 共享 island_progress + 排名/岛主 | last-hit 归属待核小缺口 |

---

## 六、数据映射与缺口小结

| 机制 | 判定 |
|---|---|
| 伤害归属(施害玩家) | ✅复用 `Signal.source`(REQ-021 域) |
| 贡献累加 | ✅复用 `Effect modify-resource` |
| 权重后置(每太阁 weight) | ✅纯数据(太阁码加 `contribution_weight` 字段) |
| 岛屿进度 | ✅资源 + flow(v1 用"清完即结束"更省) |
| **last-hit 归属** | 🟠多人才需;待核 `mortal` 是否暴露致死 source,无则小缺口(候选 REQ) |
| 排名/岛主/天梯 LP | 服务层,非 ECS |

> 复诵:岛屿进度=合作,个人贡献=竞争,权重后置=全程紧绷的悬念杠杆。v1 单机零缺口(总伤害×权重+清完即结束);last-hit 归属是多人才碰的唯一小待核。
