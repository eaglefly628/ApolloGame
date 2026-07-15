import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FELT_BROCADE, feltBrocadeUri, registerTextureOverrides, textureOverrideUri,
  clearTextureOverridesForTest, textureOverrideCount,
} from './art-textures.js';

// 批28（owner 07-14「game-g 全面台账化替换」）：贴图槽覆盖注册表 + 台账契约钉死。
// 语义与 portraits 覆盖同款：真图未到=程序化回退（观感零字节变化）；fill 登记后消费点即换。

afterEach(clearTextureOverridesForTest);

describe('贴图槽覆盖注册表（art-textures）', () => {
  it('无覆盖=程序化回退（确定性·观感零变的根据）', () => {
    expect(textureOverrideUri('game-g/tex/felt-brocade')).toBeNull();
    expect(feltBrocadeUri()).toBe(FELT_BROCADE);
    expect(feltBrocadeUri()).toBe(feltBrocadeUri()); // 同输入同输出
  });

  it('登记真图后消费点即换；空值不收；清空回落', () => {
    registerTextureOverrides({ 'game-g/tex/felt-brocade': '/games/game-g/art/gen/felt.png', 'game-g/tex/x': '' });
    expect(feltBrocadeUri()).toBe('/games/game-g/art/gen/felt.png');
    expect(textureOverrideCount()).toBe(1); // 空串没进
    clearTextureOverridesForTest();
    expect(feltBrocadeUri()).toBe(FELT_BROCADE);
  });
});

describe('game-g 美术台账契约（76 行·行行可替换·needs-art 行行有现况占位快照）', () => {
  const led = JSON.parse(readFileSync(join(process.cwd(), 'public/games/game-g/art/art-ledger.json'), 'utf8')) as {
    rows: Array<{ no: string; skinKey?: string; status: string; query: string; kind: string; gen?: unknown;
      placeholder?: { servedPath?: string; current?: string } }>;
  };

  it('76 行·skinKey 全带且唯一（一行一素材·fill 写回的别名依据）', () => {
    expect(led.rows.length).toBe(76);
    const keys = led.rows.map((r) => r.skinKey);
    expect(keys.every((k) => typeof k === 'string' && k!.startsWith('game-g/'))).toBe(true);
    expect(new Set(keys).size).toBe(76);
  });

  it('53 行现况保号保现身（replaced·程序化 svg）+ 23 个新槽需求行；描述词全英文可生成', () => {
    expect(led.rows.filter((r) => r.status === 'replaced').length).toBe(53);
    expect(led.rows.filter((r) => r.status === 'needs-art').length).toBe(23);
    for (const r of led.rows) expect(r.query.length).toBeGreaterThan(20);
  });

  it('UI 按钮皮三行（批29「按键也可换」）：hero/primary/ghost·主题级 buttonSkins 消费·编号顺延不动老账', () => {
    const ui = led.rows.filter((r) => r.skinKey!.startsWith('game-g/ui/'));
    expect(ui.map((r) => [r.no, r.skinKey])).toEqual([
      ['art-61', 'game-g/ui/btn-hero'], ['art-62', 'game-g/ui/btn-primary'], ['art-63', 'game-g/ui/btn-ghost'],
    ]);
  });

  it('needs-art 行行有现况占位快照（owner 07-15「54~63 没有预览占位符」）：placeholder.servedPath 存在且文件真在', () => {
    for (const r of led.rows.filter((x) => x.status === 'needs-art')) {
      expect(r.placeholder?.servedPath, r.no).toMatch(/^\/games\/game-g\/art\/placeholder\/.+\.svg$/);
      const file = join(process.cwd(), 'public', r.placeholder!.servedPath!);
      expect(readFileSync(file, 'utf8')).toContain('<svg'); // 文件真在且是 svg
    }
  });

  it('批30 全屏面扩展：背景板 8 屏全（home/campaign/battle/lobby/collection/deck/craft/between）+ 故事 6 幕 + 卡池 banner 2', () => {
    const keys = new Set(led.rows.map((r) => r.skinKey));
    for (const k of ['home', 'campaign', 'battle', 'lobby', 'collection', 'deck', 'craft', 'between']) {
      expect(keys.has(`game-g/tex/${k}-backdrop`), k).toBe(true);
    }
    expect(led.rows.filter((r) => r.skinKey!.startsWith('game-g/story/beat-')).length).toBe(6);
    expect(led.rows.filter((r) => r.skinKey!.startsWith('game-g/shop/banner-')).length).toBe(2);
  });

  it('立绘行覆盖键与 portraits 一致（game-g/hero/<花色字母+军衔>·消费端能对上）', () => {
    const heroKeys = led.rows.map((r) => r.skinKey!).filter((k) => k.startsWith('game-g/hero/'));
    expect(heroKeys.length).toBe(52);
    for (const k of heroKeys) expect(k).toMatch(/^game-g\/hero\/[shdc](A|K|Q|J|10|[2-9])$/);
  });
});
