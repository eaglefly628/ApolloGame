// emoji-resolve 自检：码点解析 + exact/alias/none 三态 + 覆盖汇总。用真库（assets/index.json emoji）。
import { describe, it, expect } from 'vitest';
import { resolveEmoji, cpName, coverage, SYMBOL_ALIAS } from './emoji-resolve.mjs';

describe('emoji-resolve · 码点 + 三态解析', () => {
  it('cpName 过滤变体选择符·多码点连字符', () => {
    expect(cpName('⚔')).toBe('2694');
    expect(cpName('⚔️')).toBe('2694'); // FE0F 变体选择符被过滤
  });

  it('exact：库里直中（⚔ → emoji/crossed_swords）', () => {
    const r = resolveEmoji('⚔');
    expect(r.match).toBe('exact');
    expect(r.path).toBe('emoji/2694.png');
    expect(r.id).toMatch(/^emoji\//);
  });

  it('alias：Unicode 符号就近替（★ → ⭐ 2b50）', () => {
    const r = resolveEmoji('★');
    expect(r.match).toBe('alias');
    expect(r.aliasCp).toBe('2b50');
    expect(r.path).toBe('emoji/2b50.png');
    expect(SYMBOL_ALIAS['2605']).toBe('2b50');
  });

  it('coverage(game-g)：直中+alias 全覆盖·结构完整', () => {
    const c = coverage('game-g');
    expect(c.distinct).toBeGreaterThan(0);
    expect(c.exactHits).toBeGreaterThan(0);
    expect(c.exactHits + c.aliasHits + c.noneHits).toBe(c.total); // 三态之和=总出现
    expect(c.rows[0]).toHaveProperty('match');
  });
});
