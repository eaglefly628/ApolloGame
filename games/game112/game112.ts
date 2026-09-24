// game112《星尾会客厅》—— 卡带宿主层（mount/host·契约明许·**零玩法逻辑**）。
//
// 职责全在 sim 外：建会话（Engine）· 读/写局外信封（services/save）· 离线时长分档成 key 注入 ·
// UI action 查表转成具名输入动作 · 定拍推 tick · 投影视图 · cleanup。
// 玩法规则一条都不在这里：全在 `blueprint.ts` 的数据 + 引擎能力里。
// 猫的画面 = 投影层（现为 Image 占位；REQ-112-ENG-11「内嵌 AI 视频播放」交付后由它接管，本文件不变）。
import { mountUI, type MountHandle, type HandlerMap } from '@zerocraft/engine/ui/components/index.js';
import { apolloBrocade } from '@zerocraft/engine/ui/components/apollo-kit.js';
import { LocalStorageSavePort, sealEnvelope, openEnvelope, type SaveCodec, type SavePort } from '@zerocraft/engine/services/save/index.js';
import { DIALOGUE_ACTION_ADVANCE, DIALOGUE_ACTION_CHOOSE } from '@zerocraft/engine/skills/tier3/dialogue.js';
import { HallSession } from './session.js';
import { buildScreen, UI_ACTIONS, type Screen, type UiAction } from './ui.js';
import { GAME_ID, TICK_MS, OFFLINE_ACK_KEY, offlineTierOf, offlineKey, buyKey, placeKey, shopItemOf, chapterOf } from './world-data.js';
import { EMPTY_STATE, type PersistedState } from './blueprint.js';

export const SAVE_CODEC: SaveCodec = { gameId: GAME_ID, schema: 1 };
export const SAVE_SLOT = 'main';

/** 壳层钩子（launcher 契约的 mount 第二参·可选）。 */
export interface HostHooks { exit: () => void }

/** UI action → 宿主动作（**纯查表·可测·零玩法判定**）。key = 进 sim 的具名动作；screen = 切屏。 */
export interface Route { screen?: Screen; key?: string; x?: number; readChapter?: string }
export function routeAction(action: UiAction | string, arg?: string): Route | undefined {
  switch (action) {
    case 'home.enter': return { screen: 'hall' };
    case 'home.about': return { screen: 'about' };
    case 'home.exit': return {};
    case 'hall.back': case 'later': return { screen: 'hall' };
    case 'orbs.open': return { screen: 'orbs' };
    case 'table.open': return { screen: 'table' };
    case 'toys.open': return { screen: 'toys' };
    case 'shop.open': return { screen: 'shop' };
    case 'memory.open': case 'memory.back': return { screen: 'memory' };
    case 'settings.open': return { screen: 'settings' };
    case 'cat.greet': case 'cat.sit': return { key: action };
    case 'offline.ack': return { key: OFFLINE_ACK_KEY };
    case 'shop.buy': return arg !== undefined && shopItemOf(arg) !== undefined ? { key: buyKey(arg) } : undefined;
    // 购买后优先「放到馆里看看」→ 回主厅目击新物件（menu-flow §10）。
    case 'decor.place': return arg !== undefined && shopItemOf(arg) !== undefined ? { key: placeKey(arg), screen: 'hall' } : undefined;
    case 'memory.read': return arg !== undefined && chapterOf(arg) !== undefined ? { screen: 'reading', readChapter: arg } : undefined;
    case 'memory.advance': return { key: DIALOGUE_ACTION_ADVANCE };
    case 'memory.choose': {
      const i = Number(arg);
      return Number.isInteger(i) && i >= 0 ? { key: DIALOGUE_ACTION_CHOOSE, x: i } : undefined;
    }
    default: return undefined;
  }
}

