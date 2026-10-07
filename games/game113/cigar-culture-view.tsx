import React, { useState } from 'react';
import { guidePhoto } from './guide-art.js';
import { CIGAR_BRAND_FILES, CIGAR_CULTURE_LENSES, CIGAR_CULTURE_TIMELINE } from './cigar-culture.js';

export function CigarCultureView({ onDiscuss }: { onDiscuss: () => void }) {
  const [scene, setScene] = useState(0);
  const [lens, setLens] = useState(0);
  const [brand, setBrand] = useState(0);
  const [chapter, setChapter] = useState<'story' | 'study' | 'brands'>('story');
  const moment = CIGAR_CULTURE_TIMELINE[scene];
  const viewpoint = CIGAR_CULTURE_LENSES[lens];
  const file = CIGAR_BRAND_FILES[brand];
  const featured = chapter === 'study' ? viewpoint : moment;
  const photo = guidePhoto(featured.assetId);

  return <section className="g113-cigar-culture" role="tabpanel" aria-label="雪茄文化漫游">
    <header className="g113-cigar-culture-head"><small>UNROLL THE CULTURE / 文化漫游</small><h2>先听见工坊，再读懂名字。</h2><p>叶伯只展开一页。你选一条线索，故事才往前走。这里研究农业、劳动与纸本文化，不提供烟草使用、购买或价值建议。</p></header>
    <div className="g113-cigar-culture-tabs" role="tablist" aria-label="文化漫游章节">
      <button type="button" role="tab" aria-selected={chapter === 'story'} className={chapter === 'story' ? 'active' : ''} onClick={() => setChapter('story')}><span>01</span>工坊有声音</button>
      <button type="button" role="tab" aria-selected={chapter === 'study'} className={chapter === 'study' ? 'active' : ''} onClick={() => setChapter('study')}><span>02</span>换一双眼睛</button>
      <button type="button" role="tab" aria-selected={chapter === 'brands'} className={chapter === 'brands' ? 'active' : ''} onClick={() => setChapter('brands')}><span>03</span>名字的来历</button>
    </div>

    {chapter !== 'brands' && <div className="g113-cigar-culture-scene">
      <figure className="g113-cigar-culture-image">{photo ? <img src={photo.src} alt={featured.imageNote} loading="lazy"/> : <div className="g113-guide-photo-pending">真实影像待补</div>}<figcaption>{featured.imageNote}<small>{photo ? `${photo.author} · ${photo.license}` : '影像待补'}</small></figcaption></figure>
      <div className="g113-cigar-culture-text">
        {chapter === 'story' ? <><small>叶伯的时间长卷 / {moment.year}</small><h3>{moment.title}</h3><span className="g113-cigar-culture-thread">线索 · {moment.thread}</span><p>{moment.story}</p><div className="g113-cigar-culture-question"><b>再问一层</b>{moment.ask}</div><div className="g113-cigar-culture-step"><span>{scene + 1} / {CIGAR_CULTURE_TIMELINE.length}</span><button type="button" onClick={() => setScene((scene + 1) % CIGAR_CULTURE_TIMELINE.length)}>{scene + 1 === CIGAR_CULTURE_TIMELINE.length ? '回到第一页 ↺' : '听下一段 →'}</button></div></> : <><small>不同的人，读出不同的史料</small><h3>{viewpoint.role}</h3><span className="g113-cigar-culture-thread">研究视角 · {viewpoint.mark}</span><p className="g113-cigar-culture-ask">“{viewpoint.question}”</p><div className="g113-cigar-culture-question"><b>怎样求证</b>{viewpoint.method}</div><div className="g113-cigar-culture-step"><span>{lens + 1} / {CIGAR_CULTURE_LENSES.length}</span><button type="button" onClick={() => setLens((lens + 1) % CIGAR_CULTURE_LENSES.length)}>换一双眼睛 →</button></div></>}
      </div>
    </div>}

    {chapter === 'story' && <div className="g113-cigar-culture-reel" aria-label="选择时间线索">{CIGAR_CULTURE_TIMELINE.map((entry, index) => <button key={entry.year} type="button" className={scene === index ? 'active' : ''} aria-pressed={scene === index} onClick={() => setScene(index)}><small>{entry.year}</small><span>{entry.thread}</span></button>)}</div>}
    {chapter === 'study' && <div className="g113-cigar-culture-reel g113-cigar-culture-reel--lenses" aria-label="选择研究视角">{CIGAR_CULTURE_LENSES.map((entry, index) => <button key={entry.role} type="button" className={lens === index ? 'active' : ''} aria-pressed={lens === index} onClick={() => setLens(index)}><small>{entry.mark}</small><span>{entry.role}</span></button>)}</div>}
    {chapter === 'brands' && <div className="g113-cigar-brand-room"><div className="g113-cigar-brand-intro"><small>BRAND AS CULTURAL INDEX</small><h3>先读来历，不排高下。</h3><p>古巴工坊史先收八份由品牌方沿革核对的名字档案；并不代表全球雪茄文化的全部。它们不是“必买清单”，不代表品质、价格或受众阶层；对应品牌的授权实物影像仍待补。</p><div className="g113-cigar-brand-list" aria-label="品牌名字档案">{CIGAR_BRAND_FILES.map((entry, index) => <button type="button" key={entry.name} className={brand === index ? 'active' : ''} aria-pressed={brand === index} onClick={() => setBrand(index)}><span>{String(index + 1).padStart(2, '0')}</span>{entry.name}<small>→</small></button>)}</div></div><article className="g113-cigar-brand-file" aria-live="polite"><small>名字档案 {String(brand + 1).padStart(2, '0')} / {CIGAR_BRAND_FILES.length}</small><h4>{file.name}</h4><span>{file.founded} · {file.signature}</span><p>{file.note}</p><div><b>下一次查证</b><p>{file.verify}</p></div><footer>对应品牌实物照片待授权；本页不以通用图冒充品牌藏品。</footer></article></div>}
    <div className="g113-cigar-culture-after"><p>故事读到这里，下一步不是猜价格，而是带着一条可以核对的问题去见同好。</p><button type="button" onClick={onDiscuss}>带一个好问题去同好议题 →</button></div>
    <details className="g113-cigar-culture-sources"><summary>这一页的资料出处与影像边界</summary><p>本地中文为原创编辑摘要。时间卷依据 Habanos 官方工艺与品牌史；研究视角另参考世界卫生组织。影像若不是所述品牌或事件现场，已逐页明示。</p><p>当前线索：<a href={chapter === 'brands' ? file.source : featured.source} target="_blank" rel="noreferrer">查看原始资料 ↗</a>（仅核对出处时离开应用）</p></details>
  </section>;
}
