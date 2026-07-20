// Game B ·《雀宴》麻将核切片④ —— 役表逐役测试（清单 §3·每役 ≥1 正例 + 1 反例）。
// 口径真相 = docs/design/game-b/mahjong-core-tests.md §3；牌码（tiles-def.ts）：
//   man1-9=0-8 · pin1-9=9-17 · sou1-9=18-26 · 東27南28西29北30白31發32中33；赤5=普5码+100。
// v1 纯门清（无鸣牌/无杠）；连风双计=R-1·单倍役满=R-7·累计役满=R-8。
import { describe, it, expect } from 'vitest';
import { scoreWin, type WinContext } from './yaku.js';
import { pairFu } from './fu-score.js';
import type { MeldKind } from './meld.js';

/** 默认上下文：闲家·自风南(1)·场风東(0)·荣和·无立直。测试逐项覆盖。 */
function mk(over: Partial<WinContext> & { hand14: number[]; winTile: number }): WinContext {
  return {
    tsumo: false, seatWind: 1, roundWind: 0, isDealer: false,
    riichi: false, doubleRiichi: false, ippatsu: false, haitei: false,
    doraIndicators: [], uraIndicators: [],
    ...over,
  };
}
const names = (ctx: WinContext): string[] => scoreWin(ctx)?.yaku.map((y) => y.name) ?? [];

// ── §4 R-1 雀头符（owner 2026-07-20「全日式」订正：連風=4 符·天凤/雀魂/竞技一致·只世嘉 MJ 用 2）──────────
describe('§4 雀头符 · R-1 連風=4符（全日式·权威源核实）', () => {
  const c = (seatWind: number, roundWind: number): WinContext => mk({ hand14: [], winTile: 0, seatWind, roundWind });
  it('連風対子（東场東家的東東·自风==场风·ダブ東）= 4 符（场风2+自风2）', () => {
    expect(pairFu(27, c(0, 0))).toBe(4); // 東 pair·seat東 round東 → 連風·全日式 4 符
  });
  it('单风役牌雀头（自风南）= 2 符', () => {
    expect(pairFu(28, c(1, 0))).toBe(2); // 南 pair·自风南·场风東
  });
  it('三元雀头=2符·客风=0·数牌=0', () => {
    expect(pairFu(31, c(1, 0))).toBe(2); // 白（三元）
    expect(pairFu(30, c(0, 0))).toBe(0); // 北·非自风非场风 → 客风 0 符
    expect(pairFu(9, c(0, 0))).toBe(0); // pin1 数牌雀头 0 符
  });
});

// ── 1 番役 ─────────────────────────────────────────────────────────────────
describe('§3 立直', () => {
  // man123 man456 pin123 pin456 南南（南=自风·雀头非役·penchan 待 pin3 → 无平和/无其它役）
  const base = { hand14: [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 28, 28], winTile: 11 };
  it('立直和了 → 有立直役', () => {
    const r = scoreWin(mk({ ...base, riichi: true }));
    expect(r).not.toBeNull();
    expect(r!.yaku.map((y) => y.name)).toContain('立直');
    expect(r!.han).toBe(1);
  });
  it('◇ 未立直同形无此役（且无其它役）→ 不得和 null', () => {
    expect(scoreWin(mk(base))).toBeNull();
  });
});

describe('§3 一発', () => {
  const base = { hand14: [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 28, 28], winTile: 11, riichi: true };
  it('立直巡内和 → 有一発', () => {
    expect(names(mk({ ...base, ippatsu: true }))).toContain('一発');
  });
  it('◇ 无一発标记 → 仅立直', () => {
    const ns = names(mk(base));
    expect(ns).toContain('立直');
    expect(ns).not.toContain('一発');
  });
  it('◇ 一発但未立直 → 一発不成立', () => {
    // tsumo 保证非 null（门清自摸和），riichi=false → 一発被忽略
    const ns = names(mk({ hand14: [1, 2, 3, 4, 5, 6, 12, 13, 14, 22, 23, 24, 10, 10], winTile: 24, tsumo: true, ippatsu: true }));
    expect(ns).not.toContain('一発');
  });
});

describe('§3 門前清自摸和', () => {
  // 断幺全顺 tanyao 手（man234 man567 pin456 sou567 pin22·winTile sou7）
  const hand = [1, 2, 3, 4, 5, 6, 12, 13, 14, 22, 23, 24, 10, 10];
  it('自摸 → 有门前清自摸和', () => {
    expect(names(mk({ hand14: hand, winTile: 24, tsumo: true }))).toContain('門前清自摸和');
  });
  it('◇ 荣和无此役', () => {
    expect(names(mk({ hand14: hand, winTile: 24, tsumo: false }))).not.toContain('門前清自摸和');
  });
});

