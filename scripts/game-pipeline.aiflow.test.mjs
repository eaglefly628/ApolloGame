// Wave 1施工验证：只在临时根建立工件与身份fixture，不签生产人门，不作复查判词。
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { encodePngRGBA } from './asset-matte.mjs';
import { STAGES, GATE_STAGES, REVIEW_STAGES, boardFor, pipelineFile, gameHash, readHumans, validateHumanSigner, aiFlowArtifacts, aiFlowHash, priorGaps, orderGate } from './game-pipeline.mjs';

const roots = [];
function fixture({ enabled = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aiflow-gates-')); roots.push(root);
  mkdirSync(join(root, 'docs/design/demo'), { recursive: true });
  if (enabled) mkdirSync(join(root, 'docs/design/demo/keyart'));
  return root;
}
function put(root, path, data) {
  const file = join(root, path); mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}
const humans = (root, names = ['Ada', '王小明']) => put(root, 'docs/roles/humans.json', { humans: names });
const png = (red = 20) => encodePngRGBA(2, 2, Buffer.from(Array.from({ length: 4 }, () => [red, 30, 40, 255]).flat()));
const row = (extra = {}) => ({ id: 'tree', scene: 'yard', bbox: [0, 0, 2, 2], route: 'generate', skinKey: 'prop:tree', prompt: 'A tree', refs: [], state: 'approved', ...extra });
const keyart = (root, color = 20) => put(root, 'docs/design/demo/keyart/yard.png', png(color));
const split = (root, rows = [row()]) => put(root, 'docs/design/demo/asset-split.json', rows);
const reviewDoc = (root, content = '# R1 keyart review\n\n待独立复查\n') => put(root, 'docs/design/demo/self-check/R1-keyart-review.md', content);
function completeArtifacts(root) { keyart(root); split(root); reviewDoc(root); }
const stage = (root, id) => boardFor(root, 'demo').stages.find(s => s.id === id);
const readPipeline = root => JSON.parse(readFileSync(pipelineFile(root, 'demo'), 'utf8'));
function writePipeline(root, extra = {}) { put(root, 'public/games/demo/pipeline.json', { version: 1, slug: 'demo', concept: {}, signoffs: {}, evidence: {}, reviews: {}, ...extra }); }
const CLI = fileURLToPath(new URL('./game-pipeline.mjs', import.meta.url));
function cli(root, ...args) { return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, ZEROCRAFT_PIPELINE_ROOT: root } }); }
function sign(root, id, by = 'Ada') { return cli(root, 'signoff', 'demo', id, '--note', '临时fixture人审证据', '--by', by); }
function review(root, by = 'Claude', builder = 'Codex') { return cli(root, 'review', 'demo', 'R1', '--verdict', 'CONCERNS', '--note', '临时fixture独立复查协议', '--by', by, '--builder', builder); }
afterEach(() => { vi.restoreAllMocks(); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });

