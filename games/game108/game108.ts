// game108《拳律》—— 卡带宿主层（mount/host·契约明许·零玩法逻辑）。
// 职责都在 sim 外：建 Engine + 运行环、把 world 投影成 DuelView、把 UI action 入队成引擎输入、cleanup。
// 玩法规则一律在 blueprint.ts 的数据 + 引擎能力里。
import { mountUI, resolveBindings } from '@zerocraft/engine/ui/components/index.js';
import type { MountHandle, LayoutNode, UIDataSource } from '@zerocraft/engine/ui/components/index.js';
import { mountHost } from '@zerocraft/engine/engine/host/mount-host.js';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { QueuedInputSource } from '@zerocraft/engine/net/index.js';
import type { Resource, GameFlow, StringVar } from '@zerocraft/engine/engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildDuelScreen, emptyView, type DuelView, type Phase } from './duel-screen.js';
import { DUEL_THEME, VIEW_W, VIEW_H, HANDS, SIDES, HP_MAX, HP_RES, chargeEntity, lastThrowVar, PHASE_TICKS, type Hand, type Side } from './theme.js';

const STAGE_BG = 'radial-gradient(120% 90% at 50% 40%, #1a2230 0%, #070a0f 82%)';

export function mount(container: HTMLElement): () => void {
  const { scene, teardown } = mountHost(container, {
    fieldW: VIEW_W, fieldH: VIEW_H, sceneBackground: STAGE_BG, wrapperBackground: '#05070b',
  });

  // UI action → 引擎输入：QueuedInputSource 同时是 Engine 的输入源与 mountUI 的 ActionSink
  // （同 game101 口径）——屏上的 `action` 入队成 InputQueue 动作，再由 t2-keybind 转成 Signal。
  const queue = new QueuedInputSource('p1');
  const engine = new Engine({ input: queue });
  engine.load(buildBlueprint());

  const num = (eid: string): number => engine.world.getComponent<Resource>(eid, 'Resource')?.current ?? 0;
  const str = (eid: string): string => engine.world.getComponent<StringVar>(eid, 'StringVar')?.value ?? '';

  /** world → 视图（**纯读**·outcome-first；不在这里做任何规则计算）。 */
  function readView(): DuelView {
    const flow = engine.world.getComponent<GameFlow>('flow', 'GameFlow');
    const phase = (flow?.current ?? 'charge') as Phase;
    const elapsed = flow?.elapsed ?? 0;
    const total = PHASE_TICKS[phase as keyof typeof PHASE_TICKS] ?? PHASE_TICKS.charge;
    const charge = Object.fromEntries(SIDES.map((s) => [
      s, Object.fromEntries(HANDS.map((h) => [h, num(chargeEntity(s, h))])) as Record<Hand, number>,
    ])) as Record<Side, Record<Hand, number>>;
    const shown = Object.fromEntries(SIDES.map((s) => [s, str(`var:${s}`) as Hand | ''])) as Record<Side, Hand | ''>;
    const hp = { p1: num('p1'), p2: num('p2') };

    // ── 表现层派生（**不是规则**·不写世界·不进 hash）───────────────────────
    // ① 本回合我提交了什么：读世界里我这侧的 DuelIntent（接缝挂上去的那份）。
    const intent = engine.world.getComponent('p1', 'DuelIntent') as { throw: Hand } | undefined;
    // ② 上一次结算「谁赢了、打了多少」：**比对上一帧的血量**。为什么这么做——
    //    `DuelOutcome` 在 Commit 被 announce 消费掉、跨不到宿主；而"谁掉了多少血"本身就是
    //    玩家看得见的事实，用它反推展示是**投影不是判定**（规则仍只在引擎里）。
    for (const s of SIDES) {
      if (prevHp[s] > hp[s]) lastOutcome = { winner: s === 'p1' ? 'p2' : 'p1', damage: prevHp[s] - hp[s] };
    }
    if (phase === 'clash' && prevPhase !== 'clash') tieThisRound = true;      // 进对决先假定平局
    if (lastOutcome && lastOutcome.damage > 0) tieThisRound = false;
    prevHp = { ...hp }; prevPhase = phase;

    return {
      phase,
      phaseLeft: total > 0 ? Math.max(0, 1 - elapsed / total) : 0,
      round: num('round') || 1,
      hp,
      charge,
      smoke: { uses: num('smoke:uses:p1'), hidden: !!(engine.world.getComponent('smoke:res:p1', 'Flag') as { active: boolean } | undefined)?.active },
      ...(intent ? { submitted: intent.throw } : {}),
      ...(phase === 'clash' || phase === 'settle' ? { shown } : {}),
      ...(lastOutcome ? { outcome: lastOutcome } : tieThisRound && (phase === 'clash' || phase === 'settle') && shown.p1 && shown.p2
        ? { outcome: { winner: 'tie' as const, damage: 0 } } : {}),
    };
  }

  // 表现层记忆（render-only·不进 sim/hash）：用于「上一次结算掉了多少血」的横幅。
  let prevHp: Record<Side, number> = { p1: HP_MAX, p2: HP_MAX };
  let prevPhase: Phase = 'charge';
  let tieThisRound = false;
  let lastOutcome: { winner: Side | 'tie'; damage: number } | undefined;

  /**
   * 世界数据源（引擎的 DI 接缝）：`LayoutNode` 里的 `props.bind` **不会自己生效**——
   * `mountUI` 没有数据源入口，得游戏在交树之前自己跑一遍 `resolveBindings(tree, ds)`。
   * 不跑 = `bind` 是个哑弹：条永远画在 0，**不报错**（2026-08-07 点击探针截图目击：
   * 石槽文字已 3/3、条却是空的）。
   * 只读（显示）；写世界一律走 action 信号——两端分明是这条接缝的红线。
   */
  const dataSource: UIDataSource = {
    resource: (id) => {
      for (const [e] of engine.world.query('Resource')) {
        const r = engine.world.getComponent<Resource>(e, 'Resource');
        if (r && r.id === id) return { current: r.current, ...(r.max !== undefined ? { max: r.max } : {}) };
      }
      return undefined;
    },
  };
  const screen = (v: DuelView): LayoutNode => resolveBindings(buildDuelScreen(v), dataSource);

  // handlers 传空 {}：屏上没有任何本地 handler，写世界一律经 action 信号（信号铁律）。
  const ui: MountHandle = mountUI(scene, screen(emptyView()), {}, DUEL_THEME, queue);

  // 运行环走**引擎自己的** `start()`（房屋口径·同 game101）——不许自己搓 rAF 圈直接调
  // `world.tick()`：`Engine.step()` 在 tick 之前那一句 `applyCommands(world, input.commandsForTick(...))`
  // 才是把 UI 入队的动作注进世界的**唯一**接缝，绕过它 = 队列一直填、永远没人取
  // ⇒ 点了没反应，而且**不报错**（2026-08-07 点击探针实测抓到，单测与渲染探针都照绿）。
  // 另有固定步长时钟（真实流逝时间 → 整数模拟步），自搓的圈还会让相位时长随帧率漂。
  engine.subscribe(() => { ui.update(screen(readView()), DUEL_THEME); });
  engine.start();

  return () => { engine.stop(); ui(); teardown(); };
}

export { lastThrowVar, HP_RES };