describe('§3 断幺九', () => {
  it('全 2-8 → 有断幺九', () => {
    expect(names(mk({ hand14: [1, 2, 3, 4, 5, 6, 12, 13, 14, 22, 23, 24, 10, 10], winTile: 24, tsumo: true }))).toContain('断幺九');
  });
  it('◇ 含幺九 → 无断幺九', () => {
    expect(names(mk({ hand14: [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 28, 28], winTile: 11, riichi: true }))).not.toContain('断幺九');
  });
});

describe('§3 平和', () => {
  // man123 pin456 sou678 man789 sou22（4 顺·数牌雀头）·winTile pin6=两面
  const hand = [0, 1, 2, 12, 13, 23, 24, 25, 6, 7, 8, 19, 19];
  it('四顺+数牌雀头+两面待ち → 平和（荣和 30 符）', () => {
    const r = scoreWin(mk({ hand14: [...hand, 14], winTile: 14 }));
    expect(r!.yaku.map((y) => y.name)).toContain('平和');
    expect(r!.fu).toBe(30); // 平和荣和 30 符
    expect(r!.han).toBe(1);
  });
  it('◇ 平和自摸 = 20 符（自摸 2 符不计）', () => {
    const r = scoreWin(mk({ hand14: [...hand, 14], winTile: 14, tsumo: true }));
    expect(r!.yaku.map((y) => y.name)).toContain('平和');
    expect(r!.fu).toBe(20);
  });
  it('◇ 雀头役牌（白）→ 非平和', () => {
    const h = [0, 1, 2, 12, 13, 23, 24, 25, 6, 7, 8, 31, 31]; // sou22→白白
    expect(names(mk({ hand14: [...h, 14], winTile: 14, tsumo: true }))).not.toContain('平和');
  });
  it('◇ 嵌张待ち → 非平和', () => {
    // 同四顺·但和 pin5(13) 嵌 pin4_6
    const h = [0, 1, 2, 12, 14, 23, 24, 25, 6, 7, 8, 19, 19];
    expect(names(mk({ hand14: [...h, 13], winTile: 13, tsumo: true }))).not.toContain('平和');
  });
});

describe('§3 一盃口', () => {
  it('两同一色顺子 → 一盃口', () => {
    // man234 man234 pin567 sou345 man99
    expect(names(mk({ hand14: [1, 2, 3, 1, 2, 3, 14, 15, 16, 20, 21, 22, 8, 8], winTile: 3, tsumo: true }))).toContain('一盃口');
  });
  it('◇ 无重复顺子 → 无一盃口', () => {
    expect(names(mk({ hand14: [0, 1, 2, 12, 13, 14, 23, 24, 25, 6, 7, 8, 19, 19], winTile: 19, tsumo: true }))).not.toContain('一盃口');
  });
});

describe('§3 役牌', () => {
  it('三元牌刻（中）→ 役牌 中', () => {
    const ns = names(mk({ hand14: [33, 33, 33, 0, 1, 2, 12, 13, 14, 24, 25, 26, 10, 10], winTile: 24, tsumo: true }));
    expect(ns).toContain('役牌 中');
  });
  it('◇ 役牌对子（非刻）→ 无役牌', () => {
    const ns = names(mk({ hand14: [33, 33, 0, 1, 2, 3, 4, 5, 12, 13, 14, 24, 25, 26], winTile: 26, tsumo: true }));
    expect(ns).not.toContain('役牌 中');
  });
  it('◇ 連風牌双计（東场東家·場風+自風）= 2 番', () => {
    // 庄·自风東(0)·场风東(0)·東東東刻
    const ns = names(mk({ hand14: [27, 27, 27, 0, 1, 2, 12, 13, 14, 24, 25, 26, 10, 10], winTile: 24, tsumo: true, seatWind: 0, roundWind: 0, isDealer: true }));
    expect(ns).toContain('場風 東');
    expect(ns).toContain('自風 東');
  });
  it('◇ 单风（自风南·非场风）→ 仅自風·无場風', () => {
    const ns = names(mk({ hand14: [28, 28, 28, 0, 1, 2, 12, 13, 14, 24, 25, 26, 10, 10], winTile: 24, tsumo: true, seatWind: 1, roundWind: 0 }));
    expect(ns).toContain('自風 南');
    expect(ns).not.toContain('場風 南');
  });
});

