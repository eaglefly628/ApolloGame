/* ============================================================================
 * 骰途 · 通关骰壳转场 1:1 参考实现（Three.js r128）
 * ----------------------------------------------------------------------------
 * 效果：整场战斗被一颗巨型命运骰外壳包住 → 旧场缩进骰内 → 骰子螺旋升走缩小
 *       → 中途换层 → 新场随骰壳展开旋入落定。总时长 2.5s，进度 p = t/2.5。
 *
 * 关键点（最容易还原错）：
 *  ① 全程用一个 pivot(Group) 承载：旧战场、骰壳、包裹柔光都 add 进 pivot，
 *     对 pivot 做旋转/缩放/位移，而不是各自单独动。
 *  ② 缓动只有一个：eOutBack（回弹）。骰壳张开/收起、新场展开都用它。
 *  ③ 旋转是【累加式螺旋】：spin.x/spin.y 每帧 += dt·常量，再赋给 pivot.rotation，
 *     后段乘 (1-k) 衰减到 0 归正 —— 不是设定目标角度插值。
 *  ④ 换层时机在 p≈0.46（swapped 一次性触发）：销毁旧场、build 新场并塞进 pivot、
 *     新场 scale 先设 ~0 待命。别在别处重复 build（会双重换皮）。
 *  ⑤ scale 用 setScalar，且下限用 Math.max(0.0001/0.001, ...)，
 *     防止 scale=0 时矩阵退化 / 光照 NaN。
 *  ⑥ 骰壳 = 复用 makeDie(8.6)（就是放大的命运骰），所以外壳也是六元素面。
 *
 * 依赖：makeDie（骰子与旋转参考）、glowSprite（下附）、你的 buildArena/applyTheme。
 * ==========================================================================*/

import * as THREE from 'three'; // r128
import { makeDie } from './骰子与旋转';

// 柔光精灵（加色混合，白色可染）——转场包裹光用
export function glowSprite(color: string, scale: number): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), color: new THREE.Color(color),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.set(scale, scale, 1);
  return s;
}

// 回弹缓动（overshoot）
export function eOutBack(p: number): number {
  const c = 1.70158, c3 = c + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
}

export interface Transition {
  t: number; dur: number;
  piv: THREE.Group; shell: THREE.Mesh; sg: THREE.Sprite;
  oldArena: THREE.Object3D | null;
  newArena?: THREE.Object3D;
  swapped: boolean;
  spin: THREE.Vector3;
}

/** 宿主需实现的回调：换层 + 造新场（返回新 arena 的 root Object3D，已 applyTheme） */
export interface TransitionHost {
  scene: THREE.Scene;
  getArena(): THREE.Object3D | null;
  setArena(a: THREE.Object3D): void;
  advanceLayerAndBuild(): THREE.Object3D; // layer=(layer+1)%N; buildArena(); applyTheme(); return newArena
  onDone(): void;                         // 通关演出结束（原型里在此触发 showLoot）
}

/** 开始转场。返回 Transition，交给 updateTransition 每帧推进。 */
export function startTransition(host: TransitionHost): Transition {
  const piv = new THREE.Group();
  host.scene.add(piv);

  let oldArena: THREE.Object3D | null = null;
  const cur = host.getArena();
  if (cur) { host.scene.remove(cur); piv.add(cur); oldArena = cur; }

  const shell = makeDie(8.6);                 // 巨型命运骰外壳
  shell.position.set(0, 0.9, 0);
  shell.scale.setScalar(0.001);
  piv.add(shell);

  const sg = glowSprite('#fff0cf', 11);       // 包裹柔光
  sg.position.set(0, 0.9, 0);
  (sg.material as THREE.SpriteMaterial).opacity = 0;
  piv.add(sg);

  return { t: 0, dur: 2.5, piv, shell, sg, oldArena, swapped: false, spin: new THREE.Vector3(0, 0, 0) };
}

/** 每帧推进；结束时 return true。dt 建议先 Math.min(0.05, realDt)。 */
export function updateTransition(tr: Transition, host: TransitionHost, dt: number): boolean {
  tr.t += dt;
  const p = Math.min(1, tr.t / tr.dur);
  const piv = tr.piv, sh = tr.shell, sg = tr.sg.material as THREE.SpriteMaterial;

  if (p < 0.2) {
    // 骰壳张开包住；旧场缩进骰内
    const k = eOutBack(p / 0.2);
    sh.scale.setScalar(Math.max(0.001, k));
    sg.opacity = k * 0.5;
    sh.rotation.y += dt * 1.2;
    if (tr.oldArena) tr.oldArena.scale.setScalar(Math.max(0.0001, 1 - p / 0.2));

  } else if (p < 0.46) {
    // 螺旋升走 + 缩小
    if (tr.oldArena) tr.oldArena.scale.setScalar(0.0001);
    const k = (p - 0.2) / 0.26;
    tr.spin.x += dt * 7; tr.spin.y += dt * 9;
    piv.rotation.set(tr.spin.x, tr.spin.y, tr.spin.x * 0.4);
    piv.scale.setScalar(1 - 0.62 * k);
    piv.position.y = 2.9 * k;
    sg.opacity = 0.5;

  } else if (!tr.swapped) {
    // 换层（一次性）：销毁旧场，build 新场塞进 pivot，scale≈0 待命
    tr.swapped = true;
    if (tr.oldArena) { piv.remove(tr.oldArena); host.scene.remove(tr.oldArena); }
    const na = host.advanceLayerAndBuild();
    host.scene.remove(na);
    na.scale.setScalar(0.0001);
    piv.add(na);
    tr.newArena = na;

  } else if (p < 0.74) {
    // 旋入落定（旋量衰减、放大回来、下落归位）
    const k = (p - 0.46) / 0.28;
    tr.spin.x += dt * 6; tr.spin.y += dt * 7;
    piv.rotation.set(tr.spin.x * (1 - k), tr.spin.y * (1 - k), 0);
    piv.scale.setScalar(0.38 + 0.62 * k);
    piv.position.y = 2.9 * (1 - k);
    if (tr.newArena) tr.newArena.scale.setScalar(0.0001);

  } else if (p < 1) {
    // 归正；骰壳收起，新场随之展开
    piv.rotation.set(0, 0, 0);
    piv.scale.setScalar(1);
    piv.position.y = 0;
    const k = (p - 0.74) / 0.26;
    const o = eOutBack(Math.min(1, k * 1.25));
    sh.scale.setScalar(Math.max(0.001, 1 - o));
    sg.opacity = 0.5 * (1 - k);
    sh.rotation.y += dt * 1.5;
    if (tr.newArena) tr.newArena.scale.setScalar(Math.max(0.0001, eOutBack(Math.min(1, k * 1.15))));

  } else {
    // 收尾：新场脱离 pivot 归位为正式竞技场
    if (tr.newArena) {
      piv.remove(tr.newArena);
      host.scene.add(tr.newArena);
      tr.newArena.scale.setScalar(1);
      tr.newArena.rotation.set(0, 0, 0);
      tr.newArena.position.set(0, 0, 0);
      host.setArena(tr.newArena);
    }
    host.scene.remove(piv);
    host.onDone();
    return true;
  }
  return false;
}
