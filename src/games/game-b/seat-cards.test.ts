// Game B ·《雀宴》—— 角色卡消费层走查（REQ-CHARCARD·seat-cards.ts·照 character-card.md §⑤）。
// 覆盖：默认卡可用性 · 成年硬闸回退（姨太题材 requireAdult 必开）· 平台覆盖 · toSeatCard 投影 +
//   resolveOssKey 头像 · seatFlavor 截断 · buildSessionOut 键控 card.id + passthrough 回带 · 纯确定性。
// 服务本身的收敛/取优全量在 services/character-card 测（这里只验 game-b 侧接入正确）。
import { describe, it, expect } from 'vitest';
import { normalizeCharacterCard, isCardUsable } from '../../services/character-card/index.js';
import {
  DEFAULT_SEAT_DRAFTS, resolveSeatCards, seatDisplay, seatNamesFrom, seatFlavor, buildSessionOut,
  SEAT_IDS, SEAT_INDEX, type SeatId, type SeatOutcome,
} from './seat-cards.js';

describe('Game B · 角色卡消费层（REQ-CHARCARD）', () => {
  // (a) 四席默认卡全可用·名字=现有四席名（显示零变·守既有测基线）─────────────────────────
  it('四席默认卡全可用·名字=主角/绫/莉世/小夜·座序喂 startMatch', () => {
    const cards = resolveSeatCards();
    expect(cards.hero.name).toBe('主角');
    expect(cards.daiyi.name).toBe('绫');
    expect(cards.eryi.name).toBe('莉世');
    expect(cards.sanyi.name).toBe('小夜');
    expect(seatNamesFrom(cards)).toEqual(['主角', '绫', '莉世', '小夜']); // core startMatch(seed, seatNames) 座序
    for (const id of SEAT_IDS) {
      expect(isCardUsable(normalizeCharacterCard(DEFAULT_SEAT_DRAFTS[id], { id, requireAdult: true }))).toBe(true);
      expect(cards[id].id).toBe(id);                 // opts.id 优先 → card.id 恒=席位 id
      expect(cards[id].adultConfirmed).toBe(true);   // 成年确认
    }
  });

  // (b) 成年硬闸（姨太题材必开 requireAdult）：未确认 → 回退内置默认卡 ─────────────────────
  it('成年硬闸：adultConfirmed!=true → 回退默认卡（非冒名者）·确认卡则用之', () => {
    const bad = resolveSeatCards({ seats: { daiyi: { name: '冒名姨', adultConfirmed: false } } });
    expect(bad.daiyi.name).toBe('绫');    // 未过成年闸 → 回退默认
    expect(bad.eryi.name).toBe('莉世');   // 其余席不受影响
    const missing = resolveSeatCards({ seats: { sanyi: { name: '无确认' } } }); // adultConfirmed 缺省
    expect(missing.sanyi.name).toBe('小夜');
    const ok = resolveSeatCards({ seats: { daiyi: { name: '红叶', adultConfirmed: true } } });
    expect(ok.daiyi.name).toBe('红叶');   // 成年确认 → 用平台卡
  });

  // (c) 平台覆盖某席·其余保持默认 ────────────────────────────────────────────────────
  it('平台覆盖某席·未覆盖席保持默认·id 恒=席位 id', () => {
    const cards = resolveSeatCards({ seats: { eryi: { name: '雪乃', id: 'x', adultConfirmed: true } } });
    expect(cards.eryi.name).toBe('雪乃');
    expect(cards.eryi.id).toBe('eryi');   // opts.id 优先（无论 draft.id）
    expect(cards.hero.name).toBe('主角');
    expect(cards.sanyi.name).toBe('小夜');
  });

  // (d) toSeatCard 投影 {id,name,avatar?} + resolveOssKey 解头像 ──────────────────────
  it('seatDisplay 投影：默认卡无 avatar·OssKey 经 resolveOssKey 解 url', () => {
    expect(seatDisplay(resolveSeatCards().daiyi)).toEqual({ id: 'daiyi', name: '绫' }); // 无媒体=无 avatar 键
    const withOss = resolveSeatCards({
      seats: { eryi: { name: '莉世', adultConfirmed: true, avatarOssKey: 'oss/lishi' } },
      resolveOssKey: (k) => `https://cdn/${k}`,
    });
    expect(seatDisplay(withOss.eryi)).toEqual({ id: 'eryi', name: '莉世', avatar: 'https://cdn/oss/lishi' });
  });

  // (e) seatFlavor：opening 优先·退 catchphrase·超长截断（外部不可信输入）────────────────
  it('seatFlavor：取 opening（退 catchphrase / 空串）·超长裁 max+…', () => {
    const mk = (d: Parameters<typeof normalizeCharacterCard>[0]): ReturnType<typeof normalizeCharacterCard>['card'] =>
      normalizeCharacterCard(d, { requireAdult: true }).card;
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true, opening: '短句问候' }))).toBe('短句问候');
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true, catchphrases: ['口头禅'] }))).toBe('口头禅'); // 退 catchphrase
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true }))).toBe('');                                 // 皆无 → 空串
    const long = 'あ'.repeat(50);
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true, opening: long }), 8)).toBe('あ'.repeat(8) + '…');
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true, opening: long }), 8).length).toBe(9);
    for (const id of SEAT_IDS) expect(seatFlavor(resolveSeatCards()[id]).endsWith('…')).toBe(false); // 默认卡不截
  });

  // (f) buildSessionOut：以 card.id 键控·passthrough 逐字回带 ─────────────────────────
  it('buildSessionOut：键控 card.id·carrying passthrough 逐字回带', () => {
    const custom = normalizeCharacterCard(
      { name: '定制', id: 'card-XYZ', adultConfirmed: true, tattoo: '樱纹', moreSettings: { a: 1 } },
      { requireAdult: true },
    ).card;
    expect(custom.id).toBe('card-XYZ');
    expect(custom.passthrough).toEqual({ tattoo: '樱纹', moreSettings: { a: 1 } }); // 未消费字段 → passthrough
    const cards = resolveSeatCards();
    cards.daiyi = custom; // daiyi 席换成自定义卡（id≠席位 id）
    const outcomes = {} as Record<SeatId, SeatOutcome>;
    for (const id of SEAT_IDS) outcomes[id] = { rank: SEAT_INDEX[id] + 1, score: 50000 - SEAT_INDEX[id] * 1000, stripped: SEAT_INDEX[id] };
    const out = buildSessionOut(cards, outcomes);
    expect(Object.keys(out).sort()).toEqual(['card-XYZ', 'eryi', 'hero', 'sanyi']); // daiyi→card-XYZ·余=席位 id
    expect(out['card-XYZ']).toEqual({ seatId: 'daiyi', rank: 2, score: 49000, stripped: 1, passthrough: { tattoo: '樱纹', moreSettings: { a: 1 } } });
    expect(out.hero.rank).toBe(1);
    expect(out.sanyi.stripped).toBe(3);
  });

  // (g) 纯确定性：同输入两跑深等 ─────────────────────────────────────────────────────
  it('确定性：resolveSeatCards 同输入两跑深等（无时钟/随机）', () => {
    expect(resolveSeatCards()).toEqual(resolveSeatCards());
    const sin = { seats: { eryi: { name: '莉世', adultConfirmed: true }, daiyi: { name: 'x', adultConfirmed: false } } };
    expect(resolveSeatCards(sin)).toEqual(resolveSeatCards(sin));
  });
});
