# Programmer F 交接 · Game F《像素三分天下》自走棋（金铲铲/TFT 切片）

> 移交给下一个模型。读这一份即可接手 game-f。最高纲领仍是 `docs/design/data-driven-manifesto.md`（游戏=数据，代码只属引擎）。
> 工作规范：tsc+vitest+build 全绿才推；提交署名 `Claude <noreply@anthropic.com>`、信息以 session URL 结尾；**不碰引擎**（缺口提需求池给主程）。
> 本 session 的引擎活全部走 `docs/workflow/requests.md` 的 **REQ-F-024~030**（Programmer F 命名空间）。

---

## 0. 一句话 / 定位

像素三国自走棋，**= Game D 战斗数据 ×2 队 + 六边形寻路 + 经济/技能**。**纯数据装配，零自走棋专属 system**——整套战斗由通用 capability 涌现。当前是「两队全自动对战」可玩切片。

## 1. 当前状态（已落地、可玩，全在 mainbranch）

- **8 将两队**：蜀(关羽/赵云/诸葛 + 吴周瑜) TEAM_A vs 魏(张辽/许褚/司马 + 吴甘宁) TEAM_B。各带独立 **血量/攻击 + 势力(蜀魏吴)/职业(武将/谋士/刺客) Tag + 专属大招 + 装备**。
- **12×12 六边形棋盘**（offset 布局，规整矩形，REQ-F-027）。棋子 `HexPos` 站格、`grid-move` 沿**确定性 A***（主程 REQ-024）寻路对冲、到相邻停。
- **战斗循环（全涌现，零 system）**：aggro 索敌 → grid-move 走位 → 普攻(loop Timer→EventWhen(timer 叶子,自身唯一 id)→Caster(at:target)→prefab 展开打击区→hitbox) → mortal 死亡 → **hierarchy-cascade 名字随棋子死消失**(REQ-F-026) → zone-occupancy 数存活写 present Flag。
- **回合机**（flow，REQ-020）：**备战→战斗→结算→done/gameover**（`in_combat` flag 门控普攻；**单局**，非多回合循环）。
- **大招（蓝条→大招）**：每英雄 mana sidecar 实体(`mp_<id>`) + 普攻 Effect 攒蓝 + 蓝满 EventWhen 发大招信号 + Caster 展开大招区 + Effect 清蓝。
- **技能分类 + 特效**：近战=斩光/远程=箭/法术=法弹（普攻按 atkType 选 DCSS 特效图）；大招主题特效（八阵图=冰/火烧赤壁=火+DoT/鬼谋=暗+DoT/…）。DoT 由 over-time。
- **美术**：8 将 + 5 特效 = 真 DCSS 图（`assets/FreeArtLib/{monster,effect}/*.png`，逐像素验过）；棋盘格=内联 SVG。势力色由**头顶名字颜色**承担（DCSS 固定色，drawImage 不吃 tint）。
- **头顶名字**：Text+Color，用 Sprite 抬 zOrder=30 盖在棋子上（Text-only 实体 zOrder=0 会被棋子盖住——这是个 hack，见 §6）。
- **节奏**：MOVE_PERIOD=48、ATK_CD=45、HP_SCALE=18 → 一局约 18s（见 §6 调参）。
- 挂进 launcher 卡带（♟️ Game F），mount=`src/game-f.tsx`（1280×720 画布，相机 zoom 1.8）。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `src/games/game-f/blueprint.ts` | **核心装配**：ROSTER（8 将数据）+ strike/ult 模板 + 大招接线 + flow 数据 + capabilities 列表 + 各种常量(HP_SCALE 等) |
| `src/games/game-f/assets.ts` | 美术清单：DCSS 英雄/特效 png 路径 + 六边形格 SVG |
| `src/games/game-f/hex.ts` | 棋盘配置（12×12 offset，project 投影；hex 数学归引擎） |
| `src/games/game-f/index.ts` | 导出 | `game-f.test.ts` | 5 测（确定性/互砍/团灭/名字随死/大招） | `render-frame.ts` | 离屏看帧（DCSS png 显方块，浏览器才真图） |
| `src/game-f.tsx` | launcher 挂载点 | `src/launcher.tsx` | ♟️ 卡带注册 |
| `docs/game-design/game-f-art-data.md` | 美术映射（英雄→DCSS id） |
| `docs/game-design/game-f-auto-chess.md` | **策划案/设计真相**（在 `claude/sharp-curie-hr606s` 分支） |
| `docs/workflow/requests.md` | REQ-F-024~030 |

