// scripts/ui-brief.test.mjs —— UI 设计需求单推导器单测（REQ-DESIGNLINE 二期①）。
// 全部用临时目录假造 fixture（假剧本/假 GDD/假蓝图/假台账）——不碰真仓库游戏数据。
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  deriveScreens, actionsFromScenarios, actionsFromBlueprint, actionsFromR2Evidence,
  actionSemanticsFromGdd, mergeActions, findStyleAnchor, buildBrief, generate,
} from './ui-brief.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'ui-brief-test-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const GDD_WITH_SCREENS = `# 假游戏 GDD

## 13. 屏幕（华丽件对位）

| 屏 | 起手 | 成熟件 |
|---|---|---|
| S-01 主菜单 | buildStarterHome | 起手包 |
| S-02 对局屏 | — | 六条槽 |

## 14. 动作词表（唯一真相）

| 动作名 | 时区 | 语义 | arg |
|---|---|---|---|
| \`charge.rock\` / \`charge.paper\` | T1 | 给该手 +1 蓄力 | — |
| \`throw.rock\` | T2 | 出石 | — |
`;

function writeScenario(dir, name, obj) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(obj, null, 2));
}

describe('deriveScreens · ① 屏清单', () => {
  it('GDD 有「屏幕」表格 → 抽首列（含"屏"字的列）', () => {
    const r = deriveScreens(GDD_WITH_SCREENS);
    expect(r.placeholder).toBe(false);
    expect(r.screens).toEqual(['S-01 主菜单', 'S-02 对局屏']);
  });

  it('GDD 无「屏幕」节 → 占位（不猜）', () => {
    const r = deriveScreens('# 假游戏 GDD\n\n## 1. 定位\n随便写点别的。\n');
    expect(r.placeholder).toBe(true);
    expect(r.screens).toEqual([]);
  });

  it('空 GDD（文件不存在的情形）→ 占位', () => {
    const r = deriveScreens('');
    expect(r.placeholder).toBe(true);
  });
});

describe('actionsFromScenarios · ② 数据源(a) 验收剧本', () => {
  it('多份剧本合并去重·跨文件重复的 signal 只留一条', () => {
    const dir = join(root, 'docs', 'design', 'g1', 'acceptance');
    writeScenario(dir, '01-a.scenario.jsonc', {
      name: 'a', game: 'g1', seed: 1,
      steps: [{ signal: 'charge.rock' }, { tick: 1 }, { signal: 'throw.rock' }],
    });
    writeScenario(dir, '02-b.scenario.jsonc', {
      name: 'b', game: 'g1', seed: 2,
      steps: [{ signal: 'charge.rock' }, { signal: 'smoke.use' }], // charge.rock 重复
    });
    const out = actionsFromScenarios(root, 'g1');
    const names = out.map((a) => a.name);
    expect(names).toEqual(['charge.rock', 'throw.rock', 'smoke.use']);
    expect(out.every((a) => a.source === 'scenario')).toBe(true);
  });

  it('坏剧本（schema 不过）跳过不炸·好剧本照常抽', () => {
    const dir = join(root, 'docs', 'design', 'g2', 'acceptance');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '01-bad.scenario.jsonc'), '{ not valid json,,, ]');
    writeScenario(dir, '02-good.scenario.jsonc', {
      name: 'good', game: 'g2', seed: 1, steps: [{ signal: 'menu.start' }],
    });
    const out = actionsFromScenarios(root, 'g2');
    expect(out.map((a) => a.name)).toEqual(['menu.start']);
  });

  it('无 acceptance 目录 → 空数组（不炸）', () => {
    expect(actionsFromScenarios(root, 'nope')).toEqual([]);
  });
});

