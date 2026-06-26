import { CanvasRenderer } from '../../renderer/index.js';
import { AssetManager, ImageAssetLoader } from '@assets/index.js';
import { LockstepClient } from '@net/index.js';
import type { Channel, NetMsg, Dir } from '@net/index.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap } from '@ui/components/index.js';
import type { Transform, Flag } from '@engine/protocol/components.js';
import { buildClimbWorld, SUMMIT_FLAG, GROUND_TOP } from './climb-world.js';
import { GAME_H_ASSETS } from './assets.js';

// ═══════════════════════════════════════════════════════════════
//  game-h「是男人就上100层 · 双人合作」可挂载卡带
// ═══════════════════════════════════════════════════════════════
//  lockstep 联机：每个标签页一个 LockstepClient，BroadcastChannel 自动组队（再开一个标签页=第2位玩家）。
//  世界=数据驱动的 buildClimbWorld（已过跨端确定性测试）；CanvasRenderer 画世界（相机自动跟双人卷动/缩放）；
//  HUD=新 UI 库 LayoutNode（数据驱动）：层数 + 联机状态 + 操作提示 + 登顶横幅（MVU：每帧由状态重算树→ui.update）。
// ═══════════════════════════════════════════════════════════════

// 由较高玩家的 y 估算攀爬高度（米）。
function heightOf(world: ReturnType<LockstepClient['getWorld']>): number {
  let minY = Infinity;
  for (const [id] of world.query('Controllable', 'Transform')) {
    const t = world.getComponent<Transform>(id, 'Transform');
    if (t && t.y < minY) minY = t.y;
  }
  if (!isFinite(minY)) return 0;
  return Math.max(0, Math.round((GROUND_TOP - minY) / 10));
}

function hudTree(height: number, peers: number, inSync: boolean, won: boolean): LayoutNode {
  const net = peers > 1 ? (inSync ? '🟢 联机中 · 2P' : '🟠 同步中…') : '👤 单人 — 本游戏需双人：再开一个本游戏标签页即第 2 位玩家';
  const children: LayoutNode[] = [
    {
      type: 'Panel', id: 'gh-top', props: {},
      layout: { direction: 'row', gap: 12, padding: 8, align: 'center' },
      children: [
        { type: 'Label', id: 'gh-h', props: { text: `🧗 高度 ${height} m`, size: 'lg', bold: true, color: 'gold' } },
        { type: 'Label', id: 'gh-net', props: { text: net, size: 'sm', color: peers > 1 ? 'ok' : 'dim' } },
      ],
    },
    { type: 'Label', id: 'gh-help', props: { text: '你造我塔：踩住开关→对方的「青色幻影台」才实体化，轮流给对方搭路；踩队友头借力；两人都登顶即过关', size: 'sm', color: 'dim' } },
  ];
  if (won) {
    children.push({ type: 'Panel', id: 'gh-win', props: { title: '🎉 登顶成功 · 两人会合过关！' }, layout: { padding: 14, align: 'center' } });
  }
  return { type: 'Screen', id: 'gh-hud', props: { center: false }, layout: { direction: 'column', gap: 8, padding: 12 }, children };
}

export function mount(container: HTMLElement, _host?: { exit?: () => void }): () => void {
  // 世界画布层 + HUD 叠加层（绝对定位、HUD 不拦截画布点击）。
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;inset:0;background:#0f1830;display:flex;align-items:center;justify-content:center';
  const stage = document.createElement('div');
  stage.style.cssText = 'position:relative;width:640px;height:400px;border:1px solid #334155;border-radius:6px;overflow:hidden';
  wrapper.appendChild(stage);
  container.appendChild(wrapper);

  // 美术：注册精灵表 → 异步加载（就绪前退化占位，就绪后画真帧）。
  const assets = new AssetManager(new ImageAssetLoader());
  assets.registerManifest(GAME_H_ASSETS);
  void assets.loadAll();
  const renderer = new CanvasRenderer({ width: 640, height: 400, assets });
  renderer.init(stage); // 画布先入（在底层）
  const hudHost = document.createElement('div'); // HUD 叠加层在画布之上
  hudHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  stage.appendChild(hudHost);

  // 输入：按住集合 → Dir{dx,dy,jump}（jump 是平台关键，mp-client demo 漏了，这里补上）。
  const held = new Set<string>();
  const onDown = (e: KeyboardEvent): void => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); held.add(e.code); };
  const onUp = (e: KeyboardEvent): void => { held.delete(e.code); };
  const onBlur = (): void => held.clear();
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  const getInput = (): Dir => ({
    dx: (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0),
    dy: 0,
    jump: held.has('Space') || held.has('ArrowUp') || held.has('KeyW') ? 1 : 0,
  });

  // lockstep 传输：同源标签页经 BroadcastChannel 自动发现组队。
  const bc = new BroadcastChannel('apollo-game-h-climb');
  const channel: Channel = {
    post: (m) => bc.postMessage(m),
    onMessage: (cb) => { bc.onmessage = (e) => cb(e.data as NetMsg); },
    close: () => bc.close(),
  };
  // 每个标签页唯一 peerId（仅用于网络组队、不进 sim 状态 → 表现层用 Math.random 合规）。
  const peerId = `gh-${Math.random().toString(36).slice(2, 9)}`;
  const client = new LockstepClient({ peerId, channel, getInput, tickRate: 30, inputDelay: 4, buildWorld: buildClimbWorld });

  const ui = mountUI(hudHost, hudTree(0, 1, false, false));

  let last = globalThis.performance?.now?.() ?? 0;
  let raf = 0;
  let hudTick = 0;
  const frame = (now: number): void => {
    client.pump(now - last); last = now;
    const world = client.getWorld();
    renderer.sync(world);
    if (hudTick++ % 6 === 0) { // 每 6 帧刷新 HUD（省重排）
      const v = client.view();
      const won = !!world.getComponent<Flag>('goal', 'Flag')?.active;
      ui.update(hudTree(heightOf(world), v.peerCount, v.inSync, won));
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', onBlur);
    ui();
    client.dispose();
    renderer.destroy();
    wrapper.remove();
  };
}
