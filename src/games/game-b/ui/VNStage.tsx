import React, { useEffect, useRef, useState } from 'react';
import { Engine } from '../../../runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import type { State, Text, Resource, Flag } from '@engine/protocol/components.js';
import { useWorldVersion } from '@ui/hooks/use-engine.js';
import { useComponent } from '@ui/hooks/use-component.js';
import { buildGameBBlueprint, GAME_B_STATS } from '../blueprint.js';
import { optionAvailable } from '@skills/tier3/index.js';
import type { DialogueGraph } from '@skills/tier3/index.js';
import { SCENE_01 } from '../data/dialogue.js';

// ═══════════════════════════════════════════════════════════════
//  Game B 演出层（React-DOM 浮层）。v0.2：7 属性面板 + 条件门控选项渲染。
//  对话框/选项/面板用 React-DOM（规避 R2/R3）；叙事状态住世界里，React 只读它渲染。
//  背景/立绘是占位色块（真贴图待资产流程）。
// ═══════════════════════════════════════════════════════════════

const PANEL = 'rgba(40, 28, 44, 0.92)';
const ACCENT = '#f9a8d4';
const STAT_LABEL: Record<string, string> = {
  charm: '魅力', wisdom: '智慧', stamina: '体力', career: '事业',
  affection_S: '好感·S', affection_T: '好感·T', affection_U: '好感·U',
};

function emit(engine: Engine, comp: Component): void {
  engine.world.addComponent('dialogue', comp);
}

function StatRow({ engine, id }: { engine: Engine; id: string }) {
  const r = useComponent<Resource>(engine, id, 'Resource');
  const pct = r ? (r.current / r.max) * 100 : 0;
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#fbcfe8' }}>
        <span>{STAT_LABEL[id] ?? id}</span><span>{r?.current ?? 0}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: ACCENT, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export function VNStage({ engine, script }: { engine: Engine; script: DialogueGraph }): React.ReactElement {
  useWorldVersion(engine);
  const state = useComponent<State>(engine, 'dialogue', 'State');
  const text = useComponent<Text>(engine, 'dialogue', 'Text');
  const warmed = useComponent<Flag>(engine, 'S_warmed_flag', 'Flag');
  const node = state ? script[state.current] : undefined;

  // 打字机（纯演出，按内容变化重置）。
  const full = text?.content ?? '';
  const [shown, setShown] = useState(0);
  const prev = useRef('');
  useEffect(() => { if (full !== prev.current) { prev.current = full; setShown(0); } }, [full]);
  useEffect(() => {
    if (shown >= full.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 28);
    return () => clearTimeout(t);
  }, [shown, full]);
  const typed = full.slice(0, shown);
  const done = shown >= full.length;
  const isChoice = node?.kind === 'choice';

  return (
    <div style={{ position: 'relative', width: 760, height: 500, background: '#2a1f2d', overflow: 'hidden', fontFamily: 'serif', color: '#fce7f3' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#3b2a3f,#241a28)' }} />
      {/* 立绘占位 */}
      <div style={{ position: 'absolute', left: 50, bottom: 160, width: 180, height: 290, background: 'rgba(249,168,212,0.18)', border: `2px solid ${ACCENT}`, borderRadius: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, fontSize: 13, color: ACCENT }}>
        立绘占位 · {node && (node.kind === 'line' || node.kind === 'choice') ? (node.emotion ?? 'neutral') : 'neutral'}
      </div>

      {/* 属性面板（ui-binding：7 资源 + 暖场 flag） */}
      <div style={{ position: 'absolute', top: 12, right: 12, width: 170, padding: 12, background: PANEL, borderRadius: 8 }}>
        <div style={{ marginBottom: 8, color: ACCENT, fontSize: 13, fontWeight: 600 }}>属性面板</div>
        {GAME_B_STATS.map((id) => <StatRow key={id} engine={engine} id={id} />)}
        <div style={{ marginTop: 6, fontSize: 11, color: warmed?.active ? '#86efac' : '#64748b' }}>
          {warmed?.active ? '★ 已暖场（解锁特殊选项）' : '· 未暖场'}
        </div>
      </div>

      {/* 对话框（CSS 原生换行 = 规避 R2） */}
      <div
        onClick={() => { if (node?.kind === 'line' && done) emit(engine, { type: 'DialogueAdvance' } as Component); }}
        style={{ position: 'absolute', left: 24, right: 200, bottom: 24, minHeight: 130, padding: 18, background: PANEL, borderRadius: 12, border: `1px solid ${ACCENT}55`, cursor: node?.kind === 'line' ? 'pointer' : 'default' }}
      >
        <div style={{ fontSize: 20, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{typed}</div>

        {isChoice && done && node.kind === 'choice' && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {node.options
              .map((opt, i) => ({ opt, i }))
              .filter(({ opt }) => optionAvailable(engine.world, opt)) // 条件门控：不满足的选项不显示
              .map(({ opt, i }) => (
                <button
                  key={i}
                  onClick={() => emit(engine, { type: 'DialogueChoose', index: i } as Component)}
                  style={{ textAlign: 'left', padding: '10px 14px', background: 'rgba(249,168,212,0.12)', color: '#fce7f3', border: `1px solid ${ACCENT}`, borderRadius: 8, cursor: 'pointer', fontSize: 16, fontFamily: 'serif' }}
                >
                  {opt.text}
                </button>
              ))}
          </div>
        )}

        {node?.kind === 'line' && done && (
          <div style={{ position: 'absolute', right: 16, bottom: 10, fontSize: 12, color: `${ACCENT}aa` }}>
            {node.next ? '▼ 点击继续' : '（完）'}
          </div>
        )}
      </div>
    </div>
  );
}

export function GameBApp(): React.ReactElement {
  const ref = useRef<Engine | null>(null);
  if (ref.current === null) {
    const engine = new Engine({ tickRate: 60 });
    engine.load(buildGameBBlueprint());
    engine.start();
    ref.current = engine;
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 24, background: '#1a1320', minHeight: '100vh' }}>
      <VNStage engine={ref.current} script={SCENE_01} />
    </div>
  );
}
