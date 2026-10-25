import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '@renderer/canvas-renderer.js';
import { cartInputFor, controllablePlayerIds, RUN_VP, type RunVp } from '../../studio/cart-run-core.js';
import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import { mountMobileEnvironment, mergeMobileCommands, type MobileRuntimeConfig } from './index.js';
import { mountHost, type HostSkeleton } from '@engine/host/mount-host.js';
import { getCameraView, screenToWorld } from '@engine/protocol/camera-view.js';
import { PointerInputSource } from '@net/host/queued-input.js';

/** Async mobile path; deliberately leaves runBlueprintInto's existing synchronous contract unchanged. */
export async function mountMobileBlueprint(
  host: HTMLElement, blueprint: WorldBlueprint, viewport: RunVp = RUN_VP, config: MobileRuntimeConfig = {},
): Promise<() => void> {
  if (!Number.isFinite(viewport.w) || !Number.isFinite(viewport.h) || viewport.w <= 0 || viewport.h <= 0) {
    throw new Error('Mobile blueprint viewport must have finite positive width and height');
  }
  const environment = mountMobileEnvironment(config, { touchTarget: host });
  let io: ReturnType<typeof cartInputFor> | undefined;
  let renderer: CanvasRenderer | undefined;
  let engine: Engine | undefined;
  let pointer: PointerInputSource | undefined;
  let skeleton: HostSkeleton | undefined;
  let destroyed = false;
  const dispose = (): void => {
    if (destroyed) return;
    destroyed = true;
    engine?.stop(); pointer?.dispose(); environment.dispose(); renderer?.destroy(); io?.dispose(); skeleton?.teardown(); host.replaceChildren();
  };
  try {
    const probe = new Engine(); probe.load(blueprint); probe.world.tick(); probe.world.tick();
    io = cartInputFor(blueprint);
    engine = new Engine({ input: {
      commandsForTick: tick => mergeMobileCommands(io?.input?.commandsForTick(tick) ?? [], pointer?.commandsForTick(tick) ?? []),
    } });
    engine.load(blueprint);
    renderer = new CanvasRenderer({ width: viewport.w, height: viewport.h });
    host.replaceChildren(); skeleton = mountHost(host, { fieldW: viewport.w, fieldH: viewport.h });
    engine.attachRenderer(renderer, skeleton.scene);
    const canvas = skeleton.scene.querySelector('canvas');
    if (!canvas) throw new Error('Mobile blueprint renderer did not create a canvas');
    // Pointer-only cartridges also need native dragging without browser pan/zoom arbitration.
    canvas.style.touchAction = 'none';
    pointer = new PointerInputSource(controllablePlayerIds(blueprint)[0] ?? 'p1', canvas, {
      move: true,
      worldFromScreen: (x, y) => screenToWorld(x, y, getCameraView(engine!.world.readView()), viewport.w, viewport.h),
    });
    engine.start(); await environment.settled();
    return dispose;
  } catch (error) { dispose(); throw error; }
}
