import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COLLECTIBLES, HOBBIES, dailyRecommendation } from './data.js';
import { FOCUS_HALLS } from './focus-halls.js';
import { SakeBrandView } from './sake-brand-view.js';
import { SAKE_ALL_DOSSIERS, SAKE_JAPAN_CELLAR, SAKE_WORLD_CELLAR } from './sake-cellar.js';
import { SakeJapanCellarView, SakeSourcesView, SakeWorldCellarView, SAKE_SOURCE_INDEX } from './sake-cellar-view.js';
import { SakeAppreciationView, SakeCraftView, SakeCultureView } from './sake-depth-view.js';
import { SAKE_CRAFT, SAKE_HISTORY, SAKE_PRICE_SAMPLES, SAKE_STORIES } from './sake-depth.js';
import { SAKE_BRANDS } from './sake-brands.js';
import { SAKE_PREVIEW_IMAGES } from './sake-preview-images.js';
import { guideJourneyFor } from './guide-journeys.js';
import { HobbyGuideView } from './hobby-guide-view.js';
import { SAKE_AWARD_RESEARCH, SAKE_AWARD_SOURCE } from './sake-awards.js';
import { SakeHundredDesk } from './sake-appreciation-lab.js';
import { JUYONDAI_RETAIL_OBSERVATIONS, SAKE_COMPETITION_2026, SAKE_HERITAGE_NOTE, SAKE_PRICE_REFERENCES } from './sake-rankings.js';
import { SakeRankingsView } from './sake-rankings-view.js';
import { SakeCompetitionCatalogue } from './sake-competition-catalogue.js';
import { SAKE_EVIDENCE_FILES } from './sake-evidence-files.js';
import { SakeEvidenceFilesView } from './sake-evidence-files-view.js';
import SAKE_COMPETITION_CATALOGUE from './sake-competition-2026.json';
import { INITIAL_STATE, normalizeState } from './state.js';

