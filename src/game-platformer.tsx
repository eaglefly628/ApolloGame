import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasRenderer } from '@renderer/index.js';
import { LockstepClient } from '@net/index.js';
import type { Channel, NetMsg, Dir } from '@net/index.js';
import { buildPlatformerLockstepWorld } from './assembly/platformer-lockstep.js';

function broadcastChannel(name: string): Channel {
  const bc = new BroadcastChannel(name);
  let handler: ((m: NetMsg) => void) | null = null;
  bc.onmessage = (e) => handler?.(e.data as NetMsg);
  return {
    post: (m) => bc.postMessage(m),
    onMessage: (cb) => { handler = cb; },
    close: () => bc.close(),
  };
}

const MOVE: Record<string, number> = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);

function PlatformerGame({ container }: { container: HTMLElement }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState({ tick: 0, peers: 1, inSync: true, you: 'p1' });

  useEffect(() => {
    const pressed = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (MOVE[e.code] !== undefined || JUMP.has(e.code)) {
        pressed.add(e.code);
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => pressed.delete(e.code);
    const onBlur = () => pressed.clear();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);

    const getInput = (): Dir => {
      let dx = 0;
      let jump = 0;
      for (const c of pressed) {
        dx += MOVE[c] ?? 0;
        if (JUMP.has(c)) jump = 1;
      }
      return { dx: Math.sign(dx), dy: 0, jump };
    };

    const peerId = Math.random().toString(36).slice(2, 8);
    const client = new LockstepClient({
      peerId,
      channel: broadcastChannel('apollo-platformer-lockstep'),
      getInput,
      tickRate: 30,
      inputDelay: 4,
      buildWorld: buildPlatformerLockstepWorld,
    });

    const renderer = new CanvasRenderer({ width: 640, height: 400, background: '#0f172a' });
    if (canvasRef.current) renderer.init(canvasRef.current);

    let last = performance.now();
    let raf = 0;
    const loop = (now: number): void => {
      client.pump(now - last);
      last = now;
      renderer.sync(client.getWorld());
      const v = client.view();
      setHud({ tick: v.tick, peers: v.peerCount, inSync: v.inSync, you: v.youPlayerId });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      client.dispose();
      renderer.destroy();
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return (
    <>
      <div ref={canvasRef} style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 640, height: 400,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }} />
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        color: '#e2e8f0', font: '13px monospace', lineHeight: 1.6,
        background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: 8,
        textAlign: 'center',
      }}>
        <div>
          你是 <b style={{ color: '#fbbf24' }}>{hud.you}</b> · 玩家 {hud.peers} · tick {hud.tick} ·{' '}
          <span style={{ color: hud.inSync ? '#22c55e' : '#ef4444' }}>{hud.inSync ? 'SYNC' : 'DESYNC'}</span>
        </div>
        <div style={{ opacity: 0.65 }}>Arrow/WASD move · Space/Up/W jump · Open 2 tabs = 2 players</div>
      </div>
    </>
  );
}

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;inset:0;background:#0a0f1e';
  container.appendChild(wrapper);

  const root = createRoot(wrapper);
  root.render(<PlatformerGame container={wrapper} />);

  return () => {
    root.unmount();
    wrapper.remove();
  };
}
