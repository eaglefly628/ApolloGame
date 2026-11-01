import type { Component } from '../../core/types.js';
/** Snapshot-owned static collision scene identity. This motor version rejects
 * moving/replaced obstacles instead of treating them as stationary each tick. */
export interface CharacterMotorEnvironment3D extends Component {
    readonly type: 'CharacterMotorEnvironment3D';
    readonly version: 1;
    readonly staticSceneCanonical: string;
}
