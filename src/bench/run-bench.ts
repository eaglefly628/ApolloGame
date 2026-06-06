import { BENCH_GAMES } from './games.js';
import { benchBlueprint, BENCH_PASS_THRESHOLD, type BenchReport } from './apollo-bench.js';

// vite-node 在 node 下运行，process 存在；此处仅为 tsc 声明(本项目未装 @types/node)。
declare const process: { exit(code: number): never };

// ApolloBench CLI：跑全部游戏体检并打印表格；有不及格则退出码 1（可接 CI / apollo.py bench）。

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
process.exit(failed > 0 ? 1 : 0);
