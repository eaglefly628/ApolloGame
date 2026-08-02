// Game B ·《雀宴》麻将核切片① —— 建山/洗牌/配牌/开门（headless 纯逻辑核·清单 §1）。
//
// 积木边界（owner 铁令：TS 只补引擎积木没有的缝·不绕积木）：
//   · 洗牌 = 引擎 `w1-random` 的 `seededShuffle`（种子 PRNG·同 seed 同局·**禁裸 Math.random**）；
//   · 掷骰 = 引擎 `w1-random` 的 `randomInt`（RandomSeed 状态推进）；
//   · 牌码 = t2-card-pile 契约（整数牌码数组·见 tiles-def.ts 34 种编码）。
// 本文件只补引擎没有的日麻缝：建 136 牌山（赤5 开关）、掷骰开门定劈口、王牌 14 枚分离、
//   配牌各 13、活山余 70。役/符/振听/连庄=后续切片（清单 §2+·裁决行待 GD-B 会审）。
// 确定性：单一 config.seed 贯穿（派生洗牌种子 + 骰点）→ 同 seed 整局逐张复现（walkthrough 依据）。
import { seededShuffle, randomInt, type RandomSeed } from '@zerocraft/engine/atom-skills/random/index.js';
import {
  CODE_TO_KIND, RED_FIVE_KINDS, RED_OFFSET, NUM_KINDS, TILES_PER_KIND, FULL_WALL, kindOf,
} from './tiles-def.js';

export interface WallConfig {
  seed: number; // SessionIn.seed（唯一随机源·gdd §十二）
  akaDora?: boolean; // 赤宝牌 3 枚开关（gdd §四·默认开）
}

export interface DealResult {
  hands: number[][]; // 四家配牌（hands[0]=庄·各 13 枚·升序）
  drawWall: number[]; // 活山摸序（余 70·摸切从头取·岭上从王牌取）
  deadWall: number[]; // 王牌 14 枚（宝牌指示/裏/杠宝牌/岭上·后续切片消费）
  doraIndicator: number; // 表宝牌指示牌（王牌第 3 墩上牌·标准位）
  uraIndicator: number; // 裏宝牌指示牌（其下张·立直和了才翻）
  dice: [number, number]; // 掷骰点（各 1-6·定亲/开门）
  openWall: number; // 开门家墙 0-3（0=庄东·逆时针）
  breakPos: number; // 劈口线性 index（0-135）
}

/** 建 136 牌山（34 种 × 4·赤5 开=每色一枚普5 替换为赤枚·守恒 136）。 */
export function buildWall(akaDora = true): number[] {
  const wall: number[] = [];
  for (let k = 0; k < NUM_KINDS; k++) {
    for (let i = 0; i < TILES_PER_KIND; i++) wall.push(k);
  }
  if (akaDora) {
    // 每色第一枚 5 → 赤枚（code+100）；替换非增减（枚数守恒）。
    for (const kind of [RED_FIVE_KINDS.man, RED_FIVE_KINDS.pin, RED_FIVE_KINDS.sou]) {
      const idx = wall.indexOf(kind);
      wall[idx] = kind + RED_OFFSET;
    }
  }
  return wall;
}

/** 配牌 + 开门（确定性·同 seed 全复现）。 */
export function dealWall(config: WallConfig): DealResult {
  const rng: RandomSeed = { type: 'RandomSeed', seed: config.seed, sequence: 0 };
  // 掷骰定亲/开门（各 1-6）；再派生洗牌种子——单 seed 贯穿、彼此确定性独立。
  const d1 = randomInt(rng, 1, 7);
  const d2 = randomInt(rng, 1, 7);
  const shuffleSeed = randomInt(rng, 0, 0x7fffffff);
  const shuffled = seededShuffle(buildWall(config.akaDora), shuffleSeed);

  // 开门：庄(东)起逆时针数 (d1+d2) 家 → 开门家墙；该墙第 sum 墩劈口（线性化到 136 环）。
  const sum = d1 + d2;
  const openWall = (sum - 1) % 4;
  const breakPos = (openWall * 34 + sum * 2) % FULL_WALL;

  // 劈口起环形取：王牌 14（劈口右侧 7 墩）+ 活山 122（其余·庄家起摸序）。
  const ring = (i: number): number => shuffled[((i % FULL_WALL) + FULL_WALL) % FULL_WALL]!;
  const deadWall = Array.from({ length: 14 }, (_, i) => ring(breakPos + i));
  const liveWall = Array.from({ length: FULL_WALL - 14 }, (_, i) => ring(breakPos + 14 + i));

  // 宝牌指示牌：王牌第 3 墩上牌（标准位·index 4）；裏=其下张（index 5）。
  const doraIndicator = deadWall[4]!;
  const uraIndicator = deadWall[5]!;

  // 配牌：3 轮各家取 4（=12）+ 各取 1（=13）；庄第 14 张=摸打首摸（不在配牌内）。
  const hands: number[][] = [[], [], [], []];
  let ptr = 0;
  for (let round = 0; round < 3; round++) {
    for (let seat = 0; seat < 4; seat++) {
      for (let n = 0; n < 4; n++) hands[seat]!.push(liveWall[ptr++]!);
    }
  }
  for (let seat = 0; seat < 4; seat++) hands[seat]!.push(liveWall[ptr++]!);
  const drawWall = liveWall.slice(ptr); // 余 70

  // 理牌：按种索引升序（赤5 归其普5 位·同种内普5 在赤5 前）——确定性 + 贴理牌习惯 + 便于后续判型。
  for (const h of hands) h.sort((a, b) => kindOf(a) - kindOf(b) || a - b);

  return { hands, drawWall, deadWall, doraIndicator, uraIndicator, dice: [d1, d2], openWall, breakPos };
}

/** 宝牌牌种：指示牌 → 实际宝牌种（数牌 9→1 环回·风牌 北→東 环·三元 中→白 环·标准）。 */
export function doraFromIndicator(indicatorCode: number): number {
  const k = kindOf(indicatorCode);
  if (k < 27) {
    // 数牌：同花色内 9→1 环回（花色段 [base, base+8]）。
    const base = Math.floor(k / 9) * 9;
    return base + ((k - base + 1) % 9);
  }
  if (k < 31) return 27 + ((k - 27 + 1) % 4); // 风牌 東南西北環（北→東）
  return 31 + ((k - 31 + 1) % 3); // 三元 白發中環（中→白）
}

/** 牌山健康自检（守恒 + 每种枚数·测试与落盘门共用）。 */
export function wallHealth(deal: DealResult): { total: number; perKindOk: boolean } {
  const all = [...deal.hands.flat(), ...deal.drawWall, ...deal.deadWall];
  const count = new Array<number>(NUM_KINDS).fill(0);
  for (const c of all) count[kindOf(c)]!++;
  return { total: all.length, perKindOk: count.every((n) => n === TILES_PER_KIND) };
}

export { CODE_TO_KIND };
