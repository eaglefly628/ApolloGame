import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ADAPTERS, mockImage, writePending, locations } from './ai-gen.mjs';
import { prepareTripoInputs, parseTripoGenerationArgs, TRIPO_VIEWS, TRIPO_IMAGE_MODEL } from './tripo-generation.mjs';

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'tripo-test-')); roots.push(root);
  const views = Object.fromEntries(['front', 'left', 'back', 'right'].map(view => {
    const path = join(root, `${view}.png`); writeFileSync(path, mockImage(view, 16).buffer); return [view, path];
  }));
  return { root, views, file: views.front };
}
function glb() {
  const positions = Buffer.alloc(36); [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => positions.writeFloatLE(v, i * 4));
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }], bufferViews: [{ buffer: 0, byteLength: 36 }], buffers: [{ byteLength: 36 }] }));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + positions.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const bin = Buffer.alloc(8); bin.writeUInt32LE(positions.length); bin.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, padded, bin, positions]);
}
function expectMesh(buffer) {
  expect(buffer.readUInt32LE(0)).toBe(0x46546c67); expect(buffer.readUInt32LE(4)).toBe(2); expect(buffer.readUInt32LE(8)).toBe(buffer.length);
  const doc = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  expect(doc.meshes.length).toBeGreaterThan(0); expect(doc.meshes[0].primitives.length).toBeGreaterThan(0);
}
const jsonResponse = data => ({ ok: true, status: 200, json: async () => data });
function transport(overrides = {}) {
  const calls = []; let uploads = 0;
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    if (String(url).endsWith('/files')) return overrides.upload?.(url, opts) ?? jsonResponse({ code: 0, data: { file_token: `token-${uploads++}` } });
    if (String(url).includes('/generation/')) return overrides.submit?.(url, opts) ?? jsonResponse({ code: 0, data: { task_id: 'task-fixture' } });
    if (String(url).includes('/tasks/')) return overrides.poll?.(url, opts) ?? jsonResponse({ code: 0, data: { status: 'success', output: { model_url: 'https://cdn.example.invalid/model.glb' } } });
    if (String(url) === 'https://cdn.example.invalid/model.glb') return overrides.download?.(url, opts) ?? { ok: true, status: 200, arrayBuffer: async () => glb() };
    throw new Error(`Unexpected request ${url}`);
  };
  return { calls, fetchImpl };
}
const live = fetchImpl => ({ apiKey: 'secret-fixture-key', fetchImpl, pollIntervalMs: 0, maxPolls: 2 });

