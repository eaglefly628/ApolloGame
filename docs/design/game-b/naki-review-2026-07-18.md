# 鸣牌（吃碰杠）+ 门清真算分 · GD-B 对抗性规则复审（2026-07-18）

> GD-B（规则权威·独立对抗裁判）对 PE-B 本轮交付的**只读**审查裁决 + 新建验收剧本清单。
> 审查基准 = `gdd.md §四`、`mahjong-core-tests.md §3/§4/§7/§R`、`naki-design.md §2/§3/§5/§7`（含 R-2/R-3/R-5/R-6 现生效）。
> 复审方法：逐行读 `core/{calls,meld,game-state,yaku,fu-score,hand-eval,tiles-def,wall}.ts` + 跑 sim 复现（种子 PRNG·headless）。
> **立场：不给 PE 背书·专挑真错。** 结论 = 主体规则正确，**1 条硬错**（1番縛り闭手未强制）+ 若干债需裁决/文档对齐。

---

## A. 审查裁决表（对抗性·逐条）

### A.1 判定为「规则正确」（已逐条验证·含 sim 复现）

| # | 项 | 裁决 | 验证要点 |
|---|---|---|---|
| ✅1 | **喰い替え筋方向**（R-2） | **正确** | `calls.ts kuikaeForbidden` 在**牌种空间**逐型追踪：低端吃（持高两张·被吃在低端）禁「高端+1」筋、高端吃禁「低端−1」筋、嵌张/边张仅禁現物；`inSuit` 边界守卫正确挡住 1-2-3/7-8-9 penchan 的假筋。sim 独立复现 seed=3：吃 sou3（持 sou4/5）→ 禁 {sou3 現物, **sou6 筋**}，方向正确。 |
| ✅2 | **优先级** 荣>碰/大明杠>吃 | **正确** | `resolveClaims` 荣全收（双响 claim 层）、碰/杠取一（一张弃牌至多一家可碰）、吃取一（仅下家）；`applyWinners` 荣压碰。sim 复现：主角吃被同张 AI 碰抢走（碰>吃）。 |
| ✅3 | **抢杠放铳方向** | **正确** | `declareKakan`/`resolveKakanRob`：加杠被荣 → `settleWin('ron', winner=抢和家, loser=加杠家)`——**加杠家放铳**，方向对。暗杠不开抢杠窗口（R-6 国士抢暗杠 v1 不做·守）。 |
| ✅4 | **岭上/王牌守恒** | **正确** | `rinshanDraw`：王牌前区 `dead.shift()` 取岭上 + 活山尾 `wall.pop()` 补进王牌 → **王牌恒 14**、活山随杠变短（海底提前）、总牌恒 136。sim：全交互整场 `minDead=14`、`tile_total≡136`（无一例外）。 |
| ✅5 | **门清真算分（役/番/符/点）** | **正确** | `yaku.ts`+`fu-score.ts` 审计通过：R-1 連風雀頭 **2 符单档不叠加**（`pairFu`）、R-7 役满**一律单倍**（含四暗単騎/13面国士/大四喜）、R-8 **累计役满**（13+番=8000 基·非封三倍満）、**無切上満貫**（30符4番→7700/庄11600）、平和自摸20/荣30、七対25、四暗刻 vs 荣和双碰化三暗刻、連風 yaku 場+自双计、混老頭/純全/混全 幺九守卫、取高原则。 |
| ✅6 | **门清不回退** | **正确** | `interactiveCalls=false` 时 `openCallWindow` 仅「他家荣→否则下家摸」·绝不 `applyCall`；melds 恒空。sim：默认整场 `anyMeld=false`、`score_sum=200000`。 |
| ✅7 | 吃仅下家 / 碰大明杠任意家 | **正确** | 吃座次由 `playerCallOptions`（`seat===(discarder+1)%4`）闸死·AI 不吃；碰/杠任意非弃牌家。 |
| ✅8 | 食い断 / 喰い下がり **口径** | **正确（裁决无误）** | 食断有（开手断幺成立）、喰い下がり −1 的 6 役集（三色/一気/混全/純全/混一/清一）齐全——**口径对**；实装因开手=占位（P6b）暂未行使，非错。 |

### A.2 债 · 逐条裁决（v1 可接受 / 必须现修）