describe('AI flow production stages and artifact gates', () => {
  it('orders all 11 stages and places K2/D1 human gates and R1 independent review gate', () => {
    expect(STAGES.map(s => s.id)).toEqual(['S1', 'S2', 'K2', 'D1', 'S3', 'S4', 'S5', 'S6', 'R1', 'S7', 'S8']);
    expect(GATE_STAGES).toEqual(['S2', 'K2', 'D1', 'S3', 'S4', 'S5', 'R1', 'S8']);
    expect(REVIEW_STAGES).toEqual(['S2', 'S3', 'S4', 'S5', 'R1', 'S8']);
    const root = fixture();
    for (const id of ['K2', 'D1', 'R1']) expect(stage(root, id).machine.state).toBe('fail');
  });
  it('K2 requires a genuine root keyart PNG, excluding annotated splits and nested mock previews', () => {
    const root = fixture();
    put(root, 'docs/design/demo/keyart/mock/yard.png', png());
    put(root, 'docs/design/demo/keyart/yard-split.png', png());
    expect(aiFlowArtifacts(root, 'demo', 'K2').state).toBe('fail');
    put(root, 'docs/design/demo/keyart/yard.png', 'not a PNG');
    expect(aiFlowArtifacts(root, 'demo', 'K2').state).toBe('fail');
    keyart(root);
    expect(aiFlowArtifacts(root, 'demo', 'K2').state).toBe('ok');
  });
  it('D1 rejects empty, malformed, proposed, orphan skinKey and out-of-contract rows', () => {
    const root = fixture();
    for (const input of [[], [row({ state: 'proposed' })], [row({ skinKey: '' })], [row({ route: 'unknown' })], [row({ bbox: [0, 0, 0, 2] })]]) {
      split(root, input);
      expect(aiFlowArtifacts(root, 'demo', 'D1').state, JSON.stringify(input)).toBe('fail');
    }
    put(root, 'docs/design/demo/asset-split.json', '{broken');
    expect(aiFlowArtifacts(root, 'demo', 'D1').state).toBe('fail');
    split(root, [row(), row({ id: 'rock', skinKey: 'prop:rock' })]);
    expect(aiFlowArtifacts(root, 'demo', 'D1').state).toBe('ok');
  });
  it('R1 requires nonempty real review file and ignores mock directory', () => {
    const root = fixture();
    put(root, 'docs/design/demo/self-check/mock/R1-keyart-review.md', '# Mock');
    expect(aiFlowArtifacts(root, 'demo', 'R1').state).toBe('fail');
    reviewDoc(root, ' \n\t');
    expect(aiFlowArtifacts(root, 'demo', 'R1').state).toBe('fail');
    reviewDoc(root);
    expect(aiFlowArtifacts(root, 'demo', 'R1').state).toBe('ok');
    expect(stage(root, 'R1').review.state).not.toBe('ok'); // skeleton is not a reviewer verdict
  });
  it('derives machine states from files without requiring saved gate evidence', () => {
    const root = fixture(); completeArtifacts(root);
    for (const id of ['K2', 'D1', 'R1']) expect(stage(root, id).machine.state).toBe('ok');
    expect(stage(root, 'K2').review.state).toBe('ok');
    expect(stage(root, 'D1').review.state).toBe('ok');
    expect(stage(root, 'K2').human.state).not.toBe('ok');
    expect(stage(root, 'D1').human.state).not.toBe('ok');
    expect(stage(root, 'R1').human.state).toBe('ok');
    expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
  });
  it('artifact fingerprints are deterministic, bind meaningful content and exclude mock images', () => {
    const root = fixture(); completeArtifacts(root);
    const h = Object.fromEntries(['K2', 'D1', 'R1'].map(id => [id, aiFlowHash(root, 'demo', id)]));
    for (const id of ['K2', 'D1', 'R1']) expect(aiFlowHash(root, 'demo', id)).toBe(h[id]);
    put(root, 'docs/design/demo/keyart/mock/yard.png', png(200));
    expect(aiFlowHash(root, 'demo', 'K2')).toBe(h.K2);
    keyart(root, 180);
    expect(aiFlowHash(root, 'demo', 'K2')).not.toBe(h.K2);
    split(root, [row({ prompt: 'changed input' })]);
    expect(aiFlowHash(root, 'demo', 'D1')).not.toBe(h.D1);
    reviewDoc(root, '# Changed reference evidence');
    put(root, 'docs/design/demo/self-check/r1/yard/metrics.json', '{"changed":true}');
    expect(aiFlowHash(root, 'demo', 'R1')).not.toBe(h.R1);
  });
  it('does not follow escaped symlink artifacts into another workspace', () => {
    const root = fixture(), outside = fixture();
    keyart(outside);
    mkdirSync(join(root, 'docs/design/demo/keyart'), { recursive: true });
    symlinkSync(join(outside, 'docs/design/demo/keyart/yard.png'), join(root, 'docs/design/demo/keyart/yard.png'));
    expect(aiFlowArtifacts(root, 'demo', 'K2').state).toBe('fail');
  });
});

