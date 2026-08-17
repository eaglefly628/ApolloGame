// dokiworld/shared · **五个 capability 模块的薄封装**（speech / persona / dialogue / media / episode）。
//
// owner 2026-08-17：「我想实践一下所有 SDK 的功能，请把它全部埋点在我们的游戏中，做一个 demonstration」。
//
// 每一个都只做两件事：**把 SDK 的形状原样转出来** + **说清楚叫不通时返回什么**（降级值）。
// 闸（声明门 / 降级不抛 / dispose 幂等）全在 `capability-gateway.mjs`，这里一行都不重复。
//
// ⚠ **降级值的选法是有讲究的，不是随手 null**：调用方拿到降级值之后**不该需要判断**——
//    「没拿到台词」和「拿到空台词」必须长得一样（都走本地兜底），否则每个调用点都要写一遍 if。
//    故：列表类 → 空数组 · 单值类 → null · 任务类 → 一个 status:'failed' 的假 job（同形）。
//
// ⚠ `episode` **形状不同**：它不是 request/response 的 capability，是**单向事件流**
//    （`send(event)` / `receive(message)`），所以不走那个闸，单独一个薄封装。
import { createSpeechClientExtension } from '@dokiworld/app-sdk/speech';
import { createPersonaClientExtension } from '@dokiworld/app-sdk/persona';
import { createDialogueClientExtension } from '@dokiworld/app-sdk/dialogue';
import { createMediaClientExtension } from '@dokiworld/app-sdk/media';
import { createEpisodeClientExtension, resolveEpisodeGameResult } from '@dokiworld/app-sdk/episode';
import { createGuardedCapability, declares } from './capability-gateway.mjs';

export { declares, resolveEpisodeGameResult };

const opts = (timeoutMs) => (timeoutMs === undefined ? undefined : { timeoutMs });

/**
 * 【speech】角色配音：把一句台词交给宿主合成，拿回可播的 audioUrl。
 * 降级 → `null`：调用方退回本地 TTS，再退字幕（game108 本来就有这条三级降级链）。
 */
export const createSpeechGateway = (client, { declared, timeoutMs, onWarn } = {}) =>
  createGuardedCapability({
    name: 'speech', declared, client, onWarn,
    create: (c) => createSpeechClientExtension(c, opts(timeoutMs)),
    fallbacks: { synthesize: () => null },
  });

/**
 * 【persona】玩家身份：宿主侧「我是谁」——名字、头像、喜好。
 * `requestSelection` 会**弹宿主的选择器**（有 UI 副作用·别在开局静默调，那是替玩家做主）。
 * 降级 → 列表空 / 单值 null：调用方退回「你」+ 首字。
 */
export const createPersonaGateway = (client, { declared, timeoutMs, onWarn } = {}) =>
  createGuardedCapability({
    name: 'persona', declared, client, onWarn,
    create: (c) => createPersonaClientExtension(c, opts(timeoutMs)),
    fallbacks: {
      list: () => ({ personas: [] }),
      getSelected: () => ({ persona: null }),
      requestSelection: () => ({ persona: null }),
    },
  });

/**
 * 【dialogue】角色台词生成：开场白 / 对话 / 建议回复 / 一句 tagline。
 * 降级 → null / 空：调用方退回本地写死的台词表（`voice.ts voiceLine`）。
 */
export const createDialogueGateway = (client, { declared, timeoutMs, onWarn } = {}) =>
  createGuardedCapability({
    name: 'dialogue', declared, client, onWarn,
    create: (c) => createDialogueClientExtension(c, opts(timeoutMs)),
    fallbacks: {
      generateDialogue: () => null,
      regenerateDialogue: () => null,
      generateOpening: () => null,
      generateSuggestions: () => ({ suggestions: [] }),
      generateTagline: () => null,
    },
  });

/**
 * 【media】文生图/视频：**异步 job**（pending → processing → done/failed），要轮询 `getJob`。
 * 降级 → 一个 `status:'failed'` 的**同形假 job**：调用方的 `job.status` 分支照走，不必先判 null。
 */
export const createMediaGateway = (client, { declared, timeoutMs, onWarn } = {}) => {
  const dead = (mediaType) => ({ id: '', mediaType, status: 'failed', error: 'unavailable' });
  return createGuardedCapability({
    name: 'media', declared, client, onWarn,
    create: (c) => createMediaClientExtension(c, opts(timeoutMs)),
    fallbacks: {
      generateImage: () => dead('image'),
      generateVideo: () => dead('video'),
      getJob: () => dead('image'),
      cancelJob: () => ({ cancelled: false }),
    },
  });
};

/**
 * 轮询一个 media job 到终态。**墙钟只用在这里**：它是宿主侧的异步作业进度，与世界时钟无关
 * （游戏内一切计时仍按 tick——「表现层也别引入第二个时钟」那条纪律管的是**参与规则的计时**）。
 * @returns 终态 job（超出 `tries` 也返回当前 job·**不抛**，同纪律②）
 */
export async function pollMediaJob(media, jobId, { tries = 20, stepMs = 1_500, sleep } = {}) {
  const wait = sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let job = await media.getJob(jobId);
  for (let i = 0; i < tries && (job?.status === 'pending' || job?.status === 'processing'); i++) {
    await wait(stepMs);
    job = await media.getJob(jobId);
  }
  return job;
}

/**
 * 【episode】剧情事件流 —— **不是 capability**：`send(event)` 单向发、`receive(message)` 解包。
 * 没有请求/响应配对，所以没有超时、也无从"降级"；未声明时给一台**真的什么都不做**的空壳。
 *
 * 对 Game 形态最要紧的一条事件是 `episode.gameCompleted`：把本局的 `GameResult`
 * 交给剧情去路由下一拍（配 `resolveEpisodeGameResult(output, routes)` 算落到哪个 beat）。
 * 这正是「结算数据往外放」的**第二条出口**——`app.complete` 是交给宿主记分，
 * 这一条是交给**剧情**决定接下来演什么。
 */
export function createEpisodeBridge(client, { declared, onWarn } = {}) {
  if (!declared || !client || typeof client.send !== 'function') {
    const reason = declared ? 'no-channel' : 'not-declared';
    return Object.freeze({
      available: false,
      send: (event) => { try { onWarn?.({ capability: 'episode', op: event?.type ?? 'send', reason }); } catch { /* 观察口自炸不影响主路 */ } return null; },
      receive: () => null,
      dispose: () => {},
    });
  }
  const ext = createEpisodeClientExtension(client);
  return Object.freeze({
    available: true,
    send: (event) => ext.send(event),
    receive: (message) => ext.receive(message),
    dispose: () => {},        // episode 无订阅可退（send/receive 是纯函数对），留个同形的空实现
  });
}