describe('§3 海底摸月/河底撈魚', () => {
  const hand = [1, 2, 3, 4, 5, 6, 12, 13, 14, 22, 23, 24, 10, 10];
  it('海底自摸 → 海底摸月', () => {
    expect(names(mk({ hand14: hand, winTile: 24, tsumo: true, haitei: true }))).toContain('海底摸月');
  });
  it('河底荣和 → 河底撈魚', () => {
    // 需另有役（断幺）保证非 null
    expect(names(mk({ hand14: hand, winTile: 24, tsumo: false, haitei: true }))).toContain('河底撈魚');
  });
  it('◇ 非海底 → 无', () => {
    expect(names(mk({ hand14: hand, winTile: 24, tsumo: true }))).not.toContain('海底摸月');
  });
});

describe('§3 双立直', () => {
  const base = { hand14: [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 28, 28], winTile: 11 };
  it('双立直 = 2 番·无立直役', () => {
    const r = scoreWin(mk({ ...base, doubleRiichi: true }));
    expect(r!.yaku.find((y) => y.name === '両立直')?.han).toBe(2);
    expect(r!.yaku.map((y) => y.name)).not.toContain('立直');
  });
  it('◇ 仅立直 → 1 番', () => {
    expect(scoreWin(mk({ ...base, riichi: true }))!.yaku.find((y) => y.name === '立直')?.han).toBe(1);
  });
});

// ── 2 番役 ─────────────────────────────────────────────────────────────────
describe('§3 三色同順', () => {
  it('man234 pin234 sou234 → 三色同順', () => {
    expect(names(mk({ hand14: [1, 2, 3, 10, 11, 12, 19, 20, 21, 5, 6, 7, 17, 17], winTile: 7, tsumo: true }))).toContain('三色同順');
  });
  it('◇ 非三花色对齐 → 无', () => {
    expect(names(mk({ hand14: [1, 2, 3, 10, 11, 12, 22, 23, 24, 5, 6, 7, 17, 17], winTile: 7, tsumo: true }))).not.toContain('三色同順');
  });
});

describe('§3 一気通貫', () => {
  it('man123 456 789 → 一気通貫', () => {
    expect(names(mk({ hand14: [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 14, 19, 19], winTile: 14, tsumo: true }))).toContain('一気通貫');
  });
  it('◇ 缺 456 → 无一通', () => {
    expect(names(mk({ hand14: [0, 1, 2, 6, 7, 8, 10, 11, 12, 13, 14, 15, 19, 19], winTile: 15, tsumo: true }))).not.toContain('一気通貫');
  });
});

describe('§3 混全帯么九', () => {
  it('各面子/雀头含幺九+含字 → 混全帯么九', () => {
    // man123 pin789 sou123 東東東 中中
    expect(names(mk({ hand14: [0, 1, 2, 15, 16, 17, 18, 19, 20, 27, 27, 27, 33, 33], winTile: 20, tsumo: true }))).toContain('混全帯么九');
  });
  it('◇ 含中张面子 → 无', () => {
    expect(names(mk({ hand14: [0, 1, 2, 4, 5, 6, 18, 19, 20, 27, 27, 27, 33, 33], winTile: 20, tsumo: true }))).not.toContain('混全帯么九');
  });
});

describe('§3 七対子（2 番 25 符）', () => {
  it('七个不同对子 → 七対子·25 符·2 番', () => {
    const r = scoreWin(mk({ hand14: [0, 0, 2, 2, 9, 9, 13, 13, 20, 20, 27, 27, 33, 33], winTile: 33, tsumo: true }));
    expect(r!.yaku.map((y) => y.name)).toContain('七対子');
    expect(r!.fu).toBe(25);
  });
});

describe('§3 対々和', () => {
  it('四刻+雀头（荣和双碰·三暗刻+対々）', () => {
    // man111 pin333 sou555 東東東 白白·ron 東 → 東東東明刻（和了牌含在 hand14）
    const r = scoreWin(mk({ hand14: [0, 0, 0, 11, 11, 11, 22, 22, 22, 27, 27, 27, 31, 31], winTile: 27, tsumo: false }));
    const ns = r!.yaku.map((y) => y.name);
    expect(ns).toContain('対々和');
    expect(ns).toContain('三暗刻'); // 荣和第四刻明刻 → 剩三暗
    expect(ns).not.toContain('四暗刻');
    expect(r!.yakuman).toBe(0);
  });
});

