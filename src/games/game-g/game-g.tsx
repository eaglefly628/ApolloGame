import { mountBattle, type BattleView, type BattleUnit, type BattleLane, type BattleLever, type HandCardView, type TengangCardView, type BattleActions, type ClashView, type BattleFx } from './battle-screen.js';
import { mountLobby, type LobbyView, type LobbyShopItem } from './lobby-screen.js';
import { prepareArmies, quartermasterEnergy, FORMATION_PRESETS, PRESET_NAMES, LEVER_CATALOG, LEVER_START, battleSpec, RUN_BATTLES, RUN_LIVES, BETWEEN_BUFFS, applyBuff, tiangangKeyBuffs, BOSS_ROSTER, bossFor, GAME_G_TIANGANGS, TIANGANG_BY_ID, ARCHETYPES, detectArchetype, archetypeMatchup, activeArchetype, pickAiFormation, GAME_G_PLANETS, GAME_G_FOILS, RECHARGE_PACKS, rechargeTotal, DIAMOND_EXCHANGES, DIZHI_SHARD_PACKS, RECHARGE_PASSWORD, GACHA, gachaCost, DIZHI_MAX_TIER, DIZHI_TIER_NM, DIZHI_TIER_CAP, dizhiMerge, dizhiTotal, dizhiTopTier, DIZHI_ZODIACS, INLAY_MAX, effectiveDeckFavors, POKER_PICK_SIZE, isPoolCardId, autoBuildPokerPicks, cardFavorIndex, rankOfCardId, deployCost, isHeroOwned, heroCardByName, effectiveLives, effectiveLeverCap, effectiveLeverRegen, campaignFor, unlockStageOf, type Formation, type Intervention, type LeverKind, type RunBuff, type ArmyCard, type InlayEntry } from './index.js';
import { initLiveBattle, stepLiveBattle, liveActive, migrateRear, NO_TENGANG, LANE_LEN, HOME_BLOOD, type LiveBattle, type DeployCmd, type ClashEvent, type TengangFx } from './live-combat.js';
import { initTurnBattle, drawCard, deployUnit, castTengang, discardCard, endTurn, aiTakeTurn, toggleGate, GATES, OPENING_HAND, DRAW_COST, clashDiceRoll, type PokerCard, type TengangHandCard } from './turn-combat.js';
import { mountDiceRoll } from './dice-roll.js';
import { mountTurnBattle, buildTurnBattleView, type TurnBattleView, type TurnBattleActions, type TurnClashView, type TurnClashCardView, type TurnShaView } from './turn-battle-screen.js';
import { loadLevel } from './level.js';
import { cardPoints, P_MAX } from './clash-resolve.js';
import { playSfx, isSfxOn, toggleSfx } from './sound.js';
import { startBgm, stopBgm, toggleBgm as toggleBgmState, selectBgm as selectBgmState, setBgmVolume, isBgmOn, bgmTrackIdx, bgmVolume, BGM_TRACKS } from './bgm.js';
import { makeCoachWorld, nextCoachStep, type BattleCoachStep } from './battle-coach.js';
import { mountOnboardingOverlay } from '@ui/onboarding-overlay.js';

// Game G ·《翻命扑克》—— 大厅 ↔ 出征 闭环（launcher 卡带槽：export mount(container)→cleanup）。自包含于本目录。
// outcome-first：每张牌按 favor 跑确定性种子硬币**先定生死**，3D 翻牌是**反推的表现**（抛飞→相撞→落定翻面）。
// 闭环：大厅看材料/牌组 → 花材料改造牌组(升 favor) → 出征打一关(buildGameGMatch) → 赢取材料、关卡递增 → 再改造。
// 进度本地存档；胜负=数据决策（不回灌）；3D 只在 ThreeRenderer 表现层。是 gameF 大厅式挂载编排，复用现成能力。
const W = 600;
const H = 540;
const DECK_SIZE = 52;
const SAVE_KEY = 'gameG-save-v1';
// 天罡牌组（owner 2026-06-20）：每场带 12 张天罡出战；玩家可建多套具名牌组、选一套出战、预览。数字可变 → 改这一处。
const TIANGANG_DECK_SIZE = 12;
const MAX_TIANGANG_DECKS = 6; // 牌组槽位上限
// 大厅根容器样式：默认屏(布阵/备战/战斗)居中竖排；大厅屏改顶对齐可滚动(承载 5 tab 古风布局)。
const DEFAULT_ROOT_CSS = 'position:absolute;inset:0;background:#0a0a14;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#cbd5e1;font:13px system-ui';
const LOBBY_ROOT_CSS = 'position:absolute;inset:0;overflow:auto';
// WIRE-MARCH 节奏（owner 钉死「一格格慢慢走」，doc18 §八）：sim 每 LIVE_STEP_MS 走一拍（MARCH_STEP=2 格），
// 渲染按真拍间 frac 平滑滑行（~RENDER_MS 一帧）。owner 反馈「太快来不及看」→ 600ms/拍（比首版慢 1 倍），更从容观察；
// 每场对决再叠加特写表演（PERF_MS 冻结战场细看）。SEC_PER_TICK 派生读秒。
const LIVE_STEP_MS = 600;   // 一拍真实时长（owner 要更慢：300→600 慢一倍；慢=决策窗）
const RENDER_MS = 33;       // 重渲间隔（~30fps 平滑）
const SEC_PER_TICK = LIVE_STEP_MS / 1000;
const PERF_MS = 1700;       // 对决特写表演时长（冻结战场·放大两牌·读数·掷点定生死，owner：拉到屏幕前看为什么胜败）
const ENCOUNTER_MS = 800;   // 对决前奏「遭遇」：两张牌在战场相遇提示时长（owner：开打前看清谁和谁打·在哪条路）
const CLASH_GAP_MS = 500;   // 两场对决之间回战场缓冲（owner：打完一个回到战场表现一下·再演下一场）
// 迷雾显形（owner 2026-06-18 改：**默认无迷雾**，仅附魔牌 fogged 才面朝下 → 过线 3D 翻显形）。迷雾时间缩短：早点翻。
// 非 fogged 牌一律即显形(face-up)；fogged 牌越过本侧短线(0.18/0.82·比旧 0.34/0.66 短)即翻。
const FOG_A_EDGE = 0.18;    // A 的 fogged 兵越过此线 → 显形（pos01 ≥）
const FOG_B_EDGE = 0.82;    // B 的 fogged 兵越过此线 → 显形（pos01 ≤）
// 出牌控盘层（doc18 §10 · 布局阶段 base 打底 + 抽牌堆 + 手牌实时派三路 + 读秒暂停银行）。数值初版、待真机/仿真台磨。
const BASE_PER_LANE = 3;        // 布局阶段每路预铺张数（共 9 打底，doc18 §10.2）
const AI_PERIOD_TICKS = 16;     // 敌方滴投：每 N 拍从其牌库投一张（入该牌原路 → 随阵型分布）
// ── CR 局内经济 TUNE（doc21 · owner 抄皇室战争）：点数(召唤源泉)随真实时间回复 → 花点数摸牌(玩家选库) → 普通部署/天罡施法。砍读秒暂停。──
// 改这一处即调手感。owner 2026-06-19 反馈「召唤源泉涨太快·看不到心流·点数太多」→ 池砍半(5) + regen 大幅放慢(2000ms) + 起手压低。
// 派生节奏（当前 regen 2000ms · 池 5）：≈0.5 点/秒 → 每 2s 摸 1 普通 / 4s 摸 1 天罡；满池 5 点从起手 2 攒满 ≈ 6s。心流＝攒→花的取舍张力。
// 想再调：更慢/更少手感 = REGEN 调大、MAX/START 调小；更快 = 反之。CR 原版 regen≈2800ms 可作参考上界。
const POINTS_MAX = 5;           // 点数池上限（owner：max 5·制造稀缺=心流；原 10 太满、无取舍）
const POINTS_START = 2;         // 起手点数（须 ≤MAX·压低开局；靠起手手牌先免费铺路，点数攒着摸新牌）
const POINTS_REGEN_MS = 2000;   // 每回 1 点真实时长（owner：放慢·看得见涨；原 800 太快近乎常满）
const NORMAL_DRAW_COST = 1;     // 摸普通库花点数（doc21 §二.5 ~1）
const TENGANG_DRAW_COST = 2;    // 摸天罡库花点数（~2·更贵 = 故意限流 + 一次点数投资）
const NORMAL_HAND_CAP = 7;      // 普通手牌可囤积上限（攒一波"哗"出·doc21 ~7）
const TENGANG_CAP = 5;          // 天罡在手上限（打掉一张才能再摸 · play-to-draw）
const OPENING_NORMAL = 5;       // 起手普通手牌（快档：5·更快有牌打）
type BattleControl = { hand: HandCardView[]; selectedCard: number; deckCount: number; tengang: TengangCardView[]; selectedTengang: number; tengangDeckCount: number; points: number; pointsMax: number; normalDrawCost: number; tengangDrawCost: number; canDrawNormal: boolean; canDrawTengang: boolean; migrateSource: number };
const NO_CONTROL: BattleControl = { hand: [], selectedCard: -1, deckCount: 0, tengang: [], selectedTengang: -1, tengangDeckCount: 0, points: 0, pointsMax: 0, normalDrawCost: 0, tengangDrawCost: 0, canDrawNormal: false, canDrawTengang: false, migrateSource: -1 }; // 看帧/无控盘默认

interface Save {
  materials: number; // 金币 Gold（doc25 · 打战斗赚·免费·解锁天罡/地支/改造坊）
  diamond: number; // 钻石 Diamond（doc25 · 付费·只加速速解·不卖强度）
  dizhiShards: number; // 地支碎片（养地支专属材料 · 💎可换 · 待甲镶嵌系统消耗）
  rechargeCount: number; // 已完成充值次数（投资人彩蛋：首充免密·第二次起需密码）
  seenIntro: boolean; // 是否已看过首启开场故事（doc28 §一·只播一次）
  guideStep: number; // 新手引导进度（doc28 §二）：0..N 进行中 · -1 完成/跳过
  seen: Record<string, boolean>; // 引导「看过不再弹」标记集（coachmark·seen_combat_* 等·owner 2026-06-21）
  tiangangShards: number; // 天罡碎片（抽卡重复转化 → 定向兑换指定天罡·保底 doc25 §四）
  dizhiBag: Record<string, number[]>; // 地支卡包（消耗品库存·owner 2026-06-21）：生肖 branch → 各档活化数 [铜,银,金]（满3自动升档·钻/史待开放）
  inlays: Record<string, InlayEntry[]>; // 地支附魔：牌位索引(0-51) → 已镶条目 {b,t}[]（≤INLAY_MAX·档位镶入时锁定·永久消耗不退）
  campaignMax: number; // 已抵达的最高关（持久·天罡解锁门槛 = unlockStage ≤ campaignMax）
  stage: number;
  deck: number[]; // 我方 52 张的 favor（0..95）
  lastOfficers: number[]; // 上次布阵的三路军官数 [上,中,下]（默认选中 + AI 克制依据）
  leverEnergy: number; // 干预能量◈（开局 3 / 每胜 +2 / 上限 6）
  lives: number; // 战役命线（开 run 3 命，输一场 −1，命尽=run 结束）
  bossIdx: number; // 本 run 终局 Boss（每 run 轮换一名，开 run 随机定，供针对性布阵）
  ownedTiangangs: string[]; // 已买入天罡 id（全部拥有集·跨 run 不清零）
  tiangangDecks: TiangangDeck[]; // 玩家自建的天罡牌组（每组 ≤12 张·可建多套）
  activeDeckId: string; // 出战中的牌组 id
  tiangangs: string[]; // 出战牌组的卡表（= activeDeck.cards 的派生镜像·契约②·甲读·勿手改）
  planets: Record<string, number>; // 星球牌等级（局外持久 · 可叠加升档 · 第二养成轴）
  foils: string[]; // 已收集的 foil 闪艺皮肤 id（纯表现收集 · 零 gameplay）
  fortune: { date: string; rolls: number; keptVal: number | null }; // 今日卦象（owner 2026-06-21·制卦次数/收下的卦值·每日刷新·纯趣味不进战斗）
}
const FORTUNE_MAX = 3; // 每日制卦上限（owner 2026-06-21）
const fortuneToday = (): string => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function resetFortuneIfNewDay(s: Save): void { const t = fortuneToday(); if (!s.fortune || s.fortune.date !== t) s.fortune = { date: t, rolls: 0, keptVal: null }; }
interface TiangangDeck { id: string; name: string; cards: string[]; pokerPicks: string[] } // cards = 天罡 id（≤TIANGANG_DECK_SIZE）；pokerPicks = 自选出战扑克卡 id（≤POKER_PICK_SIZE·契约A·乙写甲读·空=自动构筑一副）

