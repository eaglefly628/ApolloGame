// Game B ·《雀宴》S3 骨架关测试 —— 真引擎装载 + 空跑 2 tick（生产板 S3 机器门语义）
// + 确定性（同 seed 同 hash·种子 PRNG 序列可复现）+ 主机位口径（~55° 俯角）+ 牌山/手牌摆位
// + HUD 壳（LayoutNode 校验零 issue·线框稿 1:1 结构·gdd 数值口径）+ 占位资产索引在档。
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Engine } from '../../runtime/engine.js';
import type { Pickable3D } from '@engine/protocol/components.js';
import { nextRandom, type RandomSeed } from '@atom-skills/random/index.js';
import { parseAssetIndex } from '@assets/index.js';
import { validateLayoutNode, type LayoutNode } from '@ui/components/index.js';
import { buildTableBlueprint, HAND_PICK_SIGNAL } from './blueprint.js';
import { wallLayout, handLayout, DEMO_HAND, DEMO_TSUMO, texKey, TILE_W, TILE_H, TILE_D } from './tiles.js';
import { buildHud, initialHud, CLOTH_ITEMS } from './hud.js';
import { U, CAM_MAIN, orbitFromEye, SAKURA } from './theme.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('game-b S3 骨架 · 真引擎装载 + 空跑', () => {
  it('蓝图装进真 Engine·空跑 2 tick 不炸·实体齐全', () => {
    const engine = new Engine();
    engine.load(buildTableBlueprint({ seed: 1 }));
    engine.world.tick();
    engine.world.tick();

    const w = engine.world;
    expect(w.getComponent('cam', 'Camera3D')).toBeTruthy();
    expect(w.getComponent('rng', 'RandomSeed')).toBeTruthy();
    expect(w.getComponent('felt', 'Material3D')).toBeTruthy();
    // 牌山 136 + 手牌 14
    let wall = 0;
    let hand = 0;
    for (const [eid] of w.query('Mesh3D')) {
      if (eid.startsWith('wall-')) wall++;
      if (eid.startsWith('hand-')) hand++;
    }
    expect(wall).toBe(136);
    expect(hand).toBe(14);
    // 手牌可拾取（Pickable3D 信号在档）
    const pick = w.getComponent<Pickable3D>('hand-0', 'Pickable3D');
    expect(pick?.signal).toBe(HAND_PICK_SIGNAL);
  });

  it('确定性：同 seed 同 hash·异 seed 异 hash（空跑 2 tick 后）', () => {
    const run = (seed: number): string => {
      const e = new Engine();
      e.load(buildTableBlueprint({ seed }));
      e.world.tick();
      e.world.tick();
      return e.hash();
    };
    expect(run(42)).toBe(run(42));
    expect(run(42)).not.toBe(run(43));
  });

  it('种子 PRNG：同 seed 序列逐位可复现（gdd §十二·游戏层零裸随机）', () => {
    const draw = (seed: number): number[] => {
      const e = new Engine();
      e.load(buildTableBlueprint({ seed }));
      const rng = e.world.getComponent<RandomSeed>('rng', 'RandomSeed')!;
      return [nextRandom(rng), nextRandom(rng), nextRandom(rng)];
    };
    expect(draw(7)).toEqual(draw(7));
  });
});

describe('game-b 主机位（交接档 §二 口径）', () => {
  it('俯角 ~55°·距离≈3.94U·FOV 40', () => {
    const deg = (CAM_MAIN.pitch * 180) / Math.PI;
    expect(deg).toBeGreaterThan(53);
    expect(deg).toBeLessThan(56);
    expect(CAM_MAIN.distance).toBeCloseTo(3.9408 * U, 1);
    expect(CAM_MAIN.fov).toBe(40);
    expect(CAM_MAIN.pivotZ).toBeCloseTo(0.3 * U, 6);
  });

  it('orbitFromEye 与渲染器球面约定互逆（eye = pivot + 球面(yaw,pitch,dist)）', () => {
    const eye = { x: 0, y: 3.2 * U, z: 2.6 * U };
    const pivot = { x: 0, y: 0, z: 0.3 * U };
    const o = orbitFromEye(eye, pivot);
    const horiz = o.distance * Math.cos(o.pitch);
    expect(pivot.x + horiz * Math.sin(o.yaw)).toBeCloseTo(eye.x, 6);
    expect(pivot.y + o.distance * Math.sin(o.pitch)).toBeCloseTo(eye.y, 6);
    expect(pivot.z + horiz * Math.cos(o.yaw)).toBeCloseTo(eye.z, 6);
  });
});