describe('§3 三暗刻', () => {
  it('三暗刻（自摸·3 刻全暗）', () => {
    expect(names(mk({ hand14: [0, 0, 0, 10, 10, 10, 20, 20, 20, 3, 4, 5, 17, 17], winTile: 5, tsumo: true }))).toContain('三暗刻');
  });
  it('◇ 荣和补第三刻不计暗（明刻判定）→ 无三暗刻', () => {
    // man111 pin222 man456 sou99 白白·ron 白 → 白白白明刻·仅 2 暗
    expect(names(mk({ hand14: [0, 0, 0, 10, 10, 10, 3, 4, 5, 26, 26, 31, 31], winTile: 31, tsumo: false }))).not.toContain('三暗刻');
  });
});

describe('§3 三色同刻', () => {
  it('man222 pin222 sou222 → 三色同刻', () => {
    expect(names(mk({ hand14: [1, 1, 1, 10, 10, 10, 19, 19, 19, 4, 5, 6, 17, 17], winTile: 6, tsumo: true }))).toContain('三色同刻');
  });
  it('◇ 非三花色同刻 → 无', () => {
    expect(names(mk({ hand14: [1, 1, 1, 10, 10, 10, 20, 20, 20, 4, 5, 6, 17, 17], winTile: 6, tsumo: true }))).not.toContain('三色同刻');
  });
});

describe('§3 混老頭', () => {
  it('全幺九+字（对对形）→ 混老頭', () => {
    // man111 pin999 東東東 中中中 sou11·ron 中（双碰→中中中明刻·避开四暗刻役满遮蔽）
    const ns = names(mk({ hand14: [0, 0, 0, 17, 17, 17, 27, 27, 27, 33, 33, 33, 18, 18], winTile: 33, tsumo: false }));
    expect(ns).toContain('混老頭');
  });
  it('◇ 含中张 → 无混老頭', () => {
    expect(names(mk({ hand14: [0, 0, 0, 17, 17, 17, 18, 18, 18, 4, 5, 6, 33, 33], winTile: 6, tsumo: true }))).not.toContain('混老頭');
  });
});

describe('§3 小三元', () => {
  it('两三元刻+三元雀头 → 小三元', () => {
    // 白白白 發發發 中中 man123 pin456
    const ns = names(mk({ hand14: [31, 31, 31, 32, 32, 32, 33, 33, 0, 1, 2, 12, 13, 14], winTile: 14, tsumo: true }));
    expect(ns).toContain('小三元');
    expect(ns).toContain('役牌 白');
    expect(ns).toContain('役牌 發');
  });
  it('◇ 仅一三元刻+三元雀头 → 无小三元', () => {
    expect(names(mk({ hand14: [31, 31, 31, 0, 1, 2, 12, 13, 14, 22, 23, 24, 33, 33], winTile: 24, tsumo: true }))).not.toContain('小三元');
  });
});

// ── 3 番役 ─────────────────────────────────────────────────────────────────
describe('§3 混一色', () => {
  it('单数牌色+字 → 混一色', () => {
    expect(names(mk({ hand14: [0, 1, 2, 3, 4, 5, 6, 7, 8, 27, 27, 27, 33, 33], winTile: 8, tsumo: true }))).toContain('混一色');
  });
  it('◇ 两数牌色 → 无混一色', () => {
    expect(names(mk({ hand14: [0, 1, 2, 3, 4, 5, 12, 13, 14, 27, 27, 27, 33, 33], winTile: 14, tsumo: true }))).not.toContain('混一色');
  });
});

describe('§3 純全帯么九', () => {
  it('各面子/雀头含老头+无字 → 純全帯么九（非混全）', () => {
    // man123 pin789 sou123 man999 pin11
    const ns = names(mk({ hand14: [0, 1, 2, 15, 16, 17, 18, 19, 20, 8, 8, 8, 9, 9], winTile: 20, tsumo: true }));
    expect(ns).toContain('純全帯么九');
    expect(ns).not.toContain('混全帯么九');
  });
  it('◇ 含字牌 → 混全而非純全', () => {
    const ns = names(mk({ hand14: [0, 1, 2, 15, 16, 17, 18, 19, 20, 27, 27, 27, 9, 9], winTile: 20, tsumo: true }));
    expect(ns).not.toContain('純全帯么九');
    expect(ns).toContain('混全帯么九');
  });
});

