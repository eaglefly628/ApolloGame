# Game G 战斗轨（甲）· Session 交接 — 2026-06-19

> 给**下一个「甲（战斗开发）」session**。读这份 + 正典 `doc 19/20/21/22` + `doc/match-flow.html` + `UI/Game G 对决特写.dc.html` 即可无缝接手。
> 乙 = 菜单轨（大厅/布阵/养成），正交——只改自己文件，对方只读。

---

## 0. 怎么跑 / 工作规范
- **分支**：开发推**两条**——`claude/charming-noether-zm0g47`（owner 预览读这条）+ `claude/mainbranch`（团队/乙在这；owner 已授权甲推）。
- **流程**：每次 push 前 `git fetch origin claude/mainbranch` → `git merge origin/claude/mainbranch` → 全绿 → push 两条。**mainbranch 被多 session（资源/UI/乙）高频推进**，push 常被拒（non-ff）→ 再 fetch+merge+重 gate+再 push。
- **门禁**（全绿才推）：`npx tsc --noEmit` + `npx vitest run`（当前 ~1521）+ `npm run build`。golden 改了用 `npx vitest run -u <file>`。
- **署名** `Claude <noreply@anthropic.com>`；commit 尾 `https://claude.ai/code/session_01XaK22rg7oejfFMHDoWAX71`（换成你自己 session URL）；**产物不写模型标识**。
- **截图预览**：playwright 全局 `/opt/node22/lib/node_modules/playwright`，chromium 用 explicit `executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`。战斗屏 golden 截图需注入 `<style>.gg-root{width:1280px!important}.gg-scale-inner{transform:scale(.66667)!important;transform-origin:top left!important}`（headless 不解析 cqw）；ffmpeg 是精简版（无 hstack）。

## 1. 游戏模型（owner 拍板 · CR pivot）
**致命翻牌 = 皇室战争(点数·实时) × Commands&Colors(三路·牌驱动·掷命) × 扑克(公平+养成)**。
- **局内循环**：① 点数(圣水)随**真实时间**回复 → ② 花点数**摸牌·玩家选库**(普通~1/天罡~2) → ③ 部署三路 / 天罡施法 → ④ 慢行军 → **遭遇 logistic 掷命对决** → 先破**3 血**大本营。**无暂停**。
- **三牌库**：扑克 52(局内兵·公平骨架) / 天罡(局内法术·≤5 战库) / 地支(局外养成·乙)。
- **掷命对决**：`pEff = 点数 + 经营(buff) + 天罡(tengang) + 士气(morale)`；`winrate` logistic(夹 3%~97% 爆冷缝)；`roll<wr` 定生死。**50:50 平局裁定**：点数大者胜 → 续航高者 → 重揉。
- **对决特写**：忠实复刻 Core Design「对决特写.dc.html」→ `battle-screen.ts` 的 `clashCloseup()`（居中舞台/3D翻牌/四段战力拆解/命运一掷/活·斩·平裁定/玄铁·锦霞双皮）。

