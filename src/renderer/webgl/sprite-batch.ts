// ═══════════════════════════════════════════════════════════════
//  webgl/sprite-batch —— WebGL2 实例化批渲的**纯规划器**（REQ-3D-RENDER-EFFICIENCY 增量②·原型）。
//
//  增量①（canvas2D 去 save/restore）已把「每实体常数开销」压到最低，但 canvas2D 仍是**每实体一次
//  drawImage/fillRect** 的 CPU 提交——上千实体时提交次数本身成瓶颈（game-103 百敌实证）。增量②的解法＝
//  WebGL2 `drawArraysInstanced`：一次调用画一整批共纹理的四边形，N 个实体 → 少数几次 draw。
//
//  本文件是那套批渲的**算法核**（纯函数·零 WebGL·node 可单测）：把 `collectRenderables` 的结果规划成
//  「实例化批」——每批一个纹理 + 一段紧凑的逐实例属性数组（烤进的仿射 + UV 矩形 + 颜色 + 模式）。GL 胶水
//  （webgl-renderer.ts）只管把每批 upload + draw。**效率就活在这里**：批数 = draw call 数。
//
//  ⚠ z 序正确性：按**游程**（run-length）归批——只有**相邻**同纹理实例才并批，一旦纹理切换就起新批。
//  绝不做「全局按纹理分组」（那会打乱画家序·让重叠精灵穿帮）。同纹理成片的场景（成群同类敌）→ 长游程 →
//  批数少；纹理频繁交错的场景 → 批数多但**画面永远正确**。这是「对了再快」，不是「快了但错」。
//
//  数据驱动铁律：**零数据 / 零组件改动**——消费的还是 `Renderable`（纯数据），游戏照旧摆实体。批渲纯属
//  渲染器内部，绝不往数据里加 `batched:true` 之类渲染旗标（那是把渲染关切泄进数据·违 manifesto）。
// ═══════════════════════════════════════════════════════════════

import type { Renderable } from '../renderable.js';
import type { DeviceBase } from '../canvas-transform.js';
import { entityMatrix } from '../canvas-transform.js';
import { resolveRotation2D, spriteAnchorOffset } from '../renderable.js';

// 逐实例属性布局（Float32·STRIDE 个/实例·**行主序**便于直接绑成两个 vec3 GL 属性）：
//   [0..2]  仿射行 0 (a,c,e) —— device_x = a·u + c·v + e（单位四边形 (u,v)∈[0,1]² → 设备像素）
//   [3..5]  仿射行 1 (b,d,f) —— device_y = b·u + d·v + f（含 DPR×相机×实体×锚点尺寸·全烤进）
//   [6..9]  UV 矩形 u0,v0,uw,vh —— 纹理图集里的子矩形（0..1）；纯色形状用整白像素 UV
//   [10..13] 颜色 r,g,b,a（0..1）—— 精灵=tint 相乘·形状=填充色
//   [14]    模式 mode —— 0=纹理·1=实心方·2=实心圆（片元按 mode 决定采样/遮罩）
export const STRIDE = 15;

export const MODE_TEXTURED = 0;
export const MODE_BOX = 1;
export const MODE_CIRCLE = 2;

// 实心形状的「纹理」批号（不采样真纹理·用 1×1 白像素）。与真纹理 texId（≥0）区分。
export const WHITE_TEXID = -1;

// 纹理解析回调（GL 后端注入）：textureKey(+帧) → 图集里的 texId + UV 子矩形 + 源尺寸。null=未就绪。
export interface TexResolve {
  texId: number;      // 图集/纹理单元号（同号才并批）
  u0: number; v0: number; uw: number; vh: number; // 图集 UV 子矩形（0..1）
  sw: number; sh: number; // 源像素尺寸（决定四边形大小·同 canvas drawImage 原生尺寸语义）
}
export type TexResolver = (textureKey: string, frameIndex?: number) => TexResolve | null;

export interface InstanceBatch {
  texId: number;
  count: number;        // 本批实例数
  data: Float32Array;   // 长度 = count*STRIDE
}
export interface BatchPlan {
  batches: InstanceBatch[];
  instanceCount: number; // 并批前的实例总数（= 被画的可批实体数）
  drawCalls: number;     // = batches.length（核心指标：越少越好）
  skipped: number;       // 原型不支持而跳过的实体数（text/polygon/未就绪精灵）——绝不静默吞
}

