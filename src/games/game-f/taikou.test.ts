import { describe, it, expect } from 'vitest';
import { TAIKOU_BEACHHEAD, STAGE_UNIT, unitForStage } from './taikou.js';
import { GAME_F_TEMPLATES } from './combat.js';
import { F_TAIKOU } from './assets.js';

describe('T1 太阁守军 roster（滩头杂兵 + mob 换皮）', () => {
  it('滩头单位数据：枪足轻近战 / 弓足轻远程；stage 映射 + 越界兜底', () => {
    expect(unitForStage(1)).toBe(TAIKOU_BEACHHEAD.yari);
    expect(unitForStage(1).atkType).toBe('melee');
    expect(unitForStage(2).atkType).toBe('ranged'); // 弓足轻
    expect(STAGE_UNIT).toHaveLength(5);
    expect(unitForStage(99).code).toBe('ash_yari'); // 越界 = 枪足轻兜底
  });

  it('mob 模板已换皮太阁守军（名/皮按单位；远程波=追踪弹 + 射程驻足）', () => {
    const m1 = GAME_F_TEMPLATES['mob_s1'] as unknown as { entities: { name: { Text: { content: string } }; main: { Sprite: { textureKey: string }; GridMover: { range?: number } } } };
    expect(m1.entities.name.Text.content).toBe('枪足轻'); // 不再是「黄巾賊」
    expect(m1.entities.main.Sprite.textureKey).toBe(F_TAIKOU.yari);
    expect(m1.entities.main.GridMover.range).toBeUndefined(); // 近战贴脸（无 range）

    // 近战波(stage1 atk6)=strike_mob；远程波(stage2 弓足轻 atk9)=proj_mob + range=4
    expect(GAME_F_TEMPLATES['strike_mob_6']).toBeDefined();
    expect(GAME_F_TEMPLATES['proj_mob_9']).toBeDefined();
    const m2 = GAME_F_TEMPLATES['mob_s2'] as unknown as { entities: { main: { GridMover: { range?: number } } } };
    expect(m2.entities.main.GridMover.range).toBe(4);
  });
});
