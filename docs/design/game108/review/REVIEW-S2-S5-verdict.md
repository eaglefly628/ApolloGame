# REVIEW-108-S2S5 · 复查判词（S2 / S3 / S4 / S5）

| | |
|---|---|
| 复查人 | 独立复查人 agent（主程派·**非施工方**·复查人≠施工人红线成立） |
| 复查日 | 2026-08-18 |
| 复查对象 | 提交范围 `ec6794a9` … `1f98741d`（导航单 `REVIEW-S2-S5.md` 在案） |
| 复查基准 | **当前 HEAD `0e72bdfe`**（gameHash `cad74767ecca25b9`）——范围尾之后 game108 另有 5 个提交（`891f33d8`/`eeaeda8a`/`3801e35a`/`43f553a7`/`36886d24`），凡「范围内成立、HEAD 已变」的逐条注明 |
| 环境注 | 本 worktree 是**浅克隆**，范围两端提交默认不可达——`git fetch --deepen=300` 后才可验。下一个复查人先跑这一步 |
| 终审 | 主程（本判词是给终审的证据包·**人门项一概未代签**） |

## 〇、四关判定一览

| 关 | 机器门（我独立复跑·退出码直取） | 复查门判定 | 一句话事由 |
|---|---|---|---|
| **S2 能力计划** | `gate S2` exit=0 | **PASS** | 边界干净·四能力实名核真·零游戏层解释器·plan 缺口已由 `891f33d8` 补上 |
| **S3 骨架** | `gate S3` exit=0（渲染探针✓·点击门 7 控件 6 变·零 console error） | **PASS** | 八面旗全有产销·旗位在装配面·一处非阻断探针噪声（见 finding F3） |
| **S4 玩法** | `gate S4` exit=0（94 测 + 12 剧本 + uiwalk）·playthrough 41/41 | **CONCERNS** | 撤修锚点 10/10 全命中；唯一事由=递归复核尺子在 HEAD 已被后续提交打过期（exit=1·非本范围引入，finding F1） |
| **S5 UI** | `gate S5` exit=0（AUDIT+RATCHET PASS·⚠无 golden 基准） | **CONCERNS** | 无 DOM 逃生·只换皮不动布局成立；`/check-ui` 施工方自判没跑属实，我代跑=**两屏审计都 exit 1**（证据指向审计盲区假阳·须 PUI 裁定，finding F2） |

机器证据总账（全部独立复跑·退出码直取·不采信自陈）：

```
node scripts/scoped-gate.mjs --run                 → exit 0（scope=full 全绿）
npx vitest run games/game108                       → exit 0（94/94·注：导航单写 60，后续提交已加至 94）
npx vite-node scripts/acceptance-run.mjs --game game108 → exit 0（12 剧本全 PASS）
node scripts/game-skill-audit.mjs game108          → exit 0（AUDIT PASS · RATCHET PASS）
node scripts/game-pipeline.mjs gate game108 S2/S3/S4/S5 → 全 exit 0 @ gameHash cad74767ecca25b9
node scripts/game108-playthrough.mjs               → exit 0（真浏览器 41/41·零 console error）
npx vite-node scripts/game108-spec-recursion.mjs   → **exit 1**（见 F1·唯一的红）
node tools/ui-audit.mjs tools/audits/game108-duel.audit.ts → **exit 1**（见 F2）
git diff --name-only ec6794a9~1 1f98741d -- src/ tools/ games/game-i/ → 空（边界硬证据）
```

## 一、撤修锚点命中表（每处：预告→实撤→复原验绿；末次全量 94/94 绿收尾）

导航单八锚 + 自选两锚，**每处全量跑 `npx vitest run games/game108`，恰红一条、名字与预告一致**：

| # | 撤什么 | 应红（预告） | 实测 | 命中 |
|---|---|---|---|---|
| A | `blueprint.ts:619` `gate=flag(DECIDE_GATE)`→`THROWING_GATE` | 不许赖皮·第二道 | 1 failed：【R-108-33】**A 闸独立咬合**（结构断言·REQ-108-PE-01） | ✓ |
| B | `:405` `fx:hist` `onSignal: playerCounted(h)`→`playerThrewHand(h)` | v4 维度一台账 | 1 failed：【R-108-30】v4 维度一：出招记进跨局台账 | ✓ |
| C | `:623` 定手支路 A `readFlag(t)`→`readFlag(BEATS[t])` | 蓄力 ≠ 出手 | 1 failed：【R-108-34】蓄力 ≠ 出手 | ✓ |
| D | `:497-498` `firstOf` 去互斥（`o[h]=cand[h]`） | 判读旗互斥 | 1 failed：【R-108-34】两手同时满蓄只点亮一面判读旗 | ✓ |
| E | `:646` `fx:hit` `value:1`→`0` | 读准度 ±1 | 1 failed：【R-108-34】回顾：赢 +1 被读穿 −1 | ✓ |
| F | `:577` 蓄力条件去掉 `flag(SILENT_FLAG,false)` | 沉默不蓄 | 1 failed：【R-108-34】沉默那一回合一格都不蓄 | ✓ |
| G | `:525` `finish: closing`→`all(closing,not(closing))`（恒假） | 心态机四态 | 1 failed：【R-108-34】心态机四态按条件切换 | ✓ |
| H | 剧本 10 `"tick":275`→`152` | 拍数守卫 | 1 failed：验收剧本「跨过 T1」等待拍数 ≥ T1 真实长度 | ✓ |
| X（自选） | `duel-screen.ts:909` 去 `&& view.notStarted !== true`（幕布下对局键复活） | 启动屏死键守卫 | 1 failed：启动屏：加载没走完就点不动 | ✓ |
| Y（自选） | `duel-screen.ts:1268` `loadPct` 去量化（`return raw`） | 加载量化守卫 | 1 failed：加载进度**量化** | ✓ |

