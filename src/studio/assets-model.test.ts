import { describe, it, expect } from 'vitest';
import { studioAssets, groupByType, filterAssets } from './assets-model.js';
import type { AssetIndex } from '@assets/index.js';
import { buildGameABlueprint, LEVEL_SCROLL } from '../games/game-a/index.js';
import { buildGameBBlueprint } from '../games/game-b/index.js';
import { buildGameCBlueprint } from '../games/game-c/index.js';

describe('资产透视 · 统一模型', () => {
  it('game-b：从清单派生 背景/立绘/BGM，立绘带 variants，usedBy=场景', () => {
    const assets = studioAssets('game-b', buildGameBBlueprint(), null);
    const types = new Set(assets.map((a) => a.type));
    expect(assets.length).toBeGreaterThanOrEqual(3);
    expect(types.has('background')).toBe(true);
    expect(types.has('bgm')).toBe(true);
    const portrait = assets.find((a) => a.id === 'char_S.portrait');
    expect(portrait?.variants).toEqual(['neutral', 'cold', 'smile']);
    expect(portrait?.usedBy).toContain('char_S');
  });

  it('game-c：材料/衣服/配饰皆成资产，usedBy 全部指向蓝图里真实存在的实体（双击定位有效）', () => {
    const bp = buildGameCBlueprint();
    const assets = studioAssets('game-c', bp, null);
    const types = new Set(assets.map((a) => a.type));
    expect(types.has('material')).toBe(true);
    expect(types.has('garment')).toBe(true);
    expect(types.has('accessory')).toBe(true);

    const entityIds = new Set(Object.keys(bp.entities));
    for (const a of assets) {
      for (const u of a.usedBy) {
        expect(entityIds.has(u), `${a.id} usedBy ${u} 不是真实实体`).toBe(true);
      }
    }
    const apron = assets.find((a) => a.id === 'apron');
    expect(apron?.tags).toContain('tier1');
    expect(apron?.description.length).toBeGreaterThan(0); // 爱诗提示词
  });

  it('game-a：从 GAME_A_ASSETS 派生 texture 资产', () => {
    const assets = studioAssets('game-a', buildGameABlueprint(LEVEL_SCROLL), null);
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.every((a) => a.type === 'texture')).toBe(true);
    expect(assets.some((a) => a.id === 'bg.sky')).toBe(true);
  });

  it('cross-ref：index.json 的 tbf 状态覆盖占位判断', () => {
    const index: AssetIndex = {
      version: 1,
      assets: [{ id: 'bg.office', type: 'texture', description: '索引描述', status: 'tbf' }],
    };
    const assets = studioAssets('game-b', buildGameBBlueprint(), index);
    expect(assets.find((a) => a.id === 'bg.office')?.status).toBe('tbf');
  });

  it('filterAssets：按 tag 命中（tier / 材料名）', () => {
    const assets = studioAssets('game-c', buildGameCBlueprint(), null);
    expect(filterAssets(assets, 'tier3').some((a) => a.id === 'sundress')).toBe(true);
    expect(filterAssets(assets, 'ribbon').length).toBeGreaterThan(0);
    expect(filterAssets(assets, '').length).toBe(assets.length);
  });

  it('groupByType：按类型分组', () => {
    const groups = groupByType(studioAssets('game-c', buildGameCBlueprint(), null));
    expect(groups.map((g) => g.type)).toEqual(['accessory', 'garment', 'material']);
    expect(groups.find((g) => g.type === 'garment')?.assets.length).toBe(6);
  });
});
