// Game A 关卡数据（数据驱动，为多关卡 + 后续卷轴大关卡留好结构）。
// v0.1：固定屏 640×400 验证核心平台跳跃；真正的大关卡（世界比屏幕大 → 卷轴）
// 要等引擎相机/渲染器世界→屏幕变换落地（见 ../../../docs/workflow/requests.md REQ-001）。
import type { ConditionExpr } from '@engine/protocol/components.js';

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
  background?: string; // 背景贴图 textureKey（资产清单里声明）；无则纯色底
  goalArt?: string; // 目标处装饰贴图 textureKey（如旗帜）
  movers?: Mover[]; // Tween 驱动的移动平台（纯数据）
  doors?: Door[]; // 实心门（默认实心；被开关 set-sensor 切成可穿过）
  switches?: Switch[]; // 压力开关（踩上→开门），纯数据 zone-occupancy→event-when→effect
  collectibles?: Collectible[]; // 拾取物（金币/宝石）：碰到 → 自毁 + coins++
  goalRequires?: ('A' | 'B')[]; // 通关需哪些角色到达目标区（缺省 ['A','B'] 双人缺一不可）
}

// Tween 驱动的移动平台（数据驱动）：平台从 box 起点沿 target 轴缓动到 to。
// 一次性（连续往复需 Tween loop，见 requests REQ-004）。无 Velocity = 静态支撑，碰撞能载人。
export interface Mover {
  box: Box;
  target: 'Transform.x' | 'Transform.y';
  to: number;
  duration: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  loop?: 'none' | 'restart' | 'pingpong'; // 连续往复（REQ-004）；缺省 none = 一次性升降
  loops?: number; // 程数；缺省无限
}

// 实心门（数据驱动）：默认实心墙；被开关的 effect set-sensor 切成可穿过（REQ-008），离开复原。
export interface Door {
  id: string; // 实体 id（开关 effect 的 targetEntity 指向它）
  box: Box;
  // 开门条件（任意布尔树，组合多个开关的 outFlag）。缺省=只靠 Switch.opensDoor 直连。
  // 例：{ kind:'and', of:[{kind:'flag',id:'cover-left'},{kind:'flag',id:'cover-right'}] } = 两台都踩才开。
  // 纯数据：直接喂给 event-when 的 when（引擎已支持 and/or/not），无需任何新能力。
  openWhen?: ConditionExpr;
}

// 压力开关（数据驱动）：角色 by 踩进 plate 区域 → 产出 flag（→ 开门）。站着真、离开假。
// 纯能力链：zone-occupancy（占据→flag）→ event-when（flag/条件→signal）→ effect set-sensor（开/合门）。零游戏系统。
export interface Switch {
  plate: Box; // 压力板区域（zone 矩形 + 视觉标记）
  by: 'A' | 'B'; // 视觉色/默认踩者
  requires?: ('A' | 'B')[]; // 需同时站上才满足的角色（缺省 [by]）；['A','B'] = 重量台（双人缺一不可）
  opensDoor?: string; // 直连：满足时打开的门 id（站着开、离开合）。与 openWhen 二选一。
  outFlag?: string; // 命名旗标：满足时置真，供 Door.openWhen 组合（多台联动）。缺省 `switch{i}`。
}

// 拾取物（数据驱动）：任一玩家碰到 → 自毁 + coins 增 amount。零游戏系统。
// 纯能力链：zone-occupancy（任一玩家进 box → flag）→ event-when(edge) → effect destroy + effect modify-resource(coins)。
export interface Collectible {
  id: string;
  box: Box; // 位置 + 拾取范围
  amount?: number; // 拾到加多少 coins（缺省 1）
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
  background: 'bg.sky', // 背景贴图（资产清单 GAME_A_ASSETS）
  goalArt: 'goal.flag', // 目标处旗帜
  movers: [
    // 连续升降电梯（Tween pingpong，REQ-004，纯数据）：y 在 300↔160 往复，碰撞载人上下。
    { box: { x: 500, y: 300, width: 110, height: 18 }, target: 'Transform.y', to: 160, duration: 180, easing: 'easeInOut', loop: 'pingpong' },
  ],
};

