import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { AnimationMixer, BoxGeometry, CylinderGeometry, LoadingManager, Quaternion, TorusGeometry, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { solveTwoBone } from './apollo-two-bone.mjs';

const art = new URL('../public/art/face-studio-20261120/', import.meta.url);
const sharedPath = '/art/face-studio-20261120/shared-body.bin';
const shared = await readFile(new URL('shared-body.bin', art));
const sharedData = 'data:application/octet-stream;base64,' + shared.toString('base64');
const dataUrl = bytes => 'data:application/octet-stream;base64,' + bytes.toString('base64');
globalThis.ProgressEvent ??= class {};
const v = (x, y, z) => new Vector3(x, y, z);
const position = node => node.getWorldPosition(new Vector3());
const rotation = node => node.getWorldQuaternion(new Quaternion());
const smooth = x => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const ramp = (time, a, b) => smooth((time - a) / (b - a));
const duration = 5;
const rate = 30;
const times = Array.from({ length: duration * rate + 1 }, (_, frame) => frame / rate);
const cupStart = v(-.105, 1.055, .305);
const cupMiddle = v(0, 1.13, .312);
const cupFinish = v(.105, 1.055, .305);
const buttonStart = v(-.18, .996, .275);
const gripOffset = .064;

function performance(action, t) {
  if (action === 'press') {
    const travel = .022 * (ramp(t, .85, 1.1) - ramp(t, 1.4, 1.65));
    const prop = buttonStart.clone().add(v(0, -travel, 0));
    return { prop, right: { contact: prop.clone().add(v(0, .009, 0)),
      blend: ramp(t, .2, .8) - ramp(t, 1.65, 2.35), touching: t >= .8 && t <= 1.65 } };
  }

  const transfer = action === 'handoff';
  const grab = ramp(t, .8, 1.5);
  const placeAt = transfer ? 3.15 : 2.4;
  const leave = ramp(t, transfer ? 2.25 : 1.7, placeAt);
  const prop = cupStart.clone().lerp(cupMiddle, grab).lerp(transfer ? cupFinish : cupStart, leave);
  const releaseRight = transfer ? 2.20 : placeAt;
  return {
    prop,
    right: { contact: prop.clone().add(v(-gripOffset, 0, 0)),
      blend: ramp(t, .18, .8) - ramp(t, releaseRight, releaseRight + .6), touching: t >= .8 && t <= releaseRight },
    ...(transfer ? { left: { contact: prop.clone().add(v(gripOffset, 0, 0)),
      blend: ramp(t, 1.3, 1.75) - ramp(t, placeAt, 3.8), touching: t >= 1.75 && t <= placeAt } } : {}),
  };
}

function arm(scene, side, contactDirection) {
  const get = suffix => {
    const object = scene.getObjectByName(side + suffix);
    assert.ok(object, side + suffix);
    return object;
  };
  const upper = get('UpperArm'), lower = get('LowerArm'), wrist = get('Hand'), mesh = get('-hand');
  const joints = [upper, lower, wrist];
  const rest = joints.map(object => object.quaternion.clone());
  const wristWorld = rotation(wrist);
  const vertices = mesh.geometry.getAttribute('position');
  const point = new Vector3();
  let support = -Infinity;
  for (let index = 0; index < vertices.count; index++) {
    const candidate = mesh.localToWorld(new Vector3().fromBufferAttribute(vertices, index));
    const along = candidate.dot(contactDirection);
    if (along > support) {
      point.copy(candidate);
      support = along;
    }
  }
  return { joints, rest, wristWorld, offset: point.clone().sub(position(wrist)), marker: wrist.worldToLocal(point) };
}

function aim(chain, gesture, side) {
  const [upper, lower, wrist] = chain.joints;
  if (!gesture || gesture.blend <= 0) return;
  const start = position(upper), elbow = position(lower), hand = position(wrist);
  const goal = hand.clone().lerp(gesture.contact.clone().sub(chain.offset), gesture.blend);
  const solved = solveTwoBone(start, elbow, hand, goal, start.clone().add(v(side * .24, -.25, -.12)));
  assert.ok(solved?.reachable, `unreachable ${goal.toArray()}`);
  const align = (node, from, to) => {
    const alignWorld = new Quaternion().setFromUnitVectors(from.normalize(), to.normalize()).multiply(rotation(node));
    node.quaternion.copy(rotation(node.parent).invert().multiply(alignWorld)).normalize();
    node.updateWorldMatrix(false, true);
  };
  align(upper, elbow.clone().sub(start), solved.mid.clone().sub(start));
  align(lower, position(wrist).sub(position(lower)), solved.end.clone().sub(solved.mid));
  wrist.quaternion.copy(rotation(wrist.parent).invert().multiply(chain.wristWorld)).normalize();
  wrist.updateWorldMatrix(false, true);
}

function appendData(model, bufferIndex) {
  const chunks = [];
  let offset = 0;
  function append(values, type, size, target) {
    const data = Float32Array.from(values.flat());
    const bytes = Buffer.from(data.buffer);
    const view = model.bufferViews.push({ buffer: bufferIndex, byteOffset: offset, byteLength: bytes.length,
      ...(target ? { target } : {}) }) - 1;
    offset += bytes.length;
    chunks.push(bytes);
    const min = Array(size).fill(Infinity), max = Array(size).fill(-Infinity);
    data.forEach((value, index) => { const k = index % size; min[k] = Math.min(min[k], value); max[k] = Math.max(max[k], value); });
    return model.accessors.push({ bufferView: view, componentType: 5126, count: data.length / size, type, min, max }) - 1;
  }
  return { append, finish: () => Buffer.concat(chunks) };
}

function addProps(model, append, action) {
  function mesh(name, geometry, color, translation, parent, rotation) {
    const triangles = geometry.index ? geometry.toNonIndexed() : geometry;
    const attributes = Object.fromEntries(['position', 'normal'].map(name => [
      name.toUpperCase(), append(Array.from(triangles.attributes[name].array), 'VEC3', 3, 34962),
    ]));
    const material = model.materials.push({ pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: .7 } }) - 1;
    const mesh = model.meshes.push({ primitives: [{ attributes, material }] }) - 1;
    const index = model.nodes.push({ name, mesh, translation, ...(rotation ? { rotation } : {}) }) - 1;
    if (parent === undefined) model.scenes[model.scene ?? 0].nodes.push(index);
    else (model.nodes[parent].children ??= []).push(index);
    return index;
  }

  const platform = [.17, .21, .24, 1], teal = [.06, .53, .63, 1], dark = [.024, .085, .105, 1];
  if (action === 'press') {
    mesh('ButtonStand', new BoxGeometry(.17, .94, .14), platform, [-.18, .47, .275]);
    mesh('ButtonCollar', new CylinderGeometry(.056, .056, .045, 20), dark, [-.18, .9615, .275]);
    return mesh('ContactProp', new CylinderGeometry(.049, .051, .018, 20), [.85, .18, .07, 1], buttonStart.toArray());
  }
  const tableX = action === 'handoff' ? 0 : cupStart.x;
  mesh('CupRest', new BoxGeometry(action === 'handoff' ? .49 : .24, .03, .15), platform, [tableX, 1.055 - .06, .305]);
  mesh('CupStand', new BoxGeometry(.06, .98, .075), platform, [tableX, .49, .305]);
  const cup = mesh('ContactProp', new CylinderGeometry(.043, .034, .09, 24), teal, cupStart.toArray());
  mesh('CupInset', new CylinderGeometry(.037, .037, .001, 24), dark, [0, .0451, 0], cup);
  // The two handle outer surfaces are the two contact anchors used by the handover.
  for (const side of action === 'handoff' ? [-1, 1] : [-1]) {
    mesh('CupHandle-' + side, new TorusGeometry(.018, .004, 8, 16), teal, [side * .042, 0, 0], cup);
  }
  return cup;
}

