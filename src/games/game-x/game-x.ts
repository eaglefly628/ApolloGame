// ════════════════════════════════════════════════════════════════════════
//  Game X《残响 · Living Companion》—— 可挂载卡带 / 宿主层
//
//  「一个住在你桌上的人。」全部画面由真实游戏状态/条件触发，融入流程（无画廊陈列）：
//    大厅(选角) → 开机(初次见面) → Desk Mode(她在桌上生活·活时钟)
//      ├─ 缺席 24/48/72h：按 hoursAway 自动切暗化态
//      ├─ 纪念日/生日：按设备日历自动触发事件屏（七月一周年 / Mika 生日）
//      ├─ 拿起 → Pocket Mode：按 时段/角色 上下文显示对话屏（晨问 / 记忆驱动 / Mika 复盘）
//      ├─ 周末：出现「周末活动」入口 → 听歌 / 散步 / 猜你一天
//      └─ Mika：出现「日记」入口 → 插画收藏
//  分层红线：宿主=渲染器侧（读世界/墙钟 outcome-first、写世界只发信号）；UI 全 LayoutNode 数据。
// ════════════════════════════════════════════════════════════════════════

import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap, MountHandle } from '@ui/components/index.js';
import { deviceShell } from './device-frame.js';
import { COMPANIONS, companionById, type Companion } from './characters.js';
import { deskView, entryAt, type SessionRecord, type Weather, type ClockReading } from './companion.js';
import { deskScreen } from './desk-screen.js';
import { lobbyScreen, bootScreen } from './lobby-screen.js';
import { ZANKYOU } from './theme.js';
import { ensureFonts, ensureKeyframes } from './fonts.js';
import { absenceScreenFor } from './screens/index.js';
import { pocketMorningScreen } from './screens/pocket-morning.js';
import { pocketMemoryScreen } from './screens/pocket-memory.js';
import { pocketRecapScreen } from './screens/pocket-recap.js';
import { weekendSongScreen } from './screens/weekend-song.js';
import { weekendWalkScreen } from './screens/weekend-walk.js';
import { weekendGuessScreen } from './screens/weekend-guess.js';
import { eventBirthdayScreen } from './screens/event-birthday.js';
import { eventAnniversaryScreen } from './screens/event-anniversary.js';
import { diaryScreen } from './screens/diary.js';

type Mode = 'lobby' | 'boot' | 'desk' | 'pocket' | 'weekend' | 'weekendView' | 'diary';
const DEFAULT_RECORD: SessionRecord = { lastSeenMs: 0, firstMetMs: 0, emotionTemp: 0.15, interactions: 0 };

function recKey(id: string): string { return `gx-rec-${id}`; }
function loadRecord(id: string): SessionRecord {
  try {
    const raw = globalThis.localStorage?.getItem(recKey(id));
    if (raw) return { ...DEFAULT_RECORD, ...JSON.parse(raw) };
  } catch { /* 损坏存档忽略 */ }
  return { ...DEFAULT_RECORD };
}
function saveRecord(id: string, rec: SessionRecord): void {
  try { globalThis.localStorage?.setItem(recKey(id), JSON.stringify(rec)); } catch { /* 无存储仅本会话 */ }
}

interface BtnSpec { id: string; label: string; action: string; arg?: string; kind?: 'primary' | 'ghost' | 'hero' }

