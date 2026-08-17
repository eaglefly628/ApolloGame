// 五个模块薄封装 + 通用闸的点名测试。
//
// ⚠ 同 `apps-gateway.test.mjs`：**不 mock SDK**。每条都把 SDK 自己的 host extension 接在一条
// 内存双工通道的另一端，走真 `dokiworld-app-<name>-request/response` 报文与真校验器。
// mock 掉宿主只能证明"我调了我以为存在的方法"，而这一层要防的恰恰是形状不一样。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechHostExtension } from '@dokiworld/app-sdk/speech';
import { createPersonaHostExtension } from '@dokiworld/app-sdk/persona';
import { createDialogueHostExtension } from '@dokiworld/app-sdk/dialogue';
import { createMediaHostExtension } from '@dokiworld/app-sdk/media';
import { createEpisodeHostExtension } from '@dokiworld/app-sdk/episode';
import {
  createSpeechGateway, createPersonaGateway, createDialogueGateway, createMediaGateway,
  createEpisodeBridge, pollMediaJob, declares, resolveEpisodeGameResult,
} from '../src/sdk-gateways.mjs';

/** 内存双工通道（报文形状读自 capability.js：`send(type, payload)` → 对端 `{type, payload}`）。 */
function channelPair() {
  const listeners = { a: new Set(), b: new Set() };
  const side = (mine, theirs) => ({
    send: (type, payload) => { for (const fn of listeners[theirs]) fn({ type, payload }); },
    onMessage: (fn) => { listeners[mine].add(fn); return () => listeners[mine].delete(fn); },
  });
  return { client: side('a', 'b'), host: side('b', 'a') };
}

test('declares：只有 runtime.extensions 真含那个名字才算声明过', () => {
  const m = { runtime: { extensions: ['apps', 'speech'] } };
  assert.equal(declares(m, 'speech'), true);
  assert.equal(declares(m, 'persona'), false);
  assert.equal(declares({}, 'speech'), false);
  assert.equal(declares(undefined, 'speech'), false);
});

test('【speech】声明了就真合成；宿主不实现 ⇒ null（调用方退本地 TTS·不抛）', async () => {
  const { client, host } = channelPair();
  const seen = [];
  createSpeechHostExtension(host, {
    synthesize: (input) => { seen.push(input); return { audioUrl: 'https://cdn/a.mp3', cached: true }; },
  });
  const gw = createSpeechGateway(client, { declared: true });
  assert.equal(gw.available, true);
  assert.deepEqual(await gw.synthesize({ text: '来啊', characterId: 'c1', locale: 'zh-cn' }),
    { audioUrl: 'https://cdn/a.mp3', cached: true });
  assert.deepEqual(seen, [{ text: '来啊', characterId: 'c1', locale: 'zh-cn' }]);
  gw.dispose();

  const { client: c2, host: h2 } = channelPair();
  createSpeechHostExtension(h2, {});                       // 不实现 ⇒ unsupported-operation
  const warns = [];
  const gw2 = createSpeechGateway(c2, { declared: true, onWarn: (w) => warns.push(w) });
  assert.equal(await gw2.synthesize({ text: 'x', characterId: 'c1' }), null);
  assert.deepEqual(warns, [{ capability: 'speech', op: 'synthesize', reason: 'unsupported-operation' }]);
  gw2.dispose();
});

