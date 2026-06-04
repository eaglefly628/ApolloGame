import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Tween, Color, Transform } from '@engine/protocol/components.js';
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
  it('id / 读 Tween / 只写 Transform+Color（逻辑数值不走 tween，Gemini Q6）', () => {
    expect(tweenCapability.id).toBe('t1-tween');
    expect(tweenCapability.components.reads).toEqual(['Tween']);
    expect(tweenCapability.components.writes).toEqual(['Transform', 'Color']);
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
    // 完成即移除 Tween（防僵尸空赋值，Reviewer #2）。
    expect(w.hasComponent('portrait', 'Tween')).toBe(false);
  });

  it('完成后 Tween 被移除，终值精确锁定且后续 tick 不再变', () => {
    const w = worldWithTween();
    w.createEntity('p');
    w.addComponent('p', { type: 'Color', tint: 0, alpha: 0 } as Color);
    addTween(w, 'p', { target: 'Color.alpha', from: 0, to: 1, duration: 2, easing: 'linear' });
    w.tick();
    w.tick(); // 到点：写终值 + 移除
    expect(w.hasComponent('p', 'Tween')).toBe(false);
    expect(w.getComponent<Color>('p', 'Color')!.alpha).toBeCloseTo(1);
    w.tick(); // 无 Tween，不再变
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

