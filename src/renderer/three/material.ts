import * as THREE from 'three';
import type { Mesh3D, Material3D, SurfaceDetail } from '@engine/protocol/components.js';
import { resolvePbr, type PbrMaterialDef, type MaterialSpec } from '@assets/index.js';
import { buildSurfaceMaps } from './surface-tex.js';

// ═══════════════════════════════════════════════════════════════
//  three/material —— PBR 材质（TA Phase 5·render-only）。据 `Material3D` 预设 + 覆盖建物理材质。
//  金属/介电走 MeshStandardMaterial；玻璃(transmission>0)走 MeshPhysicalMaterial（透射/折射）。
//  数据全来自美术库 `assets/pbr-materials` 的闭集预设。
// ═══════════════════════════════════════════════════════════════

// 已解析的真实贴图（REQ-Resource ①·渲染器据 Material3D map key 从 AssetManager 取好、**色彩空间已按用途设**·传入）。
export interface PbrMaps {
  map?: THREE.Texture; // albedo·sRGB
  normalMap?: THREE.Texture; // 线性
  roughnessMap?: THREE.Texture; // 线性
  aoMap?: THREE.Texture; // 线性
}

// REQ-Resource ④：材质数据资产（MaterialSpec）→ 合成有效 Material3D。
// `spec` 作基底（材质资源权威·尤其 preset + 引的 texture key）；inline `mat` 已定义的字段覆盖之（局部微调）。
// spec 缺省（materialRef 未设 / 目录查无）→ 原样返回 mat（向后兼容·纯 inline 路径）。render-only·纯数据合成。
export function applyMaterialRef(mat: Material3D, spec: MaterialSpec | undefined): Material3D {
  if (!spec) return mat;
  return {
    type: 'Material3D',
    preset: spec.preset ?? mat.preset, // 材质资源的 preset 权威；无则用 inline 后备
    color: mat.color ?? spec.color,
    roughness: mat.roughness ?? spec.roughness,
    metalness: mat.metalness ?? spec.metalness,
    emissive: mat.emissive ?? spec.emissive,
    emissiveIntensity: mat.emissiveIntensity,
    surface: mat.surface,
    map: mat.map ?? spec.map,
    normalMap: mat.normalMap ?? spec.normalMap,
    roughnessMap: mat.roughnessMap ?? spec.roughnessMap,
    aoMap: mat.aoMap ?? spec.aoMap,
    materialRef: mat.materialRef,
  };
}

// 预设 → three 材质。surface 在场 → 程序化生成 normal/roughness 挂上；**显式 maps 覆盖同通道**（真实贴图优先·render-only）。
export function buildPbrMaterial(def: PbrMaterialDef, surface?: SurfaceDetail, maps?: PbrMaps): THREE.MeshStandardMaterial {
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
    const s = buildSurfaceMaps(surface, def.roughness);
    m.normalMap = s.normalMap;
    m.normalScale = new THREE.Vector2(surface.normal ?? 1, surface.normal ?? 1);
    m.roughnessMap = s.roughnessMap; // 与 material.roughness 相乘 → 凸光凹哑的起伏
  }
  if (maps) { // 真实贴图覆盖程序化（显式优先）
    if (maps.map) { m.map = maps.map; m.color.setHex(0xffffff); } // albedo 图供色 → 基色置白·免二次染色（PBR 惯例）
    if (maps.normalMap) { m.normalMap = maps.normalMap; m.normalScale = new THREE.Vector2(1, 1); }
    if (maps.roughnessMap) m.roughnessMap = maps.roughnessMap;
    if (maps.aoMap) m.aoMap = maps.aoMap;
    m.needsUpdate = true;
  }
  return m;
}

// Material3D + Mesh3D → 单 mesh（特征物件·不进哑光实例化批）。maps=渲染器已解析的真实贴图（色彩空间已设）。
export function buildPbrMesh3D(m: Mesh3D, mat: Material3D, maps?: PbrMaps): THREE.Mesh {
  const def = resolvePbr(mat.preset, mat);
  const geo = m.shape === 'plane'
    ? new THREE.PlaneGeometry(m.width, m.height)
    : m.shape === 'sphere'
      ? new THREE.SphereGeometry(Math.max(0.0001, m.width / 2), 48, 24) // material 球：高段数·反射/高光顺滑
      : new THREE.BoxGeometry(m.width, m.height, m.depth ?? m.width);
  if (maps?.aoMap && geo.attributes['uv'] && !geo.attributes['uv2']) {
    geo.setAttribute('uv2', geo.attributes['uv']!); // aoMap 走第二套 UV·盒/球无 uv2 → 复用 uv
  }
  const mesh = new THREE.Mesh(geo, buildPbrMaterial(def, mat.surface, maps));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 材质签名（preset + 覆盖 + 形状尺寸 + 表面细节 + **真实贴图 key** 变 → 重建 mesh）。贴图就绪态由渲染器另加进 mode。
export function pbrSig(m: Mesh3D, mat: Material3D): string {
  const s = mat.surface;
  const ss = s ? `${s.pattern}.${s.tiles ?? ''}.${s.normal ?? ''}.${s.rough ?? ''}.${s.scale ?? ''}` : '';
  const mk = `${mat.map ?? ''}.${mat.normalMap ?? ''}.${mat.roughnessMap ?? ''}.${mat.aoMap ?? ''}`;
  return `pbr|${mat.preset}|${mat.color ?? ''}|${mat.roughness ?? ''}|${mat.metalness ?? ''}|${mat.emissive ?? ''}|${m.shape}|${m.width}|${m.height}|${m.depth ?? ''}|${ss}|${mk}`;
}
