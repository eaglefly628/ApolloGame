// Game G · 养成数据层测试（天罡/流派克制/AI布阵/星球/流派激活/全栈端到端·拆分自 game-g.test.ts）。
import { describe, it, expect } from 'vitest';
import { quartermasterEnergy, pickAiFormation, tiangangKeyBuffs, GAME_G_TIANGANGS, TIANGANG_BY_ID, ARCHETYPES, detectArchetype, archetypeMatchup, activeArchetype, GAME_G_PLANETS, GAME_G_FOILS, effectiveLives, effectiveLeverCap, effectiveLeverRegen, RUN_LIVES, applyBuff, BOSS_ROSTER, LEVER_CAP, LEVER_REGEN, FORMATION_PRESETS, PRESET_NAMES, type BuffTarget } from './blueprint.js';

describe('Game G · T-G6 天罡牌（融牌面 · build 时 favor 变换 · 持久牌组身份）', () => {
  it('天罡目录(三十六天罡定稿)，kind 合法、cost>0、有 text、有 icon；TIANGANG_BY_ID 覆盖全', () => {
    expect(GAME_G_TIANGANGS.length).toBe(36);
    const kinds = new Set(['suit-synergy', 'polarize', 'lane-pref', 'diehard', 'morale', 'link', 'economy', 'revenge',
      'odds', 'power', 'combo', 'tempo', 'stamina', 'draw', 'lane', 'siege', 'arcane']);
    for (const j of GAME_G_TIANGANGS) {
      expect(kinds.has(j.kind)).toBe(true);
      expect(j.cost).toBeGreaterThan(0);
      expect(j.text.length).toBeGreaterThan(0);
      expect(TIANGANG_BY_ID.get(j.id)).toBe(j);
    }
  });

  // 注：旧 build-时 favor 变换族（同袍/赌徒/先登/不屈地板）已随 doc20 §二定稿砍掉
  // （天罡改为「主动施法·确定生效」cast-time·甲解释器）。旧 build-时编排族
  // （applyTiangangs / tiangangMoraleScale / tiangangLinks / applyShadowRevenge / prepareArmies）
  // 随旧 effect-apply 路退役（见 git 史）→ 其专测块已删。

  it('督粮：每胜一路 +1◈（仅拥有时；lanesWon clamp≥0）', () => {
    expect(quartermasterEnergy([], 3)).toBe(0);
    expect(quartermasterEnergy(['quartermaster'], 2)).toBe(2);
    expect(quartermasterEnergy(['quartermaster'], 0)).toBe(0);
    expect(quartermasterEnergy(['quartermaster'], -1)).toBe(0); // 负数钳 0
  });

  it('流派钥匙：tiangangKeyBuffs 为每张"未拥有"天罡产 kind=joker 的 RunBuff（已拥有不出）', () => {
    const all = tiangangKeyBuffs([]);
    expect(all).toHaveLength(GAME_G_TIANGANGS.length); // 全未拥有 → 全产
    for (const k of all) { expect(k.kind).toBe('tiangang'); expect(k.tiangangId).toBeTruthy(); expect(TIANGANG_BY_ID.has(k.tiangangId!)).toBe(true); }
    const owned = tiangangKeyBuffs(['ghosthand', 'bannerman']);
    expect(owned).toHaveLength(GAME_G_TIANGANGS.length - 2);
    expect(owned.some((k) => k.tiangangId === 'ghosthand' || k.tiangangId === 'bannerman')).toBe(false);
  });

  it('applyBuff(joker)：白嫖天罡入 save.jokers，去重幂等', () => {
    const t: BuffTarget = { deck: [50], lives: 3, leverEnergy: 3, materials: 0, tiangangs: [] };
    const key = tiangangKeyBuffs([])[0]; // 取第一张钥匙
    applyBuff(t, key);
    expect(t.tiangangs).toEqual([key.tiangangId]);
    applyBuff(t, key); // 再选同一张 → 不重复
    expect(t.tiangangs).toEqual([key.tiangangId]);
  });
});

describe('Game G · T-G6 流派 + 克制网（身份 + 石头剪刀布 · 纯数据）', () => {
  it('流派池=6，counters 合法(在集合内、无自克)、keyJokers 是有效天罡 id', () => {
    expect(ARCHETYPES).toHaveLength(6);
    const ids = new Set(ARCHETYPES.map((a) => a.id));
    for (const a of ARCHETYPES) {
      expect(ids.has(a.counters)).toBe(true);
      expect(a.counters).not.toBe(a.id); // 无自克
      for (const k of a.keyTiangangs) expect(TIANGANG_BY_ID.has(k)).toBe(true);
    }
  });

  it('克制网：每流派恰被 1 个克制（双 3-环闭合）+ 核心环 decap→general→wide→decap', () => {
    const counters = new Map(ARCHETYPES.map((a) => [a.id, a.counters]));
    for (const a of ARCHETYPES) expect(ARCHETYPES.filter((x) => x.counters === a.id).length).toBe(1);
    expect(counters.get('decap')).toBe('general');
    expect(counters.get('general')).toBe('wide');
    expect(counters.get('wide')).toBe('decap');
  });

  it('detectArchetype：无天罡→null；将领钥匙→将领流；多数决（doc20 §二尾新钥匙）', () => {
    expect(detectArchetype([])).toBeNull();
    expect(detectArchetype(['bannerman', 'markmorale'])?.id).toBe('general');
    expect(detectArchetype(['ghosthand', 'bedrock'])?.id).toBe('probability');
    expect(detectArchetype(['twinblade'])?.id).toBe('cardtype');
    expect(detectArchetype(['ghosthand', 'bedrock', 'twinblade'])?.id).toBe('probability'); // 概率(2) 压同rank(1)
  });

  it('archetypeMatchup：将领克铺场、铺场被将领克、将领vs牌型中立', () => {
    expect(archetypeMatchup('general', 'wide')).toBe('counter');
    expect(archetypeMatchup('wide', 'general')).toBe('countered');
    expect(archetypeMatchup('general', 'cardtype')).toBe('neutral');
  });

  it('每个 Boss 带合法流派 id', () => {
    const ids = new Set(ARCHETYPES.map((a) => a.id));
    for (const b of BOSS_ROSTER) expect(ids.has(b.archetype)).toBe(true);
  });
});