test('【persona】三个操作各自透传；未声明 ⇒ **一个字节都不发**，全走降级值', async () => {
  const { client, host } = channelPair();
  const P = { id: 'p1', name: '小樱', avatarUrl: 'https://cdn/p.png' };
  createPersonaHostExtension(host, {
    list: () => ({ personas: [P] }),
    getSelected: ({ characterId }) => ({ persona: characterId === 'c1' ? P : null }),
    requestSelection: () => ({ persona: P }),
  });
  const gw = createPersonaGateway(client, { declared: true });
  assert.deepEqual((await gw.list()).personas.map((x) => x.name), ['小樱']);
  assert.equal((await gw.getSelected('c1')).persona.name, '小樱');
  assert.equal((await gw.getSelected('nope')).persona, null);
  assert.equal((await gw.requestSelection('c1')).persona.name, '小樱');
  gw.dispose();

  // 未声明：宿主那一半**根本没被叫到**（发了再被拒 = 卡满超时才失败，最难查的那一类）
  const { client: c2, host: h2 } = channelPair();
  const called = [];
  createPersonaHostExtension(h2, { list: () => { called.push('list'); return { personas: [P] }; } });
  const gw2 = createPersonaGateway(c2, {});                 // declared 缺省 = false
  assert.equal(gw2.available, false);
  assert.deepEqual(await gw2.list(), { personas: [] });
  assert.deepEqual(called, []);
  assert.equal(gw2.lastReason(), 'not-declared');
});

test('【dialogue】五个操作齐活；失败一次后再成功，lastReason 会被抹掉（面板读它）', async () => {
  const { client, host } = channelPair();
  let boom = true;
  createDialogueHostExtension(host, {
    generateOpening: () => {
      if (boom) throw Object.assign(new Error('x'), { code: 'llm-down' });
      return { openingLine: '就你也配跟我猜拳？', segments: [] };
    },
    generateSuggestions: () => ({ suggestions: ['出石头', '诈他一手'] }),
    generateTagline: () => ({ tagline: '三拳定生死' }),
  });
  const warns = [];
  const gw = createDialogueGateway(client, { declared: true, onWarn: (w) => warns.push(w) });

  assert.equal(await gw.generateOpening({ characterId: 'c1' }), null);      // 降级：调用方退本地台词
  assert.equal(gw.lastReason(), 'llm-down');
  boom = false;
  assert.equal((await gw.generateOpening({ characterId: 'c1' })).openingLine, '就你也配跟我猜拳？');
  assert.equal(gw.lastReason(), null, '成功一次就该把上一次的失败抹掉——面板不该一直挂着旧红字');
  assert.deepEqual((await gw.generateSuggestions({ characterId: 'c1' })).suggestions.length, 2);
  assert.equal((await gw.generateTagline({ characterId: 'c1' })).tagline, '三拳定生死');
  // 宿主没实现的那两个走降级，且**不影响**已实现的那几个
  assert.equal(await gw.generateDialogue({ characterId: 'c1', playerInput: 'hi' }), null);
  assert.deepEqual(warns.map((w) => w.reason), ['llm-down', 'unsupported-operation']);
  gw.dispose();
});

test('【media】异步 job 轮询到终态；降级值是**同形假 job**（调用方不必先判 null）', async () => {
  const { client, host } = channelPair();
  let polls = 0;
  createMediaHostExtension(host, {
    generateImage: () => ({ id: 'job-1', mediaType: 'image', status: 'pending' }),
    getJob: () => {
      polls += 1;
      return polls < 3
        ? { id: 'job-1', mediaType: 'image', status: 'processing' }
        : { id: 'job-1', mediaType: 'image', status: 'done', urls: ['https://cdn/win.png'] };
    },
  });
  const gw = createMediaGateway(client, { declared: true });
  const started = await gw.generateImage({ prompt: '战报图' });
  assert.equal(started.status, 'pending');
  const done = await pollMediaJob(gw, started.id, { tries: 10, sleep: async () => {} });
  assert.deepEqual([done.status, done.urls], ['done', ['https://cdn/win.png']]);
  gw.dispose();

  // 未声明：拿到的仍是一个**能读 .status 的 job**，不是 null —— 调用方的分支一行不用改
  const dead = createMediaGateway(undefined, {});
  const j = await dead.generateImage({ prompt: 'x' });
  assert.deepEqual([j.status, j.mediaType], ['failed', 'image']);
  assert.deepEqual(await dead.cancelJob('x'), { cancelled: false });
});

