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
5. ✅ **商店+经济+升星（2026-06-10/11 分批落地）**：商店五件套+经济三件套+买经验/等级（条目 12/14/15）；升星全链见条目 20（★ 角标=独立星星子实体叠加，用户提的做法成立）。
6. ✅ **已接入（2026-06-10）**：多回合循环/回合重置（inbox F-7）。REQ-F-033（'@local:'，5ca52ec）落地后按 §5.3 草案原样接：复合棋子模板 + 槽位 + deploy/wipe + round_flow 循环；含两回合循环验收测。
7. ✅ **MVP-1 对齐第一批（2026-06-10，照 flow-spec §3.2/§4.1/§4.2/§4.5）**：L1 run_flow（boot/advance/victory/defeat + round_done 握手 + >5 进位 banded）、经济三件套（收入爬坡/利息/连胜金 = income_armed 窗 + 14 组 band）、阶段伤害（基础 0/2 + 存活近似 2，REQ-022 接真值待 Phase 3）、关卡表前 2 阶段（STAGES 数据：黄巾×0.45 / 董卓全强度，deploy_stage_N 按 stage_idx 分流）。game-f 测 **10/10**。
8. ✅ **用户实测三 bug 全闭环（2026-06-10）**：蓝条频闪（MANA_FILL 50→20，节奏数据非 bug）/ 三色阵营（名牌改队伍色，art-data 已同步修订）/ 瞬移（REQ-F-034 当日提报→主程落 glideSpeed→接入 0.8，inbox F-8 done）。
9. ✅ **ready 开战已接（2026-06-10）**：clickable「开战」按钮（240,170，无 Tag 不参战）→ 'ready_btn' 信号 → Effect 置 ready → prep 的 ready 转移优先开战、40 拍倒计时兜底；验收测走真实 InputQueue 指针路（坑：裸造 Signal 实体会被 event-when 全局先清后标扫掉，活不到 Commit）。
10. ✅ **odd-r 棋盘迁移（inbox F-10，2026-06-10）**：LAYOUT 'offset'→'odd-r'（视觉相邻=逻辑相邻，绕后/贴身不再骗人）；像素布局数学恒等画面不动；摆子数据维持视觉 (col,row)、入 sim 前 offsetToAxial 换算（slotEntity/装饰格/§5.4 配方注入均已带换算）。主程可删 'offset' 废弃分支。
11. ✅ **F-9 普攻 self 化落地（2026-06-10，三过家门）**：环(036)→排雷→残环→二刷(runsAfter:['hitbox'])→§5.4 贴回。普攻+回蓝已 per-instance（2×关羽不串台测绿）；唯一 id 脚手架只剩大招半截。
12. ✅ **商店买入核心（F-11/REQ-F-040，2026-06-10）**：袋12张→5槽→play 原子验扣（金3 + bench_space——备战席9当 playCosts 第二货币，席满=0 拒单零新机制）→ bought_code 据码 banded 分发 → buycast 入席 marker → 码复位。坑×2：deck 必须 [...] 副本（装配浅拷贝、嵌套数组跨 Engine 共享=确定性破口，实测）；capability 加 import 别忘数组（第二次）。
13. ✅ **大招半截完结（REQ-F-039 回驳的重组路线，2026-06-10）**：over-time 永久 regen（duration<=0）回蓝 + sidecar 自带 Perception 借 aggro 锁敌 + SelfRule{蓝满→spawn ult at target→清蓝}；mp 改普通 id（蓝条 fromParent 指 '@local:mana'）→ **全链 per-instance 零唯一 id，重复购买/三星合体就绪**。
14. ✅ **商店余三件（F-12/REQ-F-041，2026-06-10）**：自动/手动刷新 + 锁店 + 点席卖出。核心难点=「门判定脉冲」shop_gate_done：armed 升沿当拍先判（refresh 门读 Commit 前 locked 值）同拍 Commit 拆（撤臂+解锁）——躲开'解锁先于门判定'（锁形同虚设）与'解锁复燃 edge 补刷'两个次序坑；锁语义=恰跳过下一个 prep 刷新一次。
15. ✅ **玩家体验四件套 + F-14/F-15（2026-06-10 深夜）**：备战 30s 节奏档（装配参数，测试快速档）/三态+终幕横幅（round_ui 状态镜像）/HUD 六数字（text-binding）/商店 5 槽面板可视可点（两段脉冲清/重铺防同拍误杀）。
16. ✅ **批 B（2026-06-10 深夜）**：关卡表全 5 阶段（吕布/官渡/赤壁 Boss，hpMul 近似星级；槽位 id 加序号修同名撞键真 bug）/ 野怪回合（阶段1 全部+各阶段 r5，PVE_WAVES 5 档；死亡掉法球 LOOT，未拾随 wipe 清）/ 加时 45s 强制结束（combat_clock + reset-timer 链，单人改编=败方路径）。
17. ✅ **批 C 主角小小英雄（2026-06-10 深夜）**：WASD/方向键自由移动（Controllable→Velocity→motion-apply，launcher 挂 KeyboardInputSource）；PROTAG 位不被锁/不被打/不被清场，名牌'主公'随行；碰法球即拾（过渡版）。两个实测钉死的坑：§4.7 草图'双向 hitbox 两清'撞 trigger-zone'恰好一方 zone'互斥 → **REQ-F-044 consumeOnHit 已提池**（入账链已就位，落地即通）；hitbox amount=伤害语义（草图 -9999 实测=每拍奶满球，正负要反着写）。
18. ✅ **批 D 符文三选一（2026-06-10 深夜）**：回合1备战期顶部三卡（屯粮+10金/砺兵+8XP/广纳席+2），点选生效+destroy-tagged 整组收走=天然一次性；经济型避开 buff 施加依赖（战斗型符文随羁绊 buff 机制后补）。
19.5 ✅ **F-16 三件落地（044/047/048②，2026-06-10 深夜）**：主角赏金两清（order 钉序坑记档）/蜀魂羁绊最小版（group-count→edge 锁存→scaleByResource 乘区，战斗型符文从此解锁）/卖出袋归还（returnOnSignal）。余 F-17 升星+自动卖、F-18 拖拽摆子（模板星级化结构改造，下一批）。
19. ✅ **F 批证伪入池（2026-06-10 深夜）**：REQ-F-045 摆子拖拽（输入域 drag+落点载荷+改阵容动词三缺）/ 046 升星合成（同名计数+N换1 原子）/ 047 羁绊 buff 施加（hitbox 活系数乘区=REQ-023 簇最窄落点）/ 048 自动卖+袋归还。剩余 ⬜ 全部有去向：044 赏金 / 045-048 / 选秀九选一（可复用商店面板形，排 045 后）。引擎件全等主程，监听值守。
20. ✅ **F-17 升星全链 + F-18 数据侧（2026-06-11，「能做的全做完」批）**：
   - **升星（受限版但数值真入战）**：席位 marker 三档模板族（bench/bench2/bench3_<将>，★ 角标子体）+ 每将两条 MergeRule 三连连锁；星级带 star_<将>（GroupCount 含齐 STAR2|每将位 → 三条升降 edge 带，覆盖卖高星回落）；部署窗按星分流 12 槽位（slot_<将>_s1/2/3，overrides 血 ×1.8^n + SelfRule.do 换 strike/ult_s<星>=伤 ×1.5^n）。**坑（新）**：部署窗必须门脉冲化（deploy_gate_done 同拍撤臂）——窗开全带齐发后立刻关窗，否则备战中途合成把 star 从 1 改 2，s2 带在同窗 false→true 复燃=场上双关羽（实测先撞后修）；星级中途升档下回合生效（known wart，F-049 槽席统一后再审）。
   - **席位会计改派生**：bench_space = bench_cap − bench_occupied（GroupCount BENCH_OCC 位 + 恒真 level 带每拍重算两 Effect 定序 set/add coeff:-1）——合成 3→1 自动回 2 席、卖出自动 +1，原手工 ± 链整段删除；rune_c 改写容量源 bench_cap。playCosts 扣的 1 会被重算覆盖（原子拒单语义不变，≤3 拍自愈）。
   - **超员自动卖**：cap_armed（prep→combat 两转移臂）→ enforce_cap → destroy-tagged TEAM_A keepResource:'level'。现 4 槽恒 ≤level=休眠保险丝；**既有 F-9 多实例测试为此先抬 level 再注入**（5 单位>4=按规则被卖，特性正确性的反向证明）。
   - **袋扩容**：SHOP_DECK 24→36（9/将，3 星可达）；只追加不重排——前 24 张次序锁死全部既有手牌断言。
   - **星级卖价**：sell2/sell3_<将> 链 8/26 金（=3×3−1/3×9−1）；2/3 星卖出袋不归还（3 张已熔毁，按张语义不成立）——TUNE 注记。
   - **F-18 数据侧**：marker 全星级挂 Draggable{onlyFlag:'in_prep'}（惰性零开销）+ in_prep 门旗 flow 维护 + 就绪度测试。**系统注册被 SCC 挡**：drag-place↔motion-apply 互为 Transform RMW 对（六件套漏 'motion-apply'，game-f 是首个两者同场的世界）——探针二分定位 + 补丁假设克隆验证 60 拍绿 → **REQ-F-050（一行 runsBefore）**；「部署链随新位置展开」三路纯数据证伪（grid-move 双键查询罚站/overrides 静态/常驻 Caster 在席出兵）→ **REQ-F-049（Caster.requireHexPos + HexPos 继承）**。两单落地后解注一行+补 snap/cap 字段即全通。
   - game-f 测 24/24（升星/拖拽预备/超员相关 3 新测），全套 1087 + build 绿。HUD 第七行「空席」。
