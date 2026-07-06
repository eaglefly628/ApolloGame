import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SHELL, sBtn, sInput, sLabel, sChip } from '../ui/shell-theme.js';

// ═══════════════════════════════════════════════════════════════
//  AI 生成面板 —— 资源库的「文本→资产」入口（与「导入」向导并排）。
//  一句 prompt + 选适配器（tripo 文本→3D · qwen 文本→2D）+ 落点 → 生成 → 落库 → 库刷新。
//  生成"大脑"在 PA 车道的 scripts/ai-gen.mjs；本组件只做交互，写盘走
//    POST apollo.py /api/assets/generate（它 shell 调脚本、落文件 + index.json）。
//  哲学同 src/services/aigp：外部非确定性 AI 走旁路，产物=带 provenance 的固定资产，不碰 sim/hash。
//  本环境 GitHub-only → 真调 API 被挡，缺 key 或默认走 mock（产合法占位·prompt 播种）。
// ═══════════════════════════════════════════════════════════════

const API = 'http://localhost:4000';

interface Provider {
  readonly id: string;
  readonly kind: string;
  readonly license: string;
  readonly envKey: string;
  readonly keyConfigured: boolean;
  readonly apiKeyMasked: string;
}
interface GenResult {
  readonly ok?: boolean;
  readonly success?: boolean;
  readonly error?: string;
  readonly id?: string;
  readonly type?: string;
  readonly servedPath?: string;
  readonly mock?: boolean;
  readonly scope?: string;
}

const ADAPTER_META: Record<string, { label: string; hint: string }> = {
  tripo: { label: '🧊 Tripo · 文本→3D', hint: '生成 .glb 网格（可 vendor 进游戏 models/）' },
  qwen: { label: '🖼 千问万相 · 文本→2D', hint: '生成 .png 贴图/图标（DashScope 万相）' },
};

// served 资源的可预览 URL：游戏落点已是站点绝对路径；共享货架是 assets/ 相对路径 → 补 /assets/ 前缀。
function previewUrl(servedPath: string): string {
  return servedPath.startsWith('/') ? servedPath : `/assets/${servedPath}`;
}

