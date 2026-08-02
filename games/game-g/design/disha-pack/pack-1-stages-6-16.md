# 地煞数据包 1 · 关 6–16（新手~中前期 · 11 英雄 × 3 = 33 张）

> game design G ｜ 2026-06-20 ｜ owner：把 §九 的 11 位英雄（关 6–16）地煞**纯文字 → 可确定性实装数据形**。
> 源：`23-hero-codex-52.md` §九（141 地煞纯文字 + kind 提示）/ §八（关 1-5 精确数值=模板）；op 词汇复用 `20-joker-catalog-150.md` §二天罡 10 维度。
> 关↔英雄反序爬：关号越大越难。目标玩家胜率：关 6 ≈ 68% → 关 16 ≈ 58%（新手友好）。
> **每张地煞保留 §九 原名 + 简述**，把花哨文字简化成最接近的一个确定性 op（像关 1-5：放弃真"跳格/迷雾博弈"等重机制，落成胜率/战力/血量小值）。

## 用到的新 op 说明（超出 §八现有 DishaFx 字段的）
> 关 1-5 的 DishaFx 已含：allWinPct/generalWinPct/phalanx*/nearBase*/eliteMid/flankYou/firstStrike*/winStreak*/noRout/lastStandGeneral/bonusMana/battery*/homeHp。
> 本包**复用任务书给出的 Boss 专属新 op**（已在任务词汇表内授权，非我自创）：
> - `{kind:fog,turns:N}` —— 前 N 回合敌看不清虚实。
> - `{kind:odds,op:fewerStronger,perMissing:N}` —— 我兵越少·每缺 1 兵 +N% 胜率（"以寡敌众"族）。
> - `{kind:power,op:deepDecay,perStep:N}` —— 敌兵推进越深·每格 −N 战力（"焦土诱敌"族）。
> - `{kind:phalanx,perAdj:N,cap:M,adj8:true}` / `{kind:flank,value:-N}` / `{kind:firstStrike,value:+N}`。
> - 续航/经济类：`{kind:stamina,op:drain,value:N,enemy:true}`（敌续航/回合 −N）；`{kind:lane,op:freeDeploy,value:N}`（每回合免费铺 N 兵·复用 §八 bonusMana 通道）；`{kind:lane,op:reinforce,value:N}`（一路免费补兵）。
> - 攻守类：`{kind:siege,op:chipMore,value:N}`（破家多扣）；`{kind:siege,op:nearBase,value:+N,slots:K}`（隘口守家·复用 nearBase*）。
> **除上述任务词汇表已授权的 op 外，本包无额外自创新 op。**

---

### 关6 · 狮心王理查 · 阿苏夫之战（★ · 目标WR ~68%）
- 难度：`{homeHp:3, loadoutCap:3, aiTier:1, targetWR:0.68}`
- aiProfile：`{aggression:3, lanePref:5, spellEager:4, targetPref:'strong', risk:2, economy:6}`（严整防反·稳守待机·克制不浪）
- 地煞①「严整纵队」`{kind:morale,op:noRout}` —— 全军免疫迫推/惊扰、濒死不溃（弱版：noRout，不做"稳步前进"行军机制）。
- 地煞②「后发制人」`{kind:odds,op:winPct,value:+10,scope:all}` —— 简化：放弃主动→全军反击 +10%（不做真"按兵后反击"判定；§九原值 +30% 过猛，新手关压到 +10）。
- 地煞③「重骑反冲」`{kind:power,op:add,value:4,scope:front}` —— 一路重骑反冲→前锋 +4（不做"蓄力一回合连破前排"，落成静态前锋战力）。

### 关7 · 沙卡·祖鲁 · 牛角阵征伐（★ · 目标WR ~67%）
- 难度：`{homeHp:3, loadoutCap:3, aiTier:1, targetWR:0.67}`
- aiProfile：`{aggression:7, lanePref:6, spellEager:5, targetPref:'weak', risk:6, economy:3}`（牛角包抄·两翼压上·扑弱）
- 地煞①「水牛角」`{kind:tempo,op:advance,value:1,scope:lane}` —— 简化：两翼一路推进 +1（包抄→落成单路抢攻；不做"中路顶+两翼翻倍合围"多路联动）。
- 地煞②「短矛贴身」`{kind:odds,op:winPct,value:+12,scope:near}` —— 贴身近战 +12%（§九"敌不许后撤脱离"不做，只留近战胜率）。
- 地煞③「跑步突袭」`{kind:tempo,op:advance,value:1,scope:all}` —— 全军起手推进 +1（§九"+2 速"压到 +1，避新手被秒压境）。