// 世界 1-2 · 你踩我过：A 踩左侧开关板 → 中间实心门变可穿过 → B 通过到右侧目标；A 离开则门复原。
// 全数据：门 = Door、开关 = Switch（zone-occupancy → event-when → effect set-sensor），无任何游戏系统代码。
// 通关只需 B 到达（A 的职责是按住开关）→ goalRequires:['B']，体现非对称合作。
export const LEVEL_SWITCH: Level = {
  id: 'w1-2',
  name: '世界1-2 · 你踩我过',
  bounds: { width: 640, height: 400 },
  ground: { x: 320, y: 372, width: 620, height: 48 }, // 顶边 348
  platforms: [],
  spawnA: { x: 120, y: 80 }, // 落在左侧开关板上
  spawnB: { x: 240, y: 80 }, // 门左侧，须穿门去右侧目标
  goal: { x: 580, y: 305, width: 120, height: 130 }, // 右侧目标（门后）
  goalRequires: ['B'], // 只需 B 到达（A 在按开关）
  background: 'bg.sky', // 背景皮（地牢皮下 = 暗色地牢；SVG 皮下 = 天空）
  goalArt: 'goal.flag', // 目标处贴图（地牢皮下 = 楼梯出口）
  doors: [
    { id: 'door1', box: { x: 380, y: 300, width: 24, height: 96 } }, // 实心门 x[368,392] y[252,348]
  ],
  switches: [
    { plate: { x: 120, y: 336, width: 80, height: 44 }, by: 'A', opensDoor: 'door1' }, // 板 x[80,160] y[314,358]
  ],
};

// 世界 1-3 · 机关与宝物：演示两类"纯数据组合"出的新玩法（零游戏系统）。
//  ① 重量台：A、B 须同时站上左侧台 → door1 开（Switch.requires:['A','B']，缺一不可）。
//  ② 收集：地上的金币，任一玩家碰到 → 自毁 + coins++（zone→event-when→effect destroy+modify-resource）。
export const LEVEL_W1_3: Level = {
  id: 'w1-3',
  name: '世界1-3 · 机关与宝物',
  bounds: { width: 640, height: 400 },
  ground: { x: 320, y: 372, width: 620, height: 48 },
  platforms: [],
  spawnA: { x: 140, y: 80 }, // 落在重量台上
  spawnB: { x: 180, y: 80 }, // 也落在重量台上
  goal: { x: 580, y: 305, width: 120, height: 130 },
  goalRequires: ['A'],
  doors: [{ id: 'door1', box: { x: 440, y: 300, width: 24, height: 96 } }],
  switches: [
    // 重量台：两人同时站上才开 door1（requires 双人）
    { plate: { x: 160, y: 336, width: 140, height: 44 }, by: 'A', requires: ['A', 'B'], opensDoor: 'door1' },
  ],
  collectibles: [
    { id: 'gem1', box: { x: 300, y: 333, width: 24, height: 30 } },
    { id: 'gem2', box: { x: 350, y: 333, width: 24, height: 30 } },
  ],
};

// 世界 1-4 · 各守一台：A 守左台、B 守右台，两台同时被踩 → 中间闸门打开（缺一即合）。
// 与重量台（同一台两人同站）不同：这里是【两个分离的开关 outFlag 用 and 组合】驱动一扇门 ——
// 验证"门的开启条件可以是任意布尔树（多机关联动）"，全部喂给引擎已有的 event-when（and/or/not），零新能力、零游戏系统。
// 通关只需 A 到达右侧目标（B 的职责是守住右台按住闸门）→ 非对称合作。
export const LEVEL_W1_4: Level = {
  id: 'w1-4',
  name: '世界1-4 · 各守一台',
  bounds: { width: 640, height: 400 },
  ground: { x: 320, y: 372, width: 620, height: 48 }, // 顶边 348
  platforms: [],
  spawnA: { x: 80, y: 80 }, // 落在左台上
  spawnB: { x: 560, y: 80 }, // 落在右台上
  goal: { x: 580, y: 305, width: 120, height: 130 }, // 右侧目标（闸门后）
  goalRequires: ['A'], // 只需 A 到达（B 守右台）
  doors: [
    {
      id: 'gate',
      box: { x: 320, y: 300, width: 24, height: 96 }, // 居中闸门 x[308,332] y[252,348]
      // 两台都被踩（cover-left ∧ cover-right）→ 开；任一松开 → event-when level 模式自动转假 → 合。
      openWhen: { kind: 'and', of: [{ kind: 'flag', id: 'cover-left' }, { kind: 'flag', id: 'cover-right' }] },
    },
  ],
  switches: [
    { plate: { x: 80, y: 336, width: 80, height: 44 }, by: 'A', requires: ['A'], outFlag: 'cover-left' }, // 左台 → cover-left
    { plate: { x: 560, y: 336, width: 80, height: 44 }, by: 'B', requires: ['B'], outFlag: 'cover-right' }, // 右台 → cover-right
  ],
};
