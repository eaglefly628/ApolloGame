// scripts/scoped-gate.test.mjs —— 智能门禁分类器行为契约（owner 2026-07-21）。
// 铁律=只在可证明安全时缩范围·任何不确定一律 full——本测钉死"缩错"不发生。
import { describe, it, expect } from 'vitest';
import { classify, auditGamesOf, planFor, facesOf } from './scoped-gate.mjs';

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

// ── 面触发守卫接线（REQ-GUARDGATE 守卫接线批·2026-08-16）──
// 语义钉死：① 引擎面非测试源文件 → engine-random-guard 步（红=拦）；② src 测试文件 →
// test-hygiene-check 步（红=拦）；③ 美术面（scripts/art-replace*/main_entry/art_*）→
// art-replace-smoke.py 步（红=拦）；未触发的面绝不进计划（不给无关改动加时长）。
describe('scoped-gate × REQ-GUARDGATE（面触发守卫按改动面点名进门）', () => {
  it('facesOf：dokiworld/<app>/** 非 .md → dokiApps 命中·纯 .md 与游戏目录不触发·去重排序（DOKI-APPS 后续①）', () => {
    expect(facesOf(['dokiworld/game108/src/main.ts', 'dokiworld/game108/tests/x.test.mjs', 'dokiworld/shared/src/a.mjs']).dokiApps).toEqual(['game108', 'shared']);
    expect(facesOf(['dokiworld/game108/README.md']).dokiApps).toEqual([]);
    expect(facesOf(['games/game108/game108.ts', 'docs/design/dokiworld/x.md']).dokiApps).toEqual([]);
  });
  it('dokiworld 改动（full）：计划含 doki-test:<app> 步·红=拦（撤 planFor 的 dokiApps 注入 → 本断言红）', () => {
    const files = ['dokiworld/shared/src/apps-gateway.mjs'];
    const plan = planFor({ scope: 'full' }, [], facesOf(files));
    expect(plan.some((s) => s.name === 'doki-test:shared')).toBe(true);
    expect(planFor({ scope: 'full' }, [], {}).some((s) => s.name.startsWith('doki-test:'))).toBe(false); // 缺省 faces 不炸不加步
  });
  it('facesOf：引擎面非测试源文件 → engineRandom（五目录都认）', () => {
    expect(facesOf(['src/engine/core/world.ts']).engineRandom).toBe(true);
    expect(facesOf(['src/skills/tier2/matrix-duel.ts']).engineRandom).toBe(true);
    expect(facesOf(['src/assembly/loader.ts']).engineRandom).toBe(true);
    expect(facesOf(['src/net/mp-client.ts']).engineRandom).toBe(true);
    expect(facesOf(['src/services/save/save-port.ts']).engineRandom).toBe(true);
  });

  it('facesOf：引擎面测试文件不触发 engineRandom（归 hygiene）·renderer/ui/runtime 不在守卫面', () => {
    const f = facesOf(['src/skills/tier2/matrix-duel.test.ts']);
    expect(f.engineRandom).toBe(false);
    expect(f.testHygiene).toBe(true);
    expect(facesOf(['src/renderer/three-scene.ts']).engineRandom).toBe(false);
    expect(facesOf(['src/ui/components/types.ts']).engineRandom).toBe(false);
    expect(facesOf(['src/runtime/engine.ts']).engineRandom).toBe(false);
  });

  it('facesOf：src/**/*.test.ts → testHygiene；games 下测试/非测试都不触发', () => {
    expect(facesOf(['src/runtime/engine.loop-stop.test.ts']).testHygiene).toBe(true);
    expect(facesOf(['src/debug/debug.test.ts']).testHygiene).toBe(true);
    expect(facesOf(['games/game-a/rules.test.ts']).testHygiene).toBe(false);
    expect(facesOf(['src/engine/core/world.ts']).testHygiene).toBe(false);
  });

  it('facesOf：美术面 scripts/art-replace* / main_entry/art_* → artSmoke', () => {
    expect(facesOf(['scripts/art-replace.mjs']).artSmoke).toBe(true);
    expect(facesOf(['scripts/art-replace-smoke.py']).artSmoke).toBe(true);
    expect(facesOf(['main_entry/art_replace.py']).artSmoke).toBe(true);
    expect(facesOf(['main_entry/art_jobs.py']).artSmoke).toBe(true);
    expect(facesOf(['main_entry/artbrowser.py']).artSmoke).toBe(false); // art_ 前缀之外不触发
    expect(facesOf(['scripts/art-ledger-guard.mjs']).artSmoke).toBe(false);
  });

  it('facesOf：守卫脚本自身被改也触发各自守卫（改守卫先自证跑绿）', () => {
    expect(facesOf(['scripts/engine-random-guard.mjs']).engineRandom).toBe(true);
    expect(facesOf(['scripts/test-hygiene-check.mjs']).testHygiene).toBe(true);
    expect(facesOf(['games/game-a/rules.ts', 'docs/workflow/requests.md'])).toEqual({ engineRandom: false, testHygiene: false, artSmoke: false, syncSmoke: false, backupSmoke: false, dokiApps: [], slowLane: [] });
  });

  it('引擎面改动（full）：计划含 engine-random 步·红=拦（无 allowExit）·放 tsc 前', () => {
    const files = ['src/engine/core/world.ts'];
    const plan = planFor(classify(files), auditGamesOf(files), facesOf(files));
    const i = plan.findIndex((s) => s.name === 'engine-random');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(plan[i].cmd).toEqual(['node', ['scripts/engine-random-guard.mjs']]);
    expect(plan[i].allowExit).toBeUndefined();
    expect(i).toBeLessThan(plan.findIndex((s) => s.name === 'tsc'));
  });

  it('src 测试文件改动（full）：计划含 test-hygiene 步·红=拦', () => {
    const files = ['src/runtime/engine.loop-stop.test.ts'];
    const step = planFor(classify(files), auditGamesOf(files), facesOf(files)).find((s) => s.name === 'test-hygiene');
    expect(step).toBeDefined();
    expect(step.cmd).toEqual(['node', ['scripts/test-hygiene-check.mjs']]);
    expect(step.allowExit).toBeUndefined();
  });

  it('美术面改动（full）：计划含 art-smoke 步（python3 点名）·红=拦', () => {
    const files = ['scripts/art-replace.mjs', 'main_entry/art_replace.py'];
    const step = planFor(classify(files), auditGamesOf(files), facesOf(files)).find((s) => s.name === 'art-smoke');
    expect(step).toBeDefined();
    expect(step.cmd).toEqual(['python3', ['scripts/art-replace-smoke.py']]);
    expect(step.allowExit).toBeUndefined();
  });

  it('facesOf：git 同步面 main_entry/{art_sync,artifacts}.py + 两冒烟自身 → syncSmoke（不并进 artSmoke）', () => {
    expect(facesOf(['main_entry/art_sync.py']).syncSmoke).toBe(true);
    expect(facesOf(['main_entry/artifacts.py']).syncSmoke).toBe(true);
    expect(facesOf(['scripts/art-sync-smoke.py']).syncSmoke).toBe(true);
    expect(facesOf(['scripts/auto-sync-smoke.py']).syncSmoke).toBe(true);
    // artifacts.py 不带 art_ 前缀 → 只触发 syncSmoke；art_sync.py 两面都沾（art_ 前缀 + 同步面）
    expect(facesOf(['main_entry/artifacts.py']).artSmoke).toBe(false);
    expect(facesOf(['main_entry/art_sync.py']).artSmoke).toBe(true);
    expect(facesOf(['main_entry/art_jobs.py']).syncSmoke).toBe(false);
    expect(facesOf(['scripts/art-replace-smoke.py']).syncSmoke).toBe(false);
  });

  it('facesOf：原图备份面 t2_replace.py / art-replace.mjs / 冒烟自身 → backupSmoke（REQ-UPBACKUP）', () => {
    expect(facesOf(['main_entry/t2_replace.py']).backupSmoke).toBe(true);
    expect(facesOf(['scripts/art-replace.mjs']).backupSmoke).toBe(true);
    expect(facesOf(['scripts/art-backup-smoke.py']).backupSmoke).toBe(true);
    // t2_replace.py 不带 art_ 前缀 → 此前任何面旗都不命中，本旗即那个洞的补丁
    expect(facesOf(['main_entry/t2_replace.py']).artSmoke).toBe(false);
    expect(facesOf(['main_entry/art_jobs.py']).backupSmoke).toBe(false);
    expect(facesOf(['scripts/art-replace-smoke.py']).backupSmoke).toBe(false);
  });

  it('备份面改动（full）：计划含 art-backup-smoke 步·红=拦·放 tsc 前', () => {
    const files = ['main_entry/t2_replace.py'];
    const plan = planFor(classify(files), auditGamesOf(files), facesOf(files));
    const names = plan.map((s) => s.name);
    expect(names).toContain('art-backup-smoke');
    expect(plan.find((s) => s.name === 'art-backup-smoke').cmd).toEqual(['python3', ['scripts/art-backup-smoke.py']]);
    expect(plan.find((s) => s.name === 'art-backup-smoke').allowExit).toBeUndefined();
    expect(names.indexOf('art-backup-smoke')).toBeLessThan(names.indexOf('tsc'));
  });

  it('同步面改动（full）：计划含 art-sync-smoke + auto-sync-smoke 两步·红=拦·放 tsc 前', () => {
    const files = ['main_entry/artifacts.py'];
    const plan = planFor(classify(files), auditGamesOf(files), facesOf(files));
    const names = plan.map((s) => s.name);
    expect(names).toContain('art-sync-smoke');
    expect(names).toContain('auto-sync-smoke');
    expect(plan.find((s) => s.name === 'auto-sync-smoke').cmd).toEqual(['python3', ['scripts/auto-sync-smoke.py']]);
    expect(plan.find((s) => s.name === 'auto-sync-smoke').allowExit).toBeUndefined();
    expect(names.indexOf('auto-sync-smoke')).toBeLessThan(names.indexOf('tsc'));
  });

  it('未触发的面不进计划：游戏单改无三步·引擎单改无 art-smoke/test-hygiene', () => {
    const game = ['games/game-a/rules.ts'];
    const gamePlan = planFor(classify(game), auditGamesOf(game), facesOf(game));
    expect(gamePlan.some((s) => ['engine-random', 'test-hygiene', 'art-smoke'].includes(s.name))).toBe(false);
    const engine = ['src/engine/core/world.ts'];
    const enginePlan = planFor(classify(engine), auditGamesOf(engine), facesOf(engine));
    expect(enginePlan.some((s) => s.name === 'art-smoke')).toBe(false);
    expect(enginePlan.some((s) => s.name === 'test-hygiene')).toBe(false);
    expect(enginePlan.some((s) => s.name.endsWith('sync-smoke'))).toBe(false);
    expect(enginePlan.some((s) => s.name === 'art-backup-smoke')).toBe(false);
  });
});