## 3. 引擎需求 REQ-F-024~030（已走需求池，评估/落地归主程）

| 编号 | 内容 | 状态 |
|---|---|---|
| REQ-F-024 | 六边形棋盘 + 确定性 A* 寻路（hex+grid-move） | ✅ done（主程），game-f 已接 |
| REQ-F-025 | grid-move↔aggro 拓扑成环 → runsAfter | ✅ done |
| REQ-F-026 | 父销毁→级联销毁子（hierarchy-cascade） | ✅ done，已接（名字随死消失） |
| REQ-F-027 | grid-move 投影正交化（offset，不再平行四边形） | ✅ done，已接（12×12） |
| REQ-F-028 | flow↔zone-occupancy 成环 → flow runsAfter | ✅ done，flow 回合机已接 |
| REQ-F-029 | Resource→实时条/gauge 渲染（绿血条+蓝蓝条） | ✅ done（引擎 `t2-gauge`）**但 game-f 接入被 REQ-F-031 阻塞**——接入即拓扑成环（gauge 写 Shape↔战斗碰撞链回写 Resource） |
| **REQ-F-031** | **gauge↔战斗图成环 → 需定序/移相位**（REQ-F-029 接入前置） | 🟡 **open** —— 落地后即可接血条/蓝条（§5.1 已备好整段代码） |
| **REQ-F-030** | **grid-move haltStatusMask**（被冻定身） | ✅ **done**（主程，`GridMover.haltStatusMask`，对齐 Steering 语义）—— **接入 unblocked**：诸葛八阵图等控制技 setMask=FROZEN + 棋子 `GridMover.haltStatusMask=FROZEN` → 真定身（§5.2） |

## 4. 已知限制 / 还没做（诚实清单）

- **血量/蓝量暂不可见**：静态数字误导、已删；**实时血条/蓝条**的引擎能力 REQ-F-029（`t2-gauge`）**已落**，但接进 game-f **触发拓扑环**（gauge 写 Shape ↔ 战斗碰撞链回写 Resource）→ 转 **REQ-F-031**（定序/移相位，主程评估中）。接入代码已写好验过、待 REQ-F-031 落地原样贴回（§5.1）。**纯游戏层做条=手写 UI 违反宣言，不走捷径。**
- **控制暂未真**：能放冰特效+伤害，但"冻住不动"的引擎门 **REQ-F-030 已落**（`GridMover.haltStatusMask`），**待接**（§5.2，未做）。被冻禁攻击=另需 condition 加 Status 叶子（次要）。
- **buff/增益**：未做。撞"hitbox 读活属性 + self/group 寻址"一簇，非单一原子缺口（评估为 YAGNI，待真实拉动再重组/提）。
- **多回合循环**：flow 是**单局**（→done/gameover）。真 TFT 多回合需"棋子阵亡=倒下、回合满血归位"——而现在 mortal 直接销毁、无重生/重置机制（潜在缺口，做时再证伪/提）。
- **备战期棋子会走动**（grid-move 不被 flow 阶段门控）——小瑕疵。
- **羁绊未做**：势力/职业 Tag 已贴好（基础在）；计数用 `group-count`(REQ-022 已 done)；但"N 同类→全队 buff"的 **buff 施加** 撞 REQ-023（主程未 greenlit，倾向"全局 buff 资源"重组）。
- **商店/经济/升星**：未做（gold/player_hp 是 flow 桩）。升星可用 craft-recipe(三合一)+REQ-021 self（重复棋子）；星级显示用"独立星星实体叠加"（用户认可的做法，未做）。
- **HP_SCALE=18 是时长旋钮**，导致血量数字很大（关羽 4440）——不是真平衡，看完手感后应重新平衡成合理数值（同时长）。
- **DCSS 美术请在浏览器确认**：离屏 render-frame 嵌不了 png（显方块）。若浏览器也显方块=该路径没被 serve，查 game-e 同款路径是否生效。

