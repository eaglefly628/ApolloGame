// dokiworld/game108 · SDK 接线层（薄·**零玩法逻辑**·手册 dokiworld-pack.md「薄接线零规则」）。
// 只做四个投影：启动参数 → 游戏配置（locale/角色）、终局机读态 → GameResult、
// 挂起 ⇄ 恢复（世界快照 ⇄ storage checkpoint·传输编码见 checkpoint-codec.mjs）、
// 授权角色资料 → 对局角色（降级链见 foe-card.mjs）。
// 玩法一概在 games/game108 的 blueprint 数据 + 引擎能力里；本文件不写一条规则。
import { createAppClient } from '@dokiworld/app-sdk';
import { createGameResult } from '@dokiworld/app-sdk/game-result';
import { createStorageClientExtension } from '@dokiworld/app-sdk/storage';
import { createCharacterClientExtension } from '@dokiworld/app-sdk/character';
import { createAppsGateway } from '../../shared/src/apps-gateway.mjs';
// 五个新模块的薄封装 + episode 桥（共享层·闸与降级见 capability-gateway.mjs 文件头三条纪律）。
import {
  createSpeechGateway, createPersonaGateway, createDialogueGateway, createMediaGateway,
  createEpisodeBridge, pollMediaJob, resolveEpisodeGameResult,
} from '../../shared/src/sdk-gateways.mjs';
import { toAppPicks } from './app-picks.mjs';
import { mount, setCard, setWorldObserver, setWorldRestore, setAppPicks, onAppPick, setSdkRows, onSdkTry, setMyPersona, setVoiceClips, setVoiceLines, setStakes, setSdkLog, setAppVersion } from '../../../games/game108/index.js';
import { fromPlatformCard, MOODS, type Mood } from '../../../games/game108/card-character.js';
import type { PlatformCharacterDraft } from '@zerocraft/engine/services/character-card/index.js';
import { saveLang } from '../../../games/game108/strings.js';
// 演示台的 speech/dialogue 探针要**用游戏自己的那句台词**（屏上说的和这里合成的是同一句）。
import { voiceLine } from '../../../games/game108/voice.js';
import { toGameResult } from './to-game-result.mjs';
import { packWorld, unpackWorld, toCheckpoint, fromCheckpoint } from './checkpoint-codec.mjs';
import { hasScope, characterToDraft } from './foe-card.mjs';

const APP_ID = 'game108';
/**
 * 【版本号】构建时由 `scripts/build.mjs` 的 `define` 注入（值 = `package.json.version`）。
 * **不许在这里写字面量**——版本的唯一真相是 package.json（manifest 也是抄它的），
 * 手抄一份就是第三处真相；而屏上那个号恰恰是 owner 用来判断"传上去的是不是最新版"的依据，
 * 显示错了比不显示更糟。开发态（vite dev 没走这个 define）时它是 undefined ⇒ 屏上不画。
 */
declare const __APP_VERSION__: string | undefined;
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined;
/** capability 请求超时：宿主没实现对应 host extension 时消息被静默丢弃，只有超时能兜住。
 *  init 前的 loadCheckpoint/getCurrent 都挂在这上面——太长=降级宿主里白等，太短=慢宿主误降级。 */
const CAPABILITY_TIMEOUT_MS = 2_000;
/** 生成类能力（dialogue/media）要跑 LLM/文生图，2 秒是给不够的——单开一档更宽的。
 *  太短 = 明明在生成却被判降级；太长 = 演示台按下去像卡住。20 秒是"人愿意等"的上限。 */
const DIALOGUE_TIMEOUT_MS = 20_000;
/**
 * **回合内**那条生成链的超时——必须**短于一个回合**（本作一回合约 12 秒）。
 * 给 20 秒会出现「上上回合的台词现在才到」：台词错位比没有台词更糟（她在为已经过去的事发言）。
 * 8 秒 = 生成通常够、而且一定在下一回合开始前收口。
 */
const ROUND_DIALOGUE_TIMEOUT_MS = 8_000;

/**
 * input contract `doki.game.game108-input/1`（本 App 自定·manifest.runtime.input）：
 *   { card?: PlatformCharacterDraft 形状的平台角色卡, mood?: 五心情之一 }
 * 全部可缺省：缺卡 = 游戏内置兜底卡；坏卡（桥判 usable:false）同缺省——绝不因输入炸屏。
 */
interface Game108Input {
  card?: Record<string, unknown>;
  mood?: string;
  /**
   * 【episode 反向】这一局的**赌注**——剧情侧说清楚"这一局是为什么打的"（如「输了要请她吃饭」）。
   * 屏上显示的是剧情，玩家不知道那是 SDK 传的。缺省 = 不画（非剧情宿主逐像素同旧版）。
   * SDK 那边对应的是 `DialogueGameConfig.stakes`（宿主拉起 Game 时带下来）。
   */
  stakes?: string;
}

/**
 * **声明的扩展 = 唯一那张表**（规范 §7 五步一致的第 2 步：manifest.runtime.extensions ⇔
 * 这里 ⇔ 真建的 Client extension ⇔ 宿主 host extension ⇔ 退出时 dispose()）。
 * 下面每个网关的 `declared` 都从它现推（`EXTENSIONS.includes(...)`）——写死 `declared:true`
 * 就是给自己留一个"改了 extensions 忘了改这里"的口子，而那种错的表症是**静默等到超时**。
 *
 * ══ 2026-08-18 按 SDK 3.0 + 样例仓 `tower-confessions` 重排 ══
 * 上一版声明了九个（含 `apps` / `episode`），真宿主里五个超时。样例仓这次补了两件东西，
 * 把原因说死了：
 *
 * ① README 给出了 **Host capability profile 表**——能不能拿到某个扩展，
 *    **不由 App 的 `kind` 决定，而由「这个 App 被哪台 Host 拉起」决定**：
 *      · Chat Game Host       = character checkpoint dialogue footprint media memory
 *                               persona progress resize resume speech storage
 *      · World Page Host      = apps character chat checkpoint dialogue episode footprint
 *                               media memory persona speech storage world
 *      · World Nested App Host= checkpoint progress resize
 *    `apps` 与 `episode` **只在 World Page Host 里有**——Game 无论声明与否都拿不到。
 *    这正是那五个超时的解释，也解释了为什么当时只有 `apps`（发出去没人回=空表，形同成功）
 *    和 `episode`（单向 send，本来就没有回信可等）"看起来没事"。
 * ② 新样例 `tower-confessions` = **第一个 `kind:game` 且真用 capability 的参考实现**，
 *    它声明的正是 Chat Game Host profile 里它用得上的那 8 个。我们照它排。
 *
 * ⚠ 一个 Game 可能被**两台**不同 Host 拉起（Chat Game Host / World Nested App Host），
 *   两者交集只有 checkpoint/progress/resize。故除这三个之外的一切**必须能降级**——
 *   这不是防御性编程，是协议的常态。降级由 `capability-gateway` 统一兜。
 */
