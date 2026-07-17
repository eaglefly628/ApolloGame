import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';

// ═══════════════════════════════════════════════════════════════
//  game-c ·《六人德州》3D 牌房场景蓝图（capability-plan §4-e·render-only·owner 2026-07-17 3D 物理筹码需求）
//
//  纯 render-only 3D 组件（Transform3D/Mesh3D/Camera3D/Light3D）——渲染器（ThreeRenderer·P3D 域）直接消费，
//  不需 world capability（capabilities=[]·静态场景无 tick system）。筹码物理（RigidBody3D+Impulse3D·阶段3）
//  由渲染器 PhysicsSystem（cannon-es·render-only）处理，同样不进 world/hash。
//  坐标系：x 右 / y 上（地面 0）/ z 朝镜头近。桌心=原点。art-data-manual §5.1 斜俯视 pitch≈46°。
//  颜色取 §1 夜宴色板：呢绿 #166f4f / 木边 #8a5f2e / 暖夜地板 / 金筹码。
// ═══════════════════════════════════════════════════════════════

const FELT = 0x166f4f, FELT_LO = 0x0e5540, RIM = 0x8a5f2e, RIM_LO = 0x4a3218;
const FLOOR = 0x241812, FLOOR_EDGE = 0x160e0a, WALL = 0x1c130d;
const STOOL = 0x5a3d2e, STOOL_HERO = 0xc99a3e;
const CARD_FACE = 0xf5efe0, CARD_EDGE = 0xd8cdb4;
const CHIP_GOLD = 0xe0b458, CHIP_RED = 0xc0392b, CHIP_BLACK = 0x1b1b22;

const STOOL_RING = 2.15; // 凳环半径（世界单位）
export const SEAT_COUNT = 6;

/** 座位 i 的桌面世界坐标（主角 i=0 正南 +z 朝镜头·顺时针 60° 环·匹配 art-data §5.2 方位）。 */
export function seatWorldPos(i: number): { x: number; z: number } {
  const th = (i * Math.PI) / 3; // 0=南(+z), 60°=东南 … 顺时针
  return { x: STOOL_RING * Math.sin(th), z: STOOL_RING * Math.cos(th) };
}

/** 3D 牌房场景（静态·render-only）：斜俯视相机 + 三光 + 地板/墙 + 呢桌 + 六凳 + 公共牌位 + 底池筹码占位。 */
export function build3DTableBlueprint(): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {};

  // 相机：斜俯视（art-data §5.1 46°≈0.72 弧度·透视纵深·pivot 抬到桌面）。yaw 0 = 主角(+z)在屏底。
  entities['cam'] = {
    Camera3D: { yaw: 0, pitch: 0.72, projection: 'perspective', fov: 44, distance: 6.6, near: 0.1, far: 100, pivotX: 0, pivotY: 0.45, pivotZ: 0.15 },
  };
  // 三光：暖顶主光（投影）+ 冷蓝补光 + 暖环境（§1 烛光暖夜）。
  entities['sun'] = { Light3D: { kind: 'directional', color: 0xfff0d8, intensity: 1.15, dirX: -3, dirY: -8, dirZ: -2, castShadow: true } };
  entities['fill'] = { Light3D: { kind: 'directional', color: 0x6f7cff, intensity: 0.22, dirX: 5, dirY: -3, dirZ: 4 } };
  entities['amb'] = { Light3D: { kind: 'ambient', color: 0xffe6c4, intensity: 0.52 } };

  // 房间：暖夜地板 + 远墙（氛围·墙角暗）。
  entities['floor'] = { Transform3D: { x: 0, y: -0.05, z: 0 }, Mesh3D: { shape: 'box', width: 10, height: 0.1, depth: 8, frontTint: FLOOR, backTint: FLOOR, edgeTint: FLOOR_EDGE } };
  entities['wall-n'] = { Transform3D: { x: 0, y: 1.4, z: -4 }, Mesh3D: { shape: 'box', width: 10, height: 3, depth: 0.2, frontTint: WALL, backTint: WALL, edgeTint: FLOOR_EDGE } };

  // 牌桌：木基圆柱 + 呢面圆柱（呢绿 §1）。
  entities['table-base'] = { Transform3D: { x: 0, y: 0.28, z: 0 }, Mesh3D: { shape: 'cylinder', width: 3.1, height: 0.5, frontTint: RIM, edgeTint: RIM_LO } };
  entities['table-felt'] = { Transform3D: { x: 0, y: 0.55, z: 0 }, Mesh3D: { shape: 'cylinder', width: 2.7, height: 0.06, frontTint: FELT, edgeTint: FELT_LO } };

  // 六凳：环桌矮圆柱（主角凳暖金高亮·§5.3 出局变暗留渲染层）。
  for (let i = 0; i < SEAT_COUNT; i++) {
    const { x, z } = seatWorldPos(i);
    entities[`stool-${i}`] = { Transform3D: { x, y: 0.13, z }, Mesh3D: { shape: 'cylinder', width: 0.72, height: 0.26, frontTint: i === 0 ? STOOL_HERO : STOOL } };
  }

  // 公共牌位（桌心横排 5 张薄片·牌面 Decal3D=后续接·现暗面占位）。
  for (let i = 0; i < 5; i++) {
    entities[`board3d-${i}`] = { Transform3D: { x: (i - 2) * 0.34, y: 0.59, z: 0 }, Mesh3D: { shape: 'box', width: 0.3, height: 0.02, depth: 0.42, frontTint: CARD_FACE, backTint: CARD_FACE, edgeTint: CARD_EDGE } };
  }

  // 底池筹码堆占位（桌心偏北·物理抛掷筹码=阶段3 动态生成·此为静态底池堆）。
  const potColors = [CHIP_GOLD, CHIP_RED, CHIP_BLACK, CHIP_GOLD];
  for (let i = 0; i < potColors.length; i++) {
    entities[`potchip-${i}`] = { Transform3D: { x: 0, y: 0.61 + i * 0.045, z: -0.5 }, Mesh3D: { shape: 'cylinder', width: 0.34, height: 0.045, frontTint: potColors[i] } };
  }

  return { capabilities: [], entities };
}
