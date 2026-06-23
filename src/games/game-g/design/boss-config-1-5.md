# Boss 配置（关1-5）· 16牌组 + 地煞 + 留场/牌力 标定（design G 2026-06-21）

> owner 派：「把 5 关的 Boss 配置、16 张牌组、地煞**重新设置**，写成数据，自己跑一遍。」
> 本档 = **可直接喂 loader 的数据草案**（每 Boss：16 写死扑克 + 3 招牌地煞被动 + 留场P + 牌力偏置 + 大本营血 + 目标通关率）。
> **每个 Boss = 一个招牌被动（=它的地煞）**；轮到它掷命时全屏亮「XX 发作」(复用 `REQ-G-战斗逻辑批次·敌用地煞全屏通知`)。
>
> **标定方法**：design G 跑 16v16 原型（甲已实装"胜者掷人头留场续攻"硬币·我临时给硬币加每侧概率 + 16牌组 + 重设地煞值·跑完已撤）。玩家用逐关递进养成基线（doc27 §3.3）。N=400~500。
> ⚠ **简化模型·方向性**：原型牌力用 P 空间 buff 近似（非真 favor 系统）、玩家天罡折进 buff、AI 用通用 tier3。**甲接真 loader（16牌组 + favor 系统 + stayPMul + 诅咒）后，design G 用 `simulate-balance.ts` 重扫定稿。**

---

## 〇、目标通关率曲线（owner 锁定）
| 关 | Boss | 目标通关率 | 原型实测 |
|---|---|---|---|
| 1 | 列奥尼达·温泉关 | **98%** | 98% ✅ |
| 2 | 亚历山大·高加米拉 | **87%** | 89% ✅ |
| 3 | 曹操·赤壁 | **75%** | 77% ✅ |
| 4 | 拿破仑·滑铁卢 | **70%** | 71% ✅ |
| 5 | 项羽·垓下 | **65%** | ~68%（诅咒已撤·改 bossFavorBias 细调到 65·见 §五·待真loader定） |

---

## 一、关1 · 列奥尼达「温泉关死守」★ · 目标 98%
- **招牌被动（地煞）**：**温泉关死守** — 守墙硬汉·靠隘口与抱团把守，但牌力偏弱、易被铺场流碾过（教学关·近保送）。
- **16 牌组**（同点抱团[三条7/三条8] + 黑桃同花墙·主题=300 斯巴达同质重步兵）：
  `5♠ 6♠ 6♠ 7♠ 7♠ 7♠ 8♠ 8♠ 8♥ 9♥ 9♣ 10♠ 10♠ J♠ K♠ A♠`（主将=A♠ 列奥尼达）
- **地煞 3**：`thermopylae`(温泉关死守·家**3**血+隘口守军) + `phalanx`(斯巴达方阵) + `laststand`(死战不退·主将)
- **留场P**：0.5（base）·`laststand` 令**主将**留场更久（死战不退）
- **Boss 牌力偏置 `bossFavorBias`**：**0**（owner 2026-06-21：−2 反直觉·改 0=正常牌力；sim 偏置0=~99%·关1 本就该好赢）
- **大本营血 homeHp**：**3**（owner 2026-06-21：2→3·"死守"该厚不该薄·破家多一推）
- **⛔ 关1 明确不放**：主将 debuff / stay 偏置 / 任何阴间压迫 buff（owner：教学第一关保持干净·只有最基础推进+连携）。这类留给后期关。

## 二、关2 · 亚历山大「伙伴骑兵突击」★★ · 目标 87%
- **招牌被动**：**伙伴骑兵** — 主将带队凿穿中军·锋矢突击；尖兵强但阵浅。
- **16 牌组**（高点尖兵·锋矢·红桃骑兵）：
  `6♥ 7♥ 8♦ 8♠ 9♥ 9♣ 10♦ 10♠ J♥ J♦ Q♥ Q♠ K♥ K♦ A♥ A♠`（主将=A♥ 亚历山大）
- **地煞 3**：`companion`(伙伴骑兵·主将+10%) + `hammeranvil`(锤砧·你被夹−6%) + `sarissa`(长枪方阵·先手+4%)
- **留场P**：0.5 · **bossFavorBias −2** · **homeHp 3**

## 三、关3 · 曹操「连环船兵海」★★ · 目标 75%
- **招牌被动**：**连环兵海** — 八十万众铺三路、铁索连环抱团；靠数量与同路连携压人。
- **16 牌组**（铺三路·梅花连环同花·中低点多）：
  `3♣ 4♣ 5♣ 5♣ 6♣ 6♣ 7♦ 7♦ 8♦ 8♦ 9♠ 9♠ 10♥ J♣ Q♣ K♣`（主将=K♣ 曹操）
