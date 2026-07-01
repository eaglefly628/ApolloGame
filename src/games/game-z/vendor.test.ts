// REQ-Resource ⑤：vendoring 产物自检——scripts/vendor-asset.mjs 把共享库资源 copy 进游戏本地美术目录 +
// 写本地索引 public/games/game-z/art/index.json。此测试证明该本地索引可被引擎统一 Asset 路线直接消费
// （parseAssetIndex 校验通过 + registerAssetIndex 桥接成可加载资产·站点绝对路径 baseUrl ''）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseAssetIndex, registerAssetIndex, AssetManager, StubAssetLoader } from '@assets/index.js';

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
});