describe('human whitelist — deny by default, no agent signatures', () => {
  it('requires owner population when file is missing or whitelist is empty', () => {
    const root = fixture();
    expect(readHumans(root).ok).toBe(false);
    expect(validateHumanSigner(root, 'Ada').ok).toBe(false);
    humans(root, []);
    const result = validateHumanSigner(root, 'Ada');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('请 owner 填 docs/roles/humans.json');
  });
  it.each(['{broken', '{}', '{"humans":"Ada"}', '{"humans":[{}]}'])('rejects corrupt whitelist %s', content => {
    const root = fixture(); put(root, 'docs/roles/humans.json', content);
    expect(readHumans(root).ok).toBe(false);
    expect(validateHumanSigner(root, 'Ada').ok).toBe(false);
  });
  it('accepts only explicit people from the populated whitelist', () => {
    const root = fixture(); humans(root);
    expect(readHumans(root)).toMatchObject({ ok: true, humans: ['Ada', '王小明'] });
    expect(validateHumanSigner(root, 'Ada').ok).toBe(true);
    expect(validateHumanSigner(root, '王小明').ok).toBe(true);
    for (const by of [undefined, '', '  ', 'Unknown']) expect(validateHumanSigner(root, by).ok).toBe(false);
  });
  it.each(['Codex', 'Claude', 'Lead', 'Lead-Codex', 'agent', 'bot', 'GPT', 'gpt-6', 'Ｃｏｄｅｘ'])('rejects agent role %s even if listed as a human', by => {
    const root = fixture(); humans(root, [by]);
    expect(validateHumanSigner(root, by).ok).toBe(false);
  });
  it('B2 legacy signoffs remain valid without the current whitelist and only agent roles gain a warning', () => {
    const root = fixture();
    for (const by of ['Lead-Codex', 'Past Human']) {
      writePipeline(root, {
        concept: { name: 'Demo', pitch: 'p' },
        signoffs: { S1: { by, note: 'historical signature', at: '2026-01-01' } },
      });
      for (const list of [undefined, '{broken', { humans: [] }, { humans: ['Codex'] }]) {
        if (list !== undefined) put(root, 'docs/roles/humans.json', list);
        const s1 = stage(root, 'S1');
        expect(s1.machine.state).toBe('ok');
        expect(s1.human.state).toBe('ok');
        expect(s1.status).toBe('ok');
        if (by === 'Lead-Codex') expect(s1.human.detail).toContain('⚠ 非真人签');
        else expect(s1.human.detail).not.toContain('⚠ 非真人签');
      }
    }
  });
  it.each(['codex', 'claude', 'gpt-image'])('B3 whole whitelist rejects agent entry %s even when signer Ada is valid', by => {
    const root = fixture(); humans(root, ['Ada', by]);
    expect(readHumans(root).ok).toBe(false);
    expect(validateHumanSigner(root, 'Ada').ok).toBe(false);
    const result = sign(root, 'S1', 'Ada');
    expect(result.status).not.toBe(0);
    expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
  });
  it.each(['Abbott', 'Claudette', 'Ai Wei', '王 AI'])('B3 whole word guard allows real name %s and CLI writes only the temporary ledger', by => {
    const root = fixture(); humans(root, [by]);
    expect(readHumans(root)).toMatchObject({ ok: true, humans: [by] });
    expect(validateHumanSigner(root, by).ok).toBe(true);
    const result = sign(root, 'S1', by);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readPipeline(root).signoffs.S1.by).toBe(by);
  });
  it('rejects signoff without --by and leaves the pipeline absent', () => {
    const root = fixture(); humans(root);
    const result = cli(root, 'signoff', 'demo', 'S1', '--note', 'fixture');
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain('--by');
    expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
  });
  it.each(['S1', 'S2', 'S3', 'S4', 'S5', 'S7', 'S8', 'K2', 'D1'])('enforces whitelist in CLI stage %s and writes no denied signature', id => {
    const root = fixture(); completeArtifacts(root); humans(root, []);
    let result = sign(root, id);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain('请 owner 填 docs/roles/humans.json');
    expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
    humans(root, ['Codex']);
    result = sign(root, id, 'Codex');
    expect(result.status).not.toBe(0);
    expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
  });
  it('a refusal preserves an existing ledger byte-for-byte', () => {
    const root = fixture(); humans(root);
    writePipeline(root, { signoffs: { S1: { by: 'Ada', note: 'earlier valid signature' } } });
    const before = readFileSync(pipelineFile(root, 'demo'), 'utf8');
    expect(sign(root, 'S3', 'Unknown').status).not.toBe(0);
    expect(readFileSync(pipelineFile(root, 'demo'), 'utf8')).toBe(before);
  });
});

