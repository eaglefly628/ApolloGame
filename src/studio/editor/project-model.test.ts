import { describe, it, expect } from 'vitest';
import {
  validateProject, buildAssetTree, sceneHierarchy, flattenValues, coerceEdit, getAt, isSafeRelPath, selectionContext,
  type ProjectIndex,
} from './project-model.js';

const GOOD = {
  schema: 1, id: 'new1', name: '新游戏 1', entry: 'scenes/main',
  assets: [
    { id: 'scenes/main', type: 'scene', name: '主关卡', path: 'manifest.json' },
    { id: 'scenes/level-2', type: 'scene', path: 'scenes/level-2.json' },
    { id: 'ui/hud', type: 'ui', path: 'ui/hud.json' },
    { id: 'data/tuning', type: 'table', path: 'data/tuning.json' },
    { id: 'docs/overview', type: 'doc', path: 'design/overview.md' },
    { id: 'motion/walk', type: 'motion', ref: { platform: 'motion', id: 'walking-v1' } },
  ],
};

describe('validateProject', () => {
  it('合法索引原样通过', () => {
    const { project, issues } = validateProject(GOOD);
    expect(issues).toEqual([]);
    expect(project?.assets).toHaveLength(6);
  });

  it.each([
    ['id 非 new<n>', { ...GOOD, id: 'game102' }, 'id'],
    ['entry 不存在', { ...GOOD, entry: 'scenes/none' }, 'entry'],
    ['entry 不是场景', { ...GOOD, entry: 'ui/hud' }, 'entry'],
    ['路径回溯', { ...GOOD, assets: [...GOOD.assets, { id: 'x', type: 'table', path: '../secret.json' }] }, 'assets[6].path'],
    ['重复 id', { ...GOOD, assets: [...GOOD.assets, { id: 'ui/hud', type: 'ui', path: 'ui/b.json' }] }, 'assets[6].id'],
    ['同一文件两个资产', { ...GOOD, assets: [...GOOD.assets, { id: 'ui/b', type: 'ui', path: 'ui/hud.json' }] }, 'assets[6].path'],
    ['场景用 ref', { ...GOOD, assets: [...GOOD.assets, { id: 's/x', type: 'scene', ref: { platform: 'motion', id: 'a' } }] }, 'assets[6]'],
    ['动作同时给 path 与 ref', { ...GOOD, assets: [...GOOD.assets, { id: 'm/x', type: 'motion', path: 'm.json', ref: { platform: 'motion', id: 'a' } }] }, 'assets[6]'],
    ['未知类型', { ...GOOD, assets: [...GOOD.assets, { id: 'x', type: 'script', path: 'x.json' }] }, 'assets[6].type'],
    ['doc 不是 md', { ...GOOD, assets: [...GOOD.assets, { id: 'd/x', type: 'doc', path: 'x.json' }] }, 'assets[6].path'],
  ])('%s → 拒', (_name, raw, where) => {
    const { project, issues } = validateProject(raw);
    expect(project).toBeNull();
    expect(issues.map((i) => i.path)).toContain(where);
  });

  it('安全路径判定', () => {
    expect(isSafeRelPath('scenes/a.json')).toBe(true);
    for (const p of ['/abs.json', 'a/../b.json', '.hidden/a.json', 'a\\b.json', 'a.ts', '']) expect(isSafeRelPath(p)).toBe(false);
  });
});

describe('buildAssetTree', () => {
  it('id 前缀成文件夹；文件夹在前、叶子在后、按名排序', () => {
    const tree = buildAssetTree((validateProject(GOOD).project as ProjectIndex).assets);
    expect(tree.children.map((c) => c.label)).toEqual(['data', 'docs', 'motion', 'scenes', 'ui']);
    const scenes = tree.children.find((c) => c.key === 'scenes')!;
    expect(scenes.children.map((c) => c.label)).toEqual(['level-2', '主关卡']);
    expect(scenes.children[1].asset?.path).toBe('manifest.json');
  });
});

describe('sceneHierarchy / flattenValues / coerceEdit', () => {
  const scene = { entities: { player: { Transform: { x: 1, y: 2 }, Color: { tint: 5 } }, coins: { $template: 'coin', $repeat: { count: 3 }, Transform: { x: 0 } } } };

  it('实体行标出模板与展开数', () => {
    expect(sceneHierarchy(scene)).toEqual([
      { id: 'player', components: ['Transform', 'Color'] },
      { id: 'coins', components: ['Transform'], template: 'coin', repeat: 3 },
    ]);
    expect(sceneHierarchy(null)).toEqual([]);
  });

  it('摊平：标量可调、结构只读；指针可回读', () => {
    const rows = flattenValues(scene.entities.player, ['entities', 'player']);
    expect(rows.map((r) => r.label)).toEqual(['Transform.x', 'Transform.y', 'Color.tint']);
    expect(rows.every((r) => r.editable)).toBe(true);
    expect(getAt(scene, rows[1].pointer)).toBe(2);
    const ui = flattenValues({ children: [{ props: { text: 'a', list: [] } }] });
    expect(ui.map((r) => [r.label, r.editable])).toEqual([['children[0].props.text', true], ['children[0].props.list', false]]);
  });

  it('手调只按原类型解析（乙档不许改类型/结构）', () => {
    expect(coerceEdit(3, ' 4.5 ')).toEqual({ ok: true, value: 4.5 });
    expect(coerceEdit(3, 'abc').ok).toBe(false);
    expect(coerceEdit(true, 'false')).toEqual({ ok: true, value: false });
    expect(coerceEdit(true, 'yes').ok).toBe(false);
    expect(coerceEdit('a', '')).toEqual({ ok: true, value: '' });
    expect(coerceEdit({ a: 1 }, '{}').ok).toBe(false);
  });

  it('指认上下文写清项目/资产/实体/字段', () => {
    const p = validateProject(GOOD).project as ProjectIndex;
    const ctx = selectionContext(p, { asset: p.assets[0], entity: 'player', pointer: ['entities', 'player', 'Transform', 'x'] });
    expect(ctx).toContain('scenes/main');
    expect(ctx).toContain('manifest.json');
    expect(ctx).toContain('【选中实体】player');
    expect(ctx).toContain('Transform.x');
  });
});
