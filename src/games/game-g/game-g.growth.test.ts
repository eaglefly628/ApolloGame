// Game G · 养成数据层测试（天罡/流派克制/AI布阵/星球/流派激活/全栈端到端·拆分自 game-g.test.ts）。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import type { Transform, RandomSeed, Resource, State, Card3D } from '@engine/protocol/components.js';
import { buildGameG3DFlip, buildGameGDuel3D, buildGameGArmyMatch, prepareArmies, standardArmy, armyFromFormation, laneEstimates, applyInterventions, applyShadowRevenge, quartermasterEnergy, pickAiFormation, applyTiangangs, tiangangMoraleScale, tiangangLinks, tiangangKeyBuffs, GAME_G_TIANGANGS, TIANGANG_BY_ID, ARCHETYPES, detectArchetype, archetypeMatchup, activeArchetype, applyArchetypeActivation, GAME_G_PLANETS, GAME_G_FOILS, effectiveLives, effectiveLeverCap, effectiveLeverRegen, effectiveTierBonus, applyPlanetArmy, laneHandTier, battleSpec, RUN_BATTLES, RUN_LIVES, BETWEEN_BUFFS, applyBuff, BOSS_ROSTER, bossFor, LEVER_CATALOG, LEVER_START, LEVER_CAP, LEVER_REGEN, FORMATION_PRESETS, PRESET_NAMES, decideFaceUp, cardFace, flipTarget, FLIP_DURATION, FLIP_SPINS, MATCH_REWARD, MARCH_DURATION, type FateCard, type ArmyCard, type Intervention, type BuffTarget } from './blueprint.js';

const get = <T extends Component>(e: Engine, id: string, type: string): T | undefined => e.world.getComponent<T>(id, type);
const rotOf = (e: Engine, id = 'card'): number => get<Transform>(e, id, 'Transform')!.rotation;
const faceUpVisible = (rot: number): boolean => Math.cos(rot) > 0; // 正面=朝镜头(+z) ⟺ cos>0
const seedOf = (seed: number): RandomSeed => ({ type: 'RandomSeed', seed, sequence: 0 });