21. ✅ **代行主程批（2026-06-11 晚，用户授权出差代行；引擎五件+统一架构终态）**：
   - **引擎**（细节+换位评审记录全在 requests.md F-049~053）：部署门+出身格哨兵（049）/drag-place 定序一行（050）/占位收窄三分法（051——自己的 v1 被既有"静止目标"测试打回后重落，阻挡/查找两用途分治）/GroupCount.onBoard 席板分账（052）/壳层点拖互斥（053——实测抓获：按住 marker 起拖即被 down-click 卖掉，真实指针同病）。
   - **game-f 终态**：marker=上场槽（Caster{requireHexPos}+'@origin-hex' 跟手+Draggable snap/cap+Clickable up）；开局=bootcast 播种 4 在板 marker（与买入同族）；部署窗移入战拍+resolution 关窗+combat after:30；条目 20 的受限版（12 槽位/星级资源/升降带/门脉冲）**整段删除**——星级=模板族本身。
   - **新坑入档**：①部署窗跨 resolution=指针翻转误发双倍敌阵（窗语义=恰本场入战拍，结算即关）；②可拖+可点实体必须 Clickable{phase:'up'}（壳层 up/drag 互斥的配套约定）；③合成测试断言锚点前先想清「最老实例在哪」——板上的开局 marker seq 最小，合成会**原地升星**而不是在席上出现。
   - game-f 24/24（开局播种/入战拍展开/升星全链含原地升星/拖拽全量含限额拒超）；全套 1093 + build 绿。
