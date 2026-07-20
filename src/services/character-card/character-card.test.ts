import { describe, it, expect } from 'vitest';
import {
  normalizeCharacterCard,
  toSeatCard,
  isCardUsable,
  type PlatformCharacterDraft,
} from './index.js';

// 满卡 fixture（平台字段全集·媒体三源俱全）。
const fullDraft: PlatformCharacterDraft = {
  id: 'card-001',
  name: '  夜華  ',
  gender: '女',
  kind: '姨太',
  opening: '你来了。',
  cardDescription: '牌桌上的旧相识。',
  description: '一位深藏心事的女子。',
  personality: '冷静·记仇',
  speakingStyle: '古雅',
  boundaries: '不谈政治',
  catchphrases: ['哼', '有意思', '哼'], // 含重复
  backstory: '曾是名门之后。',
  worldView: '民国旧都。',
  eraBackground: '1930s',
  rules: '愿赌服输。',
  coreConflicts: '爱恨情仇。',
  exampleDialogues: 'A：你输了。B：未必。',
  conversationStyle: '含蓄',
  replySettings: '慢热',
  tags: ['麻将', '民国', '麻将'], // 含重复
  adultConfirmed: true,
  visibility: 'public',
  backgroundPublic: true,
  moreSettings: { theme: 'noir' },
  updatedAt: '2026-07-18T00:00:00Z',
  image: { Url: 'https://cdn/img.png' },
  avatar: { Url: 'https://cdn/ava.png' },
  animation: { Url: 'https://cdn/anim.webp' },
  imageMode: 'cover',
  imageName: '立绘A',
  animationName: '待机',
  format: 'v2',
};

// 空卡 fixture（emptyCharacterDraft·全字段在场但空值·同构于平台「新建空卡」）。
const emptyDraft: PlatformCharacterDraft = {
  id: '',
  name: '',
  gender: '',
  kind: '',
  opening: '',
  cardDescription: '',
  description: '',
  personality: '',
  speakingStyle: '',
  boundaries: '',
  catchphrases: [],
  backstory: '',
  worldView: '',
  eraBackground: '',
  rules: '',
  coreConflicts: '',
  exampleDialogues: '',
  conversationStyle: '',
  replySettings: '',
  tags: [],
  adultConfirmed: false,
  visibility: '',
  backgroundPublic: false,
  moreSettings: null,
  updatedAt: '',
  image: { Url: '', DataUrl: '', OssKey: '' },
  avatar: { Url: '', DataUrl: '', OssKey: '' },
  animation: { Url: '', DataUrl: '', OssKey: '' },
  imageMode: '',
  imageName: '',
  animationName: '',
  format: '',
};

describe('normalizeCharacterCard · 满卡', () => {
  it('全字段落位·文本 trim·数组滤重保序·媒体取 Url', () => {
    const { card, issues } = normalizeCharacterCard(fullDraft, { requireAdult: true });
    expect(isCardUsable({ card, issues })).toBe(true);
    expect(issues).toEqual([]); // 满卡零 issue（含头像、id、成年皆齐）
    expect(card.id).toBe('card-001');
    expect(card.name).toBe('夜華');
    expect(card.gender).toBe('女');
    expect(card.kind).toBe('姨太');
    expect(card.persona.opening).toBe('你来了。');
    expect(card.persona.catchphrases).toEqual(['哼', '有意思']); // 去重保序
    expect(card.persona.replySettings).toBe('慢热');
    expect(card.tags).toEqual(['麻将', '民国']); // 去重保序
    expect(card.adultConfirmed).toBe(true);
    expect(card.visibility).toBe('public');
    expect(card.backgroundPublic).toBe(true);
    expect(card.updatedAt).toBe('2026-07-18T00:00:00Z');
    expect(card.media).toEqual({
      avatarUrl: 'https://cdn/ava.png',
      imageUrl: 'https://cdn/img.png',
      animationUrl: 'https://cdn/anim.webp',
      imageName: '立绘A',
      animationName: '待机',
    });
    // imageMode/format/moreSettings=未消费 → passthrough
    expect(card.passthrough).toEqual({ moreSettings: { theme: 'noir' }, imageMode: 'cover', format: 'v2' });
  });
});

describe('normalizeCharacterCard · 空卡', () => {
  it('name 空 → error·id 回退 warn·零头像 warn·仍产出 card（不 throw）', () => {
    const { card, issues } = normalizeCharacterCard(emptyDraft);
    expect(isCardUsable({ card, issues })).toBe(false); // name 空 = 不可用
    expect(issues.some((i) => i.level === 'error' && i.field === 'name')).toBe(true);
    expect(issues.some((i) => i.level === 'warn' && i.field === 'id')).toBe(true);
    expect(issues.some((i) => i.level === 'warn' && i.field === 'media')).toBe(true);
    expect(card.name).toBe('');
    expect(card.id).toBe(''); // 无 name 可回退 → 空串
    expect(card.media).toEqual({});
    expect(card.persona.catchphrases).toEqual([]);
    expect(card.tags).toEqual([]);
    // 全空媒体源/空字符串字段不进 passthrough（imageMode/format 为空串被消费判定外但值空仍保留）
    expect(card.passthrough).toEqual({ moreSettings: null, imageMode: '', format: '' });
  });

  it('非对象/数组/null 输入 → error 非对象·不 throw', () => {
    for (const bad of ['夜華', 42, null, undefined, ['a']]) {
      const res = normalizeCharacterCard(bad as unknown);
      expect(res.issues.some((i) => i.level === 'error' && i.field === '')).toBe(true);
      expect(isCardUsable(res)).toBe(false);
      expect(res.card.name).toBe('');
    }
  });
});

