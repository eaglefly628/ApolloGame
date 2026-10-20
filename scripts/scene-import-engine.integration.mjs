#!/usr/bin/env node
// Real-file, headless E5 acceptance. The GLB is never replaced by hand-authored
// geometry: AssetManager verifies the actual bytes against the supplied bake.
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { engineAliases } from './engine-aliases.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = 'e5-real-model', IMPORT = 'e5-real-scene';
const transform = (x, y) => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const check = (condition, message) => { if (!condition) throw new Error(message); };
const distance = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const nodeId = node => `${IMPORT}/node-${node.path.join('-')}`;

function lineCrossesBounds(a, b, bounds) {
  let lo = 0, hi = 1;
  for (const [key, axis] of [['x', 0], ['y', 2]]) {
    const d = b[key] - a[key], min = bounds.min[axis], max = bounds.max[axis];
    if (Math.abs(d) < 1e-10) { if (a[key] <= min || a[key] >= max) return false; }
    else { const p = (min - a[key]) / d, q = (max - a[key]) / d; lo = Math.max(lo, Math.min(p, q)); hi = Math.min(hi, Math.max(p, q)); }
  }
  return hi > lo;
}

/** Select free endpoints using the real baked graph, then reuse the engine's A*.
 * Endpoint selection is test setup; the actual moving agent still uses pathfind. */
function chooseRoute(graph, wall, buildAdjacency, astar) {
  const sizeX = wall.bounds.max[0] - wall.bounds.min[0], sizeZ = wall.bounds.max[2] - wall.bounds.min[2];
  const crossing = sizeX <= sizeZ ? 'x' : 'y', along = crossing === 'x' ? 'y' : 'x';
  const axis = crossing === 'x' ? 0 : 2, other = axis === 0 ? 2 : 0;
  const middle = (wall.bounds.min[other] + wall.bounds.max[other]) / 2;
  const cell = graph.grid.cellSize;
  const desired = side => ({ [crossing]: (side < 0 ? wall.bounds.min[axis] - 2 * cell : wall.bounds.max[axis] + 2 * cell), [along]: middle });
  const candidates = side => graph.nodes.map((p, index) => ({ ...p, index })).filter(p =>
    (side < 0 ? p[crossing] < wall.bounds.min[axis] - cell / 2 : p[crossing] > wall.bounds.max[axis] + cell / 2)
    && p[along] > wall.bounds.min[other] && p[along] < wall.bounds.max[other])
    .sort((a, b) => distance(a, desired(side)) - distance(b, desired(side)) || a.index - b.index).slice(0, 24);
  const { adj, edgeCost, edgeKey } = buildAdjacency(graph);
  for (const from of candidates(-1)) for (const to of candidates(1)) {
    if (!lineCrossesBounds(from, to, wall.bounds)) continue;
    const path = astar(from.index, to.index, i => adj[i], (a, b) => edgeCost.get(edgeKey(a, b)), i => distance(graph.nodes[i], to));
    if (!path) continue;
    const points = path.map(i => graph.nodes[i]);
    const length = points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0), direct = distance(from, to);
    if (length > direct + cell / 2) return { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, length, direct, expectedPath: points, crossing, along };
  }
  throw new Error(`No free, connected route around actual wall ${wall.name}; this acceptance requires a wall with walkable space on both sides and around an end`);
}

