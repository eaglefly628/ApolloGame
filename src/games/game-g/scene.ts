// VIS-2 三路战场布局 —— **单一真相**（design/16 §三/§九 approved）。
// render-frame.ts（SVG 评审帧）与 ThreeRenderer（浏览器真 3D）**共用**这一份 → 保证"评审帧 = 真游戏"、不漂移。
// ⛔ 纯函数 + 数据，无 Three / DOM / 引擎依赖（只引常量）；纯表现重映射、**不进 hash、不回灌 gameplay**。
//   按 lane/side/idx 把卡摆成 MOBA 三路：A(我)从左老家、B(敌)从右老家，front(col0)接敌中线，后排退向各自老家。
import { CARD_W, CARD_H } from './blueprint.js';

export const SCENE_W = 1280;
export const SCENE_H = 760;
export const LANE_Y = [180, 380, 580]; // 上/中/下 路横轨 y
export const LANE_NAME = ['上路', '中路', '下路'];
export const HOME_AX = 96; // 我军老家 x（左）
export const HOME_BX = SCENE_W - 96; // 敌军老家 x（右）
export const CONTEST = SCENE_W / 2; // 接敌中线（命运一掷处）
export const CARD_SCALE = 0.42; // 54v54 要塞得下
export const SCENE_CW = CARD_W * CARD_SCALE;
export const SCENE_CH = CARD_H * CARD_SCALE;
export const TOWER_DX = 250; // 哨塔距中线
export const LEAP_PX = 56; // 抛飞弧上跳高度（px）

/** 卡 → MOBA 屏位（px）。lane 0/1/2=上/中/下，side a 我/左·b 敌/右，idx=路内序号，arc=抛飞弧高 [0,1] 上跳。 */
export function cardScreenPos(lane: number, side: 'a' | 'b', idx: number, arc = 0): { x: number; y: number } {
  const col = Math.floor(idx / 3);
  const row = idx % 3;
  const sign = side === 'a' ? -1 : 1;
  const x = CONTEST + sign * (40 + col * (SCENE_CW + 6));
  const y = LANE_Y[lane] + (row - 1) * (SCENE_CH + 5) - LEAP_PX * arc;
  return { x, y };
}

/** 哨塔位（每路 A/B 各一，A 左 B 右）。 */
export const TOWERS: { x: number; y: number; side: 'a' | 'b'; lane: number }[] = LANE_Y.flatMap((ly, lane) => [
  { x: CONTEST - TOWER_DX, y: ly, side: 'a' as const, lane },
  { x: CONTEST + TOWER_DX, y: ly, side: 'b' as const, lane },
]);

/** 三路比分（每路活牌数 A:B）——弃一保二/谁赢一眼可读。从 (lane,side,faceUp)[] 数。 */
export function laneScores(cards: { lane: number; side: 'a' | 'b'; faceUp: boolean }[]): { a: number; b: number }[] {
  const sc = [0, 1, 2].map(() => ({ a: 0, b: 0 }));
  for (const c of cards) if (c.faceUp) sc[c.lane][c.side] += 1;
  return sc;
}
