import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { searchArtlib, artlibThumb, type ArtLibIndex, type ArtAsset, type ArtSlot } from '../assets/artlib.js';

// 共享美术库浏览器：缩略图网格 + 搜索 + cat/slot 过滤 + 点击复制资产 id。
// 数据来自 assets/FreeArtLib/index.json（dev 下 vite 直接服务）；id 即游戏数据里的 textureKey。

const C = {
  bg: '#0a0f1e', border: 'rgba(255,255,255,0.08)', text: '#e2e8f0',
  dim: '#64748b', dim2: '#94a3b8', accent: '#38bdf8', purple: '#a78bfa', green: '#22c55e', amber: '#fbbf24',
};

const SLOT_LABEL: Record<string, string> = {
  tile: '瓦片', 'sprite.character': '角色/怪', 'sprite.paperdoll': '纸娃娃',
  'icon.item': '物品', 'icon.ui': 'UI/法术', fx: '特效', decal: '装饰',
};
const CAT_LABEL: Record<string, string> = {
  dungeon: '地牢', monster: '怪物', player: '玩家', item: '物品', gui: 'GUI', misc: '杂项', effect: '特效', emissaries: '使者',
};
const CAP = 400; // 一次最多渲染多少张缩略图（4761 全渲会卡；靠搜索/过滤收窄）

export function ArtLibBrowser({ onBack }: { onBack: () => void }) {
  const [index, setIndex] = useState<ArtLibIndex | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const [slot, setSlot] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/assets/FreeArtLib/index.json')
      .then((r) => r.json())
      .then(setIndex)
      .catch((e) => setErr(`加载 index.json 失败：${String(e)}（需 python3 apollo.py 起 vite）`));
  }, []);

  const results = useMemo(
    () => (index ? searchArtlib(index, query, { cat: cat || undefined, slot: (slot || undefined) as ArtSlot | undefined }) : []),
    [index, query, cat, slot],
  );
  const shown = results.slice(0, CAP);

  const copy = useCallback((id: string) => {
    navigator.clipboard?.writeText(id);
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  }, []);

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', fontSize: 11, borderRadius: 12, cursor: 'pointer',
    background: active ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)',
    color: active ? C.accent : C.dim2, border: `1px solid ${active ? 'rgba(56,189,248,0.4)' : C.border}`,
  });

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, color: C.text, overflow: 'auto' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,15,30,0.95)', borderBottom: `1px solid ${C.border}`, padding: '12px 20px', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.purple }}>🎨 美术库浏览器</span>
          {index && (
            <span style={{ color: C.dim, fontSize: 12 }}>
              FreeArtLib · {index.assetCount} 资产 / {index.fileCount} 张 · {index.license.split(' ')[0]} · 32px
            </span>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 id / 分类 / 主题词，如 sword / undead / floor"
            style={{ flex: 1, minWidth: 180, background: 'rgba(0,0,0,0.35)', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, padding: '6px 10px', outline: 'none' }}
          />
          <span style={{ fontSize: 11, color: C.dim }}>
            {results.length > CAP ? `显示前 ${CAP} / ${results.length}（再筛）` : `${results.length} 个`}
          </span>
          <button onClick={onBack} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)', color: C.dim2, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'monospace' }}>← 返回</button>
        </div>
        {index && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <span onClick={() => setCat('')} style={chip(cat === '')}>全部分类</span>
            {Object.keys(index.cats).sort().map((k) => (
              <span key={k} onClick={() => setCat(cat === k ? '' : k)} style={chip(cat === k)}>{CAT_LABEL[k] ?? k} {index.cats[k]}</span>
            ))}
            <span style={{ width: 1, background: C.border, margin: '0 4px' }} />
            {Object.keys(index.slots).sort().map((k) => (
              <span key={k} onClick={() => setSlot(slot === k ? '' : k)} style={chip(slot === k)}>{SLOT_LABEL[k] ?? k}</span>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 16 }}>
        {err && <div style={{ color: C.amber, fontSize: 13 }}>{err}</div>}
        {!index && !err && <div style={{ color: C.dim, fontSize: 13 }}>加载中…</div>}
        {index && results.length === 0 && <div style={{ color: C.dim, fontSize: 13 }}>无匹配资产</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {index && shown.map((a) => (
            <ArtCard key={a.id} asset={a} index={index} copied={copied === a.id} onCopy={() => copy(a.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ArtCard({ asset, index, copied, onCopy }: { asset: ArtAsset; index: ArtLibIndex; copied: boolean; onCopy: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onCopy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${asset.id}（点击复制 id 当 textureKey）`}
      style={{
        width: 92, padding: 6, borderRadius: 8, cursor: 'pointer',
        background: copied ? 'rgba(34,197,94,0.15)' : hover ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${copied ? C.green : hover ? 'rgba(56,189,248,0.4)' : C.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}
    >
      <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-conic-gradient(#1a2030 0% 25%, #11151f 0% 50%) 50% / 16px 16px', borderRadius: 4 }}>
        <img
          src={`/${artlibThumb(index, asset)}`}
          alt={asset.subject}
          loading="lazy"
          width={48}
          height={48}
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div style={{ fontSize: 10, color: C.text, textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word', maxHeight: 24, overflow: 'hidden' }}>{asset.subject}</div>
      <div style={{ fontSize: 9, color: C.dim }}>
        {SLOT_LABEL[asset.slot] ?? asset.slot}{asset.variants > 1 ? ` ·×${asset.variants}` : ''}
      </div>
      {copied && <div style={{ fontSize: 9, color: C.green }}>已复制 id ✓</div>}
    </div>
  );
}
