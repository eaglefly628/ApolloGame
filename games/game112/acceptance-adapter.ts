// game112《星尾会客厅》—— 验收剧本薄适配契约（PE 落·**纯接线零规则**·不改剧本）。
// 对接通用 runner（scripts/acceptance-run.mjs）：
//   createWorld(seed, config) → world（.tick() / .getAllEntities() / .getComponent(id,type)）
//   applySignal(world, signal, args?, by?) → void（把剧本动作词翻成引擎输入）
//   readWorld(world) → worldLike（投影机读态）
//
// 动作词表 = 真 UI 的 action 名（`ui.ts` UI_ACTIONS·剧本步骤名必须用真 UI 动作名·REQ-ACCEPT 词表对齐律）
//   + `restart`（壳层重开 = 重建会话）+ `offline.<short|long|days>`（宿主回馆时注入的分档 key）。
// 带参动作与宿主 `routeAction` 同一张表：shop.buy{item} / decor.place{item} / memory.choose{index}。
// **本文件零规则判断**：涨多少、够不够买、解不解锁，全在 blueprint 数据 + 引擎能力里。
//
// 投影键（docs/design/game112/acceptance/README.md 表）：世界 Resource/Flag/State 直读（id 全局唯一·无撞名），
// 另合成 `offline.count`（离线小事件实体数·剧本要断「恰好展开一个」而实体计数不是标量）。
import type { IWorld } from '@zerocraft/engine/engine/core/types.js';
import { DIALOGUE_ACTION_ADVANCE, DIALOGUE_ACTION_CHOOSE } from '@zerocraft/engine/skills/tier3/dialogue.js';
import { HallSession } from './session.js';
import { routeAction, normalizeState } from './game112.js';
import { offlineEventTexts } from './project.js';
import { OFFLINE_TIERS, offlineKey, type OfflineTier } from './world-data.js';

interface AccWorld {
  session: HallSession;
  seed: number;
  config: Record<string, unknown>;
  tick(): void;
  getAllEntities(): string[];
  getComponent(id: string, type: string): unknown;
}

function open(w: AccWorld): void {
  // config.state = 局外持久态（同宿主读信封后喂蓝图的那份形状·经同一个坏档守卫）。
  w.session = new HallSession(w.seed, normalizeState(w.config.state));
}

export function createWorld(seed: number, config: Record<string, unknown> = {}): AccWorld {
  const w = {
    seed, config,
    tick(): void { w.session.step(); },
    getAllEntities(): string[] { return w.session.world.getAllEntities() as string[]; },
    getComponent(id: string, type: string): unknown { return w.session.world.getComponent(id, type as never); },
  } as AccWorld;
  open(w);
  return w;
}

export function applySignal(w: AccWorld, signal: string, args?: Record<string, unknown>, _by?: string): void {
  if (signal === 'restart') { open(w); return; }
  if (signal.startsWith('offline.') && (OFFLINE_TIERS as readonly string[]).includes(signal.slice('offline.'.length))) {
    w.session.act(offlineKey(signal.slice('offline.'.length) as OfflineTier));
    return;
  }
  const arg = args?.item ?? args?.chapter ?? args?.index;
  const r = routeAction(signal, arg === undefined ? undefined : String(arg));
  if (r === undefined) {
    throw new Error(`game112 adapter: 不认识的动作 "${signal}"（词表=ui.ts UI_ACTIONS·带参 shop.buy{item}/decor.place{item}/memory.choose{index}·外加 restart/offline.<tier>）`);
  }
  if (r.key === undefined) return; // 纯切屏动作（hall.back/shop.open…）对 sim 无输入
  if (r.key === DIALOGUE_ACTION_ADVANCE || r.key === DIALOGUE_ACTION_CHOOSE) {
    w.session.act(r.key, r.x !== undefined ? { x: r.x } : undefined);
    return;
  }
  w.session.act(r.key);
}

export function readWorld(w: AccWorld): Pick<IWorld, 'getAllEntities' | 'getComponent'> {
  const world = w.session.world;
  const n = offlineEventTexts(world).length;
  const synth: Record<string, Record<string, unknown>> = {
    '@offline': { Resource: { type: 'Resource', id: 'offline.count', current: n, min: 0, max: 99 } },
  };
  return {
    getAllEntities(): string[] { return [...(world.getAllEntities() as string[]), ...Object.keys(synth)] as never; },
    getComponent(id: string, type: string): unknown {
      if (synth[id]) return synth[id][type];
      return world.getComponent(id, type as never);
    },
  } as never;
}
