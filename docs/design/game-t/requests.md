# game-t《墨消》· 游戏级工单池（工单随游戏走·不占引擎池槽）

> 用法同主池（`docs/workflow/requests.md` 规则头）：GD-T/PE-T 的 bug/平衡/演出/内容单写这里；**引擎缺口不写这里**——提到主池给 Lead 裁决。已完结条目就地标 done 加 commit。
> 关联引擎单（主池·Lead 域）：`REQ-INPUT-拖拽交换`（✅ 已落地待 Lead 对抗性验收）、`REQ-M3-三期`（①LayerCell 层视图 ②锦鲤 ③朱印二次钤印 ④MatchBoardView 手感层·挂起待 owner 拉起）。

## 待处理 / 进行中

### REQ-GDT-CONTENT-教学关特殊棋子人工核验（待 PE-T·低）
- 关 3/7/12 为特殊棋子教学关（4 连卷轴 / L-T 朱印 / 5 连太极），levels.jsonc 已用摆盘埋「破 N」定色格。
- **交接点**：装配后需在真机人工核验「前几步必现对应特殊棋子」（sim 只验平衡·不验教学触达）。核验通过后本条标 done。
- PE-T 注记（2026-07-16）：可再补机器化核验（vitest 按预期交换步走一遍·断言特殊棋子生成——确定性可测）；随下一批玩法测试做。

### REQ-GDT-BAL-关18微调候选（观察·极低）
- 蛇师父考验关 18 在 200-seed 复核 68.5%（目标带 70-85% 下沿外 1.5pp·师父考验属允许 spike）。属可接受项，先记档。
- 若上线数据偏难：`scripts/game-t-levels.gen.ts` 内该关 `d0`/意图微调后 `vite-node scripts/game-t-levels.gen.ts` 重跑 + balance-sim 复核即可。

### REQ-GDT-ART-台账推导脚本（待起·低·= capability-plan §4.5）
- 照 game-q 样板起 `scripts/game-t-art-requirements.mjs`（mergeLedger 保号），需求稿=gdd §六（约 38 件）。GD/PE 落地时建。

### T-002 · 视图过渡态记账（等引擎三期·点选先行） · [2026-07-16] · PE-T · status: open（阻塞在主池 REQ-M3-三期①④）
> ①落地前的**临时观感**（全在 game-t 数据/宿主内·非引擎债）：特殊棋子无专属外观（卷轴/朱印/太极显为本色珠）；墨渍=静态底衬不随洗净刷新、冰纹瓷 hp 变化无视觉（进度看 HUD 活计数）；选中格无高亮（底栏文案提示「已选 r行c列」）；消除为瞬消无缓动。**引擎单落地后 PE-T 接线并销本条。**
> ②拖拽交换：`t2-match3-drag-swap` 已下沉（2026-07-16·**待 Lead 对抗性验收**）——验收过后 PE-T 接入（手势产同名 `pick` 信号即插即用·sim 零改动·Clickable 点选路保留）。

### T-003 · 引擎缺口候选（报 Lead 评审·先重组后下沉·勿在游戏层自造） · [2026-07-16] · PE-T · status: open（待 Lead 裁决是否立主池单）
> ① **连锁计分倍率**：GDD §四「连锁每级 ×1.5」——`t3-match3-board` 今日只有平铺 `coinPerTile`；骨架先平 60 分/珠（GD 定标已按此口径 sim，改倍率需连表重定标）。候选=config 加 `chainScoreScale?`（缺省 1=字节不变）。
> ② **「棋盘已稳定」可判条件**：终局结算窗现用定值 SETTLE_TICKS=420 兜底（Condition 读不到 MatchBoard.phase）——候选=board 写 settled Flag/Resource（数据可判·回放安全）。
> ③ **audit 工具债（转 Lead/工具域）**：`game-skill-audit` 对宿主容器 createElement 计 anyRed → 退出码 1——S5 机器门对**一切**编译期宿主游戏恒红（game-q 同判）。基线棘轮已管住增量；建议=基线内红旗不计 anyRed 或宿主骨架白名单，Lead 裁。
> ③b **ui-audit 盲区回报（PUI 域·同 REQ-STYLESET M0.5 遗留①家族）**：/check-ui 走查 game-t 三屏（audit 入口 `tools/audits/game-t-{hud,select,result}.audit.ts`·440×780）——重叠 0；文字对比经「实底纸面化」整改后全过（glass→实底 Panel·直坐 Screen 文字包卡·color 显式 text 令牌——顺带修掉 5 处真实低对比 2.65-2.77）；**残留硬失败仅 ghost 糖果皮按钮 ratio=1.21 ×5**（border-image 皮审计不可见→按宣纸底误算；真渲=白字压深绿糖体可读·截图为证）=M0.5 Lead 验收已定性的工具债，等 PUI 修 ui-audit 后本三入口即归零。另报：pageBg 渐变/texture/glass 无 backgroundColor → 审计按深兜底算亮皮对比（同族·本次以实底纸面绕开且观感更优）。
> ④ **sim 纯函数出口**：`resolveClear/classifySpawns` 未在 `skills/tier3/index.ts` 桶出口——GD sim 已直接 import `match3-board.js` 跑通；要不要补桶出口=Lead 一行裁决。

