import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import { CanvasRenderer } from './renderer/index.js';
import { buildGameDBlueprint, TEAM_ENEMY, STATUS_FROZEN } from './games/game-d/index.js';
import type { Camera, SpawnRequest, Color } from './engine/protocol/components.js';

// Game D 可挂载模块（ARPG PoC 演示）。
// 展示「冰霜新星→碎冰重锤」涌现式系统叠加——零游戏专属代码，全由
// prefab/overlap-detect/trigger-zone/hitbox/resource 五个通用能力涌现。
// 交互：❄️ Frost Nova 冻结所有敌人（纯 CC）；🔨 Shatter Smash 仅对冻结目标结算 20% maxHP 真伤。

const CANVAS_W = 480;
const CANVAS_H = 200;
let _seq = 0;

interface EnemyState { id: string; hp: number; maxHp: number; frozen: boolean; }

function snapshot(engine: Engine): EnemyState[] {
  const out: EnemyState[] = [];
  for (const [eid] of engine.world.query('Tag', 'Resource')) {
    const tag = engine.world.getComponent<{ type: 'Tag'; flags: number }>(eid, 'Tag');
    const res = engine.world.getComponent<{ type: 'Resource'; id: string; current: number; max: number }>(eid, 'Resource');
    if (!tag || !res || !(tag.flags & TEAM_ENEMY) || res.id !== 'hp') continue;
    const st = engine.world.getComponent<{ type: 'Status'; flags: number }>(eid, 'Status');
    out.push({ id: eid, hp: res.current, maxHp: res.max, frozen: !!st && !!(st.flags & STATUS_FROZEN) });
  }
  return out;
}

function EnemyCard({ e }: { e: EnemyState }) {
  const pct = Math.max(0, (e.hp / e.maxHp) * 100);
  return (
    <div style={{
      background: e.frozen ? '#091c2a' : '#101018',
      border: `1px solid ${e.frozen ? '#38bdf866' : '#1e1e30'}`,
      borderRadius: 8, padding: '8px 14px', minWidth: 90, textAlign: 'center',
      transition: 'all 0.3s',
    }}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>{e.id}</div>
      <div style={{ fontSize: 11, color: '#38bdf8', minHeight: 15, marginBottom: 3 }}>
        {e.frozen ? '❄ FROZEN' : ''}
      </div>
      <div style={{ background: '#08080f', borderRadius: 3, height: 5, margin: '3px 0' }}>
        <div style={{
          background: e.hp <= 0 ? '#1e293b' : '#ef4444',
          width: `${pct}%`, height: '100%', borderRadius: 3,
          transition: 'width 0.25s ease',
        }} />
      </div>
      <div style={{ fontSize: 12, color: e.hp <= 0 ? '#334155' : '#e2e8f0', marginTop: 2 }}>
        {e.hp} / {e.maxHp}
      </div>
    </div>
  );
}

function Panel({ engine }: { engine: Engine }) {
  const [enemies, setEnemies] = useState<EnemyState[]>(() => snapshot(engine));
  const [log, setLog] = useState('');

  useEffect(() => engine.subscribe(() => setEnemies(snapshot(engine))), [engine]);

  const cast = useCallback((tmpl: string, msg: string) => {
    const id = `_r${_seq++}`;
    engine.world.createEntity(id);
    engine.world.addComponent(id, { type: 'SpawnRequest', templateId: tmpl, x: 0, y: 0 } as SpawnRequest);
    setLog(msg);
  }, [engine]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0 0' }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          onClick={() => cast('frost_nova', '❄️ Frost Nova → 冻结所有敌人（纯 CC，不扣血）')}
          style={{ padding: '8px 22px', background: '#091c2a', color: '#38bdf8', border: '1px solid #38bdf844', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >❄️ Frost Nova</button>
        <button
          onClick={() => cast('shatter_smash', '🔨 Shatter Smash → 仅冻结目标受 20% maxHP 真伤 + 解冻')}
          style={{ padding: '8px 22px', background: '#2a1200', color: '#fb923c', border: '1px solid #fb923c44', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >🔨 Shatter Smash</button>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {enemies.map(e => <EnemyCard key={e.id} e={e} />)}
      </div>

      {log && (
        <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', minHeight: 16 }}>{log}</div>
      )}
    </div>
  );
}

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:#060710;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#cbd5e1;font:13px system-ui';

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:10px;color:#2d3748;margin-bottom:10px;text-align:center;max-width:420px;line-height:1.5';
  hint.textContent = '暗黑类 ARPG PoC — 冰霜新星→碎冰重锤「冻结→真伤」涌现式系统叠加。零游戏专属代码。';

  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = `width:${CANVAS_W}px;height:${CANVAS_H}px;border-radius:8px;overflow:hidden`;

  const reactWrap = document.createElement('div');
  reactWrap.style.cssText = `width:${CANVAS_W}px`;

  wrapper.append(hint, canvasWrap, reactWrap);
  container.appendChild(wrapper);

  const engine = new Engine({ tickRate: 20 });
  engine.load(buildGameDBlueprint());

  // 静态相机：以 zoom=4 居中显示三个敌人（16px 方块，位于 world x=-40/0/40）
  engine.world.createEntity('_cam');
  engine.world.addComponent('_cam', {
    type: 'Camera', zoom: 4, offsetX: 0, offsetY: 0, rotation: 0,
    viewportW: CANVAS_W, viewportH: CANVAS_H,
  } as Camera);

  // 给敌人上色，在 canvas 中易于辨认
  for (const id of ['enemy_a', 'enemy_b', 'enemy_c']) {
    engine.world.addComponent(id, { type: 'Color', tint: 0xcc2222, alpha: 0.9 } as Color);
  }

  engine.attachRenderer(new CanvasRenderer({ width: CANVAS_W, height: CANVAS_H, background: '#060710' }), canvasWrap);
  engine.start();

  const root = createRoot(reactWrap);
  root.render(<Panel engine={engine} />);

  return () => {
    engine.stop();
    root.unmount();
    wrapper.remove();
  };
}