| # | 债 | GD-B 裁决 | 依据 / 附注 |
|---|---|---|---|
| 🔴 **D2** | **1番縛り 未强制**：无役**闭手荣和**走占位兜底 = **和了成立** | **硬错·必须现修（闭手荣）** | 日麻最低一役是硬规则（gdd 支柱②「懂麻将挑不出毛病」）。荣和检测闸只判**形**（`winsWithMelds`），无役闭手荣 `scoreWin→null` 却落 `settleWin` 占位分 → **允许非法荣和**。（闭手**自摸**恒带門前清自摸和·天然 1 役·不受影响；故此洞=**闭手荣和**·尤指未立直的形式听牌荣无役张。）闭手役引擎已在（`scoreWin`），补 gate 极廉价。**开手** 1番縛り = 无役引擎故 defer P6b（可接受）。见 §B 修红。 |
| 🟠 **D1** | **多家荣双响未做**·实装 = **頭跳（近家单荣）** | **v1 可接受（defer v2）·但须对齐文档 + 报 owner** | 頭跳方向本身正确（`callOffset` 近家=下家最先）、守恒安全、双响罕见。**但**背离 gdd §四**拍板默认「双响制」**（頭跳本是 config）；R-10（双响本场棒）随之 **moot**。不擅改 owner 拍板 → **提 owner/复审**：gdd §四 多家荣行 + R-10 注明「v1=頭跳 interim·双响制+R-10=v2」。 |
| 🟠 **D7** | **海底での槓未禁**（杠无活山长度守卫） | **应修（廉价守卫）·低危** | `canAnkan/canKakan/大明杠` 未查 `wall.length>0`；若在活山空时开杠，`rinshanDraw` `dead.shift` 无 `wall.pop` 补 → **王牌跌到 13**（破「王牌恒 14」）+ 违「海底牌不可杠」（mahjong-core-tests §1/§3）。sim 采样未触发（`minDead=14`·总牌仍守恒 136），故低危；**补一句 `wall.length>0` 守卫即闭**。 |
| 🟠 **D5b** | **槍槓 役未接线**（连闭手抢和家） | **v1 可接受·但因本轮上抢杠 → 建议补** | 闭手抢和家走真算分却漏 **槍槓 +1 番**（欠番）；若无他役 → `scoreWin→null` → 占位（本该 1 番成立）。罕见·defer P6b 可接受，但抢杠本轮即上，**建议**把 chankan/rinshan 旗注入 `WinContext`。 |
| 🟡 **D3** | 明杠新宝牌**即翻**（R-3 应「打后翻」） | **v1 可接受（defer）** | 无算分影响：明杠→开手→占位；仅影响加杠/明杠家的**岭上自摸**（亦占位）。纯 cosmetic 时序。PE 自评「占位下无差别」**属实**。 |
| 🟡 **D4** | 立直后**整体禁暗杠**（未做「不変听可杠」判定） | **v1 可接受（defer）** | 更严（禁掉有时合法的暗杠）→ 不产错误结果·安全子集。仅少一个罕用选项。 |
| 🟡 **D5a** | 岭上開花 役未接线 | **v1 可接受（零影响）** | 岭上必带杠（=meld）→ 开手→占位；真闭手算分永不见岭上。自洽。 |
| 🟡 **D6** | **含暗杠的门清手被当「开手」占位**（`melds.length>0` 排除真算分） | **v1 可接受（defer P6b）·须记** | 含暗杠仍是**门前清**、应走真役（立直/自摸…）+ 杠子符，现落占位（`yaku.ts` 明言不含杠符故暂排除属实）。「闭手」定义宜为「门前含暗杠」而非「melds 空」——P6b 补杠符时收口。 |
| 🟡 **D8** | **同巡/立直振听未做**（见逃 ron 后不置振听） | **headless 可接受·UI 前须补** | 现仅舍张振听。交互窗口下**玩家 pass 一个 ron** 应触发同巡振听（至下次自摸）/立直永久振听；AI 恒不 pass 荣（`aiDecideCall` 能荣即荣）故 headless 无错误结算。**玩家 pass 路径（P4 UI）落地前必补**，否则玩家可见逃后再荣=非法。 |
| 🟡 **D10** | **AI 从不吃**（`aiDecideCall` 无吃分支） | **v1 可接受（玩法债·非规则错）** | 吃合法性正确、仅下家闸死；三姨太不吃=局面偏静，等 B-006 AI/BT。 |
| 🟡 **D11** | 抢杠和牌用普通牌码（赤5 加杠第4张被吃时丢赤 dora） | **v1 可接受（罕见 cosmetic）** | 闭手抢和家若荣的是赤5 加杠张 → 少 +1 赤宝牌。极罕见·记 P6b。 |

