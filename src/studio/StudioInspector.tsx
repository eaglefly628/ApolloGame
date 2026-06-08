import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Engine } from '../runtime/engine.js';
import { CanvasRenderer } from '@renderer/canvas-renderer.js';
import { parseAssetIndex, AssetManager, ImageAssetLoader, type AssetIndex } from '@assets/index.js';
import { KeyboardInputSource, MultiInputSource, type InputSource } from '@net/index.js';
import type { WorldSnapshot } from '@engine/core/types.js';
import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import { demoBlueprint } from '../assembly/demo.assembly.js';
import {
  buildGameABlueprint,
  LEVEL_SCROLL,
  KEYMAP_A,
  KEYMAP_B,
  PLAYER_A,
  PLAYER_B,
  VIEWPORT_W,
  VIEWPORT_H,
  GAME_A_ASSETS,
} from '../games/game-a/index.js';
import { buildGameBBlueprint } from '../games/game-b/index.js';
import { buildGameCBlueprint } from '../games/game-c/index.js';
import { buildGameEBlueprint } from '../games/game-e/index.js';
import {
  inspectBlueprint,
  blueprintStats,
  capabilitySummaries,
  setField,
  coerceValue,
  exportManifest,
  type InspectedField,
} from './inspect.js';
import { studioAssets } from './assets-model.js';
import { AssetBrowser } from './AssetBrowser.js';
import { applyEditOps, type Entities } from './edit-ops.js';
import { resolveEdits, parseCommand } from './edit-resolve.js';

// ═══════════════════════════════════════════════════════════════
//  游戏数据透视器 (Data Inspector) — 把"游戏=数据"做成可见可改可预览
//
//  左：引擎实时预览(画布，Game A 可点焦后键盘试玩) + 实时世界状态读出
//  右：完整数据树(可改每个字段)  ｜  顶：游戏选择 + 统计 + 能力 + 资产 + 导出
//  改字段 → 改的是初始数据 → 点"重跑"用新数据从 t=0 重启 → 看涌现/手感变化。
//  垂直切片：Game A 打通"数据→透视→编辑→可玩预览"全链。
// ═══════════════════════════════════════════════════════════════

interface PreviewInput {
  input: InputSource;
  dispose: () => void;
}

interface GameDef {
  id: string;
  title: string;
  build: () => WorldBlueprint;
  viewport?: { w: number; h: number };
  /** 交互型游戏(Game A)提供：按 target(画布)建键盘输入源 → 可玩预览。 */
  makeInput?: (target: EventTarget) => PreviewInput;
  /** 美术资产管理器（贴图就绪画真图，否则占位方块）。 */
  makeAssets?: () => AssetManager;
  inputHint?: string;
}

const GAMES: GameDef[] = [
  {
    id: 'game-a',
    title: 'Game A · 协作平台(卷轴)',
    build: () => buildGameABlueprint(LEVEL_SCROLL),
    viewport: { w: VIEWPORT_W, h: VIEWPORT_H },
    inputHint: '点击画布聚焦后键盘试玩 —— 蓝 A：A/D 移动 · Space 跳　｜　橙 B：←/→ 移动 · / 跳',
    makeInput: (target) => {
      const sources = [
        new KeyboardInputSource(PLAYER_A, target, KEYMAP_A),
        new KeyboardInputSource(PLAYER_B, target, KEYMAP_B),
      ];
      return { input: new MultiInputSource(sources), dispose: () => sources.forEach((s) => s.dispose()) };
    },
    makeAssets: () => {
      const a = new AssetManager(new ImageAssetLoader());
      a.registerManifest(GAME_A_ASSETS);
      void a.loadAll();
      return a;
    },
  },
  { id: 'game-b', title: 'Game B · 乙游 VN', build: () => buildGameBBlueprint() },
  { id: 'game-c', title: 'Game C · 缝纫物语', build: () => buildGameCBlueprint() },
  { id: 'game-e', title: 'Game E · Balatro 小丑牌', build: () => buildGameEBlueprint() },
  { id: 'demo', title: 'Demo · 子弹撞墙', build: () => demoBlueprint },
];

const C = {
  bg: '#0a0f1e',
  panel: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  text: '#e2e8f0',
  dim: '#64748b',
  dim2: '#94a3b8',
  accent: '#38bdf8',
  purple: '#a78bfa',
  green: '#22c55e',
  amber: '#fbbf24',
  red: '#ef4444',
};

