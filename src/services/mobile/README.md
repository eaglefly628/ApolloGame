# Mobile host runtime

Install the host before calling a project's existing `mount(host)`. The synchronous `Engine.start()` contract stays intact; with a save configuration, the host holds the first animation frame until `SaveSystem.load()` succeeds. Await `settled()` after mounting to detect initialization failures.

```ts
const mobile = mountMobileEnvironment({
  touch: { mode: 'drag', deadZone: 8, range: 64, tapAction: 'confirm' },
  save: { slot: 'my-product-save-v1', intervalMs: 15000 },
  audio: { specs: { confirm: { partials: [{ freq: 880, dur: 0.08 }] } } },
}, { touchTarget: host });
const stop = await project.mount(host);
await mobile.settled();
// During an explicit exit where completion can be awaited:
await mobile.flush();
stop();
mobile.dispose();
```

For a pure blueprint, `await mountMobileBlueprint(host, blueprint, { w, h }, runtimeConfig)` installs the environment and returns an idempotent disposal function. Do not also install a separate environment for that path. Existing `runBlueprintInto()` remains synchronous.

- Touch uses the lexically first `Controllable.playerId`, samples drag movement once per simulation tick, and merges with the project's existing keyboard commands. It adds no DOM game controls or simulation systems. A tap queues the configured raw action (`source`, `key`, `phase: 'down'`), which must have a matching declarative action binding. A touch declaration without a controllable player rejects startup. Cancel, capture loss, blur, background, and disposal clear pending input. One environment has one touch surface.
- Saving uses the existing `SaveSystem` snapshot, order, and checksum semantics. Declare a versioned slot; product migrations remain the product's responsibility. Default storage is IndexedDB, otherwise localStorage. Missing persistent storage, malformed data, failed legacy migration, checksum failure, and write failure are observable errors, with no volatile-memory fallback. The host serializes/coalesces checkpoints and rejects two engines sharing a slot. Tests can inject a `StoragePort` through the second argument. A stopped engine retains ownership of its slot until environment disposal.
- The timer checkpoints every 15 seconds by default, and background/pagehide requests a checkpoint. Strong termination can preserve only the latest successfully persisted checkpoint. Neither pagehide nor synchronous disposal guarantees an asynchronous write completed. Call and await `flush()` before an explicit disposal if a final confirmed checkpoint is needed.
- `audio.specs` consumes existing and future world `Sound` components through `AudioSync` and `SynthAudioPort`, gated until a user gesture. Audio objects are available during a pending save load so the first gesture can unlock them, while world sounds wait for successful load. Resume after interruption retries current world sounds. This does not wire a project's independently managed music or audio effects automatically.

Project-owned audio can join the same lifecycle once, including before host mounting:

```ts
const unregisterAudio = registerMobileAudio(synthAudioPort);
// Or provide { resume(), suspend() } for a project-owned audio adapter.
// suspend must silence active sources and prevent new playback until resume.
// The owner unregisters when destroying its audio object.
unregisterAudio();
```

The host combines `document.visibilityState`, pagehide/pageshow, and native events. Native bootstrap may set `window.__APOLLO_NATIVE_STATE__ = { active, audioInterrupted }` before JS loads. Later native notifications are `apollo:app-state` with `{ active: boolean }`, and `apollo:audio-state` with `{ interrupted: boolean }`. Foregrounding resumes only engines whose game still requested running; a game's `Engine.stop()` while suspended prevents resurrection. No host is installed by default.

Initialization and I/O errors are retained in `mobile.errors`, logged as `[mobile] reject`, and dispatched on `window` as `apollo:mobile-error` with `{ error }`. `settled()` and `flush()` reject on their relevant failures. Install only one environment at a time; duplicate installation throws before DOM listeners are added. `dispose()` removes listeners, timers, touch sources, and frame audio services, and suspends managed audio.
