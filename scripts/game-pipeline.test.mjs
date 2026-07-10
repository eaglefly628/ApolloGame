// 生产流程板自检（owner 2026-07-10「N 步拆分·每步 review·不能只靠手册」）：
// 形态识别 · 内容指纹（排除 pipeline.json/gen-mock·变更即过期）· 看板推导（机器门×人门双验语义）。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectForm, gameHash, boardFor, artSubState, STAGES, GATE_STAGES, pipelineFile } from './game-pipeline.mjs';

const withRoot = async (fn) => { const r = mkdtempSync(join(tmpdir(), 'gpipe-')); try { return await fn(r); } finally { rmSync(r, { recursive: true, force: true }); } };
const put = (root, rel, content) => { const p = join(root, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2)); };

const MANIFEST = { name: 'G', capabilities: [], entities: { hero: { Sprite: { textureKey: 'art:knight' } } } };

describe('阶段表（八阶段·每阶段一本手册）', () => {
  it('8 阶段·手册列全非空·机器门阶段=S3/S4/S5/S8', () => {
    expect(STAGES).toHaveLength(8);
    expect(STAGES.every((s) => s.handbook)).toBe(true);
    expect(GATE_STAGES).toEqual(['S3', 'S4', 'S5', 'S8']);
  });
});

describe('形态识别', () => {
  it('library→cart · public manifest→builtin · src 目录→compiled · 都无→null', () => withRoot(async (root) => {
    put(root, 'library/g1/manifest.json', MANIFEST);
    put(root, 'public/games/g2/manifest.json', MANIFEST);
    mkdirSync(join(root, 'src/games/g3'), { recursive: true });
    expect(detectForm(root, 'g1')).toBe('cart');
    expect(detectForm(root, 'g2')).toBe('builtin');
    expect(detectForm(root, 'g3')).toBe('compiled');
    expect(detectForm(root, 'nope')).toBeNull();
  }));
});

describe('游戏内容指纹（证据过期的机器判据）', () => {
  it('稳定·文件变更即变·pipeline.json 与 gen/mock 不入指纹', () => withRoot(async (root) => {
    put(root, 'public/games/g/manifest.json', MANIFEST);
    const h0 = gameHash(root, 'g');
    expect(gameHash(root, 'g')).toBe(h0); // 幂等
    put(root, 'public/games/g/pipeline.json', { signoffs: {} });
    expect(gameHash(root, 'g')).toBe(h0); // 记账不自我过期
    put(root, 'public/games/g/art/gen/mock/art-01.png', 'noise');
    expect(gameHash(root, 'g')).toBe(h0); // mock 预览物不入指纹
    put(root, 'public/games/g/art/gen/art-01.png', 'real');
    const h1 = gameHash(root, 'g');
    expect(h1).not.toBe(h0); // 真图入指纹
    put(root, 'public/games/g/manifest.json', { ...MANIFEST, name: 'G2' });
    expect(gameHash(root, 'g')).not.toBe(h1); // manifest 变更即过期
  }));
});

describe('美术关子状态（复用五步条口径·MOCK 不算完成）', () => {
  const ledger = (rows, artStyle = {}) => ({ version: 1, artStyle, rows });
  it('无台账=dim·全 approved 无 mock=ok·有 MOCK=warn 且明说', () => withRoot(async (root) => {
    put(root, 'public/games/g/manifest.json', MANIFEST);
    expect(artSubState(root, 'g').state).toBe('dim');
    put(root, 'public/games/g/art/art-ledger.json', ledger([{ no: 'art-01', status: 'approved', gen: { mock: false } }], { packId: 'pixel-retro' }));
    expect(artSubState(root, 'g').state).toBe('ok');
    put(root, 'public/games/g/art/art-ledger.json', ledger([{ no: 'art-01', status: 'approved', gen: {} }, { no: 'art-02', status: 'replaced', gen: { mock: true } }]));
    const s = artSubState(root, 'g');
    expect(s.state).toBe('warn');
    expect(s.detail).toContain('MOCK 1');
  }));
});

describe('看板推导（机器门×人门双验）', () => {
  it('证据新鲜+签核=绿；只有机器绿=黄；exit≠0=红；指纹变=过期黄', () => withRoot(async (root) => {
    put(root, 'public/games/g/manifest.json', MANIFEST);
    const h = gameHash(root, 'g');
    put(root, pipelineFile(root, 'g').slice(root.length + 1), {
      version: 1, slug: 'g',
      concept: { name: 'G', pitch: '测试', planWaiver: '纯数据' },
      signoffs: { S1: { by: 'o', note: 'n', at: '2026-07-10T00:00:00Z' }, S3: { by: 'o', note: 'n', at: '2026-07-10T00:00:00Z' } },
      evidence: { S3: { exit: 0, gameHash: h, at: '2026-07-10T00:00:00Z' }, S4: { exit: 1, gameHash: h, at: '2026-07-10T00:00:00Z' } },
    });
    let b = boardFor(root, 'g');
    const by = (id) => b.stages.find((s) => s.id === id);
    expect(by('S1').status).toBe('ok'); // 机器 ok + 签核 ok
    expect(by('S2').status).toBe('warn'); // 免 plan 裁决在案但未签核
    expect(by('S3').status).toBe('ok'); // 证据绿 + 签核
    expect(by('S4').status).toBe('fail'); // exit 1 = 红
    expect(by('S8').status).toBe('dim'); // 未跑未签
    expect(b.next).toBe('S2'); // 第一个非绿即下一步
    // 游戏文件一动 → S3 证据过期（绿不是永久绿）
    put(root, 'public/games/g/manifest.json', { ...MANIFEST, name: 'G3' });
    b = boardFor(root, 'g');
    expect(b.stages.find((s) => s.id === 'S3').status).toBe('warn');
    expect(b.stages.find((s) => s.id === 'S3').machine.detail).toContain('过期');
  }));
  it('builtin 无 walkthrough 测试=玩法关直接红（testing.md 红线）·cart 免审计', () => withRoot(async (root) => {
    put(root, 'public/games/g/manifest.json', MANIFEST);
    const b = boardFor(root, 'g');
    expect(b.stages.find((s) => s.id === 'S4').status).toBe('fail');
    put(root, 'library/c/manifest.json', MANIFEST);
    const bc = boardFor(root, 'c');
    expect(bc.stages.find((s) => s.id === 'S5').machine.state).toBe('ok'); // 纯数据卡带天然合规
    expect(bc.form).toBe('cart');
  }));
  it('未知游戏 → ok:false', () => withRoot(async (root) => {
    expect(boardFor(root, 'ghost').ok).toBe(false);
  }));
});