const EXTENSIONS = ['character', 'dialogue', 'media', 'persona', 'progress', 'resize', 'speech', 'storage'] as const;
// ⚠ `game-result` **不在 extensions 里**：它不是 capability 扩展，是 App 的 output 契约
//（manifest.runtime.outputs + app.complete）。演示台把它单列一行是给人看的，不是给协议看的。
const app = createAppClient<Game108Input>({ appId: APP_ID, extensions: [...EXTENSIONS] });
const declared = (name: string): boolean => (EXTENSIONS as readonly string[]).includes(name);
const storage = createStorageClientExtension(app, { timeoutMs: CAPABILITY_TIMEOUT_MS });
const character = createCharacterClientExtension(app, { timeoutMs: CAPABILITY_TIMEOUT_MS });
// 「获取卡带」走共享层（`dokiworld/shared`·超时/降级/dispose 已封）。`declared` 不是随手写的 true：
// 它必须与上面那行 `extensions` 同真同假——未声明还发消息的表症是**静默等到超时**（纪律①）。
const apps = createAppsGateway(app, {
  declared: declared('apps'),
  timeoutMs: CAPABILITY_TIMEOUT_MS,
  onWarn: ({ op, reason }) => console.info(`[game108] apps.${op} 降级（${reason}）——推荐位不出现，对局照常`),
});

/**
 * 五个"演示台驱动"的模块（+ episode 桥）。`declared` 一律从 `EXTENSIONS` 现推，
 * 降级原因经 `onWarn` 落进演示台那一行的 detail —— **静默降级要看得见**，这正是这块面板的用处。
 */
/**
 * 【运行日志】owner 2026-08-17：「多点日志打出来，我们运行了什么，得到了什么」。
 *
 * 每一次 SDK 调用都落一条 `→`（发了什么）+ `←`（拿回什么 / 失败原因 + 耗时）。
 * 这不是装饰：真宿主里「没实现」和「慢」长得一模一样，**耗时是唯一能把它们分开的东西**；
 * 而"发了什么"能立刻分清是我方参数不对还是对方没接。
 *
 * ⚠ **只打摘要不打全文**：`args` 里可能有整段台词/整张快照（checkpoint 压缩包 4KB 起），
 * 原样 `JSON.stringify` 会把控制台刷爆、也会把玩家的话打进日志。故一律走 `brief()`。
 */
const SDK_LOG = '[game108][sdk]';
const brief = (v: unknown, max = 120): string => {
  if (v === undefined) return '';
  if (typeof v === 'string') return v.length > max ? `${v.slice(0, max)}…(${v.length}字)` : v;
  try {
    const t = JSON.stringify(v, (_k, x) => (typeof x === 'string' && x.length > max ? `${x.slice(0, 40)}…(${x.length}字)` : x));
    return t && t.length > max * 3 ? `${t.slice(0, max * 3)}…` : String(t);
  } catch { return String(v); }
};
/** 一条调用记录（面板也读它——不止控制台看得见）。 */
interface SdkCall { capability: string; op: string; ok: boolean; ms: number; detail: string }
const sdkCalls: SdkCall[] = [];
/**
 * 屏上那块日志区（**最新在最前**·最多留 40 条）。
 * iframe 里没有控制台，所以这一份才是 owner 真正读得到的那份；console 那份照打不误。
 * 每行带一个**本地时分秒**——判"这一条是刚才那次点击产生的、还是上一局的残留"全靠它。
 */
const screenLog: string[] = [];
const pushScreenLog = (line: string): void => {
  const d = new Date();
  const hh = `${d.getHours()}`.padStart(2, '0'), mm = `${d.getMinutes()}`.padStart(2, '0'), ss = `${d.getSeconds()}`.padStart(2, '0');
  screenLog.unshift(`${hh}:${mm}:${ss} ${line}`);
  if (screenLog.length > 40) screenLog.pop();
  setSdkLog([...screenLog]);
};
const logCall = (info: { capability: string; op: string; args?: unknown[]; ok: boolean; ms: number; result?: unknown; reason?: string }): void => {
  const sent = brief(info.args?.[0]);
  const got = info.ok ? brief(info.result) : `✗ ${info.reason}`;
  console.info(`${SDK_LOG} ${info.capability}.${info.op} → ${sent || '(无参数)'}`);
  console.info(`${SDK_LOG} ${info.capability}.${info.op} ← ${got}（${info.ms}ms）`);
  sdkCalls.push({ capability: info.capability, op: info.op, ok: info.ok, ms: info.ms, detail: got });
  if (sdkCalls.length > 200) sdkCalls.shift();     // 一局最多两百条，别把内存当日志盘
  pushScreenLog(`${info.capability}.${info.op} ${info.ok ? '✓' : '✗'} ${info.ok ? '' : `${info.reason} `}${info.ms}ms`);
};
/**
 * 裸 SDK 扩展（`character` / `storage`）**没有网关**，所以它们的调用要手工包一层同款日志。
 * 顺带把「抛出来」变成「记一笔再抛」——调用方原有的 try/catch 语义一个字不改。
 */
async function traced<T>(capability: string, op: string, args: unknown, run: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  console.info(`${SDK_LOG} ${capability}.${op} → ${brief(args) || '(无参数)'}`);
  try {
    const out = await run();
    const ms = Date.now() - t0;
    console.info(`${SDK_LOG} ${capability}.${op} ← ${brief(out)}（${ms}ms）`);
    sdkCalls.push({ capability, op, ok: true, ms, detail: brief(out) });
    pushScreenLog(`${capability}.${op} ✓ ${ms}ms`);
    return out;
  } catch (error) {
    const ms = Date.now() - t0;
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`${SDK_LOG} ${capability}.${op} ← ✗ ${reason}（${ms}ms）`);
    sdkCalls.push({ capability, op, ok: false, ms, detail: `✗ ${reason}` });
    pushScreenLog(`${capability}.${op} ✗ ${reason.slice(0, 40)} ${ms}ms`);
    throw error;
  }
}

