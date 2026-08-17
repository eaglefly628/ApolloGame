// 投影⑤（`apps.list()` → 终局屏推荐位）点名测试。语义钉死在两件事上：
//   ① **拉不起来的不画**——SDK 的 launch 要 `input:{contract,version,data}`，contract 只能来自
//      被列 App 自己的 `runtime.input`；拿不到就不该给玩家一颗点了报错的键（且必须计入 skipped 留痕）。
//   ② 自己不推荐自己 · 无名用 id 顶 · 重名去重 · 坏形状不炸。
import test from 'node:test';
import assert from 'node:assert/strict';
import { toAppPicks, launchTargetOf } from '../src/app-picks.mjs';

const app = (id, extra = {}) => ({
  id, name: `App ${id}`, protocolVersion: 2,
  runtime: { input: { contract: `doki.game.${id}-input`, version: 1 } },
  ...extra,
});

test('可拉起的进推荐位：带 id/name/cover，并落 launchable 的 contract/version', () => {
  const { picks, launchable, skipped } = toAppPicks(
    [app('match3', { coverUrl: 'https://h/c.webp' }), app('storyteller')],
    { selfId: 'game108' },
  );
  assert.deepEqual(picks, [
    { id: 'match3', name: 'App match3', cover: 'https://h/c.webp' },
    { id: 'storyteller', name: 'App storyteller' },
  ]);
  assert.deepEqual(launchable.get('match3'), { contract: 'doki.game.match3-input', version: 1 });
  assert.equal(skipped, 0);
});

test('拿不到 runtime.input.contract → 不画那一格且计入 skipped（宁可少一格，不给点了报错的键）', () => {
  const noRuntime = { id: 'a', name: 'A', protocolVersion: 2 };
  const noInput = { id: 'b', name: 'B', protocolVersion: 2, runtime: {} };
  const emptyContract = { id: 'c', name: 'C', protocolVersion: 2, runtime: { input: { contract: '', version: 1 } } };
  const badType = { id: 'd', name: 'D', protocolVersion: 2, runtime: { input: { contract: 42 } } };
  const { picks, launchable, skipped } = toAppPicks([noRuntime, noInput, emptyContract, badType, app('ok')]);
  assert.deepEqual(picks.map((p) => p.id), ['ok']);
  assert.equal(launchable.size, 1);
  assert.equal(skipped, 4);
});

test('version 缺省/非整数 → 1（contract 才是身份·version 只是修订）', () => {
  assert.deepEqual(launchTargetOf({ runtime: { input: { contract: 'x' } } }), { contract: 'x', version: 1 });
  assert.deepEqual(launchTargetOf({ runtime: { input: { contract: 'x', version: 2.5 } } }), { contract: 'x', version: 1 });
  assert.deepEqual(launchTargetOf({ runtime: { input: { contract: 'x', version: 3 } } }), { contract: 'x', version: 3 });
});

test('自己不推荐自己（不算 skipped——那不是「拉不起来」）', () => {
  const { picks, skipped } = toAppPicks([app('game108'), app('other')], { selfId: 'game108' });
  assert.deepEqual(picks.map((p) => p.id), ['other']);
  assert.equal(skipped, 0);
});

test('无名 → 拿 id 顶（不画空标签）；重名 → 先到先得', () => {
  const { picks } = toAppPicks([
    { id: 'x', protocolVersion: 2, runtime: { input: { contract: 'c' } } },
    { ...app('x'), name: '后到的' },
  ]);
  assert.deepEqual(picks, [{ id: 'x', name: 'x' }]);
});

test('坏输入一律不炸：非数组 / null / 非对象条目 / 无 id', () => {
  for (const bad of [undefined, null, 'nope', 42, {}]) {
    assert.deepEqual(toAppPicks(bad).picks, []);
  }
  const { picks, skipped } = toAppPicks([null, 'x', 7, { name: '无 id' }, app('ok')]);
  assert.deepEqual(picks.map((p) => p.id), ['ok']);
  assert.equal(skipped, 3);   // null/'x'/7 三条坏体计入；{name} 无 id 静默跳过（不是「拉不起来」）
});

test('空列表 → 空推荐位（终局屏整条不画的那条路）', () => {
  assert.deepEqual(toAppPicks([], { selfId: 'game108' }), { picks: [], launchable: new Map(), skipped: 0 });
});
