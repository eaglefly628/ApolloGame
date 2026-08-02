// Game B ·《雀宴》麻将核切片② —— 和了形/听牌判定（headless 纯逻辑核·清单 §2）。
//
// 积木边界（owner 铁令：TS 只补引擎积木没有的缝·消费既有牌码不重造）：
//   · 牌码 = tiles-def.ts 34 种编码（man 0-8·pin 9-17·sou 18-26·字牌 27-33·赤5=普5码+100）；
//   · 计数一律经 `kindOf` 归一（赤5 折进其普5 种）→ 长度 34 桶数组·判型最稳口径。
// 本文件只判「形」（标准形/七对子/国士无双）+ 由形派生的听牌枚举。
//   ⚠ 役/符/振听/连庄=后续切片（§3+）；「1 番缚·无役不得和」属役表层（§3），
//   需役评估才能成立，**不在本纯形层**——isWinningHand 对合法牌形一律判 true（yaku-agnostic）。
// 确定性：纯函数·零随机·零 IO·零 UI/DOM；同输入同输出（判型宁可慢也要对）。
import { NUM_KINDS, kindOf } from './tiles-def.js';

/**
 * 13 种幺九牌的种索引（国士无双成分）：
 * man1/man9 · pin1/pin9 · sou1/sou9 + 七字牌（東南西北白發中）。
 */
const KOKUSHI_KINDS: readonly number[] = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
const KOKUSHI_SET: ReadonlySet<number> = new Set(KOKUSHI_KINDS);

/** 牌码数组 → 长度 34 桶计数（赤5 经 kindOf 归其普5 种·单一计数口径）。 */
function toCounts(tiles: number[]): number[] {
  const counts = new Array<number>(NUM_KINDS).fill(0);
  for (const t of tiles) counts[kindOf(t)]!++;
  return counts;
}

/**
 * 剩余牌能否恰好拆成若干面子（顺子/刻子）——递归回溯·就地增删还原。
 * 完备性：在「最低未消耗的种」上，该牌必被一个以它起头的刻子或顺子吃掉
 * （无更低牌可作顺子中/尾·雀头已在上层扣除），两路穷举回溯即完备。
 */
function canFormMelds(counts: number[]): boolean {
  let i = 0;
  while (i < NUM_KINDS && counts[i] === 0) i++;
  if (i === NUM_KINDS) return true; // 全部拆净 → 面子分解成立

  // 试刻子（三枚同种）。
  if (counts[i]! >= 3) {
    counts[i]! -= 3;
    if (canFormMelds(counts)) { counts[i]! += 3; return true; }
    counts[i]! += 3;
  }
  // 试顺子（同花色相邻 i,i+1,i+2）：仅数牌且不跨花色段（i%9<=6 保证 i..i+2 同色 1-9 内）。
  if (i < 27 && i % 9 <= 6 && counts[i + 1]! > 0 && counts[i + 2]! > 0) {
    counts[i]!--; counts[i + 1]!--; counts[i + 2]!--;
    if (canFormMelds(counts)) { counts[i]!++; counts[i + 1]!++; counts[i + 2]!++; return true; }
    counts[i]!++; counts[i + 1]!++; counts[i + 2]!++;
  }
  return false;
}

/** 标准形：枚举每个可作雀头的对子 → 余牌能拆成 4 面子即和。 */
function isStandardShape(counts: number[]): boolean {
  for (let p = 0; p < NUM_KINDS; p++) {
    if (counts[p]! >= 2) {
      counts[p]! -= 2;
      const ok = canFormMelds(counts);
      counts[p]! += 2; // 无论成败都还原（判型不改变输入）
      if (ok) return true;
    }
  }
  return false;
}

/** 七对子：恰 7 个不同对子（每种恰 2 枚·四枚同牌≠两对故一律拒）。 */
function isSevenPairs(counts: number[]): boolean {
  let pairs = 0;
  for (let k = 0; k < NUM_KINDS; k++) {
    const c = counts[k]!;
    if (c === 0) continue;
    if (c !== 2) return false; // 单张/三枚/四枚 → 非七对（四枚同牌显式判否）
    pairs++;
  }
  return pairs === 7;
}

/** 国士无双：13 种幺九各 ≥1·恰一种成对（那对=雀头/单骑落点）·无任何非幺九牌。 */
function isKokushi(counts: number[]): boolean {
  let pair = 0;
  for (let k = 0; k < NUM_KINDS; k++) {
    if (KOKUSHI_SET.has(k)) continue;
    if (counts[k]! !== 0) return false; // 混入非幺九 → 非国士
  }
  for (const k of KOKUSHI_KINDS) {
    const c = counts[k]!;
    if (c < 1) return false; // 缺一种幺九 → 非国士
    if (c === 2) pair++;
    else if (c !== 1) return false; // 某幺九 ≥3 → 非国士
  }
  return pair === 1;
}

