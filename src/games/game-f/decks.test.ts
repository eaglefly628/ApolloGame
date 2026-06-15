import { describe, it, expect } from 'vitest';
import { buildGameFBlueprint } from './blueprint.js';
import { HUBAO_DECK, HANSHI_DECK, TUNTIAN_DECK, WOLONG_DECK, DECK_REGISTRY, buildDeckRules, applyShopBias, CARD_CATALOG, assembleDeck, type Deck } from './decks.js';
import { FACT_WEI, FACT_SHU, BENCH_OCC } from './constants.js';
import { SHOP_DECK } from './economy.js';

describe('T2 牌组加载器 · buildDeckRules', () => {
  it('synergy-buff → group-count + 资源 + 开战 edge 锁存写 dmg_scale_a（线性 valueFrom）', () => {
    const { entities } = buildDeckRules(HUBAO_DECK);
    // 虎豹骑令：数在板魏势力 → deck_count_hubao_edict。
    const gc = entities['gc_hubao_edict'] as unknown as { GroupCount: { countResource: string; requiredTag: number; onBoard: boolean } };
    expect(gc.GroupCount.requiredTag).toBe(BENCH_OCC | FACT_WEI);
    expect(gc.GroupCount.countResource).toBe('deck_count_hubao_edict');
    expect(gc.GroupCount.onBoard).toBe(true);
    const eff = entities['eff_hubao_edict'] as unknown as { Effect: { targetId: string; op: string; valueFrom: { resourceId: string; coeff: number } } };
    expect(eff.Effect.targetId).toBe('dmg_scale_a'); // 全队伤害系数（hitbox scaleByResource 读它）
    expect(eff.Effect.op).toBe('add');
    expect(eff.Effect.valueFrom).toEqual({ resourceId: 'deck_count_hubao_edict', coeff: 0.06 });
    const when = entities['when_hubao_edict'] as unknown as { EventWhen: { mode: string; when: { equals: string } } };
    expect(when.EventWhen.mode).toBe('edge'); // 开战拍锁存一次
  });

  it('round-buff → banded（开战 ∧ round_idx ≤ N）加伤害系数', () => {
    const { entities } = buildDeckRules(HUBAO_DECK);
    const when = entities['when_blitz'] as unknown as { EventWhen: { when: { kind: string; of: { kind: string }[] } } };
    expect(when.EventWhen.when.kind).toBe('and'); // 开战 ∧ round 条件
    const eff = entities['eff_blitz'] as unknown as { Effect: { targetId: string; value: number } };
    expect(eff.Effect.targetId).toBe('dmg_scale_a');
    expect(eff.Effect.value).toBe(0.15);
  });

  it('shop-weight → shopBias（不进 entities，进牌袋偏置）', () => {
    const { entities, shopBias } = buildDeckRules(HUBAO_DECK);
    expect(entities['eff_levy']).toBeUndefined();
    expect(shopBias).toEqual([{ codes: [1, 2, 3, 4, 5, 6], copies: 2 }]);
  });

  it('applyShopBias：只追加不重排（既有验收断言不动）', () => {
    const biased = applyShopBias(SHOP_DECK, [{ codes: [1, 2], copies: 2 }]);
    expect(biased.slice(0, SHOP_DECK.length)).toEqual(SHOP_DECK); // 前缀=原牌袋次序锁死
    expect(biased.slice(SHOP_DECK.length)).toEqual([1, 2, 1, 2]); // 追加 2 副 [1,2]
  });
});

describe('T2 集成 · buildGameFBlueprint({ deck })', () => {
  it('装牌组 → 规则实体进世界 + 商店牌袋被偏置；不装=零改动（默认路径不变）', () => {
    const withDeck = buildGameFBlueprint({ deck: HUBAO_DECK });
    expect(withDeck.entities['gc_hubao_edict']).toBeDefined();
    expect(withDeck.entities['eff_blitz']).toBeDefined();
    // 商店牌袋偏置生效（魏码各 +2 → deck 比基础长 12）。
    const pile = withDeck.entities['shop'] as unknown as { CardPile: { deck: number[] } };
    expect(pile.CardPile.deck.length).toBe(SHOP_DECK.length + 12);

    const noDeck = buildGameFBlueprint();
    expect(noDeck.entities['gc_hubao_edict']).toBeUndefined();
    const pile0 = noDeck.entities['shop'] as unknown as { CardPile: { deck: number[] } };
    expect(pile0.CardPile.deck.length).toBe(SHOP_DECK.length); // 默认牌袋不变
  });

  it('deck.faction 决定出生势力（玩家未显式指定时）→ 魏牌组=魏出生', () => {
    // 魏出生：玩家队伍=魏，开局播种的应是 b_ 前缀英雄 marker（rosterFor("wei") 翻转）。
    const bp = buildGameFBlueprint({ deck: HUBAO_DECK });
    const seatIds = Object.keys(bp.entities).filter((k) => k.startsWith('bootcast_'));
    expect(seatIds.length).toBeGreaterThan(0); // 有开局播种
  });
});

