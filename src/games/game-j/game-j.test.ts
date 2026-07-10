// Game J（内置纯数据三消）·manifest 级走查：解析零 error → 真输入路径交换消除 → 确定性双跑。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseManifest } from '../../assembly/manifest.js';
import { World } from '@engine/core/world.js';
import type { MatchBoard, Resource, InputQueue, Transform } from '@engine/protocol/components.js';

const raw = JSON.parse(readFileSync(join(__dirname, '../../../public/games/game-j/manifest.json'), 'utf8'));

function build(): World {
  const bp = parseManifest(raw) as { capabilities: Array<{ systems: unknown[] }>; entities: Record<string, Record<string, object>> };
  const w = new World();
  for (const cap of bp.capabilities) for (const s of cap.systems) w.addSystem(s as never);
  for (const [id, comps] of Object.entries(bp.entities)) {
    w.createEntity(id);
    for (const [cname, cdata] of Object.entries(comps)) w.addComponent(id, { type: cname, ...(JSON.parse(JSON.stringify(cdata)) as object) } as never);
  }
  w.createEntity('input');
  w.addComponent('input', { type: 'InputQueue', actions: [] } as InputQueue);
  return w;
}
const click = (w: World, eid: string): void => {
  const t = w.getComponent<Transform>(eid, 'Transform')!;
  w.addComponent('input', { type: 'InputQueue', actions: [{ source: 'pointer', x: t.x, y: t.y, phase: 'down' }] } as InputQueue);
  w.tick();
  w.addComponent('input', { type: 'InputQueue', actions: [] } as InputQueue);
};
const res = (w: World, id: string): number => { for (const [e] of w.query('Resource')) { const r = w.getComponent<Resource>(e, 'Resource')!; if (r.id === id) return r.current; } return -1; };

function playOneSwap(): { score: number; moves: number; cells: number[] } {
  const w = build();
  const board = () => w.getComponent<MatchBoard>('board', 'MatchBoard')!;
  const b = board(); const { cols, rows } = b;
  let pair: [number, number] | null = null;
  outer: for (let i = 0; i < cols * rows; i++) for (const j of [i + 1, i + cols]) {
    if (j >= cols * rows || (i % cols === cols - 1 && j === i + 1)) continue;
    const c = [...b.cells]; const t = c[i]; c[i] = c[j]; c[j] = t;
    let has3 = false;
    for (let r0 = 0; r0 < rows && !has3; r0++) for (let c0 = 0; c0 + 2 < cols; c0++) { const a = c[r0 * cols + c0]; if (a >= 0 && a === c[r0 * cols + c0 + 1] && a === c[r0 * cols + c0 + 2]) { has3 = true; break; } }
    for (let c0 = 0; c0 < cols && !has3; c0++) for (let r0 = 0; r0 + 2 < rows; r0++) { const a = c[r0 * cols + c0]; if (a >= 0 && a === c[(r0 + 1) * cols + c0] && a === c[(r0 + 2) * cols + c0]) { has3 = true; break; } }
    if (has3) { pair = [i, j]; break outer; }
  }
  expect(pair, '开局盘必须至少一步合法（preset 确定性搜索保证）').not.toBeNull();
  click(w, `cell-${pair![0]}`);
  click(w, `cell-${pair![1]}`);
  for (let i = 0; i < 400 && board().phase !== 'idle'; i++) w.tick();
  w.tick(); w.tick();
  return { score: res(w, 'score'), moves: res(w, 'moves'), cells: [...board().cells] };
}

describe('game-j Candy Kingdom（manifest 走查）', () => {
  it('manifest 解析零 error·出厂态=art: 详细引用（placeholder 真相·mock 永不写回）', () => {
    const bp = parseManifest(raw) as { errors?: unknown[] };
    expect(bp.errors ?? []).toHaveLength(0);
    expect(JSON.stringify(raw)).toContain('"art:'); // 真图生成前保持原始引用（owner 2026-07-10）
    expect(JSON.stringify(raw)).not.toContain('gen/art-'); // 不许任何 mock/生成物预钉进出厂 manifest
  });
  it('真输入路径：点两相邻格交换 → 消除得分·扣 1 步·盘面补满', () => {
    const r = playOneSwap();
    expect(r.score).toBeGreaterThan(0);
    expect(r.moves).toBe(19);
    expect(r.cells.includes(-1)).toBe(false);
  });
  it('确定性：同种子双跑逐字节一致', () => {
    expect(playOneSwap()).toEqual(playOneSwap());
  });
});
