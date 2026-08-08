# Review 单 · game108 四道复查门（S2 / S3 / S4 / S5）

> **给复查人（主程·owner 2026-08-08 指派）**：本单**是导航不是证据**。
> 复查人 ≠ 施工人是红线 —— 下面每一条都要你**自己复跑一遍**，别采信我的自陈那一列。
> 开工第一命令：`node scripts/game-pipeline.mjs checklist game108 S2`（S3/S4/S5 同）。

| | |
|---|---|
| 施工 | 策划/PE session（本单作者·**不参与复查**） |
| 复查 | **主程** |
| 提交范围 | `ec6794a9` … `1f98741d`（中间 `3222c0e0` / `89402109` 是 game211，与本单无关） |
| 改动面 | `games/game108/**` · `docs/design/game108/**` · `docs/playbooks/testing.md` · `public/games/game108/{pipeline.json,probe/}` |
| 声明的边界 | **不碰** `src/**`（引擎面）· 不碰 PUI 域（`src/ui/**`、`games/game-i/**`、`tools/ui-audit.mjs`、`tools/audits/**`）· 不碰其他游戏 |
| 机器门 | S3 / S4 / S5 三门皆绿 · gameHash `2e4969b32da64233`（`node scripts/game-pipeline.mjs board game108`） |
| 人门 | S3 / S4 owner 已签（2026-08-08）· S5 待签 |

## 零、先跑这一组（十分钟拿到全部机器证据）

```bash
node scripts/scoped-gate.mjs --run            # 退出码核对·别接管道
npx vitest run games/game108                  # 60 测试
npx vite-node scripts/acceptance-run.mjs --game game108   # 12 剧本
node scripts/game-skill-audit.mjs game108     # AUDIT + RATCHET
node scripts/game-pipeline.mjs board game108  # 三门态 + 证据是否新鲜
git diff --stat ec6794a9~1 1f98741d -- src/   # **应当为空**（边界核查的硬证据）
```

## 一、本轮做了什么（四件事·按风险从高到低）

1. **【R-108-33】封死大师赖皮**（`abe8e490`）—— 点名测试当场逮到一次**真违规**：
   大师开局定石，玩家出布 → `p1.hist.paper` 立刻 +1 → 「布是冠军」成立 → 判读链抬起新的上升沿
   → 接缝覆盖 intent ⇒ 大师从石改成剪刀。玩家永远输且零报错。
   两道**独立**的闸：① 定手窗（`DECIDE_GATE`·只亮一拍）② 台账推迟到结算入账。
2. **【R-108-34】大师 v5**（`1f98741d`）—— 四态心态机 + 两枚种子骰 + 六步一回合 + 跨局落地。
   全部是 `blueprint.ts` 的数据（`State`/`set-state`/`Effect.chance`/`EventWhen`），**零引擎单**。
3. **启动画面** —— 假进度条 + PRESS ANY KEY（owner 给稿·`plate-art.loadBar`）。
4. **补红** —— 验收剧本整套本来就是红的（详见三·②）。

## 二、请逐条核（每条附「怎么自己验」）

### 关口 S2 · 能力计划

| # | 核什么 | 怎么自己验 | 我的自陈 |
|---|---|---|---|
| 1 | 边界没被扩 | `git diff --name-only ec6794a9~1 1f98741d -- src/ tools/ games/game-i/` | 应为空 |
| 2 | v5 用的能力**对 registry 实名** | 逐个查 `State`/`set-state`（`components/logic.ts:52,120`）· `Effect.chance`（同上:150 + `effect-apply.ts:123`）· `ConditionExpr{kind:'state'}`（:82）· `vsResource`（:80） | 四样都是现成字段，无新增 |
| 3 | **没有「数据表 + 游戏层自写解释器」** | `grep -rn "function\|=>" games/game108/blueprint.ts \| grep -v "^.*://"`——看有没有跑规则的代码 | blueprint 里的函数只**拼数据**，不在 tick 里跑；`games/game108/` 无 system |
| 4 | plan 文档跟上了没有 | `docs/design/game108/capability-plan.md` 对照 gdd §9.6 | ⚠ **我没改 capability-plan** —— v5 用的四样能力它都已列，但「心态机」这个消费点没写进去。**这一条我判自己 CONCERNS，请你定要不要卡**。 |

### 关口 S3 · 骨架

| # | 核什么 | 怎么自己验 | 我的自陈 |
|---|---|---|---|
| 5 | 落盘门新鲜 | `node scripts/game-pipeline.mjs board game108` 看 S3 证据是否 stale | 绿 @ gameHash `2e4969b3` |
| 6 | **没有「填了但没人解释」的死数据** | 新加的旗：`p2.moodSet`/`p2.diceDone`/`p2.bluffing`/`p2.silent`/`p2.plan.*`/`p2.read.*`/`duel.read`/`duel.decide`——逐个 `grep` 看有没有消费方 | 都有；**这一条正是本轮踩过的坑**：`gate:read` 实体第一版忘了建，flow 的 `set-flag` 找不到 Flag 就静默不做，大师整局一手不出且零报错（`blueprint.ts` 该处有注释留痕） |
| 7 | 旗位建在**装配面**不是 master 分支里 | `blueprint.ts` 搜 `'flag:moodset'` | 已挪出 `masterRules()`——否则其余四档每回合对着空气 `set-flag` |

