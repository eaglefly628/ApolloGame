/**
 * Rebuild the offline, factual 2026 SAKE COMPETITION catalogue from official HTML.
 * No judging comments, tasting notes, prices or invented placements are generated.
 * Run deliberately when reviewing a new official snapshot; this is not a runtime fetch.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = 'https://www.sakecompetition.com/';
const goldUrl = `${base}award.html`;
const medalsUrl = `${base}award_silver.html`;
const groups = [
  { id: 'junmai', label: '纯米酒', expected: { gold: 10, silver: 19, bronze: 30, finalists: 143 }, finalistsUrl: `${base}result/final_junmai2026.html` },
  { id: 'junmaiginjo', label: '纯米吟酿', expected: { gold: 10, silver: 22, bronze: 34, finalists: 165 }, finalistsUrl: `${base}result/final_junmaiginjo2026.html` },
  { id: 'junmaidaiginjo', label: '纯米大吟酿', expected: { gold: 10, silver: 23, bronze: 35, finalists: 172 }, finalistsUrl: `${base}result/final_junmaidaiginjo2026.html` },
  { id: 'sp', label: 'Super Premium', expected: { gold: 3, silver: 5, bronze: 8, finalists: null } },
  { id: 'mn', label: '现代自然', expected: { gold: 5, silver: 5, bronze: 9, finalists: null } },
];

function clean(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function key(group, maker, nameJa) {
  return [group, maker, nameJa].map((part) => part.normalize('NFKC').replace(/\s+/g, '')).join('|');
}
async function officialHtml(url) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  return response.text();
}
function groupTable(html, groupId) {
  const escaped = groupId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<h2[^>]*id=["']${escaped}["'][^>]*>[\\s\\S]*?<\\/h2>[\\s\\S]*?<table[^>]*>([\\s\\S]*?)<\\/table>`, 'i').exec(html);
  if (!match) throw Error(`Missing ${groupId} table`);
  return [...match[1].matchAll(/<tr>\s*<th>([\s\S]*?)<\/th>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi)]
    .map((row) => ({ marker: clean(row[1]), maker: clean(row[2]), nameJa: clean(row[3]) }));
}
function finalistRows(html) {
  const article = /<article class="post">([\s\S]*?)<\/article>/i.exec(html)?.[1];
  if (!article) throw Error('Missing finalists article');
  return article.replace(/<br\s*\/?\s*>/gi, '\n').split('\n')
    .map(clean).filter((line) => line.includes('－'))
    .map((line) => {
      const [maker, ...name] = line.split('－');
      return { maker: clean(maker), nameJa: clean(name.join('－')) };
    }).filter((row) => row.maker && row.nameJa);
}

const [goldHtml, medalsHtml, ...finalistHtml] = await Promise.all([
  officialHtml(goldUrl), officialHtml(medalsUrl), ...groups.filter((group) => group.finalistsUrl).map((group) => officialHtml(group.finalistsUrl)),
]);
const records = new Map();
for (const group of groups) {
  const gold = groupTable(goldHtml, group.id);
  const medals = groupTable(medalsHtml, group.id);
  const counts = { gold: gold.length, silver: medals.filter((item) => item.marker === 'SILVER').length, bronze: medals.filter((item) => item.marker === 'BRONZE').length };
  for (const [kind, expected] of Object.entries(group.expected)) {
    if (kind !== 'finalists' && counts[kind] !== expected) throw Error(`${group.id} ${kind}: expected ${expected}, got ${counts[kind]}`);
  }
  for (const [index, row] of gold.entries()) {
    if (row.marker !== `第${index + 1}位`) throw Error(`${group.id}: unexpected gold rank ${row.marker}`);
    const id = key(group.id, row.maker, row.nameJa);
    if (records.has(id)) throw Error(`Duplicate medal: ${id}`);
    records.set(id, { group: group.id, maker: row.maker, nameJa: row.nameJa, result: 'GOLD', rank: index + 1, resultUrl: goldUrl });
  }
  for (const row of medals) {
    if (!['SILVER', 'BRONZE'].includes(row.marker)) throw Error(`${group.id}: unexpected medal ${row.marker}`);
    const id = key(group.id, row.maker, row.nameJa);
    if (records.has(id)) throw Error(`Duplicate medal: ${id}`);
    records.set(id, { group: group.id, maker: row.maker, nameJa: row.nameJa, result: row.marker, rank: null, resultUrl: medalsUrl });
  }
  if (group.finalistsUrl) {
    const rows = finalistRows(finalistHtml.shift());
    if (rows.length !== group.expected.finalists) throw Error(`${group.id} finalists: expected ${group.expected.finalists}, got ${rows.length}`);
    const finalistKeys = new Set(rows.map((row) => key(group.id, row.maker, row.nameJa)));
    const unmatched = [...records.entries()].filter(([id, record]) => record.group === group.id && !finalistKeys.has(id));
    if (unmatched.length) process.stderr.write(`${group.id}: ${unmatched.length} medal names absent from exact finalist keys: ${unmatched.map(([, record]) => `${record.maker} / ${record.nameJa}`).join(' ; ')}\n`);
    for (const row of rows) {
      const id = key(group.id, row.maker, row.nameJa);
      if (!records.has(id)) records.set(id, { group: group.id, maker: row.maker, nameJa: row.nameJa, result: 'FINALIST', rank: null, resultUrl: group.finalistsUrl });
    }
  }
}
const resultCounts = Object.fromEntries(['GOLD', 'SILVER', 'BRONZE', 'FINALIST'].map((result) => [result, [...records.values()].filter((record) => record.result === result).length]));
if (resultCounts.GOLD !== 38 || resultCounts.SILVER !== 74 || resultCounts.BRONZE !== 116) throw Error(`Unexpected medal totals ${JSON.stringify(resultCounts)}`);
const output = {
  source: 'SAKE COMPETITION official 2026 published results and finalist pages',
  capturedAt: new Date().toISOString().slice(0, 10),
  totalEntrantsReported: 1139,
  limitation: 'Only publicly named medalists and finalists are included. The organizer does not publish every entrant or an individual judging note for every bottle.',
  groups: groups.map(({ id, label, expected, finalistsUrl }) => ({ id, label, expected, finalistsUrl: finalistsUrl ?? null })),
  records: [...records.values()],
};
const path = resolve('games/game113/sake-competition-2026.json');
await writeFile(path, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${path}: ${output.records.length} published records ${JSON.stringify(resultCounts)}\n`);