export function AssetGenPanel({ onClose, onCommitted }: { onClose: () => void; onCommitted: () => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [adapter, setAdapter] = useState<'tripo' | 'qwen'>('qwen');
  const [prompt, setPrompt] = useState('');
  const [game, setGame] = useState(''); // 空=共享货架 assets/ai/；填=游戏本地 public/games/<g>/art/ai/
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);

  useEffect(() => {
    fetch(`${API}/api/assets/generate/providers`)
      .then((r) => r.json())
      .then((j) => setProviders((j?.providers ?? []) as Provider[]))
      .catch(() => setProviders([]));
  }, []);

  const active = useMemo(() => providers.find((p) => p.id === adapter), [providers, adapter]);

  const generate = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/assets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapter, prompt: prompt.trim(), game: game.trim() || undefined }),
      }).then((r) => r.json() as Promise<GenResult>);
      setResult(res);
      if (res.success && res.id) onCommitted(); // 库重载 index → 新资产立现
    } catch (e) {
      setResult({ success: false, error: String(e) });
    } finally {
      setBusy(false);
    }
  }, [adapter, prompt, game, busy, onCommitted]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: SHELL.appBg, color: SHELL.text, display: 'flex', flexDirection: 'column', fontFamily: SHELL.fontUi }}>
      {/* ── 头 ── */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${SHELL.line}`, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: SHELL.violet }}>✨ AI 生成资产</span>
        <span style={{ fontSize: 12, color: SHELL.dim }}>文本 → 资产，落进资源库（带 provenance·可审计）</span>
        <button onClick={onClose} style={{ ...sBtn('quiet'), marginLeft: 'auto' }}>✕ 关闭</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', maxWidth: 720 }}>
        {/* ① 适配器 */}
        <div style={sLabel}>① 选生成方式</div>
        <div style={{ display: 'flex', gap: 10, margin: '8px 0 18px', flexWrap: 'wrap' }}>
          {(['qwen', 'tripo'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAdapter(a)}
              style={{
                ...sBtn(adapter === a ? 'primary' : 'ghost'),
                padding: '10px 16px', textAlign: 'left', lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600 }}>{ADAPTER_META[a].label}</div>
              <div style={{ fontSize: 11, color: SHELL.dim }}>{ADAPTER_META[a].hint}</div>
            </button>
          ))}
        </div>

        {/* key 状态（开放设置：env key 是否已配·打码不回明文） */}
        {active && (
          <div style={{ margin: '0 0 18px', fontSize: 12, color: SHELL.sub, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ ...sChip(active.keyConfigured), background: active.keyConfigured ? SHELL.okWash : SHELL.warnWash, color: active.keyConfigured ? SHELL.ok : SHELL.warn, border: `1px solid ${active.keyConfigured ? SHELL.jadeLine : SHELL.warnWash}` }}>
              {active.keyConfigured ? `● key 已配 ${active.apiKeyMasked}` : '○ 未配 key → 走 mock'}
            </span>
            <span style={{ color: SHELL.dim }}>
              设置 <code style={{ color: SHELL.violet }}>{active.envKey}</code> 环境变量启用真调（本环境 GitHub-only·默认 mock）· {active.license}
            </span>
          </div>
        )}

        {/* ② prompt */}
        <div style={sLabel}>② 描述你要的资产</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={adapter === 'tripo' ? '例：a wooden treasure chest with iron bands' : '例：pixel fire sword icon, transparent background'}
          rows={3}
          style={{ ...sInput(), width: '100%', margin: '8px 0 18px', resize: 'vertical', fontFamily: SHELL.fontMono }}
        />

        {/* ③ 落点 */}
        <div style={sLabel}>③ 落点（空=共享货架 assets/ai/；填游戏名=该游戏本地 art/ai/）</div>
        <input
          value={game}
          onChange={(e) => setGame(e.target.value.toLowerCase())}
          placeholder="共享货架（留空）· 或填 game-z / game-d …"
          style={{ ...sInput(), width: 280, margin: '8px 0 22px' }}
        />

        <div>
          <button onClick={generate} disabled={!prompt.trim() || busy} style={{ ...sBtn('primary'), padding: '9px 22px', opacity: !prompt.trim() || busy ? 0.5 : 1, cursor: !prompt.trim() || busy ? 'default' : 'pointer' }}>
            {busy ? '⏳ 生成中…' : '✨ 生成并落库'}
          </button>
        </div>

        {/* ④ 结果 */}
        {result && (
          <div style={{ marginTop: 22, padding: 16, background: SHELL.bg1, border: `1px solid ${SHELL.line}`, borderRadius: 10 }}>
            {result.success && result.id ? (
              <>
                <div style={{ fontSize: 14, color: SHELL.ok, marginBottom: 8 }}>
                  ✓ 已生成并登记 {result.mock ? '（mock 占位）' : ''}
                </div>
                <div style={{ fontSize: 12, color: SHELL.sub, fontFamily: SHELL.fontMono, marginBottom: 4 }}>id: {result.id}</div>
                <div style={{ fontSize: 12, color: SHELL.dim, marginBottom: 12 }}>{result.type} · {result.scope}</div>
                {result.type === 'texture' && result.servedPath && (
                  <img
                    src={previewUrl(result.servedPath)}
                    alt={result.id}
                    style={{ width: 128, height: 128, imageRendering: 'pixelated', border: `1px solid ${SHELL.line}`, borderRadius: 6, background: '#000' }}
                  />
                )}
                {result.type === 'mesh' && (
                  <div style={{ fontSize: 12, color: SHELL.sub }}>🧊 已生成 .glb 网格（在资源库网格类下可见·可 vendor 进游戏）</div>
                )}
                <div style={{ marginTop: 14 }}>
                  <button onClick={() => { setResult(null); setPrompt(''); }} style={sBtn('ghost')}>再生成一个</button>
                  <button onClick={onClose} style={{ ...sBtn('primary'), marginLeft: 8 }}>回到资源库看它</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: SHELL.danger }}>✕ {result.error ?? '生成失败'}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
