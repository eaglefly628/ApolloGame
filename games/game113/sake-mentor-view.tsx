import React, { useEffect, useState } from 'react';
import { guidePhoto } from './guide-art.js';
import { sakeMentorChapter } from './sake-mentor.js';
import { sakeMentorPanel } from './sake-mentor-panels.js';
import { sakeScrollTier } from './sake-scroll.js';
import { cigarMentorChapter } from './cigar-mentor.js';
import { cigarMentorPanel } from './cigar-mentor-panels.js';
import { cigarScrollTier } from './cigar-scroll.js';
import { cigarHotspots } from './cigar-hotspots.js';

type Props = {
  topic?: 'sake' | 'cigar';
  chapterId: string;
  guideName: string;
  guideMark: string;
  passed: boolean;
  level: number;
  isLast: boolean;
  onPass: () => void;
  onNext: () => void;
  onArchive: () => void;
};

export function SakeMentorView({ topic = 'sake', chapterId, guideName, guideMark, passed, level, isLast, onPass, onNext, onArchive }: Props) {
  const chapter = topic === 'cigar' ? cigarMentorChapter(chapterId) : sakeMentorChapter(chapterId);
  const [mode, setMode] = useState<'lesson' | 'exam' | 'passed'>('lesson');
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [photoRatio, setPhotoRatio] = useState<{ src: string; ratio: number } | null>(null);
  useEffect(() => {
    return () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, [chapterId, step, mode]);
  if (!chapter) return null;

  const observation = chapter.observations[step];
  const question = chapter.exam[questionIndex];
  const panel = (topic === 'cigar' ? cigarMentorPanel : sakeMentorPanel)(chapterId, mode === 'lesson' ? step : mode === 'exam' ? question.imageStep : 2);
  const tier = topic === 'cigar' ? cigarScrollTier(level + 1) : sakeScrollTier(level + 1);
  const photo = panel ? guidePhoto(panel.assetId) : undefined;
  const imageRatio = photoRatio && photo && photoRatio.src === photo.src ? photoRatio.ratio : 1;
  const extraPhoto = panel?.extraAssetId ? guidePhoto(panel.extraAssetId) : undefined;
  const hotspots = topic === 'cigar' && mode === 'lesson' ? cigarHotspots(chapterId, step) : [];
  const spot = selectedSpot === null ? undefined : hotspots[selectedSpot];
  const correct = answer === question.correct;
  const chooseSpot = (index: number) => { setSelectedSpot(index); setRevealed(true); };
  const speak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(`${guideName}说：${observation.master} ${spot ? `${spot.title}。${spot.seen} ${spot.meaning} ${spot.question}` : observation.lesson}`);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.88;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };
  const advanceObservation = () => {
    if (step < chapter.observations.length - 1) {
      setStep(step + 1);
      setRevealed(false);
      setSelectedSpot(null);
      setSpeaking(false);
    } else {
      setMode('exam');
    }
  };
  const advanceExam = () => {
    if (!correct) return;
    if (questionIndex < chapter.exam.length - 1) {
      setQuestionIndex(questionIndex + 1);
      setAnswer(null);
    } else {
      if (!passed) onPass();
      setMode('passed');
    }
  };

  return <div className="g113-mentor">
    <div className="g113-mentor-progress" aria-label="本章进度">
      <span>师傅带看</span><div>{chapter.observations.map((item, index) => <i key={item.title} className={mode !== 'lesson' || index <= step ? 'active' : ''} aria-label={`观察 ${index + 1}${mode !== 'lesson' || index < step ? '已完成' : ''}`}/>)}<i className={mode !== 'lesson' ? 'active' : ''} aria-label="出门小考"/></div><span>{mode === 'lesson' ? `观察 ${step + 1} / ${chapter.observations.length}` : mode === 'exam' ? `小考 ${questionIndex + 1} / ${chapter.exam.length}` : '本章已通过'}</span>
    </div>
    <div className="g113-mentor-workbench">
      <figure className={`g113-mentor-photo${hotspots.length ? ' g113-mentor-photo--interactive' : ''}`}>
        <div className="g113-mentor-photo-stage">
          {hotspots.length ? <div className="g113-mentor-image-frame"><div className="g113-mentor-image-space" style={{ width: `min(100%, calc(var(--mentor-image-height) * ${imageRatio}))` }}>{photo ? <img src={photo.src} alt={panel!.alt} loading="eager" onLoad={(event) => setPhotoRatio({ src: photo.src, ratio: event.currentTarget.naturalWidth / event.currentTarget.naturalHeight })}/> : <div className="g113-guide-photo-pending"><span aria-hidden="true">✦</span><strong>真实物件影像待补</strong></div>}{photo && hotspots.map((item, index) => <button type="button" key={`${chapterId}-${step}-${item.title}`} className={`g113-mentor-hotspot${selectedSpot === index ? ' active' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }} aria-label={`观察热点 ${index + 1}：${item.title}`} aria-pressed={selectedSpot === index} onClick={() => chooseSpot(index)}><span>{String(index + 1).padStart(2, '0')}</span></button>)}</div></div> : photo ? <img src={photo.src} alt={panel!.alt} loading="eager"/> : <div className="g113-guide-photo-pending"><span aria-hidden="true">✦</span><strong>真实物件影像待补</strong></div>}
          <figcaption><small>{photo ? hotspots.length ? '真实资料影像 · 点击图上光点' : '真实资料影像 · 看图辨物' : '影像待补'}</small><strong>{panel?.caption ?? '先观察，后断言'}</strong></figcaption>
        </div>
        {hotspots.length > 0 && <div className="g113-mentor-hotspot-index" aria-label="照片线索列表"><span>点图探索</span>{hotspots.map((item, index) => <button type="button" key={item.title} aria-pressed={selectedSpot === index} className={selectedSpot === index ? 'active' : ''} onClick={() => chooseSpot(index)}>{String(index + 1).padStart(2, '0')} · {item.title}</button>)}</div>}
      </figure>
      <div className="g113-mentor-desk" aria-live="polite">
        {mode === 'lesson' && <>
          <small className="g113-mentor-kicker">第 {step + 1} 处 / {chapter.threshold}</small>
          <h4>{observation.title}</h4>
          <p className="g113-mentor-look">{observation.look}</p>
          <blockquote><span aria-hidden="true">{guideMark}</span><div><small>{guideName} · 师傅的话</small>{observation.master}</div></blockquote>
          {topic === 'cigar' && spot && <div className="g113-mentor-spot-card" aria-live="polite"><small>影像线索 {String(selectedSpot! + 1).padStart(2, '0')} / {spot.title}</small><p><b>眼前所见</b>{spot.seen}</p><p><b>慢慢读懂</b>{spot.meaning}</p><p className="g113-mentor-spot-boundary"><b>仍需追问</b>{spot.question}</p></div>}
          {!revealed ? topic === 'cigar' && photo ? <p className="g113-mentor-tap-prompt">先点照片上的一处光点，或用下方的线索按钮。你看到哪里，故事就从哪里开始。</p> : <button type="button" className="g113-mentor-action" onClick={() => setRevealed(true)}>{topic === 'cigar' ? '影像待补 · 先读文字线索 →' : '我看见了 · 听师傅拆解 →'}</button> : <>
            <div className="g113-mentor-discovery"><small>这一处要记住</small><p>{observation.lesson}</p><span>{observation.caution}</span></div>
            {topic === 'cigar' && typeof window !== 'undefined' && 'speechSynthesis' in window && <button type="button" className="g113-mentor-voice" onClick={speak}>{speaking ? '停止朗读 ◼' : '用设备语音听这一处 ◌'}</button>}
            {panel && <details className="g113-mentor-depth" key={`${chapterId}-${step}`}><summary>{guideName}的进阶追问 · {panel.deepTitle} ↓</summary><div><p>{panel.deep[0]}</p><p>{panel.deep[1]}</p>{extraPhoto && <figure><img src={extraPhoto.src} alt={panel.extraAlt ?? '补充资料实拍'} loading="lazy"/><figcaption>{panel.extraCaption} · {extraPhoto.author}</figcaption></figure>}</div></details>}
            <button type="button" className="g113-mentor-action" onClick={advanceObservation}>{step < chapter.observations.length - 1 ? '跟师傅看下一处 →' : '三处看完 · 参加出门小考 →'}</button>
          </>}
        </>}
        {mode === 'exam' && <>
          <small className="g113-mentor-kicker">出门小考 · 第 {questionIndex + 1} 问 / {chapter.exam.length}</small>
          <h4>{question.prompt}</h4>
          <p className="g113-mentor-exam-note">答对两问才开启下一章；答错可以听提示再试，不扣阅历。</p>
          <div className="g113-mentor-options">{question.options.map((option, index) => <button type="button" key={option} disabled={answer !== null} className={answer === index ? correct ? 'correct' : 'incorrect' : ''} onClick={() => setAnswer(index)}><span>{String(index + 1).padStart(2, '0')}</span>{option}</button>)}</div>
          {answer !== null && <div className={`g113-mentor-feedback ${correct ? 'correct' : 'incorrect'}`} role="status"><b>{correct ? '这一问，过。' : '先别急，回头看看线索。'}</b><p>{correct ? question.answer : question.hint}</p>{correct ? <button type="button" onClick={advanceExam}>{questionIndex < chapter.exam.length - 1 ? '继续第二问 →' : '两问通过 · 收下章印 →'}</button> : <button type="button" onClick={() => setAnswer(null)}>重试这一问 ↺</button>}</div>}
        </>}
        {mode === 'passed' && <div className="g113-mentor-passed"><small>出门小考 · 两问通过</small><h4>师傅点了点头。</h4><p>“知道一件事，也知道它不能证明什么。这才算真正入门。”</p></div>}
      </div>
    </div>
    <div className="g113-mentor-footer"><details><summary>师傅的证据簿 · 资料与影像出处</summary><p>{chapter.source}。馆内保存的是中文原创摘要；影像原档案逐张登记在资源索引。</p>{photo && <p>本页实拍：{photo.author} · {photo.license}；照片只对应上方注明的对象。</p>}</details>{passed && <div className="g113-guide-achievement"><span>小考已通过 · 章印已收</span><b>{tier.achievement}</b><small>阅历 {level + 1} / 5 · 下一章及资料卷已开启</small></div>}{passed && <div className="g113-mentor-next"><button type="button" onClick={onArchive}>打开本章资料卷 ↗</button><button type="button" onClick={isLast ? onArchive : onNext}>{isLast ? '五章成卷 · 继续深读 →' : '跟师傅进入下一章 →'}</button></div>}</div>
  </div>;
}
