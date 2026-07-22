// Game A ·《掼蛋夜宴》—— 角色卡消费层走查（REQ-CHARCARD·seat-cards.ts）。
// 覆盖：默认卡可用性 · 成年硬闸回退 · 平台覆盖 · toSeatCard 投影 · seatFlavor 截断 ·
//   buildSessionOut 键控 card.id + passthrough 回带 · 纯确定性（同输入深等）。
// 服务本身的收敛/取优全量在 services/character-card 测（这里只验 game-a 侧接入正确）。
import { describe, it, expect, afterEach } from 'vitest';
import { normalizeCharacterCard, isCardUsable } from '../../services/character-card/index.js';
import { SEATS } from './rules.js';
import { type SeatId } from './guandan-session.js';
import {
  DEFAULT_SEAT_DRAFTS,
  resolveSeatCards,
  seatDisplay,
  seatFlavor,
  seatPortrait,
  SEAT_PORTRAIT_SLOT,
  buildSessionOut,
  type GameASessionIn,
  type SeatOutcome,
} from './seat-cards.js';
import { registerArtOverrides, clearArtOverridesForTest } from './art-overrides.js';

const ALL_IDS = ['hero', 'partner', 'west', 'east'] as const;

describe('Game A · 角色卡消费层（REQ-CHARCARD）', () => {
  // (a) 四席默认卡全可用·产出具名规范卡 ──────────────────────────────────────────
  it('四席默认卡全可用·名字与 SEATS 一致（hero=夜阑君·AI 席=原名）', () => {
    const cards = resolveSeatCards();
    expect(cards.hero.name).toBe('夜阑君'); // 代词「你」的本地化在 displayName·此处=玩家人格名
    expect(cards.partner.name).toBe('沈玉薇');
    expect(cards.west.name).toBe('林曼笙');
    expect(cards.east.name).toBe('顾念念');
    // AI 席默认名必须 === SEATS 原名（否则牌桌显示漂移·破坏既有 59 测基线）
    for (const s of SEATS) if (s.kind === 'ai') expect(cards[s.id].name).toBe(s.name);
    // 每张默认草稿经成年硬闸仍 isCardUsable（零 error）·id=席位 id·adultConfirmed 真
    for (const id of ALL_IDS) {
      expect(isCardUsable(normalizeCharacterCard(DEFAULT_SEAT_DRAFTS[id], { id, requireAdult: true }))).toBe(true);
      expect(cards[id].id).toBe(id);
      expect(cards[id].adultConfirmed).toBe(true);
    }
  });

  // (b) 成年硬闸：平台草稿未过闸 → 回退默认卡 ────────────────────────────────────
  it('成年硬闸：adultConfirmed:false / 缺失 → 回退默认卡（名=默认·不冒名入局）', () => {
    const cardsFalse = resolveSeatCards({ seats: { partner: { name: '冒名者', adultConfirmed: false } } });
    expect(cardsFalse.partner.name).toBe('沈玉薇'); // 回退·非「冒名者」
    expect(cardsFalse.west.name).toBe('林曼笙'); // 其余席不受影响
    // adultConfirmed 缺省（undefined）同样不过闸 → 回退
    const cardsMissing = resolveSeatCards({ seats: { east: { name: '无确认' } } });
    expect(cardsMissing.east.name).toBe('顾念念');
  });

  // (c) 可用平台草稿覆盖默认（自定义名胜出）──────────────────────────────────────
  it('可用平台草稿覆盖默认：自定义名胜出·id 仍=席位 id（对账键稳定）', () => {
    const cards = resolveSeatCards({ seats: { west: { name: '新对手', adultConfirmed: true } } });
    expect(cards.west.name).toBe('新对手');
    expect(cards.west.id).toBe('west'); // opts.id 优先→id 恒=席位 id（无论 draft.id）
    expect(cards.partner.name).toBe('沈玉薇'); // 未覆盖席保持默认
  });

  // (d) toSeatCard 投影形状 {id,name,avatar?} ────────────────────────────────────
  it('seatDisplay/toSeatCard 投影：默认卡无 avatar·带头像平台卡取头像 url', () => {
    expect(seatDisplay(resolveSeatCards().partner)).toEqual({ id: 'partner', name: '沈玉薇' }); // 无媒体=无 avatar 键
    const withAvatar = resolveSeatCards({ seats: { east: { name: '念念', adultConfirmed: true, avatarUrl: 'https://x/a.png' } } });
    expect(seatDisplay(withAvatar.east)).toEqual({ id: 'east', name: '念念', avatar: 'https://x/a.png' });
  });

  // (e) seatFlavor：opening 优先·退 catchphrase·超长截断 max+'…' ──────────────────
  it('seatFlavor：取 opening（退 catchphrase / 空串）·超长截断到 max 字 + …', () => {
    const mk = (draft: Parameters<typeof normalizeCharacterCard>[0]) =>
      normalizeCharacterCard(draft, { requireAdult: true }).card;
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true, opening: '短句问候' }))).toBe('短句问候');
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true, catchphrases: ['口头禅一', '口头禅二'] }))).toBe('口头禅一'); // 无 opening 退首句
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true }))).toBe(''); // 皆无 → 空串
    // 超长（外部不可信输入）→ 裁到 max 字 + 省略号
    const long = 'あ'.repeat(50);
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true, opening: long }), 8)).toBe('あ'.repeat(8) + '…');
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true, opening: long }), 8).length).toBe(9);
    // 恰好 max 不截
    expect(seatFlavor(mk({ name: 'X', adultConfirmed: true, opening: 'b'.repeat(8) }), 8)).toBe('b'.repeat(8));
    // 默认卡 opening 均在默认 max(24) 内（不被截·牌桌闲时气泡完整显）
    for (const id of ALL_IDS) expect(seatFlavor(resolveSeatCards()[id]).endsWith('…')).toBe(false);
  });

  // (f) buildSessionOut：以 card.id 键控·passthrough 原样回带 ──────────────────────
  it('buildSessionOut：键控 card.id·carrying passthrough 逐字回带', () => {
    // 自定义卡 id≠席位 id + 未消费字段 → 验证「键控 card.id」与「passthrough 回带」
    const custom = normalizeCharacterCard(
      { name: '定制', id: 'card-XYZ', adultConfirmed: true, tattoo: '龙纹', moreSettings: { a: 1 } },
      { requireAdult: true },
    ).card;
    expect(custom.id).toBe('card-XYZ');
    expect(custom.passthrough).toEqual({ tattoo: '龙纹', moreSettings: { a: 1 } });

    const cards = resolveSeatCards();
    cards.partner = custom; // partner 席换成自定义卡
    const outcomes: Record<SeatId, SeatOutcome> = {
      hero: { rank: 1, team: 0 }, partner: { rank: 2, team: 0 },
      west: { rank: 3, team: 1 }, east: { rank: 4, team: 1 },
    };
    const out = buildSessionOut(cards, outcomes);
    // 键 = 各 card.id（partner→'card-XYZ'·其余默认→席位 id）
    expect(Object.keys(out).sort()).toEqual(['card-XYZ', 'east', 'hero', 'west']);
    expect(out['card-XYZ']).toEqual({ seatId: 'partner', rank: 2, team: 0, passthrough: { tattoo: '龙纹', moreSettings: { a: 1 } } });
    expect(out.hero.rank).toBe(1);
    expect(out.east.team).toBe(1);
    expect(out['card-XYZ'].passthrough).toEqual(custom.passthrough); // 逐字回带
  });

  // (g) 纯确定性：同输入两跑深等 ─────────────────────────────────────────────────
  it('确定性：resolveSeatCards 同输入两跑深等（无时钟/随机）', () => {
    expect(resolveSeatCards()).toEqual(resolveSeatCards());
    const sin: GameASessionIn = {
      seats: { west: { name: '甲', adultConfirmed: true }, partner: { name: '乙', adultConfirmed: false } },
    };
    expect(resolveSeatCards(sin)).toEqual(resolveSeatCards(sin));
  });
});

