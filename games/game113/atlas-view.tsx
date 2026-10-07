import React, { useMemo, useRef, useState } from 'react';
import { ATLAS_BRANCH_COUNT, ATLAS_GROUPS, ATLAS_GUIDES, ATLAS_OBJECT_COUNT, type AtlasBranch } from './atlas.js';

const FIRST_LOOK_COUNT = 6;

export function InterestAtlas({ openHobby }: { openHobby: (id: string) => void }) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(FIRST_LOOK_COUNT);
  const [selectedId, setSelectedId] = useState('watches');
  const [guideId, setGuideId] = useState('watches');
  const detailRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const normalized = term.trim().toLocaleLowerCase();
  const activeGroup = ATLAS_GROUPS.find((group) => group.id === groupId);
  const browsing = Boolean(activeGroup || normalized);
  const results = useMemo(() => ATLAS_GROUPS.flatMap((group) => group.branches
    .filter((branch) => (!groupId || groupId === group.id) && (!normalized || `${group.name} ${branch.name} ${branch.objects.join(' ')}`.toLocaleLowerCase().includes(normalized)))
    .map((branch) => ({ group, branch }))), [groupId, normalized]);
  const visibleResults = results.slice(0, visibleCount);
  const selected = visibleResults.find(({ branch }) => branch.id === selectedId) || visibleResults[0];
  const guide = ATLAS_GUIDES.find((item) => item.id === guideId)!;
  const enterGroup = (id: string) => {
    setGroupId(id);
    setTerm('');
    setVisibleCount(FIRST_LOOK_COUNT);
    setSelectedId(ATLAS_GROUPS.find((group) => group.id === id)?.branches[0]?.id || 'watches');
    window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const returnToGroups = () => { setGroupId(null); setTerm(''); setVisibleCount(FIRST_LOOK_COUNT); };
  const search = (value: string) => { setTerm(value); setGroupId(null); setVisibleCount(FIRST_LOOK_COUNT); };
  const choose = (branch: AtlasBranch) => {
    setSelectedId(branch.id);
    if (ATLAS_GUIDES.some((item) => item.id === branch.id)) setGuideId(branch.id);
    if (window.matchMedia('(max-width: 1100px)').matches) window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  return <section className="g113-atlas" aria-label="兴趣图谱">
    <div className="g113-atlas-hero">
      <img src="/games/game113/demo/interest-atlas-v1.png" alt="AI 生成的多种爱好器物氛围示意图"/>
      <div className="g113-atlas-shade"/>
      <div className="g113-atlas-hero-copy"><small>INTEREST ATLAS / 兴趣图谱</small><h2>世界很大，<br/>总有还没遇见的热爱。</h2><p>从一件器物出发，慢慢认识一个圈子。</p><span>{ATLAS_GROUPS.length} 个方向 · {ATLAS_BRANCH_COUNT} 条分支 · {ATLAS_OBJECT_COUNT} 个候选物件</span></div>
      <span className="g113-atlas-ai">AI 生成氛围图 · 非真实藏品</span>
    </div>
    <div className="g113-atlas-heading"><div><small>EXPLORE FURTHER</small><h2>六种方向，慢慢遇见</h2><p>先挑一门想靠近的兴趣；更深的分支，进去再看。</p></div></div>
    <div className="g113-atlas-controls"><label className="g113-atlas-search"><span aria-hidden="true">⌕</span><input value={term} onChange={(event) => search(event.target.value)} placeholder="心里已有方向？搜一搜……" aria-label="搜索兴趣图谱"/></label></div>
    {!browsing && <div className="g113-atlas-category-grid" aria-label="六大兴趣领域">{ATLAS_GROUPS.map((group, index) => <button key={group.id} className="g113-atlas-category" onClick={() => enterGroup(group.id)}><small>{String(index + 1).padStart(2, '0')} / {group.branches.length} 条分支</small><h3>{group.name}</h3><p>{group.lens}</p><span>{group.branches.slice(0, 3).map((branch) => branch.name).join(' · ')}</span><em>走进这个领域 <b aria-hidden="true">↗</b></em></button>)}</div>}
    {browsing && <div ref={resultsRef} className="g113-atlas-browse"><div className="g113-atlas-browse-head"><button onClick={returnToGroups}>← 返回六大领域</button><div><small>{activeGroup ? 'SELECTED FIELD / 领域内探索' : 'SEARCH / 找到的线索'}</small><h3>{activeGroup?.name || `与“${term.trim()}”有关`}</h3><p>{activeGroup?.lens || '从名字与器物中，找一个想继续认识的方向。'} · {results.length} 条分支</p></div></div>
      <div className="g113-atlas-layout"><div><div className="g113-atlas-list">{visibleResults.map(({ group, branch }) => <button key={branch.id} className={`g113-atlas-branch ${selected?.branch.id === branch.id ? 'active' : ''}`} onClick={() => choose(branch)} aria-pressed={selected?.branch.id === branch.id}><small>{group.name}</small><b>{branch.name}</b><span>{branch.objects.slice(0, 3).join(' · ')}</span><em>{branch.openHobby ? '已开馆 ↗' : '策展中 →'}</em></button>)}{!results.length && <div className="g113-atlas-no-results">暂未找到这个方向。图谱会继续生长，也欢迎你以后把新发现告诉我们。</div>}</div>{results.length > visibleCount && <button className="g113-atlas-more" onClick={() => setVisibleCount((count) => count + FIRST_LOOK_COUNT)}>再看 {Math.min(FIRST_LOOK_COUNT, results.length - visibleCount)} 条分支 <span aria-hidden="true">↓</span></button>}</div>
        {selected && <aside ref={detailRef} className="g113-atlas-detail" aria-live="polite"><div className="g113-atlas-detail-top"><small>{selected.group.name} / {selected.group.lens}</small><h3>{selected.branch.name}</h3><p>可以从这些具体物件开始认识：</p></div><div className="g113-atlas-objects">{selected.branch.objects.map((object) => <span key={object}>{object}</span>)}</div>{selected.branch.note && <p className="g113-atlas-caution">{selected.branch.note}</p>}{selected.branch.openHobby ? <button className="g113-atlas-link" onClick={() => openHobby(selected.branch.openHobby!)}>进入已开爱好馆 <span>↗</span></button> : <p className="g113-atlas-pending">馆藏、图片与行情尚未开放；先把这门兴趣的边界梳理清楚。</p>}</aside>}</div></div>}
    <div className="g113-atlas-guide"><div className="g113-atlas-guide-head"><div><small>LOOK CLOSER / 细看一门爱好</small><h2>从大类，走到具体型号</h2></div><img src="/games/game113/demo/curiosity-table-v1.png" alt="AI 生成的小众爱好器物氛围示意图"/><span>AI 生成氛围图</span></div><div className="g113-atlas-guide-tabs">{ATLAS_GUIDES.map((item) => <button key={item.id} className={guideId === item.id ? 'active' : ''} onClick={() => { setGuideId(item.id); setSelectedId(item.id); }}>{item.title.replace('怎么逛？', '').replace('怎么分？', '').replace('怎么收？', '').replace('能收什么？', '')}</button>)}</div><div className="g113-atlas-guide-body"><div><h3>{guide.title}</h3><p>{guide.intro}</p><div className="g113-atlas-axes">{guide.axes.map((axis) => <div key={axis.name}><b>{axis.name}</b><span>{axis.values}</span></div>)}</div></div><div className="g113-atlas-examples"><small>从具体例子感受层级</small>{guide.examples.map((example) => <p key={example}>{example}</p>)}<div>{guide.caution}</div></div></div></div>
    <p className="g113-atlas-footnote">图谱是选题清单，不代表真实市场报价或流通担保。AI 图仅用于 Demo 氛围；正式物件须由授权实拍、来源与品相资料建档。</p>
  </section>;
}
