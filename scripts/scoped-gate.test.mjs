// scripts/scoped-gate.test.mjs —— 智能门禁分类器行为契约（owner 2026-07-21）。
// 铁律=只在可证明安全时缩范围·任何不确定一律 full——本测钉死"缩错"不发生。
import { describe, it, expect } from 'vitest';
import { classify, auditGamesOf, planFor } from './scoped-gate.mjs';

describe('scoped-gate 分类器（缩范围只在可证明安全时）', () => {
  it('无改动 → none', () => {
    expect(classify([]).scope).toBe('none');
  });

  it('碰引擎/共享面 → full（下游全可能坏·绝不缩）', () => {
    expect(classify(['src/engine/protocol/components.ts']).scope).toBe('full');
    expect(classify(['src/skills/tier3/hand-pattern.ts']).scope).toBe('full');
    expect(classify(['src/ui/components/render.ts']).scope).toBe('full');
    expect(classify(['scripts/game-pipeline.mjs']).scope).toBe('full');
    expect(classify(['vite.config.ts']).scope).toBe('full');
    expect(classify(['src/launcher.tsx']).scope).toBe('full');
  });

  it('引擎面 + 游戏面同改 → full（不因掺了游戏就缩）', () => {
    expect(classify(['games/game-a/rules.ts', 'src/engine/x.ts']).scope).toBe('full');
  });

  it('改动收敛单游戏（src/public/docs 混合）→ game:<g>', () => {
    const c = classify([
      'games/game-a/guandan-session.ts',
      'public/games/game-a/art/index.json',
      'docs/design/game-a/requests.md',
    ]);
    expect(c.scope).toBe('game');
    expect(c.game).toBe('game-a');
  });

  it('单游戏面 + 通用文档 → 仍 game:<g>（通用文档不影响编译）', () => {
    const c = classify(['games/game-b/mahjong.ts', 'docs/workflow/requests.md']);
    expect(c).toMatchObject({ scope: 'game', game: 'game-b' });
  });

  it('多游戏同改 → full（安全兜底）', () => {
    expect(classify(['games/game-a/x.ts', 'games/game-b/y.ts']).scope).toBe('full');
  });

  it('仅通用文档 → docs-only（跳过编译门禁）', () => {
    expect(classify(['docs/workflow/requests.md', 'README.md']).scope).toBe('docs-only');
  });

  it('仅单游戏文档（无编译/资产）→ docs-only', () => {
    expect(classify(['docs/design/game-a/gdd.md']).scope).toBe('docs-only');
  });

  it('无法归类的非文档改动 → full（不认识=不敢缩）', () => {
    expect(classify(['weird/unknown-file.ts']).scope).toBe('full');
    expect(classify(['src/foo.ts']).scope).toBe('full'); // src 下非 games = 引擎/共享
  });

  it('游戏资产单改（public/games/<g>）→ game（该游戏 vendor/asset 测试守）', () => {
    const c = classify(['public/games/game-a/art/cards/ace-of-spades.svg']);
    expect(c).toMatchObject({ scope: 'game', game: 'game-a' });
  });
});

// ── audit 进推送门（8/4 大评审 Q1 消费路径批·2026-08-10）──
// 语义钉死三条：碰 games/<g>/** 非文档 → 门禁计划里出现只扫这些游戏的 audit 步；
// 纯文档/资产/引擎面不触发；绝不因单游戏改动全库扫描。
describe('scoped-gate × game-skill-audit（audit 进推送门·只扫改动游戏）', () => {
  it('auditGamesOf：games/<g>/** 非文档 → 该游戏入列（去重·字典序）', () => {
    expect(auditGamesOf(['games/game-a/rules.ts'])).toEqual(['game-a']);
    expect(auditGamesOf(['games/game-b/y.ts', 'games/game-a/x.ts', 'games/game-a/z.ts'])).toEqual(['game-a', 'game-b']);
  });

  it('auditGamesOf：纯文档/设计档/public 资产/引擎面 → 不触发（audit 只读游戏源码）', () => {
    expect(auditGamesOf(['games/game-a/README.md'])).toEqual([]);
    expect(auditGamesOf(['docs/design/game-a/gdd.md'])).toEqual([]);
    expect(auditGamesOf(['public/games/game-a/art/x.svg'])).toEqual([]);
    expect(auditGamesOf(['src/engine/core.ts', 'scripts/foo.mjs'])).toEqual([]);
  });

  it('game scope：计划含 audit 步·参数=改动游戏（放最前·秒级先拦红旗）', () => {
    const files = ['games/game-a/rules.ts'];
    const plan = planFor(classify(files), auditGamesOf(files));
    expect(plan[0].name).toBe('audit:game-a');
    expect(plan[0].cmd).toEqual(['node', ['scripts/game-skill-audit.mjs', 'game-a']]);
    expect(plan[0].allowExit).toBeUndefined(); // 红=拦：非 0 退出码即门禁失败，无放行档
  });

  it('full scope（引擎+游戏混改）：audit 只扫改动游戏·绝不全库扫描', () => {
    const files = ['games/game-a/rules.ts', 'games/game-b/y.ts', 'src/engine/x.ts'];
    const c = classify(files);
    expect(c.scope).toBe('full');
    const audit = planFor(c, auditGamesOf(files)).find((s) => s.name.startsWith('audit:'));
    expect(audit).toBeDefined();
    expect(audit.cmd[1]).toEqual(['scripts/game-skill-audit.mjs', 'game-a', 'game-b']); // 点名传参·缺省(全库)绝不出现
  });

  it('引擎单改（full）/纯文档（docs-only）：计划无 audit 步', () => {
    const engine = ['src/engine/x.ts'];
    expect(planFor(classify(engine), auditGamesOf(engine)).some((s) => s.name.startsWith('audit:'))).toBe(false);
    const docs = ['docs/design/game-a/gdd.md'];
    expect(planFor(classify(docs), auditGamesOf(docs)).some((s) => s.name.startsWith('audit:'))).toBe(false);
  });
});