const gwWarn = (row: string) => ({ op, reason }: { op: string; reason: string }): void => {
  sdkSet(row, { state: 'down', detail: `${op} → ${reason}` });
};
const speech = createSpeechGateway(app, { declared: declared('speech'), timeoutMs: CAPABILITY_TIMEOUT_MS, onWarn: gwWarn('speech') , onCall: logCall });
const persona = createPersonaGateway(app, { declared: declared('persona'), timeoutMs: CAPABILITY_TIMEOUT_MS, onWarn: gwWarn('persona') , onCall: logCall });
const dialogue = createDialogueGateway(app, { declared: declared('dialogue'), timeoutMs: ROUND_DIALOGUE_TIMEOUT_MS, onWarn: gwWarn('dialogue') , onCall: logCall });
const media = createMediaGateway(app, { declared: declared('media'), timeoutMs: DIALOGUE_TIMEOUT_MS, onWarn: gwWarn('media') , onCall: logCall });
const episode = createEpisodeBridge(app, { declared: declared('episode'), onWarn: gwWarn('episode'), onCall: logCall });

/**
 * **演示台专用的一套长超时实例**（owner 2026-08-17 在真 DokiWorld 截图带出）。
 *
 * 产品路上那 2 秒（`CAPABILITY_TIMEOUT_MS`）是**故意短的**：init 要 await 它们，
 * 宿主没实现时不能让玩家白等。但拿这个天花板去判「宿主到底有没有实现」是错的——
 * **"没实现"和"只是慢"长得一模一样**（都是等到超时），2 秒会把一个 3 秒才回的宿主判成死。
 * 面板的全部用处就是给出**可信的判定**，所以它自己有一套 15 秒的实例。
 *
 * 多一套实例只是多一条 onMessage 订阅（按 requestId 配对，两套互不串台），
 * 退出时同样逐个释放（§7 第 5 步）。
 */
const PROBE_TIMEOUT_MS = 15_000;
const probeStorage = createStorageClientExtension(app, { timeoutMs: PROBE_TIMEOUT_MS });
const probeCharacter = createCharacterClientExtension(app, { timeoutMs: PROBE_TIMEOUT_MS });
const probeSpeech = createSpeechGateway(app, { declared: declared('speech'), timeoutMs: PROBE_TIMEOUT_MS, onWarn: gwWarn('speech') , onCall: logCall });
const probePersona = createPersonaGateway(app, { declared: declared('persona'), timeoutMs: PROBE_TIMEOUT_MS, onWarn: gwWarn('persona') , onCall: logCall });
const probeDialogue = createDialogueGateway(app, { declared: declared('dialogue'), timeoutMs: PROBE_TIMEOUT_MS, onWarn: gwWarn('dialogue') , onCall: logCall });
const probeMedia = createMediaGateway(app, { declared: declared('media'), timeoutMs: PROBE_TIMEOUT_MS, onWarn: gwWarn('media') , onCall: logCall });

// ── 【SDK 演示台】九行状态机（owner 2026-08-17）────────────────────────────────
//
// 面板是**纯数据**（`SdkRow[]` 投影进屏），这里只做两件事：
//   ① 开局把九行的初始态推给游戏（声明了没有 / 通道建起来没有）
//   ② 玩家按某一行的「试一下」→ 真调那个 capability → 把结果写回那一行
//
// ⚠ 每一次 try 都是**真的往宿主发消息**（未声明的那几行除外——那几行按下去看到的正是
//   "没声明所以一个字节都没发"，那也是要演示的东西）。不 mock、不假装成功。
type Row = { key: string; name: string; declared: boolean; available: boolean; state: 'idle' | 'busy' | 'ok' | 'down'; detail: string };
const rows = new Map<string, Row>();
function sdkSet(key: string, patch: Partial<Row>): void {
  const cur = rows.get(key);
  if (!cur) return;
  rows.set(key, { ...cur, ...patch });
  setSdkRows([...rows.values()]);
}

/**
 * 九行各自「试一下」按下去干什么 —— **每一条都是真调用**，返回一句人能读的结果。
 * 抛不出来（网关全都降级不抛），所以这里不需要 try/catch：失败会经 `onWarn` 写成 down。
 */
/**
 * `apps` / `episode` 这一类**只有 World Page Host 提供**的能力，在 Game 里按不动时该说什么。
 *
 * ⚠ 这句话是这块面板存在的理由之一：默认那句「manifest 未声明」会把人往错的方向带
 *（"哦那加上声明就好了"——2026-08-17 就是这么加成九个、然后五个超时的）。
 *   真相是**加了也拿不到**：Host profile 里没有就是没有，声明只决定 catalog 收不收。
 */
const WORLD_ONLY = (name: string): string =>
  `${name} 只在 World Page Host 有 · Game 拿不到（声明也没用）`;

