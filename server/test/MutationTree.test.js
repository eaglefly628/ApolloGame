const { MutationTree } = require('../src/game/mutations/MutationTree');
const { BasePathogen } = require('../src/game/pathogens/BasePathogen');

describe('MutationTree', () => {
  let tree;
  let pathogen;
  let world;

  beforeEach(() => {
    tree = new MutationTree();
    pathogen = new BasePathogen('test', 'Test');
    world = {
      kpiPoints: 100,
      kpiPerDay: 0,
      kpiPerInfection: 1,
      regions: new Map(),
      cure: { progress: 50, baseRate: 0.15, resistance: 0 },
    };
  });

  test('getAll returns all mutation nodes', () => {
    const all = tree.getAll();
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((n) => n.id && n.name && n.type)).toBe(true);
  });

  test('getByType filters correctly', () => {
    const trans = tree.getByType('transmission');
    const symptoms = tree.getByType('symptom');
    const abilities = tree.getByType('ability');
    expect(trans.length).toBeGreaterThan(0);
    expect(symptoms.length).toBeGreaterThan(0);
    expect(abilities.length).toBeGreaterThan(0);
    expect(trans.every((n) => n.type === 'transmission')).toBe(true);
  });

  test('unlock works for nodes with no prerequisites', () => {
    const result = tree.unlock('referral_1', pathogen, world);
    expect(result.success).toBe(true);
    expect(world.kpiPoints).toBe(97);
    expect(pathogen.unlockedMutations.has('referral_1')).toBe(true);
  });

  test('unlock fails without prerequisite', () => {
    const result = tree.unlock('referral_2', pathogen, world);
    expect(result.error).toBeDefined();
  });

  test('unlock chain works', () => {
    tree.unlock('referral_1', pathogen, world);
    const result = tree.unlock('referral_2', pathogen, world);
    expect(result.success).toBe(true);
  });

  test('unlock fails with insufficient KPI', () => {
    world.kpiPoints = 1;
    const result = tree.unlock('referral_1', pathogen, world);
    expect(result.error).toContain('KPI 不足');
  });

  test('cure_rollback_5 reduces cure progress', () => {
    tree.unlock('non_compete', pathogen, world);
    tree.unlock('legal_warning', pathogen, world);
    expect(world.cure.progress).toBe(45);
  });

  test('kpi_per_day_2 increases daily KPI', () => {
    tree.unlock('clock_anxiety', pathogen, world);
    tree.unlock('meeting_hell', pathogen, world);
    expect(world.kpiPerDay).toBe(2);
  });
});
