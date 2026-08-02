// level 关卡加载器（doc27 · 主程逐关加载）测试：拼装正确 + 确定性 12 天罡随机 + 难度档 + 关1-5 背景对白。
import { describe, it, expect } from 'vitest';
import { loadLevel, bossTiangang, tutorialEnemyDeck, TUTORIAL_AI } from './level.js';
import { stageDisha } from './disha.js';
import { cardPoints } from './clash-resolve.js';

describe('Game G · Campaign 关卡加载器（doc27）', () => {
  it('关1 列奥尼达：拼装战役/背景/对白/地煞/难度/解锁', () => {
    const l = loadLevel(1);
    expect(l.id).toBe(1); expect(l.heroId).toBe('列奥尼达'); expect(l.stars).toBe(1);
    expect(l.battle.name).toBe('温泉关');
    expect(l.intro).toContain('温泉关'); // 开场旁白
    expect(l.bossLines.open).toContain('长矛'); expect(l.bossLines.lose).toContain('斯巴达');
    expect(l.boss.disha).toEqual(stageDisha(1)); // 3 专属地煞
    expect(l.loadoutCap).toBe(2);                // ★ 难度档
    expect(l.reward.unlock).toContain('tigertally'); // 通关解锁(doc25)
  });

  it('Boss 12 天罡：seed=关id 确定性可复现·不重复·均匀来自 36 池', () => {
    const a = bossTiangang(5), b = bossTiangang(5);
    expect(a).toEqual(b);                         // 同关同 seed → 同 12 张
    expect(a.length).toBe(12);
    expect(new Set(a).size).toBe(12);             // 不重复
    expect(bossTiangang(1)).not.toEqual(bossTiangang(2)); // 不同关不同
  });

  it('难度档随星级升：关5 项羽 ★★★ loadoutCap 升、AI 档升', () => {
    const l5 = loadLevel(5);
    expect(l5.heroId).toBe('项羽'); expect(l5.stars).toBe(3);
    expect(l5.loadoutCap).toBeGreaterThanOrEqual(loadLevel(1).loadoutCap);
    expect(l5.boss.aiTier).toBeGreaterThan(loadLevel(1).boss.aiTier);
    expect(l5.bossLines.open).toContain('力拔山');
  });

  it('越界关（>5）取末关 lore 占位·仍拼装完整不崩', () => {
    const l = loadLevel(9);
    expect(l.id).toBe(9); expect(l.boss.disha.length).toBe(3); expect(l.boss.tiangang.length).toBe(12);
  });

  it('关1-5 Boss 16 牌组（镜像玩家·boss-config-1-5）：每关 16 张 + 牌力偏置 + 留场P', () => {
    for (let s = 1; s <= 5; s++) {
      const b = loadLevel(s).boss;
      expect(b.deck.length, `关${s} 应配 16 张`).toBe(16);
      expect(b.deck.every((c) => /^(10|[2-9]|[AKQJ])$/.test(c.rank) && /^[SHDC]$/.test(c.suit)), `关${s} 卡码合法`).toBe(true);
    }
    expect(loadLevel(1).boss.favorBias).toBe(-2); // 教学关弱
    expect(loadLevel(5).boss.favorBias).toBe(4);  // 终章强
    expect(loadLevel(1).boss.stayP).toBe(0.5);    // 关1-2 base
    expect(loadLevel(3).boss.stayP).toBe(0.75);   // 关3-5 守将乘胜
    expect(loadLevel(9).boss.deck.length).toBe(0); // 关6+ 暂无 16 牌组 → 回退泛化 army
  });

  it('教学关稻草兵（doc28·关0）：全弱牌(低点)·守势画像·好赢', () => {
    const deck = tutorialEnemyDeck();
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((c) => cardPoints(c.rank) <= cardPoints('4'))).toBe(true); // 全是低点弱兵
    expect(TUTORIAL_AI.aggression).toBeLessThanOrEqual(1); expect(TUTORIAL_AI.spellEager).toBe(0); // 极守·不施法 → 可预测好赢
  });
});
