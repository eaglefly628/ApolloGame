import type { Engine } from './engine.js';
import type { Command } from '@net/commands.js';

/** Opt-in host seam. Runtime depends only on this structural contract, never services. */
export interface EngineHost {
  beforeStart(engine: Engine): boolean;
  stopped(engine: Engine): void;
  commandsForTick(engine: Engine, tick: number, original: Command[] | undefined): Command[] | undefined;
}
let host: EngineHost | undefined;
export function registerEngineHost(next: EngineHost): () => void {
  if (host) throw new Error('An engine host is already installed');
  host = next;
  return () => { if (host === next) host = undefined; };
}
export function currentEngineHost(): EngineHost | undefined { return host; }