## 5. 下一步 TODO（建议优先级）

1. ✅ **已接入（2026-06-10）**：绿血条+蓝蓝条。主程修 REQ-F-031（c46b0a6，gauge 移 PostResolve，采纳方案 A）后 §5.1 方案**原样落地**；game-f 测 +1 缩条/充条断言。
2. ✅ **已接入（2026-06-10）**：冰冻定身。§5.2 草案落地，真实字段=建议名（`setMask`/`statusDuration`）；八阵图冻 120 tick；game-f 测 +1 冻敌断言。
3. **重新平衡数值**（HP_SCALE 退回合理、低攻/适中血、同 ~18s）。
4. **羁绊**：group-count 数蜀魏吴/武将谋士 → 越阈值 buff（buff 施加先试"全局 buff 资源"重组，真不行才提 group-effect）。
5. **商店+经济+升星**（card-pile+craft-recipe）把单局扩成 roguelike；星级=独立星星实体叠加（用户提的做法）。
6. ✅ **已接入（2026-06-10）**：多回合循环/回合重置（inbox F-7）。REQ-F-033（'@local:'，5ca52ec）落地后按 §5.3 草案原样接：复合棋子模板 + 槽位 + deploy/wipe + round_flow 循环；含两回合循环验收测。
7. ✅ **MVP-1 对齐第一批（2026-06-10，照 flow-spec §3.2/§4.1/§4.2/§4.5）**：L1 run_flow（boot/advance/victory/defeat + round_done 握手 + >5 进位 banded）、经济三件套（收入爬坡/利息/连胜金 = income_armed 窗 + 14 组 band）、阶段伤害（基础 0/2 + 存活近似 2，REQ-022 接真值待 Phase 3）、关卡表前 2 阶段（STAGES 数据：黄巾×0.45 / 董卓全强度，deploy_stage_N 按 stage_idx 分流）。game-f 测 **10/10**。
8. ✅ **用户实测三 bug 全闭环（2026-06-10）**：蓝条频闪（MANA_FILL 50→20，节奏数据非 bug）/ 三色阵营（名牌改队伍色，art-data 已同步修订）/ 瞬移（REQ-F-034 当日提报→主程落 glideSpeed→接入 0.8，inbox F-8 done）。
9. **余项与阻塞面（2026-06-10 深夜）**：商店三件套 P0 = **被 REQ-F-038 阻塞**（已购牌码读不出，已提池）；F-9 普攻 self 化 = **被 REQ-F-036 残环阻塞**（035 whenGlobal 已落✓、排雷拆掉 flow/zone 后仍余 10 系统 SCC，已重开附走向推演，等主程二刷；§5.4 配方含 whenGlobal 随时贴回）；大招完整 self 化 = REQ-F-037（Phase 2 才真撞）。**当前唯一可动 = ready 开战输入（P2，策划已改派 PE-F：输入命令→信号→Effect set-flag）**→ 然后 等级/经验/概率牌袋（P2）。

### 5.1 血条/蓝条接入（✅ 已接入 mainbranch 2026-06-10，本节存档备查）

