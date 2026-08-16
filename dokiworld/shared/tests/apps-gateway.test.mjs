// 「获取卡带」薄适配的点名测试。
//
// ⚠ **不 mock SDK**：下面每一条都把 `createAppsHostExtension`（宿主那一半，SDK 自己的）
// 接在一条内存双工通道的另一端，请求/响应走的是 SDK 真正的那套
// `dokiworld-app-apps-request/response` 报文 + 真正的入参出参校验器（`apps.js` 的 `definition`）。
// mock 掉宿主的话，这些断言只能证明"我调了我以为存在的方法"——而本层要防的恰恰是
// 「我以为的形状和它真正的形状不一样」（本仓踩过的所有静默失效都是这个形状）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppsHostExtension } from '@dokiworld/app-sdk/apps';
import { createAppsGateway, appsDeclared, DEFAULT_APP_LAUNCH_TIMEOUT_MS } from '../src/apps-gateway.mjs';

/**
 * 内存双工通道：一端 `send(type, payload)` → 另一端的 onMessage 收到 `{type, payload}`。
 * 报文形状取自 `capability.js`（`client.send(requestType, {...})` / `onMessage(message => message.type)`）
 * ——**读源码定的，不是猜的**；猜错的话下面全部会红在第一条。
 */
function channelPair() {
  const listeners = { a: new Set(), b: new Set() };
  const side = (mine, theirs) => ({
    send: (type, payload) => { for (const fn of listeners[theirs]) fn({ type, payload }); },
    onMessage: (fn) => { listeners[mine].add(fn); return () => listeners[mine].delete(fn); },
  });
  return { client: side('a', 'b'), host: side('b', 'a') };
}

const APP = { id: 'game108', name: '拳律', protocolVersion: 2 };

test('appsDeclared：只有 manifest 的 runtime.extensions 真含 apps 才算声明过', () => {
  assert.equal(appsDeclared({ runtime: { extensions: ['apps'] } }), true);
  assert.equal(appsDeclared({ runtime: { extensions: ['character', 'storage'] } }), false);
  assert.equal(appsDeclared({ runtime: {} }), false);
  assert.equal(appsDeclared({}), false);
  assert.equal(appsDeclared(undefined), false);
});

test('没声明 apps ⇒ **一个字节都不发**，直接降级（规范 §7：未声明的扩展消息会被拒绝）', async () => {
  const { client, host } = channelPair();
  const seen = [];
  createAppsHostExtension(host, { list: () => { seen.push('list'); return { apps: [APP] }; } });
  const warns = [];
  // declared 缺省就是 false —— 「没明说就当没声明」，这一条同时钉住那个缺省。
  const gw = createAppsGateway(client, { onWarn: (w) => warns.push(w) });

  assert.equal(gw.available, false);
  assert.deepEqual(await gw.list(), []);
  assert.deepEqual(await gw.launch({ appId: 'x', contract: 'c' }), { status: 'unavailable', reason: 'not-declared' });
  // 要害：宿主那一半**根本没被叫到**。发了再被拒的表症是"卡满超时才失败"，最难查的那一类。
  assert.deepEqual(seen, []);
  assert.deepEqual(warns, [{ op: 'list', reason: 'not-declared' }, { op: 'launch', reason: 'not-declared' }]);
  gw.dispose();   // 空壳的 dispose 也得能叫（调用方不该为两种形态写两条路）
});

test('声明了就真能列卡带：走 SDK 真报文，filter 原样送到宿主手里', async () => {
  const { client, host } = channelPair();
  const got = [];
  createAppsHostExtension(host, {
    list: (input) => { got.push(input); return { apps: [APP, { id: 'game101', name: '海港绯闻', protocolVersion: 2 }] }; },
  });
  const gw = createAppsGateway(client, { declared: true });
  assert.equal(gw.available, true);

  const all = await gw.list();
  assert.deepEqual(all.map((a) => a.id), ['game108', 'game101']);
  const filtered = await gw.list({ capability: 'game.duel.charge-rps' });
  assert.equal(filtered.length, 2);
  assert.deepEqual(got, [{}, { capability: 'game.duel.charge-rps' }]);   // 锚点：过滤条件没被吞
  gw.dispose();
});

test('list 失败/宿主没实现 ⇒ 空数组 + warn（**恒返回数组·不抛**）', async () => {
  const { client, host } = channelPair();
  createAppsHostExtension(host, {});          // 宿主没挂 list ⇒ SDK 回 unsupported-operation
  const warns = [];
  const gw = createAppsGateway(client, { declared: true, onWarn: (w) => warns.push(w) });

  assert.deepEqual(await gw.list(), []);
  assert.deepEqual(warns, [{ op: 'list', reason: 'unsupported-operation' }]);
  gw.dispose();
});

