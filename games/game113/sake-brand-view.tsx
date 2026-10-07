import React, { useEffect, useMemo, useState } from 'react';
import { SAKE_BRANDS } from './sake-brands.js';

const SHELF_KEY = 'game113-sake-brand-shelf-v1';

function readShelf(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SHELF_KEY) || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && SAKE_BRANDS.some((brand) => brand.id === id)) : [];
  } catch { return []; }
}

export function SakeBrandView({ onGuide, onRankings }: { onGuide?: () => void; onRankings?: () => void } = {}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(readShelf);
  const [region, setRegion] = useState('全部');
  const [search, setSearch] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const regions = useMemo(() => ['全部', ...new Set(SAKE_BRANDS.map((brand) => brand.prefecture))].sort((a, b) => a === '全部' ? -1 : b === '全部' ? 1 : a.localeCompare(b, 'zh-CN')), []);
  const matches = SAKE_BRANDS.filter((brand) =>
    (region === '全部' || brand.prefecture === region)
    && (!savedOnly || savedIds.includes(brand.id))
    && `${brand.name}${brand.romanized}${brand.brewery}${brand.prefecture}${brand.area}${brand.focus}${brand.example}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = SAKE_BRANDS.find((brand) => brand.id === selectedId);

  useEffect(() => {
    try { window.localStorage.setItem(SHELF_KEY, JSON.stringify(savedIds)); } catch { /* Private mode: shelf still works for this visit. */ }
  }, [savedIds]);

  const toggleSaved = (id: string) => {
    if (savedOnly && savedIds.includes(id) && selectedId === id) setSelectedId(null);
    setSavedIds((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id]);
  };

  return <section className="g113-brand-atlas" aria-labelledby="g113-brand-atlas-title">
    <header className="g113-brand-atlas-head">
      <div><small>SAKE ATLAS / 清酒品牌目录</small><h2 id="g113-brand-atlas-title">先认识酒藏，再认识名酒。</h2><p>从不同地域和酒藏出发，按地区名称排列；这里没有付费推荐位，也不设“第一名”。2026 年比赛结果与高价珍酿单独收入「赛事与珍酿」。</p>{onGuide && <button className="g113-brand-atlas-guide" type="button" onClick={onGuide}>跟着杉翁重走五章 →</button>}{onRankings && <button className="g113-brand-atlas-guide" type="button" onClick={onRankings}>看 2026 赛事与珍酿 →</button>}</div>
      <div className="g113-brand-atlas-count"><strong>{SAKE_BRANDS.length}</strong><span>座酒藏 / 首批已核档案</span><small>持续增补，并非日本清酒品牌全集</small></div>
    </header>

    <div className="g113-brand-atlas-tools">
      <label className="g113-brand-atlas-search"><span>按品牌、酒藏、地域查找</span><input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId(null); }} placeholder="例如：而今、奈良、酿造"/></label>
      <button type="button" className={savedOnly ? 'active' : ''} aria-pressed={savedOnly} onClick={() => { setSavedOnly((value) => !value); setSelectedId(null); }}>☆ 我的品牌书架 <b>{savedIds.length}</b></button>
    </div>
    <div className="g113-brand-atlas-regions" aria-label="按地区筛选">{regions.map((name) => <button type="button" key={name} className={region === name ? 'active' : ''} aria-pressed={region === name} onClick={() => { setRegion(name); setSelectedId(null); }}>{name}</button>)}</div>

    <div className="g113-brand-atlas-body">
      <div className="g113-brand-atlas-list" aria-label="清酒品牌列表"><div className="g113-brand-atlas-list-head"><span>{savedOnly ? '我的品牌书架' : '品牌索引'}</span><small>显示 {matches.length} / {SAKE_BRANDS.length}</small></div>
        {matches.map((brand) => <div className={`g113-brand-atlas-row${selectedId === brand.id ? ' active' : ''}`} key={brand.id}>
          <button type="button" className="g113-brand-atlas-open" aria-pressed={selectedId === brand.id} onClick={() => setSelectedId(brand.id)}><span className="g113-brand-atlas-name"><strong>{brand.name}</strong><small>{brand.romanized} · {brand.prefecture}{brand.area ? ` / ${brand.area}` : ''}</small></span><span className="g113-brand-atlas-arrow" aria-hidden="true">↗</span></button>
          <button type="button" className="g113-brand-atlas-save" aria-label={`${savedIds.includes(brand.id) ? '从品牌书架移除' : '收藏品牌'}${brand.name}`} aria-pressed={savedIds.includes(brand.id)} onClick={() => toggleSaved(brand.id)}>{savedIds.includes(brand.id) ? '★' : '☆'}</button>
        </div>)}
        {!matches.length && <div className="g113-brand-atlas-empty">还没有匹配的品牌。可以换一个地区或词语；书架为空时，先从目录收藏几座酒藏。</div>}
      </div>

      <div className="g113-brand-atlas-detail" aria-live="polite">{selected ? <article key={selected.id}>
        <div className="g113-brand-atlas-detail-art">{selected.photo ? <img src={selected.photo.src} alt={selected.photo.alt}/> : <span aria-hidden="true">{selected.name.slice(0, 1)}</span>}<small>{selected.photo ? `真实酒藏照片 · ${selected.photo.credit} · ${selected.photo.license}` : '文字档案 · 品牌实拍待授权'}</small></div>
        <div className="g113-brand-atlas-detail-copy"><div className="g113-brand-atlas-detail-kicker">{selected.prefecture} · {selected.area} <span>{selected.exampleFlavor ? '深读档' : '基础档'}</span></div><h3>{selected.name}<small>{selected.romanized}</small></h3><p className="g113-brand-atlas-thesis">{selected.focus}</p><p>{selected.story}</p>
          <dl><div><dt>酿造者</dt><dd>{selected.brewery}</dd></div><div><dt>入门参照</dt><dd>{selected.example}</dd></div>{selected.exampleClass && <div><dt>作品线索</dt><dd>{selected.exampleClass}</dd></div>}{selected.exampleFlavor && <div><dt>酒藏描述</dt><dd>{selected.exampleFlavor}</dd></div>}<div><dt>值得追问</dt><dd>{selected.lookFor}</dd></div></dl>
          <div className="g113-brand-atlas-detail-foot"><span>依据：{selected.source.label}；原始来源已登记在馆内资料。未核验酒款不补写风味与价格。</span><button type="button" aria-pressed={savedIds.includes(selected.id)} onClick={() => toggleSaved(selected.id)}>{savedIds.includes(selected.id) ? '★ 已收入品牌书架' : '☆ 收入我的品牌书架'}</button></div>
        </div>
      </article> : <div className="g113-brand-atlas-invitation"><span aria-hidden="true">酒</span><small>AN INVITATION / 从一座酒藏开始</small><h3>点开左边的一个名字。</h3><p>先找到你喜欢的地区、故事或工艺，再去认识具体的酒。这里没有榜首，也不需要先懂行。</p></div>}</div>
    </div>
    <p className="g113-focus-muted">资料核对：2026-10-04。首批品牌索引持续增补；收藏仅保存在当前浏览器，没有真实用户排名、市场价格或购买链接。品牌入选不代表合作或授权。</p>
  </section>;
}