describe('Game G · AI 暗布阵 pickAiFormation（纯逻辑下沉 · committed→反制）', () => {
  const even = [10, 10, 10];
  it('低关(≤2)非 committed → 均衡', () => {
    expect(pickAiFormation(1, 0, even, false)).toEqual(FORMATION_PRESETS['均衡']);
    expect(pickAiFormation(2, 5, even, false)).toEqual(FORMATION_PRESETS['均衡']);
  });

  it('中关(3–5)非 committed → 随 stage+materials 变化(预设之一)', () => {
    const f = pickAiFormation(3, 1, even, false);
    expect(PRESET_NAMES.some((n) => FORMATION_PRESETS[n] === f)).toBe(true);
  });

  it('高关(>5) → 猛攻最弱一路（该路堆 18 军官）', () => {
    const f = pickAiFormation(6, 0, [14, 4, 12], false); // 中路最弱
    expect(f.officers[1]).toBe(18);
    expect(f.officers).toEqual([6, 18, 6]);
  });

  it('committed（玩家集齐招牌）→ 低关也反制攻最弱路', () => {
    const f = pickAiFormation(1, 0, [3, 14, 14], true); // 上路最弱
    expect(f.officers[0]).toBe(18); // 全程反制（非 committed 时此关本是均衡）
    expect(pickAiFormation(1, 0, [3, 14, 14], false)).toEqual(FORMATION_PRESETS['均衡']); // 对照：未 committed 仍均衡
  });
});

describe('Game G · T-G6 星球牌（第二养成轴 · 可叠加升档 · 纯数据）', () => {
  it('星球池≥4，kind 合法、cost/amount>0、有 text', () => {
    expect(GAME_G_PLANETS.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(['lives', 'energy', 'rank-favor', 'tier']);
    for (const p of GAME_G_PLANETS) {
      expect(kinds.has(p.kind)).toBe(true);
      expect(p.cost).toBeGreaterThan(0);
      expect(p.amount).toBeGreaterThan(0);
      expect(p.text.length).toBeGreaterThan(0);
    }
  });

  it('effective 派生 run 参数：无星球=base，按级线性叠加', () => {
    expect(effectiveLives({})).toBe(RUN_LIVES);
    expect(effectiveLives({ saturn: 2 })).toBe(RUN_LIVES + 2);
    expect(effectiveLeverCap({})).toBe(LEVER_CAP);
    expect(effectiveLeverCap({ jupiter: 1 })).toBe(LEVER_CAP + 1);
    expect(effectiveLeverRegen({ jupiter: 3 })).toBe(LEVER_REGEN + 3);
  });

  // 旧 build-时星球施加器 applyPlanetArmy / 牌型阶梯 laneHandTier / effectiveTierBonus 及其
  // prepareArmies 集成测随旧 effect-apply 路退役（见 git 史）→ 专测块已删。
  // 此处保留星球数据表 + effective 派生 run 参数（kept-data 覆盖）。

  it('foil 闪艺：池≥4、id 唯一、cost>0、有名/述（纯表现收集·零 gameplay）', () => {
    expect(GAME_G_FOILS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(GAME_G_FOILS.map((f) => f.id)).size).toBe(GAME_G_FOILS.length);
    for (const f of GAME_G_FOILS) { expect(f.cost).toBeGreaterThan(0); expect(f.name.length).toBeGreaterThan(0); expect(f.desc.length).toBeGreaterThan(0); }
  });
});

// 旧 build-时招牌增益施加器 applyArchetypeActivation 及完整编排 prepareArmies（端到端）随旧
// effect-apply 路退役（见 git 史）→ 其专测块已删。activeArchetype（流派激活检测器·game-g.tsx 活用）
// 仍存活，保留其纯逻辑回归（此块是它的唯一覆盖）。
describe('Game G · T-G6 流派激活检测 activeArchetype（主流派集齐 keyJokers）', () => {
  it('activeArchetype：空/部分→null；集齐主流派→该流派；混搭只激活主流派', () => {
    expect(activeArchetype([])).toBeNull();
    expect(activeArchetype(['bannerman'])).toBeNull(); // 部分(缺将魂印)
    expect(activeArchetype(['bannerman', 'markmorale'])).toBe('general');
    expect(activeArchetype(['rush', 'markswarm'])).toBe('wide');
    expect(activeArchetype(['bannerman', 'markmorale', 'rush'])).toBe('general'); // 将领集齐(2)>铺场部分(1) 主流派
  });
});
