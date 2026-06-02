import { Engine } from '../runtime/engine.js';
import { demoBlueprint } from './demo.assembly.js';
import type { Transform, Overlap } from '@engine/protocol/components.js';

// 无头运行演示蓝图，打印逐 tick 轨迹（npx vite-node src/assembly/demo.run.ts）。
const engine = new Engine();
engine.load(demoBlueprint);

console.log('系统拓扑顺序:', engine.world.getSortedSystems().map((s) => s.id).join(' → '));
console.log('tick | bullet.x | overlap | bullet alive');
for (let t = 1; t <= 13; t++) {
  engine.world.tick();
  const tr = engine.world.getComponent<Transform>('bullet', 'Transform');
  const overlaps = engine.world
    .query('Overlap')
    .map(([id]) => engine.world.getComponent<Overlap>(id, 'Overlap')!);
  const hit = overlaps.some((o) => o.entityA === 'bullet' || o.entityB === 'bullet');
  const alive = engine.world.getAllEntities().includes('bullet');
  const x = tr ? String(tr.x).padStart(3) : ' - ';
  console.log(`${String(t).padStart(4)} | x=${x}    | ${hit ? 'OVERLAP' : '   -   '} | ${alive ? 'yes' : 'NO'}`);
}