// (h) seatPortrait 立绘三级链（owner 2026-07-22：对手立绘·传入>默认>空不画）──────────
describe('Game A · 对手立绘三级链（seatPortrait·owner 2026-07-22）', () => {
  afterEach(clearArtOverridesForTest);

  it('三 AI 席默认立绘槽 skinKey = game-a/portrait/<seat>（对齐美术台账 rows）', () => {
    expect(SEAT_PORTRAIT_SLOT).toEqual({
      partner: 'game-a/portrait/partner',
      west: 'game-a/portrait/west',
      east: 'game-a/portrait/east',
    });
    expect(SEAT_PORTRAIT_SLOT.hero).toBeUndefined(); // hero=玩家自己·无默认立绘
  });

  it('① 平台卡传入头像最高优先（"传进来就替代默认"）', () => {
    registerArtOverrides({ 'game-a/portrait/east': '/games/game-a/art/portrait/east.png' }); // 已有默认
    const withAvatar = resolveSeatCards({ seats: { east: { name: '念念', adultConfirmed: true, avatarUrl: 'https://x/passed.png' } } });
    expect(seatPortrait('east', withAvatar.east)).toBe('https://x/passed.png'); // 传入胜出·非默认
  });

  it('② 无传入 + 注册了默认立绘 → 用默认（"不传就用这三个默认"·工坊/index 命中）', () => {
    registerArtOverrides({ 'game-a/portrait/partner': '/games/game-a/art/portrait/partner.png' });
    expect(seatPortrait('partner', resolveSeatCards().partner)).toBe('/games/game-a/art/portrait/partner.png');
  });

  it('③ 无传入 + 无默认 → undefined（"空的话就不画"·Avatar 退首字铭牌·永不裂图）', () => {
    expect(seatPortrait('west', resolveSeatCards().west)).toBeUndefined();
    expect(seatPortrait('hero', resolveSeatCards().hero)).toBeUndefined(); // hero 无槽·恒空
  });

  it('确定性：同输入同覆盖两跑深等（artOverride 读注册表·无时钟/随机）', () => {
    registerArtOverrides({ 'game-a/portrait/west': '/w.png' });
    const cards = resolveSeatCards();
    expect(seatPortrait('west', cards.west)).toBe(seatPortrait('west', cards.west));
  });
});
