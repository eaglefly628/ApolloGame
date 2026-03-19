const { Region } = require('../src/engine/Region');

describe('Region', () => {
  test('initializes with all population as susceptible', () => {
    const r = new Region({ id: 'test', name: 'Test', totalPop: 1000 });
    expect(r.susceptible).toBe(1000);
    expect(r.infected).toBe(0);
    expect(r.removed).toBe(0);
    expect(r.isDiscovered).toBe(false);
  });

  test('seedInfection moves population from S to I', () => {
    const r = new Region({ id: 'test', name: 'Test', totalPop: 1000 });
    const actual = r.seedInfection(5);
    expect(actual).toBe(5);
    expect(r.susceptible).toBe(995);
    expect(r.infected).toBe(5);
    expect(r.isDiscovered).toBe(true);
  });

  test('seedInfection caps at available susceptible', () => {
    const r = new Region({ id: 'test', name: 'Test', totalPop: 3 });
    const actual = r.seedInfection(10);
    expect(actual).toBe(3);
    expect(r.susceptible).toBe(0);
    expect(r.infected).toBe(3);
  });

  test('tick produces infections when I > 0', () => {
    const r = new Region({ id: 'test', name: 'Test', totalPop: 10000 });
    r.seedInfection(100);
    const result = r.tick(0.5, 0.01);
    expect(result.newInfected).toBeGreaterThan(0);
    expect(r.susceptible).toBeLessThan(9900);
  });

  test('tick with no infected produces no change', () => {
    const r = new Region({ id: 'test', name: 'Test', totalPop: 1000 });
    const result = r.tick(0.5, 0.01);
    expect(result.newInfected).toBe(0);
    expect(result.newRemoved).toBe(0);
  });

  test('tick respects boundary conditions', () => {
    const r = new Region({ id: 'test', name: 'Test', totalPop: 10 });
    r.seedInfection(10); // All infected
    const result = r.tick(0.5, 0.01);
    expect(result.newInfected).toBe(0);
    expect(r.susceptible).toBe(0);
    expect(r.infected).toBeLessThanOrEqual(10);
  });

  test('toJSON returns serializable snapshot', () => {
    const r = new Region({ id: 'test', name: 'Test', totalPop: 1000 });
    r.seedInfection(50);
    const json = r.toJSON();
    expect(json.id).toBe('test');
    expect(json.infected).toBe(50);
    expect(json.susceptible).toBe(950);
  });
});
