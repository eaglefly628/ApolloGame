// game112 —— 世界 → UI 投影（只读·纯函数·宿主层）。UI 侧零世界访问，只吃 HallView 这样的 POD。
import type { IWorld } from '@zerocraft/engine/engine/core/types.js';
import type { Resource, State, Flag, Tag, Text } from '@zerocraft/engine/engine/protocol/components.js';
import {
  ACTIVE_CAT, RELATIONS, SHOP_ITEMS, CHAPTERS, OFFLINE_TAG, STARDUST,
  relId, itemCount, placedFlag, chapterFlag, chapterFsm, catOf, chapterOf,
  type RelationKey,
} from './world-data.js';
import type { PersistedState } from './blueprint.js';

export function resourceOf(world: IWorld, id: string): number {
  for (const [eid] of world.query('Resource')) {
    const r = world.getComponent<Resource>(eid, 'Resource');
    if (r?.id === id) return r.current;
  }
  return 0;
}
export function flagOn(world: IWorld, id: string): boolean {
  for (const [eid] of world.query('Flag')) {
    const f = world.getComponent<Flag>(eid, 'Flag');
    if (f?.id === id) return f.active;
  }
  return false;
}
export function stateOf(world: IWorld, fsmId: string): string {
  for (const [eid] of world.query('State')) {
    const s = world.getComponent<State>(eid, 'State');
    if (s?.fsmId === fsmId) return s.current;
  }
  return '';
}
/** 离线小事件实体（Tag 命中 OFFLINE_TAG）的文案，按实体 id 排序（确定）。 */
export function offlineEventTexts(world: IWorld): string[] {
  const out: { id: string; text: string }[] = [];
  for (const [eid] of world.query('Tag', 'Text')) {
    const t = world.getComponent<Tag>(eid, 'Tag');
    if (t === undefined || (t.flags & OFFLINE_TAG) === 0) continue;
    out.push({ id: String(eid), text: world.getComponent<Text>(eid, 'Text')?.content ?? '' });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((x) => x.text);
}

// ── 视图 POD ────────────────────────────────────────────────────────────
export interface OwnedItemView { readonly id: string; readonly name: string; readonly kind: string; readonly count: number; readonly placed: boolean }
export interface ChapterView { readonly id: string; readonly title: string; readonly hint: string; readonly unlocked: boolean; readonly need: number; readonly sensitive: boolean }
export interface ReadingView {
  readonly chapterId: string;
  readonly title: string;
  readonly speaker: string;
  readonly text: string;
  /** choice 节点的选项文案（line 节点为 undefined）。 */
  readonly options?: readonly string[];
  readonly ended: boolean;
}
export interface HallView {
  readonly catId: string;
  readonly catName: string;
  readonly catLine: string;
  readonly moodPhrase: string;
  readonly stardust: number;
  readonly relations: Readonly<Record<RelationKey, number>>;
  readonly owned: readonly OwnedItemView[];
  readonly chapters: readonly ChapterView[];
  readonly offlineEvents: readonly string[];
}

export function moodPhraseOf(catId: string, mood: number): string {
  const cat = catOf(catId);
  if (cat === undefined) return '';
  return cat.moodPhrases.find((p) => mood >= p.min)?.text ?? '';
}

export function buildHallView(world: IWorld): HallView {
  const cat = catOf(ACTIVE_CAT);
  const relations = Object.fromEntries(RELATIONS.map((r) => [r.key, resourceOf(world, relId(r.key, ACTIVE_CAT))])) as Record<RelationKey, number>;
  return {
    catId: ACTIVE_CAT,
    catName: cat?.name ?? ACTIVE_CAT,
    catLine: cat?.hallLine ?? '',
    moodPhrase: moodPhraseOf(ACTIVE_CAT, relations.mood),
    stardust: resourceOf(world, STARDUST),
    relations,
    owned: SHOP_ITEMS
      .map((it) => ({ id: it.id, name: it.name, kind: it.kind, count: resourceOf(world, itemCount(it.id)), placed: flagOn(world, placedFlag(it.id)) }))
      .filter((x) => x.count > 0),
    chapters: CHAPTERS.map((c) => ({ id: c.id, title: c.title, hint: c.hint, unlocked: flagOn(world, chapterFlag(c.id)), need: c.unlockHeartlight, sensitive: c.sensitive })),
    offlineEvents: offlineEventTexts(world),
  };
}

/** 章节阅读视图：按对话机游标取节点（查表·非逻辑）。 */
export function buildReadingView(world: IWorld, chapterId: string): ReadingView | undefined {
  const c = chapterOf(chapterId);
  if (c === undefined) return undefined;
  const cur = stateOf(world, chapterFsm(c.id));
  const node = c.nodes[cur];
  if (node === undefined) return { chapterId, title: c.title, speaker: '', text: '', ended: true };
  if (node.kind === 'line') return { chapterId, title: c.title, speaker: node.speaker, text: node.text, ended: node.next === null };
  if (node.kind === 'choice') return { chapterId, title: c.title, speaker: node.speaker ?? '', text: node.prompt ?? '', options: node.options.map((o) => o.text), ended: false };
  return { chapterId, title: c.title, speaker: '', text: '', ended: false };
}

/** 世界 → 局外持久态（退出/每次动作后由宿主写信封）。兴致不进档。 */
export function toPersisted(world: IWorld): PersistedState {
  const relations: Record<string, number> = {};
  for (const r of RELATIONS) if (r.persist) relations[relId(r.key, ACTIVE_CAT)] = resourceOf(world, relId(r.key, ACTIVE_CAT));
  const items: Record<string, number> = {};
  for (const it of SHOP_ITEMS) { const n = resourceOf(world, itemCount(it.id)); if (n > 0) items[it.id] = n; }
  const cursors: Record<string, string> = {};
  for (const c of CHAPTERS) cursors[c.id] = stateOf(world, chapterFsm(c.id));
  return {
    stardust: resourceOf(world, STARDUST),
    relations,
    items,
    placed: SHOP_ITEMS.filter((it) => flagOn(world, placedFlag(it.id))).map((it) => it.id),
    chapters: CHAPTERS.filter((c) => flagOn(world, chapterFlag(c.id))).map((c) => c.id),
    cursors,
  };
}
