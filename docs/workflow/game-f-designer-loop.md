# Designer F ↔ Program F · 循环工作板

> Designer F(策划/PM)出策划案 + 验收;Program F(程序)读本板开发,动引擎的先自做完推主程 review。
> 每 ~4 分钟一循环,不停。最新循环在最上。

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