- **地煞 3**：`swarm`(大军压境·Boss 每回合+1源泉多铺) + `chainboats`(连环船·同路相邻每邻+3%·封顶9%) + `mandate`(挟天子·全军+5%)
- **留场P**：**0.75**（守将乘胜·owner 授权区间）· **bossFavorBias 0** · **homeHp 4**

## 四、关4 · 拿破仑「大炮近卫」★★★ · 目标 70%
- **招牌被动**：**大炮兵** — 周期炮火压制一路 + 近卫军中路硬核。
- **16 牌组**（中高点·方块炮兵·集中突破）：
  `5♦ 6♦ 7♠ 8♥ 8♣ 9♦ 9♣ 10♦ 10♠ J♦ J♥ Q♦ Q♠ K♦ K♥ A♦`（主将=A♦ 拿破仑）
- **地煞 3**：`battery`(大炮兵·每4回合压你一路−8%) + `guard`(近卫军·中路前锋+12%) + `maneuver`(机动调度·占位/可调+源泉)
- **留场P**：**0.75** · **bossFavorBias +2** · **homeHp 4**

## 五、关5 · 项羽「破釜霸王」★★★（run 终 boss）· 目标 65%
- **招牌被动**：**破釜沉舟** — 全军死战不退、霸王之勇主将无双、连胜滚雪球。**（owner 2026-06-21：诅咒先不实现 → 改用纯数据杠杆：地支附魔 ↑ / 多源泉。）**
- **16 牌组**（全高点·莽一波·黑红双花霸王军）：
  `8♠ 9♠ 10♠ 10♥ J♠ J♥ Q♠ Q♥ K♠ K♥ K♦ A♠ A♥ A♦ Q♠ J♥`（主将=A♠ 项羽）
- **地煞 3**：`burnboats`(破釜沉舟·全军+20%·绝不溃) + `overlord`(霸王之勇·主将+40%) + `winstreak`(九战九捷·每胜+4%·封顶20%)
- **难度数据杠杆（替诅咒）**：**bossFavorBias ↑（地支附魔·主调·细旋钮）** + **可选少量多源泉**（`bonusMana`·**慎用**）
- **留场P**：**0.75** · **bossFavorBias +4~+6（细调）** · **homeHp 5**
- ⚠ **double-mana 是悬崖不是旋钮**（design G 实测）：Boss 每回合 **+0.5 源泉** 就把通关率从 ~90% 砸到 ~20%、**+1（真双倍）→ ~1%（近乎不可胜）**。→ **双倍泉水只作"这关是堵墙"的重锤·不做细调**；65% 的细调用 **bossFavorBias（地支附魔）**。
- ⚠ 关5 对 Boss AI 画像敏感（aggression 高反而易输→莽过头）→ **精确 65% 待甲接真 loader（真 favor + AI）后 design G 重扫定**；本档先定方向（破釜+霸王+连胜 + favor 偏置）。

---

## 五·五、每关 Boss ≤5 明牌天罡（counter-pick 靶 · 写死 `boss.tiangang`）
> Boss 也带天罡（doc27 §3.1·≤5·与玩家对称）；**开局明牌亮出 → 玩家照着配克制**。张数随难度爬（同 loadoutCap：2/3/3/4/5）。贴 Boss 流派选，皆取自 36 天罡池。

| 关 | Boss | 明牌天罡（写死） | 主题 | 玩家 counter-pick 提示 |
|---|---|---|---|---|
| 1 | 列奥尼达 | `bannerman` 旗手 · `unyield` 不屈 | 守墙·士气耐久 | 铺场快攻绕开耐久；点数压过士气 |
| 2 | 亚历山大 | `tigertally` 虎符 · `bannerman` 旗手 · `bedrock` 磐石 | 全军突击·主将带队·稳 | `capturektg` 擒王斩其主将断光环；`leaddice` 拉差距 |
| 3 | 曹操 | `tigertally` 虎符 · `flow` 川流 · `twinblade` 双锋 | 兵海·源源补牌·连环对子 | `discard2` 舍车集中一路；同花/三条压连环 |
| 4 | 拿破仑 | `arrowhead` 锋矢 · `tripod` 鼎立 · `tigertally` 虎符 · `relay` 薪火 | 集中突破·前锋·接棒续航 | `swiftmarch` 疾行抢攻；`irondice` 防大炮爆冷路 |
| 5 | 项羽 | `atlas` 擎天 · `leaddice` 灌铅骰 · `irondice` 铁骰 · `tigertally` 虎符 · `arrowhead` 锋矢 | 霸王·强者愈强·莽 | `capturektg` 擒王断霸王之勇+擎天；`bedrock` 抬下限抗碾压 |

> ⚠ Boss 天罡当前 sim 未计入（原型只跑扑克+地煞+留场）→ 这 5 张会让 Boss **更强**，甲接入后 design G 把它纳入 sim 重扫、必要时回调 bossFavorBias/地煞。**明牌 counter-pick 是核心乐趣**：每关玩家看 Boss 天罡+地煞 → 针对配 loadout。

