// ════════════════════════════════════════════════════════════════════════
//  Game X《残响 · Living Companion》—— 宿主层（完整陪伴游玩·见 doc/GAMEPLAY-DESIGN.md）
//
//  大厅 → 开机 → Desk Mode(她在桌上生活·活时钟·活动菜单)
//    ├─ 缺席 24/48/72h 自动切屏；纪念日/生日自动事件
//    └─ 拿起 → Pocket 互动中枢（六入口·按阶段解锁）：
//         💬 聊天（dialogue 能力·话题分流 + 记忆驱动 callback + 羁绊）
//         🎐 一起做事（听歌/散步/猜你一天）  ☕ 关心她（送礼/问候/陪安静）
//         🤍 靠近她（摸头/牵手·阶段解锁）   📖 回忆与档案（相册/懂你/纪念日）
//  放回底座 → 写关系记录（羁绊/记忆/相册/互动·localStorage 跨会话真实流动）。
//  分层红线：宿主=渲染器侧；UI 全 LayoutNode；聊天逻辑在引擎 dialogue 能力。
// ════════════════════════════════════════════════════════════════════════

import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { QueuedInputSource } from '@zerocraft/engine/net/index.js';
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode, HandlerMap, MountHandle } from '@zerocraft/engine/ui/components/index.js';
import type { State, Resource, Flag } from '@zerocraft/engine/engine/protocol/components.js';
import { optionAvailable, DIALOGUE_ACTION_ADVANCE, DIALOGUE_ACTION_CHOOSE } from '@zerocraft/engine/skills/tier3/index.js';
import { deviceShell } from './device-frame.js';
import { COMPANIONS, companionById, type Companion } from './characters.js';
import { deskView, entryAt, hoursAway, type SessionRecord, type Weather, type ClockReading, type RelationStage } from './companion.js';
import { deskScreen } from './desk-screen.js';
import { lobbyScreen, bootScreen } from './lobby-screen.js';
import { ZANKYOU } from './theme.js';
import { ensureFonts, ensureKeyframes } from './fonts.js';
import { absenceScreenFor } from './screens/index.js';
import { weekendSongScreen } from './screens/weekend-song.js';
import { weekendWalkScreen } from './screens/weekend-walk.js';
import { weekendGuessScreen } from './screens/weekend-guess.js';
import { eventBirthdayScreen } from './screens/event-birthday.js';
import { eventAnniversaryScreen } from './screens/event-anniversary.js';
import { diaryScreen } from './screens/diary.js';
import {
  loadRecord, saveRecord, addBond, addAlbum, rolloverDay,
  stageOfRecord, stageNum, addressOf, bondOf, giftsOf, memoriesOf,
} from './record.js';
import { chatGraph, buildChatBlueprint, R_BOND, MEMORY_FACTS, TOPIC_FLAGS } from './chat.js';
import { chatScreen, type ChatView } from './chat-screen.js';
import { pocketHub, careScreen, giftScreen, intimacyScreen, memoriesScreen, reactionScreen, type HubCtx } from './pocket-hub.js';
import { giftReaction } from './gifts.js';
import { greetReaction, quietReaction, intimacyReaction } from './reactions.js';

