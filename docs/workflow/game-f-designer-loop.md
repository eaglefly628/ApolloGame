# Designer F ↔ Program F · 循环工作板

> Designer F(策划/PM)出策划案 + 验收;Program F(程序)读本板开发,动引擎的先自做完推主程 review。
> **每 ~15 分钟一循环**(2026-06-16 owner 调:轮值执守 15 分钟/次),不停。最新循环在最上。

---

## 循环 #35 · 2026-06-16 · Designer F —— 🎯 主动用牌 QTE 闭环达成

### 验收:P1.5 点地锦囊交互闭环 → ✅ 通过
- combat.ts 锦囊 fx 模板:`jinnang_huoshao`(范围 DoT)/`jinnang_dingshen`(范围 FROZEN),`caster@pointer` 落点展开、对 TEAM_B。game-f.tsx 接**点锦囊→瞄准态→点棋盘→放**。加了回归测(火烧 at=pointer + craft 扣充能 + fx DoT/FROZEN)。**零引擎、101 测绿。**
- 🎯 **owner 要的"实时用牌"全到位**:点火烧连营→点棋盘一块→那里烧 DoT;定身→范围冻。卡牌可见(P0)+被动触发(小丑牌)+主动点放(锦囊)三件齐。

### 趁窗口铺下一批:剩余锦囊 catalog(循环#34 已设计,照数据形填)
> P1.5 交互闭环已通 → 下列 4 张**照 combat.ts 锦囊 fx 模板 + decks.ts jinnang 条目直接填**,全现成能力、零引擎、各配测。
- **万箭齐发**(pointer):`caster@pointer` → `hitbox{amount:大, targetMask:TEAM_B}` 范围真伤一击(无 DoT,= 火烧去 DOT)。
- **疑兵增援**(self):`self-rule/caster spawn ash_yari×2`(TEAM_A 友军,= 太阁召援镜像友方版)。
- **妙手回春**(pointer):`caster@pointer` → `hitbox{amount:负, targetMask:TEAM_A}` 范围治友军(= 石田治疗 targetMask 换我方)。
- **空城计**(self):craft 扣充能 → 全队短时**减伤**全局资源(= 北条龟缩镜像我方;若"我方减伤系数"无读者,先重组/缓,不拓引擎)。
- 验收:四张各能点放、效果对、charges 扣减;101+ 绿、零引擎。平衡数值待 owner 真机调。

---

## 循环 #34 · 2026-06-16 · Designer F —— 空档主动设计:锦囊 catalog(主动牌内容池)

> game-f 空闲(搭档在 game-g),不空等。把主动锦囊设计成**一整套 drop-in 内容池**,P1.5 点地交互通后,这些照填即上。**全映射现成能力(caster/hitbox/over-time/spawn),零引擎。**

### 锦囊 catalog(首批 7 张;`{kind:'jinnang', id, name, target, charges, ...}`)
| 锦囊 | target | 效果 | 数据形(现成能力) | 状态 |
|---|---|---|---|---|
| **鼓舞** | self | 全队 +20% 攻(1 回合) | craft 扣充能 → dmg_scale_a(已做) | ✅ 已实装 |
| **火烧连营** | pointer | 点地范围灼烧 DoT | `caster@pointer` → spawn zone + `hitbox{dotPerTick,dotDuration, setMask:BURNING}` | 待 P1.5 |
| **万箭齐发** | pointer | 点地范围真伤一击 | `caster@pointer` → `hitbox{amount, targetMask:敌}` | 待 P1.5 |
| **铁索连环** | pointer | 点地范围定身 | `caster@pointer` → `hitbox{setMask:FROZEN, statusDuration}` | 待 P1.5 |
| **疑兵增援** | self | 召 2 友军杂兵 | `caster/self-rule spawn ash_yari×2`(TEAM_A) | 待 P1.5 |
| **妙手回春** | pointer | 点地范围治友军 | `caster@pointer` → `hitbox{amount:负, targetMask:友}`(石田治疗同款) | 待 P1.5 |
| **空城计** | self | 全队短时减伤(防守版鼓舞) | craft 扣充能 → 全局减伤资源(hitbox 读全局,信长镜像同款) | 待 P1.5 |

### 回驳(守纪律,不入池)
- **草船借箭**(把伤害按目标状态重定向到另一资源)= 撞 §7 已回驳的"伤害分型/重定向"缺口 → **不做**(为一卡拓宽引擎违 YAGNI)。
- **驱虎吞狼/嘲讽**(强制改敌索敌)= 目标侧机制(F-062 域,Lead 暂缓)→ 暂不做。

### 给 Program F
- P1.5 点地交互闭环通后,上表 6 张 pointer/self 锦囊**照数据形直接填**(全现成算子);每张配回归测。
- 平衡:charges、范围、数值首版待 owner 真机调;先把"看得见、点得动、有变化"做出来。

---

## 循环 #33 · 2026-06-16 · Designer F

### 验收:P1 主动锦囊(框架 + 鼓舞)→ ✅ 通过
- CardSpec 加 `jinnang`(charges/buff/fxTemplate/target);**鼓舞**(战中点→全队 +20%攻,每回合 1 次,充能+回合刷新+craft 扣充能)。全现成算子、**零引擎、98 绿**。还接了 owner 反馈「勿重合左栏」(牌组面板重排)。
- 🃏 **鼓舞(点一下→全队 buff)已完整可玩** = owner 要的"实时用牌"参与感的第一张。

### 下一步:P1.5 点地锦囊交互(把 QTE 补满)+ 加测
- **点地类锦囊**(火烧连营=范围 DoT / 定身=范围 FROZEN / 增援=spawn 友军):数据已接 `caster{at:'pointer'}`,**差"点锦囊→进点地态→点棋盘落点"的交互闭环**。
- 复用现成:`clickable`+`state`(点地态)+ 既有 pointer 输入(Game D 点地放火证过)。零引擎。
- **加锦囊回归测**(鼓舞扣充能/回合刷新;点地落点施 fx)——现 98 测未覆盖锦囊。
- 验收:战中点火烧连营→点棋盘一块→该处烧 DoT、扣充能;tsc+vitest 绿、确定性 hash 不变。

---

## 循环 #32 · 2026-06-16 · Designer F

### 验收:P0 局内可见牌组 → ✅ 通过("看不到牌"已修)
- HUD 面板「出战牌组 · Build」:一排卡面,每张 🃏 + 卡名 + **当前效果值**(读 buff/count 资源)+ **开战边沿 flash**。表现层、读现有数据、**零引擎、98 测绿**。
- 📌 owner 复玩点:进局看右侧"出战牌组"面板——能看到 5–8 张牌 + 开战时数值跳动。若效果文案不够直白(想要"魏骑×4→+24%攻"那种),回我再细化文案。

### 下一步:P1 主动锦囊层(循环#31 已派,催实装)
- CardSpec 加 `jinnang` 主动类 → 局内锦囊手牌(可点+charges)→ 点地 `caster{at:'pointer'}` 放效果。首批:火烧连营/增援/鼓舞/定身。复用 Game D 点地放火,零引擎。
- 这是 owner 要的"实时用牌"参与感的核心。

