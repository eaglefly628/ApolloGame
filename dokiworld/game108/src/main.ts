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
import { toAppPicks } from './app-picks.mjs';
import { mount, setCard, setWorldObserver, setWorldRestore, setAppPicks, onAppPick } from '../../../games/game108/index.js';
import { fromPlatformCard, MOODS, type Mood } from '../../../games/game108/card-character.js';
import type { PlatformCharacterDraft } from '@zerocraft/engine/services/character-card/index.js';
import { saveLang } from '../../../games/game108/strings.js';
import { toGameResult } from './to-game-result.mjs';
import { packWorld, unpackWorld, toCheckpoint, fromCheckpoint } from './checkpoint-codec.mjs';
import { hasScope, characterToDraft } from './foe-card.mjs';

const APP_ID = 'game108';
/** capability 请求超时：宿主没实现对应 host extension 时消息被静默丢弃，只有超时能兜住。
 *  init 前的 loadCheckpoint/getCurrent 都挂在这上面——太长=降级宿主里白等，太短=慢宿主误降级。 */
const CAPABILITY_TIMEOUT_MS = 2_000;

/**
 * input contract `doki.game.game108-input/1`（本 App 自定·manifest.runtime.input）：
 *   { card?: PlatformCharacterDraft 形状的平台角色卡, mood?: 五心情之一 }
 * 全部可缺省：缺卡 = 游戏内置兜底卡；坏卡（桥判 usable:false）同缺省——绝不因输入炸屏。
 */
interface Game108Input {
  card?: Record<string, unknown>;
  mood?: string;
}

// manifest.runtime.extensions = ['apps','character','storage']——**声明与真实调用一致**（规范 §5/§7：
// 三个模块这里各建一个 Client extension，别的模块一个不建）。§7 第 5 步的释放走 onExitDecision。
// `apps` 是 2026-08-16 owner 判「game108 当第一个消费者」后才加的：**先有真消费，再有声明**
//（手册红线「只声明真用到的」——多声明会被宿主拒）。
const app = createAppClient<Game108Input>({ appId: APP_ID, extensions: ['apps', 'character', 'storage'] });
const storage = createStorageClientExtension(app, { timeoutMs: CAPABILITY_TIMEOUT_MS });
const character = createCharacterClientExtension(app, { timeoutMs: CAPABILITY_TIMEOUT_MS });
// 「获取卡带」走共享层（`dokiworld/shared`·超时/降级/dispose 已封）。`declared` 不是随手写的 true：
// 它必须与上面那行 `extensions` 同真同假——未声明还发消息的表症是**静默等到超时**（纪律①）。
const apps = createAppsGateway(app, {
  declared: true,
  timeoutMs: CAPABILITY_TIMEOUT_MS,
  onWarn: ({ op, reason }) => console.info(`[game108] apps.${op} 降级（${reason}）——推荐位不出现，对局照常`),
});

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
    // 投影③：终局机读态 → GameResult。观察口每帧递一次 world（只读·与验收剧本同读法），
    // GameFlow 走到 p1win/p2win 那一帧 complete 一次。
    setWorldObserver((world) => {
      lastWorld = world;
      latest = toGameResult(world);
      if (latest.terminal && !completed) {
        completed = true;
        void app.complete(createGameResult({
          normalizedScore: latest.normalizedScore,
          outcome: latest.outcome,
          metrics: latest.metrics,
        })).catch(() => { /* ack 超时由 SDK 重试语义兜底；接线层不再造第二套重试 */ });
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
    storage.dispose();
    character.dispose();
    apps.dispose();            // 规范 §7 第 5 步：三个 extension 全释放（少释放一个 = 泄一条订阅）
  },
});
