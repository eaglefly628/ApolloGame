import { mountLobby } from './lobby-dd.js'; // 全数据驱动大厅（Step A·owner 2026-06-25 上线）·签名同旧 mountLobby
import { luckyBattleBuff, luckyFromVal, type LobbyView, type LobbyShopItem } from './lobby-types.js';
import { armyFromFormation, quartermasterEnergy, battleSpec, RUN_BATTLES, BETWEEN_BUFFS, applyBuff, tiangangKeyBuffs, bossFor, GAME_G_TIANGANGS, TIANGANG_BY_ID, isRetiredTiangang, ARCHETYPES, detectArchetype, archetypeMatchup, activeArchetype, pickAiFormation, GAME_G_PLANETS, GAME_G_FOILS, RECHARGE_PACKS, rechargeTotal, DIAMOND_EXCHANGES, DIZHI_SHARD_PACKS, RECHARGE_PASSWORD, GACHA, gachaCost, DIZHI_TIER_NM, DIZHI_TIER_CAP, DIZHI_INLAY_FAVOR, dizhiMerge, dizhiTotal, dizhiTopTier, DIZHI_ZODIACS, INLAY_MAX, effectiveDeckFavors, POKER_PICK_SIZE, isPoolCardId, autoBuildPokerPicks, cardFavorIndex, deployCost, isHeroOwned, heroNameOf, effectiveLives, effectiveLeverCap, effectiveLeverRegen, campaignFor, unlockStageOf, type Formation, type Intervention, type RunBuff, type ArmyCard } from './index.js';
import { type ClashEvent } from './combat-types.js';
// 抽出的纯函数模块（Phase 2 拆分·见各文件头注）：存档/出战编排/掷命特写视图。公共 API(buildPickDeck/bossHeroCard/
// aggregateTengang/tengangFxOf/freshSave)在文件尾从这里再导出，保 deck-wiring/live-combat/turnmatch 测试 import 不变。
import { freshSave, loadSave, persist, resetFortuneIfNewDay, FORTUNE_MAX, activeDeck, syncTiangangs, newDeckId, rollBoss, TIANGANG_DECK_SIZE, MAX_TIANGANG_DECKS, DEFAULT_STARTER_TIANGANGS } from './game-g-save.js';
import { favorToP, cardRank, avg, describeFormation, pick3, buildPickDeck, bossHeroCard, aggregateTengang, seededShuffleArr } from './game-g-build.js';
import { clashToTurnView } from './game-g-clash-view.js';
import { initTurnBattle, drawCard, deployUnit, castTengang, castTengangAt, swapCard, advanceMovePhase, resolveClashAt, endTurnFinish, aiDecide, bossOpeningGarrison, debugGrantTengang, debugAddMana, OPENING_HAND, DRAW_COST, CAST_COST, SWAP_PER_TURN, type PokerCard, type TengangHandCard, type Card } from './turn-combat.js';
import { DISHA_NAME, stageDisha } from './disha.js';
import { mountTurnBattle, buildTurnBattleView, type TurnBattleView, type TurnBattleActions, type TurnClashView, type TurnShaView } from './turn-battle-screen.js';
// 掷硬币（战胜硬币）已随「确定制」退役为死代码（owner 2026-07-01「掷硬币这环节没意义·太繁琐·先放死代码等以后可能用」）：
// 模块 coin-flip.ts 保留（含测试），此屏不再消费。未来「各自掷战力骰」向见 docs/design/game-g-clash-fate-roll-vision.md。
import { loadLevel } from './level.js';
import { cardPoints } from './clash-resolve.js';
import { playSfx, isSfxOn, toggleSfx } from './sound.js';
import { startBgm, stopBgm, toggleBgm as toggleBgmState, selectBgm as selectBgmState, setBgmVolume, isBgmOn, bgmTrackIdx, bgmVolume, BGM_TRACKS } from './bgm.js';
import { makeCoachWorld, nextCoachStep, type BattleCoachStep } from './battle-coach.js';
import { mountBattleTimeline } from './battle-timeline.js'; // 战斗演出走引擎 t3-timeline（owner 2026-07-03「用 timeline·不手写排程」）
import { mountOnboardingOverlay } from '@ui/onboarding-overlay.js';
import { mountUI } from '@ui/components/index.js'; // 引擎数据驱动 UI 解释器（采纳·替手写 DOM）
import type { LayoutNode, ButtonProps, LabelProps, PanelProps, ScreenProps } from '@ui/components/types.js';
import { GG_THEME_ONYX } from './ui-theme.js'; // game-g 古风主题（数据·喂引擎 UI 解释器换皮）
import { ggOnBattleWon } from './platform-hooks.js'; // 平台触点（Steam/假 Steam·胜利成就/排行/富状态）

// 公共 API 再导出（保旧 import 路径不变·勿删）：deck-wiring 测 ← buildPickDeck/bossHeroCard；live-combat 测 ← aggregateTengang/tengangFxOf；freshSave 历史导出。
export { buildPickDeck, bossHeroCard, aggregateTengang, tengangFxOf } from './game-g-build.js';
export { freshSave } from './game-g-save.js';

// Game G ·《翻命扑克》—— 大厅 ↔ 出征 闭环（launcher 卡带槽：export mount(container)→cleanup）。自包含于本目录。
// outcome-first：每张牌按 favor 跑确定性种子硬币**先定生死**，3D 翻牌是**反推的表现**（抛飞→相撞→落定翻面）。
// 闭环：大厅看材料/牌组 → 花材料改造牌组(升 favor) → 出征打一关(回合制 showTurnMatch) → 赢取材料、关卡递增 → 再改造。
// 进度本地存档；胜负=数据决策（不回灌）；3D 只在 ThreeRenderer 表现层。是 gameF 大厅式挂载编排，复用现成能力。
// 大厅根容器样式：默认屏(布阵/备战/战斗)居中竖排；大厅屏改顶对齐可滚动(承载 5 tab 古风布局)。
const DEFAULT_ROOT_CSS = 'position:absolute;inset:0;background:#0a0a14;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#cbd5e1;font:13px system-ui';
const LOBBY_ROOT_CSS = 'position:absolute;inset:0;overflow:auto';
// 敌方 favor 偏置随关卡递增（旧实时路遗留·当前回合制 spec.enemyBias 直供·保留）。