---

## 已完结（就地归档·带 commit）

### ✅ REQ-GDT-关卡表落地（GD-T 交付·2026-07-16）
- 交付：`levels.jsonc`(30 关·schema 校验过) + `scripts/game-t-balance-sim.ts`(确定性 bot·**复用引擎纯函数·零漂移**) + `game-t-levels.gen.ts`(意图→摆盘→定标) + `balance-report.md`(200 seeds·29/30 带内) + `copy.md`(关名/文案/招式/音效)。
- 定标口径 = level-schema §二 / gdd §四：moves=bot 中位步×裕度(1.4→1.1)；量级调至通关率入带；stars=1★达标线 / 2★P50 / 3★P85。
- 零漂移由 `scripts/game-t-balance-sim.conformance.test.ts` 驱动真 capability(World) 断言(终盘+产料+果冻+障碍逐一对齐)。
- 复现：`vite-node scripts/game-t-levels.gen.ts` → `vite-node scripts/game-t-balance-sim.run.ts --seeds=200 --report`。

### ✅ T-001 · PE-T 骨架装配领工声明（边界栏·复查门范围核查用） · [2026-07-16] · PE-T（本条=施工记录）
> **owner 启动词**：「角色=PE-T·任务=game-t《墨消》装配。第一动作=建游戏壳（优先纯数据卡带）→ concept 立 S1 → 八阶段接力；S3 用点选先行；可以有 TS 代码，但要克制。」
> **壳形态裁决（PE-T 评审·plan §4/§6 已落档）**：cart（`library/`·gitignored 用户数据）无法 git 接力多 session；builtin manifest 今日无 LayoutNode UI/多关流程表达 → **编译期薄壳（game-q 同款纪律）**，规则 0 行进 TS。
> **碰过的文件（边界）**：`src/games/game-t/**`（新建 8 文件·域内）；`src/launcher.tsx` GAMES 表 + `src/launcher/game-runner.tsx` loaders **各 1 行**（每游戏一行的既有注册点·🔶 知会：launcher 归 PST——如需改口径请 PST 裁）；`scripts/audit-baseline.json` 加 game-t 行（审计工具自身要求「新游戏请加入」·createElement:5=game-q 宿主先例同款）+ `scripts/audit-ratchet.test.mjs` 守卫清单同步 9 款；`tools/audits/game-t-*.audit.ts` ×3（/check-ui 仪式入口·同 game-q-hud 先例）；`docs/design/game-t/{capability-plan,requests}.md`。**引擎域零触碰。**
> **交付物**：骨架壳 + 走查 11 测（合法换/非法弹回/胜链/负链/确定性 hash/HUD validate 零 issue）+ 真浏览器截图 3 张（选关长卷/棋盘/交换后）+ 生产板 S1/S3/S4 机器门绿。

### ✅ T-004 · GD-T 30 关表接入（原「待 GD-T 交付接力位」·GD 表到货即接） · [2026-07-16] · PE-T
> `levels.jsonc`(30 关) + `copy.md` 关名接入运行时：`src/games/game-t/levels.data.json`（运行时纯 JSON 副本）+ **防漂移守卫测试**（断言 data.json ≡ docs/levels.jsonc 解析结果·GD 重定标忘同步即红）。PE 占位 5 关退役。