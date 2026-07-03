// level.ts —— Campaign 关卡加载器（doc27 · owner 2026-06-19「52 关系统化入库·主程逐关加载」）。
// 数据驱动：一关 = 一条 LevelDef（拼装 doc23 §三/七 英雄战役 + disha.ts 地煞 + doc25 解锁 + doc27 §四/五 难度/背景对白）。
// 引擎按 id 逐关加载喂 turn-combat（doc24 回合制）：Boss 大本营血/地煞/12 天罡 seed 随机/loadoutCap 上限。
import { campaignFor, TIANGANG_UNLOCK, type StageCampaign } from './blueprint.js';
import { stageDisha } from './disha.js';
import { NEUTRAL_AI, type AiProfile, type PokerCard } from './turn-combat.js';
import { seededShuffle } from '@atom-skills/index.js'; // 洗牌收敛 atoms 单一真相（零漂移）

export interface LevelDef {
  id: number; heroId: string; stars: number;
  battle: { name: string; oneLine: string };
  intro: string;                                  // 开场战役背景旁白
  bossLines: { open: string; mid: string; lose: string }; // Boss 对白（开场/劣势/败北）
  boss: { homeHp: number; disha: string[]; tiangang: string[]; aiTier: number; aiProfile: AiProfile;
    deck: { rank: string; suit: string }[]; favorBias: number; stayP: number;
    startFormation: { rank: string; suit: string; lane: number; slot: number }[] }; // 16 牌组(关1-5·空=回退泛化army) + 牌力偏置(写卡buff) + 留场P + 地煞 3 + 随机 12 天罡 + AI 档 + 策略画像 + 开局排阵守军(REQ-G-开局排阵)
  reward: { unlock: string[]; gold: number };
  loadoutCap: number;                             // 玩家本关天罡 loadout 上限（新手区 2→3）
}

// 关1-5 Boss 策略画像（doc27 §八·design G 填·性格即数据·与各自地煞自洽）。关6+ 暂 NEUTRAL（逐期填）。
const AI_PROFILES: Record<number, AiProfile> = {
  1: { aggression: 2, lanePref: 3, spellEager: 4, targetPref: 'strong', risk: 2, economy: 3 },   // 列奥尼达·守家硬汉
  2: { aggression: 8, lanePref: 4, spellEager: 6, targetPref: 'general', risk: 6, economy: 6 },  // 亚历山大·突击斩首
  3: { aggression: 6, lanePref: 9, spellEager: 5, targetPref: 'weak', risk: 4, economy: 8 },     // 曹操·兵海铺三路
  4: { aggression: 7, lanePref: 2, spellEager: 7, targetPref: 'weak', risk: 6, economy: 7 },     // 拿破仑·集中突破
  5: { aggression: 10, lanePref: 1, spellEager: 8, targetPref: 'strong', risk: 9, economy: 9 },  // 项羽·莽·全压一路
};

// 难度档（doc27 §四）：大本营血 / loadoutCap / AI 智能档。**按 stage 索引**（design G 2026-06-20 修 bug：原按 c.stars 索引·STAGE_CAMPAIGN stars 仅 1-3 → 4/5 档死表·项羽实拿 tier2）。
// 当前 5 战 run = 关1-5 难度阶梯 ★→★★★★★（项羽=run 终 boss·最难）。52 关批量铺开时按 doc27 §四 阶段区间重定（design G「按批出关」）。
// bossTg（owner 2026-06-29）：Boss 出战天罡数·逐关递增（关1 仅 2·序战轻松）——v2「按基础牌」后 12 天罡过强·须按关收。
const DIFFICULTY: Record<number, { homeHp: number; loadoutCap: number; aiTier: number; bossTg: number }> = {
  1: { homeHp: 3, loadoutCap: 2, aiTier: 1, bossTg: 2 }, // ★ 序战（v2 按基础牌后·AI 3→1：关1 回轻松·不全知预判·会犯错·owner 2026-06-29 目标 ~80%）
  2: { homeHp: 3, loadoutCap: 3, aiTier: 3, bossTg: 4 }, // ★★（AI 智能档 2→3：同上·开全知预判；家血/loadout 不动=只让 AI 变聪明·非整关变难）
  3: { homeHp: 4, loadoutCap: 3, aiTier: 3, bossTg: 6 }, // ★★★
  4: { homeHp: 4, loadoutCap: 4, aiTier: 4, bossTg: 9 }, // ★★★★
  5: { homeHp: 5, loadoutCap: 5, aiTier: 5, bossTg: 12 }, // ★★★★★ 终章
};