// 出战牌组（找不到则取第一个；都空则造默认）。syncTiangangs：把出战牌组卡表派生进 save.tiangangs（契约②·甲读）。
function activeDeck(s: Save): TiangangDeck {
  return s.tiangangDecks.find((d) => d.id === s.activeDeckId) ?? s.tiangangDecks[0];
}
function syncTiangangs(s: Save): void { s.tiangangs = [...(activeDeck(s)?.cards ?? [])]; }
const newDeckId = (): string => `deck_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;

const rollBoss = (): number => Math.floor(Math.random() * BOSS_ROSTER.length);
export function freshSave(): Save {
  return { materials: 120, diamond: 6, dizhiShards: 30, rechargeCount: 0, seenIntro: false, guideStep: 0, seen: {}, tiangangShards: 0, dizhiBag: { 子: [2, 0, 0], 丑: [1, 0, 0], 寅: [1, 0, 0], 卯: [1, 0, 0] }, inlays: {}, campaignMax: 1, stage: 1, deck: Array.from({ length: DECK_SIZE }, (_, i) => 44 + (i % 10) * 2), lastOfficers: [10, 10, 10], leverEnergy: LEVER_START, lives: RUN_LIVES, bossIdx: rollBoss(), ownedTiangangs: GAME_G_TIANGANGS.filter((t) => unlockStageOf(t.id) <= 1).map((t) => t.id), tiangangDecks: [{ id: 'deck1', name: '牌组 1', cards: [], pokerPicks: [] }, { id: 'deck2', name: '牌组 2', cards: [], pokerPicks: [] }, { id: 'deck3', name: '牌组 3', cards: [], pokerPicks: [] }, { id: 'deck4', name: '牌组 4', cards: [], pokerPicks: [] }], activeDeckId: 'deck1', tiangangs: [], planets: {}, foils: [], fortune: { date: '', rolls: 0, keptVal: null } }; // 44..62 起步；金币 120；钻石送 6（首充免密）；开局默认给 4 个天罡牌组让玩家去组（owner 2026-06-21）；pokerPicks 空=自动构筑一副；新存档播开场故事+引导
}
function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (Array.isArray(s.deck) && s.deck.length === DECK_SIZE) {
        if (!Array.isArray(s.lastOfficers) || s.lastOfficers.length !== 3) s.lastOfficers = [10, 10, 10]; // 旧存档兼容
        if (typeof s.leverEnergy !== 'number') s.leverEnergy = LEVER_START;
        if (typeof s.bossIdx !== 'number') s.bossIdx = rollBoss();
        if (typeof s.diamond !== 'number') s.diamond = 0; // doc25 货币迁移
        if (typeof s.dizhiShards !== 'number') s.dizhiShards = 0; // 地支碎片迁移
        if (typeof s.rechargeCount !== 'number') s.rechargeCount = 0; // 充值次数迁移
        if (typeof s.seenIntro !== 'boolean') s.seenIntro = true; // 老存档视为已看过开场（不打扰老玩家）
        if (typeof s.guideStep !== 'number') s.guideStep = -1; // 老存档引导视为已完成
        if (typeof s.tiangangShards !== 'number') s.tiangangShards = 0; // 天罡碎片迁移
        // 地支消耗品迁移（owner 2026-06-21）：老存档 dizhiOwned{branch:tier} → dizhiBag{branch:[铜,银,金]}（该档置 1 张）。
        const legacyDz = s as unknown as { dizhiOwned?: Record<string, number> };
        if (typeof s.dizhiBag !== 'object' || s.dizhiBag === null) {
          s.dizhiBag = {};
          const od = legacyDz.dizhiOwned;
          if (od && typeof od === 'object') for (const b in od) { const t = od[b]; if (t >= 1 && t <= 3) { const arr = [0, 0, 0]; arr[t - 1] = 1; s.dizhiBag[b] = arr; } }
          delete legacyDz.dizhiOwned;
        }
        // 地支附魔迁移：老 inlays{idx:branch[]} → {idx:{b,t}[]}（档位取老 dizhiOwned 该生肖档·缺则铜）。
        if (typeof s.inlays !== 'object' || s.inlays === null) s.inlays = {};
        else { const od = legacyDz.dizhiOwned ?? {}; for (const k in s.inlays) { const v = s.inlays[k] as unknown; if (Array.isArray(v) && v.length && typeof v[0] === 'string') s.inlays[k] = (v as unknown as string[]).map((b) => ({ b, t: od[b] ?? 1 })); } }
        if (typeof s.seen !== 'object' || s.seen === null) s.seen = {}; // 引导 seen 标记迁移（coachmark）
        if (typeof s.campaignMax !== 'number') s.campaignMax = Math.max(1, s.stage || 1);
        // 重命名(joker→天罡)迁移 + owner 拍「清空老存档战库」：老存档键为 jokers/ownedJokers → 战库(tiangangs)清空、收藏(ownedTiangangs)沿用旧 ownedJokers；丢弃遗留键。
        const legacy = s as unknown as { jokers?: unknown; ownedJokers?: unknown };
        if (legacy.jokers !== undefined || legacy.ownedJokers !== undefined || !Array.isArray(s.tiangangs) || !Array.isArray(s.ownedTiangangs)) {
          if (!Array.isArray(s.ownedTiangangs)) s.ownedTiangangs = Array.isArray(legacy.ownedJokers) ? (legacy.ownedJokers as string[]) : [];
          s.tiangangs = []; // 老存档战库清空（owner）
          delete legacy.jokers; delete legacy.ownedJokers;
        }
        // 牌组迁移（owner 2026-06-20 多牌组）：老存档只有单战库 s.tiangangs（≤5）→ 包成「牌组 1」；无牌组则建默认。
        if (!Array.isArray(s.tiangangDecks) || s.tiangangDecks.length === 0) {
          const seed = Array.isArray(s.tiangangs) ? s.tiangangs.slice(0, TIANGANG_DECK_SIZE) : [];
          s.tiangangDecks = [{ id: 'deck1', name: '牌组 1', cards: seed, pokerPicks: [] }];
        }
        // 清洗：每组卡表去无效/超额、去重；pokerPicks 去无效卡 id/超额/去重（缺=[] 即自动构筑）；activeDeckId 落到存在的组
        s.tiangangDecks = s.tiangangDecks.map((d) => ({ id: d.id, name: d.name || '牌组', cards: [...new Set(d.cards)].filter((c) => TIANGANG_BY_ID.has(c)).slice(0, TIANGANG_DECK_SIZE), pokerPicks: Array.isArray(d.pokerPicks) ? [...new Set(d.pokerPicks)].filter((c) => isPoolCardId(c)).slice(0, POKER_PICK_SIZE) : [] }));
        if (!s.tiangangDecks.some((d) => d.id === s.activeDeckId)) s.activeDeckId = s.tiangangDecks[0].id;
        syncTiangangs(s); // 派生出战牌组卡表 → save.tiangangs（契约②）
        if (typeof s.planets !== 'object' || s.planets === null) s.planets = {};
        if (!Array.isArray(s.foils)) s.foils = [];
        if (typeof s.fortune !== 'object' || s.fortune === null) s.fortune = { date: '', rolls: 0, keptVal: null }; // 今日卦象迁移
        if (typeof s.lives !== 'number') s.lives = effectiveLives(s.planets);
        if (s.stage < 1 || s.stage > RUN_BATTLES) s.stage = 1;
        return s;
      }
    }
  } catch {
    /* localStorage 不可用 → 用全新存档 */
  }
  return freshSave();
}
function persist(s: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* 忽略 */
  }
}

const clampFavor = (f: number): number => Math.max(5, Math.min(95, Math.round(f)));
const avg = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
// 牌组均 favor → 全军 favor 偏置（改造越多越强）；敌方偏置随关卡递增。
const myBias = (deck: number[]): number => avg(deck) - 50;
const enemyBias = (stage: number): number => -8 + stage * 2;
// AI 暗布阵：低关固定均衡 / 中关变化 / 高关克制你上局阵型（石头剪刀布闭环）。对玩家隐藏，开战揭晓。
// 布阵 → 名称（命中预设则用预设名，否则"自定义 x/y/z"），用于战后揭晓敌阵。
function describeFormation(off: number[]): string {
  for (const n of PRESET_NAMES) {
    const p = FORMATION_PRESETS[n].officers;
    if (p[0] === off[0] && p[1] === off[1] && p[2] === off[2]) return n;
  }
  return `自定义 ${off[0]}/${off[1]}/${off[2]}`;
}
// 场间三选一：从增益池随机取 3 张（Fisher–Yates；元层奖励，非确定性 gameplay，用 Math.random 即可）。
function pick3<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 3);
}

// 干预卡字形（设计稿同款图标）；对手花色（从 Boss/阵名推）。
const LEVER_GLYPH: Record<LeverKind, string> = { bless: '🎯', curse: '☠', shield: '🛡', decapitate: '🗡', reinforce: '🚩', flush: '♣' };
const suitOf = (n: string): 's' | 'h' | 'd' | 'c' => (/黑桃|♠/.test(n) ? 's' : /红桃|♥/.test(n) ? 'h' : /方块|方片|♦/.test(n) ? 'd' : /梅花|♣/.test(n) ? 'c' : 'h');
const LANE_NAME3 = ['上路', '中路', '下路'];

// WIRE-MARCH 桥：把揭晓前编排好的 ArmyCard（favor=军衔+经营+干预 聚成的单一强度标量）映射成 live-combat 投放令。
// 公平骨架（doc19）：rank→points(fair) 走 cardPoints；该牌全部强度经 favor 折算进 buff，使 P_eff=clamp(favorToP(favor))
//   单调随 favor（军衔已在 favor 里）——buff 抵消 cardPoints 噪声，让既有 favor 经济无缝驱动新 pairwise 对决核、不改既测的 live-combat。
//   （3D-CLASH 深水区会用 doc19 公平 points + 经营 buff 正式替掉 favor；此为 W1 接线桥，FAVOR/scale 待仿真台调。）
const FAVOR_LO = 5, FAVOR_HI = 95; // favor 钳域（blueprint clampFavor）
const favorToP = (favor: number): number => ((Math.max(FAVOR_LO, Math.min(FAVOR_HI, favor)) - FAVOR_LO) / (FAVOR_HI - FAVOR_LO)) * P_MAX; // favor → P_eff 空间 [0,30]
const cardRank = (c: ArmyCard): string => (c.rank === 'JOKER' ? '★' : c.rank); // 显示 + cardPoints/cardStamina 同口径（★≡JOKER：点数15/续航3）
const toUnit = (c: ArmyCard): DeployCmd['unit'] => ({ id: c.id, rank: cardRank(c), suit: c.suit, general: c.general, buff: Math.round(favorToP(c.favor) - cardPoints(cardRank(c))) });
// 契约A·甲读（owner 2026-06-21 #15/#16）：把你配的 pokerPicks(卡 id) 折成回合制战斗牌库——每张挂自己的
// effectiveDeckFavors(base favor + 逐张地支附魔)→战力 buff，suit/rank 取自卡 id，主将=favor 最高那张(留士气)。
// 纯函数·确定性（同 picks+effFav → 同牌库），让大厅配的牌(含附魔)真正按 ID 进场，不再被揉成平均 bias。
export function buildPickDeck(picks: readonly string[], effFav: readonly number[]): PokerCard[] {
  const favOf = (id: string): number => { const fi = cardFavorIndex(id); return fi >= 0 ? (effFav[fi] ?? 50) : 50; };
  const genId = picks.length ? picks.reduce((best, id) => (favOf(id) > favOf(best) ? id : best), picks[0]) : '';
  return picks.map((id) => { const rk = rankOfCardId(id); return { kind: 'poker', id, rank: rk, suit: id.slice(-1), general: id === genId, buff: Math.round(favorToP(favOf(id)) - cardPoints(rk)), cost: deployCost(rk) }; });
}
// Boss 主将牌 = 本关英雄那张牌（owner 2026-06-21·传奇主将·强化）：用英雄谱 rank/suit + 强 favor(随关卡 bias 略升)
// → 一张强力主将 PokerCard(general:true·点数虽弱但战力高)。heroName=关卡 heroId(Boss 名)；查无 → null。纯函数·可测。
const SUIT_SYM2LET: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
export function bossHeroCard(heroName: string, enemyBias: number): PokerCard | null {
  const heroDef = heroCardByName(heroName);
  if (!heroDef) return null;
  const hr = heroDef.rank === 'JOKER' ? '★' : heroDef.rank;
  const hFav = Math.min(FAVOR_HI, 65 + enemyBias); // 强 favor·随 bias 略升（细调留给重跑仿真）
  return { kind: 'poker', id: `boss-hero-${heroDef.id}`, rank: hr, suit: SUIT_SYM2LET[heroDef.suit] ?? 'S', general: true, buff: Math.round(favorToP(hFav) - cardPoints(hr)), cost: deployCost(hr) };
}
export function armyToDeploys(army: ArmyCard[], side: 'a' | 'b'): DeployCmd[] {
  return army.map((c) => ({ tick: 1, side, lane: c.lane, unit: toUnit(c) }));
}
// 逐拍位置快照（驱动层插值用：真拍间按 frac 滑行，渲染才「慢慢走」而非每拍瞬跳）。
function snapLivePos(live: LiveBattle): Map<string, number> {
  const m = new Map<string, number>();
  for (const L of live.lanes) { for (const u of L.a) m.set(u.id, u.pos); for (const u of L.b) m.set(u.id, u.pos); }
  return m;
}
// CR 摸牌可行性（doc21 §二.5 · 纯函数·便于测）：点数够 & 该手牌未到上限 & 该库还有牌。普通/天罡两库共用此判。
export function canDrawFrom(points: number, cost: number, handLen: number, cap: number, deckLen: number): boolean {
  return points >= cost && handLen < cap && deckLen > 0;
}
// A-JOKER：已施天罡(契约②·玩家施法集) → 聚合扁平战斗修正（live-combat 钩子读·只己方）。读 GAME_G_TIANGANGS 的 {kind,params}（契约③）。
// 一种牌算一次（不叠）。v1 实装 6 kind；v2 待接（背水 reroll / 顺子阵 straight / 擒王 decapCost·依干预 / tempo / lane 一次性 / siege / arcane 印记 / 战潮 pulse·CR 已取代被动涌牌）—— 未实装 kind 返回零修正、不崩。
export function aggregateTengang(castIds: readonly string[]): TengangFx {
  const cards: { kind: string; params?: Record<string, unknown> }[] = [];
  for (const id of castIds) { const j = TIANGANG_BY_ID.get(id); if (j) cards.push({ kind: j.kind, params: j.params as Record<string, unknown> | undefined }); }
  return tengangFxOf(cards);
}
// 纯映射（注入卡集·不依赖 blueprint 数据 → 可用合成卡单测新 op，先于乙上架数据）。op→效果 = 甲侧契约（乙照此编码 doc20 §二）：
//   odds: add→pEffAdd · winFloor→% · kHard(灌铅骰)→logistic 变硬 · noUpset(铁骰)→占优免爆冷 ｜ power: add(+filter countLE3|sameSuit|无=全军)
//   combo: pair(对子诀·≥2同点) / trips(鼎立·≥3同点) ｜ morale: leaderBuff ｜ stamina: stamPlus(全军) · +filter:faces(老兵)→人头牌 ｜ draw: handMax
export function tengangFxOf(cards: Iterable<{ kind: string; params?: Record<string, unknown> }>): TengangFx {
  const fx: TengangFx = { ...NO_TENGANG };
  for (const j of cards) {
    const p = j.params; if (!p) continue;
    const v = typeof p.value === 'number' ? p.value : 0; const bonus = typeof p.bonus === 'number' ? p.bonus : 0;
    if (j.kind === 'odds') { if (p.op === 'add') fx.pEffAdd += v; else if (p.op === 'winFloor') fx.winFloor += v / 100; else if (p.op === 'kHard') fx.kHard += v; else if (p.op === 'noUpset') fx.noUpset += 1; }
    else if (j.kind === 'power') {
      if (p.op === 'mul' && p.scope === 'highestRank') fx.powerMulHighest = Math.max(fx.powerMulHighest, v); // 擎天：全军最强单张 ×mul（一种算一次·取最大·非叠加）
      else if (p.op === 'add') { if (p.filter === 'countLE3') fx.powerLE3 += v; else if (p.filter === 'sameSuit') fx.powerSameSuit += v; else if (p.scope === 'front') fx.powerFront += v; else fx.powerAll += v; } // 寡兵 / 同花魁 / 锋矢(front) / 虎符(全军·scope:all 或无)
    }
    else if (j.kind === 'combo') { if (p.op === 'pair') fx.comboPair += bonus; else if (p.op === 'trips') fx.comboTrips += bonus; }
    else if (j.kind === 'morale') { if (p.op === 'leaderBuff') fx.moraleLeader += v; else if (p.op === 'revenge') fx.revenge += v; else if (p.op === 'noRout') fx.noRout = 1; } // 旗手/哀兵/督战
    else if (j.kind === 'stamina') { if (p.op === 'stamPlus') { if (p.filter === 'faces') fx.stamFaces += v; else fx.stamPlus += v; } else if (p.op === 'relay') fx.relay += v; } // 老兵/不屈/薪火
    else if (j.kind === 'draw') { if (p.op === 'handMax') fx.handMaxAdd += v; else if (p.op === 'onPlay') fx.onPlay += v; else if (p.op === 'clashElixir') fx.clashElixir += v; } // 广纳/川流/战潮
    else if (j.kind === 'siege') { if (p.op === 'defend') fx.siegeDefend += v; else if (p.op === 'chipMore') fx.siegeChip += v; } // 死守/攻城锤
  }
  return fx;
}

// 从 live-combat 逐拍 sim + save 派生战场视图（喂 battle-screen 渲染设计稿）。纯读 sim 真相、不回灌。
// owner「一格格慢慢走」：兵位 = 真 slot pos01（live pos/LANE_LEN）；最前两张相邻(接敌)才 revealed 翻开。
// 导出供无头看帧/视觉回归测试用（battle-screen.frame.test.ts 真 live sim → 真 view → 真渲染器 → HTML golden）。
export function buildBattleViewLive(live: LiveBattle, save: Save, oppName: string, oppPersona: string, oppSuit: 's' | 'h' | 'd' | 'c', control: BattleControl = NO_CONTROL, clash: ClashView | null = null, fx: BattleFx[] = []): BattleView {
  const sv = (s: string): 's' | 'h' | 'd' | 'c' => s.toLowerCase() as 's' | 'h' | 'd' | 'c';
  const units: BattleUnit[] = [];
  for (const li of [0, 1, 2]) {
    const L = live.lanes[li];
    // 默认即显形(face-up)；仅 fogged(附魔)牌面朝下、越过本侧短线才翻（owner：默认无迷雾、迷雾=附魔专属）。
    L.a.forEach((u) => { const pos01 = u.pos / LANE_LEN; units.push({ id: u.id, lane: li, side: 'a', pos01, revealed: !u.fogged || pos01 >= FOG_A_EDGE, faceUp: true, rank: u.rank, suit: sv(u.suit), general: u.general, fogged: u.fogged }); });
    L.b.forEach((u) => { const pos01 = u.pos / LANE_LEN; units.push({ id: u.id, lane: li, side: 'b', pos01, revealed: !u.fogged || pos01 <= FOG_B_EDGE, faceUp: true, rank: u.rank, suit: sv(u.suit), general: u.general, fogged: u.fogged }); });
  }
  const lanes: BattleLane[] = [0, 1, 2].map((li) => {
    const L = live.lanes[li];
    const mine = L.a.length, enemy = L.b.length;
    const lead: 'a' | 'b' | 'n' = mine > enemy ? 'a' : enemy > mine ? 'b' : 'n';
    return { name: LANE_NAME3[li], mine, enemy, lead, state: lead === 'a' ? '我方推进' : lead === 'b' ? '敌方压制' : '僵持', mineText: `存活 ${mine}`, enemyText: `存活 ${enemy}` };
  });
  const levers: BattleLever[] = (Object.keys(LEVER_CATALOG) as LeverKind[]).map((k) => ({ key: k, glyph: LEVER_GLYPH[k], name: LEVER_CATALOG[k].name, cost: LEVER_CATALOG[k].cost, desc: LEVER_CATALOG[k].desc }));
  const secs = Math.round(live.tick * SEC_PER_TICK); // 读秒（确定性，由拍数派生）
  return {
    homeA: live.homeA, homeAMax: live.homeMax, homeB: live.homeB, homeBMax: live.homeMax,
    oppName, oppPersona, oppSuit, energy: save.leverEnergy, energyMax: effectiveLeverCap(save.planets), materials: save.materials,
    phaseText: '占领敌方老家 · 即胜', timeText: `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`,
    levers, lanes, units,
    hand: control.hand, selectedCard: control.selectedCard, deckCount: control.deckCount,
    tengang: control.tengang, selectedTengang: control.selectedTengang, tengangDeckCount: control.tengangDeckCount,
    points: control.points, pointsMax: control.pointsMax, normalDrawCost: control.normalDrawCost, tengangDrawCost: control.tengangDrawCost, canDrawNormal: control.canDrawNormal, canDrawTengang: control.canDrawTengang, migrateSource: control.migrateSource,
    clash, fx,
  };
}
// 确定性洗牌（mulberry32·抽序可回放·不破 outcome-first）—— 回合制牌库铺牌用。
function seededShuffleArr<T>(xs: T[], seed: number): T[] {
  const arr = [...xs]; let t = seed >>> 0;
  const rnd = (): number => { t += 0x6d2b79f5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
const SUITNAME: Record<string, string> = { s: '黑桃', h: '红桃', d: '方块', c: '梅花' };
// turn-combat 掷命事件 → 回合制特写视图（doc24 战斗屏·点数/经营/天罡/士气 明细如实透出）。
function clashToTurnView(ev: ClashEvent, tgName: (id: string) => string = (id) => id): TurnClashView {
  const lc2 = (s: string): 's' | 'h' | 'd' | 'c' => s.toLowerCase() as 's' | 'h' | 'd' | 'c';
  const cardv = (c: ClashEvent['a'], won: boolean): TurnClashCardView => ({ rank: c.rank, suit: lc2(c.suit), name: SUITNAME[lc2(c.suit)] + c.rank, won });
  // 明细逐行 + 原因（owner 2026-06-21）：点数恒显；经营=改造/附魔；天罡总计 + 逐张溯源(哪张+多少)；士气标明主将坐镇/溃散。
  const rows = (c: ClashEvent['a']): [string, number][] => {
    const r: [string, number][] = [['点数 · 牌面基础', c.points]];
    if (c.buff !== 0) r.push(['经营 · 改造/附魔', c.buff]);
    if (c.tengang !== 0 || (c.tgBreak?.length ?? 0) > 0) {
      r.push(['天罡 · 法术合计', c.tengang]);
      for (const [id, amt] of c.tgBreak ?? []) r.push(['　└ ' + tgName(id), amt]);
    }
    if (c.morale !== 0) r.push([c.morale > 0 ? '士气 · 主将坐镇' : '士气 · 主将亡·溃散', c.morale]);
    if (c.nearDef) r.push(['地煞 · 隘口固守', c.nearDef]); // 温泉关守军贴家 +战力（owner 2026-06-21）
    return r;
  };
  return {
    laneName: ['上路', '中路', '下路'][ev.lane] ?? '路',
    mine: cardv(ev.a, ev.aWins), foe: cardv(ev.b, !ev.aWins),
    oddsMine: Math.round(ev.winrate * 100), rollPct: Math.round(ev.roll * 100),
    bonusMine: rows(ev.a), bonusFoe: rows(ev.b),
    pEffMine: ev.a.pEff, pEffFoe: ev.b.pEff,
  };
}
// live-combat 对决事件 → 特写视图（a=我方/b=敌方；点数/加成/战力/胜率/掷点 如实透出）。
function clashToView(ev: ClashEvent): ClashView {
  const card = (c: ClashEvent['a']): ClashView['a'] => ({ rank: c.rank, suit: c.suit.toLowerCase() as 's' | 'h' | 'd' | 'c', general: c.general, points: c.points, buff: c.buff, morale: c.morale, tengang: c.tengang, pEff: c.pEff });
  return { lane: ev.lane, winrate: ev.winrate, roll: ev.roll, aWins: ev.aWins, tie: ev.tie, a: card(ev.a), b: card(ev.b) };
}

// 出征入场演出（owner 2026-06-21）：点开始打这一关 → 战场以 UI 效果从无到有「展开」，二选一随机：
//   · iris  —— 圆圈从里向外爆发、再略收敛（clip-path 圆 + 微弹缩）
//   · fan   —— 孔雀开屏，从中线向两侧展开（clip-path inset + 透视微缩）
// 纯表现：战斗已挂载到 stage 后给容器套一段揭幕动画，animationend 即撤、不留残留样式；与战斗逻辑零耦合。
function ensureEntranceCss(): void {
  if (document.getElementById('gg-enter-css')) return;
  const s = document.createElement('style');
  s.id = 'gg-enter-css';
  s.textContent =
    '@keyframes gg-enter-iris{0%{clip-path:circle(0% at 50% 50%);transform:scale(.94);opacity:.25}55%{opacity:1}72%{clip-path:circle(118% at 50% 50%);transform:scale(1.025)}100%{clip-path:circle(150% at 50% 50%);transform:scale(1);opacity:1}}' +
    '@keyframes gg-enter-fan{0%{clip-path:inset(0 50% 0 50%);transform:perspective(1500px) scale(.9);opacity:.2}58%{opacity:1}100%{clip-path:inset(0 0 0 0);transform:perspective(1500px) scale(1);opacity:1}}' +
    '.gg-enter-iris{animation:gg-enter-iris .82s cubic-bezier(.16,.84,.3,1) both;transform-origin:50% 50%;will-change:clip-path,transform}' +
    '.gg-enter-fan{animation:gg-enter-fan .8s cubic-bezier(.22,.9,.27,1) both;transform-origin:50% 50%;will-change:clip-path,transform}';
  document.head.appendChild(s);
}
function playBattleEntrance(root: HTMLElement): void {
  const target = (root.firstElementChild as HTMLElement | null) ?? root;
  ensureEntranceCss();
  const fx = Math.random() < 0.5 ? 'iris' : 'fan'; // 孔雀开屏 / 圆爆 二选一
  const cls = `gg-enter-${fx}`;
  const clean = (): void => { target.classList.remove(cls); target.removeEventListener('animationend', clean); };
  target.classList.add(cls);
  target.addEventListener('animationend', clean);
  window.setTimeout(clean, 1400); // 兜底：无头/动画被打断也清干净
}

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
      const tiangangs: LobbyShopItem[] = GAME_G_TIANGANGS.map((j) => { const owned = save.ownedTiangangs.includes(j.id); const us = unlockStageOf(j.id); const locked = us > save.campaignMax; return { id: j.id, name: j.name, sub: j.text, cost: j.cost, owned, inDeck: save.tiangangs.includes(j.id), buyable: !owned && !locked && save.materials >= j.cost, power: j.power, phat: j.phat, kind: j.kind, icon: j.icon, tint: j.tint, unlockStage: us, locked }; });
      const planets: LobbyShopItem[] = GAME_G_PLANETS.map((p) => ({ id: p.id, name: p.name, sub: p.text, cost: p.cost, owned: false, level: save.planets[p.id] ?? 0, buyable: save.materials >= p.cost }));
      const foils: LobbyShopItem[] = GAME_G_FOILS.map((f) => { const owned = save.foils.includes(f.id); return { id: f.id, name: f.name, sub: f.desc, cost: f.cost, owned, buyable: !owned && save.materials >= f.cost }; });
      const heart = save.lives > 0 ? '❤'.repeat(save.lives) : '—';
      resetFortuneIfNewDay(save); // 跨日则清零今日卦象（不落盘·读时纠正即可）
      return {
        skin: lobbySkin, coin: save.materials, diamond: save.diamond, dizhiShards: save.dizhiShards, tiangangShards: save.tiangangShards, dizhiBag: save.dizhiBag, rechargeNeedsPassword: save.rechargeCount >= 1, campaignMax: save.campaignMax, firstLaunch: !save.seenIntro, guideStep: save.guideStep, energy: save.leverEnergy, energyMax: cap, foilCount: save.foils.length,
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
        const tierName = ['', '铜', '银', '金'];
        if (pool === 'tiangang') {
          const poolCards = GAME_G_TIANGANGS.filter((t) => unlockStageOf(t.id) <= save.campaignMax);
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
      onReplayIntro: () => { save.seenIntro = false; save.guideStep = 0; save.seen = {}; persist(save); }, // 全量重置引导：开场+大厅引导+战斗 coachmark(seen_*)一起清，从头走一遍（owner 2026-06-21）
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
    playBattleEntrance(root); // 战场挂载完毕 → 揭幕演出（圆爆/孔雀开屏随机）
  }

  // ───────────────────────── 场间整备 · 三选一增益（roguelike 养成核 · 胜后短窗）─────────────────────────
  // 胜一场后进军前的短窗：三随机里选一项 → 选择即流派。池=资源增益 + **流派钥匙(白嫖未拥有天罡)**，
  // 后者把场间选择做成 StS/Balatro 式构筑分叉（design reply#10），不只 +stat。改后落存档、回大厅看下一战。
  function showBetween(nextLabel: string): void {
    clear();
    const title = el('div', 'font:600 18px system-ui;color:#22c55e', '🎉 战间整备 · 三选一');
    const sub = el('div', 'max-width:520px;text-align:center;opacity:.82;line-height:1.6',
      `胜一场！<b>${nextLabel}</b>前选<b>一项</b>——资源增益，或<b style="color:#c4b5fd">🃏流派钥匙</b>(白嫖天罡牌、定你的构筑分叉)。`);
    const pool: RunBuff[] = [...BETWEEN_BUFFS, ...tiangangKeyBuffs(save.tiangangs)]; // 资源增益 + 未拥有天罡钥匙
    const cardsBox = el('div', 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap');
    cardsBox.replaceChildren(...pick3(pool).map((bf: RunBuff) => {
      const isKey = bf.kind === 'tiangang';
      const accent = isKey ? '#a78bfa' : '#22c55e';
      const card = el('div', `width:158px;padding:14px 10px;border:1px solid ${isKey ? '#4c1d95' : '#334155'};border-radius:10px;text-align:center;cursor:pointer;line-height:1.55;background:${isKey ? '#160f24' : '#10161f'}`,
        `<div style="font:600 15px system-ui;color:${isKey ? '#c4b5fd' : '#eab308'}">${bf.name}</div><div style="opacity:.85;font-size:12px;margin-top:6px">${bf.desc}</div>`);
      card.onmouseenter = () => { card.style.borderColor = accent; };
      card.onmouseleave = () => { card.style.borderColor = isKey ? '#4c1d95' : '#334155'; };
      card.onclick = () => { applyBuff(save, bf); persist(save); showLobby(); };
      return card;
    }));
    const skip = mkBtn('跳过，直接回大厅');
    skip.style.cssText += ';opacity:.6;font-size:11px';
    skip.onclick = showLobby;
    root.append(title, sub, cardsBox, skip);
  }

  // ───────────────────────── 出征（一局 · doc24 回合制 · turn-combat + turn-battle-screen）─────────────────────────
  // owner 大转向：实时 CR → 回合制桌游。每回合 +1 召唤源泉 → 四选一互斥动作(抽/放[+翻门]/打天罡/弃) → 结束回合推进一格 → 相邻遭遇掷命特写。
  // 牌库由 prepareArmies 揭晓前编排(融天罡/干预/Boss·outcome-first)折成扑克兵库；先破敌 3 血大本营胜。结算复用旧养成闭环(命/材料/三选一)。
  function showTurnMatch(formation: Formation, myName: string, interventions: Intervention[]): void {
    clear();
    const spec = battleSpec(save.stage - 1);
    const lvl = loadLevel(save.stage); // doc27 关卡加载：本关 = 命运之战的英雄(列奥尼达..项羽)·地煞/12 天罡/难度/对白 逐关入库
    const boss = spec.boss ? bossFor(save.bossIdx) : null;
    const aiForm = boss ? boss.formation : aiFormation();
    const enemyBias = boss ? boss.favorBias : spec.enemyBias;
    const aiName = lvl.heroId; // 战役 Boss = 本关英雄（52 关 = 52 命运之战·doc23 §七）
    const stage = document.createElement('div');
    stage.style.cssText = 'width:min(100%, 140vh);max-width:1340px;margin:0 auto;border-radius:12px;overflow:hidden;position:relative';
    const battleLabel = `第 ${save.stage}/${RUN_BATTLES} 战 · ${lvl.battle.name} · ⚔ ${lvl.heroId}`;
    root.append(stage); // 战斗信息/返回/设置已内化到 turn-battle-screen topbar

    // 玩家牌库（契约A·甲读·owner 2026-06-21 #16：52 牌组是唯一真相·16 张按 ID 带 favor+地支附魔进场）：
    //   = 你配的 16 张 pokerPicks，每张挂自己的 effectiveDeckFavors(base+附魔)→战力；空 picks=自动构筑一副；
    //   主将=favor 最高那张(留士气机制)。Boss(b) 仍走 prepareArmies 泛化 army。lane 由放牌时自选·非预派。
    const { b } = prepareArmies({ formation, deckBias: myBias(effectiveDeckFavors(save.deck, save.inlays)), tiangangs: save.tiangangs, planets: save.planets, interventions, enemyForm: aiForm, enemyBias, boss });
    const seed = Math.floor(Math.random() * 1e9);
    const toPoker = (c: ArmyCard): PokerCard => ({ kind: 'poker', id: c.id, rank: cardRank(c), suit: c.suit, general: c.general, buff: Math.round(favorToP(c.favor) - cardPoints(cardRank(c))), cost: deployCost(cardRank(c)) });
    const effFav = effectiveDeckFavors(save.deck, save.inlays);
    const myPicks = activeDeck(save).pokerPicks.length ? activeDeck(save).pokerPicks : autoBuildPokerPicks({ favors: effFav, isOwned: isHeroOwned });
    const myDeck = buildPickDeck(myPicks, effFav); // 你的 16 张 pick（含逐张地支附魔）→ 战斗牌库
    // loadoutCap（doc27 §四·难度档）：玩家本关天罡上限（新手区 2→3）→ 截断出战天罡。
    const aTengang: TengangHandCard[] = save.tiangangs.slice(0, lvl.loadoutCap).map((id) => ({ kind: 'tengang', id }));
    const bTengang: TengangHandCard[] = lvl.boss.tiangang.map((id) => ({ kind: 'tengang', id })); // Boss 随机 12 天罡(seed=关id·可复现)·待 Boss AI 施放
    // Boss 主将牌 = 本关英雄那张牌（owner 2026-06-21·传奇主将·强化）：泛化兵全降为非主将，英雄牌强化后**置顶**(必进起手·当场亮相)；打赢=擒此英雄(解封)。
    const bossDeck = seededShuffleArr(b.map((c) => ({ ...toPoker(c), general: false })), seed ^ 0x51ed);
    const heroCard = bossHeroCard(aiName, enemyBias);
    if (heroCard) bossDeck.unshift(heroCard);
    const tb = initTurnBattle({ seed, disha: lvl.boss.disha, aiProfile: lvl.boss.aiProfile, aiTier: lvl.boss.aiTier, a: { pokerDeck: seededShuffleArr(myDeck, seed ^ 0x9e37), tengangDeck: aTengang }, b: { pokerDeck: bossDeck, tengangDeck: bTengang } });
    for (let i = 0; i < OPENING_HAND && tb.a.pokerDeck.length; i++) tb.a.hand.push(tb.a.pokerDeck.shift()!); // 起手摸
    for (let i = 0; i < OPENING_HAND && tb.b.pokerDeck.length; i++) tb.b.hand.push(tb.b.pokerDeck.shift()!);
    const shaView: TurnShaView[] = campaignFor(save.stage).fiends.map((f, i) => ({ filled: true, name: f.name, rar: (['gold', 'blue', 'green'] as const)[i] ?? 'white', desc: f.desc })); // 敌堡垒 3 地煞明牌

    // ── 运行态（UI 选中 + 掷命特写队列）──
    let theme: 'onyx' | 'brocade' = 'onyx';
    let selMode: string | null = null; // 当前选中的动作类（draw/deploy/cast/discard·UI 先选后做）
    let selHand = -1;                  // 放牌/施法/弃牌 选中的手牌
    let gateChance = false;            // 放牌附赠：放完一张牌 → 可翻一道机关门(一次)·用掉/换动作即失效(doc24 §三·owner 2026-06-20)
    let notice: string | null = null; let noticeTimer = 0; // 临时提示 toast
    let drained = 0; const perfQueue: ClashEvent[] = []; let perfClash: ClashEvent | null = null; let busy = false; let perfResume: (() => void) | null = null; let diceFx: { destroy: () => void } | null = null;
    let coachDid: (on: BattleCoachStep['on']) => void = () => {}; let syncCoach: () => void = () => {}; // 前置声明·真体在挂载后赋（战斗新手引导）
    let justMovedIds = new Set<string>(); let freshIds = new Map<string, number>(); let dealtId: string | null = null; let thinkTimer = 0; let thinkEl: HTMLElement | null = null; let settingsOpen = false;
    const tgName = (id: string): string => TIANGANG_BY_ID.get(id)?.name ?? id;
    const tgDesc = (id: string): string => TIANGANG_BY_ID.get(id)?.text ?? '持续战法·打出后整场生效'; // 磨砂浮层：天罡效果文案
    // ── 战场操作日志（debug·owner 2026-06-21：出 bug 把日志贴来排查）。逐条记 玩家/AI 操作 + 掷命 + 结算。──
    const dbg: string[] = []; const SUITNM2: Record<string, string> = { S: '黑桃', H: '红桃', D: '方块', C: '梅花', s: '黑桃', h: '红桃', d: '方块', c: '梅花' };
    const log = (s: string): void => { if (dbg.length > 1200) dbg.shift(); dbg.push(`[T${tb.turn}|源泉 我${tb.a.mana}/敌${tb.b.mana}] ${s}`); };
    const cardLabel = (c: PokerCard | TengangHandCard): string => (c.kind === 'poker' ? (SUITNM2[c.suit] ?? '') + c.rank : '天罡·' + tgName(c.id));
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
      document.body.appendChild(ov); setTimeout(() => { ov.remove(); onDone?.(); }, durationMs);
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
    const view = (): TurnBattleView => buildTurnBattleView(tb, { theme, tengangName: tgName, tengangDesc: tgDesc, selMode, selHand, clash: perfClash ? clashToTurnView(perfClash, tgName) : null, bossName: aiName, sha: shaView, gatesLive: gateChance, notice, movedIds: justMovedIds, freshIds, dealtId: dealtId ?? undefined, battleLabel, sfxOn: isSfxOn(), settingsOpen, bgmOn: isBgmOn(), bgmIdx: bgmTrackIdx(), bgmVol: bgmVolume(), bgmNames: BGM_TRACKS.map((t) => t.name) });
    let mounted: { update: () => void; destroy: () => void } | null = null;

    const drainClashes = (): void => { for (const ev of tb.clashLog.slice(drained)) perfQueue.push(ev); drained = tb.clashLog.length; };
    // 逐场掷命特写：盖一层「10 颗十面骰」3D 表现 → 点投掷 → 滚落冲破门槛 → 看明白了=演下一场/收场（owner 2026-06-21）。
    const playPerf = (onDone: () => void): void => {
      diceFx?.destroy(); diceFx = null;
      if (perfQueue.length === 0) { perfClash = null; perfResume = null; mounted?.update(); syncCoach(); onDone(); return; }
      const e = perfClash = perfQueue.shift()!;
      log(`⚔掷命[${LANE_NM[e.lane] ?? e.lane}] 我 ${e.a.rank}${SUITNM2[e.a.suit] ?? ''}(战力${e.a.pEff}) vs 敌 ${e.b.rank}${SUITNM2[e.b.suit] ?? ''}(战力${e.b.pEff}) ｜胜率${Math.round(e.winrate * 100)}% 掷${Math.round(e.roll * 100)} → ${e.aWins ? '我胜' : '敌胜'}`);
      perfResume = () => { perfResume = null; playPerf(onDone); }; mounted?.update(); syncCoach(); // 引导：特写中隐
      // 命运骰 3D 表现：浮层盖在特写上·点投掷→10 d10 滚→点数跳进度条→冲破门槛=我胜·继续=perfResume（骰子只演 clashDiceRoll 既定结果）
      const dd = clashDiceRoll(e.roll, e.winrate, e.aWins);
      diceFx = mountDiceRoll(root, { data: dd, mine: { rank: e.a.rank, suit: e.a.suit, pEff: e.a.pEff }, foe: { rank: e.b.rank, suit: e.b.suit, pEff: e.b.pEff }, winPct: Math.round(e.winrate * 100), laneName: LANE_NM[e.lane] ?? `第${e.lane + 1}路`, sfx: playSfx }, () => { diceFx = null; const r = perfResume; if (r) r(); });
    };
    const finishTurnSeq = (): void => { busy = false; selMode = null; selHand = -1; if (tb.winner !== 'pending') settleTurn(); else mounted?.update(); syncCoach(); };
    const runAiThenContinue = (): void => { // 玩家推进特写演完 → 敌方回合播报 → AI 思考 → AI 行动 + 掷命 → 我方回合播报 → 回到玩家
      if (tb.winner !== 'pending') { finishTurnSeq(); return; }
      showBanner('敌方回合', 1300, () => {
        startThinking(() => {
          const before = snapSlots();
          aiTakeTurn(tb, aggregateTengang); // Boss utility AI（画像驱动·施法即重算 tengangA 生效）
          justMovedIds = diffMoved(before);
          // 新部署的敌兵（before 没有的 id）→ 逐张落子 g-drop 错峰 + 叭叭叭部署音（owner 2026-06-21）
          freshIds = new Map(); let fi = 0;
          const newFoe: string[] = [];
          for (const L of tb.lanes) for (const u of L.b) if (!before.has(u.id)) { freshIds.set(u.id, fi); const d = fi * 150; window.setTimeout(() => playSfx('deploy'), d); fi++; newFoe.push(`${u.rank}${SUITNM2[u.suit] ?? ''}→${LANE_NM[tb.lanes.indexOf(L)] ?? '?'}`); }
          log(`敌·行动：部署[${newFoe.join('、') || '无'}] → 结束放置 → ▶行动阶段（两线同时推进·相遇掷命）`);
          drainClashes();
          mounted?.update();
          window.setTimeout(() => { justMovedIds = new Set(); freshIds = new Map(); if (!perfClash) mounted?.update(); }, Math.max(550, fi * 150 + 380)); // 错峰落子播完再清标记（掷命特写中不重渲·防 3D 飞入重启）
          playPerf(() => showBanner('我方回合', 1100, finishTurnSeq));
        });
      });
    };
    const commitEndTurn = (): void => {
      if (busy || tb.winner !== 'pending' || tb.active !== 'a') return;
      busy = true; selMode = null; selHand = -1; gateChance = false; playSfx('endTurn'); coachDid('endturn'); log('我·结束放置回合（无战斗）→ 待敌方放置 → 行动阶段两线同时推进');
      const before = snapSlots();
      endTurn(tb);
      justMovedIds = diffMoved(before);
      drainClashes();
      mounted?.update(); // 立刻渲染推进动画，然后再演掷命特写
      window.setTimeout(() => { justMovedIds = new Set(); if (!perfClash) mounted?.update(); }, 550); // 动画播完清标记（掷命特写中不重渲·否则 3D 飞入会重启=弹两次·owner 2026-06-21）
      playPerf(runAiThenContinue);
    };
    const actions: TurnBattleActions = {
      pickAction: (kind) => { if (busy || tb.active !== 'a') return; if (kind !== 'discard' && tb.actionTaken && tb.actionTaken !== kind) return; selMode = selMode === kind ? null : kind; selHand = -1; gateChance = false; playSfx('select'); }, // 弃牌不互斥：随时可进弃牌模式
      drawFrom: (from) => {
        if (busy || selMode !== 'draw') return;
        if (drawCard(tb, 'a', from)) { playSfx('draw'); coachDid('draw'); const nc = tb.a.hand[tb.a.hand.length - 1]; log(`我·抽牌(${from === 'poker' ? '扑克' : '天罡'}) → ${nc ? cardLabel(nc) : '?'}`); dealtId = tb.a.hand[tb.a.hand.length - 1]?.id ?? null; const did = dealtId; window.setTimeout(() => { if (dealtId === did) { dealtId = null; if (!perfClash) mounted?.update(); } }, 560); } // 抽到的牌飞入翻面入场·~560ms 后清标记
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
        if (selMode === 'cast') { const tc = tb.a.hand[i]; if (castTengang(tb, 'a', i)) { tb.a.tengangA = aggregateTengang(tb.a.castIds); tb.a.castFx = tb.a.castIds.map((id) => ({ id, fx: aggregateTengang([id]) })); playSfx('cast'); coachDid('cast'); log(`我·施天罡 ${tc ? cardLabel(tc) : '?'}`); } selHand = -1; } // 施法 → 持续修正重算（+逐张 castFx 供对决溯源）
        else if (selMode === 'discard') { const dc = tb.a.hand[i]; if (discardCard(tb, 'a', i)) { playSfx('discard'); log(`我·弃牌 ${dc ? cardLabel(dc) : '?'}（返0.5源泉·不互斥）`); } selHand = -1; }
        else if (selMode === 'deploy' || tb.actionTaken === null || tb.actionTaken === 'deploy') { selMode = 'deploy'; selHand = selHand === i ? -1 : i; playSfx('select'); } // 默认进放牌·选牌→点路落子
      },
      playLane: (lane) => { if (busy || selMode !== 'deploy' || selHand < 0) return; const pc = tb.a.hand[selHand]; if (deployUnit(tb, 'a', selHand, lane)) { selHand = -1; gateChance = true; playSfx('deploy'); coachDid('deploy'); log(`我·放牌 ${pc ? cardLabel(pc) : '?'} → ${LANE_NM[lane] ?? lane}`); flash('✓ 放牌成功——可翻一道机关门(箭头·一次)，或继续放牌'); } }, // 放牌附赠：一次翻门机会
      toggleGate: (idx) => { // 仅放牌后(gateChance)可翻一道本方门·一次；平时翻门无效（doc24 §三·owner 2026-06-20）
        if (busy || tb.active !== 'a') return;
        if (GATES[idx]?.side !== 'a') { playSfx('invalid'); flash('✗ 只能改自己的机关门'); return; }
        if (!gateChance) { playSfx('invalid'); flash('✗ 放完牌后才能翻一道机关门（一次）'); return; }
        toggleGate(tb, idx); gateChance = false; playSfx(tb.gatesOpen[idx] ? 'gateOpen' : 'gateClose'); log(`我·翻门#${idx} ${tb.gatesOpen[idx] ? '开◉' : '闭✕'}`); flash(tb.gatesOpen[idx] ? '机关门已开 ◉（下一步该格兵按门向过门）' : '机关门已闭 ✕');
      },
      endTurn: commitEndTurn,
      setTheme: (t) => { theme = t; },
      clashConfirm: () => { playSfx('confirm'); const r = perfResume; if (r) r(); },
      goBack: () => {
        if (tb.winner !== 'pending') { showLobby(); return; }
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center';
        ov.innerHTML = `<div style="background:#1a2638;border:1px solid #334155;border-radius:14px;padding:28px 32px;text-align:center;min-width:280px;box-shadow:0 16px 48px rgba(0,0,0,.8)">
          <div style="font-size:16px;font-weight:600;color:#e2e8f0;margin-bottom:8px">返回大厅？</div>
          <div style="font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:20px">当前战斗进度将丢失，无法恢复。</div>
          <div style="display:flex;gap:10px;justify-content:center">
            <button id="gg-back-no"  style="padding:9px 22px;border-radius:8px;border:1px solid #334155;background:#15202b;color:#e2e8f0;cursor:pointer;font:13px system-ui">继续战斗</button>
            <button id="gg-back-yes" style="padding:9px 22px;border-radius:8px;border:none;background:#dc2626;color:#fff;cursor:pointer;font:13px system-ui;font-weight:600">确认返回</button>
          </div>
        </div>`;
        document.body.appendChild(ov);
        ov.querySelector('#gg-back-no')?.addEventListener('click', () => ov.remove());
        ov.querySelector('#gg-back-yes')?.addEventListener('click', () => { ov.remove(); showLobby(); });
        ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
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
      selectBgm: (i) => { selectBgmState(i); playSfx('select'); mounted?.update(); },
      setBgmVol: (dir) => { setBgmVolume(bgmVolume() + (dir === 'up' ? 0.1 : -0.1)); mounted?.update(); },
    };
    mounted = mountTurnBattle(stage, view, actions);
    battle = mounted; // teardownMatch 清理（destroy）

    // ── 战斗新手引导（coachmark 能力·首通即教·seen 存档不再弹·owner 2026-06-21）──
    // 打天罡相关步按**手牌活检**判定（owner 2026-06-21·修「抽牌紧接打天罡」互斥卡死）：手里真有天罡才推进到「结束回合→打天罡」，
    // 否则跳过、不让玩家卡在做不到的操作上。抽牌步会引导玩家先摸一张天罡。
    const hasTengangNow = (): boolean => tb.a.hand.some((c) => c.kind === 'tengang'); // 手里真有天罡才可打 → 才推进打天罡步（避免卡死）
    let coachStep: BattleCoachStep | null = nextCoachStep(save.seen, { hasTengang: hasTengangNow() });
    const { world: coachWorld, setStep: setCoachStep } = makeCoachWorld();
    const coach = coachStep ? mountOnboardingOverlay(document.body, coachWorld, stage) : null; // 挂 body（非 root）→ 避开战场缩放/揭幕 transform 让 position:fixed 错位（owner 2026-06-21）
    syncCoach = (): void => { if (!coach) return; const show = coachStep != null && tb.active === 'a' && tb.winner === 'pending' && perfClash == null; setCoachStep(coachStep, show); coach.update(); };
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
        <div style="display:flex;align-items:center;gap:10px"><b style="color:#eaf0f6;font-size:15px;flex:1">📋 战场操作日志</b><button id="dbg-copy" style="padding:7px 16px;border-radius:8px;border:none;cursor:pointer;background:linear-gradient(180deg,#ff8d5a,#ee5a25);color:#fff;font-weight:700">复制</button><button id="dbg-close" style="padding:7px 14px;border-radius:8px;border:1px solid #3a4659;cursor:pointer;background:transparent;color:#cdd7e3">关闭</button></div>
        <textarea id="dbg-text" readonly style="flex:1;min-height:340px;resize:none;background:#0b0f17;color:#bcd;border:1px solid #2a3346;border-radius:10px;padding:11px;font:12px/1.5 ui-monospace,monospace;white-space:pre"></textarea>
        <div id="dbg-hint" style="font-size:11px;color:#7d8b9a">出 bug 时点「复制」把日志贴给开发排查。</div></div>`;
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
    };
    root.appendChild(dbgBtn); // 挂 root(非 stage·避免 mountTurnBattle 重渲抹掉)·左下角

    stopLoop = () => { perfResume = null; diceFx?.destroy(); diceFx = null; if (noticeTimer) { clearTimeout(noticeTimer); noticeTimer = 0; } if (thinkTimer) { clearTimeout(thinkTimer); thinkTimer = 0; } if (thinkEl) { thinkEl.remove(); thinkEl = null; } if (coach) { window.removeEventListener('resize', onCoachResize); coach.destroy(); } }; // 离场：弃未决特写续演 + 清骰子浮层 + 清提示计时 + 清思考蒙层 + 卸引导

    function settleTurn(): void {
      const survA = tb.lanes.reduce((s, L) => s + L.a.length + L.spentA, 0);
      const lanesA = tb.lanes.filter((L) => L.a.length + L.spentA > L.b.length + L.spentB).length;
      const lanesB = tb.lanes.filter((L) => L.b.length + L.spentB > L.a.length + L.spentA).length;
      const homeA = tb.homeA, homeB = tb.homeB, winner = tb.winner, homeMax = tb.homeMax;
      log(`▼结算：${winner === 'a' ? '我方胜' : winner === 'b' ? '敌方胜' : '平局'} ｜控路 我${lanesA}:敌${lanesB} ｜大本营 我${homeA}/敌${homeB}（满${homeMax}）`);
      playSfx(winner === 'a' ? 'victory' : 'defeat'); // 收场号角 / 哀落
      const gain = survA + (winner === 'a' ? 15 : 0);
      save.materials += gain;
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
          ${stat('战利品', '+' + gain, '材料 🪙')}${stat('控路', lanesA + ' : ' + lanesB, '我方 : 敌方')}${stat('大本营', '我 ' + homeA + ' / 敌 ' + homeB, '满 ' + homeMax)}${qm > 0 ? stat('督粮', '+' + qm + '◈', '入下场能量') : ''}
        </div>
        <div style="font-size:14px;color:#9fb0c2;margin-bottom:22px;min-height:18px;">${tail}</div>
        <button id="gg-result-cont" style="padding:14px 44px;border-radius:13px;border:none;cursor:pointer;background:linear-gradient(180deg,#ff8d5a,#ee5a25);color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:19px;letter-spacing:.04em;box-shadow:0 10px 28px rgba(238,90,37,.5);">${cont} →</button>
      </div>`;
      root.appendChild(result); // 结算覆盖层挂 root（非 stage=mountTurnBattle 宿主）→ 战斗屏重渲(render 整片重建 stage)不会抹掉它
      result.querySelector('#gg-result-cont')?.addEventListener('click', route);
    }
  }

  // ───────────────────────── 〔superseded〕旧实时三路行军（doc24 前·留作参考/帧测；startBattle 已切回合制）─────────────────────────
  function showMatch(formation: Formation, myName: string, interventions: Intervention[]): void {
    clear();
    const spec = battleSpec(save.stage - 1); // stage 1→战 0
    const boss = spec.boss ? bossFor(save.bossIdx) : null; // 终局 → 本 run 的牌王座
    const aiForm = boss ? boss.formation : aiFormation();
    const enemyBias = boss ? boss.favorBias : spec.enemyBias;
    const aiName = boss ? boss.name : describeFormation(aiForm.officers);
    // 战斗屏 = 设计稿三路战场（battle-screen，1280×720）。运行上下文(战次/命/Boss 台词)收进下方细条，不挡设计 HUD。
    const stage = document.createElement('div');
    // 占屏比更大（owner）：撑满容器宽（受 153vh 高约束保 16:9），battle-screen 内层用 container-query 随之缩放、不再锁 1280。
    stage.style.cssText = 'width:min(100%, 153vh);aspect-ratio:16 / 9;max-width:100%;margin:0 auto;border-radius:12px;overflow:hidden';
    const label = el('div', 'min-width:300px;text-align:center;font-weight:600;opacity:.85',
      `第 ${save.stage}/${RUN_BATTLES} 战 · ${spec.label} ｜ 命 ${'❤'.repeat(save.lives)} ｜ 你的阵 ${myName}${boss ? ` ｜ ⚔ ${boss.name}：「${boss.taunt}」` : ''}`);
    const back = mkBtn('← 返回大厅');
    back.onclick = showLobby;
    const bar = el('div', 'display:flex;gap:10px;align-items:center;max-width:1280px;flex-wrap:wrap;justify-content:center');
    bar.append(label, back);
    root.append(stage, bar);

    // 揭晓前完整编排（融天罡→玩家干预→Boss 起手→士气倍率+结局联动），与测试共用 prepareArmies、杜绝漂移；均 outcome-first。
    const { a, b } = prepareArmies({ formation, deckBias: myBias(effectiveDeckFavors(save.deck, save.inlays)), tiangangs: save.tiangangs, planets: save.planets, interventions, enemyForm: aiForm, enemyBias, boss });
    const oppPersona = boss ? boss.persona : '伺机而动 · 见招拆招';
    const oppSuit = suitOf(aiName);
    // 布局阶段 → 实时出牌（doc18 §10）：每路 base 打底（共 9）tick1 预铺，余牌洗成抽牌堆，起手摸 OPENING_HAND；
    // 战斗中实时从手牌派三路（live-combat 逐拍一格格爬、接敌对决、攻克 3 血老家）。替掉旧「54 张全 tick1 瞬铺」。
    const live = initLiveBattle(Math.floor(Math.random() * 1e9), HOME_BLOOD);
    const splitBaseDeck = (army: ArmyCard[]): { base: ArmyCard[]; deck: ArmyCard[] } => {
      const base: ArmyCard[] = [], deck: ArmyCard[] = [];
      for (const lane of [0, 1, 2]) { const lc = army.filter((c) => c.lane === lane); base.push(...lc.slice(0, BASE_PER_LANE)); deck.push(...lc.slice(BASE_PER_LANE)); }
      return { base, deck };
    };
    const seededShuffle = <T,>(xs: T[], seed: number): T[] => { // 确定性洗牌（mulberry32 · 抽序可回放、不破 outcome-first）
      const arr = [...xs]; let t = seed >>> 0;
      const rnd = (): number => { t += 0x6d2b79f5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    };
    const aSplit = splitBaseDeck(a), bSplit = splitBaseDeck(b);
    const aDeck = seededShuffle(aSplit.deck, live.rng.seed ^ 0x9e37);
    const bDeck = seededShuffle(bSplit.deck, live.rng.seed ^ 0x51ed); // 敌抽牌堆（滴投顺序确定）
    const aHand: ArmyCard[] = aDeck.splice(0, OPENING_NORMAL); // 起手普通手牌（CR 起手 4）
    const deploys: DeployCmd[] = [
      ...aSplit.base.map((c): DeployCmd => ({ tick: 1, side: 'a', lane: c.lane, unit: toUnit(c) })),
      ...bSplit.base.map((c): DeployCmd => ({ tick: 1, side: 'b', lane: c.lane, unit: toUnit(c) })),
    ];
    // CR 出牌控盘运行时态（doc21）：普通/天罡手牌 + 选中 + 点数池（召唤源泉·浮点·真实时间回复）。
    let selectedCard = -1, selectedTengang = -1;
    let migrateSource = -1; // 三路兵力迁移：已选的迁出路（-1 无·无选中牌时点路 = 迁移模式）
    let points = POINTS_START;
    // 天罡库（法术·≤5·读 save.tiangangs 契约②）：cycle 队列 —— 摸牌从库顶取、施法回库底；cap5 打掉才补。
    const tDeck: { id: string; name: string }[] = save.tiangangs.map((id) => ({ id, name: TIANGANG_BY_ID.get(id)?.name ?? id }));
    const tHand: { id: string; name: string }[] = [];
    const castIds = new Set<string>(); // A-JOKER：已施天罡集（施法即加入 → 聚合持续修正 live.tengangA·一种算一次）
    let aiNext = bDeck.length ? AI_PERIOD_TICKS : Infinity; // 敌下次滴投拍
    const canDrawNormal = (): boolean => live.winner === 'pending' && canDrawFrom(points, NORMAL_DRAW_COST, aHand.length, NORMAL_HAND_CAP + live.tengangA.handMaxAdd, aDeck.length);
    const canDrawTengang = (): boolean => live.winner === 'pending' && canDrawFrom(points, TENGANG_DRAW_COST, tHand.length, TENGANG_CAP, tDeck.length);
    const control = (): BattleControl => ({
      hand: aHand.map((c): HandCardView => ({ id: c.id, rank: cardRank(c), suit: c.suit.toLowerCase() as 's' | 'h' | 'd' | 'c', general: c.general })),
      selectedCard, deckCount: aDeck.length,
      tengang: tHand.map((c): TengangCardView => ({ id: c.id, name: c.name })), selectedTengang, tengangDeckCount: tDeck.length,
      points, pointsMax: POINTS_MAX, normalDrawCost: NORMAL_DRAW_COST, tengangDrawCost: TENGANG_DRAW_COST, canDrawNormal: canDrawNormal(), canDrawTengang: canDrawTengang(), migrateSource,
    });
    let prevPos = snapLivePos(live); // 真拍间插值锚（渲染层据此平滑滑行）
    let frac = 1;
    // 对决特写表演队列（owner：每场对决拉到屏幕前·看为什么胜败）：每拍新生对决进队，逐个冻结战场演 PERF_MS。
    const perfQueue: ClashEvent[] = [];
    let perfClash: ClashEvent | null = null;
    let perfUntil = 0;
    let encounter: ClashEvent | null = null; // 遭遇前奏中的对决（先演战场相遇、再切特写）
    let encUntil = 0;
    let gapUntil = 0; // 两场对决间「回战场」缓冲到期 ts
    let drained = 0; // 已收进特写队列的 clashLog 下标
    // ── A6 死亡闪帧 + A2 出牌啪嗒：板上瞬时特效（纯表现·不进 sim/hash）──
    const FX_MS = 640; // 特效寿命（ms）
    interface FxItem { kind: 'death' | 'deploy'; lane: number; side: 'a' | 'b'; pos01: number; rank?: string; suit?: 's' | 'h' | 'd' | 'c'; general?: boolean; born: number }
    const boardFx: FxItem[] = [];
    const deathPosByEv = new Map<ClashEvent, number>(); // 对决事件 → 败者阵亡处 pos01（特写演完落到板上斩残影）
    let lastUnitIds = new Set<string>(); // 上一拍在场牌 id（本拍新出现 = 刚投放 → 啪嗒）
    let heldClash: ClashEvent | null = null; // 已定格渲染的特写：演出期间不每帧重画 → CSS 3D 翻转/掷点动画得以播完（不再每 33ms 重启卡在起手）
    let heldEnc: ClashEvent | null = null; // 遭遇前奏定格锚（同 heldClash·让左右滑入动画播完）
    const lc = (s: string): 's' | 'h' | 'd' | 'c' => s.toLowerCase() as 's' | 'h' | 'd' | 'c';
    const actions: BattleActions = {
      selectCard: (i) => { selectedCard = i === selectedCard ? -1 : i; selectedTengang = -1; migrateSource = -1; }, // 二选一：选普通清天罡，并退出迁移模式
      selectTengang: (i) => { selectedTengang = i === selectedTengang ? -1 : i; selectedCard = -1; migrateSource = -1; },
      playLane: (lane) => { // 选中普通=部署 / 选中天罡=施法 / 无选中=三路兵力迁移（点首路=迁出、点次路=迁入）
        if (live.winner !== 'pending') return;
        if (selectedCard >= 0 && selectedCard < aHand.length) { // 部署慢行军（落点玩家自选·非牌原路）
          const c = aHand.splice(selectedCard, 1)[0];
          deploys.push({ tick: live.tick + 1, side: 'a', lane, unit: toUnit(c) });
          selectedCard = -1;
        } else if (selectedTengang >= 0 && selectedTengang < tHand.length) { // 施天罡法术（A-JOKER）：施其效果(持续战斗修正) + 消耗回库底(cycle·解锁再摸)
          const c = tHand.splice(selectedTengang, 1)[0];
          tDeck.push(c);
          castIds.add(c.id); live.tengangA = aggregateTengang([...castIds]); // 施法 → 持续修正生效（一种牌算一次·不叠）
          selectedTengang = -1;
        } else { // 迁移模式（无选中牌）：先点迁出路（须有后备）→ 再点迁入路 → 搬队尾后备一张
          if (migrateSource < 0) { if (live.lanes[lane].a.length > 0) migrateSource = lane; }
          else if (lane === migrateSource) { migrateSource = -1; } // 再点取消
          else { migrateRear(live, 'a', migrateSource, lane); migrateSource = -1; }
        }
      },
      drawNormal: () => { if (canDrawNormal()) { points -= NORMAL_DRAW_COST; aHand.push(aDeck.shift()!); } }, // 花点数摸普通库
      drawTengang: () => { if (canDrawTengang()) { points -= TENGANG_DRAW_COST; tHand.push(tDeck.shift()!); } }, // 花点数摸天罡库（cap5·打掉才补）
    };
    battle = mountBattle(stage, () => {
      const now = performance.now();
      for (let i = boardFx.length - 1; i >= 0; i--) if (now - boardFx[i].born >= FX_MS) boardFx.splice(i, 1); // 过期清理
      const fxv: BattleFx[] = boardFx.map((f) => ({ kind: f.kind, lane: f.lane, side: f.side, pos01: f.pos01, rank: f.rank, suit: f.suit, general: f.general, t: Math.min(1, (now - f.born) / FX_MS) }));
      const v = buildBattleViewLive(live, save, aiName, oppPersona, oppSuit, control(), perfClash ? clashToView(perfClash) : null, fxv);
      v.encounter = encounter ? clashToView(encounter) : null; // 遭遇前奏（先于特写·两张牌战场相遇提示）
      for (const u of v.units) { const cur = u.pos01 * LANE_LEN; const prev = prevPos.has(u.id) ? prevPos.get(u.id)! : cur; u.pos01 = (prev + (cur - prev) * frac) / LANE_LEN; } // lerp 上一拍→当拍
      return v;
    }, actions);

    let settled = false;
    let last = 0, acc = 0, lastRender = 0, raf = 0;
    const settle = (): void => {
      settled = true;
      frac = 1; // 落定帧滑到真·终位（不停在插值中途）
      if (battle) battle.update(); // 落定那帧定格最终态
      const survA = live.lanes.reduce((s, L) => s + L.a.length + L.spentA, 0); // 我方幸存(在场+续航尽退场) = 战利品
      const lanesA = live.lanes.filter((L) => L.a.length + L.spentA > L.b.length + L.spentB).length; // 净控路数（督粮/战况）
      const lanesB = live.lanes.filter((L) => L.b.length + L.spentB > L.a.length + L.spentA).length;
      const homeA = live.homeA, homeB = live.homeB, winner = live.winner;
      const gain = survA + (winner === 'a' ? 15 : 0);
      save.materials += gain;
      let tail = '';
      let route: () => void = showLobby; // 结算后"继续"去向
      let cont = '回大厅';
      if (winner === 'a') {
        save.campaignMax = Math.max(save.campaignMax, save.stage); // 通关 stage → 解锁该关 4 张天罡（doc25）
        save.leverEnergy = Math.min(effectiveLeverCap(save.planets), save.leverEnergy + effectiveLeverRegen(save.planets)); // 回能◈（星球·能 升档）
        if (save.stage >= RUN_BATTLES) { // 打穿终局 Boss → 通关
          save.materials += 50;
          tail = '🏆 <b>通关战役！</b>（+50 材料）回大厅开新战役';
          save.stage = 1; save.lives = effectiveLives(save.planets); save.bossIdx = rollBoss(); // 新 run：命线读星球·命、轮换 Boss
        } else { // 胜非终局 → 进军 + 场间三选一养成窗
          save.stage += 1;
          tail = `进军 第 ${save.stage}/${RUN_BATTLES} 战`;
          cont = '战间整备（三选一）';
          const nl = `进军第 ${save.stage} 战`;
          route = () => showBetween(nl);
        }
      } else { // 败/平 → 扣命
        save.lives -= 1;
        if (save.lives <= 0) { tail = '💀 <b>命尽，战役结束</b> 回大厅重整'; save.stage = 1; save.lives = effectiveLives(save.planets); save.bossIdx = rollBoss(); } // 新 run：命线读星球·命、轮换 Boss
        else { tail = `命 −1（剩 ${save.lives}）重整旗鼓再战本场`; cont = '重整再战'; route = startBattle; }
      }
      const qm = quartermasterEnergy(save.tiangangs, lanesA); // 督粮：每胜一路 +◈ 入下场 run 能量（post-resolve）
      if (qm > 0) { save.leverEnergy = Math.min(effectiveLeverCap(save.planets), save.leverEnergy + qm); tail += `（督粮 +${qm}◈）`; }
      persist(save);
      const who = winner === 'a' ? '我方胜（攻克敌老家）' : winner === 'b' ? '敌方胜（我老家被破）' : '平局（无人破家）';
      const color = winner === 'a' ? '#eab308' : winner === 'b' ? '#94a3b8' : '#cbd5e1';
      label.innerHTML = `<span style="color:${color}">${who}</span> ｜ 控路 ${lanesA}:${lanesB} ｜ 老家 我${homeA}/敌${homeB}（满${HOME_BLOOD}）｜ 敌阵【${aiName}】 ｜ +${gain} 材料 ｜ ${tail}`;
      back.textContent = `→ ${cont}`;
      back.onclick = route;
      // 结算大屏（owner：每次打完给玩家看清结果）—— 覆盖战场的结果面板：胜/负/平大字 + 战利品/控路/老家血 + 继续。loop 已停（settle 后不再 update），故 append 到 stage 不会被重渲清掉。
      const bigTxt = winner === 'a' ? '胜 利' : winner === 'b' ? '战 败' : '平 局';
      const bigCol = winner === 'a' ? '#ffe09a' : winner === 'b' ? '#ff6b6b' : '#cbd5e1';
      const stat = (lab: string, val: string, sub: string): string => `<div style="padding:14px 12px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);text-align:center;"><div style="font-size:11px;letter-spacing:.14em;color:#8493a3;text-transform:uppercase;">${lab}</div><div style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:25px;color:#eaf0f6;margin:5px 0 2px;">${val}</div><div style="font-size:11px;color:#7d8b9a;">${sub}</div></div>`;
      const result = document.createElement('div');
      result.style.cssText = 'position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(60% 60% at 50% 42%,rgba(8,12,18,.74),rgba(4,6,10,.93));backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);font-family:"Noto Sans SC",sans-serif;';
      result.innerHTML = `<div style="width:min(86%,720px);padding:34px 40px;border-radius:22px;background:linear-gradient(180deg,rgba(26,38,54,.97),rgba(12,18,28,.99));border:2px solid ${bigCol}66;box-shadow:0 30px 90px rgba(0,0,0,.72),0 0 64px ${bigCol}33;text-align:center;">
        <div style="font-family:'Zhi Mang Xing',cursive;font-size:80px;line-height:1;color:${bigCol};text-shadow:0 4px 26px ${bigCol}66;">${bigTxt}</div>
        <div style="font-size:16px;color:#cdd7e3;margin-top:6px;">${who} ｜ 敌阵【${aiName}】</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:26px 0 18px;">
          ${stat('战利品', '+' + gain, '材料 🪙')}
          ${stat('控路', lanesA + ' : ' + lanesB, '我方 : 敌方')}
          ${stat('老家血', '我 ' + homeA + ' / 敌 ' + homeB, '满 ' + HOME_BLOOD)}
          ${qm > 0 ? stat('督粮', '+' + qm + '◈', '入下场能量') : ''}
        </div>
        <div style="font-size:14px;color:#9fb0c2;margin-bottom:22px;min-height:18px;">${tail}</div>
        <button id="gg-result-cont" style="padding:14px 44px;border-radius:13px;border:none;cursor:pointer;background:linear-gradient(180deg,#ff8d5a,#ee5a25);color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:19px;letter-spacing:.04em;box-shadow:0 10px 28px rgba(238,90,37,.5);">${cont} →</button>
      </div>`;
      stage.style.position = 'relative';
      root.appendChild(result); // 同 showTurnMatch：结算覆盖层挂 root·避免 mount 重渲抹掉（superseded 路·一并修）
      result.querySelector('#gg-result-cont')?.addEventListener('click', route);
    };
    // rAF 实时驱动（CR 纯实时·无暂停·doc21）：点数(召唤源泉)随真实时间回复；每 LIVE_STEP_MS 走一拍（一格格爬）+ 敌滴投；
    // 渲染 ~30fps 按 frac 平滑；演对决特写时世界静止（点数/sim 皆冻）；落定即结算、停步。
    const loop = (ts: number): void => {
      if (last === 0) last = ts;
      const dt = ts - last; last = ts;
      // 对决特写：演完(到 PERF_MS)收场；空闲且队列有 → 取下一场冻结战场演（sim 此刻不推进）。
      if (perfClash && ts >= perfUntil) { // 特写收场 → 败者落斩残影（A6·延续 overlay→棋盘）+ 进入「回战场」缓冲
        const loser = perfClash.aWins ? perfClash.b : perfClash.a;
        boardFx.push({ kind: 'death', lane: perfClash.lane, side: perfClash.aWins ? 'b' : 'a', pos01: deathPosByEv.get(perfClash) ?? 0.5, rank: loser.rank, suit: lc(loser.suit), general: loser.general, born: performance.now() });
        deathPosByEv.delete(perfClash);
        perfClash = null;
        gapUntil = ts + CLASH_GAP_MS; // owner：打完一个回到战场表现一下·再演下一场
      }
      if (encounter && ts >= encUntil) { perfClash = encounter; perfUntil = ts + PERF_MS; encounter = null; acc = 0; } // 遭遇前奏演完 → 切对决特写
      if (!perfClash && !encounter && ts >= gapUntil && perfQueue.length) { encounter = perfQueue.shift()!; encUntil = ts + ENCOUNTER_MS; acc = 0; } // 回战场缓冲过后 → 取下一场·先演「遭遇」前奏
      if (!perfClash && !encounter && ts >= gapUntil) { // 无特写/无遭遇前奏/回战场缓冲已过 → 点数回复 + 推进（演出与缓冲期世界静止）
        if (!settled && live.winner === 'pending') {
          points = Math.min(POINTS_MAX, points + dt / POINTS_REGEN_MS); // 召唤源泉随真实时间回复（演特写=世界静止时不回）
          acc += dt;
          if (acc > LIVE_STEP_MS * 3) acc = LIVE_STEP_MS; // 切后台回来防暴冲
          if (acc >= LIVE_STEP_MS) {
            prevPos = snapLivePos(live);
            const frontA = live.lanes.map((L) => L.a[0]?.id), frontB = live.lanes.map((L) => L.b[0]?.id); // 步进前各路前锋（阵亡处定位用）
            stepLiveBattle(live, deploys);
            acc -= LIVE_STEP_MS;
            const newClashes = live.clashLog.slice(drained); drained = live.clashLog.length; // 本拍新生对决（驱动特写 + 斩残影）
            for (const ev of newClashes) { // → 进特写队列 + 记下败者阵亡 pos01（步进前前锋位，特写演完落到板上斩残影）
              perfQueue.push(ev);
              const loserId = ev.aWins ? frontB[ev.lane] : frontA[ev.lane];
              if (loserId !== undefined && prevPos.has(loserId)) deathPosByEv.set(ev, prevPos.get(loserId)! / LANE_LEN);
            }
            // A2 出牌啪嗒：本拍新出现的牌(非起手 tick1 预铺) = 刚投放/滴投 → 入场环（己橙/敌蓝），点选派路看得见反馈。
            if (live.tick > 1) for (const li of [0, 1, 2]) {
              for (const u of live.lanes[li].a) if (!lastUnitIds.has(u.id)) boardFx.push({ kind: 'deploy', lane: li, side: 'a', pos01: u.pos / LANE_LEN, suit: lc(u.suit), general: u.general, born: performance.now() });
              for (const u of live.lanes[li].b) if (!lastUnitIds.has(u.id)) boardFx.push({ kind: 'deploy', lane: li, side: 'b', pos01: u.pos / LANE_LEN, suit: lc(u.suit), general: u.general, born: performance.now() });
            }
            lastUnitIds = new Set<string>();
            for (const li of [0, 1, 2]) { for (const u of live.lanes[li].a) lastUnitIds.add(u.id); for (const u of live.lanes[li].b) lastUnitIds.add(u.id); }
            // 抽牌改 CR（doc21 §四 · A1 superseded）：玩家花点数主动摸牌（drawNormal/drawTengang），不再底流/事件被动涌牌。
            if (live.tick >= aiNext && bDeck.length) { const c = bDeck.shift()!; deploys.push({ tick: live.tick + 1, side: 'b', lane: c.lane, unit: toUnit(c) }); aiNext = live.tick + AI_PERIOD_TICKS; } // 敌滴投入该牌原路（随阵型）
            if (live.winner === 'pending' && !liveActive(live)) live.winner = live.homeB < live.homeA ? 'a' : live.homeA < live.homeB ? 'b' : 'draw'; // 两军互清无突破 → 比残血定（同 runLiveBattle 收尾）
          }
          frac = Math.max(0, Math.min(1, acc / LIVE_STEP_MS));
        }
      }
      if (battle) { // 渲染：特写/遭遇前奏「定格一次」(CSS 动画一次播完·不每 33ms 重建把它重启)；回战场缓冲与平时 ~30fps 平滑（斩残影在战场淡出可见）
        if (perfClash) { if (perfClash !== heldClash) { battle.update(); heldClash = perfClash; heldEnc = null; lastRender = ts; } }
        else if (encounter) { if (encounter !== heldEnc) { battle.update(); heldEnc = encounter; heldClash = null; lastRender = ts; } }
        else { if (ts - lastRender >= RENDER_MS) { battle.update(); lastRender = ts; } heldClash = null; heldEnc = null; }
      }
      if (!settled && live.winner !== 'pending' && !perfClash && !encounter && ts >= gapUntil && perfQueue.length === 0) { settle(); return; } // 等遭遇前奏+特写+回战场缓冲全演完才结算
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    stopLoop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; settled = true; };
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
function mkBtn(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.cssText = 'padding:8px 13px;border-radius:8px;border:1px solid #334155;background:#15202b;color:#e2e8f0;cursor:pointer;font:12px system-ui';
  return b;
}
