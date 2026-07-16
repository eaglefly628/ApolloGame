# game-t《墨消》· 游戏级工单池（工单随游戏走·不占引擎池槽）

> 用法同主池（`docs/workflow/requests.md` 规则头）：GD-T/PE-T 的 bug/平衡/演出/内容单写这里；**引擎缺口不写这里**——提到主池给 Lead 裁决。已完结条目就地标 done 加 commit。
> 关联引擎单（主池·Lead 域）：`REQ-INPUT-拖拽交换`、`REQ-M3-三期`（①LayerCell 层视图 ②锦鲤 ③朱印二次钤印）。

## 待处理 / 进行中

### REQ-GDT-CONTENT-教学关特殊棋子人工核验（待 PE-T·低）
- 关 3/7/12 为特殊棋子教学关（4 连卷轴 / L-T 朱印 / 5 连太极），levels.jsonc 已用摆盘埋「破 N」定色格。
- **交接点**：装配后需在真机人工核验「前几步必现对应特殊棋子」（sim 只验平衡·不验教学触达）。核验通过后本条标 done。

### REQ-GDT-BAL-关18微调候选（观察·极低）
- 蛇师父考验关 18 在 200-seed 复核 68.5%（目标带 70-85% 下沿外 1.5pp·师父考验属允许 spike）。属可接受项，先记档。
- 若上线数据偏难：`scripts/game-t-levels.gen.ts` 内该关 `d0`/意图微调后 `vite-node scripts/game-t-levels.gen.ts` 重跑 + balance-sim 复核即可。

### REQ-GDT-ART-台账推导脚本（待起·低·= capability-plan §4.5）
- 照 game-q 样板起 `scripts/game-t-art-requirements.mjs`（mergeLedger 保号），需求稿=gdd §六（约 38 件）。GD/PE 落地时建。

---

## 已完结（就地归档·带 commit）

### ✅ REQ-GDT-关卡表落地（本次交付）
- 交付：`levels.jsonc`(30 关·schema 校验过) + `scripts/game-t-balance-sim.ts`(确定性 bot·**复用引擎纯函数·零漂移**) + `game-t-levels.gen.ts`(意图→摆盘→定标) + `balance-report.md`(200 seeds·29/30 带内) + `copy.md`(关名/文案/招式/音效)。
- 定标口径 = level-schema §二 / gdd §四：moves=bot 中位步×裕度(1.4→1.1)；量级调至通关率入带；stars=1★达标线 / 2★P50 / 3★P85。
- 零漂移由 `scripts/game-t-balance-sim.conformance.test.ts` 驱动真 capability(World) 断言(终盘+产料+果冻+障碍逐一对齐)。
- 复现：`vite-node scripts/game-t-levels.gen.ts` → `vite-node scripts/game-t-balance-sim.run.ts --seeds=200 --report`。
