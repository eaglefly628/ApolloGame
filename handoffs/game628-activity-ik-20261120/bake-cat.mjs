import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BoxGeometry, Quaternion, Vector3 } from 'three';
import { solveTwoBone } from './apollo-two-bone.mjs';

const here = new URL('./', import.meta.url);
const base = new URL('site/art/reference-rebuild-20261120/scene/', here);
const input = await readFile(new URL('cat-floor-idle.glb', base));
const jsonLength = input.readUInt32LE(12);
const gltf = JSON.parse(input.subarray(20, 20 + jsonLength).toString());
let bytes = input.subarray(28 + jsonLength);
const up = new Vector3(0, 1, 0);
const down = new Vector3(0, -1, 0);
const v = (x, y, z) => new Vector3(x, y, z);
const sha = data => createHash('sha256').update(data).digest('hex');
const smooth = t => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
const duration = 7.2;
const rate = 60;
const times = Array.from({length: Math.round(duration * rate) + 1}, (_, i) => i / rate);
const STEP = .065;

function append(values, type, stride, target) {
  const data = new Float32Array(values.flat());
  const offset = bytes.length;
  bytes = Buffer.concat([bytes, Buffer.from(data.buffer)]);
  const view = gltf.bufferViews.push({buffer: 0, byteOffset: offset, byteLength: data.byteLength, ...(target ? {target} : {})}) - 1;
  const axis = Array.from({length: stride}, (_, k) => data.filter((_, i) => i % stride === k));
  return gltf.accessors.push({bufferView: view, componentType: 5126, count: data.length / stride, type,
    min: axis.map(a => Math.min(...a)), max: axis.map(a => Math.max(...a))}) - 1;
}

function node(name, parent, props = {}) {
  const index = gltf.nodes.push({name, ...props}) - 1;
  (gltf.nodes[parent].children ??= []).push(index);
  return index;
}

const raw = new BoxGeometry(1, 1, 1).toNonIndexed();
const attrs = {POSITION: append(Array.from(raw.attributes.position.array), 'VEC3', 3, 34962),
  NORMAL: append(Array.from(raw.attributes.normal.array), 'VEC3', 3, 34962)};
const pawIds = gltf.nodes[0].children.filter(i => gltf.nodes[i].name.includes('_mesh_paw'));
if (pawIds.length !== 2 || gltf.skins?.length) throw new Error('Expected original rigid two-paw asset');
const palettes = pawIds.map(i => gltf.meshes[gltf.nodes[i].mesh].primitives[0].material);
const segments = palettes.map(material => gltf.meshes.push({primitives:[{attributes:attrs, material}]}) - 1);
gltf.nodes[0].children = gltf.nodes[0].children.filter(i => !pawIds.includes(i));
const legs = [-1,1].flatMap((side, s) => [-1,1].map((end, e) => {
  const id = ['far','near'][s] + '-' + ['hind','front'][e];
  const x = end * .163;
  const z = side * .128;
  const root = node(id + '-hip', 0, {translation:[x, .094, z]});
  const L1 = .152, L2 = .135;
  const knee = node(id + '-knee', root, {translation:[0,-L1,0]});
  node(id + '-upper', root, {mesh:segments[e], scale:[.070,L1+.028,.070], translation:[0,-L1/2,0]});
  node(id + '-lower', knee, {mesh:segments[e], scale:[.052,L2+.026,.051], translation:[0,-L2/2,0]});
  const pad = node(id + '-pad', knee, {translation:[0,-L2,0]});
  const original = gltf.nodes[pawIds[e]];
  const bounds = gltf.accessors[gltf.meshes[original.mesh].primitives[0].attributes.POSITION];
  const center = bounds.min.map((x,i)=>(x+bounds.max[i])/2);
  node(id + '-pad-mesh', pad, {mesh:original.mesh, translation:center.map(x=>-x)});
  return {x,z,root,knee,pad,L1,L2, pole:end < 0 ? 1 : -1, phase: [0,.30,.46,.15][s*2+e]};
}));

function path(time) {
  const t = Math.max(0, Math.min(duration, time));
  const x = -.50 + .935 * (smooth((t-1.10)/2.25) - smooth((t-4.26)/2.20));
  const yaw = .33 * Math.sin(Math.PI * smooth((t-.30)/1.10));
  const y = .126 + STEP * smooth((x+.23)/.46) + .006*Math.sin(t*2*Math.PI/.60)*Math.sin(Math.PI*t/duration)**2;
  return {p:v(x,y,0), yaw};
}

const period = .60;
const swing = .25;
const heightAt = x => x >= 0 ? STEP : 0;
function anchor(leg, time) {
  const {p,yaw} = path(time);
  const foot = v(leg.x,0,leg.z).applyAxisAngle(up,yaw).add(p);
  if (Math.abs(foot.x) < .064) foot.x = foot.x < 0 ? -.064 : .064;
  foot.y = heightAt(foot.x) + .039;
  return {foot,yaw};
}

function stepAt(leg, time) {
  if (time <= .20 || time >= 7.0) return {...anchor(leg,0),planted:true};
  const swingStart = .06 + leg.phase + Math.floor((time-.06-leg.phase)/period)*period;
  const t = (time-swingStart)/swing;
  const start = anchor(leg, swingStart - .24);
  const next = anchor(leg, swingStart + .36);
  if (t >= 1) return {...next, planted:true};
  const blend = smooth((t-.22)/.56);
  const foot = start.foot.clone().lerp(next.foot, blend);
  const moving = start.foot.distanceTo(next.foot) > .001;
  const lift = smooth(t/.22) * smooth((1-t)/.22);
  foot.y += moving ? (Math.max(start.foot.y,next.foot.y) - foot.y + .035) * lift : 0;
  return {foot,yaw:start.yaw+(next.yaw-start.yaw)*blend,planted:false};
}

