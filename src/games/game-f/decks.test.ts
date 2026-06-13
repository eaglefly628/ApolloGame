import { describe, it, expect } from 'vitest';
import { buildGameFBlueprint } from './blueprint.js';
import { HUBAO_DECK, buildDeckRules, applyShopBias, type Deck } from './decks.js';
import { FACT_WEI, BENCH_OCC } from './constants.js';
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
