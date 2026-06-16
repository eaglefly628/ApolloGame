import type { Engine } from './engine.js';
import type { World } from '@engine/core/world.js';

// ═══════════════════════════════════════════════════════════════
//  全路径回归探针（Loop B）—— 无头、确定性的「点遍所有声明按钮」回归测试基建。
//
//  数据驱动游戏的红利：UI 是数据（GameShell UILayout），按钮可**枚举**（collectButtons →
//  signal 列表）；世界是确定的（world.hash）。于是「点遍所有按钮、断言无报错/无 NaN/可复现」
//  不靠脆弱的像素或 DOM 选择器，只靠数据遍历 + 引擎 tick。
//
//  本探针游戏无关：调用方提供 `makeEngine`（造一局干净世界）、`fire`（把一个信号投进输入总线）、
//  `signals`（要点的按钮信号集，通常来自 collectButtons(UILayout)）。
//  纯测试/工具，只读/驱动 world，不改引擎语义。
// ═══════════════════════════════════════════════════════════════

export interface SignalResult {
  signal: string;
  ok: boolean;
  error?: string; // tick 抛出的异常信息
  nonFinite?: string[]; // 点完后快照里出现的 NaN/Infinity 路径
}

export interface FullPathReport {
  perSignal: SignalResult[]; // ① 每个信号从干净起点单独点一次的结果（隔离冒烟）
  deterministic: boolean; // ② 整串顺序点两遍，逐步 hash 是否完全一致
  divergedAt?: { step: number; signal: string };
  finalHash?: string; // 顺序跑完的世界指纹（可作金值钉死跨提交回归）
  ok: boolean; // 全绿：所有信号 ok 且 deterministic
}

export interface ProbeOptions {
  ticksPerAction?: number; // 每点一个按钮后推进多少 tick 让效果结算（默认 8）
  warmup?: number; // makeEngine 之后再预热多少 tick（默认 0；通常 makeEngine 自带预热）
}

export type FireFn = (engine: Engine, signal: string) => void;

// 扫快照里所有非有限数（NaN / ±Infinity）—— 通用不变量。复用 world.snapshot()（全 POD），
// 递归走任意嵌套，**无逐组件代码**（同 determinism hash 的数据驱动思路）。返回 `entity.Comp.field=值` 路径。
export function scanNonFinite(world: World): string[] {
  const out: string[] = [];
  const snap = world.snapshot();
  for (const [eid, comps] of Object.entries(snap)) {
    for (const [type, comp] of Object.entries(comps)) walk(comp as unknown, `${eid}.${type}`, out);
  }
  return out;
}

function walk(v: unknown, path: string, out: string[]): void {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(`${path}=${v}`);
    return;
  }
  if (v === null || typeof v !== 'object') return;
  if (Array.isArray(v)) {
    v.forEach((x, i) => walk(x, `${path}[${i}]`, out));
    return;
  }
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) walk(val, `${path}.${k}`, out);
}

export function fullPathProbe(makeEngine: () => Engine, fire: FireFn, signals: string[], opts: ProbeOptions = {}): FullPathReport {
  const ticks = opts.ticksPerAction ?? 8;
  const warmup = opts.warmup ?? 0;

  // ① 隔离冒烟：每个信号都从一局干净（已预热）世界单独点一次 → 不抛错、无非有限数。
  const perSignal: SignalResult[] = [];
  for (const signal of signals) {
    const r: SignalResult = { signal, ok: true };
    try {
      const e = makeEngine();
      for (let i = 0; i < warmup; i++) e.world.tick();
      fire(e, signal);
      for (let i = 0; i < ticks; i++) e.world.tick();
      const nf = scanNonFinite(e.world);
      if (nf.length) {
        r.ok = false;
        r.nonFinite = nf;
      }
    } catch (err) {
      r.ok = false;
      r.error = err instanceof Error ? err.message : String(err);
    }
    perSignal.push(r);
  }

  // ② 顺序 + 确定性：整串信号在两局干净世界各点一遍，逐步比 hash（同输入必同态；发散=非确定性 bug）。
  let deterministic = true;
  let divergedAt: { step: number; signal: string } | undefined;
  let finalHash: string | undefined;
  try {
    const a = makeEngine();
    const b = makeEngine();
    for (let i = 0; i < warmup; i++) {
      a.world.tick();
      b.world.tick();
    }
    for (let s = 0; s < signals.length; s++) {
      fire(a, signals[s]);
      for (let i = 0; i < ticks; i++) a.world.tick();
      fire(b, signals[s]);
      for (let i = 0; i < ticks; i++) b.world.tick();
      if (a.hash() !== b.hash()) {
        deterministic = false;
        divergedAt = { step: s, signal: signals[s] };
        break;
      }
    }
    finalHash = a.hash();
  } catch {
    deterministic = false;
  }

  const ok = perSignal.every((r) => r.ok) && deterministic;
  return { perSignal, deterministic, divergedAt, finalHash, ok };
}