describe('牌组 #2 · 兴复汉室（蜀·连携 threshold-buff）', () => {
  it('threshold-buff → group-count + 每档 banded（开战 ∧ count≥at → dmg_scale_a += bonus）', () => {
    const { entities } = buildDeckRules(HANSHI_DECK);
    const gc = entities['gc_taoyuan'] as unknown as { GroupCount: { countResource: string; requiredTag: number; onBoard: boolean } };
    expect(gc.GroupCount.requiredTag).toBe(BENCH_OCC | FACT_SHU); // 数在板蜀势力
    // 两档：≥3 +0.20、≥5 +0.25。
    const eff0 = entities['eff_taoyuan_t0'] as unknown as { Effect: { targetId: string; op: string; value: number } };
    const eff1 = entities['eff_taoyuan_t1'] as unknown as { Effect: { value: number } };
    expect(eff0.Effect.targetId).toBe('dmg_scale_a');
    expect(eff0.Effect.op).toBe('add');
    expect(eff0.Effect.value).toBe(0.20);
    expect(eff1.Effect.value).toBe(0.25);
    const when1 = entities['when_taoyuan_t1'] as unknown as { EventWhen: { when: { of: { cmp?: string; value?: number }[] } } };
    expect(when1.EventWhen.when.of.some((c) => c.cmp === 'gte' && c.value === 5)).toBe(true); // 满编档阈值 5
  });

  it('DECK_REGISTRY 含 hubao + hanshi；hanshi=蜀出生', () => {
    expect(DECK_REGISTRY.hubao).toBe(HUBAO_DECK);
    expect(DECK_REGISTRY.hanshi).toBe(HANSHI_DECK);
    expect(HANSHI_DECK.faction).toBe('shu');
  });

  it('装牌组 → 牌组拥有羁绊：硬编码「蜀魂」基线被拆（避免 op:set/op:add 撞 dmg_scale_a）；不装则保留', () => {
    const withDeck = buildGameFBlueprint({ deck: HANSHI_DECK });
    expect(withDeck.entities['eff_bond_shu']).toBeUndefined(); // 蜀魂被牌组接管
    expect(withDeck.entities['eff_taoyuan_t0']).toBeDefined(); // 牌组连携在
    const noDeck = buildGameFBlueprint();
    expect(noDeck.entities['eff_bond_shu']).toBeDefined(); // 默认蜀局蜀魂保留（向后兼容）
  });
});

describe('牌组 #9 · 屯田积粟（经济 economy-band）', () => {
  it('economy-band → 结算窗 banded 金币（atGold 阈值阶梯；atGold=0 恒发）', () => {
    const { entities } = buildDeckRules(TUNTIAN_DECK);
    // 屯田三档：≥20/≥40/≥60。
    const e1 = entities['eff_tuntian_e1'] as unknown as { Effect: { targetId: string; op: string; value: number } };
    expect(e1.Effect.targetId).toBe('gold');
    expect(e1.Effect.op).toBe('add');
    const w1 = entities['when_tuntian_e1'] as unknown as { EventWhen: { when: { kind: string; of?: { value?: number }[] } } };
    expect(w1.EventWhen.when.kind).toBe('and'); // income_armed ∧ gold≥40
    // 重农 atGold=0 → 仅 income_armed（非 and）。
    const w0 = entities['when_zhongnong_e0'] as unknown as { EventWhen: { when: { kind: string } } };
    expect(w0.EventWhen.when.kind).toBe('flag');
  });
  it('屯田积粟入 DECK_REGISTRY（可选第 3 套可玩牌组）', () => {
    expect(DECK_REGISTRY.tuntian).toBe(TUNTIAN_DECK);
    expect(TUNTIAN_DECK.faction).toBe('wei');
  });
});

describe('牌组 #4 · 卧龙八阵（蜀·谋士控制 threshold-buff TACTICIAN；designer #10 派单）', () => {
  it('入 DECK_REGISTRY=蜀；bazhen 两档阈值 + 卧龙 round-buff + 奇谋 shop-weight 规则齐', () => {
    expect(DECK_REGISTRY.wolong).toBe(WOLONG_DECK);
    expect(WOLONG_DECK.faction).toBe('shu');
    const { entities, shopBias } = buildDeckRules(WOLONG_DECK);
    expect(entities['eff_bazhen_t0']).toBeDefined(); // 谋士≥2
    expect(entities['eff_bazhen_t1']).toBeDefined(); // 谋士≥3
    expect(entities['eff_wolong']).toBeDefined();     // 前 3 回合 round-buff
    expect(shopBias.some((b) => b.codes.includes(3) && b.copies === 2)).toBe(true); // 奇谋：诸葛亮(码3)加权 2 张
  });
  it('装卧龙 → blueprint 拆默认蜀魂、挂八阵连携', () => {
    const bp = buildGameFBlueprint({ deck: WOLONG_DECK });
    expect(bp.entities['eff_bond_shu']).toBeUndefined();
    expect(bp.entities['eff_bazhen_t0']).toBeDefined();
  });
});

describe('组牌器（catalog + assembleDeck；designer #19 build 端）', () => {
  it('CARD_CATALOG：deck 卡按 id 可查；assembleDeck 从 id 拼 Deck（丢未知 id）', () => {
    expect(CARD_CATALOG['taoyuan']).toBeDefined();
    expect(CARD_CATALOG['bazhen']).toBeDefined();
    const d = assembleDeck(['taoyuan', 'zhangwu', 'nope_unknown'], 'shu', '自组');
    expect(d.faction).toBe('shu');
    expect(d.cards.map((c) => c.id)).toEqual(['taoyuan', 'zhangwu']); // 未知 id 丢弃
  });
  it('自组牌组喂 buildGameFBlueprint 接口不变（与硬编码 preset 同路）', () => {
    const d = assembleDeck(['taoyuan'], 'shu');
    const bp = buildGameFBlueprint({ deck: d });
    expect(bp.entities['eff_taoyuan_t0']).toBeDefined(); // 自组的桃园连携照常物化
  });
  it('附魔加成：enchants → buildDeckRules 加 eff_enchant（开战 dmg_scale_a += step×总级）；无附魔不加', () => {
    expect(buildDeckRules(HANSHI_DECK).entities['eff_enchant']).toBeUndefined(); // 无附魔
    const r = buildDeckRules(HANSHI_DECK, { taoyuan: 2 });
    expect(r.entities['eff_enchant']).toBeDefined(); // 有附魔 → 加成实体
  });
});
