import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { normalizeModel, normalizedEntry } from './model-normalize.mjs';
import { validateJob } from './blender-job.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'model-normalize.mjs');
const roots = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const params = () => ({ sourceUp: 'Y', targetHeightMeters: 1.8, maxTris: 30000, maxTextureSize: 2048 });
const job = () => ({ op: 'normalize', inputs: ['source.glb'], params: params(), outputs: ['out/model.glb', 'out/model-spec.json'] });
const save = (file, bytes) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); return file; };
function glb(extra = {}) {
  const raw = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, ...extra }));
  const json = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]);
  const b = Buffer.alloc(20 + json.length); b.write('glTF'); b.writeUInt32LE(2, 4); b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(json.length, 12); b.writeUInt32LE(0x4e4f534a, 16); json.copy(b, 20); return b;
}
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'apollo-normalize-test-')); roots.push(dir);
  save(join(dir, 'source.glb'), glb()); const data = job(); const file = save(join(dir, 'job.json'), JSON.stringify(data));
  return { dir, data, file, rewrite() { save(file, JSON.stringify(data)); } };
}
// These are independently produced protocol artifacts. A fake executable exercises
// child execution, staged files and validation; it makes no geometry measurement claim.
function fake(f, mode = 'success') {
  const bytes = glb({ extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'], accessors: [{ componentType: 5126, count: 8, type: 'VEC3', min: [-0.9, 0, -0.9], max: [0.9, 1.8, 0.9] }, { componentType: 5123, count: 36, type: 'SCALAR' }], meshes: [{ primitives: [{ mode: 4, attributes: { POSITION: 0 }, indices: 1, extensions: { KHR_draco_mesh_compression: { bufferView: 0, attributes: { POSITION: 0 } } } }] }] });
  const executable = join(f.dir, 'fake Blender.cjs');
  save(executable, `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
const p=JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--')+1],'utf8'));
fs.writeFileSync(${JSON.stringify(join(f.dir, 'child.json'))},JSON.stringify(p));
const mode=${JSON.stringify(mode)};
let b=Buffer.from(${JSON.stringify(bytes.toString('base64'))},'base64');
if(mode==='missing-draco'||mode==='index-count'){
 const doc=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 if(mode==='missing-draco'){delete doc.extensionsUsed;delete doc.meshes[0].primitives[0].extensions;}
 else doc.accessors[1].count=33;
 const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);
 b=Buffer.alloc(20+json.length);b.write('glTF');b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(json.length,12);b.writeUInt32LE(0x4e4f534a,16);json.copy(b,20);
}
const meta={spec:{scale:1,up:'Y',pivot:'bottom-center',tris:12,bytes:b.length},normalization:{sourceUp:p.params.sourceUp,targetHeightMeters:p.params.targetHeightMeters,appliedScale:0.9,sourceBounds:[[-1,-1,-1],[1,1,1]],bounds:[[-0.9,0,-0.9],[0.9,1.8,0.9]],trianglesIn:12,trianglesOut:12,maxTextureSize:p.params.maxTextureSize,textureSizes:[],compression:'draco'}};
if(mode==='bytes')meta.spec.bytes++;
if(mode==='height')meta.normalization.bounds[1][1]=9;
if(mode==='tris')meta.spec.tris=meta.normalization.trianglesOut=p.params.maxTris+1;
if(mode==='compression')meta.normalization.compression='none';
if(mode==='mock')Object.assign(meta,{mock:true,spec:null,normalization:null});
if(mode==='missing-spec')delete meta.spec;
if(mode==='texture')meta.normalization.textureSizes=[{width:4096,height:4096}];
for(const out of p.outputs){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,out.endsWith('.json')?(mode==='json'?'not json':JSON.stringify(meta)):b);}
`);
  chmodSync(executable, 0o755); return executable;
}
function rejected(fn, regex) {
  let error; try { fn(); } catch (e) { error = e; }
  expect(error, 'must reject instead of returning a successful measurement').toBeInstanceOf(Error);
  if (regex) expect(error.message).toMatch(regex); return error;
}
afterEach(() => { for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('T4 closed normalization job data', () => {
  it.each(['Y', 'Z'])('accepts explicit %s-up and leaves caller data intact', sourceUp => {
    const data = job(); data.params.sourceUp = sourceUp; const before = structuredClone(data);
    expect(validateJob(data)).toBe(data); expect(data).toEqual(before);
  });
  it.each([
    ['old reserved params', j => { j.params = {}; }],
    ['source axis guess', j => { j.params.sourceUp = 'auto'; }],
    ['X-up', j => { j.params.sourceUp = 'X'; }],
    ['zero target height', j => { j.params.targetHeightMeters = 0; }],
    ['negative height', j => { j.params.targetHeightMeters = -1; }],
    ['infinite height', j => { j.params.targetHeightMeters = Infinity; }],
    ['non numeric height', j => { j.params.targetHeightMeters = '1.8'; }],
    ['zero triangle budget', j => { j.params.maxTris = 0; }],
    ['fractional triangle budget', j => { j.params.maxTris = 1.5; }],
    ['texture above ceiling', j => { j.params.maxTextureSize = 2049; }],
    ['zero texture size', j => { j.params.maxTextureSize = 0; }],
    ['fractional texture size', j => { j.params.maxTextureSize = 128.5; }],
    ['injected command', j => { j.params.script = 'arbitrary.py'; }],
    ['two inputs', j => { j.inputs.push('second.glb'); }],
    ['non GLB input', j => { j.inputs = ['source.obj']; }],
    ['missing metadata output', j => { j.outputs.pop(); }],
    ['reversed outputs', j => { j.outputs.reverse(); }],
    ['non JSON metadata', j => { j.outputs[1] = 'out/spec.txt'; }],
  ])('rejects %s before any executable is run', (_label, mutate) => {
    const data = job(); mutate(data); expect(() => validateJob(data)).toThrow();
  });
  it.each(Object.keys(params()))('requires %s', key => { const data = job(); delete data.params[key]; expect(() => validateJob(data)).toThrow(); });
});

describe('T4 protocol execution and honest mock boundary', () => {
  it('mock records no measurements and cannot produce a normalized entry', () => {
    const f = fixture(); const a = normalizeModel(f.file, { mock: true }); const b = normalizeModel(f.file, { mock: true });
    expect(a).toMatchObject({ ok: true, op: 'normalize', mock: true, spec: null, normalization: null });
    expect(a.outputs).toHaveLength(2); expect(a.outputs.map(o => o.sha256)).toEqual(b.outputs.map(o => o.sha256));
    expect(a.jobHash).toBe(b.jobHash); expect(a.evidenceDir).not.toBe(b.evidenceDir);
    expect(JSON.parse(readFileSync(a.outputs[1].path, 'utf8'))).toEqual({ mock: true, spec: null, normalization: null });
    expect(a.evidenceDir).toContain(join('.blender-jobs', 'mock'));
    expect(existsSync(join(f.dir, 'out/model.glb'))).toBe(false); expect(existsSync(join(f.dir, 'out/model-spec.json'))).toBe(false);
    rejected(() => normalizedEntry({ id: 'mesh/source', type: 'mesh', path: '/source.glb' }, a, '/normalized.glb'), /mock/i);
  });
  it('executes an offline child and returns metadata together with retained T7 evidence', () => {
    const f = fixture(); const blender = fake(f); const report = normalizeModel(f.file, { blender });
    expect(report).toMatchObject({ ok: true, op: 'normalize', mock: false, spec: { scale: 1, up: 'Y', pivot: 'bottom-center', tris: 12 }, normalization: { sourceUp: 'Y', compression: 'draco' } });
    const metadata = JSON.parse(readFileSync(report.outputs[1].path, 'utf8'));
    expect(report.spec).toEqual(metadata.spec); expect(report.normalization).toEqual(metadata.normalization);
    expect(report.inputs).toEqual([{ path: 'source.glb', sha256: sha(readFileSync(join(f.dir, 'source.glb'))) }]);
    expect(report.outputs[0].bytes).toBe(report.spec.bytes);
    for (const o of report.outputs) { expect(sha(readFileSync(o.path))).toBe(o.sha256); expect(readFileSync(o.path)).toEqual(readFileSync(o.snapshotPath)); }
    const payload = JSON.parse(readFileSync(join(f.dir, 'child.json'), 'utf8'));
    expect(payload.inputs[0]).toContain(join(report.evidenceDir, 'inputs')); expect(payload.params).toEqual(f.data.params);
    expect(readFileSync(report.logPath, 'utf8')).toContain('commit');
  });
  it.each(['json', 'missing-spec', 'mock', 'bytes', 'tris', 'compression', 'height', 'texture', 'missing-draco', 'index-count'])('rejects child metadata defect %s and preserves prior outputs', mode => {
    const f = fixture(); const targets = f.data.outputs.map(p => save(join(f.dir, p), 'prior owner artifact'));
    const error = rejected(() => normalizeModel(f.file, { blender: fake(f, mode) }));
    expect(existsSync(error.logPath)).toBe(true); expect(readFileSync(error.logPath, 'utf8')).toContain('reject');
    expect(existsSync(join(dirname(error.logPath), 'result.json'))).toBe(false);
    for (const target of targets) expect(readFileSync(target, 'utf8')).toBe('prior owner artifact');
  });
  it('missing Blender gives an explicit error and never silently substitutes mock', () => {
    const f = fixture(); const error = rejected(() => normalizeModel(f.file, { blender: join(f.dir, 'not installed') }), /Blender.*--mock|找不到Blender/);
    expect(readFileSync(error.logPath, 'utf8')).toContain('mock=false'); expect(existsSync(join(f.dir, 'out/model.glb'))).toBe(false);
  });
  it('rejects an op belonging to another pipeline before running the child', () => {
    const f = fixture(); f.data.op = 'render-views'; f.rewrite();
    rejected(() => normalizeModel(f.file, { blender: fake(f) })); expect(existsSync(join(f.dir, 'child.json'))).toBe(false);
  });
  it('CLI emits one JSON report and mock metadata stays empty', () => {
    const f = fixture(); const result = spawnSync(process.execPath, [CLI, f.file, '--mock'], { encoding: 'utf8' });
    expect(result.status).toBe(0); const lines = result.stdout.trim().split('\n'); expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ mock: true, spec: null, normalization: null }); expect(result.stderr).toContain('mock');
  });
});

describe('T4 candidate entry merge', () => {
  it('preserves identity, licensing, provenance, mock origin and unknown source fields without mutating either argument', () => {
    const f = fixture(); const report = normalizeModel(f.file, { blender: fake(f) });
    const source = { id: 'fixture/raw', type: 'mesh', path: '/raw.glb', license: 'CC0', source: 'offline fixture', custom: { keep: 3 }, spec: { usage: 'prop', colorSpace: 'srgb', tris: 999, scale: 8 }, provenance: { mock: true, prompt: 'offline simulated model', custom: { keep: 'yes' } } };
    const sourceBefore = structuredClone(source), reportBefore = structuredClone(report);
    const merged = normalizedEntry(source, report, '/art/normalized.glb');
    expect(merged).toMatchObject({ id: source.id, type: 'mesh', path: '/art/normalized.glb', license: 'CC0', source: source.source, custom: source.custom, spec: { usage: 'prop', colorSpace: 'srgb', scale: 1, up: 'Y', pivot: 'bottom-center', tris: 12 }, provenance: { mock: true, prompt: source.provenance.prompt, custom: source.provenance.custom, normalization: { sourceSha256: report.inputs[0].sha256, jobHash: report.jobHash, ...report.normalization } } });
    expect(source).toEqual(sourceBefore); expect(report).toEqual(reportBefore);
  });
  it('refuses missing measurements even if the caller sets mock=false', () => {
    rejected(() => normalizedEntry({ id: 'fixture/raw', type: 'mesh', path: '/raw.glb' }, { ok: true, mock: false, spec: null, normalization: null }, '/new.glb'));
  });
});
