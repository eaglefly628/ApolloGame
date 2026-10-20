import { validateCameraShot3D, validateCameraShotCarrier } from '@engine/protocol/components/camera-shot.js';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

/** Validate every table without changing legacy first-camera selection semantics. */
export function validateCameraShots(entities: Record<string, unknown>): void {
  for (const [id, raw] of Object.entries(entities)) {
    if (!object(raw) || !Object.hasOwn(raw, 'CameraShot3D')) continue;
    try {
      validateCameraShot3D(raw.CameraShot3D);
      validateCameraShotCarrier(raw.Camera3D);
    } catch (error) {
      const message = `camera-shots: ${id}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(`[camera-shots] reject: ${message}`);
      throw new Error(message);
    }
  }
}
