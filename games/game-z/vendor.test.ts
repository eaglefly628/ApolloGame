// REQ-Resource ⑤：vendoring 产物自检——scripts/vendor-asset.mjs 把共享库资源 copy 进游戏本地美术目录 +
// 写本地索引 public/games/game-z/art/index.json。此测试证明该本地索引可被引擎统一 Asset 路线直接消费
// （parseAssetIndex 校验通过 + registerAssetIndex 桥接成可加载资产·站点绝对路径 baseUrl ''）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseAssetIndex, registerAssetIndex, buildMaterialCatalog, AssetManager, StubAssetLoader } from '@assets/index.js';

describe('REQ-Resource ⑤ vendoring 本地索引消费', () => {
  it('game-z 本地美术索引合法·可 registerAssetIndex 消费·携 vendoredFrom 溯源', async () => {
    const raw = JSON.parse(readFileSync('public/games/game-z/art/index.json', 'utf8'));
    const idx = parseAssetIndex(raw); // 闭集校验通过（vendor 搬来的 spec 合法）
    expect(idx.assets.length).toBeGreaterThanOrEqual(1);

    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx); // 本地索引 path 已是站点绝对路径 → baseUrl ''
    const vendored = idx.assets.find((a) => a.id === 'tex/vendor-demo');
    expect(vendored).toBeDefined();
    expect(vendored?.provenance).toMatchObject({ vendoredFrom: 'devicon/aarch64-original' }); // 溯源留痕
    expect(m.has('tex/vendor-demo')).toBe(true); // 桥接进 AssetManager

    const a = await m.load('tex/vendor-demo');
    expect(a.descriptor.src).toBe('/games/game-z/art/devicon/aarch64-original.svg'); // 指向本地拷贝·非共享库
  });

  it('材质（数据型·无文件）也能 vendor：本地条目无 path·进 buildMaterialCatalog（REQ-PA-3D公用货架 ①②）', () => {
    const raw = JSON.parse(readFileSync('public/games/game-z/art/index.json', 'utf8'));
    const idx = parseAssetIndex(raw);
    const mat = idx.assets.find((a) => a.id === 'mat/demo-wood');
    expect(mat).toBeDefined();
    expect(mat?.type).toBe('material');
    expect(mat?.path).toBeUndefined(); // 数据型·无文件
    expect(mat?.provenance).toMatchObject({ vendoredFrom: 'mat/wood' }); // 从共享货架 vendor 来
    // 材质走 buildMaterialCatalog（非 AssetManager 加载路径）→ 渲染器据 materialRef 查此表
    const catalog = buildMaterialCatalog(idx);
    expect(catalog.get('mat/demo-wood')).toMatchObject({ preset: 'wood' });
  });

  it('mesh（glb 文件资产）也能 vendor：文件进本地 art/·registerAssetIndex 桥成 model·spec 携带（REQ-PA-3D公用货架 ①②）', async () => {
    const raw = JSON.parse(readFileSync('public/games/game-z/art/index.json', 'utf8'));
    const idx = parseAssetIndex(raw);
    const mesh = idx.assets.find((a) => a.id === 'mesh/demo-cube');
    expect(mesh).toBeDefined();
    expect(mesh?.type).toBe('mesh');
    expect(mesh?.path).toBe('/games/game-z/art/meshes/cube.glb'); // 本地拷贝·站点绝对路径
    expect(mesh?.spec).toMatchObject({ scale: 1, genCollision: 'box' }); // spec 闭集一并搬
    expect(mesh?.provenance).toMatchObject({ vendoredFrom: 'mesh/cube' });

    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx); // mesh → {kind:'model'} 桥接
    expect(m.has('mesh/demo-cube')).toBe(true);
    const a = await m.load('mesh/demo-cube');
    expect(a.descriptor).toMatchObject({ kind: 'model', key: 'mesh/demo-cube', src: '/games/game-z/art/meshes/cube.glb' });
  });
});
