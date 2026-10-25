/** Project-owned music/SFX can join the mobile lifecycle without listening to native DOM events. */
export interface MobileAudioLifecycle {
  /** Called directly from a user gesture, and on foreground/interruption recovery after a gesture. */
  resume(): void | Promise<void>;
  /** Must silence active sources and prevent new playback until resume. */
  suspend(): void | Promise<void>;
}
const ports = new Set<MobileAudioLifecycle>();
let added: ((port: MobileAudioLifecycle) => void) | undefined;
let removed: ((port: MobileAudioLifecycle) => void) | undefined;
/** May be registered before mount. The owner must unregister when its audio object is destroyed. */
export function registerMobileAudio(port: MobileAudioLifecycle): () => void {
  if (ports.has(port)) throw new Error('Mobile audio lifecycle is already registered');
  ports.add(port); added?.(port);
  return () => { if (ports.delete(port)) removed?.(port); };
}
export function connectMobileAudio(
  onAdded: (port: MobileAudioLifecycle) => void, onRemoved: (port: MobileAudioLifecycle) => void,
): () => void {
  added = onAdded; removed = onRemoved;
  for (const port of ports) onAdded(port);
  return () => { added = undefined; removed = undefined; };
}

// Ownership outlives an individual promise: an older host must not silence a newly adopted port.
interface AudioOwner { epoch: object; silenceIfInactive(): void; }
const owners = new WeakMap<MobileAudioLifecycle, AudioOwner>();
export function claimMobileAudio(port: MobileAudioLifecycle, epoch: object, silenceIfInactive: () => void): void {
  owners.set(port, { epoch, silenceIfInactive });
}
export function releaseMobileAudio(port: MobileAudioLifecycle, epoch: object): void {
  if (owners.get(port)?.epoch === epoch) owners.delete(port);
}
/** A late resume delegates to the current owner's desired state; without a new owner its caller cleans up. */
export function completeMobileAudioResume(port: MobileAudioLifecycle, epoch: object): boolean {
  const owner = owners.get(port);
  if (!owner || owner.epoch === epoch) return true;
  owner.silenceIfInactive();
  return false;
}
