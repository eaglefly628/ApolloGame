// 美术替换工作流大脑自检（REQ-DEMO-T1·工作流档 §六 部分口径的单测层）：
// 列表推导（kind/spec/编号确定性）· palette-snap · 批量 mock 生成 + 缓存续跑 · 对位替换。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveLedger, batchGenerate, applyReplacements, dialectPrompt, cacheKey, paletteSnapRgb } from './art-replace.mjs';
import { STYLE_PACKS, STYLE_PACK_IDS } from './style-packs.mjs';

const MANIFEST = {
  capabilities: ['l2-color'],
  entities: {
    hero: { Sprite: { type: 'Sprite', textureKey: 'art:brave knight' }, Shape: { type: 'Shape', width: 48, height: 64 }, Transform: { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2 } },
    slime: { Sprite: { type: 'Sprite', textureKey: 'art:green slime' }, Shape: { type: 'Shape', radius: 20 } },
    background: { Sprite: { type: 'Sprite', textureKey: 'art:forest' } },
    coin3d: { Model3D: { type: 'Model3D', modelKey: 'art:gold coin', scale: 0.5 } },
    silent: { Sprite: { type: 'Sprite', textureKey: 'hero_idle' } }, // 非 art: → 不入台账
  },
};
const withRoot = (fn) => { const r = mkdtempSync(join(tmpdir(), 'artrep-')); try { return fn(r); } finally { rmSync(r, { recursive: true, force: true }); } };

describe('T1 ① 列表推导', () => {
  it('只收 art: 槽位·编号按槽位标识确定性分配（重跑不漂移）', () => {
    const l = deriveLedger(MANIFEST, { game: 'g' });
    expect(l.rows).toHaveLength(4); // silent 的 hero_idle 非 art: → 不入
    expect(l.rows.map((r) => r.no)).toEqual(['art-01', 'art-02', 'art-03', 'art-04']);
    // 按 entity 名排序：background < coin3d < hero < slime
    expect(l.rows.map((r) => r.slot.entity)).toEqual(['background', 'coin3d', 'hero', 'slime']);
    expect(deriveLedger(MANIFEST, { game: 'g' }).rows.map((r) => r.no)).toEqual(l.rows.map((r) => r.no)); // 稳定
  });
  it('kind 从组件/字段推·spec 从组件数据推', () => {
    const l = deriveLedger(MANIFEST, { game: 'g' });
    const by = (e) => l.rows.find((r) => r.slot.entity === e);
    expect(by('coin3d').kind).toBe('model3d');
    expect(by('coin3d').spec).toMatchObject({ scale: 0.5, polyBudget: 5000 });
    expect(by('background').kind).toBe('bg');
    expect(by('background').spec.transparent).toBe(false);
    expect(by('hero').kind).toBe('sprite');
    expect(by('hero').spec).toMatchObject({ w: 48, h: 64, displayW: 96, displayH: 128, transparent: true }); // scaleX/Y=2
    expect(by('slime').spec).toMatchObject({ w: 40, h: 40 }); // radius 20 → 40
    expect(by('hero').placeholder).toEqual({ ref: 'art:brave knight', source: 'freelib' });
    expect(by('hero').status).toBe('placeholder');
  });
});

describe('T1 ③④ 风格方言 + 缓存 + palette-snap', () => {
  it('dialectPrompt：qwen 吃中文·tripo/meshy 吃英文', () => {
    const row = { kind: 'sprite', query: 'knight' };
    expect(dialectPrompt(row, STYLE_PACKS['pixel-retro'])).toContain('16 位像素风'); // qwen→中文
    const model3d = { kind: 'model3d', query: 'coin' };
    const enPack = { ...STYLE_PACKS['pixel-retro'], params: { ...STYLE_PACKS['pixel-retro'].params, provider: 'meshy' } };
    expect(dialectPrompt(model3d, enPack)).toContain('16-bit pixel art'); // meshy→英文
  });
  it('cacheKey 稳定且随 prompt/seed 变', () => {
    const p = STYLE_PACKS['pixel-retro'].params;
    expect(cacheKey('qwen', 'a', p)).toBe(cacheKey('qwen', 'a', p));
    expect(cacheKey('qwen', 'a', p)).not.toBe(cacheKey('qwen', 'b', p));
  });
  it('paletteSnap 把像素量化进调色板（同批共用一板→成套）', () => {
    const pal = [0x000000, 0xffffff];
    const rgb = Buffer.from([10, 10, 10, 240, 240, 240]);
    paletteSnapRgb(rgb, pal);
    expect([...rgb]).toEqual([0, 0, 0, 255, 255, 255]);
  });
});