describe('game113 first deep-dive halls', () => {
  it('gives every open hobby an in-app guide and keeps the sake path evidence-led', () => {
    for (const hobby of HOBBIES) {
      const journey = guideJourneyFor(hobby);
      expect(journey.scenes.length).toBeGreaterThanOrEqual(3);
      expect(new Set(journey.scenes.map((scene) => scene.id)).size).toBe(journey.scenes.length);
      expect(journey.scenes.every((scene) => scene.choices.length === 2 && scene.archive.tab)).toBe(true);
    }
    const sake = HOBBIES.find((hobby) => hobby.id === 'sake')!;
    const journey = guideJourneyFor(sake);
    expect(journey.scenes).toHaveLength(5);
    expect(journey.scenes.map((scene) => scene.archive.tab)).toEqual(['culture', 'path', 'cellar', 'world', 'appreciation']);
    expect(journey.scenes.every((scene) => scene.evidence.includes('馆内'))).toBe(true);
    expect(JSON.stringify(journey.scenes)).not.toContain('獺祭');
    const html = renderToStaticMarkup(React.createElement(HobbyGuideView, { hobby: sake, onExplore: () => {} }));
    expect(html).toContain('虚构的清酒引路师傅');
    expect(html).toContain('时间的门');
    expect(html).not.toContain('href=');
  });

  it('does not misrepresent a brewery ranking or ten category trophies as the global top 100 bottles', () => {
    expect(SAKE_AWARD_RESEARCH).toHaveLength(10);
    expect(new Set(SAKE_AWARD_RESEARCH.map((item) => item.code)).size).toBe(10);
    expect(SAKE_AWARD_SOURCE.url).toMatch(/^https:\/\/www\.internationalwinechallenge\.com\//);
    const html = renderToStaticMarkup(React.createElement(SakeHundredDesk));
    expect(html).toContain('已核奖项 10 款 / 目标 100 款');
    expect(html).toContain('不是“世界第 1—10 名”');
    expect(html).not.toContain('href=');
  });

  it('provides a path, object archive and conversation prompts for both halls', () => {
    for (const id of ['woodwork', 'sake'] as const) {
      const hall = FOCUS_HALLS[id];
      expect(HOBBIES.some((hobby) => hobby.id === id)).toBe(true);
      expect(hall.steps).toHaveLength(5);
      expect(hall.objects).toHaveLength(5);
      expect(hall.prompts.length).toBeGreaterThanOrEqual(2);
      expect(hall.source.url).toMatch(/^https:\/\//);
    }
  });

  it('keeps sake cultural content out of the demo market and daily promotion', () => {
    expect(COLLECTIBLES.some((item) => item.hobbyId === 'sake')).toBe(false);
    expect(COLLECTIBLES.some((item) => item.hobbyId === 'cigar')).toBe(false);
    for (let day = 1; day <= 20; day += 1) {
      expect(['wine', 'sake', 'cigar']).not.toContain(dailyRecommendation([], new Date(2026, 9, day)).id);
    }
  });

  it('provides a sourced brand directory across regions without invented tasting data', () => {
    expect(SAKE_BRANDS).toHaveLength(28);
    expect(new Set(SAKE_BRANDS.map((brand) => brand.id)).size).toBe(SAKE_BRANDS.length);
    expect(new Set(SAKE_BRANDS.map((brand) => brand.prefecture)).size).toBeGreaterThanOrEqual(12);
    expect(SAKE_BRANDS.every((brand) => brand.example && brand.source.url.startsWith('https://'))).toBe(true);
    expect(SAKE_BRANDS.filter((brand) => brand.exampleFlavor).every((brand) => brand.flavorSourceUrl?.startsWith('https://'))).toBe(true);
    expect(SAKE_BRANDS.filter((brand) => brand.photo)).toHaveLength(1);
    expect(SAKE_SOURCE_INDEX.every((source) => source.url.startsWith('https://'))).toBe(true);
    expect(SAKE_BRANDS.find((brand) => brand.id === 'hakutsuru')?.photo?.license).toBe('CC0');
  });

  it('renders the whole brand index first, without a misleading ranking or external jumps', () => {
    expect(SAKE_BRANDS[0].id).not.toBe('dassai');
    expect(SAKE_BRANDS.map((brand) => brand.prefecture)).toEqual([...SAKE_BRANDS.map((brand) => brand.prefecture)].sort((a, b) => a.localeCompare(b, 'zh-CN')));
    const html = renderToStaticMarkup(React.createElement(SakeBrandView));
    expect(html).toContain('清酒品牌目录');
    expect(html).toContain('首批已核档案');
    expect(html).toContain('而今');
    expect(html).toContain('仙禽');
    expect(html).not.toContain('清酒导览榜');
    expect(html).not.toContain('购买链接</a>');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('g113-brand-atlas-number');
    expect(html).toContain('按地区名称排列');
  });

  it('keeps 2026 competition placements separate from verified price and collector evidence', () => {
    expect(SAKE_COMPETITION_2026.groups).toHaveLength(5);
    expect(SAKE_COMPETITION_2026.groups.every((group) => group.top.map((item) => item.rank).join(',') === '1,2,3')).toBe(true);
    expect(SAKE_COMPETITION_2026.groups.find((group) => group.id === 'premium')?.top[0].name).toBe('而今 特等雄町');
    expect(SAKE_PRICE_REFERENCES.some((item) => item.yen >= 100000 && item.volumeMl === 720)).toBe(true);
    expect(SAKE_PRICE_REFERENCES.every((item) => item.url.startsWith('https://'))).toBe(true);
    expect(SAKE_HERITAGE_NOTE.note).toContain('尚未确认');
    const html = renderToStaticMarkup(React.createElement(SakeRankingsView));
    expect(html).toContain('第 1 位');
    expect(html).toContain('而今 特等雄町');
    expect(html).toContain('十四代 龍泉');
    expect(html).not.toContain('全日本第一');
    expect(html).not.toContain('href=');
  });

  it('stores every publicly named 2026 competition result without fabricating individual judges notes', () => {
    expect(SAKE_COMPETITION_CATALOGUE.totalEntrantsReported).toBe(1139);
    expect(SAKE_COMPETITION_CATALOGUE.records).toHaveLength(528);
    expect(SAKE_COMPETITION_CATALOGUE.records.filter((item) => item.result === 'GOLD')).toHaveLength(38);
    expect(SAKE_COMPETITION_CATALOGUE.records.filter((item) => item.result === 'SILVER')).toHaveLength(74);
    expect(SAKE_COMPETITION_CATALOGUE.records.filter((item) => item.result === 'BRONZE')).toHaveLength(116);
    expect(SAKE_COMPETITION_CATALOGUE.records.filter((item) => item.result === 'FINALIST')).toHaveLength(300);
    expect(SAKE_COMPETITION_CATALOGUE.records.find((item) => item.nameJa === '十四代 龍泉')?.result).toBe('BRONZE');
    expect(renderToStaticMarkup(React.createElement(SakeCompetitionCatalogue))).toContain('没有公布其余每瓶的姓名与逐瓶评委评语');
    expect(JUYONDAI_RETAIL_OBSERVATIONS.every((item) => item.seller && item.observedAt && item.url.startsWith('https://'))).toBe(true);
    expect(new Set(JUYONDAI_RETAIL_OBSERVATIONS.map((item) => item.name)).size).toBeGreaterThan(1);
  });

  it('separates actual judging notes, brewer descriptions and retail observations in bottle files', () => {
    expect(SAKE_EVIDENCE_FILES).toHaveLength(5);
    expect(SAKE_EVIDENCE_FILES.filter((item) => item.evidenceKind === 'IWC 公开逐瓶品饮笔记')).toHaveLength(2);
    expect(SAKE_EVIDENCE_FILES.every((item) => item.resultUrl.startsWith('https://') && item.sourceUrl.startsWith('https://'))).toBe(true);
    const html = renderToStaticMarkup(React.createElement(SakeEvidenceFilesView));
    expect(html).toContain('赛事未公开这瓶的逐项盲评意见');
    expect(html).toContain('真实瓶身图片待授权');
    expect(html).not.toContain('href=');
  });

  it('keeps a deeper Japan and world archive locally, with no outbound links in the reader', () => {
    expect(SAKE_JAPAN_CELLAR).toHaveLength(4);
    expect(SAKE_WORLD_CELLAR).toHaveLength(4);
    expect(SAKE_JAPAN_CELLAR[0].id).not.toBe('dassai-deep');
    expect(SAKE_WORLD_CELLAR[0].id).not.toBe('dassai-blue');
    expect(SAKE_ALL_DOSSIERS.reduce((count, dossier) => count + dossier.products.length, 0)).toBe(27);
    expect(SAKE_ALL_DOSSIERS.every((dossier) => dossier.products.length >= 2 && dossier.products.every((product) => product.sourceUrl.startsWith('https://')))).toBe(true);
    expect(SAKE_SOURCE_INDEX.length).toBeGreaterThan(25);
    for (const view of [SakeJapanCellarView, SakeWorldCellarView, SakeSourcesView, SakeCultureView, SakeCraftView, SakeAppreciationView]) {
      expect(renderToStaticMarkup(React.createElement(view))).not.toContain('href=');
    }
    expect(renderToStaticMarkup(React.createElement(SakeJapanCellarView))).toContain('关注线索 · 非人气指数');
    expect(renderToStaticMarkup(React.createElement(SakeSourcesView))).toContain('下载本地研究包');
  });

  it('maps only exact official-product preview candidates with pending rights', () => {
    expect(SAKE_PREVIEW_IMAGES).toHaveLength(8);
    expect(new Set(SAKE_PREVIEW_IMAGES.map((image) => `${image.dossierId}/${image.productName}`)).size).toBe(SAKE_PREVIEW_IMAGES.length);
    expect(SAKE_PREVIEW_IMAGES.every((image) => image.rights === 'permission-pending' && image.usage === 'editorial-product-photo' && image.colorSpace === 'srgb' && image.wrap === 'clamp')).toBe(true);
    expect(SAKE_PREVIEW_IMAGES.every((image) => SAKE_ALL_DOSSIERS.some((dossier) => dossier.id === image.dossierId && dossier.products.some((product) => product.name === image.productName)))).toBe(true);
  });

  it('separates history, myth, brewing, flavour and dated price references', () => {
    expect(SAKE_HISTORY).toHaveLength(5);
    expect(SAKE_STORIES.some((story) => story.kind.includes('非史证'))).toBe(true);
    expect(SAKE_CRAFT).toHaveLength(5);
    expect(SAKE_PRICE_SAMPLES).toHaveLength(4);
    expect(SAKE_PRICE_SAMPLES.every((sample) => sample.volume === '720ml' && sample.priceJpy > 0 && sample.url.startsWith('https://'))).toBe(true);
    expect(renderToStaticMarkup(React.createElement(SakeCultureView))).toContain('历史与传说');
    expect(renderToStaticMarkup(React.createElement(SakeCraftView))).toContain('并行复发酵');
    const appreciation = renderToStaticMarkup(React.createElement(SakeAppreciationView));
    expect(appreciation).toContain('鉴赏与收藏');
    expect(appreciation).toContain('2026-10-02');
    expect(appreciation).toContain('真实器物');
  });

  it('migrates and bounds local private notes', () => {
    expect(normalizeState(null).fieldNotes).toEqual(INITIAL_STATE.fieldNotes);
    expect(normalizeState({ fieldNotes: { woodwork: '榫接', sake: 'a'.repeat(900) } }).fieldNotes).toEqual({ woodwork: '榫接', sake: 'a'.repeat(800), cigar: '' });
  });
});
