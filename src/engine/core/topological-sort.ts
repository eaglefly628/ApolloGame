import type { SystemDeclaration, ComponentType } from './types.js';

// 系统定序：先按 phase 分桶（缺省 0=Update），phase 升序；桶内按组件依赖拓扑排序；
// 跨 phase 的顺序由 phase 号决定。这让纯组件拓扑无法表达的"读后改"管线成为可能——
// 例如 overlap-detect 读 Transform、collision-resolve 写 Transform，二者在组件图上
// 互为前驱会判成环；把 resolve 排到更后的 phase 即可显式定序，互不成环。
export function topologicalSort(systems: SystemDeclaration[]): SystemDeclaration[] {
  const phases = Array.from(new Set(systems.map((s) => s.phase ?? 0))).sort((a, b) => a - b);
  if (phases.length <= 1) return sortWithinPhase(systems); // 全缺省 → 与原行为完全一致

  const result: SystemDeclaration[] = [];
  for (const phase of phases) {
    result.push(...sortWithinPhase(systems.filter((s) => (s.phase ?? 0) === phase)));
  }
  return result;
}

// 单个阶段内的组件依赖拓扑排序（Kahn 算法）：A 写 X 且 B 读/consume X ⇒ A 在 B 前。
function sortWithinPhase(systems: SystemDeclaration[]): SystemDeclaration[] {
  const n = systems.length;

  const adj: Set<number>[] = Array.from({ length: n }, () => new Set());
  const inDegree = new Array(n).fill(0);

  const writersOf = new Map<ComponentType, number[]>();
  for (let i = 0; i < n; i++) {
    for (const w of systems[i].writes) {
      if (!writersOf.has(w)) writersOf.set(w, []);
      writersOf.get(w)!.push(i);
    }
  }

  for (let i = 0; i < n; i++) {
    const deps = new Set([...systems[i].reads, ...systems[i].consumes]);
    for (const dep of deps) {
      const writers = writersOf.get(dep);
      if (!writers) continue;
      for (const w of writers) {
        if (w !== i && !adj[w].has(i)) {
          adj[w].add(i);
          inDegree[i]++;
        }
      }
    }
  }

  // Kahn's algorithm
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  const sorted: SystemDeclaration[] = [];
  while (queue.length > 0) {
    const idx = queue.shift()!;
    sorted.push(systems[idx]);
    for (const neighbor of adj[idx]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== n) {
    const missing = systems.filter((_, i) => !sorted.includes(systems[i])).map((s) => s.id);
    throw new Error(`Circular dependency detected among systems: ${missing.join(', ')}`);
  }

  return sorted;
}