export function mount(container: HTMLElement, shell?: { exit?: () => void }): () => void {
  const save = loadSave();
  let stopLoop: (() => void) | null = null; // live-combat rAF 驱动停手（替掉旧 Engine 时钟）
  let battle: { update: () => void; destroy: () => void } | null = null;
  let lobby: { update: () => void; destroy: () => void } | null = null; // 大厅忠实港挂载句柄
  let lobbySkin: 'onyx' | 'rosy' = 'onyx'; // 双皮：玄铁(暗)/锦霞(亮)，纯表现、不入存档

  const root = document.createElement('div');
  root.style.cssText = DEFAULT_ROOT_CSS;
  container.appendChild(root);

  // 背景音乐：autoplay 策略要求用户手势后才能出声 → 首次 pointerdown 起播（若开·引擎端口内部 resume）。
  const bgmKick = (): void => { startBgm(); };
  container.addEventListener('pointerdown', bgmKick, { once: true });

  const teardownMatch = (): void => {
    if (stopLoop) stopLoop();
    if (battle) battle.destroy();
    stopLoop = null;
    battle = null;
  };
  const clear = (): void => {
    teardownMatch();
    if (lobby) { lobby.destroy(); lobby = null; }
    root.replaceChildren();
    root.style.cssText = DEFAULT_ROOT_CSS; // 离开大厅时还原默认屏样式
  };

  // ───────────────────────── 大厅（5 tab IA · 顶栏 · 玄铁/锦霞双皮 · 对齐 UI/Game G 大厅.dc.html）─────────────────────────
  // owner 指「裸按钮堆 ≠ 设计稿」(design/16 §十一)：重做成 大厅/牌组/收藏/改造坊/天梯 五屏 + 顶栏 + 古风双皮。
  // 真实存档数据驱动；未接网的(好友/天梯1v1/全服榜)诚实标「占位」，绝不伪造功能。
  function showLobby(): void {
    clear();
    root.style.cssText = LOBBY_ROOT_CSS;
    const host = document.createElement('div');
    root.appendChild(host);
    // 大厅视图：真实存档（材料/能量/牌组 favor/天罡/星球/闪艺/战役进度/流派↔Boss 克制）→ 喂忠实港渲染器。未接网项渲染器内诚实占位。
    const buildLobbyView = (): LobbyView => {
      const effDeck = effectiveDeckFavors(save.deck, save.inlays); // 地支附魔后的有效 favor（展示+战斗一致·档位锁定在 inlays 条目里）
      const boss = bossFor(save.bossIdx);
      const arch = detectArchetype(save.tiangangs);
      const activated = activeArchetype(save.tiangangs);
      const bossArchName = ARCHETYPES.find((a) => a.id === boss.archetype)?.name ?? boss.archetype;
      let archLine: string;
      if (arch) {
        const m = archetypeMatchup(arch.id, boss.archetype);
        const rel = m === 'counter' ? '<b style="color:var(--club)">⮞ 克制 Boss</b>' : m === 'countered' ? '<b style="color:var(--heart)">⮜ 被 Boss 克</b>' : '<span class="ghost">≈ 互不克</span>';
        const act = activated === arch.id ? '　<b style="color:var(--gold)">🔥 招牌已激活</b>' : `　<span class="ghost">集齐 ${arch.keyTiangangs.map((k) => TIANGANG_BY_ID.get(k)?.name ?? k).join('+')} 激活招牌</span>`;
        archLine = `你的流派 <b>${arch.name}</b>（${arch.desc}）　${rel}${act}`;
      } else {
        archLine = `流派 <span class="ghost">未成型</span> —— 去<b>改造坊</b>融天罡牌确立身份（克制本 run Boss【${bossArchName}】）`;
      }
      const cap = effectiveLeverCap(save.planets);
      // B3: owned=已买入(ownedTiangangs)；inDeck=已选入战库(jokers ≤5)；buyable=未买且材料够
      const tiangangs: LobbyShopItem[] = GAME_G_TIANGANGS.filter((j) => !isRetiredTiangang(j.id)).map((j) => { const owned = save.ownedTiangangs.includes(j.id); const us = unlockStageOf(j.id); const locked = us > save.campaignMax; return { id: j.id, name: j.name, sub: j.text, cost: j.cost, owned, inDeck: save.tiangangs.includes(j.id), buyable: !owned && !locked && save.materials >= j.cost, power: j.power, phat: j.phat, kind: j.kind, icon: j.icon, tint: j.tint, unlockStage: us, locked }; }); // 剔除退役/暂缓天罡（片D·防买空头卡）
      const planets: LobbyShopItem[] = GAME_G_PLANETS.map((p) => ({ id: p.id, name: p.name, sub: p.text, cost: p.cost, owned: false, level: save.planets[p.id] ?? 0, buyable: save.materials >= p.cost }));
      const foils: LobbyShopItem[] = GAME_G_FOILS.map((f) => { const owned = save.foils.includes(f.id); return { id: f.id, name: f.name, sub: f.desc, cost: f.cost, owned, buyable: !owned && save.materials >= f.cost }; });
      const heart = save.lives > 0 ? '❤'.repeat(save.lives) : '—';
      resetFortuneIfNewDay(save); // 跨日则清零今日卦象（不落盘·读时纠正即可）
      return {
        skin: lobbySkin, coin: save.materials, diamond: save.diamond, dizhiShards: save.dizhiShards, tiangangShards: save.tiangangShards, dizhiBag: save.dizhiBag, rechargeNeedsPassword: save.rechargeCount >= 1, campaignMax: save.campaignMax, firstLaunch: !save.seenIntro, guideStep: save.skipGuide ? -1 : save.guideStep, guideOn: !save.skipGuide, energy: save.leverEnergy, energyMax: cap, foilCount: save.foils.length,
        name: '不翻就赢_07', mainCard: '黑桃A「掷命尖兵」', rankText: `战役 第 ${save.campaignMax} 关 / 共 52`,
        stageLabel: `第 ${save.stage} 关 · 全 52 役 · 终局 Boss【${boss.name}】`,
        archLine, bossLine: `${boss.persona} · 流派【${bossArchName}】— 据其针对布阵`,
        deckAvg: avg(effDeck), deckMin: Math.min(...effDeck), deckMax: Math.max(...effDeck), deck: effDeck, inlays: save.inlays,
        tiangangs, planets, foils,
        campaign: campaignFor(save.stage),
        decks: save.tiangangDecks.map((d) => ({ id: d.id, name: d.name, size: d.cards.length, pokerSize: d.pokerPicks.length, active: d.id === save.activeDeckId })),
        deckSize: TIANGANG_DECK_SIZE, activeDeckName: activeDeck(save).name, canAddDeck: save.tiangangDecks.length < MAX_TIANGANG_DECKS,
        pokerPicks: activeDeck(save).pokerPicks, pokerPickMax: POKER_PICK_SIZE, // 出战扑克牌组构筑（乙1·契约A）
        deckArchName: arch?.name ?? null, deckArchActivated: activated !== null,
        fortune: { rolls: save.fortune.rolls, max: FORTUNE_MAX, keptVal: save.fortune.keptVal }, // 今日卦象（owner 2026-06-21）
        ladderLines: [
          `<h2>⚔️ 战役进度</h2><div class="bigrank">第 ${save.stage} / ${RUN_BATTLES} 战</div><div class="meta" style="margin-top:6px">命 ${heart} · 能量 ◈${save.leverEnergy}/${cap} · 材料 🪙${save.materials}</div>`,
          `<h2>🏆 终局 Boss</h2><div class="bigrank" style="color:var(--heart)">${boss.name}</div><div class="meta" style="margin-top:6px">${boss.persona} · 流派【${bossArchName}】</div>`,
        ],
      };
    };
    const buy = (cost: number, apply: () => void): void => { if (save.materials < cost) return; save.materials -= cost; apply(); persist(save); };
    lobby = mountLobby(host, {
      getView: buildLobbyView,
      onPlay: () => startBattle(),
      // 金币解锁（doc25）：需该关已抵达(unlockStage ≤ campaignMax) + 金币够 → ownedTiangangs；牌组未满自动选入
      onBuyTiangang: (id) => { const j = TIANGANG_BY_ID.get(id); if (!j || save.ownedTiangangs.includes(id) || unlockStageOf(id) > save.campaignMax) return; buy(j.cost, () => { save.ownedTiangangs.push(id); const d = activeDeck(save); if (d && d.cards.length < TIANGANG_DECK_SIZE) { d.cards.push(id); syncTiangangs(save); } }); },
      // 钻石速购（doc25 · 跳 grind·只加速）：无视关门槛，花钻石(=unlockStage)直解。
      onDiamondUnlock: (id) => { const j = TIANGANG_BY_ID.get(id); if (!j || save.ownedTiangangs.includes(id)) return; const dc = unlockStageOf(id); if (save.diamond < dc) return; save.diamond -= dc; save.ownedTiangangs.push(id); const d = activeDeck(save); if (d && d.cards.length < TIANGANG_DECK_SIZE) { d.cards.push(id); syncTiangangs(save); } persist(save); },
      // 钻石商城（owner 2026-06-20 · Demo 假支付）：充值 ¥→💎（越充越送·上限64）/ 兑换 💎→🪙材料 / 兑换 💎→地支碎片
      // 投资人彩蛋：首充（rechargeCount===0）免密「送一点点」；第二次起需密码=RECHARGE_PASSWORD。返回 true=成功（供 UI 提示密码错误）。
      onRecharge: (packId, password) => { const p = RECHARGE_PACKS.find((x) => x.id === packId); if (!p) return false; if (save.rechargeCount >= 1 && password !== RECHARGE_PASSWORD) return false; save.diamond += rechargeTotal(p); save.rechargeCount += 1; persist(save); return true; },
      onExchange: (exId) => { const x = DIAMOND_EXCHANGES.find((e) => e.id === exId); if (!x || save.diamond < x.diamond) return; save.diamond -= x.diamond; save.materials += x.gold; persist(save); },
      // 今日卦象（owner 2026-06-21 · 纯趣味不进战斗）：每日限掷 FORTUNE_MAX 次（跨日刷新）；收下=持久化选中→主页顶展示。
      onRollFortune: () => { resetFortuneIfNewDay(save); if (save.fortune.rolls >= FORTUNE_MAX) return null; save.fortune.rolls += 1; const v = 1 + Math.floor(Math.random() * 100); persist(save); return v; },
      onKeepFortune: (val) => { resetFortuneIfNewDay(save); save.fortune.keptVal = Math.max(1, Math.min(100, Math.round(val))); persist(save); },
      onBuyShards: (exId) => { const x = DIZHI_SHARD_PACKS.find((e) => e.id === exId); if (!x || save.diamond < x.diamond) return; save.diamond -= x.diamond; save.dizhiShards += x.shards; persist(save); },
      // 抽卡（doc25 §四 · Demo）：从已解锁池随机；天罡重复→碎片，地支新得=铜/重复升档/满金→碎片。返回抽取结果供开包演出。
      onGacha: (pool, count, pay) => {
        const c = gachaCost(pool, count, pay);
        if (save.materials < c.gold || save.diamond < c.diamond) return null;
        if (pool === 'tiangang') {
          const poolCards = GAME_G_TIANGANGS.filter((t) => unlockStageOf(t.id) <= save.campaignMax && !isRetiredTiangang(t.id)); // 剔除退役/暂缓天罡（片D）
          if (poolCards.length === 0) return null;
          save.materials -= c.gold; save.diamond -= c.diamond;
          const res = [];
          for (let i = 0; i < count; i++) {
            const t = poolCards[Math.floor(Math.random() * poolCards.length)];
            if (save.ownedTiangangs.includes(t.id)) { save.tiangangShards += GACHA.tiangang.dupShards; res.push({ kind: 'tiangang' as const, id: t.id, name: t.name, rarity: t.rarity, outcome: 'dup-shard' as const, detail: `重复 · +${GACHA.tiangang.dupShards} 天罡碎片` }); }
            else { save.ownedTiangangs.push(t.id); const d = activeDeck(save); if (d && d.cards.length < TIANGANG_DECK_SIZE) { d.cards.push(t.id); syncTiangangs(save); } res.push({ kind: 'tiangang' as const, id: t.id, name: t.name, rarity: t.rarity, outcome: 'new' as const, detail: '新获得！' }); }
          }
          persist(save); return res;
        }
        save.materials -= c.gold; save.diamond -= c.diamond;
        const res = [];
        for (let i = 0; i < count; i++) {
          const z = DIZHI_ZODIACS[Math.floor(Math.random() * DIZHI_ZODIACS.length)];
          // 抽地支 = 进卡包一张「铜」活化 → 自动三合升档（满3铜→1银→1金；封顶金·钻待开放·满金溢出转碎片）。
          const before = save.dizhiBag[z.branch] ?? [0, 0, 0];
          const wasNew = dizhiTotal(before) === 0;
          const merged = dizhiMerge([(before[0] ?? 0) + 1, before[1] ?? 0, before[2] ?? 0]);
          const topBefore = dizhiTopTier(before), topNow = dizhiTopTier(merged);
          if (topBefore >= DIZHI_TIER_CAP) {
            // 已满金：不再堆叠，溢出转地支碎片（避免无限堆金）。
            save.dizhiShards += GACHA.dizhi.maxDupShards;
            res.push({ kind: 'dizhi' as const, id: z.branch, name: `${z.animal}·金`, outcome: 'dizhi-shard' as const, detail: `${z.animal} 满金 · +${GACHA.dizhi.maxDupShards} 地支碎片` });
          } else {
            save.dizhiBag[z.branch] = merged;
            const outcome: 'new' | 'dizhi-up' = wasNew ? 'new' : 'dizhi-up';
            res.push({ kind: 'dizhi' as const, id: z.branch, name: `${z.animal}·${DIZHI_TIER_NM[topNow]}`, outcome, detail: wasNew ? `新生肖 ${z.animal} · 铜 ×1` : topNow > topBefore ? `${z.animal} 三合升档 → ${DIZHI_TIER_NM[topNow]}` : `${z.animal} 卡包 +1（${DIZHI_TIER_NM[topNow]} ×${dizhiTotal(merged)}）` });
          }
        }
        persist(save); return res;
      },
      // 天罡碎片定向兑换（保底·可控 build）：花碎片直获指定已解锁天罡。
      onCraftTiangang: (id) => {
        const t = TIANGANG_BY_ID.get(id); if (!t || save.ownedTiangangs.includes(id) || unlockStageOf(id) > save.campaignMax) return false;
        if (save.tiangangShards < GACHA.tiangang.craftShards) return false;
        save.tiangangShards -= GACHA.tiangang.craftShards; save.ownedTiangangs.push(id);
        const d = activeDeck(save); if (d && d.cards.length < TIANGANG_DECK_SIZE) { d.cards.push(id); syncTiangangs(save); }
        persist(save); return true;
      },
      // 地支碎片定向兑换（owner 2026-06-21）：花地支碎片 → 卡包 +1 铜活化 → 自动三合升档（满金封顶·钻待开放）。
      onCraftDizhi: (branch) => {
        const before = save.dizhiBag[branch] ?? [0, 0, 0];
        if (dizhiTopTier(before) >= DIZHI_TIER_CAP && (before[DIZHI_TIER_CAP - 1] ?? 0) >= 3) return false; // 满金且无法再合：不收碎片
        if (save.dizhiShards < GACHA.dizhi.craftShards) return false;
        save.dizhiShards -= GACHA.dizhi.craftShards;
        save.dizhiBag[branch] = dizhiMerge([(before[0] ?? 0) + 1, before[1] ?? 0, before[2] ?? 0]);
        persist(save); return true;
      },
      // 地支附魔（owner 2026-06-21 消耗品）：把卡包里某生肖某档的一张活化镶进牌位（≤INLAY_MAX 槽）→ +favor。
      // **消耗**：卡包该档 −1（永久·镶入即扣）；条目锁定 {b,t}（favor 固定此档）。tier 缺省取该生肖最高在持档。
      onInlay: (idx, branch, tier) => {
        const bag = save.dizhiBag[branch]; if (!bag) return false;
        const t = (tier && tier >= 1 && tier <= DIZHI_TIER_CAP) ? tier : dizhiTopTier(bag);
        if (t < 1 || (bag[t - 1] ?? 0) < 1) return false; // 该档无在持活化
        const cur = save.inlays[idx] ?? []; if (cur.length >= INLAY_MAX) return false;
        bag[t - 1] -= 1; // 消耗一张（不退）
        save.inlays[idx] = [...cur, { b: branch, t }];
        persist(save); return true;
      },
      // 卸下某牌位第 slot 个镶嵌条目（永久消耗不退·只腾槽，不回卡包）。
      onRemoveInlay: (idx, slot) => { const cur = save.inlays[idx]; if (!cur || slot < 0 || slot >= cur.length) return; cur.splice(slot, 1); if (cur.length === 0) delete save.inlays[idx]; persist(save); },
      onBuyPlanet: (id) => { const p = GAME_G_PLANETS.find((x) => x.id === id); if (!p) return; buy(p.cost, () => { save.planets[id] = (save.planets[id] ?? 0) + 1; }); },
      onBuyFoil: (id) => { const f = GAME_G_FOILS.find((x) => x.id === id); if (!f || save.foils.includes(id)) return; buy(f.cost, () => save.foils.push(id)); },
      // 选入/踢出**出战牌组**（需已拥有；每组上限 TIANGANG_DECK_SIZE）；改完同步 save.tiangangs（契约②）
      onToggleTiangang: (id) => { if (!save.ownedTiangangs.includes(id)) return; const d = activeDeck(save); if (!d) return; if (d.cards.includes(id)) { d.cards = d.cards.filter((c) => c !== id); } else if (d.cards.length < TIANGANG_DECK_SIZE) { d.cards.push(id); } syncTiangangs(save); persist(save); },
      // 牌组管理（owner 2026-06-20 多牌组）：选出战 / 新建 / 删除
      onSelectDeck: (id) => { if (save.tiangangDecks.some((d) => d.id === id)) { save.activeDeckId = id; syncTiangangs(save); persist(save); } },
      onNewDeck: () => { if (save.tiangangDecks.length >= MAX_TIANGANG_DECKS) return; const id = newDeckId(); save.tiangangDecks.push({ id, name: `牌组 ${save.tiangangDecks.length + 1}`, cards: [], pokerPicks: [] }); save.activeDeckId = id; syncTiangangs(save); persist(save); },
      // 出战扑克牌组构筑（乙1/乙3·契约A）：点牌入/出（≤16）/ 一键自动构筑（确定性·铺曲线+偏好已养成）/ 清空 → 写 activeDeck.pokerPicks
      onTogglePick: (cardId) => { const d = activeDeck(save); if (!d) return; if (d.pokerPicks.includes(cardId)) d.pokerPicks = d.pokerPicks.filter((c) => c !== cardId); else if (d.pokerPicks.length < POKER_PICK_SIZE && isPoolCardId(cardId)) d.pokerPicks.push(cardId); persist(save); },
      onAutoBuildDeck: () => { const d = activeDeck(save); if (!d) return; d.pokerPicks = autoBuildPokerPicks({ favors: effectiveDeckFavors(save.deck, save.inlays), isOwned: isHeroOwned }); persist(save); },
      onClearPicks: () => { const d = activeDeck(save); if (!d) return; d.pokerPicks = []; persist(save); },
      // 一键配置天罡（owner 2026-06-21）：从已拥有天罡按牌力/胜率影响排序自动凑满这套（≤TIANGANG_DECK_SIZE）。
      onAutoBuildTiangang: () => { const d = activeDeck(save); if (!d) return; const owned = [...save.ownedTiangangs].sort((a, b) => { const ja = TIANGANG_BY_ID.get(a), jb = TIANGANG_BY_ID.get(b); return (jb?.power ?? 0) - (ja?.power ?? 0) || (jb?.phat ?? 0) - (ja?.phat ?? 0) || a.localeCompare(b); }); d.cards = owned.slice(0, TIANGANG_DECK_SIZE); syncTiangangs(save); persist(save); },
      onDelDeck: (id) => { if (save.tiangangDecks.length <= 1) return; save.tiangangDecks = save.tiangangDecks.filter((d) => d.id !== id); if (!save.tiangangDecks.some((d) => d.id === save.activeDeckId)) save.activeDeckId = save.tiangangDecks[0].id; syncTiangangs(save); persist(save); },
      onReset: () => { Object.assign(save, freshSave()); persist(save); },
      onSkin: (s) => { lobbySkin = s; },
      // 首启引导（doc28）：看完开场故事 → 起引导第0步；引导逐步推进；跳过/完成 → guideStep=-1
      onIntroSeen: () => { save.seenIntro = true; if (save.guideStep < 0) save.guideStep = 0; persist(save); },
      onGuideStep: (n) => { save.guideStep = n; persist(save); },
      onGuideDone: () => { save.seenIntro = true; save.guideStep = -1; persist(save); },
      onReplayIntro: () => { save.seenIntro = false; save.guideStep = 0; save.seen = {}; save.skipGuide = false; persist(save); }, // 全量重置引导：开场+大厅引导+战斗 coachmark(seen_*)一起清·并开启引导，从头走一遍（owner 2026-06-21）
      onToggleGuide: () => { save.skipGuide = !save.skipGuide; persist(save); }, // 新手引导开/关（默认开·手动关·owner 2026-06-21）
      onExitGame: shell?.exit, // 退出到游戏库（壳层钩子·收进设置菜单·替代右上角浮钮·owner 2026-06-21）
    });
  }

  // ───────────────────────── 出征前置 · AI 暗布阵（showMatch 用）─────────────────────────
  // AI 暗布阵：纯逻辑下沉到 pickAiFormation（可测）；committed=玩家集齐招牌流派 → AI 全程反制攻你最弱一路。
  const aiFormation = (): Formation => pickAiFormation(save.stage, save.materials, save.lastOfficers, activeArchetype(save.tiangangs) !== null);

  // 出征：旧「布阵分兵 / 备战干预」两屏已废弃 → 点出征直接进战斗。默认用上次布阵；开战前无预置干预。
  // doc24 大转向：战斗走【回合制】(showTurnMatch · turn-combat + turn-battle-screen)，取代旧实时三路(showMatch·保留作参考/帧测)。
  function startBattle(): void {
    const off = [...save.lastOfficers] as [number, number, number];
    showTurnMatch({ officers: off }, describeFormation(off), []);
    // 入场揭幕动画已移除（owner 2026-06-22：掌机模拟器进战斗场闪烁·clip-path/perspective/will-change 在弱合成器上重绘闪）
  }

  // ───────────────────────── 场间整备 · 三选一增益（roguelike 养成核 · 胜后短窗）─────────────────────────
  // 胜一场后进军前的短窗：三随机里选一项 → 选择即流派。池=资源增益 + **流派钥匙(白嫖未拥有天罡)**，
  // 后者把场间选择做成 StS/Balatro 式构筑分叉（design reply#10），不只 +stat。改后落存档、回大厅看下一战。
  // 数据驱动 UI（owner 2026-07-04「主城改动为主」·手写 DOM → LayoutNode，同 goBack 确认框的 mountUI 试点一脉）：
  // 三选一 = 纯数据树，mountUI 是固定解释器；点卡=applyBuff→存档→回大厅（行为与旧手写版逐项一致）。pick3 只调一次，卡与增益一一对应。
  function showBetween(nextLabel: string): void {
    clear();
    const host = document.createElement('div'); // mountUI 挂载宿主（数据 UI 需一个容器·非手写内容）
    host.style.cssText = 'position:absolute;inset:0';
    root.appendChild(host);
    const pool: RunBuff[] = [...BETWEEN_BUFFS, ...tiangangKeyBuffs(save.tiangangs)]; // 资源增益 + 未拥有天罡钥匙
    const picks = pick3(pool);
    let teardown = (): void => {};
    const choose = (bf: RunBuff): void => { applyBuff(save, bf); persist(save); teardown(); showLobby(); };
    const card = (bf: RunBuff, i: number): LayoutNode => {
      const isKey = bf.kind === 'tiangang';
      return {
        type: 'Panel', id: `gg-btw-card-${i}`,
        props: { bg: isKey ? 'void' : 'ink-deep', action: `pick-${i}` } as PanelProps, // 色库预设：钥匙=幽紫 void / 资源=深墨（替旧硬编码紫绿）
        layout: { width: 158, padding: 14, gap: 6, align: 'center' },
        children: [
          { type: 'Label', id: `gg-btw-name-${i}`, props: { text: bf.name, size: 'md', bold: true, color: isKey ? 'gold' : 'ok' } as LabelProps },
          { type: 'Label', id: `gg-btw-desc-${i}`, props: { text: bf.desc, size: 'sm', color: 'sub' } as LabelProps },
        ],
      };
    };
    const tree: LayoutNode = {
      type: 'Screen', id: 'gg-btw-screen', props: { center: true } as ScreenProps,
      children: [{
        type: 'Panel', id: 'gg-btw-panel', props: {} as PanelProps,
        layout: { direction: 'column', gap: 14, padding: 24, align: 'center' },
        children: [
          { type: 'Label', id: 'gg-btw-title', props: { text: '🎉 战间整备 · 三选一', size: 'lg', bold: true, color: 'ok' } as LabelProps },
          { type: 'Label', id: 'gg-btw-sub', props: { spans: [
            { text: '胜一场！' }, { text: nextLabel, bold: true }, { text: '前选' }, { text: '一项', bold: true },
            { text: '——资源增益，或' }, { text: '🃏流派钥匙', bold: true, color: 'gold' }, { text: '(白嫖天罡牌、定你的构筑分叉)。' },
          ] } as LabelProps },
          { type: 'Panel', id: 'gg-btw-cards', props: { bare: true } as PanelProps, layout: { direction: 'row', gap: 12, justify: 'center' }, children: picks.map(card) },
          { type: 'Button', id: 'gg-btw-skip', props: { label: '跳过，直接回大厅', kind: 'quiet', action: 'skip' } as ButtonProps },
        ],
      }],
    };
    const handlers: Record<string, () => void> = { skip: () => { teardown(); showLobby(); } };
    picks.forEach((bf, i) => { handlers[`pick-${i}`] = () => choose(bf); });
    teardown = mountUI(host, tree, handlers, GG_THEME_ONYX); // 喂 game-g 古风主题 → 同份数据渲成古风皮
  }

  // ───────────────────────── 出征（一局 · doc24 回合制 · turn-combat + turn-battle-screen）─────────────────────────
  // owner 大转向：实时 CR → 回合制桌游。每回合 +1 召唤源泉 → 三行为自由混(抽/打/换·源泉唯一门·机关门整套已退役) → 结束回合推进一格 → 相邻遭遇掷命特写。
  // 牌库由 prepareArmies 揭晓前编排(融天罡/干预/Boss·outcome-first)折成扑克兵库；先破敌 3 血大本营胜。结算复用旧养成闭环(命/材料/三选一)。
  function showTurnMatch(_formation: Formation, _myName: string, _interventions: Intervention[]): void {
    clear();
    const spec = battleSpec(save.stage - 1);
    const lvl = loadLevel(save.stage); // doc27 关卡加载：本关 = 命运之战的英雄(列奥尼达..项羽)·地煞/12 天罡/难度/对白 逐关入库
    const boss = spec.boss ? bossFor(save.bossIdx) : null;
    const aiForm = boss ? boss.formation : aiFormation();
    const enemyBias = boss ? boss.favorBias : spec.enemyBias;
    const aiName = lvl.heroId; // 战役 Boss = 本关英雄（52 关 = 52 命运之战·doc23 §七）
    // 战斗屏占满整个 root（对齐大厅占满感·owner 2026-06-28）：root 先改成铺满容器（替 clear() 的 flex 居中默认屏），
    // stage 100%×100% → mountTurnBattle 量到完整可用区做 contain 缩放（棋盘最大化居中·四周最小对称白边·不再四面大留白）。
    root.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#0c0a08';
    const stage = document.createElement('div');
    stage.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden';
    const battleLabel = `第 ${save.stage}/${RUN_BATTLES} 战 · ${lvl.battle.name} · ⚔ ${lvl.heroId}`;
    root.append(stage); // 战斗信息/返回/设置已内化到 turn-battle-screen topbar

    // 玩家牌库（契约A·甲读·owner 2026-06-21 #16：52 牌组是唯一真相·16 张按 ID 带 favor+地支附魔进场）：
    //   = 你配的 16 张 pokerPicks，每张挂自己的 effectiveDeckFavors(base+附魔)→战力；空 picks=自动构筑一副；
    //   主将=favor 最高那张(留士气机制)。lane 由放牌时自选·非预派。
    const seed = Math.floor(Math.random() * 1e9);
    const toPoker = (c: ArmyCard): PokerCard => ({ kind: 'poker', id: c.id, rank: cardRank(c), suit: c.suit, general: c.general, buff: Math.round(favorToP(c.favor) - cardPoints(cardRank(c))), cost: deployCost(cardRank(c)) });
    const effFav = effectiveDeckFavors(save.deck, save.inlays);
    const myPicks = activeDeck(save).pokerPicks.length ? activeDeck(save).pokerPicks : autoBuildPokerPicks({ favors: effFav, isOwned: isHeroOwned });
    const myDeck = buildPickDeck(myPicks, effFav); // 你的 16 张 pick（含逐张地支附魔）→ 战斗牌库
    // loadoutCap（doc27 §四·难度档）：玩家本关天罡上限（新手区 2→3）→ 截断出战天罡。
    const loadoutIds = save.tiangangs.length ? save.tiangangs : DEFAULT_STARTER_TIANGANGS; // 空 loadout 兜底（老存档没配天罡也给新手引导天罡·owner 2026-07-04「抽不到天罡」）
    const aTengang: TengangHandCard[] = loadoutIds.slice(0, lvl.loadoutCap).map((id) => ({ kind: 'tengang', id }));
    const bTengang: TengangHandCard[] = lvl.boss.tiangang.map((id) => ({ kind: 'tengang', id })); // Boss 随机 12 天罡(seed=关id·可复现)·待 Boss AI 施放
    // Boss 牌库（owner 2026-06-21 #1：敌方镜像玩家·~16 张·不再 prepareArmies 泛化 61 张全 army）：
    //   关1-5 = design/boss-config-1-5 的 16 牌组（lvl.boss.deck·牌力偏置 favorBias 写卡 buff）；
    //   本关英雄那张由 bossHeroCard 按 codex 真身**强化置顶**充当主将（如列奥尼达=3♠强化·名字显示正确）
    //   → 让出列表里点数最高一张（=配置里的 A/K 主将位）保 16 总数。关6+（暂无 16 牌组）回退 prepareArmies 泛化 army。
    const bossBias = lvl.boss.deck.length ? lvl.boss.favorBias : enemyBias;
    const heroCard = bossHeroCard(aiName, bossBias);
    let bossDeck: PokerCard[];
    if (lvl.boss.deck.length) {
      const codes = lvl.boss.deck.slice();
      if (heroCard && codes.length) { let hi = 0; for (let i = 1; i < codes.length; i++) if (cardPoints(codes[i].rank) > cardPoints(codes[hi].rank)) hi = i; codes.splice(hi, 1); } // 强化主将顶替点数最高那张（配置主将位）
      const generals: PokerCard[] = codes.map((c, i) => ({ kind: 'poker', id: `boss-${i}-${c.rank}${c.suit}`, rank: c.rank, suit: c.suit, general: false, buff: bossBias, cost: deployCost(c.rank) })); // 牌力偏置=写卡 buff
      bossDeck = seededShuffleArr(generals, seed ^ 0x51ed);
    } else {
      const b = armyFromFormation('b', enemyBias, aiForm); // 关6+（暂无 16 写死牌组）回退：裸军队生成器造 boss army → 折成 bossDeck（旧 effect-apply 路已退役）
      bossDeck = seededShuffleArr(b.map((c) => ({ ...toPoker(c), general: false })), seed ^ 0x51ed);
    }
    if (heroCard) bossDeck.unshift(heroCard); // 强化主将置顶·必进起手·当场亮相；打赢=擒此英雄
    resetFortuneIfNewDay(save);
    const fortuneBuff = save.fortune.keptVal != null ? luckyBattleBuff(save.fortune.keptVal) : 0;
    // 玩家主将必进起手（同 Boss 英雄牌置顶·owner 2026-06-21）：洗完牌后找到 general:true 那张，提到牌库顶。
    const shuffledMyDeck = seededShuffleArr(myDeck, seed ^ 0x9e37);
    const genIdx = shuffledMyDeck.findIndex((c) => c.general);
    if (genIdx > 0) { const [gen] = shuffledMyDeck.splice(genIdx, 1); shuffledMyDeck.unshift(gen); }
    // 开局排阵守军（REQ-G-开局排阵）：Boss 明牌摆兵·带同款牌力偏置 buff（与 bossDeck 一致）·静守 hold。
    const startFormation = lvl.boss.startFormation.map((f) => ({ ...f, buff: bossBias }));
    const tb = initTurnBattle({ seed, disha: lvl.boss.disha, aiProfile: lvl.boss.aiProfile, aiTier: lvl.boss.aiTier, fortuneBuff, startFormation, a: { pokerDeck: shuffledMyDeck, tengangDeck: aTengang }, b: { pokerDeck: bossDeck, tengangDeck: bTengang } });
    for (let i = 0; i < OPENING_HAND && tb.a.pokerDeck.length; i++) tb.a.hand.push(tb.a.pokerDeck.shift()!); // 起手摸
    for (let i = 0; i < OPENING_HAND && tb.b.pokerDeck.length; i++) tb.b.hand.push(tb.b.pokerDeck.shift()!);
    // 战场操作日志（debug·owner 2026-06-21「出 bug 把日志贴来排查」）：提前声明→开局布防即可入日志。逐条记 玩家/AI 操作 + 掷命 + 结算。
    const dbg: string[] = [];
    const log = (s: string): void => { if (dbg.length > 1200) dbg.shift(); dbg.push(`[T${tb.turn}|源泉 我${tb.a.mana}/敌${tb.b.mana}] ${s}`); };
    bossOpeningGarrison(tb, lvl.boss.garrisonMana, aggregateTengang, log); // 开局布防（owner 2026-06-29·敌方开场即设防一线）·按关分档 garrisonMana(关1=0·REQ-G-关1开局过载重标)·记 AI 布防决策日志（owner 2026-07-02）
    const garrisonIds: string[] = tb.lanes.flatMap((L) => L.b.map((u) => u.id)); // 布防摆下的敌兵 id → 供开场「敌方布防」逐张亮相演出（owner 2026-07-04·别让敌兵凭空预置看着像源泉没扣·布防免费=设计·源泉不减对；演个敌方设防初始拍再轮到我）
    // 敌堡垒 3 地煞明牌（动态·owner 2026-06-29 修「敌人发动斯巴达方阵但右下仍显待发动」）：
    // used 每帧据 tb 重算 → 被动地煞(开局生效·dishaBaseIds) / 可施放地煞已打出(dishaCastIds) → 显「已发动」；可施放未打 → 「待发动」。
    const shaLive = (): TurnShaView[] => campaignFor(save.stage).fiends.map((f, i) => {
      const id = stageDisha(save.stage)[i] ?? '';
      const used = tb.dishaBaseIds.includes(id) || tb.dishaCastIds.includes(id); // 被动恒生效 / 可施放已打出 → 已发动
      return { filled: true, name: f.name, rar: (['gold', 'blue', 'green'] as const)[i] ?? 'white', desc: f.desc, used };
    });

    // ── 运行态（UI 选中 + 掷命特写队列）──
    let theme: 'onyx' | 'brocade' = 'onyx';
    let selMode: string | null = null; // 当前点开的行为（三行为 owner 2026-07-03·draw/play/swap·UI 先选后做·互不互斥）
    let playKind: 'deploy' | 'cast' = 'deploy'; // 打·子模式：部署扑克 / 打天罡（子菜单高亮·selectHand 亦按手牌真类型派发）
    let swapFrom: 'poker' | 'tengang' = 'poker'; // 换·补牌库：从扑克/天罡库随机补 1 张
    let selHand = -1;                  // 放牌/施法/换牌 选中的手牌
    let notice: string | null = null; let noticeTimer = 0; // 临时提示 toast
    let drained = 0; const perfQueue: ClashEvent[] = []; let perfClash: ClashEvent | null = null; let busy = false; let perfResume: (() => void) | null = null;
    let perfPending = false; // 有待掷命的对决排队/在演中：此时压掉 move:settle 那次板面重渲——让棋盘「两兵贴身对峙」保持到掷骰特写盖上(否则 ≈1.3s 板面会闪跳到已结算态·败者凭空消失/胜者跳格·owner 2026-07-04 撞见)。
    let coachDid: (on: BattleCoachStep['on']) => void = () => {}; let syncCoach: () => void = () => {}; // 前置声明·真体在挂载后赋（战斗新手引导）
    // 演出快进（Lead·BUG-G-flow-walk）：headless 满局走查把演出节奏折成最小 tick——「演出时长是表现参数·不该进 sim 测试预算」。
    //   opt-in `window.__ggFastPerf=true`（走查测开工前置）→ 行军/前奏/横幅/掷骰/收场的墙钟拍全塌成 ~1 tick·演出逻辑照跑(仍捕演出抛错)·只是不再拖满 pump 预算。真机默认 1（原节奏不变）。
    const FAST_PERF = typeof window !== 'undefined' && (window as unknown as { __ggFastPerf?: boolean }).__ggFastPerf === true;
    const pT = (ticks: number): number => (FAST_PERF ? Math.min(ticks, 1) : ticks); // 演出 tick 数（走查折成 ≤1·仍 pump 一次让信号发出）
    const pMs = (ms: number): number => (FAST_PERF ? 16 : ms); // 演出墙钟 ms（走查折成一 tick）
    let justMovedIds = new Set<string>(); let heldIds = new Set<string>(); let moveOrder = new Map<string, number>(); let moveDist = new Map<string, number>(); let freshIds = new Map<string, number>(garrisonIds.map((id, k) => [id, k])); let dealtId: string | null = null; let thinkTimer = 0; let thinkEl: HTMLElement | null = null; let settingsOpen = false; // freshIds 预置布防兵 → 首帧就 g-drop 逐张落下（非静态预置）·开场演出随后补部署音 + 横幅
    // 离场/留场动画（owner 2026-06-29「过程要清晰·谁战败撕裂·谁掷骰留下钉桩/光荣离场」）。
    // 正确时序：移动相滑到位 → 捕捉两军前锋相邻位快照(exitCaps) → 弹「谁打谁」→ 掷骰 → 掷币定去留 → 收场后按结果演离场/钉桩。
    type GhostSpec = { html: string; left: number; top: number; w: number; h: number; zoom: number };
    const exitCaps = new Map<string, GhostSpec>(); // 本回合待掷命路前锋快照(unitId → 相邻位克隆)·供掷骰后离场动画
    const captureUnit = (id: string): GhostSpec | null => {
      const el = document.getElementById('u-' + id); if (!el) return null;
      const rect = el.getBoundingClientRect(); if (!rect.width) return null; // 无头/隐藏 → 不演
      const innerEl = document.querySelector('.ggt-inner') as HTMLElement | null;
      const zoom = innerEl ? (parseFloat(innerEl.style.zoom || '1') || 1) : 1;
      return { html: el.outerHTML, left: rect.left, top: rect.top, w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight, zoom };
    };
    const playGhost = (spec: GhostSpec | null, fate: 'tear' | 'glory' | 'charge' | 'pin' | 'fatigue', note?: string): void => {
      if (!spec) return;
      const ring = fate === 'pin' || fate === 'fatigue'; // 留场类=在真牌上打环(不克隆·真牌仍在场)：pin=金/fatigue=橙红「战力对折」
      const outer = document.createElement('div');
      outer.style.cssText = `position:fixed;left:${spec.left}px;top:${spec.top}px;width:${spec.w}px;height:${spec.h}px;transform:scale(${spec.zoom});transform-origin:0 0;z-index:240;pointer-events:none`;
      if (ring) {
        const rc = fate === 'fatigue' ? '#ff8a4c' : '#f1d792'; // 疲劳=橙红 / 钉守=金
        const rEl = document.createElement('div'); rEl.style.cssText = `position:absolute;inset:-6px;border-radius:14px;border:3px solid ${rc};box-shadow:0 0 18px ${rc}e6,inset 0 0 14px ${rc}99;animation:g-pinring .8s ease-out forwards`;
        const nail = document.createElement('div'); nail.textContent = fate === 'fatigue' ? '💢' : '📌'; nail.style.cssText = 'position:absolute;left:50%;top:-10px;transform:translateX(-50%);font-size:30px;animation:g-pin .6s cubic-bezier(.3,1.4,.5,1) forwards';
        outer.appendChild(rEl); outer.appendChild(nail);
      } else {
        const wrap = document.createElement('div'); wrap.innerHTML = spec.html; const clone = wrap.firstElementChild as HTMLElement | null;
        if (clone) { clone.removeAttribute('id'); clone.style.width = spec.w + 'px'; clone.style.height = spec.h + 'px'; clone.style.flex = 'none'; clone.style.margin = '0';
          if (fate === 'tear') { // 一刀两断（owner 2026-07-03·REQ-G 满仪式§VFX「被切成两半的一刀」）：牌沿斜线裂上下两半分离 + 白热斩线闪。
            const half = (top: boolean): HTMLElement => { const h = clone.cloneNode(true) as HTMLElement; h.style.cssText = `position:absolute;inset:0;width:${spec.w}px;height:${spec.h}px;margin:0;flex:none;clip-path:${top ? 'polygon(0 0,100% 0,100% 46%,0 54%)' : 'polygon(0 54%,100% 46%,100% 100%,0 100%)'};animation:g-slice-${top ? 't' : 'b'} .7s cubic-bezier(.3,.55,.35,1) forwards`; return h; };
            const box = document.createElement('div'); box.style.cssText = `position:absolute;inset:0;width:${spec.w}px;height:${spec.h}px`; box.appendChild(half(true)); box.appendChild(half(false));
            const slash = document.createElement('div'); slash.style.cssText = 'position:absolute;left:-14%;top:50%;width:128%;height:5px;background:linear-gradient(90deg,transparent,#fff 45%,#fff 55%,transparent);box-shadow:0 0 14px #fff,0 0 34px #ff3b30;animation:g-slash .5s ease-out forwards';
            outer.appendChild(box); outer.appendChild(slash);
          } else {
            clone.style.animation = fate === 'glory' ? 'g-glory .72s ease-out forwards' : 'g-charge .55s ease-in forwards';
            outer.appendChild(clone);
            if (fate === 'glory') { const crown = document.createElement('div'); crown.textContent = '♔'; crown.style.cssText = 'position:absolute;left:50%;top:-30px;transform:translateX(-50%);font-size:38px;color:#ffe9a8;text-shadow:0 0 18px #f1d792,0 2px 6px #000;animation:g-crown .8s ease-out forwards'; outer.appendChild(crown); } // 胜者戴冠
          }
        }
      }
      const txt = note ?? (fate === 'tear' ? '⚔ 阵亡' : fate === 'glory' ? '★ 光荣回库' : fate === 'pin' ? '★ 钉守在场' : fate === 'fatigue' ? '战力对折' : '突破');
      const col = fate === 'tear' ? '#ff5d62' : fate === 'glory' ? '#f1d792' : fate === 'pin' ? '#f1d792' : fate === 'fatigue' ? '#ff8a4c' : '#8fe0ff';
      const lab = document.createElement('div'); lab.textContent = txt;
      lab.style.cssText = `position:absolute;left:50%;top:-4px;transform:translateX(-50%);font:700 13px/1 "Noto Serif SC",serif;color:${col};text-shadow:0 1px 4px #000;white-space:nowrap;animation:g-exitlabel .9s ease forwards`;
      outer.appendChild(lab);
      document.body.appendChild(outer); window.setTimeout(() => outer.remove(), 1000);
    };
    // 战后·结果标在牌上·短暂驻留可回看（owner 2026-07-03「结算完把结果标在牌型展示上·我知道谁打了谁·别塞结算框」·REQ-G-谁打谁 §②）。
    // 纯表现层 DOM 徽标：锚在真实场上兵位(#u-<id>·读实时屏幕矩形)·飘现后驻留 ~3s 再淡出 → owner 收场后仍看得清哪枚是本场胜者(留场推进)。不动 tb/rng/turnHash。
    const stampBoard = (unitId: string, text: string, col: string): void => {
      const el = document.getElementById('u-' + unitId); if (!el) return;
      const rect = el.getBoundingClientRect(); if (!rect.width) return; // 无头/隐藏 → 不标
      const b = document.createElement('div'); b.textContent = text;
      b.style.cssText = `position:fixed;left:${rect.left + rect.width / 2}px;top:${rect.top - 6}px;transform:translate(-50%,-100%);z-index:238;pointer-events:none;font:700 12px/1 "Noto Serif SC",serif;color:#1a1208;background:linear-gradient(180deg,${col},${col}cc);border:1px solid rgba(0,0,0,.4);border-radius:7px;padding:4px 9px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.5);opacity:0;transition:opacity .3s ease,transform .3s cubic-bezier(.3,1.5,.5,1)`;
      document.body.appendChild(b);
      requestAnimationFrame(() => { b.style.opacity = '1'; b.style.transform = 'translate(-50%,-118%)'; }); // 弹现
      window.setTimeout(() => { b.style.transition = 'opacity .5s ease'; b.style.opacity = '0'; }, 3000); // 驻留 3s 后淡出
      window.setTimeout(() => b.remove(), 3600);
    };
    // P20 休整回血演出（owner 2026-07-06「疲劳恢复要给个效果」）：行动收尾后·对本轮疲劳回落的在场兵飘绿「+N% 回升」徽（stampBoard 锚 #u-id·纯表现）。
    const showRestRecovery = (fatBefore: Map<string, number>): void => {
      for (const L of tb.lanes) for (const u of [...L.a, ...L.b]) {
        const b4 = fatBefore.get(u.id); const now = u.fatiguePm ?? 0;
        if (b4 != null && now < b4) { const back = Math.round((b4 - now) / 10); if (back > 0) { playSfx('select'); stampBoard(u.id, `💚 休整 +${back}% 战力`, '#7fe0a0'); } } // 疲劳回落 → 战力回升飘字
      }
    };
    // （胜者前进克隆演出 advanceSlide 已随 owner 2026-07-04「胜者守原位·不推进占腾出格」退役——前进交回下回合正常行军 g-march。）
    const tgName = (id: string): string => TIANGANG_BY_ID.get(id)?.name ?? id;
    const tgDesc = (id: string): string => TIANGANG_BY_ID.get(id)?.text ?? '持续战法·打出后整场生效'; // 磨砂浮层：天罡效果文案
    const SUITNM2: Record<string, string> = { S: '黑桃', H: '红桃', D: '方块', C: '梅花', s: '黑桃', h: '红桃', d: '方块', c: '梅花' };
    const cardLabel = (c: Card): string => (c.kind === 'poker' ? (SUITNM2[c.suit] ?? '') + c.rank : c.kind === 'tengang' ? '天罡·' + tgName(c.id) : '地煞·' + (DISHA_NAME[c.id] ?? c.id));
    const LANE_NM = ['上路', '中路', '下路'];
    // 捕捉所有上场单位的位置（lane*9+slot 编码）
    const snapSlots = (): Map<string, string> => { const m = new Map<string, string>(); tb.lanes.forEach((L, li) => { for (const u of L.a) m.set(u.id, `${li}:${u.slot}`); for (const u of L.b) m.set(u.id, `${li}:${u.slot}`); }); return m; };
    // 与快照对比，返回移动了的单位 ID
    const diffMoved = (before: Map<string, string>): Set<string> => { const s = new Set<string>(); tb.lanes.forEach((L, li) => { for (const u of [...L.a, ...L.b]) { const old = before.get(u.id); if (old !== undefined && old !== `${li}:${u.slot}`) s.add(u.id); } }); return s; };
    // 全屏回合播报（fade in → hold → fade out）
    const showBanner = (text: string, durationMs: number, onDone?: () => void): void => {
      if (!document.getElementById('gg-bnr-css')) { const s = document.createElement('style'); s.id = 'gg-bnr-css'; s.textContent = '@keyframes gg-bnr{0%{opacity:0;transform:scale(.8)}15%{opacity:1;transform:scale(1)}78%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.06)}}'; document.head.appendChild(s); }
      const ov = document.createElement('div'); ov.style.cssText = `position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;pointer-events:none;animation:gg-bnr ${durationMs}ms ease both`;
      ov.innerHTML = `<span style="font-size:clamp(36px,6vw,72px);font-weight:900;color:#e8cd82;text-shadow:0 0 60px rgba(232,205,138,.9),0 4px 24px rgba(0,0,0,.95);letter-spacing:.25em;font-family:'Rajdhani',sans-serif;">${text}</span>`;
      document.body.appendChild(ov); battleTl.delay(pT(durationMs / 16), () => { ov.remove(); onDone?.(); }); // 时序=数据（单 cue timeline·替手写 setTimeout·owner「一切数据驱动·不手写排程」）·走查快进 pT
    };
    // 掷命前奏：先把「哪两张牌即将交战」摆到屏幕前 ~2s（武将名+牌面+战力·我橙敌蓝 VS），再切对决特写（owner 2026-06-21：看不清是谁打谁）。
    // 战前「谁打谁」（owner 2026-07-03「战前要看清是场上哪两枚在打」·REQ-G-谁打谁·战前锚场）：不再飘半空全屏 VS 弹窗——
    // **直接把将交战的两枚场上兵原地高亮（我橙敌蓝环）+ 中间连线挂 VS**（锚真实棋盘 u-<id>·getBoundingClientRect 屏幕位），
    // 一眼看清是场上哪一对，再切掷骰特写。兵不在场（无头/未渲）→ 回退居中小 VS。
    const showClashCue = (e: ClashEvent, onDone: () => void): void => {
      if (!document.getElementById('gg-cue-css')) { const s = document.createElement('style'); s.id = 'gg-cue-css'; s.textContent = '@keyframes gg-cue{0%{opacity:0}9%{opacity:1}88%{opacity:1}100%{opacity:0}}@keyframes gg-cue-vs{0%,20%{transform:translate(-50%,-50%) scale(0)}36%{transform:translate(-50%,-50%) scale(1.35)}48%,100%{transform:translate(-50%,-50%) scale(1)}}@keyframes gg-cue-ring{0%{opacity:0;box-shadow:0 0 0 0 var(--rc)}14%{opacity:1}50%{box-shadow:0 0 26px 5px var(--rc),inset 0 0 16px var(--rc)}88%{opacity:1}100%{opacity:0}}@keyframes gg-cue-spark{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}22%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--sx)),calc(-50% + var(--sy))) scale(1)}}'; document.head.appendChild(s); }
      const DUR = 2600; // 「谁打谁」前奏时长（owner 2026-07-04「延长·2 秒更清楚哪里交战」·可见窗加宽 ~2.1s）
      const ea = document.getElementById('u-' + e.a.id); const eb = document.getElementById('u-' + e.b.id);
      const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:280;pointer-events:none';
      playSfx('cast'); window.setTimeout(() => playSfx('deploy'), 90); // 醒目声（owner「让我重点知道有个声音」）：上行示警 + 一记落桌撞点
      if (!ea || !eb) { // 回退：兵不在场（无头/未渲）→ 居中小 VS + 路名
        clashOrigin = null; // P24：无棋盘锚 → 特写居中缩放
        ov.style.cssText += ';display:flex;align-items:center;justify-content:center';
        ov.innerHTML = `<div style="animation:gg-cue ${DUR}ms ease both;font-size:24px;font-weight:900;color:#e8cd82;letter-spacing:.2em;text-shadow:0 0 24px rgba(232,205,138,.8);font-family:'Rajdhani',sans-serif;">⚔ ${LANE_NM[e.lane] ?? ''} · 即将交战</div>`;
        document.body.appendChild(ov); battleTl.delay(pT(DUR / 16), () => { ov.remove(); onDone(); }); return;
      }
      const ra = ea.getBoundingClientRect(); const rb = eb.getBoundingClientRect();
      const ring = (r: DOMRect, mine: boolean): string => { const c = mine ? '#ff7a45' : '#3a86d4'; return `<div style="--rc:${c};position:absolute;left:${r.left - 5}px;top:${r.top - 5}px;width:${r.width + 10}px;height:${r.height + 10}px;border-radius:13px;border:3px solid ${c};animation:gg-cue-ring ${DUR}ms ease both"><div style="position:absolute;left:50%;bottom:-19px;transform:translateX(-50%);white-space:nowrap;font-size:11px;font-weight:800;color:${c};text-shadow:0 1px 4px rgba(0,0,0,.9);font-family:'Rajdhani',sans-serif;">${mine ? '我方前锋' : '敌方前锋'}</div></div>`; };
      const cax = ra.left + ra.width / 2, cay = ra.top + ra.height / 2, cbx = rb.left + rb.width / 2, cby = rb.top + rb.height / 2;
      const len = Math.hypot(cbx - cax, cby - cay), ang = Math.atan2(cby - cay, cbx - cax) * 180 / Math.PI;
      const line = `<div style="position:absolute;left:${cax}px;top:${cay}px;width:${len}px;height:3px;transform-origin:0 50%;transform:rotate(${ang}deg);background:linear-gradient(90deg,#ff7a45,#e8cd82,#3a86d4);box-shadow:0 0 12px rgba(232,205,138,.85);animation:gg-cue ${DUR}ms ease both"></div>`;
      const vs = `<div style="position:absolute;left:${(cax + cbx) / 2}px;top:${(cay + cby) / 2}px;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:linear-gradient(180deg,#ffe9a8,#c89a42);border:3px solid #fff;box-shadow:0 0 22px rgba(232,205,138,.85);display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:900;color:#2a1a08;font-family:'Rajdhani',sans-serif;animation:gg-cue-vs ${DUR}ms ease both">VS</div>`;
      const lane = `<div style="position:absolute;left:${(cax + cbx) / 2}px;top:${Math.min(cay, cby) - 34}px;transform:translateX(-50%);white-space:nowrap;font-size:15px;font-weight:900;color:#e8cd82;letter-spacing:.12em;text-shadow:0 0 16px rgba(232,205,138,.9),0 2px 6px rgba(0,0,0,.9);font-family:'Rajdhani',sans-serif;animation:gg-cue ${DUR}ms ease both">⚔ ${LANE_NM[e.lane] ?? ''} · 即将交战</div>`;
      // 交战点粒子迸发（owner 2026-07-04「在交战的地方放个粒子·重点知道哪里」）：中点循环喷 10 束火星（DUR 内反复迸发）。
      const mx = (cax + cbx) / 2, my = (cay + cby) / 2, R = 48;
      clashOrigin = { x: mx, y: my }; // P24：交战中点 → 对决特写开合的缩放原点（引导视野到棋盘交战处）
      const sparks = Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return `<div style="position:absolute;left:${mx}px;top:${my}px;--sx:${Math.round(Math.cos(a) * R)}px;--sy:${Math.round(Math.sin(a) * R)}px;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle,#fff,#e8cd82 60%,transparent);box-shadow:0 0 8px #e8cd82;animation:gg-cue-spark .95s ease-out ${(i % 5) * 0.12}s infinite"></div>`; }).join('');
      ov.innerHTML = ring(ra, true) + ring(rb, false) + line + vs + lane + sparks;
      document.body.appendChild(ov);
      battleTl.delay(pT(DUR / 16), () => { ov.remove(); onDone(); }); // 时序=数据（单 cue timeline·替手写 setTimeout）·走查快进 pT
    };
    // 敌方思考中蒙层（owner 2026-06-21：平均缩 2 秒 → 1-3 秒随机，均值 2s）
    const startThinking = (onDone: () => void): void => {
      const ms = 1000 + Math.floor(Math.random() * 2000);
      if (!document.getElementById('gg-spin-css')) { const s = document.createElement('style'); s.id = 'gg-spin-css'; s.textContent = '@keyframes gg-spin{to{transform:rotate(360deg)}}'; document.head.appendChild(s); }
      thinkEl = document.createElement('div'); thinkEl.style.cssText = 'position:fixed;inset:0;z-index:250;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;pointer-events:none;background:rgba(6,9,13,.45)';
      thinkEl.innerHTML = `<div style="width:52px;height:52px;border:4px solid rgba(58,134,212,.25);border-top:4px solid #3a86d4;border-radius:50%;animation:gg-spin 1s linear infinite"></div><span style="font-size:20px;font-weight:700;color:#3a86d4;text-shadow:0 0 24px rgba(58,134,212,.8);letter-spacing:.18em;font-family:'Rajdhani',sans-serif;">敌方思考中</span>`;
      document.body.appendChild(thinkEl);
      thinkTimer = window.setTimeout(() => { if (thinkEl) { thinkEl.remove(); thinkEl = null; } onDone(); }, ms);
    };
    const flash = (msg: string): void => { notice = msg; mounted?.update(); if (noticeTimer) clearTimeout(noticeTimer); noticeTimer = window.setTimeout(() => { notice = null; if (!perfClash) mounted?.update(); }, 1700); }; // 清提示时若正演掷命特写则不重渲（防飞入重启）
    // 各自掷战力骰对决（owner 2026-07-01）：进特写先藏掷值 → 玩家点「掷命」→ 两骰同屏各掷自己战力范围 → 揭晓胜负 → 点「继续」→ 一步步演结算。
    let clashRevealed = false; let clashCdTimer = 0; let clashCdInterval = 0; let clashRolling = false; let clashSettling = false; // clashSettling=结算演出(斩→进→标)进行中 → 忽略「继续」重复点击（owner 2026-07-04·防狂点重播）
    // P24（owner 2026-07-04「对决 UI 要从战斗发生的地方放缩到全屏·收场再缩回去引导视线」）：本场交战在棋盘上的屏幕坐标(两前锋中点)→ 特写开合的缩放原点。
    let clashOrigin: { x: number; y: number } | null = null; // showClashCue 量得·null=兵不在场(回退居中缩放)
    // 对决特写「从战斗位置放缩进/退」（owner 2026-07-04·P24）：transform-origin 指向棋盘交战点(引导视野)·纯表现层(不动 tb/rng)。
    //   in=露出后从该点缩小态(scale .12·透明)长到满屏；out=缩回该点+淡出·底板同步淡出 → 收场露出棋盘演谁死谁进。
    const zoomClashPanel = (dir: 'in' | 'out', onDone?: () => void): void => {
      const panel = document.getElementById('clash-panel'); const overlay = panel?.parentElement;
      if (!panel || !overlay) { onDone?.(); return; } // 无头/未渲 → 跳过动画直接续
      const pr = panel.getBoundingClientRect(); const own = (panel as HTMLElement).offsetWidth || pr.width; const scale = pr.width / own || 1; // 外层画框缩放系数（屏幕→本地坐标换算）
      let ox = own / 2, oy = ((panel as HTMLElement).offsetHeight || pr.height) / 2; // 默认居中缩放
      if (clashOrigin) { ox = (clashOrigin.x - pr.left) / scale; oy = (clashOrigin.y - pr.top) / scale; } // 缩放原点=棋盘交战点(本地坐标)
      panel.style.transformOrigin = `${ox}px ${oy}px`;
      const dice3d = Array.from(document.querySelectorAll<HTMLElement>('.gg-die3d-host')); // 骰盅独立 fixed 覆层·不随面板缩放 → 与底板同步淡（遮住脱节）
      if (dir === 'in') {
        panel.style.transition = 'none'; panel.style.transform = 'scale(.12)'; panel.style.opacity = '0'; // 同步落缩小态(update 后即刻·先于绘制·无满屏闪现)
        overlay.style.transition = 'none'; overlay.style.opacity = '0';
        dice3d.forEach((d) => { d.style.transition = 'none'; d.style.opacity = '0'; });
        requestAnimationFrame(() => { requestAnimationFrame(() => {
          panel.style.transition = 'transform .42s cubic-bezier(.2,.72,.28,1), opacity .3s ease'; panel.style.transform = 'scale(1)'; panel.style.opacity = '1';
          overlay.style.transition = 'opacity .32s ease'; overlay.style.opacity = '1';
          dice3d.forEach((d) => { d.style.transition = 'opacity .34s ease .12s'; d.style.opacity = '1'; }); // 稍迟淡入·等面板长开再现骰
        }); });
        onDone?.();
      } else {
        panel.style.transition = 'transform .38s cubic-bezier(.5,0,.75,.35), opacity .36s ease'; panel.style.transform = 'scale(.12)'; panel.style.opacity = '0';
        overlay.style.transition = 'opacity .38s ease'; overlay.style.opacity = '0';
        battleTl.delay(pT(24), () => onDone?.()); // ~384ms 缩回收完(时序=数据·单 cue timeline·非手写 setTimeout)·走查快进 pT
      }
    };
    let aiManaDisplay: number | null = null; // 敌方决策时源泉「随落牌错峰递减」的展示覆盖值（owner 2026-07-03「别直接跳 0·要看它啪啪啪扣」）·null=显真值
    const clearClashTimers = (): void => { if (clashCdTimer) { clearTimeout(clashCdTimer); clashCdTimer = 0; } if (clashCdInterval) { clearInterval(clashCdInterval); clashCdInterval = 0; } };
    // ── 战后生死演出走引擎 t3-timeline（owner 2026-07-03「用 timeline·不手写排程」）──
    // timeline 管「何时」发拍，本订阅管「怎么演」（playGhost·锚真实棋盘 u-id）。三拍（owner 2026-07-04·胜者守原位不再滑进腾出格）：
    //   ① clash:slay 斩败者 → ② clash:survivor 幸存者去留(对折/光荣)+驻留徽标 → ③ clash:resume 续下一场。
    let postClashCtx: { e: ClashEvent; loserId: string | undefined; winnerId: string | undefined; cut: number; streak: number; fatPct: number } | null = null;
    const battleTl = mountBattleTimeline((sig) => {
      if (sig.name === 'move:settle') { justMovedIds = new Set(); if (!perfClash && !perfPending) mounted?.update(); return; } // 行军慢放整段播完 → 清标记重渲（时序由 timeline 出·不再手写 setTimeout）。有对决排队(perfPending)则**不重渲**：保持棋盘在「两兵贴身」态到掷骰特写盖上·闪跳藏到全屏特写背后（owner 2026-07-04「谁打谁提示一半棋盘别跳」）
      const ctx = postClashCtx; if (!ctx) return; const e = ctx.e;
      if (sig.name === 'clash:slay') { // ① 败者阵亡（先死·清楚）
        if (ctx.loserId && !e.lastStand) { playSfx('clashLose'); playGhost(exitCaps.get(ctx.loserId) ?? null, 'tear'); }
        else if (e.lastStand) { log(`🛡 死战不退：敌主将【${aiName}】首负不亡·退回牌库（可重部署）`); showBanner('🛡 死战不退 · 敌主将首负不亡', 1500); }
      } else if (sig.name === 'clash:survivor') { // ② 幸存者：胜者守原位·头顶「本场战力−N·累计疲劳N%」（无自动退场·owner 2026-07-06 光荣回库已删）
        if (ctx.winnerId && !e.lastStand) { playSfx('clashWin'); playGhost(captureUnit(ctx.winnerId) ?? null, 'fatigue', `疲劳 ${ctx.fatPct}% · 本场战力−${ctx.cut}`); stampBoard(ctx.winnerId, `⚔ 胜 · 疲劳${ctx.fatPct}%`, '#e8cd8a'); } // 留场胜者：瞬时疲劳飘字(1s) + 驻留「⚔胜·疲劳N%」徽标(3s·可回看)

      } else if (sig.name === 'clash:resume') { postClashCtx = null; clashSettling = false; const r = perfResume; if (r) r(); } // ③ 收场续下一场·解闩
    });
    const buildClashView = (): TurnClashView | null => { if (!perfClash) return null; const cv = clashToTurnView(perfClash, tgName, save.inlays); cv.revealed = clashRevealed; return cv; };
    const view = (): TurnBattleView => buildTurnBattleView(tb, { theme, tengangName: tgName, tengangDesc: tgDesc, selMode, selHand, playKind, swapFrom, clash: buildClashView(), bossName: aiName, sha: shaLive(), notice, movedIds: justMovedIds, heldIds, moveOrder, moveDist, busy, freshIds, dealtId: dealtId ?? undefined, battleLabel, sfxOn: isSfxOn(), settingsOpen, bgmOn: isBgmOn(), bgmIdx: bgmTrackIdx(), bgmVol: bgmVolume(), bgmNames: BGM_TRACKS.map((t) => t.name), guideOn: !save.skipGuide, inlays: save.inlays, waterBDisplay: aiManaDisplay ?? undefined, enchOf: (rank, suit) => (save.inlays[String(cardFavorIndex(rank + suit))] ?? []).map((e) => [`${e.b}${DIZHI_TIER_NM[e.t]}`, DIZHI_INLAY_FAVOR[e.t]] as [string, number]) });
    let mounted: { update: () => void; destroy: () => void } | null = null;

    // 调试全局（owner 2026-07-04·dev 专用·控制台即用·非玩法·不进 hash）：正规「调试菜单」UI 归程序B（已提 requests）。
    //   用法：__ggDebug.grant('tigertally') 授召天罡到手牌 · __ggDebug.mana(10) 加源泉 · __ggDebug.list() 列全部天罡 id。
    //   __ggDebug.castAt('swiftmarch', 1) 施选路天罡到目标路（片C·免 B 的点路 UI 也能测：疾行/驰援/舍车选我路·泥沼选敌路·铁索路忽略）。
    (window as unknown as { __ggDebug?: unknown }).__ggDebug = {
      grant: (id: string): string => { debugGrantTengang(tb, 'a', id); mounted?.update(); return `授召 ${id} → 手牌`; },
      mana: (n = 10): string => { debugAddMana(tb, 'a', n); mounted?.update(); return `源泉 +${n} → ${tb.a.mana}`; },
      list: (): { id: string; name: string }[] => GAME_G_TIANGANGS.map((t) => ({ id: t.id, name: t.name })),
      castAt: (id: string, lane = 0): string => { debugAddMana(tb, 'a', 1); debugGrantTengang(tb, 'a', id); const ok = castTengangAt(tb, 'a', tb.a.hand.length - 1, lane); mounted?.update(); return ok ? `施放 ${id} → 路${lane}` : `${id} 非选路天罡/施放失败（选路天罡用此·fx 卡用 grant）`; },
    };

    const drainClashes = (): void => { for (const ev of tb.clashLog.slice(drained)) perfQueue.push(ev); drained = tb.clashLog.length; };
    // 各自掷战力骰（owner 2026-07-01「两骰摆两张牌正下方·各掷自己战力范围」）：
    //   就地在特写「牌正下方」的两个骰位(#clash-die-m/f)哒哒哒滚到各自掷值(rollA/rollB)→ 揭晓大者胜。不再全屏浮层。
    //   3D 化（owner「做成 3D 模型在那里旋转」）属 3D 渲染线 → 已转 requests-3d.md 给 P3D；此为 2D 过渡版 + 3D 挂载锚点(#clash-die3d-m/f)。
    //   （旧「单颗按胜率掷点」+ 掷硬币退役：硬币模块 coin-flip.ts 留存为死代码。）
    const doClashRoll = (): void => {
      if (clashRolling || clashRevealed || !perfClash) return;
      clashRolling = true; clearClashTimers();
      const e = perfClash; const tgtA = e.rollA ?? 0, tgtB = e.rollB ?? 0; // 各自掷值（数据已定·动画只是滚到它）
      playSfx('select');
      const mEl = document.getElementById('clash-die-m'); const fEl = document.getElementById('clash-die-f');
      const reveal = (): void => { clashCdTimer = 0; clashRolling = false; clashRevealed = true; coachDid('roll'); playSfx('clashReveal'); playSfx(e.aWins ? 'clashWin' : 'clashLose'); if (e.lastStand) { log(`🛡 死战不退发作：敌主将【${aiName}】首负不亡·退回牌库（可重部署）`); showBanner('🛡 死战不退 · 敌主将首负不亡', 1700); } mounted?.update(); syncCoach(); }; // 揭晓：重渲染显最终掷值 + 胜方高亮
      if (!mEl || !fEl) { reveal(); return; } // 无骰位（无头/未渲）→ 直接揭晓
      // 掷骰仪式（owner 2026-07-04「骰子要疯狂旋转再停在数字上·别直接出结果」）：掷前那个掷值是骰面上藏着的小 '?'——
      // 掷命时把它顶到 3D 骰画布之上(z>80)·放大狂跳(伪随机·不消费 b.rng)→减速收敛→停在真值+弹一下。setTimeout 驱动(假计时器可冲完)。
      const maxA = Math.max(1, e.a.pEff || tgtA), maxB = Math.max(1, e.b.pEff || tgtB); // 掷战力骰范围 [1,pEff]
      const dress = (el: HTMLElement): void => { const p = el.parentElement; if (p) { p.style.position = 'relative'; p.style.zIndex = '90'; } el.style.fontSize = '38px'; el.style.fontWeight = '900'; el.style.color = '#e8cd8a'; el.style.textShadow = '0 0 12px rgba(232,205,138,.9),0 2px 5px #000'; el.style.transition = 'transform .08s ease'; };
      dress(mEl); dress(fEl);
      const prnd = (seed: number): number => { const x = Math.sin((step + 1) * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); }; // 确定性伪随机·纯显示抖动(不动 rng/turnHash)
      const TOTAL = FAST_PERF ? 2 : 42; let step = 0; // 前 ~70% 狂跳随机值·后 ~30% 减速收敛到真值（走查快进折成 2 步）
      const tick = (): void => {
        step += 1; const t = step / TOTAL; const settling = t > 0.7;
        if (!settling) { mEl.textContent = String(1 + Math.floor(prnd(1) * maxA)); fEl.textContent = String(1 + Math.floor(prnd(2) * maxB)); } // 狂跳
        else { const c = (t - 0.7) / 0.3; const near = (tgt: number, max: number, seed: number): number => Math.max(1, Math.round(tgt + (1 - c) * (1 + Math.floor(prnd(seed) * max) - tgt))); mEl.textContent = String(near(tgtA, maxA, 1)); fEl.textContent = String(near(tgtB, maxB, 2)); } // 收敛
        const shake = (settling ? 1 - (t - 0.7) / 0.3 : 1) * 7; // 抖动幅度·收敛期渐停
        mEl.style.transform = `scale(${1 + shake * 0.012}) rotate(${(prnd(3) - 0.5) * shake}deg)`;
        fEl.style.transform = `scale(${1 + shake * 0.012}) rotate(${(prnd(4) - 0.5) * shake}deg)`;
        if (step % 2 === 0) playSfx('select');
        const iv = settling ? 42 + Math.pow((t - 0.7) / 0.3, 2) * 165 : 42; // 减速：收敛期间隔拉长
        clashCdTimer = window.setTimeout(t < 1 ? tick : land, iv);
      };
      const land = (): void => { mEl.textContent = String(Math.max(tgtA > 0 ? 1 : 0, tgtA)); fEl.textContent = String(Math.max(tgtB > 0 ? 1 : 0, tgtB)); mEl.style.transform = 'scale(1.32)'; fEl.style.transform = 'scale(1.32)'; playSfx('clashReveal'); clashCdTimer = window.setTimeout(reveal, 320); }; // 停真值 + 弹
      clashCdTimer = window.setTimeout(tick, 30);
    };
    // 逐场掷命特写：3D 飞入 → 停留 → **玩家点「看明白了」才演下一场/收场**（owner 2026-06-20：不能自动关·要看清为什么胜败）。
    const playPerf = (onDone: () => void): void => {
      if (perfQueue.length === 0) { perfClash = null; perfResume = null; perfPending = false; mounted?.update(); syncCoach(); onDone(); return; } // 全部对决演完 → 解压·板面同步到已结算态
      const e = perfQueue.shift()!;
      // 战力逐项拆解（owner 2026-07-02「掷骰时把两方的东西都列出来·万一算得不对可回查」）：底点+养成+天罡(逐张)+士气+地煞(固守/气势)+连胜对折 = 有效战力。
      const pBreak = (s: ClashEvent['a']): string => {
        const parts: string[] = [`底${s.points}`];
        if (s.buff) parts.push(`养成${s.buff > 0 ? '+' : ''}${s.buff}`);
        if (s.tengang) {
          const detail = s.tgBreak?.filter(([, d]) => d !== 0).map(([id, d]) => `${tgName(id)}${d > 0 ? '+' : ''}${d}`).join('/') ?? '';
          parts.push(`天罡${s.tengang > 0 ? '+' : ''}${s.tengang}${detail ? `(${detail})` : ''}`);
        }
        if (s.morale) parts.push(`士气${s.morale > 0 ? '+' : ''}${s.morale}(${s.morale > 0 ? (s.morale > 2 ? '主将在场+令旗' : '主将在场') : '主将阵亡'})`);
        if (s.nearDef) parts.push(`地煞·固守+${s.nearDef}`);
        if (s.dishaEdge) parts.push(`地煞·气势+${s.dishaEdge}`);
        if (s.fatiguePm) parts.push(`疲劳${Math.round(s.fatiguePm / 10)}%·战力已折(休整可回)`);
        return `${parts.join(' ')} = ${s.pEff}`;
      };
      const nm = (s: ClashEvent['a']): string => `${SUITNM2[s.suit] ?? ''}${s.rank}${s.general ? '(将)' : ''}`;
      // 逐场对决全量日志（可回查算法）：两方战力拆解各一行 + 掷骰范围/掷值 + 预报胜率 + 掷平裁定 + 胜负 + 战损。
      // 掷骰系天罡改掷显式化（owner/GD 2026-07-04·G03·否则掷值超 [1~P] 看着像作弊）：鬼手改掷+N/磐石掷下界/灌铅骰多掷取高 都写进读数。
      const rollStr = (s: ClashEvent['a'], roll?: number): string => { const m = s.rollMod; const mo: string[] = [];
        if (m?.bonus) mo.push(`鬼手改掷+${m.bonus}`); if (m?.floor) mo.push(`磐石掷下界≥${m.floor}`); if (m?.twice) mo.push(`灌铅骰掷${1 + m.twice}次取高`);
        return `掷战力骰 [1~${s.pEff}]${mo.length ? ` ${mo.join('·')}` : ''} → 掷 ${roll}`; };
      log(`⚔对决[${LANE_NM[e.lane] ?? e.lane}] ${nm(e.a)}(我) vs ${nm(e.b)}(敌)`);
      log(`  · 我方战力 = ${pBreak(e.a)}　→ ${rollStr(e.a, e.rollA)}`);
      log(`  · 敌方战力 = ${pBreak(e.b)}　→ ${rollStr(e.b, e.rollB)}`);
      log(`  · 预报我方胜率 ${Math.round(e.winrate * 100)}%${e.tie ? `　掷平裁定:${e.tie}` : ''}　→ ${e.aWins ? '★我胜' : '☠敌胜'}${e.warLoss ? `（胜方累计胜${e.winStreak}·疲劳${e.fatiguePm != null ? Math.round(e.fatiguePm / 10) : 50}%·本场战力对折）` : ''}${e.lastStand ? '（敌主将死战不退·首负不亡）' : ''}`);
      // 一行明确战果（owner 2026-07-04「日志要有：掷了几·大于几·谁死了」）：掷值比较 + 胜方 + 阵亡方 + 胜方去留。
      { const rA = e.rollA ?? 0, rB = e.rollB ?? 0; const cmp = rA > rB ? '>' : rA < rB ? '<' : '=（掷平）'; const win = e.aWins ? `我方 ${nm(e.a)}` : `敌方 ${nm(e.b)}`; const lose = e.aWins ? `敌方 ${nm(e.b)}` : `我方 ${nm(e.a)}`;
        const fate = e.lastStand ? '敌主将退回牌库·未亡' : `${lose} 阵亡`; const stay = `${win} 守原位`;
        log(`  ▶战果：掷 ${rA} ${cmp} ${rB} → ${win} 胜；${fate}；${stay}`); }
      // 先演 ~2s「哪两张牌即将交战」前奏 → 再切对决特写（owner 2026-06-21）
      showClashCue(e, () => {
        perfClash = e;
        clashRevealed = false; clashRolling = false; clashSettling = false; // owner 2026-07-01「各自掷战力骰」：进特写先藏掷值·等玩家点「掷命」→ 两骰同屏各掷自己战力范围 → 揭晓（新场解闩）
        perfResume = () => { perfResume = null; clearClashTimers(); playPerf(onDone); }; mounted?.update(); syncCoach(); // 引导：特写中隐
        zoomClashPanel('in'); // P24：特写从棋盘交战处放缩进场（露出后即刻落缩小态·rAF 长到满屏·引导视野）
      });
    };
    // 我方回合开始日志（owner 2026-07-02「记我的操作等·找 bug」）：附我方手牌 + 三路兵力(我/敌) → 一眼看清局面。
    const boardSummary = (): string => tb.lanes.map((L, i) => `${['上', '中', '下'][i]}${L.a.length}v${L.b.length}`).join(' ');
    // 详细位置快照（owner 2026-07-05·围跑日志揪位置偏移）：逐路每兵 rank+suit@slot(战力·将·连胜)·我 vs 敌·让策划从日志看有没有奇怪的位置偏移。
    const boardDetail = (): string => {
      const SM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
      const fmt = (arr: { rank: string; suit: string; slot: number; points: number; buff: number; general: boolean; wins?: number; hold?: boolean }[]): string =>
        arr.length ? arr.map((u) => `${u.rank}${SM[u.suit] ?? u.suit}@${u.slot}(战${Math.max(0, u.points + u.buff)}${u.general ? '·将' : ''}${u.wins ? `·连胜${u.wins}` : ''}${u.hold ? '·守' : ''})`).join(',') : '空';
      return tb.lanes.map((L, i) => `${['上', '中', '下'][i]}[我:${fmt(L.a)} ｜ 敌:${fmt(L.b)}]`).join('　');
    };
    const myHandStr = (): string => tb.a.hand.map((c) => c.kind === 'poker' ? `${(SUITNM2[c.suit] ?? '') + c.rank}(费${c.cost ?? 0})` : c.kind === 'tengang' ? '罡·' + tgName(c.id) : '煞').join('、') || '空';
    const finishTurnSeq = (): void => { busy = false; selMode = null; selHand = -1; if (tb.winner !== 'pending') settleTurn(); else { log(`◀ T${tb.turn} 我方回合开始 · 源泉 我${tb.a.mana}/敌${tb.b.mana} · 我手牌[${myHandStr()}] · 兵力[${boardSummary()}]`); mounted?.update(); } syncCoach(); };
    // 顺序回合·分相演出（owner 2026-06-29「顺序要对：移动→弹谁打谁→掷骰→才结算离场」）：
    //   ① advanceMovePhase 只移动(不掷命) → 渲染 FLIP 滑到位·两军前锋相邻·都还在场。
    //   ② 捕捉待掷命路前锋相邻位快照(exitCaps) → 供掷骰结算后的离场/钉桩动画(正确时序·不剧透)。
    //   ③ resolveClashAt 各路结算(数据) → drainClashes → playPerf 逐场特写(弹谁打谁→掷骰→掷币)；
    //      离场动画在每场掷币收场后才演(见 clashConfirm 回调)。④ 全部演完 endTurnFinish 收尾(判负/轮转/源泉)。
    const advancePerf = (next: () => void): void => {
      const before = snapSlots();
      const fatBefore = new Map<string, number>(); for (const L of tb.lanes) for (const u of [...L.a, ...L.b]) fatBefore.set(u.id, u.fatiguePm ?? 0); // P20 休整回血演出用：行动前各兵疲劳快照 → 收尾后diff 出「本轮前进没打·疲劳回落」的兵飘「+10% 回升」
      const lanes = advanceMovePhase(tb, log); // 只移动·不掷命 → 前锋滑到相邻·都还在场；记逐兵行走 + 碰撞判定日志（owner 2026-07-03「看牌走向哪·为啥没触发战斗」）
      justMovedIds = diffMoved(before);
      heldIds = new Set<string>(); for (const L of tb.lanes) for (const u of [...L.a, ...L.b]) if (before.has(u.id) && !justMovedIds.has(u.id)) heldIds.add(u.id); // 本轮没走的兵（原地固守/被挡）→ 亮盾（owner 2026-07-04）·hold 静守兵另由 u.hold 恒亮
      // 逐兵错峰行军（owner 2026-07-04「一步一步走·前面先走后面后走·你一步他一步」）：每条路内前锋(离交战线近)先启动·后队后启动；两军交替(我一步→敌一步)。
      //   给每兵一个错峰序 moveOrder → FLIP 按 order×STAGGER 逐个 animation-delay 起步（前=order 小·先动）。
      const moved: { id: string; side: 'a' | 'b'; front: number }[] = [];
      moveDist = new Map<string, number>();
      for (const L of tb.lanes) for (const u of [...L.a, ...L.b]) if (justMovedIds.has(u.id)) { const b4 = before.get(u.id); const oldSlot = b4 ? parseInt(b4.split(':')[1], 10) : u.slot; moveDist.set(u.id, Math.max(1, Math.abs(u.slot - oldSlot))); } // 本轮走了几格（疾行/快兵=2）→ 决定几跳·每跳恒 2s（修「多格移动塞进 2s 看着飞快」·owner 2026-07-04「半区几步看着快」）
      for (const L of tb.lanes) { for (const u of L.a) if (justMovedIds.has(u.id)) moved.push({ id: u.id, side: 'a', front: u.slot }); for (const u of L.b) if (justMovedIds.has(u.id)) moved.push({ id: u.id, side: 'b', front: -u.slot }); } // 我方前=slot 大 / 敌方前=slot 小（front 大=更前）
      const myO = moved.filter((m) => m.side === 'a').sort((x, y) => y.front - x.front); // 前→后
      const foeO = moved.filter((m) => m.side === 'b').sort((x, y) => y.front - x.front);
      moveOrder = new Map<string, number>(); { let k = 0; const n = Math.max(myO.length, foeO.length); for (let i = 0; i < n; i++) { if (myO[i]) moveOrder.set(myO[i].id, k++); if (foeO[i]) moveOrder.set(foeO[i].id, k++); } } // 交替：我i→敌i→我i+1…
      const STAGGER_TICKS = 9, PER_SLOT_TICKS = 64; // ~150ms/兵 错峰 + 每格 1s(64 tick@16ms·owner 2026-07-04「快一点·1 秒/步」·可再调)·恒速逐跳
      let walkTicks = 4; moved.forEach((m) => { walkTicks = Math.max(walkTicks, (moveOrder.get(m.id) ?? 0) * STAGGER_TICKS + (moveDist.get(m.id) ?? 1) * PER_SLOT_TICKS + 4); }); // 末兵启动 + 逐跳全走完
      mounted?.update(); // 渲染滑动到位（FLIP 逐兵错峰起步·owner「看到一步步前进路线」）
      exitCaps.clear();
      for (const li of lanes) { const fa = tb.lanes[li].a[0], fb = tb.lanes[li].b[0]; if (fa) { const s = captureUnit(fa.id); if (s) exitCaps.set(fa.id, s); } if (fb) { const s = captureUnit(fb.id); if (s) exitCaps.set(fb.id, s); } } // 相邻位快照(供离场动画)
      for (const li of lanes) resolveClashAt(tb, li); // 结算(数据)→ clashLog
      drainClashes();
      perfPending = perfQueue.length > 0; // 有对决排队 → 保持棋盘贴身对峙到掷骰特写盖上（下面 walk 末的重渲也据它跳过）
      // 行军全走完 → 清标记（+无对决时同步板面）→ 才演对决（谁打谁→掷骰）：owner「一步步走完·再打」——不再走一半就弹提示。
      battleTl.delay(pT(walkTicks), () => { justMovedIds = new Set(); moveOrder = new Map(); moveDist = new Map(); if (!perfClash && !perfPending) mounted?.update(); playPerf(() => { endTurnFinish(tb); log(`  📍行动毕·全场位置：${boardDetail()}`); justMovedIds = new Set(); mounted?.update(); showRestRecovery(fatBefore); next(); }); }); // 行动+对决全演完 → 打全场位置快照(移动后+战后位置·owner 2026-07-05 揪偏移) + 休整恢复演出·走查快进 pT
    };
    const runAiAct = (): void => { // 敌方行动阶段：敌方兵线推进 + 掷命（与决策分演·owner 过场说明）
      if (tb.winner !== 'pending') { finishTurnSeq(); return; }
      showBanner('敌方行动', 800, () => { log(`敌·行动：兵线推进（源泉 我${tb.a.mana}/敌${tb.b.mana}）`); advancePerf(() => showBanner('我方回合 · 决策', 1000, finishTurnSeq)); });
    };
    const runAiDecide = (): void => { // 敌方决策阶段：AI 放牌/施法/打地煞（**不推进**）→ 玩家看清敌方布阵，再单独演行动
      if (tb.winner !== 'pending') { finishTurnSeq(); return; }
      showBanner('敌方决策', 1000, () => {
        startThinking(() => {
          const before = snapSlots();
          const prevCastIds = [...tb.b.castIds];
          const manaBefore = tb.b.mana; // 决策前敌方源泉（aiDecide 会一次性扣到最终值·下面随落牌错峰把展示值从这里递减过去）
          const usedDisha = aiDecide(tb, aggregateTengang, log); // 只决策·不结束回合（owner 2026-06-29 顺序回合）·记 AI 每步决策日志（owner 2026-07-02「要看敌人 AI 决定」）
          justMovedIds = new Set(); // 决策阶段不推进 → 无行军滑动
          // 新部署的敌兵（before 没有的 id）→ 逐张落子错峰 + 部署音
          freshIds = new Map(); let fi = 0; const newFoe: string[] = [];
          for (const L of tb.lanes) for (const u of L.b) if (!before.has(u.id)) { freshIds.set(u.id, fi); const d = fi * 150; window.setTimeout(() => playSfx('deploy'), d); fi++; newFoe.push(`${u.rank}${SUITNM2[u.suit] ?? ''}→${LANE_NM[tb.lanes.indexOf(L)] ?? '?'}`); }
          // 敌源泉「随落牌啪啪啪递减」（owner 2026-07-03「别直接跳 0」）：展示值从 manaBefore 随每张落牌错峰减到真值 tb.b.mana。
          const manaAfter = tb.b.mana;
          if (fi > 0 && manaBefore > manaAfter + 0.01) {
            aiManaDisplay = manaBefore;
            for (let k = 1; k <= fi; k++) window.setTimeout(() => { aiManaDisplay = Math.max(manaAfter, Math.round((manaBefore - (manaBefore - manaAfter) * k / fi) * 2) / 2); mounted?.update(); }, k * 150);
            window.setTimeout(() => { aiManaDisplay = null; mounted?.update(); }, fi * 150 + 220); // 收尾归真值（显 tb.b.mana）
          } else { aiManaDisplay = null; }
          const newCast = tb.b.castIds.filter((id) => !prevCastIds.includes(id)).map((id) => tgName(id));
          usedDisha.forEach((id) => log(`敌·施放地煞「${DISHA_NAME[id] ?? id}」（整场生效）`));
          log(`敌·决策：部署[${newFoe.join('、') || '无'}]${newCast.length ? ` 施天罡[${newCast.join('、')}]` : ''}（源泉 我${tb.a.mana}/敌${tb.b.mana}）`);
          mounted?.update(); // 敌方布阵落子
          const afterDeploy = Math.max(700, fi * 150 + 450);
          window.setTimeout(() => { freshIds = new Map(); if (!perfClash) mounted?.update(); }, afterDeploy);
          // 决策演完 →（地煞全屏通知·REQ-G #6）→ 敌方行动阶段
          const toAct = (): void => { window.setTimeout(runAiAct, afterDeploy); };
          if (usedDisha.length) { let qi = 0; const nextDisha = (): void => { if (qi >= usedDisha.length) { toAct(); return; } const nm = DISHA_NAME[usedDisha[qi++]] ?? '地煞'; playSfx('cast'); showBanner(`敌人使用地煞 · ${nm}`, 1500, nextDisha); }; nextDisha(); }
          else toAct();
        });
      });
    };
    const commitEndTurn = (): void => {
      if (busy || tb.winner !== 'pending' || tb.active !== 'a') return;
      busy = true; selMode = null; selHand = -1; playSfx('endTurn'); coachDid('endturn'); log('我·结束回合 → 我方行动（推进/攻击·顺序回合）');
      showBanner('我方行动', 750, () => advancePerf(runAiDecide)); // 我方决策(放牌)毕 → 我方行动(推进+滑动+掷命) → 敌方决策
    };
    const actions: TurnBattleActions = {
      pickAction: (kind) => { if (busy || tb.active !== 'a') return; if (kind === 'swap' && tb.a.swapsUsed >= SWAP_PER_TURN) { playSfx('invalid'); flash('✗ 换牌本回合已用尽（1/回合）'); return; } selMode = selMode === kind ? null : kind; selHand = -1; playSfx('select'); mounted?.update(); syncCoach(); }, // 三行为自由·互不互斥（owner 2026-07-03·源泉唯一门·去掉大类互斥）；开子菜单先重渲落 DOM 再 syncCoach 让引导高亮跟到子钮
      playPick: (kind) => { if (busy || selMode !== 'play') return; playKind = kind; selHand = -1; playSfx('select'); mounted?.update(); syncCoach(); }, // 打·切子模式（部署扑克/打天罡）
      swapPick: (from) => { if (busy || selMode !== 'swap') return; if (tb.a.swapsUsed >= SWAP_PER_TURN) { playSfx('invalid'); return; } swapFrom = from; selHand = -1; playSfx('select'); mounted?.update(); }, // 换·选补牌库（天罡/扑克）
      drawFrom: (from) => {
        if (busy || selMode !== 'draw') return;
        if (drawCard(tb, 'a', from)) { playSfx('draw'); coachDid(from === 'poker' ? 'draw-poker' : 'draw-tengang'); const nc = tb.a.hand[tb.a.hand.length - 1]; log(`我·抽牌(${from === 'poker' ? '扑克' : '天罡'}) -${DRAW_COST}源泉 → ${nc ? cardLabel(nc) : '?'} [剩${tb.a.mana}源泉]`); dealtId = tb.a.hand[tb.a.hand.length - 1]?.id ?? null; const did = dealtId; window.setTimeout(() => { if (dealtId === did) { dealtId = null; if (!perfClash) mounted?.update(); } }, 560); } // 抽到的牌飞入翻面入场·~560ms 后清标记
        else { // 抽不了 → 明确提示原因（owner 2026-06-21：源泉不够要提示「抽不了」）
          const deck = from === 'poker' ? tb.a.pokerDeck : tb.a.tengangDeck;
          playSfx('invalid');
          if (tb.a.mana < DRAW_COST) flash('✗ 召唤源泉不足，抽不了——结束回合自动 +1 点再抽');
          else if (deck.length === 0) flash(`✗ ${from === 'poker' ? '扑克' : '天罡'}牌库空了，没得抽了`);
          else flash('✗ 手牌已满，先打出/弃牌再抽');
        }
      },
      selectHand: (i) => {
        if (busy || tb.active !== 'a') return;
        const card = tb.a.hand[i];
        if (selMode === 'swap') { // 换牌：选牌库→点手里1张 → 弃并从该库随机补1张（1/回合·免费）
          if (tb.a.swapsUsed >= SWAP_PER_TURN) { playSfx('invalid'); flash('✗ 换牌本回合已用尽（1/回合）'); return; }
          const sc = card; if (swapCard(tb, 'a', i, swapFrom)) { playSfx('draw'); const nc = tb.a.hand[tb.a.hand.length - 1]; log(`我·换牌 ${sc ? cardLabel(sc) : '?'} → 补${swapFrom === 'poker' ? '扑克' : '天罡'} ${nc ? cardLabel(nc) : '?'}（免费·1/回合·已用尽）`); flash('✓ 换牌成功——补入 1 张（本回合换牌用尽）'); dealtId = nc?.id ?? null; }
          else { playSfx('invalid'); flash(`✗ ${swapFrom === 'poker' ? '扑克' : '天罡'}牌库空了，换不了`); }
          selHand = -1; selMode = null; // 换牌用尽 → 收起子菜单
        }
        // 打·天罡：选中一张天罡牌 → 立即施放（施法即时·无需点路）
        else if (selMode === 'play' && card?.kind === 'tengang') { const tc = card; if (castTengang(tb, 'a', i)) { playKind = 'cast'; tb.a.tengangA = aggregateTengang(tb.a.castIds); tb.a.castFx = tb.a.castIds.map((id) => ({ id, fx: aggregateTengang([id]) })); playSfx('cast'); coachDid('cast'); log(`我·打天罡 ${tc ? cardLabel(tc) : '?'} -${CAST_COST}源泉 [剩${tb.a.mana}源泉]`); } else { playSfx('invalid'); flash('✗ 源泉不足，打不了天罡'); } selHand = -1; }
        // 打·扑克：选中一张兵牌 → 高亮待放·再点一路落子（默认也进打·部署）
        else { selMode = 'play'; playKind = 'deploy'; selHand = selHand === i ? -1 : i; playSfx('select'); }
      },
      playLane: (lane) => { if (busy || selMode !== 'play' || selHand < 0) return; const pc = tb.a.hand[selHand]; const pCost = pc?.kind === 'poker' ? (pc.cost ?? 0) : 0; if (deployUnit(tb, 'a', selHand, lane)) { selHand = -1; playSfx('deploy'); coachDid('deploy'); log(`我·部署 ${pc ? cardLabel(pc) : '?'} → ${LANE_NM[lane] ?? lane}${pCost ? ` -${pCost}源泉` : '（免费）'} [剩${tb.a.mana}源泉]`); flash('✓ 部署成功——可继续打牌'); } },
      endTurn: commitEndTurn,
      setTheme: (t) => { theme = t; },
      clashConfirm: () => { // owner 2026-07-01：未掷→先掷两骰(各掷自己战力范围)；已揭晓→点「继续」一步步演结算（先谁死·再幸存者头顶「战力对折 −N」）→ perfResume
        if (perfClash && !clashRevealed) { doClashRoll(); return; } // 各自掷战力骰（owner 2026-07-01·两骰同屏）
        if (clashSettling) return; // 结算演出进行中 → 忽略重复「继续」点击（owner 2026-07-04·防狂点不停重播）
        clearClashTimers();
        if (!perfClash) { const r = perfResume; if (r) r(); return; }
        playSfx('confirm'); const e = perfClash; clashSettling = true; // 上闩·收场(resume)才解
        // 一步步清晰（owner 2026-07-01「先表现谁死·再把幸存者减多少战力写头上」）：演出时序改由**引擎 t3-timeline** 出（owner 2026-07-03「用 timeline·不手写排程」）——
        //   ① clash:slay 败者阵亡 → ③ clash:survivor 幸存者去留（战力对折/光荣回库）→ ④ clash:resume 续下一场。表演在上面的 battleTl 订阅里（playGhost·锚 u-id）。
        const loserId = e.aWins ? e.b.id : e.a.id; const winnerId = e.aWins ? e.a.id : e.b.id;
        const w = e.aWins ? e.a : e.b; const cut = w.pEff - Math.floor(w.pEff / 2); const streak = e.winStreak ?? 1; const fatPct = e.fatiguePm != null ? Math.round(e.fatiguePm / 10) : 50; // 本场胜者：本场对折削减量 + 累计疲劳%（owner 2026-07-06·连续疲劳条·写清扣了多少/累计多疲）
        postClashCtx = { e, loserId, winnerId, cut, streak, fatPct };
        // P24（owner 2026-07-04「先把对决 UI 关掉·再显示谁被打死谁前进」）：先把特写缩回棋盘交战处 + 淡出 → 关 UI 露出棋盘 → 才在棋盘上演斩/去留（谁死谁进一目了然·非硬切）。
        zoomClashPanel('out', () => {
          perfClash = null; clashRevealed = false; mounted?.update(); // 关特写·露出棋盘（本路已结算·数据态败者已离场）→ 让斩/去留演在可见棋盘上
          battleTl.play({ id: 'clash-settle', cues: [
            { at: 0, do: { kind: 'signal', signal: 'clash:slay' } },              // ① 斩败者（≈0.5s 一刀两断·先死·清楚·此刻棋盘可见）
            { at: pT(40), do: { kind: 'signal', signal: 'clash:survivor' } },     // ② ≈670ms 斩定后·幸存者去留(对折)+驻留徽标（胜者守原位·owner 2026-07-04）·走查快进 pT
            { at: pT(40) + pT(40), do: { kind: 'signal', signal: 'clash:resume' } }, // ③ ≈1330ms 收场续下一场·走查快进（保序 slay<survivor<resume）
          ] });
        });
      },
      clashRoll: () => doClashRoll(), // 各自掷战力骰（owner 2026-07-01·两骰同屏各掷自己战力范围）
      goBack: () => {
        if (tb.winner !== 'pending') { showLobby(); return; }
        // 数据驱动 UI 采纳试点（用引擎 components/LayoutNode 替手写 innerHTML）：确认框 = LayoutNode 数据树，mountUI 是固定解释器。
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:200';
        document.body.appendChild(ov);
        const tree: LayoutNode = {
          type: 'Screen', id: 'gg-back-screen', props: { bg: { custom: 'rgba(0,0,0,.72)' }, center: true } as ScreenProps,
          children: [{
            type: 'Panel', id: 'gg-back-panel', props: {} as PanelProps,
            layout: { gap: 12, padding: 26, width: 300, align: 'stretch' },
            children: [
              { type: 'Label', id: 'gg-back-title', props: { text: '返回大厅？', size: 'lg', bold: true } as LabelProps },
              { type: 'Label', id: 'gg-back-warn', props: { text: '当前战斗进度将丢失，无法恢复。', size: 'sm', color: 'sub' } as LabelProps },
              { type: 'Button', id: 'gg-back-no', props: { label: '继续战斗', kind: 'ghost', action: 'cancel' } as ButtonProps },
              { type: 'Button', id: 'gg-back-yes', props: { label: '确认返回', kind: 'primary', action: 'confirm' } as ButtonProps },
            ],
          }],
        };
        const teardown = mountUI(ov, tree, {
          cancel: () => { teardown(); ov.remove(); },
          confirm: () => { teardown(); ov.remove(); showLobby(); },
        }, GG_THEME_ONYX); // 喂 game-g 古风主题 → 同一份 LayoutNode 数据渲成古风皮
        ov.addEventListener('click', (e) => { if ((e.target as HTMLElement).id === 'gg-back-screen') { teardown(); ov.remove(); } }); // 点背景关闭
      },
      // 点敌方大本营 → 弹本关 Boss 名号 + 战役历史故事（owner 2026-06-21·边打边读历史）。数据接 blueprint STAGE_CAMPAIGN。
      bossInfo: () => {
        const camp = campaignFor(save.stage);
        const quote = camp.bossLines?.open ?? '';
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:210;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Noto Serif SC",serif';
        ov.innerHTML = `<div style="background:linear-gradient(165deg,#1b2336,#0f1622);border:1px solid #3a4f78;border-radius:16px;padding:26px 30px;max-width:560px;max-height:82vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.85)">
          <div style="font-size:12px;letter-spacing:.16em;color:#5ea0e0;font-weight:700;margin-bottom:6px">⚔ 终局 Boss · 第 ${save.stage} 关</div>
          <div style="font-weight:800;font-size:26px;color:#e8cd82;margin-bottom:3px">${camp.boss}</div>
          <div style="font-size:13px;color:#9fb3cc;margin-bottom:14px">${camp.battle} · ${camp.oneLiner}</div>
          ${quote ? `<div style="border-left:3px solid #5ea0e0;padding:6px 0 6px 13px;margin-bottom:15px;color:#cfe0f3;font-size:14px;line-height:1.65">「${quote}」</div>` : ''}
          <div style="font-size:13.5px;color:#d6dee8;line-height:1.9;text-align:justify">${camp.intro ?? '（这位名将的故事，正在续写……）'}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:20px">
            <button id="gg-boss-ok" style="padding:9px 26px;border-radius:9px;border:none;background:linear-gradient(180deg,#f0d68f,#d9b86a);color:#2a1a08;cursor:pointer;font:700 13px system-ui">知道了 ▸</button>
          </div>
        </div>`;
        document.body.appendChild(ov);
        ov.querySelector('#gg-boss-ok')?.addEventListener('click', () => ov.remove());
        ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
        playSfx('select');
      },
      toggleSfx: () => { const on = toggleSfx(); if (on) playSfx('select'); mounted?.update(); },
      toggleSettings: () => { settingsOpen = !settingsOpen; mounted?.update(); },
      toggleBgm: () => { toggleBgmState(); mounted?.update(); }, // BGM 开/关·与音效分开
      toggleGuide: () => { save.skipGuide = !save.skipGuide; persist(save); coachStep = save.skipGuide ? null : nextCoachStep(save.seen, { hasTengang: hasTengangNow() }); flash(save.skipGuide ? '✓ 已关闭新手引导' : '✓ 已开启新手引导'); syncCoach(); mounted?.update(); }, // 彻底跳过/重启引导（卡住保险阀·owner 2026-06-21）
      selectBgm: (i) => { selectBgmState(i); playSfx('select'); mounted?.update(); },
      setBgmVol: (dir) => { setBgmVolume(bgmVolume() + (dir === 'up' ? 0.1 : -0.1)); mounted?.update(); },
    };
    mounted = mountTurnBattle(stage, view, actions);
    battle = mounted; // teardownMatch 清理（destroy）

    // ── 战斗新手引导（coachmark 能力·首通即教·seen 存档不再弹·owner 2026-06-21）──
    // 打天罡相关步按**手牌活检**判定（owner 2026-06-21·修「抽牌紧接打天罡」互斥卡死）：手里真有天罡才推进到「结束回合→打天罡」，
    // 否则跳过、不让玩家卡在做不到的操作上。抽牌步会引导玩家先摸一张天罡。
    const hasTengangNow = (): boolean => tb.a.hand.some((c) => c.kind === 'tengang'); // 手里真有天罡才可打 → 才推进打天罡步（避免卡死）
    let coachStep: BattleCoachStep | null = save.skipGuide ? null : nextCoachStep(save.seen, { hasTengang: hasTengangNow() }); // 跳过引导 → 不启动战斗 coach
    const { world: coachWorld, setStep: setCoachStep } = makeCoachWorld();
    const coach = mountOnboardingOverlay(document.body, coachWorld, stage); // 总是挂（挂 body·避战场缩放偏移）；可见性由 coachStep/syncCoach 控（菜单可实时开关·owner 2026-06-21）
    // 三行为高亮回退（owner 2026-07-03）：抽/打的子步在对应行为未点开时先高亮顶钮（抽=combat-draw / 打=combat-play）·点开后再落到子钮（抽走 combat-draw-pick 容器；部署/打天罡子钮各带 combat-deploy/combat-cast）。
    const effectiveStep = (): BattleCoachStep | null => {
      if (!coachStep) return null;
      const on = coachStep.on;
      if ((on === 'draw-poker' || on === 'draw-tengang')) return { ...coachStep, anchor: selMode === 'draw' ? 'combat-draw-pick' : 'combat-draw' };
      if ((on === 'deploy' || on === 'cast')) return { ...coachStep, anchor: selMode === 'play' ? (on === 'deploy' ? 'combat-deploy' : 'combat-cast') : 'combat-play' };
      return coachStep;
    };
    syncCoach = (): void => {
      if (!coach) return;
      // 掷骰步在对决特写里出（perfClash 在场且未揭晓·此时 active 多为 b/敌方推进结算·故不卡 active）；其余步在玩家可操作回合(active a·非特写)时出。
      const show = coachStep?.on === 'roll'
        ? (coachStep != null && tb.winner === 'pending' && perfClash != null && !clashRevealed)
        : (coachStep != null && tb.active === 'a' && tb.winner === 'pending' && perfClash == null);
      setCoachStep(effectiveStep(), show); coach.update();
    };
    coachDid = (on: BattleCoachStep['on']): void => { if (!coachStep || coachStep.on !== on) return; save.seen[coachStep.flag] = true; persist(save); coachStep = nextCoachStep(save.seen, { hasTengang: hasTengangNow() }); syncCoach(); };
    const onCoachResize = (): void => syncCoach();
    if (coach) { syncCoach(); window.addEventListener('resize', onCoachResize); }

    // ── 操作日志 debug 钮（owner 2026-06-21）：左下小钮 → 弹可复制日志（出 bug 贴给开发排查）──
    const dbgBtn = el('div', 'position:absolute;left:10px;bottom:10px;z-index:120;padding:5px 10px;border-radius:8px;cursor:pointer;background:rgba(20,26,38,.82);border:1px solid rgba(255,255,255,.16);color:#9fb0c2;font:11px system-ui;user-select:none', '📋 操作日志');
    dbgBtn.onclick = () => {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,9,13,.82);backdrop-filter:blur(4px);font-family:system-ui';
      const text = `Game G 战场操作日志（第 ${save.stage} 战 · ${dbg.length} 条）\n${'='.repeat(40)}\n${dbg.join('\n') || '（暂无操作）'}`;
      ov.innerHTML = `<div style="width:min(92%,820px);max-height:84vh;display:flex;flex-direction:column;gap:10px;background:#121826;border:1px solid #2a3346;border-radius:14px;padding:16px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:#eaf0f6;font-size:15px;flex:1">📋 战场操作日志</b><button id="dbg-alltg" style="padding:7px 12px;border-radius:8px;border:1px solid #6b4bd6;cursor:pointer;background:rgba(124,58,237,.18);color:#c4b5fd;font-weight:700">🃏 全天罡到手</button><button id="dbg-mana" style="padding:7px 12px;border-radius:8px;border:1px solid #2b6ca8;cursor:pointer;background:rgba(58,134,212,.18);color:#93c5fd;font-weight:700">💧 +10源泉</button><button id="dbg-copy" style="padding:7px 16px;border-radius:8px;border:none;cursor:pointer;background:linear-gradient(180deg,#ff8d5a,#ee5a25);color:#fff;font-weight:700">复制</button><button id="dbg-close" style="padding:7px 14px;border-radius:8px;border:1px solid #3a4659;cursor:pointer;background:transparent;color:#cdd7e3">关闭</button></div>
        <textarea id="dbg-text" readonly style="flex:1;min-height:340px;resize:none;background:#0b0f17;color:#bcd;border:1px solid #2a3346;border-radius:10px;padding:11px;font:12px/1.5 ui-monospace,monospace;white-space:pre"></textarea>
        <div id="dbg-hint" style="font-size:11px;color:#7d8b9a">出 bug 点「复制」贴给开发排查。｜dev：🃏 把全部天罡调到手牌(+源泉) · 💧 加源泉 → 测天罡用。</div></div>`;
      root.appendChild(ov);
      const ta = ov.querySelector('#dbg-text') as HTMLTextAreaElement; ta.value = text;
      const close = (): void => ov.remove();
      ov.querySelector('#dbg-close')?.addEventListener('click', close);
      ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
      ov.querySelector('#dbg-copy')?.addEventListener('click', () => {
        ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
        if (!ok && navigator.clipboard) void navigator.clipboard.writeText(text).catch(() => {});
        const h = ov.querySelector('#dbg-hint'); if (h) h.textContent = '✓ 已复制到剪贴板。';
      });
      // dev 调试（owner 2026-07-06·日志面板内）：🃏 把全部天罡调到手牌 + 加满源泉（测天罡用）· 💧 加源泉。
      ov.querySelector('#dbg-alltg')?.addEventListener('click', () => {
        for (const t of GAME_G_TIANGANGS) debugGrantTengang(tb, 'a', t.id); // 全部天罡进手牌
        debugAddMana(tb, 'a', GAME_G_TIANGANGS.length * 2); // 加足源泉好施放
        mounted?.update(); log(`🛠dev·全天罡到手牌(${GAME_G_TIANGANGS.length}张)+加源泉→${tb.a.mana}`); close();
      });
      ov.querySelector('#dbg-mana')?.addEventListener('click', () => {
        debugAddMana(tb, 'a', 10); mounted?.update(); const h = ov.querySelector('#dbg-hint'); if (h) h.textContent = `✓ 源泉 +10 → 现 ${tb.a.mana}。`;
      });
    };
    root.appendChild(dbgBtn); // 挂 root(非 stage·避免 mountTurnBattle 重渲抹掉)·左下角

    // ── 开局布防亮相（owner 2026-07-04「别让敌兵凭空预置·像源泉没扣；演个敌方布防初始拍·啪啪放兵再轮到我」）──
    // 敌兵已在场（布防免费·源泉不减=设计）；freshIds 预置已让首帧逐张 g-drop 落下——这里补横幅 + 逐张部署音把「敌方开局设防」演清楚，毕后清 fresh 标交给玩家。
    if (garrisonIds.length) {
      showBanner(`敌方开局布防 · 设防 ${garrisonIds.length} 兵`, 1200);
      garrisonIds.forEach((_, k) => window.setTimeout(() => playSfx('deploy'), 260 + k * 170)); // 啪啪逐张落桌音
      const dur = 260 + garrisonIds.length * 170 + 520;
      window.setTimeout(() => { freshIds = new Map(); if (!perfClash) mounted?.update(); log(`◀ 敌方开局布防毕（设防${garrisonIds.length}兵·免费额外线）→ 我方回合`); }, dur); // 亮相毕清 fresh 标·转我方回合
    }

    stopLoop = () => { perfResume = null; postClashCtx = null; battleTl.destroy(); clearClashTimers(); if (noticeTimer) { clearTimeout(noticeTimer); noticeTimer = 0; } if (thinkTimer) { clearTimeout(thinkTimer); thinkTimer = 0; } if (thinkEl) { thinkEl.remove(); thinkEl = null; } if (coach) { window.removeEventListener('resize', onCoachResize); coach.destroy(); } }; // 离场：弃未决特写续演 + 停战斗演出 timeline + 清硬币浮层/倒计时 + 清提示计时 + 清思考蒙层 + 卸引导

    function settleTurn(): void {
      const survA = tb.lanes.reduce((s, L) => s + L.a.length + L.spentA, 0);
      const lanesA = tb.lanes.filter((L) => L.a.length + L.spentA > L.b.length + L.spentB).length;
      const lanesB = tb.lanes.filter((L) => L.b.length + L.spentB > L.a.length + L.spentA).length;
      const homeA = tb.homeA, homeB = tb.homeB, winner = tb.winner, homeMax = tb.homeMax;
      playSfx(winner === 'a' ? 'victory' : 'defeat'); // 收场号角 / 哀落
      // 战利品 = 全局战果(幸存兵 + 胜方 +15)，再按【今日卦象】做 ±（owner 2026-06-21：大吉多得/大凶少得·这是卦象在结算层的加减·与出战部署 buff 并存）。
      const baseGain = survA + (winner === 'a' ? 15 : 0);
      const gain = Math.max(0, baseGain + fortuneBuff); // 卦象 ±：大吉+2/吉+1/中庸0/小凶−1/大凶−2（夹 ≥0）
      const fortuneLabel = save.fortune.keptVal != null ? luckyFromVal(save.fortune.keptVal).label : null;
      const lootSub = fortuneLabel ? `基础 ${baseGain} · 卦象${fortuneLabel} ${fortuneBuff >= 0 ? '+' : ''}${fortuneBuff}` : '材料 🪙';
      save.materials += gain;
      log(`▼结算：${winner === 'a' ? '我方胜' : winner === 'b' ? '敌方胜' : '平局'} ｜控路 我${lanesA}:敌${lanesB} ｜大本营 我${homeA}/敌${homeB}（满${homeMax}）｜战利品 +${gain}（基础${baseGain}${fortuneLabel ? `·卦象${fortuneLabel}${fortuneBuff >= 0 ? '+' : ''}${fortuneBuff}` : ''}）`);
      let tail = '', cont = '回大厅', route: () => void = showLobby;
      if (winner === 'a') {
        save.campaignMax = Math.max(save.campaignMax, save.stage);
        save.leverEnergy = Math.min(effectiveLeverCap(save.planets), save.leverEnergy + effectiveLeverRegen(save.planets));
        if (save.stage >= RUN_BATTLES) { save.materials += 50; tail = '🏆 <b>通关战役！</b>（+50 材料）回大厅开新战役'; save.stage = 1; save.lives = effectiveLives(save.planets); save.bossIdx = rollBoss(); }
        else { save.stage += 1; tail = `进军 第 ${save.stage}/${RUN_BATTLES} 战`; cont = '战间整备（三选一）'; const nl = `进军第 ${save.stage} 战`; route = () => showBetween(nl); }
      } else {
        save.lives -= 1;
        if (save.lives <= 0) { tail = '💀 <b>命尽，战役结束</b> 回大厅重整'; save.stage = 1; save.lives = effectiveLives(save.planets); save.bossIdx = rollBoss(); }
        else { tail = `命 −1（剩 ${save.lives}）重整旗鼓再战本场`; cont = '重整再战'; route = startBattle; }
      }
      const qm = quartermasterEnergy(save.tiangangs, lanesA);
      if (qm > 0) { save.leverEnergy = Math.min(effectiveLeverCap(save.planets), save.leverEnergy + qm); tail += `（督粮 +${qm}◈）`; }
      persist(save);
      // 平台触点（Steam/假 Steam·sim 外）：胜利解成就 + 传战役进度排行 + 富状态。不可用静默。
      if (winner === 'a') ggOnBattleWon({ campaignMax: save.campaignMax, flawless: homeA === homeMax });
      const who = winner === 'a' ? '我方胜（破敌大本营）' : winner === 'b' ? '敌方胜（我大本营被破）' : '平局（无人破家）';
      const bigTxt = winner === 'a' ? '胜 利' : winner === 'b' ? '战 败' : '平 局';
      const bigCol = winner === 'a' ? '#ffe09a' : winner === 'b' ? '#ff6b6b' : '#cbd5e1';
      const stat = (lab: string, val: string, sub: string): string => `<div style="padding:14px 12px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);text-align:center;"><div style="font-size:11px;letter-spacing:.14em;color:#8493a3;text-transform:uppercase;">${lab}</div><div style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:25px;color:#eaf0f6;margin:5px 0 2px;">${val}</div><div style="font-size:11px;color:#7d8b9a;">${sub}</div></div>`;
      const result = document.createElement('div');
      result.style.cssText = 'position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(60% 60% at 50% 42%,rgba(8,12,18,.74),rgba(4,6,10,.93));backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);font-family:"Noto Sans SC",sans-serif;';
      result.innerHTML = `<div style="width:min(86%,720px);padding:34px 40px;border-radius:22px;background:linear-gradient(180deg,rgba(26,38,54,.97),rgba(12,18,28,.99));border:2px solid ${bigCol}66;box-shadow:0 30px 90px rgba(0,0,0,.72),0 0 64px ${bigCol}33;text-align:center;">
        <div style="font-family:'Zhi Mang Xing',cursive;font-size:80px;line-height:1;color:${bigCol};text-shadow:0 4px 26px ${bigCol}66;">${bigTxt}</div>
        <div style="font-size:16px;color:#cdd7e3;margin-top:6px;">${who} ｜ 敌阵【${aiName}】</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:26px 0 18px;">
          ${stat('战利品', '+' + gain, lootSub)}${stat('控路', lanesA + ' : ' + lanesB, '我方 : 敌方')}${stat('大本营', '我 ' + homeA + ' / 敌 ' + homeB, '满 ' + homeMax)}${qm > 0 ? stat('督粮', '+' + qm + '◈', '入下场能量') : ''}
        </div>
        <div style="font-size:14px;color:#9fb0c2;margin-bottom:22px;min-height:18px;">${tail}</div>
        <button id="gg-result-cont" style="padding:14px 44px;border-radius:13px;border:none;cursor:pointer;background:linear-gradient(180deg,#ff8d5a,#ee5a25);color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:19px;letter-spacing:.04em;box-shadow:0 10px 28px rgba(238,90,37,.5);">${cont} →</button>
      </div>`;
      root.appendChild(result); // 结算覆盖层挂 root（非 stage=mountTurnBattle 宿主）→ 战斗屏重渲(render 整片重建 stage)不会抹掉它
      result.querySelector('#gg-result-cont')?.addEventListener('click', route);
    }
  }

  showLobby();
  return () => {
    container.removeEventListener('pointerdown', bgmKick);
    stopBgm();
    teardownMatch();
    root.remove();
  };
}

function el(tag: string, css: string, html = ''): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.innerHTML = html;
  return e;
}
