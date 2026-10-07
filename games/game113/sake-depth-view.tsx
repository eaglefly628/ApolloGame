import React from 'react';
import { FOCUS_HALLS } from './focus-halls.js';
import { SAKE_CLASSIFICATIONS, SAKE_COLLECTION_CHECKLIST, SAKE_CRAFT, SAKE_DEPTH_SOURCES, SAKE_HISTORY, SAKE_PRICE_SAMPLES, SAKE_STORIES, SAKE_TASTING_LENSES } from './sake-depth.js';
import { SakeAppreciationLab } from './sake-appreciation-lab.js';

const real = (name: string) => `/games/game113/real/${name}`;

export function SakeCultureView() {
  return <div className="g113-sake-depth">
    <div className="g113-sake-depth-intro"><small>THE LONG VIEW / 历史与传说</small><h2>一杯酒之外，还有漫长的时间。</h2><p>把有文献依据的历史、民间神话和品牌自己的命名故事分开读，清酒文化才会越看越有意思。</p></div>
    <div className="g113-sake-culture-feature"><div><small>真实器物 · 不是本馆酒款</small><h3>先看一件留下来的器物。</h3><p>这件酒瓶陈列于东京的食与农业博物馆。它在这里是一扇观察器形与陈列方式的窗；来源页未给出可核验的年代和窑口，因此不替它补写，也不对应下方任何品牌或价格。</p></div><figure><img src={real('museum-sake-bottle-cc0.jpg')} alt="东京食与农业博物馆陈列的真实酒瓶"/><figcaption>真实藏品照片 · 摄影 Daderot · CC0；物件来源已收录馆内索引</figcaption></figure></div>
    <section className="g113-sake-depth-section"><div className="g113-sake-section-head"><small>01 / HISTORY</small><h3>沿着五段时间，看酿造如何变化。</h3></div><div className="g113-sake-timeline">{SAKE_HISTORY.map((event) => <article key={event.era}><span>{event.era}</span><div><h4>{event.title}</h4><p>{event.text}</p></div></article>)}</div></section>
    <section className="g113-sake-depth-section"><div className="g113-sake-section-head"><small>02 / STORIES</small><h3>传说很美，也要知道它是哪一种故事。</h3></div><div className="g113-sake-story-grid">{SAKE_STORIES.map((story) => <article key={story.title}><small>{story.kind}</small><h4>{story.title}</h4><p>{story.text}</p><span>依据：{story.source.label} · 馆内索引</span></article>)}</div></section>
    <div className="g113-sake-source-note">史实与技艺依据：{SAKE_DEPTH_SOURCES[0].label}、{SAKE_DEPTH_SOURCES[4].label}，资料已收入馆内索引。神话按故事呈现，不作历史或酒款真实性证据。</div>
  </div>;
}

export function SakeCraftView() {
  return <div className="g113-sake-depth g113-sake-craft">
    <div className="g113-sake-depth-intro"><small>INSIDE THE KURA / 酿造与酒标</small><h2>懂技术，才看得懂名字。</h2><p>清酒是发酵酒，不是蒸馏酒。先认识米、麹、酵母和一座酒藏的工序，再把分类词放回酒标的正确位置。</p></div>
    <section className="g113-sake-depth-section"><div className="g113-sake-section-head"><small>01 / PROCESS</small><h3>从米到酒液的五个工序。</h3></div><div className="g113-sake-craft-flow">{SAKE_CRAFT.map((step) => <article key={step.no}><span>{step.no}</span><h4>{step.title}</h4><p>{step.text}</p></article>)}</div><p className="g113-sake-source-note">工序简述参考{SAKE_DEPTH_SOURCES[1].label}与日本酒类综合研究所；资料已收录馆内索引。</p></section>
    <section className="g113-sake-depth-section"><div className="g113-sake-section-head"><small>02 / THE LANGUAGE OF LABELS</small><h3>分类词不是一条从低到高的阶梯。</h3></div><div className="g113-sake-class-grid">{SAKE_CLASSIFICATIONS.map((item) => <article key={item.term}><span>{item.key}</span><h4>{item.term}</h4><p>{item.explanation}</p></article>)}</div><p className="g113-sake-source-note">名称与标示依据{SAKE_DEPTH_SOURCES[3].label}；具体酒款以原标签和酒藏资料为准。</p></section>
  </div>;
}

