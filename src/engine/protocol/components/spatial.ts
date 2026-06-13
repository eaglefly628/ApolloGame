// Protocol · 时空 / 物理 / 几何 / 碰撞检测 / 世界服务 ─────────────────────────────
// 实体在世界里"在哪、多大、怎么动、碰没碰、占没占区"的物理基底；以及挂在 world 实体上的
// 随机数与空间索引服务。被 motion/collision/spatial-query/trigger-zone/tilemap 等读写。
import type { Component, EntityId } from '../../core/types.js';

// ── A1 transform ── 实体在世界的位置、朝向和大小
export interface Transform extends Component {
  readonly type: 'Transform';
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

// ── B1 velocity ── 实体当前的运动方向、速度和角速度
export interface Velocity extends Component {
  readonly type: 'Velocity';
  vx: number;
  vy: number;
  angular: number;
}

// ── B2 acceleration ── 实体的速度在怎么变
export interface Acceleration extends Component {
  readonly type: 'Acceleration';
  ax: number;
  ay: number;
}

// ── B3 mass ── 实体有多重（0 = 不可移动）
export interface Mass extends Component {
  readonly type: 'Mass';
  value: number;
}

// ── C1 shape ── 碰撞/占位几何形状
export interface Shape extends Component {
  readonly type: 'Shape';
  kind: 'box' | 'circle' | 'polygon';
  width?: number;
  height?: number;
  radius?: number;
  // polygon: 局部空间凸多边形顶点，扁平存 [x0,y0,x1,y1,...]（不含旋转，旋转留待刚体阶段）。
  vertices?: number[];
}

// ── bounds-clamp ── 实体允许活动的世界矩形（含边界）。bounds-clamp 据此把 AABB 钳进去。
export interface Bounds extends Component {
  readonly type: 'Bounds';
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ── A2 hierarchy ── 实体挂在谁下面、本地偏移多少
export interface Hierarchy extends Component {
  readonly type: 'Hierarchy';
  parentId: EntityId;
  localX: number;
  localY: number;
  localRotation: number;
  localScaleX: number;
  localScaleY: number;
}

// ── W1 random ── 可控随机数（确定性重放基石），挂在 world 实体
export interface RandomSeed extends Component {
  readonly type: 'RandomSeed';
  seed: number;
  sequence: number;
}

// ── D1 overlap-detect ── 哪两个实体重叠了，法线与穿透深度
export interface Overlap extends Component {
  readonly type: 'Overlap';
  entityA: EntityId;
  entityB: EntityId;
  normalX: number;
  normalY: number;
  depth: number;
}

// ── ground-sense ── 实体这帧是否站在地面上（marker，存在即着地，每帧由 ground-sense 重算）
export interface Grounded extends Component {
  readonly type: 'Grounded';
}

// ── sensor ── 非实心碰撞体标记（REQ-002）。挂了它的实体仍参与 overlap-detect/trigger-zone（感知），
// 但 collision-resolve **跳过**含它的接触对（不做物理推开）。开关/压力板/触发区 = Sensor，玩家能站进去。
export interface Sensor extends Component {
  readonly type: 'Sensor';
}

// ── trigger-zone ── 触发事件：实体 other 进入了触发区 zone（每帧重算，read-then-consume 或每帧清重标）。
export interface Trigger extends Component {
  readonly type: 'Trigger';
  zone: EntityId;
  other: EntityId;
}

// ── zone-occupancy ── 声明式区域占据目标：区内匹配目标达数量阈值 → 置 outFlag（REQ-006，下沉 coop-goal）。
// 把「胜负/通关/到达/区域占据/收集齐」表达成纯数据，不写游戏专属系统。判实体中心点是否落入世界矩形。
export interface Zone extends Component {
  readonly type: 'Zone';
  outFlag: string; // 满足时置 true、否则 false 的 Flag id（按 id 全局定位）
  minX: number;
  minY: number;
  maxX: number;
  maxY: number; // 世界矩形（含边界）
  requiredTag?: number; // 选择器A：只数 Tag.flags 含此位的实体（位与非零即匹配）
  requiredEntities?: EntityId[]; // 选择器B：指定实体名单（与 requiredTag 二选一；都缺=所有带 Transform 的实体）
  count?: number; // 数量阈值。Tag/全体模式缺省=1；entities 模式缺省=名单长度（全部在内）
}

// ── W2 spatial-query ── 空间查询服务配置，挂在 world 实体
export interface SpatialIndex extends Component {
  readonly type: 'SpatialIndex';
  cellSize: number;
  kind: 'grid' | 'quadtree';
}

// ── tilemap ── 瓦片地图（地图=数据：二维数组 + tileset assetKey；引擎=瓦片碰撞 + 渲染两台通用解释器）。
// 瓦片不是实体、不进 tick；只在碰撞时被查询、被渲染器画。一个 collides 层里**非零**瓦片=实心(mass0 静态体)，
// 0=空/可通行。多层分工：floor(不挡)/walls(挡)/decoration(不挡)。瓦片在世界里的位置：左上角 (originX,originY)，
// 瓦片 (c,r) 覆盖世界 [originX+c*tileSize, +tileSize) × [originY+r*tileSize, +tileSize)。
// 这是 Hades 式拼接的"房间"积木：一份 Tilemap = 一个房间；dungeon 能力(后)按种子拼多份。
export interface TileLayer {
  name: string; // 'floor' | 'walls' | 'decoration' | …
  data: number[]; // 长 cols*rows，row-major，0=空，>0=tileId（tileset 里第几格，1-based）
  collides: boolean; // 该层非零瓦片是否实心（参与瓦片碰撞）
  tileset: string; // 图块集 assetKey（R9；渲染器据 tileId 算源矩形）
}
export interface Tilemap extends Component {
  readonly type: 'Tilemap';
  cols: number; // 横向格数
  rows: number; // 纵向格数
  tileSize: number; // 每格像素
  originX: number; // 瓦片 (0,0) 左上角的世界 x（房间可放任意位置 → Hades 拼接）
  originY: number;
  layers: TileLayer[];
}
