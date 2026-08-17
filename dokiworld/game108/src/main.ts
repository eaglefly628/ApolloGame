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
import { mount, setCard, setWorldObserver, setWorldRestore, setAppPicks, onAppPick, setSdkRows, onSdkTry, setMyPersona, setVoiceClips, setVoiceLines, setStakes } from '../../../games/game108/index.js';
import { fromPlatformCard, MOODS, type Mood } from '../../../games/game108/card-character.js';
import type { PlatformCharacterDraft } from '@zerocraft/engine/services/character-card/index.js';
import { saveLang } from '../../../games/game108/strings.js';
// 演示台的 speech/dialogue 探针要**用游戏自己的那句台词**（屏上说的和这里合成的是同一句）。
import { voiceLine } from '../../../games/game108/voice.js';
import { toGameResult } from './to-game-result.mjs';
import { packWorld, unpackWorld, toCheckpoint, fromCheckpoint } from './checkpoint-codec.mjs';
import { hasScope, characterToDraft } from './foe-card.mjs';

const APP_ID = 'game108';
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

// manifest.runtime.extensions = ['apps','character','storage']——**声明与真实调用一致**（规范 §5/§7：
// 三个模块这里各建一个 Client extension，别的模块一个不建）。§7 第 5 步的释放走 onExitDecision。
// `apps` 是 2026-08-16 owner 判「game108 当第一个消费者」后才加的：**先有真消费，再有声明**
//（手册红线「只声明真用到的」——多声明会被宿主拒）。
/**
 * **声明的九个模块 = 唯一那张表**（owner 2026-08-17：「把所有 SDK 的功能全部埋点在游戏中」）。
 *
 * 规范 §7 要五步一致：manifest.runtime.extensions ⇔ createAppClient({extensions}) ⇔ 真建的
 * Client extension ⇔ 宿主 host extension ⇔ 退出时 dispose()。**这张常量就是第 2 步**，
 * 并且下面每个网关的 `declared` 都从它现推（`EXTENSIONS.includes(...)`）——
 * 写死 `declared:true` 就是给自己留一个"改了 extensions 忘了改这里"的口子，
 * 而那种错的表症是**静默等到超时**（capability.js：宿主不回时客户端只有 setTimeout 一条出路）。
 *
 * ⚠ 九个都声明，**前提是九个都有真实调用点**——不是假声明凑数（手册红线「只声明真用到的」，
 * match3 多声明是反例）。逐个的落点：
 *   character/storage/apps/game-result = 产品级消费（对手卡 / 挂起恢复 / 推荐位 / 战果上报）
 *   speech/persona/dialogue/media/episode = **SDK 演示台**里逐行真调（owner 明许「加各种 sample」），
 *   外加 episode 在终局真发一条 `episode.gameCompleted`（战果的第二条出口：交给剧情路由下一拍）。
 */