### A.3 三问收口（task 点名）

- **多家荣双响 defer 可接受吗？** → **可接受**（罕见 + 頭跳方向正确 + 守恒安全）。**但**这是背离 gdd 拍板默认「双响制」——须把 gdd §四 + R-10 注为「v1=頭跳 interim」并**报 owner**（不擅改拍板）。
- **1番縛り不强制（无役也能和）硬错 or v1 可接受？** → **闭手荣和 = 硬错·必须现修**（役引擎已在·补 gate 廉价·核心规则红线；闭手自摸恒带門前清自摸和·不在洞内）；**开手 = 可接受 defer P6b**（无役引擎）。**本轮唯一硬错。**
- **食い断 口径？** → **正确**（食断有·gdd/naki 一致）；喰い下がり 6 役集齐全；实装随开手真算分 P6b 行使。

---

## B. 给 PE-B 的修红清单（按严重度）

> 🔴 = 现修（硬规则错）· 🟠 = 应修/须对齐 · 🟡 = 记债（文档标清即可）。

- 🔴 **D2 · 闭手荣和 1番縛り**：**荣和**检测点（`openCallWindow` 非交互荣支、`aiDecideCall`/`playerCallOptions` 荣、`kakanRobbers`）在**闭手（melds 空）**时须追加「有役」闸——即以该荣和牌构 `WinContext` 跑 `scoreWin(ctx)!==null` 才允许荣。建议抽 `canRon(m,seat,tile)=winsWithMelds(form) && (melds 非空 ? true : scoreWin(ctx)!==null)` 统一用。开手暂放行（占位·P6b 补）。**自摸不用改**（闭手自摸恒带門前清自摸和·`scoreWin` 恒非 null；`canTsumo` 加同 gate 是无害 no-op·非必需）。副作用正确：无役闭手降为**形式聴牌**（`ryuukyoku` 走 form `tenpaiWithMelds` 仍计罚符=对），但不得实荣。
  - **照出它的载体**：本轮 acceptance 无法注入构造手（adapter 零规则不喂牌），故此错**由单测钉**——请 PE 在 `game-state-calls.test.ts` 加：构造「无役闭手听牌（未立直·非断幺·非平和·非役牌…纯形听两面）」→ 他家弃其和牌张 → 断言 `phase!=='win'`（荣被拒·不落占位分）。（自摸支无需断言：闭手自摸永远合法带役。）
- 🟠 **D1 · 双响/頭跳文档对齐**：代码保持頭跳（可接受 v1），但**提 owner/复审**改 gdd §四 多家荣行 + `mahjong-core-tests §R` R-10 注「v1=頭跳 interim·双响制+R-10=v2」。GD-B 不擅改拍板行。
- 🟠 **D7 · 海底槓守卫**：`ankanKinds`/`kakanKinds`/大明杠 option 追加 `rs.wall.length>0`（活山空不得开杠）→ 闭「王牌跌 13」+「海底牌不可杠」。
- 🟠 **D5b · 槍槓役**：抢杠 `settleWin` 前给闭手抢和家的 `WinContext` 注入 `chankan:true` → `yaku.ts` 加「槍槓 1 番」（顺带 D5a 岭上開花 `rinshan` 旗·1 番）。
- 🟡 **D6/D8/D3/D4/D11**：文档记债（本 md §A.2 已逐条裁决）；D8 在**玩家 pass 路径 UI 化前**必补同巡/立直振听。

---

## C. 新建验收剧本清单（GD-B 亲写·PE 勿改）

> 全部落 `docs/design/game-b/acceptance/`，已过 `acceptance-schema` 校验。**每条头部注释写清查的规则/对抗目标/规则依据/所需 PE 新增信号读者**。
> 精确值全部 **sim 复现钉死**（种子 PRNG·双跑一致）；标「seed 锁定」者若 PE 改 AI 启发致漂移 → GD-B 重验。