describe('K2/D1 signature freshness and independent R1 review CLI', () => {
  it.each(['K2', 'D1', 'R1'])('runs artifact-only %s gate for design-only games without old order requirements', id => {
    const root = fixture(); completeArtifacts(root);
    const result = cli(root, 'gate', 'demo', id);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readPipeline(root).evidence[id].exit).toBe(0);
    expect(readPipeline(root).outOfOrder).toBeUndefined();
    expect(readPipeline(root).signoffs).toEqual({});
  });
  it.each(['K2', 'D1', 'R1'])('records actual missing-artifact red evidence for %s', id => {
    const root = fixture();
    const result = cli(root, 'gate', 'demo', id);
    expect(result.status).not.toBe(0);
    expect(result.status).not.toBe(2); // this is a machine failure, not "no implementation" usage rejection
    expect(readPipeline(root).evidence[id].exit).not.toBe(0);
    expect(stage(root, id).machine.state).toBe('fail');
  });
  it.each(['K2', 'D1'])('human signs %s with artifact hash, and changed source invalidates that signature', id => {
    const root = fixture(); completeArtifacts(root); humans(root);
    const result = sign(root, id);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const so = readPipeline(root).signoffs[id];
    expect(so.by).toBe('Ada');
    expect(so.artifactHash).toBe(aiFlowHash(root, 'demo', id));
    expect(stage(root, id).human.state).toBe('ok');
    expect(stage(root, id).status).toBe('ok');
    if (id === 'K2') keyart(root, 210); else split(root, [row({ prompt: 'new approved contents' })]);
    expect(stage(root, id).machine.state).toBe('ok');
    expect(stage(root, id).human.state).toBe('stale');
    expect(stage(root, id).status).not.toBe('ok');
  });
  it('R1 requires explicit builder and normalized distinct reviewer identity before any write', () => {
    const root = fixture(); completeArtifacts(root);
    const missing = cli(root, 'review', 'demo', 'R1', '--verdict', 'CONCERNS', '--note', 'fixture', '--by', 'Claude');
    expect(missing.status).not.toBe(0);
    expect(missing.stdout + missing.stderr).toContain('--builder');
    expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
    for (const [by, builder] of [[' Codex ', 'codex'], ['Ｂｕｉｌｄｅｒ', 'builder']]) {
      const same = review(root, by, builder);
      expect(same.status).not.toBe(0);
      expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
    }
  });
  it('independent agent review is allowed, carries builder and artifact hash, and expires after artifact changes', () => {
    const root = fixture(); completeArtifacts(root); humans(root, []);
    const result = review(root);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const rv = readPipeline(root).reviews.R1;
    expect(rv).toMatchObject({ by: 'Claude', builder: 'Codex', verdict: 'CONCERNS', artifactHash: aiFlowHash(root, 'demo', 'R1') });
    expect(stage(root, 'R1').review.state).toBe('ok');
    expect(stage(root, 'R1').human.state).toBe('ok');
    expect(stage(root, 'R1').status).toBe('ok');
    reviewDoc(root, '# Updated R1 evidence\n');
    put(root, 'docs/design/demo/self-check/r1/yard/metrics.json', '{"changed":true}');
    expect(stage(root, 'R1').review.state).toBe('stale');
    expect(stage(root, 'R1').status).not.toBe('ok');
  });
  it('rejects stored R1 records with missing builder or same normalized actor', () => {
    const root = fixture(); completeArtifacts(root);
    const base = { by: 'Claude', verdict: 'CONCERNS', note: 'fixture', artifactHash: aiFlowHash(root, 'demo', 'R1'), gameHash: gameHash(root, 'demo') };
    for (const rv of [base, { ...base, builder: ' claude ' }]) {
      writePipeline(root, { reviews: { R1: rv } });
      expect(stage(root, 'R1').review.state).toBe('fail');
      expect(stage(root, 'R1').status).toBe('fail');
    }
  });
  it('R1 has no separate signoff route and machine artifacts never auto-sign K2/D1', () => {
    const root = fixture(); completeArtifacts(root); humans(root);
    expect(sign(root, 'R1').status).not.toBe(0);
    expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
    expect(stage(root, 'K2').status).not.toBe('ok');
    expect(stage(root, 'D1').status).not.toBe('ok');
  });
});