describe('T1 ④ 批量生成 + 断点续跑', () => {
  it('mock 全生成·登记本地 index·provenance 硬字段·sfx/model 之外落 png', () => withRoot(async (root) => {
    const l = deriveLedger(MANIFEST, { game: 'g' });
    const r = await batchGenerate(l, 'pixel-retro', { root, game: 'g', mock: true, at: '2026-07-09T00:00:00Z' });
    expect(r.ok).toBe(true);
    expect(r.summary).toMatchObject({ total: 4, generated: 4, cached: 0, failed: 0 });
    expect(existsSync(join(root, 'public/games/g/art/gen/art-03.png'))).toBe(true); // hero sprite
    expect(existsSync(join(root, 'public/games/g/art/gen/art-02.glb'))).toBe(true); // coin3d model
    const idx = JSON.parse(readFileSync(join(root, 'public/games/g/art/index.json'), 'utf8'));
    expect(idx.assets.some((a) => a.id === 'gen/art-03')).toBe(true);
    const row = l.rows.find((x) => x.no === 'art-03');
    expect(row.status).toBe('generated');
    expect(row.provenance).toMatchObject({ date: '2026-07-09T00:00:00Z' });
    expect(row.provenance.model && row.provenance.prompt && row.provenance.license).toBeTruthy();
  }));
  it('断点续跑：二次批处理全缓存命中·0 重生成（不重扣费）', () => withRoot(async (root) => {
    const l = deriveLedger(MANIFEST, { game: 'g' });
    await batchGenerate(l, 'pixel-retro', { root, game: 'g', mock: true });
    const r2 = await batchGenerate(l, 'pixel-retro', { root, game: 'g', mock: true });
    expect(r2.summary.cached).toBe(4);
    expect(r2.summary.generated).toBe(0);
  }));
  it('无 key 且非 mock → 凭证探针输出 + mock 占位（绝不静默顶替）', () => withRoot(async (root) => {
    const l = deriveLedger(MANIFEST, { game: 'g' });
    const r = await batchGenerate(l, 'pixel-retro', { root, game: 'g', mock: false, env: {} }); // 无 key
    expect(r.summary.probes.length).toBeGreaterThan(0);
    expect(r.summary.probes[0]).toMatchObject({ configured: false });
    expect(r.summary.mock).toBeGreaterThan(0); // 落 mock 占位
  }));
});

describe('T1 ⑤ 对位替换', () => {
  it('generated 行重钉 manifest 引用为本地 id·status→replaced·原 manifest 不改', () => withRoot(async (root) => {
    const l = deriveLedger(MANIFEST, { game: 'g' });
    await batchGenerate(l, 'pixel-retro', { root, game: 'g', mock: true });
    const rep = applyReplacements(MANIFEST, l);
    expect(rep.replaced).toBe(4);
    expect(rep.manifest.entities.hero.Sprite.textureKey).toBe('gen/art-03'); // 不再是 art:
    expect(rep.manifest.entities.coin3d.Model3D.modelKey).toBe('gen/art-02');
    expect(rep.manifest.entities.silent.Sprite.textureKey).toBe('hero_idle'); // 非 art: 不动
    expect(MANIFEST.entities.hero.Sprite.textureKey).toBe('art:brave knight'); // 原 manifest 未改
    expect(l.rows.every((r) => r.status === 'replaced')).toBe(true);
  }));
  it('§六④ 编号稳定性：改一行重跑，其余行编号/资产不动', () => withRoot(async (root) => {
    const l = deriveLedger(MANIFEST, { game: 'g' });
    await batchGenerate(l, 'pixel-retro', { root, game: 'g', mock: true });
    const beforeNos = l.rows.map((r) => r.no);
    // 单槽优化（同风格包·改一行 prompt 重跑）：只该行新 cacheKey 重生成，其余命中缓存不动
    const target = l.rows.find((r) => r.no === 'art-03');
    target.status = 'placeholder'; target.query = 'dark knight'; target.gen = null;
    const r = await batchGenerate(l, 'pixel-retro', { root, game: 'g', mock: true });
    expect(l.rows.map((x) => x.no)).toEqual(beforeNos); // 编号全不动
    expect(r.summary.cached).toBe(3); // 其余 3 行命中缓存不动（不重扣费）
    expect(r.summary.generated).toBe(1); // 只重生成 art-03
  }));
});

describe('T1 风格包库', () => {
  it('至少 3 包·各带双语 prompt/palette/params(provider)', () => {
    expect(STYLE_PACK_IDS.length).toBeGreaterThanOrEqual(3);
    for (const id of STYLE_PACK_IDS) {
      const p = STYLE_PACKS[id];
      expect(p.promptZh && p.promptEn).toBeTruthy();
      expect(Array.isArray(p.palette) && p.palette.length).toBeTruthy();
      expect(['qwen', 'tripo', 'meshy']).toContain(p.params.provider);
    }
  });
});
