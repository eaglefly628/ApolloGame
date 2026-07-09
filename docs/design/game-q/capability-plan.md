# 能力总览 Capability Plan — game-q《Neon Siege · 霓虹要塞》塔防

> 按 CLAUDE.md「游戏能力总览铁律」立项前交。塔防是引擎里的**新品类**，本 plan 论证：
> 它 ~95% 由**现有 capability 组合**即可表达（不下沉即可跑通完整循环），只有一个真缺口（击杀记账）
> 走 requests.md 记债、循环层用现成能力绕过。落地后用 `node scripts/game-skill-audit.mjs game-q` 核偏差。

## 1. 游戏一句话

未来主义霓虹塔防：一波波几何无人机沿发光电路道逼近能量核心（大本营），玩家用金币在道旁空位造/升级塔（脉冲/轨道炮），塔自动索敌抛射能量弹清怪；漏怪扣核心生命，清完全部波次即胜、生命归零即败。参照物：Kingdom Rush / Bloons TD 的核心循环（造塔→索敌→清波→经济→升级），美术走 Tron/合成波霓虹。

## 2. 消费的引擎能力（对照 `capability-registry` 实名 · 全部现有）

| capability（注册 id） | 用来做什么 | 状态 |
|---|---|---|
| `t2-pathfind`（NavGraph+NavAgent+Relation） | 敌人沿多路点车道走向大本营（连续空间 A*） | ✅ 现有 |
| `t1-motion-apply`（Velocity 积分） | pathfind 写的速度 → 位移 | ✅ 现有 |
| `t2-self-rule`（SelfRule spawn·per-instance） | ①塔按自身节拍开火 ②**生怪票**：每张票=一实体·Timer 到点展开一只怪（数据驱动波次·见 §设计记录） | ✅ 现有 |
| `t2-over-time`（OverTime·局部 ResourceModify） | 金币被动涓流收入（gold 每 N tick +X） | ✅ 现有 |
| `t1-lifetime`（Timer id "life" → destroy） | 能量弹/生怪票到寿命自毁 | ✅ 现有 |
| `t3-prefab`（PrefabLibrary/SpawnRequest） | 敌人/塔/能量弹/特效按模板实例化 | ✅ 现有 |
| `t3-aggro`（Perception{sightRadius}→Relation target） | 塔按**射程**索敌最近敌（仅射程内）→ self-rule spawn `at:'target'` 命中制开火（无敌不发·杜绝空炮/满图狙） | ✅ 现有 |
| `t3-caster`（Caster onSignal→SpawnRequest·at:'self'） | **建造位**点击→在该位生成塔 prefab（放置桥） | ✅ 现有 |
| `t2-hitbox`（Hitbox+Sensor+ZONE_FLAG·**consumeOnHit**） | zap 命中区**单发结算**精确 dmg（consumeOnHit·消 5×多帧累伤 bug）；核心 kill-zone 清漏怪 | ✅ 现有 |
| `d1-overlap-detect` + `t2-trigger-zone` | 命中检测 → Trigger（zone×非zone） | ✅ 现有 |
| `t2-mortal`（Mortal atOrBelow） | 敌 hp≤0 → DestroyRequest（+可选掉落模板） | ✅ 现有 |
| `k2-destroy`（DestroyRequest） | 实体移除 | ✅ 现有 |
| `f1-resource` / `f2-flag` / `string`（态） | gold/lives/hp/wave/enemies_alive + 各布尔旗 | ✅ 现有 |
| `t2-craft-recipe`（costs/gains/grantsFlag） | 花金币造塔 / 升级（原子扣费·全或无） | ✅ 现有 |
| `t2-clickable`（onlyFlag 门控·各建造位唯一信号） | **只在道旁建造位 pad 可点**造塔（防布路面/防叠·点非法处无效）；pad 落塔即自毁=占位 | ✅ 现有 |
| `t2-effect-apply`（set-flag/destroy·@signal-source/定 id） | 放置副作用：清 pending 旗 + 销毁同位两建造钮（占位·数据接线·无新能力） | ✅ 现有 |
| `t2-group-count`（countResource+requiredTag） | 统计存活敌数 → 胜利条件读 | ✅ 现有 |
| `t3-flow`（GameFlow states+ConditionExpr） | 整局状态机：playing→victory/defeat | ✅ 现有 |
| `t2-gauge`（Resource→Shape.width 子实体） | 敌人血条 / 核心护盾条 | ✅ 现有 |
| `t2-text-binding`（Resource→Text） | HUD 世界层数字（如需）；HUD 主体走 LayoutNode | ✅ 现有 |
| `a2-hierarchy`(+cascade) | 血条/漏怪探针挂敌人、随之移动/销毁 | ✅ 现有 |
| `t1-tween` + `e1-timer` + `t1-lifetime` | 命中闪/死亡爆闪淡出 + 塔核/大本营核呼吸（pingpong）；短寿 prefab 自毁 | ✅ 现有 |
| 渲染原子 `l1-sprite`/`l2-color`/`a1-transform`/`shape`(circle/box/polygon) | play-field 几何渲染（塔=六边+核+射程环·怪按类型 circle/diamond/hex 差异化轮廓·CanvasRenderer） | ✅ 现有 |
| UI：`LayoutNode` 34 控件闭集 + `mountUI` | HUD/建造面板/开波钮/胜负屏（**UI 铁律·纯数据**） | ✅ 现有 |