describe('Game G · T-G6 天罡牌（融牌面 · build 时 favor 变换 · 持久牌组身份）', () => {
  const mk = (id: string, lane: number, suit: string, favor: number): ArmyCard => ({ id, rank: 'A', lane, favor, general: false, suit });

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

  it('空天罡集 → 原样复制（不改 favor、非别名）', () => {
    const army = [mk('x', 0, 'H', 50)];
    const out = applyTiangangs(army, []);
    expect(out).toEqual(army);
    expect(out).not.toBe(army);
  });

  // 注：旧 build-时 favor 变换族（同袍/赌徒/先登/不屈地板）已随 doc20 §二定稿砍掉
  // （天罡改为「主动施法·确定生效」cast-time·甲解释器）；applyTiangangs 对新 36 张 no-op。

  it('outcome-first：融不屈只升 favor → 同 seed 下存活数单调不减', () => {
    const baseA = standardArmy('a', -10); // 压低制造弱牌
    const run = (jids: string[]): number => {
      const a = applyTiangangs(baseA, jids);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, standardArmy('b', 0), 5));
      for (let i = 0; i < FLIP_DURATION + 8; i++) e.world.tick();
      return ['res_a0', 'res_a1', 'res_a2'].reduce((s, id) => s + (get<Resource>(e, id, 'Resource')?.current ?? 0), 0);
    };
    expect(run(['diehard'])).toBeGreaterThanOrEqual(run([]));
  });

  it('确定性：同军 + 同天罡集 + seed 逐拍 hash 一致（融天罡进 sim）', () => {
    const mkE = (): Engine => {
      const a = applyTiangangs(standardArmy('a', 2), ['comrade', 'vanguard']);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, standardArmy('b', 0), 9));
      return e;
    };
    const e1 = mkE(), e2 = mkE();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });

  it('tiangangMoraleScale：空集 + 新 36 张无 moraleMul → 恒 [1,1,1]（旧旗手×1.5/枭雄×2 已砍）', () => {
    const army = standardArmy('a', 0);
    expect(tiangangMoraleScale(army, [])).toEqual([1, 1, 1]);
    expect(tiangangMoraleScale(army, ['bannerman'])).toEqual([1, 1, 1]); // 新旗手=光环(leaderBuff)·非 moraleMul
  });

  it('旗手放大士气：build 时该路下属(主将活)favor 抬升 → 表现为存活单调不减（同 seed）', () => {
    const baseA = standardArmy('a', 6); // 主将高军衔+偏置 → 大概率活、士气生效
    const run = (jids: string[]): number => {
      const a = applyTiangangs(baseA, jids);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, standardArmy('b', 0), 11, undefined, tiangangMoraleScale(a, jids)));
      for (let i = 0; i < FLIP_DURATION + 8; i++) e.world.tick();
      return ['res_a0', 'res_a1', 'res_a2'].reduce((s, id) => s + (get<Resource>(e, id, 'Resource')?.current ?? 0), 0);
    };
    expect(run(['bannerman'])).toBeGreaterThanOrEqual(run([])); // 士气放大只升不降
  });

  it('确定性：旗手士气缩放进 sim 逐拍 hash 一致（缩放不改掷命次数）', () => {
    const mkE = (): Engine => {
      const a = applyTiangangs(standardArmy('a', 4), ['bannerman', 'warlord']);
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, standardArmy('b', 0), 13, undefined, tiangangMoraleScale(a, ['bannerman', 'warlord'])));
      return e;
    };
    const e1 = mkE(), e2 = mkE();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });

  it('tiangangLinks：从已融天罡取死士/连环开关（结局联动族）', () => {
    expect(tiangangLinks([])).toEqual({ martyr: false, chain: false });
    expect(tiangangLinks(['martyr'])).toEqual({ martyr: true, chain: false });
    expect(tiangangLinks(['chain', 'comrade'])).toEqual({ martyr: false, chain: true });
    expect(tiangangLinks(['martyr', 'chain'])).toEqual({ martyr: true, chain: true });
  });

  it('死士：首死后余部 +报仇（只升 favor、不改掷命次数）→ 同 seed 存活单调不减', () => {
    const baseA = standardArmy('a', -16); // 压低→兵大概率死、触发首死链
    const survivors = (links: { martyr: boolean; chain: boolean }): number => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(baseA, standardArmy('b', 0), 33, undefined, undefined, links));
      for (let i = 0; i < FLIP_DURATION + 8; i++) e.world.tick();
      return ['res_a0', 'res_a1', 'res_a2'].reduce((s, id) => s + (get<Resource>(e, id, 'Resource')?.current ?? 0), 0);
    };
    expect(survivors({ martyr: true, chain: false })).toBeGreaterThanOrEqual(survivors({ martyr: false, chain: false }));
  });

  it('结局联动进 sim 确定：同军 + 同 links(死士+连环) + seed 逐拍 hash 一致（前向单遍）', () => {
    const mk = (): Engine => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(standardArmy('a', 0), standardArmy('b', 0), 41, undefined, [1, 1, 1], { martyr: true, chain: true }));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });

  it('prepareArmies 带出 linksA（死士/连环 喂 build）', () => {
    const { linksA } = prepareArmies({ formation: FORMATION_PRESETS['均衡'], deckBias: 0, tiangangs: ['martyr', 'chain'], interventions: [], enemyBias: 0 });
    expect(linksA).toEqual({ martyr: true, chain: true });
  });

  it('督粮：每胜一路 +1◈（仅拥有时；lanesWon clamp≥0）', () => {
    expect(quartermasterEnergy([], 3)).toBe(0);
    expect(quartermasterEnergy(['quartermaster'], 2)).toBe(2);
    expect(quartermasterEnergy(['quartermaster'], 0)).toBe(0);
    expect(quartermasterEnergy(['quartermaster'], -1)).toBe(0); // 负数钳 0
  });

  it('applyShadowRevenge：仅被斩路(主将 favor≤8)余部 +复仇，主将不变、他路不变', () => {
    const army = standardArmy('a', 0);
    const hit = army.map((c) => (c.lane === 1 && c.general ? { ...c, favor: 8 } : c)); // 人工把 lane1 主将斩到 8
    const out = applyShadowRevenge(hit);
    const soldierSum = (arr: ArmyCard[], lane: number): number => arr.filter((c) => c.lane === lane && !c.general).reduce((s, c) => s + c.favor, 0);
    expect(soldierSum(out, 1)).toBeGreaterThan(soldierSum(hit, 1)); // 被斩路余部复仇
    expect(soldierSum(out, 0)).toBe(soldierSum(hit, 0)); // 他路不变
    expect(out.find((c) => c.lane === 1 && c.general)!.favor).toBe(8); // 主将仍被斩（退路不救将）
  });

  it('影武者：Boss 斩首命中我三路主将 → prepareArmies 让三路余部 +复仇（vs 不带影武者）', () => {
    const boss = BOSS_ROSTER.find((b) => b.id === 'smallJoker')!; // decapitate×3
    const make = (tiangangs: string[]): ArmyCard[] => prepareArmies({ formation: FORMATION_PRESETS['均衡'], deckBias: 0, tiangangs, interventions: [], enemyForm: boss.formation, enemyBias: boss.favorBias, boss }).a;
    const without = make([]);
    const withShadow = make(['shadow']);
    const soldierSum = (arr: ArmyCard[], lane: number): number => arr.filter((c) => c.lane === lane && !c.general).reduce((s, c) => s + c.favor, 0);
    for (const lane of [0, 1, 2]) {
      expect(without.find((c) => c.lane === lane && c.general)!.favor).toBe(8); // 三路主将都被斩
      expect(soldierSum(withShadow, lane)).toBeGreaterThan(soldierSum(without, lane)); // 影武者 → 余部复仇
    }
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
  const TROOP = ['A', '2', '3', '4', '5', '6'];
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

  it('星球·军：仅「兵」档(A–6) +3/级、军官不变；无 mars → 原样复制', () => {
    const army = standardArmy('a', 0);
    const out = applyPlanetArmy(army, { mars: 1 });
    for (const c of out) {
      const o = army.find((x) => x.id === c.id)!;
      if (TROOP.includes(c.rank)) expect(c.favor).toBe(Math.min(95, o.favor + 3)); // 兵 +3
      else expect(c.favor).toBe(o.favor); // 军官/王 不变
    }
    expect(applyPlanetArmy(army, {})).toEqual(army);
  });

  it('星球·军 进 prepareArmies：兵档底盘抬升（vs 无星球）', () => {
    const sumTroop = (a: ArmyCard[]): number => a.filter((c) => TROOP.includes(c.rank)).reduce((s, c) => s + c.favor, 0);
    const opt = { formation: FORMATION_PRESETS['均衡'], deckBias: 0, tiangangs: [], interventions: [] as Intervention[], enemyBias: 0 };
    const base = prepareArmies({ ...opt, planets: {} }).a;
    const withMars = prepareArmies({ ...opt, planets: { mars: 2 } }).a;
    expect(sumTroop(withMars)).toBeGreaterThan(sumTroop(base));
  });

  it('星球·型：成型(非高牌)整条阶梯 +bonus；高牌(0)不吃', () => {
    const mk = (rank: string, suit: string, i: number): ArmyCard => ({ id: `x${i}`, rank, lane: 0, favor: 50, general: i === 0, suit });
    const flushLane = ['A', 'K', 'Q', '9', '3'].map((r, i) => mk(r, 'H', i)); // 同花
    expect(laneHandTier(flushLane).buff).toBe(10); // flush 基础
    expect(laneHandTier(flushLane, 4).buff).toBe(14); // +星球·型 4
    const highCard = [['A', 'H'], ['K', 'S'], ['9', 'D'], ['7', 'C'], ['3', 'H']].map(([r, s], i) => mk(r, s, i));
    expect(laneHandTier(highCard).type).toBe('high-card');
    expect(laneHandTier(highCard, 4).buff).toBe(0); // 高牌不成型 → 不吃加成
    expect(effectiveTierBonus({ mercury: 2 })).toBe(8); // amount 4 × 2 级
  });

  it('foil 闪艺：池≥4、id 唯一、cost>0、有名/述（纯表现收集·零 gameplay）', () => {
    expect(GAME_G_FOILS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(GAME_G_FOILS.map((f) => f.id)).size).toBe(GAME_G_FOILS.length);
    for (const f of GAME_G_FOILS) { expect(f.cost).toBeGreaterThan(0); expect(f.name.length).toBeGreaterThan(0); expect(f.desc.length).toBeGreaterThan(0); }
  });

  it('星球·型 进 prepareArmies：flush 干预受益于 mercury（vs 无星球）', () => {
    const opt = { formation: FORMATION_PRESETS['均衡'], deckBias: 0, tiangangs: [], interventions: [{ kind: 'flush', lane: 0 }] as Intervention[], enemyBias: 0 };
    const sumLane0 = (a: ArmyCard[]): number => a.filter((c) => c.lane === 0).reduce((s, c) => s + c.favor, 0);
    const base = prepareArmies({ ...opt, planets: {} }).a;
    const withTier = prepareArmies({ ...opt, planets: { mercury: 2 } }).a;
    expect(sumLane0(withTier)).toBeGreaterThan(sumLane0(base)); // 牌型阶梯被星球·型抬高 → flush 给该路更多 favor
  });
});

