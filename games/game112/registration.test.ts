import { describe, expect, it } from 'vitest';
import { validateLayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { HallSession } from './session.js';
import { addEntry, EMPTY_DRAFT, EMPTY_REGISTRY, normalizeRegistry, removeEntry } from './registration.js';
import { buildReception, buildScreen, loopPrompt, UI_ACTIONS } from './ui.js';
import { CHAPTERS, relId, ACTIVE_CAT } from './world-data.js';
import { EMPTY_STATE } from './blueprint.js';

describe('game112 主厅前台与第一条陪伴循环', () => {
  it('登记、寻找与跳过均不虚构猫的去向；坏档和空名无效，删除可逆到空名册', () => {
    expect(addEntry(EMPTY_REGISTRY, EMPTY_DRAFT)).toBeUndefined();
    const registry = addEntry(EMPTY_REGISTRY, { name: '  小白  ', whereabouts: 'missing', note: '  还在等你  ' })!;
    expect(registry).toEqual({ visited: true, entries: [{ id: 'cat-1', name: '小白', whereabouts: 'missing', note: '还在等你' }] });
    expect(normalizeRegistry({ visited: false, entries: [{ id: 'cat-2', name: '花花', whereabouts: 'passed', note: '' }] }).visited).toBe(true);
    expect(normalizeRegistry({ visited: true, entries: [{ id: 'x', name: '伪造', whereabouts: 'unknown' }] })).toEqual({ visited: true, entries: [] });
    expect(removeEntry(registry, 'cat-1').entries).toEqual([]);
    const page = buildReception(registry, { name: '小白', whereabouts: 'missing', note: '' });
    expect(validateLayoutNode(page)).toEqual([]);
    expect(JSON.stringify(page)).toContain('不宣称它来到喵星');
    expect(UI_ACTIONS).toContain('registration.open');
  });

  it('主厅可再开前台，名册可见且可删除', () => {
    const registry = addEntry(EMPTY_REGISTRY, { name: '毛球', whereabouts: 'with-me', note: '喜欢纸袋' })!;
    const v = new HallSession(112).hall();
    const hall = buildScreen({ screen: 'scene', view: v, room: 'hall', registry });
    const orbs = buildScreen({ screen: 'orbs', view: v, room: 'hall', registry });
    expect(JSON.stringify(hall)).toContain('registration.open');
    expect(JSON.stringify(orbs)).toContain('喜欢纸袋');
    expect(JSON.stringify(orbs)).toContain('registration.remove');
    expect(validateLayoutNode(orbs)).toEqual([]);
  });

  it('心光解锁回忆，再去星砂铺，最后布置物件；牌桌仍是预留', () => {
    const initial = new HallSession(112).hall();
    expect(loopPrompt(initial).action).toBe('cat.sit');
    const unlocked = new HallSession(112, { ...EMPTY_STATE, relations: { [relId('heartlight', ACTIVE_CAT)]: CHAPTERS[0]!.unlockHeartlight }, chapters: [CHAPTERS[0]!.id] }).hall();
    expect(loopPrompt(unlocked).action).toBe('memory.open');
    const read = new HallSession(112, { ...EMPTY_STATE, relations: { [relId('heartlight', ACTIVE_CAT)]: 10 }, chapters: [CHAPTERS[0]!.id], cursors: { [CHAPTERS[0]!.id]: 'n4a' } }).hall();
    expect(loopPrompt(read).action).toBe('shop.open');
    const owned = new HallSession(112, { ...EMPTY_STATE, relations: { [relId('heartlight', ACTIVE_CAT)]: 10 }, chapters: [CHAPTERS[0]!.id], cursors: { [CHAPTERS[0]!.id]: 'n4a' }, items: { feather: 1 } }).hall();
    expect(loopPrompt(owned).action).toBe('toys.open');
  });
});
