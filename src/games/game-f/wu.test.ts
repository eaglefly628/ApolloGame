import { describe, it, expect } from 'vitest';
import { rosterFor } from './blueprint.js';
import { WU_ROSTER } from './heroes.js';
import { BAIYI_DECK, DECK_REGISTRY } from './decks.js';
import { templatesFor } from './combat.js';
import { FACT_WU, ASSASSIN, BENCH_OCC } from './constants.js';

// 吴 faction 刺客核心（game-f-wu-faction-seed.md）：数据待命验证（plumbing 前不接线，但数据正确 + F-061 trait 覆盖）。
describe('吴 faction 刺客核心 + 白衣渡江（待命数据）', () => {
  it('WU_ROSTER：6 英雄（4 刺客+1谋+1将）全 FACT_WU；4 个 ASSASSIN 支撑白衣两档阈值', () => {
    expect(WU_ROSTER).toHaveLength(6);
    expect(WU_ROSTER.every((h) => (h.faction & FACT_WU) === FACT_WU)).toBe(true);
    expect(WU_ROSTER.filter((h) => h.cls === ASSASSIN)).toHaveLength(4); // 吕蒙/甘宁/太史慈/凌统
    expect(WU_ROSTER.map((h) => h.name)).toEqual(['吕蒙', '甘宁', '太史慈', '凌统', '周瑜', '孙策']);
    expect(rosterFor('wu')).toBe(WU_ROSTER);
  });

  it('F-061 职业 trait 自动覆盖吴刺客：吕蒙普攻自带 executeBelow（处决残血）', () => {
    const t = templatesFor(WU_ROSTER) as Record<string, unknown>;
    const lv = t['strike_c_lvmeng'] as { entities: { area: { Hitbox: { executeBelow?: number } } } };
    expect(lv.entities.area.Hitbox.executeBelow).toBe(0.15); // ASSASSIN 斩杀线
    const zhou = t['proj_c_zhouyu'] ?? t['strike_c_zhouyu']; // 周瑜=谋士非刺客，无斩杀
    expect(zhou).toBeDefined();
  });

  it('BAIYI_DECK：白衣 threshold-buff 绑刺客；待命=不入 DECK_REGISTRY（plumbing 前不可选）', () => {
    const baiyi = BAIYI_DECK.cards.find((c) => c.kind === 'threshold-buff');
    expect(baiyi && 'tagMask' in baiyi && baiyi.tagMask).toBe(BENCH_OCC | ASSASSIN);
    expect(BAIYI_DECK.faction).toBe('wu');
    expect(DECK_REGISTRY.baiyi).toBeUndefined(); // 待命，未入表
  });
});
