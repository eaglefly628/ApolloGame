import { describe, expect, it } from 'vitest';
import { imageMeshPoint } from '@zerocraft/engine/ui/components/image-mesh-motion.js';
import { XUETUAN_NOTICE_MOTION, XUETUAN_REST_MOTION, xuetuanMotion } from './cat-motion.js';

describe('Xuetuan local mesh presets', () => {
  it('binds only the two authored pictures', () => {
    expect(xuetuanMotion('/games/game112/art/cat/xuetuan-rest-v1.png')).toBe(XUETUAN_REST_MOTION);
    expect(xuetuanMotion('/games/game112/art/cat/xuetuan-notice-v1.png')).toBe(XUETUAN_NOTICE_MOTION);
    expect(xuetuanMotion('/games/game112/art/cat/other.png')).toBeUndefined();
  });

  it('keeps floor contact and mesh orientation through both loops', () => {
    for (const rig of [XUETUAN_REST_MOTION, XUETUAN_NOTICE_MOTION]) {
      for (let t = 0; t < rig.cycleMs; t += 215) {
        for (const x of [0.18, 0.34, 0.52]) expect(imageMeshPoint(rig, t, x, 0.98)).toEqual([x, 0.98]);
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
});
