import React, { useEffect, useRef, useState } from 'react';
import { Engine } from '../../../runtime/engine.js';
import type { Component } from '@engine/core/types.js';
import type { State, Text, Resource } from '@engine/protocol/components.js';
import { useWorldVersion } from '@ui/hooks/use-engine.js';
import { useComponent } from '@ui/hooks/use-component.js';
import { buildGameBBlueprint } from '../blueprint.js';
import { SCENE_01, type DialogueScript } from '../data/dialogue.js';

// ═══════════════════════════════════════════════════════════════
//  Game B 演出层（React-DOM 浮层）—— 验证我们定的架构：
//  对话框/选项/属性面板用 React-DOM（CSS 原生换行 + onClick），规避 R2(多行文本)/R3(canvas 命中)。
//  叙事状态住在 World 里（State/Resource/Flag），React 只读它渲染；点击注入事件到世界。
//  背景/立绘是占位色块（真贴图待 R1 资产 + 占位 provider）。
// ═══════════════════════════════════════════════════════════════

const SAKURA_BG = '#2a1f2d';
const SAKURA_PANEL = 'rgba(40, 28, 44, 0.92)';
const SAKURA_ACCENT = '#f9a8d4';

// 注入一次性事件到 dialogue 实体；引擎下一 tick 由 dialogue-runner 消费。
function emit(engine: Engine, comp: Component): void {
  engine.world.addComponent('dialogue', comp);
}

export function VNStage({ engine, script }: { engine: Engine; script: DialogueScript }): React.ReactElement {
  useWorldVersion(engine); // 每 tick 重渲染
  const state = useComponent<State>(engine, 'dialogue', 'State');
  const text = useComponent<Text>(engine, 'dialogue', 'Text');
  const affection = useComponent<Resource>(engine, 'affection_S', 'Resource');
  const node = state ? script[state.current] : undefined;

  // 打字机：按内容变化重置，逐字揭示（纯演出，不进世界状态）。
  const full = text?.content ?? '';
  const [shown, setShown] = useState(0);
  const prev = useRef('');
  useEffect(() => {
    if (full !== prev.current) {
      prev.current = full;
      setShown(0);
    }
  }, [full]);
  useEffect(() => {
    if (shown >= full.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 28);
    return () => clearTimeout(t);
  }, [shown, full]);
  const typed = full.slice(0, shown);
  const done = shown >= full.length;

  const isChoice = node?.kind === 'choice';

  return (
    <div style={{ position: 'relative', width: 720, height: 480, background: SAKURA_BG, overflow: 'hidden', fontFamily: 'serif', color: '#fce7f3' }}>
      {/* 背景占位（待 R1 真贴图） */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#3b2a3f,#241a28)' }} />
      {/* 立绘占位（带表情标签） */}
      <div style={{ position: 'absolute', left: 60, bottom: 150, width: 180, height: 280, background: 'rgba(249,168,212,0.18)', border: `2px solid ${SAKURA_ACCENT}`, borderRadius: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, fontSize: 13, color: SAKURA_ACCENT }}>
        立绘占位 · {node?.kind === 'line' || node?.kind === 'choice' ? (node.emotion ?? 'neutral') : 'neutral'}
      </div>

      {/* 属性面板（ui-binding：读 Resource 投影成条） */}
      <div style={{ position: 'absolute', top: 12, right: 12, width: 180, padding: 10, background: SAKURA_PANEL, borderRadius: 8, fontSize: 13 }}>
        <div style={{ marginBottom: 6, color: SAKURA_ACCENT }}>好感度 · S</div>
        <div style={{ height: 12, background: 'rgba(0,0,0,0.4)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ width: `${affection ? (affection.current / affection.max) * 100 : 0}%`, height: '100%', background: SAKURA_ACCENT, transition: 'width 0.3s' }} />
        </div>
        <div style={{ textAlign: 'right', marginTop: 2 }}>{affection?.current ?? 0} / {affection?.max ?? 100}</div>
      </div>

      {/* 对话框（CSS 原生换行 = 规避 R2） */}
      <div
        onClick={() => { if (node?.kind === 'line' && done) emit(engine, { type: 'DialogueAdvance' } as Component); }}
        style={{ position: 'absolute', left: 24, right: 24, bottom: 24, minHeight: 120, padding: 18, background: SAKURA_PANEL, borderRadius: 12, border: `1px solid ${SAKURA_ACCENT}55`, cursor: node?.kind === 'line' ? 'pointer' : 'default' }}
      >
        <div style={{ fontSize: 20, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{typed}</div>

        {/* 选项（onClick = 规避 R3 的 canvas 命中测试） */}
        {isChoice && done && node.kind === 'choice' && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {node.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => emit(engine, { type: 'DialogueChoose', index: i } as Component)}
                style={{ textAlign: 'left', padding: '10px 14px', background: 'rgba(249,168,212,0.12)', color: '#fce7f3', border: `1px solid ${SAKURA_ACCENT}`, borderRadius: 8, cursor: 'pointer', fontSize: 16, fontFamily: 'serif' }}
              >
                {opt.text}
              </button>
            ))}
          </div>
        )}

        {node?.kind === 'line' && done && (
          <div style={{ position: 'absolute', right: 16, bottom: 10, fontSize: 12, color: `${SAKURA_ACCENT}aa` }}>
            {node.next ? '▼ 点击继续' : '（完）'}
          </div>
        )}
      </div>
    </div>
  );
}

// 自包含挂载组件：建引擎 + 载蓝图 + 起循环 + 渲染演出层。未来 main 入口只需 <GameBApp/>。
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
