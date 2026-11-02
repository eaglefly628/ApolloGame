import { describe, expect, it } from 'vitest';
import type { CharacterMotor3D, CharacterMotorPlayback3D } from '@engine/protocol/components/character-motor.js';
import { prepareRootMotionWorldStep } from './root-motion-plan.js';

describe('root motion transaction admission', () => {
  it('leaves ordinary motors untouched without inspecting unrelated state', () => {
    const reads: string[] = [];
    const view = { getComponent<T>(_id: string, type: string): T | undefined {
      reads.push(type);
      if (!['RootMotion3D', 'RootMotionSource3D', 'RootMotionPlayback3D'].includes(type)) throw Error('unrelated read');
      return undefined;
    } };
    expect(prepareRootMotionWorldStep(view, 'actor', {} as CharacterMotor3D, {} as CharacterMotorPlayback3D, {})).toBeUndefined();
    expect(reads).toEqual(['RootMotion3D', 'RootMotionSource3D', 'RootMotionPlayback3D']);
  });

  it.each(['RootMotionSource3D', 'RootMotionPlayback3D'])('refuses an orphan %s before a motor step', type => {
    const view = { getComponent<T>(_id: string, key: string): T | undefined {
      return key === type ? { type } as T : undefined;
    } };
    expect(() => prepareRootMotionWorldStep(view, 'actor', {} as CharacterMotor3D, {} as CharacterMotorPlayback3D, {})).toThrow('orphan source/playback');
  });
});
