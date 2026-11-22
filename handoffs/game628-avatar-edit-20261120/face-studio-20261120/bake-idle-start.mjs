import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const contract = JSON.parse(await readFile(new URL('./face-contract.json', import.meta.url), 'utf8'));
const publicDir = new URL('../public/', import.meta.url);
const binary = await readFile(new URL('art/face-studio-20261120/shared-body.bin', publicDir));

function firstSample(model, accessorIndex, type, size) {
  const accessor = model.accessors[accessorIndex];
  const view = model.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType, 5126);
  assert.equal(accessor.type, type);
  assert.equal(view.buffer, 0);
  assert.equal(accessor.sparse, undefined);
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: size }, (_, index) => binary.readFloatLE(start + index * 4));
}

const recipes = await Promise.all(contract.variants.map(async variant => {
  const file = new URL(variant.src.slice(1), publicDir);
  const model = JSON.parse(await readFile(file, 'utf8'));
  const idle = model.animations.find(animation => animation.name === 'idle');
  assert.ok(idle?.channels.length, variant.id + ' has no idle animation');
  for (const { sampler, target } of idle.channels) {
    const track = idle.samplers[sampler];
    const node = model.nodes[target.node];
    assert.equal(node.matrix, undefined);
    assert.equal(track.interpolation, 'LINEAR');
    assert.equal(firstSample(model, track.input, 'SCALAR', 1)[0], 0);
    const isRotation = target.path === 'rotation';
    assert.ok(isRotation || target.path === 'translation' || target.path === 'scale');
    node[target.path] = firstSample(model, track.output, isRotation ? 'VEC4' : 'VEC3', isRotation ? 4 : 3);
  }
  return { file, model };
}));

// The model pool blends the first clip from these node transforms.
await Promise.all(recipes.map(({ file, model }) => writeFile(file, JSON.stringify(model))));
console.info('[face-idle-start:commit]', recipes.length, 'studio faces');