describe('normalizeCharacterCard · 媒体取优矩阵', () => {
  it('Url > DataUrl > OssKey：三者齐时取 Url', () => {
    const { card } = normalizeCharacterCard({
      name: 'x',
      avatar: { Url: 'u', DataUrl: 'd', OssKey: 'k' },
    });
    expect(card.media.avatarUrl).toBe('u');
  });

  it('无 Url 时取 DataUrl', () => {
    const { card } = normalizeCharacterCard({ name: 'x', avatar: { DataUrl: 'd', OssKey: 'k' } });
    expect(card.media.avatarUrl).toBe('d');
  });

  it('仅 OssKey + 有解析器 → 解析地址', () => {
    const { card, issues } = normalizeCharacterCard(
      { name: 'x', avatar: { OssKey: 'oss://a' } },
      { resolveOssKey: (k) => `https://cdn/${k}` },
    );
    expect(card.media.avatarUrl).toBe('https://cdn/oss://a');
    expect(issues.some((i) => i.field === 'avatar.OssKey')).toBe(false);
  });

  it('仅 OssKey + 无解析器 → 弃 + warn', () => {
    const { card, issues } = normalizeCharacterCard({ name: 'x', avatar: { OssKey: 'oss://a' } });
    expect(card.media.avatarUrl).toBeUndefined();
    expect(issues.some((i) => i.level === 'warn' && i.field === 'avatar.OssKey')).toBe(true);
  });

  it('解析器抛异常 → 不炸 normalize·媒体弃 + warn', () => {
    const { card, issues } = normalizeCharacterCard(
      { name: 'x', avatar: { OssKey: 'k' } },
      {
        resolveOssKey: () => {
          throw new Error('boom');
        },
      },
    );
    expect(card.media.avatarUrl).toBeUndefined();
    expect(issues.some((i) => i.field === 'avatar.OssKey')).toBe(true);
  });
});

describe('normalizeCharacterCard · 成年硬闸', () => {
  it('requireAdult 开 + adultConfirmed 非 true → error', () => {
    const res = normalizeCharacterCard({ name: 'x', adultConfirmed: false }, { requireAdult: true });
    expect(res.issues.some((i) => i.level === 'error' && i.field === 'adultConfirmed')).toBe(true);
    expect(isCardUsable(res)).toBe(false);
  });

  it('requireAdult 开 + adultConfirmed=true → 通过', () => {
    const res = normalizeCharacterCard({ name: 'x', adultConfirmed: true }, { requireAdult: true });
    expect(res.issues.some((i) => i.field === 'adultConfirmed')).toBe(false);
  });

  it('requireAdult 关 → 不校验成年（默认放行）', () => {
    const res = normalizeCharacterCard({ name: 'x', adultConfirmed: false });
    expect(res.issues.some((i) => i.field === 'adultConfirmed')).toBe(false);
  });
});

describe('normalizeCharacterCard · 宽容读 & passthrough', () => {
  it('未识别字段原样进 passthrough', () => {
    const { card } = normalizeCharacterCard({ name: 'x', tattoo: 'dragon', extra: { a: 1 } });
    expect(card.passthrough).toEqual({ tattoo: 'dragon', extra: { a: 1 } });
  });

  it('opts.id 优先于 draft.id·draft.id 优先于 name', () => {
    expect(normalizeCharacterCard({ name: 'n', id: 'd' }, { id: 'o' }).card.id).toBe('o');
    expect(normalizeCharacterCard({ name: 'n', id: 'd' }).card.id).toBe('d');
    const nameFallback = normalizeCharacterCard({ name: 'n' });
    expect(nameFallback.card.id).toBe('n');
    expect(nameFallback.issues.some((i) => i.field === 'id')).toBe(true); // 回退记 warn
  });
});

describe('normalizeCharacterCard · 确定性', () => {
  it('同输入两次深等输出', () => {
    const a = normalizeCharacterCard(fullDraft, { requireAdult: true });
    const b = normalizeCharacterCard(fullDraft, { requireAdult: true });
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // 键序也稳定
  });
});

describe('toSeatCard · v1 投影兼容', () => {
  it('{id,name,avatar}·avatar 取头像', () => {
    const { card } = normalizeCharacterCard(fullDraft, { requireAdult: true });
    expect(toSeatCard(card)).toEqual({ id: 'card-001', name: '夜華', avatar: 'https://cdn/ava.png' });
  });

  it('无头像退回主图', () => {
    const { card } = normalizeCharacterCard({ name: 'x', image: { Url: 'img' } });
    expect(toSeatCard(card)).toEqual({ id: 'x', name: 'x', avatar: 'img' });
  });

  it('零媒体 → 无 avatar 字段', () => {
    const { card } = normalizeCharacterCard({ name: 'x' });
    expect(toSeatCard(card)).toEqual({ id: 'x', name: 'x' });
  });
});
