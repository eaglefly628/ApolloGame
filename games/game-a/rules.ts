// Game A ·《掼蛋夜宴》—— 规则数据层（纯数据 + 纯转换·零系统逻辑）。
// 语义真相 = docs/design/game-a/gdd.md §2（淮安标准全套默认值表·owner 三轮拍板）。
// 判型/压制序/逢人配的解释器 = 引擎 t3-hand-pattern（A-S1 条件②·游戏层禁自写判型）——
// 本文件只提供它要吃的 config **数据**与牌码工具；发牌/轮转/结算的消费在 S4 玩法关接入。
import type { HandPatternConfig } from '@skills/tier3/index.js';

// ── 牌码（card-pile 约定 code = suit*100 + rank）────────────────────────────────
// suit：♠0 ♥1 ♦2 ♣3（protocol Card 约定）；rank：2..14（J=11 Q=12 K=13 A=14），小王 15、大王 16。
export const SUIT_SPADE = 0;
export const SUIT_HEART = 1;
export const SUIT_DIAMOND = 2;
export const SUIT_CLUB = 3;
export const RANK_ACE = 14;
export const RANK_SMALL_JOKER = 15;
export const RANK_BIG_JOKER = 16;

export const cardCode = (suit: number, rank: number): number => suit * 100 + rank;
export const codeSuit = (code: number): number => Math.floor(code / 100);
export const codeRank = (code: number): number => code % 100;
export const isJoker = (code: number): boolean => codeRank(code) >= RANK_SMALL_JOKER;

/** 理牌排序（纯视图变换·不碰 sim）：
 *  - 'rank'：按点数升序（级牌抬到 A 上·王下·同点按花色）——默认。
 *  - 'family'：同点聚成组·组按张数降序（炸弹/三张/对子前置·一眼看牌力）·同张数按点数升序。
 *  levelRank=本盘级牌点数（抬高排序位）。纯函数·可回放·可测。 */
export function sortHand(codes: readonly number[], mode: 'rank' | 'family', levelRank: number): number[] {
  const eff = (c: number): number => {
    const r = codeRank(c);
    return r === levelRank ? RANK_ACE + 0.5 : r; // 级牌抬到 A 之上、小王(15)之下
  };
  if (mode === 'rank') {
    return [...codes].sort((a, b) => eff(a) - eff(b) || codeSuit(a) - codeSuit(b));
  }
  const byRank = new Map<number, number[]>();
  for (const c of codes) {
    const r = codeRank(c);
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(c);
  }
  return [...byRank.values()]
    .sort((g1, g2) => g2.length - g1.length || eff(g1[0]) - eff(g2[0]))
    .flat();
}

/** 两副含王 108 张（gdd R1）。基准顺序=副×花色×点数+双王；洗牌在 S4 发牌时走 seededShuffle（种子 PRNG）。 */
export function buildDeck108(): number[] {
  const deck: number[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (let suit = 0; suit <= 3; suit++) {
      for (let rank = 2; rank <= RANK_ACE; rank++) deck.push(cardCode(suit, rank));
    }
    deck.push(cardCode(0, RANK_SMALL_JOKER), cardCode(0, RANK_BIG_JOKER));
  }
  return deck;
}
export const DECK_SIZE = 108;
export const HAND_SIZE = 27; // 108 ÷ 4 家

// ── 掼蛋判型 config（t3-hand-pattern 消费·gdd §2.2 牌型闭集 T1~T8 + 压制序）─────────
// 压制序（跨型）：天王炸(9) ＞ 10张炸(8)…6张炸(4) ＞ 同花顺(3) ＞ 5张炸(2) ＞ 4张炸(1) ＞ 普通型(0)。
// 级牌：levelRank 重映射到 A 之上王之下；红桃级牌=逢人配（wild·可替除王外任意牌·gdd R5）。
export function guandanConfig(levelRank: number): HandPatternConfig {
  return {
    levelRank,
    jokerRanks: [RANK_SMALL_JOKER, RANK_BIG_JOKER],
    wild: { suit: SUIT_HEART, rank: levelRank },
    families: [
      { name: 'single', kind: 'ntuple', composition: [1], tier: 0 }, // T1 单张
      { name: 'pair', kind: 'ntuple', composition: [2], tier: 0 }, // T1 对子
      { name: 'triple', kind: 'ntuple', composition: [3], tier: 0 }, // T1 三同张
      { name: 'full', kind: 'ntuple', composition: [3, 2], tier: 0 }, // T2 三带二（比三张部）
      { name: 'straight', kind: 'sequence', runLen: 5, tier: 0 }, // T3 顺子
      { name: 'tube', kind: 'tuple-sequence', groupSize: 2, runLen: 3, tier: 0 }, // T4 三连对·木板
      { name: 'plate', kind: 'tuple-sequence', groupSize: 3, runLen: 2, tier: 0 }, // T5 钢板·二连三
      {
        name: 'bomb', // T6 炸弹 4~10 张（先比张数再比点）
        kind: 'ntuple',
        n: { min: 4, max: 10 },
        tier: { byLength: { 4: 1, 5: 2, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8 } },
        compare: 'byLenThenRank',
      },
      { name: 'straight-flush', kind: 'flush-sequence', runLen: 5, suited: true, tier: 3 }, // T7 同花顺
      {
        name: 'sky', // T8 四大天王（双大王+双小王）
        kind: 'fixed-set',
        cards: [
          { rank: RANK_SMALL_JOKER, count: 2 },
          { rank: RANK_BIG_JOKER, count: 2 },
        ],
        tier: 9,
      },
    ],
  };
}

