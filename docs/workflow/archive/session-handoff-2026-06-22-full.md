# Session 交接 / 项目现状（2026-06-22 · Game G playtest）

> ⚠ **2026-07-02 增补横幅（主程）**：本文件主体定格 2026-06-22、已落后主干 60+ 提交。读"现状"以下列为准：
> ① 游戏清单/治理态见 `docs/llm-onboarding.md` §4——**game-d 已由 ARPG 推倒重写为骰途**、a/b/c 已删、**D+G=唯二出口游戏**（owner 拍板）；
> ② §0 末的 `kind-gates-xtajic`「大规模重构」条目**作废**——查实该分支从未有重构提交（只是 6-22 主线快照，10 天零活动）；
> ③ §0a game-f「下一步=多人」已被冻结令覆盖（CLAUDE.md：owner 2026-06-25 拍板暂冻）；
> ④ 引擎能力现况（79 capability·骰能力族/wild 已下沉）见 `docs/workflow/requests.md` REQ-GAMED 条目与 llm-onboarding §0 机读真相。

> 纲领：`data-driven-manifesto.md`｜规范：`CLAUDE.md`｜需求池：`requests.md`
> **分工**：主程只动引擎+文档；游戏层任务走 `docs/workflow/programmer/inbox.md` 派 PE；PE 不得直改引擎。

---

## 0. 最新交接（2026-06-22 · Game G《翻命扑克 Fateflip》playtest · 主程/甲）

> owner live playtest 边玩边提、主程（甲·战斗域）落地。本节=**单一真相**：做完的 / 待办 / git 分支标签态 / 工作流约束。下一程序员从这里接。

### 🔴 P0 进行中：掌机「APOLLO OS 绿字 + 黑屏」（已修 zoom · 待真机烧版验证）
- **现象**：owner 新烧 cartridge 包（掌机弱 GPU webview），开机绿字 APOLLO OS 后黑屏；**同代码 Mac 正常**。
- **关键认知**：掌机烧的是 **cartridge 构建**（`npm run build:cartridge` → `dist-cartridge`·入口 `cartridge.html`+`src/cartridge-entry.ts`·`base:'./'`），**直接挂 game-g、无 launcher**；绿字 = `cartridge.html` 的「APOLLO OS」boot shell；黑 = `#game-root`。
- **定位（穷尽）**：非 JS 崩溃——cartridge 真产物在无头(happy-dom)挂 game-g 零报错、大厅/战斗 DOM 全渲(605KB)；tsc/vitest1664/build:cartridge 全绿。Mac 好 → 是掌机弱 GPU 的**合成/绘制**失败（无头测不出）。
- **根因**：闪烁修(`7634b027`) 把战斗屏首帧烤成 **transform:scale 单合成图层**；弱 GPU 合成该整屏图层失败→黑（旧两段绘制至少 CPU 先画可见帧＝那正是"闪烁"）。
- **修(`c5608bbc`)**：战斗屏 1340×858 适配 **transform:scale → CSS zoom**（CPU 布局缩放·不生成合成图层·消闪烁·Mac 等价·zoom 不支持也只裁切不黑＝fail-safe）。**待 owner 有真机再烧 cartridge 验证**。
- **若仍黑（次候选·按真机定位再查）**：① cartridge `#game-root` 整屏 opacity 渐变（`cartridge-entry.ts` L102-106·弱 GPU 合成大图层）→ 改直接显形；② 战斗浮层 `backdrop-filter:blur`（对决/硬币/结算·交互态才出）。

### ✅ 本 session 做完（甲·全程门禁绿）
1. **战胜硬币**（`REQ-G-战斗结构`核心）：`resolveClash` `winStays=nextRandom<0.5`（种子化可回放）；**人面=留场/字面=回库+返半费**；`coin-flip.ts` 3D 抛掷·玩家亲掷/AI 自动·**投后才揭晓（不剧透）**·挂战力明细之后。
2. **战力来源清晰**：对决特写 `clash-view.rows()` 逐条列每点来源（点数/经营·附魔逐生肖/天罡逐张/士气/地煞 + 封顶·擎天行）。
3. **卦象进结算**（`REQ-G-卦象结算`✅）：`settleTurn` 战利品按今日卦象 ±（大吉+2…大凶−2·夹≥0）·确定性。
4. **1-5 关数据**（`boss-config-1-5.md §七`）：`level.ts` BOSS_DECK_1_5（每关 16 写死牌）+favorBias + `disha.ts` 地煞改值（关2/3/4 调弱）。**暂缓**：homeHp 2/3/4/4/5（需血条每侧独立 max·乙渲染契约）、≤5 写死天罡（现随机12）、stayP 关3-5=0.75（并入天罡/地煞重设计）。
5. **BUG#7 死战不退**（owner 真 bug·乙搜根因·甲修）：主将首负不亡退格 slot 碰撞吞后方兵 → 级联退格（恰退1格）+ `showBanner` 全屏通知。
6. **去腐·退役旧战斗核**（`REQ-G-退役旧战斗核`✅）：删 `live-combat`/`battle-screen`(503行)/`three-renderer`/`scene`/`render-frame`/`showMatch`/`buildGameGMatch`+全部续命测试·抽 `combat-types.ts`。单一真相=`turn-combat`+`turn-battle-screen`+`clash-resolve`。
7. **掌机闪烁修**(`7634b027`)：去两段绘制 + RO→applyScale + 移除入场动画。**⚠ 其 transform:scale 即上面 P0 黑屏因·已被 `c5608bbc` 的 zoom 取代**。