/**
 * 14 张（13 + 和牌）是否构成和了形。
 * 覆盖三形：标准形（4 面子 + 1 雀头）/ 七对子 / 国士无双。
 * ⚠ 纯「形」判定·yaku-agnostic：合法牌形即 true；
 *   「1 番缚·无役不得和」由役表层（§3）叠加，不在本函数职责内。
 */
export function isWinningHand(tiles: number[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = toCounts(tiles);
  return isStandardShape(counts) || isSevenPairs(counts) || isKokushi(counts);
}

/**
 * 13 张手牌听哪些牌种（形式听牌·流局罚符依据）。
 * 逐一试 34 种牌码：加一张能否和 → 收集听牌种；升序去重（枚举天然有序无重）。
 * 排除已握 4 枚的种（无第 5 枚可摸·形式听牌不认「四枚使い」单听）。
 * 返回听牌种码数组（0-33·赤5 归其普5 种）；非听牌 / 非 13 张 → 空数组。
 */
export function tenpai(tiles: number[]): number[] {
  if (tiles.length !== 13) return [];
  const counts = toCounts(tiles);
  const waits: number[] = [];
  for (let k = 0; k < NUM_KINDS; k++) {
    if (counts[k]! >= 4) continue; // 已握 4 枚 → 无可摸的第 5 枚
    if (isWinningHand([...tiles, k])) waits.push(k);
  }
  return waits;
}

// ── 鸣牌（副露）加法扩展（naki-design §6）─────────────────────────────────────
// owner 铁令：门清核（isWinningHand/tenpai）签名与行为一字不改·此处纯加法。
// 关键复用：isStandardShape/canFormMelds 的面子数并非硬编码 4，而是由「余牌张数」隐含
//   （拆一雀头后余 3k 张 → 恰 k 面子）。故只需喂入「暗手 + 和牌」正确长度，
//   即自动判定 (4-meldCount) 面子 + 雀头，无需另造分解器。
//   长度绳（不变式）：一副露占 1 面子（3 张手数），暗手在和牌时须凑 (4-meldCount) 面子 + 雀头：
//     concealed.length（不含和牌）= 13 - 3*meldCount；加和牌后 = 14 - 3*meldCount。

/**
 * 副露后暗手和了判定：concealed（暗手·不含副露牌）+ winTile 是否凑成 (4-meldCount) 面子 + 雀头。
 * · meldCount=0 → 逐例等价 `isWinningHand([...concealed, winTile])`（含七対子 / 国士·回归钉）。
 * · meldCount≥1 → 只可能标准形（鸣了牌不可能七対 / 国士）：暗手+和牌拆成 (4-meldCount) 面子 + 雀头。
 * · meldCount / concealed 长度不合法（非 13-3*meldCount）→ false。
 * 顺子仍受 canFormMelds 的 `i%9<=6` 防跨花色；赤5 经 toCounts→kindOf 归普5 计。
 */
export function winsWithMelds(concealed: number[], meldCount: number, winTile: number): boolean {
  if (!Number.isInteger(meldCount) || meldCount < 0 || meldCount > 4) return false;
  if (concealed.length !== 13 - 3 * meldCount) return false;
  // meldCount=0：直接委托旧核 → 与门清路径逐例等价（七対 / 国士一并覆盖）。
  if (meldCount === 0) return isWinningHand([...concealed, winTile]);
  // meldCount≥1：标准形唯一路径。isStandardShape 拆一雀头后由余牌张数隐含 (4-meldCount) 面子。
  return isStandardShape(toCounts([...concealed, winTile]));
}

/**
 * 副露后暗手听牌枚举：concealed（不含副露·长度须 = 13-3*meldCount）逐试 34 种待ち → 能和的牌码升序数组。
 * · meldCount=0 → 逐例等价旧 `tenpai(concealed)`。
 * · 排除 concealed 已握 4 枚的种（无第 5 枚可摸·与门清 tenpai 同口径·不认「四枚使い」单听）。
 * · 非听 / 长度非法 → 空数组。
 */
export function tenpaiWithMelds(concealed: number[], meldCount: number): number[] {
  if (!Number.isInteger(meldCount) || meldCount < 0 || meldCount > 4) return [];
  if (concealed.length !== 13 - 3 * meldCount) return [];
  if (meldCount === 0) return tenpai(concealed); // 逐例等价旧核
  const counts = toCounts(concealed);
  const waits: number[] = [];
  for (let k = 0; k < NUM_KINDS; k++) {
    if (counts[k]! >= 4) continue; // 暗手已握 4 枚 → 无可摸的第 5 枚
    if (winsWithMelds(concealed, meldCount, k)) waits.push(k);
  }
  return waits;
}
