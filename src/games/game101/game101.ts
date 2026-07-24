// game101 ·《海港绯闻》—— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// S4 可玩：引擎 play-field 真板（CanvasRenderer 画物品/生成器）+ 指针点击输入（点生成器→耗体力→产出）+
//   merge-rule 自动合并 + 顶部 HUD 实时投影（体力/金币·纯读世界·outcome-first）。玩法规则全在 blueprint 数据
//   + 引擎能力里（见其头注）。宿主只搭渲染器/输入/HUD 胶水。
// ⚠ 观感：play-field 物品/生成器当前=引擎色块占位（链色×等级亮度）——真 sprite 走 S6 美术台账皮肤槽。
//   真·拖拽合并（拖同类才合）待引擎能力 REQ-MERGE-ON-PLACE；当前=自动合并（2 同类即合）。
import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { QueuedInputSource, canvasPointerToScreen } from '@net/index.js';
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, MountHandle } from '@ui/components/index.js';
import type { Resource } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { GAME101_THEME } from './ui-theme.js';
import { FIELD_W, FIELD_H, RES, ENERGY } from './theme.js';

const TOP_BAR_H = 92;
const SCENE_BG =
  'radial-gradient(circle at 50% 20%, #bfeaf6 0%, #a6def0 45%, #7fcfe6 100%)';

function buildHud(energy: number, coins: number): LayoutNode {
  return {
    type: 'Panel', id: 'hud', props: { bare: true },
    layout: { direction: 'row', align: 'center', justify: 'between', gap: 12, padding: 12 },
    children: [
      {
        type: 'Panel', id: 'hud-stats', props: { bare: true },
        layout: { direction: 'row', align: 'center', gap: 14 },
        children: [
          { type: 'Label', id: 'hud-e', props: { text: `⚡ ${Math.round(energy)}/${ENERGY.cap}`, color: 'text', bold: true } },
          { type: 'Label', id: 'hud-c', props: { text: `🪙 ${Math.round(coins)}`, color: 'gold', bold: true } },
        ],
      },
      { type: 'Label', id: 'hud-hint', props: { text: '点生成器产出 · 同类自动合并', color: 'sub', size: 'sm' } },
    ],
  };
}

export function mount(container: HTMLElement, _host?: { exit: () => void }): () => void {
  const { scene, topHost, teardown } = mountHost(container, {
    fieldW: FIELD_W,
    fieldH: FIELD_H,
    topBarH: TOP_BAR_H,
    sceneBackground: SCENE_BG,
    wrapperBackground: '#2a1c12',
  });

  const input = new QueuedInputSource('101');
  const engine = new Engine({ input });
  engine.load(buildBlueprint());

  const renderer = new CanvasRenderer({ width: FIELD_W, height: FIELD_H, background: 'transparent' });
  engine.attachRenderer(renderer, scene);
  const canvas = scene.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas) canvas.style.zIndex = '1';

  // 画布点击 → 逆投影为世界坐标 → 入队；clickable 命中生成器 → 信号 → craft-recipe/caster 消费。
  const onDown = (ev: PointerEvent): void => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const p = canvasPointerToScreen(ev.clientX, ev.clientY, rect, canvas.width / dpr, canvas.height / dpr);
    input.enqueue({ source: '101', x: p.x, y: p.y, phase: 'down' });
  };
  canvas?.addEventListener('pointerdown', onDown);

  // HUD 实时投影（纯读世界·outcome-first）。
  const readRes = (id: string): number => engine.world.getComponent<Resource>(id, 'Resource')?.current ?? 0;
  const hud: MountHandle = mountUI(topHost, buildHud(readRes(RES.energy), readRes(RES.coins)), {}, GAME101_THEME);
  let lastSig = '';
  const unsub = engine.subscribe(() => {
    const e = readRes(RES.energy), c = readRes(RES.coins);
    const sig = `${Math.round(e)}|${Math.round(c)}`;
    if (sig !== lastSig) { lastSig = sig; hud.update(buildHud(e, c), GAME101_THEME); }
  });

  engine.start();

  return () => {
    unsub();
    engine.stop();
    canvas?.removeEventListener('pointerdown', onDown);
    renderer.destroy();
    hud();
    teardown();
  };
}
