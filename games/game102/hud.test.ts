import { describe, it, expect } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import {
  buildTopBar, buildBurst, buildResult, buildSelect, buildRevive, defaultHud,
  type SelectState, type ResultState, type BurstState, type ReviveState,
} from './hud.js';
import { pixelPour, KEYS_TOTAL, DOOR_GOAL, TRAY_SLOTS, AMMO_MAX, CAPACITY } from './ui-theme.js';

// 闭集控件校验：四屏全 LayoutNode 纯数据·零新控件（REQ-G102-UI 交付纪律）。
const CLOSED_SET = new Set([
  'Screen', 'Panel', 'Label', 'Badge', 'ProgressBar', 'Button', 'Modal', 'Rating',
  'LevelPath', 'Float', 'Particles', 'Toast',
]);
function types(node: LayoutNode, acc = new Set<string>()): Set<string> {
  acc.add(node.type);
  for (const c of node.children ?? []) types(c, acc);
  return acc;
}

describe('game102 ·《色流工坊》UI（四屏纯 LayoutNode·零新控件）', () => {
  it('主题常量对齐 GDD（金钥匙 8 / 宝箱门 100 / 待命槽 5 / 弹药 20 / 容量 5）', () => {
    expect([KEYS_TOTAL, DOOR_GOAL, TRAY_SLOTS, AMMO_MAX, CAPACITY]).toEqual([8, 100, 5, 20, 5]);
    // pixelPour 是完整 UITheme：必填令牌齐、皮 URL 全程序化 data-URI（零外部资产依赖）。
    expect(pixelPour.jade && pixelPour.gold && pixelPour.text && pixelPour.bg1).toBeTruthy();
    for (const k of ['hero', 'primary', 'ghost', 'quiet'] as const) {
      expect(pixelPour.buttonSkins?.[k]?.skin.startsWith('data:image/svg+xml,')).toBe(true);
    }
  });

  it('① 对局 HUD 顶栏是合法 LayoutNode（多态·含暂停/开门/满进度·零 issue）', () => {
    const states = [
      defaultHud(),
      defaultHud({ levelNo: 7, keys: 3, score: 8420, doorPct: 62 }),
      defaultHud({ keys: KEYS_TOTAL, doorPct: 100 }), // 宝箱门开启态
      defaultHud({ paused: true, doorPct: 140 }), // 越界进度须被夹住
    ];
    for (const s of states) {
      const node = buildTopBar(s);
      expect(validateLayoutNode(node)).toEqual([]);
      const door = findById(node, 'g102-door');
      const p = door!.props as { value: number };
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(DOOR_GOAL); // 夹钳生效（不溢出）
    }
    // 得分千分位复刻视觉稿
    expect((findById(buildTopBar(defaultHud({ score: 12340 })), 'g102-score')!.props as { text: string }).text)
      .toBe('◆ 12,340');
  });

  it('连击/突破飘层是合法 LayoutNode（Float 飘分锚得分位·突破切星爆）', () => {
    const bursts: BurstState[] = [
      { combo: 1, burst: false }, // combo=1 不飘分（只星屑）
      { combo: 4, burst: false },
      { combo: 9, burst: true }, // 突破态星爆
    ];
    for (const b of bursts) {
      const node = buildBurst(b);
      expect(validateLayoutNode(node)).toEqual([]);
      expect(!!findById(node, 'g102-combo-float')).toBe(b.combo > 1);
    }
  });

  it('② 结算屏是合法 LayoutNode（Rating 星级 + confetti·有/无下一关）', () => {
    const base: ResultState = { levelNo: 7, stars: 3, keys: KEYS_TOTAL, keysTotal: KEYS_TOTAL, score: 12340, hasNext: true };
    for (const s of [base, { ...base, stars: 1, keys: 5, hasNext: false }] as ResultState[]) {
      const node = buildResult(s);
      expect(validateLayoutNode(node)).toEqual([]);
      expect((findById(node, 'g102-res-stars')!.props as { value: number }).value).toBe(s.stars);
      expect(!!findById(node, 'g102-res-next')).toBe(s.hasNext);
    }
  });

  it('③ 选关屏是合法 LayoutNode（LevelPath 蛇形·节点映射关号/星/状态）', () => {
    const sel: SelectState = {
      coins: 2180,
      nodes: [
        { no: 1, stars: 3, state: 'done' },
        { no: 2, stars: 3, state: 'done' },
        { no: 3, stars: 2, state: 'done' },
        { no: 4, stars: 0, state: 'current' },
        { no: 5, stars: 0, state: 'locked' },
      ],
    };
    const node = buildSelect(sel);
    expect(validateLayoutNode(node)).toEqual([]);
    const path = findById(node, 'g102-sel-path')!.props as { nodes: Array<{ label: string; action: string; actionArg: string }> };
    expect(path.nodes.map((n) => n.label)).toEqual(['1', '2', '3', '4', '5']);
    expect(path.nodes.every((n) => n.action === 'play')).toBe(true);
    expect(path.nodes[3].actionArg).toBe('4');
  });

  it('④ 失败/续命屏是合法 LayoutNode（offer=Modal+三键 / revived=Toast）', () => {
    const offer: ReviveState = { hint: '还差 1 块就点亮宝箱门', price: '$6.99', ammo: 3, revived: false };
    const offerNode = buildRevive(offer);
    expect(validateLayoutNode(offerNode)).toEqual([]);
    expect(offerNode.type).toBe('Modal');
    for (const id of ['g102-revive-ad', 'g102-revive-pay', 'g102-revive-give']) expect(!!findById(offerNode, id)).toBe(true);

    const revivedNode = buildRevive({ ...offer, revived: true });
    expect(validateLayoutNode(revivedNode)).toEqual([]);
    expect(revivedNode.type).toBe('Toast');
  });

  it('全四屏控件落在 34 闭集内（先重组·零新控件红线）', () => {
    const trees = [
      buildTopBar(defaultHud({ levelNo: 7, keys: 3, score: 8420, doorPct: 62 })),
      buildBurst({ combo: 4, burst: true }),
      buildResult({ levelNo: 7, stars: 3, keys: KEYS_TOTAL, keysTotal: KEYS_TOTAL, score: 12340, hasNext: true }),
      buildSelect({ coins: 2180, nodes: [{ no: 1, stars: 3, state: 'done' }, { no: 2, stars: 0, state: 'current' }] }),
      buildRevive({ hint: 'x', price: '$6.99', ammo: 3, revived: false }),
      buildRevive({ hint: 'x', price: '$6.99', ammo: 3, revived: true }),
    ];
    const used = new Set<string>();
    for (const t of trees) for (const ty of types(t)) used.add(ty);
    for (const ty of used) expect(CLOSED_SET.has(ty)).toBe(true);
  });
});

function findById(node: LayoutNode, id: string): LayoutNode | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const hit = findById(c, id);
    if (hit) return hit;
  }
  return null;
}
