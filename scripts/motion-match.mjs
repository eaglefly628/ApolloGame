#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATEGORIES, EMOTIONS, CONTACTS, validateCatalog } from './lib/motion-catalog.mjs';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const normalized = text => text.normalize('NFKC').toLowerCase();
/** Locale-independent terms: whole non-Han words and adjacent Han pairs. */
export function searchTerms(text) {
  const parts = normalized(text).match(/\p{Script=Han}+|[\p{L}\p{N}]+/gu) || [];
  return [...new Set(parts.flatMap(part => {
    const chars = [...part];
    return /^\p{Script=Han}+$/u.test(part) && chars.length > 1
      ? chars.slice(1).map((char, i) => chars[i] + char) : [part];
  }))].sort(compare);
}
const fields = [ ['tags', 6], ['id', 4], ['descZh', 3], ['descEn', 3], ['category', 2], ['emotion', 2], ['contacts', 2] ];

function validateOptions(options) {
  if (options.emotion !== undefined && !EMOTIONS.includes(options.emotion)) throw new Error('unknown emotion');
  if (options.contact !== undefined && !CONTACTS.includes(options.contact)) throw new Error('unknown contact');
  if (options.category !== undefined && !CATEGORIES.includes(options.category)) throw new Error('unknown category');
  if (options.maxDuration !== undefined && (!Number.isFinite(options.maxDuration) || options.maxDuration <= 0)) throw new Error('max-duration must be finite and >0');
  if (options.top !== undefined && (!Number.isInteger(options.top) || options.top < 1 || options.top > 1000)) throw new Error('top must be an integer in 1..1000');
}

/** Reads catalog metadata only. No files, labels, state or source assets are changed. */
export function matchMotions(catalog, query, options = {}) {
  validateCatalog(catalog);
  validateOptions(options);
  if (typeof query !== 'string' || !query.trim() || query.length > 4000) throw new Error('query must be nonempty text, max4000');
  const terms = searchTerms(query);
  if (!terms.length) throw new Error('query requires a searchable letter or number');
  const candidates = [];
  for (const row of catalog.clips) {
    if (options.emotion !== undefined && !row.emotion.includes(options.emotion)) continue;
    if (options.contact !== undefined && !row.contacts.includes(options.contact)) continue;
    if (options.category !== undefined && row.category !== options.category) continue;
    if (options.maxDuration !== undefined && row.durationS > options.maxDuration) continue;
    const reasons = [];
    for (const [field, points] of fields) {
      const values = Array.isArray(row[field]) ? row[field] : [row[field]];
      const indexed = new Set(values.flatMap(searchTerms));
      for (const term of terms) if (indexed.has(term)) reasons.push({ field, term, points });
    }
    // Constraints do not fabricate relevance for unrelated text.
    if (!reasons.length) continue;
    candidates.push({ id: row.id, file: row.file, score: reasons.reduce((sum, reason) => sum + reason.points, 0), reasons,
      status: row.status, requiresHumanConfirmation: row.status !== 'confirmed', durationS: row.durationS,
      category: row.category, emotion: row.emotion, contacts: row.contacts, intensity: row.intensity,
      descZh: row.descZh, descEn: row.descEn, tags: row.tags, loop: row.loop, inPlace: row.inPlace, rootMotion: row.rootMotion });
  }
  candidates.sort((a, b) => b.score - a.score || compare(a.id, b.id));
  const filters = Object.fromEntries(['emotion','contact','category','maxDuration'].filter(key => options[key] !== undefined).map(key => [key, options[key]]));
  return { query, terms, filters, totalMatches: candidates.length, candidates: candidates.slice(0, options.top ?? 5) };
}

export function parseArgs(args) {
  const options = {};
  const map = { '--emotion':'emotion', '--contact':'contact', '--category':'category', '--max-duration':'maxDuration', '--top':'top', '--lib':'lib', '--catalog':'catalog' };
  let query;
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token.startsWith('--')) {
      const key = map[token];
      if (!key) throw new Error(`unknown option ${token}`);
      if (Object.hasOwn(options, key)) throw new Error(`duplicate option ${token}`);
      const value = args[++i];
      if (value === undefined || !value.trim() || value.startsWith('--')) throw new Error(`missing value for ${token}`);
      if (['top','maxDuration'].includes(key) && !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw new Error(`invalid numeric value for ${token}`);
      options[key] = ['top','maxDuration'].includes(key) ? Number(value) : value;
    } else {
      if (token.startsWith('-')) throw new Error(`unknown option ${token}`);
      if (query !== undefined) throw new Error('pass the script beat as one quoted argument');
      query = token;
    }
  }
  if (query === undefined) throw new Error('script beat required');
  if (options.lib !== undefined && options.catalog !== undefined) throw new Error('choose --lib or --catalog');
  validateOptions(options);
  return { query, options };
}

export async function main(args = process.argv.slice(2), io = { out: text => console.log(text), log: text => console.error(text) }) {
  try {
    const { query, options } = parseArgs(args);
    const catalogFile = options.catalog ? resolve(options.catalog) : join(resolve(options.lib || join(homedir(), 'ApolloAssets', 'motion-lib')), 'catalog.json');
    const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
    const result = matchMotions(catalog, query, options);
    io.log(`[motion-match] ${result.candidates.length ? 'decision' : 'reject'} ${JSON.stringify({ reason: result.candidates.length ? 'ranked catalog candidates' : 'no matching catalog motion', totalMatches: result.totalMatches, returned: result.candidates.length })}`);
    io.out(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    io.log(`[motion-match] reject ${JSON.stringify({ message: error.message })}`);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
