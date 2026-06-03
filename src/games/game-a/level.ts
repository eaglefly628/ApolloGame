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
}

// 世界 1-1 · 初次配合：地面 + 三块居中平台（供跳跃），两名玩家在两侧空地起跳、各自落到地面。
// 布局刻意让出生点正下方是地面（非平台）→ 落地点确定（y≈333），手感与回归都好预测。
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
  spawnA: { x: 80, y: 80 }, // 玩家横跨 [65,95]，左侧空地，落地面
  spawnB: { x: 560, y: 80 }, // 玩家横跨 [545,575]，右侧空地，落地面
};