describe('B1 opt-in preserves the historical production board', () => {
  it('B1 disabled board rows are explicitly inapplicable and do not add next or order debt', () => {
    const root = fixture({ enabled: false });
    writePipeline(root, { concept: { name: 'Demo', pitch: 'p' }, signoffs: { S1: { by: 'Past Human', note: 'historical' } } });
    const board = boardFor(root, 'demo');
    for (const id of ['K2', 'D1', 'R1']) {
      const st = board.stages.find(s => s.id === id);
      expect(st.applicable).toBe(false);
      expect(st.status).toBe('ok');
      for (const gate of ['machine', 'review', 'human']) expect(st[gate]).toEqual({ state: 'ok', detail: '— 不适用' });
      expect(orderGate(board, id)).toEqual({ allowed: true, gaps: [] });
    }
    expect(board.next).toBe('S2');
    expect(priorGaps(board, 'S5').map(g => g.id)).toEqual(['S2', 'S3', 'S4']);
    expect(orderGate(board, 'S5').gaps.map(g => g.id)).toEqual(['S2', 'S3', 'S4']);
  });
  it('B1 enabling uses keyart directory OR explicit aiflow true, and false flag does not override directory', () => {
    const root = fixture({ enabled: false });
    expect(stage(root, 'K2').applicable).toBe(false);
    writePipeline(root, { aiflow: true });
    expect(stage(root, 'K2').applicable).not.toBe(false);
    expect(stage(root, 'K2').machine.state).toBe('fail');
    writePipeline(root, { aiflow: false });
    expect(stage(root, 'K2').applicable).toBe(false);
    mkdirSync(join(root, 'docs/design/demo/keyart'));
    for (const id of ['K2', 'D1', 'R1']) {
      expect(stage(root, id).applicable).not.toBe(false);
      expect(stage(root, id).machine.state).toBe('fail');
    }
  });
  it.each(['K2', 'D1', 'R1'])('B1 disabled %s CLI gate skips without creating evidence or a ledger', id => {
    const root = fixture({ enabled: false });
    const result = cli(root, 'gate', 'demo', id);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout + result.stderr).toContain('不适用');
    expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
  });
  it('B1 disabled R1 review and K2/D1 signatures cannot enable the flow through a side effect', () => {
    const root = fixture({ enabled: false }); humans(root);
    for (const id of ['K2', 'D1']) expect(sign(root, id).status).not.toBe(0);
    expect(review(root).status).not.toBe(0);
    expect(existsSync(pipelineFile(root, 'demo'))).toBe(false);
    expect(stage(root, 'K2').applicable).toBe(false);
  });

  // Captured by executing 7304e4bab^:scripts/game-pipeline.mjs against these real,
  // unchanged game files on 2026-10-17. Do not infer the expected rows from new STAGES.
  // No production file is written; the snapshots also pin all existing S1-S8 debts.
  const legacy = {
    game108: [
      ['S1', 'ok', 'ok', 'ok', 'ok'], ['S2', 'warn', 'ok', 'stale', 'ok'],
      ['S3', 'warn', 'stale', 'stale', 'ok'], ['S4', 'warn', 'stale', 'stale', 'ok'],
      ['S5', 'warn', 'stale', 'stale', 'dim'], ['S6', 'warn', 'warn', 'ok', 'dim'],
      ['S7', 'warn', 'stale', 'dim', 'dim'], ['S8', 'dim', 'dim', 'dim', 'dim'],
    ],
    game112: [
      ['S1', 'ok', 'ok', 'ok', 'ok'], ['S2', 'warn', 'ok', 'stale', 'ok'],
      ['S3', 'warn', 'stale', 'stale', 'ok'], ['S4', 'warn', 'stale', 'stale', 'ok'],
      ['S5', 'warn', 'stale', 'stale', 'ok'], ['S6', 'warn', 'warn', 'ok', 'dim'],
      ['S7', 'warn', 'stale', 'dim', 'ok'], ['S8', 'warn', 'dim', 'stale', 'ok'],
    ],
  };
  it.each(['game108', 'game112'])('B1 real %s S1-S8 and S5 order debt equal the pre-wave baseline snapshot', slug => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const board = boardFor(root, slug);
    expect(board.ok).toBe(true);
    const oldRows = board.stages.filter(s => /^S[1-8]$/.test(s.id));
    expect(oldRows.map(s => [s.id, s.status, s.machine.state, s.review.state, s.human.state])).toEqual(legacy[slug]);
    expect(board.next).toBe('S2');
    expect(priorGaps(board, 'S5').map(g => ({ id: g.id, owes: g.owes }))).toEqual([
      { id: 'S2', owes: ['复查门(stale)'] },
      { id: 'S3', owes: ['机器门(stale)', '复查门(stale)'] },
      { id: 'S4', owes: ['机器门(stale)', '复查门(stale)'] },
    ]);
    const order = orderGate(board, 'S5');
    expect(order.allowed).toBe(false);
    expect(order.gaps).toHaveLength(3);
    expect(order.gaps.map(g => g.id)).toEqual(['S2', 'S3', 'S4']);
    expect(order.reviewGaps.map(g => ({ id: g.id, state: g.state }))).toEqual([{ id: 'S2', state: 'stale' }]);
    for (const id of ['K2', 'D1', 'R1']) expect(board.stages.find(s => s.id === id).applicable).toBe(false);
  });
});