### 关8 · 维钦托利 · 格尔戈维亚（★ · 目标WR ~66%）
- 难度：`{homeHp:3, loadoutCap:3, aiTier:1, targetWR:0.66}`
- aiProfile：`{aggression:4, lanePref:7, spellEager:5, targetPref:'general', risk:4, economy:5}`（据高地游击·焦土消耗·守险）
- 地煞①「高地坚守」`{kind:odds,op:nearBase,value:+12,slots:1}` —— 占自家隘口高地格守战 +12%（§九 +25% 压到 +12·新手；复用 nearBase 通道·slots:1 仅最前 1 格）。
- 地煞②「焦土游击」`{kind:stamina,op:drain,value:1,enemy:true}` —— 烧补给→敌续航/回合 −1（§九"−2 + 禁铺兵"压到 −1·不做禁铺）。
- 地煞③「全境举义」`{kind:tempo,op:slow,scope:all,enemy:true}` —— 三路骚扰→敌全军隔回合才推进（半速·呼应"每路 −1 速"）。

### 关9 · 斯巴达克斯 · 维苏威突围（★★ · 目标WR ~64%）
- 难度：`{homeHp:3, loadoutCap:3, aiTier:2, targetWR:0.64}`
- aiProfile：`{aggression:8, lanePref:4, spellEager:6, targetPref:'weak', risk:8, economy:4}`（困兽夜袭·亡命猛攻·血越低越狠）
- 地煞①「藤蔓夜袭」`{kind:lane,op:reinforce,value:1}` —— 夜袭绕后→一路免费补 1 兵（不做"凭空现敌后方格"的真绕过前排，落成免费补兵）。
- 地煞②「奴隶怒涌」`{kind:lane,op:freeDeploy,value:1}` —— 每回合免费多铺 1 兵（§九"每死 1 兵补 1"落成稳定每回合 +1 铺场·复用 bonusMana 通道）。
- 地煞③「困兽反扑」`{kind:odds,op:winPct,value:+12,scope:all}` —— 简化：本营血越低越狠→全军 +12%（不做血量动态缩放·落成静态全军胜率·★★ 关给到上限段）。

### 关10 · 巴布尔 · 帕尼帕特之战（★★ · 目标WR ~63%）
- 难度：`{homeHp:3, loadoutCap:3, aiTier:2, targetWR:0.63}`
- aiProfile：`{aggression:4, lanePref:6, spellEager:7, targetPref:'strong', risk:3, economy:6}`（车阵火炮·阵地战·守垒远轰）
- 地煞①「车垒环营」`{kind:siege,op:nearBase,value:+12,slots:2}` —— 车阵环营→隘口前 2 格守战 +12%（"撞墙归零"不做·落成守家加成·复用 nearBase）。
- 地煞②「回回炮轰」`{kind:power,op:add,value:-3,scope:lane}`（enemy:true）—— 越垒远轰一路→该路敌前排 −3 战力（§九"轰后两格"落成静态一路减战力·小值）。
- 地煞③「两翼包抄」`{kind:odds,op:winPct,value:+12,scope:lane}` —— 两翼骑兵夹击→一路 +12%（不做真"中军顶+两翼绕出"联动）。

### 关11 · 孙膑 · 马陵之战（★★ · 目标WR ~62%）
- 难度：`{homeHp:3, loadoutCap:3, aiTier:2, targetWR:0.62}`
- aiProfile：`{aggression:3, lanePref:6, spellEager:8, targetPref:'general', risk:5, economy:5}`（减灶诱敌·设伏射杀·阴谋取主将）
- 地煞①「减灶诱敌」`{kind:power,op:deepDecay,perStep:2}` —— 示弱诱深→敌兵推进越深·每格 −2 战力（"踏入设伏"落成深入惩罚·呼应诱敌）。
- 地煞②「马陵设伏」`{kind:odds,op:winPct,value:+14,scope:near}` —— 埋伏圈→隘口近战 +14%（"双面围杀"落成近战高胜率）。
- 地煞③「万弩齐发」`{kind:odds,op:winPct,value:+12,scope:lane}` —— 万弩→一路集火 +12%（"每格各受一次远程"落成一路胜率·不做多次掷命）。

### 关12 · 罗伯特·李 · 钱斯勒斯维尔（★★ · 目标WR ~61%）
- 难度：`{homeHp:3, loadoutCap:3, aiTier:2, targetWR:0.61}`
- aiProfile：`{aggression:6, lanePref:7, spellEager:6, targetPref:'weak', risk:7, economy:4}`（分兵奇袭·以少打多·险中求胜）
- 地煞①「分进合击」`{kind:tempo,op:advance,value:1,scope:all}` —— 同时多路推进→全军推进 +1（"两路各发起推进"落成全军抢攻）。
- 地煞②「杰克逊侧击」`{kind:odds,op:winPct,value:+14,scope:lane}` —— 奇兵绕弱路侧后突袭→一路 +14%（不做"无视前排"真绕过·落成一路胜率）。
- 地煞③「以寡敌众」`{kind:odds,op:fewerStronger,perMissing:4}` —— 我兵越少·每缺 1 兵 +4% 胜率（呼应"分兵以少胜多"·设上限交 sim 调）。

