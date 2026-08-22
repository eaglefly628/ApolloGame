// scripts/webgl-batch-bench.mjs —— WebGL2 批渲吞吐台账（REQ-3D-RENDER-EFFICIENCY 增量②·原型量化证据）
//
//  跑 `sprite-batch` 纯规划器（零浏览器·vite-node），对几种合成场景数「N 实体 → K 次 draw」，与 canvas2D
//  的「每实体一次提交」对照。证的不是「WebGL 一定更快」（那要真机 FPS·见 webgl-proto-shot 真机目击），而是
//  **提交次数的数量级差**——canvas2D 的 CPU 提交随实体线性涨，批渲让同纹理成片实体坍缩成个位数 draw。
//
//  用法：npx vite-node scripts/webgl-batch-bench.mjs
import { buildSpriteBatches } from '../src/renderer/webgl/sprite-batch.ts';

const base = { s: 1, e: 0, f: 0 };
const resolve = (key) => key.startsWith('tex')
  ? { texId: Number(key.slice(3)) || 0, u0: 0, v0: 0, uw: 1, vh: 1, sw: 32, sh: 32 } : null;

const rend = (p) => ({ entityId: 'e', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, zOrder: 0, ...p });

// 场景工厂
const scenes = {
  '1000 同纹理精灵（成群同类敌）': Array.from({ length: 1000 }, (_, i) => rend({ x: i, sprite: { textureKey: 'tex0' } })),
  '1000 实心方（灰盒原型）': Array.from({ length: 1000 }, (_, i) => rend({ x: i, shape: { kind: 'box', width: 8, height: 8 } })),
  '2000 实心圆（弹幕/宝石）': Array.from({ length: 2000 }, (_, i) => rend({ x: i, shape: { kind: 'circle', radius: 4 } })),
  '500 精灵×4 纹理交错（最坏游程）': Array.from({ length: 500 }, (_, i) => rend({ x: i, sprite: { textureKey: 'tex' + (i % 4) } })),
  '500 精灵×4 纹理连片（分层排布）': [
    ...Array.from({ length: 125 }, () => rend({ sprite: { textureKey: 'tex0' } })),
    ...Array.from({ length: 125 }, () => rend({ sprite: { textureKey: 'tex1' } })),
    ...Array.from({ length: 125 }, () => rend({ sprite: { textureKey: 'tex2' } })),
    ...Array.from({ length: 125 }, () => rend({ sprite: { textureKey: 'tex3' } })),
  ],
};

console.log('\n  WebGL2 批渲吞吐台账（sprite-batch 规划器·REQ-3D-RENDER-EFFICIENCY 增量②）\n');
console.log('  场景'.padEnd(38) + 'canvas2D 提交'.padStart(14) + 'webgl2 draw'.padStart(14) + '  降幅');
console.log('  ' + '─'.repeat(74));
let fail = 0;
for (const [name, rs] of Object.entries(scenes)) {
  const plan = buildSpriteBatches(rs, base, resolve);
  const canvasCalls = plan.instanceCount; // canvas2D = 每实例一次 drawImage/fillRect
  const ratio = plan.drawCalls > 0 ? (canvasCalls / plan.drawCalls) : 0;
  console.log('  ' + name.padEnd(36) + String(canvasCalls).padStart(14) + String(plan.drawCalls).padStart(14) + `  ${ratio.toFixed(0)}×`);
  if (plan.skipped > 0) { console.log(`      ⚠ skipped=${plan.skipped}`); fail++; }
}
console.log('  ' + '─'.repeat(74));
console.log('  注：draw = 批数（游程按相邻同纹理并·保画家序）。连片排布 → 少数几 draw；纹理交错 → 批多但画面永远正确。\n');
process.exit(fail ? 1 : 0);
