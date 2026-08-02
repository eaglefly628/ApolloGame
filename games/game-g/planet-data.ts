// Game G · 星球牌数据（第二养成轴 doc12 §三 · 升档/可叠加·拆分自 blueprint.ts·纯数据+小helper叶子·只 import 更底层叶子）。

import { RUN_LIVES } from './campaign-data.js'; // effectiveLives 基线（run 命线上限）
import { LEVER_CAP, LEVER_REGEN } from './lever-data.js'; // effectiveLeverCap/effectiveLeverRegen 基线

// ── T-G6 · 星球牌（第二养成轴 · design/12 §三 · 升档/可叠加）──
// 与天罡（一次性·改规则·身份）正交：星球 = **可叠加的升档**（买 N 级累加），改 run 参数 / 军阵底盘。持久存档、跨 run。
// 本批 3 张：命(run 命线上限)/能(干预能量上限+回能)/军(「兵」档 favor 底盘)——皆**与大厅 deck-favor 商店不重叠**的新轴
// （命/能=run 经济无现成；军=作用在 built 军阵的兵档结构，非 deck 均值偏置）。路(选路)/型(牌型档) 待 design 定目标 UI，见 finish。
export type PlanetKind = 'lives' | 'energy' | 'rank-favor' | 'tier';
export interface PlanetCard { id: string; name: string; kind: PlanetKind; cost: number; amount: number; text: string }
export const GAME_G_PLANETS: PlanetCard[] = [
  { id: 'saturn', name: '地支·命', kind: 'lives', cost: 24, amount: 1, text: '战役命线上限 +1/级（更长的 run）' },
  { id: 'jupiter', name: '地支·能', kind: 'energy', cost: 20, amount: 1, text: '干预能量上限 +1 且每胜回能 +1/级' },
  { id: 'mars', name: '地支·军', kind: 'rank-favor', cost: 14, amount: 3, text: '全军「兵」档(A–6) favor +3/级（夯实底盘）' },
  { id: 'mercury', name: '地支·型', kind: 'tier', cost: 16, amount: 4, text: '牌型羁绊（同花/顺子卡）整条阶梯 +4/级（牌型流升档）' },
];
export const PLANET_BY_ID: ReadonlyMap<string, PlanetCard> = new Map(GAME_G_PLANETS.map((p) => [p.id, p]));
const planetBump = (planets: Record<string, number> | undefined, id: string): number => (planets?.[id] ?? 0) * (PLANET_BY_ID.get(id)?.amount ?? 0);
/** 派生 run 参数（叠加星球级数；纯函数、可测）。星球持久 → run 重开读它。 */
export function effectiveLives(planets: Record<string, number>): number { return RUN_LIVES + planetBump(planets, 'saturn'); }
export function effectiveLeverCap(planets: Record<string, number>): number { return LEVER_CAP + planetBump(planets, 'jupiter'); }
export function effectiveLeverRegen(planets: Record<string, number>): number { return LEVER_REGEN + planetBump(planets, 'jupiter'); }