test('【media】轮询封顶也不抛：一直 processing 就把当前 job 原样交回', async () => {
  const { client, host } = channelPair();
  createMediaHostExtension(host, {
    generateImage: () => ({ id: 'j', mediaType: 'image', status: 'pending' }),
    getJob: () => ({ id: 'j', mediaType: 'image', status: 'processing' }),
  });
  const gw = createMediaGateway(client, { declared: true });
  const job = await pollMediaJob(gw, 'j', { tries: 3, sleep: async () => {} });
  assert.equal(job.status, 'processing');   // 没抛、没死等——"还没好"是个正常世界
  gw.dispose();
});

test('【episode】gameCompleted 事件真发得出去，宿主那半收得到（单向流·非 capability）', async () => {
  const { client, host } = channelPair();
  const inbox = [];
  // episode 的两半都是纯 send/receive：宿主侧 receive 把 client 发来的报文解回事件
  const hostExt = createEpisodeHostExtension({ send: host.send });
  host.onMessage((m) => { const ev = hostExt.receive(m); if (ev) inbox.push(ev); });

  const bridge = createEpisodeBridge({ send: client.send }, { declared: true });
  assert.equal(bridge.available, true);
  const output = { contract: 'doki.game.result', version: 1, data: { normalizedScore: 92, outcome: 'win', metrics: { round: 6 } } };
  bridge.send({ type: 'episode.gameCompleted', configId: 'duel-1', output });
  assert.equal(inbox.length, 1);
  assert.deepEqual([inbox[0].type, inbox[0].output.data.normalizedScore], ['episode.gameCompleted', 92]);
});

test('【episode】未声明 ⇒ send 是真的 no-op（不发报文·只 warn）', () => {
  const { client, host } = channelPair();
  const seen = [];
  host.onMessage((m) => seen.push(m));
  const warns = [];
  const bridge = createEpisodeBridge({ send: client.send }, { onWarn: (w) => warns.push(w) });
  assert.equal(bridge.available, false);
  assert.equal(bridge.send({ type: 'episode.start' }), null);
  assert.deepEqual(seen, []);
  assert.deepEqual(warns, [{ capability: 'episode', op: 'episode.start', reason: 'not-declared' }]);
});

test('【episode】resolveEpisodeGameResult：同一份战果按 routes 落到不同 beat', () => {
  const out = (score, outcome) => ({ contract: 'doki.game.result', version: 1, data: { normalizedScore: score, outcome, metrics: {} } });
  const routes = [
    { id: 'crush', when: { outcomes: ['win'], minScore: 90 }, nextBeatId: 'beat-brag' },
    { id: 'win', when: { outcomes: ['win'] }, nextBeatId: 'beat-nod' },
    { id: 'lose', when: { outcomes: ['loss'] }, nextBeatId: 'beat-tease' },
  ];
  assert.equal(resolveEpisodeGameResult(out(96, 'win'), routes)?.nextBeatId, 'beat-brag');
  assert.equal(resolveEpisodeGameResult(out(61, 'win'), routes)?.nextBeatId, 'beat-nod');   // 顺序即优先级
  assert.equal(resolveEpisodeGameResult(out(12, 'loss'), routes)?.nextBeatId, 'beat-tease');
  // 一条都不命中 ⇒ routeId=null（配 fallback 用），**不是抛**
  assert.equal(resolveEpisodeGameResult(out(50, 'exited'), routes)?.routeId, null);
});

test('通用闸：dispose 幂等，之后一律降级且不再打扰宿主（五个模块共用这一条）', async () => {
  const { client, host } = channelPair();
  const called = [];
  createSpeechHostExtension(host, {
    synthesize: () => { called.push('s'); return { audioUrl: 'u', cached: false }; },
  });
  const gw = createSpeechGateway(client, { declared: true });
  assert.ok(await gw.synthesize({ text: 'a', characterId: 'c' }));
  gw.dispose(); gw.dispose(); gw.dispose();
  assert.equal(await gw.synthesize({ text: 'b', characterId: 'c' }), null);
  assert.deepEqual(called, ['s']);
  assert.equal(gw.lastReason(), 'disposed');
});