| 剧本文件 | 查什么 | seed·驱动 | 关键断言 |
|---|---|---|---|
| `menzen-no-regression-sentinel` | 门清不回退哨兵 | 20260717·默认 play-match | `melds_sum=0`（恒）·`dead_len=14`·`score_sum=200000` |
| `menzen-real-score` | 门清闭手真算分（非占位） | 42·默认 play-round | `result_type=ron`·`winner=主角`·`win_placeholder=0`·`win_has_yaku=true`·`delta_sum=0`·`melds_sum=0` |
| `naki-pon` | 碰机制 + 守恒 | 909·interactive play-round | `melds_sum=3`·`melds_2=3`·`kan_count=0`·`tile_total=136` |
| `naki-kan-deadwall-conservation` | 杠·王牌恒14·新宝牌 + 交互整场守恒 | 88·interactive play-round→play-match | `kan_count≥1`·`dora_count≥2`·`dead_len=14`·`tile_total=136`·终局 `score_sum=200000` |
| `naki-chi-kuikae-suji` | 吃仅下家 + 喰い替え**筋方向** | 3·interactive tick24→call-chi | `melds_0=3`·`turn=0`·`forbidden_count=2`·`forbidden_sum=43`（={sou3,sou6}）·`tile_total=136` |

### C.1 需要 PE 新增的适配器信号 / 读者（照单纯接线·零规则）

**信号（`applySignal` 加 case·纯转发到既有 sim 函数）：**
- `interactive` → `m.interactiveCalls = true;`（开鸣牌闸·被 naki-pon/kan/chi 三剧本用）。
- `call-chi`（args 可选 `[consumeLo]`）→ 若 `m.cur.callWindow?.options.chi.length>0`：按 `consume[0]===args[0]` 选中候选（缺 args 取首个）→ `playerCall(m,{type:'chi',chi:cand})`（被 chi 剧本用）。
- （**建议一并加·未来剧本/UI 平价·本 5 剧本不用**）`call-pon`/`call-minkan`/`call-ron`/`pass`/`ankan`(args`[kind?]`)/`kakan`(args`[kind?]`)——全纯转发 `playerCall`/`playerPass`/`declareAnkan`/`declareKakan`。

**读者（`RES`/`FLAG`·纯投影 `MatchState`·零算番）：**
- `RES melds_sum` = `m.cur.melds.reduce((a,ms)=>a+ms.reduce((b,md)=>b+md.tiles.length,0),0)`。
- `RES melds_0..melds_3` = 各席 `m.cur.melds[s].reduce((b,md)=>b+md.tiles.length,0)`。
- `RES kan_count` = `m.cur.kanCount`。
- `RES dora_count` = `m.cur.doraInd.length`。
- `RES dead_len` = `m.cur.dead.length`。
- `RES tile_total` = 手+副露牌+河+活山+王牌+摸 全和（= 既有单测 `totalTiles` 同式·恒 136）。
- `RES win_placeholder` = `m.cur.result ? (String(m.cur.result.scoreLabel).includes('占位') ? 1 : 0) : -1`。
- `RES forbidden_count` = `m.cur.forbiddenDiscard.length`。
- `RES forbidden_sum` = `m.cur.forbiddenDiscard.reduce((a,b)=>a+b,0)`。
- `FLAG win_has_yaku` = `!!m.cur.result?.yakuLabel`。

### C.2 未覆盖项（诚实边界）

- **抢杠放铳（chankan）end-to-end 剧本 = 缺**。原因：AI 恒不吃、加杠被抢需「他家恰听加杠张且非振听」——sim 扫 seeds 1..250（14 局有加杠）**0 自然抢杠**；adapter 零规则不能注入构造手，故 headless 无确定性路径。**抢杠方向已 §A.1-✅3 读码验证正确 + PE 单测 `game-state-calls.test.ts:250` 钉死**（winner=抢和家·loser=加杠家）。若 owner 要 acceptance 层也钉：需 PE 提供「构造盘面」测试信号（越出零规则契约·不建议），或接受单测覆盖。（后台大范围扫种子中·若寻得自然抢杠局将补剧本。）
- **D2（无役闭手和）**、双响、同巡/立直振听：同理不可注入构造手 → 归**单测**载体（§B 已点名 D2 单测）。