describe('game-b 摆位（纯函数·交接档 §二）', () => {
  it('牌山：四边各 17×2 共 136·全在桌呢内·平躺两层', () => {
    const wall = wallLayout();
    expect(wall).toHaveLength(136);
    for (const side of ['e', 's', 'w', 'n'] as const) {
      expect(wall.filter((t) => t.side === side)).toHaveLength(34);
    }
    const feltHalf = 0.9 * U;
    for (const t of wall) {
      expect(Math.abs(t.x)).toBeLessThan(feltHalf);
      expect(Math.abs(t.z)).toBeLessThan(feltHalf);
      expect([TILE_D / 2, TILE_D * 1.5]).toContainEqual(t.y);
    }
  });

  it('手牌：13+摸牌位（右离一档）·立于南边·线框稿示意手 1:1', () => {
    const hand = handLayout();
    expect(hand).toHaveLength(14);
    expect(hand[13].tsumo).toBe(true);
    const step = hand[1].x - hand[0].x;
    expect(hand[13].x - hand[12].x).toBeGreaterThan(step);
    expect(hand.every((p) => p.z === 0.85 * U && p.y === TILE_H / 2)).toBe(true);
    expect(DEMO_HAND).toHaveLength(13);
    expect([...DEMO_HAND, DEMO_TSUMO]).toEqual([
      'man-1', 'man-2', 'man-3', 'pin-4', 'pin-5', 'pin-6',
      'sou-4', 'sou-5', 'sou-6', 'ton', 'ton', 'man-9', 'man-9', 'pin-7',
    ]);
  });

  it('牌比例≈真实（宽:高:厚 = 0.072:0.096:0.052 × U）', () => {
    expect(TILE_W).toBeCloseTo(0.72, 6);
    expect(TILE_H).toBeCloseTo(0.96, 6);
    expect(TILE_D).toBeCloseTo(0.52, 6);
  });
});

describe('game-b HUD 壳（LayoutNode·线框稿 1:1·gdd 口径）', () => {
  const tree = buildHud(initialHud());

  const collect = (n: LayoutNode, out: LayoutNode[] = []): LayoutNode[] => {
    out.push(n);
    for (const c of n.children ?? []) collect(c, out);
    return out;
  };

  it('validateLayoutNode 零 issue', () => {
    expect(validateLayoutNode(tree)).toEqual([]);
  });

  it('席位卡×4·风位東南西北各一·衣物 5 章/席·点数=gdd 起点 50,000', () => {
    const nodes = collect(tree);
    const seats = nodes.filter((n) => n.id?.startsWith('seat-'));
    expect(seats).toHaveLength(4);
    const winds = nodes.filter((n) => n.id?.endsWith('-wind')).map((n) => (n.props as { label: string }).label);
    expect([...winds].sort()).toEqual(['東', '北', '南', '西'].sort());
    for (const sid of ['north', 'west', 'east', 'hero']) {
      expect(nodes.filter((n) => /-cl\d$/.test(n.id ?? '') && n.id!.startsWith(sid))).toHaveLength(CLOTH_ITEMS.length);
    }
    const pts = nodes.filter((n) => n.id?.endsWith('-pts')).map((n) => (n.props as { text: string }).text);
    expect(pts).toEqual(['50,000', '50,000', '50,000', '50,000']);
  });

  it('行动按钮排：吃碰杠立直和跳过·S3 全 disabled·全 action 信号', () => {
    const btns = collect(tree).filter((n) => n.type === 'Button' && n.id?.startsWith('act-'));
    expect(btns.map((b) => (b.props as { label: string }).label)).toEqual(['吃', '碰', '杠', '立直', '和', '跳过']);
    for (const b of btns) {
      const p = b.props as { disabled?: boolean; action?: string };
      expect(p.disabled).toBe(true);
      expect(p.action).toMatch(/^act-/);
    }
  });

  it('场况角标=東1局 0本場 供托0 余牌70（gdd 口径·非线框稿示意值）', () => {
    const info = collect(tree).find((n) => n.id === 'info-line');
    expect((info?.props as { text: string }).text).toBe('東1局 · 0本場 ｜ 供托 0 ｜ 余牌 70');
  });

  it('主题：纸面墨字+樱粉 accent（sakura-otome 色板对位）', () => {
    expect(SAKURA.text).toBe('#3a2433');
    expect(SAKURA.jade.toLowerCase()).toBe('#e8899e');
    expect(SAKURA.danger.toLowerCase()).toBe('#c03a52');
  });
});

describe('game-b 占位资产（B-007 vendor 包）', () => {
  it('本地索引在档·40 条 filled·手牌用到的贴面全在且文件真存在', () => {
    const idxPath = join(ROOT, 'public', 'games', 'game-b', 'art', 'index.json');
    expect(existsSync(idxPath)).toBe(true);
    const idx = parseAssetIndex(JSON.parse(readFileSync(idxPath, 'utf8')));
    expect(idx.assets).toHaveLength(40);
    const byId = new Map(idx.assets.map((a) => [a.id, a]));
    for (const kind of new Set([...DEMO_HAND, DEMO_TSUMO])) {
      const entry = byId.get(texKey(kind));
      expect(entry, `缺 ${texKey(kind)}`).toBeTruthy();
      expect(entry!.status).toBe('filled');
      const file = join(ROOT, 'public', entry!.path!.replace(/^\//, ''));
      expect(existsSync(file), `文件缺失 ${entry!.path}`).toBe(true);
    }
    // 溯源纪律：占位=placeholder 真相入账（CC0·FluffyStuff）
    const one = byId.get('mahjong/tex/man-1')!;
    expect(one.license).toBe('CC0-1.0');
    expect(one.source).toContain('FluffyStuff');
  });
});
