#!/usr/bin/env node
// Explicit offline R2 acceptance. Real mode uses the pinned T7 Blender bridge;
// --mock uses the authored fixture bytes and clearly skips Blender execution.
// No credentials/network/paid model service are required in either path.
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { engineAliases } from './engine-aliases.mjs';
import { importScene } from './scene-import.mjs';
import { runBlenderJob } from './blender-job.mjs';
import { realDracoVariant } from './fixtures/scene-import/draco-variant.mjs';
import { createGroundWalkingFixture, GROUND_FIXTURE_LAYOUT } from './fixtures/ground-walking/blender-ground.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PINNED_BLENDER = '/private/tmp/apollo-tools/blender-4.5.14/Blender.app/Contents/MacOS/Blender';
const MODEL = 'r2-real-model', IMPORT = 'r2-real-scene', MARKER = 'r2-foot-marker';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => { if (!condition) throw new Error(message); };
const transform = (x, y) => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const actor = (x, z, model = false) => ({ Transform: transform(x, z), Collider3D: { kind: 'capsule', radius: .15, height: 1.2, baseY: 0 },
  GroundWalker3D: { surfaceId: IMPORT }, Velocity: { vx: 0, vy: 0, angular: 0 }, ...(model ? { Model3D: { modelKey: MARKER, scale: 1 } } : {}) });
function rawManifest() {
  return { capabilities: ['a-scene-import-3d', 'a1-transform', 'b1-velocity', 'd1-overlap-detect-3d', 'd-collision-resolve-3d', 't1-motion-apply', 't2-navigation-grid', 't2-pathfind', 't2-ground-walk-3d'], entities: {
    [IMPORT]: { SceneImport3D: { modelKey: MODEL, rules: 'default', ground: { source: 'navigation' } } },
    ramp: actor(-3.5, -4, true), step: { ...actor(-.4, 0), Collider3D: { kind: 'capsule', radius: .3, height: 1.2, baseY: 0 } }, high: actor(-.4, 4), hole: actor(-.4, 8), wall: actor(-.2, 12),
  } };
}
const ACTORS = ['ramp', 'step', 'high', 'hole', 'wall'];
function input(world, tick) {
  for (const id of ACTORS) {
    const v = world.getComponent(id, 'Velocity');
    v.vx = id === 'ramp' ? (tick <= 90 ? .05 : -.05) : id === 'step' ? (tick <= 90 ? .04 : -.04) : id === 'wall' ? (tick <= 10 ? .05 : 0) : tick === 1 ? .8 : 0;
    v.vy = 0;
  }
}
function inspectManifestWarnings(warnings) {
  const renderOnly = new Set(['Model3D', 'Transform3D', 'Pickable3D']);
  for (const warning of warnings) {
    const prefix = '这些组件无对应 provider capability（可能不被解释）：';
    check(warning.startsWith(prefix), `Unexpected manifest warning: ${warning}`);
    check(warning.slice(prefix.length).split(', ').every(name => renderOnly.has(name)), `Missing simulation provider: ${warning}`);
  }
}
function measuredState(world, sampler) {
  const s = world.getComponent(IMPORT, 'GroundSurface3D');
  return Object.fromEntries(ACTORS.map(id => {
    const t = world.getComponent(id, 'Transform'), body = world.getComponent(id, 'Collider3D'), c = world.getComponent(id, 'GroundContact3D');
    const xQ = Math.round((t.x + (body.offsetX ?? 0)) * 10000) || 0, zQ = Math.round((t.y + (body.offsetZ ?? 0)) * 10000) || 0;
    const hit = sampler(s, xQ, zQ, c?.triangleId);
    check(c?.supported && hit, `${id}: missing support after tick`);
    check(body.baseY === hit.heightQ / 10000 && c.heightQ === hit.heightQ && c.acceptedHeightQ === hit.heightQ, `${id}: final height differs from the actual final XZ surface sample`);
    check(c.acceptedXQ === xQ && c.acceptedZQ === zQ, `${id}: final accepted coordinates were not committed`);
    return [id, { x: t.x, z: t.y, baseY: body.baseY, heightQ: c.heightQ, triangleId: c.triangleId }];
  }));
}