const EXTENSIONS = ['apps', 'character', 'storage', 'speech', 'persona', 'dialogue', 'media', 'episode'] as const;
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
const gwWarn = (row: string) => ({ op, reason }: { op: string; reason: string }): void => {
  sdkSet(row, { state: 'down', detail: `${op} → ${reason}` });
};
const speech = createSpeechGateway(app, { declared: declared('speech'), timeoutMs: CAPABILITY_TIMEOUT_MS, onWarn: gwWarn('speech') });
const persona = createPersonaGateway(app, { declared: declared('persona'), timeoutMs: CAPABILITY_TIMEOUT_MS, onWarn: gwWarn('persona') });
const dialogue = createDialogueGateway(app, { declared: declared('dialogue'), timeoutMs: ROUND_DIALOGUE_TIMEOUT_MS, onWarn: gwWarn('dialogue') });
const media = createMediaGateway(app, { declared: declared('media'), timeoutMs: DIALOGUE_TIMEOUT_MS, onWarn: gwWarn('media') });
const episode = createEpisodeBridge(app, { declared: declared('episode'), onWarn: gwWarn('episode') });

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
const PROBES: Record<string, () => Promise<string>> = {
  // ── 产品级消费点（演示台只是再叫一次，看宿主答不答）──────────────────────
  character: async () => {
    const { character: c } = await character.getCurrent();
    return c ? `当前角色：${c.name}（${c.id}）` : '宿主没给角色（未授权 character.identity？）';
  },
  storage: async () => {
    // 存一个探针档 → 立刻读回来 → 再清掉。**不碰真存档**（真档是 game108-checkpoint 契约，
    // 这里用同契约但内容是探针串——读回来能对上就说明这条链是通的）。
    const probe = { contract: 'doki.game.game108-checkpoint', version: 1, data: { world: 'sdk-probe' } };
    // ⚠ `saveCheckpoint(checkpoint)` 收的是 **checkpoint 本身**，不是 `{checkpoint}`
    //（storage.d.ts 实读；包一层会被入参校验器判 invalid-request——目击腿当场逮到过）。
    await storage.saveCheckpoint(probe);
    const back = await storage.loadCheckpoint();
    const ok = (back?.checkpoint as { data?: { world?: string } } | null)?.data?.world === 'sdk-probe';
    await storage.clearCheckpoint();
    return ok ? '存 → 读 → 清 三步都通了' : '存进去了但读回来对不上（宿主 storage 实现有问题？）';
  },
  apps: async () => {
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
    const r = await speech.synthesize({ text: line, characterId: currentCharacterId, locale: 'zh-cn' });
    if (!r) return '宿主没合成（游戏退回本地 TTS → 字幕，照常打）';
    void playAudio(r.audioUrl);
    return `合成好了${r.cached ? '（命中缓存）' : ''}，正在放：「${line}」`;
  },
  persona: async () => {
    const { persona: p } = await persona.getSelected(currentCharacterId);
    if (p) return `当前身份：${p.name}${p.age ? ` · ${p.age}` : ''}${p.likes ? ` · 喜欢${p.likes}` : ''}`;
    const { personas } = await persona.list();
    return personas.length ? `宿主有 ${personas.length} 个身份可选，但这个角色还没选定` : '宿主没给身份（没授权或没实现）';
  },
  dialogue: async () => {
    const r = await dialogue.generateOpening({ characterId: currentCharacterId, originalOpeningLine: voiceProbeLine() });
    return r ? `它说：「${r.openingLine}」` : '宿主没生成（游戏退回本地台词表）';
  },
  media: async () => {
    const started = await media.generateImage({
      prompt: '一张猜拳对决的纪念图：石头、剪刀、布三张牌浮在半空，卡通明亮风',
      characterId: currentCharacterId,
    });
    if (started.status === 'failed') return '宿主没接文生图';
    const job = await pollMediaJob(media, started.id, { tries: 12, stepMs: 1_500 });
    if (job.status === 'done' && job.urls?.length) return `出图了：${job.urls[0]}`;
    return `作业 ${job.id} 还是 ${job.status}${job.error ? `（${job.error}）` : ''}`;
  },
  episode: async () => {
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
  myPersona = p;      // dialogue 那条要拿它做文章（「你不是最爱吃辣吗」）
}
let myPersona: { name?: string; likes?: string; dislikes?: string } | undefined;

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
/** 一个回合打完 → 为下一回合备一句（拿不到就静悄悄用本地那句，玩家看不出）。 */
async function refreshTauntLine(situation: string): Promise<void> {
  const r = await dialogue.generateDialogue({
    characterId: currentCharacterId,
    playerInput: situation,
    ...(myPersona ? { playerPersona: { name: myPersona.name ?? '', gender: 'non-binary' as const, age: 0, ...(myPersona.likes ? { likes: myPersona.likes } : {}) } } : {}),
  });
  const text = r?.utterances?.[0]?.segments?.find((sg) => sg.type === 'dialogue')?.text;
  if (typeof text === 'string' && text) { lines.roundStart = text; setVoiceLines({ ...lines }); }
}

/** 开局把九行推给游戏（声明了没有 / 通道建起来没有 —— 还没试过一律 idle）。 */
function initSdkRows(): void {
  const meta: ReadonlyArray<[string, boolean]> = [
    ['character', character !== undefined], ['storage', storage !== undefined], ['apps', apps.available],
    ['speech', speech.available], ['persona', persona.available], ['dialogue', dialogue.available],
    ['media', media.available], ['episode', episode.available], ['game-result', true],
  ];
  for (const [key, available] of meta) {
    const dec = key === 'game-result' ? true : declared(key);
    rows.set(key, {
      key, name: key, declared: dec, available,
      state: 'idle',
      detail: dec ? '已声明 · 待试' : 'manifest 未声明',
    });
  }
  setSdkRows([...rows.values()]);
  onSdkTry((key) => {
    const probe = PROBES[key];
    if (!probe) return;
    sdkSet(key, { state: 'busy', detail: '正在问宿主…' });
    void probe().then(
      (detail) => { const r = rows.get(key); if (r?.state === 'busy') sdkSet(key, { state: 'ok', detail }); },
      // 网关不抛，走到这里说明是**探针自己**写错了（不是宿主的问题）——照实说，别栽给宿主。
      (e: unknown) => sdkSet(key, { state: 'down', detail: `探针自己炸了：${String(e)}` }),
    );
  });
}

type Projection = ReturnType<typeof toGameResult>;
type ObservedWorld = Parameters<NonNullable<Parameters<typeof setWorldObserver>[0]>>[0];
let latest: Projection | undefined;   // 最近一帧的机读投影（onPrepareExit 报「当时分」用）
let lastWorld: ObservedWorld | undefined; // 最近一帧的世界只读引用（挂起时 snapshot 用·纯投影）
let completed = false;                // complete 只发一次（协议按 resultId 去重·SDK 负责重试）
let unmount: (() => void) | undefined;

/** 投影②：对局角色（降级链 授权角色资料 → init.input 卡 → 内置兜底·foe-card.mjs 注释即规范）。 */
async function resolveFoeCard(grantedScopes: string[] | undefined, data: Game108Input, mood: Mood): Promise<void> {
  if (hasScope(grantedScopes, 'character.identity')) {
    try {
      const { character: profile } = await character.getCurrent();
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
    const { checkpoint } = await storage.loadCheckpoint();
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
    // 投影①：locale → 游戏语言（游戏自己从 localStorage 读，同真 UI 的语言开关一条路）。
    saveLang(String(locale ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh');
    const data = input?.data ?? {};
    const mood: Mood = (MOODS as readonly string[]).includes(data.mood ?? '') ? (data.mood as Mood) : 'stubborn';
    // 投影②（角色）与投影④（恢复）并行查——都挂 CAPABILITY_TIMEOUT_MS，降级宿主里最多等一拍。
    await Promise.all([resolveFoeCard(grantedScopes, data, mood), resolveCheckpoint()]);
    // 投影⑥（persona）：我方身份 —— 与"对手是谁"对称的那一半，**必须在开场白之前**
    //（开场白要拿 likes 做文章）。一次 capability 往返，之后全程不再问。
    await resolveMyPersona();
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
        const lost = latest.metrics.playerHp < prev.metrics.playerHp;
        void refreshTauntLine(
          `第 ${prev.metrics.round} 回合刚打完：${lost ? '我打中了他' : '他躲过去了'}，` +
          `现在他 ${latest.metrics.playerHp} 血、我 ${latest.metrics.opponentHp} 血。` +
          '用一句话挑衅他，不超过二十个字。',
        );
      }
      if (latest.terminal && !completed) {
        completed = true;
        void app.complete(createGameResult({
          normalizedScore: latest.normalizedScore,
          outcome: latest.outcome,
          metrics: latest.metrics,
        })).catch(() => { /* ack 超时由 SDK 重试语义兜底；接线层不再造第二套重试 */ });
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
    // 列表**挂载之后**再拉（异步 capability·到货时游戏侧自己重画一次）：
    // 放在挂载前会把首屏卡在一次 capability 往返上——推荐位是终局屏才用得着的东西，
    // 拿开局那一秒去等它是本末倒置。宿主没实现 apps ⇒ 超时后空数组 ⇒ 整条不画。
    void resolveAppPicks();
    // 【SDK 演示台】九行状态推给游戏（菜单第六行进得去）。**挂载之后**才推：
    // 面板是给人按的，开局那一秒不该为它多等任何一次 capability 往返。
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
        await storage.saveCheckpoint(toCheckpoint(packed));
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
    apps.dispose();            // 规范 §7 第 5 步：三个 extension 全释放（少释放一个 = 泄一条订阅）
  },
});