const PROBES: Record<string, () => Promise<string>> = {
  // ── 产品级消费点（演示台只是再叫一次，看宿主答不答）──────────────────────
  character: async () => {
    const { character: c } = await traced('character', 'getCurrent', undefined, () => probeCharacter.getCurrent());
    return c ? `当前角色：${c.name}（${c.id}）` : '宿主没给角色（未授权 character.identity？）';
  },
  storage: async () => {
    // 存一个探针档 → 立刻读回来 → 再清掉。**不碰真存档**（真档是 game108-checkpoint 契约，
    // 这里用同契约但内容是探针串——读回来能对上就说明这条链是通的）。
    const probe = { contract: 'doki.game.game108-checkpoint', version: 1, data: { world: 'sdk-probe' } };
    // ⚠ `saveCheckpoint(checkpoint)` 收的是 **checkpoint 本身**，不是 `{checkpoint}`
    //（storage.d.ts 实读；包一层会被入参校验器判 invalid-request——目击腿当场逮到过）。
    await traced('storage', 'saveCheckpoint', probe, () => probeStorage.saveCheckpoint(probe));
    const back = await traced('storage', 'loadCheckpoint', undefined, () => probeStorage.loadCheckpoint());
    const ok = (back?.checkpoint as { data?: { world?: string } } | null)?.data?.world === 'sdk-probe';
    await traced('storage', 'clearCheckpoint', undefined, () => probeStorage.clearCheckpoint());
    return ok ? '存 → 读 → 清 三步都通了' : '存进去了但读回来对不上（宿主 storage 实现有问题？）';
  },
  progress: async () => {
    // 与 resize 同类的**普通会话消息**：发出去就完了，没有回信可等。故"成功"的判据只能是
    // 「`app.send` 没抛」——`send` 对未声明的类型会当场抛（SDK 本地闸），那正是要演示的那条。
    if (!declared('progress')) return '未声明 progress，app.send 会当场抛（本地闸拦在发之前）';
    const score = latest ? Math.max(0, Math.min(100, 100 - Math.min(latest.metrics.playerHp, latest.metrics.opponentHp))) : 0;
    app.send('dokiworld-app-progress', { score, maxScore: 100 });
    return `已发 progress → ${score}/100（单向·宿主不回信）`;
  },
  apps: async () => {
    if (!declared('apps')) return WORLD_ONLY('apps');
    const list = await apps.list();
    return list.length ? `宿主能拉起 ${list.length} 个 App：${list.map((a) => a.name).join('、')}` : '宿主没给出可拉起的 App';
  },
  'game-result': async () => {
    // **不真发 complete**（那会结束这一局）。这里报的是「现在这一刻发出去会是什么」——
    // 演示台的用处是让人看清楚契约长什么样，不是替玩家交卷。
    const p = latest;
    return p
      ? `现在发出去会是：score=${p.normalizedScore} · ${p.outcome} · 第 ${p.metrics.round} 回合（终局才真发）`
      : '世界还没起来（先开局再看）';
  },
  // ── 演示台驱动的五个（owner 明许「加各种 sample」）─────────────────────────
  speech: async () => {
    const line = voiceProbeLine();
    const r = await probeSpeech.synthesize({ text: line, characterId: currentCharacterId, locale: 'zh-cn' });
    if (!r) return '宿主没合成（游戏退回本地 TTS → 字幕，照常打）';
    void playAudio(r.audioUrl);
    return `合成好了${r.cached ? '（命中缓存）' : ''}，正在放：「${line}」`;
  },
  persona: async () => {
    const { persona: p } = await probePersona.getSelected(currentCharacterId);
    if (p) return `当前身份：${p.name}${p.age ? ` · ${p.age}` : ''}${p.likes ? ` · 喜欢${p.likes}` : ''}`;
    const { personas } = await probePersona.list();
    return personas.length ? `宿主有 ${personas.length} 个身份可选，但这个角色还没选定` : '宿主没给身份（没授权或没实现）';
  },
  dialogue: async () => {
    const r = await probeDialogue.generateOpening({ characterId: currentCharacterId, originalOpeningLine: voiceProbeLine() });
    return r ? `它说：「${r.openingLine}」` : '宿主没生成（游戏退回本地台词表）';
  },
  media: async () => {
    const started = await probeMedia.generateImage({
      prompt: '一张猜拳对决的纪念图：石头、剪刀、布三张牌浮在半空，卡通明亮风',
      characterId: currentCharacterId,
    });
    if (started.status === 'failed') return '宿主没接文生图';
    const job = await pollMediaJob(probeMedia, started.id, { tries: 12, stepMs: 1_500 });
    if (job.status === 'done' && job.urls?.length) return `出图了：${job.urls[0]}`;
    return `作业 ${job.id} 还是 ${job.status}${job.error ? `（${job.error}）` : ''}`;
  },
  episode: async () => {
    if (!declared('episode')) return WORLD_ONLY('episode');
    // 单向事件流：发一条**演习用**的 gameCompleted，并当场演示 routes 会把它路由到哪个 beat。
    const p = latest ?? { normalizedScore: 50, outcome: 'exited' as const, metrics: { round: 1, playerHp: 100, opponentHp: 100 } };
    const output = { contract: 'doki.game.result', version: 1, data: { normalizedScore: p.normalizedScore, outcome: p.outcome, metrics: p.metrics } };
    const sent = episode.send({ type: 'episode.gameCompleted', configId: 'sdk-demo', output });
    const routed = resolveEpisodeGameResult(output, DEMO_ROUTES);
    const beat = routed?.nextBeatId ?? '（没有一条 route 命中·剧情走 fallback）';
    return sent ? `已发 episode.gameCompleted → 剧情会走 ${beat}` : '未声明 episode，一个字节都没发';
  },
};

/** 演示 `resolveEpisodeGameResult` 用的示例路由（**纯示例**：真剧情的 routes 由 Episode World 给）。 */
const DEMO_ROUTES = [
  { id: 'crush', when: { outcomes: ['win' as const], minScore: 90 }, nextBeatId: 'beat-brag' },
  { id: 'win', when: { outcomes: ['win' as const] }, nextBeatId: 'beat-nod' },
  { id: 'lose', when: { outcomes: ['loss' as const] }, nextBeatId: 'beat-tease' },
];

/** 当前对手角色 id（character 降级链定下来的那个·探针要用同一个 id 才问得对人）。 */
let currentCharacterId = 'game108-foe';
/** 探针用的一句台词（用游戏自己的台词表，不另编一句——屏上说的和这里合成的是同一句）。 */
const localLine = (ev: 'roundStart' | 'foeFull' | 'clash' | 'foeWin' | 'youWin' | 'gameWin' | 'gameLose'): string => voiceLine(ev, 'zh');
const voiceProbeLine = (): string => localLine('roundStart');
/** 播一段宿主给的音频（合成结果是 URL·播不出来不算错，静默即可——演示台的判据是"拿到 URL"）。 */
async function playAudio(url: string): Promise<void> {
  try { await new Audio(url).play(); } catch { /* 自动播放被拦/格式不支持 → 不影响本次判定 */ }
}

// ── 【无感接线】persona / speech / dialogue（owner 2026-08-17 判做前三条）────────────
//
// 三条共同的纪律：**绝不站在关键路径上**。这一局只有 60-90 秒，任何一次"玩家点了要等 SDK 回话"
// 都是有感的。所以：persona 在 init 一次问完；speech 在**加载条那 1.4 秒**里把台词批量合成；
// dialogue **提前一个回合**生成，用上一回合的战况当输入，延迟被整个 T4+T1 吸收。
// 三条全都拿不到时，玩家看到的与接 SDK 之前**逐像素相同**。

/** 本作会说的全部台词事件（`voice.ts VoiceEvent` 的闭集·预取按它逐条来）。 */
const VOICE_EVENTS = ['roundStart', 'foeFull', 'clash', 'foeWin', 'youWin', 'gameWin', 'gameLose'] as const;
type VoiceEv = (typeof VOICE_EVENTS)[number];

