import React, { useState } from 'react';
import official from './sake-competition-2026.json';

const RESULT_LABELS: Record<string, string> = {
  GOLD: '金奖', SILVER: '银奖', BRONZE: '铜奖', FINALIST: '决审入围名单',
};
const RESULT_ORDER: Record<string, number> = { GOLD: 0, SILVER: 1, BRONZE: 2, FINALIST: 3 };
const LABEL_CLUES = ['山田錦', '雄町', '愛山', '美山錦', '五百万石', '生酛', '山廃', '水酛', '無濾過', '原酒', '斗瓶', 'にごり', 'スパークリング'];
const allRecords = official.records.map((record, index) => ({ ...record, id: index }));

function resultMeaning(result: string, rank: number | null) {
  if (result === 'GOLD') return `该酒列入 2026 年本组金奖，官方公布组内第 ${rank} 位；此名次不跨组通用。`;
  if (result === 'SILVER') return '该酒列入 2026 年本组银奖；官方说明银奖对应组内较高评价区间，但未给银奖酒逐瓶名次。';
  if (result === 'BRONZE') return '该酒列入 2026 年本组铜奖；官方未给铜奖酒逐瓶名次。';
  return '该酒出现在官方决审入围名单；本地资料未把这一行与某条获奖记录确认为同一瓶，不推断最终奖级。';
}

export function SakeCompetitionCatalogue() {
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [result, setResult] = useState('all');
  const [shown, setShown] = useState(18);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const needle = query.trim().toLocaleLowerCase();
  const matches = allRecords.filter((item) =>
    (groupId === 'all' || item.group === groupId)
    && (result === 'all' || item.result === result)
    && (!needle || `${item.nameJa} ${item.maker}`.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => (RESULT_ORDER[a.result] ?? 9) - (RESULT_ORDER[b.result] ?? 9) || (a.rank ?? 99) - (b.rank ?? 99) || a.nameJa.localeCompare(b.nameJa, 'ja'));
  const selected = allRecords.find((item) => item.id === selectedId);
  const groupName = (id: string) => official.groups.find((item) => item.id === id)?.label ?? id;

  return <details className="g113-sake-catalogue">
    <summary><span>2026 官方公开名录</span><strong>{allRecords.length} 条可查记录</strong><small>展开搜索每一条已公开结果与入围记录 ↓</small></summary>
    <div className="g113-sake-catalogue-body">
      <p>赛事共报 {official.totalEntrantsReported.toLocaleString('zh-CN')} 件参赛；这里收录公开名单可辨认的 {allRecords.length} 条记录，其中金奖 38、银奖 74、铜奖 116、其余为决审名单行。官网没有公布其余每瓶的姓名与逐瓶评委评语；名单可能因官方前后命名不同出现同一作品的异名行。</p>
      <div className="g113-sake-catalogue-tools"><label>按酒款或酒藏查找<input value={query} onChange={(event) => { setQuery(event.target.value); setShown(18); setSelectedId(null); }} placeholder="例如：十四代、而今、雄町"/></label><label>赛事组别<select value={groupId} onChange={(event) => { setGroupId(event.target.value); setShown(18); setSelectedId(null); }}><option value="all">全部组别</option>{official.groups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>官方结果<select value={result} onChange={(event) => { setResult(event.target.value); setShown(18); setSelectedId(null); }}><option value="all">全部结果</option>{Object.entries(RESULT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
      <div className="g113-sake-catalogue-layout"><div className="g113-sake-catalogue-list"><div className="g113-sake-catalogue-list-head">找到 {matches.length} 条 · 每次展示 {Math.min(shown, matches.length)} 条</div>{matches.slice(0, shown).map((item) => <button key={item.id} type="button" className={selectedId === item.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}><span>{RESULT_LABELS[item.result]}{item.rank ? ` · 第 ${item.rank} 位` : ''}</span><b>{item.nameJa}</b><small>{item.maker} · {groupName(item.group)}</small></button>)}{matches.length > shown && <button type="button" className="g113-sake-catalogue-more" onClick={() => setShown((value) => value + 18)}>继续展开 18 条 ↓</button>}{!matches.length && <p className="g113-sake-catalogue-empty">没有找到对应记录。可以改用酒款日文原名或酒藏名称搜索。</p>}</div>
        <div className="g113-sake-catalogue-detail" aria-live="polite">{selected ? <article key={selected.id}><small>SAKE COMPETITION 2026 / {groupName(selected.group)}</small><h3>{selected.nameJa}</h3><p>{selected.maker}</p><div className="g113-sake-catalogue-verdict"><b>{RESULT_LABELS[selected.result]}{selected.rank ? ` · 组内第 ${selected.rank} 位` : ''}</b><p>{resultMeaning(selected.result, selected.rank)}</p></div><h4>读这瓶酒的第一条线索</h4><p>{LABEL_CLUES.filter((word) => selected.nameJa.includes(word)).length ? `酒名中出现「${LABEL_CLUES.filter((word) => selected.nameJa.includes(word)).join('、')}」。这些只是名称文字，不能据此确认参赛批次的配料、工艺或风味；下一步需要核对酒藏当年产品资料与原瓶标签。` : '官方结果只提供酒名与酒藏；尚需酒藏产品页、参赛年份对应批次与标签原图，才能进入工艺或风味深读。'}</p><h4>评价证据边界</h4><p>赛事公开了奖项与组内名次口径，但未发布此瓶的逐项评委意见、盲评分数或可核对的具体品饮笔记。本馆不会把编辑想象写成评委评价。</p><small>原始名单：{selected.result === 'FINALIST' ? '官方决审入围页' : selected.result === 'GOLD' ? '官方 GOLD 结果页' : '官方 SILVER / BRONZE 结果页'}；网址保存在本地档案与资料索引。</small></article> : <div className="g113-sake-catalogue-prompt"><span>酒</span><h3>选一瓶，读它的真实结果。</h3><p>先看赛事和酒款原名，再问这瓶酒还缺哪些证据。未获授权的真实瓶身照片继续留白。</p></div>}</div></div>
    </div>
  </details>;
}
