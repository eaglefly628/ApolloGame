import { Engine } from './runtime/engine.js';
import { CanvasRenderer } from './renderer/index.js';
import { AssetManager, ImageAssetLoader } from '@assets/index.js';
import { SwitchableInputSource } from './net/index.js';
import {
  buildGameABlueprint,
  GAME_A_STAGES,
  GAME_A_ASSETS,
  KEYMAP_A,
  PLAYER_A,
  PLAYER_B,
  VIEWPORT_W,
  VIEWPORT_H,
} from './games/game-a/index.js';

// Game A 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 单人「切换双人玩」：一套键盘控制当前激活角色，Tab 在 蓝A/橙B 间轮换（SwitchableInputSource，
// 零引擎改动——非激活角色本 tick 无指令即原地待命）。美术=原版可爱小方块。数字键 1/2/3 选关。
export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:#16213e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#cbd5e1;font:13px system-ui';

  const bar = document.createElement('div'); // 选关 + 关卡名
  bar.style.cssText = 'font-weight:600;text-align:center';
  const tip = document.createElement('div'); // 当前关玩法提示
  tip.style.cssText = 'text-align:center;line-height:1.6;max-width:600px;min-height:34px';
  const active = document.createElement('div'); // 当前操控角色
  active.style.cssText = 'font-weight:600';
  const stage = document.createElement('div');
  stage.style.cssText = `width:${VIEWPORT_W}px;height:${VIEWPORT_H}px;border:1px solid #334155;border-radius:6px;overflow:hidden`;

  wrapper.append(bar, tip, active, stage);
  container.appendChild(wrapper);

  // 每关玩法提示（双人协作 + 切换）。
  const TIPS = [
    '🟦A 踩住开关把门打开 → Tab 切 🟧B → B 穿过门走到目标过关（A 留在开关上）',
    '协力攀塔：🟦A 踩住平台上的开关，半透明「幻影台」就变实 → Tab 切 🟧B，踩着幻影台跨过缺口往上爬到顶过关',
    '各守一台：把 🟦A 停在左台、Tab 切 🟧B 守右台，两台同时被踩 → 中间闸门开 → 让先到的角色进右侧目标',
  ];

  const input = new SwitchableInputSource([PLAYER_A, PLAYER_B], window, KEYMAP_A, 'Tab');
  const assets = new AssetManager(new ImageAssetLoader());
  assets.registerManifest(GAME_A_ASSETS); // 原版可爱小方块
  void assets.loadAll();

  let engine: Engine | null = null;
  let idx = 1; // 默认进 关2「协力攀塔」（owner 指定的"往上跳"关）

  const loadStage = (i: number): void => {
    idx = i;
    engine?.stop();
    stage.replaceChildren();
    bar.textContent = `选关：1 / 2 / 3（数字键切换）　|　当前：${GAME_A_STAGES[i].name}`;
    tip.textContent = TIPS[i] ?? '';
    engine = new Engine({ tickRate: 60, input });
    engine.load(buildGameABlueprint(GAME_A_STAGES[i].level));
    engine.attachRenderer(new CanvasRenderer({ width: VIEWPORT_W, height: VIEWPORT_H, assets }), stage);
    engine.start();
  };

  const onKey = (e: KeyboardEvent): void => {
    const n = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
    if (n !== undefined && n !== idx) loadStage(n);
  };
  window.addEventListener('keydown', onKey);

  const refreshActive = (): void => {
    const a = input.activePlayerId();
    active.textContent = `A/D 移动 · Space 跳 · Tab 切角色　|　当前操控：${a === PLAYER_A ? '🟦 蓝 A' : '🟧 橙 B'}`;
    active.style.color = a === PLAYER_A ? '#60a5fa' : '#fb923c';
  };
  refreshActive();
  const activeTimer = window.setInterval(refreshActive, 120);

  loadStage(idx);

  return () => {
    window.clearInterval(activeTimer);
    window.removeEventListener('keydown', onKey);
    engine?.stop();
    input.dispose();
    wrapper.remove();
  };
}
