import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  LIBRARY_TAXONOMY,
  categoryLabel,
  parseAssetIndex,
  projectRecords,
  artlibRecords,
  manifestRecords,
  queryLibrary,
  libraryCounts,
  type AliasMap,
  type AssetIndex,
  type LibraryRecord,
  type LibrarySource,
  type LibraryStatus,
} from '@assets/index.js';
import type { ArtLibIndex } from '@assets/artlib.js';
import { GAME_F_ASSETS } from '../games/game-f/assets.js';
import { JOKER_ART_MANIFEST } from '../games/game-e/assets.js';
import { SHELL, sBtn, sInput, sSelect, sChip, sLabel, sBadge, sChecker } from '../ui/shell-theme.js';
import { AssetImportWizard } from './AssetImportWizard.js';

// ═══════════════════════════════════════════════════════════════
//  资源库浏览器 —— 统一资产库的「数据浏览」面（+入口进「数据导入」向导）。
//  三栏：类型目录树+来源过滤 ｜ 缩略图网格 ｜ 选中详情。
//  三来源经 @assets/library 适配成同一种记录：
//   · 项目资产 assets/index.json（可刷新：导入器写完即重载）
//   · FreeArtLib 素材包（只读）
//   · 游戏 AssetManifest 声明清单（只读聚合；游戏层迁数据归 PE）
//  布局对标成熟资源浏览器（Unity Project / Unreal Content Browser），mockup 见
//  docs/design/asset-library-mockup.html（用户已拍板）。
// ═══════════════════════════════════════════════════════════════

const CAP = 400; // 网格一次最多渲染数（靠搜索/过滤收窄）

const GAME_MANIFESTS: ReadonlyArray<readonly [string, Parameters<typeof manifestRecords>[1]]> = [
  ['game-e', JOKER_ART_MANIFEST],
  ['game-f', GAME_F_ASSETS],
];

const STATUS_LABEL: Record<LibraryStatus, string> = { filled: '已填', tbf: '待填', placeholder: '占位' };