/** 投影⑥（persona）：我方身份 —— 名字 + 头像。取不到就不设，屏上仍是「你」+ 首字。 */
async function resolveMyPersona(): Promise<void> {
  const { persona: p } = await persona.getSelected(currentCharacterId);
  if (!p) return;
  setMyPersona({
    ...(typeof p.name === 'string' && p.name ? { name: p.name } : {}),
    ...(typeof p.avatarUrl === 'string' && p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}),
  });
  myPersona = p;      // dialogue 那条要拿它做文章（见 refreshTauntLine）
}
/** 宿主给的玩家身份**原样存**（`AppPersona`）——喂给 dialogue 时逐字段转发，不补也不猜。 */
let myPersona: { name?: string; gender?: string; age?: number; likes?: string; dislikes?: string; description?: string } | undefined;

/**
 * 投影⑦（speech）：**把七句台词一次性合成好**，塞给游戏当查表用。
 * 跑在加载条那一段——玩家看着进度条的时候我们在合成，对局中播放是零等待的查表。
 * 逐条独立降级：合成不出来的那几条就没有 URL，游戏自己退回本地 TTS。
 */
async function prefetchVoiceClips(lines: Partial<Record<VoiceEv, string>>): Promise<void> {
  const pairs = await Promise.all(VOICE_EVENTS.map(async (ev) => {
    const text = lines[ev] ?? localLine(ev);
    const r = await speech.synthesize({ text, characterId: currentCharacterId, locale: 'zh-cn' });
    return [ev, r?.audioUrl] as const;
  }));
  const clips = Object.fromEntries(pairs.filter(([, url]) => typeof url === 'string' && url)) as Partial<Record<VoiceEv, string>>;
  // 预取结果落一条日志：这条链**静默失败的代价很大**（她整局用浏览器塑料嗓说话，
  // 而没有任何报错）——出问题时这一行是唯一的线索。
  console.info(`[game108] 语音预取：${Object.keys(clips).length}/${VOICE_EVENTS.length} 句拿到 URL`);
  if (Object.keys(clips).length > 0) setVoiceClips(clips);
}

/**
 * 投影⑧（dialogue）：**这个角色自己的台词**，替掉本地写死的七句。
 *
 * 开场那一批用 `generateOpening`（一句挑衅）——它落在加载条那段，不挡任何事。
 * 之后每回合结算时用 `generateDialogue` 为**下一回合**生成，输入是刚打完这一回合的战况
 * （外加 persona 的 likes —— 「你不是最爱吃辣吗，怎么出手这么软」这种话就是这么来的）。
 *
 * ⚠ **超时必须短于一个回合**：一个回合约 12 秒，生成超时给 20 秒的话，会出现
 * 「上上回合的台词现在才到」。故这条链单独用 `ROUND_DIALOGUE_TIMEOUT_MS`（8 秒）。
 */
const lines: Partial<Record<VoiceEv, string>> = {};
async function resolveOpeningLine(): Promise<void> {
  const r = await dialogue.generateOpening({ characterId: currentCharacterId, originalOpeningLine: localLine('roundStart') });
  if (r?.openingLine) { lines.roundStart = r.openingLine; setVoiceLines({ ...lines }); }
}
/**
 * 把宿主给的 persona 转成 SDK 的 `PlayerPersona`（`dialogue.d.ts`）。
 *
 * ⚠ **缺字段就整个不传，绝不编**：`PlayerPersona` 的 `gender`/`age` 是必填的，
 * 第一版为了凑类型填了 `'non-binary'` / `0` —— 那是在给宿主的 LLM 喂**假身份**
 * （0 岁、无性别），比不传更糟。宿主没给全就只把喜好写进提示词，身份整块不递。
 */
function personaForDialogue(): { name: string; gender: 'male' | 'female' | 'non-binary'; age: number; likes?: string; dislikes?: string; description?: string } | null {
  const p = myPersona;
  if (!p || typeof p.name !== 'string' || !p.name) return null;
  if (p.gender !== 'male' && p.gender !== 'female' && p.gender !== 'non-binary') return null;
  if (typeof p.age !== 'number' || !Number.isFinite(p.age)) return null;
  return {
    name: p.name, gender: p.gender, age: p.age,
    ...(p.likes ? { likes: p.likes } : {}),
    ...(p.dislikes ? { dislikes: p.dislikes } : {}),
    ...(p.description ? { description: p.description } : {}),
  };
}

/** 一个回合打完 → 为下一回合备一句（拿不到就静悄悄用本地那句，玩家看不出）。 */
async function refreshTauntLine(situation: string): Promise<void> {
  const r = await dialogue.generateDialogue({
    characterId: currentCharacterId,
    // 喜好**写进提示词里**，而不是只塞进 playerPersona 指望 LLM 自己想起来用。
    // （2026-08-17 自查：我先前只递了 persona 就对 owner 说"她会拿你的喜好做文章"——
    //  那是句没有依据的话。要它用就明说，不明说就别宣称。）
    playerInput: myPersona?.likes ? `${situation}（他喜欢${myPersona.likes}，可以拿这个揶揄他。）` : situation,
    ...(personaForDialogue() ? { playerPersona: personaForDialogue()! } : {}),
  });
  const text = r?.utterances?.[0]?.segments?.find((sg) => sg.type === 'dialogue')?.text;
  if (typeof text === 'string' && text) { lines.roundStart = text; setVoiceLines({ ...lines }); }
}

/** 开局把九行推给游戏（声明了没有 / 通道建起来没有 —— 还没试过一律 idle）。 */
/** 只有 World Page Host 才有的能力（Game 端一律拿不到·文案要与"我们没接"分开）。 */
const WORLD_ONLY_KEYS = ['apps', 'episode', 'chat', 'world'];