const recipes = {};
const solver = await readFile(new URL('apollo-two-bone.mjs', import.meta.url));
const solverSha256 = createHash('sha256').update(solver).digest('hex');
const manifest = { bakeRate: rate, replayRate: 60, duration, solverSha256, recipes };
for (const action of ['cup', 'press', 'handoff']) {
  recipes[action] = [];
  for (const body of [0, 1, 2]) {
    for (const hand of [0, 1]) {
      const key = `contact-${action}-${body}${hand}`;
      const source = `avatar-0${body}0${hand}.gltf`;
      const json = await readFile(new URL(source, art), 'utf8');
      const model = JSON.parse(json);
      const load = (json, extraUri, extra) => new GLTFLoader(new LoadingManager().setURLModifier(url =>
        url === sharedPath ? sharedData : url === extraUri ? dataUrl(extra) : url)).parseAsync(json, '');
      const modelScene = (await load(json)).scene;
      modelScene.updateMatrixWorld(true);
      const chains = {
        right: arm(modelScene, 'Right', action === 'press' ? v(0, -1, 0) : v(1, 0, 0)),
        ...(action === 'handoff' ? { left: arm(modelScene, 'Left', v(-1, 0, 0)) } : {}),
      };
      const { append, finish } = appendData(model, model.buffers.length);
      const prop = addProps(model, append, action);
      const anchorNames = {};
      function socket(name, parent, translation) {
        const index = model.nodes.push({ name, translation }) - 1;
        (model.nodes[parent].children ??= []).push(index);
        return name;
      }
      for (const [side, chain] of Object.entries(chains)) {
        const [, , wrist] = chain.joints;
        const title = side === 'right' ? 'Right' : 'Left';
        const initial = performance(action, 0);
        anchorNames[side] = {
          hand: socket(title + 'HandContact', model.nodes.findIndex(node => node.name === wrist.name), chain.marker.toArray()),
          prop: socket(title + 'PropContact', prop, initial[side].contact.clone().sub(initial.prop).toArray()),
        };
      }
      const time = append(times, 'SCALAR', 1);
      const props = [];
      const tracks = Object.fromEntries(Object.entries(chains).map(([side, chain]) => [side, chain.joints.map(() => [])]));
      for (const t of times) {
        const pose = performance(action, t);
        props.push(pose.prop.toArray());
        for (const [side, chain] of Object.entries(chains)) {
          chain.joints.forEach((node, index) => node.quaternion.copy(chain.rest[index]));
          modelScene.updateMatrixWorld(true);
          aim(chain, pose[side], side === 'right' ? -1 : 1);
          chain.joints.forEach((node, index) => tracks[side][index].push(node.quaternion.toArray()));
        }
      }
      const clip = { name: action, samplers: [], channels: [] };
      function channel(node, path, values) {
        const size = path === 'rotation' ? 4 : 3;
        const sampler = clip.samplers.push({ input: time, output: append(values, `VEC${size}`, size), interpolation: 'LINEAR' }) - 1;
        clip.channels.push({ sampler, target: { node, path } });
      }
      channel(prop, 'translation', props);
      for (const [side, chain] of Object.entries(chains)) {
        chain.joints.forEach((node, index) => channel(model.nodes.findIndex(data => data.name === node.name), 'rotation', tracks[side][index]));
      }
      model.animations.push(clip);
      const bytes = finish();
      const uri = `/art/face-studio-20261120/${key}.bin`;
      model.buffers.push({ uri, byteLength: bytes.length });
      const output = JSON.stringify(model);

      const replay = await load(output, uri, bytes);
      const mixer = new AnimationMixer(replay.scene);
      mixer.clipAction(replay.animations.find(item => item.name === action)).play();
      const replayProp = replay.scene.getObjectByName('ContactProp');
      const results = Object.fromEntries(Object.keys(chains).map(side => [side, { contactSamples: 0, maxContactErrorM: 0, finalClearanceM: 0 }]));
      let maxPropReplayErrorM = 0;
      const playbackTimes = Array.from({ length: duration * 60 }, (_, frame) => frame / 60);
      playbackTimes.push(duration - .0001);
      for (const t of playbackTimes) {
        mixer.setTime(t);
        replay.scene.updateMatrixWorld(true);
        const expected = performance(action, t);
        const propPosition = position(replayProp);
        maxPropReplayErrorM = Math.max(maxPropReplayErrorM, propPosition.distanceTo(expected.prop));
        for (const [side, names] of Object.entries(anchorNames)) {
          const anchor = position(replay.scene.getObjectByName(names.hand));
          const surface = position(replay.scene.getObjectByName(names.prop));
          const error = anchor.distanceTo(surface);
          if (expected[side].touching) {
            results[side].contactSamples++;
            results[side].maxContactErrorM = Math.max(results[side].maxContactErrorM, error);
          }
          if (t > duration - .001) results[side].finalClearanceM = error;
        }
      }
      for (const result of Object.values(results)) {
        assert.ok(result.contactSamples > 0 && result.maxContactErrorM < .008 && result.finalClearanceM > .07, JSON.stringify({ key, result }));
      }
      assert.ok(maxPropReplayErrorM < .001, key);
      await writeFile(new URL(`${key}.bin`, art), bytes);
      await writeFile(new URL(`${key}.gltf`, art), output);
      recipes[action].push({ key, body, hand, source, anchorNames, results, maxPropReplayErrorM });
    }
  }
}
await writeFile(new URL('./hands-assets.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
console.info('[hands-bake:commit]', Object.values(recipes).reduce((total, variants) => total + variants.length, 0), 'replayed assets');
