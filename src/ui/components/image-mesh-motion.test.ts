import { describe, expect, it } from 'vitest';
import { imageMeshPoint, parseImageMeshMotion } from './image-mesh-motion.js';
import { renderNode } from './render.js';
import type { ImageMeshMotion } from './types.js';

const RIG: ImageMeshMotion = {
  cycleMs: 4600,
  regions: [
    { center: [0.39, 0.59], radius: [0.34, 0.32], move: [0, -0.013], scale: [0.05, 0.04] },
    { center: [0.85, 0.84], radius: [0.22, 0.16], move: [0.055, -0.018], harmonic: 2 },
  ],
};

describe('Image local mesh motion', () => {
  it('renders a WebGL layer over a permanent static fallback', () => {
    const html = renderNode({ type: 'Image', id: 'cat', props: { src: '/cat.png', alt: 'cat', fit: 'contain', meshMotion: RIG }, layout: { width: 154, height: 141 } });
    expect(html).toContain('data-image-mesh=');
    expect(html).toContain('data-mesh-poster');
    expect(html).toContain('data-mesh-canvas');
    expect(html).toContain('aria-label="cat"');
  });

  it('rejects oversized or malformed rigs and keeps motion bounded', () => {
    expect(parseImageMeshMotion('{')).toBeUndefined();
    expect(parseImageMeshMotion(JSON.stringify({ cycleMs: 100, regions: RIG.regions }))).toBeUndefined();
    expect(parseImageMeshMotion(JSON.stringify({ cycleMs: 4600, regions: [{ center: [0.5, 0.5], radius: [0.3, 0.3], move: [3, 0] }] }))).toBeUndefined();
    expect(parseImageMeshMotion(JSON.stringify(RIG))).toBeDefined();
  });

  it('keeps paws pinned, closes the loop, and moves the tail independently', () => {
    const rig = RIG;
    for (const t of [0, 500, 1150, 2300, 3450, 4600]) {
      expect(imageMeshPoint(rig, t, 0.34, 0.94)).toEqual([0.34, 0.94]);
      expect(imageMeshPoint(rig, t, 0.52, 0.94)).toEqual([0.52, 0.94]);
    }
    for (const [x, y] of [[0.39, 0.59], [0.85, 0.84], [0.33, 0.16]]) {
      const a = imageMeshPoint(rig, 0, x, y);
      const b = imageMeshPoint(rig, rig.cycleMs, x, y);
      expect(b[0]).toBeCloseTo(a[0], 8);
      expect(b[1]).toBeCloseTo(a[1], 8);
    }
    expect(imageMeshPoint(rig, 0, 0.85, 0.84)[0]).not.toBeCloseTo(imageMeshPoint(rig, 575, 0.85, 0.84)[0], 3);
  });

  it('does not fold mesh cells during the cycle', () => {
    for (const rig of [RIG]) for (let t = 0; t < rig.cycleMs; t += 230) {
      for (let row = 0; row < 36; row++) for (let col = 0; col < 36; col++) {
        const x = col / 36; const y = row / 36;
        const a = imageMeshPoint(rig, t, x, y);
        const b = imageMeshPoint(rig, t, x + 1 / 36, y);
        const c = imageMeshPoint(rig, t, x, y + 1 / 36);
        const signedArea = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        expect(signedArea).toBeGreaterThan(0);
      }
    }
  });
});
