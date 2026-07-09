import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SHELL, sBtn, sInput, sBadge, sChecker, sLabel } from '../ui/shell-theme.js';

// ═══════════════════════════════════════════════════════════════
//  美术台账浏览墙（REQ-DEMO-T2 ③④⑤·owner 硬要求「完整浏览+优化流程」）。
//  逐游戏缩略图墙：每格=编号 art-01…+槽位语义+来源标（generated/库/上传/MOCK）+缩略图；
//  点开看 prompt/provenance/history + 并排预览（占位/现用）+ 按编号三式替换：
//    🔄 重新生成（可改 prompt·选风格包）/ 📚 从共享库选换（钉资产 id）/ ⬆ 上传替换。
//  顶部「换皮」= 同玩法换风格包 → 新卡带；「一键全量」= 整表批量生成（断点续跑）。
//  双数据源（R1 ① 平台归一）：library 卡带（manifest 线·三式+换皮）/ 编译期游戏（requirements 台账·
//  生成走 fill=skinKey 别名写回·无 manifest 的动作自动隐藏）。mock=显式勾选才走（无 key 时服务端探针+mock 兜底）。
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
  readonly prompt?: string; // 回填的完整提示词（skinKey 行有·needs-art 行 null）
  readonly placeholder?: { ref?: string; current?: string; source?: string; count?: number };
  readonly spec?: Record<string, unknown>;
  readonly context?: string;
  readonly status: string;
  readonly skinKey?: string;
  readonly gen?: Gen | null;
  readonly provenance?: Provenance | null;
  readonly history?: Hist[];
}
interface Pack { readonly packId: string; readonly name: string; readonly palette?: number[] }

