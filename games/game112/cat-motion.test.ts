import { describe, expect, it } from 'vitest';
import { imageMeshPoint } from '@zerocraft/engine/ui/components/image-mesh-motion.js';
import { SHOPKEEPER_REST_MOTION, XUETUAN_REST_MOTION, shopkeeperMotion, xuetuanMotion } from './cat-motion.js';

describe('Xuetuan local mesh presets', () => {
  it('binds only the seated picture with calibrated chest and tail regions', () => {
    expect(xuetuanMotion('/games/game112/art/cat/xuetuan-rest-v1.png')).toBe(XUETUAN_REST_MOTION);
    expect(xuetuanMotion('/games/game112/art/cat/xuetuan-notice-v1.png')).toBeUndefined();
    expect(xuetuanMotion('/games/game112/art/cat/other.png')).toBeUndefined();
    expect(XUETUAN_REST_MOTION.regions).toHaveLength(2);
  });

  it('keeps face, ears, torso and paws pinned through the loop', () => {
    for (const rig of [XUETUAN_REST_MOTION, xuetuanMotion('/games/game112/art/cat/xuetuan-rest-v1.png', true)!]) {
      for (let t = 0; t < rig.cycleMs; t += 215) {
        for (const [x, y] of [[0.33, 0.14], [0.39, 0.30], [0.48, 0.36], [0.67, 0.58], [0.18, 0.98], [0.34, 0.98], [0.52, 0.98]]) {
          expect(imageMeshPoint(rig, t, x, y)).toEqual([x, y]);
        }
        for (let row = 0; row < 36; row++) for (let col = 0; col < 36; col++) {
          const x = col / 36; const y = row / 36;
          const a = imageMeshPoint(rig, t, x, y);
          const b = imageMeshPoint(rig, t, x + 1 / 36, y);
          const c = imageMeshPoint(rig, t, x, y + 1 / 36);
          expect((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])).toBeGreaterThan(0);
        }
      }
    }
  });

  it('moves only the chest and tail with a closed, subtle cycle', () => {
    const rig = XUETUAN_REST_MOTION;
    expect(imageMeshPoint(rig, rig.cycleMs / 4, 0.36, 0.65)[1]).toBeLessThan(0.65);
    expect(imageMeshPoint(rig, rig.cycleMs / 8, 0.85, 0.83)[0]).toBeGreaterThan(0.85);
    for (const [x, y] of [[0.36, 0.65], [0.85, 0.83]]) {
      expect(imageMeshPoint(rig, 0, x, y)).toEqual([x, y]);
      expect(imageMeshPoint(rig, rig.cycleMs, x, y)[0]).toBeCloseTo(x, 8);
      expect(imageMeshPoint(rig, rig.cycleMs, x, y)[1]).toBeCloseTo(y, 8);
    }
  });
});

describe('shopkeeper local mesh preset', () => {
  it('binds only the source cutout, with a closed loop and stable face and paws', () => {
    const rig = SHOPKEEPER_REST_MOTION;
    expect(shopkeeperMotion('/games/game112/art/cat/shopkeeper-tortoiseshell-v1.png')).toBe(rig);
    expect(shopkeeperMotion('/games/game112/art/cat/other-cat.png')).toBeUndefined();
    expect(rig.regions).toHaveLength(2);
    for (let t = 0; t < rig.cycleMs; t += 211) {
      for (const [x, y] of [[0.50, 0.10], [0.75, 0.27], [0.80, 0.36], [0.66, 0.95], [0.86, 0.96]]) {
        expect(imageMeshPoint(rig, t, x, y)).toEqual([x, y]);
      }
      for (let row = 0; row < 36; row++) for (let col = 0; col < 36; col++) {
        const x = col / 36; const y = row / 36;
        const a = imageMeshPoint(rig, t, x, y);
        const b = imageMeshPoint(rig, t, x + 1 / 36, y);
        const c = imageMeshPoint(rig, t, x, y + 1 / 36);
        expect((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])).toBeGreaterThan(0);
      }
    }
    expect(imageMeshPoint(rig, rig.cycleMs / 4, 0.75, 0.62)[1]).toBeLessThan(0.62);
    expect(imageMeshPoint(rig, rig.cycleMs / 8, 0.13, 0.60)[0]).toBeGreaterThan(0.13);
    for (const [x, y] of [[0.75, 0.62], [0.13, 0.60]]) {
      expect(imageMeshPoint(rig, 0, x, y)).toEqual([x, y]);
      expect(imageMeshPoint(rig, rig.cycleMs, x, y)[0]).toBeCloseTo(x, 8);
      expect(imageMeshPoint(rig, rig.cycleMs, x, y)[1]).toBeCloseTo(y, 8);
    }
  });
});
