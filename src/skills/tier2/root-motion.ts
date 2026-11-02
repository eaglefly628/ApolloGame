import { defineCapability } from '@engine/core/define-capability.js';
import { defineComponent } from '@engine/core/define-component.js';
import { ROOT_MOTION_SCHEMAS, validateRootMotionSource3D } from '@engine/protocol/components/root-motion.js';
import { validateRootMotion3D } from '@engine/animation/root-motion.js';
const schema = ROOT_MOTION_SCHEMAS;
export const rootMotionCapability = defineCapability({ id: 't2-root-motion', version: '1.0.0', describe: { name: 'root-motion', summary: 'D4 source-paired planar root extraction requests accepted by the character capsule transaction; no independent animation or movement clock.', semantic: ['tier2', 'animation', 'movement', 'deterministic'], whenToUse: 'Use with CharacterMotor3D and one authoritative D1 clip or a full-body performance slot. Source and root-removed GLB hashes must be verified by native asset binding. Y/jump remains motor-owned.', examples: ['A root-driven interaction approaches a sim anchor while static walls constrain its capsule.'] }, components: { provides: { RootMotion3D: defineComponent('RootMotion3D', schema.RootMotion3D.props, { category: 'config', sim: true, describe: 'Explicit root curve, paired original/root-removed SHA, fixed timing, bounded SE2 accumulation and optional once-only sim anchor warp.', refine(v) { try {
                    validateRootMotion3D({ ...v, type: 'RootMotion3D' });
                    return [];
                }
                catch (e) {
                    return [{ path: '', severity: 'error' as const, message: String(e) }];
                } } }), RootMotionSource3D: defineComponent('RootMotionSource3D', schema.RootMotionSource3D.props, { category: 'config', sim: true, describe: 'Exact authoritative clip alias or performance slot/clip reference; no independent root cursor.', refine(v) { try {
                    validateRootMotionSource3D({ ...v, type: 'RootMotionSource3D' });
                    return [];
                }
                catch (e) {
                    return [{ path: '', severity: 'error' as const, message: String(e) }];
                } } }), RootMotionPlayback3D: defineComponent('RootMotionPlayback3D', schema.RootMotionPlayback3D.props, { category: 'config', sim: true, describe: 'Atomic accepted root cursor, source instance, epoch, body pose and request feedback. Pending proposals are never committed to a World.' }) }, reads: [], writes: [], consumes: [] }, config: {}, systems: [] });
