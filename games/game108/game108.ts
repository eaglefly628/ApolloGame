// game108《拳律》—— 卡带宿主层（mount/host·契约明许·零玩法逻辑）。
// 职责都在 sim 外：建 Engine + 运行环、把 world 投影成 DuelView、把 UI action 入队成引擎输入、cleanup。
// 玩法规则一律在 blueprint.ts 的数据 + 引擎能力里。
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import type { MountHandle } from '@zerocraft/engine/ui/components/index.js';
import { mountHost } from '@zerocraft/engine/engine/host/mount-host.js';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { QueuedInputSource } from '@zerocraft/engine/net/index.js';
import type { Resource, GameFlow, StringVar } from '@zerocraft/engine/engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildDuelScreen, emptyView, type DuelView, type Phase } from './duel-screen.js';
import { DUEL_THEME, VIEW_W, VIEW_H, HANDS, SIDES, HP_RES, chargeEntity, lastThrowVar, PHASE_TICKS, type Hand, type Side } from './theme.js';

const STAGE_BG = 'radial-gradient(120% 90% at 50% 40%, #1a2230 0%, #070a0f 82%)';

export function mount(container: HTMLElement): () => void {
  const { scene, teardown } = mountHost(container, {
    fieldW: VIEW_W, fieldH: VIEW_H, sceneBackground: STAGE_BG, wrapperBackground: '#05070b',
  });

  const engine = new Engine();
  engine.load(buildBlueprint());
  const queue = new QueuedInputSource('p1'); // UI action → 引擎输入（keybind 转成 Signal）

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
    return {
      phase,
      phaseLeft: total > 0 ? Math.max(0, 1 - elapsed / total) : 0,
      hp: { p1: num('p1'), p2: num('p2') },
      charge,
      ...(phase === 'clash' || phase === 'settle' ? { shown } : {}),
    };
  }

  // UI action → 入队（引擎侧 keybind 把动作名转成 Signal·handler 里零自由逻辑=信号铁律）。
  const ui: MountHandle = mountUI(scene, buildDuelScreen(emptyView()), {}, DUEL_THEME, {
    enqueueAction: (name: string, value?: { arg?: string }) => { queue.enqueueAction(name, value?.arg ? { arg: value.arg } : undefined); },
  });

  let raf = 0;
  const loop = (): void => {
    engine.world.tick();
    ui.update(buildDuelScreen(readView()), DUEL_THEME);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => { cancelAnimationFrame(raf); ui(); teardown(); };
}

export { lastThrowVar, HP_RES };
