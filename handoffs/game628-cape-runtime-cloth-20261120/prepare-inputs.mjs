import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { AnimationMixer, Box3, LoadingManager, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(root, '../game628-avatar-edit-20261120/public');
const canonicalPath = path.resolve(root, '../game628-cape-runtime-engine-20261120/CONTRACT.json');
const canonicalBytes = await fs.readFile(canonicalPath);
const canonical = JSON.parse(canonicalBytes);
if (canonical.attachment.left.node !== 'LeftUpperArm' || canonical.attachment.right.node !== 'RightUpperArm') throw new Error('Reconcile canonical bone choices before regenerating');
const sourceUnitM = 0.0086;
const round = value => Number(value.toFixed(7));
const vector = v => v.toArray().map(round);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
globalThis.ProgressEvent ??= class ProgressEvent {};
const summary = { version: 1, status: 'inputs-aligned-with-isolated-engine-candidate', units: 'meters', axes: 'Y-up,+Z-forward', sampleHz: 60, canonicalContract: {path:canonicalPath,sha256:sha(canonicalBytes)}, bodies: [] };

for (const bodyId of ['slim', 'full']) {
  const src = `/art/face-studio-20261120/body-${bodyId}.gltf`;
  const bytes = await fs.readFile(publicRoot + src);
  const json = JSON.parse(bytes);
  const binary = await fs.readFile(publicRoot + json.buffers[0].uri);
  const binaryUri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
  const loader = new GLTFLoader(new LoadingManager().setURLModifier(url => url === json.buffers[0].uri ? binaryUri : url));
  const asset = await loader.parseAsync(bytes.toString(), '');
  const mixer = new AnimationMixer(asset.scene);
  const node = name => {
    const found = asset.scene.getObjectByName(name);
    if (!found) throw new Error(`Missing node ${name}`);
    return found;
  };
  asset.scene.updateMatrixWorld(true);
  const shoulderOffsetsM = {};
  for (const side of ['Left', 'Right']) {
    const child = node(`${side}UpperArm`);
    if (child.parent !== node(`${side}Shoulder`)) throw new Error('Expected upper arm to be a direct clavicle child');
    shoulderOffsetsM[side] = child.position.clone().multiplyScalar(sourceUnitM).toArray();
  }
  const torsoBox = new Box3().setFromObject(node('shirt-body'));
  const torsoSize = torsoBox.getSize(new Vector3());
  const torsoOffset = torsoBox.getCenter(new Vector3()).sub(node('Spine1').getWorldPosition(new Vector3()))
    .applyQuaternion(node('Spine1').getWorldQuaternion(new Quaternion()).invert());
  const torsoRadius = Math.max(torsoSize.x, torsoSize.z) * 0.5 + 0.008;
  const armRadius = {};
  const proxyBindings = [];
  for (const side of ['Left', 'Right']) {
    const mesh = node(`${side}-arm-upper`);
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox.getSize(new Vector3()).multiply(mesh.getWorldScale(new Vector3()));
    const dimensions = size.toArray().map(Math.abs).sort((a,b) => a-b);
    armRadius[side] = Math.max(0.02, dimensions[1] * 0.5) + 0.005;
    const armLength = node(`${side}LowerArm`).position.length() * sourceUnitM;
    proxyBindings.push({id:side.toLowerCase()+'-upper-arm',shape:'capsule',radius:round(armRadius[side]),
      halfHeight:round(Math.max(.01,armLength*.5-armRadius[side]*.65)),
      attachment:{node:`${side}UpperArm`,offsetM:[0,round(armLength*.5),0]}});
  }
  proxyBindings.unshift({id:'torso',shape:'capsule',radius:round(torsoRadius),
    halfHeight:round(Math.max(.01,torsoSize.y*.5-torsoRadius*.5)),
    attachment:{node:'Spine1',offsetM:vector(torsoOffset)}});
  let maximumOffsetConversionErrorM = 0;
  const cases = [];
  for (const clipName of ['idle', 'walk', 'wave']) {
    const clip = asset.animations.find(clip => clip.name === clipName);
    if (!clip) throw new Error(`Missing ${clipName}`);
    const action = mixer.clipAction(clip);
    mixer.stopAllAction(); action.reset().play();
    const frames = [];
    for (let frame = 0; frame <= Math.ceil(clip.duration * 60); frame++) {
      const seconds = Math.min(frame / 60, clip.duration - 0.000001);
      mixer.setTime(seconds); asset.scene.updateMatrixWorld(true);
      const anchors = {}, clavicles = {};
      const capsules = [];
      for (const side of ['Left', 'Right']) {
        const shoulder = node(`${side}Shoulder`);
        const orientation = shoulder.getWorldQuaternion(new Quaternion());
        const origin = shoulder.getWorldPosition(new Vector3());
        const converted = new Vector3().fromArray(shoulderOffsetsM[side]).applyQuaternion(orientation).add(origin);
        const actual = node(`${side}UpperArm`).getWorldPosition(new Vector3());
        maximumOffsetConversionErrorM = Math.max(maximumOffsetConversionErrorM, converted.distanceTo(actual));
        const binding = canonical.attachment[side.toLowerCase()];
        const jointRotation = node(binding.node).getWorldQuaternion(new Quaternion());
        const fitted = new Vector3().fromArray(binding.offsetM).applyQuaternion(jointRotation).add(actual);
        anchors[side.toLowerCase()] = vector(fitted);
        clavicles[side.toLowerCase()] = { origin: vector(origin), rotation: orientation.toArray().map(round) };
        const elbow = node(`${side}LowerArm`).getWorldPosition(new Vector3());
        capsules.push({id:side.toLowerCase()+'-upper-arm', a:vector(actual), b:vector(elbow), radius:round(armRadius[side])});
      }
      const hip = node('Hips').getWorldPosition(new Vector3());
      const chest = node('Spine1').getWorldPosition(new Vector3());
      capsules.unshift({id:'torso', a:vector(hip), b:vector(chest), radius:round(torsoRadius)});
      frames.push({ seconds:round(seconds), anchorsRootM:anchors, claviclesRootM:clavicles, capsulesRootM:capsules });
    }
    cases.push({ clip:clipName, durationSeconds:clip.duration, frames });
  }
  if (maximumOffsetConversionErrorM > 0.00001) throw new Error(`Meter offset conversion error ${maximumOffsetConversionErrorM}`);
  const profile = { bodyId, source:{path:src,modelSha256:sha(bytes),binPath:json.buffers[0].uri,binSha256:sha(binary)},
    sourceUnitM, shoulderOffsetsM, maximumOffsetConversionErrorM,
    cape:{heightM:0.75,normal:{quality:'medium',iterations:4},low:{quality:'low',iterations:2}},
    proxyBindings,capsulesAreSimplifiedCandidates:true, capsulesFitAcceptance:'pending-contact-evaluation',cases };
  await fs.writeFile(path.join(root,`fixtures/${bodyId}.json`),JSON.stringify(profile));
  summary.bodies.push({bodyId,source:profile.source,shoulderOffsetsM,maximumOffsetConversionErrorM,
    frames:cases.map(c=>({clip:c.clip,count:c.frames.length,duration:c.durationSeconds})),torsoRadius:round(torsoRadius),armRadius});
}
const profiles = {canonicalContract:summary.canonicalContract,status:'fitting-candidates-pending-dynamic-contact-test',
  material:{fabric:'velvet',color:0x5e2439},body:{}};
for (const body of summary.bodies) {
  const input = JSON.parse(await fs.readFile(path.join(root,`fixtures/${body.bodyId}.json`)));
  const anchors = input.cases[0].frames[0].anchorsRootM;
  const shoulderGapM = new Vector3().fromArray(anchors.left).distanceTo(new Vector3().fromArray(anchors.right));
  profiles.body[body.bodyId] = {shoulderGapM,widthM:Math.max(shoulderGapM*1.7,body.torsoRadius*2.1),heightM:.75,
    pins:['left','right'],qualityByTier:{normal:{quality:'medium',iterations:4},low:{quality:'low',iterations:2},off:null},
    proxyBindings:input.proxyBindings,sourceInput:`fixtures/${body.bodyId}.json`,fitStatus:'unverified-native-dynamic-runtime'};
}
await fs.writeFile(path.join(root,'profiles.json'),JSON.stringify(profiles,null,2));
await fs.writeFile(path.join(root,'fixtures/summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
