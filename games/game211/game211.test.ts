import { describe, it, expect } from 'vitest';
import { standardArmy } from './blueprint.js';

// 旧 outcome-first 战斗核（buildGameG3DFlip / buildGameGDuel3D / decideFaceUp / buildGameGArmyMatch 的 3D 翻牌 +
// ECS 军阵对决）已随 REQ-G-退役旧战斗核 退役——出货战斗走回合制 turn-combat（见 turn-combat.test.ts）。
// 本文件保留仍存活的纯数据装配回归：standardArmy 军阵结构（54/方·三路×18·每路 1 主将）。
describe('Game G · 军阵装配（standardArmy 结构 · 纯数据）', () => {
  it('军阵：54/方·三路×18·军衔=点数（standardArmy 结构）', () => {
    const A = standardArmy('a', 0);
    expect(A).toHaveLength(54);
    for (const lane of [0, 1, 2]) {
      const lc = A.filter((c) => c.lane === lane);
      expect(lc).toHaveLength(18); // 每路 18
      expect(lc.filter((c) => c.general)).toHaveLength(1); // 每路 1 主将
    }
    // 三路主将 = 最高军衔（2 王 + 1 K，favor 80）
    expect(A.filter((c) => c.general).every((c) => c.favor >= 80 || c.rank === 'JOKER' || c.rank === 'K')).toBe(true);
  });
});
