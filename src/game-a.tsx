import { Engine } from './runtime/engine.js';
import { CanvasRenderer } from './renderer/index.js';
import { AssetManager, ImageAssetLoader } from '@assets/index.js';
import { SwitchableInputSource } from './net/index.js';
import {
  buildGameABlueprint,
  LEVEL_SWITCH,
  KEYMAP_A,
  PLAYER_A,
  PLAYER_B,
  VIEWPORT_W,
  VIEWPORT_H,
} from './games/game-a/index.js';
import { DUNGEON_SKIN } from './games/game-a/dungeon-skin.js';

// Game A 可挂载模块（launcher 卡带槽契约：export mount(container) → cleanup）。
// 单人「切换双人玩」：一套键盘控制当前激活角色，Tab 在 精灵A/矮人B 间轮换（SwitchableInputSource，
// 零引擎改动——非激活角色本 tick 无指令即原地待命）。地牢皮（DUNGEON_SKIN）把同一份数据换成 DCSS 像素美术。
// 关卡 LEVEL_SWITCH「你踩我过」正是切换协作的范式：A 踩开关开门 → 切到 B → B 穿门到楼梯过关。
export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:#16213e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#cbd5e1;font:13px system-ui';

  const hint = document.createElement('div');
  hint.style.cssText = 'text-align:center;line-height:1.6';
  const active = document.createElement('div');
  active.style.cssText = 'font-weight:600';

  const stage = document.createElement('div');
  stage.style.cssText = `width:${VIEWPORT_W}px;height:${VIEWPORT_H}px;border:1px solid #334155;border-radius:6px;overflow:hidden`;

  wrapper.appendChild(hint);
  wrapper.appendChild(active);
  wrapper.appendChild(stage);
  container.appendChild(wrapper);

  hint.innerHTML =
    'A/D 移动 · Space 跳 · <b>Tab 切换角色</b><br>' +
    '玩法：操 🧝 精灵踩住开关把门打开 → Tab 切到 🧔 矮人 → 让矮人穿门走到楼梯即过关（精灵会留在开关上）';

  // 单人轮替操控：一套键位驱动「当前激活」的 playerId，Tab 在 A/B 间循环。
  const input = new SwitchableInputSource([PLAYER_A, PLAYER_B], window, KEYMAP_A, 'Tab');
  const refreshActive = () => {
    const a = input.activePlayerId();
    active.textContent = a === PLAYER_A ? '当前操控：🧝 精灵 A（守开关）' : '当前操控：🧔 矮人 B（去楼梯）';
    active.style.color = a === PLAYER_A ? '#60a5fa' : '#fb923c';
  };
  refreshActive();
  const activeTimer = window.setInterval(refreshActive, 120);

  // 美术资产（数据驱动）：注册「地牢皮」→ 异步加载；就绪前渲染器退化占位方块，就绪后自动画 DCSS 像素图。
  // 「换皮」= 换这一行注册的清单（GAME_A_ASSETS=SVG 占位 / DUNGEON_SKIN=DCSS），蓝图与逻辑一行不改。
  const assets = new AssetManager(new ImageAssetLoader());
  assets.registerManifest(DUNGEON_SKIN);
  void assets.loadAll();

  const engine = new Engine({ tickRate: 60, input });
  engine.load(buildGameABlueprint(LEVEL_SWITCH));
  engine.attachRenderer(new CanvasRenderer({ width: VIEWPORT_W, height: VIEWPORT_H, assets }), stage);
  engine.start();

  return () => {
    window.clearInterval(activeTimer);
    engine.stop();
    input.dispose();
    wrapper.remove();
  };
}
