// game101 ·《海港绯闻》—— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 玩法+美术**结合**：完整 S1 漂亮界面（HUD+顾客订单+Twemoji 板+导航）+ **活板**——
//   引擎 sim 跑（生成器点击产出/资源/体力恢复/自动合并·headless 测过），每帧把世界态投影进 S1 板格
//   （物品显真 Twemoji·合并即变·生成器格可点·体力/金币实时）。宿主只搭 UI/输入/投影胶水·零玩法逻辑。
// 交互：生成器格 Panel.action=tap_<id> → mountUI ActionSink 入队 → KeyBinding 转信号 → craft-recipe/caster。
// ⚠ 缺口（主程域·数据已备待接）：真·拖拽合并 REQ-MERGE-ON-PLACE（现自动合并）；加权掉落 REQ-TAPSPAWN（现固定产出）。
import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { HandlerMap, MountHandle } from '@ui/components/index.js';
import type { Resource, PrefabOrigin, Transform } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildS1Live, type S1State, type CellView } from './s1.js';
import { GAME101_THEME } from './ui-theme.js';
import { GAME, RES, GENERATORS, ITEM_EMOJI, cellIndexOf } from './theme.js';

const SCREEN_W = 1080;
const SCREEN_H = 1920;

export function mount(container: HTMLElement, _host?: { exit: () => void }): () => void {
  const { scene, teardown } = mountHost(container, {
    fieldW: SCREEN_W,
    fieldH: SCREEN_H,
    sceneBackground: GAME101_THEME.pageBg,
    wrapperBackground: '#2a1c12',
  });

  const input = new QueuedInputSource('101');
  const engine = new Engine({ input });
  engine.load(buildBlueprint());

  // 世界态 → S1State（纯读·outcome-first）：板格=生成器(可点)/物品 Twemoji；HUD=真资源。
  function readState(): S1State {
    const w = engine.world;
    const res = (id: string): number => w.getComponent<Resource>(id, 'Resource')?.current ?? 0;
    const cells: (CellView | null)[] = new Array(GAME.board.cols * GAME.board.rows).fill(null);
    for (const g of GENERATORS) cells[g.cell] = { emoji: g.emoji, gen: g.id };
    for (const [eid] of w.query('PrefabOrigin')) {
      const po = w.getComponent<PrefabOrigin>(eid, 'PrefabOrigin');
      const t = w.getComponent<Transform>(eid, 'Transform');
      if (!po || !t) continue;
      const idx = cellIndexOf(t.x, t.y);
      if (idx >= 0 && !cells[idx]) cells[idx] = { emoji: ITEM_EMOJI[po.templateId] ?? '❓' };
    }
    return { energy: res(RES.energy), coins: res(RES.coins), cells };
  }

  // 导航信号占位（真弹层=后续 slice）；生成器 tap_<id> **不放 handler** → 走 ActionSink 入队 → sim。
  const noop = (): void => {};
  const handlers: HandlerMap = { open_shop: noop, open_menu: noop, open_tasks: noop, open_reno: noop, open_events: noop, deliver_order: noop, gen_left: noop, gen_right: noop, delete_sel: noop };

  const ui: MountHandle = mountUI(scene, buildS1Live(readState()), handlers, GAME101_THEME, input);
  let lastSig = '';
  const unsub = engine.subscribe(() => {
    const st = readState();
    const sig = `${Math.round(st.energy)}|${Math.round(st.coins)}|${st.cells.map((c) => (c ? c.emoji : '') + (c?.gen ?? '')).join(',')}`;
    if (sig !== lastSig) { lastSig = sig; ui.update(buildS1Live(st), GAME101_THEME); }
  });

  engine.start();

  return () => {
    unsub();
    engine.stop();
    ui();
    teardown();
  };
}
