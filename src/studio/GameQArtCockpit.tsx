import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SHELL, sBtn, sInput, sLabel, sChip, sBadge } from '../ui/shell-theme.js';
import { mount as mountGameQ } from '../games/game-q/index.js';

const API = 'http://localhost:4000';
const GAME = 'game-q';
async function postJson(path: string, body: unknown): Promise<Record<string, unknown>> {
  return fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
}
// 3D 需求默认走 3D 适配器（tripo），2D 需求走千问。
function defaultAdapter(kind: string): 'qwen' | 'tripo' | 'meshy' {
  return kind === 'model3d' ? 'tripo' : 'qwen';
}

// ═══════════════════════════════════════════════════════════════
//  game-q 美术工坊（数据透视器·重设计版·标杆）—— 把「游戏=数据」做成看得见的美术管线入口。
//  左：game-q **活场景渲染窗**（复用卡带 mount()·ThreeRenderer 自理·不碰 P3D 域）。
//  右：这局**需要哪些美术**——从台账 `/games/game-q/art/game-q-art-ledger.json` 读、**按类型分组**
//      （3D 模型 / 精灵 / 贴图 / UI…）。选中一项 → 看它的槽位/查询词/占位/provenance。
//  数据源=已落进标准游戏美术目录的台账（`deriveRequirements` 产物·编号 art-NN·确定性）。
//  operate（生成/替换）走 REQ-DEMO-T2 的 /api/art/*（PST 域）——本面板先做「加载+看需求」，
//    操作接线随 T2 收口，避免与 PST 撞车。
// ═══════════════════════════════════════════════════════════════

interface Need {
  readonly no: string;
  readonly kind: string;
  readonly slot: { entity: string; component: string; field: string };
  readonly query: string;
  readonly placeholder: { current: string; source: string; count: number; instances: string[] };
  readonly spec?: Record<string, unknown>;
  readonly context: string;
  readonly status: string;
  readonly gen?: { id?: string; servedPath?: string; at?: string } | null;
  readonly provenance?: unknown;
}
interface Ledger {
  readonly version: number;
  readonly game: string;
  readonly count: number;
  readonly rows: Need[];
}

const KIND_LABEL: Record<string, string> = {
  model3d: '🧊 3D 模型',
  sprite: '👾 精灵',
  texture: '🖼 贴图',
  ui: '🎛 UI',
  particle: '✨ 粒子',
  material: '🎨 材质',
};

