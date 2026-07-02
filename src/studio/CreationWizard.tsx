import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SHELL } from '../ui/shell-theme.js';
import { LOCAL_PROVIDER_IDS, type ProviderInfo } from './library-model.js';
import { ManifestPreview } from './DataCartridgeRunner.js';

// ═══════════════════════════════════════════════════════════════
//  创作台 v1 · M2 创作向导（右滑面板）——「说一句创意 → 卡带」+「对话式迭代修改」
//   · 玩家模式「＋新建游戏」→ 向导 create 态：游戏名 + 一句话创意 + 当前 provider + 开始生成
//   · 「✎ 继续创作」→ 向导 revise 态：显示游戏名 + 当前版本 + 修改指令
//   生成走 POST /api/generate（autofix:true → 服务端 JSON parse + manifest-check 校验重试 ≤3 次）
//   得 manifest → 预览试玩（复用 ManifestPreview 运行核，喂 manifest 而非拉 slug）→ 保存入库/弃掉重来。
//   保存：create = POST create + PUT manifest{note:'初版生成'}；revise = PUT manifest{note:指令摘要}。
//   本组件是**创作台产品壳**（非游戏 UI），沿用 M0/M1 既有 React 壳层风格（SHELL 令牌），不走 LayoutNode。
// ═══════════════════════════════════════════════════════════════

const PANEL_W = 'min(600px, 94vw)';

