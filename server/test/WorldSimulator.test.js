const { WorldSimulator } = require('../src/engine/WorldSimulator');

describe('WorldSimulator', () => {
  let world;

  beforeEach(() => {
    world = new WorldSimulator({ tickRate: 100000 }); // slow tick, we'll call manually
    world.initDefaultWorld();
  });

  afterEach(() => {
    world.stop();
  });

  test('initDefaultWorld creates 10 regions', () => {
    expect(world.regions.size).toBe(10);
    expect(world.stats.totalRegions).toBe(10);
  });

  test('seedRegion infects a region', () => {
    const count = world.seedRegion('cn_south', 5);
    expect(count).toBe(5);
    const region = world.regions.get('cn_south');
    expect(region.infected).toBe(5);
    expect(region.isDiscovered).toBe(true);
    expect(world.stats.totalInfected).toBe(5);
  });

  test('seedRegion returns 0 for invalid region', () => {
    expect(world.seedRegion('invalid', 5)).toBe(0);
  });

  test('tick advances day and computes SIR', () => {
    world.pathogen = {
      getStats: () => ({ infectivity: 0.5, severity: 0.1, lethality: 0.01 }),
      specialTick: () => null,
    };
    world.seedRegion('cn_east', 100);
    const report = world._tick();
    expect(report.day).toBe(1);
    expect(report.regions.cn_east).toBeDefined();
    expect(report.regions.cn_east.newI).toBeGreaterThanOrEqual(0);
  });

  test('cure starts when infection rate exceeds threshold', () => {
    world.pathogen = {
      getStats: () => ({ infectivity: 0.9, severity: 0.3, lethality: 0.001, cureResistance: 0 }),
      specialTick: () => null,
    };
    // Infect a large portion
    world.seedRegion('cn_south', 10000);
    world.seedRegion('cn_east', 10000);
    world.seedRegion('cn_north', 10000);
    world._tick();
    // With 30000 infected out of ~490000 total (~6%), should exceed 5% threshold
    expect(world.cure.isStarted).toBe(true);
  });

  test('getSnapshot returns complete world state', () => {
    const snapshot = world.getSnapshot();
    expect(snapshot.day).toBe(0);
    expect(snapshot.state).toBe('idle');
    expect(Object.keys(snapshot.regions).length).toBe(10);
    expect(snapshot.cure).toBeDefined();
    expect(snapshot.kpiPoints).toBe(0);
  });

  test('victory detected when all susceptible = 0', () => {
    world.pathogen = {
      getStats: () => ({ infectivity: 0.5, severity: 0.1, lethality: 0, cureResistance: 0 }),
      specialTick: () => null,
    };
    // Force all regions to 0 susceptible
    for (const [, region] of world.regions) {
      region.infected = region.susceptible;
      region.susceptible = 0;
      region.isDiscovered = true;
    }
    let gameOverResult = null;
    world.on('gameOver', (result) => { gameOverResult = result; });
    world._tick();
    expect(gameOverResult).not.toBeNull();
    expect(gameOverResult.result).toBe('victory');
  });
});
