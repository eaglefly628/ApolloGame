// 外部平台入口（三平台合并 P0·docs/design/platform-merge-2026-10-30.md）：创作平台只「拉起 + 开新窗」，
// 动画平台 / 3D 资产平台保持独立进程、独立界面——本组件不嵌、不代理、不读它们的数据。
// 平台清单与运行态全由 /api/platforms 给（读 .zerocraft/platforms.json），本组件零新真相。
// 新窗必须在点击同步栈里先开（否则被拦截弹窗），拿到地址后再导航；失败关掉空窗并显示原因。
import React, { useCallback, useEffect, useState } from 'react';
import { SHELL } from '../ui/shell-theme.js';

const API = 'http://localhost:4000';

export interface PlatformInfo { id: string; label: string; configured: boolean; mode: 'command' | 'url' | null; running: boolean; url: string | null }
interface ListResp { success?: boolean; platforms?: PlatformInfo[]; configFile?: string }
interface LaunchResp { success?: boolean; url?: string; error?: string }

const ICON: Record<string, string> = { motion: '🎞', asset3d: '🧊' };

export function PlatformLauncher() {
  const [items, setItems] = useState<PlatformInfo[]>([]);
  const [configFile, setConfigFile] = useState('.zerocraft/platforms.json');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const j = await (await fetch(`${API}/api/platforms`)).json() as ListResp;
      if (j.success && Array.isArray(j.platforms)) { setItems(j.platforms); if (j.configFile) setConfigFile(j.configFile); }
    } catch (e) {
      console.warn('[platforms] reject: 平台清单拉取失败（API 未起？）', e);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const launch = useCallback(async (p: PlatformInfo) => {
    if (!p.configured) { setError(`${p.label} 未配置：在 ${configFile} 写 platforms.${p.id}`); return; }
    setError(null);
    setBusy(p.id);
    const win = typeof window !== 'undefined' ? window.open('about:blank', `zerocraft-${p.id}`) : null;
    try {
      const j = await (await fetch(`${API}/api/platforms/${p.id}/launch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json() as LaunchResp;
      if (!j.success || !j.url) throw new Error(j.error || '拉起失败');
      if (win) win.location.href = j.url;
      else setError(`${p.label} 已就绪，浏览器拦截了新窗口：${j.url}`);
    } catch (e) {
      win?.close();
      setError(`${p.label}：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
      void refresh();
    }
  }, [configFile, refresh]);

  if (!items.length) return null;
  return (
    <span data-testid="platform-launcher" style={{ position: 'relative' }}>
      {items.map((p) => (
        <button
          key={p.id}
          data-platform={p.id}
          onClick={() => void launch(p)}
          disabled={busy !== null}
          title={p.configured ? `${p.label}（独立平台·新窗口打开${p.running ? '·已在运行' : ''}）` : `${p.label} 未配置：${configFile}`}
          style={{
            marginTop: 14,
            marginLeft: 10,
            padding: '7px 18px',
            background: SHELL.violetWash,
            color: p.configured ? SHELL.violet : SHELL.dim,
            border: `1px solid ${p.configured ? SHELL.violetLine : SHELL.line}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            cursor: busy ? 'wait' : 'pointer',
            outline: 'none',
            opacity: busy && busy !== p.id ? 0.5 : 1,
          }}
        >
          {busy === p.id ? '⏳ 启动中…' : `${ICON[p.id] ?? '↗'} ${p.label}${p.running ? ' ●' : ''}`}
        </button>
      ))}
      {/* 提示浮在按钮行下方：不占行内流，免得把同排按钮挤成两行 */}
      {error && <span role="alert" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, whiteSpace: 'nowrap', fontSize: 12, color: SHELL.warn }}>{error}</span>}
    </span>
  );
}