**无一处红出第二条** ⇒ 互斥构造无洞。注：A 的命中对象与 2026-08-08 主程初审时不同——初审实测 A **零红**（真发现·同路冗余裸防御），随后加的结构测试「A 闸独立咬合」即本次命中者，闭环成立。

## 二、施工方自判三处 CONCERNS 的处置

| # | 自判 | 实证结论 | 处置 |
|---|---|---|---|
| 1 | S2-4 `capability-plan.md` 缺「心态机」消费点 | **属实（范围尾时）**：`git show 1f98741d:…capability-plan.md \| grep -c 心态` = 0。**已消**：`891f33d8`（同日 14:57）补了 §能力表 36-37 两行，与实现逐项对得上（`State{fsmId:'ai.mood'}`·四条互斥 `EventWhen`·`Effect{set-state}`·`Effect.chance` 概率表） | 已消·S2 不卡 |
| 2 | S4-12 递归复核/八问 v5 后没重跑 | **属实（范围尾时）·大头已消**：对齐单「第 4 轮（2026-08-08·v5 后重跑）」在案——playthrough 33/33（今 41/41）、spec-recursion 12 条款 0 裸奔、好玩三问 v5 重答（含四打法整局 sim 定量表·顺手逮出 `MASTER_PATCHES` 反转真 bug→`891f33d8`）。**残留**：八问是第 2 轮（v5 前）答的，v5 后未逐条重答；v5 唯一新屏=启动屏，其归属/时效面在三问②有覆盖，风险低 | 已消（残留记非阻断）·**但见 F1：递归尺子今天又被打过期** |
| 3 | S5-15 `/check-ui` 没跑新屏 | **属实且仍开着**：`tools/audits/` 只有对局屏一份审计（clash 态），startScreen 无入口。我代跑两屏（对局屏在档审计 + 临时 startScreen 审计·跑完即删）——**双双 exit 1**，详见 F2 | 未消·计入 S5 CONCERNS |

## 三、复查新发现（导航单外·按分级）

### F1 ·（非阻断于本范围·**S4 再 bless 前必修**）spec-recursion 尺子在 HEAD 过期

`npx vite-node scripts/game108-spec-recursion.mjs` → **exit 1**：
`✗ 锚点未命中（脚本过期，不是条款没守卫）：R-108-30/32 AI 只在对应时区动手（相位门）——找不到 “when: { kind: 'and', of: [{ kind: 'flag', id: DECIDE_GATE }, when] },”`。
归因（git -S 实查）：该锚点串 `abe8e490`（范围内）引入、**`eeaeda8a`（2026-08-15·范围外）改走**，尺子（末次更新 `891f33d8`）没跟——正是对齐单里点过名的「改了游戏没改尺子」形状，这回轮到尺子自己。范围内该项当时绿（第 4 轮记录 12 条款 0 裸奔）。**处置**：开给 game108 session 修尺子（补新锚点），修好前 S4 复查停在 CONCERNS。

### F2 ·（非阻断·**须 PUI 裁定后 S5 才可升 PASS**）ui-audit 两屏皆红，且在案假阳台账已过期

- 对局屏（在档审计）：exit 1，**15 处硬性低对比·全部 ratio=1.5**（`你`/`复读机`/相位标签/六槽读数/`烟雾 ×2`/石板铭文等）+ 4 处 3.64 警告。
- startScreen（临时审计·`view.notStarted=true, bootMs=60000`·跑完已删）：exit 1，**0 重叠**，17 处硬失败=上述 15 + `start-t「拳律」ratio=1.5`；另 `start-s` 副标 3.64 警告、华丽度 ⚠（glass:1·无 house 主题——本作走 `.dc.html` 设计稿 1:1 复刻线，属「明确美术方向」例外，记注不记罪）。
- **假阳证据**：这些文字在真渲染截图（`probe/S3-render.png`·`S4-play-2-charged.png`，我亲阅）里全部清晰可读——墨字压 `plate()` **data-URI 贴图底**，审计解析不了图片实底、落到近黑页底 ⇒ 1.5。与审计文件头在案的 hero 键假阳（6 处 @1.12）同类**但台账已对不上**（此次 15 处 @1.5、hero 键反而消失——`ui-audit.mjs` 后续被 PUI 改过的旁证）。
- **处置**：game108 不得自宣假阳。报 PUI 重立基线（工具解析 plate 实底，或重写在案 skip 台账），落定前 S5 停在 CONCERNS。

