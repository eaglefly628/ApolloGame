import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import { collectRenderables, AsciiRenderer } from './index.js';
import type { Transform, Shape, Sprite, Visibility } from '@engine/protocol/components.js';

function addTransform(w: World, id: string, x: number, y: number) {
  w.createEntity(id);
  const t: Transform = { type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 };
  w.addComponent(id, t);
}

describe('renderer · collectRenderables', () => {
  it('collects visible Transform entities sorted by zOrder', () => {
    const w = new World();
    addTransform(w, 'a', 0, 0);
    w.addComponent('a', { type: 'Sprite', textureKey: 'a', anchorX: 0.5, anchorY: 0.5, zOrder: 5 } as Sprite);
    addTransform(w, 'b', 1, 1);
    w.addComponent('b', { type: 'Sprite', textureKey: 'b', anchorX: 0.5, anchorY: 0.5, zOrder: 1 } as Sprite);

    expect(collectRenderables(w).map((r) => r.entityId)).toEqual(['b', 'a']);
  });

  it('skips entities hidden by Visibility.visible=false', () => {
    const w = new World();
    addTransform(w, 'ghost', 0, 0);
    w.addComponent('ghost', { type: 'Visibility', visible: false, active: true } as Visibility);
    expect(collectRenderables(w)).toHaveLength(0);
  });
});

describe('renderer · AsciiRenderer', () => {
  it('projects a box onto the character grid', () => {
    const w = new World();
    addTransform(w, 'wall', 90, 0);
    w.addComponent('wall', { type: 'Shape', kind: 'box', width: 10, height: 10 } as Shape);

    const out = new AsciiRenderer({ width: 10, height: 1, worldWidth: 100, worldHeight: 100 }).render(w);
    expect(out).toContain('#');
    expect(out.length).toBe(10);
  });

  it('prefers the sprite glyph over the shape glyph', () => {
    const w = new World();
    addTransform(w, 'bullet', 0, 0);
    w.addComponent('bullet', { type: 'Shape', kind: 'box', width: 4, height: 4 } as Shape);
    w.addComponent('bullet', { type: 'Sprite', textureKey: 'bullet', anchorX: 0.5, anchorY: 0.5, zOrder: 1 } as Sprite);

    const out = new AsciiRenderer({ width: 4, height: 1, worldWidth: 10, worldHeight: 10 }).render(w);
    expect(out).toContain('B');
  });
});
