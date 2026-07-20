// 平台角色卡桥 · 收敛实现（REQ-CHARCARD·纯确定性：零网络/零时钟/零随机）。
// 同输入 → 深等输出；绝不 throw（脏输入全部收进 issues，仍产出可检视的 card）。

import type {
  ApolloCharacterCard,
  CardIssue,
  CharacterMedia,
  CharacterPersona,
  NormalizeOptions,
  NormalizeResult,
  SeatCard,
} from './types.js';

/** persona 段的纯文本字段（逐个 trim·空串丢弃）。 */
const PERSONA_STR_FIELDS = [
  'opening',
  'description',
  'cardDescription',
  'personality',
  'speakingStyle',
  'boundaries',
  'backstory',
  'worldView',
  'eraBackground',
  'rules',
  'coreConflicts',
  'exampleDialogues',
  'conversationStyle',
  'replySettings',
] as const;

/**
 * 已消费进规范卡的顶层键集合——其余键（imageMode/format/moreSettings/未知字段）原样进 passthrough。
 * 这样 SessionOut 能把平台自留字段完整带回（只透传不消费）。
 */
const CONSUMED_KEYS: ReadonlySet<string> = new Set<string>([
  'id',
  'name',
  'gender',
  'kind',
  ...PERSONA_STR_FIELDS,
  'catchphrases',
  'tags',
  'adultConfirmed',
  'visibility',
  'backgroundPublic',
  'updatedAt',
  'image',
  'avatar',
  'animation',
  'imageName',
  'animationName',
]);

/** trim 后取非空串，否则 undefined（非字符串一律 undefined·不因单坏字段废整卡）。 */
function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

/** 字符串数组：滤空 + 按序去重（保作者序·不排序）。 */
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const s = str(item);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/**
 * 把平台角色卡草稿收敛为引擎规范卡。**绝不 throw**——所有问题进 issues。
 * 纯确定性：零网络/零时钟/零随机；同输入深等输出。
 */
export function normalizeCharacterCard(
  input: unknown,
  opts: NormalizeOptions = {},
): NormalizeResult {
  const issues: CardIssue[] = [];
  const isObj = !!input && typeof input === 'object' && !Array.isArray(input);
  if (!isObj) {
    issues.push({ level: 'error', field: '', msg: '角色卡输入非对象' });
  }
  const draft = (isObj ? input : {}) as Record<string, unknown>;

  // —— name（error：空）——
  const name = str(draft.name);
  if (!name) issues.push({ level: 'error', field: 'name', msg: 'name 为空' });

  // —— 成年硬闸 ——
  const adultConfirmed = draft.adultConfirmed === true;
  if (opts.requireAdult && !adultConfirmed) {
    issues.push({
      level: 'error',
      field: 'adultConfirmed',
      msg: '成年确认硬闸未通过（requireAdult）',
    });
  }

  // —— id（opts.id > draft.id > name·回退记 warn）——
  const draftId = str(draft.id);
  let id: string;
  if (opts.id) {
    id = opts.id;
  } else if (draftId) {
    id = draftId;
  } else {
    id = name ?? '';
    issues.push({ level: 'warn', field: 'id', msg: 'id 缺失，回退用 name' });
  }

  // —— 媒体三源（Url > DataUrl > OssKey；仅 OssKey 无解析器/解析空 → 弃 + warn）——
  const resolveMedia = (src: unknown, slot: string): string | undefined => {
    if (!src || typeof src !== 'object') return undefined;
    const m = src as Record<string, unknown>;
    const url = str(m.Url);
    if (url) return url;
    const dataUrl = str(m.DataUrl);
    if (dataUrl) return dataUrl;
    const ossKey = str(m.OssKey);
    if (!ossKey) return undefined;
    if (!opts.resolveOssKey) {
      issues.push({ level: 'warn', field: `${slot}.OssKey`, msg: '仅 OssKey 无解析器，媒体源丢弃' });
      return undefined;
    }
    let resolved: string | undefined;
    try {
      resolved = str(opts.resolveOssKey(ossKey));
    } catch {
      resolved = undefined; // 解析器异常也不炸 normalize
    }
    if (resolved) return resolved;
    issues.push({ level: 'warn', field: `${slot}.OssKey`, msg: 'OssKey 解析为空，媒体源丢弃' });
    return undefined;
  };

  const avatarUrl = resolveMedia(draft.avatar, 'avatar');
  const imageUrl = resolveMedia(draft.image, 'image');
  const animationUrl = resolveMedia(draft.animation, 'animation');
  if (!avatarUrl && !imageUrl && !animationUrl) {
    issues.push({ level: 'warn', field: 'media', msg: '零头像媒体' });
  }

  const media: CharacterMedia = {};
  if (avatarUrl) media.avatarUrl = avatarUrl;
  if (imageUrl) media.imageUrl = imageUrl;
  if (animationUrl) media.animationUrl = animationUrl;
  const imageName = str(draft.imageName);
  const animationName = str(draft.animationName);
  if (imageName) media.imageName = imageName;
  if (animationName) media.animationName = animationName;

  // —— persona ——
  const persona: CharacterPersona = { catchphrases: strArray(draft.catchphrases) };
  for (const f of PERSONA_STR_FIELDS) {
    const s = str(draft[f]);
    if (s) persona[f] = s;
  }

  // —— passthrough（未消费键原样保留·保输入序·深等友好）——
  const passthrough: Record<string, unknown> = {};
  for (const k of Object.keys(draft)) {
    if (!CONSUMED_KEYS.has(k)) passthrough[k] = draft[k];
  }

  // —— 组卡 ——
  const card: ApolloCharacterCard = {
    id,
    name: name ?? '',
    media,
    persona,
    tags: strArray(draft.tags),
    adultConfirmed,
    passthrough,
  };
  const gender = str(draft.gender);
  const kind = str(draft.kind);
  const visibility = str(draft.visibility);
  const updatedAt = str(draft.updatedAt);
  if (gender) card.gender = gender;
  if (kind) card.kind = kind;
  if (visibility) card.visibility = visibility;
  if (typeof draft.backgroundPublic === 'boolean') card.backgroundPublic = draft.backgroundPublic;
  if (updatedAt) card.updatedAt = updatedAt;

  return { card, issues };
}

/** v1 席位卡投影：{id,name,avatar}（avatar 取头像·退回主图）。game-b 席位 adapter 零改动。 */
export function toSeatCard(card: ApolloCharacterCard): SeatCard {
  const seat: SeatCard = { id: card.id, name: card.name };
  const avatar = card.media.avatarUrl ?? card.media.imageUrl;
  if (avatar) seat.avatar = avatar;
  return seat;
}

/** 卡是否可用 = 零 error（warn 不影响可用）。 */
export function isCardUsable(result: NormalizeResult): boolean {
  return !result.issues.some((i) => i.level === 'error');
}