### 关口 S4 · 玩法

| # | 核什么 | 怎么自己验 | 我的自陈 |
|---|---|---|---|
| 8 | **测试断言的是行为不是常量**（撤修验红） | 见下「三、撤修锚点」——**七处，逐个跑** | 七处各自只红一条，无交叉 |
| 9 | 剧本作者 = GD 非 PE | `git blame docs/design/game108/acceptance/*.scenario.jsonc` | ⚠ **本轮我改了 11 本剧本的 tick 数**（补红·非改语义）。改的是等待拍数，**没动任何断言**——请你 `git diff ec6794a9~1 1f98741d -- docs/design/game108/acceptance/` 核这一点 |
| 10 | 确定性 | 测试「骰子走引擎种子 PRNG」；另 `grep -rn "Math.random" games/game108/` | 应为 0 命中 |
| 11 | 真浏览器试玩 | `public/games/game108/probe/S5-v5-*.png` 七张（启动屏 → 开局 → T1 → T2 → 对决 → 第二回合 → 第五回合） | 旅程脚本 8 条断言全绿；**其中一条当场逮到持久化兜底写成 `?? m.read`（那正是 0 本身）** |
| 12 | 递归复核 / 玩家视角八问 | `docs/design/game108/self-check/` | ⚠ **v5 之后没重跑**。请你判要不要在本关卡住 |

### 关口 S5 · UI

| # | 核什么 | 怎么自己验 | 我的自陈 |
|---|---|---|---|
| 13 | 无手写 DOM 逃生 | `grep -rn "innerHTML\|createElement\|document\." games/game108/` | 启动画面走 `LayoutNode`（`Panel`/`Image`/`Label`）+ `plate-art` 贴图；宿主里有一处 `requestAnimationFrame`（**只驱动假进度条**·见 `game108.ts tickBoot` 注释） |
| 14 | 棘轮 | `node scripts/game-skill-audit.mjs game108` | RATCHET: PASS |
| 15 | `/check-ui` 四关 | 跑 `/check-ui` | ⚠ **我没跑**（启动画面是新屏）。请你跑 |
| 16 | **只换皮不动布局** | `git diff -- games/game108/duel-screen.ts` | 只动了 `startScreen()` 一屏（它本来就是覆盖层）+ 加 `loadPct`；对局屏零改动 |
| 17 | 进度条不逐帧换皮 | 测试「加载进度**量化**」；或真浏览器看 `networkidle` 是否落停 | 量化到 5% = 21 张图封顶 |

## 三、撤修锚点（S4 第 8 条用·**逐个撤、逐个跑、跑完复原**）

改完跑 `npx vitest run games/game108`，**每处应当只红括号里那一条**；红别的 = 我的互斥构造有洞。

| # | 撤什么（`games/game108/blueprint.ts`） | 应红 |
|---|---|---|
| A | `masterRules` 里 `const gate = { …DECIDE_GATE }` → 改回 `THROWING_GATE` | 不许赖皮·第二道 |
| B | `fx:hist:*` 的 `onSignal: playerCounted(h)` → 改回 `playerThrewHand(h)` | v4 维度一台账 |
| C | ⑤ 定手支路 A `all(bluffing, flag(readFlag(t)))` → `readFlag(BEATS[t])` | 蓄力 ≠ 出手 |
| D | `firstOf` 去掉互斥（`o[h] = cand[h]`） | 两手同时满蓄只点亮一面判读旗 |
| E | `fx:hit` 的 `value: 1` → `0` | 回顾：读准度 ±1 |
| F | ③ 蓄力条件去掉 `flag(SILENT_FLAG, false)` | 沉默那一回合一格不蓄 |
| G | 心态 `finish: closing` → 改成永不成立 | 心态机四态切换 |
| H | （剧本侧）把任一本剧本的 `"tick": 275` 改回 `152` | 验收剧本等待拍数守卫 |

> A/B 两处我**已各自实跑过一遍**（各只红一条），C–H 同法。但**这一列是我的自陈，不是证据** —— 请你自己跑。

## 四、我自己判红/黄的地方（不用你找）

1. **S2 第 4 条**：`capability-plan.md` 没跟上 v5 的「心态机」消费点 —— 自判 CONCERNS。
2. **S4 第 12 条**：递归复核与玩家视角八问在 v5 之后没重跑 —— 自判 CONCERNS。
3. **S5 第 15 条**：`/check-ui` 没跑新屏 —— 自判 CONCERNS。
4. **待 owner 定的设计问题**（不属复查范围，附此备忘）：T2 免费段**跑满 5 秒才走**，玩家一提交就只能干等 ~4.8 秒。既有 v3 设计，非本轮引入，但真玩起来正是 owner 2026-08-07 嫌弃过的那种空等。
5. **REQ-UIFX** 仍在 PUI 手里（粒子定色/定向/拖尾 + 液态进度条）——到货后烟雾演出与加载条可再升一档。

## 五、落账

```bash
node scripts/game-pipeline.mjs review game108 S2 --verdict PASS|CONCERNS|FAIL --note "逐条结论（带 file:line/实数）" --by 主程
# S3 / S4 / S5 同
```
