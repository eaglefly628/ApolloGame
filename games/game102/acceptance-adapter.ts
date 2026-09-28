// Game 102 · Pixel Pour —— 验收剧本薄适配契约（REQ-G102-ADAPTER·PE 落·纯接线零规则·不改剧本）。
// 对接 Lead 通用 runner（scripts/acceptance-run.mjs）契约：
//   createWorld(seed, config) → world（须 .tick() / .getAllEntities() / .getComponent(id,type)）
//   applySignal(world, signal, args?, by?) → void（把剧本动作词翻成引擎输入信号）
//   readWorld(world) → worldLike（投影机读态：把 GameFlow.current 投成 StringVar 'flow'；其余 Resource 直读）
// 动作/机读态词表见 docs/design/game102/acceptance/README.md。规则真相全在 blueprint（本文件零规则判断）。
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { applyCommands } from '@zerocraft/engine/net/index.js';
import { QueuedInputSource } from '@zerocraft/engine/net/host/index.js';
import type { IWorld } from '@zerocraft/engine/engine/core/types.js';
import type { Transform, Tag, GameFlow, Caster } from '@zerocraft/engine/engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import type { Level } from './levels.js';
import { TRAY_BIT } from './theme.js';

interface AccWorld {
  engine: Engine;
  input: QueuedInputSource;
  tk: number;
  tick(): void;
  getAllEntities(): string[];
  getComponent(id: string, type: string): unknown;
}

// config（剧本 config 段）→ Level（补默认字段）。剧本只给玩法相关字段，其余取默认。
function toLevel(seed: number, config: Record<string, unknown>): Level {
  return {
    no: 0, name: 'acc', stars: [0, 0, 0], seed,
    cols: 1, rows: 1, palette: ['blue'], ammo: 20,
    conveyorCap: 5, burstCap: 10, slots: 5, beltSpeed: 90,
    limit: { kind: 'moves', n: 99 }, goals: [{ kind: 'clear' }], bitmap: ['0'],
    ...(config as Partial<Level>),
  };
}

export function createWorld(seed: number, config: Record<string, unknown> = {}): AccWorld {
  const input = new QueuedInputSource('g102');
  const engine = new Engine({ input });
  engine.load(buildBlueprint(toLevel(seed, config)));
  const w: AccWorld = {
    engine, input, tk: 0,
    tick(): void { applyCommands(engine.world, input.commandsForTick(++w.tk)); engine.world.tick(); },
    getAllEntities(): string[] { return engine.world.getAllEntities() as string[]; },
    getComponent(id: string, type: string): unknown { return engine.world.getComponent(id, type as never); },
  };
  return w;
}

// 点某实体（逆投影已由 clickable 用世界坐标·此处直接入队该实体 Transform 中心）。
function clickEntity(w: AccWorld, id: string): void {
  const t = w.engine.world.getComponent<Transform>(id, 'Transform');
  if (t) w.input.enqueue({ source: 'g102', x: t.x, y: t.y, phase: 'down' });
}
/**
 * 待发弹库里**首个该色**的炮槽实体 id（`pool-<i>`·`Caster.template === 'cannon_<color>'`）。
 *
 * 为什么要有这个函数（2026-09-28 修·本 adapter 原先点的是 `supply-<color>`）：
 * `supply-<color>` 这个实体 id **全仓只出现在本文件原来那一行**——蓝图里从来没有它
 * （补给口是 `deployQueue()` 生的 `pool-<i>`，见 `blueprint.ts:222`）。于是 `clickEntity` 取不到
 * Transform 就静默 no-op：**每个剧本第一步就点空、全程什么都没发生**，后面所有断言当然全红。
 * 这正是「reject/什么都没发生」那一类最难查的形状——报错没有，只是安静地不动。
 *
 * 正确写法有现成的、且是绿的：`game102.walkthrough.test.ts:28` 的 `tapSupply` helper。本函数照它。
 * 差一处**有意加强**：按 `pool-<i>` 的 **i 数值序**取（不是字符串序——`pool-10` 字符串序在 `pool-2` 前，
 * 而队列语义是「前排=队首」，取错槽就取错了颜色/顺序）。`query` 的迭代序不该被当成稳定契约。
 */
function supplyCannonId(w: AccWorld, color: string): string | undefined {
  const hits: Array<{ i: number; id: string }> = [];
  for (const [id] of w.engine.world.query('Caster', 'Transform')) {
    const m = /^pool-(\d+)$/.exec(id);
    if (!m) continue;
    const c = w.engine.world.getComponent<Caster>(id, 'Caster');
    if (c?.template === `cannon_${color}`) hits.push({ i: Number(m[1]), id });
  }
  hits.sort((a, b) => a.i - b.i);
  return hits[0]?.id;
}

// 第 i 门待命槽炮（Tag 含 TRAY_BIT·按实体 id 稳定序）。
function trayCannonIds(w: AccWorld): string[] {
  const ids: string[] = [];
  for (const [id] of w.engine.world.query('Tag', 'Transform')) {
    const tg = w.engine.world.getComponent<Tag>(id, 'Tag');
    if (tg && (tg.flags & TRAY_BIT) !== 0) ids.push(id);
  }
  return ids.sort();
}

export function applySignal(w: AccWorld, signal: string, _args?: Record<string, unknown>, _by?: string): void {
  const [verb, arg] = signal.split(':');
  switch (verb) {
    case 'tapSupply': {                       // tapSupply:<color> → 点待发弹库里首个该色炮槽 → 生成上带色炮
      const id = arg ? supplyCannonId(w, arg) : undefined;
      // 取不到就**抛**，不再静默 no-op：颜色拼错/该色已取空是剧本或数据的问题，
      // 安静地什么都不做正是本次 bug 藏了这么久的原因（同 tapSlot 那支仍容忍空槽——那是合法局面）。
      if (!id) throw new Error(`game102 adapter: 待发弹库里没有可取的 "${arg}" 色炮槽（pool-<i> 的 Caster.template=cannon_${arg}）`);
      clickEntity(w, id);
      break;
    }
    case 'tapSlot': {                         // tapSlot:<i> → 点第 i 门待命槽炮复用
      const id = trayCannonIds(w)[Number(arg) || 0];
      if (id) clickEntity(w, id);
      break;
    }
    // useSpecial:laser / aim:col|row:<i> = 激光手动瞄准（REQ-G102-SPECIAL·未实现→pending）。
    default: break;
  }
}

// 机读态投影：GameFlow.current → StringVar 'flow'（剧本读 sv:flow）；其余 Resource/Flag 直读引擎世界。
export function readWorld(w: AccWorld): Pick<IWorld, 'getAllEntities' | 'getComponent'> {
  const cur = w.engine.world.getComponent<GameFlow>('flow', 'GameFlow')?.current ?? 'playing';
  const synth: Record<string, Record<string, unknown>> = { '@flow': { StringVar: { type: 'StringVar', id: 'flow', value: cur } } };
  return {
    getAllEntities(): string[] { return [...(w.engine.world.getAllEntities() as string[]), ...Object.keys(synth)] as never; },
    getComponent(id: string, type: string): unknown {
      if (synth[id]) return synth[id][type];
      return w.engine.world.getComponent(id, type as never);
    },
  } as never;
}
