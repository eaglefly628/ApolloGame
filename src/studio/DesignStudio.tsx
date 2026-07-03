import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SHELL } from '../ui/shell-theme.js';
import { LOCAL_PROVIDER_IDS, type ProviderInfo } from './library-model.js';
import { ManifestPreview } from './DataCartridgeRunner.js';

// ═══════════════════════════════════════════════════════════════
//  创作台 · 设计先行创作流（讨论 → 分解 → 对齐 → 定稿 → 原型）
//   主创作流升级：输入是策划案 / 从讨论窗构想 → AI 分解成 design 目录 → 反复对齐细节 → 定稿生成原型。
//   一句话生成降级为「⚡ 快速模式」（CreationWizard）。
//   · EntryChoice     —— 新建入口双选卡：🗣 设计一个游戏（推荐）/ ⚡ 快速生成
//   · ContinueChoice  —— 已有 design 的卡带「✎ 继续创作」：改设计 / 快改数值(M2 revise)
//   · DesignStudio    —— 设计模式主件：聊天窗 → 目录浏览（左树右文·逐篇「改这里」）→ 定稿生成原型 → 预览保存
//   端点：POST /api/generate {mode: design-chat|design-breakdown|design-revise|prototype}；
//        GET/PUT /api/library/<slug>/design[/<path>]；保存原型走既有 PUT manifest。
//   本组件是**创作台产品壳**（非游戏 UI），沿用既有 React 壳层风格（SHELL 令牌），不走 LayoutNode。
// ═══════════════════════════════════════════════════════════════

const PANEL_BG = SHELL.bg1;

// 关键帧（幂等·全局单例）。prefers-reduced-motion 下瞬现。
function ensureDesignKeyframes(): void {
  if (typeof document === 'undefined') return;
  const id = 'apollo-design-kf';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    @keyframes apollo-design-fadein { from { opacity: 0; } to { opacity: 1; } }
    @keyframes apollo-design-spin { to { transform: rotate(360deg); } }
    .apollo-design-studio { animation: apollo-design-fadein 0.2s ease; }
    @media (prefers-reduced-motion: reduce) { .apollo-design-studio { animation: none; } }
  `;
  document.head.appendChild(s);
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

/** 设计模式默认 provider：优先 mock（测试）→ 云 provider → 任一 available（local 兜底）。 */
function pickProvider(providers: ProviderInfo[]): ProviderInfo | null {
  return (
    providers.find((p) => p.id === 'mock' && p.available)
    ?? providers.find((p) => p.available && !LOCAL_PROVIDER_IDS.has(p.id))
    ?? providers.find((p) => p.available)
    ?? null
  );
}

// ── 新建入口双选卡（🗣 设计一个游戏 推荐 / ⚡ 快速生成）──
export function EntryChoice({ onDesign, onQuick, onClose }: {
  onDesign: () => void;
  onQuick: () => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} className="apollo-design-studio" style={{
        width: 'min(680px, 94vw)', background: PANEL_BG, border: `1px solid ${SHELL.lineStrong}`,
        borderRadius: 14, padding: '26px 26px 30px', fontFamily: SHELL.fontUi, color: SHELL.text,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.6 }}>＋ 新建游戏</span>
          <button onClick={onClose} aria-label="关闭" style={closeBtn}>×</button>
        </div>
        <div style={{ fontSize: 13, color: SHELL.sub, marginBottom: 20 }}>选一种创作方式</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <ChoiceCard
            emoji="🗣" title="设计一个游戏" badge="推荐"
            desc="和 AI 聊清楚玩法 → 分解成设计稿 → 逐条对齐 → 定稿生成原型。做得深、改得准。"
            onClick={onDesign} accent={SHELL.jade}
          />
          <ChoiceCard
            emoji="⚡" title="快速生成"
            desc="说一句创意，直接压出一盘可玩卡带。想先看到东西、之后再慢慢改就选它。"
            onClick={onQuick} accent={SHELL.violet}
          />
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({ emoji, title, desc, onClick, accent, badge }: {
  emoji: string; title: string; desc: string; onClick: () => void; accent: string; badge?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        flex: '1 1 260px', minWidth: 240, textAlign: 'left', cursor: 'pointer',
        padding: '20px 18px', borderRadius: 12, fontFamily: SHELL.fontUi,
        background: hover ? `${accent}14` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hover ? accent : SHELL.line}`,
        transition: 'background 0.18s, border-color 0.18s', outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 30, lineHeight: 1 }}>{emoji}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color: SHELL.text }}>{title}</span>
        {badge && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', background: accent, padding: '2px 8px', borderRadius: 999 }}>{badge}</span>
        )}
      </div>
      <div style={{ fontSize: 13, color: SHELL.sub, lineHeight: 1.7 }}>{desc}</div>
    </button>
  );
}