24. ✅ **实测批二（2026-06-11 深夜：换位/垃圾桶/点卖陷阱/远程贴脸/战后残留/动态结算）**：F-058 拖到被占格=换位+DropZone 垃圾桶卖出（独立 drop-zone 系统——「effect-apply 是 Commit 相位、event-when 全局扫 Signal、信号写者拆独立死端系统」三条定序铁律入档；最短环打印探针替代瞎猜）；F-059 Clickable.onlyFlag（点选卖出停用=陷阱拆除）；F-060 GridMover.range 射程驻足（近战1/法师3/弓手4）；PROJ 位庆祝拍清在飞弹；收入窗移结算+战果面板逐行淡入实时跳数。game-f 26/26、全套 1102。
23. ✅ **表现/打击感批（2026-06-11 晚，用户口述八条 + 四 bug 批）**：幽灵 marker 战斗期隐藏（REQ-F-056 set-visible-tagged）/商店价签/符文标题+开战收走/星级放大辨识；落子压扁回弹（REQ-F-057 Tween.keep+drag-place 重放钩）/战后 celebrate 相位（胜败横幅+金彩喷洒+幸存亮相）/合成金闪/呼吸微动/远程法术真弹道（纯数据追踪弹：Perception+Steering+consumeOnHit）/被击红闪+斩光余韵（zlift Shape 抬层 hack）/死亡四分碎裂（dropTemplate 管道；野怪 mob_death 复合=法球+碎片）。follow-up 记档：攻击者前刺、三幻影聚拢、「仅移动时」抖动门。全套 1102 绿。
22. ✅ **用户五条钦定批（2026-06-11 晚）**：①棋盘改 **7×8=56 格真规格**（旧 12×12 是注释与实现失配的错版；全站位压进 col0..6/row0..7、中线 r3|r4 贴脸、TILE 40、ARENA/主角/按钮全反流）；②商店改**三大框选卡页**（小丑牌式，handSize 3、大卡 58×68、底板+框 placeholder 待 UI 资源；SHOPSLOT 位裁回 3）；③**开战倒计时**（零引擎件：prep_left 资源 OverTime -1/秒 min=0 钳停自终止 + L2 新 countdown 状态——ready 也要数 3-2-1，不许瞬开；HUD 金色读秒、战斗期隐藏）；④**刷新枯竭 bug 根治**（REQ-F-054：refresh 旧手回袋底，卡池守恒）；⑤**备战席托盘**（REQ-F-055 t2-tray：9 槽平台、买入自动落最小空槽、席内拖拽互换、上板让座、无效落点弹回；9 槽框 placeholder）。坑（新）：toolbar 类按钮坐标被布局反流牵连的测试要整批跟手；7×8 中线贴脸后「前排出生即相邻不走位」——滑行/走位类断言要抽样后排单位。game-f 24/24；全套 1097 + build 绿。

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