export async function runGroundWalkingEngineIntegration(glbPath, scenePath, options = {}) {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
  const bytes = readFileSync(glbPath), candidate = JSON.parse(readFileSync(scenePath, 'utf8'));
  const runtimeWarnings = [], manifestWarnings = new Set(), originalWarn = console.warn, originalInfo = console.info;
  console.warn = (...args) => { runtimeWarnings.push(args.map(String).join(' ')); originalWarn(...args); };
  console.info = (...args) => console.error(...args);
  let server;
  try {
    // An unlistened HTTP server prevents Vite 5's HMR websocket from opening a
    // hidden TCP listener, even when middlewareMode is used.
    const unlistenedServer = createHttpServer();
    server = await createServer({ root: ROOT, configFile: false, resolve: { alias: engineAliases(ROOT) }, appType: 'custom', logLevel: 'error',
      server: { middlewareMode: true, hmr: { server: unlistenedServer }, watch: { ignored: ['**/*'] } } });
    const [assets, sync, asynchronous, runtime, registry, surfaceMath, verify] = await Promise.all([
      server.ssrLoadModule('/src/assets/asset-manager.ts'), server.ssrLoadModule('/src/assembly/manifest.ts'),
      server.ssrLoadModule('/src/assembly/manifest-async.ts'), server.ssrLoadModule('/src/runtime/engine.ts'),
      server.ssrLoadModule('/src/assembly/capability-registry.ts'), server.ssrLoadModule('/src/engine/spatial/ground-surface.ts'),
      server.ssrLoadModule('/src/assets/scene-import-data.ts'),
    ]);
    await verify.verifySceneImportBytes(candidate, Uint8Array.from(bytes).buffer);
    let loads = 0;
    const manager = new assets.AssetManager({ load: async descriptor => {
      check(descriptor.kind === 'model' && descriptor.key === MODEL, 'Unexpected real asset request'); loads++;
      return { handle: Uint8Array.from(bytes).buffer, width: 0, height: 0 };
    } });
    manager.register({ kind: 'model', key: MODEL, src: resolve(glbPath), scene: candidate });
    await manager.load(MODEL);
    const catalog = manager.sceneImportCatalog([MODEL]);
    check(loads === 1 && catalog[MODEL].sourceSha256 === sha(bytes), 'Actual GLB bytes were not SHA-verified exactly once');
    const parseOptions = { sceneImports: catalog, assetKeys: new Set([MODEL, MARKER]) }, raw = rawManifest(), before = JSON.stringify([raw, candidate]);
    const parsed = sync.parseManifestDetailed(raw, parseOptions); inspectManifestWarnings(parsed.warnings); parsed.warnings.forEach(w => manifestWarnings.add(w));
    const asyncParsed = await asynchronous.parseManifestDetailedAsync(raw, parseOptions); inspectManifestWarnings(asyncParsed.warnings); asyncParsed.warnings.forEach(w => manifestWarnings.add(w));
    assert.deepEqual(parsed.blueprint.entities, asyncParsed.blueprint.entities, 'sync/async ground expansion differs');
    const runs = [];
    for (const mode of ['sync', 'async', 'direct']) for (const trace of [false, true]) {
      const engine = new runtime.Engine();
      engine.load(mode === 'sync' ? parsed.blueprint : mode === 'async' ? asyncParsed.blueprint : { entities: raw.entities, capabilities: registry.resolveCapabilities(raw.capabilities) }, mode === 'direct' ? { sceneImports: catalog } : undefined);
      if (trace) engine.world.addComponent(IMPORT, { type: 'DebugTrace', events: [], max: 10000 });
      runs.push({ mode, trace, engine, hashes: [], frames: [] });
    }
    const order = runs[0].engine.world.getSortedSystems().map(system => system.id);
    for (const [a, b] of [['ground-init-3d', 'motion-apply'], ['motion-apply', 'ground-pre-3d'], ['ground-pre-3d', 'overlap-detect-3d'], ['overlap-detect-3d', 'collision-resolve-3d'], ['collision-resolve-3d', 'ground-final-3d']]) check(order.indexOf(a) >= 0 && order.indexOf(a) < order.indexOf(b), `Invalid actual system order ${a} -> ${b}: ${order.join(',')}`);
    const ticks = 180, hashes = tick => {
      const values = runs.map(run => { const value = run.engine.hash(); run.hashes.push(value); return value; });
      check(new Set(values).size === 1, `sync/async/direct or trace hash differs at tick ${tick}: ${values.join(',')}`);
    };
    hashes(0);
    for (let tick = 1; tick <= ticks; tick++) {
      for (const run of runs) {
        input(run.engine.world, tick); run.engine.world.tick();
        run.frames.push(measuredState(run.engine.world, surfaceMath.sampleGroundSurface));
        if (tick === 90) run.saved = { snapshot: run.engine.world.snapshot(), order: run.engine.world.snapshotOrder() };
      }
      hashes(tick);
    }
    const frames = runs[0].frames;
    const measurements = {
      ramp: { startX: -3.5, turn: frames[89].ramp, end: frames.at(-1).ramp, minHeight: Math.min(...frames.map(f => f.ramp.baseY)), maxHeight: Math.max(...frames.map(f => f.ramp.baseY)) },
      legalStep: { startX: -.4, turn: frames[89].step, end: frames.at(-1).step, maxHeight: Math.max(...frames.map(f => f.step.baseY)) },
      highStep: { maximumX: Math.max(...frames.map(f => f.high.x)), first: frames[0].high },
      hole: { maximumX: Math.max(...frames.map(f => f.hole.x)), first: frames[0].hole },
      wall: { initial: { x: -.2, z: 12, groundY: .95 }, first: frames[0].wall, maximumX: Math.max(...frames.map(f => f.wall.x)) },
    };
    const failures = [];
    const acceptance = (condition, message) => { if (!condition) failures.push(message); };
    acceptance(Math.abs(measurements.ramp.turn.x - 1) < .001 && Math.abs(measurements.ramp.end.x + 3.5) < .001 && measurements.ramp.maxHeight - measurements.ramp.minHeight > 1, 'real ramp did not complete supported uphill/downhill travel');
    acceptance(measurements.legalStep.turn.x > 2 && measurements.legalStep.maxHeight === .2 && Math.abs(measurements.legalStep.end.x + .4) < .001, 'real 0.2m legal step did not allow ordinary-radius capsule up and down');
    acceptance(Math.abs(measurements.highStep.maximumX + .4) < 1e-8, '1m high step did not reject the first large movement');
    acceptance(Math.abs(measurements.hole.maximumX + .4) < 1e-8, 'continuous sweep crossed the actual 0.2m hole');
    acceptance(measurements.wall.first.x < -.24 && measurements.wall.maximumX <= -.249, 'real wall did not push/block the capsule');
    acceptance(measurements.wall.first.heightQ === Math.ceil((measurements.wall.first.x * .25 + 1) * 10000 - 1e-7), 'post-collision final XZ did not determine same-tick ramp foot height');
    acceptance(Math.abs(measurements.wall.first.baseY - measurements.wall.initial.groundY) > .005, 'collision fixture did not actually change the ground height during the first tick');
    const restored = [];
    for (const run of runs) {
      const world = run.engine.world; world.restore(run.saved.snapshot, run.saved.order);
      check(run.engine.hash() === run.hashes[90], `${run.mode}/${run.trace}: snapshot+order immediate hash differs`);
      for (let tick = 91; tick <= ticks; tick++) {
        input(world, tick); world.tick();
        check(run.engine.hash() === run.hashes[tick], `${run.mode}/${run.trace}: restored history differs at tick ${tick}`);
      }
      const trace = world.getComponent(IMPORT, 'DebugTrace')?.events ?? [];
      if (run.trace) {
        acceptance(trace.some(event => event.kind === 'reject' && event.why?.includes('hole, boundary or excessive step')), 'trace does not explain rejected high step/hole');
        acceptance(trace.some(event => event.system === 'collision-resolve-3d' && event.kind === 'decision'), 'trace does not record support contact decisions');
        const density = new Map(); for (const event of trace) { const key = `${event.tick}:${event.system}`; density.set(key, (density.get(key) ?? 0) + 1); }
        acceptance([...density.values()].every(count => count <= 3), 'trace exceeds 3 events per system/tick');
      }
      restored.push({ mode: run.mode, trace: run.trace, ticks, finalHash: run.hashes.at(-1), historySha256: sha(JSON.stringify(run.hashes)), snapshotAndOrderRestored: true, traceEvents: trace });
    }
    check(before === JSON.stringify([raw, candidate]), 'Ground loading mutated the input candidate/manifest');
    check(runtimeWarnings.length === 0, `Unexpected runtime/topology warning: ${runtimeWarnings.join(' | ')}`);
    const table = parsed.blueprint.entities[IMPORT].GroundSurface3D;
    const report = { ok: failures.length === 0, glb: resolve(glbPath), scene: resolve(scenePath), modelKey: MODEL, importId: IMPORT, markerModelKey: MARKER,
      sourceSha256: sha(bytes), bytes: bytes.length, verifiedBy: 'verifySceneImportBytes + AssetManager.load -> sceneImportCatalog',
      layout: GROUND_FIXTURE_LAYOUT, actorDefinitions: Object.fromEntries(ACTORS.map(id => [id, raw.entities[id]])), systemOrder: order, ticks, table, tableSha256: sha(JSON.stringify(table)), measurements,
      runs: restored, frames, warnings: { existingRenderOnlyProviderWarnings: [...manifestWarnings], runtimeWarnings }, inputUnchanged: true, failures };
    if (failures.length && !options.reportFailures) throw Object.assign(new Error(failures.join('; ')), { report });
    return report;
  } finally { console.warn = originalWarn; console.info = originalInfo; await server?.close(); }
}