> 我本轮已把它接进 `blueprint.ts` 并跑测——**tsc 过、但 vitest 拓扑成环**（gauge 写 Shape ↔ 战斗碰撞链回写 Resource，详 REQ-F-031）。已回退保持全绿。**待主程按 REQ-F-031 给 gauge 定序/移相位后，原样贴回即可**（纯数据、约 5 分钟）：
>
> **① import**（`@skills/tier2/index.js` 块里加 `gaugeCapability`）。
> **② capabilities 数组**（"胜负 + 表现"段，`zoneOccupancyCapability` 之后）加一行 `gaugeCapability`。
> **③ 名字标签上移让位**：`labelEntity` 里 `Transform: xf(p.x, p.y - 34)` 且 `Hierarchy{... localY: -34 ...}`（原 -22，给两条腾头顶空间）。
> **④ 加 `barEntities` 工厂 + 在 build 循环里 `Object.assign(entities, barEntities(h));`**（紧接 `labelEntity` 之后、`ultEntities` 之前）：
>
> ```ts
> // 头顶实时状态条（REQ-F-029 gauge）：暗轨道(满宽静态,先插=在下) + 彩填充(挂 Gauge,后插=在上)。
> // 同 zOrder=0，渲染器 stable sort 按插入序 → 填充盖轨道、露出已掉部分。hp 读父共享 'hp'；mana 读各自全局唯一 mp_<id>。
> const BAR_W = 28;
> const trackColor = 0x18181c;
> function barEntities(h: HeroSpec): Record<string, EntityBlueprint> {
>   const p = project(h.q, h.r);
>   const bar = (localY: number, height: number): Record<string, unknown> => ({
>     Transform: xf(p.x, p.y + localY),
>     Shape: { kind: 'box', width: BAR_W, height },
>     Hierarchy: { parentId: h.id, localX: 0, localY, localRotation: 0, localScaleX: 1, localScaleY: 1 },
>   });
>   const HP_Y = -26, MP_Y = -20;
>   return {
>     [`${h.id}_hpbg`]:  { ...bar(HP_Y, 5), Color: { tint: trackColor, alpha: 0.85 } } as unknown as EntityBlueprint,
>     [`${h.id}_hpbar`]: { ...bar(HP_Y, 5), Color: { tint: 0x33cc33, alpha: 1 }, Gauge: { resourceId: 'hp', fromParent: true, width: BAR_W } } as unknown as EntityBlueprint,
>     [`${h.id}_mpbg`]:  { ...bar(MP_Y, 3), Color: { tint: trackColor, alpha: 0.85 } } as unknown as EntityBlueprint,
>     [`${h.id}_mpbar`]: { ...bar(MP_Y, 3), Color: { tint: 0x3aa0ff, alpha: 1 }, Gauge: { resourceId: `mp_${h.id}`, width: BAR_W } } as unknown as EntityBlueprint,
>   };
> }
> ```
>
> **验收**：`mp_<id>` 走全局寻址（缺省，非 fromParent）已确认正确（蓝条 sidecar 实体的 Resource id 唯一）；hp 走 `fromParent`（共享 id，读棋子本体）。条随棋子由 hierarchy-resolve 带走、随死由 hierarchy-cascade 一并消失（同名字）。**贴回后务必 tsc+vitest+build 全绿再推**——若仍成环说明 REQ-F-031 未真正解掉，回报主程别硬推。

### 5.2 冰冻定身接入（✅ 已接入 mainbranch 2026-06-10；草案字段即落地字段 `setMask`/`statusDuration`，本节存档备查）

> 主程已落 **`GridMover.haltStatusMask?: number`**（src/engine/protocol/components.ts:871 / grid-move.ts:124）：棋子自身 `Status.flags` 含该掩码 → 本 tick 不走 **且节奏时钟暂停**（解控后按剩余节奏恢复，无补步突进；对齐旧 `Steering.haltStatusMask`、game-d 冰冻即此）。纯位与，确定性不变。
>
> **接入草案（先读真实 hitbox 置 Status 的字段再写，别照搬字段名）**：
> 1. 定个 CC 位常量，与 team/cls/faction 位**不重叠**（现已用 `1<<0..1<<8`，可取 `const FROZEN = 1 << 10`）。
> 2. **棋子** `GridMover` 加 `haltStatusMask: FROZEN`（被冻即定身）。
> 3. **控制技**（诸葛"八阵图"等）的 ult 打击区 `Hitbox` 置上 Status=FROZEN + 一个时长（到点自动解冻）——`hitbox` 系统 `writes:['ResourceModify','Status','OverTime']`，**先去 `src/skills/tier2/hitbox.ts` 读它置 Status / 调度 OverTime 解控的真实字段**（我提案里写的 `setMask/statusDuration` 是建议名，未必是落地名），按真实字段填。
> 4. 可选：被冻禁攻击=普攻 `EventWhen.when` 的 `and` 里再加一条"自身 Status 不含 FROZEN"叶子（次要，先定身就够）。
> 5. tsc+vitest+build 全绿才推。