// 右滑进场关键帧（幂等·全局单例）。prefers-reduced-motion 下瞬现（去掉位移动画）。
function ensureWizardKeyframes(): void {
  if (typeof document === 'undefined') return;
  const id = 'apollo-wizard-kf';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    @keyframes apollo-wizard-slidein {
      from { transform: translateX(30px); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes apollo-wizard-spin { to { transform: rotate(360deg); } }
    .apollo-wizard-panel { animation: apollo-wizard-slidein 0.24s cubic-bezier(0.22,0.61,0.36,1); }
    @media (prefers-reduced-motion: reduce) { .apollo-wizard-panel { animation: none; } }
  `;
  document.head.appendChild(s);
}

export type WizardMode = 'create' | 'revise';

interface GenResult {
  success: boolean;
  error?: string;
  blueprint?: unknown;
  manifest?: unknown;
  warnings?: string[];
  attempts?: number;
  fixed_errors?: string[];
}

type Phase =
  | { k: 'input' }
  | { k: 'generating' }
  | { k: 'preview'; manifest: unknown; attempts: number; fixedErrors: string[] }
  | { k: 'error'; message: string; rawErrors: string[] }
  | { k: 'saving' };

/** 向导默认 provider：优先 mock（测试）→ 云 provider → 任一 available（local 兜底）。 */
function pickProvider(providers: ProviderInfo[]): ProviderInfo | null {
  return (
    providers.find((p) => p.id === 'mock' && p.available)
    ?? providers.find((p) => p.available && !LOCAL_PROVIDER_IDS.has(p.id))
    ?? providers.find((p) => p.available)
    ?? null
  );
}

export function CreationWizard({
  api, mode, slug, initialName, providers, catalog, resolveArt, onClose, onSaved,
}: {
  api: string;
  mode: WizardMode;
  /** revise 态：目标游戏 slug（拉当前 manifest / 落盘目标）。 */
  slug?: string;
  /** 游戏名：create 态作输入初值，revise 态作只读展示。 */
  initialName?: string;
  providers: ProviderInfo[];
  /** buildCapabilityCatalog(ALL_CAPABILITIES)：随生成请求送出，注入系统词。 */
  catalog: string;
  resolveArt?: (raw: unknown) => unknown;
  onClose: () => void;
  /** 保存成功 → 通知上层刷新卡带架并选中该 slug。 */
  onSaved: (slug: string) => void;
}) {
  useEffect(ensureWizardKeyframes, []);

  const [name, setName] = useState(initialName ?? '');
  const [idea, setIdea] = useState('');          // create 态：一句话创意
  const [instruction, setInstruction] = useState(''); // revise 态：修改指令
  const [phase, setPhase] = useState<Phase>({ k: 'input' });
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // revise 态：拉当前 manifest（供 revise 请求）+ 版本数（展示「当前版本 N」）。
  const [currentManifest, setCurrentManifest] = useState<unknown>(null);
  const [versionCount, setVersionCount] = useState<number | null>(null);
  useEffect(() => {
    if (mode !== 'revise' || !slug) return;
    let dead = false;
    fetch(`${api}/api/library/${slug}/manifest`)
      .then((r) => r.json())
      .then((m) => { if (!dead) setCurrentManifest(m); })
      .catch(() => { if (!dead) setCurrentManifest(null); });
    fetch(`${api}/api/library/${slug}/history`)
      .then((r) => r.json())
      .then((h) => { if (!dead) setVersionCount(Array.isArray(h?.entries) ? h.entries.length : null); })
      .catch(() => {});
    return () => { dead = true; };
  }, [api, mode, slug]);

  const activeProvider = useMemo(() => pickProvider(providers), [providers]);

  const canGenerate = mode === 'revise'
    ? instruction.trim().length > 0 && currentManifest != null && !!activeProvider
    : name.trim().length > 0 && idea.trim().length > 0 && !!activeProvider;

  const generate = useCallback(async () => {
    if (!activeProvider) return;
    setPhase({ k: 'generating' });
    setSaveErr(null);
    const body = mode === 'revise'
      ? { mode: 'revise', current_manifest: currentManifest, instruction: instruction.trim(), provider: activeProvider.id, catalog, autofix: true }
      : { prompt: idea.trim(), provider: activeProvider.id, catalog, autofix: true };
    try {
      const res = await fetch(`${api}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data: GenResult = await res.json();
      if (data.success) {
        setPhase({
          k: 'preview',
          manifest: data.manifest ?? data.blueprint,
          attempts: data.attempts ?? 1,
          fixedErrors: data.fixed_errors ?? [],
        });
      } else {
        setPhase({ k: 'error', message: data.error ?? '生成失败', rawErrors: data.fixed_errors ?? [] });
      }
    } catch (e: unknown) {
      setPhase({ k: 'error', message: e instanceof Error ? e.message : String(e), rawErrors: [] });
    }
  }, [activeProvider, mode, currentManifest, instruction, idea, catalog, api]);

  const save = useCallback(async (manifest: unknown) => {
    setPhase({ k: 'saving' });
    setSaveErr(null);
    try {
      let targetSlug = slug;
      if (mode === 'create') {
        const cr = await fetch(`${api}/api/library/create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), provider: activeProvider?.id ?? 'user' }),
        });
        const cd = await cr.json();
        if (!cd?.success || !cd?.slug) throw new Error(cd?.error ?? '建库失败');
        targetSlug = cd.slug;
      }
      if (!targetSlug) throw new Error('缺少目标 slug');
      const note = mode === 'create' ? '初版生成' : (instruction.trim().slice(0, 50) || '修改');
      const pr = await fetch(`${api}/api/library/${targetSlug}/manifest`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest, note }),
      });
      const pd = await pr.json();
      if (!pd?.success) throw new Error(pd?.error ?? '落盘校验失败');
      onSaved(targetSlug);
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : String(e));
      // 回到预览态让用户可重试保存 / 弃掉。
      setPhase((p) => (p.k === 'saving' ? { k: 'preview', manifest, attempts: 1, fixedErrors: [] } : p));
    }
  }, [api, mode, slug, name, instruction, activeProvider, onSaved]);

  const title = mode === 'create' ? '＋ 新建游戏' : '✎ 继续创作';

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 300 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="apollo-wizard-panel"
        style={{
          width: PANEL_W, height: '100%', overflowY: 'auto',
          background: SHELL.bg1, borderLeft: `1px solid ${SHELL.lineStrong}`,
          boxShadow: '-16px 0 48px rgba(0,0,0,0.5)', padding: '22px 24px',
          fontFamily: SHELL.fontUi, color: SHELL.text,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {/* 头 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: 0.6 }}>{title}</span>
          <button onClick={onClose} aria-label="关闭" style={{ background: 'none', border: 'none', color: SHELL.dim, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* 当前 provider（纯展示） */}
        <div style={{ fontSize: 12, color: SHELL.sub }}>
          当前 AI：{activeProvider
            ? <b style={{ color: SHELL.jade }}>{activeProvider.name}</b>
            : <b style={{ color: SHELL.warn }}>未配置 API Key（去 .env 配置或用本地模型）</b>}
        </div>

        {/* ── 输入态 ── */}
        {(phase.k === 'input' || phase.k === 'generating' || phase.k === 'error') && (
          <>
            {mode === 'create' ? (
              <>
                <Field label="游戏名">
                  <input
                    value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="给你的游戏起个名字"
                    disabled={phase.k === 'generating'}
                    style={inputStyle}
                  />
                </Field>
                <Field label="一句话创意">
                  <textarea
                    value={idea} onChange={(e) => setIdea(e.target.value)}
                    placeholder="例：一个小球在方块间弹跳，有重力和弹跳"
                    disabled={phase.k === 'generating'}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 68 }}
                  />
                </Field>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14 }}>
                  <b>{initialName || slug}</b>
                  {versionCount != null && <span style={{ color: SHELL.dim, fontSize: 12, marginLeft: 8 }}>· 当前 {versionCount} 个版本</span>}
                </div>
                <Field label="修改指令">
                  <textarea
                    value={instruction} onChange={(e) => setInstruction(e.target.value)}
                    placeholder="例：金币掉落改两倍 / 把玩家改成红色 / 加一个会移动的平台"
                    disabled={phase.k === 'generating'}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 68 }}
                  />
                </Field>
                {mode === 'revise' && currentManifest == null && (
                  <div style={{ fontSize: 12, color: SHELL.dim }}>正在读取当前版本…</div>
                )}
              </>
            )}

            {phase.k === 'error' && (
              <div style={{ padding: '10px 12px', background: SHELL.dangerWash, border: `1px solid ${SHELL.danger}44`, borderRadius: 8 }}>
                <div style={{ color: SHELL.danger, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>没能造出来 😕</div>
                <div style={{ color: SHELL.sub, fontSize: 12, lineHeight: 1.6 }}>{phase.message}</div>
                <div style={{ color: SHELL.dim, fontSize: 12, marginTop: 6 }}>换个说法，或把创意描述得更具体些再试。</div>
                {phase.rawErrors.length > 0 && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ color: SHELL.dim, fontSize: 11, cursor: 'pointer' }}>查看原始校验错误（{phase.rawErrors.length}）</summary>
                    <pre style={{ color: SHELL.dim, fontSize: 11, lineHeight: 1.4, marginTop: 4, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                      {phase.rawErrors.join('\n\n')}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <button
              onClick={generate}
              disabled={!canGenerate || phase.k === 'generating'}
              style={{
                ...primaryBtn,
                opacity: (!canGenerate || phase.k === 'generating') ? 0.5 : 1,
                cursor: (!canGenerate || phase.k === 'generating') ? 'default' : 'pointer',
              }}
            >
              {phase.k === 'generating'
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Spinner /> AI 正在生成…（含自动校验修正）</span>
                : (phase.k === 'error' ? '换个说法再生成' : (mode === 'create' ? '开始生成' : '应用修改'))}
            </button>
          </>
        )}

        {/* ── 预览态 ── */}
        {phase.k === 'preview' && (
          <>
            <div style={{ fontSize: 13, color: SHELL.sub }}>
              预览试玩
              {phase.attempts > 1 && (
                <span style={{ color: SHELL.jade, marginLeft: 8, fontSize: 12 }}>
                  · 自动修正了 {phase.attempts - 1} 次后通过校验
                </span>
              )}
            </div>
            <div style={{ background: SHELL.bg0, borderRadius: 10, border: `1px solid ${SHELL.line}`, padding: 8 }}>
              <ManifestPreview manifest={phase.manifest} resolveArt={resolveArt} />
            </div>
            {saveErr && <div style={{ color: SHELL.danger, fontSize: 12 }}>保存失败：{saveErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => save(phase.manifest)} style={{ ...primaryBtn, flex: 1 }}>
                {mode === 'create' ? '保存入库' : '保存这一版'}
              </button>
              <button
                onClick={() => setPhase({ k: 'input' })}
                style={secondaryBtn}
              >
                {mode === 'create' ? '弃掉重来' : '再改改'}
              </button>
            </div>
          </>
        )}

        {/* ── 保存中 ── */}
        {phase.k === 'saving' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: SHELL.sub, fontSize: 13, padding: '20px 0' }}>
            <Spinner /> 正在保存入库…
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: SHELL.dim, letterSpacing: 0.5 }}>{label}</span>
      {children}
    </label>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: 14, height: 14, borderRadius: '50%',
        border: `2px solid ${SHELL.line}`, borderTopColor: SHELL.jade,
        display: 'inline-block', animation: 'apollo-wizard-spin 0.8s linear infinite',
      }}
    />
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
  background: SHELL.bg0, color: SHELL.text,
  border: `1px solid ${SHELL.line}`, borderRadius: 8,
  fontSize: 14, outline: 'none', fontFamily: SHELL.fontUi,
};

const primaryBtn: React.CSSProperties = {
  padding: '11px 20px', borderRadius: 9, border: 'none',
  background: `linear-gradient(135deg, ${SHELL.jade}, ${SHELL.jade}cc)`,
  color: '#0f172a', fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
  cursor: 'pointer', outline: 'none', fontFamily: SHELL.fontUi,
};

const secondaryBtn: React.CSSProperties = {
  padding: '11px 18px', borderRadius: 9,
  background: 'rgba(255,255,255,0.05)', border: `1px solid ${SHELL.line}`,
  color: SHELL.sub, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', outline: 'none', fontFamily: SHELL.fontUi,
};
