import { describe, it, expect } from 'vitest';
import { startsInLegacy } from './app-route.js';

describe('首屏路由', () => {
  it('缺省进新编辑器；项目深链仍是新编辑器', () => {
    expect(startsInLegacy('')).toBe(false);
    expect(startsInLegacy('?project=new1')).toBe(false);
  });
  it.each(['?legacy=1', '?game=lib:abc', '?from=workshop', '?bare=1', '?mode=player'])('%s → 旧版创作台', (s) => {
    expect(startsInLegacy(s)).toBe(true);
  });
});