function initSdkRows(): void {
  const meta: ReadonlyArray<[string, boolean]> = [
    ['character', character !== undefined], ['storage', storage !== undefined], ['apps', apps.available],
    ['speech', speech.available], ['persona', persona.available], ['dialogue', dialogue.available],
    ['media', media.available], ['progress', declared('progress')],
    ['episode', episode.available], ['game-result', true],
  ];
  for (const [key, available] of meta) {
    const dec = key === 'game-result' ? true : declared(key);
    rows.set(key, {
      key, name: key, declared: dec, available,
      state: (WORLD_ONLY_KEYS.includes(key) && !dec) ? 'off' : 'idle',
      // 未声明分两种，**说法必须不同**：World 专属能力是"加了也没用"，
      // 其余才是真的"我们没接"。混成一句话会把人引去做无用功（实测教训见 WORLD_ONLY）。
      detail: dec ? '已声明 · 待试' : (WORLD_ONLY_KEYS.includes(key) ? '本宿主不提供 · World Page Host 专属' : 'manifest 未声明'),
    });
  }
  setSdkRows([...rows.values()]);
  onSdkTry((key) => {
    const probe = PROBES[key];
    if (!probe) return;
    // World 专属的那两行：**按下去也不发消息、也不假装在等**。
    // 上一版让它们照常走 probe，于是屏上先"正在问宿主…"再变**金点**——金点=宿主答了，
    // 而真相是这台宿主根本没有这项。演示台谎报比不报更糟（真渲染目击当场看出来的）。
    if (WORLD_ONLY_KEYS.includes(key) && !declared(key)) {
      sdkSet(key, { state: 'off', detail: WORLD_ONLY(key) });
      pushScreenLog(`${key} · 本宿主 profile 无此能力，未发送`);
      return;
    }
    sdkSet(key, { state: 'busy', detail: '正在问宿主…' });
    const t0 = Date.now();
    // **每一行都报耗时**：真宿主里"没实现"与"慢"长得一模一样（都是等到超时），
    // 而耗时能把它们分开——恰好卡在我们的超时值上 = 对方根本没回；远小于超时 = 对方主动拒了。
    const ms = (): number => Date.now() - t0;
    void probe().then(
      (detail) => { const r = rows.get(key); if (r?.state === 'busy') sdkSet(key, { state: 'ok', detail: `${detail}（${ms()}ms）` }); },
      /**
       * 走到这里 = **抛出来了**。走网关的那几个不会抛（降级不抛），所以抛的只可能是
       * 直接用裸 SDK 扩展的那两个（`character` / `storage`）——**那是宿主超时，不是探针写错**。
       *
       * ⚠ 2026-08-17 owner 在真 DokiWorld 里截图：这两行写着「探针自己炸了：
       * AppCapabilityTimeoutError」——**把宿主超时说成我方 bug**，直接把排查方向指反了。
       * 文案照实说：超时就是超时，写错才叫写错（用错误类型分开，不猜）。
       */
      (e: unknown) => {
        const timeout = e instanceof Error && (e.name === 'AppCapabilityTimeoutError' || /timed out/i.test(e.message));
        sdkSet(key, {
          state: 'down',
          detail: timeout
            ? `宿主没答，等满 ${ms()}ms 超时——多半是宿主没挂这个 host extension`
            : `探针自己炸了：${String(e)}`,
        });
      },
    );
  });
}

type Projection = ReturnType<typeof toGameResult>;

/**
 * 【progress】把「离终局还有多远」报给宿主（`dokiworld-app-progress`）。
 *
 * 与 `resize` 同类：**普通会话消息**，不是 capability——`app.send` 出去就完了，没有回信、
 * 没有超时、也无从降级。故它不走 `traced`（那层是给"叫得通/叫不通"用的），只落一行屏上日志，
 * 让演示台看得见"我们确实发了"。
 *
 * ⚠ `app.send` 会对**未声明**的类型直接抛（SDK `isDeclaredExtensionMessage` 本地闸），
 *   所以这里按 `declared('progress')` 短路——否则从 EXTENSIONS 里摘掉 progress 的那天，
 *   游戏会在每个回合边界抛一次异常，而那是玩家看得见的崩。
 */
let lastProgress = -1;
function reportProgress(p: Projection): void {
  if (!declared('progress')) return;
  const score = Math.max(0, Math.min(100, 100 - Math.min(p.metrics.playerHp, p.metrics.opponentHp)));
  if (score === lastProgress) return;                 // 同值不重发（宿主侧没必要收一串一样的）
  lastProgress = score;
  try {
    app.send('dokiworld-app-progress', { score, maxScore: 100 });
    pushScreenLog(`progress.send ✓ ${score}/100`);
  } catch (e) {
    pushScreenLog(`progress.send ✗ ${String(e).slice(0, 40)}`);
  }
}
type ObservedWorld = Parameters<NonNullable<Parameters<typeof setWorldObserver>[0]>>[0];
let latest: Projection | undefined;   // 最近一帧的机读投影（onPrepareExit 报「当时分」用）
let lastWorld: ObservedWorld | undefined; // 最近一帧的世界只读引用（挂起时 snapshot 用·纯投影）
let completed = false;                // complete 只发一次（协议按 resultId 去重·SDK 负责重试）
let unmount: (() => void) | undefined;

/** 投影②：对局角色（降级链 授权角色资料 → init.input 卡 → 内置兜底·foe-card.mjs 注释即规范）。 */
async function resolveFoeCard(grantedScopes: string[] | undefined, data: Game108Input, mood: Mood): Promise<void> {
  if (hasScope(grantedScopes, 'character.identity')) {
    try {
      const { character: profile } = await traced('character', 'getCurrent', undefined, () => character.getCurrent());
      const draft = characterToDraft(profile);
      if (draft) {
        const { card, usable } = fromPlatformCard(draft as PlatformCharacterDraft, mood);
        if (usable) { setCard(card); return; }
      }
      // profile 为 null / 桥判坏卡 → 落下一级（降级要留痕：这是「什么都没发生」类分支）
      console.info('[game108] character.getCurrent 无可用角色，降级到 init.input 卡');
    } catch {
      // 宿主没实现 character host extension（超时/unsupported-operation）→ 降级，不炸屏
      console.info('[game108] character capability 不可用，降级到 init.input 卡');
    }
  }
  if (data.card && typeof data.card === 'object') {
    const { card, usable } = fromPlatformCard(data.card as never, mood);
    if (usable) { setCard(card); return; }
    console.info('[game108] init.input 卡不可用（桥判 usable:false），落内置兜底卡');
  }
  // 什么都不 set = 游戏内置 DEFAULT_CARD（第三级·屏上照常）
}

/** 投影④之恢复半程：有本 App 的 checkpoint 就把世界快照塞给游戏（坏档/无档一律 null → 全新开局）。 */
async function resolveCheckpoint(): Promise<void> {
  try {
    const { checkpoint } = await traced('storage', 'loadCheckpoint', undefined, () => storage.loadCheckpoint());
    const packed = fromCheckpoint(checkpoint);
    if (!packed) return;                             // 无档 / 别家档 / 别版档 → 全新开局
    const world = await unpackWorld(packed);
    if (!world) {                                    // 坏档：拒收要留痕（reject 类分支）
      console.warn('[game108] checkpoint 解码失败（坏档），按全新开局处理');
      void storage.clearCheckpoint().catch(() => { /* 清坏档尽力而为 */ });
      return;
    }
    setWorldRestore({ snapshot: world.snapshot as never, order: world.order });
  } catch {
    // 宿主没实现 storage host extension（超时/unsupported-operation）→ 全新开局
    console.info('[game108] storage capability 不可用，走全新开局');
  }
}