> **零新增引擎 capability**：塔防完整循环全部由上表现有能力组合涌现——正是宣言要的「新品类=数据」结果。

## 3. 摆成数据的规则面（每张表都有现成解释器·无虚胖数据）

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| `LANE`（NavGraph nodes/edges·**单调右进**防寻路倒走） | 车道路点图 | `t2-pathfind`（禁游戏层自写寻路） |
| `WAVE_SCHEDULE`（[{at,key}]→每条一张生怪票实体） | 每波何时生什么怪 | `t2-self-rule`(spawn) + `e1-timer` + `t1-lifetime`（禁游戏层自写波循环） |
| `PREFABS`（PrefabLibrary templates：enemy/tower/bolt/coin/fx） | 实体模板 | `t3-prefab` |
| `TOWER_DEFS`（cost/damage(scaleByResource)/reload(Timer)/range(Perception)） | 塔档参数 | craft-recipe(扣费) + caster/launch/hitbox(消费) |
| `ECONOMY`（start gold / 塔价 / 升级价 / 清波奖金） | 经济数值 | resource + craft-recipe + timeline resource-cue/effect-apply |
| 胜负判据（lives≤0 / waves_done ∧ enemies_alive≤0） | ConditionExpr | `t3-flow` GameFlow（数据状态机） |
| 伤害/射速升级 | dmg=amount×`scaleByResource` gold-gain；射速=`reset-timer` | hitbox + craft-recipe + effect-apply |

> 红线自检：**无「数据表 + 待写游戏层解释器」**——每张表的解释器都是现有 capability。

## 4. 申请的游戏层代码例外（逐条过审 · Lead=本 session 裁决）

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| `game-q.ts` mount/host 编排（建 Engine + CanvasRenderer + mountUI + QueuedInputSource 指针胶水 + engine.subscribe 把 world 资源投影进 HUD/胜负屏 + cleanup） | 「工程师写 mount/host 层」是契约明许的宿主代码（game-i/game-d 先例）；**不含任何玩法规则**（规则全在 blueprint 数据 + 能力） | ~220 | ✅ 准（常驻·同 game-i/game-d 宿主层） | 常驻 |
| `handlers.ts`：HUD `action` 信号名 → 转发进 QueuedInputSource / 置本地 UI 态（选中塔档等纯表现态） | UI 铁律：handler 只转发信号，**绝不塞玩法逻辑**；本地态仅驱动 HUD 高亮（表现） | ~60 | ✅ 准 | 常驻 |
| play-field 渲染/HUD 数据构造函数（blueprint.ts / hud.ts=纯数据工厂） | 是**数据**不是系统代码（返回 WorldBlueprint / LayoutNode）；无自由逻辑 | n/a | ✅ 准（本就是数据） | — |