test('launch 三态各归各位：completed 带 output · cancelled 是正常结局 · 抛错才叫 unavailable', async () => {
  const { client, host } = channelPair();
  let mode = 'completed';
  const seen = [];
  createAppsHostExtension(host, {
    launch: (input) => {
      seen.push(input);
      if (mode === 'completed') return { status: 'completed', output: { contract: 'doki.game.result', version: 1, data: { winner: 'p1' } } };
      if (mode === 'cancelled') return { status: 'cancelled' };
      throw Object.assign(new Error('boom'), { code: 'host-exploded' });
    },
  });
  const warns = [];
  const gw = createAppsGateway(client, { declared: true, onWarn: (w) => warns.push(w) });

  const done = await gw.launch({ appId: 'game108', contract: 'doki.game.game108-input', data: { rounds: 3 } });
  assert.deepEqual(done, { status: 'completed', output: { contract: 'doki.game.result', version: 1, data: { winner: 'p1' } } });
  // 锚点：契约信封是本层拼的（appId/contract/version/data → {appId, input:{contract,version,data}}）。
  assert.deepEqual(seen[0], { appId: 'game108', input: { contract: 'doki.game.game108-input', version: 1, data: { rounds: 3 } } });

  mode = 'cancelled';
  assert.deepEqual(await gw.launch({ appId: 'game108', contract: 'c' }), { status: 'cancelled' });

  mode = 'throw';
  assert.deepEqual(await gw.launch({ appId: 'game108', contract: 'c' }), { status: 'unavailable', reason: 'host-exploded' });
  // cancelled 不该报 warn —— 玩家退出那个 App 是正常结局，不是降级。
  assert.deepEqual(warns, [{ op: 'launch', reason: 'host-exploded' }]);
  gw.dispose();
});

test('launch 参数不全 ⇒ 立刻 unavailable，**不发消息**（别把接线错养成一次超时）', async () => {
  const { client, host } = channelPair();
  const seen = [];
  createAppsHostExtension(host, { launch: (i) => { seen.push(i); return { status: 'cancelled' }; } });
  const gw = createAppsGateway(client, { declared: true });

  assert.deepEqual(await gw.launch({}), { status: 'unavailable', reason: 'invalid-request' });
  assert.deepEqual(await gw.launch({ appId: 'x' }), { status: 'unavailable', reason: 'invalid-request' });
  assert.deepEqual(await gw.launch(), { status: 'unavailable', reason: 'invalid-request' });
  assert.deepEqual(seen, []);
  gw.dispose();
});

test('dispose 幂等，且之后一律降级（不是抛，也不是继续发消息）', async () => {
  const { client, host } = channelPair();
  const seen = [];
  createAppsHostExtension(host, { list: () => { seen.push('list'); return { apps: [APP] }; } });
  const warns = [];
  const gw = createAppsGateway(client, { declared: true, onWarn: (w) => warns.push(w) });

  assert.equal((await gw.list()).length, 1);
  gw.dispose(); gw.dispose(); gw.dispose();          // 幂等：叫三次不炸
  assert.deepEqual(await gw.list(), []);
  assert.deepEqual(await gw.launch({ appId: 'a', contract: 'c' }), { status: 'unavailable', reason: 'disposed' });
  assert.deepEqual(seen, ['list']);                  // dispose 之后没再打扰宿主
  assert.deepEqual(warns, [{ op: 'list', reason: 'disposed' }, { op: 'launch', reason: 'disposed' }]);
});

test('超时按操作分档：list 用普通超时、launch 用一小时（玩家正在玩那个 App）', async () => {
  const { client, host } = channelPair();
  createAppsHostExtension(host, {});                 // 挂着但两个 handler 都不实现 ⇒ 不影响本条
  const warns = [];
  // list 给 20ms、launch 不给（吃 SDK 默认一小时）。宿主故意**不回**，只有超时能救场。
  const dead = { send: () => {}, onMessage: () => () => {} };
  const gw = createAppsGateway(dead, { declared: true, timeoutMs: 20, onWarn: (w) => warns.push(w) });

  const t0 = Date.now();
  assert.deepEqual(await gw.list(), []);
  assert.deepEqual(warns, [{ op: 'list', reason: 'timeout' }]);
  assert.ok(Date.now() - t0 < 1000, 'list 该按传入的 20ms 超时，不该吃 30 秒默认值');

  // launch 的默认值**不许被磨平成 list 那档**。断常量太弱（那只证明我抄对了数字），
  // 这里断**行为**：同一台 gateway 只给了 20ms 的 `timeoutMs`，launch 却必须**不会**在 200ms 内失败
  // ——磨平的话（把 timeoutMs 也套给 launch）这条当场红。
  const pending = gw.launch({ appId: 'a', contract: 'c' });
  const raced = await Promise.race([pending, new Promise((r) => setTimeout(() => r('still-waiting'), 200))]);
  assert.equal(raced, 'still-waiting', 'launch 吃了 list 的短超时 ⇒ 玩家还在玩、我方已判失败');
  assert.equal(DEFAULT_APP_LAUNCH_TIMEOUT_MS, 60 * 60 * 1000);
  gw.dispose();                                    // dispose 会把挂着的 launch 结掉，进程不吊住
  assert.deepEqual(await pending, { status: 'unavailable', reason: 'disposed' });
  void host;
});

test('launchTimeoutMs 真的透传给 launch（不是只写在文档里）', async () => {
  const dead = { send: () => {}, onMessage: () => () => {} };
  const warns = [];
  const gw = createAppsGateway(dead, { declared: true, launchTimeoutMs: 20, onWarn: (w) => warns.push(w) });
  const t0 = Date.now();
  assert.deepEqual(await gw.launch({ appId: 'a', contract: 'c' }), { status: 'unavailable', reason: 'timeout' });
  assert.ok(Date.now() - t0 < 1000, '传了 20ms 却等了更久 ⇒ 参数没透传');
  assert.deepEqual(warns, [{ op: 'launch', reason: 'timeout' }]);
  gw.dispose();
});
