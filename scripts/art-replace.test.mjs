// 美术替换工作流大脑自检（REQ-DEMO-T1·工作流档 §六 部分口径的单测层）：
// 列表推导（kind/spec/编号确定性）· palette-snap · 批量 mock 生成 + 缓存续跑 · 对位替换。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveLedger, batchGenerate, applyReplacements, dialectPrompt, cacheKey, paletteSnapRgb, deriveRequirements, resetRow, swapSlot, mergeLedger } from './art-replace.mjs';
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

describe('需求推导（retrofit·色块游戏无 art: 槽位时）', () => {
  const Q_MANIFEST = {
    entities: {
      base: { Mesh3D: { shape: 'sphere' }, Color: { tint: 0x8effc9 }, Material3D: { emissive: 0x8effc9 } },
      hidden: { Shape: { kind: 'box', width: 50, height: 50 }, Visibility: { visible: false } }, // 隐形碰撞体不计
      logic: { Resource: { id: 'gold', current: 0 } }, // 纯逻辑不计
      'pad-0-p': { Mesh3D: { shape: 'cylinder', frontTint: 0x2b6f86 } },
      'pad-1-p': { Mesh3D: { shape: 'cylinder', frontTint: 0x2b6f86 } },
      'pad-2-p': { Mesh3D: { shape: 'cylinder', frontTint: 0x2b6f86 } },
      lib: { PrefabLibrary: { templates: { enemy_basic: { entities: { body: { Mesh3D: { shape: 'sphere', frontTint: 0xff0000 }, Material3D: { emissive: 0xff0000 } } } } } } },
    },
  };
  it('扫视觉实体+预制模板·归并结构等价实例·跳过隐形/纯逻辑', () => {
    const r = deriveRequirements(Q_MANIFEST, { game: 'q' });
    expect(r.mode).toBe('requirements');
    expect(r.instances).toBe(5); // base + 3 pads + prefab body（hidden/logic 不计）
    expect(r.count).toBe(3); // base · pad-p(×3 归一) · prefab enemy body
    const pad = r.rows.find((x) => x.query.includes('pad'));
    expect(pad.placeholder.count).toBe(3); // 3 个 pad 归成一条
    expect(r.rows.every((x) => x.kind === 'model3d')).toBe(true); // 全 Mesh3D → model3d
    expect(r.rows.every((x) => x.status === 'needs-art' && x.context.includes('美术需求'))).toBe(true);
  });
});

