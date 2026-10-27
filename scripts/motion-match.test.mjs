import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { main, matchMotions, parseArgs, searchTerms } from './motion-match.mjs';
const roots = [];
afterEach(() => roots.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));
const clip = (id, extra = {}) => ({ id, file: `clips/${id}.glb`, sha256: 'a'.repeat(64),
 source: { kind: 'mixamo', fbxSha256: 'b'.repeat(64), searchTerm: 'Synthetic fixture', mixamoName: 'Synthetic fixture' },
 fps: 30, frames: 61, durationS: 2, loop: false, inPlace: true, rootMotion: 'none',
 category: 'gesture', emotion: ['tender'], contacts: ['right-hand'], intensity: 1,
 descZh: '伸手接住她', descEn: 'extends a hand', tags: ['reach'], derivedFrom: null, status: 'draft', ...extra });
const catalog = (...clips) => ({ version: 1, clips, skins: [] });
const fixture = data => { const dir = mkdtempSync(join(tmpdir(), 'motion-match-')); roots.push(dir); const file = join(dir, 'catalog.json'); writeFileSync(file, JSON.stringify(data)); return file; };
describe('deterministic motion matching over closed catalog data', () => {
 it('ranks observable matches and gives an exact score ledger', () => {
  const data = catalog(clip('description', { tags: [], descEn: 'reach toward partner' }), clip('tagged'));
  const result = matchMotions(data, 'reach');
  expect(result.candidates.map(row => row.id)).toEqual(['tagged', 'description']);
  expect(result.candidates[0]).toMatchObject({ score: 6, reasons: [{ field: 'tags', term: 'reach', points: 6 }], status: 'draft', requiresHumanConfirmation: true });
  expect(result.candidates[1].score).toBe(3);
  expect(result.candidates.every(row => row.score === row.reasons.reduce((n, r) => n + r.points, 0))).toBe(true);
 });
 it('keeps Unicode Chinese search useful, folds width/case, and ignores repetition', () => {
  expect(searchTerms('ＲＥＡＣＨ Reach 伸手接住')).toEqual(['reach', '伸手', '手接', '接住']);
  const data = catalog(clip('sample'));
  expect(matchMotions(data, 'reach reach').candidates).toEqual(matchMotions(data, 'ＲＥＡＣＨ').candidates);
  expect(matchMotions(data, '她伸手接住女孩').candidates[0].reasons).toContainEqual({ field: 'descZh', term: '伸手', points: 3 });
  expect(matchMotions(catalog(clip('sample', { descEn: 'breathe', tags: [] })), 'eat').candidates).toEqual([]);
 });
 it('sorts ties by stable ASCII id, independent of source ordering and locale', () => {
  const data = [clip('a2'), clip('a10'), clip('z'), clip('a-1')];
  const expected = ['a-1', 'a10', 'a2', 'z'];
  expect(matchMotions(catalog(...data), 'reach').candidates.map(row => row.id)).toEqual(expected);
  expect(matchMotions(catalog(...data.reverse()), 'reach').candidates.map(row => row.id)).toEqual(expected);
  expect(matchMotions(catalog(...data), 'reach', { top: 2 })).toMatchObject({ totalMatches: 4, candidates: [{ id: 'a-1' }, { id: 'a10' }] });
 });
 it('intersects emotion/contact/category/duration filters including exact duration boundary', () => {
  const rows = [clip('yes', { status: 'confirmed' }), clip('wrong-emotion', { emotion: ['angry'] }), clip('wrong-contact', { contacts: ['left-hand'] }), clip('wrong-category', { category: 'combat' }), clip('too-long', { durationS: 3, frames: 91 })];
  const result = matchMotions(catalog(...rows), 'reach', { emotion: 'tender', contact: 'right-hand', category: 'gesture', maxDuration: 2 });
  expect(result.candidates.map(row => row.id)).toEqual(['yes']);
  expect(result.candidates[0].requiresHumanConfirmation).toBe(false);
  expect(result.filters).toEqual({ emotion: 'tender', contact: 'right-hand', category: 'gesture', maxDuration: 2 });
 });
 it('does not fabricate relevance from filters or invent ids and does not mutate annotations', () => {
  const data = catalog(clip('actual')); const before = JSON.stringify(data);
  expect(matchMotions(data, 'unknown unicorn', { emotion: 'tender' })).toMatchObject({ totalMatches: 0, candidates: [] });
  expect(matchMotions(data, 'reach').candidates.map(row => row.id)).toEqual(['actual']);
  expect(JSON.stringify(data)).toBe(before);
 });
 it('validates even excluded metadata and refuses duplicate stable ids', () => {
  expect(() => matchMotions(catalog(clip('bad', { emotion: ['invented'] })), 'reach', { category: 'combat' })).toThrow();
  expect(() => matchMotions(catalog(clip('same'), clip('same')), 'reach')).toThrow(/duplicate/);
 });
});
describe('strict read-only motion-match CLI', () => {
 it.each([['--typo', 'x'], ['beat', '--top', 'NaN'], ['beat', '--top', 'Infinity'], ['beat', '--top', '1.2'], ['beat', '--top', '0'], ['beat', '--top', '1001'], ['beat', '--top', '0x10'], ['beat', '--max-duration', '0'], ['beat', '--max-duration', '1e999'], ['beat', '--emotion', 'confused'], ['beat', '--contact', 'face'], ['beat', '--category', 'dance'], ['beat', '--emotion'], ['beat', '--top', '2', '--top', '3'], ['one', 'two'], ['beat', '--lib', 'a', '--catalog', 'b']])('rejects malformed options %j', (...args) => expect(() => parseArgs(args)).toThrow());
 it('emits explicit empty JSON and a reject reason, without changing catalog', async () => {
  const file = fixture(catalog(clip('actual'))); const before = readFileSync(file); const out = [], log = [];
  expect(await main(['unicorn', '--catalog', file], { out: value => out.push(value), log: value => log.push(value) })).toBe(0);
  expect(JSON.parse(out[0])).toMatchObject({ totalMatches: 0, candidates: [] });
  expect(log[0]).toContain('[motion-match] reject');
  expect(readFileSync(file)).toEqual(before);
 });
 it('returns failure for invalid catalog and never emits candidate JSON', async () => {
  const file = fixture({ version: 1, clips: [{}], skins: [] }); const out = [], log = [];
  expect(await main(['reach', '--catalog', file], { out: value => out.push(value), log: value => log.push(value) })).toBe(1);
  expect(out).toEqual([]); expect(log[0]).toContain('reject');
 });
 it('executes as a real CLI with JSON-only stdout and locale-independent results', () => {
  const file = fixture(catalog(clip('a2'), clip('a10')));
  const run = locale => spawnSync(process.execPath, ['scripts/motion-match.mjs', 'reach', '--catalog', file, '--top', '2'], { encoding: 'utf8', env: { ...process.env, LANG: locale, LC_ALL: locale } });
  const a = run('C'), b = run('tr_TR.UTF-8');
  expect(a.status).toBe(0); expect(b.status).toBe(0); expect(a.stdout).toBe(b.stdout);
  expect(JSON.parse(a.stdout).candidates.map(row => row.id)).toEqual(['a10', 'a2']);
  expect(a.stderr).toContain('[motion-match] decision');
 });
});
