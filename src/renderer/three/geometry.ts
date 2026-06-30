import * as THREE from 'three';
import type { Mesh3D, Sky3D, Camera3D } from '@engine/protocol/components.js';
import type { Renderable } from '../renderable.js';
import {
  renderablePose, flipEuler, mesh3dDepth, transform3dPose, groundPose, type Pose3D,
} from '../three-projection.js';

// ═══════════════════════════════════════════════════════════════
//  three/geometry —— ThreeRenderer 的几何/材质/位姿**无状态工厂**（不持渲染器实例态）。
//  几何与「易错处理」抽这：盒/薄片几何、逐面色烤 vertexColors、天空盒纹理、位姿合成、资源释放。
// ═══════════════════════════════════════════════════════════════

// Mesh3D 实体位姿（纯计算）：① Transform3D 真三维 / 盒庭模式 2D 实体落地面；② 否则 2D 投影 + flip 翻面角。
// 翻面把欧拉折进 rx/ry/rotZ，便于 applyPose 统一施加（实例化与 fallback 同一份位姿）。
export function mesh3dPose(r: Renderable, m: Mesh3D, cam3d: Camera3D | null, zStep: number): Pose3D {
  if (r.transform3d || cam3d) return r.transform3d ? transform3dPose(r.transform3d) : groundPose(r, m.height);
  const p = renderablePose(r, zStep);
  const fe = flipEuler(r.rotation, m.flipAxis);
  return { x: p.x, y: p.y, z: p.z, rx: fe.x, ry: fe.y, rotZ: 0, sx: p.sx, sy: p.sy, sz: 1 };
}

// 把 Pose3D 施加到一个 Object3D（fallback mesh 或实例化 dummy）。quat 在场（物理翻滚）→ 用四元数（无万向锁）。
export function applyPose(o: THREE.Object3D, p: Pose3D): void {
  o.position.set(p.x, p.y, p.z);
  if (p.quat) o.quaternion.set(p.quat[0], p.quat[1], p.quat[2], p.quat[3]);
  else o.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rotZ);
  o.scale.set(p.sx, p.sy, p.sz ?? 1);
}

// 球几何（material 球/星体）：width=直径 → 半径 width/2。32×16 段·圆润够用、PBR 反射/高光读得清。
function sphereGeo(width: number): THREE.SphereGeometry {
  return new THREE.SphereGeometry(Math.max(0.0001, width / 2), 32, 16);
}

// 单 mesh 版 Mesh3D（透明 fallback 用）：box=有厚度盒（面序 px,nx,py,ny,pz=正,nz=反，四边共用一材质）；plane=双面薄片。
// 哑光质感（roughness 高·metalness 0）= 盒庭圆润不反光的可爱面（Captain Toad 风）。颜色每帧由 paintMesh3D 设。
export function buildMesh3D(m: Mesh3D): THREE.Mesh {
  const matte = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.92, metalness: 0 });
  if (m.shape === 'plane') {
    const mat = matte();
    mat.side = THREE.DoubleSide;
    return new THREE.Mesh(new THREE.PlaneGeometry(m.width, m.height), mat);
  }
  if (m.shape === 'sphere') return new THREE.Mesh(sphereGeo(m.width), matte()); // 球：单材质（无面分色）
  const depth = mesh3dDepth(m.shape, m.width, m.height, m.depth);
  const edge = matte();
  const front = matte();
  const back = matte();
  return new THREE.Mesh(new THREE.BoxGeometry(m.width, m.height, depth), [edge, edge, edge, edge, front, back]);
}

// W1-A 实例化批几何：逐面色烤进 `vertexColors`（实例共享一个材质，色靠几何携带）。
// box 面序 px,nx,py,ny,pz(正),nz(反)：四边=edgeTint、正面=frontTint、反面=backTint；plane 单面=frontTint。
export function buildInstancedMesh3DGeometry(m: Mesh3D): THREE.BufferGeometry {
  if (m.shape === 'plane') {
    const geo = new THREE.PlaneGeometry(m.width, m.height);
    bakeFaceColors(geo, [m.frontTint]);
    return geo;
  }
  if (m.shape === 'sphere') {
    const geo = sphereGeo(m.width);
    bakeFaceColors(geo, [m.frontTint]); // 球：整体单色（frontTint）
    return geo;
  }
  const depth = mesh3dDepth('box', m.width, m.height, m.depth);
  const edge = m.edgeTint ?? 0x1f2937;
  const geo = new THREE.BoxGeometry(m.width, m.height, depth);
  bakeFaceColors(geo, [edge, edge, edge, edge, m.frontTint, m.backTint ?? m.frontTint]);
  return geo;
}

