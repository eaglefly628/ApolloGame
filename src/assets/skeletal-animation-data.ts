import type { SkeletalAnimationSpec } from './asset-types.js';

/** Validate the E2 metadata contract without decoding assets or importing a renderer. */
export function parseSkeletalAnimationSpec(raw: unknown): SkeletalAnimationSpec {
  const fail = (message: string): never => { throw new Error(`skeletal-animation: ${message}`); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('spec must be an object');
  const spec = raw as Record<string, unknown>;
  for (const key of Object.keys(spec)) {
    if (!['skeleton', 'fps', 'frames', 'loop'].includes(key)) fail(`unknown spec field ${key}`);
  }
  if (spec.skeleton !== 'apollo-humanoid-v1') fail('skeleton must be apollo-humanoid-v1');
  if (!Number.isInteger(spec.fps) || (spec.fps as number) < 1 || (spec.fps as number) > 120)
    fail('fps must be an integer in 1..120');
  if (!Number.isInteger(spec.frames) || (spec.frames as number) < 2 || (spec.frames as number) > 36001)
    fail('frames must be an integer in 2..36001');
  if (typeof spec.loop !== 'boolean') fail('loop must be boolean');
  return { skeleton: 'apollo-humanoid-v1', fps: spec.fps as number, frames: spec.frames as number, loop: spec.loop as boolean };
}
