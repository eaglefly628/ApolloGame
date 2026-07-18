// Game A ·《掼蛋夜宴》—— S3 骨架关走查：牌库完整性 · 掼蛋 config 判型冒烟（t3-hand-pattern 消费）·
// 蓝图真装载空跑（「能存必须能跑」编译期等价）· UI 骨架 LayoutNode 零 issue。
// 淮安全套 conformance 全量在引擎 hand-pattern.test（36 测）——这里只验 game-a 自带 config 数据的正确性。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { matchPattern, beats, legalResponses } from '@skills/tier3/index.js';
import type { Card, GameFlow, Resource, CardPile, Flag } from '@engine/protocol/components.js';
import { validateLayoutNode } from '@ui/components/index.js';
import {
  buildDeck108, guandanConfig, cardCode, codeRank, codeSuit, sortHand,
  SEATS, DECK_SIZE, RANK_SMALL_JOKER, RANK_BIG_JOKER, SUIT_HEART, INITIAL_FUNDS, DRESS_TIERS,
} from './rules.js';
import { buildTableBlueprint } from './blueprint.js';
import { buildMenu, buildTableSelect, buildPlay, buildResult, buildGameMenu, type SeatView } from './hud.js';
import { cardAssetId } from './theme.js';
import { pickLead } from './ai.js';

const c = (suit: number, rank: number): Card => ({ suit, rank });