const SOURCE_BADGE = (r: LedgerRow): { text: string; tone: 'ok' | 'warn' | 'dim' } => {
  const s = r.gen?.source;
  if (r.status === 'retired') return { text: '🪦 退役', tone: 'dim' }; // 墓碑：槽位已消失·编号保留不复用
  if (s === 'library') return { text: '📚 库', tone: 'ok' };
  if (s === 'upload') return { text: '⬆ 上传', tone: 'ok' };
  if (r.status === 'replaced' || r.status === 'generated' || r.status === 'filled') return { text: r.gen?.model?.includes('mock') ? '⚙ MOCK' : '✨ 生成', tone: r.gen?.model?.includes('mock') ? 'warn' : 'ok' };
  return { text: r.status === 'needs-art' ? '待配' : '占位', tone: 'dim' };
};
// 缩略图 URL：生成的 2D 走 servedPath；其它退化为图标。
function thumbUrl(r: LedgerRow): string | null {
  if (r.kind !== 'model3d' && r.gen?.servedPath) return r.gen.servedPath;
  return null;
}
// 占位色块图（未生成时的默认「这长啥样」缩略图）：从 placeholder.current 里的「形状·#色」画个 SVG 色块 →
// 一眼认出「粉圆=基础敌」「品红多边=炮塔」，配卡面 query 就不再是「一屏全 art-NN 分不清」。解析不出→null 退回图标。
function swatchDataUri(r: LedgerRow): string | null {
  const m = /([a-z]+)·(#[0-9a-fA-F]{6})/.exec(r.placeholder?.current ?? '');
  if (!m) return null;
  const [, shape, color] = m;
  const inner = shape === 'circle' ? `<circle cx='23' cy='23' r='19' fill='${color}'/>`
    : shape === 'box' ? `<rect x='5' y='5' width='36' height='36' rx='3' fill='${color}'/>`
      : `<polygon points='23,3 40,13 40,33 23,43 6,33 6,13' fill='${color}'/>`; // polygon（含 hex/diamond）→ 六边形
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='46' viewBox='0 0 46 46'>${inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function ArtLedgerPanel({ slug, title, kind, onBack, onChanged }: { slug: string; title?: string; kind?: 'builtin' | 'library'; onBack: () => void; onChanged?: () => void }) {
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
  const [mockRun, setMockRun] = useState(false); // 显式才 mock（R1 ②）；不勾=真调尝试·无 key 服务端自动探针+mock
  const [mode, setMode] = useState<'library' | 'game'>('library'); // 双数据源：library 卡带 / 编译期游戏（requirements）
  const [stylePrompt, setStylePrompt] = useState(''); // 每游戏整体风格锚（台账头 artStyle·owner review ②）
  const [styleDirty, setStyleDirty] = useState(false);
  const [genProvider, setGenProvider] = useState(''); // ''=风格包默认；否则点名覆盖 qwen/tripo/meshy（owner review ④）
  const triedDerive = useRef(false); // library 卡带缺台账 → 自动 derive 一次（防循环）

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/art/ledger?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then(async (j) => {
        if (!j?.success && kind !== 'builtin' && !triedDerive.current) {
          // library 卡带没台账 → 自动初始化（derive）一次再读——「每个游戏都应该有目录」
          triedDerive.current = true;
          const d = await fetch(`${API}/api/art/derive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) }).then((r) => r.json()).catch(() => null);
          if (d?.success) {
            const j2 = await fetch(`${API}/api/art/ledger?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
            if (j2?.success) { setRows(j2.rows ?? []); setMode(j2.mode === 'requirements' ? 'game' : 'library'); if (!styleDirty) setStylePrompt(j2.artStyle?.stylePrompt ?? ''); return; }
          }
        }
        setRows(j?.success ? (j.rows ?? []) : []);
        setMode(j?.mode === 'requirements' ? 'game' : 'library');
        if (j?.success && !styleDirty) setStylePrompt(j.artStyle?.stylePrompt ?? '');
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [slug, kind, styleDirty]);
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

  const doRegen = () => sel && act('/api/art/regenerate', { slug, no: sel.no, packId: regenPack, query: regenPrompt.trim() || undefined, mock: mockRun, ...(genProvider ? { provider: genProvider } : {}) }, `✓ 重生成 ${sel.no}`);
  const doSaveStyle = () => act('/api/art/style', { slug, stylePrompt: stylePrompt.trim() }, '✓ 风格锚已存').then(() => setStyleDirty(false));
  const doSwap = () => sel && swapId.trim() && act('/api/art/swap', { slug, no: sel.no, assetId: swapId.trim() }, `✓ 换库 ${sel.no}`);
  const doReskin = () => act('/api/art/reskin', { slug, packId: reskinPack, mock: mockRun }, `✓ 换皮 ${reskinPack}`);
  // 一键全量：整表批量生成（断点续跑·缓存命中不重扣费）；library 线随后重钉 manifest（replace）。
  const doBatchAll = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const b = await fetch(`${API}/api/art/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, packId: reskinPack, mock: mockRun, ...(genProvider ? { provider: genProvider } : {}) }) }).then((r) => r.json() as Promise<{ success?: boolean; error?: string; summary?: { generated?: number; cached?: number; mock?: number } }>);
      if (!b.success) { flash(false, `✕ ${b.error ?? '批量失败'}`); return; }
      if (mode === 'library') {
        const rep = await fetch(`${API}/api/art/replace`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) }).then((r) => r.json() as Promise<{ success?: boolean; error?: string }>);
        if (!rep.success) { flash(false, `✕ 重钉引用失败: ${rep.error ?? ''}`); return; }
      }
      flash(true, `✓ 全量：生成 ${b.summary?.generated ?? 0} · 缓存 ${b.summary?.cached ?? 0}${(b.summary?.mock ?? 0) > 0 ? ` · MOCK ${b.summary?.mock}` : ''}`);
      load(); onChanged?.();
    } catch (e) { flash(false, `✕ ${String(e)}`); }
    finally { setBusy(false); }
  }, [busy, slug, reskinPack, mockRun, mode, load, onChanged]);
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
        <label style={{ fontSize: 12, color: SHELL.dim, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} title="勾选=mock 试跑（不扣费占位图）；不勾=真调美术 API（无 key 时服务端探针+mock 兜底·绝不静默顶替）">
          <input type="checkbox" checked={mockRun} onChange={(e) => setMockRun(e.target.checked)} /> mock 试跑
        </label>
        <span style={{ fontSize: 12, color: SHELL.dim }}>风格包：</span>
        <select value={reskinPack} onChange={(e) => setReskinPack(e.target.value)} style={{ ...sInput(), padding: '6px 8px' }}>
          {packs.map((p) => <option key={p.packId} value={p.packId}>{p.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: SHELL.dim }}>模型：</span>
        <select value={genProvider} onChange={(e) => setGenProvider(e.target.value)} style={{ ...sInput(), padding: '6px 8px' }} title="默认=风格包钉死的供应商（同款成套的保证）；点名覆盖只在需要时用">
          <option value="">默认（随风格包）</option>
          <option value="qwen">🖼 千问万相 2D</option>
          <option value="tripo">🧊 Tripo 3D</option>
          <option value="meshy">🗿 Meshy 3D</option>
        </select>
        <button onClick={doBatchAll} disabled={busy} style={{ ...sBtn('primary'), opacity: busy ? 0.5 : 1 }} title="整表批量生成（断点续跑·缓存命中不重扣费）">⚡ 一键全量</button>
        {mode === 'library' && <button onClick={doReskin} disabled={busy} style={{ ...sBtn('primary'), opacity: busy ? 0.5 : 1 }} title="同玩法换风格包 → 存新卡带">🎭 一键换皮</button>}
        <button onClick={load} style={sBtn('quiet')}>↻</button>
        <button onClick={onBack} style={sBtn('ghost')}>← 返回</button>
      </div>

      {/* 整体风格锚（owner review ②）：本游戏专属风格提示词·自动拼进每行生成 prompt（风格包之后） */}
      <div style={{ padding: '8px 20px', borderBottom: `1px solid ${SHELL.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: SHELL.dim, flex: 'none' }}>🎯 本游戏整体风格：</span>
        <input
          value={stylePrompt}
          onChange={(e) => { setStylePrompt(e.target.value); setStyleDirty(true); }}
          placeholder="如：暗黑哥特风，血红与铁灰主色，粗粝质感（留空=只用风格包）"
          style={{ ...sInput(), flex: 1, fontSize: 12 }}
        />
        <button onClick={doSaveStyle} disabled={busy || !styleDirty} style={{ ...sBtn('ghost'), opacity: busy || !styleDirty ? 0.5 : 1 }}>存风格锚</button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 缩略图墙 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignContent: 'flex-start', minWidth: 0 }}>
          {loading ? <div style={{ color: SHELL.dim }}>加载台账…</div>
            : rows.length === 0 ? <div style={{ color: SHELL.dim, fontSize: 13 }}>{kind === 'builtin' ? '编译期游戏未初始化美术库——照 game-q 样板跑一次 requirements 推导脚本（见交接档 game-q 节）' : '无台账（自动初始化失败——确认 library 卡带 manifest 可读后点 ↻）'}</div>
              : rows.map((r) => {
                const b = SOURCE_BADGE(r); const thumb = thumbUrl(r); const swatch = swatchDataUri(r); const active = selNo === r.no;
                return (
                  <div key={r.no} onClick={() => { setSelNo(r.no); setRegenPrompt(r.prompt || r.query || ''); setSwapId(''); }} style={{ width: 132, padding: 8, borderRadius: 9, cursor: 'pointer', background: active ? SHELL.jadeWash : 'rgba(255,255,255,0.02)', border: `1px solid ${active ? SHELL.jadeLine : SHELL.line}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: SHELL.fontMono, fontSize: 11, color: SHELL.jade, fontWeight: 700 }}>{r.no}</span>
                      <span style={{ ...sBadge(b.tone), fontSize: 9, marginLeft: 'auto' }}>{b.text}</span>
                    </div>
                    <div style={{ ...sChecker, width: '100%', height: 96, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `1px solid ${SHELL.line}` }}>
                      {thumb ? <img src={thumb} alt={r.no} style={{ maxWidth: '92%', maxHeight: '92%', imageRendering: 'pixelated' }} />
                        : swatch ? <img src={swatch} alt={r.query} title="占位（当前程序化色块·未生成美术）" style={{ maxWidth: '58%', maxHeight: '58%' }} />
                          : <span style={{ fontSize: 30, opacity: 0.55 }}>{r.kind === 'model3d' ? '🧊' : '🎨'}</span>}
                    </div>
                    <div title={r.query} style={{ fontSize: 11, color: SHELL.sub, fontWeight: 600, lineHeight: 1.25, maxHeight: 28, overflow: 'hidden' }}>{r.query || r.slot.entity}</div>
                    <div style={{ fontSize: 9, color: SHELL.dim, wordBreak: 'break-all', lineHeight: 1.2, maxHeight: 22, overflow: 'hidden' }}>{r.slot.entity} · {r.kind}{r.placeholder?.count && r.placeholder.count > 1 ? ` ×${r.placeholder.count}` : ''}</div>
                  </div>
                );
              })}
        </div>

        {/* 详情 + 三式替换 + 并排预览 */}
        <div style={{ width: 320, flex: 'none', borderLeft: `1px solid ${SHELL.line}`, background: SHELL.bg1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!sel ? <div style={{ color: SHELL.dim, fontSize: 12, marginTop: 20, textAlign: 'center' }}>点击左侧编号 art-N 查看 + 替换</div> : (
            <>
              <div style={{ fontFamily: SHELL.fontMono, fontSize: 13, color: SHELL.jade }}>{sel.no} · {sel.kind}{sel.status === 'retired' ? ' · 🪦 已退役（槽位消失·编号保留）' : ''}</div>
              <div style={{ fontSize: 11, color: SHELL.sub, lineHeight: 1.5 }}>{sel.context || sel.query}</div>
              {sel.skinKey && <div style={{ fontSize: 10, color: SHELL.dim, fontFamily: SHELL.fontMono }}>皮肤 key: {sel.skinKey}（生成/上传即按此 id 登记·游戏自动换装）</div>}
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
                    {box('占位/原始', swatchDataUri(sel), sel.placeholder?.current || sel.placeholder?.ref || '—')}
                    {box('现用', cur, cur ? '' : (sel.gen?.localId || '待生成'))}
                  </div>
                );
              })()}
              {sel.prompt && <div style={{ fontSize: 10, color: SHELL.sub, wordBreak: 'break-all', lineHeight: 1.45 }}>📝 提示词: {sel.prompt}</div>}
              {sel.provenance?.prompt && <div style={{ fontSize: 10, color: SHELL.dim, wordBreak: 'break-all' }}>已生成 prompt: {sel.provenance.prompt}</div>}
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
              {/* 📚 从共享库选换（library 卡带线·编译期游戏无 manifest 可钉） */}
              {mode === 'library' && <div>
                <div style={sLabel}>📚 从共享库选换（资产 id）</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input value={swapId} onChange={(e) => setSwapId(e.target.value)} placeholder="如 dungeon/monsters/orc" style={{ ...sInput(), flex: 1 }} />
                  <button onClick={doSwap} disabled={busy || !swapId.trim()} style={{ ...sBtn('ghost'), opacity: busy || !swapId.trim() ? 0.5 : 1 }}>换</button>
                </div>
              </div>}
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

// ═══ 游戏选择器（owner 07-09 review ③）：美术平台入口=先选游戏目录——内置（src/games）+ library 卡带全列，
// 每个游戏一个美术资料库。点击进入该游戏的台账面板（library 缺台账会自动 derive 初始化）。 ═══
export function ArtGamePicker({ onPick, onBack }: {
  onPick: (g: { slug: string; title: string; kind: 'builtin' | 'library' }) => void;
  onBack: () => void;
}) {
  const [builtin, setBuiltin] = useState<Array<{ id: string; hasLocalArt?: boolean }>>([]);
  const [carts, setCarts] = useState<Array<{ slug: string; meta?: { name?: string } }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/games`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/library`).then((r) => r.json()).catch(() => null),
    ]).then(([g, l]) => {
      setBuiltin(Array.isArray(g?.games) ? g.games : []);
      const arr = Array.isArray(l?.games) ? l.games : Array.isArray(l) ? l : [];
      setCarts(arr);
    }).finally(() => setLoading(false));
  }, []);
  const card = (key: string, title: string, sub: string, badge: string, onClick: () => void) => (
    <div key={key} onClick={onClick} style={{ width: 200, padding: 14, borderRadius: 10, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: `1px solid ${SHELL.line}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: SHELL.text }}>🎨 {title}</div>
      <div style={{ fontSize: 11, color: SHELL.dim }}>{sub}</div>
      <span style={{ ...sBadge('ok'), alignSelf: 'flex-start', fontSize: 9 }}>{badge}</span>
    </div>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: SHELL.appBg, color: SHELL.text, fontFamily: SHELL.fontUi, zIndex: 400, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${SHELL.line}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: SHELL.violet }}>🎨 美术平台 · 选择游戏</span>
        <span style={{ fontSize: 12, color: SHELL.dim }}>每个游戏一个美术资料库（需求台账+生成产物+本地索引）</span>
        <button onClick={onBack} style={{ ...sBtn('ghost'), marginLeft: 'auto' }}>← 返回</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {loading ? <div style={{ color: SHELL.dim }}>加载游戏列表…</div> : (
          <>
            <div style={{ ...sLabel, marginBottom: 8 }}>内置游戏（src/games）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              {builtin.map((g) => card(g.id, g.id, g.hasLocalArt ? '已有本地美术目录' : '尚无本地美术目录', '编译期', () => onPick({ slug: g.id, title: g.id, kind: 'builtin' })))}
              {builtin.length === 0 && <div style={{ color: SHELL.dim, fontSize: 12 }}>（无）</div>}
            </div>
            <div style={{ ...sLabel, marginBottom: 8 }}>游戏库卡带（library·创作台产出）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {carts.map((c) => card(c.slug, c.meta?.name || c.slug, c.slug, '卡带', () => onPick({ slug: c.slug, title: c.meta?.name || c.slug, kind: 'library' })))}
              {carts.length === 0 && <div style={{ color: SHELL.dim, fontSize: 12 }}>（空库·先在创作台生成一款）</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
