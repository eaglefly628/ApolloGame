// ═══════════════════════════════════════════════════════════════
//  PBR 材质库（美术库·TA Phase 5）—— **封闭的常见物理材质预设集**。
//  数据驱动：物件挂 `Material3D { preset, 覆盖参数 }` 选一种 + 调参，**不写自由材质**（弱 LLM 也只在闭集里选+调）。
//  渲染器据预设建 three 物理材质（MeshStandard / 玻璃走 MeshPhysical transmission）。render-only·不进 hash。
//
//  ⚠️ 数值=临时参考值（业界常见 albedo/roughness/metalness）。后续可换实测反照率 + 贴图（normal/roughness map）精修。
//  约定：金属 metalness=1·color=反照率；介电 metalness=0·color=漫反射；玻璃走 transmission。
// ═══════════════════════════════════════════════════════════════

export interface PbrMaterialDef {
  color: number; // 0xRRGGBB（金属=反照率·介电=漫反射）
  roughness: number; // 0..1（粗糙度·越大越哑）
  metalness: number; // 0..1（金属度）
  emissive?: number; // 自发光色 0xRRGGBB
  emissiveIntensity?: number;
  transmission?: number; // 透射(玻璃) 0..1 → 渲染器改用 MeshPhysicalMaterial
  ior?: number; // 折射率（玻璃 ~1.5）
  opacity?: number; // 透明度（玻璃 <1）
  transparent?: boolean;
}

// 闭集预设（owner「不用太多·几种就够」：金属/玻璃/土/钢/岩石… + 默认哑光）。临时参考值。
export const PBR_MATERIALS = {
  matte: { color: 0xffffff, roughness: 0.9, metalness: 0 }, // 哑光（默认·陶土/塑料感·色常由物件给）
  plastic: { color: 0xffffff, roughness: 0.35, metalness: 0 }, // 光面塑料
  steel: { color: 0x8a8d92, roughness: 0.42, metalness: 1 }, // 钢
  iron: { color: 0x6e7074, roughness: 0.62, metalness: 1 }, // 铁（粗糙暗）
  gold: { color: 0xffc64a, roughness: 0.28, metalness: 1 }, // 金
  copper: { color: 0xb87333, roughness: 0.36, metalness: 1 }, // 铜
  glass: { color: 0xeaf6ff, roughness: 0.05, metalness: 0, transmission: 0.92, ior: 1.5, opacity: 0.5, transparent: true }, // 玻璃
  rock: { color: 0x8d8f92, roughness: 0.9, metalness: 0 }, // 岩石
  dirt: { color: 0x6e4f33, roughness: 0.96, metalness: 0 }, // 土
  wood: { color: 0x9c6b3f, roughness: 0.62, metalness: 0 }, // 木
  emissive: { color: 0x222222, roughness: 0.5, metalness: 0, emissive: 0xfff0a0, emissiveIntensity: 1.6 }, // 自发光
} as const satisfies Record<string, PbrMaterialDef>;

export type PbrPreset = keyof typeof PBR_MATERIALS;

// 覆盖参数（Material3D 给）：在预设基础上微调。
export interface PbrOverrides {
  color?: number; roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number;
}

// 解析：预设 + 覆盖 → 最终材质数据。未知预设回退 matte（健壮·弱 LLM 拼错不崩）。
export function resolvePbr(preset: string, ov?: PbrOverrides): PbrMaterialDef {
  const base = (PBR_MATERIALS as Record<string, PbrMaterialDef>)[preset] ?? PBR_MATERIALS.matte;
  if (!ov) return base;
  return {
    ...base,
    ...(ov.color !== undefined ? { color: ov.color } : {}),
    ...(ov.roughness !== undefined ? { roughness: ov.roughness } : {}),
    ...(ov.metalness !== undefined ? { metalness: ov.metalness } : {}),
    ...(ov.emissive !== undefined ? { emissive: ov.emissive } : {}),
    ...(ov.emissiveIntensity !== undefined ? { emissiveIntensity: ov.emissiveIntensity } : {}),
  };
}
