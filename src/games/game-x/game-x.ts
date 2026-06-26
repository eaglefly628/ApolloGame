// ════════════════════════════════════════════════════════════════════════
//  Game X《残响 · Living Companion》—— 可挂载卡带 / 宿主层（基础框架）
//
//  「一个住在你桌上的人。」本宿主把框架逻辑串成可跑的整体：
//    · 时钟服务：读设备实时时钟（+ 演示用时刻偏移）→ 注入 companion.ts 派生层（GDD §四）。
//    · Desk Mode：她在你不在时继续在桌上生活（时间/天气/缺席驱动，纯派生 → LayoutNode）。
//    · Pocket Mode：拿起设备 → 引擎 dialogue 能力跑脚本对话 → 放回时把"暖意"写回关系记录。
//    · 关系记录持久化：localStorage 存 lastSeen / 纪念日 / 情感温度 / 互动次数（跨会话真实流动）。
//
//  分层红线（本宿主＝工程师侧 host/表现层，等同渲染器）：读世界/时钟 outcome-first，
//  用 ui/components 解释 LayoutNode；写世界只经 action 信号入队。游戏"内容"全在角色数据里。
//  表现层（立绘/场景/UI）为占位实现，待 Claude designer 设计层接入后替换，不动本逻辑。
// ════════════════════════════════════════════════════════════════════════

import { Engine } from '../../runtime/engine.js';
import { QueuedInputSource } from '@net/index.js';
import { mountUI, apolloBrocade } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap, MountHandle } from '@ui/components/index.js';
import type { State, Resource } from '@engine/protocol/components.js';
import { DIALOGUE_FSM } from '@skills/tier3/index.js';
import type { DialogueNode } from '@skills/tier3/index.js';
import { COMPANIONS, companionById, type Companion } from './characters.js';
import {
  deskView, greetOf, entryAt, type ClockReading, type SessionRecord, type Weather,
} from './companion.js';
import { deskScreen } from './desk-screen.js';
import { pocketScreen, type PocketView } from './pocket-screen.js';
import {
  buildPocketBlueprint, pocketGraph, R_WARMTH, POCKET_START,
} from './pocket.js';
import { optionAvailableIndices } from './choices.js';

const DEFAULT_RECORD: SessionRecord = { lastSeenMs: 0, firstMetMs: 0, emotionTemp: 0.15, interactions: 0 };

// ── 关系记录持久化（localStorage·每角色一份；跨会话真实时间流动的载体）──────────
function recKey(id: string): string { return `gx-rec-${id}`; }
function loadRecord(id: string): SessionRecord {
  try {
    const raw = globalThis.localStorage?.getItem(recKey(id));
    if (raw) return { ...DEFAULT_RECORD, ...JSON.parse(raw) };
  } catch { /* 忽略损坏存档 */ }
  return { ...DEFAULT_RECORD };
}
function saveRecord(id: string, rec: SessionRecord): void {
  try { globalThis.localStorage?.setItem(recKey(id), JSON.stringify(rec)); } catch { /* 无存储则仅本会话有效 */ }
}

