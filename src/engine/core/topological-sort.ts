import type { SystemDeclaration, ComponentType } from './types.js';

export function topologicalSort(systems: SystemDeclaration[]): SystemDeclaration[] {
  const n = systems.length;
  const indexById = new Map<string, number>();
  systems.forEach((s, i) => indexById.set(s.id, i));

  // Build adjacency: if A writes X and B reads/consumes X → A before B
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
    const missing = systems
      .filter((_, i) => !sorted.includes(systems[i]))
      .map(s => s.id);
    throw new Error(`Circular dependency detected among systems: ${missing.join(', ')}`);
  }

  return sorted;
}
