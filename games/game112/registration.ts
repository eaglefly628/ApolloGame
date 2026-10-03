// 前台名册只记录玩家亲自填写的事实；不推断猫的去向，不生成虚构的往昔。
export type CatWhereabouts = 'passed' | 'missing' | 'with-me' | 'undisclosed';
export interface CatEntry {
  readonly id: string;
  readonly name: string;
  readonly whereabouts: CatWhereabouts;
  readonly note: string;
}
export interface CatRegistry { readonly visited: boolean; readonly entries: readonly CatEntry[] }
export interface RegistrationDraft { readonly name: string; readonly whereabouts: CatWhereabouts; readonly note: string }

export const EMPTY_REGISTRY: CatRegistry = { visited: false, entries: [] };
export const EMPTY_DRAFT: RegistrationDraft = { name: '', whereabouts: 'undisclosed', note: '' };
export const WHEREABOUTS: readonly { id: CatWhereabouts; label: string; explanation: string }[] = [
  { id: 'passed', label: '它已离开', explanation: '只保存你愿意写下的回忆。' },
  { id: 'missing', label: '仍在寻找', explanation: '点一盏寻猫灯；不宣称它来到喵星。' },
  { id: 'with-me', label: '还在身边', explanation: '也可以为正在陪伴你的猫留一页。' },
  { id: 'undisclosed', label: '暂不说明', explanation: '你不必解释任何事。' },
];
const isWhereabouts = (s: unknown): s is CatWhereabouts => WHEREABOUTS.some((x) => x.id === s);
const short = (s: unknown, max: number): string => typeof s === 'string' ? s.trim().slice(0, max) : '';

export function normalizeRegistry(value: unknown): CatRegistry {
  if (value === null || typeof value !== 'object') return EMPTY_REGISTRY;
  const o = value as { visited?: unknown; entries?: unknown };
  const entries = Array.isArray(o.entries) ? o.entries.flatMap((raw: unknown): CatEntry[] => {
    if (raw === null || typeof raw !== 'object') return [];
    const e = raw as Record<string, unknown>;
    const name = short(e.name, 24);
    if (!name || typeof e.id !== 'string' || !/^cat-\d+$/.test(e.id) || !isWhereabouts(e.whereabouts)) return [];
    return [{ id: e.id, name, whereabouts: e.whereabouts, note: short(e.note, 120) }];
  }).slice(0, 32) : [];
  return { visited: o.visited === true || entries.length > 0, entries };
}

export function addEntry(registry: CatRegistry, draft: RegistrationDraft): CatRegistry | undefined {
  const name = short(draft.name, 24);
  if (!name || registry.entries.length >= 32) return undefined;
  const next = registry.entries.reduce((n, e) => Math.max(n, Number(e.id.slice(4)) || 0), 0) + 1;
  return { visited: true, entries: [...registry.entries, { id: `cat-${next}`, name, whereabouts: draft.whereabouts, note: short(draft.note, 120) }] };
}

export function removeEntry(registry: CatRegistry, id: string): CatRegistry {
  return { ...registry, entries: registry.entries.filter((e) => e.id !== id) };
}
