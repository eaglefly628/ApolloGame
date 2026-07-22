import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';

// ═══════════════════════════════════════════════════════════════
//  game-a ·《掼蛋夜宴》3D 呢面牌桌（owner 2026-07-22：牌桌用 3D + 高质量/高分辨率材质 + 高光 + 打几盏灯）。
//
//  纯 render-only 3D 组件（Transform3D/Mesh3D/Material3D/Camera3D/Light3D）——ThreeRenderer（P3D 域）直接消费。
//  掼蛋=纯观感·无物理筹码（区别德州 game-c 的抛筹码/围栏）：椭圆酒红呢面 + 金边桌沿环 + 深胡桃桌基 + 桌心暖光池（高光）
//  + 暖主光(投影) + 冷紫补 + 暖环境。「2D 观感」= 陡俯视相机（近垂直看下·桌面平·2D 手牌/席位/按钮盖在上层）。
//  ⚠ 红线：render-only·不进 sim/hash·不被 Condition 读（回放/确定性零影响）；材质/贴图**只写 skinKey**、真字节在资产层。
//  材质贴图槽 skinKey `game-a/table/felt-albedo`(+normal)：工坊生成高清呢面真图 → ThreeRenderer 按 key 挂上（mesh 自动重建）；
//  无真图 = 回退 preset matte + 酒红 color（观感近零变·兜底永不丢）。坐标：x 右 / y 上（地 0）/ z 朝镜头。桌心=原点。
// ═══════════════════════════════════════════════════════════════

// 色板（蓝本酒红呢桌 × 米金边 × 深胡桃基·同 2D theme FELT_RED/GOLD 色锚）。
const FELT = 0x6a1f26, FELT_LO = 0x360f14; // 呢面主色 / 边暗
const RIM = 0xf0c96a;                       // 金边环（米金·metal 高光）
const BASE = 0x2a1512, BASE_LO = 0x150a06;  // 深胡桃桌基 / 边暗

// 椭圆呢面长/短半轴（世界单位·≈2.5:1 对齐 2D felt 816×322 屏区）。
export const FELT_RX = 3.6, FELT_RZ = 1.9;
const FELT_TOP = 0.5; // 呢面上沿 y

/** 3D 牌桌场景（静态·render-only）：陡俯视相机 + 四光 + 深胡桃桌基 + 金边环 + 酒红椭圆呢面（材质贴图槽）。 */
export function build3DTableBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};

  // 相机：陡俯视（pitch≈1.32rad≈76°·近垂直=桌面平·减少桌侧"墙"露出防阶梯感）·yaw0=主角(+z)在屏底·distance 框住椭圆长轴。
  entities['cam'] = {
    Camera3D: { yaw: 0, pitch: 1.32, projection: 'perspective', fov: 36, distance: 7.4, near: 0.1, far: 100, pivotX: 0, pivotY: 0.35, pivotZ: 0 },
  };
  // 四光：暖顶主光（投影→呢面立体+金边高光）+ 冷紫补（夜局冷调）+ 暖环境 + 桌心暖光池（呢面中央提亮=高光池）。
  entities['sun'] = { Light3D: { kind: 'directional', color: 0xfff0d8, intensity: 1.15, dirX: -2, dirY: -8, dirZ: -2, castShadow: true } };
  entities['fill'] = { Light3D: { kind: 'directional', color: 0x8a6fff, intensity: 0.18, dirX: 4, dirY: -3, dirZ: 4 } };
  entities['amb'] = { Light3D: { kind: 'ambient', color: 0xe8d0c0, intensity: 0.45 } };
  entities['pool'] = { Transform3D: { x: 0, y: 2.6, z: -0.1 }, Light3D: { kind: 'point', color: 0xffd2a0, intensity: 5.0, range: 9 } };

  // 桌基（深胡桃·椭圆圆柱×scaleX·呢面下桌身·矮身减少桌侧墙露出）。
  entities['base'] = {
    Transform3D: { x: 0, y: 0.14, z: 0, scaleX: FELT_RX / FELT_RZ },
    Mesh3D: { shape: 'cylinder', width: FELT_RZ * 2 + 0.5, height: 0.32, frontTint: BASE, edgeTint: BASE_LO },
    Material3D: { preset: 'wood', color: BASE },
  };
  // 金边环（米金 metal·夹在桌基与呢面之间露出一圈金边·夜宴金饰·薄）。
  entities['rim'] = {
    Transform3D: { x: 0, y: FELT_TOP - 0.04, z: 0, scaleX: FELT_RX / FELT_RZ },
    Mesh3D: { shape: 'cylinder', width: FELT_RZ * 2 + 0.2, height: 0.08, frontTint: RIM, edgeTint: 0xa9791f },
    Material3D: { preset: 'gold', color: RIM },
  };
  // 酒红呢面（椭圆·材质贴图槽 albedo+normal·无真图回退 preset matte + 酒红 color·最上·最窄）。
  entities['felt'] = {
    Transform3D: { x: 0, y: FELT_TOP - 0.02, z: 0, scaleX: FELT_RX / FELT_RZ },
    Mesh3D: { shape: 'cylinder', width: FELT_RZ * 2, height: 0.08, frontTint: FELT, edgeTint: FELT_LO },
    Material3D: { preset: 'matte', color: FELT, map: 'game-a/table/felt-albedo', normalMap: 'game-a/table/felt-normal' },
  };

  return { capabilities: [], entities };
}
