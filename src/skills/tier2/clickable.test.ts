import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Transform, Shape, Sprite, Signal, Camera, InputQueue, Clickable, RawInputData } from '@engine/protocol/components.js';
import { clickableCapability } from './clickable.js';

function worldWithClickable(): World {
  const w = new World();
  for (const s of clickableCapability.systems) w.addSystem(s);
  return w;
}

function setInput(w: World, actions: RawInputData[]): void {
  const e = 'input';
  if (!w.hasComponent(e, 'InputQueue')) w.createEntity(e);
  w.addComponent(e, { type: 'InputQueue', actions } as InputQueue);
}

function setCamera(w: World, offsetX: number, offsetY: number, zoom: number, vw: number, vh: number): void {
  const e = 'cam';
  if (!w.hasComponent(e, 'Camera')) w.createEntity(e);
  w.addComponent(e, { type: 'Camera', zoom, offsetX, offsetY, rotation: 0, viewportW: vw, viewportH: vh } as Camera);
}

function box(w: World, eid: string, x: number, y: number, width: number, height: number, action: string, opts: { phase?: string; z?: number; scaleX?: number } = {}): void {
  if (!w.hasComponent(eid, 'Transform')) w.createEntity(eid);
  w.addComponent(eid, { type: 'Transform', x, y, rotation: 0, scaleX: opts.scaleX ?? 1, scaleY: 1 } as Transform);
  w.addComponent(eid, { type: 'Shape', kind: 'box', width, height } as Shape);
  w.addComponent(eid, { type: 'Clickable', action, phase: opts.phase } as Clickable);
  if (opts.z !== undefined) w.addComponent(eid, { type: 'Sprite', textureKey: '', anchorX: 0.5, anchorY: 0.5, zOrder: opts.z } as Sprite);
}

function down(x: number, y: number): RawInputData {
  return { source: 'p1', x, y, phase: 'down' };
}

function sig(w: World, eid: string): string | undefined {
  return w.getComponent<Signal>(eid, 'Signal')?.name;
}

describe('T2 clickable — metadata', () => {
  it('id / 读 Clickable+几何+输入 / 写 Signal / 排在 event-when 后', () => {
    expect(clickableCapability.id).toBe('t2-clickable');
    expect(clickableCapability.components.writes).toEqual(['Signal']);
    expect(clickableCapability.components.reads).toContain('InputQueue');
    expect(clickableCapability.systems[0].runsAfter).toContain('event-when');
  });
});

describe('T2 clickable — 无相机：屏幕即世界', () => {
  it('命中 → 在命中实体上产出 Signal{name:action,source:自身}', () => {
    const w = worldWithClickable();
    box(w, 'btn', 100, 100, 80, 40, 'craft_apron');
    setInput(w, [down(100, 100)]);
    w.tick();
    expect(sig(w, 'btn')).toBe('craft_apron');
    expect(w.getComponent<Signal>('btn', 'Signal')?.source).toBe('btn');
  });

  it('未命中（点在框外）→ 无 Signal', () => {
    const w = worldWithClickable();
    box(w, 'btn', 100, 100, 80, 40, 'craft_apron');
    setInput(w, [down(500, 500)]);
    w.tick();
    expect(w.hasComponent('btn', 'Signal')).toBe(false);
  });
});

describe('T2 clickable — 相机逆投影', () => {
  it('点屏幕中心 → 世界相机中心命中；缩放/平移正确换算', () => {
    const w = worldWithClickable();
    setCamera(w, 0, 0, 1, 800, 600); // 中心(0,0)，视口 800x600
    box(w, 'cell', 0, 0, 50, 50, 'cell');
    setInput(w, [down(400, 300)]); // 屏幕中心 → 世界(0,0)
    w.tick();
    expect(sig(w, 'cell')).toBe('cell');
  });

  it('zoom=2：屏幕(500,300) → 世界(50,0)', () => {
    const w = worldWithClickable();
    setCamera(w, 0, 0, 2, 800, 600);
    box(w, 'cell', 50, 0, 20, 20, 'cell');
    setInput(w, [down(500, 300)]); // (500-400)/2 + 0 = 50
    w.tick();
    expect(sig(w, 'cell')).toBe('cell');
  });
});

describe('T2 clickable — 相位 / 最上层 / 信号清扫', () => {
  it('phase 不匹配不触发；匹配才触发', () => {
    const w = worldWithClickable();
    box(w, 'btn', 0, 0, 100, 100, 'release', { phase: 'up' });
    setInput(w, [down(0, 0)]); // down ≠ up
    w.tick();
    expect(w.hasComponent('btn', 'Signal')).toBe(false);
    setInput(w, [{ source: 'p1', x: 0, y: 0, phase: 'up' }]);
    w.tick();
    expect(sig(w, 'btn')).toBe('release');
  });

  it('重叠命中只触发最上层（zOrder 最大）', () => {
    const w = worldWithClickable();
    box(w, 'low', 0, 0, 100, 100, 'low', { z: 0 });
    box(w, 'high', 0, 0, 100, 100, 'high', { z: 10 });
    setInput(w, [down(0, 0)]);
    w.tick();
    expect(sig(w, 'high')).toBe('high');
    expect(w.hasComponent('low', 'Signal')).toBe(false);
  });

  it('下一帧无输入 → 上帧 Signal 被清', () => {
    const w = worldWithClickable();
    box(w, 'btn', 0, 0, 100, 100, 'go');
    setInput(w, [down(0, 0)]);
    w.tick();
    expect(sig(w, 'btn')).toBe('go');
    setInput(w, []);
    w.tick();
    expect(w.hasComponent('btn', 'Signal')).toBe(false);
  });
});
