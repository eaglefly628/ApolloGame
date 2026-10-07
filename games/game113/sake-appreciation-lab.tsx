import React, { useState } from 'react';
import { SAKE_AWARD_RESEARCH, SAKE_AWARD_SOURCE, SAKE_HUNDRED_METHOD } from './sake-awards.js';

const comparisons = [
  {
    id: 'rice', title: '只换酒米，能读出什么？', left: '九平次 · 山田锦 EAU DU DÉSIR', right: '九平次 · 雄町 SAUVAGE',
    clue: '酒藏称这组作品采用相同精米和酿造方式，主要变化是山田锦与雄町。',
    prompt: '第一步，不是猜哪瓶更贵，而是找出被控制的变量。',
    options: ['先比较酒米', '先按品牌排名'], answer: 0,
    reveal: '这是一组适合认识“米种表达”的对照：工艺条件尽量相近，才更有理由讨论原料差别。即便如此，年份与保存仍需核对，不能把文案读成自己已经品饮过的结论。',
    collection: '建档：两款分别记录米种、年份、容量、标签与保存条件。',
    source: '九平次官方 · Désir et Sauvage；馆内名酒深读与资料索引。',
  },
  {
    id: 'polish', title: '507 与 807，不是一道大小题', left: '风之森 · 露叶风 507', right: '风之森 · 露叶风 807',
    clue: '两款都以露叶风为主题，精米设置分别为 50% 与 80%。',
    prompt: '如果想观察“磨法”，先把什么留在同一栏？',
    options: ['先记录共同米种', '先宣布 50% 更高级'], answer: 0,
    reveal: '共同米种让比较更有方向，但其他批次与工艺条件仍要查。酒藏把 807 的较高精米步合视为保留复杂滋味的设计，不是质量差的证明。',
    collection: '建档：完整代码、米种、年度、是否生酒和保存提示；不要只截取“50／80”。',
    source: '油长酒造官方 · 风之森产品；馆内名酒深读与资料索引。',
  },
  {
    id: 'state', title: '热门生酒，可以放多久？', left: '新政 · No.6 X-type', right: '新政 · Colors Ash',
    clue: '酒藏把 No.6 作为生酒线，把 Colors 作为火入系列；所引产品资料是 2021 年度档案。',
    prompt: '收藏时，哪个信息必须早于“人气”？',
    options: ['核对火入与冷链', '先看讨论热度'], answer: 0,
    reveal: '生酒与火入酒的保存逻辑不能混写。No.6 的官方资料提示持续冷藏并尽早饮用；“有名”并不意味着适合长期囤藏。',
    collection: '建档：BY 年度、出荷月、火入状态、冷链证据；旧年度资料不能冒充当季规格。',
    source: '新政官方 · No.6 / Colors 2021 档案；馆内名酒深读与资料索引。',
  },
  {
    id: 'cloud', title: '“浊”，是瑕疵还是风格？', left: 'KANPAI · KUMO CLOUDY', right: 'KANPAI · KAZE WIND',
    clue: '同一伦敦酒藏，一款刻意保留细米沉淀，一款是纯米吟酿。',
    prompt: '面对外观差异，你会怎样开始？',
    options: ['先查工艺与产品说明', '只凭浑浊判定坏酒'], answer: 0,
    reveal: 'KUMO 的浊度是酒藏明确设计的风格线索，不自动等于缺陷。对比时还要看到两款的原料、容量和保存提示可能不同。',
    collection: '建档：酒款名称、是否浊酒、具体瓶装容量与当年标签；不拿英国 375ml 与日本 720ml 直接比价。',
    source: 'KANPAI 官方 · KUMO / KAZE；馆内世界酒藏与资料索引。',
  },
] as const;