/** 信封里的 data → 持久态（形状守卫·坏档回空档，不让坏数据进蓝图）。 */
export function normalizeState(u: unknown): PersistedState {
  if (u === null || typeof u !== 'object') return EMPTY_STATE;
  const o = u as Partial<Record<keyof PersistedState, unknown>>;
  const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  const rec = (x: unknown): Record<string, number> => {
    if (x === null || typeof x !== 'object') return {};
    return Object.fromEntries(Object.entries(x as Record<string, unknown>).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, v as number]));
  };
  const strRec = (x: unknown): Record<string, string> => {
    if (x === null || typeof x !== 'object') return {};
    return Object.fromEntries(Object.entries(x as Record<string, unknown>).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v as string]));
  };
  const list = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
  return { stardust: num(o.stardust), relations: rec(o.relations), items: rec(o.items), placed: list(o.placed), chapters: list(o.chapters), cursors: strRec(o.cursors) };
}

/** 宿主开局种子（新局随机·回放固定）：由注入的 `now()` 派生一个整数，进 sim 的只是这个数。 */
const seedFrom = (now: () => number): number => (now() % 2147483647) | 0;

export function mount(container: HTMLElement, host?: HostHooks, opts: { save?: SavePort; now?: () => number; seed?: number } = {}): () => void {
  const save: SavePort = opts.save ?? new LocalStorageSavePort();
  // 墙钟只在宿主这一处出现（audit 「墙钟」告警的合法落点·plan §5.1：seed/savedAt 宿主注入）；测试可注入。
  const now = opts.now ?? (() => Date.now());
  let disposed = false;
  let handle: MountHandle | undefined;
  let session: HallSession | undefined;
  let screen: Screen = 'home';
  let reading: string | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastView = '';

  const render = (): void => {
    if (disposed) return;
    const node = buildScreen({
      screen,
      view: session?.hall(),
      reading: session !== undefined && reading !== undefined ? session.reading(reading) : undefined,
      canExit: host !== undefined,
    });
    if (handle) handle.update(node);
    else handle = mountUI(container, node, handlers, apolloBrocade);
  };

  const persist = (): void => {
    if (session === undefined) return;
    void save.write(SAVE_SLOT, sealEnvelope(session.persisted(), SAVE_CODEC, now())).catch(() => { /* 存不进去不打断陪伴 */ });
  };

  const start = async (): Promise<void> => {
    let initial = EMPTY_STATE;
    let savedAt: number | undefined;
    try {
      const env = await save.read(SAVE_SLOT);
      if (env !== null) { initial = normalizeState(openEnvelope(env, SAVE_CODEC)); savedAt = env.savedAt; }
    } catch { /* 坏档 → 空档；不让技术失败变成「猫失败」 */ }
    if (disposed) return;
    session = new HallSession(opts.seed ?? seedFrom(now), initial);
    // 离线「田螺姑娘」：宿主算离开时长 → 分档 key；sim 只见 Signal，永不见墙钟。
    const tier = savedAt !== undefined ? offlineTierOf(now() - savedAt) : undefined;
    if (tier !== undefined) session.act(offlineKey(tier));
    screen = 'hall';
    timer = setInterval(() => {
      if (session === undefined || disposed) return;
      session.step();
      const v = JSON.stringify(session.hall());
      if (v !== lastView) { lastView = v; render(); }
    }, TICK_MS);
    render();
  };

  // handler 里不塞自由逻辑：只把 UI 信号查表路由到宿主动作（信号铁律）。
  const handlers: HandlerMap = Object.fromEntries(UI_ACTIONS.map((a) => [a, (arg?: string): void => {
    if (a === 'home.exit') { host?.exit(); return; }
    if (a === 'home.enter' && session === undefined) { void start(); return; }
    const r = routeAction(a, arg);
    if (r === undefined) return;
    if (r.key !== undefined && session !== undefined) { session.act(r.key, r.x !== undefined ? { x: r.x } : undefined); persist(); }
    if (r.readChapter !== undefined) reading = r.readChapter;
    if (r.screen !== undefined) screen = r.screen;
    render();
  }]));

  render();
  return () => {
    disposed = true;
    if (timer !== undefined) clearInterval(timer);
    persist();
    handle?.();
  };
}