function chooseCollision(probe, wall, route, groundY, contact3d) {
  const entity = probe.entities[nodeId(wall)], axis = route.crossing === 'x' ? 0 : 2, other = axis === 0 ? 2 : 0;
  const radius = Math.min(.2, (wall.bounds.max[1] - Math.max(groundY, wall.bounds.min[1])) / 4);
  check(radius > .02, 'Actual wall is too short for the collision acceptance probe');
  const collider = { type: 'Collider3D', kind: 'sphere', radius, baseY: groundY };
  const targetT = { ...entity.Transform, type: 'Transform' }, targetC = { ...entity.Collider3D, type: 'Collider3D' };
  for (const fraction of [.5, .25, .75]) for (let inset = -.5; inset <= 1; inset += .25) {
    const coords = [0, 0, 0]; coords[axis] = wall.bounds.min[axis] + radius * inset;
    coords[other] = wall.bounds.min[other] + fraction * (wall.bounds.max[other] - wall.bounds.min[other]);
    const initial = transform(coords[0], coords[2]);
    const hit = contact3d(targetT, targetC, { ...initial, type: 'Transform' }, collider);
    const horizontal = route.crossing === 'x' ? hit?.nx : hit?.nz;
    if (hit && horizontal < -.9 && hit.depth > .01 && hit.depth < radius * .9) return { initial, collider, initialContact: hit, targetT, targetC };
  }
  throw new Error(`Could not construct a genuine horizontal sphere contact against the actual convex wall ${wall.name}`);
}

function inspectManifestWarnings(warnings) {
  const renderOnly = new Set(['Model3D', 'Transform3D', 'Pickable3D']);
  for (const warning of warnings) {
    const prefix = '这些组件无对应 provider capability（可能不被解释）：';
    check(warning.startsWith(prefix), `Unexpected manifest warning: ${warning}`);
    const names = warning.slice(prefix.length).split(', ');
    check(names.length > 0 && names.every(name => renderOnly.has(name)), `Missing simulation provider: ${warning}`);
  }
}

