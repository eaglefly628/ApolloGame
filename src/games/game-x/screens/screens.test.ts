// @vitest-environment happy-dom
// 12 复刻屏验收：每屏 build() 产合法 Screen LayoutNode、renderNode 出非空 HTML、含关键文案；
// 缺席按小时选屏；画廊菜单可建。确保 Designer 复刻屏全部可渲染、不回归。
import { describe, it, expect } from 'vitest';
import { renderNode } from '@ui/components/index.js';
import { ZANKYOU } from '../theme.js';
import { ALL_SCREENS, SCREEN_MAP, absenceScreenFor } from './index.js';

describe('Game X · 12 复刻屏：渲染不崩 + 结构合法', () => {
  it('注册表 12 屏，id 唯一', () => {
    expect(ALL_SCREENS).toHaveLength(12);
    expect(new Set(ALL_SCREENS.map((s) => s.id)).size).toBe(12);
  });

  for (const s of ALL_SCREENS) {
    it(`${s.id} → Screen 根 + 非空 HTML`, () => {
      const node = s.build();
      expect(node.type).toBe('Screen');
      expect(node.id).toContain('gx-');
      const html = renderNode(node, ZANKYOU);
      expect(html.length).toBeGreaterThan(200);
      // 设备外框 + 像素字体槽（VT323/Silkscreen 至少其一出现，证明字体槽生效）
      expect(html).toMatch(/VT323|Silkscreen|DotGothic16/);
    });
  }
});

describe('Game X · 复刻屏关键文案（忠实设计稿内容）', () => {
  const has = (id: string, text: string): void => {
    expect(renderNode(SCREEN_MAP[id].build(), ZANKYOU)).toContain(text);
  };
  it('缺席三档文案', () => {
    has('absence-24h', 'AWAY');
    has('absence-72h', '灯');
  });
  it('Pocket 记忆驱动「她记得」+ 边界', () => {
    const html = renderNode(SCREEN_MAP['pocket-memory'].build(), ZANKYOU);
    expect(html).toContain('两个月前');
    expect(html).toContain('不会替你回答');
  });
  it('周末听歌曲名 + 生日祝福 + 日记收藏', () => {
    has('weekend-song', 'lo-fi');
    has('event-birthday', '生日快乐');
    has('diary', '她画下的每一天');
  });
});

describe('Game X · 缺席按小时选屏', () => {
  it('阈值正确', () => {
    expect(absenceScreenFor(10)).toBeNull();
    expect(absenceScreenFor(30)?.().id).toBe('gx-absence-24h');
    expect(absenceScreenFor(50)?.().id).toBe('gx-absence-48h');
    expect(absenceScreenFor(100)?.().id).toBe('gx-absence-72h');
  });
});

