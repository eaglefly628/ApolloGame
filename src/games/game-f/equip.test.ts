import { describe, it, expect } from 'vitest';
import { addEquip, removeEquip, equipStatSum, equipDeployHp, parseMarkerId, MAX_EQUIP, type EquipMap } from './equip.js';
import { finalHp, type HeroSpec } from './heroes.js';
import { STAR_HP_MUL } from './economy.js';

const hero = (hp: number, atk: number, items?: string[]): HeroSpec =>
  ({ hp, atk, items } as unknown as HeroSpec);

describe('装备 ③/④ 模型（金铲铲 ≤3 / 烘下次部署 / 拆解退栏；纯函数零引擎）', () => {
  it('addEquip：每将 ≤3；满员拒绝（回弹）', () => {
    const m: EquipMap = {};
    expect(addEquip(m, 'k', 'w_fangtian')).toBe(true);
    expect(addEquip(m, 'k', 'a_baiyin')).toBe(true);
    expect(addEquip(m, 'k', 't_yuxi')).toBe(true);
    expect(m['k'].length).toBe(MAX_EQUIP);
    expect(addEquip(m, 'k', 'w_qinglong')).toBe(false); // 第 4 件拒绝
    expect(m['k'].length).toBe(3);
  });
  it('removeEquip：拆首个匹配并退回 id；空了清键；无则 null', () => {
    const m: EquipMap = { k: ['w_fangtian', 'a_baiyin'] };
    expect(removeEquip(m, 'k', 'a_baiyin')).toBe('a_baiyin');
    expect(m['k']).toEqual(['w_fangtian']);
    expect(removeEquip(m, 'k', 'w_fangtian')).toBe('w_fangtian');
    expect(m['k']).toBeUndefined(); // 空了清键
    expect(removeEquip(m, 'k', 'x')).toBeNull();
  });
  it('equipStatSum：hp/atk 加总（缺省 0）', () => {
    const m: EquipMap = { k: ['a_baiyin', 'w_fangtian'] }; // hp260 / atk40
    expect(equipStatSum(m, 'k', 'hp')).toBe(260);
    expect(equipStatSum(m, 'k', 'atk')).toBe(40);
    expect(equipStatSum(m, 'none', 'hp')).toBe(0);
  });
  it('equipDeployHp：= round((finalHp + Σ装备hp) × 人数难度 × 星级)（heroOverrides 同管道）', () => {
    const h = hero(200, 15);
    const m: EquipMap = { k: ['a_baiyin'] }; // +hp260
    const expected2 = Math.round((finalHp(h) + 260) * 1 * STAR_HP_MUL[2]);
    expect(equipDeployHp(h, 2, 1, m, 'k')).toBe(expected2);
    // 无装备 = 纯 heroOverrides 基线
    expect(equipDeployHp(h, 1, 1, {}, 'k')).toBe(Math.round(finalHp(h) * STAR_HP_MUL[1]));
  });
  it('parseMarkerId：bench/bench2/bench3 编码星级；heroId 含下划线；非席位 null', () => {
    expect(parseMarkerId('bench_a_guanyu#3:seat')).toEqual({ heroId: 'a_guanyu', star: 1 });
    expect(parseMarkerId('bench2_b_simayi#7:seat')).toEqual({ heroId: 'b_simayi', star: 2 });
    expect(parseMarkerId('bench3_a_zhaoyun#1:seat')).toEqual({ heroId: 'a_zhaoyun', star: 3 });
    expect(parseMarkerId('hero_a_guanyu#3')).toBeNull();
    expect(parseMarkerId('r_dmg_scale_a')).toBeNull();
  });
});
