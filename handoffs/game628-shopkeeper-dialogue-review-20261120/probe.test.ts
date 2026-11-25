import {describe, expect, it} from 'vitest';
import {World} from '../../src/engine/core/world.js';
import {dialogueCapability} from '../../src/skills/tier3/dialogue.js';
import {zoneOccupancyCapability} from '../../src/skills/tier2/zone-occupancy.js';
import {applyMovement, applyRawActions} from '../../src/net/commands.js';
import {renderNode, apolloOnyx} from '../../src/ui/components/index.js';
import type {Component} from '../../src/engine/core/types.js';

// Contract probes for the existing engine. These deliberately do not implement
// target selection or a game-specific dialogue interpreter.
function add(world: World, id: string, components: Component[]) {
  world.createEntity(id);
  for (const component of components) world.addComponent(id, component);
}

function dialogueWorld() {
  const world = new World();
  for (const system of dialogueCapability.systems) world.addSystem(system);
  add(world, 'bakery', [
    {type: 'DialogueScript', fsmId: 'bakery', nodes: {
      greeting: {kind: 'line', speaker: '面包房店主', text: '早上好，面包刚刚出炉。', next: 'ask'},
      ask: {kind: 'choice', prompt: '想聊什么？', options: [{text: '今天忙吗？', next: 'goodbye'}]},
      goodbye: {kind: 'line', speaker: '面包房店主', text: '等会儿见。', next: null},
    }},
    {type: 'State', fsmId: 'bakery', current: 'greeting', previous: ''},
  ] as Component[]);
  return world;
}

function action(world: World, phase: string, key = 'dialogue.advance') {
  applyRawActions(world, [{playerId: 'p1', tick: 1, move: {dx: 0, dy: 0},
    actions: [{source: 'p1', key, phase}]}]);
  world.tick();
}

const node = (world: World, id = 'bakery') => world.getComponent<any>(id, 'State')!.current;

describe('Game628 shopkeeper existing-consumer contract probes', () => {
  it('keyboard down actions alone do not advance, whereas queued action phase does', () => {
    const world = dialogueWorld();
    action(world, 'down');
    expect(node(world)).toBe('greeting');
    action(world, 'action');
    expect(node(world)).toBe('ask');
  });

  it('coalesces duplicate advance actions within a tick', () => {
    const world = dialogueWorld();
    applyRawActions(world, [{playerId: 'p1', tick: 1, move: {dx: 0, dy: 0}, actions: [
      {source: 'p1', key: 'dialogue.advance', phase: 'action'},
      {source: 'p1', key: 'dialogue.advance', phase: 'action'},
    ]}]);
    world.tick();
    expect(node(world)).toBe('ask');
  });

  it('broadcasts an advance to both valid dialogue machines', () => {
    const world = dialogueWorld();
    add(world, 'other-shop', [
      {type: 'DialogueScript', fsmId: 'other-shop', nodes: {
        first: {kind: 'line', speaker: '另一位店主', text: '你好。', next: 'second'},
        second: {kind: 'line', speaker: '另一位店主', text: '再见。', next: null},
      }},
      {type: 'State', fsmId: 'other-shop', current: 'first', previous: ''},
    ] as Component[]);
    action(world, 'action');
    expect(node(world)).toBe('ask');
    expect(node(world, 'other-shop')).toBe('second');
  });

  it('a terminal line and a cancel action do not automatically close the machine', () => {
    const world = dialogueWorld();
    world.getComponent<any>('bakery', 'State')!.current = 'goodbye';
    action(world, 'action');
    expect(node(world)).toBe('goodbye');
    action(world, 'action', 'dialogue.cancel');
    expect(node(world)).toBe('goodbye');
  });

  it('the range Zone stays occupied after facing reverses', () => {
    const world = new World();
    for (const system of zoneOccupancyCapability.systems) world.addSystem(system);
    add(world, 'player', [
      {type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1},
      {type: 'FaceDir', x: 1, y: 0},
    ] as Component[]);
    add(world, 'near-flag', [{type: 'Flag', id: 'near', active: false}] as Component[]);
    add(world, 'range', [{type: 'Zone', outFlag: 'near', minX: -1, maxX: 1,
      minY: -1, maxY: 1, requiredEntities: ['player']}] as Component[]);
    world.tick();
    expect(world.getComponent<any>('near-flag', 'Flag')!.active).toBe(true);
    world.getComponent<any>('player', 'FaceDir')!.x = -1;
    world.getComponent<any>('player', 'Transform')!.scaleX = -1;
    world.tick();
    expect(world.getComponent<any>('near-flag', 'Flag')!.active).toBe(true);
    world.getComponent<any>('player', 'Transform')!.x = 3;
    world.tick();
    expect(world.getComponent<any>('near-flag', 'Flag')!.active).toBe(false);
  });

  it('a valid dialogue does not implicitly block movement input', () => {
    const world = dialogueWorld();
    add(world, 'player', [
      {type: 'Controllable', playerId: 'p1', speed: 0.1},
      {type: 'Velocity', vx: 0, vy: 0},
    ] as Component[]);
    applyMovement(world, [{playerId: 'p1', tick: 1, move: {dx: 1, dy: 0}}]);
    expect(world.getComponent<any>('player', 'Velocity')!.vx).toBeGreaterThan(0);
    expect(node(world)).toBe('greeting');
  });

  it('the dialog panel has a pointer action and requires separate keyboard/focus wiring', () => {
    const html = renderNode({type: 'dialog', id: 'talk', props: {
      speaker: '面包房店主', text: '早上好。', kind: 'line',
    }}, apolloOnyx);
    expect(html).toContain('data-action="dialogue.advance"');
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('<button');
  });
});