describe('Game G · T-G6 流派激活质变（主流派集齐 keyJokers → 招牌增益）', () => {
  const sumLane = (arr: ArmyCard[], lane: number): number => arr.filter((c) => c.lane === lane).reduce((s, c) => s + c.favor, 0);

  it('activeArchetype：空/部分→null；集齐主流派→该流派；混搭只激活主流派', () => {
    expect(activeArchetype([])).toBeNull();
    expect(activeArchetype(['bannerman'])).toBeNull(); // 部分(缺将魂印)
    expect(activeArchetype(['bannerman', 'markmorale'])).toBe('general');
    expect(activeArchetype(['rush', 'markswarm'])).toBe('wide');
    expect(activeArchetype(['bannerman', 'markmorale', 'rush'])).toBe('general'); // 将领集齐(2)>铺场部分(1) 主流派
  });

  it('将领流激活：moraleMul=1.3、军不变', () => {
    const A = standardArmy('a', 0);
    const r = applyArchetypeActivation('general', A, standardArmy('b', 0), 0);
    expect(r.moraleMul).toBe(1.3);
    expect(r.a.map((c) => c.favor)).toEqual(A.map((c) => c.favor));
  });

  it('铺场流激活：每路 +2 兵（共 +6）', () => {
    const A = standardArmy('a', 0);
    const r = applyArchetypeActivation('wide', A, standardArmy('b', 0), 0);
    expect(r.a.length).toBe(A.length + 6);
    for (const lane of [0, 1, 2]) expect(r.a.filter((c) => c.lane === lane).length).toBe(A.filter((c) => c.lane === lane).length + 2);
  });

  it('牌型流激活：tierBonusAdd=12（阶梯近×2）；概率流：favor 下限拉到 15', () => {
    expect(applyArchetypeActivation('cardtype', standardArmy('a', 0), standardArmy('b', 0), 0).tierBonusAdd).toBe(12);
    const r = applyArchetypeActivation('probability', standardArmy('a', -40), standardArmy('b', 0), 0);
    expect(Math.min(...r.a.map((c) => c.favor))).toBeGreaterThanOrEqual(15);
  });

  it('斩首流激活：敌主将先怯 −12（仅敌主将）', () => {
    const B = standardArmy('b', 0);
    const r = applyArchetypeActivation('decap', standardArmy('a', 0), B, 0);
    for (const lane of [0, 1, 2]) {
      const g0 = B.find((c) => c.lane === lane && c.general)!;
      const g1 = r.b.find((c) => c.lane === lane && c.general)!;
      expect(g1.favor).toBe(Math.max(5, g0.favor - 12));
    }
  });

  it('弃一保二激活：两强路 +favor、最弱路不变', () => {
    const A = armyFromFormation('a', 0, FORMATION_PRESETS['田忌']); // 上路最弱(2 军官)
    const r = applyArchetypeActivation('tianji', A, standardArmy('b', 0), 0);
    const sums = [0, 1, 2].map((l) => sumLane(A, l));
    const weakest = sums.indexOf(Math.min(...sums));
    expect(sumLane(r.a, weakest)).toBe(sumLane(A, weakest)); // 最弱路不变
    for (const lane of [0, 1, 2]) if (lane !== weakest) expect(sumLane(r.a, lane)).toBeGreaterThan(sumLane(A, lane));
  });

  it('将领流激活进 prepareArmies：集齐 将领钥匙 → moraleA = ×1.3（新旗手无 moraleMul → 1×1.3）', () => {
    const r = prepareArmies({ formation: FORMATION_PRESETS['均衡'], deckBias: 0, tiangangs: ['bannerman', 'markmorale'], interventions: [], enemyBias: 0 });
    const morTiangang = tiangangMoraleScale(r.a, ['bannerman', 'markmorale']);
    for (let i = 0; i < 3; i++) expect(r.moraleA[i]).toBeCloseTo(morTiangang[i] * 1.3, 6);
  });

  it('确定性：激活质变(铺场流+联动)进 sim 逐拍 hash 一致', () => {
    const mk = (): Engine => {
      const { a, b, moraleA, linksA } = prepareArmies({ formation: FORMATION_PRESETS['锋矢'], deckBias: 2, tiangangs: ['vanguard', 'martyr', 'chain'], interventions: [], enemyForm: FORMATION_PRESETS['均衡'], enemyBias: 0 });
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, 55, undefined, moraleA, linksA));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });
});