describe('Game A ·《掼蛋夜宴》骨架关（S3）', () => {
  // ── 牌库数据（gdd R1：两副含王 108 张）────────────────────────────────────────
  it('牌库 108 张：四花色×13 点各 2 张 + 大小王各 2 张', () => {
    const deck = buildDeck108();
    expect(deck.length).toBe(DECK_SIZE);
    const count = new Map<number, number>();
    for (const code of deck) count.set(code, (count.get(code) ?? 0) + 1);
    for (let suit = 0; suit <= 3; suit++) {
      for (let rank = 2; rank <= 14; rank++) expect(count.get(cardCode(suit, rank))).toBe(2);
    }
    expect(count.get(cardCode(0, RANK_SMALL_JOKER))).toBe(2);
    expect(count.get(cardCode(0, RANK_BIG_JOKER))).toBe(2);
    expect(count.size).toBe(54); // 去重后恰 54 种
  });

  // ── 掼蛋 config（gdd §2.2·喂引擎 t3-hand-pattern·禁游戏层自写判型）───────────────
  it('判型冒烟：级牌参数化 + 三带二/钢板/炸弹族/天王炸', () => {
    const cfg = guandanConfig(7); // 打 7：级牌=7
    expect(matchPattern([c(0, 7)], cfg)).toMatchObject({ family: 'single', rank: 15 }); // 级牌单抬到 A 上
    expect(matchPattern([c(0, 9), c(1, 9), c(2, 9), c(0, 5), c(1, 5)], cfg)).toMatchObject({ family: 'full', rank: 9 });
    expect(matchPattern([c(0, 3), c(1, 3), c(2, 3), c(0, 4), c(1, 4), c(2, 4)], cfg)).toMatchObject({ family: 'plate' });
    expect(matchPattern([c(0, 8), c(1, 8), c(2, 8), c(3, 8)], cfg)).toMatchObject({ family: 'bomb', length: 4 });
    expect(
      matchPattern(
        [c(0, RANK_SMALL_JOKER), c(0, RANK_SMALL_JOKER), c(0, RANK_BIG_JOKER), c(0, RANK_BIG_JOKER)],
        cfg,
      ),
    ).toMatchObject({ family: 'sky' });
  });

  // ── 钢板必须点数相邻（owner 2026-07-18 报「888+一对10+2 打出钢板」）──────────────────
  it('钢板点数必须相邻：888+10·10+逢人配 非法拒；888+9·9+逢人配=888-999 合法', () => {
    const cfg = guandanConfig(2); // ♥2=逢人配
    const w = c(SUIT_HEART, 2); // 红桃2 逢人配
    // 8 与 10 不相邻 → 逢人配补不成钢板 → 非法（null）
    expect(matchPattern([c(0, 8), c(1, 8), c(2, 8), c(0, 10), c(1, 10), w], cfg)).toBeNull();
    // 8 与 9 相邻 → 逢人配补第三张 9 → 合法钢板 888-999
    expect(matchPattern([c(0, 8), c(1, 8), c(2, 8), c(0, 9), c(1, 9), w], cfg)).toMatchObject({ family: 'plate', rank: 9 });
    // 纯自然 888-999 也是钢板（对照）
    expect(matchPattern([c(0, 8), c(1, 8), c(2, 8), c(0, 9), c(1, 9), c(2, 9)], cfg)).toMatchObject({ family: 'plate' });
  });

  it('逢人配（红桃级牌）可补顺子缺口；黑桃级牌不是百搭', () => {
    const cfg = guandanConfig(5);
    const straightWithWild = [c(0, 6), c(1, 7), c(2, 8), c(0, 10), c(SUIT_HEART, 5)]; // ♥5 顶缺位 9
    expect(matchPattern(straightWithWild, cfg)?.family).toBe('straight');
    const notWild = [c(0, 6), c(1, 7), c(2, 8), c(0, 10), c(0, 5)]; // ♠5 只能按自然点用 → 缺 9 凑不成
    expect(matchPattern(notWild, cfg)).toBeNull();
    // 级牌按自然点参与顺子仍合法（5-6-7-8-9 天然顺）
    expect(matchPattern([c(0, 5), c(0, 6), c(1, 7), c(2, 8), c(0, 9)], cfg)?.family).toBe('straight');
  });

  it('压制序：天王炸 > 10 张炸 > 同花顺 > 5 张炸 > 4 张炸 > 普通型', () => {
    const cfg = guandanConfig(2);
    const sky = [c(0, RANK_SMALL_JOKER), c(0, RANK_SMALL_JOKER), c(0, RANK_BIG_JOKER), c(0, RANK_BIG_JOKER)];
    const bomb10 = Array.from({ length: 10 }, (_, i) => c(i % 4, 4));
    const flush = [c(1, 5), c(1, 6), c(1, 7), c(1, 8), c(1, 9)];
    const bomb5 = Array.from({ length: 5 }, (_, i) => c(i % 4, 13));
    const bomb4 = Array.from({ length: 4 }, (_, i) => c(i % 4, 14));
    const pairA = [c(0, 14), c(1, 14)];
    expect(beats(sky, bomb10, cfg)).toBe(true);
    expect(beats(bomb10, flush, cfg)).toBe(true);
    expect(beats(flush, bomb5, cfg)).toBe(true);
    expect(beats(bomb5, bomb4, cfg)).toBe(true);
    expect(beats(bomb4, pairA, cfg)).toBe(true); // 炸族跨型压普通型
    expect(beats(pairA, bomb4, cfg)).toBe(false); // 普通型压不了炸族
  });

  it('最小合法压牌（提示按钮语义）：legalResponses 首位', () => {
    const cfg = guandanConfig(2);
    const hand = [c(0, 8), c(1, 8), c(0, 10), c(1, 10), c(0, 13)];
    const target = [c(2, 7), c(3, 7)]; // 对 7
    const first = legalResponses(hand, target, cfg)[0];
    expect(first).toMatchObject({ family: 'pair', rank: 8 }); // 最小能压=对 8
  });

  // ── 领出启发 pickLead（hint 与 AI 领出共用·防单张流退化·owner 2026-07-18 报）──────
  it('领出 pickLead：倾长牌型倒库存·不主动领炸·不拆炸凑牌型', () => {
    const cfg = guandanConfig(2);
    const lead = (codes: number[]): ReturnType<typeof pickLead> =>
      pickLead(legalResponses(codes.map((x) => c(codeSuit(x), codeRank(x))), null, cfg));
    // 顺子(5张) 优先于对子(2张)——最长牌型
    expect(lead([cardCode(0, 5), cardCode(1, 5), cardCode(0, 6), cardCode(1, 7), cardCode(2, 8), cardCode(3, 9), cardCode(0, 10)])?.family).toBe('straight');
    // 三连对(6张) 优先于其中的对子——最长牌型
    expect(lead([cardCode(0, 3), cardCode(1, 3), cardCode(0, 4), cardCode(1, 4), cardCode(0, 5), cardCode(1, 5), cardCode(0, 9)])?.family).toBe('tube');
    // 四张同点=炸 + 散单 → 既不主动领炸、也不拆炸成三张 → 只领最小单张·不碰炸弹牌
    const bombHand = lead([cardCode(0, 6), cardCode(1, 6), cardCode(2, 6), cardCode(3, 6), cardCode(0, 8), cardCode(0, 10), cardCode(0, 12)]);
    expect(bombHand?.family).toBe('single');
    expect(bombHand?.cards.every((cc) => cc.rank !== 6)).toBe(true); // 炸弹的 4 张 6 未被拆
    // 残局只剩炸 → 兜底用炸收尾（出光）
    expect(lead([cardCode(0, 7), cardCode(1, 7), cardCode(2, 7), cardCode(3, 7)])?.family).toBe('bomb');
    expect(pickLead([])).toBeNull(); // 空候选
  });

  // ── 蓝图真装载（机器门语义：引擎吃得下 + 空跑 2 tick）───────────────────────────
  it('牌桌蓝图装载 + 空跑：flow boot→table-idle · 资源/牌堆/闸就位', () => {
    const e = new Engine();
    e.load(buildTableBlueprint({ seed: 42 }));
    const w = e.world;
    const flowOf = (): string => w.getComponent<GameFlow>('flow', 'GameFlow')!.current;
    expect(flowOf()).toBe('boot');
    w.tick();
    w.tick();
    w.tick();
    expect(flowOf()).toBe('table-idle'); // after:2 过渡触发（骨架活着）
    // 庄桌全牌未发·四家空手
    const dealer = w.getComponent<CardPile>('pile-dealer', 'CardPile')!;
    expect(dealer.deck.length).toBe(DECK_SIZE);
    for (const seat of SEATS) {
      const p = w.getComponent<CardPile>(`pile-${seat.id}`, 'CardPile')!;
      expect(p.hand.length).toBe(0);
    }
    // run 状态资源
    const res = (id: string): number => {
      for (const [eid] of w.query('Resource')) {
        const r = w.getComponent<Resource>(eid, 'Resource');
        if (r?.id === id) return r.current;
      }
      return -1;
    };
    expect(res('wallet')).toBe(INITIAL_FUNDS);
    expect(res('level-ours')).toBe(2);
    expect(res('level-theirs')).toBe(2);
    for (const seat of SEATS) expect(res(`dress-${seat.id}`)).toBe(DRESS_TIERS);
    // 输入闸关死（S4 出牌轮开闸）
    expect(w.getComponent<Flag>('can-act', 'Flag')!.active).toBe(false);
  });

  // ── AI 黑板接线（owner 2026-07-18 报「AI 全程最小单张」根因回归）──────────────────
  // chooseTurn 经 setFlag/setRes 刷 bb-* → BT 叶按 id 读；缺这些实体则 setFlag 空找、BT 恒落 move:min。
  it('AI 黑板 bb-* Flag/Resource 在世界（BT 策略树非空转）', () => {
    const e = new Engine();
    e.load(buildTableBlueprint({ seed: 42 }));
    const w = e.world;
    const flagIds = new Set<string>();
    for (const [eid] of w.query('Flag')) { const f = w.getComponent<Flag>(eid, 'Flag'); if (f) flagIds.add(f.id); }
    for (const id of ['bb-leading', 'bb-partner-winning', 'bb-only-bomb', 'bb-endgame']) expect(flagIds.has(id)).toBe(true);
    let aggr: Resource | null = null;
    for (const [eid] of w.query('Resource')) { const r = w.getComponent<Resource>(eid, 'Resource'); if (r?.id === 'bb-aggression') aggr = r; }
    expect(aggr).not.toBeNull();
    expect(aggr!.max).toBe(100);
  });

  it('同种子双跑同世界（确定性冒烟）', () => {
    const snap = (): string => {
      const e = new Engine();
      e.load(buildTableBlueprint({ seed: 7 }));
      for (let i = 0; i < 5; i++) e.world.tick();
      const dealer = e.world.getComponent<CardPile>('pile-dealer', 'CardPile')!;
      return JSON.stringify([dealer.deck, e.world.getComponent<GameFlow>('flow', 'GameFlow')!.current]);
    };
    expect(snap()).toBe(snap());
  });

  // ── UI 菜单 + 选桌屏（LayoutNode 纯数据·零 issue；牌桌/结算屏在下方 S4 用例）──────
  it('菜单壳 + 选桌屏（各难度）过 validateLayoutNode', () => {
    expect(validateLayoutNode(buildMenu({ wallet: 12860, level: 2, showMenu: false, menuTab: 'log' }))).toEqual([]);
    expect(validateLayoutNode(buildMenu({ wallet: 12860, level: 2, showMenu: true, menuTab: 'rules' }))).toEqual([]); // 设置浮层开
    for (const d of ['l1', 'l2', 'l3', 'l4'] as const) {
      for (const stake of [100, 500, 2000]) {
        expect(validateLayoutNode(buildTableSelect({ difficulty: d, stake, wallet: 10000 }))).toEqual([]);
      }
    }
  });

  // ── S4 玩法屏/结算屏 UI（LayoutNode 纯数据·零 issue）────────────────────────────
  it('可玩牌桌屏与结算浮层过 validateLayoutNode', () => {
    const sv = (id: SeatView['seat']['id']): SeatView => ({ seat: SEATS.find((s) => s.id === id)!, cards: 27, dress: DRESS_TIERS });
    const play = buildPlay({
      round: 1, stake: 100, levelPlay: 2, levelOurs: 2, levelTheirs: 2, wallet: INITIAL_FUNDS,
      turn: 'hero', turnName: '你',
      seats: { partner: sv('partner'), west: sv('west'), east: sv('east'), hero: sv('hero') },
      hand: [cardCode(0, 3), cardCode(1, 3), cardCode(0, 7), cardCode(2, 14), cardCode(0, RANK_BIG_JOKER)],
      selected: [0, 1], // 选中前两张（下标·非牌码）
      trick: { name: '对子', family: 'pair', cards: [cardCode(2, 2), cardCode(3, 2)], holder: 'west', holderName: '林曼笙', holderTeam: 1 },
      canCommit: true, commitWhy: '', canPass: true, sortMode: 'rank', tributeText: null, showCounter: false, counter: [],
      showMenu: false, menuTab: 'log', logRows: [], tierName: '常客',
      plays: { west: { cards: [cardCode(2, 2), cardCode(3, 2)], pass: false }, partner: { cards: [], pass: true } },
    });
    expect(validateLayoutNode(play)).toEqual([]);
    // 领出态（无墩）+ AI 轮次
    const lead = buildPlay({
      round: 2, stake: 100, levelPlay: 2, levelOurs: 3, levelTheirs: 2, wallet: 12000,
      turn: 'west', turnName: '林曼笙',
      seats: { partner: sv('partner'), west: sv('west'), east: sv('east'), hero: sv('hero') },
      hand: [cardCode(0, 5)], selected: [], trick: null, canCommit: false, commitWhy: '点牌选中 · 出牌或过', canPass: false, sortMode: 'family', tributeText: '抗贡成功 · 双大王免进贡 · 头游先出', showCounter: true, counter: [{ rank: 'A', played: 3, total: 8 }],
      showMenu: true, menuTab: 'rules', logRows: [{ round: 2, who: '林曼笙', act: '领出', cards: '♠5', fam: '单张' }], tierName: '宗师',
      plays: {},
    });
    expect(validateLayoutNode(lead)).toEqual([]);
    for (const phase of ['settled', 'run-won', 'run-lost'] as const) {
      const res = buildResult({
        ranking: [
          { seat: 'hero', name: '你', team: 0 }, { seat: 'partner', name: '沈玉薇', team: 0 },
          { seat: 'west', name: '林曼笙', team: 1 }, { seat: 'east', name: '顾念念', team: 1 },
        ],
        winnersTeam: 0, comboLabel: '双上 ×3', totalMult: 3, payPerPlayer: 300,
        levelAfter: [5, 2], dressOutDoubled: false, phase,
      });
      expect(validateLayoutNode(res)).toEqual([]);
    }
  });

  // ── 游戏内菜单（☰·出牌日志/规则说明/设置·owner 2026-07-18）过 validateLayoutNode ─────────
  it('游戏内菜单三页（日志/规则/设置）纯数据·零 issue', () => {
    for (const tab of ['log', 'rules', 'settings'] as const) {
      const menu = buildGameMenu({
        menuTab: tab,
        logRows: [
          { round: 3, who: '顾念念', act: '领出', cards: '♥4 ♥4 ♣4 ♠5 ♠5 ♥5', fam: '钢板' },
          { round: 3, who: '你', act: '过', cards: '—', fam: '—' },
        ],
        tierName: '常客', levelPlay: 2, stake: 100, wallet: 10000, sortMode: 'rank',
      });
      expect(validateLayoutNode(menu)).toEqual([]);
    }
    // 空日志（本盘还没出牌）也零 issue
    expect(validateLayoutNode(buildGameMenu({ menuTab: 'log', logRows: [], tierName: '雏鸟', levelPlay: 2, stake: 500, wallet: 200000, sortMode: 'family' }))).toEqual([]);
  });

  // ── 理牌排序（视图·纯函数·不碰 sim）────────────────────────────────────────────
  it('理牌 sortHand：按点数升序（级牌抬到 A 上王下）/ 按牌型同点聚组张数降序', () => {
    // 打 7：♥7=级牌抬高。牌 = 3,3,7(级),9,大王,炸4×5
    const codes = [
      cardCode(0, 9), cardCode(1, 3), cardCode(0, 3), cardCode(1, 7), cardCode(0, RANK_BIG_JOKER),
      cardCode(0, 5), cardCode(1, 5), cardCode(2, 5), cardCode(3, 5),
    ];
    const byRank = sortHand(codes, 'rank', 7).map(codeRank);
    // 升序：3,3,5,5,5,5,9,7(级=A上),大王 → 级牌7排在9之后、王之前
    expect(byRank[0]).toBe(3);
    expect(byRank[byRank.length - 1]).toBe(RANK_BIG_JOKER); // 大王最后
    expect(byRank.indexOf(7)).toBeGreaterThan(byRank.indexOf(9)); // 级牌7 抬到 9 之后
    // 按牌型：炸弹（4×5）聚最前（张数最多）
    const byFam = sortHand(codes, 'family', 7);
    expect(byFam.slice(0, 4).map(codeRank)).toEqual([5, 5, 5, 5]); // 4 张 5 组在最前
    expect(byFam.length).toBe(codes.length); // 不丢牌
  });

  // ── 牌码 → 资产 id 映射抽查（全量对账在 vendor.test）────────────────────────────
  it('牌码资产 id 映射：点数花色/双王', () => {
    expect(cardAssetId(cardCode(0, 14))).toBe('card/ace-of-spades');
    expect(cardAssetId(cardCode(1, 10))).toBe('card/ten-of-hearts');
    expect(cardAssetId(cardCode(3, 2))).toBe('card/two-of-clubs');
    expect(cardAssetId(cardCode(0, RANK_SMALL_JOKER))).toBe('card/joker-black');
    expect(cardAssetId(cardCode(0, RANK_BIG_JOKER))).toBe('card/joker-red');
    expect(codeRank(cardCode(2, 11))).toBe(11);
    expect(codeSuit(cardCode(2, 11))).toBe(2);
  });
});