export function mount(container: HTMLElement, _host?: { exit?: () => void }): () => void {
  // ── 宿主状态 ──
  let companion: Companion = COMPANIONS[0];
  let weather: Weather = 'sunny';
  let hourOffset = 0; // 演示：早/晚拨时刻（正式版恒 0，由真实时钟驱动）
  let mode: 'desk' | 'pocket' = 'desk';
  let record = loadRecord(companion.id);

  // Pocket Mode 引擎/输入（仅 pocket 期存在）。
  let engine: Engine | null = null;
  let input: QueuedInputSource | null = null;
  let engineUnsub: (() => void) | null = null;
  let pickupGreeting = '';
  let lastPocketNode = '';

  const theme = apolloBrocade;

  // ── 时钟服务：设备实时时钟 + 演示偏移 → ClockReading（唯一读 new Date() 处）──────
  function readClock(): ClockReading {
    const nowMs = Date.now() + hourOffset * 3_600_000;
    const d = new Date(nowMs);
    return { hour: d.getHours(), minute: d.getMinutes(), weekday: d.getDay(), nowMs };
  }

  // ── 上次对话摘要（基础框架先存一句；正式版接记忆层 §七）──────────────────────
  function lastSummary(): string {
    try { return globalThis.localStorage?.getItem(`gx-sum-${companion.id}`) ?? ''; } catch { return ''; }
  }

  // 挂载点。
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#05060a';
  container.appendChild(root);

  let ui: MountHandle = mountUI(root, deskTree(), handlers(), theme, input ?? undefined);

  // ── Desk Mode 树 ──
  function deskTree(): LayoutNode {
    const clock = readClock();
    const view = deskView(companion, clock, weather, record);
    return deskScreen(companion, clock, view, lastSummary());
  }

  // ── Pocket Mode 树（从引擎世界读当前节点 + 暖意）──
  function pocketTree(): LayoutNode {
    const world = engine!.world;
    const st = world.getComponent<State>('dialogue', 'State');
    const graph = pocketGraph(companion);
    const node: DialogueNode | undefined = st ? graph[st.current] : undefined;
    const warmth = world.getComponent<Resource>(R_WARMTH, 'Resource')?.current ?? 0;
    const clock = readClock();
    const pose = entryAt(companion, clock.hour).pose;
    const ended = !!node && node.kind === 'line' && node.next === null;
    const choices = node && node.kind === 'choice'
      ? optionAvailableIndices(world, node).map((i) => ({ text: node.options[i].text, index: i }))
      : [];
    const v: PocketView = { node, pose, greeting: pickupGreeting, warmth, choices, ended };
    return pocketScreen(companion, v);
  }

  // ── 重新渲染当前模式 ──
  function render(): void {
    ui.update(mode === 'desk' ? deskTree() : pocketTree(), theme);
  }

  // ── 进入 Pocket Mode（拿起设备）──
  function enterPocket(): void {
    const clock = readClock();
    pickupGreeting = greetOf(companion, clock, record).firstLine; // 见面第一句按缺席/时段派生
    input = new QueuedInputSource('p1');
    engine = new Engine({ tickRate: 30, input });
    engine.load(buildPocketBlueprint(companion, record.emotionTemp * 100));
    lastPocketNode = '';
    // 世界变化 → 节点切换时刷新 UI（避免逐 tick 重渲打断打字机）。
    engineUnsub = engine.subscribe(() => {
      const cur = engine!.world.getComponent<State>('dialogue', 'State')?.current ?? '';
      if (cur !== lastPocketNode) { lastPocketNode = cur; render(); }
    });
    engine.start();
    mode = 'pocket';
    remount();
  }

  // ── 退出 Pocket Mode（放回底座）：把暖意 + 互动写回关系记录（跨会话持久）──────────
  function dock(): void {
    if (engine) {
      const warmth = engine.world.getComponent<Resource>(R_WARMTH, 'Resource')?.current ?? 0;
      const now = readClock().nowMs;
      record = {
        lastSeenMs: now,
        firstMetMs: record.firstMetMs || now, // 第一次互动 = 纪念日起点
        emotionTemp: Math.min(1, warmth / 100), // 本次互动累积的暖意写回温度
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

  // 模式切换需要换 sink（pocket 的 dialogue 信号要进 pocket input）→ 重挂。
  function remount(): void {
    ui();
    ui = mountUI(root, mode === 'desk' ? deskTree() : pocketTree(), handlers(), theme, input ?? undefined);
  }

  // ── 动作信号处理（mode/dev 在本地 handler；dialogue.* 无 handler → 走 sink 入队由引擎消费）──
  function handlers(): HandlerMap {
    return {
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

  // ── Desk Mode 心跳：每 20s 刷新一帧（时刻/场景/缺席随真实时间推进）──────────────
  const heartbeat = globalThis.setInterval(() => { if (mode === 'desk') render(); }, 20_000);

  return () => {
    globalThis.clearInterval(heartbeat);
    teardownEngine();
    ui();
    root.remove();
  };
}

// 兼容旧动态 import 习惯：默认导出 mount。
export default { mount };
// 占位引用，避免未使用告警（companionById 供测试/外部按 id 取角色）。
export const _api = { companionById };
