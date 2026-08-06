// 渲染卫生批（REQ-3D-RENDERHYG）红→绿回归：贴图释放（共享保护）· 动画 live 计数 · renderSig 覆盖 AO/grade。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { disposeMeshMat } from './geometry.js';
import { countRunningAnims } from './models.js';
import { postSig, hashPoses } from './stats.js';
import type { Pose3D } from '../three-projection.js';
import type { Post3D } from '@engine/protocol/components.js';

// 贴图是否被 dispose：监听 'dispose' 事件（无需 GL）。
function tex(shared = false): { t: THREE.Texture; disposed: () => boolean } {
  const t = new THREE.Texture();
  let d = false;
  t.addEventListener('dispose', () => { d = true; });
  if (shared) t.userData['shared'] = true;
  return { t, disposed: () => d };
}

describe('fix① disposeMeshMat：释放 per-mesh 独占贴图·**跳过共享缓存贴图**', () => {
  it('共享贴图（userData.shared）不被误释放；独占贴图（map/emissiveMap）被释放（补漏）', () => {
    const shared = tex(true), owned = tex(false);
    const mat = new THREE.MeshStandardMaterial();
    mat.map = shared.t;         // 共享缓存图（pbrMapTexture 标记）
    mat.emissiveMap = owned.t;  // per-mesh 独占（原代码漏释放）
    disposeMeshMat(mat);
    expect(shared.disposed()).toBe(false); // ★ 正面用例：共享图未被误毁（否则其他活网格画面损坏）
    expect(owned.disposed()).toBe(true);   // 独占图释放（撤掉修复=emissiveMap 不释放→泄漏·此断言转红）
  });
  it('两网格共用同一共享贴图：销毁其一，另一个仍持有可渲的贴图', () => {
    const shared = tex(true);
    const a = new THREE.MeshStandardMaterial(); a.map = shared.t;
    const b = new THREE.MeshStandardMaterial(); b.map = shared.t;
    disposeMeshMat(a); // 销毁网格 a
    expect(shared.disposed()).toBe(false); // b 仍在用 → 共享图存活
    expect((b.map as THREE.Texture).image).toBeDefined; // b 贴图未损
  });
  it('ORM 打包图同挂 ao/rough/metal 三槽：去重·只 dispose 一次（独占时）', () => {
    const orm = tex(false);
    const mat = new THREE.MeshStandardMaterial();
    mat.aoMap = orm.t; mat.roughnessMap = orm.t; mat.metalnessMap = orm.t;
    let n = 0; orm.t.addEventListener('dispose', () => { n++; });
    disposeMeshMat(mat);
    expect(n).toBe(1); // 三槽同图 → 只释放一次（去重·避免重复 dispose 事件）
  });
});

describe('fix② countRunningAnims：只计真正在播的 action（静态/播完不占脏标）', () => {
  it('running=计入·finished/未播=不计（撤掉修复=返回 size 会把 finished 也算）', () => {
    const anims = [
      { action: { isRunning: () => true } },   // 循环/播放中 → 计
      { action: { isRunning: () => false } },  // 播完 clampWhenFinished → 不计
      { action: undefined },                    // 有 clip 未 applyAnim → 不计
    ];
    expect(countRunningAnims(anims)).toBe(1);
  });
  it('真 AnimationMixer 语义：LoopOnce 播完 isRunning→false（脏标可歇）·LoopRepeat 恒 true', () => {
    const obj = new THREE.Object3D();
    const track = new THREE.NumberKeyframeTrack('.scale[x]', [0, 1], [1, 2]); // 1s clip
    const clip = new THREE.AnimationClip('t', 1, [track]);
    const once = new THREE.AnimationMixer(obj).clipAction(clip);
    once.setLoop(THREE.LoopOnce, 1); once.clampWhenFinished = true; once.play();
    expect(once.isRunning()).toBe(true);
    once.getMixer().update(0.5); expect(once.isRunning()).toBe(true); // 播放中
    once.getMixer().update(1.0); expect(once.isRunning()).toBe(false); // 越过末尾 → 停（一次性播完）
    const loop = new THREE.AnimationMixer(new THREE.Object3D()).clipAction(clip);
    loop.setLoop(THREE.LoopRepeat, Infinity); loop.play();
    loop.getMixer().update(2.5); expect(loop.isRunning()).toBe(true); // 循环恒 running
  });
});

describe('尾① postSig 纳入 AO / grade（漏则改 AO/分级 静态场景不重渲）', () => {
  const base: Post3D = { type: 'Post3D' };
  it('改 AO 参数 → postSig 变', () => {
    expect(postSig({ ...base, ao: { intensity: 0.5 } })).not.toBe(postSig({ ...base, ao: { intensity: 0.9 } }));
  });
  it('改 grade 参数 → postSig 变', () => {
    expect(postSig({ ...base, grade: { exposure: 1 } })).not.toBe(postSig({ ...base, grade: { exposure: 1.2 } }));
    expect(postSig({ ...base, grade: { saturation: 1 } })).not.toBe(postSig({ ...base, grade: { saturation: 1.3 } }));
  });
});

describe('尾② hashPoses 纳入 quat（漏则纯四元数旋转在静态场景不重渲）', () => {
  const P = (quat?: [number, number, number, number]): Pose3D => ({ x: 0, y: 0, z: 0, rotZ: 0, rx: 0, ry: 0, sx: 1, sy: 1, sz: 1, quat });
  it('仅 quat 不同 → hashPoses 变（撤掉修复=两者同哈希→跳渲吞掉旋转）', () => {
    expect(hashPoses([P([0, 0, 0, 1])])).not.toBe(hashPoses([P([0, 0.7, 0, 0.7])]));
  });
  it('无 quat 时行为不变（向后兼容）', () => {
    expect(hashPoses([P()])).toBe(hashPoses([P()]));
  });
});
