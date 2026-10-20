// Unit-test scene bytes only. Explicit authored geometry, never Blender/Tripo evidence.
import { BoxGeometry, PlaneGeometry } from 'three';
import { glb } from '../scene-import/glb-fixtures.mjs';
import { bakeSceneImport } from '../../scene-import.mjs';

export async function createV1CpuScene() {
  const json = {
    asset: { version: '2.0', generator: 'Apollo V1 CPU unit-test authored geometry' },
    scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [],
    accessors: [], bufferViews: [], buffers: [],
  };
  const parts = []; let byteLength = 0;
  const accessor = (values, componentType, type, count, bounds = {}) => {
    const padding = Buffer.alloc((4 - byteLength % 4) % 4);
    parts.push(padding); byteLength += padding.length;
    const bytes = Buffer.alloc(values.length * (componentType === 5126 ? 4 : 2));
    values.forEach((value, i) => componentType === 5126 ? bytes.writeFloatLE(value, i * 4) : bytes.writeUInt16LE(value, i * 2));
    const bufferView = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length });
    parts.push(bytes); byteLength += bytes.length;
    const index = json.accessors.length;
    json.accessors.push({ bufferView, componentType, type, count, ...bounds });
    return index;
  };
  const add = (name, geometry) => {
    const values = Array.from(geometry.getAttribute('position').array);
    const indices = Array.from(geometry.index.array);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    values.forEach((value, i) => { min[i % 3] = Math.min(min[i % 3], value); max[i % 3] = Math.max(max[i % 3], value); });
    const position = accessor(values, 5126, 'VEC3', values.length / 3, { min, max });
    const triangles = accessor(indices, 5123, 'SCALAR', indices.length);
    const mesh = json.meshes.length;
    json.meshes.push({ primitives: [{ attributes: { POSITION: position }, indices: triangles }] });
    json.scenes[0].nodes.push(json.nodes.length); json.nodes.push({ name, mesh });
    geometry.dispose();
  };
  add('col_floor', new BoxGeometry(6, 0.2, 5).translate(0, -0.1, 0));
  add('col_wall', new BoxGeometry(0.5, 2, 2).translate(0, 1, 0));
  add('nav_floor', new PlaneGeometry(6, 5).rotateX(-Math.PI / 2).translate(0, 0.001, 0));
  add('pick_cpu_marker', new BoxGeometry(0.1, 0.1, 0.1).translate(2, 0.05, 2));
  json.scenes[0].nodes.push(json.nodes.length);
  json.nodes.push({ name: 'spawn_hero', translation: [-1, 0, 1] });
  json.buffers.push({ byteLength });
  const bytes = glb(json, Buffer.concat(parts));
  return { bytes, scene: await bakeSceneImport(bytes) };
}