export async function runGroundWalkingIntegration({ mock = false, evidenceDir, keep = false } = {}) {
  const blender = process.env.BLENDER_BIN || PINNED_BLENDER;
  if (!mock && !existsSync(blender)) {
    console.warn('[ground-walking-real] skip: pinned Blender is unavailable; set BLENDER_BIN or use --mock for authored offline geometry');
    return { ok: true, skipped: true, mock: false, realValidationPerformed: false, reason: 'pinned Blender unavailable' };
  }
  const dir = evidenceDir ? resolve(evidenceDir) : mkdtempSync(join(tmpdir(), 'apollo-r2-ground-'));
  const fixture = createGroundWalkingFixture(dir), save = (name, data) => { const path = join(dir, name); writeFileSync(path, Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2)); return path; };
  const retained = keep || !!evidenceDir || process.env.GROUND_WALK_KEEP_EVIDENCE === '1';
  let failed = false;
  try {
    let glb = fixture.sourcePath, blenderRuns = [];
    if (mock) console.warn('[ground-walking-real] skip Blender: explicit --mock; testing authored offline GLB, not a Blender/Tripo result');
    else {
      const prior = process.env.BLENDER_BIN; process.env.BLENDER_BIN = blender;
      try {
        const a = runBlenderJob(fixture.jobPath), first = readFileSync(a.outputs[0].path), b = runBlenderJob(fixture.jobPath);
        check(!a.mock && !b.mock, 'Real mode silently used mock Blender');
        assert.deepEqual(readFileSync(b.outputs[0].path), first, 'Real Blender exports differ across identical jobs');
        glb = b.outputs[0].path; blenderRuns = [a, b];
      } finally { if (prior === undefined) delete process.env.BLENDER_BIN; else process.env.BLENDER_BIN = prior; }
    }
    const rawScenePath = join(dir, 'scene.json'), rawCandidate = await importScene(glb, { out: rawScenePath });
    const dracoPath = save('scene-draco.glb', realDracoVariant(readFileSync(glb))), dracoScenePath = join(dir, 'scene-draco.json');
    const dracoCandidate = await importScene(dracoPath, { out: dracoScenePath });
    assert.deepEqual(dracoCandidate.nodes, rawCandidate.nodes, 'Raw/Draco actual quantized scene geometry differs');
    const raw = await runGroundWalkingEngineIntegration(glb, rawScenePath, { reportFailures: true });
    const draco = await runGroundWalkingEngineIntegration(dracoPath, dracoScenePath, { reportFailures: true });
    assert.deepEqual(raw.table, draco.table, 'Raw/Draco ground tables differ');
    assert.deepEqual(raw.runs.map(run => run.historySha256), draco.runs.map(run => run.historySha256), 'Raw/Draco deterministic histories differ');
    const report = { ok: raw.ok && draco.ok, mock, skipped: false, realBlenderExecuted: !mock, source: 'explicit authored offline terrain; no Tripo API claim',
      evidenceDir: dir, marker: fixture.markerPath, layout: fixture.layout, blenderRuns, raw, draco };
    save('report.json', report);
    if (!report.ok) throw Object.assign(new Error([...raw.failures, ...draco.failures].join('; ')), { evidenceDir: dir, reportPath: join(dir, 'report.json') });
    return report;
  } catch (error) { failed = true; throw error; }
  finally {
    if (retained || failed) console.error(`[ground-walking-real] evidence retained: ${dir}`);
    else rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2); check(args.every(arg => arg === '--mock' || arg === '--keep'), 'Usage: node scripts/ground-walking.integration.mjs [--mock] [--keep]');
    const report = await runGroundWalkingIntegration({ mock: args.includes('--mock'), keep: args.includes('--keep') });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message, evidenceDir: error.evidenceDir, reportPath: error.reportPath }, null, 2)); process.exitCode = 1; }
}