---

## 循环 #31 · 2026-06-16 · Designer F —— owner 真机反馈:卡牌局内隐形(P0+P1)

> **owner 试玩发现**:小丑牌/牌组**局内完全隐形**(`buildDeckRules` 只产隐形 buff 数学)——看不到牌、不知用了啥、无操作感。**owner 拍板做 P0+P1。** 全纯游戏侧/表现层,零引擎。

### P0 · 让小丑牌「可见」(表现层,先做)
- **局内 HUD 一排卡面**显示出战 Build 牌组(`cfg.deck.cards`):每张 = 名 + 图标 + **当前效果值**(读对应 buff 资源,如"虎豹骑令:魏骑×4 → +24% 攻")。
- **触发可见**:开战锁存那拍,该卡 **flash + 蹦效果数字**(现成 `Tween`/`Text`/`Sprite`)。
- 纯表现层(读现有 deck + buff/count 资源渲染),**零引擎**。**验收**:局内看得到 5–8 张牌 + 生效时动一下、显数值。

### P1 · 主动锦囊层(后做,补 QTE 参与感)
- **CardSpec 加主动类**:`{ kind:'jinnang', id, name, fxTemplate, target:'pointer'|'enemies'|'self', charges }`(数据)。
- **加载**:`buildDeckRules` 把锦囊卡 → 局内**「锦囊手牌」**(可点 marker + charges 资源),**不进 buff**。
- **操作**:战斗中点锦囊 → 进"指定/点地"态 → 点棋盘 → `caster{at:'pointer'}` 展开效果。**= 现成"点地放火"(Game D 已验证,lockstep 安全),零引擎。**
- **首批锦囊**:火烧连营(范围 DoT)/ 增援(spawn 2 友军杂兵)/ 鼓舞(全队短时 buff)/ 定身(范围 FROZEN)。每局每张 1 用、回合刷新。
- **验收**:战斗中点锦囊→点地→效果生效、charges 扣减;零引擎、确定性 hash 不变。

### 数据驱动守 + 给 Program F 的纪律
- 锦囊 = 数据(id+fx 模板+target)+ 现成 `caster/hitbox/over-time`,**零新引擎能力**。**先查** `caster at:'pointer'` 是否已支持(Game D 点地放火证过);若锦囊手牌的"指定态"表达不了,**先重组**(clickable+state+caster),真缺口才提主程。
- **先交 P0(快、解决"看不到"),再交 P1。**

---

## 循环 #30 · 2026-06-16 · Designer F

### 验收:game-f 视觉回归(SVG 无头截图 + 快照 diff)→ ✅ 通过
- `frame-svg.ts`(World→SVG 投影)+ `game-f.frame.test.ts`(备战/战斗 golden SVG 快照)+ `__frames__/*.svg`(golden)。**无浏览器、确定性视觉回归**——画面一变快照 diff 即红,守住"看帧"。**98 测绿。** 渲染器/工具层,非游戏 system。
- 连带 Program F 近期还落了 **Loop B 全路径回归探针 + BFS 状态图爬 + 点遍按钮测**——game-f 的**自动化质量网**织起来了。

### 澄清(给 owner):Program F 没卡,在做质量基建
- game-f 提交节奏:6 / 71 / 83 分钟前(视觉回归 / 状态爬 / 按钮测),**98 绿,活跃**。
- 它做的是**测试/验证基建**(自查 game-f 不回退),**不是我队列里的 gameplay polish**(AI 难度/掷点手感)。两者不冲突;polish 队列仍就绪,Program F 转回 gameplay 即接。

---

## 循环 #29 · 2026-06-16 · Designer F —— 补验收 #28(我之前漏了)

### 验收:太阁/岛强度按攻岛人数缩放(#28)→ ✅ 通过(迟到的验收)
- `coop.ts`:`enemyScaleForPlayers=1+0.3×(n-1)`(hp:单机1.0/双人1.3/三人1.6)+ `enemyAtkBaseForPlayers=1+0.15×(n-1)`(atk 缓,防与信长/毛利叠爆)+ `COOP_GOAL_PER_OWNER` 岛 goal ×人数。**防秒岛、单机不变。零引擎、94 测绿。**
- 🙏 PM 自查:我在 idle-rearm 期间**漏验了这笔**(它做完时 watcher 没捕到),现补上闭环。

### 现状:game-f 不是"卡死",是被 game-g 抢了注意力
- game-f 队列已喂(AI 难度档 / 掷点份额手感 / REQ-018 真联机=主程)——**无人接,因团队全在 game-g**(VIS 真渲染,最近提交 81 秒前)。
- game-f 单机+本地三人 v1 **已可玩、94 绿**;剩的是锦上添花 polish + 真联机(主程)。**不阻塞,等 game-f 有 session 回来即接。**

---

## 循环 #28 · 2026-06-16 · Designer F

### 验收:贡献后置曲线 → ✅ 通过
- 按关卡层级加权:滩头杂兵=6 / 国人众=18 / **天守 Boss=45**;序盘锁不死、岛主到终盘才定。回归测 + 快照守更新。**零引擎、90 测绿。** anti-snowball 到位。

### 派 polish:太阁/岛强度按「攻岛人数」缩放(三人平衡的根)
> 现太阁/岛是**单机基线**调的;三人(1 人+2AI)同凿一岛 → **输出约 3×** → 单机基线会被秒,岛太脆。
- **岛屿进度目标 × 人数**(`COOP_GOAL_PER_OWNER` 已有迹象,确认按 owner 数 scale)+ **太阁 hp/atk 按攻岛人数档**(2-3 人更厚更凶),让三人局有挑战、终盘 Boss 扛得住到"抢人头"那刻。
- **验收**:三人局岛/Boss 不被秒、一局时长合理、终盘有抢 Boss 张力;单机不受影响(人数=1 时基线不变);tsc+vitest 绿、零引擎。
- 队列:AI 难度档(盟友不抢戏也不躺平)/ 掷点份额手感 / juice。REQ-018 真联机待主程。

---

## 循环 #27 · 2026-06-16 · Designer F

### 验收:多人 polish 共享岛贡献榜 → ✅ 通过
- `renderCoop` 扩 `ranking` → HUD 渲染名次榜(👑 岛主冠 + name·faction·贡献值),**纯表现层**(读 island.ranking、不进 sim)。co-opetition 张力可见。**零引擎、89 测绿。**

### 派 polish 核心:贡献权重「后置」曲线(防一人独大,保排名悬念)
> 这是三人局好玩的关键杠杆(早在设计期定的 anti-snowball):**别让序盘领先者锁死岛主**。
- **每太阁 `contribution_weight`,序盘低、终盘高**:滩头杂兵=1 · 国人众部将=5 · 天守 Boss=**40**(数据,改 taikou/结算)。
- 效果:**岛主到"终盘抢 Boss"那刻才定** → 三人全程紧绷、有翻盘;还强化"抢 Boss 人头"高光。
- **验收**:三人局序盘领先不锁胜,终盘 Boss 贡献能翻名次;tsc+vitest 绿、零引擎。
- 其余 polish 队列:AI 难度档 / Boss 强度按三人(2人+岛)调 / 掷点份额手感 / juice。
- (REQ-018 真联机仍待主程档期。)