/**
 * 投影⑤：宿主可拉起的 App → 终局屏「换个游戏玩」推荐位（REQ-DOKI-APPS·owner 2026-08-16 判）。
 * 过滤规则与理由全在 `app-picks.mjs`（纯函数·带点名测试）；这里只做「拉一次 → 交给屏」。
 */
const launchable = new Map<string, { contract: string; version: number }>();

async function resolveAppPicks(): Promise<void> {
  const { picks, launchable: targets, skipped } = toAppPicks(await apps.list(), { selfId: APP_ID });
  launchable.clear();
  for (const [id, t] of targets) launchable.set(id, t);
  if (skipped) console.info(`[game108] apps.list 里 ${skipped} 个条目拿不到 runtime.input.contract，不进推荐位（拉不起来的键不画）`);
  setAppPicks(picks);                      // 空数组 = 终局屏整条不画（游戏侧语义）
}

app.connect({
  onInit: async ({ locale, grantedScopes, input }) => {
    const initAt = Date.now();
    console.info(`${SDK_LOG} onInit → locale=${locale} · scopes=[${(grantedScopes ?? []).join(',')}] · 声明的扩展=[${EXTENSIONS.join(',')}]`);
    console.info(`${SDK_LOG} onInit → input=${brief(input?.data)}`);
    // 投影①：locale → 游戏语言（游戏自己从 localStorage 读，同真 UI 的语言开关一条路）。
    saveLang(String(locale ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh');
    const data = input?.data ?? {};
    const mood: Mood = (MOODS as readonly string[]).includes(data.mood ?? '') ? (data.mood as Mood) : 'stubborn';
    // 投影②（角色）与投影④（恢复）并行查——都挂 CAPABILITY_TIMEOUT_MS，降级宿主里最多等一拍。
    // ⚠ **三条并行，不许串行**（2026-08-17 真宿主实测的教训）：这三个都是"宿主没实现就等到超时"
    // 的 capability，串一条就多黑屏一个超时。我先前把 persona 串在后面，把开局白等从 2 秒变成 4 秒。
    // 开场白要用 persona 的 likes，但它是**挂载之后**才发的（不 await），所以并行不影响它。
    // **`allSettled` 不是 `all`**（照 storyteller 的 onInit 那一批）：这三条各自独立，
    // 用 `all` 的话任何一条抛出来都会让整个 onInit 挂掉 —— 而它们恰恰是最容易抛的
    // （宿主没实现就超时）。一条坏不许拖垮开局。
    const settled = await Promise.allSettled([
      resolveFoeCard(grantedScopes, data, mood), resolveCheckpoint(), resolveMyPersona(),
    ]);
    settled.forEach((r, i) => {
      const who = ['对手卡(character)', '续局(storage)', '我方身份(persona)'][i];
      if (r.status === 'rejected') console.warn(`${SDK_LOG} onInit 投影「${who}」失败：${String(r.reason)}——已降级，开局照常`);
    });
    console.info(`${SDK_LOG} onInit ← 三条投影收口，用时 ${Date.now() - initAt}ms`);
    // 【episode 反向】剧情给的赌注上屏（纯表现·不改规则）。
    if (typeof data.stakes === 'string') setStakes(data.stakes);
    // 投影③：终局机读态 → GameResult。观察口每帧递一次 world（只读·与验收剧本同读法），
    // GameFlow 走到 p1win/p2win 那一帧 complete 一次。
    setWorldObserver((world) => {
      lastWorld = world;
      const prev = latest;
      latest = toGameResult(world);
      // 【dialogue·提前一个回合】回合号一跳（= 上一回合刚结算完）就为**下一回合**备一句。
      // 输入是刚打完那一回合的实况：她赢了还是你赢了、你还剩多少血。
      // 生成期整个落在 T4 结算 + T1 蓄力（4.5 秒）里，玩家等的是"看结果"，不是等我们。
      if (prev && latest.metrics.round > prev.metrics.round && !latest.terminal) {
        // 【progress】回合一跳就给宿主报一次进度（`tower-confessions` 同款：一条普通会话消息，
        // 没有 capability 模块、没有回信、也没有超时——所以它**不进 traced**，只落一行屏上日志）。
        // 语义选「离终局还有多远」而不是「打了几回合」：本局在任一方掉到 0 血时结束，
        // 故 `100 - min(双方血量)` 一到 100 就是终局，宿主侧的进度条不会出现"永远差一点"。
        reportProgress(latest);
        const lost = latest.metrics.playerHp < prev.metrics.playerHp;
        void refreshTauntLine(
          `第 ${prev.metrics.round} 回合刚打完：${lost ? '我打中了他' : '他躲过去了'}，` +
          `现在他 ${latest.metrics.playerHp} 血、我 ${latest.metrics.opponentHp} 血。` +
          '用一句话挑衅他，不超过二十个字。',
        );
      }
      if (latest.terminal && !completed) {
        completed = true;
        const finalResult = createGameResult({
          normalizedScore: latest.normalizedScore,
          outcome: latest.outcome,
          metrics: latest.metrics,
        });
        console.info(`${SDK_LOG} app.complete → ${brief(finalResult.data)}`);
        void app.complete(finalResult).then(
          // **回执的 status 要看**（README §6 点名「completion acknowledgement」要覆盖）：
          // 宿主可以 `rejected`（契约不认 / 运行已结束）。此前我们只 catch 不看 status，
          // 于是"交卷被打回"和"交卷成功"在日志里长得一样。
          (ack) => {
            console.info(`${SDK_LOG} app.complete ← ${ack.status}（resultId=${ack.resultId}）`);
            if (ack.status === 'rejected') console.warn(`${SDK_LOG} 宿主拒收了本局战果：${brief(ack.error)}`);
          },
          (e: unknown) => console.warn(`${SDK_LOG} app.complete ← ✗ ${String(e)}（ack 超时由 SDK 重试语义兜底）`),
        );
        // 【结算数据的第二条出口】`app.complete` 是交给**宿主记分**；这一条是交给**剧情**：
        // Episode World 拿 `episode.gameCompleted` 里的 GameResult 去 `resolveEpisodeGameResult`
        // 路由下一拍演什么（赢得漂亮 → 吹牛那一拍，输了 → 被调侃那一拍）。
        // 未声明 episode / 非剧情宿主 ⇒ 桥是 no-op，一个字节都不发（纪律①）。
        episode.send({
          type: 'episode.gameCompleted',
          configId: APP_ID,
          output: { contract: 'doki.game.result', version: 1, data: { normalizedScore: latest.normalizedScore, outcome: latest.outcome, metrics: latest.metrics } },
        });
        // 正常打完 = 这局的挂起档作废（不清的话下次进来会「恢复」到已终局的世界）。
        void storage.clearCheckpoint().catch(() => { /* 尽力而为·失败下次 restore 也只是多看一眼终局屏 */ });
      }
    });
    // 投影⑤（推荐位）：点了哪一格 → 拉起那个 App。**先接住点击再挂载**——玩家在第一局
    // 打完之前不会点到它，但「挂载后才接」等于给自己留一个「早点了就掉进静默分支」的窗口。
    onAppPick((appId) => {
      const target = launchable.get(appId);
      if (!target) { console.info(`[game108] 推荐位 ${appId} 已不可拉起（列表已刷新？）——不发消息`); return; }
      void apps.launch({ appId, contract: target.contract, version: target.version, data: {} })
        .then((r) => {
          // 三态都是正常世界：completed=玩家在那边打完回来了·cancelled=玩家中途退了·
          // unavailable=通道没成事。**都不打扰对局**（推荐位是可选增强·纪律②）。
          if (r.status !== 'completed') console.info(`[game108] apps.launch ${appId} → ${r.status}`);
        });
    });
    document.querySelector('#standby')?.remove();
    const stage = document.querySelector('#stage');
    if (stage instanceof HTMLElement) unmount = mount(stage);
    // 【resize】照 `game-match3` 的做法：布局落定后给宿主一个**高度建议**，让 iframe 收到合适的高。
    // 这是 Game 参考实现里唯一真正用起来的那个扩展（它 `dokiworld-app-resize` 一次性发）。
    // 我们是定尺画布（1920×1080 等比缩放），故按舞台实际渲染高报，并夹在合理区间。
    if (stage instanceof HTMLElement) {
      const height = Math.min(1080, Math.max(520, Math.round(stage.getBoundingClientRect().height || stage.scrollHeight)));
      console.info(`${SDK_LOG} app.send(dokiworld-app-resize) → height=${height}`);
      app.send('dokiworld-app-resize', { height });
    }
    // 列表**挂载之后**再拉（异步 capability·到货时游戏侧自己重画一次）：
    // 放在挂载前会把首屏卡在一次 capability 往返上——推荐位是终局屏才用得着的东西，
    // 拿开局那一秒去等它是本末倒置。宿主没实现 apps ⇒ 超时后空数组 ⇒ 整条不画。
    void resolveAppPicks();
    // 【SDK 演示台】九行状态推给游戏（菜单第六行进得去）。**挂载之后**才推：
    // 面板是给人按的，开局那一秒不该为它多等任何一次 capability 往返。
    setAppVersion(APP_VERSION);
    pushScreenLog(`本包 v${APP_VERSION ?? '?'} · 声明扩展 ${EXTENSIONS.length} 个 · 已授权 scope ${(grantedScopes ?? []).length} 个`);
    initSdkRows();
    // 【无感三条】开场白 → 预取语音 —— **串行是有意的**：先拿到这一局她要说的那句，
    // 再拿那句去合成，否则合成的是本地兜底词、真台词到了却没有声音。
    // 整条挂在挂载之后（不 await），玩家看着加载条/开始屏的那一两秒正好被它用掉。
    void resolveOpeningLine().then(() => prefetchVoiceClips(lines));
  },
  // 中途退出（规范 §6/§8）：挂起半程=把当前世界快照存进 storage checkpoint，存成了才敢
  // 报 canSuspend:true（报了 true 却没存上=恢复时静默丢局）。output 仍带 exited+当时分
  // （宿主判 discard 时用；已正常 complete 过就不再带——不双报）。
  onPrepareExit: async () => {
    if (completed) {
      void storage.clearCheckpoint().catch(() => { /* 同 complete 处的清档语义 */ });
      return { isDirty: false, canSuspend: false };
    }
    let canSuspend = false;
    if (lastWorld) {
      try {
        const packed = await packWorld(lastWorld.snapshot(), lastWorld.snapshotOrder());
        await traced('storage', 'saveCheckpoint', { bytes: packed.length }, () => storage.saveCheckpoint(toCheckpoint(packed)));
        canSuspend = true;
      } catch {
        // 存不上（宿主无 storage / 超时）→ canSuspend:false，宿主只剩 stay/discard——不许假承诺
        console.warn('[game108] checkpoint 保存失败，本次退出不可挂起（canSuspend:false）');
      }
    }
    return {
      isDirty: false,
      canSuspend,
      ...(latest ? {
        output: createGameResult({
          normalizedScore: latest.normalizedScore,
          outcome: 'exited',
          metrics: latest.metrics,
        }),
      } : {}),
    };
  },
  // 规范 §7 第 5 步：结束时释放 extension 与嵌套宿主。suspend/discard 都意味着本实例到头了
  //（挂起恢复时是**新 instanceId 新页面**，不是本实例复活）——卸游戏、断观察口、释放两个 capability。
  onExitDecision: (decision) => {
    console.info(`${SDK_LOG} onExitDecision ← ${decision} · 本局共发起 ${sdkCalls.length} 次 SDK 调用`
      + `（成功 ${sdkCalls.filter((c) => c.ok).length}·降级 ${sdkCalls.filter((c) => !c.ok).length}）`);
    if (decision === 'stay') return;
    unmount?.();
    unmount = undefined;
    setWorldObserver(undefined);
    onAppPick(undefined);      // 摘掉推荐位回调（游戏已卸载·再点没有承接方）
    setAppPicks([]);           // 清空推荐位（下一个实例是新页面，别让旧列表跨实例活着）
    onSdkTry(undefined);       // 摘掉演示台回调（游戏已卸载·再按没有承接方）
    setSdkRows([]);
    storage.dispose();
    character.dispose();
    // 规范 §7 第 5 步：**声明了几个就释放几个**。少释放一个 = 那条 onMessage 一直挂着，
    // 下一个实例的报文会被上一实例的监听器也收一遍（跨实例串台）。
    speech.dispose(); persona.dispose(); dialogue.dispose(); media.dispose(); episode.dispose();
    // 演示台那套长超时实例同样要释放（少释放一条 = 泄一条订阅·跨实例串台）
    probeStorage.dispose(); probeCharacter.dispose();
    probeSpeech.dispose(); probePersona.dispose(); probeDialogue.dispose(); probeMedia.dispose();
    apps.dispose();            // 规范 §7 第 5 步：三个 extension 全释放（少释放一个 = 泄一条订阅）
  },
});
