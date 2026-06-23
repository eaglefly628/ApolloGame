import { describe, it, expect } from 'vitest';
import { studioAssets, groupByType, filterAssets } from './assets-model.js';
import type { AssetIndex } from '@assets/index.js';
import { buildGameABlueprint, LEVEL_SCROLL } from '../games/game-a/index.js';

describe('资产透视 · 统一模型', () => {
  it('game-a：从 GAME_A_ASSETS 派生 texture 资产', () => {
    const assets = studioAssets('game-a', buildGameABlueprint(LEVEL_SCROLL), null);
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.every((a) => a.type === 'texture')).toBe(true);
    expect(assets.some((a) => a.id === 'bg.sky')).toBe(true);
  });

  it('cross-ref：index.json 的 tbf 状态覆盖占位判断', () => {
    const index: AssetIndex = {
      version: 1,
      assets: [{ id: 'bg.sky', type: 'texture', description: '索引描述', status: 'tbf' }],
    };
    const assets = studioAssets('game-a', buildGameABlueprint(LEVEL_SCROLL), index);
    expect(assets.find((a) => a.id === 'bg.sky')?.status).toBe('tbf');
  });

  it('filterAssets：按 tag 命中 + 空串返回全部', () => {
    const assets = studioAssets('game-a', buildGameABlueprint(LEVEL_SCROLL), null);
    expect(filterAssets(assets, 'inline-svg').length).toBe(assets.length); // game-a 资产皆内联 SVG 占位
    expect(filterAssets(assets, '').length).toBe(assets.length);
  });

  it('groupByType：按类型分组', () => {
    const groups = groupByType(studioAssets('game-a', buildGameABlueprint(LEVEL_SCROLL), null));
    expect(groups.map((g) => g.type)).toEqual(['texture']); // game-a 资产皆 texture
  });
});
