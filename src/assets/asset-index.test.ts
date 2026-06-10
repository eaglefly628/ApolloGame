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

  it('baseUrl 不以 / 结尾 → 防御性补斜杠（不拼成 texhero.png）', async () => {
    const idx = parseAssetIndex(good);
    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx, '/assets'); // 注意：无尾斜杠
    const a = await m.load('char_S.neutral');
    expect(a.descriptor.src).toBe('/assets/texture/char_S/neutral.png'); // 正确补斜杠
  });

  it('baseUrl 为空 → 直接用 path（不画蛇添足加斜杠）', async () => {
    const idx = parseAssetIndex(good);
    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx); // baseUrl 缺省 ''
    const a = await m.load('char_S.neutral');
    expect(a.descriptor.src).toBe('texture/char_S/neutral.png');
  });
});

describe('asset-index — v2 字段（资源库）', () => {
  it('category/tags/source/license/provenance 可选且校验类型', () => {
    const idx = parseAssetIndex({
      version: 1,
      assets: [{
        id: 'x', type: 'texture', description: 'a', status: 'tbf',
        category: 'icon.item', tags: ['sword', 'loot'], source: 'import', license: 'CC0',
        provenance: { method: 'import-loose', originalFile: 'Sword.PNG' },
      }],
    });
    expect(idx.assets[0]).toMatchObject({ category: 'icon.item', source: 'import', license: 'CC0' });
    expect(idx.assets[0].tags).toEqual(['sword', 'loot']);
  });

  it('tags 非字符串数组 → 报错；font 是合法类型', () => {
    expect(() =>
      parseAssetIndex({ version: 1, assets: [{ id: 'x', type: 'texture', description: 'a', status: 'tbf', tags: [1] }] }),
    ).toThrow(/tags/);
    const idx = parseAssetIndex({ version: 1, assets: [{ id: 'f', type: 'font', description: '字体', status: 'tbf' }] });
    expect(idx.assets[0].type).toBe('font');
  });

  it('spec.sheet → 注册成 sprite-sheet（导入器·精灵表切割的运行时消费）', async () => {
    const idx = parseAssetIndex({
      version: 1,
      assets: [{
        id: 'hero.sheet', type: 'texture', description: '精灵表', status: 'filled',
        path: 'texture/sheet/hero.png',
        spec: { sheet: { frameWidth: 48, frameHeight: 64, columns: 16, count: 32 } },
      }],
    });
    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx, '/assets/');
    const a = await m.load('hero.sheet');
    expect(a.descriptor).toMatchObject({ kind: 'sprite-sheet', frameWidth: 48, frameHeight: 64, columns: 16, count: 32 });
    const frame = m.resolve('hero.sheet', 17); // 第 17 帧 → 第二行第 2 列
    expect(frame).toMatchObject({ sx: 48, sy: 64, sw: 48, sh: 64 });
  });
});

describe('asset-index — 真实 assets/index.json 自检', () => {
  it('仓库里的 index.json 合法可解析', () => {
    const idx = parseAssetIndex(realIndex);
    expect(idx.version).toBeGreaterThanOrEqual(1);
    for (const a of idx.assets) expect(ASSET_TYPES).toContain(a.type);
  });
});
