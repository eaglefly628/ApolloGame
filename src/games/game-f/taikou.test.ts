import { describe, it, expect } from 'vitest';
import { TAIKOU_BEACHHEAD, TAIKOU_KOKUJIN, TAIKOU_BOSS, TAIKOU_ROSTER, STAGE_UNIT, unitForStage, unitByCode } from './taikou.js';
import { GAME_F_TEMPLATES } from './combat.js';
import { F_TAIKOU } from './assets.js';
import { PVE_COMP } from './stages.js';

describe('C 太阁全谱 roster（master §六 数据落地）', () => {
  it('全谱完整：滩头4 + 国人众6 + 天守11 = 21；按 master 数值钉关键样本', () => {
    expect(Object.keys(TAIKOU_BEACHHEAD)).toHaveLength(4);
    expect(Object.keys(TAIKOU_KOKUJIN)).toHaveLength(6);
    expect(Object.keys(TAIKOU_BOSS)).toHaveLength(11);
    expect(Object.keys(TAIKOU_ROSTER)).toHaveLength(21);
    // master 样本：斋藤(蝮,TAC,hp600)、家康(忍耐,厚血 hp2000)、谦信(军神,atk90,ASN,斩杀招牌)
    expect(unitByCode('saito')).toMatchObject({ cls: 'TAC', hp: 600, atkType: 'magic', seg: 'kokujin' });
    expect(unitByCode('ieyasu')).toMatchObject({ hp: 2000, seg: 'tenshu' });
    expect(unitByCode('kenshin')).toMatchObject({ atk: 90, cls: 'ASN' });
    expect(unitByCode('masamune')?.atkType).toBe('ranged'); // 狙击=远程
    // 每个单位都有皮 + 正数 hp/atk（master 完整性）
    for (const u of Object.values(TAIKOU_ROSTER)) {
      expect(u.sprite.startsWith('f.taikou.')).toBe(true);
      expect(u.hp).toBeGreaterThan(0);
      expect(u.atk).toBeGreaterThan(0);
    }
  });

  it('国人众进战斗（slice2）：W3–W5 编成引国人众；mob_<code> 战斗模板就绪（master 数值）', () => {
    // W3 含斋藤、W4 含北条+毛利、W5 含明智+石田+今川。
    expect(PVE_COMP.find((w) => w.stage === 3)!.comp.some((c) => c.code === 'saito')).toBe(true);
    expect(PVE_COMP.find((w) => w.stage === 4)!.comp.map((c) => c.code)).toEqual(expect.arrayContaining(['hojo', 'mori']));
    // 国人众战斗模板就绪（部署槽 mob_<code> + 武器）：斋藤(法术弹)、北条(近战)。
    expect(GAME_F_TEMPLATES['mob_saito']).toBeDefined();
    expect(GAME_F_TEMPLATES['proj_mob_saito']).toBeDefined(); // 斋藤 magic → 弹
    expect(GAME_F_TEMPLATES['mob_hojo']).toBeDefined();
    expect(GAME_F_TEMPLATES['strike_mob_hojo']).toBeDefined(); // 北条 melee → 打击区
  });

  it('天守 Boss 斩杀接线（slice3，F-061）：谦信进终盘波 + 普攻带 executeBelow；非斩杀单位不带', () => {
    expect(PVE_COMP.find((w) => w.stage === 5)!.comp.some((c) => c.code === 'kenshin')).toBe(true); // 谦信终盘部署
    const ken = GAME_F_TEMPLATES['strike_mob_kenshin'] as unknown as { entities: { area: { Hitbox: { executeBelow?: number } } } };
    expect(ken.entities.area.Hitbox.executeBelow).toBe(0.3); // 军神·斩杀残血
    const hojo = GAME_F_TEMPLATES['strike_mob_hojo'] as unknown as { entities: { area: { Hitbox: { executeBelow?: number } } } };
    expect(hojo.entities.area.Hitbox.executeBelow).toBeUndefined(); // 北条非斩杀
  });

  it('天守 Boss 忍耐接线（slice3b）：家康进终盘波 + mob 带 over-time 自回复；普通单位不带', () => {
    expect(PVE_COMP.find((w) => w.stage === 5)!.comp.some((c) => c.code === 'ieyasu')).toBe(true);
    const ie = GAME_F_TEMPLATES['mob_ieyasu'] as unknown as { entities: { main: { OverTime?: { effects: { resource: string }[] } } } };
    expect(ie.entities.main.OverTime?.effects[0].resource).toBe('hp'); // 忍耐=自回血
    const yari = GAME_F_TEMPLATES['mob_ash_yari'] as unknown as { entities: { main: { OverTime?: unknown } } };
    expect(yari.entities.main.OverTime).toBeUndefined(); // 足轻无回复
  });
});

describe('T1 太阁守军 roster（滩头杂兵 + mob 换皮）', () => {
  it('滩头单位数据：枪足轻近战 / 弓足轻远程；stage 映射 + 越界兜底', () => {
    expect(unitForStage(1)).toBe(TAIKOU_BEACHHEAD.yari);
    expect(unitForStage(1).atkType).toBe('melee');
    expect(unitForStage(2).atkType).toBe('ranged'); // 弓足轻
    expect(STAGE_UNIT).toHaveLength(5);
    expect(unitForStage(99).code).toBe('ash_yari'); // 越界 = 枪足轻兜底
  });

  it('mob 模板已换皮太阁守军（名/皮按单位；远程波=追踪弹 + 射程驻足）', () => {
    const m1 = GAME_F_TEMPLATES['mob_ash_yari'] as unknown as { entities: { name: { Text: { content: string } }; main: { Sprite: { textureKey: string }; GridMover: { range?: number } } } };
    expect(m1.entities.name.Text.content).toBe('枪足轻'); // 不再是「黄巾賊」
    expect(m1.entities.main.Sprite.textureKey).toBe(F_TAIKOU.yari);
    expect(m1.entities.main.GridMover.range).toBeUndefined(); // 近战贴脸（无 range）

    // 近战波(stage1 atk6)=strike_mob；远程波(stage2 弓足轻 atk9)=proj_mob + range=4
    expect(GAME_F_TEMPLATES['strike_mob_ash_yari']).toBeDefined();
    expect(GAME_F_TEMPLATES['proj_mob_ash_yumi']).toBeDefined();
    const m2 = GAME_F_TEMPLATES['mob_ash_yumi'] as unknown as { entities: { main: { GridMover: { range?: number } } } };
    expect(m2.entities.main.GridMover.range).toBe(4);
  });
});