### F3 ·（非阻断）S3 点击门里 `key-menu` 是静默噪声位

`S3-click-gate.json`：7 控件里唯 `key-menu` `changed:false`。根因链（读码实证）：启动幕布 `start-veil` 盖屏时 `key-menu` **仍带 `action`**（`duel-screen.ts:460`——对局键在 `:979` 会摘 action，齿轮键不摘）⇒ 探针点它被幕布挡、`page.click` 2s 超时**被 `.catch(()=>{})` 吞掉** ⇒ 记为「点了没变」，而门只在 `changed===0` 才红。「点不到」与「点了死键」在此探针下不可分辨。**处置**：建议 ① `key-menu` 在 `notStarted` 时同样摘 action（与「幕布下一律真禁用」的定稿口径对齐）② 探针把 click 超时与「点中没变」分开记账。菜单本身非死键（`game108.ts:575` handler 在·历史 `S5-menu-*.png` 目击·非本轮复验点）。

### F4 ·（非阻断·前审已记账）剧本 10 的实质改动与「只动 tick」自陈不符

全 11 本剧本 diff 亲核：注释与 tick 外**恰一行**实质改动——`10-master-rewrites-table` 加 `{ "signal": "throw.rock", "by": "p2" }`（显式代发大师出招，把「判定表测试」与「AI 行为」脱钩）。断言零改动、理由正当且注释在案；但导航单自陈「没动任何断言·非改语义」**漏报了这一行**。2026-08-08 主程初审已记「诚实性偏差一笔·改动照准」，本次独立复核**结论一致**，不再另立账。

### F5 ·（记注）杂项

- `ec6794a9` 碰了 `docs/workflow/requests.md`（开 REQ-UIFX 引擎单）——不在导航单「改动面」栏里；开单走池是正当工作流，记导航单漏列，非越界。
- 导航单笔误：`Effect.chance` 消费方实在 `src/skills/tier2/effect-apply.ts:123`（单写 tier1）；「60 测试」现为 94（后续提交增补）。
- `probe/S5-menu-*.png`、`S5-lang-*.png` 系历史脚本产物，现无脚本再生成（probe 目录不进指纹故长存）——将来不要当「新鲜证据」引用。
- 读告警（全程 stderr）：game108 单跑 vitest/acceptance/playthrough/各 gate **stderr 全净**；全量 scoped-gate 里两处**非 game108** 噪声——① `ART-LEDGER-GUARD: WARN`（game-a `art-03`、game-c `art-017` 死账·game108 行 0/0/0）② happy-dom `ECONNREFUSED 127.0.0.1:3000` ×8（他游戏测试面）。无 topological-sort 环告警。
- S5 机器门自带 ⚠「无标准照基准·未比对」——**golden bless 是人门项，未代签**，留 owner/主程。

## 四、复查门落账说明

- 四关 `review` 落账已按 §五以 `--by 独立复查人agent` 写入 `pipeline.json`（S2 PASS·S3 PASS·S4 CONCERNS·S5 CONCERNS @ gameHash `cad74767ecca25b9`），随本判词同提交。**主程 2026-08-08 的四条初审判词被此覆盖**，原文完整保存在 git 历史（`git show 0e72bdfe:public/games/game108/pipeline.json`）；本次结论与初审逐条对得上（S2 缺口→已消故升 PASS·S3 同 PASS·S4 初审那笔诚实性偏差=本次 F4·S5 因 F2 由 PASS 降 CONCERNS——降级事由是初审后 PUI 改了审计工具，非初审误判）。终审若另有判词，直接重跑 `review` 覆盖即可。
- 机器门证据（`gate S2–S5` 的新鲜绿 + probe 刷新）同提交——那是我复跑的真产物。
- **未签任何 signoff**；S5 人门、golden bless、S2 复查升级后的下一步（`board` 指向 S7 评分卡）全部留人。

## 五、给下一步的清单（不代做·只列）

1. 【game108 session】修 `scripts/game108-spec-recursion.mjs` 的 R-108-30/32 锚点（F1）→ 绿后 S4 复查可升 PASS。
2. 【PUI】ui-audit 对 `plate()` 贴图实底的解析/skip 台账重立（F2）→ 落定后 `/check-ui` 归零、S5 复查可升 PASS。
3. 【game108 session·小】`key-menu` 在 `notStarted` 时摘 action；点击探针分账 click 超时（F3）。
4. 【owner/主程】S5 人门签字 + golden bless（S5 机器门 ⚠ 消除）。
