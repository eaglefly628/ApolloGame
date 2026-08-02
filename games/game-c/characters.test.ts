import { describe, it, expect } from 'vitest';
import { resolveSeatCharacters, personaFlavor, buildSessionOut, type GameCSessionIn } from './characters.js';
import type { PlatformCharacterDraft } from '@services/character-card/index.js';

// REQ-CHARCARD 接线（手册 docs/playbooks/character-card.md §⑤）：SessionIn 席位草稿 → 席位卡 + persona + SessionOut。
describe('game-c 角色卡接线（REQ-CHARCARD·§⑤）', () => {
  it('无草稿 → 全退内置默认卡（座 1..N-1·id=builtin·名=剧情默认·fromDraft=false）', () => {
    const cs = resolveSeatCharacters(4, undefined);
    expect(cs.map((c) => c.seat)).toEqual([1, 2, 3]);
    expect(cs.every((c) => !c.fromDraft)).toBe(true);
    expect(cs.every((c) => c.issues.length === 0)).toBe(true);
    expect(cs[0]!.card.id).toBe('builtin-c-1');
    expect(cs[0]!.seatCard.name).toBe('林曼笙'); // STORY_OPPONENTS 座 1 = 中座主（默认名·owner 2026-07-23）
  });

  it('成年硬闸必开：草稿缺 adultConfirmed → 不可用 → 退默认卡（带 error·上报）', () => {
    const draft: PlatformCharacterDraft = { id: 'plat-x', name: '柯岚', /* 无 adultConfirmed */ };
    const cs = resolveSeatCharacters(2, { seats: [draft] });
    expect(cs).toHaveLength(1);
    expect(cs[0]!.fromDraft).toBe(false);                          // 坏卡 → 回退
    expect(cs[0]!.card.id).toBe('builtin-c-1');                    // 用内置默认
    expect(cs[0]!.issues.some((i) => i.level === 'error')).toBe(true); // error 留存供上报
  });

  it('合格成年卡 → 采用（fromDraft·卡名覆盖显示·id 稳定）', () => {
    const draft: PlatformCharacterDraft = { id: 'plat-lu', name: '陆时衍', adultConfirmed: true, catchphrases: ['要不要加大？'] };
    const cs = resolveSeatCharacters(2, { seats: [draft] });
    expect(cs[0]!.fromDraft).toBe(true);
    expect(cs[0]!.card.id).toBe('plat-lu');
    expect(cs[0]!.seatCard.name).toBe('陆时衍');
  });

  it('头像取优：仅 avatarOssKey + resolveOssKey → 席位卡 avatar 解出 url', () => {
    const draft: PlatformCharacterDraft = { id: 'plat-a', name: '林夏', adultConfirmed: true, avatarOssKey: 'oss/lin.png' };
    const session: GameCSessionIn = { seats: [draft], resolveOssKey: (k) => `https://cdn/${k}` };
    const cs = resolveSeatCharacters(2, session);
    expect(cs[0]!.seatCard.avatar).toBe('https://cdn/oss/lin.png');
  });

  it('persona 台词/风味：口头禅优先 → 长度截断（外部不可信输入）', () => {
    const draft: PlatformCharacterDraft = {
      id: 'p', name: 'N', adultConfirmed: true,
      opening: '开场白', personality: '性格', catchphrases: ['短句'],
    };
    const [c] = resolveSeatCharacters(2, { seats: [draft] });
    expect(personaFlavor(c!.card)).toBe('短句'); // 口头禅优先
    const long: PlatformCharacterDraft = { id: 'p2', name: 'N', adultConfirmed: true, catchphrases: ['一二三四五六七八九十'.repeat(6)] };
    const [c2] = resolveSeatCharacters(2, { seats: [long] });
    const f = personaFlavor(c2!.card, 12)!;
    expect(f.length).toBe(12);
    expect(f.endsWith('…')).toBe(true);
  });

  it('SessionOut：以 card.id 键控·passthrough 原样带回（手册④对账）', () => {
    const draft: PlatformCharacterDraft = { id: 'plat-lu', name: '陆时衍', adultConfirmed: true, moreSettings: { tattoo: 'x' }, unknownField: 42 };
    const cs = resolveSeatCharacters(2, { seats: [draft] });
    const out = buildSessionOut(cs, (seat) => ({ placement: seat, chips: 1000 * seat, eliminated: false }));
    expect(Object.keys(out.results)).toEqual(['plat-lu']);       // 键=card.id
    expect(out.results['plat-lu']!.chips).toBe(1000);
    expect(out.results['plat-lu']!.passthrough['moreSettings']).toEqual({ tattoo: 'x' }); // 透传原样
    expect(out.results['plat-lu']!.passthrough['unknownField']).toBe(42);
  });

  it('确定性：同输入两次解析深等（零时钟/随机）', () => {
    const s: GameCSessionIn = { seats: [{ id: 'x', name: 'A', adultConfirmed: true }] };
    expect(resolveSeatCharacters(3, s)).toEqual(resolveSeatCharacters(3, s));
  });
});