export function GameQArtCockpit({ onBack }: { onBack: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  // 每行 AI 生成（走千问 ai-gen + 人审门）：适配器 / 待审预览 / 忙 / 错。
  const [adapter, setAdapter] = useState<'qwen' | 'tripo' | 'meshy'>('qwen');
  const [pending, setPending] = useState<{ id: string; previewPath: string; no: string } | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);

  // 台账路径：优先标准 `art-ledger.json`（game-q 域产出·与 PST T2 同约定），回退我materialize 的
  // `game-q-art-ledger.json`。no-store：入库填 ID 后读到最新（否则浏览器缓存旧版·UI 不刷新）。
  const reloadLedger = useCallback(async () => {
    const bust = `?t=${Date.now()}`; // 强制新鲜（vite 静态文件 no-store 不够·填 ID 后必须读到最新）
    for (const name of ['art-ledger.json', `${GAME}-art-ledger.json`]) {
      try {
        const r = await fetch(`/games/${GAME}/art/${name}${bust}`, { cache: 'no-store' });
        if (!r.ok) continue;
        const j = await r.json();
        if (j && Array.isArray(j.rows)) { setLedger(j as Ledger); setLoadErr(null); return; }
      } catch { /* 试下一个 */ }
    }
    setLoadErr('台账加载失败（需 python3 apollo.py 起 vite·或 game-q 尚未产台账）');
  }, []);

  // ① 加载 game-q 活场景（卡带 mount → cleanup；ThreeRenderer 自建·失败不炸壳）。
  useEffect(() => {
    const div = stageRef.current;
    if (!div) return;
    let cleanup = () => {};
    try {
      cleanup = mountGameQ(div);
    } catch {
      /* 无 WebGL / 渲染环境缺失时降级：只展台需求列表，不阻塞 */
    }
    return () => {
      try { cleanup(); } catch { /* noop */ }
      div.innerHTML = '';
    };
  }, []);

  // ② 拉这局的美术需求台账（标准游戏美术目录·可 fetch）。
  useEffect(() => { void reloadLedger(); }, [reloadLedger]);

  // 选一行需求：默认适配器按类型、清掉上一行的待审预览。
  const pick = useCallback((row: Need) => {
    setSel(row.no);
    setAdapter(defaultAdapter(row.kind));
    setPending(null);
    setGenErr(null);
  }, []);

  // ✨ 生成此项：走千问 ai-gen（--game game-q·prompt=需求查询词）→ 落待审区、出预览（不入库）。
  const genRow = useCallback(async (row: Need) => {
    if (genBusy) return;
    setGenBusy(true); setGenErr(null); setPending(null);
    try {
      const res = await postJson('/api/assets/generate', { adapter, prompt: row.query, game: GAME });
      if (res.success && res.pending) setPending({ id: String(res.id), previewPath: String(res.previewPath), no: row.no });
      else setGenErr(String(res.error ?? '生成失败'));
    } catch (e) { setGenErr(String(e)); } finally { setGenBusy(false); }
  }, [adapter, genBusy]);

  // ✓ 入库：人审 approve → 资产落 game-q/art + 登记 index → 把生成 id 填回该需求行（数据+ID 对应）。
  const approveRow = useCallback(async (row: Need) => {
    if (!pending || genBusy) return;
    setGenBusy(true); setGenErr(null);
    try {
      const rev = await postJson('/api/assets/review', { id: pending.id, action: 'approve', game: GAME });
      if (!rev.success) { setGenErr(String(rev.error ?? '入库失败')); return; }
      const gen = { id: String(rev.id), servedPath: (rev.servedPath as string) ?? undefined, at: '' };
      await postJson('/api/art/needs-fill', { game: GAME, no: row.no, gen });
      setPending(null);
      // 乐观更新：直接从 approve 回执把该行标 filled（避免 re-fetch 竞态/缓存）；reloadLedger 再对账。
      setLedger((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => (r.no === row.no ? { ...r, status: 'filled', gen } : r)) } : prev));
      void reloadLedger();
    } catch (e) { setGenErr(String(e)); } finally { setGenBusy(false); }
  }, [pending, genBusy, reloadLedger]);

  // ✕ 弃：人审 reject → 删待审、不入库、不留痕。
  const rejectRow = useCallback(async () => {
    const p = pending; setPending(null);
    if (p) { try { await postJson('/api/assets/review', { id: p.id, action: 'reject', game: GAME }); } catch { /* noop */ } }
  }, [pending]);

  // 按类型分组（3D/精灵/贴图/UI…）。
  const groups = useMemo(() => {
    const g = new Map<string, Need[]>();
    for (const r of ledger?.rows ?? []) {
      const arr = g.get(r.kind) ?? [];
      arr.push(r);
      g.set(r.kind, arr);
    }
    return [...g.entries()];
  }, [ledger]);

  const selected = useMemo(() => ledger?.rows.find((r) => r.no === sel) ?? null, [ledger, sel]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: SHELL.appBg, color: SHELL.text, display: 'flex', flexDirection: 'column', fontFamily: SHELL.fontUi }}>
      {/* ── 头 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${SHELL.line}`, background: 'rgba(10,14,23,0.95)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: SHELL.violet, whiteSpace: 'nowrap' }}>🎨 game-q 美术工坊</span>
        <span style={{ fontSize: 12, color: SHELL.dim }}>《Neon Siege》· 标杆游戏 · 游戏=数据 → 看这局要哪些美术</span>
        {ledger && <span style={{ ...sChip(false), color: SHELL.jade }}>{ledger.count} 项美术需求</span>}
        <button onClick={onBack} style={{ ...sBtn('ghost'), marginLeft: 'auto' }}>← 返回</button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ── 左：活场景渲染窗 ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${SHELL.line}` }}>
          <div style={{ ...sLabel, padding: '8px 14px 4px' }}>游戏场景（活渲染 · ThreeRenderer 盒庭）</div>
          <div ref={stageRef} style={{ flex: 1, minHeight: 0, position: 'relative', background: '#03050b', overflow: 'hidden' }} />
          <div style={{ padding: '6px 14px', fontSize: 11, color: SHELL.dim, borderTop: `1px solid ${SHELL.line}` }}>
            现全程序化图元（占位）· 右侧每项=一个可换真美术的槽位（art-NN·编号确定性）
          </div>
        </div>

        {/* ── 右：按类型的美术需求 + 选中详情 ── */}
        <div style={{ width: 380, flex: 'none', display: 'flex', flexDirection: 'column', background: SHELL.bg1, minHeight: 0 }}>
          <div style={{ ...sLabel, padding: '10px 14px 6px' }}>需要的美术资源 · 按类型</div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
            {loadErr && <div style={{ color: SHELL.warn, fontSize: 12, padding: 10 }}>{loadErr}</div>}
            {!ledger && !loadErr && <div style={{ color: SHELL.dim, fontSize: 12, padding: 10 }}>台账加载中…</div>}
            {groups.map(([kind, rows]) => (
              <div key={kind} style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: SHELL.jade, padding: '4px 6px', display: 'flex', gap: 6 }}>
                  {KIND_LABEL[kind] ?? kind} <span style={{ color: SHELL.dim }}>· {rows.length}</span>
                </div>
                {rows.map((r) => {
                  const active = r.no === sel;
                  return (
                    <div
                      key={r.no}
                      onClick={() => pick(r)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                        background: active ? SHELL.violetWash : 'transparent',
                        border: `1px solid ${active ? SHELL.violetLine : 'transparent'}`,
                      }}
                    >
                      <span style={{ fontFamily: SHELL.fontMono, fontSize: 10, color: SHELL.dim, minWidth: 42 }}>{r.no}</span>
                      <span style={{ flex: 1, color: SHELL.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.slot.entity}</span>
                      {r.placeholder.count > 1 && <span style={{ fontSize: 10, color: SHELL.dim }}>×{r.placeholder.count}</span>}
                      <span style={sBadge(r.status === 'filled' ? 'ok' : 'warn')}>{r.status === 'filled' ? '已填' : '待生成'}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 选中详情 */}
          {selected && (
            <div style={{ flex: 'none', borderTop: `1px solid ${SHELL.line}`, padding: 14, maxHeight: '42%', overflow: 'auto' }}>
              <div style={{ fontSize: 13, color: SHELL.violet, marginBottom: 8 }}>{selected.no} · {selected.slot.entity}</div>
              <Row label="类型">{KIND_LABEL[selected.kind] ?? selected.kind}</Row>
              <Row label="槽位">{selected.slot.entity}.{selected.slot.component}.{selected.slot.field}</Row>
              <Row label="生成查询词">{selected.query}</Row>
              <Row label="当前占位">{selected.placeholder.current}（{selected.placeholder.source}）</Row>
              <Row label="用在">{selected.placeholder.instances.join('、')}</Row>
              {selected.spec && <Row label="规格">{Object.entries(selected.spec).map(([k, v]) => `${k}:${String(v)}`).join(' · ')}</Row>}
              {selected.gen?.id && (
                <Row label="已生成"><span style={{ color: SHELL.ok }}>{selected.gen.id}</span></Row>
              )}
              <div style={{ fontSize: 11, color: SHELL.dim, marginTop: 8, lineHeight: 1.5 }}>{selected.context}</div>

              {/* ── AI 生成此项（千问 ai-gen + 人审门·生成落 game-q 目录·填回 ID）── */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${SHELL.line}` }}>
                <div style={sLabel}>AI 生成此项（第三方·人审入库）</div>
                {!pending ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <select value={adapter} onChange={(e) => setAdapter(e.target.value as typeof adapter)} style={{ ...sInput(), padding: '5px 8px', background: SHELL.bg2, color: SHELL.sub }}>
                      <option value="qwen">🖼 千问 2D</option>
                      <option value="tripo">🧊 Tripo 3D</option>
                      <option value="meshy">🗿 Meshy 3D</option>
                    </select>
                    <button onClick={() => genRow(selected)} disabled={genBusy} style={{ ...sBtn('primary'), background: SHELL.violetWash, color: SHELL.violet, border: `1px solid ${SHELL.violetLine}`, opacity: genBusy ? 0.5 : 1 }}>
                      {genBusy ? '⏳ 生成中…' : selected.status === 'filled' ? '✨ 重新生成' : '✨ 生成此项'}
                    </button>
                    <span style={{ fontSize: 10, color: SHELL.dim }}>prompt=「{selected.query}」</span>
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: SHELL.violet, marginBottom: 6 }}>🔍 待人审（未入库）</div>
                    <img src={pending.previewPath} alt={pending.id} style={{ width: 120, height: 120, imageRendering: 'pixelated', border: `1px solid ${SHELL.line}`, borderRadius: 6, background: '#000' }} />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button onClick={() => approveRow(selected)} disabled={genBusy} style={{ ...sBtn('primary'), opacity: genBusy ? 0.5 : 1 }}>{genBusy ? '⏳…' : '✓ 入库并填 ID'}</button>
                      <button onClick={rejectRow} disabled={genBusy} style={{ ...sBtn('ghost'), color: SHELL.danger, borderColor: SHELL.danger }}>✕ 弃</button>
                    </div>
                  </div>
                )}
                {genErr && <div style={{ marginTop: 8, fontSize: 12, color: SHELL.danger }}>✕ {genErr}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12, margin: '3px 0' }}>
      <span style={{ color: SHELL.dim, minWidth: 64, flex: 'none' }}>{label}</span>
      <span style={{ color: SHELL.sub, wordBreak: 'break-all' }}>{children}</span>
    </div>
  );
}