// 把每面一个色写进几何 color 属性（每面 4 顶点）。Color.setHex 线性·与 material.color.setHex 同空间→看相一致。
function bakeFaceColors(geo: THREE.BufferGeometry, faceTints: readonly number[]): void {
  const count = geo.attributes['position']!.count;
  const vertsPerFace = count / faceTints.length;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < faceTints.length; f++) {
    c.setHex(faceTints[f]! & 0xffffff);
    for (let v = 0; v < vertsPerFace; v++) {
      const i = (f * vertsPerFace + v) * 3;
      colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// 2D 渲染模式几何：shape→对应平面几何；sprite/text/placeholder→单位面（贴图/占位）。
export function buildGeometry(r: Renderable, mode: string): THREE.BufferGeometry {
  if (mode === 'shape' && r.shape) {
    const s = r.shape;
    if (s.kind === 'circle') return new THREE.CircleGeometry(s.radius ?? 4, 24);
    if (s.kind === 'polygon' && s.vertices && s.vertices.length >= 6) {
      const shape = new THREE.Shape();
      shape.moveTo(s.vertices[0]!, -s.vertices[1]!); // 同 pose 的 y 翻转
      for (let i = 2; i + 1 < s.vertices.length; i += 2) shape.lineTo(s.vertices[i]!, -s.vertices[i + 1]!);
      return new THREE.ShapeGeometry(shape);
    }
    return new THREE.PlaneGeometry(s.width ?? 8, s.height ?? 8); // box
  }
  if (mode === 'text') return new THREE.PlaneGeometry(64, 32);
  return new THREE.PlaneGeometry(16, 16); // sprite / placeholder
}

// Sky3D → 画布纹理：天顶→地平线竖直渐变 + 可选程序化云团（固定位置·可复现·无图片资产）。
export function buildSkyTexture(sky: Sky3D): THREE.CanvasTexture {
  const W = 512, H = 256;
  const hexstr = (n: number): string => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
  const rgba = (n: number, a: number): string => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, hexstr(sky.top));
  grad.addColorStop(1, hexstr(sky.bottom));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  if (sky.clouds) {
    const c = sky.cloudTint ?? 0xffffff;
    // 固定云团（x,y,半径）：横跨天顶→近地平线一带，大团叠小团堆出蓬松感。
    const puffs: Array<[number, number, number]> = [
      [70, 96, 52], [120, 78, 40], [165, 110, 46], [40, 124, 38],
      [250, 88, 56], [305, 72, 40], [350, 112, 48], [215, 130, 40],
      [430, 92, 54], [486, 76, 40], [398, 120, 46], [470, 134, 36],
      [150, 150, 34], [330, 152, 36], [60, 60, 30], [420, 56, 28],
    ];
    for (const [x, y, r] of puffs) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba(c, 0.95));
      rg.addColorStop(0.55, rgba(c, 0.6));
      rg.addColorStop(1, rgba(c, 0));
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// 释放单 mesh 的几何 + 材质（含程序化 normal/roughness 贴图·这些是逐 mesh 生成·非共享缓存）。
export function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const m = mesh.material;
  (Array.isArray(m) ? m : [m]).forEach((x) => {
    const sm = x as THREE.MeshStandardMaterial;
    sm.normalMap?.dispose(); sm.roughnessMap?.dispose(); // 程序化表面贴图（surface-tex 生成·随 mesh 释放）
    x.dispose();
  });
}

// 释放整棵模型树（模板用）：遍历所有 Mesh 释放几何 + 材质。clone 实例不走此函数（几何共享·只释放实例材质）。
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const m = mesh.material;
    (Array.isArray(m) ? m : [m]).forEach((x) => x?.dispose());
  });
}