describe('Game G · 全栈养成端到端（星球+激活流派+干预+Boss+联动 一锅 · 硬化）', () => {
  const surv = (setup: Parameters<typeof prepareArmies>[0], seed: number): number => {
    const { a, b, moraleA, linksA } = prepareArmies(setup);
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameGArmyMatch(a, b, seed, undefined, moraleA, linksA));
    for (let i = 0; i < FLIP_DURATION + 10; i++) e.world.tick();
    return ['res_a0', 'res_a1', 'res_a2'].reduce((s, id) => s + (get<Resource>(e, id, 'Resource')?.current ?? 0), 0);
  };

  it('养成回报：满配(星球+集齐将领流+干预)军 vs 同 Boss 存活 > 裸军', () => {
    const boss = bossFor(2);
    const base = { formation: FORMATION_PRESETS['均衡'], deckBias: 0, tiangangs: [] as string[], interventions: [] as Intervention[], enemyForm: boss.formation, enemyBias: boss.favorBias, boss, planets: {} as Record<string, number> };
    const kitted = { ...base, tiangangs: ['bannerman', 'warlord', 'diehard'], interventions: [{ kind: 'bless', lane: 0 }, { kind: 'bless', lane: 1 }] as Intervention[], planets: { mars: 3, saturn: 1 } };
    expect(surv(kitted, 77)).toBeGreaterThan(surv(base, 77)); // 养成全栈确实更强
  });

  it('胜负正确性：压倒性强军 → winner=a；裸弱军 vs 强敌 → winner=b（净突破方向对）', () => {
    const settle = (armyA: ArmyCard[], armyB: ArmyCard[], seed: number): string => {
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(armyA, armyB, seed));
      for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) e.world.tick();
      return get<State>(e, 'winner', 'State')!.current;
    };
    const strong = applyTiangangs(standardArmy('a', 20), ['diehard']); // 高偏置 + 免死地板 88 → 压倒
    expect(settle(strong, standardArmy('b', -40), 7)).toBe('a'); // 强 vs 弱 → a 胜
    expect(settle(standardArmy('a', -40), applyTiangangs(standardArmy('b', 20), ['diehard']), 7)).toBe('b'); // 反向 → b 胜
  });

  it('最大配置确定性：星球+铺场流激活+联动+护盾/增援+终局 Boss 同 setup+seed 逐拍 hash 一致', () => {
    const boss = bossFor(5); // 小王·无常（decapitate×3）
    const setup = (): Parameters<typeof prepareArmies>[0] => ({
      formation: FORMATION_PRESETS['田忌'], deckBias: 4,
      tiangangs: ['rush', 'markswarm'], // wide(铺场)集齐 → 激活 +2兵/路（doc20 §二尾新钥匙）
      interventions: [{ kind: 'reinforce', lane: 2 }, { kind: 'shield', lane: 0 }],
      enemyForm: boss.formation, enemyBias: boss.favorBias, boss,
      planets: { mars: 2, mercury: 1, jupiter: 1 },
    });
    const mk = (): Engine => {
      const { a, b, moraleA, linksA } = prepareArmies(setup());
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, 88, undefined, moraleA, linksA));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });
});

