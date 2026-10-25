// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mountMobileEnvironment, registerMobileAudio, type MobileEnvironment } from './index.js';

function deferredAudio() {
  let playing = false;
  let release!: () => void;
  let reject!: (error: Error) => void;
  let calls = 0;
  const port = {
    resume() {
      calls++;
      if (calls === 1) return new Promise<void>((resolve, fail) => { release = resolve; reject = fail; }).then(() => { playing = true; });
      playing = true;
      return Promise.resolve();
    },
    suspend() { playing = false; return Promise.resolve(); },
  };
  return { port, release: () => release(), reject: (error: Error) => reject(error), playing: () => playing };
}
const drain = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
describe('mobile audio ownership across environment replacement', () => {
  it('keeps audio adopted by the new active environment playing when the old resume completes', async () => {
    const audio = deferredAudio();
    const unregister = registerMobileAudio(audio.port);
    const old = mountMobileEnvironment({}); let next: MobileEnvironment | undefined;
    try {
      window.dispatchEvent(new Event('pointerdown')); old.dispose(); next = mountMobileEnvironment({});
      window.dispatchEvent(new Event('pointerdown')); await drain(); expect(audio.playing()).toBe(true);
      audio.release(); await drain(); expect(audio.playing()).toBe(true);
    } finally { old.dispose(); next?.dispose(); unregister(); }
  });
  it('silences an old resume when no new environment has adopted the port', async () => {
    const audio = deferredAudio(); const unregister = registerMobileAudio(audio.port);
    const old = mountMobileEnvironment({});
    try {
      window.dispatchEvent(new Event('pointerdown')); old.dispose();
      audio.release(); await drain(); expect(audio.playing()).toBe(false);
    } finally { old.dispose(); unregister(); }
  });
  it('respects a new owner that still requires silence and suppresses errors from the disposed environment', async () => {
    const audio = deferredAudio(); const unregister = registerMobileAudio(audio.port);
    const old = mountMobileEnvironment({}); let next: MobileEnvironment | undefined;
    const error = vi.fn();
    try {
      window.dispatchEvent(new Event('pointerdown')); old.dispose(); next = mountMobileEnvironment({});
      audio.release(); await drain(); expect(audio.playing()).toBe(false);
      next.dispose(); next = undefined;
    } finally { old.dispose(); next?.dispose(); unregister(); }
    const failed = deferredAudio(); const unregisterFailed = registerMobileAudio(failed.port);
    const disposed = mountMobileEnvironment({}); let replacement: MobileEnvironment | undefined;
    try {
      window.dispatchEvent(new Event('pointerdown')); disposed.dispose(); replacement = mountMobileEnvironment({});
      window.addEventListener('apollo:mobile-error', error);
      failed.reject(new Error('stale resume rejection')); await drain();
      expect(error).not.toHaveBeenCalled(); expect(replacement.errors).toHaveLength(0); expect(disposed.errors).toHaveLength(0);
    } finally { window.removeEventListener('apollo:mobile-error', error); disposed.dispose(); replacement?.dispose(); unregisterFailed(); }
  });
});