> 审计红旗自检：裸 Math.random=**无**（随机走 `Effect.chance`/`RandomSeed`）；innerHTML=**无**；createElement=host 层容器 div（stage/uiHost·基线登记·同 game-i）；零能力接入=**否**（消费 20+ 能力）；零测试=**否**（game-q.test.ts 覆盖 蓝图纯数据/tick 演化/确定性双跑）。

## 5. 确定性声明

- **无随机**：本作生怪位置/波次/伤害全为**定数据**（生怪票固定坐标·hitscan 精确 dmg），不含任何随机 → 已删 `w1-random`，天然可回放。
- **回放 / lockstep**：sim 全走整数/枚举 + 按 entity id 定序（clickable/aggro/self-rule 命中并列取 id 最小）；`InputQueue` 世界坐标在采集期定死（`canvasPointerToScreen`，无相机=identity）→ 命令流确定；确定性双跑同 hash 有测试钉死。
- **非确定性风险点**：命中闪/死亡爆闪/呼吸核的 tween（Color.alpha）纯表现、不被 Condition 读、不进胜负判定 → 不破 hash。渲染层不回灌 sim。

## 6. 真缺口 · 记债（走 requests.md）

- **REQ-Q-击杀记账（on-kill credit）**：`Hitbox` 只写目标**本地**资源、`Mortal.dropTemplate` 对**任何死因无差别**触发 →
  无法用单个 Mortal 区分「被塔击杀→发赏金」与「抵达核心漏怪→扣命·不发赏金」。
  - **本作循环层绕法（不下沉即跑通）**：经济走「**开局金 + `t2-over-time` 涓流收入**」——完全组合现有能力、确定性、无缺口依赖。逐怪赏金暂不做。
  - **建议下沉（记债·待 owner/Lead 排期）**：`Hitbox.creditResource`（命中/击杀时给具名 global/攻击者资源记账）或 `Mortal` 按「哪个资源/tag 致死」分支掉落。属通用战斗能力（赏金/击杀计分/连击表都用），非塔防专属。落地后逐怪赏金即可干净接入。

## 设计记录（落地时的两处发现）

1. **波次不用 `t3-timeline` 而用 `t2-self-rule` 生怪票**：timeline 的 system 声明写 `Resource`/`Flag`，与 resource 管线
   （resource-apply/group-count/flow/self-rule 全对 Resource/Flag RMW）在同一 phase 互为前驱 → 拓扑排序判环
   （timeline+flow+self-rule+group-count 同场无法定序）。改用「每张生怪票 = 一实体（Timer+SelfRule spawn+lifetime）」
   同样纯数据、且与全套逻辑系统天然可定序——**优先重组现有能力、不擅改引擎共享 capability 的定序**（宪法 §4）。
   金币收入同理走 `t2-over-time`（局部 ResourceModify），不走 timeline resource-cue。
2. **车道必须 x 单调**：pathfind 按「最近节点」入图，回字形道会让智能体在平行 y 道间反复横跳（repath 重锚到身后节点）；
   单调右进的锯齿道保证任一次重锚都指向前方，敌人稳定前进。
3. **v2 对抗性 QA 整改（owner 复盘"塔能布路上=粗糙"后·子代理审出全表 bug）**：
   - **放置约束**（genre 核心）：弃"整块 field clickable + caster at:pointer 任意落塔"，改**道旁离散建造位 pad**——只 pad 可点（防布路面/防叠/防出界·点非法处无效），各 pad 唯一信号（防串发），落塔即销毁同位两建造钮（占位）。全组合 clickable/caster/effect·零新能力。
   - **命中制**（消两 bug）：塔 firing 由"launch 抛射(锁全图最近·无射程·多帧累伤·穿透)"改为"`aggro`(Perception sightRadius 射程索敌)→ self-rule spawn `at:'target'`(仅射程内发·无空炮) → zap `Hitbox{consumeOnHit}`(单发精确 dmg)"。删 `t2-launch`。
   - **清理**：删死代码 `w1-random`/`t2-event-when`/`t2-timeline`/胜负旗；局终 `engine.stop()` 省 CPU；HUD 防重复买（pending 时两钮皆禁）；补测试（放置合法性/占位/塔杀敌/胜/败/防重复买）。