type Mode =
  | 'lobby' | 'boot' | 'desk' | 'weekend' | 'weekendView' | 'diary'
  | 'pockethub' | 'chat' | 'care' | 'gifts' | 'intimacy' | 'memories' | 'reaction';

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export function mount(container: HTMLElement, _host?: { exit?: () => void }): () => void {
  ensureFonts();
  ensureKeyframes();

  let companion: Companion = COMPANIONS[0];
  let weather: Weather = 'sunny';
  let hourOffset = 0;
  let mode: Mode = 'lobby';
  let record: SessionRecord = loadRecord(companion.id);
  let weekendPick = '';
  let eventAck = '';
  let reactionText = '';
  let reactionBack = 'pocket.hub';
  const owned: Record<string, boolean> = { qiyue: true, mika: true };

  // 聊天对话引擎（仅 chat 期存在）。
  let engine: Engine | null = null;
  let input: QueuedInputSource | null = null;
  let engineUnsub: (() => void) | null = null;
  let lastChatNode = '';
  let chatYou = ''; // 你上一句（气泡回声）

  const theme = ZANKYOU;

  function readClock(): ClockReading {
    const nowMs = Date.now() + hourOffset * 3_600_000;
    const d = new Date(nowMs);
    return { hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(), month: d.getMonth() + 1, date: d.getDate(), weekday: d.getDay(), nowMs };
  }
  const dayKey = (c: ClockReading): string => `${c.month}-${c.date}`;
  const clockStr = (c: ClockReading): string => `${pad2(c.hour)}:${pad2(c.minute)}`;
  const isWeekend = (c: ClockReading): boolean => c.weekday === 0 || c.weekday === 6;
  const isBirthday = (c: ClockReading): boolean => c.month === companion.birthday.month && c.date === companion.birthday.day;
  const stageNow = (): RelationStage => stageOfRecord(record, readClock().nowMs);
  function moodOf(): string {
    const away = hoursAway(readClock().nowMs, record.lastSeenMs);
    if (away >= 48) return '淡淡的担心';
    if (bondOf(record) >= 70) return '温暖';
    if (bondOf(record) >= 35) return '平静';
    return '有点生分';
  }
  function hubCtx(): HubCtx {
    const clk = readClock();
    return { mood: moodOf(), address: addressOf(companion, stageNow()), stage: stageNow(), bond: bondOf(record), clock: clockStr(clk) };
  }
  function lastSummary(): string {
    try { return globalThis.localStorage?.getItem(`gx-sum-${companion.id}`) ?? ''; } catch { return ''; }
  }

  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#05060a;overflow:auto';
  container.appendChild(root);

  // ── 控制条 + 套壳（屏=设备·控制宿主附加）──
  interface BtnSpec { id: string; label: string; action: string; arg?: string; kind?: 'primary' | 'ghost' | 'hero' }
  function controlBar(ctx: BtnSpec[]): LayoutNode {
    const mk = (b: BtnSpec): LayoutNode => ({ type: 'Button', id: b.id, props: { label: b.label, kind: b.kind ?? 'ghost', action: b.action, ...(b.arg !== undefined ? { actionArg: b.arg } : {}) } });
    const dev: BtnSpec[] = [
      { id: 'gx-dev-char', label: '切角色', action: 'dev.swapChar' },
      { id: 'gx-dev-rain', label: '🌧️', action: 'dev.weather', arg: 'rainy' },
      { id: 'gx-dev-sun', label: '☀️', action: 'dev.weather', arg: 'sunny' },
      { id: 'gx-dev-h+', label: '⏩h', action: 'dev.hour', arg: '1' },
      { id: 'gx-dev-d+', label: '⏭ +1天', action: 'dev.hour', arg: '24' },
      { id: 'gx-dev-lobby', label: '◀ 大厅', action: 'mode.lobby' },
    ];
    return { type: 'Panel', id: 'gx-ctrl', props: { bare: true }, layout: { direction: 'row', gap: 6, justify: 'center', width: 660, padding: 4 }, children: [...ctx, ...dev].map(mk) };
  }
  function shell(screen: LayoutNode, ctx: BtnSpec[]): LayoutNode {
    return { type: 'Screen', id: `${screen.id}-host`, props: { center: true, bg: { custom: '#05060a' } }, layout: { direction: 'column', padding: 0, gap: 6 }, children: [...(screen.children ?? []), controlBar(ctx)] };
  }

  // ── 活动选择屏 ──
  function weekendChooser(): LayoutNode {
    const opt = (id: string, label: string, sub: string): LayoutNode => ({
      type: 'Panel', id: `gx-wk-${id}`, props: { bg: { custom: '#1c1726' } }, layout: { direction: 'column', gap: 4, padding: 16, width: 580 },
      children: [
        { type: 'Button', id: `gx-wk-pick-${id}`, props: { label, kind: 'primary', action: 'weekend.pick', actionArg: id } },
        { type: 'Label', id: `gx-wk-sub-${id}`, props: { text: sub, color: 'sub', size: 'sm' } },
      ],
    });
    return deviceShell({
      id: 'gx-weekend-pick', chip: '一起做点什么',
      interior: [{
        type: 'Panel', id: 'gx-wk-list', props: { bare: true }, layout: { direction: 'column', gap: 14, padding: 24, justify: 'center', align: 'center', width: 640, height: 480 },
        children: [
          { type: 'Label', id: 'gx-wk-t', props: { text: '想一起做点什么？', color: 'text', size: 'lg' } },
          opt('song', '🎧 一起听一首歌', '为今晚生成一首 lo-fi，听完聊聊'),
          opt('walk', '🌳 文字散步', '沿着像素小径走走，看看路边'),
          opt('guess', '🔮 猜你的一天', '她根据最近的话，猜你今天做了什么'),
        ],
      }],
    });
  }
  const weekendScreenFor = (id: string): LayoutNode => (id === 'walk' ? weekendWalkScreen() : id === 'guess' ? weekendGuessScreen() : weekendSongScreen());

  // ── 聊天：读对话世界 → ChatView ──
  function flagActive(id: string): boolean {
    if (!engine) return false;
    for (const [e] of engine.world.query('Flag')) {
      const f = engine.world.getComponent<Flag>(e, 'Flag');
      if (f && f.id === id) return f.active;
    }
    return false;
  }
  function chatTree(): LayoutNode {
    const world = engine!.world;
    const st = world.getComponent<State>('dialogue', 'State')!;
    const graph = chatGraph(companion);
    const node = graph[st.current];
    const bond = world.getComponent<Resource>(`res-${R_BOND}`, 'Resource')?.current ?? 0;
    let kind: ChatView['kind'] = 'line';
    let herLine = '';
    let options: ChatView['options'] = [];
    if (node?.kind === 'choice') {
      kind = 'choice'; herLine = node.prompt ?? '';
      node.options.forEach((o, i) => { if (optionAvailable(world, o)) options.push({ text: o.text, index: i }); });
    } else if (node?.kind === 'line') {
      herLine = node.text; kind = node.next === null ? 'end' : 'line';
    }
    const v: ChatView = { address: addressOf(companion, stageNow()), mood: moodOf(), clock: clockStr(readClock()), bond, herLine, yourLine: chatYou, kind, options };
    return chatScreen(companion, v);
  }

  // ── 主 tree ──
  function tree(): LayoutNode {
    switch (mode) {
      case 'lobby': return lobbyScreen(owned);
      case 'boot': return bootScreen(companion);
      case 'weekend': return shell(weekendChooser(), [{ id: 'gx-wk-back', label: '◀ 回桌面', action: 'mode.desk' }]);
      case 'weekendView': return shell(weekendScreenFor(weekendPick), [{ id: 'gx-wk-end', label: '结束活动', action: 'mode.desk', kind: 'primary' }]);
      case 'diary': return shell(diaryScreen(), [{ id: 'gx-diary-back', label: '◀ 回桌面', action: 'mode.desk' }]);
      case 'pockethub': return shell(pocketHub(companion, hubCtx()), []);
      case 'chat': return shell(chatTree(), []);
      case 'care': return shell(careScreen(companion), []);
      case 'gifts': return shell(giftScreen(companion, giftsOf(record)), []);
      case 'intimacy': return shell(intimacyScreen(companion, stageNum(stageNow())), []);
      case 'memories': return shell(memoriesScreen(companion, record, hubCtx(), record.firstMetMs ? (readClock().nowMs - record.firstMetMs) / 86_400_000 : 0), []);
      case 'reaction': return shell(reactionScreen(companion, reactionText, reactionBack), []);
      default: return deskTree();
    }
  }

  function deskTree(): LayoutNode {
    const clock = readClock();
    const view = deskView(companion, clock, weather, record);
    const evtKey = `${companion.id}-${clock.month}-${clock.date}`;
    if (eventAck !== evtKey) {
      if (companion.id === 'mika' && isBirthday(clock)) return shell(eventBirthdayScreen(), [{ id: 'gx-evt-go', label: '继续', action: 'event.ack', arg: evtKey, kind: 'hero' }]);
      if (companion.id === 'qiyue' && view.isAnniversary) return shell(eventAnniversaryScreen(), [{ id: 'gx-evt-go', label: '继续', action: 'event.ack', arg: evtKey, kind: 'hero' }]);
    }
    const abs = absenceScreenFor(view.hoursAway);
    if (abs) return shell(abs(), [{ id: 'gx-abs-pickup', label: '拿起 ▶', action: 'mode.pickup', kind: 'primary' }]);
    return shell(deskScreen(companion, clock, view, lastSummary(), { weekend: isWeekend(clock), diary: companion.id === 'mika' }), []);
  }

  // ── 绘制（根屏 id 变→重挂；否则最小 diff）──
  let ui: MountHandle | null = null;
  let lastRootId = '';
  function paint(): void {
    const t = tree();
    if (ui && t.id === lastRootId) ui.update(t, theme);
    else { ui?.(); ui = mountUI(root, t, handlers(), theme); }
    lastRootId = t.id;
  }
  const remount = paint;

  // ── 聊天生命周期 ──
  function enterChat(): void {
    chatYou = '';
    input = new QueuedInputSource('p1');
    engine = new Engine({ tickRate: 30, input });
    engine.load(buildChatBlueprint(companion, record, stageNum(stageNow())));
    lastChatNode = '';
    engineUnsub = engine.subscribe(() => {
      const cur = engine!.world.getComponent<State>('dialogue', 'State')?.current ?? '';
      if (cur !== lastChatNode) { lastChatNode = cur; paint(); }
    });
    engine.start();
    mode = 'chat';
    remount();
  }
  function persistChat(): void {
    if (!engine) return;
    const bond = engine.world.getComponent<Resource>(`res-${R_BOND}`, 'Resource')?.current;
    if (bond !== undefined) record = { ...record, bond, emotionTemp: bond / 100 };
    const mem = MEMORY_FACTS.filter((f) => flagActive(f));
    const topics = TOPIC_FLAGS.filter((t) => flagActive(t));
    record = { ...record, memories: Array.from(new Set([...memoriesOf(record), ...mem])), dailyTopics: topics };
    if (!record.album?.some((a) => a.key === 'first_chat')) record = addAlbum(record, { key: 'first_chat', title: '第一次好好说话', day: dayKey(readClock()) });
    teardownEngine();
  }
  function teardownEngine(): void { engineUnsub?.(); engineUnsub = null; engine?.stop(); engine = null; input = null; }

  // 放回底座：结算本次相处。
  function dock(): void {
    if (engine) persistChat();
    const now = readClock().nowMs;
    record = { ...record, lastSeenMs: now, firstMetMs: record.firstMetMs || now, interactions: record.interactions + 1 };
    record = rolloverDay(record, dayKey(readClock())); // 跨日则清今日话题
    saveRecord(companion.id, record);
    mode = 'desk';
    remount();
  }

  // 反应（送礼/问候/陪安静/靠近）→ 写记录 → 反应屏。
  function react(text: string, bondDelta: number, back: string, album?: { key: string; title: string }): void {
    record = addBond(record, bondDelta);
    if (album) record = addAlbum(record, { ...album, day: dayKey(readClock()) });
    saveRecord(companion.id, record);
    reactionText = text; reactionBack = back; mode = 'reaction'; remount();
  }

  function handlers(): HandlerMap {
    return {
      'lobby.enter': (arg) => {
        companion = companionById(arg ?? 'qiyue');
        record = rolloverDay(loadRecord(companion.id), dayKey(readClock()));
        mode = record.interactions === 0 && record.lastSeenMs === 0 ? 'boot' : 'desk';
        remount();
      },
      'boot.dock': () => { mode = 'desk'; remount(); },
      'mode.lobby': () => { teardownEngine(); mode = 'lobby'; remount(); },
      'mode.desk': () => { teardownEngine(); weekendPick = ''; mode = 'desk'; remount(); },
      'mode.pickup': () => { mode = 'pockethub'; remount(); },
      'mode.dock': () => dock(),
      'pocket.hub': () => { teardownEngine(); mode = 'pockethub'; remount(); },
      'chat.open': () => enterChat(),
      'chat.choose': (arg) => {
        // 回声：记你选的那句
        const st = engine?.world.getComponent<State>('dialogue', 'State')?.current ?? '';
        const node = chatGraph(companion)[st];
        const idx = Number(arg);
        if (node?.kind === 'choice' && node.options[idx]) chatYou = node.options[idx].text;
        input?.enqueueAction(DIALOGUE_ACTION_CHOOSE, { x: idx });
      },
      'chat.advance': () => { chatYou = ''; input?.enqueueAction(DIALOGUE_ACTION_ADVANCE); },
      'weekend.open': () => { mode = 'weekend'; remount(); },
      'weekend.pick': (arg) => { weekendPick = arg ?? 'song'; mode = 'weekendView'; remount(); },
      'diary.open': () => { mode = 'diary'; remount(); },
      'care.open': () => { mode = 'care'; remount(); },
      'care.gifts': () => { mode = 'gifts'; remount(); },
      'care.give': (arg) => {
        const r = giftReaction(companion.id, arg ?? '');
        record = { ...record, gifts: [...giftsOf(record), arg ?? ''] };
        react(r.text, r.bond, 'care.open', r.love && !record.album?.some((a) => a.key === 'first_gift') ? { key: 'first_gift', title: '送了她喜欢的东西' } : undefined);
      },
      'care.greet': () => { const r = greetReaction(companion.id); react(r.text, r.bond, 'care.open'); },
      'care.quiet': () => { const r = quietReaction(companion.id, stageNow() === 'deep'); react(r.text, r.bond, 'care.open'); },
      'intimacy.open': () => { mode = 'intimacy'; remount(); },
      'intimacy.act': (arg) => {
        const r = intimacyReaction(companion.id, arg ?? 'head');
        react(r.text, r.bond, 'intimacy.open', arg === 'hand' ? { key: 'first_hand', title: '第一次牵手' } : undefined);
      },
      'memories.open': () => { mode = 'memories'; remount(); },
      'event.ack': (arg) => { eventAck = arg ?? ''; mode = 'desk'; remount(); },
      'dev.swapChar': () => {
        teardownEngine();
        const idx = COMPANIONS.findIndex((c) => c.id === companion.id);
        companion = COMPANIONS[(idx + 1) % COMPANIONS.length];
        record = rolloverDay(loadRecord(companion.id), dayKey(readClock()));
        mode = 'desk'; remount();
      },
      'dev.weather': (arg) => { weather = (arg as Weather) ?? 'sunny'; paint(); },
      'dev.hour': (arg) => { hourOffset += Number(arg) || 0; paint(); },
    };
  }

  paint(); // 初绘
  const clockTick = globalThis.setInterval(() => { if (mode === 'desk') paint(); }, 1000);

  return () => {
    globalThis.clearInterval(clockTick);
    teardownEngine();
    ui?.();
    root.remove();
  };
}

export default { mount };
export const _api = { companionById };