---

## 六、地煞数值「重新设置」（派甲改 `disha.ts · DISHA_SPECS`）
> design G 实测发现旧值**关2/3/4 过强**（非单调难度）→ 按"该关玩家真实养成"重标。改动如下（旧→新）：

| id | 字段 | 旧 | **新** | 关 |
|---|---|---|---|---|
| thermopylae | nearBasePower | 2 | **1** | 1 |
| phalanx | phalanxPerAdj / cap | 6 / 24 | **4 / 12** | 1 |
| companion | generalWinPct | 20 | **10** | 2 |
| hammeranvil | flankYouWinPct | 15 | **6** | 2 |
| sarissa | firstStrikeWinPct | 10 | **4** | 2 |
| chainboats | phalanxPerAdj / cap | 6 / 18 | **3 / 9** | 3 |
| mandate | allWinPct | 10 | **5** | 3 |
| battery | batteryEveryTurns / WinPct | 3 / 15 | **4 / 8** | 4 |
| guard | eliteMidWinPct | 25 | **12** | 4 |
| maneuver | bonusMana | 1 | **0** | 4 |
| winstreak | winStreakPer / cap | 5 / 30 | **4 / 20** | 5 |
> 未列 = 不变（nearBaseSlots=2、laststand、swarm、burnboats、overlord）。**thermopylae.homeHp：2→3**（owner 2026-06-21）；**关1 bossFavorBias：−2→0**（owner·−2 反直觉）。
> **诅咒（curse）owner 先不实现** → 关5 难度改用现有数据杠杆：`bossFavorBias`（地支附魔·细调）+ 慎用 `bonusMana`（双倍泉水=悬崖·见 §五）。

## 七、给甲的接入清单（数据驱动·引擎域）
1. **level loader 读 Boss 16写死牌组**（本档 §一-五 的 16 张 rank+suit）+ `bossFavorBias`（每关偏置·写卡 buff）+ `homeHp`（已支持）+ **≤5 写死天罡 `boss.tiangang`**（§五·五·已有 `lvl.boss.tiangang` 通道·把随机改写死）。
2. **每 Boss 留场P**：§4.2 `stayPMul` 钩子（甲已实装 base 0.5 硬币 → 加每侧/每 Boss 概率覆写）；关3-5 守将留场 0.75。
3. **地煞重设值**：§六 表（改 `DISHA_SPECS`）。
4. ~~诅咒新 op~~：**owner 暂缓**（`REQ-G-诅咒地煞` ⏸·不做）。
5. **被动发作全屏提示**：复用 `REQ-G-战斗逻辑批次·敌用地煞全屏通知`。
> 接好后 **design G 用 `simulate-balance.ts` 重扫（纳入 Boss 16牌组+5天罡+地煞+留场）→ 收敛各关到 §〇 目标曲线 → 回填**。

### 甲接入进度（2026-06-21）
- ✅ **#1 16 牌组**：`level.ts` BOSS_DECK_1_5 + LevelDef.boss.deck/favorBias/stayP；`game-g.tsx` 关1-5 用 16 牌组建 Boss 库（偏置写卡 buff·镜像玩家·不再 61 张泛化army）。本关英雄按 codex 真身强化置顶充当主将（让出列表点数最高那张保 16 总数）。⚠ config 把主将标 A/K，codex 里却是列奥尼达=3♠/曹操=5♣/项羽=9♦——**以 codex 真身为准**（heroNameOf 显示正确）；关2「亚历山大」名不匹配 codex「亚历山大大帝」→ 暂无强化主将。
- ✅ **#3 地煞重设值**：§六 表全部落 `DISHA_SPECS`（disha.test + lobby 数值条 golden 已同步）。
- ⏸ **#1 余项·homeHp 每关 2/3/4/4/5**：暂缓——`homeMax` 当前是双方共享格数，Boss 家>玩家家会撑爆血条；需先把血条改**每侧独立 max**（战场屏=乙域渲染契约改动）。关1=2 已由 thermopylae disha 生效；关2-5 暂为默认 3。
- ⏸ **#1 余项·≤5 写死天罡**：暂缓——当前 `lvl.boss.tiangang` 仍随机 12（`bossTiangang`）；改写死 ≤5（§五·五）待排。
- ⏸ **#2 留场P stayPMul**：暂缓——base 0.5 已实装；每 Boss 覆写(关3-5=0.75)是 owner 早先暂缓的「调参钩子」，并入后续天罡/地煞重设计一起落 + design G 重扫定。
- 🔀 **#4 诅咒** owner 暂缓；**#5 全屏通知** 转交他人。
> **现状**：deck/偏置/地煞值已让对战「敌人像个对手·数值方向对」；homeHp/写死天罡/留场覆写 待续 → design G 可先就当前态跑一轮 `simulate-balance` 看曲线偏移。
