import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SHELL, sBtn, sInput, sBadge, sChecker, sLabel } from '../ui/shell-theme.js';

// ═══════════════════════════════════════════════════════════════
//  美术台账浏览墙（REQ-DEMO-T2 ③④⑤·owner 硬要求「完整浏览+优化流程」）。
//  逐游戏缩略图墙：每格=编号 art-01…+槽位语义+来源标（generated/库/上传/MOCK）+缩略图；
//  点开看 prompt/provenance/history + 并排预览（占位/现用）+ 按编号三式替换：
//    🔄 重新生成（可改 prompt·选风格包）/ 📚 从共享库选换（钉资产 id）/ ⬆ 上传替换。
//  顶部「换皮」= 同玩法换风格包 → 新卡带。全走 T2 后端端点（apollo.py·CORS *），预览图走相对 /games。
// ═══════════════════════════════════════════════════════════════

const API = 'http://localhost:4000';

interface Provenance { readonly model?: string; readonly prompt?: string; readonly date?: string; readonly license?: string }
interface Gen { readonly provider?: string; readonly source?: string; readonly model?: string; readonly prompt?: string; readonly servedPath?: string; readonly localId?: string; readonly pack?: string }
interface Hist { readonly action?: string; readonly at?: string; readonly assetId?: string }
export interface LedgerRow {
  readonly no: string;
  readonly kind: string;
  readonly slot: { entity: string; component: string; field: string };
  readonly query: string;
  readonly placeholder?: { ref?: string; current?: string; source?: string; count?: number };
  readonly spec?: Record<string, unknown>;
  readonly context?: string;
  readonly status: string;
  readonly gen?: Gen | null;
  readonly provenance?: Provenance | null;
  readonly history?: Hist[];
}
interface Pack { readonly packId: string; readonly name: string; readonly palette?: number[] }

const SOURCE_BADGE = (r: LedgerRow): { text: string; tone: 'ok' | 'warn' | 'dim' } => {
  const s = r.gen?.source;
  if (s === 'library') return { text: '📚 库', tone: 'ok' };
  if (s === 'upload') return { text: '⬆ 上传', tone: 'ok' };
  if (r.status === 'replaced' || r.status === 'generated') return { text: r.gen?.model?.includes('mock') ? '⚙ MOCK' : '✨ 生成', tone: r.gen?.model?.includes('mock') ? 'warn' : 'ok' };
  return { text: '占位', tone: 'dim' };
};
// 缩略图 URL：生成的 2D 走 servedPath；其它退化为图标。
function thumbUrl(r: LedgerRow): string | null {
  if (r.kind !== 'model3d' && r.gen?.servedPath) return r.gen.servedPath;
  return null;
}