### 5.3 回合重置接入草案（✅ 已按此接入 mainbranch 2026-06-10；REQ-F-033 落地语法='@local:'，本节存档备查）

> 引擎已备好（d863f92，4 验收测）：`SpawnRequest.overrides` / `Caster.overrides`（localId→组件→字段补丁，深拷贝后逐字段合并）+ `Effect{kind:'destroy-tagged', value:Tag掩码}`（按 Tag 批量清场，cascade 连挂件）。实例 id = `模板#seq:localId`。**范式见 `roster-round.integration.test.ts`（主程写的整轮循环样例，照抄结构）**。
>
> 1. **每英雄一个模板** `hero_<id>` 进 `GAME_F_TEMPLATES`：entities = `main`（现 unitEntity 全套；hp Resource/Tag 占位由槽位 overrides 改写）+ `name` + `hpbg/hpbar/mpbg/mpbar` + `mana/fill/ultcast/drain`。**内部引用（name/条的 `Hierarchy.parentId`、ultcast 的 `Caster.originEntity` → main）按 REQ-F-033 落地语法写**（提案 B 即 `'@local:main'`；以主程最终落地为准）。唯一 id 策略不变（每英雄专属模板，`atk_<id>/mp_<id>` 烘进各自模板）。
> 2. **槽位实体（持久，无 Tag → wipe 不波及）**：我方 4 槽 `Caster{onSignal:'deploy', template:'hero_<id>', at:'self', overrides:{main:{HexPos:{q,r}, Tag:{flags:team|cls|faction}, Resource:{current/max=星级数值}}}}`；敌方 4 槽同构、onSignal `'deploy_stage_1'`（关卡表多阶段=每阶段一组敌槽，纯数据）。**槽 Transform 直接放 `project(q,r)` 投影坐标**（消除展开后一帧跳变，主程接入注意原话）。
> 3. **flow 改循环**：prep onEnter `[gold+5, in_combat=false, wipe_armed=false, deploy_armed=true, round+1]`；`deploy_armed` → EventWhen(edge) → 发 `'deploy'`（+按 `round` 条件发 `'deploy_stage_N'`）；combat 同现状（present flag 判胜负）；resolution onEnter `[in_combat=false, deploy_armed=false, wipe_armed=true]`（EventWhen edge → `'wipe'`），转移 `player_hp≤0→gameover`、`after 60 → prep`（**回 prep = 多回合循环**，替掉单局 done）。
> 4. **清场**：两条常驻 `Effect{onSignal:'wipe', kind:'destroy-tagged', targetId:'', value:TEAM_A / TEAM_B}`。
> 5. **全局 id 先登记 flow-spec §3.1 注册表**：`deploy` / `wipe` / `deploy_stage_1` / `round` / `deploy_armed` / `wipe_armed`。
> 6. **测试**：两回合循环（一轮团灭→resolution wipe→prep 重展开：实例 id 全新、名牌/条随生随灭、槽位/库幸存）+ 确定性 hash 双跑；Zone present flag 注意 prep 40 拍内 zone 重新数到人（展开次拍生效，余量足）。

### 5.4 F-9 普攻 self 化接入配方（**被 REQ-F-036 残环阻塞**——035 已落、whenGlobal 语法已并入下方第 2 步；带门重接复测 10 系统残环（详 036 复测补充），主程拆环后照此贴回 + 第 4 步两断言 + 阶段门"关门零出手/开门恢复"测）

