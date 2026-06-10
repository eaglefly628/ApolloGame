import { describe, it, expect } from 'vitest';
import {
  projectRecords,
  artlibRecords,
  manifestRecords,
  queryLibrary,
  libraryCounts,
  inferCategory,
  LIBRARY_TAXONOMY,
  categoryLabel,
} from './library.js';
import { parseAssetIndex } from './asset-index.js';
import type { ArtLibIndex } from './artlib.js';
import type { AssetManifest } from './asset-types.js';

const projIndex = parseAssetIndex({
  version: 1,
  assets: [
    { id: 'bg.office', type: 'texture', description: '办公室', status: 'tbf', spec: { width: 1280, height: 720 } },
    { id: 'hero.idle', type: 'texture', description: '英雄', status: 'filled', path: 'texture/hero.png', category: 'sprite.character', tags: ['hero'], license: 'CC0' },
    { id: 'bgm.daily', type: 'sound', description: '日常BGM', status: 'tbf' },
  ],
});

const artIndex: ArtLibIndex = {
  version: 1,
  source: 'DCSS — opengameart.org',
  license: 'CC0 (public domain)',
  root: 'assets/FreeArtLib',
  basePixel: 32,
  fileCount: 3,
  assetCount: 2,
  cats: { monster: 1, item: 1 },
  slots: { 'sprite.character': 1, 'icon.item': 1 },
  assets: [
    { id: 'monster/undead/skeleton', cat: 'monster', sub: 'undead', subject: 'skeleton', slot: 'sprite.character', transparent: true, variants: 2, sample: 'skeleton_1.png' },
    { id: 'item/weapon/axe', cat: 'item', sub: 'weapon', subject: 'axe', slot: 'icon.item', transparent: true, variants: 1, sample: 'axe.png' },
  ],
};

const gameManifest: AssetManifest = [
  { kind: 'texture', key: 'f.hero.guan_yu', src: 'assets/FreeArtLib/monster/death_knight.png', width: 32, height: 32 },
  { kind: 'texture', key: 'f.fx.strike', src: 'data:image/svg+xml,<svg/>', width: 24, height: 24 },
  { kind: 'sprite-sheet', key: 'd.hero.sheet', src: 'data:image/svg+xml,<svg/>', frameWidth: 24, frameHeight: 24, columns: 4, count: 8 },
];

describe('library — 三来源适配', () => {
  it('projectRecords：显式 category 优先，缺省按 id 推断；filled 贴图才有 thumb', () => {
    const rs = projectRecords(projIndex);
    expect(rs.find((r) => r.id === 'bg.office')).toMatchObject({ category: 'background', status: 'tbf', thumb: undefined, source: 'project' });
    expect(rs.find((r) => r.id === 'hero.idle')).toMatchObject({ category: 'sprite.character', thumb: '/assets/texture/hero.png', license: 'CC0' });
    expect(rs.find((r) => r.id === 'bgm.daily')).toMatchObject({ type: 'sound', category: 'bgm' });
  });

  it('artlibRecords：slot 即分类，CC0，缩略图为 sample 路径', () => {
    const rs = artlibRecords(artIndex);
    expect(rs[0]).toMatchObject({
      id: 'monster/undead/skeleton',
      category: 'sprite.character',
      license: 'CC0',
      status: 'filled',
      thumb: '/assets/FreeArtLib/monster/undead/skeleton_1.png',
      variants: 2,
    });
    expect(rs[0].tags).toContain('undead');
  });

  it('manifestRecords：data: 内联 → placeholder；文件引用 → filled；sheet 归精灵表类', () => {
    const rs = manifestRecords('game-f', gameManifest);
    expect(rs[0]).toMatchObject({ status: 'filled', thumb: '/assets/FreeArtLib/monster/death_knight.png', sourceLabel: 'game-f' });
    expect(rs[1]).toMatchObject({ status: 'placeholder', category: 'misc' });
    expect(rs[2]).toMatchObject({ category: 'sheet', variants: 8 });
  });
});

describe('library — 查询/计数', () => {
  const all = [...projectRecords(projIndex), ...artlibRecords(artIndex), ...manifestRecords('game-f', gameManifest)];

  it('文本分词全命中', () => {
    expect(queryLibrary(all, { text: 'undead skeleton' })).toHaveLength(1);
    expect(queryLibrary(all, { text: 'undead dragon' })).toHaveLength(0);
  });

  it('维度过滤：type/category/status/source/tags 叠加', () => {
    expect(queryLibrary(all, { type: 'sound' })).toHaveLength(1);
    expect(queryLibrary(all, { type: 'texture', category: 'sprite.character' })).toHaveLength(2);
    expect(queryLibrary(all, { status: 'placeholder' })).toHaveLength(2);
    expect(queryLibrary(all, { sources: ['artlib'] })).toHaveLength(2);
    expect(queryLibrary(all, { tags: ['undead'] })).toHaveLength(1);
  });

  it('排序：variants 降序', () => {
    const rs = queryLibrary(all, { type: 'texture', sort: 'variants' });
    expect(rs[0].variants ?? 0).toBeGreaterThanOrEqual(rs[1].variants ?? 0);
  });

  it('libraryCounts：type 与 type/category 双层计数', () => {
    const c = libraryCounts(all);
    expect(c.get('texture')).toBe(7);
    expect(c.get('sound')).toBe(1);
    expect(c.get('texture/sprite.character')).toBe(2);
  });
});

describe('library — 分类法', () => {
  it('七大类型常驻（含空类型也建目录）', () => {
    expect(LIBRARY_TAXONOMY.map((t) => t.type)).toEqual(['texture', 'sound', 'animation', 'video', 'material', 'mesh', 'font']);
  });
  it('分类显示名回退 id', () => {
    expect(categoryLabel('texture', 'icon.item')).toBe('物品图标');
    expect(categoryLabel('texture', 'unknown.cat')).toBe('unknown.cat');
  });
  it('inferCategory：sheet spec → 精灵表类', () => {
    expect(inferCategory({ id: 'x', type: 'texture', description: '', status: 'tbf', spec: { sheet: { frameWidth: 1, frameHeight: 1, columns: 1, count: 1 } } })).toBe('sheet');
  });
});