// 关1-5 Boss「16 牌组」（design/boss-config-1-5.md §一-五·design G 2026-06-21 标定·rank+suit·与玩家 16 张对称）。
// 主将那张（=本关英雄）由 bossHeroCard 强化提供，建库时从列表挪掉一张同 rank+suit → 15 泛兵 + 1 强化主将 = 16。
// 关6+ 暂无（fall back 旧 prepareArmies 泛化 army·待逐期补 16 牌组）。
const BOSS_DECK_1_5: Record<number, string[]> = {
  1: ['5S', '6S', '6S', '7S', '7S', '7S', '8S', '8S', '8H', '9H', '9C', '10S', '10S', 'JS', 'KS', 'AS'], // 列奥尼达·黑桃同点墙
  2: ['6H', '7H', '8D', '8S', '9H', '9C', '10D', '10S', 'JH', 'JD', 'QH', 'QS', 'KH', 'KD', 'AH', 'AS'], // 亚历山大·红桃高点尖兵
  3: ['3C', '4C', '5C', '5C', '6C', '6C', '7D', '7D', '8D', '8D', '9S', '9S', '10H', 'JC', 'QC', 'KC'], // 曹操·梅花连环兵海
  4: ['5D', '6D', '7S', '8H', '8C', '9D', '9C', '10D', '10S', 'JD', 'JH', 'QD', 'QS', 'KD', 'KH', 'AD'], // 拿破仑·方块大炮近卫
  5: ['8S', '9S', '10S', '10H', 'JS', 'JH', 'QS', 'QH', 'KS', 'KH', 'KD', 'AS', 'AH', 'AD', 'QS', 'JH'], // 项羽·全高点莽军
};
// Boss 牌力偏置（写卡 buff·design/boss-config-1-5.md）：教学关弱(−2)→终章强(+4)。留场P：关3-5 守将乘胜 0.75（base 0.5）。
const BOSS_FAVOR_BIAS: Record<number, number> = { 1: -2, 2: -2, 3: 0, 4: 2, 5: 4 };
const BOSS_STAY_P: Record<number, number> = { 1: 0.5, 2: 0.5, 3: 0.75, 4: 0.75, 5: 0.75 };
// 开局排阵守军（REQ-G-开局排阵·明牌摆兵·静守 hold）：关1 列奥尼达 2 张守军排隘口(贴 Boss 家 slot 8/7·上/下路)→ 玩家开局撞现成的墙·得绕/啃。
// 张数/摆哪路 = design G 用 sim 标（关1 教学取 2·后续关爬 3-4）；lane 暂上/下分置（中路留主将+驻军）·待 design G 定稿。
const BOSS_START_FORMATION: Record<number, { rank: string; suit: string; lane: number; slot: number }[]> = {
  1: [{ rank: '8', suit: 'S', lane: 0, slot: 8 }, { rank: '9', suit: 'H', lane: 2, slot: 7 }],
};
const CODE_RE = /^(10|[2-9]|[AKQJ])([SHDC])$/;
/** 解析 '10S'/'AS'/'5H' → {rank,suit}（suit 用字母·与 bossHeroCard/SUITNAME·lc2 一致）。非法码丢弃。 */
function parseCardCode(code: string): { rank: string; suit: string } | null {
  const m = CODE_RE.exec(code); return m ? { rank: m[1], suit: m[2] } : null;
}

