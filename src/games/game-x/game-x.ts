// ════════════════════════════════════════════════════════════════════════
//  Game X《残响 · Living Companion》—— 可挂载卡带 / 宿主层
//
//  「一个住在你桌上的人。」四态流转：
//    大厅(角色选择 Marketplace) → 开机(初次见面) → Desk Mode(她在桌上生活·活时钟)
//                                                → 拿起 Pocket Mode(对话) → 放回(写关系记录)
//  美术完全对齐 Designer bundle：ZANKYOU 主题 + 像素字体(VT323/DotGothic16/Silkscreen) + 像素场景 SVG。
//  分层红线：宿主=渲染器侧（读世界/墙钟 outcome-first、写世界只发信号）；UI 全 LayoutNode 数据。
// ════════════════════════════════════════════════════════════════════════

import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap, MountHandle } from '@ui/components/index.js';
import type { State, Resource } from '@engine/protocol/components.js';
import type { DialogueNode } from '@skills/tier3/index.js';
import { COMPANIONS, companionById, type Companion } from './characters.js';
import { deskView, greetOf, entryAt, type SessionRecord, type Weather, type ClockReading } from './companion.js';
import { deskScreen } from './desk-screen.js';
import { lobbyScreen, bootScreen } from './lobby-screen.js';
import { pocketScreen, type PocketView } from './pocket-screen.js';
import { buildPocketBlueprint, pocketGraph, R_WARMTH } from './pocket.js';
import { optionAvailableIndices } from './choices.js';
import { ZANKYOU } from './theme.js';
import { ensureFonts, ensureKeyframes } from './fonts.js';

type Mode = 'lobby' | 'boot' | 'desk' | 'pocket';
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

export function mount(container: HTMLElement, _host?: { exit?: () => void }): () => void {
  ensureFonts();
  ensureKeyframes();

  let companion: Companion = COMPANIONS[0];
  let weather: Weather = 'sunny';
  let hourOffset = 0; // 演示拨时刻（正式版恒 0·真实时钟驱动）
  let mode: Mode = 'lobby';
  let record: SessionRecord = loadRecord(companion.id);
  const owned: Record<string, boolean> = { qiyue: true, mika: true }; // 框架期默认都可进（正式版 mika 需购买）

  let engine: Engine | null = null;
  let input: QueuedInputSource | null = null;
  let engineUnsub: (() => void) | null = null;
  let pickupGreeting = '';
  let lastPocketNode = '';

  const theme = ZANKYOU;

  // 时钟服务：设备实时时钟 + 演示偏移（唯一读 new Date() 处）。
  function readClock(): ClockReading {
    const nowMs = Date.now() + hourOffset * 3_600_000;
    const d = new Date(nowMs);
    return { hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(), month: d.getMonth() + 1, date: d.getDate(), weekday: d.getDay(), nowMs };
  }
  function lastSummary(): string {
    try { return globalThis.localStorage?.getItem(`gx-sum-${companion.id}`) ?? ''; } catch { return ''; }
  }

  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#05060a;overflow:auto';
  container.appendChild(root);

  // ── 各态的 LayoutNode 树 ──
  function tree(): LayoutNode {
    if (mode === 'lobby') return lobbyScreen(owned);
    if (mode === 'boot') return bootScreen(companion);
    if (mode === 'pocket') return pocketTree();
    const clock = readClock();
    return deskScreen(companion, clock, deskView(companion, clock, weather, record), lastSummary());
  }

  function pocketTree(): LayoutNode {
    const world = engine!.world;
    const st = world.getComponent<State>('dialogue', 'State');
    const graph = pocketGraph(companion);
    const node: DialogueNode | undefined = st ? graph[st.current] : undefined;
    const warmth = world.getComponent<Resource>(R_WARMTH, 'Resource')?.current ?? 0;
    const pose = entryAt(companion, readClock().hour).pose;
    const ended = !!node && node.kind === 'line' && node.next === null;
    const choices = node && node.kind === 'choice'
      ? optionAvailableIndices(world, node).map((i) => ({ text: node.options[i].text, index: i }))
      : [];
    const v: PocketView = { node, pose, greeting: pickupGreeting, warmth, choices, ended };
    return pocketScreen(companion, v);
  }

  function render(): void { ui.update(tree(), theme); }
  function remount(): void { ui(); ui = mountUI(root, tree(), handlers(), theme, input ?? undefined); }

  // ── Pocket Mode ──
  function enterPocket(): void {
    pickupGreeting = greetOf(companion, readClock(), record).firstLine;
    input = new QueuedInputSource('p1');
    engine = new Engine({ tickRate: 30, input });
    engine.load(buildPocketBlueprint(companion, record.emotionTemp * 100));
    lastPocketNode = '';
    engineUnsub = engine.subscribe(() => {
      const cur = engine!.world.getComponent<State>('dialogue', 'State')?.current ?? '';
      if (cur !== lastPocketNode) { lastPocketNode = cur; render(); }
    });
    engine.start();
    mode = 'pocket';
    remount();
  }
  function dock(): void {
    if (engine) {
      const warmth = engine.world.getComponent<Resource>(R_WARMTH, 'Resource')?.current ?? 0;
      const now = readClock().nowMs;
      record = {
        lastSeenMs: now,
        firstMetMs: record.firstMetMs || now,
        emotionTemp: Math.min(1, warmth / 100),
        interactions: record.interactions + 1,
      };
      saveRecord(companion.id, record);
    }
    teardownEngine();
    mode = 'desk';
    remount();
  }
  function teardownEngine(): void {
    engineUnsub?.(); engineUnsub = null;
    engine?.stop(); engine = null;
    input = null;
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
      'mode.lobby': () => { teardownEngine(); mode = 'lobby'; remount(); },
      'mode.pickup': () => enterPocket(),
      'mode.dock': () => dock(),
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

  let ui: MountHandle = mountUI(root, tree(), handlers(), theme, input ?? undefined);

  // Desk Mode 活时钟：每秒刷新（对齐 bundle setInterval 1s·VT323 秒位跳动）。
  const clockTick = globalThis.setInterval(() => { if (mode === 'desk') render(); }, 1000);

  return () => {
    globalThis.clearInterval(clockTick);
    teardownEngine();
    ui();
    root.remove();
  };
}

export default { mount };
export const _api = { companionById };
