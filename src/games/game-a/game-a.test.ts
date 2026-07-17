// Game A ·《掼蛋夜宴》—— S3 骨架关走查：牌库完整性 · 掼蛋 config 判型冒烟（t3-hand-pattern 消费）·
// 蓝图真装载空跑（「能存必须能跑」编译期等价）· UI 骨架 LayoutNode 零 issue。
// 淮安全套 conformance 全量在引擎 hand-pattern.test（36 测）——这里只验 game-a 自带 config 数据的正确性。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { matchPattern, beats, legalResponses } from '@skills/tier3/index.js';
import type { Card, GameFlow, Resource, CardPile, Flag } from '@engine/protocol/components.js';
import { validateLayoutNode } from '@ui/components/index.js';
import {
  buildDeck108, guandanConfig, cardCode, codeRank, codeSuit,
  SEATS, DECK_SIZE, RANK_SMALL_JOKER, RANK_BIG_JOKER, SUIT_HEART, INITIAL_FUNDS, DRESS_TIERS,
} from './rules.js';
import { buildTableBlueprint } from './blueprint.js';
import { buildMenu, buildTable, type TableView, type SeatView } from './hud.js';
import { cardAssetId } from './theme.js';

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

  // ── UI 骨架（LayoutNode 纯数据·零 issue）─────────────────────────────────────
  it('菜单壳与牌桌骨架屏过 validateLayoutNode', () => {
    expect(validateLayoutNode(buildMenu())).toEqual([]);
    const sv = (id: SeatView['seat']['id']): SeatView => ({
      seat: SEATS.find((s) => s.id === id)!,
      cards: 0,
      dress: DRESS_TIERS,
    });
    const view: TableView = {
      wallet: INITIAL_FUNDS, stake: 100, round: 1, levelOurs: 2, levelTheirs: 2,
      flowState: 'table-idle', deckCount: DECK_SIZE,
      partner: sv('partner'), west: sv('west'), east: sv('east'), hero: sv('hero'),
    };
    expect(validateLayoutNode(buildTable(view))).toEqual([]);
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
