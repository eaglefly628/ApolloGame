import { afterEach, describe, expect, it } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { GAME112_NATIVE_CHARACTERS, XUETUAN_NATIVE_KEY } from './native-character.js';
import { setSkinOverrides } from './cat-art.js';
import { HallSession } from './session.js';
import { buildScene } from './ui.js';
import { ROOMS } from './world-data.js';

const walk = (n: LayoutNode): LayoutNode[] => [n, ...(n.children ?? []).flatMap(walk)];
afterEach(() => setSkinOverrides({}));
describe('Game112 consumes PUI native character data', () => {
  it('preserves procedural fallback until a same-origin static poster is available', () => {
    setSkinOverrides({});
    const scene = buildScene(new HallSession(112).hall(), 'hall');
    expect(walk(scene).find(n => n.id === 'hall-cat')?.type).toBe('Image');
    expect(validateLayoutNode(scene)).toEqual([]);
  });
  it('all room anchors, hit action and distinct sizes survive native projection', () => {
    setSkinOverrides({ 'game112/cat/xuetuan-rest': '/games/game112/art/cat/xuetuan-rest-v1.png' });
    const view = new HallSession(112).hall();
    for (const room of ROOMS) {
      const scene = buildScene(view, room.id);
      const nodes = walk(scene);
      const cat = nodes.find(n => n.id === 'hall-cat')!;
      expect(cat.type).toBe('NativeCharacter');
      expect(cat.props).toMatchObject({ assetKey: XUETUAN_NATIVE_KEY, clip: 'idle', loop: true, fit: 'contain' });
      expect(cat.layout).toEqual({ width: room.catSpot.w, height: room.catSpot.h, fx: [{ kind: 'glow', color: 'white', intensity: 0.1 }] });
      expect(nodes.find(n => n.id === 'hall-cat-wrap')).toMatchObject({ props: { action: 'cat.greet' }, layout: { x: room.catSpot.x, y: room.catSpot.y } });
      expect(validateLayoutNode(scene), room.id).toEqual([]);
    }
  });
  it('the opted-in host config stays on the shared local AssetIndex and runtime', () => {
    expect(GAME112_NATIVE_CHARACTERS.runtimeUrl).toBe('/native-character/index.html');
    expect(GAME112_NATIVE_CHARACTERS.index.assets.find(a => a.id === XUETUAN_NATIVE_KEY)).toMatchObject({ type: 'animation', spec: { format: 'stretch' }, provenance: { localOnly: true, modelReady: false } });
  });
});
