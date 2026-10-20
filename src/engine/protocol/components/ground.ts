import type { Component, EntityId } from '../../core/types.js';

/** E5 load-time output. Coordinates/heights are integer 1/10000 metre units.
 * Each nine triangle entries are world XYZ; row-major buckets index triangles.
 * JSON data, including static geometry, participates in snapshot/hash. */
export interface GroundSurface3D extends Component {
  readonly type: 'GroundSurface3D';
  originXQ: number;
  originZQ: number;
  cellSizeQ: number;
  cols: number;
  rows: number;
  triangles: readonly number[];
  supportIds: ReadonlyArray<readonly EntityId[]>;
  offsets: readonly number[];
  indices: readonly number[];
}

/** Opt-in planar character; never reads render-only Transform3D. */
export interface GroundWalker3D extends Component {
  readonly type: 'GroundWalker3D';
  surfaceId: EntityId;
  maxStepUpQ?: number;
  maxStepDownQ?: number;
}

/** Last accepted position is serialized: restore does not depend on hidden caches. */
export interface GroundContact3D extends Component {
  readonly type: 'GroundContact3D';
  surfaceId: EntityId;
  heightQ: number;
  triangleId: number;
  acceptedXQ: number;
  acceptedZQ: number;
  acceptedHeightQ: number;
  acceptedTriangleId: number;
  supported: boolean;
  rejected?: boolean;
}
