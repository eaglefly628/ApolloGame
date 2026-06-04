import { describe, it, expect } from 'vitest';
import realIndex from '../../assets/index.json';
import {
  parseAssetIndex,
  pendingAssets,
  filledAssets,
  registerAssetIndex,
  ASSET_TYPES,
} from './asset-index.js';
import { AssetManager, StubAssetLoader } from './asset-manager.js';

const good = {
  version: 1,
  assets: [
    { id: 'bg.office', type: 'texture', description: '办公室', status: 'tbf', spec: { width: 1280, height: 720 } },
    { id: 'char_S.neutral', type: 'texture', description: '立绘S', status: 'filled', path: 'texture/char_S/neutral.png', spec: { width: 720, height: 1280 } },
    { id: 'bgm.daily', type: 'sound', description: '日常BGM', status: 'tbf' },
  ],
};

describe('asset-index — 校验', () => {
  it('解析合法索引', () => {
    const idx = parseAssetIndex(good);
    expect(idx.version).toBe(1);
    expect(idx.assets).toHaveLength(3);
  });

  it('拒绝重复 id', () => {
    expect(() =>
      parseAssetIndex({ version: 1, assets: [
        { id: 'x', type: 'texture', description: 'a', status: 'tbf' },
        { id: 'x', type: 'texture', description: 'b', status: 'tbf' },
      ] }),
    ).toThrow(/重复/);
  });

  it('拒绝非法 type', () => {
    expect(() =>
      parseAssetIndex({ version: 1, assets: [{ id: 'x', type: 'blob', description: 'a', status: 'tbf' }] }),
    ).toThrow(/type 非法/);
  });

  it('filled 缺 path 报错', () => {
    expect(() =>
      parseAssetIndex({ version: 1, assets: [{ id: 'x', type: 'texture', description: 'a', status: 'filled' }] }),
    ).toThrow(/缺 path/);
  });

  it('拒绝非法 status', () => {
    expect(() =>
      parseAssetIndex({ version: 1, assets: [{ id: 'x', type: 'texture', description: 'a', status: 'approved' }] }),
    ).toThrow(/status/);
  });
});

describe('asset-index — TBF 工作面', () => {
  it('pendingAssets 列出待填充', () => {
    const idx = parseAssetIndex(good);
    expect(pendingAssets(idx).map((a) => a.id)).toEqual(['bg.office', 'bgm.daily']);
  });

  it('filledAssets 列出已填充', () => {
    const idx = parseAssetIndex(good);
    expect(filledAssets(idx).map((a) => a.id)).toEqual(['char_S.neutral']);
  });
});

describe('asset-index — 桥接 AssetManager', () => {
  it('只注册 filled 的 texture；tbf / 非 texture 不注册', async () => {
    const idx = parseAssetIndex(good);
    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx, '/assets/');
    expect(m.has('char_S.neutral')).toBe(true); // filled texture
    expect(m.has('bg.office')).toBe(false); // tbf
    expect(m.has('bgm.daily')).toBe(false); // sound（暂不消费）
    const a = await m.load('char_S.neutral');
    expect(a.descriptor).toMatchObject({ kind: 'texture', key: 'char_S.neutral', src: '/assets/texture/char_S/neutral.png' });
    expect(a.width).toBe(720);
  });
});

describe('asset-index — 真实 assets/index.json 自检', () => {
  it('仓库里的 index.json 合法可解析', () => {
    const idx = parseAssetIndex(realIndex);
    expect(idx.version).toBeGreaterThanOrEqual(1);
    for (const a of idx.assets) expect(ASSET_TYPES).toContain(a.type);
  });
});
