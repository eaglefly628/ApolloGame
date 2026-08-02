// Game B ·《雀宴》设置屏 —— LayoutNode 校验 + 真接线（UI 铁律·治「设置=死键」的回归钉）。
import { describe, it, expect } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@ui/components/index.js';
import { buildSettings, defaultSettings, SET_SPEED, SET_LOGDEFAULT, SETTINGS_BACK } from './menu-settings.js';

const collect = (n: LayoutNode, out: LayoutNode[] = []): LayoutNode[] => {
  out.push(n);
  for (const c of n.children ?? []) collect(c, out);
  return out;
};

describe('game-b 设置屏（menu-settings·LayoutNode 纪律 + 真接线）', () => {
  it('validateLayoutNode 零 issue（默认 + 各态）', () => {
    expect(validateLayoutNode(buildSettings(defaultSettings()))).toEqual([]);
    expect(validateLayoutNode(buildSettings({ aiSpeed: 'fast', logDefault: true }))).toEqual([]);
    expect(validateLayoutNode(buildSettings({ aiSpeed: 'slow', logDefault: false }))).toEqual([]);
  });

  it('三速度钮=set-speed 信号·当前档 primary 高亮·余档 ghost', () => {
    const nodes = collect(buildSettings({ aiSpeed: 'fast', logDefault: false }));
    const spd = nodes.filter((n) => /^set-spd-(fast|normal|slow)$/.test(n.id ?? ''));
    expect(spd).toHaveLength(3);
    for (const b of spd) expect((b.props as { action?: string }).action).toBe(SET_SPEED);
    expect((spd.find((n) => n.id === 'set-spd-fast')!.props as { kind?: string }).kind).toBe('primary');
    expect((spd.find((n) => n.id === 'set-spd-normal')!.props as { kind?: string }).kind).toBe('ghost');
  });

  it('日志开关=set-logdefault·标签随态开/关·返回=settings-back', () => {
    const on = collect(buildSettings({ aiSpeed: 'normal', logDefault: true }, 'zh')).find((n) => n.id === 'set-log-tg')!;
    expect((on.props as { label: string }).label).toBe('开');
    expect((on.props as { action?: string }).action).toBe(SET_LOGDEFAULT);
    const off = collect(buildSettings({ aiSpeed: 'normal', logDefault: false }, 'zh')).find((n) => n.id === 'set-log-tg')!;
    expect((off.props as { label: string }).label).toBe('关');
    // 默认日文：同开关出「オン/オフ」（i18n 生效）。
    const onJa = collect(buildSettings({ aiSpeed: 'normal', logDefault: true })).find((n) => n.id === 'set-log-tg')!;
    expect((onJa.props as { label: string }).label).toBe('オン');
    const back = collect(buildSettings(defaultSettings())).find((n) => n.id === 'set-back')!;
    expect((back.props as { action?: string }).action).toBe(SETTINGS_BACK);
  });
});
