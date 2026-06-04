import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Tween, Color, Transform, Resource } from '@engine/protocol/components.js';
import { tweenCapability } from './tween.js';

function worldWithTween(): World {
  const w = new World();
  for (const s of tweenCapability.systems) w.addSystem(s);
  return w;
}
function addTween(w: World, eid: string, t: Partial<Tween> & Pick<Tween, 'target' | 'from' | 'to' | 'duration'>): void {
  w.addComponent(eid, {
    type: 'Tween',
    elapsed: 0,
    easing: 'linear',
    done: false,
    ...t,
  } as Tween);
}

describe('T1 tween — metadata', () => {
  it('id / 读 Tween / 写 Transform+Color+Resource', () => {
    expect(tweenCapability.id).toBe('t1-tween');
    expect(tweenCapability.components.reads).toEqual(['Tween']);
    expect(tweenCapability.components.writes).toEqual(['Transform', 'Color', 'Resource']);
  });
});

describe('T1 tween — 线性插值与收尾', () => {
  it('Color.alpha 从 0 线性插到 1（duration=4），逐帧推进并在终点 done', () => {
    const w = worldWithTween();
    w.createEntity('portrait');
    w.addComponent('portrait', { type: 'Color', tint: 0xffffff, alpha: 0 } as Color);
    addTween(w, 'portrait', { target: 'Color.alpha', from: 0, to: 1, duration: 4, easing: 'linear' });

    const alpha = () => w.getComponent<Color>('portrait', 'Color')!.alpha;
    w.tick();
    expect(alpha()).toBeCloseTo(0.25);
    w.tick();
    expect(alpha()).toBeCloseTo(0.5);
    w.tick();
    w.tick();
    expect(alpha()).toBeCloseTo(1);
    expect(w.getComponent<Tween>('portrait', 'Tween')!.done).toBe(true);
  });

  it('done 后锁定终值（幂等，不越过 to）', () => {
    const w = worldWithTween();
    w.createEntity('p');
    w.addComponent('p', { type: 'Color', tint: 0, alpha: 0 } as Color);
    addTween(w, 'p', { target: 'Color.alpha', from: 0, to: 1, duration: 2, easing: 'linear' });
    w.tick();
    w.tick(); // 到点 done
    w.tick(); // 额外 tick
    w.tick();
    expect(w.getComponent<Color>('p', 'Color')!.alpha).toBeCloseTo(1);
  });

  it('duration<=0 立即到 to', () => {
    const w = worldWithTween();
    w.createEntity('p');
    w.addComponent('p', { type: 'Transform', x: -100, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
    addTween(w, 'p', { target: 'Transform.x', from: -100, to: 0, duration: 0, easing: 'linear' });
    w.tick();
    expect(w.getComponent<Transform>('p', 'Transform')!.x).toBeCloseTo(0);
  });
});

describe('T1 tween — 缓动曲线', () => {
  it('easeIn(quad) 在中点低于线性', () => {
    const w = worldWithTween();
    w.createEntity('p');
    w.addComponent('p', { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
    addTween(w, 'p', { target: 'Transform.x', from: 0, to: 100, duration: 2, easing: 'easeIn' });
    w.tick(); // t=0.5 → easeIn = 0.25 → 25
    expect(w.getComponent<Transform>('p', 'Transform')!.x).toBeCloseTo(25);
  });

  it('easeOut(quad) 在中点高于线性', () => {
    const w = worldWithTween();
    w.createEntity('p');
    w.addComponent('p', { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
    addTween(w, 'p', { target: 'Transform.x', from: 0, to: 100, duration: 2, easing: 'easeOut' });
    w.tick(); // t=0.5 → easeOut = 0.75 → 75
    expect(w.getComponent<Transform>('p', 'Transform')!.x).toBeCloseTo(75);
  });
});

describe('T1 tween — Resource.current 尊重上下限', () => {
  it('插值越过 max 时被钳到 max', () => {
    const w = worldWithTween();
    w.createEntity('stat');
    w.addComponent('stat', { type: 'Resource', id: 'charm', current: 90, min: 0, max: 100 } as Resource);
    addTween(w, 'stat', { target: 'Resource.current', from: 90, to: 200, duration: 1, easing: 'linear' });
    w.tick(); // value=200 → 钳到 100
    expect(w.getComponent<Resource>('stat', 'Resource')!.current).toBe(100);
  });
});
