import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { STORY_BACKDROP } from './theme.js';
import {
  backdropUri, registerTextureOverrides, textureOverrideUri,
  clearTextureOverridesForTest, textureOverrideCount, loadArtOverrides,
} from './art-overrides.js';

// REQ-C-112（owner 2026-07-22「生成的场景美术写不回游戏」）：生成美术消费槽注册表 + 台账 skinKey 契约。
// 语义 mirror game-g art-textures：真图未到=程序化回退（观感零字节变化·Lead 红线）；skinKey 别名登记后消费点即换。

afterEach(clearTextureOverridesForTest);

describe('game-c 生成美术消费槽（art-overrides·REQ-C-112）', () => {
  it('无覆盖=程序化 STORY_BACKDROP 回退（真图未到观感零变的根据）', () => {
    expect(textureOverrideUri('game-c/scene/backdrop')).toBeNull();
    expect(backdropUri()).toBe(STORY_BACKDROP);
    expect(backdropUri()).toBe(backdropUri()); // 同输入同输出
  });

  it('登记真图后背幕即换；空值不收；清空回落程序化', () => {
    registerTextureOverrides({ 'game-c/scene/backdrop': '/games/game-c/art/gen/art-001.png', 'game-c/x': '' });
    expect(backdropUri()).toBe('/games/game-c/art/gen/art-001.png');
    expect(textureOverrideCount()).toBe(1); // 空串没进
    clearTextureOverridesForTest();
    expect(backdropUri()).toBe(STORY_BACKDROP);
  });

  it('loadArtOverrides 无 fetch（headless）= 空对象·消费点回退程序化（不崩）', async () => {
    const out = await loadArtOverrides('game-c');
    expect(out).toEqual({});
    expect(backdropUri()).toBe(STORY_BACKDROP);
  });
});

describe('game-c 美术台账 skinKey 契约（art-replace 写回别名依据）', () => {
  const led = JSON.parse(readFileSync('public/games/game-c/art/art-ledger.json', 'utf8')) as {
    rows: Array<{ no: string; skinKey?: string }>;
  };

  it('36 行·skinKey 全带且唯一（一行一素材·fill 写回的别名依据·此前全 null=生成写不回的根因）', () => {
    // owner 2026-07-22 定稿：长方 3D 桌回归——背幕(室内环境) + 呢面 albedo/normal + 桌边木纹 albedo/normal → 32→36 行。
    expect(led.rows.length).toBe(36);
    const keys = led.rows.map((r) => r.skinKey);
    expect(keys.every((k) => typeof k === 'string' && k!.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(36);
  });

  it('27 生成槽 game-c/ 命名空间（override 载入过滤依据）+ 9 vendor 筹码 chip/ 保其索引 id', () => {
    const keys = led.rows.map((r) => r.skinKey!);
    expect(keys.filter((k) => k.startsWith('game-c/')).length).toBe(27);
    expect(keys.filter((k) => k.startsWith('chip/')).length).toBe(9);
    expect(keys).toContain('game-c/table/felt-albedo'); // 呢面主美术槽（长方桌面整幅贴图·可换材质）
    expect(keys).toContain('game-c/scene/backdrop'); // 室内环境背幕槽（setBackgroundTexture）
  });

  it('背幕槽存在且首号（game-c/scene/backdrop·art-001·backdropUri 消费键）', () => {
    const b = led.rows.find((r) => r.skinKey === 'game-c/scene/backdrop');
    expect(b?.no).toBe('art-001');
  });
});
