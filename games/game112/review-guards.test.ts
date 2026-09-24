// game112 —— 复查门点名的守卫测试（S3 复查 r2 N2·S4 复查 八问第 2 问）。
// 每条都是「撤修验红」形状：写死/压平/删消费 → 该例必红（复查人 2026-09-24 实测三处撤修全绿 = 无人守）。
import { describe, it, expect } from 'vitest';
import type { StringVar } from '@zerocraft/engine/engine/protocol/components.js';
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { HallSession } from './session.js';
import { buildHallView, offlineEventTexts } from './project.js';
import { buildScreen } from './ui.js';
import { ACTIVE_CAT, CATS, OFFLINE_EVENTS, OFFLINE_TIERS, offlineKey, type OfflineTier } from './world-data.js';

function walk(n: LayoutNode, out: LayoutNode[] = []): LayoutNode[] {
  out.push(n);
  for (const c of n.children ?? []) walk(c, out);
  return out;
}

describe('game112 守卫（复查门点名·撤修必红）', () => {
  it('①「当前陪伴猫」从世界 StringVar activeCat 读，不是写死常量（改变量 → 投影跟着变）', () => {
    const s = new HallSession(112);
    expect(buildHallView(s.world).catId).toBe(ACTIVE_CAT);
    const sv = s.world.getComponent<StringVar>('world', 'StringVar');
    expect(sv?.id).toBe('activeCat');
    s.world.addComponent('world', { ...sv!, value: 'nobody' } as StringVar);
    const v = buildHallView(s.world);
    expect(v.catId).toBe('nobody');
    expect(v.catName).toBe('nobody'); // 无档案 → 回退到 id，不回退到雪团
  });

  it('④ 三个离线档各用自己的权重表：short 永不出「睡过你的位置」（权重 0）、days 多种子内必出（权重最高）', () => {
    const pick = (tier: OfflineTier, seed: number): string => {
      const s = new HallSession(seed);
      s.act(offlineKey(tier)); s.step();
      const t = offlineEventTexts(s.world);
      expect(t).toHaveLength(1);
      return t[0]!;
    };
    const slept = OFFLINE_EVENTS.find((e) => e.id === 'slept-on-seat')!.text;
    const seeds = Array.from({ length: 24 }, (_, i) => 1000 + i * 7);
    const shortPicks = seeds.map((sd) => pick('short', sd));
    const daysPicks = seeds.map((sd) => pick('days', sd));
    expect(shortPicks).not.toContain(slept);
    expect(daysPicks).toContain(slept);
    // 三档表不是同一张（压平成 short 即红）
    const tables = OFFLINE_TIERS.map((t) => OFFLINE_EVENTS.map((e) => e.weight[t]).join(','));
    expect(new Set(tables).size).toBe(OFFLINE_TIERS.length);
  });

  it('⑤ 敏感章节在回忆廊有「可跳过」徽标；非敏感没有（删消费 → 红）', () => {
    const v = new HallSession(112).hall();
    const flip = (sensitive: boolean) => ({ ...v, chapters: v.chapters.map((c) => ({ ...c, sensitive })) });
    const id = v.chapters[0]!.id;
    const badge = (tree: LayoutNode) => walk(tree).some((n) => n.id === `chap-${id}-sensitive`);
    expect(badge(buildScreen({ screen: 'memory', view: flip(true) }))).toBe(true);
    expect(badge(buildScreen({ screen: 'memory', view: flip(false) }))).toBe(false);
  });

  it('八问②：陪伴动作后猫换姿态与台词（姿态机 pose.<cat>·画面确认）', () => {
    const s = new HallSession(112);
    const cat = CATS.find((c) => c.id === ACTIVE_CAT)!;
    expect(s.hall().pose).toBe('rest');
    expect(s.hall().catLine).toBe(cat.hallLine);
    s.act('cat.sit'); s.step();
    expect(s.hall().pose).toBe('settled');
    expect(s.hall().catLine).toBe(cat.poseLines.settled);
    s.act('cat.greet'); s.step();
    expect(s.hall().pose).toBe('lookup');
    expect(s.hall().catLine).toBe(cat.poseLines.lookup);
    // 主厅 Image 随 lookup 切到「注意」态（画面真变）
    const src = (pose: 'rest' | 'lookup'): string => {
      const tree = buildScreen({ screen: 'hall', view: { ...s.hall(), pose, relations: { ...s.hall().relations, mood: 0 } } });
      return String((walk(tree).find((n) => n.id === 'hall-cat')!.props as { src: string }).src);
    };
    expect(src('lookup')).not.toBe(src('rest'));
    // 晶球卡副标带心光进度（陪坐的可见回报）
    const sub = walk(buildScreen({ screen: 'hall', view: s.hall() })).find((n) => n.id === 'hot-orbs-sub')!.props as { text: string };
    expect(sub.text).toContain(`心光 ${s.hall().relations.heartlight}`);
  });
});