### ⏳ 待办（移交·按域）
- **甲**：#5 敌回合逐步演出钩子(active·未做)；#1 敌库 16+3=19(⏸待数据)；homeHp/写死天罡/stayP(⏸并入天罡地煞重设计)；`REQ-G-Boss牌面板`；`REQ-G-地煞新op`(4 新 op)；`REQ-G-诅咒地煞`(⏸暂缓)。
- **乙**：`REQ-G-战场UI批次`(owner 二催：敌方源泉数/双方牌库剩/Boss 地煞 mini-deck+悬停/开销水滴角标别挡字/买不起暗掉)；`REQ-G-说明同步`(helpBox 补战胜硬币 + 改「16扑克+5天罡+3地煞」)。
- **design G**：接入后重跑 `simulate-balance.ts` 标定 1-5 关。
- **框架(主程评)**：`REQ-ARCH-SAVE-PORT`/`MENU-DSL`/`ANCHOR`(带 YAGNI 审)。
- **大规模重构**：owner 已派**程序架构程序员** → `claude/kind-gates-xtajic`（**主干不要动**·测好再合）。

### git · 分支/标签（2026-06-22）
- `claude/mainbranch` = 主干出货线（bug 修 + 文档走这）·HEAD=`c5608bbc`(掌机黑屏 zoom 修)。
- `claude/kind-gates-xtajic` = **大规模重构专用**（owner「主干不要动」）·架构程序员在此 rework·测好再合。
- `build-2026-06-22-prerefactor`(=`d91221a3`) = 重构前快照(主干祖先·可回滚参照)。
- ⚠ 远端代理**拒绝 tag 推送** → 用分支当标签(仓内零 tags)。
- ⚠ **2 历史标签待 owner 指认 commit**：22:00 烧版 / 凌晨 2 点后版（rebase 打乱时间戳·主程无法自认）。

### 工作流（必读）
- 重构 → `kind-gates-xtajic`(主干不要动)；bug 修/文档 → `mainbranch`。
- push 前 `fetch→rebase→全套门禁(tsc+vitest+build)→push`；rebase 带进新提交必重跑。多 session 热 churn（game-g.tsx 最热）。
- 域红线：combat 核(`turn-combat`/`clash-resolve`/`combat-types`)=甲；`turn-battle-screen`/`lobby-screen`=乙（仅 owner 直派 bug 修可跨·须知会）。
- 掌机 = cartridge 构建(`build:cartridge`·弱 GPU webview)；**渲染改动须顾弱 GPU**（避免整屏 transform 合成图层 / 大图层 opacity 动画 / backdrop-filter）·**Mac 绿 ≠ 掌机绿**。

---

## 0a. game-f 自动循环（2026-06-15，Program F session）

**🟢 game-f 单机功能完整（本 session 全零引擎、纯游戏侧、全测+真机验）**：
- **太阁 Boss 招牌 ×8**（现成能力重组）：信长·天下布武(阶段递增 dmg_scale_b)、秀吉/本愿寺(SelfRule spawn 援军/人海)、斋藤毒沼(DoT)、明智群冻(FROZEN)、毛利三矢/今川弓阵(group-count BUSHO/BOW→buff)、石田三献茶(负 hitbox 回血)、谦信/家康(斩杀/忍耐, 早 done)。
- **牌组 ×5 + 组牌器**：虎豹/汉室/卧龙/白衣/屯田 preset + `CARD_CATALOG`/`assembleDeck`(从收藏自组) + 大厅 picker。
- **单机吴启用 + 3-faction plumbing**：`rosterFor('wu')`=吴+魏敌方半区（修旧崩 bug）；`buildSoloHud` 阵营感知（HEROES/名牌/商店卡按 faction 派生，去硬编码蜀+a_ 前缀）。
- **三人 mirror**：`ally-mirror.ts` 本地 AI 盟友各跑 PvE → 右栏迷你棋盘（state-sync 还原）。
- **经济 v1 全养成环**（`account.ts`，与 ECS 单向解耦）：战功 earn(攻岛结算)→spend(单抽/十连保底抽小丑牌)→收藏→组牌→段位(LP/难度阀 ×太阁hp)→附魔(分解化尘+升卡→局内 dmg_scale_a)。
- **去腐 + 回驳**：商店脉冲清零(114→0)、商店卡/名牌从 ROSTER 派生（删手抄 HEROES/HERO_NAMES）；回驳 REQ-F-064(Boss=重组)/屯田(已 economy-band)/econ-buff(过度设计)/武将-gacha(破公平)。