export async function runSceneImportEngineIntegration(glbPath, scenePath) {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
  const bytes = readFileSync(glbPath), candidate = JSON.parse(readFileSync(scenePath, 'utf8'));
  const digest = createHash('sha256').update(bytes).digest('hex');
  const runtimeWarnings = [], manifestWarnings = new Set(), warn = console.warn;
  console.warn = (...args) => { runtimeWarnings.push(args.map(String).join(' ')); warn(...args); };
  let server;
  try {
    // Vite 5 still constructs a websocket channel with hmr:false. Supplying an
    // unlistened server keeps that channel in-process and binds no TCP port.
    const unlistenedServer = createHttpServer();
    server = await createServer({ root: ROOT, configFile: false, resolve: { alias: engineAliases(ROOT) },
      appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: { server: unlistenedServer }, watch: { ignored: ['**/*'] } } });
    const [assets, sync, asynchronous, runtime, pathfind, search, contacts, registry] = await Promise.all([
      server.ssrLoadModule('/src/assets/asset-manager.ts'), server.ssrLoadModule('/src/assembly/manifest.ts'),
      server.ssrLoadModule('/src/assembly/manifest-async.ts'), server.ssrLoadModule('/src/runtime/engine.ts'),
      server.ssrLoadModule('/src/skills/tier2/pathfind.ts'), server.ssrLoadModule('/src/engine/spatial/astar.ts'),
      server.ssrLoadModule('/src/engine/spatial/contact3d.ts'), server.ssrLoadModule('/src/assembly/capability-registry.ts'),
    ]);
    let loads = 0;
    const manager = new assets.AssetManager({ load: async descriptor => {
      check(descriptor.kind === 'model' && descriptor.key === MODEL, 'Unexpected asset loader request'); loads++;
      return { handle: Uint8Array.from(bytes).buffer, width: 0, height: 0 };
    } });
    manager.register({ kind: 'model', key: MODEL, src: resolve(glbPath), scene: candidate });
    const loaded = await manager.load(MODEL), catalog = manager.sceneImportCatalog([MODEL]);
    check(loaded.handle instanceof ArrayBuffer && loads === 1, 'AssetManager did not consume the real GLB bytes exactly once');
    check(catalog[MODEL].sourceSha256 === digest, 'Verified catalog SHA does not match the actual GLB');
    const scene = catalog[MODEL], nav = scene.nodes.find(n => n.kind === 'navigation'), spawn = scene.nodes.find(n => n.kind === 'spawn');
    check(nav && spawn, 'Acceptance requires actual navigation and spawn nodes in the input GLB');
    const groundY = nav.positions[1];
    const wall = scene.nodes.filter(n => n.kind === 'collision' && n.bounds.max[1] > groundY + .1 && n.bounds.min[1] < groundY + 1.8)
      .sort((a, b) => Number(/wall/i.test(b.name)) - Number(/wall/i.test(a.name)) || a.index - b.index)[0];
    check(wall, 'Acceptance requires a real col_* wall extending into the agent occupied height');
    const capabilities = ['a-scene-import-3d', 'a1-transform', 'b1-velocity', 'g2-relation', 'k1-spawn',
      'd1-overlap-detect-3d', 'd-collision-resolve-3d', 't1-motion-apply', 't2-navigation-grid', 't2-pathfind', 't2-event-when', 't3-prefab', 't3-caster'];
    const options = { sceneImports: catalog, assetKeys: new Set([MODEL]) };
    const parse = raw => {
      const result = sync.parseManifestDetailed(raw, options); inspectManifestWarnings(result.warnings);
      for (const warning of result.warnings) manifestWarnings.add(warning);
      return result.blueprint;
    };
    const imports = { [IMPORT]: { SceneImport3D: { modelKey: MODEL, rules: 'default' } } };
    const probe = parse({ capabilities, entities: imports }), graph = probe.entities[IMPORT].NavGraph;
    check(graph?.nodes.length > 0 && graph.grid, 'Real imported navigation produced no graph');
    const route = chooseRoute(graph, wall, pathfind.buildAdjacency, search.astar);
    const collision = chooseCollision(probe, wall, route, groundY, contacts.contact3d);
    const speed = .06, arrival = .04;
    const raw = { capabilities, entities: { ...imports,
      'e5-walker': { Transform: transform(route.from.x, route.from.y), NavAgent: { graphId: IMPORT, speed, arriveRange: arrival }, Relation: { kind: 'target', targetId: 'e5-target' } },
      'e5-target': { Transform: transform(route.to.x, route.to.y) },
      'e5-contact': { Transform: collision.initial, Collider3D: { ...collision.collider, type: undefined }, Velocity: { vx: route.crossing === 'x' ? .02 : 0, vy: route.crossing === 'y' ? .02 : 0, angular: 0 } },
      'e5-library': { PrefabLibrary: { seq: 0, templates: { 'e5-actor': { entities: { unit: { Transform: transform(0, 0) } } } } } },
      'e5-deploy': { Caster: { onSignal: 'e5.deploy', template: 'e5-actor', at: 'self', originEntity: nodeId(spawn) } },
      'e5-trigger': { EventWhen: { signal: 'e5.deploy', when: { kind: 'always' }, mode: 'edge', armed: false } },
    } };
    const inputBefore = JSON.stringify([raw, candidate]), runs = [];
    for (const mode of ['sync', 'async', 'direct']) for (let repeat = 0; repeat < 2; repeat++) {
      const engine = new runtime.Engine();
      if (mode === 'sync') engine.load(parse(raw));
      else if (mode === 'async') {
        const result = await asynchronous.parseManifestDetailedAsync(raw, options); inspectManifestWarnings(result.warnings);
        for (const warning of result.warnings) manifestWarnings.add(warning);
        engine.load(result.blueprint);
      } else engine.load({ entities: raw.entities, capabilities: registry.resolveCapabilities(capabilities) }, { sceneImports: catalog });
      runs.push({ mode, repeat, engine, hashes: [], trace: [], firstContact: undefined });
    }
    const ticks = Math.max(180, Math.ceil(route.length / speed) * 2 + 30);
    check(ticks <= 2400, `Acceptance route requires ${ticks} ticks; use a smaller scene fixture`);
    const assertHashes = tick => {
      const hashes = runs.map(run => { const hash = run.engine.hash(); run.hashes.push(hash); return hash; });
      check(new Set(hashes).size === 1, `sync/async/direct world hashes diverged at tick ${tick}: ${hashes.join(',')}`);
    };
    assertHashes(0);
    for (let tick = 1; tick <= ticks; tick++) {
      for (const run of runs) {
        run.engine.world.tick();
        const walker = run.engine.world.getComponent('e5-walker', 'Transform'), body = run.engine.world.getComponent('e5-contact', 'Transform');
        run.trace.push({ x: walker.x, y: walker.y });
        if (tick === 1) run.firstContact = { x: body.x, y: body.y };
      }
      assertHashes(tick);
    }
    const measurements = runs.map(run => {
      const world = run.engine.world, walker = world.getComponent('e5-walker', 'Transform'), body = world.getComponent('e5-contact', 'Transform');
      const anchor = world.getComponent(nodeId(spawn), 'Transform'), actor = world.getComponent('e5-actor#0:unit', 'Transform');
      const remaining = contacts.contact3d(collision.targetT, collision.targetC, { ...body, type: 'Transform' }, collision.collider);
      const error = distance(walker, route.to), pushed = distance(run.firstContact, collision.initial);
      const dx = route.to.x - route.from.x, dy = route.to.y - route.from.y, denominator = Math.sqrt(dx * dx + dy * dy);
      const detour = run.trace.reduce((max, p) => Math.max(max, Math.abs(dx * (p.y - route.from.y) - dy * (p.x - route.from.x)) / denominator), 0);
      check(error <= arrival + 1e-7, `${run.mode}/${run.repeat}: walker failed to arrive (error ${error})`);
      check(detour >= graph.grid.cellSize / 2, `${run.mode}/${run.repeat}: no measured detour around the real wall`);
      check(pushed > .01 && (!remaining || remaining.depth < 1e-7), `${run.mode}/${run.repeat}: real wall did not push the initial sphere overlap out`);
      check(actor && anchor && distance(actor, anchor) < 1e-10, `${run.mode}/${run.repeat}: prefab did not consume the actual spawn anchor`);
      check(world.getComponent('e5-library', 'PrefabLibrary').seq === 1, `${run.mode}/${run.repeat}: expected exactly one prefab spawn`);
      return { mode: run.mode, repeat: run.repeat, finalHash: run.hashes.at(-1), historySha256: createHash('sha256').update(JSON.stringify(run.hashes)).digest('hex'),
        arrivalError: error, maximumDetour: detour, initialSpherePenetration: collision.initialContact.depth, firstTickPush: pushed,
        finalSpherePenetration: remaining?.depth ?? 0, spawnAnchor: { x: anchor.x, z: anchor.y }, prefab: { id: 'e5-actor#0:unit', x: actor.x, z: actor.y } };
    });
    check(inputBefore === JSON.stringify([raw, candidate]), 'Manifest or engine loading mutated the original input');
    check(runtimeWarnings.length === 0, `Unexpected runtime/topology warnings: ${runtimeWarnings.join(' | ')}`);
    return { ok: true, glb: resolve(glbPath), scene: resolve(scenePath), bytes: bytes.length, sourceSha256: digest,
      verifiedBy: 'AssetManager.load -> sceneImportCatalog', roles: scene.nodes.map(n => ({ index: n.index, path: n.path, name: n.name, kind: n.kind })),
      wall: { id: nodeId(wall), bounds: wall.bounds }, navigation: { graphId: IMPORT, nodes: graph.nodes.length, edges: graph.edges.length, cellSize: graph.grid.cellSize, groundY },
      route: { from: route.from, to: route.to, directDistance: route.direct, plannedDistance: route.length }, ticks, runs: measurements,
      warnings: { existingRenderOnlyProviderWarnings: [...manifestWarnings], runtimeWarnings }, inputUnchanged: true };
  } finally { console.warn = warn; await server?.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    check(args.length === 2 && args.every(arg => !arg.startsWith('--')), 'Usage: node scripts/scene-import-engine.integration.mjs <scene.glb> <scene.json>');
    console.log(JSON.stringify(await runSceneImportEngineIntegration(args[0], args[1]), null, 2));
  } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exitCode = 1; }
}