describe('actionsFromBlueprint · ② 数据源(b) 蓝图/manifest', () => {
  it("'compiled' 形态（games/<slug>/*.ts）→ 正则扫 action:/signal:/data-action= 字面量", () => {
    const dir = join(root, 'games', 'g3');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'hud.ts'), `
      export const btn = { type: 'Button', props: { action: 'menu.start' } };
      export const btn2 = { type: 'Button', props: { action: 'menu.settings' } };
      export const kb = { type: 'KeyBinding', key: '1', signal: 'duel.next' };
    `);
    // .test.ts 必须被跳过（测试代码里的字面量不该混进真动作清单）
    writeFileSync(join(dir, 'hud.test.ts'), `expect(x.action).toBe('should.not.appear');`);
    const out = actionsFromBlueprint(root, 'g3');
    const names = out.map((a) => a.name);
    expect(names).toContain('menu.start');
    expect(names).toContain('menu.settings');
    expect(names).toContain('duel.next');
    expect(names).not.toContain('should.not.appear');
    expect(out.every((a) => a.source === 'blueprint')).toBe(true);
  });

  it("'builtin' 形态（public/games/<slug>/manifest.json）→ 递归找 Clickable.action / KeyBinding.signal", () => {
    mkdirSync(join(root, 'public', 'games', 'g4'), { recursive: true });
    writeFileSync(join(root, 'public', 'games', 'g4', 'manifest.json'), JSON.stringify({
      entities: {
        e1: { components: { Clickable: { type: 'Clickable', action: 'shop.buy' } } },
        e2: { components: { KeyBinding: { type: 'KeyBinding', key: 'q', signal: 'shop.close' } } },
      },
    }));
    const out = actionsFromBlueprint(root, 'g4');
    expect(out.map((a) => a.name).sort()).toEqual(['shop.buy', 'shop.close']);
  });

  it('两种源都没有 → 空数组', () => {
    expect(actionsFromBlueprint(root, 'ghost')).toEqual([]);
  });
});

describe('actionsFromR2Evidence · ② 数据源(c) R2 实测（若在档）', () => {
  it('probe/ui-inventory.json 在档 → 读 seen 列表', () => {
    const dir = join(root, 'public', 'games', 'g5', 'probe');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ui-inventory.json'), JSON.stringify({ seen: ['menu.start', 'menu.settings'] }));
    expect(actionsFromR2Evidence(root, 'g5').map((a) => a.name)).toEqual(['menu.start', 'menu.settings']);
  });

  it('不在档 → 空数组（不是缺陷，是「若在档」条件不成立）', () => {
    expect(actionsFromR2Evidence(root, 'g6')).toEqual([]);
  });
});

describe('mergeActions · ② 三源合并去重（核心逻辑·假信心自查靶心）', () => {
  it('同名跨源只保留一条·sources 合并·语义查 GDD 表命中', () => {
    const sem = actionSemanticsFromGdd(GDD_WITH_SCREENS);
    const merged = mergeActions(
      [
        [{ name: 'charge.rock', source: 'scenario' }, { name: 'throw.rock', source: 'scenario' }],
        [{ name: 'charge.rock', source: 'blueprint' }, { name: 'smoke.use', source: 'blueprint' }], // charge.rock 与 (a) 重复
        [{ name: 'smoke.use', source: 'r2' }], // smoke.use 与 (b) 重复
      ],
      sem,
    );
    const names = merged.map((m) => m.name);
    // 去重后总数=3（不是 5）；顺序=先出现优先：a→b→c
    expect(names).toEqual(['charge.rock', 'throw.rock', 'smoke.use']);
    const chargeRock = merged.find((m) => m.name === 'charge.rock');
    expect(chargeRock.sources.sort()).toEqual(['blueprint', 'scenario']);
    expect(chargeRock.semantic).toBe('给该手 +1 蓄力'); // 命中 GDD §14 语义注解
    const smoke = merged.find((m) => m.name === 'smoke.use');
    expect(smoke.sources.sort()).toEqual(['blueprint', 'r2']);
  });

  it('GDD 无该动作条目 → 语义占位（不是空字符串·提示回哪补）', () => {
    const merged = mergeActions([[{ name: 'unknown.act', source: 'scenario' }]], new Map());
    expect(merged[0].semantic).toMatch(/语义待补/);
  });

  it('空源列表 → 空结果（不炸）', () => {
    expect(mergeActions([[], [], []], new Map())).toEqual([]);
  });
});