export function ArtLedgerPanel({ slug, title, onBack, onChanged }: { slug: string; title?: string; onBack: () => void; onChanged?: () => void }) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selNo, setSelNo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  // 三式替换/换皮输入
  const [regenPrompt, setRegenPrompt] = useState('');
  const [regenPack, setRegenPack] = useState('pixel-retro');
  const [swapId, setSwapId] = useState('');
  const [reskinPack, setReskinPack] = useState('neon-synthwave');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/art/ledger?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => setRows(j?.success ? (j.rows ?? []) : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [slug]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    fetch(`${API}/api/art/style-packs`).then((r) => r.json()).then((j) => { const p = (j?.packs ?? []) as Pack[]; setPacks(p); if (p[0]) { setRegenPack(p[0].packId); setReskinPack(p[1]?.packId ?? p[0].packId); } }).catch(() => setPacks([]));
  }, []);

  const sel = useMemo(() => rows.find((r) => r.no === selNo) ?? null, [rows, selNo]);

  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); window.setTimeout(() => setToast(null), 3200); };
  const act = useCallback(async (url: string, body: unknown, okMsg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json() as Promise<{ success?: boolean; error?: string; newSlug?: string }>);
      if (res.success) { flash(true, res.newSlug ? `${okMsg} → ${res.newSlug}` : okMsg); load(); onChanged?.(); }
      else flash(false, `✕ ${res.error ?? '失败'}`);
    } catch (e) { flash(false, `✕ ${String(e)}`); }
    finally { setBusy(false); }
  }, [busy, load, onChanged]);

  const doRegen = () => sel && act('/api/art/regenerate', { slug, no: sel.no, packId: regenPack, query: regenPrompt.trim() || undefined, mock: true }, `✓ 重生成 ${sel.no}`);
  const doSwap = () => sel && swapId.trim() && act('/api/art/swap', { slug, no: sel.no, assetId: swapId.trim() }, `✓ 换库 ${sel.no}`);
  const doReskin = () => act('/api/art/reskin', { slug, packId: reskinPack, mock: true }, `✓ 换皮 ${reskinPack}`);
  const doUpload = useCallback((file: File) => {
    if (!sel) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result || '').split(',')[1] || '';
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      act('/api/art/upload', { slug, no: sel.no, dataBase64: b64, ext }, `✓ 上传替换 ${sel.no}`);
    };
    reader.readAsDataURL(file);
  }, [sel, slug, act]);

  const counts = useMemo(() => {
    const done = rows.filter((r) => r.status === 'replaced' || r.status === 'generated').length;
    return { done, total: rows.length };
  }, [rows]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: SHELL.appBg, color: SHELL.text, display: 'flex', flexDirection: 'column', fontFamily: SHELL.fontUi, zIndex: 400 }}>
      {/* 头 */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${SHELL.line}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: SHELL.violet }}>🎨 美术台账</span>
        <span style={{ fontSize: 13, color: SHELL.sub }}>{title || slug}</span>
        <span style={{ ...sBadge(counts.done === counts.total && counts.total > 0 ? 'ok' : 'warn') }}>{counts.done}/{counts.total} 已配</span>
        <span style={{ flex: 1 }} />
        {/* 换皮 */}
        <span style={{ fontSize: 12, color: SHELL.dim }}>换皮：</span>
        <select value={reskinPack} onChange={(e) => setReskinPack(e.target.value)} style={{ ...sInput(), padding: '6px 8px' }}>
          {packs.map((p) => <option key={p.packId} value={p.packId}>{p.name}</option>)}
        </select>
        <button onClick={doReskin} disabled={busy} style={{ ...sBtn('primary'), opacity: busy ? 0.5 : 1 }} title="同玩法换风格包 → 存新卡带">🎭 一键换皮</button>
        <button onClick={load} style={sBtn('quiet')}>↻</button>
        <button onClick={onBack} style={sBtn('ghost')}>← 返回</button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 缩略图墙 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignContent: 'flex-start', minWidth: 0 }}>
          {loading ? <div style={{ color: SHELL.dim }}>加载台账…</div>
            : rows.length === 0 ? <div style={{ color: SHELL.dim, fontSize: 13 }}>无台账（先在生成流水线里 derive 这个游戏）</div>
              : rows.map((r) => {
                const b = SOURCE_BADGE(r); const thumb = thumbUrl(r); const active = selNo === r.no;
                return (
                  <div key={r.no} onClick={() => { setSelNo(r.no); setRegenPrompt(r.query || ''); setSwapId(''); }} style={{ width: 132, padding: 8, borderRadius: 9, cursor: 'pointer', background: active ? SHELL.jadeWash : 'rgba(255,255,255,0.02)', border: `1px solid ${active ? SHELL.jadeLine : SHELL.line}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: SHELL.fontMono, fontSize: 11, color: SHELL.jade, fontWeight: 700 }}>{r.no}</span>
                      <span style={{ ...sBadge(b.tone), fontSize: 9, marginLeft: 'auto' }}>{b.text}</span>
                    </div>
                    <div style={{ ...sChecker, width: '100%', height: 96, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `1px solid ${SHELL.line}` }}>
                      {thumb ? <img src={thumb} alt={r.no} style={{ maxWidth: '92%', maxHeight: '92%', imageRendering: 'pixelated' }} />
                        : <span style={{ fontSize: 30, opacity: 0.55 }}>{r.kind === 'model3d' ? '🧊' : '🎨'}</span>}
                    </div>
                    <div style={{ fontSize: 10.5, color: SHELL.sub, wordBreak: 'break-all', lineHeight: 1.3, maxHeight: 26, overflow: 'hidden' }}>{r.slot.entity}</div>
                    <div style={{ fontSize: 9, color: SHELL.dim }}>{r.kind}{r.placeholder?.count && r.placeholder.count > 1 ? ` ·×${r.placeholder.count}` : ''}</div>
                  </div>
                );
              })}
        </div>

        {/* 详情 + 三式替换 + 并排预览 */}
        <div style={{ width: 320, flex: 'none', borderLeft: `1px solid ${SHELL.line}`, background: SHELL.bg1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!sel ? <div style={{ color: SHELL.dim, fontSize: 12, marginTop: 20, textAlign: 'center' }}>点击左侧编号 art-N 查看 + 替换</div> : (
            <>
              <div style={{ fontFamily: SHELL.fontMono, fontSize: 13, color: SHELL.jade }}>{sel.no} · {sel.kind}</div>
              <div style={{ fontSize: 11, color: SHELL.sub, lineHeight: 1.5 }}>{sel.context || sel.query}</div>
              {/* ⑤ 并排预览：占位 vs 现用 */}
              {(() => {
                const cur = thumbUrl(sel);
                const box = (lab: string, img: string | null, desc: string) => (
                  <div style={{ flex: 1 }}>
                    <div style={{ ...sLabel, marginBottom: 3 }}>{lab}</div>
                    <div style={{ ...sChecker, height: 88, borderRadius: 6, border: `1px solid ${SHELL.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 10, color: SHELL.dim, padding: 4, textAlign: 'center' }}>
                      {img ? <img src={img} alt={lab} style={{ maxWidth: '90%', maxHeight: '90%', imageRendering: 'pixelated' }} /> : <span style={{ wordBreak: 'break-all' }}>{desc}</span>}
                    </div>
                  </div>
                );
                return (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {box('占位/原始', null, sel.placeholder?.current || sel.placeholder?.ref || '—')}
                    {box('现用', cur, cur ? '' : (sel.gen?.localId || '待生成'))}
                  </div>
                );
              })()}
              {sel.provenance?.prompt && <div style={{ fontSize: 10, color: SHELL.dim, wordBreak: 'break-all' }}>prompt: {sel.provenance.prompt}</div>}
              {(sel.history?.length ?? 0) > 0 && <div style={{ fontSize: 10, color: SHELL.faint }}>历史: {sel.history!.map((h) => h.action).join(' → ')}</div>}

              {/* 🔄 重新生成 */}
              <div style={{ borderTop: `1px solid ${SHELL.line}`, paddingTop: 10 }}>
                <div style={sLabel}>🔄 重新生成（可改描述）</div>
                <textarea value={regenPrompt} onChange={(e) => setRegenPrompt(e.target.value)} rows={2} style={{ ...sInput(), width: '100%', margin: '6px 0', resize: 'vertical', fontFamily: SHELL.fontMono, fontSize: 11 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={regenPack} onChange={(e) => setRegenPack(e.target.value)} style={{ ...sInput(), flex: 1, padding: '6px 8px' }}>{packs.map((p) => <option key={p.packId} value={p.packId}>{p.name}</option>)}</select>
                  <button onClick={doRegen} disabled={busy} style={{ ...sBtn('primary'), opacity: busy ? 0.5 : 1 }}>生成</button>
                </div>
              </div>
              {/* 📚 从共享库选换 */}
              <div>
                <div style={sLabel}>📚 从共享库选换（资产 id）</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input value={swapId} onChange={(e) => setSwapId(e.target.value)} placeholder="如 dungeon/monsters/orc" style={{ ...sInput(), flex: 1 }} />
                  <button onClick={doSwap} disabled={busy || !swapId.trim()} style={{ ...sBtn('ghost'), opacity: busy || !swapId.trim() ? 0.5 : 1 }}>换</button>
                </div>
              </div>
              {/* ⬆ 上传替换 */}
              <div>
                <div style={sLabel}>⬆ 上传替换</div>
                <input type="file" accept=".png,.webp,.jpg,.jpeg,.glb" onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f); }} style={{ fontSize: 11, color: SHELL.sub, marginTop: 6 }} />
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 50, padding: '9px 18px', borderRadius: 8, fontSize: 13, background: SHELL.bg2, border: `1px solid ${toast.ok ? SHELL.jadeLine : SHELL.danger}`, color: toast.ok ? SHELL.ok : SHELL.danger, boxShadow: SHELL.shadow }}>{toast.msg}</div>}
    </div>
  );
}