## 8. 3D 盒庭化改造（owner「换成 3D 版本」· 2026-07-08）—— ⚠️ **已回退 2D（owner 同日「变回 2D」）·本节留作历史记录**

> **回退说明（2026-07-08）**：为贴 PST 2D-first 美术管线（`art:`→Sprite 换皮·2D 塔防每主体=一张俯视精灵天生契合），3D 版已**回退成 2D**（CanvasRenderer·commit 见 git log）。3D 实现停在 `git show 8de5a11c`·随时可取回。以下 §8=3D 版历史记录（口径/发现仍有参考·勿据以为现状）；现行 2D 资产规格见 `asset-requirements.md`。
>
> **口径：换渲染方法、不改玩法。** sim（pathfind/命中制/经济/放置/胜负）**一字未动**——只在蓝图加 render-only 3D 组件，
> 靠引擎「2D→3D 桥」把带 `Mesh3D` 的 2D 实体 `groundPose` 落到地面（sim x→世界 X、sim y→世界 Z、地面 y=0）。
> 全部 3D 组件（Camera3D/Mesh3D/Material3D/Light3D/Sky3D/Fog3D/Post3D/Glow3D/Transform3D）皆 render-only·不进 hash·不被 Condition 读
> → **确定性/回放/lockstep 与 2D 版逐 tick 同哈希**（`确定性双跑同 hash` 测试仍绿·2337 测试全过）。零新增引擎能力（消费的是既有 3D 渲染线，P3D 域）。

### 8.1 加了什么（全在 blueprint.ts 数据层·`scene3dEntities()`）

| 单例/组件 | 用途 |
|---|---|
| `Camera3D`（ortho·yaw 0.6·pitch 0.72） | 对角微俯正交盒庭机位（Captain-Toad 桌面微缩感·露深度+塔高） |
| `Light3D`×3（sun 投软影 + fill 冷紫补 + ambient 冷蓝） | 数据化光照·霓虹夜掠光 |
| `Sky3D`（暗渐变 + env 0.2 IBL）·`Fog3D`（暗蓝距离雾） | 天穹 + 金属微反射 + 纵深 |
| `Post3D`（bloom + tilt-shift + AO + SMAA·**刻意不挂 grade**） | 泛光=霓虹辉光·移轴=微缩·见 §8.2 |
| `ground`（Transform3D + Mesh3D box + Material3D matte+surface） | 近黑霓虹地台（出框·消悬浮卡片边） |
| 塔/敌/大本营/车道/pad/FX 挂 `Mesh3D` + `Material3D`(+`Glow3D`) | 见 §8.3 主角面台账 |

### 8.2 落地时的 4 处发现（截图验证·scratchpad/*.png）

1. **`Visibility{visible:false,active:true}` 隐形 sim-only 判定区**（killzone/漏怪探针/zap 命中区/隐形建造钮）——裸 Shape 否则在盒庭里渲成竖立方块；Hitbox/Clickable 仍 sim 生效（沿 game-f/combat 先例）。
2. **grade 色彩分级 pass 在此暗场把地台上翻成灰橄榄浊底**——逐 pass 隔离截图证实（bloom-only 干净、tiltShift-only 干净、加 grade 即糊）→ 弃 grade（霓虹自发光已够饱和）。
3. **env(IBL) 在掠射角把近黑地台 Fresnel 反射成暖橄榄**（RoomEnvironment 是暖影室）→ env 压到 0.2（够金属微反射·不泛白）。
4. **浮空核心用「height=2×塔高」骗 groundPose**（`groundPose` 恒把网格心置于 y=height/2）→ 小发光球被抬到塔尖（塔身/敌 body 无法真堆叠——见 §8.4 缺口）。

### 8.3 主角面资产来源台账（scorecard 维 2 要求）

