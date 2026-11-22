import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = new URL('../', import.meta.url);
const modelUrl = new URL('public/art/reference-rebuild-20261120/scene/street-reference.glb', root);
const bytes = readFileSync(modelUrl);
const model = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
model.scene.updateMatrixWorld(true);
const meshes = [];
model.scene.traverse(object => { if (object.isMesh) meshes.push(object); });
const ray = new THREE.Raycaster();
let seed = 6282026;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
function contact(x, z, slope = 0) {
  ray.set(new THREE.Vector3(x, 11, z), new THREE.Vector3(slope, -1, 0).normalize());
  const hit = ray.intersectObjects(meshes, false)[0];
  if (!hit) return null;
  return { point: hit.point, normal: hit.face.normal.clone().transformDirection(hit.object.matrixWorld) };
}
const effects = {};
const rainIds = [], snowIds = [];
function add(id, entity, group) {
  effects[id] = { ...entity, Visibility: { visible: false } };
  group.push(id);
}
const rainMesh = { shape: 'box', width: 1, height: 1, depth: 1, frontTint: 0xc0d1dc };
const rainMaterial = { preset: 'matte', shading: 'flat', color: 0xb0c6d5 };
const collisionSamples = [];
for (let i = 0; i < 220; i++) {
  const startX = -11 + random() * 22;
  const z = -1.2 + random() * 6;
  const slope = 0.045 + random() * 0.055;
  const hit = contact(startX, z, slope);
  if (!hit) continue;
  const { x, y } = hit.point;
  const angle = Math.atan(slope);
  const length = 0.14 + random() ** 2 * 0.29;
  const width = 0.009 + random() ** 2 * 0.009;
  const half = (10 - y) / 2;
  if (half <= 0.1) continue;
  const freq = (7 + random() * 4) * Math.PI / half;
  const phase = random() * Math.PI * 2;
  add('weather-rain-' + i, {
    Transform3D: {
      x: x - slope * half - Math.sin(angle) * length / 2,
      y: y + half + Math.cos(angle) * length / 2 + 0.007,
      z, rotZ: angle, scaleX: width, scaleY: length, scaleZ: width * 0.45,
    },
    Mesh3D: rainMesh, Material3D: rainMaterial,
    Anim3D: { channels: [
      { kind: 'osc', field: 'y', wave: 'saw', amp: -half, freq, phase },
      { kind: 'osc', field: 'x', wave: 'saw', amp: slope * half, freq, phase },
    ] },
  }, rainIds);
  collisionSamples.push({ start: [startX, 11, z], end: [x, y, z], normal: hit.normal.toArray() });
  if (i % 5 === 0 && hit.normal.y > 0.9 && y < 0.65 && z > 0.9) {
    const radius = 0.035 + random() * 0.035;
    add('weather-ripple-' + i, {
      Transform3D: { x, y: y + 0.012, z, rotX: Math.PI / 2, scale: radius },
      Mesh3D: { shape: 'torus', width: 2, height: 2, tube: 0.025, frontTint: 0x9bafb8 },
      Material3D: { preset: 'matte', shading: 'flat', color: 0x9bafb8 },
      Anim3D: { channels: [{ kind: 'osc', field: 'scale', wave: 'saw', amp: radius * 0.98, freq, phase }] },
    }, rainIds);
    add('weather-puddle-' + i, {
      Transform3D: { x, y, z },
      Decal3D: { kind: 'blob', width: 0.3 + random() * 0.65, height: 0.16 + random() * 0.28, color: 0x718d9c, opacity: 0.35, y: y + 0.006 },
    }, rainIds);
  }
}
for (let i = 0; i < 76; i++) {
  const x = -11 + random() * 22, z = -1 + random() * 5.6;
  const hit = contact(x, z);
  if (!hit || hit.point.y > 8) continue;
  const y = hit.point.y, half = (10 - y) / 2;
  const size = 0.018 + random() * 0.018;
  add('weather-snow-' + i, {
    Transform3D: { x, y: y + half + size, z, scale: size },
    Mesh3D: { shape: 'box', width: 1, height: 1, depth: 1, frontTint: 0xe8eef1 },
    Material3D: { preset: 'matte', shading: 'flat', color: 0xe8eef1 },
    Anim3D: { channels: [
      { kind: 'osc', field: 'y', wave: 'saw', amp: -half, freq: (0.55 + random() * 0.45) * Math.PI / half, phase: random() * 6.28 },
      { kind: 'spin', field: 'rotZ', rate: 0.2 + random() },
    ] },
  }, snowIds);
  if (hit.normal.y > 0.9 && z > 0.1 && (y < 0.65 || i % 3 === 0)) {
    // Ground snow is only placed where an upward ray can reach the open sky.
    add('weather-snow-cover-' + i, {
      Transform3D: { x, y: y + 0.009, z },
      Decal3D: { kind: 'blob', width: 0.5 + random() * 0.9, height: 0.25 + random() * 0.4, color: 0xe7ecec, opacity: 0.86, y: y + 0.009 },
    }, snowIds);
  }
}
const patch = (entity, component, values) => ({ entity, component, values });
const visibility = mode => [
  ...rainIds.map(entity => patch(entity, 'Visibility', { visible: mode === 'rain' })),
  ...snowIds.map(entity => patch(entity, 'Visibility', { visible: mode === 'snow' })),
];
for (const name of ['reference-street', 'reference-walk', 'reference-lighting']) {
  const url = new URL('public/scenes/' + name + '.json', root);
  const config = JSON.parse(readFileSync(url, 'utf8'));
  for (const id of Object.keys(config.manifest.entities)) if (id.startsWith('weather-')) delete config.manifest.entities[id];
  Object.assign(config.manifest.entities, effects, {
    'weather-fog': { Fog3D: { color: 0xb2c8d0, near: 26, far: 160 } },
  });
  const presets = config.environment.presets;
  for (const [id, preset] of Object.entries(presets)) {
    if (id.startsWith('weather.')) { delete presets[id]; continue; }
    preset.patches = preset.patches.filter(p => !p.entity.startsWith('weather-'));
    preset.patches.push(...visibility('clear'), patch('weather-fog', 'Fog3D', { near: 80, far: 300 }));
  }
  const lights = mode => [
    patch('sun', 'Light3D', { color: mode === 'rain' ? 0xe4e4da : 0xeee8d9, intensity: mode === 'rain' ? 1.15 : 1.7 }),
    patch('ambient', 'Light3D', { color: 0xb7cbd9, intensity: 0.82 }),
    patch('sky', 'Sky3D', { top: 0x7793a5, bottom: 0xcbd7d5, cloudTint: 0xcbd5d9, env: 0.12 }),
    patch('weather-fog', 'Fog3D', { color: 0xb2c8d0, near: mode === 'fog' ? 10 : 27, far: mode === 'fog' ? 46 : 110 }),
  ];
  presets['weather.clear'] = { label: '晴天', patches: structuredClone(presets['env.day'].patches) };
  for (const [mode, label] of [['rain', '下雨'], ['snow', '飘雪'], ['fog', '薄雾']]) {
    presets['weather.' + mode] = { label, patches: [...lights(mode), ...visibility(mode)] };
  }
  config.layout.children = config.layout.children.filter(node => node.id !== 'weather-controls');
  config.layout.children.splice(config.layout.children.findIndex(node => node.id === 'footer'), 0, {
    type: 'Panel', id: 'weather-controls', props: { bare: true },
    layout: { direction: 'row', align: 'center', gap: 8, padding: 6, height: 38 },
    children: [
      { type: 'Label', id: 'weather-label', props: { text: '街上的天气', size: 12, color: 'text' } },
      ...Object.entries({ clear: '晴天', rain: '下雨', snow: '飘雪', fog: '薄雾' }).map(([mode, label]) => ({
        type: 'Button', id: 'weather-select-' + mode, props: { label, action: 'weather.' + mode, kind: 'quiet' },
      })),
    ],
  });
  writeFileSync(url, JSON.stringify(config, null, 2) + '\n');
}
writeFileSync(new URL('collision-samples.json', import.meta.url), JSON.stringify({
  model: fileURLToPath(modelUrl), rainCount: collisionSamples.length, rippleCount: rainIds.filter(id => id.startsWith('weather-ripple')).length,
  note: 'Static triangle raycasts baked against the actual street GLB. Re-run when the street geometry changes.',
  samples: collisionSamples,
}, null, 2) + '\n');
console.log({ rain: collisionSamples.length, rainEffects: rainIds.length, snowEffects: snowIds.length });