// ── 座次与人设（gdd R2 + characters.md·名字/标签可 owner 改口，结构不变）────────────
export interface SeatSpec {
  id: 'hero' | 'partner' | 'west' | 'east';
  name: string;
  team: 0 | 1; // 0=我方（主角+对家），1=对方
  kind: 'hero' | 'ai';
  traits?: readonly string[]; // 性格标签 → AI 行为风格权重（S4 BT 数据消费）
  wardrobe?: readonly string[]; // 服饰阶梯 5 档（盛→简·底线档非裸露=内容红线 A-006）
}
export const SEATS: readonly SeatSpec[] = [
  { id: 'hero', name: '你', team: 0, kind: 'hero' },
  {
    id: 'partner',
    name: '沈玉薇',
    team: 0,
    kind: 'ai',
    traits: ['沉稳', '护家'],
    wardrobe: ['酒红丝绒晚礼服', '立领改良旗袍裙', '真丝衬衫长裙', '吊带长裙', '缎面吊带披肩'],
  },
  {
    id: 'west',
    name: '林曼笙',
    team: 1,
    kind: 'ai',
    traits: ['锋利', '好胜'],
    wardrobe: ['黑金开衩晚装', '西装裙套装', '针织衫皮裙', '露肩上衣短裙', '抹胸短裤'],
  },
  {
    id: 'east',
    name: '顾念念',
    team: 1,
    kind: 'ai',
    traits: ['跳脱', '爱起哄'],
    wardrobe: ['亮片小礼服', '奶茶色针织连衣裙', '卫衣百褶裙', '背心热裤', '运动风内搭短裤'],
  },
];
export const DRESS_TIERS = 5; // 服饰阶梯档数（run 开局回满·gdd §3）

// ── 经济（gdd §4·弱压力）────────────────────────────────────────────────────────
export const INITIAL_FUNDS = 10_000; // 生涯钱包初值
export const STAKES: readonly number[] = [100, 500, 2000]; // 底注档
export const BUYIN_MULT = 20; // 带入 = 底注×20
export const RESULT_MULTS = { doubleWin: 3, firstThird: 2, firstFourth: 1 } as const; // 双上/一三/一四
export const BONUS_RESIST_MULT = 1; // 抗贡成功 +1 倍
export const BONUS_SKY_MULT = 1; // 天王炸终结本盘 +1 倍
export const ROUND_MULT_CAP = 5; // 单盘封顶 ×5
export const DRESS_OUT_MONEY_MULT = 2; // 底线档后金钱罚 ×2

// ── 级数（gdd R3/§2.4）─────────────────────────────────────────────────────────
export const LEVEL_START = 2; // 两队各自从 2 打起
export const LEVEL_ACE = RANK_ACE; // 打过 A 触发 run 终局
export const LEVEL_UPS = { doubleWin: 3, firstThird: 2, firstFourth: 1 } as const; // 头游队升级步长

// ── AI 分档（gdd §5·数据表·S4 BT 消费；宗师偷看 UI 明示=公平告知）───────────────────
export interface AiTierSpec {
  id: 'l1' | 'l2' | 'l3' | 'l4';
  name: string;
  memory: 'none' | 'big-cards' | 'full';
  peek: number; // 开局偷看每对手牌数（仅宗师 2）
}
export const AI_TIERS: readonly AiTierSpec[] = [
  { id: 'l1', name: '雏鸟', memory: 'none', peek: 0 },
  { id: 'l2', name: '常客', memory: 'big-cards', peek: 0 },
  { id: 'l3', name: '老手', memory: 'full', peek: 0 },
  { id: 'l4', name: '宗师', memory: 'full', peek: 2 },
];