| 主角面 | 来源 | 产物 | 说明 |
|---|---|---|---|
| 脉冲塔 PULSE | `procedural`(hybrid) | cone + 浮空核心球 + 发光平台盘·steel PBR + 青自发光 | **精修图元组合**（3 件套·非裸盒） |
| 轨道炮 RAIL | `procedural`(hybrid) | cylinder + 核心 + 平台盘·steel + 品红自发光 | 同上·与脉冲塔剪影区分 |
| 敌 basic/fast/tank | `procedural` | sphere / cone / cylinder·plastic·steel + 各自自发光 | 三型剪影差异化 |
| 大本营 | `procedural` | 三层堆叠（Transform3D·台+柱+核）+ Glow3D 绿光晕 | authored 静态·真三维堆叠 |
| **blocker** | — | — | **无 AI 资产生成 key**（TRIPO/MESHY/DASHSCOPE·env 未配·网络 000 实测）→ 无法产 bespoke glTF/贴图·退**精修图元组合**（scorecard 维 2 底线·台账已记 blocker） |

### 8.4 3D 化引入的缺口（记债）

- **敌人血条落 3D 世界锚缺口**：`Gauge` 写 2D `Shape.width`，在盒庭里会渲成竖立 billboard（脱离落地面的敌体）；`WorldUI3D` v1 只静态文字、**无动态 HP 绑定** → 本版**暂去掉逐敌血条**（大本营生命走 HUD 顶条）。建议 P3D 域记 **REQ-3D-WorldUI3D 动态绑定**（Resource→头顶条）后干净接回。
- **spawned 实体无法真垂直堆叠**：caster `at:'self'` 生成的塔只得 2D Transform（继承落点）→ 子件 `groundPose` 全压地面（无高度偏移），故塔身用单尊图元 + 浮空核心 trick，非多层堆叠（静态大本营用 Transform3D 才堆得起来）。属 groundPose 语义限制·非缺陷·记录备查。

### 8.5 视觉自评分（scorecard 八维·截图/bench 为证）

> `VISUAL: 19/24 · PREMIUM: YES`（全维 ≥2·唯维 2 系"精修图元组合 + blocker 已记"的达标·非 3 分 bespoke 模型）

| 维 | 分 | 证据 / 理由 |
|---|---|---|
| 1 艺术方向 | 3 | 统一合成波霓虹夜（青/品红/绿 + 暗台 + 自发光语言）·三截图同一款（mount-hud/final-late） |
| 2 主角面 | 2 | 精修图元组合（塔=体+核+盘·PBR+自发光·剪影区分）·**blocker 已记**（无资产生成 key）·路径到 3=真 glTF 英雄模型 |
| 3 世界密度 | 2 | 地台(带 surface) + 车道(道面+节点盘+出生门) + 塔/敌/大本营 ≥3 层·无裸色空地（偏简·可加环境装饰件） |
| 4 材质 | 2 | 全主体挂 Material3D（steel/plastic/emissive）+ 地台 surface 噪声·非全场 flat（env 压低换掉暖染·金属反射偏弱=取舍） |
| 5 渲染管线 | 3 | 主光+补光+环境有意图·Sky/Fog/Post(bloom+移轴+AO+SMAA) 全调过（非默认值·逐 pass 截图调参） |
| 6 VFX | 2 | 三关键时刻有反馈（建塔/命中闪/死亡爆闪·落地淡出发光球+bloom）·不喧宾（简·可升 Vfx3D 粒子） |
| 7 UI 美术 | 2 | HUD 走 LayoutNode + NEON_THEME 令牌（霓虹标题/♥⬡⚔ 芯片/PULSE·RAIL 钮）·非默认灰控件 |
| 8 性能证据 | 3 | bench PASS：mean 0.077ms·p99 0.255ms（预算 16.667ms）；2337 测试全绿；build OK |

## 7. 评审记录

- 提交人 / 日期：LEAD（本 session · game-q 立项 + 落地 + v2 QA 整改 + 3D 盒庭化） / 2026-07-08
- Lead 裁决：✅ **通过并落地**（零新增引擎能力·完整循环全组合现有能力·门禁全绿·bench 95/100；v2 修全表 QA bug；3D 化纯 render-only·sim 同哈希）；唯一真缺口=击杀记账，循环层用涓流经济绕过、记债 REQ-Q-击杀记账 待排期。3D 化引入 2 缺口（血条世界锚 / 英雄模型资产）见 §8.4·记债待 P3D/owner 排期。