---

## 循环 #26 · 2026-06-16 · Designer F —— 🎉 A+B game-side 完成

### 验收:B·slice3 组队房接三人配置 → ✅ 通过(本地三人攻岛 v1 跑通)
- 组队房 2 AI 盟友席(各选阵营)→ `onStart({deck, allies})` → 起玩家+2AI → coop 3-owner 共享岛。**本地三人攻岛 v1 完整闭环**(配置→各自盘→共享岛→掷点分卡→岛主排名)。**附魔级烘进卡数值带进三人局**(养成×多人打通)。**零引擎、89 测绿。**

### 🎉 里程碑:owner 指示 A(附魔/养成)+ B(多人本地)game-side 全部完成
- 单机:3 阵营 · 5 牌组+自组牌 · 太阁全 Boss · 贡献/攻岛 · 大厅 · **养成闭环(抽卡+组牌+附魔+段位)**。
- 多人:**本地三人攻岛 v1**(共享岛 + 掷点分卡 + 岛主,mirror 同步)。

### 下一步(B 唯一剩件 = 主程;game-side 转 polish/平衡)
- **① 真·远程联机(REQ-018,主程/网络层)**:把"本地玩家+2AI"换成"真三人 WS/WebRTC"。**handoff 主程**(game-side 已备 mirror/coop/掷点;只差传输层)。Designer 出对接说明,不越界写 `src/net`。
- **② game-side polish/平衡**(Program F 可做):三人局 AI 难度档 / 贡献权重曲线(防一人独大)/ Boss 强度按三人调 / 掷点份额手感 / juice。
- ③ 备选:phase3 交易市场(owner 押后)/ 更多牌组·太阁 variety。
- 建议 Program F 先做 ②(三人平衡/手感,让本地 v1 好玩),REQ-018 等主程档期。

---

## 循环 #25 · 2026-06-16 · Designer F

### 验收:B·slice2 Boss 宝箱掷点分卡 → ✅ 通过
- `distributeBossLoot(owners, lootCount, pool, rng)`:**按贡献轮选**(第一先挑、份额随名次 3卡=高2/低1)、确定性 rng、边界(0卡/空池)处理 → 入各 owner 收藏(多人第二获取源)。co-opetition「合作杀 Boss、按贡献分赃」。**账号/coop 层、零引擎、89 测绿。**

### 派 B·slice3:组队房 S2 接三人对局配置(UI 骨架已存在,做接线)
> 核现状:`lobby.tsx` 组队/seat 已有 ~18 处骨架 → 本 slice = **把它接上三人对局**,不重写。
- **3 席配置**:每席选 `{阵营(蜀/魏/吴) + 牌组(preset/自组) + 人|AI}`;空席默认 **AI 补位**(承 N-owner 架构)。
- **喂 coop**:开局把 3 席配置 → `coop.ts` 的 3-owner 对局(各带 rosterFor(阵营)+assembleDeck(牌组));复用单机选牌路径。
- **闭合三人一局**:配置 → 三人各自盘(玩家+AI)→ 共享岛进度(slice1)→ Boss 宝箱分卡(slice2)→ 岛陷落出排名/岛主。**= 本地三人攻岛 v1 跑通。**
- **验收**:组队房选 3 席 → 开局 → 三人共享岛一局完整 → 岛主排名 + 各自收藏到分卡;tsc+vitest 绿、零引擎、mirror 不进 hash。
- **押后**:真·远程联机(REQ-018 WS/WebRTC,主程);本 slice 只做本地(AI 补位)可玩。

---

## 循环 #24 · 2026-06-16 · Designer F

### 验收:B·slice1 本地三人共享岛 + per-owner 贡献排名/岛主 → ✅ 通过
- 新 `coop.ts`(共享岛聚合三 owner 贡献 + 名次→岛主)+ `ally-mirror.ts`(明定 **Mirror 非 lockstep**,读各盟友 contribution)+ `island_taken→victory`。**mirror 同步、零引擎、87 测绿。** 三人地基立住。

### 派 B·slice2:Boss 宝箱掷点分卡(co-opetition 高光,账号层)
> "合作杀 Boss、竞争分赃"——co-opetition 的核心张力,纯账号层/数据,零引擎。
- **触发**:三人合力打掉天守 Boss → 宝箱掉 N 张小丑牌(小池)。
- **分配**(本地 3-owner v1,AI 补位):**按本局贡献排序轮选**(贡献最高者先挑 1 张)→ 入各自收藏;或可选**掷点**(WoW /roll,确定性 seed)。AI 自动挑(随机/补缺)。
- **闭合多人养成**:多人局也喂收藏(单机抽卡之外的第二获取源,co-opetition 味)。
- **验收**:三人局打到 Boss → 宝箱 N 卡 → 按贡献分入各 owner 收藏;account 层、零引擎、87+ 绿。

### B 后续(本 slice 后)
- 组队房 S2 UI(大厅:3 席选阵营+牌组,空席 AI 补位)——把单机选牌接到三人配置。
- 真·远程传输(REQ-018,主程/网络层,押后);先把 local 三人玩法跑全。

---

## 循环 #23 · 2026-06-16 · Designer F —— A 附魔收口,转 B·多人

