// @vitest-environment happy-dom
// 牌组数据打通验收（契约A·甲读·owner 2026-06-21 #15/#16）：大厅配的 16 张 pokerPicks + 逐张地支附魔
// 必须按卡 ID 真正进战斗牌库（不再被揉成全军平均 bias）。回归测，防再断。
import { describe, it, expect } from 'vitest';
import { buildPickDeck, bossHeroCard } from './game211.js';
import { effectiveDeckFavors, cardFavorIndex } from './index.js';
import { initTurnBattle, deployUnit } from './turn-combat.js';

describe('Game G · 牌组数据打通（契约A甲读 · 地支附魔按 ID 进战斗）', () => {
  it('buildPickDeck：战斗牌库=你配的那几张(id/rank/suit)，且附魔真抬高其战力', () => {
    const base = Array.from({ length: 52 }, () => 50); // 基线 favor 全 50
    const idx = cardFavorIndex('AS'); // 黑桃A 的 favor/inlays 索引
    const effFav = effectiveDeckFavors(base, { [idx]: [{ b: '子', t: 3 }, { b: '丑', t: 3 }] }); // 给黑桃A 镶两个金生肖
    expect(effFav[idx]).toBeGreaterThan(50); // 附魔确实抬高了该卡 effective favor

    const built = buildPickDeck(['AS', '2C', '10D'], effFav);
    expect(built.map((c) => c.id)).toEqual(['AS', '2C', '10D']); // 牌库就是你配的那几张·按 ID
    expect(built[0]).toMatchObject({ kind: 'poker', id: 'AS', rank: 'A', suit: 'S' });
    expect(built[2]).toMatchObject({ id: '10D', rank: '10', suit: 'D' }); // '10D' 的 rank='10' 不丢位

    const plain = buildPickDeck(['AS'], base); // 同一张牌·无附魔(favor 50)作对照
    expect(built[0].buff).toBeGreaterThan(plain[0].buff); // 附魔的黑桃A 战力更高 = 真带进了战斗
  });

  it('主将 = favor 最高那张（保留士气机制）· 且唯一', () => {
    const base = Array.from({ length: 52 }, () => 50);
    const effFav = effectiveDeckFavors(base, { [cardFavorIndex('KS')]: [{ b: '子', t: 3 }] }); // KS 被附魔→最高
    const built = buildPickDeck(['2C', 'KS', '5D'], effFav);
    expect(built.find((c) => c.general)?.id).toBe('KS');
    expect(built.filter((c) => c.general)).toHaveLength(1);
  });

  it('放牌按档收费（契约B·deployCost）：每张挂 cost·建库时按 rank 写在卡上', () => {
    const base = Array.from({ length: 52 }, () => 50);
    const built = buildPickDeck(['2C', '7H', '10D', 'KS'], base);
    expect(built.map((c) => c.cost)).toEqual([0, 1, 2, 3]); // 2→免费·7→1·10→2·K→3
  });

  it('deployUnit 按 cost 收源泉：买不起→拒；够→扣对应源泉', () => {
    const b = initTurnBattle({ seed: 1 });
    b.a.mana = 2; b.a.hand.push({ kind: 'poker', id: 'k', rank: 'K', suit: 'S', general: false, buff: 0, cost: 3 });
    expect(deployUnit(b, 'a', 0, 0)).toBe(false); // 费 3 > 源泉 2 → 拒
    b.a.mana = 3;
    expect(deployUnit(b, 'a', 0, 0)).toBe(true);  // 够 → 放
    expect(b.a.mana).toBe(0);                     // 扣掉 3
  });

  it('Boss 主将牌 = 本关英雄那张牌·传奇强化（owner 2026-06-21）', () => {
    const c = bossHeroCard('列奥尼达', 12); // 温泉关英雄 = 英雄谱 3♠
    expect(c).toMatchObject({ kind: 'poker', rank: '3', suit: 'S', general: true });
    expect(c!.buff).toBeGreaterThan(15);      // 强化：点数 3 但战力高(配得上传奇统帅)
    expect(c!.cost).toBe(0);                  // rank 3 → deployCost 0
    expect(bossHeroCard('查无此英雄', 0)).toBeNull(); // 查不到 → null(不注入)
  });
});