describe('Game G · 完整 build 时编排 prepareArmies（showMatch 同款 · 端到端）', () => {
  const boss = bossFor(5); // 小王·无常（decapitate×3 反噬玩家）
  const setup = () => ({
    formation: FORMATION_PRESETS['田忌'],
    deckBias: 6,
    tiangangs: ['bannerman'],
    interventions: [{ kind: 'bless', lane: 1 }, { kind: 'reinforce', lane: 2 }] as Intervention[],
    enemyForm: boss.formation,
    enemyBias: boss.favorBias,
    boss,
  });

  it('端到端确定性：同 setup+seed → 逐拍 hash 一致（融天罡+玩家干预+Boss起手+士气 全栈）', () => {
    const mk = (): Engine => {
      const { a, b, moraleA } = prepareArmies(setup());
      const e = new Engine({ tickRate: 60 });
      e.load(buildGameGArmyMatch(a, b, 21, undefined, moraleA));
      return e;
    };
    const e1 = mk(), e2 = mk();
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) { e1.world.tick(); e2.world.tick(); expect(e1.hash()).toBe(e2.hash()); }
  });

  it('编排落实各效果：moraleA[1,1,1]（新旗手无倍率）、Boss 斩首压玩家三路主将 favor=8、增援我方该路 +2 兵', () => {
    const { a, moraleA } = prepareArmies(setup());
    expect(moraleA).toEqual([1, 1, 1]); // 新旗手=光环非 moraleMul；未集齐将魂印 → 无 ×1.3
    for (const lane of [0, 1, 2]) expect(a.find((c) => c.lane === lane && c.general)!.favor).toBe(8); // Boss 斩首（绝对设值，覆盖天罡加成）
    const base = armyFromFormation('a', 6, FORMATION_PRESETS['田忌']).filter((c) => c.lane === 2).length;
    expect(a.filter((c) => c.lane === 2).length).toBe(base + 2); // 增援 lane2
  });

  it('编排不改掷命次数 → 跑到结算出胜负（不卡 pending）', () => {
    const { a, b, moraleA } = prepareArmies(setup());
    const e = new Engine({ tickRate: 60 });
    e.load(buildGameGArmyMatch(a, b, 21, undefined, moraleA));
    for (let i = 0; i < FLIP_DURATION + MARCH_DURATION + 6; i++) e.world.tick();
    expect(['a', 'b', 'draw']).toContain(get<State>(e, 'winner', 'State')!.current);
  });
});
