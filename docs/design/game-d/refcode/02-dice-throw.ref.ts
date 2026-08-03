/* ============================================================================
 * 骰途 · 掷骰（出战骰组落场） 1:1 参考实现（Three.js r128）
 * ----------------------------------------------------------------------------
 * 依赖同目录 makeDie / makeDieFaceTexture / ELEMENTS（见「骰子与旋转」参考）。
 *
 * 关键点（别脑补）：
 *  ① 落地缓动是 cubic-out：e = 1 - (1-t)^3。抛物线高度用 sin(t·π)。
 *  ② 每颗骰子随机绕【单一随机轴】翻滚（不是分别随机 xyz 欧拉角）：
 *     用 rotateOnAxis(randomUnitAxis, spin·dt·(1 - t·0.7))，越落地转越慢。
 *  ③ 翻滚是“视觉表演”，不代表最终点数——落定后若要显示确定结果，
 *     另行 setRotation 到目标面（原型未做，按你规则补）。
 *  ④ 元素骰的 emissiveIntensity 掷场版是 0.20（比 Title 的 0.16 略强）。
 *  ⑤ dt 每帧上限 0.05s（Math.min），防止切后台回来跳帧炸动画。
 * ==========================================================================*/

import * as THREE from 'three'; // r128
import { ELEMENTS, makeDie, makeDieFaceTexture } from './骰子与旋转';

// 掷场用骰子：与 makeDie 同参，唯 emissiveIntensity=0.2；el 为元素序号，null=万能
export function makeDieByElement(size: number, el: number | null): THREE.Mesh {
  if (el == null) return makeDie(size); // 万能骰用彩虹面
  const col = ELEMENTS[el].color;
  const mats = [1, 6, 2, 5, 3, 4].map(n =>
    new THREE.MeshStandardMaterial({
      map: makeDieFaceTexture(col, n),
      roughness: 0.42, metalness: 0.18,
      emissive: new THREE.Color(col), emissiveIntensity: 0.2,
    })
  );
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mats);
  m.castShadow = true;
  return m;
}

interface RollingDie {
  mesh: THREE.Mesh;
  t: number; dur: number;
  from: THREE.Vector3; to: THREE.Vector3;
  ax: THREE.Vector3; spin: number; delay: number;
}

/**
 * 掷骰。els = 出战骰组的元素数组，如 [2,0,3]（木火雷）；null 表示万能。
 * TILE_TOP = 地格高度（原型 0.45）；落点 y = TILE_TOP/2 + 0.3。
 */
export function rollDice(scene: THREE.Scene, dice: RollingDie[], els: (number | null)[], TILE_TOP = 0.45) {
  // 清掉上一批
  for (const d of dice) scene.remove(d.mesh);
  dice.length = 0;

  if (!els || !els.length) els = [2, 0];
  const n = els.length;
  const spread = Math.min(4.4, Math.max(1.2, n * 0.9)); // 扇形铺开宽度

  els.forEach((el, i) => {
    const fx = n === 1 ? 0 : (-spread / 2 + spread * i / (n - 1)); // 第 i 颗横向落点
    const tz = 1.0 + Math.sin(i * 1.9) * 0.55;                     // z 交错，避免排成一条线
    const m = makeDieByElement(0.58, el);
    m.position.set(fx * 1.25, 5.6, 4);                             // 起点：高空偏后
    scene.add(m);
    dice.push({
      mesh: m,
      t: 0,
      dur: 1.0 + Math.random() * 0.28,                             // 每颗时长略不同
      from: new THREE.Vector3(fx * 1.25, 5.6, 4),
      to: new THREE.Vector3(fx, TILE_TOP / 2 + 0.3, tz),
      ax: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), // 单一随机轴
      spin: 13 + Math.random() * 7,                                // 翻滚基础角速度
      delay: i * 0.1,                                              // 依次出手
    });
  });
}

/** 每帧推进。dt 建议先 Math.min(0.05, realDt)。 */
export function updateDice(dice: RollingDie[], dt: number) {
  for (const d of dice) {
    if (d.delay > 0) { d.delay -= dt; continue; }
    if (d.t >= 1) continue;
    d.t = Math.min(1, d.t + dt / d.dur);
    const e = 1 - Math.pow(1 - d.t, 3);                 // cubic-out 落地
    const m = d.mesh;
    m.position.lerpVectors(d.from, d.to, e);
    m.position.y += Math.sin(Math.min(1, d.t) * Math.PI) * 2.2 * (1 - d.t * 0.3); // 抛物线弧
    m.rotateOnAxis(d.ax, d.spin * dt * (1 - d.t * 0.7)); // 越落地转越慢
  }
}
