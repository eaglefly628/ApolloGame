// Game B ·《雀宴》—— 设置屏（LayoutNode·NIGHT 皮·真可用选项·治「设置=死键」）。
// 只放**真接线**的设置（改了立刻生效），不摆没接的假控件：AI 出牌速度（接 AI_DELAY）+ 开局默认
// 展开日志（接 logOpen）。难度/音量/脱衣演出等待玩法完善再开（gdd §四/§五），现不放假钮。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { MENU_W, MENU_H } from './theme.js';
import { t, type Lang } from './strings.js';

export const SET_SPEED = 'set-speed';        // arg: 'fast' | 'normal' | 'slow'
export const SET_LOGDEFAULT = 'set-logdefault'; // 切换开局默认日志
export const SETTINGS_BACK = 'settings-back';

export type AiSpeed = 'fast' | 'normal' | 'slow';
export interface Settings { aiSpeed: AiSpeed; logDefault: boolean }

/** 默认设置（模块级持有·菜单↔牌桌之间存活）。 */
export function defaultSettings(): Settings { return { aiSpeed: 'normal', logDefault: false }; }

const SPEED_KEYS: Array<{ v: AiSpeed; key: 'set.fast' | 'set.normal' | 'set.slow' }> = [
  { v: 'fast', key: 'set.fast' }, { v: 'normal', key: 'set.normal' }, { v: 'slow', key: 'set.slow' },
];

export function buildSettings(s: Settings, lang: Lang = 'ja'): LayoutNode {
  const speedBtns: LayoutNode[] = SPEED_KEYS.map(({ v, key }) => ({
    type: 'Button', id: `set-spd-${v}`,
    props: { label: t(lang, key), kind: s.aiSpeed === v ? 'primary' : 'ghost', action: SET_SPEED, actionArg: v },
  }));
  return {
    type: 'Panel', id: 'settings-root', props: { bare: true },
    layout: { width: MENU_W, height: MENU_H },
    children: [{
      type: 'Modal', id: 'settings-modal', props: { title: t(lang, 'set.title'), closable: false },
      children: [{
        type: 'Panel', id: 'set-body', props: { bare: true },
        layout: { direction: 'column', gap: 20, padding: 10, width: 440 },
        children: [
          // AI 出牌速度（接 AI_DELAY·改了下把牌立刻生效）
          {
            type: 'Panel', id: 'set-spd-row', props: { bare: true }, layout: { direction: 'column', gap: 9 },
            children: [
              { type: 'Label', id: 'set-spd-l', props: { text: t(lang, 'set.speed'), size: 'md', bold: true, color: 'text' } },
              { type: 'Panel', id: 'set-spd-opts', props: { bare: true }, layout: { direction: 'row', gap: 10 }, children: speedBtns },
            ],
          },
          // 开局默认展开日志（接 logOpen）
          {
            type: 'Panel', id: 'set-log-row', props: { bare: true }, layout: { direction: 'row', gap: 12, align: 'center' },
            children: [
              { type: 'Label', id: 'set-log-l', props: { text: t(lang, 'set.log'), size: 'md', color: 'text' }, layout: { flex: 1 } },
              { type: 'Button', id: 'set-log-tg', props: { label: s.logDefault ? t(lang, 'set.on') : t(lang, 'set.off'), kind: s.logDefault ? 'primary' : 'ghost', action: SET_LOGDEFAULT } },
            ],
          },
          { type: 'Label', id: 'set-note', props: { text: t(lang, 'set.note'), size: 'sm', color: 'sub' } },
          { type: 'Button', id: 'set-back', props: { label: t(lang, 'set.back'), kind: 'hero', action: SETTINGS_BACK } },
        ],
      }],
    }],
  };
}
