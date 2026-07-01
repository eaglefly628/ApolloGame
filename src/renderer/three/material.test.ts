// PBR 材质消费端（REQ-Resource ①·真实贴图走 texture-key 路线）：map 签名 + 贴图挂载 + 色彩空间/基色处理。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildPbrMaterial, pbrSig, applyMaterialRef, type PbrMaps } from './material.js';
import { resolvePbr, type MaterialSpec } from '@assets/index.js';
import type { Mesh3D, Material3D } from '@engine/protocol/components.js';

const mesh = (): Mesh3D => ({ type: 'Mesh3D', shape: 'box', width: 8, height: 8, depth: 8, frontTint: 0xffffff });

describe('REQ-Resource ① 材质贴图消费端', () => {
  it('pbrSig 纳入 4 个贴图 key（map 变 → 重建 mesh）', () => {
    const base: Material3D = { type: 'Material3D', preset: 'wood' };
    const withMap: Material3D = { type: 'Material3D', preset: 'wood', map: 'tex/a', normalMap: 'tex/n' };
    expect(pbrSig(mesh(), base)).not.toBe(pbrSig(mesh(), withMap));
    // 换 normalMap key → 签名再变
    expect(pbrSig(mesh(), withMap)).not.toBe(pbrSig(mesh(), { ...withMap, normalMap: 'tex/n2' }));
    // 无 map 时两个同预设材质签名一致
    expect(pbrSig(mesh(), base)).toBe(pbrSig(mesh(), { type: 'Material3D', preset: 'wood' }));
  });

  it('buildPbrMaterial 挂 map/normalMap；有 albedo 图 → 基色置白（免二次染色）', () => {
    const def = resolvePbr('wood');
    const maps: PbrMaps = { map: new THREE.Texture(), normalMap: new THREE.Texture() };
    const m = buildPbrMaterial(def, undefined, maps);
    expect(m.map).toBe(maps.map);
    expect(m.normalMap).toBe(maps.normalMap);
    expect(m.color.getHex()).toBe(0xffffff); // albedo 图供色 → 白基
    expect(m.normalScale.x).toBe(1); // 真实法线图 normalScale=1
  });

  it('显式贴图覆盖程序化 surface（真实贴图优先）', () => {
    const def = resolvePbr('rock');
    const surfMap = buildPbrMaterial(def, { pattern: 'noise' }).normalMap; // 程序化法线
    const realNormal = new THREE.Texture();
    const m = buildPbrMaterial(def, { pattern: 'noise' }, { normalMap: realNormal });
    expect(m.normalMap).toBe(realNormal); // 显式覆盖程序化
    expect(m.normalMap).not.toBe(surfMap);
  });

  it('无贴图（仅预设）→ 不设 map·行为不变', () => {
    const m = buildPbrMaterial(resolvePbr('gold'));
    expect(m.map).toBeNull();
    expect(m.metalness).toBe(1);
  });
});

describe('REQ-Resource ④ 材质数据资产（applyMaterialRef）', () => {
  const spec: MaterialSpec = { preset: 'wood', map: 'tex/alb', normalMap: 'tex/nrm', roughness: 0.7 };

  it('materialRef 目录命中 → spec 作基底（preset/贴图 key 来自材质资源）', () => {
    const mat: Material3D = { type: 'Material3D', preset: 'matte', materialRef: 'mat/wood' };
    const eff = applyMaterialRef(mat, spec);
    expect(eff.preset).toBe('wood'); // 材质资源 preset 权威（压过 inline 'matte'）
    expect(eff.map).toBe('tex/alb');
    expect(eff.normalMap).toBe('tex/nrm');
    expect(eff.roughness).toBe(0.7);
    // 有效材质喂 pbrSig → 反映材质资源（与裸 matte 不同）
    expect(pbrSig(mesh(), eff)).not.toBe(pbrSig(mesh(), mat));
  });

  it('inline 字段覆盖材质资源（局部微调）', () => {
    const mat: Material3D = { type: 'Material3D', preset: 'matte', materialRef: 'mat/wood', roughness: 0.2, color: 0xff0000 };
    const eff = applyMaterialRef(mat, spec);
    expect(eff.roughness).toBe(0.2); // inline 覆盖 spec.roughness=0.7
    expect(eff.color).toBe(0xff0000); // spec 无 color → 用 inline
    expect(eff.map).toBe('tex/alb'); // 未 inline 覆盖 → 用 spec
  });

  it('目录查无（spec undefined）→ 原样返回（向后兼容）', () => {
    const mat: Material3D = { type: 'Material3D', preset: 'steel', materialRef: 'mat/missing' };
    expect(applyMaterialRef(mat, undefined)).toBe(mat);
  });
});