describe('T2 单槽重解析地基（点名优化/三式替换）', () => {
  it('resetRow：单行打回待生成·可改 query·留 history', () => {
    const l = deriveLedger(MANIFEST, { game: 'g' });
    l.rows[0].status = 'generated'; l.rows[0].gen = { cacheKey: 'x' };
    const r = resetRow(l, l.rows[0].no, { query: 'new prompt' });
    expect(r.ok).toBe(true);
    expect(l.rows[0].status).toBe('placeholder');
    expect(l.rows[0].query).toBe('new prompt');
    expect(l.rows[0].gen).toBeNull();
    expect(l.rows[0].history[0].action).toBe('regen');
    expect(resetRow(l, 'art-99', {}).ok).toBe(false); // 无此编号
  });
  it('swapSlot：把某槽引用直接钉到已存在资产 id·status→replaced·原 manifest 不改', () => {
    const l = deriveLedger(MANIFEST, { game: 'g' });
    const heroRow = l.rows.find((x) => x.slot.entity === 'hero');
    const r = swapSlot(MANIFEST, l, heroRow.no, 'dungeon/knight_blue', { source: 'library' });
    expect(r.ok).toBe(true);
    expect(r.manifest.entities.hero.Sprite.textureKey).toBe('dungeon/knight_blue');
    expect(MANIFEST.entities.hero.Sprite.textureKey).toBe('art:brave knight'); // 原不改
    expect(heroRow.status).toBe('replaced');
    expect(heroRow.gen.source).toBe('library');
    expect(heroRow.history.some((h) => h.action === 'swap-library')).toBe(true);
  });
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

describe('编号 append-only（owner 07-09「ID 错位」定案·mergeLedger）', () => {
  it('加槽位重跑：旧号全不动·新槽位取 max+1 顺延', () => {
    const prev = deriveLedger(MANIFEST, { game: 'g' }); // art-01..04
    const bigger = JSON.parse(JSON.stringify(MANIFEST));
    bigger.entities.aaa_new = { Sprite: { type: 'Sprite', textureKey: 'art:new thing' }, Shape: { type: 'Shape', width: 8, height: 8 } };
    const merged = mergeLedger(prev, deriveLedger(bigger, { game: 'g' }));
    // aaa_new 排序在最前，但编号必须是 art-05（追加），background 保持 art-01
    expect(merged.rows.find((r) => r.slot.entity === 'aaa_new').no).toBe('art-05');
    expect(merged.rows.find((r) => r.slot.entity === 'background').no).toBe('art-01');
    expect(merged.rows.map((r) => r.no)).toEqual(['art-01', 'art-02', 'art-03', 'art-04', 'art-05']);
  });
  it('删槽位重跑：墓碑 retired 保号·编号不复用；再加新槽位继续顺延', () => {
    const prev = deriveLedger(MANIFEST, { game: 'g' });
    const smaller = JSON.parse(JSON.stringify(MANIFEST));
    delete smaller.entities.hero; // hero 原 art-03
    const merged = mergeLedger(prev, deriveLedger(smaller, { game: 'g' }));
    const hero = merged.rows.find((r) => r.slot.entity === 'hero');
    expect(hero.status).toBe('retired'); // 墓碑
    expect(hero.no).toBe('art-03'); // 保号
    const withNew = JSON.parse(JSON.stringify(smaller));
    withNew.entities.zzz = { Sprite: { type: 'Sprite', textureKey: 'art:late comer' }, Shape: { type: 'Shape', width: 8, height: 8 } };
    const m2 = mergeLedger(merged, deriveLedger(withNew, { game: 'g' }));
    expect(m2.rows.find((r) => r.slot.entity === 'zzz').no).toBe('art-05'); // max(4)+1·不占 hero 的 3
  });
  it('已生成状态/provenance/prompt 在重跑合并后保留', async () => {
    await withRoot(async (root) => {
      const prev = deriveLedger(MANIFEST, { game: 'g' });
      await batchGenerate(prev, 'pixel-retro', { root, game: 'g', mock: true });
      prev.rows[0].prompt = '手工精调提示词';
      const merged = mergeLedger(prev, deriveLedger(MANIFEST, { game: 'g' }));
      expect(merged.rows[0].status).toBe('generated');
      expect(merged.rows[0].prompt).toBe('手工精调提示词');
      expect(merged.rows[0].provenance?.model).toBeTruthy();
    });
  });
});

describe('皮肤槽写回（编译期游戏线·R2 ①）', () => {
  const SKINNED = {
    entities: {
      body: { Sprite: { type: 'Sprite', textureKey: 'q/hero', anchorX: 0.5, anchorY: 0.5, zOrder: 0 }, Shape: { type: 'Shape', width: 24, height: 24 }, Color: { type: 'Color', tint: 0x112233, alpha: 1 } },
    },
  };
  it('deriveRequirements 识别皮肤槽 → 行带 skinKey', () => {
    const l = deriveRequirements(SKINNED, { game: 'g' });
    expect(l.rows).toHaveLength(1);
    expect(l.rows[0].skinKey).toBe('q/hero');
    expect(l.rows[0].placeholder.current).toContain('皮肤槽 q/hero');
  });
  it('batchGenerate 对带 skinKey 的行双登记：gen id + 皮肤别名（写回=登记别名）', async () => {
    await withRoot(async (root) => {
      const l = deriveRequirements(SKINNED, { game: 'g' });
      const res = await batchGenerate(l, 'pixel-retro', { root, game: 'g', mock: true, only: l.rows[0].no });
      expect(res.summary.generated).toBe(1);
      const idx = JSON.parse(readFileSync(join(root, 'public', 'games', 'g', 'art', 'index.json'), 'utf8'));
      const ids = idx.assets.map((a) => a.id);
      expect(ids).toContain('gen/' + l.rows[0].no);
      expect(ids).toContain('q/hero'); // 别名=游戏消费的皮肤 key
      expect(idx.assets.find((a) => a.id === 'q/hero').tags).toContain('skin');
    });
  });
  it('dialectPrompt：行内 prompt（手拼回填）整体替代 query 作主体', () => {
    const pack = STYLE_PACKS['pixel-retro'];
    const row = { no: 'art-01', kind: 'sprite', query: 'hero', prompt: 'a very specific hand-tuned prompt' };
    expect(dialectPrompt(row, pack)).toContain('a very specific hand-tuned prompt');
    expect(dialectPrompt(row, pack)).not.toMatch(/^hero,/);
  });
});
