import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { BENCH_GAMES } from './games.js';
import {
  benchBlueprint,
  BENCH_PASS_THRESHOLD,
  measureFrameTime,
  frameTimeDelta,
  type BenchReport,
  type FrameTimeStats,
  type FrameTimePrior,
} from './apollo-bench.js';

// vite-node 在 node 下运行，process 存在；此处仅为 tsc 声明。
declare const process: { exit(code: number): never };

// ApolloBench CLI：跑全部游戏体检并打印表格；有不及格则退出码 1（可接 CI / apollo.py bench）。
// 另跑「帧时轴」墙钟测量：p99/max 判定（均值绿尖峰红=CONCERNS·超标帧点名）+ 同场景 prior delta 回归行。
// 帧时是墙钟性能维度，与确定性 total/hash 完全分离，只报告不进分（永不改退出码——性能是告警非硬闸）。

// prior 存档落点（gitignore；墙钟按机器/运行波动，不入库）。
const PRIOR_PATH = 'bench-results/frame-times.json';

function bar(score: number, max: number): string {
  const n = Math.max(0, Math.min(10, Math.round((score / max) * 10)));
  return '█'.repeat(n) + '░'.repeat(10 - n);
}

function printReport(r: BenchReport): void {
  const tag = r.passed ? 'PASS' : 'FAIL';
  const kind = r.spatial ? '[空间]' : '[非空间]';
  console.log(`\n${tag}  ${r.game}  —  ${r.total}/100  ${kind}${r.evolves ? '' : ' [静态]'}`);
  for (const a of r.axes) {
    console.log(`  ${a.name.padEnd(12)} ${bar(a.score, a.max)} ${String(a.score).padStart(3)}/${a.max}`);
    for (const note of a.notes) console.log(`      · ${note}`);
  }
}

function loadPrior(): Record<string, FrameTimePrior> {
  try {
    return JSON.parse(readFileSync(PRIOR_PATH, 'utf8')) as Record<string, FrameTimePrior>;
  } catch {
    return {}; // 首跑无 prior：只报当前、不出 delta
  }
}

function savePrior(store: Record<string, FrameTimePrior>): void {
  try {
    mkdirSync(dirname(PRIOR_PATH), { recursive: true });
    writeFileSync(PRIOR_PATH, JSON.stringify(store, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.log(`  (prior 存档写入失败，跳过：${(err as Error).message})`);
  }
}

const ms = (v: number): string => `${v.toFixed(3)}ms`;

/** 帧时段：逐游戏墙钟测量 + p99/max 判定 + prior delta 回归行。返回是否有 CONCERNS（仅信息，不改退出码）。 */
function runFrameTime(): boolean {
  console.log('\n' + '═'.repeat(62));
  console.log(' 帧时轴 —— 墙钟性能（p99/max 判定 + prior delta 回归·不进确定分）');
  console.log('═'.repeat(62));
  const prior = loadPrior();
  const next: Record<string, FrameTimePrior> = {};
  let anyConcern = false;

  for (const g of BENCH_GAMES) {
    // warmup=8 甩掉 JIT/首帧分配冷启动，避免误判为尖峰。
    const s: FrameTimeStats = measureFrameTime(g.id, g.build, { warmup: 8 });
    const vtag = s.verdict === 'PASS' ? 'PASS ' : 'CONCERNS';
    if (s.verdict === 'CONCERNS') anyConcern = true;
    console.log(
      `\n${vtag}  ${g.id}  —  mean ${ms(s.meanMs)} · p99 ${ms(s.p99Ms)} · max ${ms(s.maxMs)}  (预算 ${ms(s.budgetMs)}/${s.ticks} 帧)`,
    );
    if (s.spikeFrames.length) {
      const named = s.spikeFrames.slice(0, 10).map((f) => `#${f.frame}(${ms(f.ms)})`).join(', ');
      console.log(`      超标帧点名: ${named}${s.spikeFrames.length > 10 ? ` …共 ${s.spikeFrames.length} 帧` : ''}`);
    }

    // delta 回归行（改善也记录）。
    const p = prior[g.id];
    if (p) {
      for (const d of frameTimeDelta(p, s)) {
        const arrow = d.direction === 'improved' ? '↓改善' : d.direction === 'regressed' ? '↑退化' : '≈持平';
        const priorMs = d.metric === 'mean' ? p.meanMs : d.metric === 'p99' ? p.p99Ms : p.maxMs;
        const sign = d.deltaMs >= 0 ? '+' : '';
        console.log(
          `      Δ${d.metric.padEnd(4)} ${arrow}  ${ms(priorMs)} → ${ms(d.currentMs)}  (${sign}${ms(d.deltaMs)} / ${sign}${(d.deltaPct * 100).toFixed(1)}%)`,
        );
      }
    } else {
      console.log('      (首跑无 prior：仅留档，下次出 delta)');
    }

    next[g.id] = {
      meanMs: s.meanMs,
      p99Ms: s.p99Ms,
      maxMs: s.maxMs,
      ticks: s.ticks,
      budgetMs: s.budgetMs,
      ts: new Date().toISOString(),
    };
  }

  savePrior(next);
  return anyConcern;
}

const reports = BENCH_GAMES.map((g) => benchBlueprint(g.id, g.build));
console.log('═'.repeat(62));
console.log(' ApolloBench —— 执行落地体检 (借鉴 OpenGame-Bench)');
console.log('═'.repeat(62));
let failed = 0;
for (const r of reports) {
  printReport(r);
  if (!r.passed) failed++;
}
const avg = Math.round(reports.reduce((s, r) => s + r.total, 0) / reports.length);
console.log('\n' + '─'.repeat(62));
console.log(` 平均 ${avg}/100 · 通过 ${reports.length - failed}/${reports.length} · 阈值 ${BENCH_PASS_THRESHOLD}`);

const concerns = runFrameTime();
console.log('\n' + '─'.repeat(62));
console.log(` 帧时判词: ${concerns ? 'CONCERNS（见上超标帧/退化行）' : 'PASS（无尖峰超预算）'}`);

// 退出码只由确定性体检打分决定（帧时是告警维度，不改退出码）。
process.exit(failed > 0 ? 1 : 0);