describe('T3 offline input and mesh contract', () => {
  it('single PNG stays mesh GLB; explicit mock and absent key never fetch; input hashes seed deterministic bytes', async () => {
    const { file } = fixture(); let calls = 0;
    const opts = { refs: [file], fetchImpl: async () => { calls++; throw new Error('network forbidden'); } };
    const a = await ADAPTERS.tripo.generate('chair', { ...opts, mock: true, apiKey: 'unused' });
    const b = await ADAPTERS.tripo.generate('chair', opts);
    expectMesh(a.buffer); expect(a.buffer).toEqual(b.buffer); expect(a.mock).toBe(true); expect(calls).toBe(0);
    expect(a.generation).toMatchObject({ operation: 'image_to_model', apiVersion: 'v3' }); expect(a.generation).not.toHaveProperty('taskId');
    expect(a.model).toMatch(/mock/); expect(a.references[0].sha256).toBe(sha(readFileSync(file)));
    writeFileSync(file, mockImage('changed input', 16).buffer);
    const c = await ADAPTERS.tripo.generate('chair', { ...opts, mock: true }); expect(c.buffer.equals(a.buffer)).toBe(false);
  });
  it('all CLI flag orders normalize front left back right, retaining each distinct image hash', () => {
    const { views } = fixture(); expect(TRIPO_VIEWS).toEqual(['front', 'left', 'back', 'right']);
    for (const order of [['right', 'back', 'front', 'left'], ['left', 'front', 'right', 'back']]) {
      const parsed = parseTripoGenerationArgs(['chair', ...order.flatMap(v => [`--${v}`, views[v]]), '--mock']);
      const prepared = prepareTripoInputs(parsed); expect(prepared.mode).toBe('multiview_to_model');
      expect(prepared.inputs.map(i => i.view)).toEqual(TRIPO_VIEWS);
      expect(prepared.inputs.map(i => i.sha256)).toEqual(TRIPO_VIEWS.map(v => sha(readFileSync(views[v]))));
    }
  });
  it.each(['front', 'left', 'back', 'right'])('missing %s rejects even mock without fetching', async missing => {
    const { views } = fixture(); delete views[missing]; let calls = 0;
    await expect(ADAPTERS.tripo.generate('chair', { views, mock: true, fetchImpl: async () => { calls++; } })).rejects.toThrow(); expect(calls).toBe(0);
  });
  it('duplicate/unknown flags, unknown views, unlabeled refs and mixed sources reject before network', async () => {
    const { views, file } = fixture();
    expect(() => parseTripoGenerationArgs(['chair', '--front', file, '--front', file])).toThrow();
    expect(() => parseTripoGenerationArgs(['chair', '--top', file])).toThrow();
    let calls = 0;
    for (const options of [{ views: { ...views, top: file } }, { refs: Object.values(views) }, { views, refs: [file] }, { views, edit: file }, { refs: [file], edit: file }]) {
      await expect(ADAPTERS.tripo.generate('chair', { ...options, mock: true, fetchImpl: async () => { calls++; } })).rejects.toThrow();
    }
    expect(calls).toBe(0);
  });
  it('preloaded duplicate/unknown/missing views and mixed preloaded/file sources reject before fetch', async () => {
    const { file } = fixture(); const buffer = readFileSync(file); const input = view => ({ path: `${view}.png`, role: 'reference', view, buffer }); let calls = 0;
    for (const options of [
      { inputs: [...TRIPO_VIEWS.map(input), input('front')] },
      { inputs: [...TRIPO_VIEWS.map(input), input('top')] },
      { inputs: TRIPO_VIEWS.slice(1).map(input) },
      { inputs: [input('front')], mode: 'image_to_model' },
      { inputs: [input('front')], refs: [file] },
      { inputs: [input('front')], views: { front: file } },
      { views: TRIPO_VIEWS.map(input) },
    ]) await expect(ADAPTERS.tripo.generate('chair', { ...options, mock: true, fetchImpl: async () => { calls++; } })).rejects.toThrow();
    expect(calls).toBe(0);
  });
  it('oversized PNG, invalid PNG and explicit mode/input mismatch reject in mock', async () => {
    const { file } = fixture(); const png = readFileSync(file);
    writeFileSync(file, Buffer.concat([png, Buffer.alloc(20 * 1024 * 1024)]));
    await expect(ADAPTERS.tripo.generate('chair', { refs: [file], mock: true })).rejects.toThrow();
    writeFileSync(file, 'bad PNG'); await expect(ADAPTERS.tripo.generate('chair', { refs: [file], mock: true })).rejects.toThrow();
    writeFileSync(file, png); await expect(ADAPTERS.tripo.generate('chair', { refs: [file], mode: 'text_to_model', mock: true })).rejects.toThrow();
  });
  it('preloaded snapshots copy caller buffers and recompute SHA rather than trusting supplied hashes', () => {
    const original = mockImage('preloaded', 16).buffer;
    const prepared = prepareTripoInputs({ inputs: [{ path: 'memory.png', role: 'reference', buffer: original, sha256: 'forged' }] });
    expect(prepared.inputs[0].sha256).toBe(sha(original)); expect(prepared.inputs[0].buffer).not.toBe(original);
    const before = Buffer.from(prepared.inputs[0].buffer); original.fill(0); expect(prepared.inputs[0].buffer).toEqual(before);
  });
  it('edit is explicit whole-model regeneration with provenance preserved through pending', async () => {
    const { file, root } = fixture(); const result = await ADAPTERS.tripo.generate('whole variant', { edit: file, mock: true });
    expect(result.generation).toMatchObject({ operation: 'image_to_model', fallback: 'whole_model_regeneration' });
    const pending = writePending({ root, adapter: 'tripo', prompt: 'whole variant', ...result });
    expect(pending.entry.type).toBe('mesh'); expect(pending.previewPath).toMatch(/\.glb$/);
    expect(pending.entry.provenance.generation).toEqual(result.generation); expect(pending.entry.provenance.references).toEqual(result.references);
    expect(existsSync(locations(root, null).indexFile)).toBe(false);
  });
});