## 2. 甲拥有的文件（只你改）
- `live-combat.ts` — sim 核：掷命/慢行军/续航/3血/天罡 fx(TengangFx·tengangA)/`migrateRear`/平局裁定/`ClashEvent.tie`。
- `clash-resolve.ts` — `pEff`/`winrate`/`cardPoints`。
- `battle-screen.ts` — 渲染器：HUD/dock/board/`clashCloseup`/**JS 缩放**(mountBattle render)。
- `game-g.tsx` 内 `showMatch` + 战斗驱动（`armyToDeploys`/`buildBattleViewLive`/`clashToView`/`aggregateTengang`/`canDrawFrom`/`control`/rAF loop）+ `Save`/`loadSave`。
- 测：`live-combat.test.ts` / `clash-resolve.test.ts` / `battle-screen.frame.test.ts`。
- **只读**：`blueprint.ts`(`GAME_G_TIANGANGS`/`prepareArmies`/`TIANGANG_BY_ID`) · `lobby-screen.ts`(乙)。

## 3. 契约（不私改 shape · 撞了先改本档 + 知会乙）
- **①** `prepareArmies(setup) → {a,b: ArmyCard[]}`，`ArmyCard{id,rank,suit,favor,lane,general}`（乙产·甲读）。
- **②** `save.tiangangs[]`(战库≤5) + `save.planets{}`（乙写·甲读）。
- **③** `GAME_G_TIANGANGS` 每张 `{id,name,rarity,kind,params,power,phat,text,cost}`（乙数据·甲 `aggregateTengang` 读 `kind`/`params`）。

## 4. 本 session 已落地（都在 mainbranch · 勿重做）
- **CR 两牌库经济**：点数 regen + 花点数摸牌选库 + 普通 cap7 / 天罡 cap5 打掉才补 + **砍读秒暂停**。取代旧战潮/天机能量。
- **三路兵力迁移** `migrateRear`（抽队尾后备 → 改派任意路·确定性不消耗 rng·不破 hash）。
- **A-JOKER v1**：天罡施法效果 **6 kind / 9 张**（odds 巧手·稳手 / power 虎符·寡兵·同花魁 / combo 对子诀 / morale 令旗 / stamina 铁汉 / draw 广纳）。`aggregateTengang(castIds)→live.tengangA`，**cast 持续整局·一种算一次·只己方**。
- **50:50 平局裁定** + 对决明细加「天罡」段 + 掷点贴边修复。
- **A6 死亡闪帧 + A2 出牌啪嗒**（`boardFx`）+ 修对决特写**演出期定格一次渲染**(`heldClash`)。
- **分辨率修复**：弃 cqw、JS 实测容器宽显式 scale，整屏 720p。
- **移除干预卡左栏 + 干预能量**（owner）。
- **对决特写忠实复刻 Core Design 稿**。

## 5. TODO / 待办（owner 拍）
1. **⚠️ owner 反馈「8 个很多」**（2026-06-19 看战斗屏后）：**不确定 8 指哪个**——最可能是**手牌上限**(`NORMAL_HAND_CAP=7`，含天罡显得多) 或某 UI 计数偏多。**先跟 owner 确认"8"具体指什么再调**（若手牌：改 `game-g.tsx` 顶 TUNE 区 `NORMAL_HAND_CAP`/`OPENING_NORMAL`）。
2. **B7（乙做·已转交 TODAY-TASKS）**：出战 → 直接战斗、删「选阵型/备战」两屏。甲 `showMatch` 签名不变·已就绪，不用甲动。
3. **天罡触发模型 v2**（owner：「**按牌本身描述**」，否了"一刀切持续整局"）：v1 的持续 buff 对（那些牌描述本就持续）；补**一次性**(增援路/弃一保二 spawn/transfer)、**条件触发**(背水 reroll·攻城锤 chip)、**tempo**(疾行/迟滞·需 live-combat 行军速挂点)、combo straight(顺子阵)、arcane 印记(流派集齐)、战潮 pulse(语义被 CR 取代·待 owner 重定)、擒王(依干预·斩首令)。
4. **A7 仿真台 `sim.ts`**：离线蒙卡扫 CR 经济+天罡 → 胜率矩阵 + 退化告警 + 镜像偏胜(~62/38)。**未建**。
5. **CR 手感调值**（`game-g.tsx` 顶 TUNE 区）：慢/中/快档（`POINTS_REGEN_MS` 1100/950/800·`POINTS_START` 5/5/6·`OPENING_NORMAL` 4/4/5）。待真机。
6. **捷径门 vs migrateRear**：策划 doc（e33/doc23）有「横向门(上↔中/中↔下·天罡开关)」迁移模型，与我的"召回重派"不同 → owner 定用哪个。
7. **hero/生肖立绘**（doc22 世界观）：`clashCloseup` 现用花色字占位 → 待乙数据/美术替换。

## 6. 坑 / 注意
- **战斗屏缩放别再用 container-query `cqw`**（部分浏览器不解析 → 只露左上角）；用 `mountBattle` render() 里 JS 实测 `.gg-scale-outer.clientWidth` → scale `.gg-scale-inner`。
- **对决特写演出期"定格一次渲染"**(`heldClash`)：别每帧重渲(否则 CSS 翻转/掷点动画每帧重启、卡在起手)。
- **mainbranch 高频被推**：push 前必 fetch+merge+重 gate。
- **rank `'JOKER'`/`'★'`/`'王'` = 大小王扑克牌**(15 点/续航 3)，**不是**天罡牌——别在重命名/清理时误改。
- `happy-dom` 有时 sandbox 没装（乙的 `lobby-screen.click.test` 需要）→ `npm install happy-dom --no-save`。

> 复诵：甲 = 战斗轨；CR 局内循环 + 掷命对决 + 天罡施法 + 对决特写已成形并在 mainbranch；下一步先确认 owner 的「8 个很多」，再按 owner 排期推 天罡 v2 / 仿真台 / 调手感。两条分支都推、全绿才推、守甲乙正交。