// ── 单字段编辑器（局部缓冲，失焦/回车提交；非法值红框不提交）──
function FieldEditor({ field, onCommit }: { field: InspectedField; onCommit: (raw: string) => void }) {
  // 值缺省 → 空串（绝不让 buf 为 undefined：JSON.stringify(undefined)===undefined 会让 buf.length 崩）。
  const initial =
    field.value === undefined || field.value === null
      ? ''
      : field.kind === 'json'
        ? JSON.stringify(field.value)
        : String(field.value);
  const [buf, setBuf] = useState(initial);
  const [bad, setBad] = useState(false);

  if (field.kind === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={field.value === true}
        onChange={(e) => onCommit(e.target.checked ? 'true' : 'false')}
        style={{ accentColor: C.accent, cursor: 'pointer' }}
      />
    );
  }

  const commit = () => {
    if (buf === initial) return; // 未改动不写：避免聚焦+失焦把未设置(undefined)默认值刷成 0/空
    const res = coerceValue(buf, field.kind);
    if (res.ok) {
      setBad(false);
      onCommit(buf);
    } else {
      setBad(true);
    }
  };

  const common: React.CSSProperties = {
    background: 'rgba(0,0,0,0.35)',
    color: bad ? C.red : C.text,
    border: `1px solid ${bad ? C.red : C.border}`,
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'monospace',
    padding: '3px 6px',
    outline: 'none',
  };

  if (field.kind === 'json') {
    return (
      <textarea
        value={buf}
        onChange={(e) => setBuf(e.target.value)}
        onBlur={commit}
        rows={(buf ?? '').length > 60 ? 3 : 1}
        style={{ ...common, width: '100%', resize: 'vertical' }}
      />
    );
  }

  return (
    <input
      type="text"
      value={buf}
      placeholder={field.value === undefined || field.value === null ? '(未设置)' : undefined}
      onChange={(e) => setBuf(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      style={{ ...common, width: field.kind === 'number' ? 90 : 180 }}
    />
  );
}

// ── 实时世界状态读出（从 world.snapshot 提取动态值）──
function LiveState({ snapshot, tick }: { snapshot: WorldSnapshot; tick: number }) {
  const rows: Array<{ k: string; v: string; c: string }> = [];
  for (const [eid, comps] of Object.entries(snapshot)) {
    const r = comps['Resource'] as unknown as { id: string; current: number } | undefined;
    if (r) rows.push({ k: `Resource ${r.id}`, v: String(r.current), c: C.accent });
    const f = comps['Flag'] as unknown as { id: string; active: boolean } | undefined;
    if (f) rows.push({ k: `Flag ${f.id}`, v: f.active ? 'on' : 'off', c: f.active ? C.green : C.dim });
    const s = comps['State'] as unknown as { fsmId: string; current: string } | undefined;
    if (s) rows.push({ k: `State ${s.fsmId}`, v: String(s.current), c: C.purple });
    const t = comps['Text'] as unknown as { content: string } | undefined;
    if (t) rows.push({ k: `Text ${eid}`, v: String(t.content), c: C.dim2 });
  }
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: C.dim, fontSize: 11, marginBottom: 4 }}>
        实时世界状态 · tick {tick}{' '}
        <span style={{ color: C.dim }}>(改资源值→重跑可看 Condition→Event→Effect 涌现)</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ color: C.dim, fontSize: 11 }}>（无 Resource/Flag/State/Text 动态值）</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {rows.map((r, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: '2px 6px',
                color: C.dim2,
              }}
            >
              {r.k}: <b style={{ color: r.c }}>{r.v}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudioInspector({ onBack, extraGame }: { onBack: () => void; extraGame?: GameDef }) {
  // 外部注入的游戏(如「在透视器里打开」AI 生成的游戏)排在内置游戏前，默认选中。
  const allGames = extraGame ? [extraGame, ...GAMES] : GAMES;
  const [gameId, setGameId] = useState(allGames[0].id);
  const [workingBp, setWorkingBp] = useState<WorldBlueprint>(() => allGames[0].build());
  const [appliedBp, setAppliedBp] = useState<WorldBlueprint>(workingBp);
  const [snapshot, setSnapshot] = useState<WorldSnapshot>({});
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(true);
  const [assetIndex, setAssetIndex] = useState<AssetIndex | null>(null);
  const [treeNonce, setTreeNonce] = useState(0); // 切游戏/重置时强制重挂数据树(刷新输入缓冲)
  const [flashed, setFlashed] = useState<string | null>(null); // 资产双击定位 → 高亮的实体
  const [nlCmd, setNlCmd] = useState(''); // 自然语言/命令行编辑输入
  const [nlMsg, setNlMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const entityRefs = useRef<Map<string, HTMLDetailsElement>>(new Map()); // 实体 id → 数据树 DOM(定位用)

  const dirty = workingBp !== appliedBp;

  // 资产双击定位：滚动右侧数据树到引用该资产的实体并展开+高亮。返回是否命中实体
  // （game-b 的 usedBy 是场景而非实体 → 命中不了 → 返回 false，仅在资产面板内展示用处）。
  const locate = useCallback((usedBy: string[]): boolean => {
    const targetId = usedBy.find((u) => entityRefs.current.has(u));
    if (!targetId) return false;
    const el = entityRefs.current.get(targetId)!;
    el.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashed(targetId);
    window.setTimeout(() => setFlashed((f) => (f === targetId ? null : f)), 1500);
    return true;
  }, []);

  // 资产索引（dev 下 vite 直接服务根目录的 assets/index.json）。
  useEffect(() => {
    fetch('/assets/index.json')
      .then((r) => r.json())
      .then((raw) => setAssetIndex(parseAssetIndex(raw)))
      .catch(() => setAssetIndex(null));
  }, []);

  // 引擎生命周期：appliedBp/gameId 变化(切游戏/重跑/重置)即重建并从 t=0 重启。
  useEffect(() => {
    const div = previewRef.current;
    if (!div) return;
    div.innerHTML = '';
    const def = allGames.find((g) => g.id === gameId);
    const vp = def?.viewport ?? { w: 640, h: 400 };
    const assets = def?.makeAssets?.();
    const pin = def?.makeInput?.(div);
    const engine = new Engine({ tickRate: 60, input: pin?.input });
    engine.load(appliedBp);
    const renderer = new CanvasRenderer({ width: vp.w, height: vp.h, assets });
    engine.attachRenderer(renderer, div);
    engineRef.current = engine;
    rendererRef.current = renderer;
    let last = 0;
    const unsub = engine.subscribe(() => {
      const now = performance.now();
      if (now - last > 150) {
        last = now;
        setSnapshot(engine.world.snapshot());
        setTick(engine.world.getVersion());
      }
    });
    engine.start();
    setRunning(true);
    setSnapshot(engine.world.snapshot());
    setTick(0);
    return () => {
      unsub();
      engine.stop();
      renderer.destroy();
      pin?.dispose();
      engineRef.current = null;
      rendererRef.current = null;
      div.innerHTML = '';
    };
  }, [appliedBp, gameId]);

  const selectGame = useCallback((id: string) => {
    const def = allGames.find((g) => g.id === id);
    if (!def) return;
    const bp = def.build();
    setGameId(id);
    setWorkingBp(bp);
    setAppliedBp(bp);
    setTreeNonce((n) => n + 1);
  }, []);

  const apply = useCallback(() => setAppliedBp(workingBp), [workingBp]);

  // 自然语言/命令编辑：命令行解析(零模型对照) → 解析吸附 → 强校验应用 → 改 workingBp(点重跑生效)。
  // LLM 接入后只需把 parseCommand 换成"模型产 LooseEdit[]"，复用同一 resolve/apply 管线。
  const runNlEdit = useCallback(() => {
    const line = nlCmd.trim();
    if (!line) return;
    const parsed = parseCommand(line);
    if ('error' in parsed) {
      setNlMsg({ ok: false, text: parsed.error });
      return;
    }
    const ents = workingBp.entities as unknown as Entities;
    const { ops, errors } = resolveEdits(ents, [parsed]);
    if (errors.length) {
      setNlMsg({ ok: false, text: errors.join('；') });
      return;
    }
    const { entities: next, results } = applyEditOps(ents, ops);
    const bad = results.filter((r) => !r.ok);
    if (bad.length) {
      setNlMsg({ ok: false, text: bad.map((b) => b.reason).join('；') });
      return;
    }
    setWorkingBp((bp) => ({ ...bp, entities: next as typeof bp.entities }));
    const r0 = results[0];
    setNlMsg({ ok: true, text: `已改 ${r0.op.entity}：${JSON.stringify(r0.before)} → ${JSON.stringify(r0.after)}（点上方"重跑"看效果）` });
    setNlCmd('');
  }, [nlCmd, workingBp]);

  const reset = useCallback(() => {
    const def = allGames.find((g) => g.id === gameId);
    if (!def) return;
    const bp = def.build();
    setWorkingBp(bp);
    setAppliedBp(bp);
    setTreeNonce((n) => n + 1);
  }, [gameId]);

  const togglePlay = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    if (running) {
      e.stop();
      setRunning(false);
    } else {
      e.start();
      setRunning(true);
    }
  }, [running]);

  const stepOnce = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.world.tick();
    rendererRef.current?.sync(e.world);
    setSnapshot(e.world.snapshot());
    setTick(e.world.getVersion());
  }, []);

  const commitField = useCallback((entityId: string, type: string, f: InspectedField, raw: string) => {
    const res = coerceValue(raw, f.kind);
    if (!res.ok) return;
    setWorkingBp((bp) => setField(bp, entityId, type, f.key, res.value));
  }, []);

  const exportJson = useCallback(() => {
    const blob = new Blob([exportManifest(workingBp)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameId}.manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [workingBp, gameId]);

  const inspected = useMemo(() => inspectBlueprint(workingBp), [workingBp]);
  const stats = useMemo(() => blueprintStats(workingBp), [workingBp]);
  const caps = useMemo(() => capabilitySummaries(workingBp.capabilities), [workingBp]);
  const assets = useMemo(
    () => studioAssets(gameId, workingBp, assetIndex),
    [gameId, workingBp, assetIndex],
  );

  const currentDef = allGames.find((g) => g.id === gameId);
  const vp = currentDef?.viewport ?? { w: 640, h: 400 };

  const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.06)',
    color: C.dim2,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'monospace',
    ...extra,
  });

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, color: C.text, overflow: 'auto' }}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(10,15,30,0.95)',
          borderBottom: `1px solid ${C.border}`,
          padding: '12px 20px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.purple }}>🔬 数据透视器</span>
          <span style={{ color: C.dim, fontSize: 12 }}>
            游戏 = 数据 · {stats.entities} 实体 / {stats.components} 组件 / {stats.capabilities} 能力
          </span>
          <div style={{ flex: 1 }} />
          {dirty && <span style={{ color: C.amber, fontSize: 12 }}>● 有未应用的修改</span>}
          <button
            onClick={apply}
            disabled={!dirty}
            style={btn({
              background: dirty ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.04)',
              color: dirty ? C.accent : C.dim,
              borderColor: dirty ? 'rgba(56,189,248,0.4)' : C.border,
              cursor: dirty ? 'pointer' : 'default',
            })}
          >
            ↻ 重跑(应用)
          </button>
          <button onClick={reset} style={btn()}>重置</button>
          <button onClick={exportJson} style={btn({ color: C.green, borderColor: 'rgba(34,197,94,0.3)' })}>
            ⭳ 导出 manifest
          </button>
          <button onClick={onBack} style={btn()}>← 返回</button>
        </div>

        {/* Game selector */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {allGames.map((g) => (
            <button
              key={g.id}
              onClick={() => selectGame(g.id)}
              style={btn({
                background: gameId === g.id ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
                color: gameId === g.id ? C.purple : C.dim2,
                borderColor: gameId === g.id ? 'rgba(167,139,250,0.4)' : C.border,
              })}
            >
              {g.title}
              {g.makeInput && <span style={{ color: C.green, marginLeft: 4 }}>· 可玩</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Body: two columns */}
      <div style={{ display: 'flex', gap: 16, padding: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left: preview + state + capabilities + assets */}
        <div style={{ flex: '0 0 660px', maxWidth: '100%' }}>
          <div
            ref={previewRef}
            tabIndex={0}
            onClick={(e) => e.currentTarget.focus()}
            style={{
              width: vp.w,
              height: vp.h,
              maxWidth: '100%',
              background: '#16213e',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
              outline: 'none',
            }}
          />

          {/* Playback controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <button onClick={togglePlay} style={btn()}>{running ? '⏸ 暂停' : '▶ 继续'}</button>
            <button onClick={stepOnce} style={btn()}>⏭ 单步</button>
            <span style={{ color: C.dim, fontSize: 11 }}>tick {tick}</span>
          </div>

          {currentDef?.inputHint && (
            <div style={{ color: C.amber, fontSize: 11, marginTop: 4 }}>{currentDef.inputHint}</div>
          )}
          <div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>
            空间预览（画布）：有 Transform/Shape 的实体在此可见；纯逻辑/文字游戏在此为空，看下方实时状态 + 右侧数据。
          </div>

          <LiveState snapshot={snapshot} tick={tick} />

          {/* Capabilities */}
          <div style={{ marginTop: 14 }}>
            <div style={{ color: C.dim, fontSize: 11, marginBottom: 4 }}>启用的引擎能力（解释这些数据的代码）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {caps.map((c) => (
                <span
                  key={c.id}
                  title={`${c.summary}\n提供组件: ${c.provides.join(', ')}`}
                  style={{
                    fontSize: 11,
                    background: 'rgba(167,139,250,0.1)',
                    border: '1px solid rgba(167,139,250,0.2)',
                    borderRadius: 12,
                    padding: '2px 10px',
                    color: C.purple,
                    cursor: 'help',
                  }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>

          {/* Assets — 商业引擎风资产透视：分类(可收缩) + tag 搜索 + 双击定位 */}
          <div style={{ marginTop: 14 }}>
            <div style={{ color: C.dim, fontSize: 11, marginBottom: 6 }}>
              资产透视 · 这局要哪些美术、填了没、谁在用{' '}
              {assetIndex === null && <span style={{ color: C.dim }}>（assets/index.json 未加载，状态走数据声明）</span>}
            </div>
            <AssetBrowser assets={assets} onLocate={locate} />
          </div>
        </div>

        {/* Right: NL edit box + full editable data tree */}
        <div style={{ flex: 1, minWidth: 360 }}>
          {/* 自然语言/命令编辑（模型无关地基：解析→吸附→强校验→应用，零模型可用） */}
          <div style={{ marginBottom: 10, padding: 10, background: 'rgba(167,139,250,0.06)', border: `1px solid rgba(167,139,250,0.2)`, borderRadius: 8 }}>
            <div style={{ color: C.purple, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>✎ 自然语言编辑（模型无关）</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={nlCmd}
                onChange={(e) => setNlCmd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runNlEdit()}
                placeholder='如：player 重力 0.9 ｜ player 速度 x1.5 ｜ platform0 变蓝'
                style={{ flex: 1, background: 'rgba(0,0,0,0.35)', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, padding: '6px 8px', outline: 'none' }}
              />
              <button onClick={runNlEdit} style={btn({ background: 'rgba(167,139,250,0.18)', color: C.purple, borderColor: 'rgba(167,139,250,0.4)' })}>应用编辑</button>
            </div>
            {nlMsg && (
              <div style={{ marginTop: 6, fontSize: 11, color: nlMsg.ok ? C.green : C.red }}>
                {nlMsg.ok ? '✓ ' : '✗ '}{nlMsg.text}
              </div>
            )}
            <div style={{ marginTop: 4, fontSize: 10, color: C.dim }}>
              格式 <code>实体 目标 值</code>：<code>0.9</code>=设值 · <code>x1.5</code>=相对乘 · <code>+3/-2</code>=相对加 · <code>变蓝/颜色 红</code>=改色。错值会被强校验拦截。
            </div>
          </div>

          <div style={{ color: C.dim, fontSize: 11, marginBottom: 8 }}>
            完整数据（实体 → 组件 → 字段，全可改；改完点上方"重跑"应用）
          </div>
          <div key={`${gameId}:${treeNonce}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inspected.map((ent) => (
              <details
                key={ent.id}
                open
                ref={(el) => {
                  if (el) entityRefs.current.set(ent.id, el);
                  else entityRefs.current.delete(ent.id);
                }}
                style={{
                  background: flashed === ent.id ? 'rgba(56,189,248,0.12)' : C.panel,
                  borderRadius: 8,
                  border: `1px solid ${flashed === ent.id ? C.accent : C.border}`,
                  transition: 'background 0.4s, border-color 0.4s',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: C.accent,
                    userSelect: 'none',
                  }}
                >
                  {ent.id}{' '}
                  <span style={{ color: C.dim, fontSize: 11 }}>
                    {ent.components.map((c) => c.type).join(' · ')}
                  </span>
                </summary>
                <div style={{ padding: '0 12px 10px' }}>
                  {ent.components.map((comp) => (
                    <div key={comp.type} style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.dim2 }}>
                        {comp.type}
                        {comp.category && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              color: C.dim,
                              background: 'rgba(255,255,255,0.05)',
                              borderRadius: 4,
                              padding: '1px 5px',
                            }}
                          >
                            {comp.category}
                          </span>
                        )}
                        {comp.describe && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: C.dim, fontWeight: 400 }}>
                            {comp.describe}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, paddingLeft: 8 }}>
                        {comp.fields.map((f) => (
                          <div key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span
                              title={f.describe}
                              style={{
                                fontSize: 12,
                                fontFamily: 'monospace',
                                color: C.dim2,
                                minWidth: 110,
                                cursor: f.describe ? 'help' : 'default',
                              }}
                            >
                              {f.key}
                              {f.declaredType && <span style={{ color: C.dim, fontSize: 10 }}> :{f.declaredType}</span>}
                            </span>
                            <FieldEditor field={f} onCommit={(raw) => commitField(ent.id, comp.type, f, raw)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