describe('T3 V3 transport using fetch replacements only', () => {
  it.each(['single', 'multi'])('%s uploads exact snapshots and submits named V3 tokens; downloads GLB without authorization', async kind => {
    const { file, views } = fixture(); const { fetchImpl, calls } = transport();
    const result = await ADAPTERS.tripo.generate('description must stay provenance only', { ...(kind === 'single' ? { refs: [file] } : { views: { right: views.right, back: views.back, left: views.left, front: views.front } }), ...live(fetchImpl) });
    const uploads = calls.filter(c => c.url.endsWith('/files')); expect(uploads).toHaveLength(kind === 'single' ? 1 : 4);
    for (let i = 0; i < uploads.length; i++) {
      expect(uploads[i].opts.method).toBe('POST'); expect(uploads[i].opts.body).toBeInstanceOf(FormData);
      const blob = uploads[i].opts.body.get('file'); expect(blob).toBeTruthy();
      const bytes = Buffer.from(await blob.arrayBuffer()); expect(bytes).toEqual(readFileSync(kind === 'single' ? file : views[TRIPO_VIEWS[i]]));
      expect(sha(bytes)).toBe(result.references[i].sha256);
    }
    const submission = calls.find(c => c.url.includes('/generation/')); const body = JSON.parse(submission.opts.body);
    expect(submission.url).toMatch(kind === 'single' ? /\/generation\/image-to-model$/ : /\/generation\/multiview-to-model$/);
    expect(body).toMatchObject({ model: 'v3.1-20260211', texture: true, pbr: true }); expect(TRIPO_IMAGE_MODEL).toBe('v3.1-20260211'); expect(body).not.toHaveProperty('prompt');
    if (kind === 'single') expect(body.input).toBe('token-0');
    else expect(body.inputs).toEqual([{ front: 'token-0' }, { left: 'token-1' }, { back: 'token-2' }, { right: 'token-3' }]);
    const download = calls.at(-1); expect(download.url).toBe('https://cdn.example.invalid/model.glb');
    expect(Object.keys(download.opts.headers ?? {}).map(k => k.toLowerCase())).not.toContain('authorization');
    expect(result.mock).toBe(false); expect(result.buffer).toEqual(glb()); expectMesh(result.buffer);
    expect(result.generation).toMatchObject({ operation: kind === 'single' ? 'image_to_model' : 'multiview_to_model', apiVersion: 'v3', modelVersion: TRIPO_IMAGE_MODEL, taskId: 'task-fixture', parameters: { model: TRIPO_IMAGE_MODEL, texture: true, pbr: true } });
    expect(JSON.stringify(result.references)).not.toMatch(/buffer|token-/); expect(JSON.stringify(result.generation)).not.toMatch(/secret-fixture-key|token-|cdn\.example/);
  });
  it.each([
    ['upload HTTP', { upload: () => ({ ok: false, status: 403 }) }],
    ['upload business code', { upload: () => jsonResponse({ code: 12, message: 'secret-fixture-key denied' }) }],
    ['missing token', { upload: () => jsonResponse({ code: 0, data: {} }) }],
    ['submit HTTP', { submit: () => ({ ok: false, status: 500 }) }],
    ['submit business code', { submit: () => jsonResponse({ code: 7, message: 'secret-fixture-key denied' }) }],
    ['missing taskId', { submit: () => jsonResponse({ code: 0, data: {} }) }],
    ['poll HTTP', { poll: () => ({ ok: false, status: 502 }) }],
    ['poll business code', { poll: () => jsonResponse({ code: 9, message: 'secret-fixture-key denied' }) }],
    ['failed status', { poll: () => jsonResponse({ code: 0, data: { status: 'failed' } }) }],
    ['unknown status', { poll: () => jsonResponse({ code: 0, data: { status: 'unexpected_terminal' } }) }],
    ['poll timeout', { poll: () => jsonResponse({ code: 0, data: { status: 'running' } }) }],
    ['missing model URL', { poll: () => jsonResponse({ code: 0, data: { status: 'success', output: {} } }) }],
    ['invalid download URL', { poll: () => jsonResponse({ code: 0, data: { status: 'success', output: { model_url: 'http://cdn.example.invalid/model.glb' } } }) }],
    ['download HTTP', { download: () => ({ ok: false, status: 404 }) }],
    ['non GLB download', { download: () => ({ ok: true, arrayBuffer: async () => Buffer.from('not a GLB') }) }],
    ['fetch exception redacts key', { upload: () => { throw new Error('fetch secret-fixture-key failed'); } }],
  ])('%s rejects without exposing API key', async (_name, overrides) => {
    const { file } = fixture(); const { fetchImpl } = transport(overrides);
    let error; try { await ADAPTERS.tripo.generate('chair', { refs: [file], ...live(fetchImpl) }); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error); expect(error.message).not.toContain('secret-fixture-key');
  });
});