export function SakeAppreciationLab() {
  const [selected, setSelected] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const item = comparisons[selected];
  return <section className="g113-sake-lab" aria-label="高级风格与收藏练习">
    <div className="g113-sake-section-head"><small>THE CONNOISSEUR'S TABLE / 风格辨识</small><h3>杉翁陪你读四组作品，而不是背一张等级表。</h3><p>不用真实品饮也能练习：先控制比较变量、拆开酒藏陈述与个人感受，再把收藏证据留完整。以下是依据酒藏资料的编辑分析，不是假装亲自试饮的评分。</p></div>
    <div className="g113-sake-lab-tabs" role="tablist" aria-label="选择比较题">{comparisons.map((caseItem, index) => <button key={caseItem.id} role="tab" aria-selected={selected === index} className={selected === index ? 'active' : ''} onClick={() => { setSelected(index); setAnswer(null); }}>{String(index + 1).padStart(2, '0')} · {caseItem.title}</button>)}</div>
    <div className="g113-sake-lab-card"><small>杉翁的观察桌 / {String(selected + 1).padStart(2, '0')}</small><h4>{item.title}</h4><div className="g113-sake-lab-pair"><span>{item.left}</span><i>对照</i><span>{item.right}</span></div><p>{item.clue}</p><strong>{item.prompt}</strong><div className="g113-sake-lab-choices">{item.options.map((option, index) => <button key={option} className={answer === index ? 'active' : ''} aria-pressed={answer === index} onClick={() => setAnswer(index)}>{option}</button>)}</div>{answer !== null && <div className="g113-sake-lab-result" aria-live="polite"><small>{answer === item.answer ? '好线索' : '杉翁的提醒'}</small><p>{item.reveal}</p><b>{item.collection}</b><span>依据：{item.source}</span></div>}</div>
  </section>;
}

export function SakeHundredDesk() {
  const [selected, setSelected] = useState(0);
  const item = SAKE_AWARD_RESEARCH[selected];
  return <section className="g113-sake-hundred" aria-label="百酒深读研究计划"><div className="g113-sake-section-head"><small>THE HUNDRED FILES / 百酒深读计划</small><h3>{SAKE_HUNDRED_METHOD.title}</h3><p>{SAKE_HUNDRED_METHOD.note}</p></div><div className="g113-sake-hundred-status"><b>已核奖项 {SAKE_AWARD_RESEARCH.length} 款 / 目标 100 款</b><span>{SAKE_HUNDRED_METHOD.progress}</span></div><div className="g113-sake-hundred-layout"><div className="g113-sake-hundred-list" aria-label="首批官方获奖样本">{SAKE_AWARD_RESEARCH.map((award, index) => <button key={award.code} className={selected === index ? 'active' : ''} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, '0')}</span><b>{award.name}</b><small>{award.award}</small></button>)}</div><article className="g113-sake-hundred-file"><small>IWC 2026 · {item.award} · 参赛编号 {item.code}</small><h4>{item.name}</h4><p>{item.producer}</p><div><b>这一款该如何深读？</b><p>{item.lens}</p></div>{'profile' in item && <div className="g113-sake-hundred-profile"><b>{item.profile.distinction} · 首份深读样本</b><p>{item.profile.evidence}</p><p>{item.profile.declaredStyle}</p><p>{item.profile.collectorQuestion}</p><small>产品依据：{item.profile.productSource}；发布页已收入馆内索引。奖项与酒藏产品说明是两份证据，尚未证明参赛批次与发布批次相同。</small></div>}<div><b>待完成的证据</b><ul>{SAKE_HUNDRED_METHOD.requiredFields.slice(1).map((field) => <li key={field}>{field}</li>)}</ul></div><span>奖项来源：{SAKE_AWARD_SOURCE.label} · {SAKE_AWARD_SOURCE.checkedAt} 核对；原始网址留在馆内资料索引。</span></article></div><p className="g113-sake-source-note">这里显示的是按 IWC 2026 不同组别选出的首批研究样本，不是“世界第 1—10 名”。没有酒款原始资料的风味、价格、保存建议与瓶身图片保持待核，不靠想象补齐。</p></section>;
}