### 验收:A·附魔(养成第二轴)→ ✅ 通过(A 完成)
- `disenchant`(分解多余卡→尘 dust)+ `enchantCard`(spend 战功+尘,成本 `100×2^lv / 2×2^lv` 递增)+ **assembleDeck 按 enchant 放大每卡数值**(per-card Balatro modifier,按我 #22 spec 重构)。account 层解耦、**零引擎、83 测绿**。**养成系统(抽卡+组牌+附魔+段位)收口。**

### ▶ 转 B·多人/三人征日(方案乙:分盘 + 共享岛;mirror 同步)
> REQ-F-057 PF 定论:game-f 走 **mirror**(权威端各自跑 PvE、对端只还原显示不重演)→ **浮点确定性不阻塞三人**。先做 **game-side 三人框架**(本地 + AI 补位,可测);**真·远程联机(WS/WebRTC)= REQ-018 主程/押后**。

**B·slice1(派 Program F,game-side,核现状�’盟友镜像’已有右栏):**
1. **N-owner 对局配置**:3 个 owner(玩家 + 2 AI,**人不全 AI 补位**=已有 N 阵营架构),各带**阵营+牌组**(复用单机 rosterFor/assembleDeck)。
2. **共享岛屿进度**:三人各自盘的攻岛贡献凿**同一座岛**(`island_progress` 累加三方贡献);满 → 全局岛陷落、本局结束。
3. **per-owner 贡献 + 名次 → 岛主**:结算读各 owner 贡献排序(承贡献度系统;单机 scaffold 已有,扩 per-owner)。
4. **盟友镜像**:右栏已有(循环更早),接真三人各自盘只读镜像。
5. **Boss 宝箱掷点分卡**(账号层多人):合作杀 Boss → 宝箱 → 按贡献/掷点分小丑牌(co-opetition)。
- **验收**:本地 3-owner(1 人+2 AI)一局攻岛 → 共享岛进度涨 → 岛陷落 → 出贡献排名/岛主;tsc+vitest 绿、零引擎、mirror 不进 hash。
- **押后(主程/网络层)**:REQ-018 真远程传输;先把 local 三人框架跑通。

---

## 循环 #22 · 2026-06-15 · Designer F —— owner 拍板:先 A 附魔,再 B 多人

> owner 2026-06-16:**先做 A 附魔,完了直接做 B 多人;过程中不问、不停。** Designer F 按此驱动到底。

### 派 A·附魔(养成第二轴,account 层 + assembleDeck;纯游戏侧零引擎,spec §五)
> 先核 account.ts 现状(collection 结构),不重复;account 自注"附魔随后切片"=未做。

- **数据**:collection 每卡从 `count` 扩成 `{ count, enchant: 0..3 }`(0 普通 / 1 foil / 2 holo / 3 polychrome)。
- **材料**:**分解**重复卡(超出组牌所需的多余卡)→ 碎片 `dust`(account 软资源);如每张多余卡 = 1 dust。
- **附魔**:`enchantCard(id)` = spend 战功 + dust(每级递增,如 lv1=100战功+2dust / lv2=200+4 / lv3=400+8)→ 该卡 enchant +1(≤3)。
- **生效**:`assembleDeck` 时按 enchant level **放大该卡 CardSpec 数值**——`synergy/threshold/round-buff` 的 `bonus/perUnit` ×(1 + 0.2×enchant);`economy-band` 的 tier bonus 同放大;`shop-weight` 的 copies +enchant。**= Balatro 附魔的数据 modifier(Game E joker 先例),不进 sim 逻辑、零引擎。**
- **UI**:大厅 S5 收藏 → 卡详情显 enchant 角标 + [附魔]/[分解] 按钮 + dust 余额。
- **验收**:抽重复卡→分解得 dust→附魔一张钥匙牌→该卡进局数值更高(自组牌走 assembleDeck 放大);tsc+vitest 绿、零引擎、与 ECS 解耦。

### A 完成后 → 直接进 B·多人/三人征日(不停,见后续循环)
- B 起步预告:三方共享岛(mirror 同步,REQ-F-057 PF 定论=浮点不阻塞)+ 攻岛贡献排名(per-owner)+ Boss 宝箱掷点分卡。详规到 A 收尾时展开。

---

## 循环 #21 · 2026-06-15 · Designer F —— 🎉 单机养成闭环达成

### 验收:组牌器 picker(build 端)+ 段位难度阀 → ✅ 通过(双项)
- **build→play 真闭合**:`custom-start → onStart({deck:assembleDeck(...)})`;`game-f.tsx:683 engine.load(buildGameFBlueprint({deck:cfg.deck}))` → 自组牌**真进局生效**。
- **段位=难度阀也做了**(循环#17② 欠项):`683 difficulty: rankFor(getLP()).difficulty` → 高段位太阁更凶。
- **🎉 单机养成闭环达成**:earn(战功)→spend(抽小丑牌→收藏)→build(组牌器)→play(自组牌进局)→climb(段位难度阀)。**零引擎、80 测绿。**
- 🔧 小清理:`lobby.tsx:114` 注释过期("一律发 HUBAO")——代码已对,清注释即可(非阻塞)。

### 里程碑盘点(单机 game-f 已功能完整)
3 阵营(蜀/魏/吴)· 5 牌组 + 自组牌 · 太阁全 Boss 招牌 · 贡献/攻岛 · 大厅 · **养成闭环**。**单机主体完成。**

### 下一步(挑大方向)
- **A·附魔**(养成第二轴,account 层 spend 战功+材料升卡,spec §五;account.ts 自注"附魔随后切片")——补全养成系统。
- **B·多人/三人征日**(F,大愿景):mirror 同步(浮点确定性已证不阻塞,REQ-F-057 PF 定论)+ 掷点分卡 + 三方共享岛。是最大增量,但工程量大。
- **C·phase3**:交易市场/充值(owner 押后)。
- 建议:**先 A 附魔收口养成,再开 B 多人**。请 owner/Program F 确认主攻 A 还是 B。

---

## 循环 #20 · 2026-06-15 · Designer F

### 验收:组牌器机制(card catalog + assembleDeck + 自组牌持久化)→ ✅ 通过
- `CARD_CATALOG`(id→CardSpec)+ `assembleDeck(cardIds, faction)`(从收藏 id 拼 Deck,无效 id 丢弃)+ 自组牌持久化。**`buildDeckRules` 接口不变 → 自组牌与硬编码 preset 同路进局**(零返工)。**零引擎、80 测绿。**

### 下一步:闭合养成环最后一脚(组牌器 UI + run 用自组牌)
- **组牌器 UI**(大厅 S4):列收藏(已拥有小丑牌)+ 选 5–8 张 → `assembleDeck` → 存为出战牌组。preset 与自组牌并列可选。
- **run 消费自组牌**:开局把"当前出战牌组"(自组 or preset)喂进局内(机制已通,接 UI 选择即可)。
- 闭合后:**earn(战功)→ spend(抽小丑牌)→ build(组牌器)→ play(带入)→ climb(段位)** 全环跑通 = 单机养成闭环达成。
- 并行欠项:**段位=难度阀**(循环#17②);信玄火相(低优先)。

---

## 循环 #19 · 2026-06-15 · Designer F

### 验收:抽卡池纠正为小丑牌 + rarity + 十连保底 → ✅ 通过(纠正落地)
- 卡池=`DECK_REGISTRY` 全 deck 的 CardSpec 卡(去重),`rarityOf`:synergy/threshold=传说·economy=稀有·配牌=普通,权重 1/3/6,十连 900+保底≥1 稀有。**注释明引 designer #18 + 地基。零引擎、78 测绿。** 我的纠正干净落地。

### 下一步:收藏 → 组牌器(养成环真正落点)
- 现状:decks **硬编码**(HUBAO_DECK 等),抽到的小丑牌进收藏但**还不能拼进牌组** → earn→spend→**build** 这环还没闭。
- **派 Program F**(评估实现路径,纯游戏侧):
  1. **抽 card catalog**:`id → CardSpec 定义`(把现内联在 deck 里的卡抽成 id 索引的目录);
  2. **收藏 = 拥有的卡 id**(account 已有 collection count);
  3. **组牌器**(接大厅 S4):从收藏选 5–8 张 id → 拼成 Deck → 喂局内(`buildDeckRules` 已吃 Deck,接口不变);
  4. 现 5 套硬编码 deck **保留为 preset/起手套**(新人直接能玩)。
- **段位 = 难度阀**(循环#17② 仍欠):攻岛名次→LP/段位→高段位换凶关卡表(spec §六)。可并行。
- 信玄火相 = 低优先。

---

## 循环 #18 · 2026-06-15 · Designer F

### 验收:收藏 + 软币抽卡(机制)→ ✅ 通过
- `account.ts` 扩 spend/collection/gacha,earn→spend 闭合、与 ECS 解耦、localStorage 持久化、接大厅。**零引擎、74 测绿。** 机制对。

### ⚠️ 设计纠正(designer 该管):卡池 = **小丑牌**,不是武将
- Program F 占位"三国全武将"——但**武将每局清零、人人平等是地基**(`game-f-cards-and-decks.md`:"武将是租来的,小丑牌牌组才是灵魂")。**抽/收集武将 = 破武将公平 = P2W 武将,违核心**。
- **正解:gacha 抽「小丑牌」(各 deck 的 CardSpec 卡,持久收藏 → 组牌器拼牌组)**。武将另留**纯图鉴(无强度)**,不进强度池。
- (若 owner 想走"武将也可收集"的炉石式 = **改地基的 owner 决定**,需明确拍板;在此之前按"武将公平"做。)

### 我补上 designer 要的数据(给「小丑牌」卡池)
- **rarity 表(首版,按"是否定义流派"分级)**:传说=**钥匙牌**(虎豹骑令/桃园三义/八阵图/白衣/屯田,定义流派,出率最低)｜稀有=星球牌+进阶 buff｜普通=round-buff/shop-weight 等通用配牌。
- **GACHA_COST**:单抽 100 战功(≈ 攻岛 2-3 局)、十连 900(9 折)、**保底每 10 抽 ≥1 稀有**。

### 下一步:卡池改挂小丑牌 + 收藏→组牌器(养成真正落点)
- 收藏=小丑牌;**组牌器从收藏拼 Build 牌组**(接大厅 S4)→ decks 由硬编码改为"从收藏组装"。这才闭合"抽小丑牌→收藏→组牌→带入局内"的炉石养成环。

---

## 循环 #17 · 2026-06-15 · Designer F

### 验收:经济 v1 战功软币 earn-loop → ✅ 通过(干净)
- `account.ts`(48 行账号层):**与 ECS 单向解耦**(注释明钉,只消费攻岛结算、不进 sim/hash)、战功公式按 spec §一、localStorage/内存 KV 持久化、接大厅余额。**零引擎、71 测绿。** 养成闭环「赚」端通。

### 下一步:闭合「花」端 + 难度阀(都 game-side/账号层,核过现状无重复)
- **① 收藏 + 软币抽卡**(account 层扩):`collection:{[cardId]:count}` + `gachaPull(warfunds)→ 扣战功、随机出小丑牌入收藏、概率公示`(spec §二/§五)。**闭合 earn→spend**(战功有出口)。
- **② 段位 = 难度阀**(game-side 数据):攻岛名次 → LP/段位 → 高段位换更凶太阁关卡表(spec §六)。
- 组牌器(从收藏拼 Build 牌组,接大厅 S4)= 收藏做完后接;市场/充值 = phase3 不碰。
- 信玄火相 = 低优先,有空收。

---

## 循环 #16 · 2026-06-15 · Designer F —— 接受 Program F 回驳 + 自我复盘

### 接受回驳:屯田 econ-buff 提案 = 过度设计,撤回
- **Program F 回驳成立**:① CardSpec 现有 **5 类**(我循环#14 误数成 4),已含 `economy-band`(banded by gold,**早碰经济**);② **屯田积粟(`TUNTIAN_DECK`)早用 economy-band 实装、入 registry、有测**(利息=高 atGold 档)。我循环#14 为已覆盖的东西新加 `econ-buff` 类 = **过度设计,撤回**。
- **自我复盘**:空档预研时**没核 decks.ts 现状**(漏看 economy-band + 屯田已做),凭"4 类"臆断 → 违了"先查再提"的纪律。这是我第二次被有理回驳(owner 否 T-F4 / PF 否 econ-buff),**记教训:派单/预研前先核代码现状**。
- 正解收下:真要连胜金,**泛化 economy-band 的 banded 源(gold→可选 resource 字段)**,不加新 kind(PF 已记 decks.ts 注释)。

### 现状盘点(我重新核过):**5 套牌组全实装**
- 虎豹铁骑(魏速攻)/ 兴复汉室(蜀连携)/ 卧龙八阵(蜀控制)/ 白衣渡江(吴刺客斩首)/ 屯田积粟(经济)。+ 3 阵营 + 太阁全 Boss 招牌 + 贡献/攻岛 + 大厅。**单机 game-f 内容已相当完整。**

### 下一步:转「养成闭环」game-side 起步(向 owner 炉石模型推进)
- **攻岛结算 → 产出「战功」软币**(`game-f-economy-spec-v1.md` §一:按贡献+名次结算软币)——game-side,纯数据资源。
- **段位 = 难度阀**(§六:高段位换更凶太阁关卡表)——game-side,换数据。
- 收藏/组牌器/抽卡/市场 = 服务层独立工程(后续,非本轮)。
- (信玄火相 = 低优先,有空再收。)

---

## 循环 #15 · 2026-06-15 · Designer F —— Program F 恢复,大解锁

### 验收:启用单机吴 + 阵营感知 HUD → ✅ 通过(白衣渡江上线!)
- **白衣渡江入 `DECK_REGISTRY`**(`baiyi: BAIYI_DECK`)—— 单机吴布局一通,**刺客斩首流上线**(4 吴刺客 + F-061 斩杀 trait)。
- 单机吴可玩(`rosterFor('wu')` 跑真吴 PvE)+ 阵营感知 HUD。**零引擎、68 测绿。**
- 🎯 里程碑:**3 可玩阵营(蜀/魏/吴)+ 4 牌组(虎豹/兴复/卧龙/白衣)**。

### 下一步:屯田积粟 deck(econ-buff,方案已备循环#14)
- 加第 5 类 CardSpec `econ-buff`(`{hook:'interest'|'income'|'streak', op, value}` → buildDeckRules 物化成挂经济信号的 Effect,复用 banded 经济链,零引擎)。
- 屯田 deck:`econ-buff interest +2` / `econ-buff streak +1`(经济流,后期金山转战力)。信号名对 blueprint 真实实装。
- 后续:信玄火相(低优先)→ 经济 v1。

---

## 循环 #14 · 2026-06-15 · Designer F —— 空档预研(game-f 静默期,提前定掉开放问题)

> game-f 静默 2h+(搭档在 game-g)。利用空档把屯田的开放问题(需不需要第 5 类 CardSpec)预先定掉,Program F 回来即可 drop-in。**这是预研、非验收。**

### 定案:屯田 **需要**第 5 类 CardSpec `econ-buff`(现有 4 类都只改 dmg_scale,碰不到经济)
- **CardSpec 加一员**:`{ kind:'econ-buff'; id:string; hook:'interest'|'income'|'streak'; op:'add'|'mul'; value:number }`
- **`buildDeckRules` 加分支**:把 econ-buff 物化成挂在**经济信号**上的 `Effect`(复用现有 banded 经济链):
  - `hook:'interest'` → `Effect{ onSignal:'give_interest', targetId:'gold', op, value }`(改利息产出/上限)
  - `hook:'income'` → 挂回合收入结算信号;`hook:'streak'` → 挂连胜金信号
  - **全是现成 `Effect modify-resource` + 现有经济信号,零引擎**(同卡牌加载器一贯做法)。
- **屯田积粟 deck**(drop-in,faction 任意):
  - `{ kind:'econ-buff', id:'tuntian', hook:'interest', op:'add', value:2 }`(利息每跳 +2,= "屯田生息")
  - `{ kind:'econ-buff', id:'zhongnong', hook:'streak', op:'add', value:1 }`(连胜金 +1)
  - `{ kind:'round-buff', id:'houfa', untilRound:99, bonus:0 }` 占位 or 省略 —— 屯田是经济流,战力靠后期攒出来,不必带伤害 buff。
- **验收**:装屯田 → 利息/连胜金明显更高 → 后期金山转战力;`econ-buff` 物化正确;tsc+vitest 绿、零引擎。
- ⚠️ 注:经济信号名(give_interest/income/streak)以 blueprint 现有实装为准,Program F 接时对一下真实信号名。

### 队列现状(等搭档回 game-f)
1. 吴单机布局调正 → 白衣渡江入 registry(循环#13 派)
2. 屯田 deck(本预研,econ-buff 第 5 类)
3. 信玄火相(低优先)→ 经济 v1(已定案 `game-f-economy-spec-v1.md`)

---

## 循环 #13 · 2026-06-15 · Designer F

### 验收:3-faction plumbing(`rosterFor('wu')` + 盟友镜像吴名册)→ ✅ 通过
- `WU_ROSTER`(6 吴英雄)+ `Faction='shu'|'wei'|'wu'` + 盟友镜像跑真吴名册。**零引擎、68 测绿。**

### 白衣渡江:仍 gated —— 卡在「吴单机布阵布局」
- decks.ts 注释:"现入会因 `rosterFor('wu')` 占位布局打不正常" → plumbing 通了一半(吴可 roster + 盟友镜像),但**吴选阵营后的单机布阵/落点布局还没调正**。
- **派 Program F:把吴单机 deploy 布局调正**(让 `rosterFor('wu')` 单机能正常开局/布阵)→ **白衣渡江即可入 `DECK_REGISTRY` 上线**(deck 已写好,就差这一脚)。

### 下一步(无依赖,并行推):屯田积粟 deck(经济·贪婪)
- 评估能否用现有 round-buff 框架,不能则提小 `econ-buff` CardSpec 扩展(纯游戏侧)。
- 后续:吴布局通 → 白衣上线 → 信玄火相(低优先)→ 经济 v1。

---

## 循环 #12 · 2026-06-15 · Designer F

### 验收:卧龙八阵 deck + 白衣渡江 deck 定义 → ✅ 通过(+ 好纪律)
- **卧龙八阵** 进 `DECK_REGISTRY`(threshold-buff TACTICIAN [2→0.15, 3→0.20] + round-buff),= #10 spec。**零引擎、67 测绿。**
- 👍 **白衣渡江** deck 也写好了,但**故意不入 DECK_REGISTRY**(注释:依赖 3-faction plumbing,不通前不可选/不会被错误构建)。准确接住了 #11 的 plumbing flag。

### 厘清:白衣渡江的真实解锁条件(给主程/多人评估)
- 白衣只需**「吴可选为玩家阵营」**(单机 吴 vs 太阁)——即 `rosterFor('wu')` + 大厅选吴一项,**未必要全套三人 plumbing**。建议先评估这个小解锁(吴当第 3 个单机阵营)→ 白衣即可上;**全三人对局(孙刘曹同场)再随多人 F**。

### 下一步(无依赖,继续推):屯田积粟 deck(经济·贪婪)
- drop-in `decks.ts`(faction 任意,蜀/魏皆可):
  - `{ kind:'round-buff' 或 econ-buff }` 思路:利息/连胜加成。**⚠️ 现 CardSpec 4 类是 buff/shop-weight,没有"改经济档"的卡类** → 屯田可能需第 5 类 `econ-buff`(改 gold 利息 banded)。请 Program F 评估:能否用现有 round-buff 框架表达,不能则提一个小 CardSpec 扩展(纯游戏侧)。
- 后续:卧龙之外更多牌组 → 信玄火相(低优先)→ 经济 v1。

---

## 循环 #11 · 2026-06-15 · Designer F

### 验收:吴 faction 6 英雄入 roster(+ 吕蒙 sprite 404 修复)→ ✅ 通过
- `c_lvmeng/ganning/taishici/lingtong`(**4 刺客**)+ 周瑜(谋·火烧赤壁 DoT)+ 孙策(将);`FACT_WU/WU_GREEN` 入 constants(= `wu-faction-seed` 方案落地)。吕蒙 sprite 修正(`deep_elf_annihilator`)。**65 测绿。**
- 🎯 大里程碑:**4 吴刺客 + 刺客斩杀 trait(已 done)→ 白衣渡江解锁**。

### ⭐ 重排:白衣渡江 deck 现在能做(优先于卧龙)
- drop-in `decks.ts`(`DECK_REGISTRY` 加 `baiyi`,faction `wu`):
  - `{ kind:'threshold-buff', id:'baiyi', tagMask: BENCH_OCC|ASSASSIN, tiers:[{at:2,bonus:0.18},{at:4,bonus:0.22}] }`(刺客成军质变)
  - `{ kind:'round-buff', id:'jinfan', untilRound:3, bonus:0.12 }` + `{ kind:'shop-weight', id:'muci', codes:[/* 吴刺客码 codesFor(rosterFor('wu')) */], copies:3 }`
  - **斩杀来自刺客职业 trait(已 done)**;周瑜火烧赤壁 = ult DoT(已接)。零引擎。
  - ⚠️ 若 3-faction 选阵营 plumbing 未通,先确认吴可选/可买;不通则记一条 plumbing 跟进(随多人)。
- 后续:卧龙八阵 → 屯田积粟 → 经济 v1。

---

## 循环 #10 · 2026-06-15 · Designer F

### 验收:今川义元·弓阵 → ✅ 通过
- group-count `BOW`(弓兵)≥3 → +0.12(毛利镜像);mob spawn 打 `BUSHO`/`BOW` 兵种 tag 供计数。**零引擎、65 测绿。** 太阁国人众/✅Boss 招牌**收齐**。

### PM 裁决:信玄·风林火山 → **简化(火相)/复杂部分守纪律缓做**
- 风(提速=per-unit steering)/ 山(减伤=无 mob 防御系数)**不是 dmg_scale_b 式全局系数能干净重组的**,硬做要拓宽引擎 → **不做**(YAGNI)。
- **可选简化**:只做"火相"= 阶段 Timer 切 `dmg_scale_b` 加攻(同信长法),达"信玄在场守军更凶"之意。**优先级低,排牌组之后。**

### ⭐ 转大块内容:派牌组(丰富玩家构筑,纯数据,现有阵营即可)
- **下一个:卧龙八阵 deck(蜀·谋士控制)** —— drop-in `decks.ts`(`DECK_REGISTRY` 加 `wolong`):
  - `{ kind:'threshold-buff', id:'bazhen', tagMask: BENCH_OCC|TACTICIAN, tiers:[{at:2,bonus:0.15},{at:3,bonus:0.20}] }`(谋士越多越强;诸葛亮已在 roster)
  - `{ kind:'round-buff', id:'wolong', untilRound:3, bonus:0.10 }` + `{ kind:'shop-weight', id:'qimou', codes:[/* 谋士码 */], copies:2 }`
  - 八阵图(冻)走武将大招既有 ult(诸葛 ultFreeze 已接),牌组只管 synergy buff。
- 再后:屯田积粟(经济 banded)→ 吴 faction → 经济 v1。

---

## 循环 #9 · 2026-06-15 · Designer F

### 验收:国人众招牌·石田三成·三献茶 → ✅ 通过
- `healPulse`:hitbox 负 amount(`amount:-X, targetMask:TEAM_B`)= AoE 回血 + 周期 spawn sidecar(Timer loop)。**特意不挂 `scaleByResource`**(治疗量不吃信长/毛利伤害 buff,正确)。**现成词汇、零引擎、64 测绿。**
- 📊 进度:太阁招牌已接 = 信长/谦立半斩杀/家康/秀吉·本愿寺召援/斋藤毒/明智冻/毛利羁绊/石田治疗。**国人众+✅Boss 基本收齐。**

### 下一步:收尾国人众 + 转大块内容
- 收尾:**今川·弓阵**(group-count 弓 → 全弓 buff)/ **信玄·风林火山**(Timer 阶段切换系数)——最后两个,同重组法。
- **然后转大块:更多牌组**(赤壁火攻 DoT / 卧龙八阵 冻 / 屯田 banded,纯数据,丰富玩家构筑)→ 吴 faction → 经济 v1。

---

## 循环 #8 · 2026-06-15 · Designer F

### 验收:国人众招牌·毛利元就·三矢 → ✅ 通过(+ 一个好 catch)
- `group-count 部将(国人众/天守)≥3 → edge 信号 busho_sanshi → Effect add 0.18 到 dmg_scale_b` = 玩家羁绊 bond 的敌方镜像重组。**零引擎、63 测绿。**
- 👍 **Program F 主动修了 buff 叠加坑**:发现信长 `op:set` 会覆盖毛利 buff → 把信长阶段递增改成 `op:add`(从 prep 复位基线 1 累加),信长×阶段 + 毛利羁绊**正确叠加**。好工程嗅觉。

### 下一步:继续国人众/Boss 余下招牌
- **今川义元·弓取**:弓阵(全弓 buff)——group-count 弓职 → 全局 buff(同毛利法)。
- **武田信玄·风林火山**:阶段切换(提速/加攻/减伤)——`Timer` 阶段 + 全局系数,纯数据。
- 之后:更多牌组(赤壁/卧龙/屯田)→ 吴 faction → 经济 v1。

---

## 循环 #7 · 2026-06-15 · Designer F —— 接受 owner 裁决 + 自我复盘

### 收到 owner 裁决:T-F4(game-f.tsx→全 GameShell)= **wontfix**,我撤回刹车
- owner 真机复核:**GameShell 与 canvas 并存 → 重复 UI bug**(棋盘下方堆第二套点将台/主公卡);钦定**保留手写 DOM HUD**(主公卡左下、右栏盟友预览),`GAME_F_UI` 留作蓝本+测试、不并存渲染。**以 owner 为准。**
- **自我复盘**:循环#5/#6 的"去腐 T-F4 硬优先"是**我过头了**——去腐其实已还掉大半(**脉冲清零✅ / band·visSwap·chrome 展平✅ / 商店卡名牌派生去重✅**);我盯着 `game-f.tsx` 行数这个指标不放,但 owner 要的是**能用不出 bug 的 HUD**,不是行数。错在用代洁指标压过产品手感。**收回。**
- 余 `blueprint→manifest` 全量展平 = Lead 标低优先(`makeRoundFlow/templatesFor` 保留),**不催**。**去腐这条线就此告一段落。**

### 重开内容队列(去腐既闭,内容解押)
- **下一个:国人众/Boss 余下招牌** —— 信玄·风林火山 / 毛利三矢(部将≥3全局buff)/ 今川弓阵(全弓buff),同重组法(group-count→全局buff→scaleByResource / 现成 hitbox),纯数据零引擎。
- 再后:更多牌组(赤壁火攻/卧龙八阵/屯田)→ 吴 faction 6 英雄+白衣渡江 → 经济 v1(已定案)。

---

## 循环 #6 · 2026-06-15 · Designer F

### 验收:去腐去重(商店卡/名牌从 ROSTER 派生,删手抄 HEROES/HERO_NAMES)→ 🟡 部分通过
- 去重对路(手抄数据消除、单一真相回到 ROSTER),62 测绿、零引擎。**但这是 T-F4 的边角,不是核心。**

### ⛔ T-F4 仍未达验收线 —— 继续顶,别开新内容
- **核心没动**:`game-f.tsx` = **736 行**(还在涨,目标是删它→`UILayout`)、`manifest.json` **仍 0**。
- **下一步只做这两件**(达标才算 T-F4 完成):
  1. `game-f.tsx` 手写壳 → `GAME_F_UI: UILayout` + GameShell,删 canvas 假点击桥(行数大降);
  2. 建 `data/game-f.manifest.json`,blueprint 生成器残余展平为字面实体。
- 安全网=片0 快照守 + 行为测;**引擎零改动**。**信玄/毛利/牌组/吴 一律继续押后**,先把 game-f.tsx 这块硬骨头啃下来。

---

## 循环 #5 · 2026-06-15 · Designer F

### 验收:国人众招牌 斋藤·毒沼 + 明智·群冻 → ✅ 通过
- `strike()/projectile()` 工厂加 `dot`/`freezeTicks` 入参 → 套现成 hitbox `DOT{25/30/240}` + `setMask:FROZEN`+`statusDuration`(八阵图同款 REQ-F-030)。**现成 hitbox 词汇、零引擎、62 测绿。**

### ⛔ PM 刹车 + 重排优先级:T-F4 去腐片4/5 = 硬任务,先于一切新内容
- **连 4 轮内容,去腐债没动**:`game-f.tsx` 反而从 623 涨到 **728 行**(去腐目标是删它→UILayout)、`manifest.json` 仍无。**LEAD→PF 是站着的义务**;内容越堆,未去腐的壳/blueprint 返工越大。
- **请 Program F 下一轮务必做 T-F4(去腐片4/5)**:`game-f.tsx`→`GAME_F_UI:UILayout`+GameShell、删假点击桥;建 `data/game-f.manifest.json`;核账行数大降。安全网=片0 快照守 + 行为测兜底,runbook=`game-f-derot-runbook.md`,**引擎零改动**。
- **信玄/毛利/今川/更多牌组/吴 faction 一律押到 T-F4 落地之后。** 先把债还清。

---

## 循环 #4 · 2026-06-15 · Designer F

### 验收:T-F2 秀吉一夜城 + T-F3 本愿寺一揆 → ✅ 通过
- 通用 `summon` 数据字段 + 召援 sidecar(`Timer`+`SelfRule spawn reinf_<code>`):秀吉 `period180/count1` 周期召;本愿寺 `period30/count3/once` 开场人海。**REQ-021 spawn 重组、零引擎**,3 个回归测试,**60 测绿**。
- 🎯 **✅类天守 Boss 招牌全齐**(信长 buff / 谦信斩杀 / 家康忍耐 / 秀吉·本愿寺召援)→ **终盘攻岛体验成型**。

### 下一步:T-F4 去腐片4/5 收尾(还质量债,LEAD→PF 交办)
> 内容告一段落,转去把"在数据里编程"的债清掉(blueprint 已展平大半、脉冲已 0;余手写壳 + manifest)。
- **片4**:`game-f.tsx`(692 行)手写残余 → 完整 `GAME_F_UI: UILayout` + GameShell;删 canvas 假点击桥。
- **片5**:建 `data/game-f.manifest.json`(blueprint 生成器残余展平为字面实体);核账:脉冲=0(已)、非测试行数大降、对照 game-b。
- **安全网**:片0 快照守已在;redesign 片用「商店/战斗/流程行为测全绿 + 确定性 hash 不变」兜底。runbook=`game-f-derot-runbook.md`。
- **验收**:game-f tsc 0 + vitest 绿 + hash 不变;过"最弱 LLM 产出 manifest"尺子;**引擎零改动**。

### 后续队列:国人众招牌(毛利三矢/今川弓阵/明智群冻)→ 更多牌组 → 吴 faction → 经济 v1(已定案)

---

## 循环 #3 · 2026-06-15 · Designer F

### 验收:T-F1 阶段递增(follow-up)→ ✅ 通过
- `eff_tenka_s2..s5` 挂 `deploy_pve_2/3/4/5` → `dmg_scale_b` 阶梯 1.08→1.16→1.25→**1.40**(关越深守军越凶,终盘信长 ×1.40);prep 每回合复位回 1;全 mob hitbox `scaleByResource:'dmg_scale_b'`。**纯数据重组、零引擎**,加了回归测试(`taikou.test.ts`)。**57 测绿。** follow-up 结清。

### 下一步:T-F2 / T-F3(仍在队列,催实装)
- **T-F2 秀吉·一夜城**:`SelfRule{loop Timer→spawn ash_yari×2}` 周期援军。
- **T-F3 本愿寺·一揆**:`SelfRule` 开战 spawn `ash_yari×4` 人海。
- 之后:去腐片4/5 收尾。

---

## 循环 #2 · 2026-06-15 · Designer F

### 验收:T-F1 信长·天下布武 → ✅ 通过
- 实现 = `Effect{ onSignal:'deploy_pve_5' → dmg_scale_b set 1.35 }`:终盘 W6 信长坐镇 → 全军伤害 ×1.35(敌方系数,与玩家 `dmg_scale_a` 羁绊乘区对称)。**纯数据重组、零引擎改动**(注释明引 REQ-F-064);信长已进终盘天守波(`stages` W5/6)。**game-f 56 测绿、game-f 侧 0 tsc 错。**
- 📌 follow-up(非阻塞,入 C 队列):派的"**阶段递增**"被简化成**一次性 ×1.35**——达意,但少了"越拖越强"的压迫感。若要逼真,后续加 loop `Timer` 阶梯递增。
- ⚠️ 环境提示(非 game-f):tsc 报 `three` 未安装 = **game-g 3D 渲染依赖**(package.json 有,本地 node_modules 未更新),装了即绿,**与 game-f 无关**。

### 下一步:Program F 继续 T-F2 / T-F3(循环#1 已派,同重组法)
- **T-F2 秀吉·一夜城**:`SelfRule{loop Timer→spawn ash_yari×2}` 周期援军。
- **T-F3 本愿寺·一揆**:`SelfRule` 开战 spawn `ash_yari×4` 人海。
- 之后进 **C 队列**:去腐片4/5 收尾(`game-f.tsx`→UILayout / `manifest.json`)。

---

## 循环 #1 · 2026-06-15 · Designer F

### A. 验收(game-f 最近产出 → 通过)
| 项 | 判定 |
|---|---|
| 去腐片3 收尾(商店脉冲清零,`shop_marks`=0,GameShell `shop_face` 接管) | ✅ 通过(脉冲债清了一大块) |
| 太阁 Boss slice3:谦信/立花/半藏 **斩杀**(F-061)+ 家康 **忍耐**回血 | ✅ 通过 |
| 三人版右栏:对战玩家名单 + 迷你布阵镜像(mirror) | ✅ 通过 |
| 测试 56 绿(9 文件) | ✅ |

📌 **PM 记账(两条战略变化)**:
1. **REQ-F-057 定论**:game-f 战斗走 **mirror 同步**(权威端各自跑 PvE、对端只还原显示不重演)→ **浮点确定性不参与跨端比对、自动消解 → 不阻塞三人**。多人地基从此通畅;lockstep 只承载离散跨玩家命令(卡牌/连携,整数,天然确定)。
2. **REQ-F-064「Boss 技能=引擎需求」已 Lead wontfix**:Boss 招牌**必须用现成能力重组,严禁提引擎需求**。下方任务据此设计。

### B. 下一个任务:太阁 Boss 余下招牌(纯数据重组,零引擎改动)
> 数据齐(21 单位/6 波),斩杀+忍耐已接;补 ✅ 类三大 Boss 招牌。**全用现成能力重组**(对齐 REQ-F-064 裁决)。

| 任务 | Boss·招牌 | 重组方案(现成能力) | 验收 |
|---|---|---|---|
| **T-F1** | 织田信长·天下布武(全军 atk↑阶段递增) | 阶段 `Timer`(loop)→信号→`Effect` 累加全局 buff 资源 `boss_atk` → 太阁 strike `scaleByResource:'boss_atk'`(= 虎豹骑令/羁绊同款) | 信长在场,守军伤害随时间阶梯↑ |
| **T-F2** | 丰臣秀吉·一夜城(周期召援军) | `SelfRule{ when:loop Timer到点, whenGlobal:in_combat, do:[spawn ash_yari×2] }`(REQ-021 spawn) | 秀吉每隔 N 拍召 2 杂兵 |
| **T-F3** | 本愿寺显如·一向一揆(人海 spawn) | `SelfRule` 一次性 spawn `ash_yari×4`(开战拍) | 本愿寺开场放人海 |

**通用验收**:终盘 Boss 波招牌生效;`tsc 0 + vitest 绿 + 确定性 hash 不变`;**combat.ts 数据装配,零引擎改动、零新 REQ**。

### C. 后续队列(Program F 消化完 B 依次取)
1. **去腐片4/5 收尾**:`game-f.tsx`(692 行)→ 完整移交 `UILayout`/GameShell;建 `manifest.json`;blueprint 生成器残余展平。
2. **信玄·风林火山 / 毛利三矢 / 今川弓阵** 等国人众/Boss 余下招牌(同 B 重组法)。
3. **更多牌组**(赤壁火攻 DoT / 卧龙八阵 冻 / 屯田 banded — 纯数据)。
4. **吴 faction 6 英雄 + 白衣渡江**(`game-f-wu-faction-seed.md`;3-faction plumbing 随多人)。
5. **经济 v1**(已定案 `game-f-economy-spec-v1.md`,服务层独立工程)。

> Designer F 下一循环:验收 B 的落地 + 推进 C。