export function mount(container: HTMLElement, _host?: { exit?: () => void }): () => void {
  ensureFonts();
  ensureKeyframes();

  let companion: Companion = COMPANIONS[0];
  let weather: Weather = 'sunny';
  let hourOffset = 0; // 演示拨时刻/日（正式版恒 0·真实时钟驱动）
  let mode: Mode = 'lobby';
  let record: SessionRecord = loadRecord(companion.id);
  let weekendPick = '';
  let eventAck = ''; // 已"继续"过的事件 key（避免同一天反复弹）
  const owned: Record<string, boolean> = { qiyue: true, mika: true };

  const theme = ZANKYOU;

  function readClock(): ClockReading {
    const nowMs = Date.now() + hourOffset * 3_600_000;
    const d = new Date(nowMs);
    return { hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(), month: d.getMonth() + 1, date: d.getDate(), weekday: d.getDay(), nowMs };
  }
  function lastSummary(): string {
    try { return globalThis.localStorage?.getItem(`gx-sum-${companion.id}`) ?? ''; } catch { return ''; }
  }
  const isWeekend = (c: ClockReading): boolean => c.weekday === 0 || c.weekday === 6;
  const isBirthday = (c: ClockReading): boolean => c.month === companion.birthday.month && c.date === companion.birthday.day;

  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#05060a;overflow:auto';
  container.appendChild(root);

  // ── 宿主统一控制条（dev 时钟/天气/切角色/大厅 + 上下文动作）——置于设备下方 ──
  function controlBar(ctx: BtnSpec[]): LayoutNode {
    const mk = (b: BtnSpec): LayoutNode => ({ type: 'Button', id: b.id, props: { label: b.label, kind: b.kind ?? 'ghost', action: b.action, ...(b.arg !== undefined ? { actionArg: b.arg } : {}) } });
    const dev: BtnSpec[] = [
      { id: 'gx-dev-char', label: '切角色', action: 'dev.swapChar' },
      { id: 'gx-dev-sun', label: '☀️', action: 'dev.weather', arg: 'sunny' },
      { id: 'gx-dev-rain', label: '🌧️', action: 'dev.weather', arg: 'rainy' },
      { id: 'gx-dev-snow', label: '❄️', action: 'dev.weather', arg: 'snowy' },
      { id: 'gx-dev-h-', label: '⏪h', action: 'dev.hour', arg: '-1' },
      { id: 'gx-dev-h+', label: '⏩h', action: 'dev.hour', arg: '1' },
      { id: 'gx-dev-d+', label: '⏭ +1天', action: 'dev.hour', arg: '24' },
      { id: 'gx-dev-lobby', label: '◀ 大厅', action: 'mode.lobby' },
    ];
    return {
      type: 'Panel', id: 'gx-ctrl', props: { bare: true },
      layout: { direction: 'row', gap: 6, justify: 'center', width: 660, padding: 4 },
      children: [...ctx, ...dev].map(mk),
    };
  }

  // 把某屏(Screen 节点)套上宿主控制条（屏本身只是设备·控制由宿主统一附加）。
  function shell(screen: LayoutNode, ctx: BtnSpec[]): LayoutNode {
    return {
      type: 'Screen', id: `${screen.id}-host`, props: { center: true, bg: '#05060a' },
      layout: { direction: 'column', padding: 0, gap: 6 },
      children: [...(screen.children ?? []), controlBar(ctx)],
    };
  }

  // 拿起时按 时段/角色 选上下文对话屏（GDD §六）。
  function pocketContextScreen(): LayoutNode {
    if (companion.id === 'mika') return pocketRecapScreen();
    return readClock().hour < 14 ? pocketMorningScreen() : pocketMemoryScreen();
  }

  // 周末活动选择屏（仅周末入口可达）。
  function weekendChooser(): LayoutNode {
    const opt = (id: string, label: string, sub: string): LayoutNode => ({
      type: 'Panel', id: `gx-wk-${id}`, props: { bg: '#1c1726' },
      layout: { direction: 'column', gap: 4, padding: 16, width: 580 },
      children: [
        { type: 'Button', id: `gx-wk-pick-${id}`, props: { label, kind: 'primary', action: 'weekend.pick', actionArg: id } },
        { type: 'Label', id: `gx-wk-sub-${id}`, props: { text: sub, color: 'sub', size: 'sm' } },
      ],
    });
    return deviceShell({
      id: 'gx-weekend-pick', chip: '一起做点什么',
      interior: [{
        type: 'Panel', id: 'gx-wk-list', props: { bare: true },
        layout: { direction: 'column', gap: 14, padding: 24, justify: 'center', align: 'center', width: 640, height: 480 },
        children: [
          { type: 'Label', id: 'gx-wk-t', props: { text: '想一起做点什么？', color: 'text', size: 'lg' } },
          opt('song', '🎧 一起听一首歌', '为今晚生成一首 lo-fi，听完聊聊'),
          opt('walk', '🌳 文字散步', '沿着像素小径走走，看看路边'),
          opt('guess', '🔮 猜你的一天', '她根据最近的话，猜你今天做了什么'),
        ],
      }],
    });
  }
  function weekendScreenFor(id: string): LayoutNode {
    if (id === 'walk') return weekendWalkScreen();
    if (id === 'guess') return weekendGuessScreen();
    return weekendSongScreen();
  }

  // ── 各态 → LayoutNode 树 ──
  function tree(): LayoutNode {
    if (mode === 'lobby') return lobbyScreen(owned);
    if (mode === 'boot') return bootScreen(companion);
    if (mode === 'pocket') return shell(pocketContextScreen(), [{ id: 'gx-dock', label: '🔌 放回底座', action: 'mode.dock', kind: 'hero' }]);
    if (mode === 'weekend') return shell(weekendChooser(), [{ id: 'gx-wk-back', label: '◀ 回桌面', action: 'mode.desk' }]);
    if (mode === 'weekendView') return shell(weekendScreenFor(weekendPick), [{ id: 'gx-wk-end', label: '结束活动', action: 'mode.desk', kind: 'primary' }]);
    if (mode === 'diary') return shell(diaryScreen(), [{ id: 'gx-diary-back', label: '◀ 回桌面', action: 'mode.desk' }]);
    return deskTree();
  }

  // Desk Mode：事件 → 缺席 → 常规，按真实条件路由。
  function deskTree(): LayoutNode {
    const clock = readClock();
    const view = deskView(companion, clock, weather, record);
    // 事件（按设备日历·GDD §九）——角色专属事件屏。
    const evtKey = `${companion.id}-${clock.month}-${clock.date}`;
    if (eventAck !== evtKey) {
      if (companion.id === 'mika' && isBirthday(clock)) {
        return shell(eventBirthdayScreen(), [{ id: 'gx-evt-go', label: '继续', action: 'event.ack', arg: evtKey, kind: 'hero' }]);
      }
      if (companion.id === 'qiyue' && view.isAnniversary) {
        return shell(eventAnniversaryScreen(), [{ id: 'gx-evt-go', label: '继续', action: 'event.ack', arg: evtKey, kind: 'hero' }]);
      }
    }
    // 缺席（按 hoursAway·GDD §四）——拿起即回到她身边、清掉缺席。
    const abs = absenceScreenFor(view.hoursAway);
    if (abs) return shell(abs(), [{ id: 'gx-abs-pickup', label: '拿起 ▶', action: 'mode.pickup', kind: 'primary' }]);
    // 常规 Desk（周末/日记入口在信息带·条件出现）。
    const desk = deskScreen(companion, clock, view, lastSummary(), { weekend: isWeekend(clock), diary: companion.id === 'mika' });
    return shell(desk, []);
  }

  // 单一绘制入口：根屏 id 变 → 整重挂（结构换屏）；否则最小 diff（同屏刷数据·如活时钟）。
  let lastRootId = '';
  function paint(): void {
    const t = tree();
    if (ui && t.id === lastRootId) {
      ui.update(t, theme);
    } else {
      ui?.();
      ui = mountUI(root, t, handlers(), theme);
    }
    lastRootId = t.id;
  }
  const render = paint;
  const remount = paint;

  // 放回底座：写关系记录（暖意 + 互动 + 清缺席）。
  function dock(): void {
    const now = readClock().nowMs;
    record = {
      lastSeenMs: now,
      firstMetMs: record.firstMetMs || now,
      emotionTemp: Math.min(1, record.emotionTemp + 0.08),
      interactions: record.interactions + 1,
    };
    saveRecord(companion.id, record);
    mode = 'desk';
    remount();
  }

  function handlers(): HandlerMap {
    return {
      'lobby.enter': (arg) => {
        companion = companionById(arg ?? 'qiyue');
        record = loadRecord(companion.id);
        mode = record.interactions === 0 && record.lastSeenMs === 0 ? 'boot' : 'desk';
        remount();
      },
      'boot.dock': () => { mode = 'desk'; remount(); },
      'mode.lobby': () => { mode = 'lobby'; remount(); },
      'mode.desk': () => { mode = 'desk'; weekendPick = ''; remount(); },
      'mode.pickup': () => { mode = 'pocket'; remount(); },
      'mode.dock': () => dock(),
      'weekend.open': () => { mode = 'weekend'; remount(); },
      'weekend.pick': (arg) => { weekendPick = arg ?? 'song'; mode = 'weekendView'; remount(); },
      'diary.open': () => { mode = 'diary'; remount(); },
      'event.ack': (arg) => { eventAck = arg ?? ''; mode = 'desk'; remount(); },
      'dev.swapChar': () => {
        const idx = COMPANIONS.findIndex((c) => c.id === companion.id);
        companion = COMPANIONS[(idx + 1) % COMPANIONS.length];
        record = loadRecord(companion.id);
        remount();
      },
      'dev.weather': (arg) => { weather = (arg as Weather) ?? 'sunny'; render(); },
      'dev.hour': (arg) => { hourOffset += Number(arg) || 0; render(); },
    };
  }

  let ui: MountHandle | null = null;
  paint(); // 初绘

  // Desk Mode 活时钟：每秒刷新（对齐 bundle setInterval 1s·VT323 秒位跳动）。
  const clockTick = globalThis.setInterval(() => { if (mode === 'desk') render(); }, 1000);

  return () => {
    globalThis.clearInterval(clockTick);
    ui?.();
    root.remove();
  };
}

export default { mount };
export const _api = { companionById };
