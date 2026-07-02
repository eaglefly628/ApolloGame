/* ============================================================================
 * 骰途 · 命运骰 — 骰子材质 + 旋转 参考实现（Three.js r128）
 * ----------------------------------------------------------------------------
 * 这是原型里 1:1 的实现，抽成纯 TS 供你的 3D 底座对接。
 * 两个最容易还原错的点，先看这里：
 *
 *  ① 旋转不是随机的。 是【固定轴向 + 固定速度】的慢速翻滚：
 *     每帧 rot.x += 0.004，rot.y += 0.006（弧度，按 60fps 标定）。
 *     X 比 Y 慢，两者同为正 → 骰子始终朝同一方向斜着匀速滚。
 *     原型里的 `vx += (BASE - vx)*0.03` 只是【阻尼回弹】：只有当你
 *     主动扰动过角速度（比如交互甩一下）时才有意义；初始 vx=BASE，
 *     不扰动就恒等于固定转速。别加 Math.random()。
 *
 *  ② 骰面材质的“质感”来自三样东西，缺一就不像：
 *     - emissive = 元素色，emissiveIntensity = 0.16（自发光微光，关键！）
 *     - roughness 0.42 / metalness 0.18（半哑光微金属）
 *     - CanvasTexture：圆角基底 + 内层对角渐变 + 白描边 + 点数径向高光
 *       且 texture.anisotropy = 4
 *
 *  ③ BoxGeometry 的材质数组顺序是 [+X,-X,+Y,-Y,+Z,-Z]，
 *     六面点数固定 [1,6,2,5,3,4]、六面颜色固定为六元素色。
 *     若你的引擎面序/UV 不同，先对齐这个顺序，否则点数落错面。
 * ==========================================================================*/

import * as THREE from 'three'; // r128

// ---- 六元素色（骰子六面依次用这组色）----
export const ELEMENTS = [
  { name: '火', color: '#ff5b4d' },
  { name: '水', color: '#3ba0ff' },
  { name: '木', color: '#46c66a' },
  { name: '雷', color: '#ffcf3f' },
  { name: '风', color: '#e8edf3' },
  { name: '暗', color: '#9b6cff' },
] as const;

// 六面点数（对应 BoxGeometry 材质顺序 [+X,-X,+Y,-Y,+Z,-Z]）
const PIPS = [1, 6, 2, 5, 3, 4];

/* ---------------------------------------------------------------------------
 * 颜色工具：_shade(hex, a)
 *   a >= 0 → 向白提亮 a；a < 0 → 向黑压暗 |a|
 * ------------------------------------------------------------------------- */
function hx(h: string) {
  h = h.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function hex(o: { r: number; g: number; b: number }) {
  const c = (v: number) => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
  return '#' + c(o.r) + c(o.g) + c(o.b);
}
export function shade(h: string, a: number) {
  const o = hx(h), t = a < 0 ? 0 : 255, k = Math.abs(a);
  return hex({ r: o.r + (t - o.r) * k, g: o.g + (t - o.g) * k, b: o.b + (t - o.b) * k });
}

// 圆角矩形路径
function rr(x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

/* ---------------------------------------------------------------------------
 * 骰面贴图（CanvasTexture）——一面一张，256×256
 *   color = 该面的元素色；n = 点数（1..6）
 * ------------------------------------------------------------------------- */
export function makeDieFaceTexture(color: string, n: number, size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const s = size;
  const r = (v: number) => v * s;

  // 基底圆角块（略暗）
  x.fillStyle = shade(color, -0.04);
  rr(x, r(0.04), r(0.04), s - r(0.08), s - r(0.08), r(0.18));
  x.fill();

  // 内层对角渐变（提亮 → 压暗）
  const g = x.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, shade(color, 0.22));
  g.addColorStop(1, shade(color, -0.1));
  x.fillStyle = g;
  rr(x, r(0.08), r(0.08), s - r(0.16), s - r(0.16), r(0.14));
  x.fill();

  // 白色内描边
  x.strokeStyle = 'rgba(255,255,255,.28)';
  x.lineWidth = r(0.03);
  rr(x, r(0.1), r(0.1), s - r(0.2), s - r(0.2), r(0.12));
  x.stroke();

  // 点数布局
  const lo = 0.28, mid = 0.5, hi = 0.72;
  const P: Record<number, number[][]> = {
    1: [[mid, mid]],
    2: [[lo, lo], [hi, hi]],
    3: [[lo, lo], [mid, mid], [hi, hi]],
    4: [[lo, lo], [hi, lo], [lo, hi], [hi, hi]],
    5: [[lo, lo], [hi, lo], [mid, mid], [lo, hi], [hi, hi]],
    6: [[lo, lo], [lo, mid], [lo, hi], [hi, lo], [hi, mid], [hi, hi]],
  };
  const pr = s * 0.075;
  for (const [px, py] of P[n]) {
    const cx = px * s, cy = py * s;
    const rg = x.createRadialGradient(cx - pr * 0.3, cy - pr * 0.3, pr * 0.1, cx, cy, pr);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(1, '#dde4ec');
    x.fillStyle = rg;
    x.shadowColor = 'rgba(0,0,0,.35)';
    x.shadowBlur = s * 0.04;
    x.shadowOffsetY = s * 0.012;
    x.beginPath();
    x.arc(cx, cy, pr, 0, Math.PI * 2);
    x.fill();
    x.shadowColor = 'transparent';
  }

  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;             // ← 别漏，斜视角清晰度
  // r128 sRGB：贴图当颜色用
  (t as any).encoding = THREE.sRGBEncoding;
  return t;
}

/* ---------------------------------------------------------------------------
 * 命运骰 Mesh —— 六面各自元素色 + 自发光微光
 * ------------------------------------------------------------------------- */
export function makeDie(size = 1.95): THREE.Mesh {
  const mats = ELEMENTS.map((e, i) =>
    new THREE.MeshStandardMaterial({
      map: makeDieFaceTexture(e.color, PIPS[i]),
      roughness: 0.42,
      metalness: 0.18,
      emissive: new THREE.Color(e.color),
      emissiveIntensity: 0.16,   // ← “活”的关键：元素色自发光
    })
  );
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mats);
  m.castShadow = true;
  return m;
}

