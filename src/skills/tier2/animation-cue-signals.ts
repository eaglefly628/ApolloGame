import { defineCapability } from '@engine/core/define-capability.js';
import { defineComponent } from '@engine/core/define-component.js';
import { defineSystem } from '@engine/core/define-system.js';
import { SystemPhase, type IWorld } from '@engine/core/types.js';
import { validateDriverTree } from '@engine/protocol/components/animation-driver.js';
import { ANIMATION_CUE_SCHEMAS, cueConfigFromIdentity, validateAnimationCueSignals3D, validateAnimationCueSignalsPlayback3D, validateAnimationCueSource3D } from '@engine/protocol/components/animation-cue-signals.js';
import { planAnimationCueDelivery, planAnimationCuePublication } from '@engine/animation/cue-signals-world.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';

const schemas = ANIMATION_CUE_SCHEMAS;
export const animationCueSignalsCapability = defineCapability({
  id: 't2-animation-cue-signals', version: '1.0.0',
  describe: { name: 'animation-cue-signals', summary: 'Routes validated actor-owned animation events into existing Signals, with deterministic next-tick queued gameplay delivery.', semantic: ['tier2', 'animation', 'signal', 'deterministic'], whenToUse: 'Bind explicitly declared base/montage notifies or completion, measured plant events or motor jump/land. No callback, inferred timer or renderer event is allowed.', examples: ['Route a declared montage cue to a named effect Signal.', 'Deliver a measured left plant cue once, including after snapshot restoration.'] },
  components: {
    provides: {
      AnimationCueSignals3D: defineComponent('AnimationCueSignals3D', schemas.AnimationCueSignals3D.props, { category: 'config', sim: true, describe: 'Closed cue-to-Signal bindings with authored per-tick budget. References and conservative source bounds are checked before loading.', refine(v) { try { validateDriverTree(v); validateAnimationCueSignals3D({ ...v, type: 'AnimationCueSignals3D' }); return []; } catch (error) { return [{ path: '', severity: 'error' as const, message: String(error) }]; } } }),
      AnimationCueSignalsPlayback3D: defineComponent('AnimationCueSignalsPlayback3D', schemas.AnimationCueSignalsPlayback3D.props, { category: 'config', sim: true, describe: 'Exact config/actor identity, source snapshot cursors, monotonic emission sequence and reserved event ownership.', refine(v) { try { validateDriverTree(v); const value={...v,type:'AnimationCueSignalsPlayback3D'}; const config=cueConfigFromIdentity(v.configIdentity); validateAnimationCueSignalsPlayback3D(config,value); return []; } catch(error) { return [{path:'',severity:'error' as const,message:String(error)}]; } } }),
      AnimationCueSource3D: defineComponent('AnimationCueSource3D', schemas.AnimationCueSource3D.props, { category: 'event', sim: true, describe: 'Reserved transient provenance and pending/delivered queued Signal. Never attach to gameplay entities.', refine(v) { try { validateDriverTree(v); validateAnimationCueSource3D({ ...v, type: 'AnimationCueSource3D' }); return []; } catch (error) { return [{ path: '', severity: 'error' as const, message: String(error) }]; } } }),
    }, reads: ['AnimationCueSignals3D', 'AnimationCueSignalsPlayback3D', 'AnimationCueSource3D', 'AnimationDriver3D', 'AnimationDriverPlayback3D', 'AnimationPerformance3D', 'AnimationPerformancePlayback3D', 'LocomotionDriver3D', 'LocomotionPlayback3D', 'CharacterMotor3D', 'CharacterMotorPlayback3D', 'Signal'], writes: ['AnimationCueSignalsPlayback3D', 'AnimationCueSource3D', 'Signal'], consumes: [],
  }, config: {},
  systems: [
    defineSystem({ id: 'animation-cue-delivery', phase: SystemPhase.Commit - 1, reads: ['AnimationCueSignals3D', 'AnimationCueSignalsPlayback3D', 'AnimationCueSource3D', 'AnimationDriver3D', 'AnimationDriverPlayback3D', 'AnimationPerformance3D', 'AnimationPerformancePlayback3D', 'LocomotionDriver3D', 'LocomotionPlayback3D', 'CharacterMotor3D', 'CharacterMotorPlayback3D', 'Signal'], writes: ['Signal', 'AnimationCueSource3D'], run(view) {
      if (!view.query('AnimationCueSignals3D').length && !view.query('AnimationCueSignalsPlayback3D').length && !view.query('AnimationCueSource3D').length) return;
      const world = view as unknown as IWorld, trace = findDebugTrace(world);
      try { const plan = planAnimationCueDelivery(world); for (const marker of plan) { if (!world.hasComponent(marker.entityId, 'Signal')) world.addComponent(marker.entityId, { type: 'Signal', ...marker.signal }); world.addComponent(marker.entityId, marker); } if (trace && plan.length) appendTrace(trace, world.getVersion(), 'animation-cue-delivery', 'commit', `${plan.length} queued cues delivered for this tick's effects`); }
      catch (error) { if (trace) appendTrace(trace, world.getVersion(), 'animation-cue-delivery', 'reject', 'queued cue batch unchanged', String(error)); throw error; }
    } }),
    defineSystem({ id: 'animation-cue-signals', phase: SystemPhase.Commit + 4, reads: ['AnimationCueSignals3D', 'AnimationCueSignalsPlayback3D', 'AnimationCueSource3D', 'AnimationDriver3D', 'AnimationDriverPlayback3D', 'AnimationPerformance3D', 'AnimationPerformancePlayback3D', 'LocomotionDriver3D', 'LocomotionPlayback3D', 'CharacterMotor3D', 'CharacterMotorPlayback3D', 'Signal'], writes: ['AnimationCueSignalsPlayback3D', 'AnimationCueSource3D', 'Signal'], run(view) {
      if (!view.query('AnimationCueSignals3D').length && !view.query('AnimationCueSignalsPlayback3D').length && !view.query('AnimationCueSource3D').length) return;
      const world = view as unknown as IWorld, trace = findDebugTrace(world);
      try { const plan = planAnimationCuePublication(world); for (const id of plan.cleanup) world.destroyEntity(id); for (const row of plan.playback) world.addComponent(row.actorId, row.value); for (const e of plan.emissions) { world.createEntity(e.entityId); world.addComponent(e.entityId, e.signal); world.addComponent(e.entityId, e.marker); } if (trace && (plan.cleanup.length || plan.emissions.length)) appendTrace(trace, world.getVersion(), 'animation-cue-signals', 'commit', `${plan.cleanup.length} old cues removed; ${plan.emissions.length} actor-owned cues published`); }
      catch (error) { if (trace) appendTrace(trace, world.getVersion(), 'animation-cue-signals', 'reject', 'publication batch unchanged', String(error)); throw error; }
    } }),
  ],
});
