import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { prepareArmies, buildGameGArmyMatch, FORMATION_PRESETS, bossFor, FLIP_DURATION, MARCH_DURATION } from './index.js';
import { renderBattleDoc } from './battle-screen.js';
import { buildBattleView, freshSave } from './game-g.js';

// ═══════════════════════════════════════════════════════════════
//  Game G 战斗屏视觉回归（无头）—— 真 MARCH-1 world → buildBattleView → battle-screen 真渲染器 → 自包含 HTML。
//  同 game-f frameSvg 套路：容器内确定性"看帧"，golden 落 __frames__/（浏览器直接打开 = 真游戏战斗屏）。
//  渲 HTML 而非 PNG：node 无 GL（既定）；HTML 自带 CSS+字体，浏览器开即真画面。改了视觉 → toMatchFileSnapshot 当场 diff。
// ═══════════════════════════════════════════════════════════════
const frameAt = (ticks: number, theme: 'onyx' | 'brocade' = 'onyx'): string => {
  const boss = bossFor(2);
  const { a, b, moraleA, linksA } = prepareArmies({ formation: FORMATION_PRESETS['锋矢'], deckBias: 8, jokers: ['bannerman', 'warlord'], interventions: [], enemyForm: boss.formation, enemyBias: boss.favorBias, boss });
  const e = new Engine({ tickRate: 60 });
  e.load(buildGameGArmyMatch(a, b, 7, undefined, moraleA, linksA));
  for (let i = 0; i < ticks; i++) e.world.tick();
  const save = freshSave();
  save.materials = 28;
  const view = buildBattleView(e.world, save, boss.name, boss.persona, 'h');
  return renderBattleDoc(view, theme);
};

describe('Game G · 战斗屏视觉回归（真渲染器 → HTML golden · 无头 · design/UI 三路战场）', () => {
  it('行军中帧（兵面朝下沿三路推进）匹配 golden', async () => {
    const html = frameAt(Math.round(FLIP_DURATION * 0.45));
    expect(html).toContain('我方老家'); // 顶部 HUD（真渲染器输出·非空）
    expect(html).toContain('干预卡 · Levers'); // 左栏
    expect(html).toContain('占领敌方老家'); // 相位条
    expect(html).toContain('--accent:#ff5d2e'); // 玄铁皮
    await expect(html).toMatchFileSnapshot('./__frames__/battle-march.html');
  });

  it('破家帧（幸存突破·攻克敌老家）匹配 golden', async () => {
    const html = frameAt(FLIP_DURATION + MARCH_DURATION + 4);
    await expect(html).toMatchFileSnapshot('./__frames__/battle-break.html');
  });

  it('锦霞皮帧匹配 golden', async () => {
    const html = frameAt(FLIP_DURATION + MARCH_DURATION + 4, 'brocade');
    expect(html).toContain('--accent:#d8607b'); // 锦霞皮
    await expect(html).toMatchFileSnapshot('./__frames__/battle-brocade.html');
  });

  it('确定性：同帧两次渲染逐字符一致（回归基线稳）', () => {
    expect(frameAt(60)).toBe(frameAt(60));
  });
});