// ── 已有 design 的卡带「✎ 继续创作」双选：改设计 / 快改数值 ──
export function ContinueChoice({ name, onEditDesign, onQuickRevise, onClose }: {
  name: string;
  onEditDesign: () => void;
  onQuickRevise: () => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} className="apollo-design-studio" style={{
        width: 'min(620px, 94vw)', background: PANEL_BG, border: `1px solid ${SHELL.lineStrong}`,
        borderRadius: 14, padding: '26px 26px 30px', fontFamily: SHELL.fontUi, color: SHELL.text,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>✎ 继续创作 · {name}</span>
          <button onClick={onClose} aria-label="关闭" style={closeBtn}>×</button>
        </div>
        <div style={{ fontSize: 13, color: SHELL.sub, marginBottom: 20 }}>这盘卡带有设计稿。你想怎么改？</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <ChoiceCard emoji="📐" title="改设计" desc="打开设计稿目录，对齐玩法/数值/内容规模，改完再重新生成原型。" onClick={onEditDesign} accent={SHELL.jade} />
          <ChoiceCard emoji="🎚" title="快改数值" desc="不动设计，直接对当前卡带下一句修改指令（M2 对话式迭代）。" onClick={onQuickRevise} accent={SHELL.violet} />
        </div>
      </div>
    </div>
  );
}

type Phase = 'chat' | 'design' | 'preview';

export function DesignStudio({
  api, providers, catalog, resolveArt, initialSlug, initialName, onClose, onSaved, onDirty,
}: {
  api: string;
  providers: ProviderInfo[];
  catalog: string;
  resolveArt?: (raw: unknown) => unknown;
  /** 继续创作已有 design → 直接进目录浏览（跳过讨论）。 */
  initialSlug?: string;
  initialName?: string;
  onClose: () => void;
  /** 原型保存入库成功 → 刷架 + 选中该 slug。 */
  onSaved: (slug: string) => void;
  /** 分解已建库 / 落盘改动 → 通知上层刷架（卡带此刻已存在）。 */
  onDirty?: () => void;
}) {
  useEffect(ensureDesignKeyframes, []);

  const provider = useMemo(() => pickProvider(providers), [providers]);

  const [name, setName] = useState(initialName ?? '');
  const [slug, setSlug] = useState<string | null>(initialSlug ?? null);
  const [phase, setPhase] = useState<Phase>(initialSlug ? 'design' : 'chat');

  // 讨论
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  // 目录 / 对齐
  const [files, setFiles] = useState<Record<string, string> | null>(initialSlug ? null : {});
  const [selected, setSelected] = useState<string | null>(null);
  const [reviseInput, setReviseInput] = useState('');
  const [revising, setRevising] = useState(false);

  // 分解 / 原型 / 保存
  const [busy, setBusy] = useState(false);
  const [previewManifest, setPreviewManifest] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ block: 'end' }); }, [messages, chatBusy]);

  const loadDesign = useCallback(async (s: string) => {
    try {
      const r = await fetch(`${api}/api/library/${s}/design`);
      const d = await r.json();
      const f = (d?.files ?? {}) as Record<string, string>;
      setFiles(f);
      setSelected((prev) => (prev && f[prev] ? prev : Object.keys(f)[0] ?? null));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setFiles({});
    }
  }, [api]);

  useEffect(() => { if (initialSlug) loadDesign(initialSlug); }, [initialSlug, loadDesign]);

  const post = useCallback((body: unknown) => fetch(`${api}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then((r) => r.json()), [api]);

  const sendChat = useCallback(async () => {
    const text = input.trim();
    if (!text || chatBusy || !provider) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setChatBusy(true);
    setErr(null);
    try {
      const d = await post({ mode: 'design-chat', messages: next, provider: provider.id });
      if (d?.success) {
        setMessages((m) => [...m, { role: 'assistant', content: d.reply ?? '' }]);
        setReady((prev) => prev || !!d.ready);
      } else {
        setErr(d?.error ?? '讨论失败');
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setChatBusy(false);
  }, [input, chatBusy, provider, messages, post]);

  const breakdown = useCallback(async () => {
    if (!name.trim() || !ready || busy || !provider) return;
    setBusy(true);
    setErr(null);
    try {
      let s = slug;
      if (!s) {
        const cr = await fetch(`${api}/api/library/create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), provider: provider.id }),
        });
        const cd = await cr.json();
        if (!cd?.success || !cd?.slug) throw new Error(cd?.error ?? '建库失败');
        s = cd.slug;
        setSlug(s);
      }
      const d = await post({ mode: 'design-breakdown', slug: s, messages, catalog, provider: provider.id });
      if (!d?.success) throw new Error(d?.error ?? '分解失败');
      const f = (d.files ?? {}) as Record<string, string>;
      setFiles(f);
      setSelected(Object.keys(f)[0] ?? null);
      setPhase('design');
      onDirty?.();   // 游戏此刻已建 + 落了设计稿 → 让上层刷架
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }, [name, ready, busy, provider, slug, api, messages, catalog, post, onDirty]);

  const reviseFile = useCallback(async () => {
    if (!selected || !reviseInput.trim() || revising || !provider || !slug || !files) return;
    setRevising(true);
    setErr(null);
    try {
      const d = await post({
        mode: 'design-revise', file_path: selected,
        current_content: files[selected] ?? '', instruction: reviseInput.trim(), provider: provider.id,
      });
      if (!d?.success || typeof d.content !== 'string') throw new Error(d?.error ?? '修订失败');
      const content = d.content as string;
      const pr = await fetch(`${api}/api/library/${slug}/design/${selected}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, note: reviseInput.trim().slice(0, 50) || `design: ${selected}` }),
      });
      const pd = await pr.json();
      if (!pd?.success) throw new Error(pd?.error ?? '落盘失败');
      setFiles((prev) => ({ ...(prev ?? {}), [selected]: content }));
      setReviseInput('');
      onDirty?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setRevising(false);
  }, [selected, reviseInput, revising, provider, slug, files, api, post, onDirty]);

  const prototype = useCallback(async () => {
    if (!slug || busy || !provider) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await post({ mode: 'prototype', slug, catalog, provider: provider.id });
      if (!d?.success) throw new Error(d?.error ?? '原型生成失败');
      setPreviewManifest(d.manifest ?? d.blueprint);
      setPhase('preview');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }, [slug, busy, provider, catalog, post]);

  const savePrototype = useCallback(async () => {
    if (!slug || previewManifest == null || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const pr = await fetch(`${api}/api/library/${slug}/manifest`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest: previewManifest, note: '原型生成 v1' }),
      });
      const pd = await pr.json();
      if (!pd?.success) throw new Error(pd?.error ?? '保存失败');
      onSaved(slug);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }, [slug, previewManifest, busy, api, onSaved]);

  const providerBar = (
    <div style={{ fontSize: 12, color: SHELL.sub }}>
      当前 AI：{provider
        ? <b style={{ color: SHELL.jade }}>{provider.name}</b>
        : <b style={{ color: SHELL.warn }}>未配置 API Key（去设置或用本地模型）</b>}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: SHELL.bg0, color: SHELL.text,
      display: 'flex', flexDirection: 'column', fontFamily: SHELL.fontUi, zIndex: 400,
    }} className="apollo-design-studio">
      {/* 头栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px',
        borderBottom: `1px solid ${SHELL.line}`,
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.6 }}>🗣 设计工作台</span>
        <StepDots phase={phase} />
        <span style={{ flex: 1 }} />
        {providerBar}
        <button onClick={onClose} aria-label="关闭" style={{ ...closeBtn, fontSize: 24 }}>×</button>
      </div>

      {err && (
        <div style={{ padding: '8px 22px', color: SHELL.danger, fontSize: 13, background: SHELL.dangerWash, borderBottom: `1px solid ${SHELL.danger}33` }}>
          {err}
        </div>
      )}

      {/* ── 讨论态 ── */}
      {phase === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '14px 22px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: SHELL.dim }}>游戏名</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="给你的游戏起个名字（分解前必填）"
              style={{ ...inputStyle, width: 320, maxWidth: '60vw' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            {messages.length === 0 && (
              <div style={{ color: SHELL.dim, fontSize: 14, lineHeight: 1.8, maxWidth: 640 }}>
                先聊清楚你的想法——AI 会引导你把<b style={{ color: SHELL.sub }}> 类型与参照物 / 核心循环 / 胜负与进程 / 内容规模 </b>
                这四件事说明白，然后你就能一键把它分解成设计稿。<br />
                <span style={{ color: SHELL.faint }}>例：「我想做个两人投骰子比大小的小游戏」</span>
              </div>
            )}
            {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.content} />)}
            {chatBusy && <Bubble role="assistant" text="…" busy />}
            {ready && (
              <div style={{
                alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 8,
                background: SHELL.jadeWash, border: `1px solid ${SHELL.jadeLine}`, color: SHELL.jade, fontSize: 12,
              }}>
                ✓ 想法够清楚了，可以分解成设计稿了
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '12px 22px 18px', borderTop: `1px solid ${SHELL.line}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendChat(); } }}
                placeholder="说说你的想法…（Ctrl/⌘+Enter 发送）"
                rows={2}
                disabled={!provider}
                style={{ ...inputStyle, flex: 1, resize: 'vertical', minHeight: 48 }}
              />
              <button onClick={sendChat} disabled={!input.trim() || chatBusy || !provider} style={{ ...secondaryBtn, alignSelf: 'stretch', opacity: (!input.trim() || chatBusy || !provider) ? 0.5 : 1 }}>
                发送
              </button>
            </div>
            <button
              onClick={breakdown}
              disabled={!ready || !name.trim() || busy || !provider}
              title={!name.trim() ? '先给游戏起个名字' : (!ready ? '再聊几句，把四件事说清楚' : undefined)}
              style={{ ...primaryBtn, opacity: (!ready || !name.trim() || busy) ? 0.5 : 1, cursor: (!ready || !name.trim() || busy) ? 'default' : 'pointer' }}
            >
              {busy ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Spinner /> 正在分解成设计稿…</span> : '分解成设计稿 →'}
            </button>
          </div>
        </div>
      )}

      {/* ── 目录浏览 / 对齐态 ── */}
      {phase === 'design' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px 22px', borderBottom: `1px solid ${SHELL.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, color: SHELL.sub }}>设计稿目录 · <b style={{ color: SHELL.text }}>{name || slug}</b></span>
            <span style={{ flex: 1 }} />
            <button onClick={prototype} disabled={busy || !files || Object.keys(files).length === 0} style={{ ...primaryBtn, padding: '9px 18px', opacity: (busy || !files || Object.keys(files ?? {}).length === 0) ? 0.5 : 1 }}>
              {busy ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Spinner /> 生成原型中…</span> : '设计定稿 → 生成原型'}
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* 左：文件树 */}
            <div style={{ width: 230, minWidth: 180, borderRight: `1px solid ${SHELL.line}`, overflowY: 'auto', padding: 10 }}>
              {files === null ? (
                <div style={{ color: SHELL.dim, fontSize: 13, padding: 12 }}>加载设计稿…</div>
              ) : Object.keys(files).length === 0 ? (
                <div style={{ color: SHELL.dim, fontSize: 13, padding: 12 }}>（暂无设计稿）</div>
              ) : (
                Object.keys(files).sort().map((f) => (
                  <button key={f} onClick={() => { setSelected(f); setReviseInput(''); }} style={{
                    display: 'block', width: '100%', textAlign: 'left', marginBottom: 4,
                    padding: '8px 10px', borderRadius: 7, fontFamily: SHELL.fontMono, fontSize: 12,
                    background: selected === f ? SHELL.jadeWash : 'transparent',
                    border: `1px solid ${selected === f ? SHELL.jadeLine : 'transparent'}`,
                    color: selected === f ? SHELL.jade : SHELL.sub, cursor: 'pointer', outline: 'none',
                  }}>
                    {f}
                  </button>
                ))
              )}
            </div>
            {/* 右：内容 + 「改这里」 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
                {selected && files ? (
                  <pre style={{
                    margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    fontFamily: SHELL.fontMono, fontSize: 13, lineHeight: 1.7, color: SHELL.text,
                  }}>{files[selected]}</pre>
                ) : (
                  <div style={{ color: SHELL.dim, fontSize: 13 }}>选一份设计稿查看</div>
                )}
              </div>
              {selected && (
                <div style={{ borderTop: `1px solid ${SHELL.line}`, padding: '12px 22px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <label style={{ fontSize: 12, color: SHELL.dim }}>改这里：（对 <b style={{ color: SHELL.sub }}>{selected}</b> 下一句修订指令）</label>
                    <textarea
                      value={reviseInput} onChange={(e) => setReviseInput(e.target.value)}
                      placeholder="例：把目标分数从 2 改成 3 / 加一句节奏描述 / 补一个音效系统"
                      rows={2}
                      disabled={!provider}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 44 }}
                    />
                  </div>
                  <button onClick={reviseFile} disabled={!reviseInput.trim() || revising || !provider} style={{ ...secondaryBtn, marginTop: 22, opacity: (!reviseInput.trim() || revising || !provider) ? 0.5 : 1 }}>
                    {revising ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Spinner /> 修订中</span> : '应用修订'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 原型预览态 ── */}
      {phase === 'preview' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '18px 22px', gap: 14, overflowY: 'auto' }}>
          <div style={{ fontSize: 14, color: SHELL.sub }}>原型预览 · <b style={{ color: SHELL.text }}>{name || slug}</b>（由设计稿生成）</div>
          <div style={{ background: SHELL.bg1, borderRadius: 10, border: `1px solid ${SHELL.line}`, padding: 8, alignSelf: 'center' }}>
            <ManifestPreview manifest={previewManifest} resolveArt={resolveArt} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={savePrototype} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
              {busy ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Spinner /> 保存入库…</span> : '保存入库'}
            </button>
            <button onClick={() => setPhase('design')} style={secondaryBtn}>← 回设计稿再改改</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepDots({ phase }: { phase: Phase }) {
  const steps: Array<{ k: Phase; label: string }> = [
    { k: 'chat', label: '讨论' }, { k: 'design', label: '设计稿' }, { k: 'preview', label: '原型' },
  ];
  const idx = steps.findIndex((s) => s.k === phase);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.k}>
          <span style={{ fontSize: 12, color: i <= idx ? SHELL.jade : SHELL.faint, fontWeight: i === idx ? 700 : 500 }}>{s.label}</span>
          {i < steps.length - 1 && <span style={{ color: SHELL.faint, fontSize: 11 }}>›</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function Bubble({ role, text, busy }: { role: 'user' | 'assistant'; text: string; busy?: boolean }) {
  const mine = role === 'user';
  return (
    <div style={{
      alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%',
      padding: '10px 14px', borderRadius: 12,
      background: mine ? SHELL.violetWash : 'rgba(255,255,255,0.04)',
      border: `1px solid ${mine ? SHELL.violetLine : SHELL.line}`,
      color: SHELL.text, fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>
      {busy ? <Spinner /> : text}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14, borderRadius: '50%',
      border: `2px solid ${SHELL.line}`, borderTopColor: SHELL.jade,
      display: 'inline-block', animation: 'apollo-design-spin 0.8s linear infinite',
    }} />
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(3,6,12,0.66)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 350, padding: 20,
};

const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: SHELL.dim, cursor: 'pointer', fontSize: 22, lineHeight: 1, outline: 'none',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', boxSizing: 'border-box',
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
  padding: '10px 16px', borderRadius: 9,
  background: 'rgba(255,255,255,0.05)', border: `1px solid ${SHELL.line}`,
  color: SHELL.sub, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', outline: 'none', fontFamily: SHELL.fontUi, whiteSpace: 'nowrap',
};