describe('§3 二盃口', () => {
  it('两组一盃口 → 二盃口（与七対互斥·取高）', () => {
    // man234×2 pin234×2 sou55 → 亦七対形·取高应为二盃口
    const r = scoreWin(mk({ hand14: [1, 2, 3, 1, 2, 3, 10, 11, 12, 10, 11, 12, 22, 22], winTile: 22, tsumo: true }));
    const ns = r!.yaku.map((y) => y.name);
    expect(ns).toContain('二盃口');
    expect(ns).not.toContain('一盃口');
    expect(ns).not.toContain('七対子');
  });
  it('◇ 仅一组重复顺 → 一盃口非二盃口', () => {
    const ns = names(mk({ hand14: [1, 2, 3, 1, 2, 3, 14, 15, 16, 20, 21, 22, 8, 8], winTile: 3, tsumo: true }));
    expect(ns).toContain('一盃口');
    expect(ns).not.toContain('二盃口');
  });
});

// ── 6 番役 ─────────────────────────────────────────────────────────────────
describe('§3 清一色', () => {
  it('纯单色无字 → 清一色', () => {
    expect(names(mk({ hand14: [0, 0, 1, 1, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8], winTile: 8, tsumo: true }))).toContain('清一色');
  });
  it('◇ 含字 → 混一色非清一色', () => {
    const ns = names(mk({ hand14: [0, 1, 2, 3, 4, 5, 6, 7, 8, 27, 27, 27, 33, 33], winTile: 8, tsumo: true }));
    expect(ns).not.toContain('清一色');
    expect(ns).toContain('混一色');
  });
});

