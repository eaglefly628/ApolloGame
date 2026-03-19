const { GameSession } = require('../src/game/GameSession');

describe('GameSession', () => {
  let session;

  beforeEach(() => {
    session = new GameSession('test_session', { tickRate: 999999 });
  });

  afterEach(() => {
    session.destroy();
  });

  test('selectPathogen initializes world and pathogen', () => {
    const result = session.selectPathogen('tencent');
    expect(result.error).toBeUndefined();
    expect(result.pathogen.type).toBe('tencent');
    expect(result.pathogen.name).toBe('私域小绿龙');
    expect(result.regions.length).toBe(10);
    expect(session.state).toBe('seeding');
  });

  test('selectPathogen rejects unknown type', () => {
    const result = session.selectPathogen('unknown');
    expect(result.error).toBeDefined();
  });

  test('all 4 pathogen types can be selected', () => {
    for (const type of ['tencent', 'bytedance', 'ali', 'xiaomi']) {
      const s = new GameSession(`test_${type}`);
      const result = s.selectPathogen(type);
      expect(result.error).toBeUndefined();
      expect(result.pathogen.type).toBe(type);
      s.destroy();
    }
  });

  test('seedInfection works in seeding phase', () => {
    session.selectPathogen('bytedance');
    const result = session.seedInfection('cn_east');
    expect(result.error).toBeUndefined();
    expect(result.infected).toBe(5);
  });

  test('startSimulation requires seeded region', () => {
    session.selectPathogen('ali');
    const fail = session.startSimulation();
    expect(fail.error).toBeDefined();

    session.seedInfection('india');
    const success = session.startSimulation();
    expect(success.error).toBeUndefined();
    expect(session.state).toBe('running');
  });

  test('unlockMutation works during running state', () => {
    session.selectPathogen('tencent');
    session.seedInfection('cn_south');
    session.startSimulation();
    session.world.kpiPoints = 100;

    const result = session.unlockMutation('referral_1');
    expect(result.success).toBe(true);
    expect(session.world.kpiPoints).toBe(97); // cost = 3
  });

  test('unlockMutation fails without prerequisite', () => {
    session.selectPathogen('tencent');
    session.seedInfection('cn_south');
    session.startSimulation();
    session.world.kpiPoints = 100;

    const result = session.unlockMutation('referral_2'); // requires referral_1
    expect(result.error).toBeDefined();
  });

  test('getSnapshot returns full game state', () => {
    session.selectPathogen('xiaomi');
    const snapshot = session.getSnapshot();
    expect(snapshot.sessionId).toBe('test_session');
    expect(snapshot.pathogen.type).toBe('xiaomi');
    expect(snapshot.mutationTree.length).toBeGreaterThan(0);
  });

  test('tencent spore burst ability', () => {
    session.selectPathogen('tencent');
    session.seedInfection('cn_south');
    session.startSimulation();

    const result = session.useSpecialAbility('spore_burst');
    expect(result.error || result.targets).toBeDefined();
  });

  test('xiaomi eco lock ability', () => {
    session.selectPathogen('xiaomi');
    session.seedInfection('cn_east');
    session.startSimulation();
    session.world.kpiPoints = 100;

    const result = session.useSpecialAbility('eco_lock');
    expect(result.success).toBe(true);
    expect(result.duration).toBe(15);
    expect(session.world.kpiPoints).toBe(50);
  });
});
