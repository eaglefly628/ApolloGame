import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { art } from './theme.js';
import {
  registerArtOverrides, artUri, clearArtOverridesForTest, artOverrideCount, loadArtOverrides,
} from './art-overrides.js';

// A-023（owner 2026-07-22「工坊替换美术游戏没变」·Lead 诊断硬编码 URL 绕索引）：可消费槽注册表 + 台账 skinKey 契约。
// 语义 mirror game-c：真图未到=内置占位回退（观感零字节变化·Lead 红线）；skinKey 别名登记后消费点即热替换。

afterEach(clearArtOverridesForTest);

describe('game-a 可消费美术槽（art-overrides·A-023）', () => {
  it('无覆盖=内置占位回退（真图未到观感零变的根据）·同输入同输出', () => {
    expect(artUri('game-a/bg/menu', '/fallback.svg')).toBe('/fallback.svg');
    expect(art('bg/menu')).toBe('/games/game-a/art/bg/menu.svg'); // 内置回退
    expect(art('icon/coin')).toBe(art('icon/coin'));
  });

  it('登记真图后 art(slot) 即换；空值不收；清空回落内置', () => {
    registerArtOverrides({ 'game-a/icon/coin': '/games/game-a/art/gen/coin-real.png', 'game-a/x': '' });
    expect(art('icon/coin')).toBe('/games/game-a/art/gen/coin-real.png'); // 覆盖优先
    expect(art('bg/menu')).toBe('/games/game-a/art/bg/menu.svg'); // 未覆盖仍回退
    expect(artOverrideCount()).toBe(1); // 空串没进
    clearArtOverridesForTest();
    expect(art('icon/coin')).toBe('/games/game-a/art/icons/coin.svg'); // 回落内置
  });

  it('loadArtOverrides 无 fetch（headless）= 空对象·消费点回退内置（不崩）', async () => {
    const out = await loadArtOverrides('game-a');
    expect(out).toEqual({});
    expect(art('bg/menu')).toBe('/games/game-a/art/bg/menu.svg');
  });
});

describe('game-a 美术台账 skinKey 契约（art-replace 写回别名依据·A-023）', () => {
  const led = JSON.parse(readFileSync('public/games/game-a/art/art-ledger.json', 'utf8')) as {
    rows: Array<{ no: string; skinKey?: string; slot?: { entity?: string } }>;
    pending: Array<{ no: string; wired?: { consumed?: boolean } }>;
  };

  it('接线行 skinKey 全带 game-a/ 命名空间且唯一（工坊 override 载入过滤依据·此前全无=换不生效的根因）', () => {
    expect(led.rows.length).toBe(12); // 10 2D 槽 + 2 3D 呢面材质槽（felt-albedo/normal·A-023 3D 桌）
    const keys = led.rows.map((r) => r.skinKey);
    expect(keys.every((k) => typeof k === 'string' && k!.startsWith('game-a/'))).toBe(true);
    expect(new Set(keys).size).toBe(12);
  });

  it('skinKey = game-a/<slot.entity>（消费键 art(slot) 与台账 slot 对齐·工坊写回同键即命中）', () => {
    for (const r of led.rows) expect(r.skinKey).toBe(`game-a/${r.slot?.entity}`);
    const menu = led.rows.find((r) => r.skinKey === 'game-a/bg/menu');
    expect(menu?.no).toBe('art-01');
  });

  it('pending 行=未接（wired.consumed=false·art 在库不删·非孤儿计·俟能力到位转 rows）', () => {
    expect(led.pending.length).toBeGreaterThan(0);
    expect(led.pending.every((r) => r.wired?.consumed === false)).toBe(true);
  });
});
