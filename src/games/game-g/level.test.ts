// level 关卡加载器（doc27 · 主程逐关加载）测试：拼装正确 + 确定性 12 天罡随机 + 难度档 + 关1-5 背景对白。
import { describe, it, expect } from 'vitest';
import { loadLevel, bossTiangang } from './level.js';
import { stageDisha } from './disha.js';

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
});