export function AssetLibrary({ onBack }: { onBack: () => void }) {
  // ── 数据源 ──
  const [artIndex, setArtIndex] = useState<ArtLibIndex | null>(null);
  const [projIndex, setProjIndex] = useState<AssetIndex | null>(null);
  // 检索别名层（概念/同义词/中文）：补图标名读不出的搜索词，让 剑/weapon/blade 互搜。
  const [aliases, setAliases] = useState<AliasMap>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/assets/FreeArtLib/index.json')
      .then((r) => r.json())
      .then((j) => setArtIndex(j as ArtLibIndex))
      .catch((e) => setLoadErr(`FreeArtLib 索引加载失败：${String(e)}（需 python3 apollo.py 起 vite）`));
  }, []);
  useEffect(() => {
    fetch('/assets/curated/search-aliases.json')
      .then((r) => r.json())
      .then((j) => setAliases((j?.aliases ?? {}) as AliasMap))
      .catch(() => setAliases({})); // 别名缺失只是少了同义词增益，不阻塞库
  }, []);

  const reloadProject = useCallback(() => {
    fetch('/assets/index.json')
      .then((r) => r.json())
      .then((j) => setProjIndex(parseAssetIndex(j)))
      .catch(() => setProjIndex(null));
  }, []);
  useEffect(() => reloadProject(), [reloadProject]);
  // 别名是运行时并入 tags 的（不入 index.json）→ index 或 aliases 任一就绪/变更都重算记录。
  const projRecords = useMemo(
    () => (projIndex ? projectRecords(projIndex, '/assets/', aliases) : []),
    [projIndex, aliases],
  );

  const gameRecords = useMemo(
    () => GAME_MANIFESTS.flatMap(([id, m]) => manifestRecords(id, m)),
    [],
  );
  const allRecords = useMemo(
    () => [...projRecords, ...(artIndex ? artlibRecords(artIndex) : []), ...gameRecords],
    [projRecords, artIndex, gameRecords],
  );

  // ── 查询状态 ──
  const [text, setText] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<LibraryStatus | ''>('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [sources, setSources] = useState<Record<LibrarySource, boolean>>({ project: true, artlib: true, game: true });
  const [sort, setSort] = useState<'name' | 'size' | 'variants' | 'relevance'>('name');
  const [thumbPx, setThumbPx] = useState(64);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);

  const enabledSources = useMemo(
    () => (Object.keys(sources) as LibrarySource[]).filter((s) => sources[s]),
    [sources],
  );
  const scoped = useMemo(
    () => allRecords.filter((r) => enabledSources.includes(r.source)),
    [allRecords, enabledSources],
  );
  const counts = useMemo(() => libraryCounts(scoped), [scoped]);
  // 输入框即时回显 text，重查询用 deferred 值 → 打字不被 2 万条查询阻塞（React 18，可中断、无需手搓计时器）。
  const deferredText = useDeferredValue(text);
  // 搜索时默认按相关度（与 AI 选材解析同一个排序器：所见即所选）；用户显式选了尺寸/变体则尊重。
  const effectiveSort = deferredText.trim() && sort === 'name' ? 'relevance' : sort;
  const results = useMemo(
    () => queryLibrary(scoped, { text: deferredText, type: type || undefined, category: category || undefined, status: status || undefined, tags: tagFilters, sort: effectiveSort }),
    [scoped, deferredText, type, category, status, tagFilters, effectiveSort],
  );
  const shown = results.slice(0, CAP);
  const selected = useMemo(() => allRecords.find((r) => r.id === selectedId) ?? null, [allRecords, selectedId]);
  const tbfCount = useMemo(() => scoped.filter((r) => r.status === 'tbf').length, [scoped]);
  const existingIds = useMemo(() => new Set(allRecords.map((r) => r.id)), [allRecords]);

  const copyId = useCallback((id: string) => {
    void navigator.clipboard?.writeText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }, []);

  const pickType = (t: string) => {
    setType((cur) => (cur === t ? '' : t));
    setCategory('');
  };
  const pickCategory = (t: string, c: string) => {
    setType(t);
    setCategory((cur) => (cur === c ? '' : c));
  };

  if (importing) {
    return (
      <AssetImportWizard
        existingIds={existingIds}
        onClose={() => setImporting(false)}
        onCommitted={reloadProject}
      />
    );
  }

  const typeDef = LIBRARY_TAXONOMY.find((t) => t.type === type);

  return (
    <div style={{ position: 'absolute', inset: 0, background: SHELL.appBg, color: SHELL.text, display: 'flex', flexDirection: 'column', fontFamily: SHELL.fontUi }}>
      {/* ── 工具栏 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${SHELL.line}`, background: 'rgba(10,14,23,0.95)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: SHELL.violet, whiteSpace: 'nowrap' }}>🗃 资源库</span>
        <button onClick={() => setImporting(true)} style={sBtn('primary')}>📥 导入资产</button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="搜索 id / 名称 / 描述 / tag，空格分词全命中"
          style={{ ...sInput(), flex: 1, minWidth: 200 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as LibraryStatus | '')} style={sSelect()}>
          <option value="">状态: 全部</option>
          <option value="filled">已填 filled</option>
          <option value="tbf">待填 tbf</option>
          <option value="placeholder">占位 placeholder</option>
        </select>
        <select value={effectiveSort} onChange={(e) => setSort(e.target.value as typeof sort)} style={sSelect()}>
          <option value="name">排序: 名称</option>
          <option value="relevance">排序: 相关度（搜索时默认）</option>
          <option value="size">排序: 尺寸</option>
          <option value="variants">排序: 变体数</option>
        </select>
        <button onClick={onBack} style={sBtn('ghost')}>← 返回</button>
      </div>

      {/* ── 面包屑 + tag chips ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderBottom: `1px solid ${SHELL.line}`, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: SHELL.sub }}>
          <span style={{ cursor: 'pointer' }} onClick={() => { setType(''); setCategory(''); }}>全部</span>
          {typeDef && <> ▸ <span style={{ cursor: 'pointer' }} onClick={() => setCategory('')}>{typeDef.icon} {typeDef.label}</span></>}
          {typeDef && category && <> ▸ <b style={{ color: SHELL.jade }}>{categoryLabel(type, category)}</b></>}
        </span>
        {tagFilters.length > 0 && <span style={{ width: 1, height: 14, background: SHELL.line }} />}
        {tagFilters.map((t) => (
          <span key={t} onClick={() => setTagFilters((ts) => ts.filter((x) => x !== t))} style={{ ...sChip(true), background: SHELL.violetWash, color: SHELL.violet, borderColor: SHELL.violetLine }}>
            #{t} ×
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: SHELL.dim }}>
          {results.length > CAP ? `显示前 ${CAP} / ${results.length}（再筛）` : `${results.length} 个`}
        </span>
      </div>

      {/* ── 三栏 ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 目录树 */}
        <div style={{ width: 212, flex: 'none', borderRight: `1px solid ${SHELL.line}`, background: SHELL.bg1, overflow: 'auto', padding: '8px 0' }}>
          {LIBRARY_TAXONOMY.map((t) => {
            const total = counts.get(t.type) ?? 0;
            const open = type === t.type;
            return (
              <div key={t.type}>
                <div
                  onClick={() => pickType(t.type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 14px', cursor: 'pointer', fontSize: 13,
                    color: open ? SHELL.jade : total > 0 ? SHELL.sub : SHELL.dim,
                    background: open && !category ? SHELL.jadeWash : 'transparent',
                    borderRight: open && !category ? `2px solid ${SHELL.jade}` : '2px solid transparent',
                  }}
                >
                  <span style={{ width: 12, color: SHELL.faint }}>{open ? '▾' : '▸'}</span>
                  {t.icon} {t.label}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: SHELL.faint }}>{total}</span>
                </div>
                {open &&
                  t.categories.map((c) => {
                    const n = counts.get(`${t.type}/${c.id}`) ?? 0;
                    const active = category === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => pickCategory(t.type, c.id)}
                        style={{
                          display: 'flex', alignItems: 'center', padding: '3px 14px 3px 38px', cursor: 'pointer', fontSize: 12,
                          color: active ? SHELL.jade : n > 0 ? SHELL.sub : SHELL.faint,
                          background: active ? SHELL.jadeWash : 'transparent',
                          borderRight: active ? `2px solid ${SHELL.jade}` : '2px solid transparent',
                        }}
                      >
                        {c.label}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: SHELL.faint }}>{n}</span>
                      </div>
                    );
                  })}
              </div>
            );
          })}

          <div style={{ ...sLabel, padding: '14px 14px 6px' }}>来源（包）</div>
          {(
            [
              ['project', '项目资产 assets/'],
              ['artlib', `FreeArtLib${artIndex ? ` · ${artIndex.assetCount}` : ''}`],
              ['game', '游戏清单（只读）'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 14px', fontSize: 12, color: SHELL.sub, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sources[key]}
                onChange={(e) => setSources((s) => ({ ...s, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>

        {/* 缩略图网格 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderBottom: `1px solid ${SHELL.line}`, fontSize: 11, color: SHELL.dim }}>
            缩略图
            <input type="range" min={48} max={96} step={8} value={thumbPx} onChange={(e) => setThumbPx(+e.target.value)} style={{ width: 90, accentColor: SHELL.jade }} />
            {loadErr && <span style={{ color: SHELL.warn }}>{loadErr}</span>}
            {!artIndex && !loadErr && <span>FreeArtLib 索引加载中…</span>}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start' }}>
            {shown.length === 0 && <div style={{ color: SHELL.dim, fontSize: 13, padding: 8 }}>无匹配资产</div>}
            {shown.map((r) => (
              <AssetCard key={`${r.source}:${r.id}`} r={r} px={thumbPx} active={selectedId === r.id} onPick={() => setSelectedId(r.id)} />
            ))}
          </div>
          {/* 状态栏 */}
          <div style={{ display: 'flex', gap: 18, padding: '6px 14px', borderTop: `1px solid ${SHELL.line}`, fontSize: 11, color: SHELL.dim, background: SHELL.bg1 }}>
            <span>共 {scoped.length} 资产</span>
            <span>筛得 {results.length}</span>
            <span style={{ color: tbfCount ? SHELL.warn : SHELL.dim }}>TBF 待填 {tbfCount}</span>
            {selected && <span style={{ color: SHELL.sub }}>已选 {selected.id}</span>}
          </div>
        </div>

        {/* 详情 */}
        <div style={{ width: 256, flex: 'none', borderLeft: `1px solid ${SHELL.line}`, background: SHELL.bg1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {!selected ? (
            <div style={{ color: SHELL.dim, fontSize: 12, marginTop: 20, textAlign: 'center' }}>点击左侧资产查看详情</div>
          ) : (
            <>
              <div style={{ ...sChecker, width: '100%', height: 150, borderRadius: 8, border: `1px solid ${SHELL.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {selected.thumb ? (
                  <img src={selected.thumb} alt={selected.name} style={{ maxWidth: '90%', maxHeight: '90%', imageRendering: 'pixelated' }} />
                ) : (
                  <span style={{ fontSize: 40, opacity: 0.4 }}>❓</span>
                )}
              </div>
              <div>
                <div style={{ ...sLabel, marginBottom: 3 }}>id（即 textureKey）</div>
                <div
                  onClick={() => copyId(selected.id)}
                  title="点击复制"
                  style={{ fontFamily: SHELL.fontMono, fontSize: 12, color: copied ? SHELL.ok : SHELL.jade, cursor: 'pointer', wordBreak: 'break-all' }}
                >
                  {selected.id} {copied ? '✓' : '⧉'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={sLabel}>类型/分类</div>
                  <div style={{ fontSize: 12 }}>{LIBRARY_TAXONOMY.find((t) => t.type === selected.type)?.label} · {categoryLabel(selected.type, selected.category)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={sLabel}>状态</div>
                  <span style={sBadge(selected.status === 'filled' ? 'ok' : selected.status === 'tbf' ? 'warn' : 'dim')}>{STATUS_LABEL[selected.status]}</span>
                </div>
              </div>
              {(selected.width || selected.format) && (
                <div>
                  <div style={sLabel}>规格</div>
                  <div style={{ fontSize: 12, color: SHELL.sub }}>
                    {selected.width ? `${selected.width}×${selected.height}` : '—'}
                    {selected.format ? ` · ${selected.format}` : ''}
                    {selected.transparent !== undefined ? (selected.transparent ? ' · 透明' : ' · 不透明') : ''}
                    {selected.variants && selected.variants > 1 ? ` · ×${selected.variants} 变体` : ''}
                  </div>
                </div>
              )}
              {selected.description && (
                <div>
                  <div style={sLabel}>描述</div>
                  <div style={{ fontSize: 11, color: SHELL.sub, lineHeight: 1.5, wordBreak: 'break-all' }}>{selected.description}</div>
                </div>
              )}
              {selected.tags.length > 0 && (() => {
                // 语义标签（像素扫描层）黛紫高亮、排前；结构词（路径/主题派生）常规色——区分"看图所得"与"名字所得"。
                const sem = selected.semanticTags ?? [];
                const semSet = new Set(sem);
                const struct = selected.tags.filter((t) => !semSet.has(t));
                const chip = (t: string, semantic: boolean) => (
                  <span
                    key={t}
                    onClick={() => setTagFilters((ts) => (ts.includes(t) ? ts : [...ts, t]))}
                    style={
                      semantic && !tagFilters.includes(t)
                        ? { ...sChip(false), background: SHELL.violetWash, color: SHELL.violet, borderColor: SHELL.violetLine }
                        : sChip(tagFilters.includes(t))
                    }
                  >
                    #{t}
                  </span>
                );
                return (
                  <div>
                    <div style={{ ...sLabel, marginBottom: 5 }}>
                      tags（点击加为过滤{sem.length > 0 ? ' · 紫=语义' : ''}）
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {sem.map((t) => chip(t, true))}
                      {struct.slice(0, Math.max(4, 16 - sem.length)).map((t) => chip(t, false))}
                    </div>
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={sLabel}>来源</div>
                  <div style={{ fontSize: 12 }}>{selected.sourceLabel}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={sLabel}>许可</div>
                  <div style={{ fontSize: 12, color: selected.license ? SHELL.ok : SHELL.dim }}>{selected.license ?? '—'}</div>
                </div>
              </div>
              {selected.path && (
                <div>
                  <div style={sLabel}>文件</div>
                  <div style={{ fontFamily: SHELL.fontMono, fontSize: 10, color: SHELL.dim, wordBreak: 'break-all' }}>{selected.path}</div>
                </div>
              )}
              <button onClick={() => copyId(selected.id)} style={{ ...sBtn('primary'), marginTop: 'auto', textAlign: 'center' }}>
                {copied ? '已复制 ✓' : '复制 key'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 网格卡片 ──

function AssetCard({ r, px, active, onPick }: { r: LibraryRecord; px: number; active: boolean; onPick: () => void }) {
  const [hover, setHover] = useState(false);
  // 图上标签：语义标签优先（像素扫描层），没有则退回普通 tags；悬停 title 给全量。
  const overlayTags = (r.semanticTags?.length ? r.semanticTags : r.tags).slice(0, 2);
  const extra = (r.semanticTags?.length ? r.semanticTags.length : r.tags.length) - overlayTags.length;
  return (
    <div
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${r.id}${r.semanticTags?.length ? `\n语义: ${r.semanticTags.join(' ')}` : ''}`}
      style={{
        width: px + 28, padding: 6, borderRadius: 8, cursor: 'pointer',
        background: active ? SHELL.jadeWash : hover ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
        border: `1px solid ${active ? SHELL.jadeLine : hover ? SHELL.lineStrong : SHELL.line}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}
    >
      <div style={{ ...sChecker, width: px, height: px, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        {r.thumb ? (
          <img src={r.thumb} alt={r.name} loading="lazy" style={{ maxWidth: px - 8, maxHeight: px - 8, imageRendering: 'pixelated' }} />
        ) : (
          <span style={{ fontSize: px / 3, opacity: 0.35 }}>❓</span>
        )}
        {overlayTags.length > 0 && px >= 56 && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center',
            padding: '2px 2px', background: 'rgba(6,8,13,0.72)', backdropFilter: 'blur(2px)',
          }}>
            {overlayTags.map((t) => (
              <span key={t} style={{ fontSize: 8, lineHeight: 1.4, padding: '0 4px', borderRadius: 6, background: SHELL.violetWash, color: SHELL.violet, border: `1px solid ${SHELL.violetLine}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: px / 2 }}>
                {t}
              </span>
            ))}
            {extra > 0 && <span style={{ fontSize: 8, color: SHELL.dim }}>+{extra}</span>}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word', maxHeight: 24, overflow: 'hidden', color: SHELL.text }}>
        {r.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {r.status !== 'filled' && <span style={sBadge(r.status === 'tbf' ? 'warn' : 'dim')}>{STATUS_LABEL[r.status]}</span>}
        {r.variants && r.variants > 1 && <span style={{ fontSize: 9, color: SHELL.dim }}>×{r.variants}</span>}
      </div>
    </div>
  );
}
