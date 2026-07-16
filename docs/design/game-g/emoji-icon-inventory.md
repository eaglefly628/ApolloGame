# game-g · emoji 图标清单（当图标用的 emoji 字形 → 待转 Image 槽）

> PA 审计产出（`node scripts/emoji-audit.mjs game-g --md`·可重跑）。**456 处 emoji 图标 · 74 种 · 29 个运行时 UI 文件。**
> 这些 emoji 写在 LayoutNode **文本**里=不是 Sprite/Image 美术槽 → T2 台账 derive 抓不到、管线换不了。
> **给 game-g/PE**：照本单把要美术化的 emoji 从「文本字形」改成「带 skinKey 的 `Image` 控件槽」，台账重跑即可纳入生成管线。

## 一、按 emoji（种类 · 次数 · 代表 · 位置）

| emoji | 次数 | 出现文件数 | 代表（看样例上下文） | 样例位置 |
|---|---|---|---|---|
| ♠ | 50 | 12 | `const SUIT_NAME: Record<string, string> = { '♠': '黑桃', '♥': ` | collection-screen.ts:22 |
| ♥ | 41 | 11 | `const SUIT_NAME: Record<string, string> = { '♠': '黑桃', '♥': ` | collection-screen.ts:22 |
| ♦ | 39 | 11 | `const SUIT_NAME: Record<string, string> = { '♠': '黑桃', '♥': ` | collection-screen.ts:22 |
| ♣ | 37 | 11 | `const SUIT_NAME: Record<string, string> = { '♠': '黑桃', '♥': ` | collection-screen.ts:22 |
| ★ | 34 | 11 | `const stars = (n: number): string => '★'.repeat(n) + '☆'.rep` | campaign-screen.ts:18 |
| ⚔ | 28 | 11 | `{ type: 'Label', id: `camp-${c.stage}-bl-mid`, props: { text` | campaign-screen.ts:48 |
| 💎 | 21 | 6 | `type: 'Panel', id: 'ench-slot-box', props: { title: `💎 镶嵌槽 ` | craft-screen.ts:58 |
| 🎴 | 20 | 8 | `{ flag: 'seen_combat_draw_pk', anchor: 'combat-draw', text: ` | battle-coach.ts:15 |
| 🪙 | 17 | 7 | `<div class="gg-coin-btns">${opts.winnerMine ? '<button class` | coin-flip.ts:47 |
| 💧 | 11 | 3 | `{ type: 'Label', id: `pcb-s-${hero.id}`, props: { size: 'sm'` | deck-screen.ts:54 |
| 🎲 | 10 | 4 | `{ flag: 'seen_combat_roll', anchor: 'combat-roll', text: '👉` | battle-coach.ts:21 |
| ⚡ | 10 | 6 | `props: { size: 13, color: 'sub', spans: [{ text: '⚡ 明牌天罡（cou` | campaign-screen.ts:66 |
| 👉 | 8 | 1 | `{ flag: 'seen_combat_draw_tg', anchor: 'combat-draw', text: ` | battle-coach.ts:14 |
| 🛡 | 8 | 3 | `props: { title: `🎴 ${f.name} · ${f.kind}`, sub: `${f.effect` | collection-screen.ts:167 |
| 🧩 | 7 | 3 | `iconPill('tb-shard', 'shard-dizhi', '🧩', String(view.dizhiS` | lobby-dd.ts:72 |
| 🀄 | 6 | 4 | `type: 'Panel', id: 'ench-pick-box', props: { title: '🀄 卡包地支` | craft-screen.ts:82 |
| 🛒 | 5 | 4 | `else pickKids.push({ type: 'Button', id: 'ench-getdizhi', pr` | craft-screen.ts:77 |
| ⚖ | 5 | 2 | `if (ev.tie) extras.push(ev.tie === 'power' ? '⚖ 掷平 → 战力高者胜' ` | game-g-clash-view.ts:52 |
| 📖 | 5 | 3 | `{ type: 'Button', id: 'home-man', props: { label: '📖 玩法手册',` | home-screen.ts:92 |
| ⚙ | 5 | 3 | `iconPill('tb-settings', 'settings', '⚙', '', 'settings'),` | lobby-dd.ts:76 |
| 🔒 | 4 | 3 | `const badge = locked ? '🔒 未解锁' : isCur ? '▶ 当前' : cleared ?` | campaign-screen.ts:25 |
| 🔶 | 4 | 2 | `iconPill('tb-shardtg', 'shard-tiangang', '🔶', String(view.t` | lobby-dd.ts:73 |
| ♟ | 3 | 2 | `{ flag: 'seen_combat_deploy', anchor: 'combat-deploy', text:` | battle-coach.ts:19 |
| 📊 | 3 | 3 | `props: { title: `🎴 ${f.name}`, sub: nums ? `${f.desc} · 📊 ` | campaign-screen.ts:59 |
| 🏆 | 3 | 2 | ``<h2>🏆 终局 Boss</h2><div class="bigrank" style="color:var(--` | game-g.tsx:141 |
| 💢 | 3 | 2 | `const nail = document.createElement('div'); nail.textContent` | game-g.tsx:426 |
| 🔴 | 3 | 1 | `'⚔ 掷命预报（落子前就看得见）：两军前锋将要相遇的那一路，棋盘上会在你前锋头顶浮出「档位词 + 具体胜率%」，让你开战` | overlays.ts:52 |
| 🎓 | 3 | 2 | `{ type: 'Toggle', id: 'set-guide', props: { label: '🎓 新手引导'` | overlays.ts:104 |
| ⚠ | 3 | 3 | `{ type: 'Button', id: 'set-reset', props: { label: '⚠ 重置所有数据` | overlays.ts:108 |
| ☆ | 2 | 2 | `const stars = (n: number): string => '★'.repeat(n) + '☆'.rep` | campaign-screen.ts:18 |
| 💀 | 2 | 2 | `{ type: 'Label', id: `camp-${c.stage}-bl-lose`, props: { siz` | campaign-screen.ts:49 |
| 🎯 | 2 | 2 | `props: { size: 13, color: 'ok', spans: [{ text: '🎯 克制：', bo` | campaign-screen.ts:68 |
| 🔨 | 2 | 1 | `type: 'Modal', id: 'ench-modal', props: { title: `🔨 附魔 · ${` | craft-screen.ts:87 |
| 🔥 | 2 | 2 | `{ name:'🔥 火·燎原', members:'寅虎+午马+戌狗', effect:'赢对决后连推 1 次 + 破` | dizhi-data.ts:40 |
| 🎉 | 2 | 2 | `{ type: 'Label', id: 'gg-btw-title', props: { text: '🎉 战间整备` | game-g.tsx:303 |
| ♔ | 2 | 2 | `if (fate === 'glory') { const crown = document.createElement` | game-g.tsx:439 |
| ☠ | 2 | 2 | `log(`  · 预报我方胜率 ${Math.round(e.winrate * 100)}%${e.tie ? `　掷` | game-g.tsx:649 |
| 📋 | 2 | 1 | `const dbgBtn = el('div', 'position:absolute;left:10px;bottom` | game-g.tsx:890 |
| 📚 | 2 | 2 | `iconPill('tb-man', 'manual', '📚', '手册', 'man', 'accent', un` | lobby-dd.ts:75 |
| 🟢 | 2 | 1 | `easy: { title: '🟢 初级 · 打赢第一场', color: 'ok', paras: [` | overlays.ts:45 |
| 🟡 | 2 | 1 | `mid: { title: '🟡 中级 · 三牌组 + 经营', color: 'warn', paras: [` | overlays.ts:50 |
| 📜 | 2 | 1 | `{ type: 'Tabs', id: 'help-tabs', props: { tabs: [tab('intro'` | overlays.ts:81 |
| 🔊 | 2 | 2 | `{ type: 'Toggle', id: 'set-sfx', props: { label: '🔊 音效', ch` | overlays.ts:102 |
| 🎵 | 2 | 2 | `{ type: 'Toggle', id: 'set-bgm', props: { label: '🎵 背景音乐', ` | overlays.ts:103 |
| 🗣 | 1 | 1 | `{ type: 'Label', id: `camp-${c.stage}-bl-open`, props: { tex` | campaign-screen.ts:47 |
| 🔮 | 1 | 1 | `props: { text: '🔮 关 6–52（孙武 · 成吉思汗 · 汉尼拔……）战役背景与 Boss 对白已入库` | campaign-screen.ts:93 |
| 🗃 | 1 | 1 | `: { text: `🗃 天罡牌 · 收藏 ${ownedT}/${view.tiangangs.length}（到「` | collection-screen.ts:196 |
| 🎖 | 1 | 1 | `type: 'Panel', id: 'deck-selector', props: { title: `🎖 我的出战` | deck-screen.ts:28 |
| 🌊 | 1 | 1 | `{ name:'🌊 水·灵动不败', members:'申猴+子鼠+辰龙', effect:'整局 1 次必重掷（用掉` | dizhi-data.ts:39 |
| 🌿 | 1 | 1 | `{ name:'🌿 木·生生', members:'亥猪+卯兔+未羊', effect:'阵亡回手牌可重新派遣 + 击` | dizhi-data.ts:42 |
| 📌 | 1 | 1 | `const nail = document.createElement('div'); nail.textContent` | game-g.tsx:426 |
| 💚 | 1 | 1 | `if (b4 != null && now < b4) { const back = Math.round((b4 - ` | game-g.tsx:466 |
| 📍 | 1 | 1 | `battleTl.delay(pT(walkTicks), () => { justMovedIds = new Set` | game-g.tsx:702 |
| 🛠 | 1 | 1 | `mounted?.update(); log(`🛠dev·全天罡到手牌(${GAME_G_TIANGANGS.leng` | game-g.tsx:913 |
| 🪟 | 1 | 1 | `type: 'Panel', id: 'launch-panel', props: { title: '🪟 大厅浮层 ` | overlays.ts:261 |
| 🐀 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐂 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐅 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐇 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐉 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐍 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐎 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐑 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐒 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐓 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐕 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 🐖 | 1 | 1 | `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂',` | turn-battle-screen.ts:23 |
| 👑 | 1 | 1 | `const bossTip = `<div class="gg-tip" style="width:210px;text` | turn-battle-screen.ts:211 |
| 👆 | 1 | 1 | `{ type: 'Label', id: `${cid}-tap`, props: { text: '👆', size` | turn-battle-screen.ts:291 |
| 🔇 | 1 | 1 | `tog('sfx', `${view.sfxOn ? '🔊' : '🔇'} 音效`, view.sfxOn, 'to` | turn-battle-screen.ts:609 |
| ♪ | 1 | 1 | `props: { label: (view.bgmIdx === i ? '♪ ' : '') + nm, kind: ` | turn-battle-screen.ts:617 |
| 👹 | 1 | 1 | `{ type: 'Label', id: 'shatip-n', props: { text: `👹 ${s.name` | turn-battle-screen.ts:682 |
| ⚑ | 1 | 1 | `{ type: 'Label', id: 'shatip-s', props: { text: used ? '⚑ 已发` | turn-battle-screen.ts:684 |
| ♺ | 1 | 1 | `const ACT: [string, string, string][] = [['draw', '🎴', '抽']` | turn-battle-screen.ts:838 |

## 二、按文件（哪屏 emoji 最多 → 优先转槽）

| 文件 | emoji 图标数 |
|---|---|
| `hero-codex.ts` | 76 |
| `turn-battle-screen.ts` | 66 |
| `overlays.ts` | 50 |
| `game-g.tsx` | 38 |
| `collection-screen.ts` | 35 |
| `home-screen.ts` | 21 |
| `economy-data.ts` | 17 |
| `portraits.ts` | 16 |
| `level.ts` | 15 |
| `campaign-screen.ts` | 14 |
| `craft-screen.ts` | 13 |
| `deck-screen.ts` | 13 |
| `lobby-dd.ts` | 12 |
| `battle-coach.ts` | 11 |
| `lobby-util.ts` | 8 |
| `game-g-build.ts` | 7 |
| `lobby-types.ts` | 7 |
| `game-g-clash-view.ts` | 6 |
| `coin-flip.ts` | 5 |
| `deck-data.ts` | 5 |
| `dizhi-data.ts` | 4 |
| `formation-data.ts` | 4 |
| `simulate-balance.ts` | 4 |
| `turn-combat.ts` | 4 |
| `clash-dice-3d.ts` | 1 |
| `clash-resolve.ts` | 1 |
| `combat-types.ts` | 1 |
| `game-g-save.ts` | 1 |
| `player-ai.ts` | 1 |

## 三、逐处明细（file:line · emoji · 上下文）


### `battle-coach.ts`

- `:14` 👉 — `{ flag: 'seen_combat_draw_tg', anchor: 'combat-draw', text: '👉 第一步【抽】：点【抽】，再点【✦抽天罡】——先摸一张`
- `:15` 👉 — `{ flag: 'seen_combat_draw_pk', anchor: 'combat-draw', text: '👉 再点【🎴抽扑克】——摸一张扑克兵牌（上场打仗用）。`
- `:15` 🎴 — `{ flag: 'seen_combat_draw_pk', anchor: 'combat-draw', text: '👉 再点【🎴抽扑克】——摸一张扑克兵牌（上场打仗用）。`
- `:16` 👉 — `{ flag: 'seen_combat_end1', anchor: 'combat-end', text: '👉 点【结束回合】：源泉 +1、双方兵线一起推进一格。', on`
- `:17` 👉 — `{ flag: 'seen_combat_cast', anchor: 'combat-cast', text: '👉 这一轮【打】→【✦打天罡】：施放刚摸到的天罡战法，整局为你`
- `:18` 👉 — `{ flag: 'seen_combat_end2', anchor: 'combat-end', text: '👉 再点【结束回合】，进入下一轮。', on: 'endturn`
- `:19` 👉 — `{ flag: 'seen_combat_deploy', anchor: 'combat-deploy', text: '👉 【打】→【♟部署扑克】：先点一张兵牌、再点一路（上`
- `:19` ♟ — `{ flag: 'seen_combat_deploy', anchor: 'combat-deploy', text: '👉 【打】→【♟部署扑克】：先点一张兵牌、再点一路（上`
- `:20` 👉 — `{ flag: 'seen_combat_end3', anchor: 'combat-end', text: '👉 再点【结束回合】：兵沿路前进，前锋相遇（碰撞）就触发【绝命对`
- `:21` 👉 — `{ flag: 'seen_combat_roll', anchor: 'combat-roll', text: '👉 前锋相遇进入【绝命对决】：点【🎲掷命】——双方各掷自己战`
- `:21` 🎲 — `{ flag: 'seen_combat_roll', anchor: 'combat-roll', text: '👉 前锋相遇进入【绝命对决】：点【🎲掷命】——双方各掷自己战`

### `campaign-screen.ts`

- `:18` ★ — `const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));`
- `:18` ☆ — `const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));`
- `:25` 🔒 — `const badge = locked ? '🔒 未解锁' : isCur ? '▶ 当前' : cleared ? '✓ 已通关' : '可重打';`
- `:47` 🗣 — `{ type: 'Label', id: ˋcamp-${c.stage}-bl-openˋ, props: { text: ˋ🗣️ 开场「${c.bossLines.open}`
- `:48` ⚔ — `{ type: 'Label', id: ˋcamp-${c.stage}-bl-midˋ, props: { text: ˋ⚔️ 劣势「${c.bossLines.mid}」ˋ,`
- `:49` 💀 — `{ type: 'Label', id: ˋcamp-${c.stage}-bl-loseˋ, props: { size: 'md', color: 'sub', spans: `
- `:53` 🎴 — `props: { text: '🎴 地煞（明牌 · 公平可破）', size: 'md', color: 'sub' } });`
- `:59` 🎴 — `props: { title: ˋ🎴 ${f.name}ˋ, sub: nums ? ˋ${f.desc} · 📊 ${nums}ˋ : f.desc, tone: 'norm`
- `:59` 📊 — `props: { title: ˋ🎴 ${f.name}ˋ, sub: nums ? ˋ${f.desc} · 📊 ${nums}ˋ : f.desc, tone: 'norm`
- `:66` ⚡ — `props: { size: 13, color: 'sub', spans: [{ text: '⚡ 明牌天罡（counter-pick 靶）：' }, { text: c.bo`
- `:68` 🎯 — `props: { size: 13, color: 'ok', spans: [{ text: '🎯 克制：', bold: true }, { text: c.counterT`
- `:71` ⚔ — `props: { label: ˋ⚔ 出征 · 第 ${c.stage} 关ˋ, kind: 'primary', action: 'play' } });`
- `:86` ⚔ — `props: { title: ˋ⚔️ 命运之战 · 战役进度 · 第 ${cur} / ${STAGE_CAMPAIGN.length} 关ˋ, scroll: true },`
- `:93` 🔮 — `props: { text: '🔮 关 6–52（孙武 · 成吉思汗 · 汉尼拔……）战役背景与 Boss 对白已入库，随章节逐步开放。', size: 'sm', color:`

### `clash-dice-3d.ts`

- `:67` 🎲 — `return null; // headless / 无 WebGL → 交给 🎲 emoji 占位`

### `clash-resolve.ts`

- `:22` ★ — `if (rank === 'JOKER' || rank === '★' || rank === '王') return 15;`

### `coin-flip.ts`

- `:44` ⚔ — `<div style="font-size:15px;font-weight:700;color:#ffd27a;margin-bottom:2px">⚔ ${esc(opts.w`
- `:47` 🪙 — `<div class="gg-coin-btns">${opts.winnerMine ? '<button class="gg-coin-btn throw">🪙 掷 硬 币<`
- `:68` 🪙 — `cap.innerHTML = ˋ<span class="gg-coin-res" style="color:${opts.heads ? '#43d07f' : '#9aa7b`
- `:68` ⚔ — `cap.innerHTML = ˋ<span class="gg-coin-res" style="color:${opts.heads ? '#43d07f' : '#9aa7b`
- `:68` 🪙 — `cap.innerHTML = ˋ<span class="gg-coin-res" style="color:${opts.heads ? '#43d07f' : '#9aa7b`

### `collection-screen.ts`

- `:22` ♠ — `const SUIT_NAME: Record<string, string> = { '♠': '黑桃', '♥': '红桃', '♦': '方块', '♣': '梅花' };`
- `:22` ♥ — `const SUIT_NAME: Record<string, string> = { '♠': '黑桃', '♥': '红桃', '♦': '方块', '♣': '梅花' };`
- `:22` ♦ — `const SUIT_NAME: Record<string, string> = { '♠': '黑桃', '♥': '红桃', '♦': '方块', '♣': '梅花' };`
- `:22` ♣ — `const SUIT_NAME: Record<string, string> = { '♠': '黑桃', '♥': '红桃', '♦': '方块', '♣': '梅花' };`
- `:37` ♠ — `const suitTags: LayoutNode[] = ([['all', '全部'], ['♠', '♠'], ['♥', '♥'], ['♦', '♦'], ['♣', `
- `:37` ♠ — `const suitTags: LayoutNode[] = ([['all', '全部'], ['♠', '♠'], ['♥', '♥'], ['♦', '♦'], ['♣', `
- `:37` ♥ — `const suitTags: LayoutNode[] = ([['all', '全部'], ['♠', '♠'], ['♥', '♥'], ['♦', '♦'], ['♣', `
- `:37` ♥ — `const suitTags: LayoutNode[] = ([['all', '全部'], ['♠', '♠'], ['♥', '♥'], ['♦', '♦'], ['♣', `
- `:37` ♦ — `const suitTags: LayoutNode[] = ([['all', '全部'], ['♠', '♠'], ['♥', '♥'], ['♦', '♦'], ['♣', `
- `:37` ♦ — `const suitTags: LayoutNode[] = ([['all', '全部'], ['♠', '♠'], ['♥', '♥'], ['♦', '♦'], ['♣', `
- `:37` ♣ — `const suitTags: LayoutNode[] = ([['all', '全部'], ['♠', '♠'], ['♥', '♥'], ['♦', '♦'], ['♣', `
- `:37` ♣ — `const suitTags: LayoutNode[] = ([['all', '全部'], ['♠', '♠'], ['♥', '♥'], ['♦', '♦'], ['♣', `
- `:108` ♠ — `['1', '同花顺王', '♠ 黑桃A', '♠ 顺子', '78%', '2880'], ['2', '红桃皇后', '♥ 红桃K', '♥ 火攻', '74%', '2710`
- `:108` ♠ — `['1', '同花顺王', '♠ 黑桃A', '♠ 顺子', '78%', '2880'], ['2', '红桃皇后', '♥ 红桃K', '♥ 火攻', '74%', '2710`
- `:108` ♥ — `['1', '同花顺王', '♠ 黑桃A', '♠ 顺子', '78%', '2880'], ['2', '红桃皇后', '♥ 红桃K', '♥ 火攻', '74%', '2710`
- `:108` ♥ — `['1', '同花顺王', '♠ 黑桃A', '♠ 顺子', '78%', '2880'], ['2', '红桃皇后', '♥ 红桃K', '♥ 火攻', '74%', '2710`
- `:109` ♦ — `['3', '方块老千', '♦ 方块Q', '♦ 配重', '71%', '2640'], ['4', '梅花骑士', '♣ 梅花J', '♣ 连携', '69%', '2510`
- `:109` ♦ — `['3', '方块老千', '♦ 方块Q', '♦ 配重', '71%', '2640'], ['4', '梅花骑士', '♣ 梅花J', '♣ 连携', '69%', '2510`
- `:109` ♣ — `['3', '方块老千', '♦ 方块Q', '♦ 配重', '71%', '2640'], ['4', '梅花骑士', '♣ 梅花J', '♣ 连携', '69%', '2510`
- `:109` ♣ — `['3', '方块老千', '♦ 方块Q', '♦ 配重', '71%', '2640'], ['4', '梅花骑士', '♣ 梅花J', '♣ 连携', '69%', '2510`
- `:110` ♠ — `['5', '百搭天罡', '♠ 黑桃10', '混 · 干预', '67%', '2380'], ['6', '黑桃暗影', '♠ 黑桃A', '♠ 速攻', '65%', '2`
- `:110` ♠ — `['5', '百搭天罡', '♠ 黑桃10', '混 · 干预', '67%', '2380'], ['6', '黑桃暗影', '♠ 黑桃A', '♠ 速攻', '65%', '2`
- `:110` ♠ — `['5', '百搭天罡', '♠ 黑桃10', '混 · 干预', '67%', '2380'], ['6', '黑桃暗影', '♠ 黑桃A', '♠ 速攻', '65%', '2`
- `:111` ♠ — `['7', view.name, '♠ 黑桃A', '♠ 急袭', '64%', '1240'], ['8', '掷地有声', '♦ 方块K', '♦ 稳翻', '61%', '1`
- `:111` ♠ — `['7', view.name, '♠ 黑桃A', '♠ 急袭', '64%', '1240'], ['8', '掷地有声', '♦ 方块K', '♦ 稳翻', '61%', '1`
- `:111` ♦ — `['7', view.name, '♠ 黑桃A', '♠ 急袭', '64%', '1240'], ['8', '掷地有声', '♦ 方块K', '♦ 稳翻', '61%', '1`
- `:111` ♦ — `['7', view.name, '♠ 黑桃A', '♠ 急袭', '64%', '1240'], ['8', '掷地有声', '♦ 方块K', '♦ 稳翻', '61%', '1`
- `:132` ♠ — `{ type: 'Avatar', id: 'ldr-seal', props: { name: '♠', shape: 'rounded', size: 72 } },`
- `:167` 🎴 — `props: { title: ˋ🎴 ${f.name} · ${f.kind}ˋ, sub: ˋ${f.effect}${nums ? ˋ · 📊 ${nums}ˋ : ''`
- `:167` 📊 — `props: { title: ˋ🎴 ${f.name} · ${f.kind}ˋ, sub: ˋ${f.effect}${nums ? ˋ · 📊 ${nums}ˋ : ''`
- `:167` 🛡 — `props: { title: ˋ🎴 ${f.name} · ${f.kind}ˋ, sub: ˋ${f.effect}${nums ? ˋ · 📊 ${nums}ˋ : ''`
- `:169` 🔒 — `const tag = st !== undefined ? ˋ${locked ? '🔒 ' : ''}第 ${st} 关ˋ : '🔒 后续关卡';`
- `:169` 🔒 — `const tag = st !== undefined ? ˋ${locked ? '🔒 ' : ''}第 ${st} 关ˋ : '🔒 后续关卡';`
- `:186` ⚡ — `props: { ...(iconUri('tiangang') ? { media: iconUri('tiangang')! } : {}), title: iconUri('`
- `:196` 🗃 — `: { text: ˋ🗃 天罡牌 · 收藏 ${ownedT}/${view.tiangangs.length}（到「牌组」屏编入出战）ˋ },`

### `combat-types.ts`

- `:6` ★ — `if (rank === 'JOKER' || rank === '★' || rank === '王') return 3;`

### `craft-screen.ts`

- `:58` 💎 — `type: 'Panel', id: 'ench-slot-box', props: { title: ˋ💎 镶嵌槽 ${inlaid.length}/${INLAY_MAX}ˋ`
- `:77` 🛒 — `else pickKids.push({ type: 'Button', id: 'ench-getdizhi', props: { label: '🛒 去商城抽地支', kin`
- `:82` 🀄 — `type: 'Panel', id: 'ench-pick-box', props: { title: '🀄 卡包地支' }, layout: { direction: 'col`
- `:87` 🔨 — `type: 'Modal', id: 'ench-modal', props: { title: ˋ🔨 附魔 · ${rank}${su} ${hero?.name ?? ''}`
- `:107` 🀄 — `props: { rank, suit: su, label: hero?.name, value: n ? ˋ${fv}·🀄${n}ˋ : String(fv), fluid:`
- `:115` 🔨 — `type: 'Panel', id: 'craft-ench', props: { title: ˋ🔨 地支牌 · 生肖镶嵌（附魔）· ≤${INLAY_MAX} 槽ˋ }, l`
- `:128` ⚔ — `if (j.owned) { sub = ˋ✓ 已解锁${j.inDeck ? ' · ⚔ 已入组' : ''}ˋ; tone = 'accent'; }`
- `:129` 🔒 — `else if (j.locked) { sub = ˋ🔒 通关第 ${us} 关解锁（💎${us} 速解）ˋ; tone = 'locked'; action = 'diam`
- `:129` 💎 — `else if (j.locked) { sub = ˋ🔒 通关第 ${us} 关解锁（💎${us} 速解）ˋ; tone = 'locked'; action = 'diam`
- `:130` 🪙 — `else { sub = ˋ🪙 ${j.cost}ˋ; tone = 'normal'; action = 'buyTiangang'; actionArg = j.id; }`
- `:132` ⚡ — `props: { ...(iconUri('tiangang') ? { media: iconUri('tiangang')! } : {}), title: iconUri('`
- `:135` ⚡ — `type: 'Panel', id: 'craft-shelf', props: { title: '⚡ 天罡牌 · 购买（局内法术·买入后到「牌组」屏编入）', scroll: `
- `:138` 💎 — `{ type: 'Label', id: 'shelf-note', props: { text: '花金币买入天罡牌（解锁后入「拥有」）·关未到可花 💎 速解（跳 grind）`

### `deck-data.ts`

- `:8` ♠ — `const POOL_SUIT_LETTERS = ['S', 'H', 'D', 'C']; // ♠♥♦♣（与大厅 deckGrid 同序）`
- `:8` ♥ — `const POOL_SUIT_LETTERS = ['S', 'H', 'D', 'C']; // ♠♥♦♣（与大厅 deckGrid 同序）`
- `:8` ♦ — `const POOL_SUIT_LETTERS = ['S', 'H', 'D', 'C']; // ♠♥♦♣（与大厅 deckGrid 同序）`
- `:8` ♣ — `const POOL_SUIT_LETTERS = ['S', 'H', 'D', 'C']; // ♠♥♦♣（与大厅 deckGrid 同序）`
- `:23` ★ — `const p = RANK_POINT[rank] ?? 14; // 未知（JOKER/★）按最高档`

### `deck-screen.ts`

- `:24` ⚔ — `props: { label: ˋ${d.active ? '⚔ ' : ''}${d.name} · 扑${d.pokerSize ?? 0}/罡${d.size}ˋ, acti`
- `:28` 🎖 — `type: 'Panel', id: 'deck-selector', props: { title: ˋ🎖 我的出战牌组 · 一套 = ${view.pokerPickMax `
- `:54` 💧 — `{ type: 'Label', id: ˋpcb-s-${hero.id}ˋ, props: { size: 'sm', color: 'sub', spans: [{ text`
- `:74` 💧 — `if (cost > 0) overlays.push({ type: 'Label', id: ˋpc-cost-${cardId}ˋ, props: { text: '💧'.`
- `:106` 🎴 — `{ type: 'Label', id: 'poker-count', props: { text: ˋ🎴 扑克牌库 ·「${view.activeDeckName ?? ''}`
- `:122` ⚡ — `{ type: 'Label', id: ˋtgb-n-${j.id}ˋ, props: { text: ˋ⚡ ${j.name}ˋ, size: 'md', color: 'go`
- `:137` ⚡ — `type: 'Card', id: ˋtg-${j.id}ˋ, props: { ...(iconUri('tiangang') ? { media: iconUri('tiang`
- `:143` ⚡ — `type: 'Panel', id: 'deck-tiangang', props: { title: ˋ⚡ 天罡战法 ·「${view.activeDeckName ?? ''}`
- `:167` 🀄 — `type: 'Panel', id: 'deck-dizhi', props: { title: ˋ🀄 地支牌 · 卡包 ${ownedN}/12 生肖（满 3 同档自动升档 铜`
- `:170` 🛒 — `{ type: 'Label', id: 'dz-note', props: { text: '地支=消耗牌（镶进扑克牌附魔·镶一张少一张）·抽卡获取（🛒商城）。三合/六合连携待`
- `:181` 🎴 — `props: { tabs: [{ id: 'poker', label: '🎴 扑克牌库' }, { id: 'tiangang', label: '⚡ 天罡战法', anch`
- `:181` ⚡ — `props: { tabs: [{ id: 'poker', label: '🎴 扑克牌库' }, { id: 'tiangang', label: '⚡ 天罡战法', anch`
- `:181` 🀄 — `props: { tabs: [{ id: 'poker', label: '🎴 扑克牌库' }, { id: 'tiangang', label: '⚡ 天罡战法', anch`

### `dizhi-data.ts`

- `:39` 🌊 — `{ name:'🌊 水·灵动不败', members:'申猴+子鼠+辰龙', effect:'整局 1 次必重掷（用掉即消失）——一局一张保命符' },`
- `:40` 🔥 — `{ name:'🔥 火·燎原', members:'寅虎+午马+戌狗', effect:'赢对决后连推 1 次 + 破大本营时少量额外伤害' },`
- `:41` ⚔ — `{ name:'⚔️ 金·肃杀', members:'巳蛇+酉鸡+丑牛', effect:'每场对决返 1 召唤源泉 + 击败的敌人限时不能再上场' },`
- `:42` 🌿 — `{ name:'🌿 木·生生', members:'亥猪+卯兔+未羊', effect:'阵亡回手牌可重新派遣 + 击杀返材料' },`

### `economy-data.ts`

- `:19` 💎 — `{ id: 'r6', price: 6, base: 6, bonus: 0 }, // ¥6=6💎（1:1·首档无赠）`
- `:29` 🪙 — `{ id: 'x6', diamond: 6, gold: 60 }, // 10🪙/💎`
- `:29` 💎 — `{ id: 'x6', diamond: 6, gold: 60 }, // 10🪙/💎`
- `:30` 🪙 — `{ id: 'x18', diamond: 18, gold: 200, tag: '超值' }, // ~11🪙/💎`
- `:30` 💎 — `{ id: 'x18', diamond: 18, gold: 200, tag: '超值' }, // ~11🪙/💎`
- `:31` 🪙 — `{ id: 'x36', diamond: 36, gold: 450, tag: '热卖' }, // 12.5🪙/💎`
- `:31` 💎 — `{ id: 'x36', diamond: 36, gold: 450, tag: '热卖' }, // 12.5🪙/💎`
- `:32` 🪙 — `{ id: 'x64', diamond: 64, gold: 900, tag: '至尊' }, // ~14🪙/💎`
- `:32` 💎 — `{ id: 'x64', diamond: 64, gold: 900, tag: '至尊' }, // ~14🪙/💎`
- `:46` ♠ — `const SUIT_PW_ORDER = ['♠', '♥', '♦', '♣'];`
- `:46` ♥ — `const SUIT_PW_ORDER = ['♠', '♥', '♦', '♣'];`
- `:46` ♦ — `const SUIT_PW_ORDER = ['♠', '♥', '♦', '♣'];`
- `:46` ♣ — `const SUIT_PW_ORDER = ['♠', '♥', '♦', '♣'];`
- `:51` ♥ — `export const RECHARGE_SUIT_PW = ['♥', '♠']; // 正确密码：红心 + 黑桃`
- `:51` ♠ — `export const RECHARGE_SUIT_PW = ['♥', '♠']; // 正确密码：红心 + 黑桃`
- `:52` ♠ — `export const RECHARGE_PASSWORD = canonSuitPw(RECHARGE_SUIT_PW); // 规范化后 = '♠♥'`
- `:52` ♥ — `export const RECHARGE_PASSWORD = canonSuitPw(RECHARGE_SUIT_PW); // 规范化后 = '♠♥'`

### `formation-data.ts`

- `:4` ♠ — `const SUITS = ['S', 'H', 'D', 'C']; // ♠♥♦♣`
- `:4` ♥ — `const SUITS = ['S', 'H', 'D', 'C']; // ♠♥♦♣`
- `:4` ♦ — `const SUITS = ['S', 'H', 'D', 'C']; // ♠♥♦♣`
- `:4` ♣ — `const SUITS = ['S', 'H', 'D', 'C']; // ♠♥♦♣`

### `game-g-build.ts`

- `:36` ★ — `export const cardRank = (c: ArmyCard): string => (c.rank === 'JOKER' ? '★' : c.rank); // 显`
- `:36` ★ — `export const cardRank = (c: ArmyCard): string => (c.rank === 'JOKER' ? '★' : c.rank); // 显`
- `:47` ♠ — `export const SUIT_SYM2LET: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': '`
- `:47` ♥ — `export const SUIT_SYM2LET: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': '`
- `:47` ♦ — `export const SUIT_SYM2LET: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': '`
- `:47` ♣ — `export const SUIT_SYM2LET: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': '`
- `:51` ★ — `const hr = heroDef.rank === 'JOKER' ? '★' : heroDef.rank;`

### `game-g-clash-view.ts`

- `:51` 🎲 — `if (mo.length) extras.push(ˋ🎲 ${who}掷骰系天罡：${mo.join('·')}（掷值可超 [1~${s.pEff}] 上界）ˋ); });`
- `:52` ⚖ — `if (ev.tie) extras.push(ev.tie === 'power' ? '⚖ 掷平 → 战力高者胜' : ev.tie === 'points' ? '⚖ 掷平·`
- `:52` ⚖ — `if (ev.tie) extras.push(ev.tie === 'power' ? '⚖ 掷平 → 战力高者胜' : ev.tie === 'points' ? '⚖ 掷平·`
- `:52` ⚖ — `if (ev.tie) extras.push(ev.tie === 'power' ? '⚖ 掷平 → 战力高者胜' : ev.tie === 'points' ? '⚖ 掷平·`
- `:52` ⚖ — `if (ev.tie) extras.push(ev.tie === 'power' ? '⚖ 掷平 → 战力高者胜' : ev.tie === 'points' ? '⚖ 掷平·`
- `:58` ⚔ — `extras.push(ˋ⚔ ${wn} 战胜（累计胜 ${ev.winStreak ?? 1} 场·疲劳 ${fatPct}%）→ 本场战力对折 −${cut}· 留场续战·歇一`

### `game-g-save.ts`

- `:21` 💎 — `dizhiShards: number; // 地支碎片（养地支专属材料 · 💎可换 · 待甲镶嵌系统消耗）`

### `game-g.tsx`

- `:114` 🔥 — `const act = activated === arch.id ? '　<b style="color:var(--gold)">🔥 招牌已激活</b>' : ˋ　<span`
- `:140` ⚔ — `ˋ<h2>⚔️ 战役进度</h2><div class="bigrank">第 ${save.stage} / ${RUN_BATTLES} 战</div><div class="`
- `:140` 🪙 — `ˋ<h2>⚔️ 战役进度</h2><div class="bigrank">第 ${save.stage} / ${RUN_BATTLES} 战</div><div class="`
- `:141` 🏆 — `ˋ<h2>🏆 终局 Boss</h2><div class="bigrank" style="color:var(--heart)">${boss.name}</div><div`
- `:303` 🎉 — `{ type: 'Label', id: 'gg-btw-title', props: { text: '🎉 战间整备 · 三选一', size: 'lg', bold: tru`
- `:335` ⚔ — `const battleLabel = ˋ第 ${save.stage}/${RUN_BATTLES} 战 · ${lvl.battle.name} · ⚔ ${lvl.heroI`
- `:426` 💢 — `const nail = document.createElement('div'); nail.textContent = fate === 'fatigue' ? '💢' :`
- `:426` 📌 — `const nail = document.createElement('div'); nail.textContent = fate === 'fatigue' ? '💢' :`
- `:439` ♔ — `if (fate === 'glory') { const crown = document.createElement('div'); crown.textContent = '`
- `:443` ⚔ — `const txt = note ?? (fate === 'tear' ? '⚔ 阵亡' : fate === 'glory' ? '★ 光荣回库' : fate === 'pi`
- `:443` ★ — `const txt = note ?? (fate === 'tear' ? '⚔ 阵亡' : fate === 'glory' ? '★ 光荣回库' : fate === 'pi`
- `:443` ★ — `const txt = note ?? (fate === 'tear' ? '⚔ 阵亡' : fate === 'glory' ? '★ 光荣回库' : fate === 'pi`
- `:466` 💚 — `if (b4 != null && now < b4) { const back = Math.round((b4 - now) / 10); if (back > 0) { pl`
- `:499` ⚔ — `ov.innerHTML = ˋ<div style="animation:gg-cue ${DUR}ms ease both;font-size:24px;font-weight`
- `:508` ⚔ — `const lane = ˋ<div style="position:absolute;left:${(cax + cbx) / 2}px;top:${Math.min(cay, `
- `:568` 🛡 — `else if (e.lastStand) { log(ˋ🛡 死战不退：敌主将【${aiName}】首负不亡·退回牌库（可重部署）ˋ); showBanner('🛡 死战不退 `
- `:568` 🛡 — `else if (e.lastStand) { log(ˋ🛡 死战不退：敌主将【${aiName}】首负不亡·退回牌库（可重部署）ˋ); showBanner('🛡 死战不退 `
- `:570` ⚔ — `if (ctx.winnerId && !e.lastStand) { playSfx('clashWin'); playGhost(captureUnit(ctx.winnerI`
- `:570` ⚔ — `if (ctx.winnerId && !e.lastStand) { playSfx('clashWin'); playGhost(captureUnit(ctx.winnerI`
- `:599` 🛡 — `const reveal = (): void => { clashCdTimer = 0; clashRolling = false; clashRevealed = true;`
- `:599` 🛡 — `const reveal = (): void => { clashCdTimer = 0; clashRolling = false; clashRevealed = true;`
- `:646` ⚔ — `log(ˋ⚔对决[${LANE_NM[e.lane] ?? e.lane}] ${nm(e.a)}(我) vs ${nm(e.b)}(敌)ˋ);`
- `:649` ★ — `log(ˋ  · 预报我方胜率 ${Math.round(e.winrate * 100)}%${e.tie ? ˋ　掷平裁定:${e.tie}ˋ : ''}　→ ${e.aWin`
- `:649` ☠ — `log(ˋ  · 预报我方胜率 ${Math.round(e.winrate * 100)}%${e.tie ? ˋ　掷平裁定:${e.tie}ˋ : ''}　→ ${e.aWin`
- `:666` ♠ — `const SM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };`
- `:666` ♥ — `const SM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };`
- `:666` ♦ — `const SM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };`
- `:666` ♣ — `const SM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };`
- `:702` 📍 — `battleTl.delay(pT(walkTicks), () => { justMovedIds = new Set(); moveOrder = new Map(); mov`
- `:838` ⚔ — `<div style="font-size:12px;letter-spacing:.16em;color:#5ea0e0;font-weight:700;margin-botto`
- `:890` 📋 — `const dbgBtn = el('div', 'position:absolute;left:10px;bottom:10px;z-index:120;padding:5px `
- `:896` 📋 — `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:#eaf0f`
- `:896` 💧 — `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:#eaf0f`
- `:898` 💧 — `<div id="dbg-hint" style="font-size:11px;color:#7d8b9a">出 bug 点「复制」贴给开发排查。｜dev：🃏 把全部天罡调到手`
- `:913` 🛠 — `mounted?.update(); log(ˋ🛠dev·全天罡到手牌(${GAME_G_TIANGANGS.length}张)+加源泉→${tb.a.mana}ˋ); clos`
- `:942` 🪙 — `const lootSub = fortuneLabel ? ˋ基础 ${baseGain} · 卦象${fortuneLabel} ${fortuneBuff >= 0 ? '+`
- `:949` 🏆 — `if (save.stage >= RUN_BATTLES) { save.materials += 50; tail = '🏆 <b>通关战役！</b>（+50 材料）回大厅开`
- `:953` 💀 — `if (save.lives <= 0) { tail = '💀 <b>命尽，战役结束</b> 回大厅重整'; save.stage = 1; save.lives = effe`

### `hero-codex.ts`

- `:6` ♠ — `id: string; rank: string; suit: '♠'|'♥'|'♦'|'♣';`
- `:6` ♥ — `id: string; rank: string; suit: '♠'|'♥'|'♦'|'♣';`
- `:6` ♦ — `id: string; rank: string; suit: '♠'|'♥'|'♦'|'♣';`
- `:6` ♣ — `id: string; rank: string; suit: '♠'|'♥'|'♦'|'♣';`
- `:16` ♠ — `{ id:'AS',rank:'A',suit:'♠',name:'孙武',title:'兵圣',era:'春秋·齐/吴',contribRank:1,contrib:'《孙子兵法`
- `:23` ♥ — `{ id:'AH',rank:'A',suit:'♥',name:'成吉思汗',title:'一代天骄',era:'13C·蒙古',contribRank:2,contrib:'史`
- `:30` ♦ — `{ id:'AD',rank:'A',suit:'♦',name:'亚历山大大帝',title:'征服者',era:'BC4C·马其顿',contribRank:3,contrib`
- `:37` ♣ — `{ id:'AC',rank:'A',suit:'♣',name:'拿破仑',title:'战争之神',era:'18–19C·法国',contribRank:4,contrib:`
- `:45` ♠ — `{ id:'KS',rank:'K',suit:'♠',name:'凯撒',title:'高卢征服者',era:'BC1C·罗马',contribRank:5,contrib:'《`
- `:52` ♥ — `{ id:'KH',rank:'K',suit:'♥',name:'汉尼拔',title:'战略之父',era:'BC3C·迦太基',contribRank:6,contrib:'`
- `:59` ♦ — `{ id:'KD',rank:'K',suit:'♦',name:'韩信',title:'兵仙',era:'BC3C·汉',contribRank:7,contrib:'背水一战、`
- `:66` ♣ — `{ id:'KC',rank:'K',suit:'♣',name:'白起',title:'杀神',era:'BC3C·秦',contribRank:8,contrib:'一生未尝败`
- `:74` ♠ — `{ id:'QS',rank:'Q',suit:'♠',name:'哈立德·伊本·瓦利德',title:'真主之剑',era:'7C·阿拉伯',contribRank:9,cont`
- `:81` ♥ — `{ id:'QH',rank:'Q',suit:'♥',name:'居鲁士大帝',title:'万王之王',era:'BC6C·波斯',contribRank:10,contrib`
- `:88` ♦ — `{ id:'QD',rank:'Q',suit:'♦',name:'帖木儿',title:'跛足征服者',era:'14C·中亚',contribRank:11,contrib:'`
- `:95` ♣ — `{ id:'QC',rank:'Q',suit:'♣',name:'速不台',title:'常胜先锋',era:'13C·蒙古',contribRank:12,contrib:'横`
- `:103` ♠ — `{ id:'JS',rank:'J',suit:'♠',name:'腓特烈大帝',title:'军事天才',era:'18C·普鲁士',contribRank:13,contrib`
- `:110` ♥ — `{ id:'JH',rank:'J',suit:'♥',name:'西庇阿',title:'征非者',era:'BC3C·罗马',contribRank:14,contrib:'扎`
- `:117` ♦ — `{ id:'JD',rank:'J',suit:'♦',name:'苏沃洛夫',title:'不败统帅',era:'18C·俄国',contribRank:15,contrib:'`
- `:124` ♣ — `{ id:'JC',rank:'J',suit:'♣',name:'李靖',title:'大唐军神',era:'7C·唐',contribRank:16,contrib:'灭东突厥`
- `:132` ♠ — `{ id:'10S',rank:'10',suit:'♠',name:'萨拉丁',title:'伊斯兰之盾',era:'12C·阿尤布',contribRank:17,contri`
- `:139` ♥ — `{ id:'10H',rank:'10',suit:'♥',name:'古斯塔夫二世',title:'近代战争之父',era:'17C·瑞典',contribRank:18,con`
- `:146` ♦ — `{ id:'10D',rank:'10',suit:'♦',name:'霍去病',title:'冠军侯',era:'BC2C·汉',contribRank:19,contrib:'`
- `:153` ♣ — `{ id:'10C',rank:'10',suit:'♣',name:'李世民',title:'天可汗',era:'7C·唐',contribRank:20,contrib:'虎牢`
- `:161` ♠ — `{ id:'9S',rank:'9',suit:'♠',name:'朱可夫',title:'胜利元帅',era:'20C·苏联',contribRank:21,contrib:'斯`
- `:166` ♥ — `{ id:'9H',rank:'9',suit:'♥',name:'隆美尔',title:'沙漠之狐',era:'20C·德国',contribRank:22,contrib:'机`
- `:171` ♦ — `{ id:'9D',rank:'9',suit:'♦',name:'项羽',title:'西楚霸王',era:'BC3C·楚',contribRank:23,contrib:'巨鹿`
- `:176` ♣ — `{ id:'9C',rank:'9',suit:'♣',name:'贝利撒留',title:'最后的罗马人',era:'6C·拜占庭',contribRank:24,contrib`
- `:182` ♠ — `{ id:'8S',rank:'8',suit:'♠',name:'阿提拉',title:'上帝之鞭',era:'5C·匈人',contribRank:25,contrib:'震撼`
- `:187` ♥ — `{ id:'8H',rank:'8',suit:'♥',name:'穆罕默德二世',title:'征服者',era:'15C·奥斯曼',contribRank:26,contrib`
- `:192` ♦ — `{ id:'8D',rank:'8',suit:'♦',name:'曼施坦因',title:'闪击战策划',era:'20C·德国',contribRank:27,contrib:`
- `:197` ♣ — `{ id:'8C',rank:'8',suit:'♣',name:'岳飞',title:'精忠武穆',era:'12C·南宋',contribRank:28,contrib:'撼山`
- `:203` ♠ — `{ id:'7S',rank:'7',suit:'♠',name:'威灵顿公爵',title:'铁公爵',era:'19C·英国',contribRank:29,contrib:'`
- `:208` ♥ — `{ id:'7H',rank:'7',suit:'♥',name:'纳尔逊',title:'海上之王',era:'18–19C·英国',contribRank:30,contrib`
- `:213` ♦ — `{ id:'7D',rank:'7',suit:'♦',name:'戚继光',title:'抗倭名将',era:'16C·明',contribRank:31,contrib:'鸳鸯`
- `:218` ♣ — `{ id:'7C',rank:'7',suit:'♣',name:'诸葛亮',title:'卧龙·智圣',era:'3C·蜀汉',contribRank:32,contrib:'隆`
- `:224` ♠ — `{ id:'6S',rank:'6',suit:'♠',name:'扬·杰士卡',title:'独眼不败',era:'15C·波希米亚',contribRank:33,contri`
- `:229` ♥ — `{ id:'6H',rank:'6',suit:'♥',name:'马尔伯勒公爵',title:'常胜公爵',era:'18C·英国',contribRank:34,contrib`
- `:234` ♦ — `{ id:'6D',rank:'6',suit:'♦',name:'织田信长',title:'第六天魔王',era:'16C·日本',contribRank:35,contrib:`
- `:239` ♣ — `{ id:'6C',rank:'6',suit:'♣',name:'卫青',title:'长平侯',era:'BC2C·汉',contribRank:36,contrib:'反击匈`
- `:245` ♠ — `{ id:'5S',rank:'5',suit:'♠',name:'查理曼',title:'欧洲之父',era:'8–9C·法兰克',contribRank:37,contrib:`
- `:250` ♥ — `{ id:'5H',rank:'5',suit:'♥',name:'图拉真',title:'最佳元首',era:'2C·罗马',contribRank:38,contrib:'罗马`
- `:255` ♦ — `{ id:'5D',rank:'5',suit:'♦',name:'苏莱曼大帝',title:'立法者',era:'16C·奥斯曼',contribRank:39,contrib:`
- `:260` ♣ — `{ id:'5C',rank:'5',suit:'♣',name:'曹操',title:'魏武',era:'3C·汉/魏',contribRank:40,contrib:'官渡破袁`
- `:266` ♠ — `{ id:'4S',rank:'4',suit:'♠',name:'埃帕米农达斯',title:'斜阵之父',era:'BC4C·底比斯',contribRank:41,contr`
- `:271` ♥ — `{ id:'4H',rank:'4',suit:'♥',name:'皮洛士',title:'险胜之王',era:'BC3C·伊庇鲁斯',contribRank:42,contrib`
- `:276` ♦ — `{ id:'4D',rank:'4',suit:'♦',name:'武田信玄',title:'甲斐之虎',era:'16C·日本',contribRank:43,contrib:'`
- `:281` ♣ — `{ id:'4C',rank:'4',suit:'♣',name:'吴起',title:'兵家亚圣',era:'BC4C·魏/楚',contribRank:44,contrib:'`
- `:287` ♠ — `{ id:'3S',rank:'3',suit:'♠',name:'列奥尼达',title:'温泉关之王',era:'BC5C·斯巴达',contribRank:45,contri`
- `:292` ♥ — `{ id:'3H',rank:'3',suit:'♥',name:'罗伯特·李',title:'南军统帅',era:'19C·美国',contribRank:46,contrib:`
- `:297` ♦ — `{ id:'3D',rank:'3',suit:'♦',name:'孙膑',title:'智囊',era:'BC4C·齐',contribRank:47,contrib:'围魏救赵`
- `:302` ♣ — `{ id:'3C',rank:'3',suit:'♣',name:'巴布尔',title:'莫卧儿奠基者',era:'16C·莫卧儿',contribRank:48,contrib`
- `:308` ♠ — `{ id:'2S',rank:'2',suit:'♠',name:'斯巴达克斯',title:'角斗士之王',era:'BC1C·罗马',contribRank:49,contri`
- `:313` ♥ — `{ id:'2H',rank:'2',suit:'♥',name:'维钦托利',title:'高卢之王',era:'BC1C·高卢',contribRank:50,contrib:`
- `:318` ♦ — `{ id:'2D',rank:'2',suit:'♦',name:'沙卡·祖鲁',title:'非洲战王',era:'19C·祖鲁',contribRank:51,contrib:`
- `:323` ♣ — `{ id:'2C',rank:'2',suit:'♣',name:'狮心王理查',title:'狮心',era:'12C·英格兰',contribRank:52,contrib:'`
- `:334` ♠ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♥ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♦ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♣ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♠ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♥ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♦ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♣ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♠ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♥ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♦ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♣ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♠ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♠ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♥ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♥ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♦ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♦ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♣ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`
- `:334` ♣ — `const SUIT_GLYPH: Record<string, '♠'|'♥'|'♦'|'♣'> = { s:'♠', h:'♥', d:'♦', c:'♣', S:'♠', H`

### `home-screen.ts`

- `:23` ★ — `const stars = c ? '★'.repeat(c.stars) + '☆'.repeat(Math.max(0, 3 - c.stars)) : '';`
- `:23` ☆ — `const stars = c ? '★'.repeat(c.stars) + '☆'.repeat(Math.max(0, 3 - c.stars)) : '';`
- `:29` ♠ — `{ type: 'Label', id: 'st-s', props: { text: '♠ 黑桃', size: 12, color: 'sub' } },`
- `:30` ♥ — `{ type: 'Label', id: 'st-h', props: { text: '♥ 红桃', size: 12, color: 'danger' } },`
- `:31` ♦ — `{ type: 'Label', id: 'st-d', props: { text: '♦ 方块', size: 12, color: 'warn' } },`
- `:32` ♣ — `{ type: 'Label', id: 'st-c', props: { text: '♣ 梅花', size: 12, color: 'ok' } },`
- `:45` ♠ — `tiltFloat('duel-a', { rank: 'A', suit: '♠', face: 'light' }, -9),`
- `:56` ♠ — `rank: 'A', suit: '♠', face: 'light', faceUp: false, back: '❖', backPattern: 'checker',`
- `:82` 🎴 — `{ type: 'Label', id: 'home-fortune-t', props: { size: 13, color: 'sub', spans: [iconUri('f`
- `:86` ⚔ — `{ type: 'Label', id: 'home-duelline', props: { text: c ? ˋ⚔ 对决 ${c.boss} · ${c.oneLiner}ˋ `
- `:90` ⚔ — `{ type: 'Button', id: 'home-play', props: { label: c ? ˋ⚔ 出征 · 第 ${c.stage} 关ˋ : ˋ⚔ 出征 · $`
- `:90` ⚔ — `{ type: 'Button', id: 'home-play', props: { label: c ? ˋ⚔ 出征 · 第 ${c.stage} 关ˋ : ˋ⚔ 出征 · $`
- `:92` 📖 — `{ type: 'Button', id: 'home-man', props: { label: '📖 玩法手册', kind: 'ghost', action: 'man' `
- `:103` 🎴 — `{ type: 'Label', id: ˋhome-fiend-n-${i}ˋ, props: { text: ˋ🎴 ${fd.name}ˋ, size: 12, color:`
- `:106` 📊 — `if (nums) body.push({ type: 'Label', id: ˋhome-fiend-nums-${i}ˋ, props: { text: ˋ📊 ${nums`
- `:113` ⚔ — `type: 'Panel', id: 'home-rail', props: { title: ˋ⚔ 本关 Boss · ${c?.boss ?? '—'}ˋ },`
- `:117` ★ — `props: c ? { size: 12, color: 'sub', spans: [{ text: '难度 ' }, { text: '★'.repeat(c.stars),`
- `:119` 🎴 — `props: { text: '🎴 地煞（明牌 · 公平可破）— Boss 招牌历史战术：', size: 11, color: 'sub' } },`
- `:124` ⚡ — `props: { size: 11 as const, color: 'sub' as const, spans: [{ text: '⚡ 明牌天罡：' }, { text: c.`
- `:128` 🎯 — `props: { size: 11 as const, color: 'ok' as const, spans: [iconUri('target') ? { text: '克制：`
- `:131` 🏆 — `props: { text: c ? ˋ🏆 打赢 = 破其诅咒 · 通关解锁天罡 ${c.unlock}ˋ : '', size: 11, color: 'gold' } },`

### `level.ts`

- `:36` ★ — `1: { homeHp: 3, loadoutCap: 2, aiTier: 1, bossTg: 2, garrisonMana: 0 },                   `
- `:37` ★ — `2: { homeHp: 3, loadoutCap: 3, aiTier: 3, bossTg: 4, garrisonMana: BOSS_GARRISON_MANA },  `
- `:37` ★ — `2: { homeHp: 3, loadoutCap: 3, aiTier: 3, bossTg: 4, garrisonMana: BOSS_GARRISON_MANA },  `
- `:38` ★ — `3: { homeHp: 4, loadoutCap: 3, aiTier: 3, bossTg: 6, garrisonMana: BOSS_GARRISON_MANA },  `
- `:38` ★ — `3: { homeHp: 4, loadoutCap: 3, aiTier: 3, bossTg: 6, garrisonMana: BOSS_GARRISON_MANA },  `
- `:38` ★ — `3: { homeHp: 4, loadoutCap: 3, aiTier: 3, bossTg: 6, garrisonMana: BOSS_GARRISON_MANA },  `
- `:39` ★ — `4: { homeHp: 4, loadoutCap: 4, aiTier: 4, bossTg: 9, garrisonMana: BOSS_GARRISON_MANA },  `
- `:39` ★ — `4: { homeHp: 4, loadoutCap: 4, aiTier: 4, bossTg: 9, garrisonMana: BOSS_GARRISON_MANA },  `
- `:39` ★ — `4: { homeHp: 4, loadoutCap: 4, aiTier: 4, bossTg: 9, garrisonMana: BOSS_GARRISON_MANA },  `
- `:39` ★ — `4: { homeHp: 4, loadoutCap: 4, aiTier: 4, bossTg: 9, garrisonMana: BOSS_GARRISON_MANA },  `
- `:40` ★ — `5: { homeHp: 5, loadoutCap: 5, aiTier: 5, bossTg: 12, garrisonMana: BOSS_GARRISON_MANA }, `
- `:40` ★ — `5: { homeHp: 5, loadoutCap: 5, aiTier: 5, bossTg: 12, garrisonMana: BOSS_GARRISON_MANA }, `
- `:40` ★ — `5: { homeHp: 5, loadoutCap: 5, aiTier: 5, bossTg: 12, garrisonMana: BOSS_GARRISON_MANA }, `
- `:40` ★ — `5: { homeHp: 5, loadoutCap: 5, aiTier: 5, bossTg: 12, garrisonMana: BOSS_GARRISON_MANA }, `
- `:40` ★ — `5: { homeHp: 5, loadoutCap: 5, aiTier: 5, bossTg: 12, garrisonMana: BOSS_GARRISON_MANA }, `

### `lobby-dd.ts`

- `:62` ♠ — `children: [{ type: 'Avatar', id: 'tb-seal', props: { name: '♠', shape: 'rounded', size: 42`
- `:65` ⚔ — `const stage: LayoutNode = iconPill('tb-stage', 'battle', '⚔', view.stageLabel, 'tab', 'nor`
- `:69` 🛒 — `iconPill('tb-shop', 'shop', '🛒', '商城', 'openShop', 'accent'),`
- `:70` 🪙 — `iconPill('tb-coin', 'coin', '🪙', String(view.coin), 'recharge'),`
- `:71` 💎 — `iconPill('tb-dia', 'diamond', '💎', String(view.diamond ?? 0), 'recharge'),`
- `:72` 🧩 — `iconPill('tb-shard', 'shard-dizhi', '🧩', String(view.dizhiShards ?? 0), 'recharge'),`
- `:73` 🔶 — `iconPill('tb-shardtg', 'shard-tiangang', '🔶', String(view.tiangangShards ?? 0), 'recharge`
- `:75` 📚 — `iconPill('tb-man', 'manual', '📚', '手册', 'man', 'accent', undefined, 'help'),`
- `:76` ⚙ — `iconPill('tb-settings', 'settings', '⚙', '', 'settings'),`
- `:136` 🎴 — `type: 'Modal', id: 'gacha-reveal', props: { title: '🎴 开 包', size: 'md', closeAction: 'rev`
- `:140` 🎴 — `props: { title: ˋ${r.kind === 'tiangang' ? '🎴' : '🀄'} ${r.name}ˋ, sub: r.detail,`
- `:140` 🀄 — `props: { title: ˋ${r.kind === 'tiangang' ? '🎴' : '🀄'} ${r.name}ˋ, sub: r.detail,`

### `lobby-types.ts`

- `:43` 💎 — `onRecharge?: (packId: string, password: string) => boolean | void; // 充值 ¥→💎（Demo·首充免密/复充`
- `:46` 💎 — `onExchange?: (exId: string) => void; // 兑换 💎→🪙金币`
- `:46` 🪙 — `onExchange?: (exId: string) => void; // 兑换 💎→🪙金币`
- `:47` 💎 — `onBuyShards?: (exId: string) => void; // 兑换 💎→🧩地支碎片`
- `:47` 🧩 — `onBuyShards?: (exId: string) => void; // 兑换 💎→🧩地支碎片`
- `:84` 📖 — `{ anchor: 'help', text: '① 先翻一遍《玩法手册》——30 秒看懂怎么打（三路九格 · 每回合四选一 · 掷命对决）。点这里 📖', advanceAct`
- `:87` ⚡ — `{ anchor: 'tab-gang', text: '④ 再切到「⚡天罡战法」页配天罡。', advanceAct: 'deckTab', advanceK: 'gang', `

### `lobby-util.ts`

- `:4` ♠ — `export const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['`
- `:4` ♥ — `export const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['`
- `:4` ♦ — `export const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['`
- `:4` ♣ — `export const SUITS: [string, string][] = [['♠', 'var(--spade)'], ['♥', 'var(--heart)'], ['`
- `:6` ♠ — `export const SUIT_LETTER: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C`
- `:6` ♥ — `export const SUIT_LETTER: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C`
- `:6` ♦ — `export const SUIT_LETTER: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C`
- `:6` ♣ — `export const SUIT_LETTER: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C`

### `overlays.ts`

- `:45` 🟢 — `easy: { title: '🟢 初级 · 打赢第一场', color: 'ok', paras: [`
- `:50` 🟡 — `mid: { title: '🟡 中级 · 三牌组 + 经营', color: 'warn', paras: [`
- `:52` ⚔ — `'⚔ 掷命预报（落子前就看得见）：两军前锋将要相遇的那一路，棋盘上会在你前锋头顶浮出「档位词 + 具体胜率%」，让你开战前就心里有数：\n· 占优：小优 55%↑ → 优势 65%`
- `:52` 🔴 — `'⚔ 掷命预报（落子前就看得见）：两军前锋将要相遇的那一路，棋盘上会在你前锋头顶浮出「档位词 + 具体胜率%」，让你开战前就心里有数：\n· 占优：小优 55%↑ → 优势 65%`
- `:55` 🔴 — `hard: { title: '🔴 高级 · 概率算法 · 连携 · 克制', color: 'danger', paras: [`
- `:71` 🟢 — `{ type: 'Segmented', id: 'help-mantier', props: { options: [{ value: 'easy', label: '🟢 初级`
- `:71` 🟡 — `{ type: 'Segmented', id: 'help-mantier', props: { options: [{ value: 'easy', label: '🟢 初级`
- `:71` 🔴 — `{ type: 'Segmented', id: 'help-mantier', props: { options: [{ value: 'easy', label: '🟢 初级`
- `:77` 📖 — `type: 'Modal', id: 'help-modal', props: { title: '📖 帮助中心', size: 'lg', closeAction: 'clos`
- `:81` 📜 — `{ type: 'Tabs', id: 'help-tabs', props: { tabs: [tab('intro', '📜 游戏介绍'), tab('tut', '📖 新`
- `:81` 📖 — `{ type: 'Tabs', id: 'help-tabs', props: { tabs: [tab('intro', '📜 游戏介绍'), tab('tut', '📖 新`
- `:81` 📚 — `{ type: 'Tabs', id: 'help-tabs', props: { tabs: [tab('intro', '📜 游戏介绍'), tab('tut', '📖 新`
- `:96` ⚙ — `type: 'Modal', id: 'settings-modal', props: { title: '⚙ 设置', size: 'lg', closeAction: 'clo`
- `:102` 🔊 — `{ type: 'Toggle', id: 'set-sfx', props: { label: '🔊 音效', checked: true, action: 'sfxToggl`
- `:103` 🎵 — `{ type: 'Toggle', id: 'set-bgm', props: { label: '🎵 背景音乐', checked: false, action: 'bgmTo`
- `:104` 🎓 — `{ type: 'Toggle', id: 'set-guide', props: { label: '🎓 新手引导', checked: view.guideOn !== fa`
- `:108` ⚠ — `{ type: 'Button', id: 'set-reset', props: { label: '⚠ 重置所有数据（调试用）', kind: 'ghost', action:`
- `:123` 🪙 — `return { type: 'Button', id: ˋgacha-${pool}-${count}-${pay}ˋ, props: { label: ˋ${count ===`
- `:123` 💎 — `return { type: 'Button', id: ˋgacha-${pool}-${count}-${pay}ˋ, props: { label: ˋ${count ===`
- `:139` 🔶 — `? tgCraftable.map((j) => ({ type: 'Tag', id: ˋshop-craft-tg-${j.id}ˋ, props: { label: ˋ${j`
- `:140` 🎉 — `: [{ type: 'Label', id: 'shop-craft-tg-none', props: { text: '已解锁天罡均已拥有 🎉', size: 'sm', c`
- `:141` 🧩 — `const dzCraftChips: LayoutNode[] = DIZHI_ZODIACS.map((z) => ({ type: 'Tag', id: ˋshop-craf`
- `:151` 🎴 — `poolPanel('tiangang', '🎴 天罡卡池', ˋ抽到重复 → +${GACHA.tiangang.dupShards} 天罡碎片ˋ),`
- `:152` 🀄 — `poolPanel('dizhi', '🀄 地支卡池', '12 生肖·重复自动升档 铜→银→金·满金转碎片'),`
- `:153` 🔶 — `craftPanel('shop-craft-tg', '🔶 天罡碎片 · 定向兑换（保底）', ˋ攒够碎片直接换想要的天罡·每张 ${GACHA.tiangang.craftS`
- `:154` 🧩 — `craftPanel('shop-craft-dz', '🧩 地支碎片 · 定向兑换（升档）', ˋ攒够地支碎片直接换/升生肖（铜→银→金）·每次 ${GACHA.dizhi.c`
- `:157` 🪙 — `props: { title: ˋ✨ ${f.name}ˋ, sub: f.owned ? '✓ 已拥有' : ˋ🪙 ${f.cost}ˋ, tone: (f.owned ? '`
- `:162` 💎 — `props: { media: '💎', title: String(rechargeTotal(p)), sub: ˋ${p.bonus > 0 ? ˋ含赠+${p.bonus`
- `:164` 🪙 — `props: { media: '🪙', title: String(x.gold), sub: ˋ💎 ${x.diamond}ˋ, corner: x.tag, action`
- `:164` 💎 — `props: { media: '🪙', title: String(x.gold), sub: ˋ💎 ${x.diamond}ˋ, corner: x.tag, action`
- `:166` 🧩 — `props: { media: '🧩', title: String(x.shards), sub: ˋ💎 ${x.diamond}ˋ, corner: x.tag, acti`
- `:166` 💎 — `props: { media: '🧩', title: String(x.shards), sub: ˋ💎 ${x.diamond}ˋ, corner: x.tag, acti`
- `:171` 💎 — `{ type: 'Label', id: 'wallet-ex-h', props: { text: '兑换金币 · 💎 → 🪙（改造坊通用材料）', size: 'md', `
- `:171` 🪙 — `{ type: 'Label', id: 'wallet-ex-h', props: { text: '兑换金币 · 💎 → 🪙（改造坊通用材料）', size: 'md', `
- `:173` 💎 — `{ type: 'Label', id: 'wallet-shard-h', props: { text: '兑换地支碎片 · 💎 → 🧩（养地支专属材料）', size: '`
- `:173` 🧩 — `{ type: 'Label', id: 'wallet-shard-h', props: { text: '兑换地支碎片 · 💎 → 🧩（养地支专属材料）', size: '`
- `:177` 🛒 — `type: 'Modal', id: 'shop-modal', props: { title: '🛒 商城', size: 'lg', closeAction: 'closeO`
- `:183` 🪙 — `{ type: 'Label', id: 'shop-bal-coin', props: { size: 'md', color: 'text', spans: [iconSpan`
- `:184` 💎 — `{ type: 'Label', id: 'shop-bal-dia', props: { size: 'md', color: 'sub', spans: [iconSpan('`
- `:185` 🔶 — `{ type: 'Label', id: 'shop-bal-tsh', props: { size: 'md', color: 'warn', spans: [iconSpan(`
- `:186` 🧩 — `{ type: 'Label', id: 'shop-bal-dsh', props: { size: 'md', color: 'warn', spans: [iconSpan(`
- `:188` 🎴 — `{ type: 'Tabs', id: 'shop-tabs', props: { tabs: [{ id: 'gacha', label: '🎴 抽卡' }, { id: 'f`
- `:188` 💎 — `{ type: 'Tabs', id: 'shop-tabs', props: { tabs: [{ id: 'gacha', label: '🎴 抽卡' }, { id: 'f`
- `:200` 🎴 — `type: 'Modal', id: 'lucky-modal', props: { title: '🎴 掷命 · 今日卦象', size: 'sm', closeAction:`
- `:261` 🪟 — `type: 'Panel', id: 'launch-panel', props: { title: '🪟 大厅浮层 · Modal/Drawer（点开各浮层）' },`
- `:265` 📖 — `{ type: 'Button', id: 'open-help', props: { ...iconBtnProps('manual', '📖', '帮助中心'), kind:`
- `:266` ⚙ — `{ type: 'Button', id: 'open-settings', props: { ...iconBtnProps('settings', '⚙', '设置'), ki`
- `:267` 🛒 — `{ type: 'Button', id: 'open-shop', props: { ...iconBtnProps('shop', '🛒', '商城'), kind: 'gh`
- `:268` 🎴 — `{ type: 'Button', id: 'open-lucky', props: { ...iconBtnProps('fortune', '🎴', '今日卦象'), kin`
- `:269` 📜 — `{ type: 'Button', id: 'open-story', props: { ...iconBtnProps('story', '📜', '开场故事'), kind:`

### `player-ai.ts`

- `:47` ★ — `rng: { type: b.rng.type, seed: b.rng.seed, sequence: b.rng.sequence }, // ★ 深拷 rng·推演在副本 r`

### `portraits.ts`

- `:5` ♠ — `export type Suit = '♠' | '♥' | '♦' | '♣';`
- `:5` ♥ — `export type Suit = '♠' | '♥' | '♦' | '♣';`
- `:5` ♦ — `export type Suit = '♠' | '♥' | '♦' | '♣';`
- `:5` ♣ — `export type Suit = '♠' | '♥' | '♦' | '♣';`
- `:8` ♠ — `const SUIT_HEX: Record<Suit, string> = { '♠': '#6b8fc4', '♥': '#e0635f', '♦': '#e6a24a', '`
- `:8` ♥ — `const SUIT_HEX: Record<Suit, string> = { '♠': '#6b8fc4', '♥': '#e0635f', '♦': '#e6a24a', '`
- `:8` ♦ — `const SUIT_HEX: Record<Suit, string> = { '♠': '#6b8fc4', '♥': '#e0635f', '♦': '#e6a24a', '`
- `:8` ♣ — `const SUIT_HEX: Record<Suit, string> = { '♠': '#6b8fc4', '♥': '#e0635f', '♦': '#e6a24a', '`
- `:9` ♠ — `const SUIT_KEY: Record<Suit, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };`
- `:9` ♥ — `const SUIT_KEY: Record<Suit, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };`
- `:9` ♦ — `const SUIT_KEY: Record<Suit, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };`
- `:9` ♣ — `const SUIT_KEY: Record<Suit, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };`
- `:79` ♠ — `const SUIT_LETTER: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };`
- `:79` ♥ — `const SUIT_LETTER: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };`
- `:79` ♦ — `const SUIT_LETTER: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };`
- `:79` ♣ — `const SUIT_LETTER: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };`

### `simulate-balance.ts`

- `:28` ★ — `const cardRank = (c: ArmyCard): string => (c.rank === 'JOKER' ? '★' : c.rank);`
- `:125` ★ — `mirror = false, // ★裸镜像诊断（程序A 2026-07-04·design G 验收「双方同牌·公平底层」）：Boss 牌也 base-override(同玩家`
- `:302` ★ — `console.log('║  ★裸镜像诊断 · 双方同牌同规则 · 玩家+地支+先手 · N=' + MIRROR_RUNS + '     ║');`
- `:327` ⚠ — `console.log('⚠ Boss 16 写死牌组 + dishaScale 尚未接入 loader（doc27 §六派甲）→ 本扫描用旧 favorBias 模型，标定为「临`

### `turn-battle-screen.ts`

- `:21` ♠ — `const SUITG: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };`
- `:21` ♥ — `const SUITG: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };`
- `:21` ♦ — `const SUITG: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };`
- `:21` ♣ — `const SUITG: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };`
- `:23` 🐀 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐂 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐅 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐇 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐉 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐍 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐎 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐑 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐒 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐓 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐕 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:23` 🐖 — `const ZOD_ICON: Record<string, string> = { 鼠: '🐀', 牛: '🐂', 虎: '🐅', 兔: '🐇', 龙: '🐉', 蛇:`
- `:151` 💢 — `export interface TurnSlotView { hasUnit: boolean; mine: boolean; isBorder: boolean; isClas`
- `:197` ♔ — `const crown: LayoutNode = { type: 'Label', id: ˋfort-${who}-crownˋ, props: { text: '♔', si`
- `:199` ♠ — `const shield: LayoutNode = { type: 'Panel', id: ˋfort-${who}-shieldˋ, props: { bg: { custo`
- `:199` ♥ — `const shield: LayoutNode = { type: 'Panel', id: ˋfort-${who}-shieldˋ, props: { bg: { custo`
- `:211` 👑 — `const bossTip = ˋ<div class="gg-tip" style="width:210px;text-align:left;"><div style="font`
- `:250` ☠ — `if (isGen) children.push({ type: 'Label', id: ˋu-${id}-genˋ, props: { text: s.mine ? '⭐主将'`
- `:251` 💢 — `if (s.fatiguePm) children.push({ type: 'Label', id: ˋu-${id}-wsˋ, props: { text: ˋ💢${Math`
- `:252` 🛡 — `if (s.held) children.push({ type: 'Label', id: ˋu-${id}-holdˋ, props: { size: 15, glow: tr`
- `:252` 🛡 — `if (s.held) children.push({ type: 'Label', id: ˋu-${id}-holdˋ, props: { size: 15, glow: tr`
- `:291` 👆 — `{ type: 'Label', id: ˋ${cid}-tapˋ, props: { text: '👆', size: 25 } },`
- `:294` ⚔ — `if (s.forecast != null) { const [lab] = oddsTier(s.forecast); const pct = Math.round(s.for`
- `:401` ⚔ — `{ type: 'Label', id: 'clash-title', props: { text: '⚔ 绝命对决', size: 38, color: 'gold', bold`
- `:430` 🎲 — `{ type: 'Label', id: ˋclash-die3d-ph-${s}ˋ, props: { text: '🎲', size: 30, color: 'text' }`
- `:451` ⚔ — `children: [sideStack(true), clashChip('clash-vs-pill', revealed ? '掷' : '⚔', 'gold', 'md')`
- `:454` 🎲 — `: { type: 'Label', id: 'clash-dice-hint', props: { text: '🎲 骰盅翻滚中 · 点掷战力骰定生死', size: 'xs'`
- `:459` ⚔ — `const verdict = (c: TurnClashCardView): string => c.won ? '⚔ 胜 · 留场续战' : c.lastStand ? '🛡`
- `:459` 🛡 — `const verdict = (c: TurnClashCardView): string => c.won ? '⚔ 胜 · 留场续战' : c.lastStand ? '🛡`
- `:485` ⚖ — `children: [{ type: 'Label', id: 'clash-extras-h', props: { text: '⚖ 额外效果', size: 'xs', col`
- `:499` 🎲 — `: { type: 'Button', id: 'clash-roll-btn', props: { ...(iconUri('dice') ? { label: '掷战力骰 ▸'`
- `:499` 🎲 — `: { type: 'Button', id: 'clash-roll-btn', props: { ...(iconUri('dice') ? { label: '掷战力骰 ▸'`
- `:526` ♠ — `children: [{ type: 'Avatar', id: 'ggt-tb-seal', props: { name: '♠', shape: 'rounded', size`
- `:546` ⚙ — `{ type: 'Button', id: 'ggt-tb-gear', props: { label: '⚙', kind: view.settingsOpen ? 'prima`
- `:608` ⚙ — `{ type: 'Label', id: 'ggt-set-title', props: { text: '⚙ 设置', size: 'xs', color: 'dim', bol`
- `:609` 🔊 — `tog('sfx', ˋ${view.sfxOn ? '🔊' : '🔇'} 音效ˋ, view.sfxOn, 'toggle-sfx'),`
- `:609` 🔇 — `tog('sfx', ˋ${view.sfxOn ? '🔊' : '🔇'} 音效ˋ, view.sfxOn, 'toggle-sfx'),`
- `:610` 🎵 — `tog('bgm', '🎵 背景音乐', view.bgmOn, 'toggle-bgm'),`
- `:617` ♪ — `props: { label: (view.bgmIdx === i ? '♪ ' : '') + nm, kind: view.bgmIdx === i ? 'primary' `
- `:630` 🎓 — `children.push(tog('guide', '🎓 新手引导', !!view.guideOn, 'toggle-guide'));`
- `:644` 🎓 — `{ type: 'Label', id: 'ggt-narr-ic', props: { text: '🎓', size: 22 } },`
- `:682` 👹 — `{ type: 'Label', id: 'shatip-n', props: { text: ˋ👹 ${s.name} · ${rc[0]}ˋ, size: 12, color`
- `:684` ⚑ — `{ type: 'Label', id: 'shatip-s', props: { text: used ? '⚑ 已发动' : '⏳ 待发动 · 战斗中择机触发', size: `
- `:689` ♥ — `{ type: 'Panel', id: 'rail-hdr-ic', props: { bg: { custom: 'linear-gradient(150deg,#7a3340`
- `:699` 💧 — `return { type: 'Panel', id: 'rail', props: {}, layout: { width: 206, direction: 'column', `
- `:699` 🎴 — `return { type: 'Panel', id: 'rail', props: {}, layout: { width: 206, direction: 'column', `
- `:719` 🎴 — `cntChip('hand', '🎴', '手牌', view.hand.length),`
- `:838` 🎴 — `const ACT: [string, string, string][] = [['draw', '🎴', '抽'], ['play', '♟', '打'], ['swap',`
- `:838` ♟ — `const ACT: [string, string, string][] = [['draw', '🎴', '抽'], ['play', '♟', '打'], ['swap',`
- `:838` ♺ — `const ACT: [string, string, string][] = [['draw', '🎴', '抽'], ['play', '♟', '打'], ['swap',`
- `:844` 💧 — `draw: ˋ抽牌:天罡/扑克二选一 · 各花 💧${DRAW_COST} 源泉ˋ,`
- `:845` 💧 — `play: '打牌:部署扑克(按点数)/打天罡(💧1)·天罡+扑克可混·有源泉就打',`
- `:854` 🎴 — `{ id: 'draw-poker', glyph: '🎴', label: '抽扑克', cost: ˋ💧${DRAW_COST}ˋ, active: false, disa`
- `:854` 💧 — `{ id: 'draw-poker', glyph: '🎴', label: '抽扑克', cost: ˋ💧${DRAW_COST}ˋ, active: false, disa`
- `:855` 💧 — `{ id: 'draw-tengang', glyph: '✦', label: '抽天罡', cost: ˋ💧${DRAW_COST}ˋ, active: false, dis`
- `:858` ♟ — `{ id: 'play-poker', glyph: '♟', label: '部署扑克', cost: '💧按点', active: playKind === 'deploy'`
- `:858` 💧 — `{ id: 'play-poker', glyph: '♟', label: '部署扑克', cost: '💧按点', active: playKind === 'deploy'`
- `:859` 💧 — `{ id: 'play-tengang', glyph: '✦', label: '打天罡', cost: ˋ💧${CAST_COST}ˋ, active: playKind =`
- `:862` 🎴 — `{ id: 'swap-poker', glyph: '🎴', label: '补扑克', cost: '免费', active: swapFrom === 'poker', d`
- `:948` 🎲 — `if (!dice3dMod) { // three 后端动态 import（首次掷命拉·模块到位前 🎲 占位）`
- `:957` 🎲 — `if (!anchor || !r || r.width < 2 || r.height < 2) { killDie3DSlot(s); return; } // 无锚点/无头量`
- `:965` 🎲 — `s.sig = s.handle ? sig : ''; // 建失败(无 WebGL)→ 不记签名（headless 恒失败·🎲 占位兜底）`

### `turn-combat.ts`

- `:64` ★ — `const FAST_RANKS = new Set(['★', '王', 'JOKER', 'K']);`
- `:265` ⚠ — `else if (op === 'jumpToMid') { // 抢滩：我该路整列即时抢到中线（逐格推进到前锋达中线·卡住即停·不越敌/不越界）·⚠"新部署兵"语义→即时现兵版·`
- `:651` ★ — `const why = collides ? '★碰撞→掷命' : !mobile ? (front.hold ? '守军静守·不撞' : '主将死守·不撞') : ˋ走位不打（前`
- `:652` ★ — `say(ˋ[${sideNm}·${LN[li]}路] 前锋 ${front.rank}${front.suit}@${beforeMap.get(front.id)} · 敌前锋`