describe('T3 compatibility and isolated CLI', () => {
  it.each(['seedream', 'gpt-image-2.5'])('%s reference mock remains PNG', async adapter => {
    const { file } = fixture(); const result = await ADAPTERS[adapter].generate('chair', { refs: [file], mock: true });
    expect(result.buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
  it('text Tripo retains the V2 submission contract', async () => {
    const original = globalThis.fetch; const calls = [];
    globalThis.fetch = async (url, opts = {}) => {
      calls.push({ url, opts });
      if (calls.length === 1) return jsonResponse({ data: { task_id: 'text-task' } });
      if (calls.length === 2) return jsonResponse({ data: { status: 'success', output: { pbr_model: 'https://cdn.example.invalid/text.glb' } } });
      return { ok: true, arrayBuffer: async () => glb() };
    };
    try {
      const result = await ADAPTERS.tripo.generate('legacy chair', { apiKey: 'fixture' });
      expect(calls[0].url).toBe('https://api.tripo3d.ai/v2/openapi/task');
      expect(JSON.parse(calls[0].opts.body)).toEqual({ type: 'text_to_model', prompt: 'legacy chair' }); expect(result.buffer).toEqual(glb());
    } finally { globalThis.fetch = original; }
  });
  it('CLI mock preserves four view hashes and generation in pending without registering index', () => {
    const { root, views } = fixture(); const source = dirname(fileURLToPath(import.meta.url)); mkdirSync(join(root, 'scripts'));
    for (const file of ['ai-gen.mjs', 'ai-gen-inputs.mjs', 'tripo-inputs.mjs', 'tripo-generation.mjs']) copyFileSync(join(source, file), join(root, 'scripts', file));
    // The isolated source root resolves dependencies through this local link; never execute the repository CLI directly.
    symlinkSync(join(source, '..', 'node_modules'), join(root, 'node_modules'), 'dir');
    const result = spawnSync(process.execPath, ['scripts/ai-gen.mjs', 'tripo', 'four view chair', '--right', views.right, '--front', views.front, '--back', views.back, '--left', views.left, '--mock', '--json'], { cwd: root, encoding: 'utf8', env: { ...process.env, TRIPO_API_KEY: '' } });
    expect(result.status, result.stderr).toBe(0); const report = JSON.parse(result.stdout.trim().split('\n').at(-1));
    expect(report.entry.type).toBe('mesh'); expect(report.entry.provenance.mock).toBe(true);
    expect(report.entry.provenance.generation).toMatchObject({ operation: 'multiview_to_model', apiVersion: 'v3' }); expect(report.entry.provenance.generation).not.toHaveProperty('taskId');
    expect(report.entry.provenance.references.map(r => r.view)).toEqual(TRIPO_VIEWS);
    expect(report.entry.provenance.references.map(r => r.sha256)).toEqual(TRIPO_VIEWS.map(v => sha(readFileSync(views[v]))));
    expect(report.entry.provenance.references.every(r => !('buffer' in r))).toBe(true);
    expectMesh(readFileSync(join(root, report.previewPath.replace(/^\//, ''))));
    const manifest = JSON.parse(readFileSync(locations(root, null).pendingFile, 'utf8'));
    expect(manifest.pending[0].provenance).toEqual(report.entry.provenance);
    expect(existsSync(locations(root, null).indexFile)).toBe(false);
  });
});

describe('T3 downloaded GLB structural rejection before pending', () => {
  const malformed = kind => {
    const valid = glb();
    if (kind === 'missing BIN') {
      const jsonEnd = 20 + valid.readUInt32LE(12);
      const result = Buffer.from(valid.subarray(0, jsonEnd));
      result.writeUInt32LE(result.length, 8); return result;
    }
    if (kind === 'trailing bytes') {
      const result = Buffer.concat([valid, Buffer.alloc(4)]);
      result.writeUInt32LE(result.length, 8); return result;
    }
    const jsonEnd = 20 + valid.readUInt32LE(12);
    const document = JSON.parse(valid.subarray(20, jsonEnd).toString());
    document.buffers[0].uri = 'https://cdn.example.invalid/external.bin';
    const json = Buffer.from(JSON.stringify(document));
    const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
    const header = Buffer.from(valid.subarray(0, 20));
    header.writeUInt32LE(padded.length, 12);
    const result = Buffer.concat([header, padded, valid.subarray(jsonEnd)]);
    result.writeUInt32LE(result.length, 8); return result;
  };
  it.each(['missing BIN', 'trailing bytes', 'external buffer URL'])('%s GLB rejects and creates no pending asset', async kind => {
    const { root, file } = fixture(); const buffer = malformed(kind);
    // Keep valid GLB magic/version/total length: these cases exercise chunk and resource checks.
    expect(buffer.readUInt32LE(0)).toBe(0x46546c67);
    expect(buffer.readUInt32LE(4)).toBe(2);
    expect(buffer.readUInt32LE(8)).toBe(buffer.length);
    const { fetchImpl } = transport({ download: () => ({ ok: true, status: 200, arrayBuffer: async () => buffer }) });
    const generationAndPending = ADAPTERS.tripo.generate('chair', { refs: [file], ...live(fetchImpl) })
      .then(result => writePending({ root, adapter: 'tripo', prompt: 'chair', ...result }));
    await expect(generationAndPending).rejects.toThrow(/GLB|buffer|BIN|chunk/i);
    expect(existsSync(locations(root, null).pendingFile)).toBe(false);
    expect(existsSync(locations(root, null).indexFile)).toBe(false);
  });
});
