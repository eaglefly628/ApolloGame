import { describe, expect, it } from 'vitest';
import { modelMotionSpeed, modelYawFromFaceDir, turnModelYaw } from './model-motion.js';

describe('3D ground model motion', () => {
  it('faces the model head along its ground velocity', () => {
    const face = (x: number, y: number) => modelYawFromFaceDir({ type: 'FaceDir', x, y }, 0);
    expect(face(0, 1)).toBe(0);
    expect(face(1, 0)).toBeCloseTo(Math.PI / 2);
    expect(face(-1, 0)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(face(0, -1))).toBeCloseTo(Math.PI);
    expect(modelYawFromFaceDir({ type: 'FaceDir', x: 0, y: 0 }, .7)).toBe(.7);
  });

  it('turns across the ±π seam on the short arc', () => {
    const from = Math.PI - .1;
    const to = -Math.PI + .1;
    expect(turnModelYaw(from, to, .05)).toBeCloseTo(from + .05);
    expect(turnModelYaw(from, to, .3)).toBe(to);
  });

  it('pauses the gait when stopped and scales it with travel speed', () => {
    const anim = { type: 'AnimState3D' as const, clip: 'walk', speed: 1, speedAtVelocity: .05 };
    const velocity = (vx: number) => ({ type: 'Velocity' as const, vx, vy: 0, angular: 0 });
    expect(modelMotionSpeed(anim, velocity(0))).toBe(0);
    expect(modelMotionSpeed(anim, velocity(.025))).toBeCloseTo(.5);
    expect(modelMotionSpeed(anim, velocity(.05))).toBeCloseTo(1);
  });
});