export function SakeAppreciationView() {
  return <div className="g113-sake-depth">
    <div className="g113-sake-depth-intro"><small>THE COLLECTOR'S EYE / 鉴赏与收藏</small><h2>从感官词汇，到可信的收藏档案。</h2><p>鉴赏不是比谁喝得多。先学会描述色泽、香气与风味，再理解价格口径、器物和保存证据。</p></div>
    <div className="g113-sake-appreciation-photo"><figure><img src={real('rengetsu-sake-cup-cc0.jpg')} alt="大田垣莲月所作和歌铭酒盏的真实馆藏照片"/><figcaption>真实器物 · 大田垣莲月和歌铭酒盏，檀香山艺术博物馆藏；摄影 Hiart · CC0，来源已收录馆内索引。</figcaption></figure><div><small>A CULTURAL OBJECT</small><h3>酒器，也值得独立收藏。</h3><p>器物有作者、年代、材料和馆藏记录；它的价值不能从酒款价格推出来。我们把“酒”“瓶”“标”“器”拆成不同档案，不混成一件商品。</p></div></div>
    <SakeAppreciationLab/>
    <section className="g113-sake-depth-section"><div className="g113-sake-section-head"><small>01 / FLAVOUR LANGUAGE</small><h3>四个角度，建立自己的鉴赏词典。</h3></div><div className="g113-sake-flavour-grid">{SAKE_TASTING_LENSES.map((lens) => <article key={lens.title}><small>{lens.terms}</small><h4>{lens.title}</h4><p>{lens.text}</p></article>)}</div><p className="g113-sake-source-note">风味术语参考{SAKE_DEPTH_SOURCES[2].label}。描述仅供达到当地法定饮酒年龄的成年人学习，不是饮用建议。</p></section>
    <section className="g113-sake-depth-section"><div className="g113-sake-section-head"><small>02 / PRICE CONTEXT</small><h3>看价格，先看它是哪里的、何时的。</h3><p>以下是 2026-10-02 核对的日本官方渠道公开标价样本，均为 720ml、日元含税。不同国家、版本、包装、税费与日期不能直接比较。</p></div><div className="g113-sake-price-list">{SAKE_PRICE_SAMPLES.map((item) => <article key={item.name}><div><h4>{item.name}</h4><span>{item.style} · {item.volume}</span></div><div className="g113-sake-price-amount">¥ {item.priceJpy.toLocaleString('ja-JP')}<small>日本公开标价 · 含税</small></div><span>{item.source} · 馆内索引</span></article>)}</div><p className="g113-sake-source-note">仅为价格识读，不是实时行情、投资价值或购买建议。本馆无下单、转售或雅钱兑换酒类功能。</p></section>
    <section className="g113-sake-depth-section"><div className="g113-sake-section-head"><small>03 / COLLECTION RECORD</small><h3>把喜欢留下来，先从记录开始。</h3></div><div className="g113-sake-collection-grid">{SAKE_COLLECTION_CHECKLIST.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h4>{item.title}</h4><p>{item.text}</p></article>)}</div><p className="g113-sake-source-note">保存环境依据{SAKE_DEPTH_SOURCES[5].label}；实际品相、价值和保管方案仍须实物、来源与专业审校。</p></section>
    <section className="g113-sake-depth-section"><div className="g113-sake-section-head"><small>04 / OBJECT ARCHIVE</small><h3>收藏的对象，不止是一瓶酒。</h3></div><div className="g113-sake-mini-archive">{FOCUS_HALLS.sake.objects.map((object) => <article key={object.name}><span>{object.kind}</span><h4>{object.name}</h4><p>{object.lens}</p></article>)}</div></section>
  </div>;
}
