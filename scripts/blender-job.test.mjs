import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { BLENDER_OPS, validateJob, runBlenderJob } from './blender-job.mjs';
import { encodePng } from './ai-gen.mjs';
import { decodePng } from './asset-matte.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'blender-job.mjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const roots = [];
const clone = value => structuredClone(value);
function root() { const dir = mkdtempSync(join(tmpdir(), 'apollo-blender-test-')); roots.push(dir); return dir; }
function save(file, bytes) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); return file; }
// Independent minimal glTF fixture: a JSON chunk is sufficient for bridge protocol tests.
// Worker geometry/import semantics are exercised by the separate real-Blender integration.
function glb(marker = 'fixture', extra = {}) {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: marker }], ...extra }));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const result = Buffer.alloc(20 + padded.length);
  result.write('glTF'); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20);
  return result;
}
const split = (patch = {}) => ({ id: 'wall', scene: 'yard', bbox: [0, 0, 10, 10], route: 'build', skinKey: 'example/wall', prompt: 'stone wall', refs: ['keyart/yard.png'], state: 'approved', ...patch });
const object = (patch = {}) => ({ splitId: 'wall', name: 'col_wall', source: { primitive: 'box', size: [2, 1, 3] }, position: [1, 0, 2], rotation: [0, 0.25, 0], scale: 1, ...patch });
const view = (patch = {}) => ({ id: 'front', position: [3, 2, 4], target: [0, 0, 0], fov: 50, width: 24, height: 16, ...patch });
const build = () => ({ op: 'build-scene', inputs: ['asset-split.json', 'prop.glb'], params: { scene: 'yard', objects: [object()] }, outputs: ['out/scene.glb'] });
const render = (count = 1) => ({ op: 'render-views', inputs: ['scene.glb'], params: { views: Array.from({ length: count }, (_, i) => view({ id: `view${i}`, width: 24 + i * 8 })) }, outputs: Array.from({ length: count }, (_, i) => `out/view${i}.png`) });
function fixture(job = build(), rows = [split()]) {
  const dir = root();
  save(join(dir, 'asset-split.json'), JSON.stringify(rows));
  save(join(dir, 'prop.glb'), glb('prop')); save(join(dir, 'scene.glb'), glb('scene'));
  const file = save(join(dir, 'job.json'), JSON.stringify(job));
  return { dir, file, job, rows };
}
function rewrite(f) { save(f.file, JSON.stringify(f.job)); save(join(f.dir, 'asset-split.json'), JSON.stringify(f.rows)); }
function failure(fn, pattern) {
  let error; try { fn(); } catch (e) { error = e; }
  expect(error, 'operation must reject instead of returning a success report').toBeInstanceOf(Error);
  if (pattern) expect(error.message).toMatch(pattern);
  return error;
}
function assertEvidence(error) {
  expect(typeof error.logPath).toBe('string');
  expect(existsSync(error.logPath)).toBe(true);
  expect(readFileSync(error.logPath, 'utf8')).toContain('reject');
  expect(existsSync(join(dirname(error.logPath), 'result.json'))).toBe(false);
}
// A real executable boundary, not a mocked spawn: verifies argv, snapshot payload,
// fresh outputs, nonzero exits and timeout propagation without requiring Blender.
function fakeBlender(dir, mode = 'success', options = {}) {
  const executable = join(dir, 'fake Blender ; literal.cjs');
  const record = join(dir, 'child-record.json');
  const code = `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
 const args=process.argv.slice(2),payload=JSON.parse(fs.readFileSync(args[args.indexOf('--')+1],'utf8'));
 const mode=${JSON.stringify(mode)},options=${JSON.stringify(options)};
 if(mode==='mutate')fs.writeFileSync(options.original,Buffer.from(options.replacement,'base64'));
 const consumed=payload.inputs.map(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'));
 fs.writeFileSync(${JSON.stringify(record)},JSON.stringify({args,payload,consumed}));
 console.log('fake child stdout');console.error('fake child stderr');
 if(mode==='sleep'){setTimeout(()=>{},5000);return;}
 if(mode==='none')return;
 const {encodePng}=await import(${JSON.stringify(pathToFileURL(join(HERE, 'ai-gen.mjs')).href)});
 for(let i=0;i<payload.outputs.length;i++){
  const p=payload.outputs[i];fs.mkdirSync(path.dirname(p),{recursive:true});
  if(mode==='invalid-second'&&i===1){fs.writeFileSync(p,'not PNG');continue;}
  if(mode==='bad-glb'){fs.writeFileSync(p,'glTF');continue;}
  if(p.endsWith('.png')){const v=payload.params.views[i];fs.writeFileSync(p,encodePng(mode==='wrong-size'?v.width+1:v.width,v.height,Buffer.alloc((mode==='wrong-size'?v.width+1:v.width)*v.height*3,64)));}
  else fs.writeFileSync(p,Buffer.from(${JSON.stringify(glb('child result').toString('base64'))},'base64'));
  if(mode==='fail')process.exit(7);
 }
})().catch(e=>{console.error(e.stack);process.exit(9)});
`;
  save(executable, code); chmodSync(executable, 0o755); return { executable, record };
}
beforeEach(() => { for (const method of ['error', 'warn', 'info']) vi.spyOn(console, method).mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('T7 closed job schema', () => {
  it('exposes only five operations and validates data without reading files or mutating it', () => {
    expect(BLENDER_OPS).toEqual(['normalize', 'rig-arp', 'retarget-arp', 'build-scene', 'render-views']);
    const jobs = [build(), render(), { op: 'normalize', inputs: ['absent.glb'], params: { sourceUp: 'Y', targetHeightMeters: 1.8, maxTris: 30000, maxTextureSize: 2048 }, outputs: ['out.glb', 'spec.json'] }, ...['rig-arp', 'retarget-arp'].map(op => ({ op, inputs: op === 'retarget-arp' ? ['absent-a.glb', 'absent-b.glb'] : ['absent.glb'], params: {}, outputs: ['out.glb'] }))];
    for (const job of jobs) { const before = clone(job); expect(validateJob(job)).toBe(job); expect(job).toEqual(before); }
  });
  it.each([
    ['unknown operation', j => { j.op = 'python'; }],
    ['unknown top-level field', j => { j.script = 'arbitrary.py'; }],
    ['missing params', j => { delete j.params; }],
    ['empty inputs', j => { j.inputs = []; }],
    ['nonstring input', j => { j.inputs = [1]; }],
    ['duplicate output', j => { j.outputs.push(j.outputs[0]); }],
    ['unknown params field', j => { j.params.command = 'echo unsafe'; }],
    ['unknown object field', j => { j.params.objects[0].python = 'print(1)'; }],
    ['unknown primitive', j => { j.params.objects[0].source.primitive = 'sphere'; }],
    ['ambiguous source', j => { j.params.objects[0].source.input = 1; }],
    ['input zero', j => { j.params.objects[0].source = { input: 0 }; }],
    ['input past end', j => { j.params.objects[0].source = { input: 2 }; }],
    ['input with size', j => { j.params.objects[0].source = { input: 1, size: [1, 1, 1] }; }],
    ['nonfinite position', j => { j.params.objects[0].position[1] = NaN; }],
    ['nonfinite rotation', j => { j.params.objects[0].rotation[0] = Infinity; }],
    ['negative scale', j => { j.params.objects[0].scale = -1; }],
    ['scale vector instead of scalar', j => { j.params.objects[0].scale = [1, 1, 1]; }],
    ['missing explicit size', j => { delete j.params.objects[0].source.size; }],
    ['missing D1 identity', j => { delete j.params.objects[0].splitId; }],
    ['nonempty spawn', j => { j.params.objects[0].name = 'spawn_player'; }],
    ['empty collider', j => { j.params.objects[0].source = { primitive: 'empty' }; }],
    ['color outside RGBA', j => { j.params.objects[0].color = [1, 0, 0, 2]; }],
    ['input material override', j => { j.params.objects[0].source = { input: 1 }; j.params.objects[0].color = [1, 0, 0, 1]; }],
    ['duplicate object name', j => { j.params.objects.push(clone(j.params.objects[0])); }],
    ['non-GLB scene output', j => { j.outputs = ['scene.blend']; }],
  ])('rejects %s', (_name, change) => { const job = build(); change(job); expect(() => validateJob(job)).toThrow(); });
  it('accepts explicit XZ plane, non-ASCII D1 id, material color, and named empty spawn', () => {
    const job = build(); job.params.objects = [object({ splitId: '院子·地面', name: 'nav_ground', source: { primitive: 'plane', size: [10, 0, 8] }, color: [0.1, 0.2, 0.3, 1] }), object({ splitId: undefined, name: 'spawn_player', source: { primitive: 'empty' } })];
    delete job.params.objects[1].splitId;
    expect(validateJob(job)).toBe(job);
    job.params.objects[0].source.size[1] = 0.1; expect(() => validateJob(job)).toThrow('plane');
  });
  it.each([
    ['zero fov', j => { j.params.views[0].fov = 0; }],
    ['180 degree fov', j => { j.params.views[0].fov = 180; }],
    ['coincident position and target', j => { j.params.views[0].position = [0, 0, 0]; }],
    ['fractional dimensions', j => { j.params.views[0].width = 32.5; }],
    ['missing view output', j => { j.outputs = []; }],
    ['duplicate view id', j => { j.params.views.push(clone(j.params.views[0])); j.outputs.push('second.png'); }],
    ['unknown view field', j => { j.params.views[0].python = 'unsafe'; }],
    ['wrong render input count', j => { j.inputs.push('another.glb'); }],
  ])('rejects render %s', (_name, change) => { const job = render(); change(job); expect(() => validateJob(job)).toThrow(); });
  it('rejects an unknown op even when every other field satisfies the reserved-operation schema', () => {
    expect(() => validateJob({ op: 'python', inputs: ['absent.glb'], params: {}, outputs: ['out.glb'] })).toThrow(/未知 op python/);
  });
  it('reserved operations reject invented T4/T5 params and retarget requires two inputs', () => {
    for (const op of ['normalize', 'rig-arp', 'retarget-arp']) {
      const job = { op, inputs: ['a.glb', 'b.glb'], params: { arbitraryScript: 'x.py' }, outputs: ['out.glb'] };
      expect(() => validateJob(job)).toThrow('未知字段');
    }
    expect(() => validateJob({ op: 'retarget-arp', inputs: ['a.glb'], params: {}, outputs: ['out.glb'] })).toThrow();
  });
});

describe('T7 D1 association and input provenance', () => {
  it('consumes approved Chinese splitId with explicit geometry and records skip for unused proposed rows', () => {
    const job = build(); job.params.objects[0].splitId = '院墙';
    const f = fixture(job, [split({ id: '院墙' }), split({ id: 'pending', skinKey: 'example/pending', state: 'proposed' }), split({ id: 'other', scene: 'hall', skinKey: 'example/other' })]);
    const report = runBlenderJob(f.file, { mock: true });
    expect(report.ok).toBe(true); expect(report.mock).toBe(true);
    const cli = spawnSync(process.execPath, [CLI, f.file, '--mock'], { encoding: 'utf8' });
    expect(cli.status).toBe(0); expect(cli.stderr).toContain('skip: pending');
    expect(JSON.parse(cli.stdout)).toMatchObject({ ok: true, mock: true });
    expect(existsSync(join(f.dir, 'out/scene.glb'))).toBe(false);
  });
  it.each([
    ['unknown split id', f => { f.job.params.objects[0].splitId = 'missing'; }, /不存在splitId/],
    ['proposed object', f => { f.rows[0].state = 'proposed'; }, /尚未approved/],
    ['unconsumed approved row', f => { f.rows.push(split({ id: 'extra', skinKey: 'example/extra' })); }, /未消费/],
    ['build routed to imported model', f => { f.job.params.objects[0].source = { input: 1 }; }, /route=build/],
    ['generate routed to primitive', f => { f.rows[0].route = 'generate'; }, /route=generate/],
    ['character routed to primitive', f => { f.rows[0].route = 'character'; }, /route=character/],
    ['missing scene', f => { f.job.params.scene = 'missing'; }, /没有场景/],
    ['invalid split schema', f => { delete f.rows[0].skinKey; }, /D1拆层单无效/],
  ])('refuses D1 %s before creating a real output', (_name, change, pattern) => {
    const f = fixture(); change(f); rewrite(f);
    failure(() => runBlenderJob(f.file, { mock: true }), pattern);
    expect(existsSync(join(f.dir, 'out/scene.glb'))).toBe(false);
  });
  it.each(['missing', 'malformed JSON'])('refuses %s D1 input before any output', kind => {
    const f = fixture(); const input = join(f.dir, 'asset-split.json');
    if (kind === 'missing') rmSync(input); else save(input, '{ broken');
    failure(() => runBlenderJob(f.file, { mock: true })); expect(existsSync(join(f.dir, 'out/scene.glb'))).toBe(false);
  });
  it('accepts generate and character model references when every approved row is consumed', () => {
    const job = build(); job.params.objects = [object({ splitId: 'lamp', name: 'pick_lamp', source: { input: 1 } }), object({ splitId: 'actor', name: 'actor_main', source: { input: 1 } })];
    const f = fixture(job, [split({ id: 'lamp', route: 'generate' }), split({ id: 'actor', route: 'character', skinKey: 'example/actor' })]);
    expect(runBlenderJob(f.file, { mock: true }).outputs).toHaveLength(1);
  });
  it('permits explicit external input files and reports original paths with SHA256', () => {
    const external = save(join(root(), 'shared.glb'), glb('external'));
    const f = fixture(render()); f.job.inputs = [external]; rewrite(f);
    const report = runBlenderJob(f.file, { mock: true });
    expect(report.inputs).toEqual([{ path: external, sha256: hash(readFileSync(external)) }]);
  });
  it.each(['missing', 'directory', 'invalid GLB', 'external buffer', 'external image'])('refuses %s input without producing output', kind => {
    const f = fixture(render()); const input = join(f.dir, 'scene.glb');
    if (kind === 'missing') rmSync(input);
    if (kind === 'directory') { rmSync(input); mkdirSync(input); }
    if (kind === 'invalid GLB') save(input, 'glTF');
    if (kind === 'external buffer') save(input, glb('bad', { buffers: [{ uri: 'https://example.invalid/hidden.bin', byteLength: 4 }] }));
    if (kind === 'external image') save(input, glb('bad', { images: [{ uri: 'hidden.png' }] }));
    failure(() => runBlenderJob(f.file, { mock: true })); expect(existsSync(join(f.dir, 'out/view0.png'))).toBe(false);
  });
  it('accepts embedded data URIs without network access', () => {
    const f = fixture(render()); save(join(f.dir, 'scene.glb'), glb('embedded', { buffers: [{ uri: 'data:application/octet-stream;base64,AAAAAA==', byteLength: 4 }] }));
    expect(runBlenderJob(f.file, { mock: true }).ok).toBe(true);
  });
});

describe('T7 isolated deterministic mock evidence', () => {
  it.each([build, render])('repeat produces stable job and output hashes but distinct retained run evidence (%s)', make => {
    const f = fixture(make()); const target = join(f.dir, f.job.outputs[0]); save(target, 'owner existing output');
    const first = runBlenderJob(f.file, { mock: true }); const firstLog = readFileSync(first.logPath, 'utf8');
    const second = runBlenderJob(f.file, { mock: true });
    expect(second.jobHash).toBe(first.jobHash);
    expect(second.outputs.map(o => o.sha256)).toEqual(first.outputs.map(o => o.sha256));
    expect(second.logPath).not.toBe(first.logPath); expect(readFileSync(first.logPath, 'utf8')).toBe(firstLog);
    for (const report of [first, second]) {
      expect(report).toMatchObject({ ok: true, op: f.job.op, mock: true });
      expect(report.evidenceDir).toContain(join('.blender-jobs', 'mock', report.jobHash));
      expect(existsSync(report.scriptPath)).toBe(true); expect(readFileSync(report.logPath, 'utf8')).toContain('downgrade explicit mock');
      expect(JSON.parse(readFileSync(join(report.evidenceDir, 'result.json'), 'utf8'))).toEqual(report);
      report.outputs.forEach((out, i) => {
        expect(out.path).toBe(join(report.evidenceDir, 'out', f.job.outputs[i]));
        const bytes = readFileSync(out.path); expect(out.sha256).toBe(hash(bytes)); expect(out.bytes).toBe(bytes.length);
        if (f.job.op === 'render-views') { const decoded = decodePng(bytes); expect([decoded.w, decoded.h]).toEqual([f.job.params.views[i].width, f.job.params.views[i].height]); }
        else expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
      });
    }
    expect(readFileSync(target, 'utf8')).toBe('owner existing output');
  });
  it('hash changes with input bytes or explicit scene geometry', () => {
    const f = fixture(); const first = runBlenderJob(f.file, { mock: true });
    save(join(f.dir, 'prop.glb'), glb('updated input')); const changedInput = runBlenderJob(f.file, { mock: true });
    expect(changedInput.jobHash).not.toBe(first.jobHash);
    f.job.params.objects[0].position[0] = 5; rewrite(f); const changedJob = runBlenderJob(f.file, { mock: true });
    expect(changedJob.jobHash).not.toBe(changedInput.jobHash);
  });
  it.each(['rig-arp', 'retarget-arp'])('reserved %s mock is explicit and isolated without claiming real implementation', op => {
    const f = fixture({ op, inputs: op === 'retarget-arp' ? ['scene.glb', 'prop.glb'] : ['scene.glb'], params: {}, outputs: ['result.glb'] });
    const report = runBlenderJob(f.file, { mock: true }); expect(report.mock).toBe(true);
    expect(existsSync(join(f.dir, 'result.glb'))).toBe(false); expect(readFileSync(report.logPath, 'utf8')).toContain('no Blender execution');
  });
});

describe('T7 output boundary and actual executable protocol', () => {
  it.each(['../escape.glb', '/tmp/apollo-blender-escape.glb', 'prop.glb', 'job.json', '.blender-jobs/overwrite.glb'])('refuses unsafe output %s', output => {
    const f = fixture(); const before = readFileSync(join(f.dir, 'prop.glb')); f.job.outputs = [output]; rewrite(f);
    failure(() => runBlenderJob(f.file, { mock: true })); expect(readFileSync(join(f.dir, 'prop.glb'))).toEqual(before);
  });
  it('refuses overwriting the JSON job even when its filename has a GLB suffix', () => {
    const f = fixture(); f.job.outputs = ['job.glb']; const file = save(join(f.dir, 'job.glb'), JSON.stringify(f.job));
    const original = readFileSync(file); failure(() => runBlenderJob(file, { mock: true }), /覆盖输入或job/);
    expect(readFileSync(file)).toEqual(original);
  });
  it.each([false, true])('refuses outside symlink ancestors including dangling=%s', dangling => {
    const f = fixture(); const outside = root(); const linkTarget = join(outside, 'external');
    if (!dangling) mkdirSync(linkTarget); symlinkSync(linkTarget, join(f.dir, 'linked'));
    f.job.outputs = ['linked/scene.glb']; rewrite(f);
    failure(() => runBlenderJob(f.file, { mock: true }), /符号链接/);
    expect(existsSync(join(linkTarget, 'scene.glb'))).toBe(false);
  });
  it('refuses an output symlink alias of the source model', () => {
    const f = fixture(); symlinkSync(join(f.dir, 'prop.glb'), join(f.dir, 'alias.glb')); f.job.outputs = ['alias.glb']; rewrite(f);
    failure(() => runBlenderJob(f.file, { mock: true }), /覆盖输入/);
  });
  it('refuses normalized duplicate output paths', () => {
    const f = fixture(render(2)); f.job.outputs = ['out/view.png', 'out/../out/view.png']; rewrite(f);
    failure(() => runBlenderJob(f.file, { mock: true }), /同一路径|物理路径重复|路径重叠/);
  });
  it('rejects ancestor-overlapping outputs before execution and preserves an existing front PNG', () => {
    const f = fixture(render(2)); f.job.outputs = ['out/front.png', 'out/front.png/side.png']; rewrite(f);
    const target = save(join(f.dir, 'out/front.png'), encodePng(24, 16, Buffer.alloc(24 * 16 * 3, 37)));
    const before = readFileSync(target); const fake = fakeBlender(f.dir);
    failure(() => runBlenderJob(f.file, { blender: fake.executable }), /祖先不是目录|路径重叠/);
    expect(readFileSync(target)).toEqual(before);
    expect(existsSync(fake.record), 'invalid destination set must reject before executing the child').toBe(false);
  });
  it('rejects a symlink output into prior evidence and leaves its retained snapshot hash unchanged', () => {
    const f = fixture(render()); const fake = fakeBlender(f.dir);
    const prior = runBlenderJob(f.file, { blender: fake.executable });
    const snapshot = prior.outputs[0].snapshotPath; const before = readFileSync(snapshot);
    expect(hash(before)).toBe(prior.outputs[0].sha256);
    symlinkSync(dirname(snapshot), join(f.dir, 'evidence-alias'));
    const next = clone(f.job); next.outputs = ['evidence-alias/0.png'];
    const nextFile = save(join(f.dir, 'another-job.json'), JSON.stringify(next)); rmSync(fake.record);
    failure(() => runBlenderJob(nextFile, { blender: fake.executable }), /证据目录/);
    expect(hash(readFileSync(snapshot))).toBe(prior.outputs[0].sha256);
    expect(readFileSync(snapshot)).toEqual(before);
    expect(existsSync(fake.record), 'prior evidence aliases must reject before executing the child').toBe(false);
  });
  it('rejects distinct lexical outputs aliasing the same physical PNG instead of reporting two hashes', () => {
    const f = fixture(render(2)); f.job.outputs = ['out/front.png', 'alias/front.png']; rewrite(f);
    const target = save(join(f.dir, 'out/front.png'), encodePng(24, 16, Buffer.alloc(24 * 16 * 3, 83)));
    symlinkSync(join(f.dir, 'out'), join(f.dir, 'alias'));
    const before = readFileSync(target); const fake = fakeBlender(f.dir);
    failure(() => runBlenderJob(f.file, { blender: fake.executable }), /物理路径重复|路径重叠/);
    expect(readFileSync(target)).toEqual(before);
    expect(existsSync(fake.record), 'duplicate physical outputs must reject before executing the child').toBe(false);
  });
  it('passes literal argv without shell, consumes snapshots, stages outputs and publishes hashes only after success', () => {
    const f = fixture(render(2)); const fake = fakeBlender(f.dir);
    const report = runBlenderJob(f.file, { blender: fake.executable });
    const { args, payload, consumed } = JSON.parse(readFileSync(fake.record, 'utf8'));
    expect(args.slice(0, 5)).toEqual(['--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1']);
    expect(args[5]).toBe('--python'); expect(args[6]).toBe(report.scriptPath); expect(args[7]).toBe('--'); expect(args).toHaveLength(9);
    expect(payload.op).toBe('render-views'); expect(payload.params).toEqual(f.job.params);
    expect(payload.inputs[0]).not.toBe(join(f.dir, 'scene.glb')); expect(payload.inputs[0]).toContain(join(report.evidenceDir, 'inputs'));
    expect(consumed).toEqual(report.inputs.map(x => x.sha256));
    payload.outputs.forEach(p => expect(p).toContain(join(report.evidenceDir, 'stage')));
    report.outputs.forEach((out, i) => { expect(out.path).toBe(join(f.dir, f.job.outputs[i])); expect(hash(readFileSync(out.path))).toBe(out.sha256); });
    expect(readFileSync(report.logPath, 'utf8')).toContain('fake child stdout'); expect(readFileSync(report.logPath, 'utf8')).toContain('fake child stderr');
    expect(report.mock).toBe(false);
  });
  it('child consumes the hashed input snapshot even when the original changes during execution', () => {
    const f = fixture(render()); const input = join(f.dir, 'scene.glb'); const before = readFileSync(input);
    const fake = fakeBlender(f.dir, 'mutate', { original: input, replacement: glb('child modified original').toString('base64') });
    const report = runBlenderJob(f.file, { blender: fake.executable }); const record = JSON.parse(readFileSync(fake.record, 'utf8'));
    expect(report.inputs[0]).toEqual({ path: 'scene.glb', sha256: hash(before) });
    expect(record.consumed).toEqual([hash(before)]); expect(hash(readFileSync(input))).not.toBe(hash(before));
    expect(readFileSync(record.payload.inputs[0])).toEqual(before);
  });
  it('missing Blender rejects with retained evidence and never silently chooses mock', () => {
    const f = fixture(); const error = failure(() => runBlenderJob(f.file, { blender: join(f.dir, 'missing Blender') }), /找不到Blender.*--mock/);
    assertEvidence(error); expect(readFileSync(error.logPath, 'utf8')).toContain('mock=false'); expect(existsSync(join(f.dir, 'out/scene.glb'))).toBe(false);
  });
  it('child exit zero with no new output cannot borrow a previous successful target or evidence', () => {
    const f = fixture(); const fake = fakeBlender(f.dir); const prior = runBlenderJob(f.file, { blender: fake.executable });
    const previousOutput = readFileSync(prior.outputs[0].path), previousLog = readFileSync(prior.logPath, 'utf8');
    fakeBlender(f.dir, 'none'); const error = failure(() => runBlenderJob(f.file, { blender: fake.executable }));
    assertEvidence(error); expect(error.logPath).not.toBe(prior.logPath);
    expect(readFileSync(prior.outputs[0].path)).toEqual(previousOutput); expect(readFileSync(prior.logPath, 'utf8')).toBe(previousLog);
  });
  it.each(['fail', 'invalid-second', 'wrong-size'])('does not publish any partial outputs when child mode is %s', mode => {
    const f = fixture(render(2)); const targets = f.job.outputs.map(p => save(join(f.dir, p), encodePng(16, 16, Buffer.alloc(16 * 16 * 3, 9))));
    const before = targets.map(p => readFileSync(p)); const fake = fakeBlender(f.dir, mode);
    const error = failure(() => runBlenderJob(f.file, { blender: fake.executable }), mode === 'fail' ? /退出码 7/ : mode === 'wrong-size' ? /尺寸/ : /PNG/);
    assertEvidence(error); targets.forEach((p, i) => expect(readFileSync(p)).toEqual(before[i]));
  });
  it('rejects a magic-only fake GLB instead of recording success', () => {
    const f = fixture(); const fake = fakeBlender(f.dir, 'bad-glb'); const error = failure(() => runBlenderJob(f.file, { blender: fake.executable }), /GLB/);
    assertEvidence(error); expect(existsSync(join(f.dir, 'out/scene.glb'))).toBe(false);
  });
  it('enforces timeout and leaves an error log with no published output', () => {
    const f = fixture(); const fake = fakeBlender(f.dir, 'sleep'); const error = failure(() => runBlenderJob(f.file, { blender: fake.executable, timeoutMs: 100 }), /执行失败|退出码/);
    assertEvidence(error); expect(existsSync(join(f.dir, 'out/scene.glb'))).toBe(false);
  });
});

describe('T7 command line', () => {
  it('prints exactly one JSON report on stdout and all decisions on stderr', () => {
    const f = fixture(render()); const result = spawnSync(process.execPath, [CLI, f.file, '--mock'], { encoding: 'utf8' });
    expect(result.status).toBe(0); const lines = result.stdout.trim().split('\n'); expect(lines).toHaveLength(1);
    const report = JSON.parse(lines[0]); expect(report).toMatchObject({ ok: true, mock: true, op: 'render-views' });
    expect(result.stderr).toContain('decision:'); expect(result.stderr).toContain('downgrade:'); expect(result.stderr).toContain('commit:');
    expect(existsSync(report.outputs[0].path)).toBe(true);
  });
  it.each([[], ['--unknown'], ['--blender'], ['--timeout-ms'], ['--timeout-ms', '0'], ['--timeout-ms', 'NaN']].map(args => [args]))('rejects invalid CLI args %j with nonzero exit and empty stdout', args => {
    const f = fixture(); const result = spawnSync(process.execPath, [CLI, ...(args.length ? [f.file, ...args] : [])], { encoding: 'utf8' });
    expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expect(result.stderr).toContain('reject:');
  });
});