### 5.4 F-9 普攻 self 化接入配方（✅ 036 二刷后已照此贴回 mainbranch 2026-06-10，本节存档备查；实际落地含 whenGlobal 门 + odd-r 坐标换算 + 2×关羽/阶段门两验收测）

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
>    （大招半边 EventWhen+ultcast+drain 本轮**不动**——sidecar 仅一条 SelfRule 名额已被回蓝占用，完整 self 化等 REQ-F-039 rules[]（原编 037 撞号让位）。）
> 4. **验收测 ×2**：① 2×关羽不串台——tick 20 注入第二份 `hero_a_guanyu` SpawnRequest（HexPos q3r7、Tag TEAM_A、hp overrides），窗口 [20,88) 收集 `strike_a_guanyu#` 实例集合，断言 ≥2（窗内单实例至多 1 击）+ 双 main 存活；② 备战/结算无伤害（策划要求的防回归）：prep 期所有 main 满血、resolution wipe 前无新 strike 实例。
> 5. 头注释同步（普攻行 + 唯一 id 段），tsc+vitest+build 全绿推。

## 6. Gotchas（坑）

- **利息区间带的带宽语义**：armed 窗内 gold 上穿/下落入带都触发一次 edge（注资或消费会蹭到 ±一档利息）——确定性、每带每窗至多一次，但经济偏宽；TUNE 候选=利息带挪到 armed 升沿前快照（需引擎拍照语义）或接受现状。测试一律在窗外（combat 期）做金币操作。
- **capability 三件套**：组件挂上 ≠ 能力注册——import、capabilities 数组、（若有）组件 provides 三处都要；本日三次踩坑（selfRule/cardPile/craftRecipe 各一次），接新能力先过这条。
- **唯一 id 策略**：每英雄 `atk_<id>/mp_<id>/strike_<id>/ult_<id>` 唯一，规避"逻辑链全局按 id 寻址"串台（MVP-0）。**重复棋子/三星合体**会撞——需接 REQ-021 self 作用域（主程已 done，未接）。
- **mana 在 sidecar 实体**（一实体一 Resource，棋子本体已占 hp）。
- **名字 zOrder hack**：Text-only 实体 zOrder=0（被棋子盖）；给名字加个 Sprite（文本模式不绘）只为抬 zOrder=30。REQ 一个"Text 也能设 zOrder"会更干净（未提）。
- **hp 共享 id 'hp'**：hitbox 局部路由依赖它，**不能改唯一**；所以血条子条要读"父"的 hp（REQ-F-029 已写明）。
- **armed 窗内条件叶被改写=带复燃**（F-17 实测）：窗开期间任何会被链路自己改写的条件叶（如 star_<将>）都可能让某带 false→true 迟到触发——部署这类「一窗恰一发」语义的窗，开窗拍就要门脉冲撤臂（deploy_gate_done 同 shop_gate_done 纪律）；只有 income 这类「窗内多带各自至多一次」语义才允许长窗。
- **新系统进全图先跑 SCC 探针**：capability 自带测试绿 ≠ 全图无环（drag-place 7 测绿、入 game-f 即 22 系统 SCC——它与 motion-apply 的 Transform RMW 对只在两者同场才成环）。定位法=逐个 drop 二分元凶 + 克隆 capability 补 runsBefore 假设验证（测试里 spread-clone，不碰引擎源）——把"猜的修法"变成"验过的修法"再提 REQ。
- **派生资源与 playCosts 共存语义**：bench_space 既是派生值（每拍重算）又是 playCosts 货币——扣款会被下拍重算覆盖，但原子拒单只看扣款瞬时值 → 语义成立；代价是 ≤3 拍的瞬时回弹窗（人手速不可感知，测试断言留 ≥4 拍余量）。
- 调参旋钮都在 `blueprint.ts` 顶部常量：`HP_SCALE / MOVE_PERIOD / ATK_CD / MANA_REGEN / DOT / STAR_HP_MUL / STAR_DMG_MUL / SELL_PRICE`。

## 7. 分支

game-f 全部在 **`claude/mainbranch`**（用户授权直推）。REQ-F-031/032/033 均为本席位上报→主程落地→本席位接入的完整闭环（031 方案 A / 033 方案 B 皆被采纳）。
**本轮（2026-06-10）**：F-5 血条/蓝条 + F-6 冰冻定身 + F-7 回合重置（多回合循环）三项接入已直推 mainbranch，inbox 均已回执；game-f 测 9/9。
> 下一项 = **MVP-1 余项**（flow-spec §6.2：L1 run_flow、商店三件套、经济三件套、关卡表前 2 阶段、ready 输入）——**全纯数据、无引擎阻塞**，照 §6.2 队列逐项接、逐项补测。
