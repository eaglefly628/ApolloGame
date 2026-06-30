import * as THREE from 'three';
import type { Mesh3D, Material3D, SurfaceDetail } from '@engine/protocol/components.js';
import { resolvePbr, type PbrMaterialDef } from '@assets/index.js';
import { buildSurfaceMaps } from './surface-tex.js';

// ═══════════════════════════════════════════════════════════════
//  three/material —— PBR 材质（TA Phase 5·render-only）。据 `Material3D` 预设 + 覆盖建物理材质。
//  金属/介电走 MeshStandardMaterial；玻璃(transmission>0)走 MeshPhysicalMaterial（透射/折射）。
//  数据全来自美术库 `assets/pbr-materials` 的闭集预设。
// ═══════════════════════════════════════════════════════════════

// 预设 → three 材质。surface 在场 → 程序化生成 normal/roughness 贴图挂上（render-only·零美术文件）。
export function buildPbrMaterial(def: PbrMaterialDef, surface?: SurfaceDetail): THREE.MeshStandardMaterial {
  let m: THREE.MeshStandardMaterial;
  if (def.transmission && def.transmission > 0) {
    m = new THREE.MeshPhysicalMaterial({
      color: def.color & 0xffffff, roughness: def.roughness, metalness: def.metalness,
      transmission: def.transmission, ior: def.ior ?? 1.5,
      transparent: true, opacity: def.opacity ?? 1, thickness: 1,
    });
  } else {
    m = new THREE.MeshStandardMaterial({ color: def.color & 0xffffff, roughness: def.roughness, metalness: def.metalness });
    if (def.emissive !== undefined) { m.emissive.setHex(def.emissive & 0xffffff); m.emissiveIntensity = def.emissiveIntensity ?? 1; }
  }
  if (surface) {
    const { normalMap, roughnessMap } = buildSurfaceMaps(surface, def.roughness);
    m.normalMap = normalMap;
    m.normalScale = new THREE.Vector2(surface.normal ?? 1, surface.normal ?? 1);
    m.roughnessMap = roughnessMap; // 与 material.roughness 相乘 → 凸光凹哑的起伏
  }
  return m;
}

// Material3D + Mesh3D → 单 mesh（特征物件·不进哑光实例化批）。
export function buildPbrMesh3D(m: Mesh3D, mat: Material3D): THREE.Mesh {
  const def = resolvePbr(mat.preset, mat);
  const geo = m.shape === 'plane'
    ? new THREE.PlaneGeometry(m.width, m.height)
    : m.shape === 'sphere'
      ? new THREE.SphereGeometry(Math.max(0.0001, m.width / 2), 48, 24) // material 球：高段数·反射/高光顺滑
      : new THREE.BoxGeometry(m.width, m.height, m.depth ?? m.width);
  const mesh = new THREE.Mesh(geo, buildPbrMaterial(def, mat.surface));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 材质签名（preset + 覆盖 + 形状尺寸 + 表面细节变 → 重建 mesh）。
export function pbrSig(m: Mesh3D, mat: Material3D): string {
  const s = mat.surface;
  const ss = s ? `${s.pattern}.${s.tiles ?? ''}.${s.normal ?? ''}.${s.rough ?? ''}.${s.scale ?? ''}` : '';
  return `pbr|${mat.preset}|${mat.color ?? ''}|${mat.roughness ?? ''}|${mat.metalness ?? ''}|${mat.emissive ?? ''}|${m.shape}|${m.width}|${m.height}|${m.depth ?? ''}|${ss}`;
}