**⛔ 下一大方向 = B·多人/三人征日**：核心(传输 REQ-018 + N 端 lockstep)在 `src/net`=主程域 → 需 Lead+owner 协同，**Program F 不擅自入 net 层**。mirror 同步已证不阻塞(REQ-F-057 PF 定论)。小切片(星球牌/天梯解锁)待 Designer F spec。

**自动循环说明**：4 分钟心跳 Monitor（env 30min 上限 → 每周期重武装）；owner 定「不问问题、决策默认+报告」。Designer F 同步跑 docs(`game-f-designer-loop.md`)派单，Program F 实现+回驳，单一 `claude/mainbranch` 直推 rebase。

---

## 0b. 上一交接（2026-06-12，PE-F session）

**🔴 高分屏点击回归（`1fce0e0` 已修）**：`c105b92` 改 canvas 缓冲=逻辑×dpr，但 PointerInputSource 仍按 canvas.width(=缓冲)算坐标 → 落点偏 dpr 倍全空。修：onPointer 先 ÷dpr 还原逻辑坐标。⚠️ headless dpr=1 测试**不保真**——改任何 canvas 尺寸/坐标须真高分屏手验或传 dpr≠1 测试。

**🟡 REQ-F-061 选阵营（`d3dd065` 地基已推）**：`buildGameFBlueprint({playerFaction:'shu'|'wei'})` 纯数据。**待接**：`src/game-f.tsx` 加开局选阵营菜单 → 选定后再 start。

**🟢 本周引擎交付**：倒排索引(World.query 性能)；validate-references(P0 链接器)；REQ-F-049~055（部署门/占位/group-count 席板/点拖互斥/card-pile 刷新/t2-tray 托盘）；详见 `requests.md`。

**给主程复核**：① F-053 up/drag 互斥改了输入域形态（lockstep 安全，但值得过目）；② deploy 移入战拍偏离 flow-spec §3.3（策划 PF 尚未复核）。

---

## 1. 架构一句话

```
Manifest(纯数据) ──parseManifest──▶ WorldBlueprint ──engine.load──▶ World ──tick──▶ 确定性状态
```

- **引擎** `src/engine/`：ECS World（snapshot/hash）；SystemPhase 拓扑排序
- **能力库** `src/skills/`：Tier1（运动/动画/hierarchy-cascade）/ Tier2（物理/逻辑链/ARPG/tilemap/hex/gauge）/ Tier3（dialogue/match3/prefab/caster/aggro/poker-hand/card-scoring/flow/card-pile）
- **桥接** `src/assembly/`：capability-registry + parseManifest/exportManifest + schema 校验 + validate-references
- **Studio** `src/studio/`：数据透视器、资源库（art:<query>）、ZeroCraftBench
- **启动器** `apollo.py`：Vite+API+多 LLM；`bench` 命令

## 2. 五个游戏

| 游戏 | 一句话 |
|---|---|
| **A** 协作平台 | 双人卷轴；zone-occupancy+event-when+effect-apply |
| **B** 乙游 VN | dialogue；7 属性+掷骰；多结局 |
| **C** 缝纫物语 | match3+craft-recipe+换装 |
| **D** 暗黑 ARPG | aggro+caster+tilemap；WASD 可玩 |
| **E** 小丑牌 | poker-hand→card-scoring；150 小丑；webp 美术 |
| **F** 三国自走棋 | 六角+hex A*+回合 flow；单机功能完整（3阵营/5牌组+组牌器/8太阁招牌/三人mirror/经济v1养成环）；下一步=多人 |
| **G** 翻命扑克 Fateflip | 回合制三路掷命 deck-builder（doc24）；拟人扑克+天罡+地煞+战胜硬币+卦象结算；boss 关1-5 配数据；掌机 cartridge 出货。详见 §0 |

## 3. TODO

| 条目 | 内容 | 优先 |
|---|---|---|
| **R9** | TBF 资产"诊所"工具 | P2 |
| REQ-C-005/006/007 | match3 扩展/健壮/特效 | P1/P2 |
| REQ-023 | group-effect（不 greenlit，先重组） | P3 |
| PE-E | flow/card-pile 重写回合 + ScoreTrace | PE-E |
| game-f 多人 | B·三人征日：传输 REQ-018 + N 端 lockstep（主程域）+ 掷点分卡 + 三方共享岛 | 待 Lead/owner |
| game-f 养成余项 | 星球牌(流派升级)、天梯解锁(段位→解锁将/岛/Boss) | 待 Designer F spec |

**🔵 Studio follow-up**：结构编辑；playwright 真截图；⭐ NL→意图层（`ai-data-editor.md`）；Controllable schema

## 4. 技术债

- 🔴 无真浏览器帧验证；🟠 跨端浮点未验；🟠 多 session：push 前 fetch→rebase

## 5. 关键文件

- 宪法 `docs/design/data-driven-manifesto.md`｜需求 `requests.md`｜知识库 `wiki/skills/`
- 代码 `src/{engine,skills,assembly,studio,bench,games}`｜`apollo.py`
- 参考 `docs/ref/verified-fixes.md`
