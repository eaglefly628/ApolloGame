import React, { useState } from 'react';
import type { Hobby } from './data.js';
import { FOCUS_HALLS, type FocusHallId } from './focus-halls.js';
import { SakeBrandView } from './sake-brand-view.js';
import { SakeJapanCellarView, SakeSourcesView, SakeWorldCellarView } from './sake-cellar-view.js';
import { SakeAppreciationView, SakeCraftView, SakeCultureView } from './sake-depth-view.js';
import { HobbyGuideView, readGuideProgress } from './hobby-guide-view.js';
import { SakeHundredDesk } from './sake-appreciation-lab.js';
import { SakeRankingsView } from './sake-rankings-view.js';
import { SAKE_SCROLL_ARCHIVES, SAKE_SCROLL_TIERS, sakeScrollCanOpen, sakeScrollTier, type SakeScrollTab } from './sake-scroll.js';
import { CIGAR_SCROLL_ARCHIVES, CIGAR_SCROLL_TIERS, cigarScrollCanOpen, cigarScrollTier, type CigarScrollTab } from './cigar-scroll.js';
import { CigarCultureView } from './cigar-culture-view.js';

type HallTab = 'guide' | 'cellar' | 'brands' | 'rankings' | 'world' | 'sources' | 'culture' | 'path' | 'appreciation' | 'hundred' | 'objects' | 'people' | 'notes';
const COMMON_TABS: { id: HallTab; label: string }[] = [
  { id: 'guide', label: '师傅带路' }, { id: 'path', label: '入门路径' }, { id: 'objects', label: '器物档案' },
  { id: 'people', label: '同好议题' }, { id: 'notes', label: '我的手记' },
];
export function FocusHallView({ hobby, following, note, onFollow, onCircle, onCompose, onOpenItem, onSaveNote }: {
  hobby: Hobby & { id: FocusHallId };
  following: boolean;
  note: string;
  onFollow: () => void;
  onCircle: () => void;
  onCompose: () => void;
  onOpenItem: (id: string) => void;
  onSaveNote: (value: string) => void;
}) {
  const hall = FOCUS_HALLS[hobby.id];
  const [tab, setTab] = useState<HallTab>('guide');
  const [sakeCompleted, setSakeCompleted] = useState(() => readGuideProgress('sake', SAKE_SCROLL_TIERS.length - 1).completed);
  const [cigarCompleted, setCigarCompleted] = useState(() => readGuideProgress('cigar', CIGAR_SCROLL_TIERS.length - 1).completed);
  const [noteDraft, setNoteDraft] = useState(note);
  const [ageConfirmed, setAgeConfirmed] = useState(hobby.id === 'woodwork');
  const [saved, setSaved] = useState(false);
  const openTab = (target: HallTab) => {
    if (hobby.id === 'sake' && !sakeScrollCanOpen(target as SakeScrollTab, sakeCompleted)) return;
    if (hobby.id === 'cigar' && !cigarScrollCanOpen(target as CigarScrollTab, cigarCompleted)) return;
    setTab(target);
    window.requestAnimationFrame(() => document.getElementById('g113-hall-tabs')?.scrollIntoView({ block: 'start' }));
  };
  const openArchives = SAKE_SCROLL_ARCHIVES.filter((entry) => entry.requiredLevel <= sakeCompleted);
  const openCigarArchives = CIGAR_SCROLL_ARCHIVES.filter((entry) => entry.requiredLevel <= cigarCompleted);

  if (!ageConfirmed) return <div className="g113-focus"><div className="g113-focus-gate"><small>ADULT CULTURE / 成人内容</small><h2>先确认一件事</h2><p>{hobby.id === 'cigar' ? '雪茄馆只讨论农业、手工与历史纸本收藏，不提供吸食或购买引导。所有形式的烟草使用都有害。请确认你已达到所在地法定烟草年龄，再继续浏览。' : '清酒馆仅提供酿造、酒标与器物文化知识，不提供饮用建议或交易。请确认你已达到所在地法定饮酒年龄，再继续浏览。'}</p><button onClick={() => setAgeConfirmed(true)}>我已达到当地法定{hobby.id === 'cigar' ? '烟草' : '饮酒'}年龄</button><p className="g113-focus-muted">此处为 Demo 自我确认；正式发行仍须按地区完成年龄分级与审核。</p></div></div>;

  return <div className="g113-focus">
    {hobby.id === 'sake' && <nav id="g113-hall-tabs" className="g113-sake-scroll-nav" aria-label="清酒馆长卷与资料卷"><div className="g113-sake-scroll-status"><small>SAKE SCROLL / 清酒长卷</small><strong>阅历 {sakeCompleted} / {SAKE_SCROLL_TIERS.length - 1} · {sakeScrollTier(sakeCompleted).name}</strong><span>{sakeCompleted === SAKE_SCROLL_TIERS.length - 1 ? '五章成卷，资料卷已全部展开。' : `下一章：${sakeScrollTier(sakeCompleted).chapter}`}</span></div><div className="g113-sake-scroll-primary"><button type="button" className={tab === 'guide' ? 'active' : ''} aria-current={tab === 'guide' ? 'page' : undefined} onClick={() => openTab('guide')}>继续长卷 <span>由杉翁带路 · 过两问再开章</span></button><button type="button" className={tab === 'rankings' ? 'active' : ''} aria-current={tab === 'rankings' ? 'page' : undefined} onClick={() => openTab('rankings')}>2026 赛事公报 <span>独立公开，不需解锁</span></button></div>{openArchives.length > 0 && <details className="g113-sake-scroll-library"><summary>已展开的资料卷 · {openArchives.length} 卷 <span>↓</span></summary><div>{openArchives.map((item) => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} aria-current={tab === item.id ? 'page' : undefined} onClick={() => openTab(item.id)}><small>阅历 {item.requiredLevel}</small>{item.label}</button>)}</div></details>}<button type="button" className="g113-sake-scroll-sources" onClick={() => openTab('sources')}>查看资料出处与本地研究包 →</button></nav>}
    {hobby.id === 'cigar' && <nav id="g113-hall-tabs" className="g113-sake-scroll-nav" aria-label="雪茄馆长卷与资料卷"><div className="g113-sake-scroll-status"><small>CRAFT & PAPER SCROLL / 雪茄工艺长卷</small><strong>阅历 {cigarCompleted} / {CIGAR_SCROLL_TIERS.length - 1} · {cigarScrollTier(cigarCompleted).name}</strong><span>{cigarCompleted === 5 ? '五章成卷；继续读纸本与器具。' : `当前章：${cigarScrollTier(cigarCompleted).chapter}`}</span></div><div className="g113-sake-scroll-primary"><button type="button" className={tab === 'guide' ? 'active' : ''} aria-current={tab === 'guide' ? 'page' : undefined} onClick={() => openTab('guide')}>继续长卷 <span>由叶伯带路 · 看图、追问、过小考</span></button></div>{openCigarArchives.length > 0 && <details className="g113-sake-scroll-library"><summary>已展开的资料卷 · {openCigarArchives.length} 卷 <span>↓</span></summary><div>{openCigarArchives.map((item) => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} aria-current={tab === item.id ? 'page' : undefined} onClick={() => openTab(item.id)}><small>阅历 {item.requiredLevel}</small>{item.label}</button>)}</div></details>}</nav>}
    {tab === 'guide' && <HobbyGuideView hobby={hobby} onMilestone={hobby.id === 'sake' ? setSakeCompleted : hobby.id === 'cigar' ? setCigarCompleted : undefined} onExplore={(target) => openTab(target as HallTab)}/ >}
    {hobby.id === 'woodwork' && tab !== 'guide' && tab !== 'brands' && <div className="g113-focus-hero">
      <div className="g113-focus-photo"><img src={hobby.image.src} alt={`${hobby.name}馆 AI 氛围示意图`}/><span>AI 示意图 · 非真实物件</span></div>
      <div className="g113-focus-copy"><small>{hall.kicker}</small><h2>{hall.thesis}</h2><p>{hall.invitation}</p><div className="g113-focus-hero-actions"><button onClick={onFollow}>{following ? '✓ 已关注这门兴趣' : '+ 关注这门兴趣'}</button><button onClick={onCircle}>走进同好圈 ↗</button></div></div>
    </div>}

    {hobby.id === 'woodwork' && <div id="g113-hall-tabs" className="g113-focus-tabs" role="tablist" aria-label={`${hobby.name}馆内容`}>{COMMON_TABS.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>}

      {hobby.id === 'sake' && tab === 'cellar' && <section role="tabpanel"><SakeJapanCellarView/></section>}
      {hobby.id === 'sake' && tab === 'brands' && <section role="tabpanel"><SakeBrandView onGuide={() => openTab('guide')} onRankings={() => openTab('rankings')}/></section>}
      {hobby.id === 'sake' && tab === 'rankings' && <SakeRankingsView/>}
      {hobby.id === 'sake' && tab === 'world' && <section role="tabpanel"><SakeWorldCellarView/></section>}
      {hobby.id === 'sake' && tab === 'sources' && <section role="tabpanel"><SakeSourcesView/></section>}
      {hobby.id === 'sake' && tab === 'culture' && <section role="tabpanel"><SakeCultureView/></section>}
      {hobby.id === 'cigar' && tab === 'culture' && <CigarCultureView onDiscuss={() => openTab('people')}/>}
      {hobby.id === 'sake' && tab === 'appreciation' && <section role="tabpanel"><SakeAppreciationView/></section>}
      {hobby.id === 'sake' && tab === 'hundred' && <section role="tabpanel"><SakeHundredDesk/></section>}
      {hobby.id === 'sake' && tab === 'path' && <SakeCraftView/>}

      {hobby.id !== 'sake' && tab === 'path' && <section className="g113-focus-section" role="tabpanel"><div className="g113-focus-section-head"><small>01 / FOLLOW THE CRAFT</small><h2>沿着五个观察点，慢慢看懂</h2><p>每一步都可以独立开始，不用考试，也不必先购买。</p></div><div className="g113-focus-steps">{hall.steps.map((step, index) => <article key={step.title}><span>0{index + 1}</span><small>{step.summary}</small><h3>{step.title}</h3><p>{step.detail}</p><div>{step.clue}</div></article>)}</div></section>}

      {tab === 'objects' && <section className="g113-focus-section" role="tabpanel"><div className="g113-focus-section-head"><small>02 / OBJECT ARCHIVE</small><h2>从具体器物继续认识</h2><p>这是建档字段和观察角度的范例，不是上架商品，也不对应可核验实物。</p></div><div className="g113-focus-objects">{hall.objects.map((object, index) => <article key={object.name}><div><small>0{index + 1} / {object.kind}</small><h3>{object.name}</h3><p>{object.lens}</p></div><ul>{object.record.map((line) => <li key={line}>{line}</li>)}</ul>{hobby.id === 'woodwork' && index === 2 && <button onClick={() => onOpenItem('woodwork-01')}>查看虚拟小椅档案 ↗</button>}</article>)}</div><div className="g113-focus-evidence"><b>真实藏品还缺什么？</b><p>需要有授权的整体、多角度、局部、标记和瑕疵原图；保留来源与处理记录。AI 图只能做场景示意，不能用于真假和品相判断。</p></div></section>}

      {tab === 'people' && <section className="g113-focus-section" role="tabpanel"><div className="g113-focus-section-head"><small>03 / FIND YOUR PEOPLE</small><h2>从一个好问题，遇见同好</h2><p>我们希望先交流观察与经验，而不是比价格、比拥有多少。</p></div><div className="g113-focus-prompts">{hall.prompts.map((prompt) => <article key={prompt.title}><h3>{prompt.title}</h3><p>{prompt.text}</p></article>)}</div><div className="g113-focus-social-actions"><button onClick={onCircle}>看看本机演示话题 ↗</button><button onClick={onCompose}>写一条本机演示分享</button></div><p className="g113-focus-muted">现在没有真实用户、评论或云端发布；正式社区开放前需要账户和内容审核。</p></section>}

      {tab === 'notes' && <section className="g113-focus-section" role="tabpanel"><div className="g113-focus-section-head"><small>04 / PRIVATE JOURNAL</small><h2>留一页自己的观察</h2><p>记下想了解的词、看见的细节，或准备向同好请教的问题。</p></div><label className="g113-focus-note">我的私人手记<textarea value={noteDraft} maxLength={800} rows={7} onChange={(event) => { setNoteDraft(event.target.value); setSaved(false); }} placeholder={hobby.id === 'woodwork' ? '例：这张小椅的接合处还想再看两个角度……' : hobby.id === 'cigar' ? '例：这张旧纸环的字体与年代，有哪份馆藏记录可核对？' : '例：想弄清一张酒标上的精米步合与酒藏信息……'}/></label><div className="g113-focus-note-actions"><button onClick={() => { onSaveNote(noteDraft.trim()); setSaved(true); }}>保存到本机</button><span>{noteDraft.length} / 800 字{saved ? ' · 已保存' : ''}</span></div><p className="g113-focus-muted">手记只存在当前浏览器；不要在 Demo 中写入身份、地址或其他敏感信息。清除浏览器数据会丢失。</p></section>}
    <div className="g113-focus-footer"><p>{hall.caution}</p>{hobby.id === 'sake' || hobby.id === 'cigar' ? <span>依据与影像出处已收入馆内证据簿；阅读无需离开应用。</span> : <a href={hall.source.url} target="_blank" rel="noreferrer">阅读参考：{hall.source.label} ↗</a>}</div>
  </div>;
}