const DEFAULT_TINT = 0xe2e8f0; // 无 Color 时的实心形状填充（同 canvas-renderer 缺省 '#e2e8f0'）

// 把「单位四边形→模型空间矩形 (dx,dy,sw,sh)」烤进实体仿射 → 单位四边形直接落到设备像素。
//  device = M·(dx+u·sw, dy+v·sh) 展开：列 a'=a·sw,b'=b·sw；c'=c·sh,d'=d·sh；平移 e'=a·dx+c·dy+e, f'=b·dx+d·dy+f。
export function bakeQuadAffine(
  m: readonly [number, number, number, number, number, number],
  dx: number, dy: number, sw: number, sh: number,
): [number, number, number, number, number, number] {
  const [a, b, c, d, e, f] = m;
  return [a * sw, b * sw, c * sh, d * sh, a * dx + c * dy + e, b * dx + d * dy + f];
}

// 规划实例化批（**单遍·游程归批**）。resolveTex 决定精灵能否被批（未就绪→跳过·不画占位·原型口径）。
export function buildSpriteBatches(
  renderables: Iterable<Renderable>,
  base: DeviceBase,
  resolveTex: TexResolver,
): BatchPlan {
  // 累积期用 number[]（切批不 new·末尾一次性落 Float32Array）；游程：texId 变则起新批（保画家序）。
  const acc: { texId: number; arr: number[] }[] = [];
  let cur: { texId: number; arr: number[] } | null = null;
  let instanceCount = 0;
  let skipped = 0;

  const emit = (texId: number, inst: readonly number[]): void => {
    if (cur === null || cur.texId !== texId) { cur = { texId, arr: [] }; acc.push(cur); }
    for (let i = 0; i < STRIDE; i++) cur.arr.push(inst[i]);
    instanceCount++;
  };

  for (const r of renderables) {
    if (r.text) { skipped++; continue; } // 文本走另一条路（字形不适合本原型的四边形批）——记数不静默吞
    const m = entityMatrix(base, r.x, r.y, resolveRotation2D(r), r.scaleX, r.scaleY);
    const tint = r.color ? (r.color.tint & 0xffffff) : DEFAULT_TINT;
    const cr = ((tint >> 16) & 0xff) / 255, cg = ((tint >> 8) & 0xff) / 255, cb = (tint & 0xff) / 255, ca = r.color?.alpha ?? 1;

    if (r.sprite) { // 优先精灵（就绪才批·同 chooseRenderMode 的 Sprite 盖 Shape 语义）
      const tex = resolveTex(r.sprite.textureKey, r.frame?.index);
      if (tex) {
        const { dx, dy } = spriteAnchorOffset(r.sprite, tex.sw, tex.sh);
        const A = bakeQuadAffine(m, dx, dy, tex.sw, tex.sh);
        emit(tex.texId, [A[0], A[2], A[4], A[1], A[3], A[5], tex.u0, tex.v0, tex.uw, tex.vh, cr, cg, cb, ca, MODE_TEXTURED]);
      } else {
        skipped++; // 有精灵但未就绪：原型跳过（占位方块是 canvas 后端的退化观感·非批渲关切）
      }
    } else if (r.shape?.kind === 'box') {
      const w = r.shape.width ?? 8, h = r.shape.height ?? 8;
      const A = bakeQuadAffine(m, -w / 2, -h / 2, w, h);
      emit(WHITE_TEXID, [A[0], A[2], A[4], A[1], A[3], A[5], 0, 0, 1, 1, cr, cg, cb, ca, MODE_BOX]);
    } else if (r.shape?.kind === 'circle') {
      const rad = r.shape.radius ?? 4;
      const A = bakeQuadAffine(m, -rad, -rad, rad * 2, rad * 2);
      emit(WHITE_TEXID, [A[0], A[2], A[4], A[1], A[3], A[5], 0, 0, 1, 1, cr, cg, cb, ca, MODE_CIRCLE]);
    } else {
      skipped++; // polygon / 无形状无精灵 → 原型不画（记数）
    }
  }

  const batches: InstanceBatch[] = acc.map((b) => ({
    texId: b.texId, count: b.arr.length / STRIDE, data: Float32Array.from(b.arr),
  }));
  return { batches, instanceCount, drawCalls: batches.length, skipped };
}
