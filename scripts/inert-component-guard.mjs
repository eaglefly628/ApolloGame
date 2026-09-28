#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/inert-component-guard.mjs —— 惰性组件守卫的 **CLI 壳**（纯核见 inert-component-core.mjs）。
//
//  用法（须 vite-node·因要 import .ts 蓝图）：
//    npx vite-node scripts/inert-component-guard.mjs              # 全部有 buildBlueprint 的游戏
//    npx vite-node scripts/inert-component-guard.mjs game102 …    # 只查这几个
//  判词 `INERT-COMPONENT: PASS|FAIL`；退出码 0=过 · 1=有惰性组件**或空转** · 2=用法错。
//
//  壳里**无条件**跑 main（照 `system-graph-audit.mjs` 成例）——别再加任何「是不是入口」的判断：
//  vite-node 下那些判断恒不命中，症状是脚本一声不响什么都不跑而退出码 0
//  （施工中连踩两次·复盘全文在核文件头）。要纯函数请 import 核，不要 import 本文件。
// ═══════════════════════════════════════════════════════════════
import { join } from 'node:path';
import { ROOT, presentComponents, touchedComponents, inertOf, gamesWithBlueprint } from './inert-component-core.mjs';

async function main(argv) {
  const wanted = argv.filter((a) => !a.startsWith('--'));
  const all = gamesWithBlueprint();
  const games = wanted.length ? wanted.filter((g) => all.includes(g)) : all;
  if (wanted.length && games.length === 0) {
    console.error(`用法：npx vite-node scripts/inert-component-guard.mjs [game…]（有 blueprint.ts 的：${all.join(' ')}）`);
    return 2;
  }

  const bad = [];
  const skipped = [];
  for (const g of games) {
    let bp;
    try {
      // 直引 `.ts`：本文件是 .mjs，vite-node 不替它做 `.js→.ts` 扩展名改写（实测 .js 全数 Failed to load）。
      const mod = await import(join(ROOT, 'games', g, 'blueprint.ts'));
      const build = mod.buildBlueprint ?? mod.default;
      if (typeof build !== 'function') { skipped.push(`${g}（无 buildBlueprint 导出）`); continue; }
      bp = build();
    } catch (e) {
      skipped.push(`${g}（装载失败：${String(e?.message ?? e).slice(0, 60)}）`);
      continue;
    }
    const inert = inertOf(bp);
    const present = presentComponents(bp).size;
    const touched = touchedComponents(bp.capabilities).size;
    if (inert.length) {
      bad.push({ game: g, inert });
      console.log(`  ✗ ${g}：组件 ${present} 种 · 能力覆盖 ${touched} 种 · **惰性 ${inert.length}** → ${inert.join(' ')}`);
    } else {
      console.log(`  ✓ ${g}：组件 ${present} 种 · 能力覆盖 ${touched} 种 · 惰性 0`);
    }
  }

  // 跳过的照实报（覆盖面有洞就把洞说出来·别让"全绿"掩盖"没查"）
  if (skipped.length) console.log(`  · 跳过 ${skipped.length} 个：${skipped.join(' · ')}`);

  // ★ **空转不许绿**（施工中实撞·差点交出一个橡皮章）：第一版把 12 个游戏全装载失败当成「跳过」，
  // 于是判词是 `PASS（0 个游戏零惰性·12 个未覆盖）`——**一个都没真查，退出码还是 0**。
  // 守卫最坏的形态不是漏报，是永远绿。故：真查到的游戏数为 0 → 直接 FAIL。
  const checked = games.length - skipped.length;
  if (checked === 0) {
    console.error('\n✗ 一个游戏都没真查到（全部跳过）——守卫空转。空转 = 橡皮章，故判 FAIL 而非 PASS。');
    console.error('  多半是 import 解析或蓝图导出形态变了：先手跑一次看 skipped 里的原因。');
    console.error('\nINERT-COMPONENT: FAIL（空转·零覆盖）');
    return 1;
  }

  if (bad.length) {
    console.error('\n惰性组件 = 蓝图挂了它，但**没有任何已装能力**读/写/提供它 → 那段数据什么都不干，且零告警。');
    console.error('两条合法出路（二选一·别第三条）：');
    console.error('  ① 把对应能力加进该游戏蓝图的 `capabilities` 清单（多半就是漏装·先查 registry 实名）；');
    console.error('  ② 若该组件确由渲染器/宿主直接消费、本不经能力系统 → 加进本文件 `RENDER_ONLY_EXEMPT` 并写清谁消费它。');
    console.error('**别把组件删掉了事**——先弄清它本该由谁解释（game102 的 Tray 就是漏装能力，不是多余组件）。');
    console.error(`\nINERT-COMPONENT: FAIL（${bad.length} 个游戏有惰性组件）`);
    return 1;
  }
  console.log(`\nINERT-COMPONENT: PASS（${checked} 个游戏零惰性${skipped.length ? `·${skipped.length} 个未覆盖` : ''}）`);
  return 0;
}

main(process.argv.slice(2)).then((c) => process.exit(c));
