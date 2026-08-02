// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 屏注册表（画廊 + 自然流转引用）
//
//  12 个复刻屏（缺席×3 / Pocket×3 / 周末×3 / 事件×2 / 日记×1）的统一登记。
//  每屏=parameterless LayoutNode builder（忠实静态态·代表性数据来自设计稿）。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { absence24Screen } from './absence-24h.js';
import { absence48Screen } from './absence-48h.js';
import { absence72Screen } from './absence-72h.js';
import { pocketMorningScreen } from './pocket-morning.js';
import { pocketMemoryScreen } from './pocket-memory.js';
import { pocketRecapScreen } from './pocket-recap.js';
import { weekendSongScreen } from './weekend-song.js';
import { weekendWalkScreen } from './weekend-walk.js';
import { weekendGuessScreen } from './weekend-guess.js';
import { eventBirthdayScreen } from './event-birthday.js';
import { eventAnniversaryScreen } from './event-anniversary.js';
import { diaryScreen } from './diary.js';

export interface ScreenDef { id: string; label: string; group: string; build: () => LayoutNode }

export const ALL_SCREENS: ScreenDef[] = [
  { id: 'absence-24h', label: '缺席 +24H', group: '缺席感知', build: absence24Screen },
  { id: 'absence-48h', label: '缺席 +48H', group: '缺席感知', build: absence48Screen },
  { id: 'absence-72h', label: '缺席 +72H', group: '缺席感知', build: absence72Screen },
  { id: 'pocket-morning', label: '晨间问候', group: 'Pocket Mode', build: pocketMorningScreen },
  { id: 'pocket-memory', label: '记忆驱动对话', group: 'Pocket Mode', build: pocketMemoryScreen },
  { id: 'pocket-recap', label: 'Mika 夜间复盘', group: 'Pocket Mode', build: pocketRecapScreen },
  { id: 'weekend-song', label: '一起听一首歌', group: '周末活动', build: weekendSongScreen },
  { id: 'weekend-walk', label: '文字散步', group: '周末活动', build: weekendWalkScreen },
  { id: 'weekend-guess', label: '猜你的一天', group: '周末活动', build: weekendGuessScreen },
  { id: 'event-birthday', label: '你的生日', group: '特殊事件', build: eventBirthdayScreen },
  { id: 'event-anniversary', label: '第一次纪念日', group: '特殊事件', build: eventAnniversaryScreen },
  { id: 'diary', label: 'Mika 日记收藏', group: '系统', build: diaryScreen },
];

export const SCREEN_MAP: Record<string, ScreenDef> = Object.fromEntries(ALL_SCREENS.map((s) => [s.id, s]));

// 缺席态按小时数选屏（宿主 Desk Mode 路由用）。
export function absenceScreenFor(hoursAway: number): (() => LayoutNode) | null {
  if (hoursAway >= 72) return absence72Screen;
  if (hoursAway >= 48) return absence48Screen;
  if (hoursAway >= 24) return absence24Screen;
  return null;
}