### 关13 · 吴起 · 阴晋之战（★★ · 目标WR ~60%）
- 难度：`{homeHp:3, loadoutCap:3, aiTier:2, targetWR:0.60}`
- aiProfile：`{aggression:5, lanePref:5, spellEager:4, targetPref:'strong', risk:4, economy:7}`（魏武卒精锐·号令严明·稳硬不溃）
- 地煞①「魏武卒」`{kind:power,op:add,value:5,scope:all}` —— 重装精锐→全军 +5 战力（"战力高续航高以一当十"落成全军点数·此包最高 add）。
- 地煞②「同甘共苦」`{kind:morale,op:noRout}` —— 士气不可削·掷命永不溃败（落成 noRout）。
- 地煞③「严明号令」`{kind:lane,op:freeDeploy,value:1}` —— 号令严明、调度有序→每回合免费多铺 1 兵（"锁场双方不能迁路"重机制不做·落成 Boss 铺场优势）。

### 关14 · 武田信玄 · 川中岛之战（★★★ · 目标WR ~59%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:3, targetWR:0.59}`
- aiProfile：`{aggression:6, lanePref:8, spellEager:7, targetPref:'general', risk:5, economy:5}`（风林火山·啄木鸟分兵·攻守自如）
- 地煞①「啄木鸟」`{kind:odds,op:winPct,value:+15,scope:lane}` —— 分兵夹中→中路压制 +15%（"两翼推进时中路敌 −20%"落成 Boss 一路 +15%）。
- 地煞②「风林火山」`{kind:tempo,op:advance,value:1,scope:all}` + `{kind:stamina,op:stamPlus,value:1}` —— ★★★ 双张联动：疾如风（全军推进 +1）+ 不动如山（全军续航 +1）同开（§九"二选一"在 Boss 侧给齐·满威力）。
- 地煞③「骑马武者」`{kind:power,op:add,value:4,scope:front}` —— 骑兵突击→前锋 +4（"连破前两格"落成前锋静态战力）。

### 关15 · 皮洛士 · 赫拉克利亚（★★★ · 目标WR ~58%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:3, targetWR:0.58}`
- aiProfile：`{aggression:8, lanePref:5, spellEager:6, targetPref:'strong', risk:9, economy:3}`（战象冲阵·惨胜豪赌·王者亲征不惜代价）
- 地煞①「巨象冲阵」`{kind:tempo,op:slow,scope:lane,enemy:true}` + `{kind:power,op:add,value:3,scope:lane}` —— ★★★ 双张联动：战象踏入一路→该路敌半速（推进归零的弱版）+ Boss 该路 +3 战力（呼应"踏入后退一格"的压制）。
- 地煞②「惨胜之刃」`{kind:odds,op:winPct,value:+16,scope:all}` —— 本回合全军 +16%（§九"+25% 但战后扣续航"的代价机制不做·压到 +16 静态·★★★ 上限段）。
- 地煞③「王者亲征」`{kind:power,op:mul,value:1.5,scope:highest}` —— 皮洛士亲入→最强一张 ×1.5（"该路全员暴涨至被击退"落成主将系单张 ×1.5·破法=集火逼退）。

### 关16 · 埃帕米农达斯 · 留克特拉（★★★ · 目标WR ~58%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:3, targetWR:0.58}`
- aiProfile：`{aggression:5, lanePref:9, spellEager:7, targetPref:'strong', risk:6, economy:5}`（斜阵之父·兵力全压一翼·纵深极厚）
- 地煞①「斜阵压顶」`{kind:power,op:mul,value:1.5,scope:lane}` + `{kind:lane,op:reinforce,value:1}` —— ★★★ 双张联动：兵力全压一路→该路全员 ×1.5（斜阵叠战力）+ 该路免费补 1 兵（"其余两路放空"由 Boss AI lanePref=9 偏压一路体现·破法=攻空路直取本营）。
- 地煞②「五十纵深」`{kind:siege,op:nearBase,value:+14,slots:1}` —— 加厚一格→隘口守战 +14%（"连胜三次才打得动"落成厚守家·复用 nearBase）。
- 地煞③「斩首精锐」`{kind:odds,op:winPct,value:+12,scope:general}` —— 直冲敌最强路核心→Boss 斩首向 +12%（"先点杀核心"落成针对主将的胜率·破法=核心后撤）。

---

> **难度脊自洽**：homeHp 关 6-13=3、关 14-16=4；loadoutCap 关 6-13=3、关 14-16=4；aiTier ★=1/★★=2/★★★=3。
> **数值档自洽**：winPct 关 6-10 用 +10~12、关 11-16 用 +12~16；power add +3~5；★★★（14-16）才允许 2 张地煞联动满值（武田/皮洛士/埃帕米农达斯各 1 张双 op），前面以单张为主。
> **全部为占位数值·sim 真机调到目标 WR**（关 6 ~68% → 关 16 ~58%）。新增 op 若进 disha.ts 由主程（Lead）实装·本包仅设计数据形、不碰代码。
