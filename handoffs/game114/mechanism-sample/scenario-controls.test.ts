import { describe, expect, it } from 'vitest';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { validateLayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { oxTemplateIds, sampleBlueprint } from './scene';
import { buildControls } from './controls-ui';
import { ScenarioControls } from './scenario-controls';
import { contactBetween } from '@zerocraft/engine/engine/spatial/contact.js';
import type { CrowdAvoidance, FlowAgent, FlowField, Line3D, PathFollow, Shape, Transform } from '@zerocraft/engine/engine/protocol/components.js';

describe('game114 crowd stress controls', () => {
  it('gives replan slots to reachable oxen when outer candidates cannot enter the grid', () => {
    const blueprint = { ...sampleBlueprint, entities: structuredClone(sampleBlueprint.entities) };
    for (const [index, id] of oxTemplateIds.upper.entries()) {
      const ox = blueprint.entities[id]!;
      const transform = ox.Transform as unknown as Transform;
      transform.x = index < 2 ? 40 : 12;
    }
    const engine = new Engine();
    engine.load(blueprint);
    engine.world.tick();
    const planned = oxTemplateIds.upper.filter(id =>
      !!engine.world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')?.repathPath);
    expect(planned).toHaveLength(2);
    expect(planned.every(id => oxTemplateIds.upper.indexOf(id) >= 2)).toBe(true);
  });

  it('keeps a paused cached route in its replan slot until the ox resumes', () => {
    const blueprint = { ...sampleBlueprint, entities: structuredClone(sampleBlueprint.entities) };
    for (const id of oxTemplateIds.upper) {
      (blueprint.entities[id]!.Transform as unknown as Transform).x = 4;
    }
    const engine = new Engine();
    engine.load(blueprint);
    const active = () => oxTemplateIds.upper.filter(id =>
      !!engine.world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')?.repathPath);
    engine.world.tick();
    const initial = active();
    expect(initial).toHaveLength(2);
    const paused = initial[0]!;
    const path = engine.world.getComponent<PathFollow>(paused, 'PathFollow')!;
    const speed = path.speed;
    path.speed = 0;
    engine.world.tick();
    expect(active()).toEqual(initial);
    path.speed = speed;
    engine.world.tick();
    expect(active()).toEqual(initial);
  });

  it('does not spend replan slots on units using legacy flow avoidance', () => {
    const blueprint = { ...sampleBlueprint, entities: structuredClone(sampleBlueprint.entities) };
    for (const id of oxTemplateIds.upper) {
      (blueprint.entities[id]!.Transform as unknown as Transform).x = 4;
    }
    const engine = new Engine();
    engine.load(blueprint);
    const legacy = [oxTemplateIds.upper[0]!, oxTemplateIds.upper[4]!];
    for (const id of legacy) engine.world.addComponent(id,
      { type: 'FlowAgent', fieldId: 'ox-flow-vertical', speed: .07, orca: { radius: .8 } } as FlowAgent);
    engine.world.tick();
    const planned = oxTemplateIds.upper.filter(id =>
      !!engine.world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')?.repathPath);
    expect(planned).toHaveLength(2);
    expect(planned.every(id => !legacy.includes(id))).toBe(true);
  });

  it('releases a cached route when an ox switches temporarily to legacy avoidance', () => {
    const blueprint = { ...sampleBlueprint, entities: structuredClone(sampleBlueprint.entities) };
    for (const id of oxTemplateIds.upper) {
      (blueprint.entities[id]!.Transform as unknown as Transform).x = 4;
    }
    const engine = new Engine();
    engine.load(blueprint);
    const active = () => oxTemplateIds.upper.filter(id =>
      !!engine.world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')?.repathPath);
    engine.world.tick();
    const initial = active();
    expect(initial).toHaveLength(2);
    const toggled = initial[0]!;
    engine.world.addComponent(toggled,
      { type: 'FlowAgent', fieldId: 'ox-flow-vertical', speed: .07, orca: { radius: .8 } } as FlowAgent);
    engine.world.tick();
    expect(active()).toHaveLength(2);
    expect(active()).not.toContain(toggled);
    engine.world.removeComponent(toggled, 'FlowAgent');
    engine.world.tick();
    expect(active()).toHaveLength(2);
  });

  it('trims excess cached routes when the replan slot limit is restored', () => {
    const blueprint = { ...sampleBlueprint, entities: structuredClone(sampleBlueprint.entities) };
    for (const id of oxTemplateIds.upper) {
      (blueprint.entities[id]!.Transform as unknown as Transform).x = 4;
    }
    const engine = new Engine();
    engine.load(blueprint);
    const active = () => oxTemplateIds.upper.filter(id =>
      !!engine.world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')?.repathPath);
    engine.world.tick();
    const initial = active();
    expect(initial).toHaveLength(2);
    const toggled = engine.world.getComponent<CrowdAvoidance>(initial[0]!, 'CrowdAvoidance')!;
    delete toggled.flowGuide!.edgeRepathSlots;
    engine.world.tick();
    expect(active().length).toBeGreaterThan(2);
    toggled.flowGuide!.edgeRepathSlots = 2;
    engine.world.tick();
    expect(active()).toHaveLength(2);
  });

  it('doubles live oxen, hides/restores debug lines, and removes only the requested agents', () => {
    const engine = new Engine();
    engine.load(sampleBlueprint);
    const controls = new ScenarioControls(engine.world);
    expect(controls.state).toEqual({ oxen: 16, linesVisible: true, flowView: 'off', flowMarks: 0, occupancyMarks: 0, occupancyPenalty: 0 });
    expect(validateLayoutNode(buildControls(controls.state))).toEqual([]);

    controls.dispatch('scenario.double');
    expect(controls.state.oxen).toBe(32);
    expect(engine.world.query('CrowdAvoidance')).toHaveLength(33);
    expect(engine.world.query('Line3D')).toHaveLength(3 + 33 * 4);
    for (const [id] of engine.world.query('Shape', 'Transform')) {
      if (!id.startsWith('stress-ox-')) continue;
      const shape = engine.world.getComponent<Shape>(id, 'Shape')!;
      const transform = engine.world.getComponent<Transform>(id, 'Transform')!;
      for (const [otherId] of engine.world.query('Shape', 'Transform')) {
        if (otherId === id) continue;
        const otherShape = engine.world.getComponent<Shape>(otherId, 'Shape')!;
        const otherTransform = engine.world.getComponent<Transform>(otherId, 'Transform')!;
        expect(contactBetween(transform, shape, otherTransform, otherShape), `${id}/${otherId} spawned in collision`).toBeNull();
      }
    }

    controls.dispatch('scenario.lines');
    expect(engine.world.query('Line3D')).toHaveLength(0);
    engine.world.tick();
    controls.dispatch('scenario.lines');
    expect(engine.world.query('Line3D')).toHaveLength(3 + 33 * 4);

    controls.dispatch('scenario.remove');
    expect(controls.state.oxen).toBe(28);
    expect(engine.world.query('CrowdAvoidance')).toHaveLength(29);
    expect(engine.world.query('Line3D')).toHaveLength(3 + 29 * 4);
    controls.dispatch('scenario.add');
    expect(controls.state.oxen).toBe(32);
    expect(validateLayoutNode(buildControls(controls.state))).toEqual([]);

    for (let n = 0; n < 8; n++) controls.dispatch('scenario.remove');
    expect(controls.state.oxen).toBe(0);
    controls.dispatch('scenario.add');
    expect(controls.state.oxen).toBe(4);
    expect(engine.world.query('Line3D')).toHaveLength(3 + 5 * 4);
    const actual = engine.world.query('Line3D').find(([id]) => id.startsWith('crowd-vector-stress-ox-') && id.endsWith(':actual'));
    expect(actual).toBeDefined();
    expect(engine.world.getComponent<Line3D>(actual![0], 'Line3D')).toMatchObject({ color: 0x7aff75, width: .065 });
  });

  it('cycles sampled flow fields independently of the RVO line toggle', () => {
    const engine = new Engine();
    engine.load(sampleBlueprint);
    const controls = new ScenarioControls(engine.world);
    controls.dispatch('scenario.flow');
    expect(controls.state.flowView).toBe('vertical');
    expect(controls.state.occupancyPenalty).toBe(.45);
    expect(controls.state.flowMarks).toBe(0); // Grid output arrives on the first tick.
    engine.world.tick();
    expect(controls.ensureFlowView()).toBe(true);
    expect(controls.state.flowMarks).toBeGreaterThan(20);
    expect(controls.state.occupancyMarks).toBeGreaterThan(0);
    expect(validateLayoutNode(buildControls(controls.state))).toEqual([]);
    const verticalCount = controls.state.flowMarks;
    expect(engine.world.query('Line3D').filter(([id]) => id.startsWith('flow-debug-'))).toHaveLength(verticalCount);
    expect(engine.world.query('Line3D').filter(([id]) => id.startsWith('flow-cost-'))).toHaveLength(controls.state.occupancyMarks);
    const arrow = engine.world.query('Line3D').find(([id]) => id.startsWith('flow-debug-vertical-'));
    expect(arrow && engine.world.getComponent<Line3D>(arrow[0], 'Line3D')!.points.length).toBeGreaterThan(0);

    const before = new Map(engine.world.query('Line3D').filter(([id]) => id.startsWith('flow-debug-vertical-'))
      .map(([id]) => [id, JSON.stringify(engine.world.getComponent<Line3D>(id, 'Line3D')!.points)]));
    const field = engine.world.getComponent<FlowField>('ox-flow-vertical', 'FlowField')!;
    field.goals = [{ x: 0, y: 15 }];
    expect(controls.ensureFlowView()).toBe(true);
    expect(engine.world.query('Line3D').some(([id]) => before.has(id) &&
      JSON.stringify(engine.world.getComponent<Line3D>(id, 'Line3D')!.points) !== before.get(id))).toBe(true);

    const baseCost = engine.world.getComponent<FlowField>('ox-flow-vertical', 'FlowField')!.cost!.slice();
    const oldCostLines = new Set(engine.world.query('Line3D').filter(([id]) => id.startsWith('flow-cost-')).map(([id]) => id));
    const oxId = oxTemplateIds.upper[2]!;
    const ox = engine.world.getComponent<Transform>(oxId, 'Transform')!;
    ox.x += 13;
    for (let n = 0; n < 8; n++) controls.ensureFlowView();
    const newCostLines = new Set(engine.world.query('Line3D').filter(([id]) => id.startsWith('flow-cost-')).map(([id]) => id));
    expect([...newCostLines].some(id => !oldCostLines.has(id))).toBe(true);
    expect(engine.world.getComponent<FlowField>('ox-flow-vertical', 'FlowField')!.cost).toEqual(baseCost);

    controls.dispatch('scenario.lines');
    expect(engine.world.query('Line3D')).toHaveLength(controls.state.flowMarks + controls.state.occupancyMarks);
    controls.dispatch('scenario.flow');
    expect(controls.state.flowView).toBe('horizontal');
    expect(engine.world.query('Line3D').some(([id]) => id.startsWith('flow-debug-vertical-'))).toBe(false);
    controls.dispatch('scenario.flow');
    expect(controls.state.flowView).toBe('cart');
    expect(controls.state.occupancyPenalty).toBe(.2);
    controls.dispatch('scenario.flow');
    expect(controls.state).toMatchObject({ flowView: 'off', flowMarks: 0, occupancyMarks: 0 });
    expect(engine.world.query('Line3D')).toHaveLength(0);
  });
});