/* ---------------------------------------------------------------------------
 * Title 场景旋转 —— 固定轴向匀速翻滚（非随机！）
 *
 * 用法：每帧调用 tumble(die, state)。
 *   - 不扰动时：等价于 rot.x += 0.004；rot.y += 0.006（@60fps）
 *   - 想帧率无关：见下方 tumbleDtStable（乘 dt*60）
 * ------------------------------------------------------------------------- */
export const BASE_VX = 0.004; // X 轴每帧弧度（@60fps）——慢
export const BASE_VY = 0.006; // Y 轴每帧弧度（@60fps）——快

export interface TumbleState { vx: number; vy: number; }
export function newTumbleState(): TumbleState { return { vx: BASE_VX, vy: BASE_VY }; }

/** 逐帧固定翻滚（@60fps）。s 由 newTumbleState() 创建。 */
export function tumble(die: THREE.Object3D, s: TumbleState) {
  die.rotation.x += s.vx;
  die.rotation.y += s.vy;
  // 阻尼回弹到基准：仅当外部把 vx/vy 扰动过（甩动/命中）才有可见效果
  s.vx += (BASE_VX - s.vx) * 0.03;
  s.vy += (BASE_VY - s.vy) * 0.03;
}

/** 帧率无关版本：dt 为上一帧秒数。逻辑等价，60fps 下与 tumble 一致。 */
export function tumbleDtStable(die: THREE.Object3D, s: TumbleState, dt: number) {
  const k = dt * 60;
  die.rotation.x += s.vx * k;
  die.rotation.y += s.vy * k;
  s.vx += (BASE_VX - s.vx) * (1 - Math.pow(1 - 0.03, k));
  s.vy += (BASE_VY - s.vy) * (1 - Math.pow(1 - 0.03, k));
}

/* ---------------------------------------------------------------------------
 * Title 场景完整装配（相机 / 光 / 骰子）—— 原型同参
 * ------------------------------------------------------------------------- */
export function buildTitleScene(canvas: HTMLCanvasElement) {
  const w = canvas.clientWidth || 640, h = canvas.clientHeight || 360;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(w, h, false);
  (renderer as any).outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
  cam.position.set(0, 0.2, 6.3);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.1); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.PointLight(0x9b6cff, 1.2, 30); rim.position.set(-4, 1, -3); scene.add(rim);
  const fill = new THREE.PointLight(0x3ba0ff, 0.7, 30); fill.position.set(4, -2, 2); scene.add(fill);

  const die = makeDie(1.95);
  die.position.y = -0.45;
  die.rotation.set(0.5, 0.7, 0); // 初始姿态
  scene.add(die);

  const state = newTumbleState();

  function frame() {
    requestAnimationFrame(frame);
    tumble(die, state);              // ← 固定匀速翻滚
    renderer.render(scene, cam);
  }
  frame();

  return { renderer, scene, cam, die, key, rim, state };
}

/* ---------------------------------------------------------------------------
 * 氛围随「暗神秘 ↔ 暖童话」滑块 t∈[0,1] 变化（可选）
 * ------------------------------------------------------------------------- */
export function applyTitleMood(
  die: THREE.Mesh, glowOpacityRef: { value: number }, rim: THREE.PointLight, t: number
) {
  const mats = die.material as THREE.MeshStandardMaterial[];
  const ei = 0.34 - 0.2 * t;       // 暗端更亮的自发光，暖端收敛
  for (const m of mats) m.emissiveIntensity = ei;
  glowOpacityRef.value = 0.85 - 0.42 * t;
  rim.intensity = 1.4 - 0.6 * t;
}
