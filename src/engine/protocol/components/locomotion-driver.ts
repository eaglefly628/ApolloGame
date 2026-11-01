import type { Component } from '../../core/types.js';
import type { LocomotionPlayback, LocomotionCommand, LocomotionDriver3D as DriverConfiguration } from '../../animation/locomotion-driver.js';
import type { GaitPlantEvent } from '../../animation/gait-phase.js';
export interface LocomotionDriver3D extends Component, DriverConfiguration {
    readonly type: 'LocomotionDriver3D';
}
export interface LocomotionPlayback3D extends Component {
    readonly type: 'LocomotionPlayback3D';
    readonly version: 1;
    readonly playback: LocomotionPlayback;
    /** Fixed-tick plant events are snapshot-owned. Renderer never routes gameplay. */
    readonly events: readonly GaitPlantEvent[];
}
export interface LocomotionCommand3D extends Component {
    readonly type: 'LocomotionCommand3D';
    readonly version: 1;
    readonly commands: readonly LocomotionCommand[];
}
