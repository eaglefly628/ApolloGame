import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasRenderer } from '@renderer/index.js';
import { LockstepClient } from '@net/index.js';
import type { Channel, NetMsg, Dir } from '@net/index.js';
import { buildPlatformerLockstepWorld } from './assembly/platformer-lockstep.js';

// 浏览器传输：BroadcastChannel —— 同源所有标签页互通。开两个标签页即两名玩家。
// 升级到真网络时，只换这一个 Channel 实现（WebRTC/WS），LockstepClient 一行不动。
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

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
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

    const peerId = Math.random().toString(36).slice(2, 8); // 连接级标识，不进模拟哈希
    const client = new LockstepClient({
      peerId,
      channel: broadcastChannel('apollo-platformer-lockstep'),
      getInput,
      tickRate: 30,
      inputDelay: 4,
      buildWorld: buildPlatformerLockstepWorld,
    });

    const renderer = new CanvasRenderer({ width: 640, height: 400, background: '#0f172a' });
    if (containerRef.current) renderer.init(containerRef.current);

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
      <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: 640, height: 400 }} />
      <div style={{ position: 'absolute', top: 8, left: 8, color: '#e2e8f0', font: '13px monospace', lineHeight: 1.6 }}>
        <div>
          你是 <b style={{ color: '#fbbf24' }}>{hud.you}</b> · 玩家 {hud.peers} · tick {hud.tick} ·{' '}
          <span style={{ color: hud.inSync ? '#22c55e' : '#ef4444' }}>{hud.inSync ? '✅ 同步' : '⚠️ 分叉'}</span>
        </div>
        <div>←/→ 或 A/D 移动 · 空格/↑/W 跳 · 斜坡可踩可滑</div>
        <div style={{ opacity: 0.65 }}>开两个标签页（同一地址）= 两名玩家帧同步联机</div>
      </div>
    </>
  );
}

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