// 关1-5 战役背景 + Boss 对白（doc27 §五·全文）。关6+ 暂复用占位（§六文案后续逐期接入）。
const LEVEL_LORE: Record<number, { intro: string; open: string; mid: string; lose: string }> = {
  1: { intro: '公元前 480 年，波斯百万大军压境。列奥尼达率三百斯巴达勇士死守温泉关隘口——以血肉筑成不可逾越之墙。而你，要翻动这场死战的结局。',
    open: '波斯人！来取我的长矛吧——如果你们能。', mid: '斯巴达人，早餐尽情吃——晚餐我们在冥府享用！', lose: '……斯巴达的荣耀，今日终结于你手。' },
  2: { intro: '公元前 331 年，高加米拉平原。亚历山大以四万直面大流士二十万波斯大军，亲率伙伴骑兵直取王旗。',
    open: '我不窃取胜利。来吧，让命运在阳光下见分晓。', mid: '看我的伙伴骑兵，如何凿穿你的中军！', lose: '……连我，也有马失前蹄之日。了不起。' },
  3: { intro: '建安十三年，赤壁。曹操列八十万众于江北、铁索连环。一把火，将改写天下三分。这一回，你是那把火。',
    open: '孤提百万雄师，踏平江东，弹指间耳。', mid: '区区火攻，也敢撼我连环巨舰？', lose: '……华容道上，孤竟败于这一炬。' },
  4: { intro: '1815 年，滑铁卢。从厄尔巴归来的拿破仑，要在此重夺欧洲——或永远落幕。',
    open: '近卫军从未后退。今日，让世界再记住我的名字。', mid: '大炮是我最忠诚的女儿——听她歌唱吧。', lose: '……普鲁士人来得太快。命运，终弃我而去。' },
  5: { intro: '垓下，四面楚歌。西楚霸王力能扛鼎、勇冠三军，却已陷十面埋伏。虞兮虞兮奈若何——而你，能否为霸王翻这一局命？',
    open: '力拔山兮气盖世！纵八千子弟散尽，此身亦战至最后一人！', mid: '此天亡我，非战之罪也！', lose: '……无颜见江东父老。罢了，就让你来翻这命吧。' },
};

const ALL_TIANGANG: readonly string[] = TIANGANG_UNLOCK.flatMap((u) => u.ids); // 36 天罡全池（9 关 ×4）

/** Boss 随机 12 天罡（doc27 §三）：seed=关 id → 同关同 12 张·可复现喂 sim。从 36 池均匀不重复抽。 */
export function bossTiangang(stage: number, count = 12): string[] {
  return seededShuffle(ALL_TIANGANG, (stage * 2654435761) >>> 0).slice(0, Math.min(count, ALL_TIANGANG.length));
}

// 教学关稻草兵（doc28 §三·关0·弱训练敌·固定弱牌·好赢）：几张低点扑克兵·无地煞无天罡·配 aiTier 0 + 守势画像 → 可预测好赢。乙 跑教学关用。
export const TUTORIAL_AI: AiProfile = { aggression: 1, lanePref: 5, spellEager: 0, targetPref: 'weak', risk: 0, economy: 3 };
export function tutorialEnemyDeck(): PokerCard[] {
  return ['2', '3', '2', '4', '3', '2'].map((rank, i) => ({ kind: 'poker', id: 'straw' + i, rank, suit: 'C', general: false, buff: 0 }));
}

/** 按 stage（1 基）加载一关定义（越界取末关 lore 占位·数据全拼装）。纯数据·确定性。 */
export function loadLevel(stage: number): LevelDef {
  const c: StageCampaign = campaignFor(stage);
  const diff = DIFFICULTY[stage] ?? DIFFICULTY[5]; // 按 stage 索引（design G 修 bug·原 c.stars 致 4/5 档死表）；越界取终章档
  const lore = LEVEL_LORE[stage] ?? LEVEL_LORE[5]; // 关6+ 暂复用占位
  const unlock = TIANGANG_UNLOCK.find((u) => u.stage === stage)?.ids ?? [];
  return {
    id: stage, heroId: c.boss, stars: c.stars,
    battle: { name: c.battle, oneLine: c.oneLiner },
    intro: lore.intro,
    bossLines: { open: lore.open, mid: lore.mid, lose: lore.lose },
    boss: { homeHp: diff.homeHp, disha: stageDisha(stage), tiangang: bossTiangang(stage, diff.bossTg), aiTier: diff.aiTier, aiProfile: AI_PROFILES[stage] ?? NEUTRAL_AI,
      deck: (BOSS_DECK_1_5[stage] ?? []).map(parseCardCode).filter((c): c is { rank: string; suit: string } => c != null), favorBias: BOSS_FAVOR_BIAS[stage] ?? 0, stayP: BOSS_STAY_P[stage] ?? 0.5,
      startFormation: BOSS_START_FORMATION[stage] ?? [] },
    reward: { unlock, gold: 20 + stage * 10 },
    loadoutCap: diff.loadoutCap,
  };
}
