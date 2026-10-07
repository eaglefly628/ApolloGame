import React, { useState } from 'react';
import { SAKE_EVIDENCE_FILES } from './sake-evidence-files.js';

export function SakeEvidenceFilesView() {
  const [selectedId, setSelectedId] = useState<string>(SAKE_EVIDENCE_FILES[0].id);
  const selected = SAKE_EVIDENCE_FILES.find((item) => item.id === selectedId) ?? SAKE_EVIDENCE_FILES[0];
  return <section className="g113-sake-evidence-files" aria-labelledby="g113-sake-evidence-title">
    <header><small>THE BOTTLE FILES / 逐瓶深读</small><h3 id="g113-sake-evidence-title">一瓶酒，三层证据。</h3><p>先辨赛事结果，再读具体作品，最后标出尚不能证明的事。目前五份样本有独立来源；完整公开名单仍可在下方检索。</p></header>
    <div className="g113-sake-evidence-body"><div className="g113-sake-evidence-index" aria-label="选择酒款深读">{SAKE_EVIDENCE_FILES.map((item, index) => <button key={item.id} type="button" className={selected.id === item.id ? 'active' : ''} aria-pressed={selected.id === item.id} onClick={() => setSelectedId(item.id)}><span>{String(index + 1).padStart(2, '0')} / {item.evidenceKind}</span><b>{item.name}</b><small>{item.maker}</small></button>)}</div><article className="g113-sake-evidence-reader" key={selected.id}><div className="g113-sake-evidence-object" role="img" aria-label={`${selected.name}真实瓶身图片待授权`}><span>REAL OBJECT / 待补实拍</span><b>{selected.name.slice(0, 2)}</b><small>不以生成图冒充实物</small></div><div className="g113-sake-evidence-copy"><small>{selected.evidenceKind}</small><h4>{selected.name}</h4><p className="g113-sake-evidence-result">{selected.result}</p><dl><div><dt>具体作品</dt><dd>{selected.reading}</dd></div><div><dt>评价与结果</dt><dd>{selected.evaluation}</dd></div><div><dt>还须辨清</dt><dd>{selected.nuance}</dd></div></dl><p className="g113-sake-evidence-source">馆内原始资料：{selected.evidenceKind}；网址收录在资料索引与下载研究包中。</p></div></article></div>
  </section>;
}