describe('findStyleAnchor · ③ 风格锚', () => {
  const packs = { 'modern-manor': { packId: 'modern-manor', name: '现代豪宅夜局', promptZh: 'p', promptEn: 'e', palette: [16711680] } };

  it('artStyle.packId 命中', () => {
    mkdirSync(join(root, 'public', 'games', 'g7', 'art'), { recursive: true });
    writeFileSync(join(root, 'public', 'games', 'g7', 'art', 'art-ledger.json'),
      JSON.stringify({ artStyle: { packId: 'modern-manor' } }));
    const a = findStyleAnchor(root, 'g7', packs);
    expect(a && a.packId).toBe('modern-manor');
  });

  it('rows[].gen.pack 兜底命中', () => {
    mkdirSync(join(root, 'public', 'games', 'g8', 'art'), { recursive: true });
    writeFileSync(join(root, 'public', 'games', 'g8', 'art', 'art-ledger.json'),
      JSON.stringify({ rows: [{ no: 'art-01' }, { no: 'art-02', gen: { pack: 'modern-manor' } }] }));
    const a = findStyleAnchor(root, 'g8', packs);
    expect(a && a.packId).toBe('modern-manor');
  });

  it('未锚定 / 无台账 → null（brief 走占位分支）', () => {
    expect(findStyleAnchor(root, 'g9', packs)).toBeNull();
  });
});

describe('buildBrief · ④ 输出契约段模板', () => {
  it('契约段固定文字逐条存在（不可被推导逻辑意外吞掉）', () => {
    const md = buildBrief({
      slug: 'g10', name: '假游戏', pitch: 'p', taste: '', screens: ['S-01'], screensPlaceholder: false,
      actions: [], anchor: null, packs: {},
    });
    expect(md).toContain('## ④ 输出契约（固定模板·不可删改）');
    expect(md).toContain('data-action="<②清单里的动作名>"');
    expect(md).toContain('禁外链');
    expect(md).toContain('标注屏尺寸');
    expect(md).toContain('正常 / 悬停 / 禁用');
    expect(md).toContain('📥 收稿箱');
    expect(md).toContain('design-import'); // ⑤ 交付方式：命令行路径
  });

  it('品味槽：传了 taste 原样落文·不传留 owner 填占位', () => {
    const withTaste = buildBrief({ slug: 'g', name: 'n', pitch: 'p', taste: '走暗黑帝国感', screens: [], screensPlaceholder: true, actions: [], anchor: null, packs: {} });
    expect(withTaste).toContain('走暗黑帝国感');
    const noTaste = buildBrief({ slug: 'g', name: 'n', pitch: 'p', taste: '', screens: [], screensPlaceholder: true, actions: [], anchor: null, packs: {} });
    expect(noTaste).toContain('【owner 填】');
  });
});

describe('generate · 端到端（真落盘）', () => {
  it('完整 fixture（GDD+pipeline.json+剧本+蓝图）→ 落文件 + 计数正确', async () => {
    const slug = 'e2e-game';
    mkdirSync(join(root, 'docs', 'design', slug), { recursive: true });
    writeFileSync(join(root, 'docs', 'design', slug, 'gdd.md'), GDD_WITH_SCREENS);
    mkdirSync(join(root, 'public', 'games', slug), { recursive: true });
    writeFileSync(join(root, 'public', 'games', slug, 'pipeline.json'),
      JSON.stringify({ concept: { name: 'E2E 游戏', pitch: '一句话' } }));
    writeScenario(join(root, 'docs', 'design', slug, 'acceptance'), '01.scenario.jsonc', {
      name: 'x', game: slug, seed: 1, steps: [{ signal: 'charge.rock' }, { signal: 'throw.rock' }],
    });
    mkdirSync(join(root, 'games', slug), { recursive: true });
    writeFileSync(join(root, 'games', slug, 'hud.ts'), `export const b = { action: 'smoke.use' };`);

    const res = await generate(root, slug, '走暗黑帝国感');
    expect(res.ok).toBe(true);
    expect(res.screenCount).toBe(2);
    expect(res.actionCount).toBe(3); // charge.rock, throw.rock（剧本）+ smoke.use（蓝图）
    expect(res.actionSources).toEqual({ scenario: 2, blueprint: 1, r2: 0 });
    expect(res.tasteFilled).toBe(true);
    expect(existsSync(join(root, res.path))).toBe(true);
    const onDisk = readFileSync(join(root, res.path), 'utf8');
    expect(onDisk).toContain('charge.rock');
    expect(onDisk).toContain('走暗黑帝国感');
  });

  it('无任何数据源的新游戏 → 两处占位·不抛异常', async () => {
    const slug = 'blank-game';
    const res = await generate(root, slug, '');
    expect(res.ok).toBe(true);
    expect(res.screenCount).toBe(0);
    expect(res.actionCount).toBe(0);
    expect(res.markdown).toContain('推不出');
  });
});
