// Game G · 本地存档（纯数据 + 迁移）—— 从 game-g.tsx 抽出的存档层：类型 Save/TiangangDeck + 读写迁移 + 出战牌组派生。
// 全是纯函数（除 localStorage 读写），不依赖 mount() 运行态；驱动层(game-g.tsx)与各模块共享 Save 类型从这里取。
import { LEVER_START, RUN_LIVES, RUN_BATTLES, BOSS_ROSTER, GAME_G_TIANGANGS, TIANGANG_BY_ID, unlockStageOf, isPoolCardId, POKER_PICK_SIZE, effectiveLives, type InlayEntry } from './index.js';
import { ggCloudSave } from './platform-hooks.js'; // 存档镜像上（真/假）Steam 云

const DECK_SIZE = 52;
export const SAVE_KEY = 'gameG-save-v1';
// 天罡牌组（owner 2026-06-20）：每场带 12 张天罡出战；玩家可建多套具名牌组、选一套出战、预览。数字可变 → 改这一处。
export const TIANGANG_DECK_SIZE = 12;
export const MAX_TIANGANG_DECKS = 6; // 牌组槽位上限

export interface Save {
  materials: number; // 金币 Gold（doc25 · 打战斗赚·免费·解锁天罡/地支/改造坊）
  diamond: number; // 钻石 Diamond（doc25 · 付费·只加速速解·不卖强度）
  dizhiShards: number; // 地支碎片（养地支专属材料 · 💎可换 · 待甲镶嵌系统消耗）
  rechargeCount: number; // 已完成充值次数（投资人彩蛋：首充免密·第二次起需密码）
  seenIntro: boolean; // 是否已看过首启开场故事（doc28 §一·只播一次）
  guideStep: number; // 新手引导进度（doc28 §二）：0..N 进行中 · -1 完成/跳过
  skipGuide: boolean; // 跳过新手引导（owner 2026-06-21·默认 false=开·菜单手动关）
  guideDefaultFixed?: boolean; // 一次性迁移标记：纠正早期「默认关」误版写入的 skipGuide=true
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
export const FORTUNE_MAX = 3; // 每日制卦上限（owner 2026-06-21）
export const fortuneToday = (): string => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export function resetFortuneIfNewDay(s: Save): void { const t = fortuneToday(); if (!s.fortune || s.fortune.date !== t) s.fortune = { date: t, rolls: 0, keptVal: null }; }
export interface TiangangDeck { id: string; name: string; cards: string[]; pokerPicks: string[] } // cards = 天罡 id（≤TIANGANG_DECK_SIZE）；pokerPicks = 自选出战扑克卡 id（≤POKER_PICK_SIZE·契约A·乙写甲读·空=自动构筑一副）

// 出战牌组（找不到则取第一个；都空则造默认）。syncTiangangs：把出战牌组卡表派生进 save.tiangangs（契约②·甲读）。
export function activeDeck(s: Save): TiangangDeck {
  return s.tiangangDecks.find((d) => d.id === s.activeDeckId) ?? s.tiangangDecks[0];
}
export function syncTiangangs(s: Save): void { s.tiangangs = [...(activeDeck(s)?.cards ?? [])]; }
export const newDeckId = (): string => `deck_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;

export const rollBoss = (): number => Math.floor(Math.random() * BOSS_ROSTER.length);
export function freshSave(): Save {
  return { materials: 120, diamond: 6, dizhiShards: 30, rechargeCount: 0, seenIntro: false, guideStep: 0, skipGuide: false, seen: {}, tiangangShards: 0, dizhiBag: { 子: [2, 0, 0], 丑: [1, 0, 0], 寅: [1, 0, 0], 卯: [1, 0, 0] }, inlays: {}, campaignMax: 1, stage: 1, deck: Array.from({ length: DECK_SIZE }, (_, i) => 44 + (i % 10) * 2), lastOfficers: [10, 10, 10], leverEnergy: LEVER_START, lives: RUN_LIVES, bossIdx: rollBoss(), ownedTiangangs: GAME_G_TIANGANGS.filter((t) => unlockStageOf(t.id) <= 1).map((t) => t.id), tiangangDecks: [{ id: 'deck1', name: '牌组 1', cards: [], pokerPicks: [] }, { id: 'deck2', name: '牌组 2', cards: [], pokerPicks: [] }, { id: 'deck3', name: '牌组 3', cards: [], pokerPicks: [] }, { id: 'deck4', name: '牌组 4', cards: [], pokerPicks: [] }], activeDeckId: 'deck1', tiangangs: [], planets: {}, foils: [], fortune: { date: '', rolls: 0, keptVal: null } }; // 44..62 起步；金币 120；钻石送 6（首充免密）；开局默认给 4 个天罡牌组让玩家去组（owner 2026-06-21）；pokerPicks 空=自动构筑一副；新存档播开场故事+引导
}
export function loadSave(): Save {
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
        if (typeof s.skipGuide !== 'boolean') s.skipGuide = false; // 新手引导默认开（owner 2026-06-21）·菜单手动关；老存档 seen/guideStep 已完成→自然不再弹
        if (!s.guideDefaultFixed) { s.skipGuide = false; s.guideDefaultFixed = true; } // 一次性纠正：早期「默认关」误版把 skipGuide=true 写进存档 → 纠回开一次（之后手动关照常保留·owner 2026-06-21）
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
export function persist(s: Save): void {
  try {
    const raw = JSON.stringify(s);
    localStorage.setItem(SAVE_KEY, raw);
    ggCloudSave(raw); // 镜像上（真/假）Steam 云·best-effort·失败不碰本地存档
  } catch {
    /* 忽略 */
  }
}
