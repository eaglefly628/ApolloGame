import * as THREE from 'three';
import type { Mesh3D, Material3D } from '@engine/protocol/components.js';
import { resolvePbr, type PbrMaterialDef } from '@assets/index.js';

// ═══════════════════════════════════════════════════════════════
//  three/material —— PBR 材质（TA Phase 5·render-only）。据 `Material3D` 预设 + 覆盖建物理材质。
//  金属/介电走 MeshStandardMaterial；玻璃(transmission>0)走 MeshPhysicalMaterial（透射/折射）。
//  数据全来自美术库 `assets/pbr-materials` 的闭集预设。
// ═══════════════════════════════════════════════════════════════

// 预设 → three 材质。
export function buildPbrMaterial(def: PbrMaterialDef): THREE.MeshStandardMaterial {
  if (def.transmission && def.transmission > 0) {
    const m = new THREE.MeshPhysicalMaterial({
      color: def.color & 0xffffff, roughness: def.roughness, metalness: def.metalness,
      transmission: def.transmission, ior: def.ior ?? 1.5,
      transparent: true, opacity: def.opacity ?? 1, thickness: 1,
    });
    return m;
  }
  const m = new THREE.MeshStandardMaterial({ color: def.color & 0xffffff, roughness: def.roughness, metalness: def.metalness });
  if (def.emissive !== undefined) { m.emissive.setHex(def.emissive & 0xffffff); m.emissiveIntensity = def.emissiveIntensity ?? 1; }
  return m;
}

// Material3D + Mesh3D → 单 mesh（特征物件·不进哑光实例化批）。
export function buildPbrMesh3D(m: Mesh3D, mat: Material3D): THREE.Mesh {
  const def = resolvePbr(mat.preset, mat);
  const geo = m.shape === 'plane'
    ? new THREE.PlaneGeometry(m.width, m.height)
    : new THREE.BoxGeometry(m.width, m.height, m.depth ?? m.width);
  const mesh = new THREE.Mesh(geo, buildPbrMaterial(def));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 材质签名（preset + 覆盖 + 形状尺寸变 → 重建 mesh）。
export function pbrSig(m: Mesh3D, mat: Material3D): string {
  return `pbr|${mat.preset}|${mat.color ?? ''}|${mat.roughness ?? ''}|${mat.metalness ?? ''}|${mat.emissive ?? ''}|${m.shape}|${m.width}|${m.height}|${m.depth ?? ''}`;
}
