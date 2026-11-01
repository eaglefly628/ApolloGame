import { len } from '@engine/math/vec2.js';
import { defineCapability } from '@engine/core/define-capability.js';
import { defineComponent } from '@engine/core/define-component.js';
import { defineSystem } from '@engine/core/define-system.js';
import { SystemPhase, type IWorld } from '@engine/core/types.js';
import { buildIdLookup } from '@engine/logic/index.js';
import type { Velocity, AnimGraphParamValue } from '@engine/protocol/components.js';
import {
  ANIMATION_DRIVER_SCHEMAS, validateAnimationDriver3D, validateAnimationDriverCommand3D,
  type AnimationDriver3D, type AnimationDriverPlayback3D, type AnimationDriverCommand3D,
} from '@engine/protocol/components/animation-driver.js';
import { createAnimationDriver, stepAnimationDriver } from '@engine/animation/driver.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';

const provides = {
  AnimationDriver3D: defineComponent('AnimationDriver3D', ANIMATION_DRIVER_SCHEMAS.AnimationDriver3D.props, {
    category: 'config', sim: true,
    describe: 'M3.5 versioned authoritative animation configuration. Integer fixed-tick clip timing, existing graph and explicit initial state. Not the legacy render-only AnimGraph3D.',
    refine(value) {
      try { validateAnimationDriver3D({ ...value, type: 'AnimationDriver3D' }); return []; }
      catch (error) { return [{ path: '', severity: 'error' as const, message: String(error) }]; }
    },
  }),
  AnimationDriverPlayback3D: defineComponent('AnimationDriverPlayback3D', ANIMATION_DRIVER_SCHEMAS.AnimationDriverPlayback3D.props, {
    category: 'config', sim: true,
    describe: 'Authoritative restorable animation state: configuration identity, integer cursors, state/transition weights, instances, command sequence and current-tick notify events. System-owned; preserved by world snapshots.',
  }),
  AnimationDriverCommand3D: defineComponent('AnimationDriverCommand3D', ANIMATION_DRIVER_SCHEMAS.AnimationDriverCommand3D.props, {
    category: 'intent', sim: true,
    describe: 'Monotonic-sequence animation play/pause/resume/preview-seek request. Repeated sequence does not retrigger; play with a new sequence restarts. Preview seek does not emit gameplay events.',
    refine(value) {
      try { validateAnimationDriverCommand3D({ ...value, type: 'AnimationDriverCommand3D' }); return []; }
      catch (error) { return [{ path: '', severity: 'error' as const, message: String(error) }]; }
    },
  }),
};

export const animationDriverCapability = defineCapability({
  id: 't2-animation-driver', version: '1.0.0',
  describe: {
    name: 'animation-driver',
    summary: 'M3.5 D1: fixed-tick authoritative skeletal animation state, pause/retrigger/seek, restorable cursors and notify identities; renderer samples the committed pose without advancing it.',
    semantic: ['tier2', 'animation', 'deterministic', 'cinematic'],
    whenToUse: 'Attach AnimationDriver3D and Model3D to a character. tickRate must equal Engine tickRate. Configuration and playback participate in sim snapshots/hash; old AnimState3D/AnimGraph3D cannot share the entity. D1 does not move the character or apply damage.',
    examples: ['A cinematic actor plays an idle/interaction graph with deterministic pause and restart.', 'Restore a world snapshot mid-animation and reproduce its pose and notify sequence.'],
  },
  components: {
    provides,
    reads: ['AnimationDriver3D', 'AnimationDriverPlayback3D', 'AnimationDriverCommand3D', 'Velocity', 'Flag', 'State'],
    writes: ['AnimationDriverPlayback3D'], consumes: [],
  },
  config: {},
  systems: [defineSystem({
    id: 'animation-driver', phase: SystemPhase.Commit + 1,
    reads: ['AnimationDriver3D', 'AnimationDriverPlayback3D', 'AnimationDriverCommand3D', 'Velocity', 'Flag', 'State'],
    writes: ['AnimationDriverPlayback3D'],
    run(view) {
      const actors = view.query('AnimationDriver3D').map(([id]) => id).sort();
      if (!actors.length) return;
      const world = view as unknown as IWorld;
      const trace = findDebugTrace(world), lookup = buildIdLookup(world);
      const commits: Array<{ id: string; playback: AnimationDriverPlayback3D; previous?: AnimationDriverPlayback3D }> = [];
      // Stage every actor first: malformed raw-world data cannot partially advance the batch.
      try {
        for (const id of actors) {
          const config = view.getComponent<AnimationDriver3D>(id, 'AnimationDriver3D')!;
          validateAnimationDriver3D(config);
          // Presentation ownership is enforced at load/render boundaries.
          // Excluded render-only components must never influence sim advancement.
          const params: Record<string, AnimGraphParamValue> = Object.create(null) as Record<string, AnimGraphParamValue>;
          for (const [name, source] of Object.entries(config.graph.params)) {
            if (source === 'speed') {
              const velocity = view.getComponent<Velocity>(id, 'Velocity');
              if (velocity && Number.isFinite(velocity.vx) && Number.isFinite(velocity.vy)) {
                const speed = len(velocity.vx, velocity.vy);
                params[name] = Number.isFinite(speed) ? speed : undefined;
              }
            } else if (source.startsWith('flag:')) params[name] = lookup.flag(source.slice(5))?.active;
            else params[name] = lookup.state(source.slice(6))?.current;
          }
          const previous = view.getComponent<AnimationDriverPlayback3D>(id, 'AnimationDriverPlayback3D');
          const command = view.getComponent<AnimationDriverCommand3D>(id, 'AnimationDriverCommand3D');
          if (command) validateAnimationDriverCommand3D(command);
          const result = stepAnimationDriver(config, previous ?? createAnimationDriver(config, params), { params, commands: command?.commands ?? [] });
          commits.push({ id, playback: result.playback, previous });
        }
      } catch (error) {
        appendTrace(trace, view.getVersion(), 'animation-driver', 'reject', 'batch not advanced', String(error));
        // Raw writes bypassing the loader fail closed before any playback commit or later consumers.
        throw error;
      }
      let transitions = 0, events = 0;
      for (const { id, playback, previous } of commits) {
        if (previous && (previous.state !== playback.state || previous.nextInstance !== playback.nextInstance)) transitions++;
        events += playback.events.length;
        view.addComponent(id, playback);
      }
      if (transitions) appendTrace(trace, view.getVersion(), 'animation-driver', 'transition', `${transitions} actor states or instances changed`);
      if (events) appendTrace(trace, view.getVersion(), 'animation-driver', 'commit', `${events} notify events committed`, 'Snapshot-owned; no renderer callbacks or automatic gameplay effects');
    },
  })],
});