const timeIndex = append(times, 'SCALAR', 1);
const evidence = {};
const movement = {};
for (const enabled of [false,true]) {
  const clip = {name: enabled ? 'cat_paws_ik' : 'cat_paws_fk', channels:[], samplers:[]};
  const tracks = new Map();
  const result = {supportSamples:0, unreachable:0, maxSupportErrorM:0, maxSupportSlipPerFrameM:0, maxRiserPenetrationM:0, upperFootContacts:0, lowerFootContacts:0};
  const add = (id, path, value) => {
    const key = id + '/' + path;
    if (!tracks.has(key)) tracks.set(key, {id,path,values:[]});
    tracks.get(key).values.push(value.toArray());
  };
  const previous = [];
  for (const time of times) {
    const {p,yaw} = path(time);
    add(0,'translation',p);
    add(0,'rotation',new Quaternion().setFromAxisAngle(up,yaw));
    for (const [i,leg] of legs.entries()) {
      const contact = stepAt(leg,time);
      const root = v(leg.x,.094,leg.z), knee = root.clone().add(v(-.105*leg.pole,-.110,0));
      const end = knee.clone().add(v(.115*leg.pole,-.071,0));
      // Fix exact segment lengths before feeding Apollo's unchanged analytic solver.
      knee.sub(root).setLength(leg.L1).add(root);
      end.sub(knee).setLength(leg.L2).add(knee);
      const desired = contact.foot.clone().sub(p).applyAxisAngle(up,-yaw);
      // OFF runs the same root and cadence with local FK bend only.
      const swingAngle = contact.planted ? 0 : .30;
      const jointAxis = v(0,0,1);
      const fkMid = knee.clone().sub(root).applyAxisAngle(jointAxis, leg.pole*swingAngle).add(root);
      const fkEnd = end.clone().sub(knee).applyAxisAngle(jointAxis, -leg.pole*swingAngle*1.7).add(fkMid);
      const sol = enabled
        ? solveTwoBone(root,knee,end,desired,root.clone().add(v(-leg.pole,0,0)))
        : {mid:fkMid,end:fkEnd,reachable:true};
      if (!sol) throw new Error('Degenerate leg chain');
      if (!sol.reachable && enabled) result.unreachable++;
      const q1 = new Quaternion().setFromUnitVectors(down,sol.mid.clone().sub(root).normalize());
      const q2 = new Quaternion().setFromUnitVectors(down,sol.end.clone().sub(sol.mid).normalize());
      const localKnee = q1.clone().invert().multiply(q2);
      const pad = q2.clone().invert().multiply(new Quaternion().setFromAxisAngle(up,enabled ? contact.yaw-yaw : 0));
      add(leg.root,'rotation',q1);
      add(leg.knee,'rotation',localKnee);
      add(leg.pad,'rotation',pad);
      const replay = v(0,-leg.L2,0).applyQuaternion(q2).add(v(0,-leg.L1,0).applyQuaternion(q1)).add(root).applyAxisAngle(up,yaw).add(p);
      if (contact.planted) {
        result.supportSamples++;
        result.maxSupportErrorM = Math.max(result.maxSupportErrorM,replay.distanceTo(contact.foot));
        if (previous[i]?.planted) result.maxSupportSlipPerFrameM = Math.max(result.maxSupportSlipPerFrameM,replay.distanceTo(previous[i].replay));
        if (contact.foot.x > 0) result.upperFootContacts++; else result.lowerFootContacts++;
      }
      if (replay.x > -.060) result.maxRiserPenetrationM = Math.max(result.maxRiserPenetrationM,STEP-(replay.y-.039));
      previous[i] = {...contact,replay};
    }
  }
  for (const {id,path,values} of tracks.values()) {
    const sampler = clip.samplers.push({input:timeIndex, output:append(values,path==='rotation'?'VEC4':'VEC3',values[0].length), interpolation:'LINEAR'})-1;
    clip.channels.push({sampler,target:{node:id,path}});
  }
  gltf.animations.push(clip);
  evidence[clip.name] = result;
  movement[clip.name] = [...tracks.keys()];
}

gltf.asset.generator = 'Game 628 local offline Apollo two-bone IK comparison';
gltf.buffers[0].byteLength = bytes.length;
let json = JSON.stringify(gltf);
while (Buffer.byteLength(json) % 4) json += ' ';
const jsonBytes = Buffer.from(json);
const header = Buffer.alloc(20);
[0x46546c67,2,28+jsonBytes.length+bytes.length,jsonBytes.length,0x4e4f534a].forEach((n,i)=>header.writeUInt32LE(n,i*4));
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(bytes.length);
binHeader.writeUInt32LE(0x004e4942,4);
const output = Buffer.concat([header,jsonBytes,binHeader,bytes]);
await writeFile(new URL('cat-floor-ik-study.glb',base),output);
await writeFile(new URL('evidence/cat-solver.json',here),JSON.stringify({source:sha(input),output:sha(output),duration,rate,stepM:STEP,movement,evidence},null,2)+'\n');
console.log(evidence);
