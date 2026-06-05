// Game A 关卡数据（数据驱动，为多关卡 + 后续卷轴大关卡留好结构）。
// v0.1：固定屏 640×400 验证核心平台跳跃；真正的大关卡（世界比屏幕大 → 卷轴）
// 要等引擎相机/渲染器世界→屏幕变换落地（见 ../../../docs/workflow/requests.md REQ-001）。
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Spawn {
  x: number;
  y: number;
}

export interface Level {
  id: string;
  name: string;
  // 关卡世界尺寸。v0.1 == 视口；卷轴上线后可远大于视口。
  bounds: { width: number; height: number };
  ground: Box;
  platforms: Box[];
  spawnA: Spawn; // 蓝（角色 A）起点
  spawnB: Spawn; // 橙（角色 B）起点
  goal: Box; // 协作目标区：两名玩家都进入即过关（v0.2-proto）
}

// 世界 1-1 · 初次配合：地面 + 三块居中平台 + 右侧协作目标区。
// 两名玩家都从左侧空地出生、落到地面，须各自前进到右侧目标区会合 → 过关（双人缺一不可）。
// 出生点正下方是地面（非平台）→ 落地点确定（y≈333），回归好预测。
export const LEVEL_W1_1: Level = {
  id: 'w1-1',
  name: '世界1-1 · 初次配合',
  bounds: { width: 640, height: 400 },
  ground: { x: 320, y: 372, width: 620, height: 48 }, // 顶边 348
  platforms: [
    { x: 160, y: 290, width: 120, height: 24 }, // 横跨 [100,220]
    { x: 320, y: 210, width: 120, height: 24 }, // 横跨 [260,380]
    { x: 480, y: 290, width: 120, height: 24 }, // 横跨 [420,540]
  ],
  spawnA: { x: 40, y: 80 }, // 玩家横跨 [25,55]，左侧空地，落地面
  spawnB: { x: 80, y: 80 }, // 玩家横跨 [65,95]，左侧空地，落地面
  goal: { x: 580, y: 305, width: 120, height: 130 }, // 右侧目标区 x[520,640] y[240,370]（含右墙）
};

// 卷轴 demo 关卡：世界 1920×400（约 3 屏宽）。双人从左侧出发，须携手 traverse 到右端目标会合。
// 相机（camera-follow）跟两人中点卷动、分开时缩小 —— REQ-001 落地后解锁的"世界比屏幕大"。
export const LEVEL_SCROLL: Level = {
  id: 'scroll-1',
  name: '卷轴 · 携手向右',
  bounds: { width: 1920, height: 400 },
  ground: { x: 960, y: 372, width: 1900, height: 48 }, // x[10,1910] 顶边 348
  platforms: [
    { x: 300, y: 290, width: 140, height: 24 },
    { x: 620, y: 250, width: 140, height: 24 },
    { x: 940, y: 290, width: 160, height: 24 },
    { x: 1280, y: 250, width: 140, height: 24 },
    { x: 1600, y: 290, width: 160, height: 24 },
  ],
  spawnA: { x: 60, y: 80 }, // 横跨 [45,75]，左端空地
  spawnB: { x: 110, y: 80 }, // 横跨 [95,125]，左端空地
  goal: { x: 1830, y: 305, width: 160, height: 130 }, // 右端 x[1750,1910]
};
