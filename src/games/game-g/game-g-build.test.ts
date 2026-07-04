// game-g-build 天罡聚合迁移守护（REQ-G-修正栈迁移·owner 2026-07-04·程序A）。
// tengangFxOf 内芯已从本地自写累加循环迁到引擎能力 t2-modifier-stack 的 aggregateModifiers。
// 独立 oracle = 旧 TENGANG_OPS handler 逐字段语义；跨全 35 天罡单卡 + 全两两对 + 全集，断言新路径逐字段一致
// → 证战斗持续修正零漂移（turnHash 稳）。全值为整数（唯一非整 winFloor=v/100 只 1 张卡·无求和序问题）。
import { describe, it, expect } from 'vitest';
import { tengangFxOf, aggregateTengang } from './game-g-build.js';
import { GAME_G_TIANGANGS, TIANGANG_BY_ID } from './index.js';
import { NO_TENGANG, type TengangFx } from './combat-types.js';

type TgCard = { id: string; kind: string; params?: Record<string, unknown> };

// oracle：迁移前 TENGANG_OPS handler 逐字段累加语义（power:mul 仍查 scope==='highestRank'·擎天 filter:'highest' 故为 no-op·空头卡·留 REQ 片3 修）。
function oldTengangFxOf(cards: Iterable<TgCard>): TengangFx {
  const fx = { ...NO_TENGANG } as unknown as Record<string, number>;
  for (const j of cards) {
    const p = j.params; if (!p) continue;
    const v = typeof p.value === 'number' ? p.value : 0;
    const bonus = typeof p.bonus === 'number' ? p.bonus : 0;
    switch (`${j.kind}:${String(p.op)}`) {
      case 'odds:add': fx.pEffAdd += v; break;
      case 'odds:winFloor': fx.winFloor += v / 100; break;
      case 'odds:kHard': fx.kHard += v; break;
      case 'odds:noUpset': fx.noUpset += 1; break;
      case 'power:mul': if (p.filter === 'highest' || p.scope === 'highestRank') fx.powerMulHighest = Math.max(fx.powerMulHighest, v); break; // 空头卡修（片3）：擎天 filter:'highest' 现生效
      case 'power:add':
        if (p.filter === 'countLE3') fx.powerLE3 += v;
        else if (p.filter === 'sameSuit') fx.powerSameSuit += v;
        else if (p.filter === 'front' || p.scope === 'front') fx.powerFront += v; // 空头卡修（§四.4）：锋矢 filter:'front' 现只前锋
        else fx.powerAll += v; break;
      case 'combo:pair': fx.comboPair += bonus; break;
      case 'combo:trips': fx.comboTrips += bonus; break;
      case 'morale:leaderBuff': fx.moraleLeader += v; break;
      case 'morale:revenge': fx.revenge += v; break;
      case 'morale:noRout': fx.noRout = 1; break;
      case 'stamina:stamPlus': if (p.filter === 'faces') fx.stamFaces += v; else fx.stamPlus += v; break;
      case 'stamina:relay': fx.relay += v; break;
      case 'draw:handMax': fx.handMaxAdd += v; break;
      case 'draw:onPlay': fx.onPlay += v; break;
      case 'draw:clashElixir': fx.clashElixir += v; break;
      case 'siege:defend': fx.siegeDefend += v; break;
      case 'siege:chipMore': fx.siegeChip += v; break;
    }
  }
  return fx as unknown as TengangFx;
}

describe('Game G · 天罡聚合迁移守护（tengangFxOf 走 aggregateModifiers · REQ-G-修正栈迁移）', () => {
  const ALL = GAME_G_TIANGANGS as unknown as TgCard[];

  it('全 35 天罡单卡：tengangFxOf(新) === oldTengangFxOf(oracle) 逐字段', () => {
    for (const c of ALL) expect(tengangFxOf([c]), `card=${c.id}`).toEqual(oldTengangFxOf([c]));
  });

  it('全两两对 + 全集：新 === oracle 逐字段（累加/取大语义一致）', () => {
    for (let i = 0; i < ALL.length; i++) for (let j = i + 1; j < ALL.length; j++) {
      const pair = [ALL[i], ALL[j]];
      expect(tengangFxOf(pair), `pair=${ALL[i].id},${ALL[j].id}`).toEqual(oldTengangFxOf(pair));
    }
    expect(tengangFxOf(ALL)).toEqual(oldTengangFxOf(ALL));
    expect(tengangFxOf([])).toEqual(NO_TENGANG);
  });

  it('空头卡修·擎天 atlas：filter:"highest" 现生效 → powerMulHighest=1.5（曾 no-op·REQ-G 片3）', () => {
    const atlas = TIANGANG_BY_ID.get('atlas')! as unknown as TgCard;
    expect(atlas.params).toMatchObject({ op: 'mul', value: 1.5, filter: 'highest' });
    expect(tengangFxOf([atlas]).powerMulHighest).toBe(1.5); // 修前=0（空头）·修后=1.5
  });

  it('空头卡修·锋矢 arrowhead：filter:"front" → powerFront（曾误落全军 powerAll·§四.4）', () => {
    const arrow = TIANGANG_BY_ID.get('arrowhead')! as unknown as TgCard;
    expect(arrow.params).toMatchObject({ op: 'add', value: 4, filter: 'front' });
    const fx = tengangFxOf([arrow]);
    expect(fx.powerFront).toBe(4); // 只前锋 +4
    expect(fx.powerAll).toBe(0);   // 修前=4(全军)·修后=0
  });

  it('aggregateTengang(ids) === tengangFxOf(查表卡)（id→卡→行 链路一致）', () => {
    const ids = ALL.map((c) => c.id);
    const someCombos = [[], [ids[0]], ids.slice(0, 5), ids];
    for (const c of someCombos) {
      const cards = c.map((id) => TIANGANG_BY_ID.get(id)!).filter(Boolean) as unknown as TgCard[];
      expect(aggregateTengang(c)).toEqual(tengangFxOf(cards));
    }
  });
});
