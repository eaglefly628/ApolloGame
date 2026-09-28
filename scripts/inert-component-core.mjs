#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  scripts/inert-component-guard.mjs —— **惰性组件守卫**（owner 2026-09-28 令「引擎的问题需要改」）
//
//  治的病（2026-09-28 实撞·代价是一整轮排查）：蓝图可以挂一个组件，而它的能力**没被装进这个游戏的
//  `capabilities` 清单**——于是那个组件就静静地躺着什么都不做，**没有任何东西报警**。
//  实证：game102 的 `Tray` 组件挂上了、`theme.ts` 的几何早备好、`tray_<color>` 模板也在档，
//  唯独 `trayCapability` 不在清单里 → 「弹尽入槽」整条机制从来没接通，而所有门全绿。
//  我自己修那个 bug 时又原地踩了同一个坑：挂了 Tray、忘了装能力，跑出来毫无动静。
//
//  为什么现有守卫都挡不住：
//    · `component-manifest-guard` 管「全库组件名清单 vs 冻结基线」——不看谁装了什么能力。
//    · `system-graph-audit` 管**已注册能力之间**的定序/成环——不看某个游戏漏装了哪个能力。
//    · `manifest-check` 是卡带 manifest 的字段/引用校验——编译期游戏的 blueprint 不走它。
//    · `game-skill-audit` 是**纯 regex 静态扫描**（只读文本从不 import 游戏代码），
//      而本检查必须**真求值蓝图**（调 `buildBlueprint()`）→ 形态不同，故单列（照 system-graph-audit）。
//
//  判据（结构性·零时序·零墙钟）：
//    蓝图里出现过的组件类型名（entities + prefabs 模板内的 entities）
//    减 已装能力碰得到的（各能力 components 的 provides + reads + writes + consumes）
//    = **惰性组件**。非空即红。
//
//  本文件 = **纯核**（零 IO·零 import 游戏代码·可被单测直接喂对象）。CLI 壳在
//  `inert-component-guard.mjs`。**为什么拆**：壳要走 vite-node（import .ts 蓝图），而 vite-node
//  既不把脚本路径放进 argv、也让 `import.meta.url===file://argv[1]` 恒不命中；一度改用「没有
//  VITEST 环境变量就跑 main」绕过，结果单测 spawn 子进程时 VITEST 被继承 → 子进程里 main 又不跑了。
//  三次都是同一种病：**守卫在某些上下文里静默不动作**。拆成核/壳，这一类失效模式整体消失
//  （壳无条件跑 main·照 system-graph-audit.mjs 的成例）。
//
//  ⚠ **跳过要说出来**：6/12 个游戏不导出 `buildBlueprint`（入口形态不同），本守卫覆盖不到。
//  那部分照实打印「跳过 N 个」而不是假装全查了——这一轮的教训就是「静默」本身最贵。
// ═══════════════════════════════════════════════════════════════
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.ZEROCRAFT_INERT_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 豁免名单：**确认由渲染器/宿主直接消费、不经任何能力系统**的组件才许进这里。
 * 进这张表要写清「谁消费它」——空着就是把守卫关掉。目前实测 6 个游戏零惰性，故为空
 * （YAGNI：真出现合法例外时再加一条 + 理由，同棘轮基线纪律「显式改·diff 可见·须给理由」）。
 * @type {Record<string, string>} 组件名 → 豁免理由（谁消费它）
 */
export const RENDER_ONLY_EXEMPT = {};

/** 一层实体表 → 其中出现的组件类型名（键即组件名·蓝图的 POD 形状）。 */
export function componentsOfEntities(entities) {
  const out = new Set();
  for (const comps of Object.values(entities ?? {})) {
    for (const k of Object.keys(comps ?? {})) out.add(k);
  }
  return out;
}

/** 蓝图里出现过的全部组件名（entities + 每个 prefab 模板内的 entities）。 */
export function presentComponents(blueprint) {
  const out = componentsOfEntities(blueprint?.entities);
  for (const tpl of Object.values(blueprint?.prefabs ?? {})) {
    for (const k of componentsOfEntities(tpl?.entities)) out.add(k);
  }
  return out;
}

/** 已装能力碰得到的组件名（provides ∪ reads ∪ writes ∪ consumes）。 */
export function touchedComponents(capabilities) {
  const out = new Set();
  for (const cap of capabilities ?? []) {
    const c = cap?.components;
    for (const k of Object.keys(c?.provides ?? {})) out.add(k);
    for (const k of [...(c?.reads ?? []), ...(c?.writes ?? []), ...(c?.consumes ?? [])]) out.add(k);
  }
  return out;
}

/** 惰性组件（升序·全序·豁免名单已扣除）。 */
export function inertOf(blueprint, exempt = RENDER_ONLY_EXEMPT) {
  const touched = touchedComponents(blueprint?.capabilities);
  return [...presentComponents(blueprint)]
    .filter((k) => !touched.has(k) && !(k in exempt))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** 有 blueprint.ts 的游戏名（升序）。 */
export function gamesWithBlueprint(root = ROOT) {
  const dir = join(root, 'games');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((g) => existsSync(join(dir, g, 'blueprint.ts')))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

