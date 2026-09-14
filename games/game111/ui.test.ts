import { describe, it, expect } from 'vitest';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { validateLayoutNode } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { NullNpcAgentPort } from '@zerocraft/engine/services/npc-agent/index.js';
import type { Resource } from '@zerocraft/engine/engine/protocol/components.js';
import { buildBlueprint, setupTown } from './blueprint.js';
import { runTurn } from './turn-driver.js';
import { buildTownView, fill } from './project.js';
import { buildHome, buildTownBoard, buildRelationGraph, buildFeed, UI_ACTIONS, labelOf } from './ui.js';
import type { TownView } from './ui.js';
import { NEEDS, TITLES, AGENT_NPC_IDS, affinityId, titleFlag } from './world-data.js';

function town(): Engine {
  const e = new Engine();
  e.load(buildBlueprint(111));
  setupTown(e.world, 0);
  return e;
}
const port = new NullNpcAgentPort({
  rules: [
    { whenLowest: 'energy', verb: 'rest' },
    { whenLowest: 'social', verb: 'talk_to', args: ['gud'] },
    { whenLowest: 'curiosity', verb: 'observe' },
    { whenLowest: 'mood', verb: 'observe' },
  ],
});
/** 收集树里所有节点（含 children 递归）。 */
function walk(n: LayoutNode, out: LayoutNode[] = []): LayoutNode[] {
  out.push(n);
  for (const c of n.children ?? []) walk(c, out);
  return out;
}
const typesIn = (n: LayoutNode): Set<string> => new Set(walk(n).map((x) => x.type));