> 实测：按 inbox F-9 处方接入，tsc 过、12 测全编出，但 **selfRuleCapability 一进战斗图抛 12 系统 SCC**（详 REQ-F-036，根因=self-rule RMW Resource/Flag 零显式定序边）。回退保持全绿。贴回步骤：
>
> 1. **capabilities**：import 加 `selfRuleCapability`（tier2），数组「自动普攻」段 `timerCapability` 后插 `selfRuleCapability`（⚠️ 两处都要——本轮就是漏了数组只加了 import，白查二十分钟）。
> 2. **heroTemplate main**：删 `EventWhen`/`Caster` 两组件与 `atk_<id>` 变量，换：
>    `Timer: { id: 'atk', elapsed: 0, duration: ATK_CD, loop: true },`
>    `SelfRule: { when: { kind: 'timer', id: 'atk', cmp: 'gte', value: ATK_CD - 1 }, whenGlobal: { kind: 'flag', id: 'in_combat', equals: true }, do: [{ kind: 'spawn', template: 'strike_<id>', at: 'target' }], once: false, armed: false },`
>    （`whenGlobal` 字段名以 REQ-F-035 最终落地为准；timer id 共享 'atk'，self 作用域不串台。）
> 3. **攒蓝改时基**（普攻信号消失，旧 `fill` Effect 失挂点）：删 `fill` 实体；`MANA_FILL` 常量换 `const MANA_REGEN = { period: 9, amount: 4 };`（≈0.44/拍，节奏对齐旧 5 攻一大招）；mana sidecar 加
>    `Timer: { id: 'mana', elapsed: 0, duration: MANA_REGEN.period, loop: true },`
>    `SelfRule: { when: { kind: 'timer', id: 'mana', cmp: 'gte', value: MANA_REGEN.period - 1 }, do: [{ kind: 'modify-resource', op: 'add', value: MANA_REGEN.amount }], once: false, armed: false },`
>    （大招半边 EventWhen+ultcast+drain 本轮**不动**——sidecar 仅一条 SelfRule 名额已被回蓝占用，完整 self 化等 REQ-F-037 rules[]。）
> 4. **验收测 ×2**：① 2×关羽不串台——tick 20 注入第二份 `hero_a_guanyu` SpawnRequest（HexPos q3r7、Tag TEAM_A、hp overrides），窗口 [20,88) 收集 `strike_a_guanyu#` 实例集合，断言 ≥2（窗内单实例至多 1 击）+ 双 main 存活；② 备战/结算无伤害（策划要求的防回归）：prep 期所有 main 满血、resolution wipe 前无新 strike 实例。
> 5. 头注释同步（普攻行 + 唯一 id 段），tsc+vitest+build 全绿推。

## 6. Gotchas（坑）

- **唯一 id 策略**：每英雄 `atk_<id>/mp_<id>/strike_<id>/ult_<id>` 唯一，规避"逻辑链全局按 id 寻址"串台（MVP-0）。**重复棋子/三星合体**会撞——需接 REQ-021 self 作用域（主程已 done，未接）。
- **mana 在 sidecar 实体**（一实体一 Resource，棋子本体已占 hp）。
- **名字 zOrder hack**：Text-only 实体 zOrder=0（被棋子盖）；给名字加个 Sprite（文本模式不绘）只为抬 zOrder=30。REQ 一个"Text 也能设 zOrder"会更干净（未提）。
- **hp 共享 id 'hp'**：hitbox 局部路由依赖它，**不能改唯一**；所以血条子条要读"父"的 hp（REQ-F-029 已写明）。
- 调参旋钮都在 `blueprint.ts` 顶部常量：`HP_SCALE / MOVE_PERIOD / ATK_CD / MANA_FILL / DOT`。

## 7. 分支

game-f 全部在 **`claude/mainbranch`**（用户授权直推）。REQ-F-031/032/033 均为本席位上报→主程落地→本席位接入的完整闭环（031 方案 A / 033 方案 B 皆被采纳）。
**本轮（2026-06-10）**：F-5 血条/蓝条 + F-6 冰冻定身 + F-7 回合重置（多回合循环）三项接入已直推 mainbranch，inbox 均已回执；game-f 测 9/9。
> 下一项 = **MVP-1 余项**（flow-spec §6.2：L1 run_flow、商店三件套、经济三件套、关卡表前 2 阶段、ready 输入）——**全纯数据、无引擎阻塞**，照 §6.2 队列逐项接、逐项补测。
