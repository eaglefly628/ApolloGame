import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { AssetManager } from '../../../src/assets/index.ts';
import { World } from '../../../src/engine/core/world.ts';
import { ThreeRenderer } from '../../../src/renderer/three-renderer.ts';
import { hashWorld } from '../../../src/net/world-hash.ts';
import { hashSnapshot } from '../../../src/net/determinism.ts';
const ensure = (value, message) => { if (!value) throw Error(message); };
let renderer, world, assets, clock = 1000, gl, syncChecks = 0, draws = 0;
const uploads = [], disposals = [], owned = new WeakSet(), nativeHandles = [];
window.renderBindingImages = {};
Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
function stamp() { return JSON.stringify([world.snapshot(), hashWorld(world), hashSnapshot(world.snapshot()), world.writeSequence, [...world.dirty]]); }
function sync(dt = 16) { clock += dt; const before = stamp(); renderer.sync(world.readView()); ensure(stamp() === before, 'render binding mutated snapshot/hash/write sequence/dirty'); syncChecks++; }
function add(id, components) { world.createEntity(id); for (const [type, data] of Object.entries(components)) world.addComponent(id, { type, ...data }); }
function flag(active) { world.addComponent('vars', { type: 'Flag', id: 'lit', active }); }
function ratio(current) { world.addComponent('vars', { type: 'Resource', id: 'fuel', current, min: 0, max: 100 }); }
function signal(name) { world.addComponent('vars', { type: 'Signal', name, source: 'vars' }); world.removeComponent('vars', 'Signal'); }
function pixels() { const data = new Uint8Array(800 * 600 * 4); gl.readPixels(0, 0, 800, 600, gl.RGBA, gl.UNSIGNED_BYTE, data); ensure(gl.getError() === gl.NO_ERROR, 'pixel read failed'); return data; }
function changed(a, b) { let count = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 4) count++; return count; }
function watch(material) { if (owned.has(material)) return; owned.add(material); const row = { uuid: material.uuid, disposals: 0 }; material.addEventListener('dispose', () => row.disposals++); disposals.push(row); }
window.renderBindingProbe = {
  async run() {
    const source = new THREE.Group(), texCanvas = document.createElement('canvas'); texCanvas.width = texCanvas.height = 4; const ctx = texCanvas.getContext('2d'); ctx.fillStyle = '#c8945b'; ctx.fillRect(0, 0, 4, 4);
    const texture = new THREE.CanvasTexture(texCanvas), material = new THREE.MeshStandardMaterial({ map: texture, roughness: .8 }), geometry = new THREE.BoxGeometry(.7, 1.3, .7);
    const left = new THREE.Mesh(geometry, material), right = new THREE.Mesh(geometry, [material, material, material, material, material, material]); left.position.x = -.5; right.position.x = .5; source.add(left, right);
    const bytes = await new GLTFExporter().parseAsync(source, { binary: true }); ensure(bytes instanceof ArrayBuffer, 'fixture is not native binary GLB');
    assets = new AssetManager({ load: async () => ({ handle: bytes, width: 0, height: 0 }) }); assets.register({ kind: 'model', key: 'fixture', src: '/fixture.glb' }); await assets.load('fixture');
    geometry.dispose(); material.dispose(); texture.dispose(); world = new World();
    add('camera', { Camera3D: { yaw: 0, pitch: .15, distance: 8, pivotY: .2, near: .1, far: 30 } });
    add('vars', { Flag: { id: 'lit', active: false }, Resource: { id: 'fuel', current: 25, min: 0, max: 100 } });
    add('light', { Light3D: { kind: 'ambient', color: 0xffffff, intensity: 1 }, RenderBinding3D: { bindings: [{ target: 'Light3D.intensity', source: { kind: 'resource-ratio', id: 'fuel' }, range: [.2, 2] }] } });
    const bind = (id, x, range) => add(id, { Transform3D: { x, y: 0, z: 0 }, Model3D: { modelKey: 'fixture' }, Material3D: { preset: 'matte', materialRef: 'shared', dissolve: { pattern: 'noise', speed: 0, glow: 0 } }, Pickable3D: { signal: 'click' }, RenderBinding3D: { bindings: [{ target: 'Material3D.dissolve.progress', source: { kind: 'signal', on: 'on', off: 'off' }, range }] } });
    bind('a', -1.4, [.15, .85]); bind('b', 1.4, [.85, .15]);
    add('glow', { Transform3D: { x: 0, y: -.9, z: 0 }, Glow3D: { color: 0xffa030, scale: 1.4, opacity: .3 }, Mesh3D: { shape: 'box', width: .5, height: .5, depth: .5, frontTint: 0xffa030 }, Pickable3D: { signal: 'click' }, RenderBinding3D: { bindings: [{ target: 'Glow3D.opacity', source: { kind: 'flag', id: 'lit' }, range: [0, 1] }] } });
    add('vfx', { Transform3D: { x: 0, y: .3, z: 0 }, Vfx3D: { rate: 0, max: 100, size: 1, speed: 1, lifetime: .2 }, RenderBinding3D: { bindings: [{ target: 'Vfx3D.rate', source: { kind: 'signal', on: 'emit', off: 'stop' }, range: [0, 100] }] } });
    renderer = new ThreeRenderer({ assets, width: 800, height: 600, dprCap: 1, antialias: false, materials: new Map([['shared', { preset: 'matte' }]]) }); renderer.init(document.getElementById('stage')); gl = renderer.gl.getContext();
    for (const [create, remove, is] of [['createBuffer','deleteBuffer','isBuffer'],['createTexture','deleteTexture','isTexture'],['createFramebuffer','deleteFramebuffer','isFramebuffer'],['createRenderbuffer','deleteRenderbuffer','isRenderbuffer']]) { const make = gl[create].bind(gl), drop = gl[remove].bind(gl); gl[create] = (...args) => { const handle = make(...args); if (handle) nativeHandles.push({ handle, is, deleted: false }); return handle; }; gl[remove] = handle => { drop(handle); for (const item of nativeHandles) if (item.handle === handle) item.deleted = true; }; }
    const native = renderer.gl.render.bind(renderer.gl); renderer.gl.render = (...args) => { draws++; return native(...args); };
    for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const draw = gl[method].bind(gl); gl[method] = (...args) => { const program = gl.getParameter(gl.CURRENT_PROGRAM), location = gl.getUniformLocation(program, 'uDisProgress'); if (location) uploads.push(gl.getUniform(program, location)); return draw(...args); }; }
    for (let i = 0; i < 100 && renderer.models.instances.size < 2; i++) { sync(); await new Promise(resolve => setTimeout(resolve, 10)); }
    ensure(renderer.models.instances.size === 2, 'native GLB instances never decoded'); sync();
    ensure(uploads.some(value => Math.abs(value - .15) < .00001) && uploads.some(value => Math.abs(value - .85) < .00001), 'actual GPU uniforms did not isolate model instances');
    const shaderValues = uploads.slice(); renderer.invalidate(); sync(); const initial = pixels(); window.renderBindingImages.initial = renderer.gl.domElement.toDataURL(); signal('on'); sync(); const reversed = pixels(); window.renderBindingImages.reversed = renderer.gl.domElement.toDataURL(); ensure(changed(initial, reversed) > 200, 'GLB signal dissolve did not change actual pixels');
    const modelMaterials = [...renderer.modelDissolves.entries.values()].flatMap(entry => entry.materials); modelMaterials.forEach(watch);
    const textureMaps = modelMaterials.map(mat => mat.map).filter(Boolean); ensure(new Set(textureMaps).size === 1, 'model clone fixture did not retain shared texture identity');
    let textureDisposals = 0; textureMaps[0].addEventListener('dispose', () => textureDisposals++);
    ratio(100); sync(); ensure(Math.abs(renderer.lights.ambient.intensity - 2) < 1e-8, 'resource ratio did not reach native light');
    // Make models static at the endpoints; isolate a Glow-only change from all animation live flags.
    for (const id of ['a', 'b']) world.addComponent(id, { type: 'RenderBinding3D', bindings: [{ target: 'Material3D.dissolve.progress', source: { kind: 'flag', id: 'lit' }, range: [0, 0] }] });
    sync(); const darkGlow = pixels(); const before = draws; sync(); ensure(draws === before, 'static bound frame did not converge');
    flag(true); sync(50); const litGlow = pixels(); window.renderBindingImages.glow = renderer.gl.domElement.toDataURL(); ensure(changed(darkGlow, litGlow) > 80 && renderer.glows.get('glow').material.opacity === 1, 'Glow static change was swallowed by dirty cache');
    signal('emit'); sync(50); ensure(renderer.vfx.emitters.get('vfx').parts.length > 0, 'bound VFX rate did not emit real particles');
    flag(false); signal('stop'); for (let i = 0; i < 8; i++) sync(50);
    // Reuse the existing raycast and prove visual hover has no world side effects.
    world.addComponent('glow', { type: 'RenderBinding3D', bindings: [{ target: 'Glow3D.opacity', source: { kind: 'hover' }, range: [0, 1] }] }); sync();
    const point = new THREE.Vector3(0, -.9, 0).project(renderer.cameras.current), x = (point.x + 1) * 400, y = (1 - point.y) * 300;
    const hit = renderer.pick(x, y); ensure(hit?.entityId === 'glow', 'existing pick did not hit hover fixture');
    const snapshot = stamp(); renderer.gl.domElement.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse' })); sync(); ensure(renderer.glows.get('glow').material.opacity === 1 && stamp() === snapshot, 'pure hover did not light or wrote sim');
    renderer.gl.domElement.dispatchEvent(new PointerEvent('pointercancel')); sync(); ensure(renderer.glows.get('glow').material.opacity === 0, 'pointer cancel retained hover');
    const saved = world.snapshot(); signal('on'); sync(); world.restore(saved); sync(); ensure(renderer.glows.get('glow').material.opacity === 0, 'restore retained hover');
    world.destroyEntity('a'); sync(); ensure(textureDisposals === 0, 'removing one effect instance disposed shared model texture');
    for (const id of world.queryEntities('RenderBinding3D')) world.removeComponent(id, 'RenderBinding3D'); sync();
    ensure(renderer.lights.ambient.intensity === 1 && renderer.glows.get('glow').material.opacity === .3 && renderer.modelDissolves.entries.size === 0, 'no-binding path did not restore authored values');
    const stable = draws; sync(); ensure(draws === stable, 'no-binding static frame did not skip');
    return { actualWebGL: gl.getParameter(gl.VERSION), glbBytes: bytes.byteLength, nativeModelInstances: 2, nativeDissolveUniforms: [...new Set(shaderValues)], changedGLBPixels: changed(initial, reversed), changedGlowPixels: changed(darkGlow, litGlow), syncChecks, draws, textureDisposalsBeforeDestroy: textureDisposals, pick: hit };
  },
  destroy() {
    const before = stamp(), nativeLoss = renderer.gl.forceContextLoss.bind(renderer.gl); let loss = 0, beforeLoss;
    renderer.gl.forceContextLoss = () => {
      loss++; beforeLoss = { ...renderer.gl.info.memory };
      // THREE.Sprite owns a module-global shared quad; its final GPU copy is released by context loss.
      ensure(beforeLoss.textures === 0 && beforeLoss.geometries <= 1, 'unexpected owned resources retained: ' + JSON.stringify(beforeLoss));
      return nativeLoss();
    };
    renderer.destroy(); renderer.destroy(); ensure(stamp() === before, 'destroy wrote world');
    ensure(disposals.every(row => row.disposals === 1), 'effect material not disposed exactly once'); ensure(loss === 1, 'context disposed more than once');
    ensure(gl.isContextLost() && nativeHandles.every(item => !gl[item.is](item.handle)), 'native resources remain usable after closing context');
    assets.clear(); return { effectMaterials: disposals, sharedSpriteGeometryBeforeLoss: beforeLoss.geometries, nativeHandles: nativeHandles.length, nativeHandlesUsableAfterLoss: nativeHandles.filter(item => gl[item.is](item.handle)).length, remainingObservers: world.componentObservers?.empty ?? true, canvases: document.querySelectorAll('canvas').length };
  },
};
