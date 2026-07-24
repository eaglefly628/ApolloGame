# game102 · S4「完成」对账表（GD 出给 PE · 2026-07-24）

> 用途：一次补齐 S4 到「可宣布完成」。判词=`node scripts/game-pipeline.mjs board game102` 该行全绿。
> 底线：adapter=**纯接线零规则·不改剧本**（剧本错=GD 改）；连锁/激光**撞墙回 `requests.md` 报缺口·绝不游戏层自写 flood/aim**。

## A. 先补真门 blocker（P0·REQ-G102-ADAPTER）
- [ ] 落 `src/games/game102/acceptance-adapter.ts`（薄适配·契约见 `acceptance/README.md`）
  - 动作词表→引擎 action：`tapSupply:<color>` / `tapSupply:rainbow|chain` / `useSpecial:laser` / `aim:col|row:<i>` / `tapSlot:<i>` / `tick:<n>`
  - 机读态→投影：`remain.<color>` `remain.total` `keys` `doorOpen` `score` `combo` `conveyor.count` `tray.count` `flow`(playing/victory/defeat)
- [ ] `npx vite-node scripts/acceptance-run.mjs --game game102` 能跑（进 `scripts/acceptance.test.mjs` 门禁）

## B. 8 份验收剧本逐条过（`acceptance/01~08`）
**即刻应绿（核心已实现）**
- [ ] 01 基础消色（连喷清同色·清空 victory）
- [ ] 02 弹尽入槽 + 点槽复用装填
- [ ] 05 限额用尽仍有像素 → defeat

**需对应玩法落地才绿（缺则先标 pending·不算红）**
- [ ] 04 突破 5→10（快连切容量·conveyor.count 到 6）——核对 burst 已接
- [ ] 03 钥匙开门（关型变体·gdd §2.4）——集齐钥匙→doorOpen→victory
- [ ] 06 彩虹炮（matchAny 命中任意色）—— 依赖 REQ-G102-SPECIAL ①（纯数据·先做）
- [ ] 07 连锁炮（flood 清连通同色）—— REQ-G102-SPECIAL ②·**撞墙报缺口候选 `flood-clear`**
- [ ] 08 激光炮手动（aim→清列同色）—— REQ-G102-SPECIAL ③·**撞墙报缺口候选 `aim-target`**

> 06~08 属 REQ-G102-SPECIAL；本表只要求「adapter 就绪 + 01/02/05 绿 + 03/04 就绪或 pending 标注」即达 S4 完成线，特殊炮可随该单并行/后续。

## C. 走门（八阶段·完成判词）
- [ ] **S4 机器门**：`node scripts/game-pipeline.mjs gate game102 S4`（=game102 vitest 绿 + 验收剧本 conformance 绿）
- [ ] **S4 复查门**：另开 session `checklist game102 S4` → 对抗核证 → `review game102 S4 --verdict pass --note … --by 复查人`
- [ ] **S4 人门**：`signoff game102 S4 --note "试玩签·附真浏览器截图序列" --by <owner/Lead>`（不许代签）
- [ ] 顺带 **S5 UI**（PUI 已实装）：`/check-ui` + `gate game102 S5`（game-skill-audit 红旗零）+ signoff
- [ ] **S8 终检**：`gate game102 S8`（tsc + vitest + build 三绿·证据绑 git HEAD+净树）

## D. 前置（owner·非 PE）
- [ ] 立项卡：`node scripts/game-pipeline.mjs concept game102 --name "色流工坊 / Pixel Pour" --pitch "…"`（S1 解锁·board 现卡此）

## 完成定义
`node scripts/game-pipeline.mjs board game102` → S4 行三门全绿（机器+复查+人）。未全绿只许说「做到 SN」。
