import React, { useState } from 'react';
import { SAKE_ALL_DOSSIERS, SAKE_JAPAN_CELLAR, SAKE_WORLD_CELLAR, type SakeDossier } from './sake-cellar.js';
import { SAKE_BRANDS } from './sake-brands.js';
import { SAKE_DEPTH_SOURCES, SAKE_PRICE_SAMPLES, SAKE_STORIES } from './sake-depth.js';
import { SAKE_PREVIEW_IMAGES, sakePreviewImageFor } from './sake-preview-images.js';
import { SAKE_AWARD_SOURCE } from './sake-awards.js';
import { JUYONDAI_RETAIL_OBSERVATIONS, SAKE_COMPETITION_2026, SAKE_HERITAGE_NOTE, SAKE_OTHER_2026_HONORS, SAKE_PRICE_REFERENCES } from './sake-rankings.js';
import SAKE_COMPETITION_CATALOGUE from './sake-competition-2026.json';
import { SAKE_EVIDENCE_FILES } from './sake-evidence-files.js';

function ProductVisual({ dossierId, productName, index }: { dossierId: string; productName: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const preview = import.meta.env.DEV ? sakePreviewImageFor(dossierId, productName) : undefined;
  if (preview && !failed) return <div className="g113-cellar-product-photo g113-cellar-product-photo--real"><img src={`/games/game113/preview-art-local/${preview.file}`} alt={preview.depicted} onError={() => setFailed(true)}/><span>官网产品图 · 仅本机 Demo</span><small>授权待核 · 不入发行包</small></div>;
  return <div className="g113-cellar-product-photo" role="img" aria-label={`${productName}真实瓶身照片待补`}><span>PHOTO / 待补实拍</span><b>{String(index + 1).padStart(2, '0')}</b><small>不以 AI 图冒充实物</small></div>;
}

function DossierReader({ dossiers, global }: { dossiers: readonly SakeDossier[]; global?: boolean }) {
  const [selectedId, setSelectedId] = useState(dossiers[0].id);
  const selected = dossiers.find((item) => item.id === selectedId) ?? dossiers[0];
  return <div className="g113-cellar">
    <div className="g113-cellar-intro"><small>{global ? 'THE WORLD CELLAR / 世界酒藏' : 'THE CONNOISSEUR FILES / 名酒深读'}</small><h2>{global ? '清酒离开日本，也生长出自己的风土。' : '不背名酒名单，读懂它们各自想回答的问题。'}</h2><p>{global ? '从纽约、伦敦到英国乡间：这些是有酒藏一手资料的海外酿造实例，不是“全球所有酒藏”的完整名录。' : '每座酒藏挑出具体作品，比较米、工艺、年份、保存方式与收藏证据。这里的风味均为酒藏对具体产品的描述，不是品牌永久不变的味道。'}</p></div>
    <div className="g113-cellar-index" aria-label="选择酒藏">{dossiers.map((item) => <button key={item.id} type="button" className={selected.id === item.id ? 'active' : ''} aria-pressed={selected.id === item.id} onClick={() => setSelectedId(item.id)}><b>{item.name}</b><small>{item.place}</small></button>)}</div>
    <article className="g113-cellar-feature" key={selected.id}>
      <div className="g113-cellar-feature-top"><div><small>{selected.latin} / {selected.place}</small><h3>{selected.name}</h3><em>{selected.lens}</em></div><div className="g113-cellar-feature-sign">{selected.name.slice(0, 1)}</div></div>
      <p className="g113-cellar-thesis">{selected.thesis}</p>
      <div className="g113-cellar-feature-bottom"><div><small>一层更深的问题</small><h4>{selected.deepQuestion}</h4><p>{selected.deepAnswer}</p></div><div><small>关注线索 · 非人气指数</small><p>{selected.recognition}</p><small>收藏时记什么</small><p>{selected.collectorNote}</p></div></div>
    </article>
    <section className="g113-cellar-products" aria-label={`${selected.name}的作品档案`}><div className="g113-cellar-products-head"><small>THE WORKS / 作品档案</small><h3>在具体酒款里，看见差别。</h3><p>下方是编辑整理的本地中文摘要。产品与年份会变化，档案核对日期：2026-10-02。</p></div><div className="g113-cellar-product-grid">{selected.products.map((product, index) => <article key={product.name}><ProductVisual dossierId={selected.id} productName={product.name} index={index}/><div className="g113-cellar-product-copy"><small>{product.category}</small><h4>{product.name}</h4><p>{product.character}</p><div>{product.detail}</div><span>资料依据：{product.sourceName}{product.sourceDate ? ` · ${product.sourceDate}` : ''}</span></div></article>)}</div></section>
    <p className="g113-cellar-caveat">目前没有跨品牌真实关注人数、销量或独立热度指数，所以不显示“最火酒款”假榜。上述关注线索只说明酒藏公开的产品沿革或经营事实。酒类档案不提供购买、交易、投资或饮用建议。</p>
  </div>;
}

export function SakeJapanCellarView() { return <DossierReader dossiers={SAKE_JAPAN_CELLAR}/>; }
export function SakeWorldCellarView() { return <DossierReader dossiers={SAKE_WORLD_CELLAR} global/>; }

const STATIC_SOURCES = [
  ...SAKE_DEPTH_SOURCES.map((item) => ({ label: item.label, url: item.url })),
  ...SAKE_STORIES.map((item) => ({ label: item.source.label, url: item.source.url })),
  ...SAKE_PRICE_SAMPLES.map((item) => ({ label: item.source, url: item.url })),
  ...SAKE_BRANDS.map((item) => item.source),
  ...SAKE_BRANDS.flatMap((item) => item.flavorSourceUrl ? [{ label: `${item.name}代表酒款`, url: item.flavorSourceUrl }] : []),
  ...SAKE_ALL_DOSSIERS.flatMap((dossier) => dossier.products.map((item) => ({ label: item.sourceName, url: item.sourceUrl }))),
  ...SAKE_PREVIEW_IMAGES.map((item) => ({ label: `${item.productName}官网产品图 · 授权待核`, url: item.pageUrl })),
  SAKE_AWARD_SOURCE,
  { label: SAKE_COMPETITION_2026.label, url: SAKE_COMPETITION_2026.url },
  { label: 'SAKE COMPETITION 2026 · 官方参赛组别与价格门槛', url: SAKE_COMPETITION_2026.rulesUrl },
  { label: 'SAKE COMPETITION 2026 · 官方 SILVER / BRONZE 结果', url: 'https://www.sakecompetition.com/award_silver.html' },
  ...SAKE_PRICE_REFERENCES.map((item) => ({ label: `${item.name} · ${item.source}`, url: item.url })),
  ...JUYONDAI_RETAIL_OBSERVATIONS.map((item) => ({ label: `${item.name} · ${item.seller} · ${item.observedAt} 展示价`, url: item.url })),
  ...SAKE_COMPETITION_CATALOGUE.groups.flatMap((item) => item.finalistsUrl ? [{ label: `SAKE COMPETITION 2026 · ${item.label}决审入围`, url: item.finalistsUrl }] : []),
  ...SAKE_OTHER_2026_HONORS.map((item) => ({ label: `${item.event} · ${item.award}`, url: item.url })),
  ...SAKE_EVIDENCE_FILES.flatMap((item) => [
    { label: `${item.name} · 逐瓶赛事结果`, url: item.resultUrl },
    { label: `${item.name} · ${item.evidenceKind}`, url: item.sourceUrl },
    ...('extraResultUrl' in item ? [{ label: `${item.name} · 第二赛事结果`, url: item.extraResultUrl }] : []),
  ]),
  { label: SAKE_HERITAGE_NOTE.source, url: SAKE_HERITAGE_NOTE.url },
  { label: '长州酒造 · 天美 蛍天 2026 产品发布资料', url: 'https://choshusake.com/item/1902' },
  { label: 'World Sakagura Ranking 2025 · 排名对象是酒藏，不是单款酒', url: 'https://www.sakaguraranking.jp/2025/index_e.html' },
  { label: 'Kura Master 2026 · 日本酒不同组别获奖名单', url: 'https://kuramaster.com/search/ja/japanese-sake/laureats-2026/' },
  { label: 'SAKE COMPETITION 2026 · 分组获奖结果', url: 'https://www.sakecompetition.com/award.html' },
  { label: '日本酒类综合研究所 · 清酒基础', url: 'https://www.nrib.go.jp/English/sake_info/sake-essentials/whats-sake/' },
  { label: 'Wikimedia Commons · 白鹤酒造建筑 CC0 实拍', url: 'https://commons.wikimedia.org/wiki/File:HAKUTSURU_SAKE_BREWING.jpg' },
  { label: 'Wikimedia Commons · 大田垣莲月酒盏 CC0 实拍', url: 'https://commons.wikimedia.org/wiki/File:Sake_cup_inscribed_with_waka_poem_by_Otagaki_Rengetsu,_Honolulu_Museum_of_Art,_13224.1a.JPG' },
  { label: 'Wikimedia Commons · 东京博物馆酒瓶 CC0 实拍', url: 'https://commons.wikimedia.org/wiki/File:Sake_bottle_-_Food_and_Agriculture_Museum_-_Setagaya,_Tokyo,_Japan_-_DSC09789.jpg' },
  { label: 'Wikimedia Commons · 盛冈酒藏杉玉 CC0 实拍', url: 'https://commons.wikimedia.org/wiki/File:Sugidama_-_Kiku_no_Tsukasa_Sake_Brewery_-_Morioka,_Iwate_-_DSC04109.jpg' },
  { label: 'Wikimedia Commons · 米麹 CC BY-SA 4.0 实拍', url: 'https://commons.wikimedia.org/wiki/File:Koji_Mold_Rice.jpg' },
  { label: 'Wikimedia Commons · 2011 年獺祭标签 CC BY 2.0 实拍', url: 'https://commons.wikimedia.org/wiki/File:Dassai_(Brand_of_sake).jpg' },
];
export const SAKE_SOURCE_INDEX = [...new Map(STATIC_SOURCES.map((item) => [item.url, item])).values()];

function downloadResearch() {
  const archive = {
    title: '雅趣：第二人生 · 清酒资料馆本地策展档案', checkedAt: '2026-10-06',
    note: '中文摘要为本站编辑整理；不是酒藏网页原文或图片离线镜像，不含实时价格、销量与购买入口。原始 URL 仅供日后审校。',
    japan: SAKE_JAPAN_CELLAR, world: SAKE_WORLD_CELLAR, brandAtlas: SAKE_BRANDS, competition2026: SAKE_COMPETITION_2026, publishedCompetitionCatalogue2026: SAKE_COMPETITION_CATALOGUE, bottleEvidenceFiles: SAKE_EVIDENCE_FILES, otherHonors2026: SAKE_OTHER_2026_HONORS, priceReferences: SAKE_PRICE_REFERENCES, juyondaiRetailObservations: JUYONDAI_RETAIL_OBSERVATIONS, heritageNote: SAKE_HERITAGE_NOTE, sources: SAKE_SOURCE_INDEX,
    previewImageCandidates: SAKE_PREVIEW_IMAGES.map(({ dossierId, productName, pageUrl, imageUrl, depicted, rights }) => ({ dossierId, productName, pageUrl, imageUrl, depicted, rights })),
  };
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'yaqu-sake-research-2026-10-06.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SakeSourcesView() {
  return <div className="g113-cellar g113-cellar-sources"><div className="g113-cellar-intro"><small>THE RESEARCH CABINET / 资料索引</small><h2>资料进馆，不把人带出馆。</h2><p>酒藏官网、行业机构与馆藏档案用于研究核实；前台展示我们自己的中文摘要。这里保留题名和核对日期，不复制整站文字或未经授权的产品照片。</p></div><div className="g113-cellar-research-card"><div><small>本地研究包 · 2026-10-06</small><h3>{SAKE_BRANDS.length} 座品牌基础档 · {SAKE_ALL_DOSSIERS.length} 座深读酒藏</h3><p>下载 JSON 后可离线查看品牌目录、酒款差异和原始来源记录。来源网址在文件里用于后续编辑核对，页面不会自动跳转。</p></div><button type="button" onClick={downloadResearch}>下载本地研究包 ↓</button></div><div className="g113-cellar-source-list">{SAKE_SOURCE_INDEX.map((source, index) => <div key={source.url}><span>{String(index + 1).padStart(2, '0')}</span><p>{source.label}</p><small>官网 / 原始资料 · 已入本地索引</small></div>)}</div><p className="g113-cellar-caveat">本馆是逐批审校的精选档案，不自称覆盖全世界所有酒藏。人气、奖项、价格、在售状态都需另设更新时间与独立证据，未核实的字段宁留空。</p></div>;
}
