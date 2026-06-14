import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from './three-renderer.js';
import { buildGameGMatch, type FateCard } from './index.js';
import type { State, Resource } from '@engine/protocol/components.js';

// Game G ·《翻命扑克》一局掷命（launcher 卡带槽：export mount(container)→cleanup）。自包含于本目录。
// outcome-first：每张牌按 favor 跑确定性种子硬币**先定生死**，3D 翻牌是**反推的表现**（tween 翻到既定面，
//   正面金=活 / 反面石板=死）。数存活→比数定胜负→我方胜掉材。翻牌不决定胜负→跨端浮点不影响 gameplay。
// 零新 capability；3D 仅在 ThreeRenderer 渲染后端 + render-only Card3D 组件。逻辑全 headless 测过，画面仅浏览器。
const W = 460;
const H = 600;

// 我方(偏强)vs 敌方(偏弱)各 3 张；favor 越高越易正面(活)。同一局 seed 随机 → 每次结果不同但确定。
const TEAM_A: FateCard[] = [{ id: 'a1', favor: 85 }, { id: 'a2', favor: 70 }, { id: 'a3', favor: 60 }];
const TEAM_B: FateCard[] = [{ id: 'b1', favor: 45 }, { id: 'b2', favor: 35 }, { id: 'b3', favor: 25 }];

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;background:#0a0a14;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#cbd5e1;font:13px system-ui';

  const hint = document.createElement('div');
  hint.style.cssText = 'max-width:460px;text-align:center;line-height:1.5;opacity:.85';
  hint.innerHTML =
    '翻命扑克 · <b>一局掷命</b>：胜负 <b>先定</b>（属性加权种子硬币），物理翻牌是 <b>反推的表现</b>。<br>上排敌方 / 下排我方；正面金 = 活，反面石板 = 死。数存活定胜负。';

  const stage = document.createElement('div');
  stage.style.cssText = `width:${W}px;height:${H}px;border:1px solid #334155;border-radius:10px;overflow:hidden`;

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:10px;align-items:center';
  const label = document.createElement('div');
  label.style.cssText = 'min-width:240px;text-align:center;font-weight:600';
  const btnFight = mkBtn('再来一局（随机种子）');
  bar.append(btnFight, label);

  wrapper.append(hint, stage, bar);
  container.appendChild(wrapper);

  let engine: Engine | null = null;
  let renderer: ThreeRenderer | null = null;

  const refresh = (): void => {
    if (!engine) return;
    const w = engine.world;
    const winner = w.getComponent<State>('winner', 'State')?.current ?? 'pending';
    const a = w.getComponent<Resource>('res_a', 'Resource')?.current ?? 0;
    const b = w.getComponent<Resource>('res_b', 'Resource')?.current ?? 0;
    const mats = w.getComponent<Resource>('res_mats', 'Resource')?.current ?? 0;
    if (winner === 'pending') {
      label.textContent = '掷命中…';
      label.style.color = '#cbd5e1';
    } else {
      const who = winner === 'a' ? '我方胜' : winner === 'b' ? '敌方胜' : '平局';
      label.textContent = `${who} ｜ 存活 我 ${a} : ${b} 敌 ｜ 材料 ${mats}`;
      label.style.color = winner === 'a' ? '#eab308' : winner === 'b' ? '#94a3b8' : '#cbd5e1';
    }
  };

  const teardown = (): void => {
    if (engine) engine.stop();
    if (renderer) renderer.destroy();
  };

  const newMatch = (): void => {
    teardown();
    engine = new Engine({ tickRate: 60 });
    engine.load(buildGameGMatch(TEAM_A, TEAM_B, Math.floor(Math.random() * 1e9)));
    renderer = new ThreeRenderer({ width: W, height: H });
    engine.attachRenderer(renderer, stage);
    engine.subscribe(refresh); // 每帧刷新胜负/存活/材料显示（掷命中→揭晓）
    engine.start();
    refresh();
  };

  btnFight.onclick = newMatch;
  newMatch();

  return () => {
    teardown();
    wrapper.remove();
  };
}

function mkBtn(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.cssText =
    'padding:7px 12px;border-radius:8px;border:1px solid #334155;background:#15202b;color:#e2e8f0;cursor:pointer;font:12px system-ui';
  return b;
}
