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

describe('game-g 美术台账契约（60 行·行行可替换）', () => {
  const led = JSON.parse(readFileSync(join(process.cwd(), 'public/games/game-g/art/art-ledger.json'), 'utf8')) as {
    rows: Array<{ no: string; skinKey?: string; status: string; query: string; kind: string; gen?: unknown }>;
  };

  it('60 行·skinKey 全带且唯一（一行一素材·fill 写回的别名依据）', () => {
    expect(led.rows.length).toBe(60);
    const keys = led.rows.map((r) => r.skinKey);
    expect(keys.every((k) => typeof k === 'string' && k!.startsWith('game-g/'))).toBe(true);
    expect(new Set(keys).size).toBe(60);
  });

  it('53 行现况保号保现身（replaced·程序化 svg）+ 7 个新槽需求行；描述词全英文可生成', () => {
    expect(led.rows.filter((r) => r.status === 'replaced').length).toBe(53);
    expect(led.rows.filter((r) => r.status === 'needs-art').length).toBe(7);
    for (const r of led.rows) expect(r.query.length).toBeGreaterThan(20);
  });

  it('立绘行覆盖键与 portraits 一致（game-g/hero/<花色字母+军衔>·消费端能对上）', () => {
    const heroKeys = led.rows.map((r) => r.skinKey!).filter((k) => k.startsWith('game-g/hero/'));
    expect(heroKeys.length).toBe(52);
    for (const k of heroKeys) expect(k).toMatch(/^game-g\/hero\/[shdc](A|K|Q|J|10|[2-9])$/);
  });
});
