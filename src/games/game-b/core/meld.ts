// Game B ·《雀宴》麻将核 —— 鸣牌（副露）数据模型（纯数据/纯函数·headless 逻辑核·naki-design §1）。
//
// 积木边界（owner 铁令·加法扩展不破门清核）：
//   · Meld = 一组已鸣露的面子（吃/碰/大明杠/暗杠/加杠）·tiles 为组成牌码（含赤5·升序·由调用方保证）；
//   · 本文件只放「数据模型 + 纯查询」——鸣牌合法性检测/应用=后续切片 calls.ts（P2），不在此；
//   · from/called = 供牌者 seat 与被鸣牌码（P3 流程 / UI 展示消费·P1 仅承载）。
// 确定性：纯函数·零随机·零 IO·零 UI/DOM·零引擎依赖。

/** 副露类型：吃 / 碰 / 大明杠 / 暗杠 / 加杠。 */
export type MeldKind = 'chi' | 'pon' | 'minkan' | 'ankan' | 'kakan';

/** 一组副露（已鸣露的面子·杠含 4 枚）。 */
export interface Meld {
  /** 类型（决定暗手消耗 / 朝向 / 可抢杠等·见各切片）。 */
  kind: MeldKind;
  /** 组成牌码（chi/pon = 3 枚·kan = 4 枚·含赤5·升序·调用方保证）。 */
  tiles: number[];
  /** 供牌者 seat（ankan = 自己·kakan = 原碰的供牌者）。 */
  from: number;
  /** 被鸣的那张牌码（摆放 / 朝向·加杠 = 补的第 4 张）。 */
  called: number;
}

/** 是否杠子（大明杠 / 暗杠 / 加杠·4 枚一组·役 / 符 / 岭上摸的判据）。 */
export function isKan(m: Meld): boolean {
  return m.kind === 'minkan' || m.kind === 'ankan' || m.kind === 'kakan';
}

/**
 * 形成该副露时从暗手（含刚摸进的那张）取走几张：
 *   · 吃 / 碰：暗手 2 张 + 他家弃牌 1 → **2**；
 *   · 大明杠：暗手 3 张 + 他家弃牌 1 → **3**；
 *   · 暗杠：暗手（含刚摸）4 张 → **4**；
 *   · 加杠：已碰的 3 张已在副露·仅从暗手补第 4 张 → **1**。
 * （手数不变式 / 岭上补摸由流程层 game-state 维护·本函数只报暗手消耗张数。）
 */
export function meldConsumesFromHand(m: Meld): number {
  switch (m.kind) {
    case 'chi':
    case 'pon':
      return 2;
    case 'minkan':
      return 3;
    case 'ankan':
      return 4;
    case 'kakan':
      return 1;
    default: {
      // 穷尽性守卫：新增 MeldKind 未接线 → 此处编译期报错（正确性地基防漏）。
      const _exhaustive: never = m.kind;
      return _exhaustive;
    }
  }
}
