import React, { useEffect, useState } from 'react';
import type { Hobby } from './data.js';
import { guideJourneyFor } from './guide-journeys.js';
import { guideArtFor, guidePhoto, type GuideArt } from './guide-art.js';
import { SAKE_SCROLL_TIERS, sakeScrollTier } from './sake-scroll.js';
import { SakeMentorView } from './sake-mentor-view.js';
import { CIGAR_SCROLL_TIERS, cigarScrollTier } from './cigar-scroll.js';

function GuidePlate({ art, chapter }: { art: GuideArt | undefined; chapter: string }) {
  const photo = art ? guidePhoto(art.assetId) : undefined;
  const detailPhoto = art?.detailAssetId ? guidePhoto(art.detailAssetId) : undefined;
  const steps = art?.steps ?? [
    { title: '看见', detail: '观察物件' },
    { title: '追问', detail: '留下疑问' },
    { title: '核对', detail: '寻找资料' },
  ];
  return <div className={`g113-guide-plate${art?.variant === 'route' ? ' g113-guide-plate-route' : ''}`} aria-label={`${chapter}图文线索`}>
    <figure className="g113-guide-photo">
      <div className="g113-guide-photo-frame">
        {photo ? <img src={photo.src} alt={art!.alt} loading="eager"/> : <div className="g113-guide-photo-pending"><span aria-hidden="true">✦</span><strong>真实物件影像待补</strong><small>已核实来源的实拍会在这里出现</small></div>}
        <span className="g113-guide-photo-stamp">{photo ? '真实资料照片 · 非本章酒款实拍' : '资料图占位'}</span>
      </div>
      <figcaption><strong>{art?.photoTitle ?? '这一页先从观察开始'}</strong><span>{art?.photoNote ?? '此馆图片尚待取得与核验，不以示意图冒充实物。'}</span>{photo && <span className="g113-guide-credit" title={photo.sourceUrl}>摄影 {photo.author} · {photo.license} · 来源已入馆内索引</span>}</figcaption>
    </figure>
    <div className="g113-guide-diagram">
      <small>FIELD NOTE / 线索图解</small>
      <h4>{art?.diagramTitle ?? '一条温和的探索路径'}</h4>
      <ol>{steps.map((step, index) => <li key={`${step.title}-${index}`}><span className="g113-guide-diagram-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><small>{step.detail}</small></div></li>)}</ol>
      <p>{art?.diagramHint ?? '编辑绘制的导览示意；具体物件资料仍需核验。'}</p>
    </div>
    {detailPhoto && <div className="g113-guide-object-note"><img src={detailPhoto.src} alt="东京食与农业博物馆陈列的酒瓶" loading="lazy"/><div><small>馆藏实物旁证</small><p>{art?.detailTitle}</p><span className="g113-guide-credit" title={detailPhoto.sourceUrl}>摄影 {detailPhoto.author} · {detailPhoto.license}</span></div></div>}
  </div>;
}

export type GuideProgress = { scene: number; completed: number; answers: (number | null)[] };
// v2 sake completions were awarded for choosing any branch; the new exam has a fresh v3 record.
const progressKey = (id: string) => `game113-guide-${id === 'sake' || id === 'cigar' ? 'v3' : 'v2'}-${id}`;

export function readGuideProgress(id: string, count: number): GuideProgress {
  const empty = { scene: 0, completed: 0, answers: Array<number | null>(count).fill(null) };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = JSON.parse(window.localStorage.getItem(progressKey(id)) || 'null');
    if (!raw || !Number.isInteger(raw.completed) || raw.completed < 0 || raw.completed > count || !Array.isArray(raw.answers)) return empty;
    const answers = Array.from({ length: count }, (_, index) => raw.answers[index] === 0 || raw.answers[index] === 1 ? raw.answers[index] : null);
    const completed = id === 'sake' || id === 'cigar' ? raw.completed : Math.min(raw.completed, answers.findIndex((answer) => answer === null) < 0 ? count : answers.findIndex((answer) => answer === null));
    const scene = Number.isInteger(raw.scene) && raw.scene >= 0 && raw.scene < count ? Math.min(raw.scene, completed) : Math.min(completed, count - 1);
    return { scene, completed, answers };
  } catch { return empty; }
}

export function HobbyGuideView({ hobby, onExplore, onMilestone }: { hobby: Hobby; onExplore: (tab: string) => void; onMilestone?: (completed: number) => void }) {
  const journey = guideJourneyFor(hobby);
  const [progress, setProgress] = useState<GuideProgress>(() => readGuideProgress(hobby.id, journey.scenes.length));
  const [deeperOpen, setDeeperOpen] = useState(false);
  const scene = journey.scenes[progress.scene];
  const art = guideArtFor(hobby.id, scene.id);
  const selected = progress.answers[progress.scene];
  const completed = progress.completed;
  const chapterClaimed = completed > progress.scene;
  const mentorLed = hobby.id === 'sake' || hobby.id === 'cigar';
  const scrollName = hobby.id === 'cigar' ? cigarScrollTier(completed).name : sakeScrollTier(completed).name;
  const scrollCount = hobby.id === 'cigar' ? CIGAR_SCROLL_TIERS.length - 1 : SAKE_SCROLL_TIERS.length - 1;

  useEffect(() => {
    try { window.localStorage.setItem(progressKey(hobby.id), JSON.stringify(progress)); } catch { /* Private mode: the guide still works in memory. */ }
  }, [hobby.id, progress]);

  const choose = (answer: number) => setProgress((old) => ({ ...old, answers: old.answers.map((value, index) => index === old.scene ? answer : value) }));
  const goTo = (index: number) => { if (index > completed) return; setProgress((old) => ({ ...old, scene: index })); setDeeperOpen(false); };
  const next = () => goTo(Math.min(progress.scene + 1, journey.scenes.length - 1));
  const claim = () => {
    if (selected === null || chapterClaimed) return;
    const nextCompleted = progress.scene + 1;
    setProgress((old) => ({ ...old, completed: nextCompleted }));
    onMilestone?.(nextCompleted);
  };
  const passMentorExam = () => {
    if (chapterClaimed) return;
    const nextCompleted = progress.scene + 1;
    setProgress((old) => ({ ...old, completed: nextCompleted }));
    onMilestone?.(nextCompleted);
  };

  return <section className="g113-guide" aria-label={`${hobby.name}${mentorLed ? '师傅带路' : '精灵导览'}`}>
    <div className="g113-guide-heading"><div><small>GUIDED DISCOVERY / {mentorLed ? '师傅带路' : '精灵带路'}</small><h2>{mentorLed ? '跟着师傅，一道一道过门槛。' : '一页一页，展开自己的长卷。'}</h2><p>{journey.invitation}</p></div><span>{mentorLed ? `阅历 ${completed} / ${scrollCount} · ${scrollName}` : `${completed} / ${journey.scenes.length} 枚线索`}</span></div>
    <div className="g113-guide-layout">
      <aside className="g113-guide-rail" aria-label="导览章节">
        <div className="g113-guide-spirit"><div className="g113-guide-mark" aria-hidden="true"><span>{journey.guideMark}</span></div><div><small>{journey.guideRole}</small><strong>{journey.guideName}</strong><p>“我只带路，不替你下结论。”</p></div></div>
        <ol>{journey.scenes.map((chapter, index) => <li key={chapter.id}>{index <= completed ? <button type="button" className={index === progress.scene ? 'active' : ''} aria-current={index === progress.scene ? 'step' : undefined} onClick={() => goTo(index)}><span>{String(index + 1).padStart(2, '0')}</span><b>{chapter.chapter}</b><em>{index < completed ? '已点亮' : '正在展开'}</em></button> : <div className="g113-guide-sealed" aria-label={`第 ${index + 1} 章尚未解锁`}><span>{String(index + 1).padStart(2, '0')}</span><b>尚未展开</b><em>{mentorLed ? '通过前章小考后开启' : '收下前一枚线索后开启'}</em></div>}</li>)}</ol>
        <p className="g113-guide-rail-note">{mentorLed ? '每章跟看三处、通过两问，才取得章印。答错可重试；阅历只记录所学，不靠付费解锁。' : '阅历只记录你走过的知识章节，不衡量品味高低，也不需要购买、计时或比输赢。'}</p>
      </aside>
      <article className="g113-guide-stage" key={scene.id}>
        <div className="g113-guide-stage-top"><small>第 {progress.scene + 1} 章 / {journey.scenes.length}</small><span>{scene.place}</span></div>
        <h3>{scene.chapter}</h3><div className="g113-guide-dialogue"><span aria-hidden="true">{journey.guideMark}</span><p><b>{journey.guideName}</b>{scene.opening}</p></div>
        {mentorLed ? <SakeMentorView key={scene.id} topic={hobby.id === 'cigar' ? 'cigar' : 'sake'} chapterId={scene.id} guideName={journey.guideName} guideMark={journey.guideMark} passed={chapterClaimed} level={progress.scene} isLast={progress.scene === journey.scenes.length - 1} onPass={passMentorExam} onNext={next} onArchive={() => onExplore(scene.archive.tab)}/> : <>
        <GuidePlate art={art} chapter={scene.chapter}/>
        <div className="g113-guide-question"><small>你的下一步</small><h4>{scene.question}</h4><div className="g113-guide-choices">{scene.choices.map((choice, index) => <button type="button" key={choice.label} className={selected === index ? 'chosen' : ''} aria-pressed={selected === index} onClick={() => { choose(index); setDeeperOpen(false); }}><span>0{index + 1}</span>{choice.label}<span aria-hidden="true">→</span></button>)}</div></div>
        {selected !== null && <div className="g113-guide-reveal" aria-live="polite"><small>线索已发现 · {scene.choices[selected].label}</small><strong>{scene.discovery}</strong><details className="g113-guide-insight"><summary>细看这条线索 ↓</summary><p>{scene.choices[selected].insight}</p></details><div className="g113-guide-followup"><button type="button" onClick={() => setDeeperOpen((open) => !open)} aria-expanded={deeperOpen}>{deeperOpen ? '收起追问 ↑' : '再往深处追问 ↓'}</button>{chapterClaimed && <button type="button" onClick={() => onExplore(scene.archive.tab)}>{scene.archive.label} ↗</button>}</div>{deeperOpen && <div className="g113-guide-deep"><b>{journey.guideName}的追问</b><p>{scene.deeper}</p><small>{scene.evidence}</small></div>}{chapterClaimed && <div className="g113-guide-achievement"><span>章印已收</span><b>新线索已入册</b><small>阅历 {completed} / {journey.scenes.length} · 新章节和资料卷已开启</small></div>}</div>}
        <div className="g113-guide-bottom"><span>可随时改变观察方向；这里没有答错。</span>{selected !== null && (!chapterClaimed ? <button type="button" onClick={claim}>收下这枚线索 · 点亮下一章 →</button> : progress.scene < journey.scenes.length - 1 ? <button type="button" onClick={next}>展开下一章 →</button> : <button type="button" onClick={() => onExplore(scene.archive.tab)}>{journey.scenes.length} 章已成卷 · 继续探索 →</button>)}</div>
        </>}
      </article>
    </div>
  </section>;
}