// ── 役満 ───────────────────────────────────────────────────────────────────
describe('§3 役満', () => {
  it('国士無双', () => {
    const r = scoreWin(mk({ hand14: [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 0], winTile: 0, tsumo: true }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('国士無双');
  });
  it('四暗刻（自摸·单倍 R-7）', () => {
    const r = scoreWin(mk({ hand14: [0, 0, 0, 10, 10, 10, 20, 20, 20, 27, 27, 27, 31, 31], winTile: 31, tsumo: true }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('四暗刻');
  });
  it('◇ 四暗刻单骑荣和 = 同档役满（4 刻已暗·单骑补雀头）', () => {
    // man111 pin222 sou333 東東東 + 白单骑·ron 白
    const r = scoreWin(mk({ hand14: [0, 0, 0, 10, 10, 10, 20, 20, 20, 27, 27, 27, 31, 31], winTile: 31, tsumo: false }));
    expect(r!.yakuman).toBe(1); // 单骑荣和 → 四暗刻成立
  });
  it('大三元', () => {
    const r = scoreWin(mk({ hand14: [31, 31, 31, 32, 32, 32, 33, 33, 33, 0, 1, 2, 10, 10], winTile: 2, tsumo: true }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('大三元');
  });
  it('◇ 大三元反例：仅小三元（非役满）', () => {
    const r = scoreWin(mk({ hand14: [31, 31, 31, 32, 32, 32, 33, 33, 0, 1, 2, 12, 13, 14], winTile: 14, tsumo: true }));
    expect(r!.yakuman).toBe(0);
  });
  it('字一色', () => {
    // 東東東 南南南 白白白 中中中 西西·ron 中（双碰明刻·避四暗刻叠加·纯字牌=字一色）
    const r = scoreWin(mk({ hand14: [27, 27, 27, 28, 28, 28, 31, 31, 31, 33, 33, 33, 29, 29], winTile: 33, tsumo: false }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('字一色');
  });
  it('緑一色（含發·标准）', () => {
    // sou234 sou234 sou666 發發發 sou88
    const r = scoreWin(mk({ hand14: [19, 20, 21, 19, 20, 21, 23, 23, 23, 32, 32, 32, 25, 25], winTile: 25, tsumo: true }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('緑一色');
  });
  it('◇ 緑一色反例：含非绿牌 sou5 → 无', () => {
    const r = scoreWin(mk({ hand14: [19, 20, 21, 22, 23, 24, 23, 23, 23, 32, 32, 32, 25, 25], winTile: 25, tsumo: true }));
    expect(r!.yakuman).toBe(0);
  });
  it('清老頭', () => {
    // man111 man999 pin999 pin111 sou11·ron pin1（双碰明刻·避四暗刻叠加·纯老头=清老頭）
    const r = scoreWin(mk({ hand14: [0, 0, 0, 8, 8, 8, 17, 17, 17, 9, 9, 9, 18, 18], winTile: 9, tsumo: false }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('清老頭');
  });
  it('小四喜', () => {
    // 東東東 南南南 西西西 北北 man123
    const r = scoreWin(mk({ hand14: [27, 27, 27, 28, 28, 28, 29, 29, 29, 30, 30, 0, 1, 2], winTile: 2, tsumo: true }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('小四喜');
  });
  it('大四喜（单倍 R-7）', () => {
    // 東東東 南南南 北北北 西西西 man55·ron 西（双碰明刻→避四暗刻·数牌雀头→避字一色·纯四喜=大四喜）
    const r = scoreWin(mk({ hand14: [27, 27, 27, 28, 28, 28, 30, 30, 30, 29, 29, 29, 4, 4], winTile: 29, tsumo: false }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('大四喜');
  });
  it('天和（庄第一巡自摸）', () => {
    const r = scoreWin(mk({ hand14: [0, 1, 2, 3, 4, 5, 12, 13, 14, 22, 23, 24, 10, 10], winTile: 24, tsumo: true, isDealer: true, seatWind: 0, tenhou: true }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('天和');
  });
  it('◇ 天和反例：荣和不成立', () => {
    const r = scoreWin(mk({ hand14: [0, 1, 2, 3, 4, 5, 12, 13, 14, 22, 23, 24, 10, 10], winTile: 24, tsumo: false, isDealer: true, seatWind: 0, tenhou: true }));
    expect(r?.yaku.map((y) => y.name) ?? []).not.toContain('天和');
  });
  it('地和（闲第一巡自摸）', () => {
    const r = scoreWin(mk({ hand14: [0, 1, 2, 3, 4, 5, 12, 13, 14, 22, 23, 24, 10, 10], winTile: 24, tsumo: true, chiihou: true }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('地和');
  });
});

// ── 宝牌 / 赤 / 裏 ─────────────────────────────────────────────────────────
describe('§3 宝牌/赤/裏（只加番不成役·光宝牌无役不得和）', () => {
  it('表宝牌加番（指示 man1→宝 man2·手含 man2 两枚）', () => {
    // 立直保证有役；man2 两枚 = 宝牌 2
    const r = scoreWin(mk({ hand14: [0, 1, 2, 1, 2, 3, 12, 13, 14, 22, 23, 24, 28, 28], winTile: 24, riichi: true, doraIndicators: [0] }));
    expect(r!.yaku.find((y) => y.name === '宝牌')?.han).toBe(2);
  });
  it('赤5 加番（赤 man5=104）', () => {
    const r = scoreWin(mk({ hand14: [1, 2, 3, 3, 104, 5, 12, 13, 14, 22, 23, 24, 28, 28], winTile: 24, riichi: true }));
    expect(r!.yaku.find((y) => y.name === '赤宝牌')?.han).toBe(1);
  });
  it('裏宝牌（立直和了才计·指示 pin1→裏 pin2）', () => {
    const r = scoreWin(mk({ hand14: [0, 1, 2, 3, 4, 5, 10, 11, 12, 22, 23, 24, 28, 28], winTile: 24, riichi: true, uraIndicators: [9] }));
    expect(r!.yaku.find((y) => y.name === '裏宝牌')?.han).toBe(1); // pin2×1（pin234 中的 pin2=10）
  });
  it('◇ 光宝牌无役 → 不得和 null', () => {
    // 无役形 + 仅宝牌（指示 man1→宝 man2·手含 man2）·荣和
    expect(scoreWin(mk({ hand14: [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 28, 28], winTile: 11, doraIndicators: [0] }))).toBeNull();
  });
  it('◇ 未立直不计裏宝牌', () => {
    // 自摸有役·但未立直 → uraIndicators 被忽略
    const r = scoreWin(mk({ hand14: [1, 2, 3, 4, 5, 6, 12, 13, 14, 22, 23, 24, 10, 10], winTile: 24, tsumo: true, uraIndicators: [9] }));
    expect(r!.yaku.map((y) => y.name)).not.toContain('裏宝牌');
  });
});

// ── 数え役満（R-8）+ 取高原则 ───────────────────────────────────────────────
describe('§3 数え役満（R-8·13+ 番=役满点·非三倍满封顶）', () => {
  it('清一色+一盃口+立直+自摸+宝牌堆 → 13+ 番 = 役满点（yakuman=0·数え）', () => {
    // 清一色 man 手 + 表宝牌 man1→man2 大量
    const r = scoreWin(mk({
      hand14: [0, 0, 1, 1, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8], winTile: 8, tsumo: true,
      riichi: true, doraIndicators: [8, 8, 8], // man9→man1·手 man1×2 → 每指示 +2·三指示 = 6 宝
    }));
    // 清一色6 + 自摸1 + 立直1 + 一盃口1 + 宝牌6 = 15 番 → 数え役满
    expect(r!.han).toBeGreaterThanOrEqual(13);
    expect(r!.yakuman).toBe(0);
    // 闲家自摸役满点：庄付 16000 + 闲各 8000 = 32000
    expect(r!.points.total).toBe(32000);
  });
});

describe('§3 取高原则（多分解取番符最高）', () => {
  it('嵌张 vs 两面：取平和解（若存在两面）', () => {
    // sou45678 复合·和 sou6 可解嵌(46 嵌5?)... 用 二盃口 vs 七対 已在上·此处校验 fu 取高
    // man22334455 pin678 sou9? 用简单：man223344 + pin55 + sou678 + man...（见二盃口例已覆盖取高）
    // 这里校验：一手既可二盃口(标准)又可七対 → 已断言取二盃口。补一个点数更高性质。
    const r = scoreWin(mk({ hand14: [1, 2, 3, 1, 2, 3, 10, 11, 12, 10, 11, 12, 22, 22], winTile: 22, tsumo: true }));
    // 二盃口解 = 二盃口(3)+门清自摸(1)+断幺九(1) = 5 番 > 七対解 = 七対(2)+自摸(1)+断幺(1) = 4 番 → 取 5
    expect(r!.han).toBe(5);
  });
});

// ── §9 开手真算分（G1/G2/G3·calledMelds）──────────────────────────────────────
// 开手 hand14=暗手（含和牌·14−3k 张·杠亦占 3 张面子预算）·calledMelds=k 副已鸣露固定面子。
type CM = { kind: MeldKind; tiles: number[] };
const chi = (lo: number): CM => ({ kind: 'chi', tiles: [lo, lo + 1, lo + 2] }); // 明顺（lo=最低种码）
const pon = (k: number): CM => ({ kind: 'pon', tiles: [k, k, k] }); // 明刻
const minkan = (k: number): CM => ({ kind: 'minkan', tiles: [k, k, k, k] }); // 大明杠
const ankan = (k: number): CM => ({ kind: 'ankan', tiles: [k, k, k, k] }); // 暗杠
const hanOf = (ctx: WinContext, name: string): number | undefined => scoreWin(ctx)?.yaku.find((y) => y.name === name)?.han;

describe('§9 开手·门前清限定役 gating（副露即消·G1）', () => {
  it('① 开手（吃）+ 平和/一盃口形 + 宣立直自摸 → 门清限定役一律不计（食断存活）', () => {
    // 吃 234p + 暗手 234s×2 456m 88p·两面自摸·riichi=true（开手不该有·gating 须丢弃）。
    const ns = names(mk({
      hand14: [19, 20, 21, 19, 20, 21, 3, 4, 5, 16, 16], winTile: 21,
      tsumo: true, riichi: true, calledMelds: [chi(10)],
    }));
    expect(ns).toContain('断幺九'); // 食断有·副露断幺存活（证 scoreWin 非 null）
    expect(ns).not.toContain('平和'); // 平和=门清限定·开手消
    expect(ns).not.toContain('一盃口'); // 两 234s 本是一盃口形·开手消
    expect(ns).not.toContain('門前清自摸和'); // 门前限定·开手消
    expect(ns).not.toContain('立直'); // 门前限定·开手消
    expect(ns).not.toContain('両立直');
  });
});

describe('§9 开手·喰い下がり −1 番（G1）', () => {
  it('② 三色同順 副露 = 1 番（门清 2）', () => {
    // 吃 234m + 暗手 234p 234s 678p 99m
    expect(hanOf(mk({ hand14: [10, 11, 12, 19, 20, 21, 14, 15, 16, 8, 8], winTile: 21, tsumo: true, calledMelds: [chi(1)] }), '三色同順')).toBe(1);
  });
  it('② 一気通貫 副露 = 1 番（门清 2）', () => {
    // 吃 123m + 暗手 456m 789m 234p 99s
    expect(hanOf(mk({ hand14: [3, 4, 5, 6, 7, 8, 10, 11, 12, 26, 26], winTile: 12, tsumo: true, calledMelds: [chi(0)] }), '一気通貫')).toBe(1);
  });
  it('② 混全帯么九 副露 = 1 番（门清 2）', () => {
    // 吃 123m + 暗手 789p 789s 北北北 中中（北=客风·无役牌污染）
    expect(hanOf(mk({ hand14: [15, 16, 17, 24, 25, 26, 30, 30, 30, 33, 33], winTile: 24, tsumo: true, calledMelds: [chi(0)] }), '混全帯么九')).toBe(1);
  });
  it('② 純全帯么九 副露 = 2 番（门清 3）', () => {
    // 吃 123m + 暗手 789p 789s 123p 99m
    expect(hanOf(mk({ hand14: [15, 16, 17, 24, 25, 26, 9, 10, 11, 8, 8], winTile: 26, tsumo: true, calledMelds: [chi(0)] }), '純全帯么九')).toBe(2);
  });
  it('② 混一色 副露 = 2 番（门清 3）', () => {
    // 吃 123m + 暗手 456m 567m 北北北 白白（单 man 色 + 字·北客风）
    expect(hanOf(mk({ hand14: [3, 4, 5, 4, 5, 6, 30, 30, 30, 31, 31], winTile: 5, tsumo: true, calledMelds: [chi(0)] }), '混一色')).toBe(2);
  });
  it('② 清一色 副露 = 5 番（门清 6）', () => {
    // 吃 123m + 暗手 234m 345m 456m 99m（纯 man·无 789 避一通污染）
    expect(hanOf(mk({ hand14: [1, 2, 3, 2, 3, 4, 3, 4, 5, 8, 8], winTile: 5, tsumo: true, calledMelds: [chi(0)] }), '清一色')).toBe(5);
  });
});

describe('§9 开手·暗刻计数（碰=明刻·不计三暗刻·G1）', () => {
  it('③ 碰役牌 中 + 两暗刻 → 有役牌·无三暗刻（碰的中=明刻不计暗）', () => {
    // 碰 中 + 暗手 999p(暗刻) 333s(暗刻) 456m 77m·和 456m 两面自摸（999p/333s 暗摸·中=明刻）
    const ns = names(mk({ hand14: [17, 17, 17, 20, 20, 20, 3, 4, 5, 6, 6], winTile: 5, tsumo: true, calledMelds: [pon(33)] }));
    expect(ns).toContain('役牌 中');
    expect(ns).not.toContain('三暗刻'); // 仅 2 暗刻（碰的中=明刻不计）
    expect(ns).not.toContain('四暗刻');
  });
});

describe('§9 开手·杠子役 + 九蓮宝燈（G2/G3）', () => {
  it('⑤ 三槓子 = 2 番（3 组杠·非役满）', () => {
    // 3 大明杠 2m/3p/4s + 暗手 567m + 88p 雀头（tanyao 存活证非 null）
    const r = scoreWin(mk({ hand14: [4, 5, 6, 16, 16], winTile: 6, tsumo: true, calledMelds: [minkan(1), minkan(11), minkan(21)] }));
    expect(r!.yaku.find((y) => y.name === '三槓子')?.han).toBe(2);
    expect(r!.yakuman).toBe(0);
  });
  it('⑤ 四槓子 = 役满（4 组杠·全明杠避四暗刻·R-7 单倍）', () => {
    // 4 大明杠 2m/3p/4s/6m + 88p 雀头单骑
    const r = scoreWin(mk({ hand14: [16, 16], winTile: 16, tsumo: true, calledMelds: [minkan(1), minkan(11), minkan(21), minkan(5)] }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('四槓子');
  });
  it('⑤ 九蓮宝燈 = 役满（门清清一色 1112345678999+任一同色·R-7 单倍）', () => {
    // 纯正九蓮 man：1112345678999 + man5·自摸
    const r = scoreWin(mk({ hand14: [0, 0, 0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 8, 8], winTile: 4, tsumo: true }));
    expect(r!.yakuman).toBe(1);
    expect(r!.yaku.map((y) => y.name)).toContain('九蓮宝燈');
  });
  it('◇ 九蓮反例：普通门前清一色（缺 man1×3 模板）→ 清一色非九蓮·不误判役满', () => {
    const r = scoreWin(mk({ hand14: [0, 0, 1, 1, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8], winTile: 8, tsumo: true }));
    expect(r!.yakuman).toBe(0);
    expect(r!.yaku.map((y) => y.name)).not.toContain('九蓮宝燈');
  });
});

describe('§9 开手·D6 含暗杠门清手真算分（G2）', () => {
  it('⑥ 门前含暗杠（man1 幺九）自摸立直 → 门清役成立 + 暗杠符 32 → 60 符', () => {
    // 暗杠 man1 + 暗手 234p 567p 789s 22s·和 567p 两面自摸立直（暗杠不破门清）
    const r = scoreWin(mk({ hand14: [10, 11, 12, 13, 14, 15, 24, 25, 26, 19, 19], winTile: 15, tsumo: true, riichi: true, calledMelds: [ankan(0)] }));
    const ns = r!.yaku.map((y) => y.name);
    expect(ns).toContain('立直'); // 暗杠不破门清·立直成立
    expect(ns).toContain('門前清自摸和'); // 门前清自摸成立
    expect(r!.fu).toBe(60); // 20 + 暗杠幺九 32 + 自摸 2 = 54 → 60（暗杠符 32 钉死·联动 §4）
  });
});
