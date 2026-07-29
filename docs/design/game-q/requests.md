# game-q 需求单（游戏域工单）

> 2026-07-15 立（owner 拍板「工单随游戏走·游戏可暂停」）：本游戏的 bug/玩法/演出/平衡工作票在此，
> 域主（程序/PE/design）自取自结，**不占主池 10 槽**（主池 `docs/workflow/requests.md` 只管引擎本身）。
> 标「控件缺口/引擎收编」的条目=引擎域候补——落地须走主池腾槽或 capgap 通道，游戏层不得自造。
> done 迁 `docs/workflow/requests-archive.md`；3D 线仍在 `docs/workflow/requests-3d.md`。

---

### REQ-Q-击杀记账（on-kill credit）· 塔防赏金/击杀计分通用缺口 · [2026-07-07] · LEAD（game-q 立项）→ Lead 排期 · status: **open（真缺口·已记债·循环层用清波经济绕过·非阻塞）** · 类型: 通用战斗能力下沉候选
> **缺口**：`t2-hitbox` 只写**目标本地**资源（`hitbox.ts` `queueResourceMod(...,'local')`）；`t2-mortal` 的 `dropTemplate` 对**任何死因无差别**触发。→ 无法用单个 Mortal 区分「被塔击杀→给全局/攻击者记赏金」与「抵达大本营漏怪→扣命·不发赏金」。这是塔防经济（逐怪赏金）唯一表达不了的点，也是**击杀计分/连击表/赏金**一类通用需求的共性缺口（非塔防专属）。
> **game-q 现绕法（已落地·不依赖本单）**：经济走「开局金 + 清波奖金（timeline resource-cue / `effect-apply` on `timeline:done:<wave>`）+ 波中缓速涓流」——全组合现有能力、确定性、无缺口依赖；逐怪赏金暂缓。
> **建议下沉（待 Lead 排期·勿抢跑）**：择一——① `Hitbox.creditResource:{id,amount,scope:'global'|'caster'}`：命中/致死时给具名全局或攻击者（`PrefabOrigin.source`）资源记账；② `Mortal` 按致死资源/tag 分支 `dropTemplate`（塔杀 vs 漏怪不同掉落）。落地后 game-q 逐怪赏金 + 击杀计分一并干净接入。**证明它的测试**：塔杀敌→gold+N；漏怪→lives−1 且 gold 不变。
> **裁决记录**：game-q 能力总览已 ✅（`docs/design/game-q/capability-plan.md §6`）——本单是其唯一记债项，不阻塞 game-q 出货。

### REQ-Q-壳件迁移 · 换用引擎公共壳三件（host-runloop / game-art-load / local-store） · [2026-07-29] · Lead 派单（引擎池 `REQ-SHELL-公共壳三件` 已落地）→ **指派：PE-Q** · status: open · 类型: 壳层去重（render-only·观感零变化）
> **件已在库**（带测·引擎侧同日落地）：`@engine/host/run-loop.js` `createRunLoop` · `@assets/index.js` `createArtAssets`/`loadGameArtInto` · `@services/persist/index.js` `localStore`/`flagCodec`。
> **本游戏替换点**（file:line = 2026-07-29 基线）：
> - `game-q.ts:87-110`（refreshHud 的 lastSig 差分 + 局终 overlay 挂摘 + 冻结）+ `112-167`（startSim/stopSim/restart）→ 合并成一个 `createRunLoop({ create, engineOf, read, sig, paint, over, overlay, dispose })`；`syncAudio` 照旧在 paint 里自理（本件不管音频）。
> - `game-q.ts:115-125`（皮肤索引 fetch 那 8 行）→ `const skinAssets = createArtAssets(); void loadGameArtInto(skinAssets, 'game-q');`
> - `sounds.ts:20-25`（静音位 `apollo-q-sfx-mute`）→ `localStore('apollo-q-sfx-mute', false, flagCodec)`——'1'/'0' 字节兼容，老玩家静音偏好不丢。
> **顺带修一个真 bug**：`game-q.ts:104` 在 subscribe 回调里**同步**调 `engine.stop()`，被 `src/runtime/engine.ts:70-80` 的「notifyListeners 之后才重挂 RAF」覆盖（=BUG-04·`game-103.ts:93-96` 已记档），**局终其实没冻结**。`createRunLoop` 的冻结默认延到 microtask，迁移即顺手修好（这也是本次迁移唯一有意的行为变化）。
> **验收**：观感/交互零变化（除上条冻结）+ game-q vitest 绿 + `node scripts/scoped-gate.mjs --run` 全绿。红线：不碰 sim/蓝图/hash 面，不趁迁移改玩法。