describe('game111 UI · schema 合法性（机器门）', () => {
  it('主菜单 validateLayoutNode 零 issue', () => {
    expect(validateLayoutNode(buildHome())).toEqual([]);
    expect(validateLayoutNode(buildHome({ canExit: true }))).toEqual([]);
  });

  it('看板（空世界 / 跑过几回合）validateLayoutNode 均零 issue', async () => {
    const e = town();
    expect(validateLayoutNode(buildTownBoard(buildTownView(e.world, 0)))).toEqual([]);
    let last;
    for (let t = 1; t <= 3; t++) last = await runTurn(e.world, t, port);
    expect(validateLayoutNode(buildTownBoard(buildTownView(e.world, 3, last)))).toEqual([]);
  });

  it('忙态 / 刚解锁称号两种变体也零 issue（分支不漏校验）', async () => {
    const e = town();
    const last = await runTurn(e.world, 1, port);
    for (const opts of [{ busy: true }, { justUnlocked: TITLES[0].id }, { busy: true, justUnlocked: TITLES[0].id }]) {
      expect(validateLayoutNode(buildTownBoard(buildTownView(e.world, 1, last, opts))), JSON.stringify(opts)).toEqual([]);
    }
  });

  it('节点 id 全树唯一（重复 id 会让锚定/diff 认错人）', async () => {
    const e = town();
    const last = await runTurn(e.world, 1, port);
    const ids = walk(buildTownBoard(buildTownView(e.world, 1, last))).map((n) => n.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});

describe('game111 UI · 华丽起手三步（零成熟件 = 朴素缺陷）', () => {
  it('主菜单走的是起手包，不是从空白搭的朴素屏', () => {
    const t = typesIn(buildHome());
    expect(t.has('Particles'), '起手包的环境微光').toBe(true);
    expect(t.has('Button')).toBe(true);
    expect(t.has('Label')).toBe(true);
  });

  it('看板用足成熟件：Avatar.ring / Connector / VirtualList / ProgressBar / Particles', async () => {
    const e = town();
    const last = await runTurn(e.world, 1, port);
    const v = buildTownView(e.world, 1, last, { justUnlocked: TITLES[0].id });
    const nodes = walk(buildTownBoard(v));
    const t = new Set<string>(nodes.map((n) => n.type));
    for (const want of ['Avatar', 'VirtualList', 'ProgressBar', 'Particles', 'Tag', 'Button']) {
      expect(t.has(want), `缺成熟件 ${want}`).toBe(true);
    }
    // Avatar 必须带好感度环（一件顶两件·不是光秃秃的头像）
    const avatars = nodes.filter((n) => n.type === 'Avatar');
    expect(avatars.length).toBeGreaterThan(0);
    expect(avatars.every((a) => (a.props as { ring?: unknown }).ring !== undefined)).toBe(true);
    // 主 CTA 必须有悬停流光
    const cta = nodes.find((n) => n.id === 'btn-next-turn')!;
    expect(JSON.stringify(cta.layout?.fx)).toContain('sheen-hover');
  });
});

describe('game111 UI · 关系网（Connector）', () => {
  it('同区两人之间才连线，且一对只连一次（连两遍=视觉加深·属坏 UI）', () => {
    const mk = (zoneA: string, zoneB: string): TownView => ({
      turn: 1, feed: [], titles: [],
      npcs: [
        { id: 'nao', name: '娜洛', zone: zoneA, needs: {}, affinity: 10 },
        { id: 'mor', name: '茉尔', zone: zoneB, needs: {}, affinity: 20 },
      ],
    });
    const apart = buildRelationGraph(mk('z-cafe', 'z-hill')).filter((n) => n.type === 'Connector');
    expect(apart.length).toBe(0);
    const together = buildRelationGraph(mk('z-cafe', 'z-cafe')).filter((n) => n.type === 'Connector');
    expect(together.length).toBe(1);
    expect(together[0].props).toMatchObject({
      from: { kind: 'node', id: 'rel-nao' },
      to: { kind: 'node', id: 'rel-mor' },
    });
    // 线中点标**刻意不给**：ui-audit 实测该 SVG text 在深底上 ratio=1.05（硬失败），
    // 而这条信息已由每张卡的分区 Tag 承载 → 去掉零信息损失。钉住它，防谁"顺手"把 label 加回来。
    expect((together[0].props as { label?: string }).label).toBeUndefined();
    expect((together[0].props as { tone?: string }).tone).toBe('gold');
  });

  it('连线两端的锚 id 必须真存在于同一棵树（锚空 = 线悬空）', async () => {
    const e = town();
    // 把两人凑到一起
    const last = await runTurn(e.world, 1, new NullNpcAgentPort({
      script: { nao: [{ verb: 'move_to', args: ['z-hill'] }], mor: [{ verb: 'move_to', args: ['z-hill'] }] },
    }));
    const v = buildTownView(e.world, 1, last);
    const tree = buildTownBoard(v);
    const ids = new Set(walk(tree).map((n) => n.id));
    const links = walk(tree).filter((n) => n.type === 'Connector');
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      const p = l.props as { from: { id: string }; to: { id: string } };
      expect(ids.has(p.from.id), `锚 ${p.from.id} 不在树里`).toBe(true);
      expect(ids.has(p.to.id), `锚 ${p.to.id} 不在树里`).toBe(true);
    }
  });
});

describe('game111 UI · 小星书（VirtualList）', () => {
  it('帖子来自 NPC 的记忆，回合降序、同回合按 id 兜底（确定性）', async () => {
    const e = town();
    let last;
    for (let t = 1; t <= 3; t++) last = await runTurn(e.world, t, port);
    const v = buildTownView(e.world, 3, last);
    expect(v.feed.length).toBeGreaterThan(0);
    for (let i = 1; i < v.feed.length; i++) {
      const a = v.feed[i - 1]; const b = v.feed[i];
      expect(a.turn > b.turn || (a.turn === b.turn && a.id <= b.id), `第 ${i} 条乱序`).toBe(true);
    }
    const list = buildFeed(v);
    expect(list.type).toBe('VirtualList');
    expect((list.props as { rows: unknown[] }).rows.length).toBe(v.feed.length);
  });

  it('两次投影同一个世界 → feed 完全一致（不靠遍历序）', async () => {
    const e = town();
    const last = await runTurn(e.world, 1, port);
    const a = buildTownView(e.world, 1, last).feed;
    const b = buildTownView(e.world, 1, last).feed;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('文案模板填空：有宾语填人话，无宾语不留空洞花括号', () => {
    expect(fill('今天去了{o}，路上没什么人。', 'z-hill')).toBe('今天去了后山遗迹，路上没什么人。');
    expect(fill('和{o}说了会儿话。', undefined)).toBe('和说了会儿话。');
    expect(fill('歇一会儿', undefined)).toBe('歇一会儿');
    expect(labelOf('z-cafe')).toBe('野咖啡馆');
    expect(labelOf('nao')).toBe('娜洛');
    expect(labelOf('unknown-id')).toBe('unknown-id');
  });
});

describe('game111 UI · 投影正确性', () => {
  it('需求条读的是世界真值，不是硬编码', async () => {
    const e = town();
    const last = await runTurn(e.world, 1, port);
    const v = buildTownView(e.world, 1, last);
    for (const n of v.npcs) {
      for (const need of NEEDS) {
        let real = -1;
        for (const [eid] of e.world.query('Resource')) {
          const r = e.world.getComponent<Resource>(eid, 'Resource');
          if (r?.id === `${n.id}.${need.key}`) real = r.current;
        }
        expect(n.needs[need.key], `${n.id}.${need.key}`).toBe(real);
      }
    }
  });

  it('降级的 NPC 在卡上标出来（可观测落点·不是静默）', async () => {
    const e = town();
    const last = await runTurn(e.world, 1, undefined); // 无端口 → 全员降级
    const v = buildTownView(e.world, 1, last);
    expect(v.npcs.every((n) => n.fallback === true)).toBe(true);
    const texts = walk(buildTownBoard(v)).map((n) => String((n.props as { text?: string }).text ?? ''));
    expect(texts.some((t) => t.includes('降级'))).toBe(true);
  });

  it('称号解锁后上称号条，且写明是谁给的', async () => {
    const e = town();
    const t0 = TITLES.find((t) => t.byNpc === 'nao')!;
    for (const [eid] of e.world.query('Resource')) {
      const r = e.world.getComponent<Resource>(eid, 'Resource');
      if (r?.id === affinityId('nao')) r.current = t0.minAffinity;
    }
    const last = await runTurn(e.world, 1, port);
    const v = buildTownView(e.world, 1, last);
    expect(v.titles).toContain(t0.id);
    const texts = walk(buildTownBoard(v)).map((n) => String((n.props as { text?: string }).text ?? ''));
    expect(texts.some((t) => t.includes(t0.text) && t.includes('娜洛'))).toBe(true);
    void titleFlag; void AGENT_NPC_IDS;
  });
});

describe('game111 UI · 信号闭集', () => {
  it('树里出现的每个 action 都在 UI_ACTIONS 清单里（宿主接线的单一真相）', async () => {
    const e = town();
    const last = await runTurn(e.world, 1, port);
    const trees = [buildHome({ canExit: true }), buildTownBoard(buildTownView(e.world, 1, last))];
    const known = new Set<string>(UI_ACTIONS);
    for (const tree of trees) {
      for (const n of walk(tree)) {
        const a = (n.props as { action?: string }).action;
        if (a !== undefined && a !== '') expect(known.has(a), `${a} 不在 UI_ACTIONS`).toBe(true);
      }
    }
  });
});
