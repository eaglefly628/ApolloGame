import { describe, it, expect } from 'vitest';
import { studioAssets, groupByType, filterAssets } from './assets-model.js';
import type { AssetIndex } from '@assets/index.js';
import { demoBlueprint } from '../assembly/demo.assembly.js';

// game-e 走专属资产清单(小丑牌真美术)；bp 参数对 game-e 不参与（用 demo 占位即可）。
describe('资产透视 · 统一模型', () => {
  it('game-e：从小丑牌目录派生 texture 资产', () => {
    const assets = studioAssets('game-e', demoBlueprint, null);
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.every((a) => a.type === 'texture')).toBe(true);
    expect(assets.some((a) => a.id === 'je.suit.spades')).toBe(true);
  });

  it('cross-ref：index.json 的 tbf 状态覆盖占位判断', () => {
    const index: AssetIndex = {
      version: 1,
      assets: [{ id: 'je.suit.spades', type: 'texture', description: '索引描述', status: 'tbf' }],
    };
    const assets = studioAssets('game-e', demoBlueprint, index);
    expect(assets.find((a) => a.id === 'je.suit.spades')?.status).toBe('tbf');
  });

  it('filterAssets：按 tag 命中 + 空串返回全部 + 不命中→0 + 选择性命中→恰 N', () => {
    const assets = studioAssets('game-e', demoBlueprint, null);
    expect(filterAssets(assets, '小丑牌').length).toBe(assets.length); // game-e 资产皆带「小丑牌」tag
    expect(filterAssets(assets, '').length).toBe(assets.length);
    // 加强（测试加固 2026-08-24）：全命中/空串测不出过滤器真在过滤——补零命中与恰 N 命中两极。
    expect(filterAssets(assets, '绝不存在的词zzz')).toHaveLength(0); // 不命中 → 0
    expect(filterAssets(assets, 'suit-icon')).toHaveLength(4); // 恰 4 张花色图标（je.suit.* 的 sub tag）
    expect(filterAssets(assets, 'suit-icon').map((a) => a.id).sort())
      .toEqual(['je.suit.clubs', 'je.suit.diamonds', 'je.suit.hearts', 'je.suit.spades']);
  });

  it('groupByType：按类型分组', () => {
    const groups = groupByType(studioAssets('game-e', demoBlueprint, null));
    expect(groups.map((g) => g.type)).toEqual(['texture']); // game-e 资产皆 texture
  });
});
