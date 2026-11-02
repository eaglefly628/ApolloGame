import { prepareAnimationDriverStep } from './animation-driver.js';
import { prepareRootMotionWorldStep, acceptRootMotionWorldStep, validateRootMotionWorldSnapshot } from './root-motion-plan.js';
import type { RootMotionPlayback3D } from '@engine/protocol/components/root-motion.js';
import type { AnimationDriverPlayback3D } from '@engine/protocol/components/animation-driver.js';
import { LOCOMOTION_SCHEMAS } from '@engine/protocol/components/locomotion-schema.js';
import { LOCOMOTION_CHARACTER_SCHEMAS, validateLocomotionCharacter3D } from '@engine/protocol/components/locomotion-character.js';
import type { LocomotionDriver3D, LocomotionPlayback3D, LocomotionCommand3D } from '@engine/protocol/components/locomotion-driver.js';
import { compileLocomotionDriver3D, createLocomotionDriver, stepLocomotionDriver, type CompiledLocomotionDriver } from '@engine/animation/locomotion-driver.js';
import { validateLocomotionPlayback3D, validateLocomotionCommand3D } from '@engine/animation/locomotion-envelope.js';
import { defineCapability } from '@engine/core/define-capability.js';
import { defineComponent } from '@engine/core/define-component.js';
import { defineSystem } from '@engine/core/define-system.js';
import { prepareAnimationPerformanceStep } from './animation-performance.js';
import { validateAnimationPerformancePlayback3D, type AnimationPerformance3D, type AnimationPerformancePlayback3D } from '@engine/protocol/components/animation-performance.js';
import { t } from '@engine/core/schema.js';
import { SystemPhase, type IWorld } from '@engine/core/types.js';
import type { Transform, Collider3D } from '@engine/protocol/components.js';
import type { CharacterMotor3D, CharacterMotorIntent3D, CharacterMotorPlayback3D } from '@engine/protocol/components/character-motor.js';
import type { CharacterMotorEnvironment3D } from '@engine/protocol/components/character-motor-environment.js';
import { CHARACTER_MOTOR_SCHEMAS } from '@engine/protocol/components/character-motor-schema.js';
import { createCharacterMotorPlayback3D, stepCharacterMotorPlayback3D, validateCharacterMotor3D, validateCharacterMotorIntent3D, validateCharacterMotorPlayback3D } from '@engine/spatial/character-motor-driver.js';
import { validateDriverTree } from '@engine/protocol/components/animation-driver.js';
import { findDebugTrace, appendTrace } from '../debug-trace.js';
import { MOTOR_EXCLUSIVE_SIM as exclusive, motorCanonical as canonical, motorProjections, validateMotorProjection, motorStaticObstacles, validateMotorSceneSnapshot, validateMotorEnvironment } from '@engine/spatial/character-motor-world.js';
export { motorProjections, validateMotorProjection, motorStaticObstacles } from '@engine/spatial/character-motor-world.js';
function fail(s: string): never { throw new Error('character-motor: ' + s); }
const schema = CHARACTER_MOTOR_SCHEMAS;
const programs = new WeakMap<IWorld, Map<string, {
    canonical: string;
    compiled: CompiledLocomotionDriver;
}>>();
function program(world: IWorld, id: string, raw: LocomotionDriver3D): CompiledLocomotionDriver {
    validateDriverTree(raw);
    const key = canonical(raw), root = world.root ?? world;
    let cache = programs.get(root);
    if (!cache) {
        cache = new Map();
        programs.set(root, cache);
    }
    const existing = cache.get(id);
    if (existing?.canonical === key)
        return existing.compiled;
    const compiled = compileLocomotionDriver3D(raw);
    cache.set(id, { canonical: key, compiled });
    return compiled;
}
const provides = {
    LocomotionCharacter3D: defineComponent('LocomotionCharacter3D', LOCOMOTION_CHARACTER_SCHEMAS.LocomotionCharacter3D.props, {
        category: 'config', sim: false,
        describe: 'Optional exact target Skin, selector, scale and immutable rest binding for a locomotion profile. Renderer validates actual asset bytes and parsed skeleton; declared calibration status is metadata, not quality approval.',
        refine(value) { try {
            validateLocomotionCharacter3D({ ...value, type: 'LocomotionCharacter3D' });
            return [];
        }
        catch (error) {
            return [{ path: '', severity: 'error' as const, message: String(error) }];
        } }
    }),
    LocomotionDriver3D: defineComponent('LocomotionDriver3D', LOCOMOTION_SCHEMAS.LocomotionDriver3D.props, { category: 'config', sim: true, describe: 'Complete D2 locomotion state lifecycle and calibrated two-dimensional blend configuration; requires same-entity CharacterMotor3D. Actual asset SHA and in-place motion are explicit.', refine(value) {
            try {
                compileLocomotionDriver3D({ ...value, type: 'LocomotionDriver3D' });
                return [];
            }
            catch (error) {
                return [{ path: '', severity: 'error' as const, message: String(error) }];
            }
        } }),
    LocomotionPlayback3D: defineComponent('LocomotionPlayback3D', LOCOMOTION_SCHEMAS.LocomotionPlayback3D.props, { category: 'config', sim: true, describe: 'Snapshot-owned locomotion cursors, state/phase and current-tick plant events. Physics and animation commit atomically.' }),
    LocomotionCommand3D: defineComponent('LocomotionCommand3D', LOCOMOTION_SCHEMAS.LocomotionCommand3D.props, { category: 'intent', sim: true, describe: 'Monotonic pause/resume/preview seek for the animation clock. Does not pause physical movement; director world pause is separate.', refine(value) {
            try {
                validateLocomotionCommand3D({ ...value, type: 'LocomotionCommand3D' });
                return [];
            }
            catch (error) {
                return [{ path: '', severity: 'error' as const, message: String(error) }];
            }
        } }),
    CharacterMotor3D: defineComponent('CharacterMotor3D', schema.CharacterMotor3D.props, { category: 'config', sim: true, describe: 'Versioned fixed-tick capsule motor configuration in Q10000 meters; one movement authority, static AABB support only.', refine(value) {
            try {
                validateCharacterMotor3D({ ...value, type: 'CharacterMotor3D' });
                return [];
            }
            catch (error) {
                return [{ path: '', severity: 'error' as const, message: String(error) }];
            }
        } }),
    CharacterMotorIntent3D: defineComponent('CharacterMotorIntent3D', schema.CharacterMotorIntent3D.props, { category: 'intent', sim: true, describe: 'Independent monotonic movement, jump and facing intents. World movement and body facing can differ.', refine(value) {
            try {
                validateCharacterMotorIntent3D({ ...value, type: 'CharacterMotorIntent3D' });
                return [];
            }
            catch (error) {
                return [{ path: '', severity: 'error' as const, message: String(error) }];
            }
        } }),
    CharacterMotorPlayback3D: defineComponent('CharacterMotorPlayback3D', schema.CharacterMotorPlayback3D.props, { category: 'config', sim: true, describe: 'Snapshot-owned accepted position, velocity, yaw, intent cursors, events and derived locomotion facts; not a second editable transform.' }),
    CharacterMotorEnvironment3D: defineComponent('CharacterMotorEnvironment3D', { version: t.lit(1), staticSceneCanonical: t.str() }, { category: 'config', sim: true, describe: 'System-owned static collision scene identity; changed/moving obstacles reject until a supported movement policy exists.' }),
};
const reads = ['RootMotion3D', 'RootMotionSource3D', 'RootMotionPlayback3D', 'AnimationDriver3D', 'AnimationDriverPlayback3D', 'AnimationDriverCommand3D', 'Velocity', 'Flag', 'State', 'AnimationPerformance3D', 'AnimationPerformancePlayback3D', 'AnimationPerformanceCommand3D', 'LocomotionDriver3D', 'LocomotionPlayback3D', 'LocomotionCommand3D', 'CharacterMotor3D', 'CharacterMotorIntent3D', 'CharacterMotorPlayback3D', 'CharacterMotorEnvironment3D', 'Collider3D', 'Transform', ...exclusive] as const;
export const characterMotorCapability = defineCapability({
    id: 't2-character-motor', version: '1.0.0', describe: { name: 'character-motor', summary: 'D2 fixed-tick capsule movement and optional calibrated locomotion animation in one atomic commit, with authoritative yaw and snapshot-owned events.', semantic: ['tier2', '3d', 'movement', 'deterministic'], whenToUse: 'Use CharacterMotor3D on a character without legacy Velocity/GroundWalker/Bounds/Hierarchy/FaceDir. Static axis-aligned box scene only; dynamic actors, slopes, hulls and steps are unsupported. Intents and initial position use Q10000 meters.', examples: ['Move and jump a cinematic actor over a static box floor, with a separately controlled gaze direction.'] },
    components: { provides, reads: [...reads], writes: ['RootMotionPlayback3D', 'AnimationDriverPlayback3D', 'AnimationPerformancePlayback3D', 'LocomotionPlayback3D', 'CharacterMotorPlayback3D', 'CharacterMotorEnvironment3D', 'Transform', 'Collider3D'], consumes: [] }, config: {},
    systems: [defineSystem({ id: 'character-motor-step', phase: SystemPhase.Simulate - 1, reads: [...reads], writes: ['RootMotionPlayback3D', 'AnimationDriverPlayback3D', 'AnimationPerformancePlayback3D', 'LocomotionPlayback3D', 'CharacterMotorPlayback3D', 'CharacterMotorEnvironment3D', 'Transform', 'Collider3D'], run(view) {
                const ids = view.query('CharacterMotor3D').map(([id]) => id).sort();
                const orphanTypes = ['RootMotion3D', 'RootMotionSource3D', 'RootMotionPlayback3D', 'CharacterMotorIntent3D', 'CharacterMotorPlayback3D', 'CharacterMotorEnvironment3D', 'LocomotionDriver3D', 'LocomotionPlayback3D', 'LocomotionCommand3D'] as const;
                const orphan = orphanTypes.flatMap(type => view.query(type).filter(([id]) => !view.hasComponent(id, 'CharacterMotor3D')).map(([id]) => id));
                if (!ids.length && !orphan.length)
                    return;
                const world = view as unknown as IWorld, trace = findDebugTrace(world);
                const staged: Array<{
                    id: string;
                    playback: CharacterMotorPlayback3D;
                    environment: CharacterMotorEnvironment3D;
                    projection: {
                        transform: Transform;
                        collider: Collider3D;
                    };
                    changed: boolean;
                    locomotion?: LocomotionPlayback3D;
                    performance?: AnimationPerformancePlayback3D;
                    driver?: AnimationDriverPlayback3D;
                    root?: RootMotionPlayback3D;
                }> = [];
                try {
                    if (orphan.length)
                        fail(`${orphan[0]}: motor/locomotion component without CharacterMotor3D`);
                    if (ids.length > 1)
                        fail('static-aabb version supports one motor actor per collision world; moving actor pairs are unsupported');
                    for (const id of ids) {
                        const c = view.getComponent<CharacterMotor3D>(id, 'CharacterMotor3D')!;
                        validateCharacterMotor3D(c);
                        const obstacles = motorStaticObstacles(world, id), scene = canonical(obstacles), environment = view.getComponent<CharacterMotorEnvironment3D>(id, 'CharacterMotorEnvironment3D');
                        if (environment)
                            validateMotorEnvironment(environment, scene);
                        const saved = view.getComponent<CharacterMotorPlayback3D>(id, 'CharacterMotorPlayback3D');
                        if (!!saved !== !!environment)
                            fail(`${id}: playback/environment must restore together`);
                        const previous = saved ?? createCharacterMotorPlayback3D(c, obstacles);
                        validateCharacterMotorPlayback3D(c, previous);
                        if (saved)
                            validateMotorSceneSnapshot(c, previous, obstacles);
                        validateMotorProjection(world, id, c, previous, true);
                        const performance = prepareAnimationPerformanceStep(view, id);
                        const driver = view.getComponent(id, 'RootMotion3D') ? prepareAnimationDriverStep(world, id) : undefined;
                        const rootPlan = prepareRootMotionWorldStep(view, id, c, previous, { ...(driver ? { base: driver } : {}), ...(performance ? { performance } : {}) });
                        const intent = view.getComponent<CharacterMotorIntent3D>(id, 'CharacterMotorIntent3D');
                        const physicsRoot = rootPlan ? { requestId: JSON.stringify([id, rootPlan.playback.instance, rootPlan.playback.epoch, rootPlan.request?.driverTick ?? rootPlan.playback.lastDriverTick]), deltaQ: rootPlan.request?.deltaQ ?? { x: 0, z: 0 }, yawDeltaUnits: rootPlan.request?.yawDeltaUnits ?? 0 } : undefined;
                        const playback = stepCharacterMotorPlayback3D(c, previous, id, intent, obstacles, physicsRoot);
                        const root = rootPlan ? acceptRootMotionWorldStep(rootPlan, previous, playback) : undefined;
                        const graph = view.getComponent<LocomotionDriver3D>(id, 'LocomotionDriver3D'), savedLoco = view.getComponent<LocomotionPlayback3D>(id, 'LocomotionPlayback3D'), command = view.getComponent<LocomotionCommand3D>(id, 'LocomotionCommand3D');
                        let locomotion: LocomotionPlayback3D | undefined;
                        if (!graph && (savedLoco || command))
                            fail(`${id}: locomotion playback/commands require LocomotionDriver3D`);
                        if (graph) {
                            const compiled = program(world, id, graph);
                            if (graph.tickRate !== c.motion.tickRate)
                                fail(`${id}: animation/motor tickRate mismatch`);
                            if (command)
                                validateLocomotionCommand3D(command);
                            if (savedLoco) {
                                validateLocomotionPlayback3D(compiled, savedLoco);
                                if (!saved || savedLoco.playback.lastFactsSeq !== previous.motor.tick || savedLoco.playback.seenJumpInstance > previous.motor.jumpInstance || savedLoco.playback.seenLandingInstance > previous.motor.landingInstance)
                                    fail(`${id}: inconsistent motor/animation snapshot tuple`);
                            }
                            // Physical stance is instantaneous in V1; animation needs its observed edge.
                            // Use saved animation stance as the baseline so a paused transition is not lost.
                            const observed = savedLoco?.playback.lastStance ?? previous.motor.stance;
                            const priorStance = observed === 'crouch-in' ? 'crouched' : observed === 'crouch-out' ? 'standing' : observed;
                            const animationFacts = { ...playback.facts, stance: priorStance === playback.motor.stance ? playback.motor.stance : playback.motor.stance === 'crouched' ? 'crouch-in' as const : 'crouch-out' as const };
                            const animated = stepLocomotionDriver(compiled, savedLoco?.playback ?? createLocomotionDriver(compiled, playback.motor.tick), { facts: animationFacts, commands: command?.commands ?? [] });
                            locomotion = { type: 'LocomotionPlayback3D', version: 1, playback: animated.state, events: animated.events };
                            validateLocomotionPlayback3D(compiled, locomotion);
                        }
                        staged.push({ id, playback, ...(driver ? { driver: driver.playback } : {}), ...(root ? { root } : {}), ...(locomotion ? { locomotion } : {}), ...(performance ? { performance } : {}), environment: { type: 'CharacterMotorEnvironment3D', version: 1, staticSceneCanonical: scene }, projection: motorProjections(c, playback), changed: !!trace && (!!locomotion && (!savedLoco || locomotion.playback.state !== savedLoco.playback.state || locomotion.playback.paused !== savedLoco.playback.paused || locomotion.playback.lastCommandSeq !== savedLoco.playback.lastCommandSeq) || !saved || playback.yawUnits !== previous.yawUnits || playback.motor.stance !== previous.motor.stance || playback.motor.lastMoveSeq !== previous.motor.lastMoveSeq || Object.values(playback.result.acceptedDeltaQ).some(n => n !== 0)) });
                    }
                }
                catch (error) {
                    if (trace)
                        appendTrace(trace, view.getVersion(), 'character-motor-step', 'reject', 'motor batch unchanged', String(error));
                    throw error;
                }
                let rejected = 0, events = 0;
                for (const { id, playback, environment, projection, locomotion, performance, driver, root } of staged) {
                    view.addComponent(id, playback);
                    if (driver)
                        view.addComponent(id, driver);
                    if (root)
                        view.addComponent(id, root);
                    if (locomotion)
                        view.addComponent(id, locomotion);
                    if (performance)
                        view.addComponent(id, performance);
                    view.addComponent(id, environment);
                    view.addComponent(id, projection.transform);
                    view.addComponent(id, projection.collider);
                    if (trace) {
                        rejected += playback.result.blockedReasons.length ? 1 : 0;
                        events += playback.events.length + (locomotion?.events.length ?? 0) + (performance?.events.length ?? 0) + (driver?.events.length ?? 0);
                    }
                }
                if (trace && rejected)
                    appendTrace(trace, view.getVersion(), 'character-motor-step', 'reject', `${rejected} actors constrained`, staged.filter(s => s.playback.result.blockedReasons.length).slice(0, 3).map(s => s.id + ':' + s.playback.result.blockedReasons.join(',')).join('; '));
                if (trace && events)
                    appendTrace(trace, view.getVersion(), 'character-motor-step', 'transition', `${events} movement/animation lifecycle events`, staged.flatMap(s => [...s.playback.events.map(e => e.id), ...(s.locomotion?.events.map(e => e.id) ?? [])]).slice(0, 3).join('; '));
                for (const key of programs.get(world.root ?? world)?.keys() ?? [])
                    if (!ids.includes(key))
                        programs.get(world.root ?? world)?.delete(key);
                const moved = trace ? staged.filter(s => s.changed) : undefined;
                if (moved?.length)
                    appendTrace(trace, view.getVersion(), 'character-motor-step', 'commit', `${moved.length} accepted motor projections`, moved.slice(0, 3).map(s => s.id + '@' + JSON.stringify(s.playback.motor.positionQ) + '/yaw' + s.playback.yawUnits + '/state' + (s.locomotion?.playback.state ?? 'none') + '/actual' + JSON.stringify(s.playback.result.acceptedDeltaQ) + '/desired' + JSON.stringify(s.playback.result.desiredDeltaQ)).join('; '));
            } }), defineSystem({ id: 'character-motor-integrity', phase: SystemPhase.Commit + 2, reads: [...reads], writes: [], run(view) {
                const world = view as unknown as IWorld;
                try {
                    for (const [id] of view.query('CharacterMotorPlayback3D')) {
                        validateRootMotionWorldSnapshot(view, id);
                        const c = view.getComponent<CharacterMotor3D>(id, 'CharacterMotor3D'), p = view.getComponent<CharacterMotorPlayback3D>(id, 'CharacterMotorPlayback3D')!;
                        if (!c)
                            fail(`${id}: orphan motor playback`);
                        validateCharacterMotorPlayback3D(c, p);
                        validateMotorProjection(world, id, c, p);
                        const obstacles = motorStaticObstacles(world, id);
                        validateMotorEnvironment(view.getComponent<CharacterMotorEnvironment3D>(id, 'CharacterMotorEnvironment3D'), canonical(obstacles));
                        validateMotorSceneSnapshot(c, p, obstacles);
                        const graph = view.getComponent<LocomotionDriver3D>(id, 'LocomotionDriver3D'), loco = view.getComponent<LocomotionPlayback3D>(id, 'LocomotionPlayback3D'), commands = view.getComponent<LocomotionCommand3D>(id, 'LocomotionCommand3D');
                        if (!graph && (loco || commands))
                            fail(`${id}: orphan late locomotion component`);
                        if (commands)
                            validateLocomotionCommand3D(commands);
                        if (graph && loco) {
                            validateLocomotionPlayback3D(program(world, id, graph), loco);
                            if (loco.playback.lastFactsSeq !== p.motor.tick || loco.playback.seenJumpInstance > p.motor.jumpInstance || loco.playback.seenLandingInstance > p.motor.landingInstance)
                                fail(`${id}: late inconsistent motor/animation snapshot tuple`);
                        }
                        else if (graph)
                            fail(`${id}: missing committed locomotion playback`);
                        const performanceConfig = view.getComponent<AnimationPerformance3D>(id, 'AnimationPerformance3D'), performance = view.getComponent<AnimationPerformancePlayback3D>(id, 'AnimationPerformancePlayback3D');
                        if (performanceConfig) {
                            if (!performance)
                                fail(`${id}: missing committed performance playback`);
                            validateAnimationPerformancePlayback3D(performanceConfig, performance);
                            if (performance.actorId !== id)
                                fail(`${id}: late performance actor mismatch`);
                        }
                        else if (performance || view.getComponent(id, 'AnimationPerformanceCommand3D'))
                            fail(`${id}: orphan late performance component`);
                    }
                }
                catch (error) {
                    appendTrace(findDebugTrace(world), view.getVersion(), 'character-motor-integrity', 'reject', 'late external movement write', String(error));
                    throw error;
                }
            } })],
});
