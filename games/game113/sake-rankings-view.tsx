import React, { useState } from 'react';
import { JUYONDAI_RETAIL_OBSERVATIONS, SAKE_COMPETITION_2026, SAKE_HERITAGE_NOTE, SAKE_OTHER_2026_HONORS, SAKE_PRICE_REFERENCES } from './sake-rankings.js';
import { SakeCompetitionCatalogue } from './sake-competition-catalogue.js';
import { SakeEvidenceFilesView } from './sake-evidence-files-view.js';

type Lens = 'competition' | 'price' | 'evidence';

export function SakeRankingsView() {
  const [lens, setLens] = useState<Lens>('competition');
  const [groupId, setGroupId] = useState<string>(SAKE_COMPETITION_2026.groups[0].id);
  const group = SAKE_COMPETITION_2026.groups.find((item) => item.id === groupId) ?? SAKE_COMPETITION_2026.groups[0];
  const prices = [...SAKE_PRICE_REFERENCES].sort((a, b) => a.maker.localeCompare(b.maker, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN'));

  return <section className="g113-sake-rankings" aria-labelledby="g113-sake-rankings-title">
    <header className="g113-sake-rankings-head">
      <small>THE 2026 LEDGER / 赛事与珍酿</small>
      <h2 id="g113-sake-rankings-title">先问是哪一场比赛，再问是哪一瓶酒。</h2>
      <p>这里把 2026 年真实赛事名次、可核对的高价酒款、收藏证据分开看；不把三者相加成虚构的“清酒总榜”，也不把品牌陈列顺序当作酒质评价。</p>
      <div className="g113-sake-rankings-lenses" role="tablist" aria-label="选择清酒研究角度">
        {([['competition', '2026 赛事名次'], ['price', '公开价格样本'], ['evidence', '收藏价值怎么判断']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={lens === id} className={lens === id ? 'active' : ''} onClick={() => setLens(id)}>{label}</button>)}
      </div>
    </header>

    {lens === 'competition' && <div role="tabpanel" className="g113-sake-rankings-panel">
      <div className="g113-sake-rankings-context"><strong>SAKE COMPETITION 2026</strong><span>共 {SAKE_COMPETITION_2026.entries.toLocaleString('zh-CN')} 件参赛 · 官方盲评 · 本页摘录每组前三</span></div>
      <div className="g113-sake-rankings-groups" aria-label="选择比赛组别">{SAKE_COMPETITION_2026.groups.map((item) => <button key={item.id} type="button" aria-pressed={group.id === item.id} className={group.id === item.id ? 'active' : ''} onClick={() => setGroupId(item.id)}>{item.name}</button>)}</div>
      <div className="g113-sake-rankings-group-head"><div><small>2026 / {group.name.toUpperCase()}</small><h3>{group.name}组 · 前三位</h3></div><span>{group.entries} 件参赛</span></div>
      <p className="g113-sake-rankings-lead">{group.lead}</p>
      <ol className="g113-sake-rankings-list">{group.top.map((entry) => <li key={entry.rank}><span>第 {entry.rank} 位</span><div><h4>{entry.name}</h4><p>{entry.maker} · {entry.prefecture}</p></div><small>2026 GOLD</small></li>)}</ol>
      {group.id === 'premium' && <div className="g113-sake-rankings-aside"><small>同一高端组，不止金奖</small><div>{SAKE_COMPETITION_2026.premiumOther.map((item) => <p key={item.name}><b>{item.name}</b><span>{item.maker} · {item.award}</span></p>)}</div><p>银奖与铜奖没有金奖的第 1—3 位序号；不能把它们伪装成第 4、5 名。</p></div>}
      <div className="g113-sake-rankings-aside"><small>另外两场 2026 赛事 · 独立奖项</small><div>{SAKE_OTHER_2026_HONORS.map((item) => <p key={item.event}><b>{item.name}</b><span>{item.maker} · {item.event} {item.award}</span></p>)}</div><p>这里不是跨赛事第 1、2 名；酒藏排名又是另一种统计对象。</p></div>
      <SakeEvidenceFilesView/>
      <SakeCompetitionCatalogue/>
      <p className="g113-sake-rankings-foot">资料：{SAKE_COMPETITION_2026.label}，{SAKE_COMPETITION_2026.checkedAt} 核对；官方结果与参赛规则已收入馆内资料索引。赛事只评价当届参赛酒，不覆盖未参赛作品。</p>
    </div>}

    {lens === 'price' && <div role="tabpanel" className="g113-sake-rankings-panel">
      <div className="g113-sake-rankings-context"><strong>THE PRICE DESK / 高价酒档</strong><span>按酒藏名称陈列 · 全部 720ml</span></div>
      <p className="g113-sake-rankings-lead">这里记录相同容量、同为日元含税标价的四份样本，按酒藏名称排列而非按价格高低排名。不是全日本最贵榜；不同年份、礼盒、地区和二手成交价不能直接混排。</p>
      <ol className="g113-sake-rankings-list g113-sake-rankings-list--price">{prices.map((item) => <li key={item.name}><span>¥{item.yen.toLocaleString('ja-JP')}</span><div><h4>{item.name}</h4><p>{item.maker} · {item.volumeMl}ml · 日本含税公开价</p><p>{item.detail}</p></div><small>{item.source}</small></li>)}</ol>
      <div className="g113-sake-rankings-retail"><div><small>THE RETAIL OBSERVATION / 十四代价格观察</small><h3>同叫“十四代”，不是同一瓶，也没有统一市价。</h3><p>以下均为零售店展示价，不是高木酒造官方定价、实际成交价或 2026 参赛瓶估值。按酒款、版本、容量、商家与观察日期分别存档；价格随时可能变化。</p></div><div className="g113-sake-rankings-retail-grid">{JUYONDAI_RETAIL_OBSERVATIONS.map((item) => <article key={`${item.name}-${item.observedAt}`}><small>{item.observedAt} · {item.seller}</small><h4>{item.name}</h4><strong>¥{item.yen.toLocaleString('ja-JP')}</strong><p>{item.volumeMl}ml · 店铺含税展示价</p><p>{item.edition}</p></article>)}</div></div>
      <div className="g113-sake-rankings-aside"><small>旧名酒线索</small><h4>{SAKE_HERITAGE_NOTE.name}</h4><p>{SAKE_HERITAGE_NOTE.note}</p><span>来源：{SAKE_HERITAGE_NOTE.source}</span></div>
      <p className="g113-sake-rankings-foot">价格核对：2026-10-06。标价可能变动，且不证明稀缺度、流动性或未来升值；原始价格页均记录在馆内资料索引。</p>
    </div>}

    {lens === 'evidence' && <div role="tabpanel" className="g113-sake-rankings-panel">
      <div className="g113-sake-rankings-context"><strong>THE COLLECTOR'S LENS / 收藏证据</strong><span>价值不等于贵，也不等于获奖</span></div>
      <div className="g113-sake-rankings-evidence">
        <article><span>01 / 赛事</span><h3>奖项要落到具体版本</h3><p>先记赛事、年度、组别、名次与参赛酒名。2026 年 Super Premium 组的「而今 特等雄町」是组内第一，不是全日本所有酒的第一。</p></article>
        <article><span>02 / 价格</span><h3>标价与成交分开</h3><p>比较时固定容量、税费、地区和日期。官网标价只是定价证据；没有可靠成交记录，就不显示“市价”或涨跌幅。</p></article>
        <article><span>03 / 实物</span><h3>年份、标签与品相</h3><p>收藏档案还需原瓶多角度实拍、封签、批次、保存与来源链。当前比赛资料并不能替代具体瓶子的真伪和保存状态。</p></article>
        <article><span>04 / 流通</span><h3>稀缺不等于能转手</h3><p>发行量、持续需求与可合法流通的市场需要单独核验。缺二级市场证据时，本馆只做文化和作品研究，不给投资价值排名。</p></article>
      </div>
      <p className="g113-sake-rankings-foot">此栏是策展判断框架，不是购买、交易、饮用或投资建议。酒类内容仍受年龄门槛与地区规则约束。</p>
    </div>}
  </section>;
}
