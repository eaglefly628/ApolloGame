import React from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './runtime/engine.js';
import { PointerInputSource } from './net/index.js';
import type { IWorld } from '@engine/core/types.js';
import type { MatchBoard, BoardCell, Transform, Resource, Flag } from '@engine/protocol/components.js';
import {
  buildGameCBlueprint,
  BOARD_ENTITY, BOARD_W, CANVAS_H, BOARD_CELL,
  BTN_W, BTN_H, garmentButtonEntity,
} from './games/game-c/blueprint.js';
import { MATERIALS, GARMENTS, garmentFlagId } from './games/game-c/theme.js';
import { AtelierStage } from './games/game-c/ui/AtelierStage.js';

// Game C 卡带（launcher 槽契约：mount(container) → cleanup）。v0.3 可玩三消工坊。
// 棋盘/缝制全是数据装配的世界实体（match3-board + clickable + craft-recipe）；本文件只做表现层：
// 轻量画板把世界态画到 canvas + 指针输入，React 面板读世界态展示材料/换装/爱诗。无任何游戏规则代码。

const hex = (tint: number) => `#${(tint & 0xffffff).toString(16).padStart(6, '0')}`;
const resVal = (w: IWorld, id: string): number => {
  for (const [e] of w.query('Resource')) { const r = w.getComponent<Resource>(e, 'Resource'); if (r?.id === id) return r.current; }
  return 0;
};
const flagOn = (w: IWorld, id: string): boolean => {
  for (const [e] of w.query('Flag')) { const f = w.getComponent<Flag>(e, 'Flag'); if (f?.id === id) return f.active; }
  return false;
};
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(ctx: CanvasRenderingContext2D, engine: Engine) {
  const w = engine.world;
  ctx.clearRect(0, 0, BOARD_W, CANVAS_H);
  ctx.fillStyle = '#fff7fb';
  ctx.fillRect(0, 0, BOARD_W, CANVAS_H);

  const board = w.getComponent<MatchBoard>(BOARD_ENTITY, 'MatchBoard');
  if (!board) return;
  const sz = BOARD_CELL - 6;

  // 棋盘格（按逻辑 cells 上色；-1=空格淡显；选中描边）。
  for (const [eid] of w.query('BoardCell', 'Transform')) {
    const bc = w.getComponent<BoardCell>(eid, 'BoardCell')!;
    const t = w.getComponent<Transform>(eid, 'Transform')!;
    const kind = board.cells[bc.index];
    roundRect(ctx, t.x - sz / 2, t.y - sz / 2, sz, sz, 11);
    ctx.fillStyle = kind >= 0 ? hex(board.kindTint[kind]) : 'rgba(150,120,140,0.08)';
    ctx.fill();
    if (kind >= 0) { ctx.fillStyle = 'rgba(255,255,255,0.28)'; roundRect(ctx, t.x - sz / 2, t.y - sz / 2, sz, sz / 2.4, 11); ctx.fill(); }
    if (board.selIndex === bc.index) { ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff'; roundRect(ctx, t.x - sz / 2, t.y - sz / 2, sz, sz, 11); ctx.stroke(); }
  }

  // 缝制按钮（颜色随 已缝制 / 够料 / 缺料）。
  ctx.textAlign = 'center';
  GARMENTS.forEach((g) => {
    const t = w.getComponent<Transform>(garmentButtonEntity(g), 'Transform');
    if (!t) return;
    const unlocked = flagOn(w, garmentFlagId(g));
    const afford = g.requires.every((r) => resVal(w, r.material) >= r.amount);
    roundRect(ctx, t.x - BTN_W / 2, t.y - BTN_H / 2, BTN_W, BTN_H, 9);
    ctx.fillStyle = unlocked ? '#ffe3ef' : afford ? '#ff7aa2' : '#efe4ec';
    ctx.fill();
    ctx.fillStyle = unlocked ? '#b15c82' : afford ? '#ffffff' : '#b39bab';
    ctx.font = '700 12px "PingFang SC","Microsoft YaHei",system-ui';
    ctx.fillText(`${g.icon} ${g.name}${unlocked ? ' ✓' : ''}`, t.x, t.y - 3);
    ctx.font = '10px "PingFang SC",system-ui';
    const cost = unlocked ? '已入店' : g.requires.map((r) => `${MATERIALS.find((m) => m.id === r.material)!.glyph}${r.amount}`).join(' ');
    ctx.fillText(cost, t.x, t.y + 13);
  });
}

export function mount(container: HTMLElement): () => void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;display:flex;gap:16px;align-items:center;justify-content:center;padding:16px;' +
    'background:linear-gradient(160deg,#ffe9f1,#fdf6ff);box-sizing:border-box;overflow:auto;' +
    'font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif';

  const boardStage = document.createElement('div');
  boardStage.style.cssText =
    `flex:0 0 ${BOARD_W}px;border-radius:16px;overflow:hidden;box-shadow:0 12px 36px rgba(180,90,130,0.28);background:#fff7fb`;
  const canvas = document.createElement('canvas');
  canvas.width = BOARD_W;
  canvas.height = CANVAS_H;
  canvas.style.cssText = 'display:block;width:100%;height:auto;touch-action:none;cursor:pointer';
  boardStage.appendChild(canvas);

  const panel = document.createElement('div');
  panel.style.cssText = 'flex:0 1 auto';

  wrapper.appendChild(boardStage);
  wrapper.appendChild(panel);
  container.appendChild(wrapper);

  const ctx = canvas.getContext('2d')!;
  const pointer = new PointerInputSource('p1', canvas);
  const engine = new Engine({ tickRate: 60, input: pointer });
  engine.load(buildGameCBlueprint());
  const unsub = engine.subscribe(() => draw(ctx, engine)); // 每模拟帧后重绘
  draw(ctx, engine);
  engine.start();

  const root = createRoot(panel);
  root.render(<AtelierStage engine={engine} />);

  return () => {
    unsub();
    engine.stop();
    pointer.dispose();
    root.unmount();
    wrapper.remove();
  };
}
