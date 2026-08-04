/*
 * Game 106 — 题库 / 画作库
 *
 * 所有题目图片都是用 Canvas 程序化绘制的，不依赖任何外部图片资源，
 * 因此整个游戏可以完全离线运行。
 *
 * 每个 draw(ctx) 都在「单位坐标系」中作画：画布已经被 ctx.scale(S, S)，
 * 所以 x / y / 半径 / 线宽 全部使用 0~1 之间的比例值。
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  /* ---------- 绘图原语（全部工作在 0~1 单位坐标系） ---------- */

  function bg(ctx, c1, c2) {
    var g = ctx.createLinearGradient(0, 0, 0.35, 1);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, 1);
  }

  function circ(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /**
   * 环形 / 挖洞：利用 nonzero 填充规则，两个反向缠绕的圆得到中空。
   * 注意第二个 arc 前必须 moveTo 另起子路径，否则 canvas 会从上一个
   * 子路径的终点连一条线过来，破坏缠绕数（月牙会退化成圆环）。
   */
  function ring(ctx, x, y, r, inner, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU, false);
    ctx.moveTo(x + inner, y);
    ctx.arc(x, y, inner, 0, TAU, true);
    ctx.fill();
  }

  /**
   * 月牙：外圆减去一个偏移的圆。
   * 这里不能用 ring 的双圆缠绕技巧 —— 月牙的切割圆必然会伸到外圆之外，
   * 那部分区域缠绕数是 -1，nonzero 规则照样会填充，结果退化成圆环。
   * 所以改用离屏画布 + destination-out 真正「打洞」。
   */
  function crescent(ctx, x, y, r, cx, cy, cr, c) {
    var m = ctx.getTransform ? ctx.getTransform().a : 512;
    var px = Math.max(64, Math.round(m));
    var t = document.createElement('canvas');
    t.width = px;
    t.height = px;
    var g = t.getContext('2d');
    g.scale(px, px);
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(cx, cy, cr, 0, TAU);
    g.fill();
    ctx.drawImage(t, 0, 0, 1, 1);   // ctx 已被缩放到单位坐标系
  }

  function ell(ctx, x, y, rx, ry, rot, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    ctx.fill();
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function box(ctx, x, y, w, h, r, c) {
    ctx.fillStyle = c;
    rr(ctx, x, y, w, h, r || 0);
    ctx.fill();
  }

  function poly(ctx, pts, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function line(ctx, pts, c, w, cap) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = cap || 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  function curve(ctx, x0, y0, cx, cy, x1, y1, c, w) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }

  function circleStroke(ctx, x, y, r, c, w) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
  }

  /** 顶部半圆穹顶（伞面 / 西瓜片） */
  function dome(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, TAU, false);
    ctx.closePath();
    ctx.fill();
  }

  function clipped(ctx, pathFn, drawFn) {
    ctx.save();
    ctx.beginPath();
    pathFn(ctx);
    ctx.clip();
    drawFn(ctx);
    ctx.restore();
  }

  function stars(ctx, list, c) {
    ctx.fillStyle = c;
    for (var i = 0; i < list.length; i++) {
      ctx.beginPath();
      ctx.arc(list[i][0], list[i][1], list[i][2], 0, TAU);
      ctx.fill();
    }
  }

  var NIGHT_STARS = [
    [0.12, 0.14, 0.011], [0.27, 0.08, 0.007], [0.83, 0.16, 0.012],
    [0.68, 0.09, 0.008], [0.9, 0.36, 0.009], [0.08, 0.4, 0.008],
    [0.19, 0.72, 0.009], [0.88, 0.68, 0.011], [0.36, 0.2, 0.006],
    [0.75, 0.83, 0.008], [0.06, 0.62, 0.006], [0.46, 0.09, 0.007]
  ];

  /* ---------- 题库 ---------- */

  var SUBJECTS = [
    /* ============ 食物 ============ */
    {
      id: 'apple', name: '苹果', cat: 'food',
      draw: function (ctx) {
        bg(ctx, '#fff6e2', '#ffd9a6');
        ell(ctx, 0.41, 0.60, 0.23, 0.25, 0, '#d93a34');
        ell(ctx, 0.59, 0.60, 0.23, 0.25, 0, '#e8483f');
        ell(ctx, 0.50, 0.64, 0.24, 0.22, 0, '#e2413a');
        ell(ctx, 0.35, 0.48, 0.06, 0.10, -0.5, 'rgba(255,255,255,0.38)');
        line(ctx, [[0.50, 0.40], [0.545, 0.24]], '#7a4a22', 0.035);
        ell(ctx, 0.62, 0.27, 0.10, 0.05, -0.45, '#3faf55');
        line(ctx, [[0.545, 0.27], [0.70, 0.25]], '#2e8a41', 0.008);
      }
    },
    {
      id: 'watermelon', name: '西瓜', cat: 'food',
      draw: function (ctx) {
        bg(ctx, '#e4f7ff', '#a9e2f7');
        dome(ctx, 0.5, 0.74, 0.40, '#2c8b3d');
        dome(ctx, 0.5, 0.74, 0.365, '#f2f7ee');
        dome(ctx, 0.5, 0.74, 0.325, '#e8384a');
        var seeds = [[0.34, 0.60], [0.50, 0.55], [0.66, 0.60], [0.42, 0.68], [0.58, 0.68], [0.50, 0.70]];
        for (var i = 0; i < seeds.length; i++) {
          ell(ctx, seeds[i][0], seeds[i][1], 0.022, 0.033, 0, '#231a12');
        }
      }
    },
    {
      id: 'icecream', name: '冰淇淋', cat: 'food',
      draw: function (ctx) {
        bg(ctx, '#fff0f7', '#ffcfe2');
        poly(ctx, [[0.35, 0.52], [0.65, 0.52], [0.5, 0.90]], '#d9994c');
        line(ctx, [[0.40, 0.62], [0.58, 0.58]], '#b57a35', 0.012);
        line(ctx, [[0.44, 0.73], [0.57, 0.69]], '#b57a35', 0.012);
        circ(ctx, 0.38, 0.47, 0.155, '#ff8fb1');
        circ(ctx, 0.62, 0.46, 0.155, '#7fdcc0');
        circ(ctx, 0.50, 0.33, 0.15, '#ffd96a');
        circ(ctx, 0.50, 0.19, 0.048, '#d9364a');
        line(ctx, [[0.50, 0.15], [0.55, 0.10]], '#3f7d3a', 0.014);
      }
    },
    {
      id: 'pizza', name: '披萨', cat: 'food',
      draw: function (ctx) {
        bg(ctx, '#fff8e6', '#ffdfa8');
        poly(ctx, [[0.5, 0.90], [0.15, 0.28], [0.85, 0.28]], '#f3c451');
        box(ctx, 0.13, 0.17, 0.74, 0.13, 0.06, '#d99a4c');
        var pep = [[0.38, 0.44, 0.055], [0.62, 0.42, 0.05], [0.50, 0.60, 0.052], [0.30, 0.35, 0.045], [0.70, 0.34, 0.045], [0.50, 0.40, 0.04]];
        for (var i = 0; i < pep.length; i++) circ(ctx, pep[i][0], pep[i][1], pep[i][2], '#cf3129');
        circ(ctx, 0.44, 0.52, 0.022, '#3f8f42');
        circ(ctx, 0.60, 0.54, 0.02, '#3f8f42');
      }
    },
    {
      id: 'burger', name: '汉堡', cat: 'food',
      draw: function (ctx) {
        bg(ctx, '#fff3d6', '#ffd5a0');
        ell(ctx, 0.5, 0.42, 0.31, 0.19, 0, '#e0a45c');
        var ses = [[0.40, 0.35], [0.52, 0.31], [0.63, 0.36], [0.46, 0.40], [0.58, 0.42]];
        for (var i = 0; i < ses.length; i++) ell(ctx, ses[i][0], ses[i][1], 0.022, 0.013, 0.2, '#fdf1dc');
        poly(ctx, [[0.17, 0.50], [0.83, 0.50], [0.79, 0.57], [0.68, 0.52], [0.56, 0.58], [0.44, 0.52], [0.32, 0.58], [0.21, 0.52]], '#4fae4b');
        box(ctx, 0.19, 0.55, 0.62, 0.055, 0.02, '#f6c93f');
        poly(ctx, [[0.24, 0.60], [0.34, 0.60], [0.30, 0.67]], '#f6c93f');
        poly(ctx, [[0.66, 0.60], [0.76, 0.60], [0.71, 0.67]], '#f6c93f');
        box(ctx, 0.17, 0.59, 0.66, 0.10, 0.04, '#6b3a1e');
        box(ctx, 0.19, 0.69, 0.62, 0.11, 0.05, '#dc9a52');
      }
    },

    /* ============ 动物 ============ */
    {
      id: 'cat', name: '猫', cat: 'animal',
      draw: function (ctx) {
        bg(ctx, '#fff5e8', '#ffdcb8');
        ell(ctx, 0.5, 0.76, 0.22, 0.17, 0, '#ef9027');
        poly(ctx, [[0.31, 0.36], [0.30, 0.16], [0.46, 0.27]], '#ef9027');
        poly(ctx, [[0.69, 0.36], [0.70, 0.16], [0.54, 0.27]], '#ef9027');
        poly(ctx, [[0.335, 0.33], [0.335, 0.21], [0.44, 0.28]], '#f7b6c2');
        poly(ctx, [[0.665, 0.33], [0.665, 0.21], [0.56, 0.28]], '#f7b6c2');
        circ(ctx, 0.5, 0.44, 0.21, '#f5a03a');
        line(ctx, [[0.36, 0.30], [0.42, 0.34]], '#c96f18', 0.02);
        line(ctx, [[0.64, 0.30], [0.58, 0.34]], '#c96f18', 0.02);
        line(ctx, [[0.50, 0.25], [0.50, 0.31]], '#c96f18', 0.02);
        ell(ctx, 0.42, 0.43, 0.045, 0.055, 0, '#ffffff');
        ell(ctx, 0.58, 0.43, 0.045, 0.055, 0, '#ffffff');
        ell(ctx, 0.42, 0.44, 0.021, 0.036, 0, '#22201e');
        ell(ctx, 0.58, 0.44, 0.021, 0.036, 0, '#22201e');
        poly(ctx, [[0.47, 0.52], [0.53, 0.52], [0.50, 0.56]], '#e05a72');
        line(ctx, [[0.50, 0.56], [0.50, 0.59]], '#7a4a22', 0.01);
        curve(ctx, 0.50, 0.59, 0.455, 0.615, 0.43, 0.585, '#7a4a22', 0.01);
        curve(ctx, 0.50, 0.59, 0.545, 0.615, 0.57, 0.585, '#7a4a22', 0.01);
        line(ctx, [[0.20, 0.46], [0.38, 0.50]], '#5b4636', 0.009);
        line(ctx, [[0.20, 0.54], [0.38, 0.55]], '#5b4636', 0.009);
        line(ctx, [[0.80, 0.46], [0.62, 0.50]], '#5b4636', 0.009);
        line(ctx, [[0.80, 0.54], [0.62, 0.55]], '#5b4636', 0.009);
        curve(ctx, 0.71, 0.80, 0.88, 0.78, 0.84, 0.62, '#ef9027', 0.055);
      }
    },
    {
      id: 'elephant', name: '大象', cat: 'animal',
      draw: function (ctx) {
        bg(ctx, '#eaf2ff', '#c2d7f2');
        box(ctx, 0.24, 0.68, 0.10, 0.19, 0.03, '#7d8a9c');
        box(ctx, 0.45, 0.68, 0.10, 0.19, 0.03, '#7d8a9c');
        ell(ctx, 0.40, 0.56, 0.27, 0.21, 0, '#95a2b4');
        ell(ctx, 0.68, 0.46, 0.19, 0.19, 0, '#9dabbd');
        ell(ctx, 0.575, 0.44, 0.13, 0.17, -0.25, '#7d8a9c');
        curve(ctx, 0.80, 0.52, 0.90, 0.70, 0.79, 0.83, '#9dabbd', 0.085);
        line(ctx, [[0.735, 0.60], [0.70, 0.71]], '#f4f0e6', 0.028);
        circ(ctx, 0.72, 0.41, 0.022, '#2b3340');
        curve(ctx, 0.14, 0.58, 0.05, 0.62, 0.09, 0.72, '#7d8a9c', 0.03);
      }
    },
    {
      id: 'giraffe', name: '长颈鹿', cat: 'animal',
      draw: function (ctx) {
        bg(ctx, '#effbe0', '#c9eba2');
        box(ctx, 0.16, 0.72, 0.07, 0.20, 0.02, '#e8b23c');
        box(ctx, 0.36, 0.72, 0.07, 0.20, 0.02, '#e8b23c');
        ell(ctx, 0.33, 0.66, 0.22, 0.14, 0, '#f2c34f');
        poly(ctx, [[0.44, 0.66], [0.57, 0.66], [0.66, 0.26], [0.54, 0.24]], '#f2c34f');
        ell(ctx, 0.68, 0.21, 0.115, 0.075, -0.18, '#f7cd63');
        ell(ctx, 0.775, 0.245, 0.045, 0.035, -0.15, '#c98a3d');
        line(ctx, [[0.63, 0.16], [0.615, 0.09]], '#8a5a24', 0.018);
        line(ctx, [[0.70, 0.15], [0.695, 0.08]], '#8a5a24', 0.018);
        circ(ctx, 0.615, 0.085, 0.024, '#8a5a24');
        circ(ctx, 0.695, 0.075, 0.024, '#8a5a24');
        circ(ctx, 0.70, 0.19, 0.018, '#2b2018');
        var spots = [[0.57, 0.35], [0.61, 0.47], [0.51, 0.42], [0.55, 0.56], [0.30, 0.62], [0.40, 0.68], [0.22, 0.68], [0.36, 0.58]];
        for (var i = 0; i < spots.length; i++) circ(ctx, spots[i][0], spots[i][1], 0.042, '#b5762c');
      }
    },
    {
      id: 'crab', name: '螃蟹', cat: 'animal',
      draw: function (ctx) {
        bg(ctx, '#e4f8ff', '#a3e0f2');
        for (var i = 0; i < 3; i++) {
          line(ctx, [[0.30, 0.60 + i * 0.06], [0.16, 0.66 + i * 0.08], [0.09, 0.60 + i * 0.09]], '#c93a26', 0.024);
          line(ctx, [[0.70, 0.60 + i * 0.06], [0.84, 0.66 + i * 0.08], [0.91, 0.60 + i * 0.09]], '#c93a26', 0.024);
        }
        ell(ctx, 0.5, 0.58, 0.25, 0.17, 0, '#e2452f');
        ell(ctx, 0.5, 0.53, 0.20, 0.09, 0, '#f2634a');
        line(ctx, [[0.30, 0.50], [0.19, 0.38]], '#d13d29', 0.028);
        line(ctx, [[0.70, 0.50], [0.81, 0.38]], '#d13d29', 0.028);
        ell(ctx, 0.145, 0.33, 0.095, 0.075, -0.5, '#e2452f');
        poly(ctx, [[0.145, 0.33], [0.04, 0.24], [0.10, 0.36]], '#f9d9d2');
        ell(ctx, 0.855, 0.33, 0.095, 0.075, 0.5, '#e2452f');
        poly(ctx, [[0.855, 0.33], [0.96, 0.24], [0.90, 0.36]], '#f9d9d2');
        line(ctx, [[0.43, 0.44], [0.42, 0.34]], '#c93a26', 0.018);
        line(ctx, [[0.57, 0.44], [0.58, 0.34]], '#c93a26', 0.018);
        circ(ctx, 0.42, 0.31, 0.043, '#ffffff');
        circ(ctx, 0.58, 0.31, 0.043, '#ffffff');
        circ(ctx, 0.425, 0.315, 0.021, '#20201e');
        circ(ctx, 0.575, 0.315, 0.021, '#20201e');
      }
    },
    {
      id: 'butterfly', name: '蝴蝶', cat: 'animal',
      draw: function (ctx) {
        bg(ctx, '#f6ecff', '#d5b6ff');
        ell(ctx, 0.29, 0.40, 0.18, 0.21, -0.32, '#7b4dd8');
        ell(ctx, 0.71, 0.40, 0.18, 0.21, 0.32, '#7b4dd8');
        ell(ctx, 0.33, 0.68, 0.14, 0.155, 0.30, '#ff8a3d');
        ell(ctx, 0.67, 0.68, 0.14, 0.155, -0.30, '#ff8a3d');
        circ(ctx, 0.27, 0.38, 0.048, '#ffe066');
        circ(ctx, 0.73, 0.38, 0.048, '#ffe066');
        circ(ctx, 0.31, 0.70, 0.032, '#fff1c2');
        circ(ctx, 0.69, 0.70, 0.032, '#fff1c2');
        ell(ctx, 0.5, 0.53, 0.032, 0.24, 0, '#2f2340');
        circ(ctx, 0.5, 0.29, 0.042, '#2f2340');
        curve(ctx, 0.49, 0.26, 0.42, 0.17, 0.38, 0.13, '#2f2340', 0.014);
        curve(ctx, 0.51, 0.26, 0.58, 0.17, 0.62, 0.13, '#2f2340', 0.014);
        circ(ctx, 0.38, 0.125, 0.018, '#2f2340');
        circ(ctx, 0.62, 0.125, 0.018, '#2f2340');
      }
    },
    {
      id: 'penguin', name: '企鹅', cat: 'animal',
      draw: function (ctx) {
        bg(ctx, '#e3f4ff', '#a8d8f5');
        ell(ctx, 0.31, 0.60, 0.09, 0.20, 0.22, '#1f2733');
        ell(ctx, 0.69, 0.60, 0.09, 0.20, -0.22, '#1f2733');
        ell(ctx, 0.42, 0.86, 0.10, 0.045, -0.1, '#f0932b');
        ell(ctx, 0.58, 0.86, 0.10, 0.045, 0.1, '#f0932b');
        ell(ctx, 0.5, 0.56, 0.24, 0.31, 0, '#1f2733');
        ell(ctx, 0.5, 0.62, 0.165, 0.245, 0, '#f7f7f2');
        circ(ctx, 0.5, 0.30, 0.185, '#1f2733');
        ell(ctx, 0.5, 0.36, 0.125, 0.11, 0, '#f7f7f2');
        circ(ctx, 0.435, 0.29, 0.038, '#f7f7f2');
        circ(ctx, 0.565, 0.29, 0.038, '#f7f7f2');
        circ(ctx, 0.44, 0.295, 0.019, '#16181d');
        circ(ctx, 0.56, 0.295, 0.019, '#16181d');
        poly(ctx, [[0.44, 0.365], [0.56, 0.365], [0.5, 0.44]], '#f0932b');
      }
    },
    {
      id: 'whale', name: '鲸鱼', cat: 'animal',
      draw: function (ctx) {
        bg(ctx, '#ddf1ff', '#8ecdf0');
        ell(ctx, 0.45, 0.58, 0.31, 0.185, 0, '#3c7fd0');
        poly(ctx, [[0.72, 0.58], [0.94, 0.40], [0.90, 0.60], [0.94, 0.78]], '#3c7fd0');
        ell(ctx, 0.44, 0.66, 0.25, 0.095, 0, '#dbe9f7');
        ell(ctx, 0.40, 0.60, 0.09, 0.055, 0.35, '#2f6cb4');
        circ(ctx, 0.24, 0.53, 0.022, '#16233a');
        curve(ctx, 0.17, 0.60, 0.21, 0.65, 0.27, 0.645, '#16233a', 0.012);
        line(ctx, [[0.33, 0.40], [0.33, 0.28]], '#bfe4ff', 0.028);
        circ(ctx, 0.29, 0.23, 0.045, '#d6efff');
        circ(ctx, 0.38, 0.20, 0.055, '#d6efff');
        circ(ctx, 0.335, 0.14, 0.042, '#d6efff');
      }
    },

    /* ============ 交通工具 ============ */
    {
      id: 'car', name: '汽车', cat: 'vehicle',
      draw: function (ctx) {
        bg(ctx, '#eef3fa', '#c6d5e8');
        poly(ctx, [[0.30, 0.52], [0.40, 0.30], [0.64, 0.30], [0.73, 0.52]], '#d63b2c');
        poly(ctx, [[0.345, 0.49], [0.42, 0.345], [0.495, 0.345], [0.495, 0.49]], '#8fd3f4');
        poly(ctx, [[0.525, 0.345], [0.615, 0.345], [0.685, 0.49], [0.525, 0.49]], '#8fd3f4');
        box(ctx, 0.11, 0.48, 0.78, 0.20, 0.07, '#e2402f');
        box(ctx, 0.11, 0.60, 0.78, 0.07, 0.03, '#b02b1f');
        circ(ctx, 0.29, 0.71, 0.105, '#22262e');
        circ(ctx, 0.71, 0.71, 0.105, '#22262e');
        circ(ctx, 0.29, 0.71, 0.048, '#c9ced8');
        circ(ctx, 0.71, 0.71, 0.048, '#c9ced8');
        ell(ctx, 0.885, 0.53, 0.035, 0.028, 0, '#ffe066');
        ell(ctx, 0.115, 0.53, 0.03, 0.026, 0, '#ff8080');
      }
    },
    {
      id: 'sailboat', name: '帆船', cat: 'vehicle',
      draw: function (ctx) {
        bg(ctx, '#e2f5ff', '#93d3f2');
        circ(ctx, 0.80, 0.18, 0.09, '#ffe27a');
        ctx.fillStyle = '#2f7fc4';
        ctx.fillRect(0, 0.76, 1, 0.24);
        line(ctx, [[0.50, 0.16], [0.50, 0.72]], '#6b4423', 0.018);
        poly(ctx, [[0.485, 0.18], [0.485, 0.68], [0.21, 0.68]], '#fbfbf6');
        poly(ctx, [[0.515, 0.24], [0.515, 0.68], [0.79, 0.68]], '#e2453d');
        poly(ctx, [[0.18, 0.70], [0.82, 0.70], [0.70, 0.82], [0.30, 0.82]], '#8b4a24');
        box(ctx, 0.18, 0.685, 0.64, 0.035, 0.015, '#5f3116');
        line(ctx, [[0.05, 0.88], [0.20, 0.85], [0.35, 0.88]], '#bfe6fa', 0.016);
        line(ctx, [[0.62, 0.90], [0.77, 0.87], [0.92, 0.90]], '#bfe6fa', 0.016);
      }
    },
    {
      id: 'rocket', name: '火箭', cat: 'vehicle',
      draw: function (ctx) {
        bg(ctx, '#131a3c', '#2c1a54');
        stars(ctx, NIGHT_STARS, '#f2f0ff');
        poly(ctx, [[0.5, 0.08], [0.63, 0.38], [0.37, 0.38]], '#e2453d');
        box(ctx, 0.37, 0.34, 0.26, 0.38, 0.03, '#f0f2f5');
        poly(ctx, [[0.37, 0.55], [0.22, 0.78], [0.37, 0.73]], '#e2453d');
        poly(ctx, [[0.63, 0.55], [0.78, 0.78], [0.63, 0.73]], '#e2453d');
        circ(ctx, 0.5, 0.47, 0.085, '#2e5a86');
        circ(ctx, 0.5, 0.47, 0.065, '#5ec8f2');
        box(ctx, 0.40, 0.66, 0.20, 0.06, 0.02, '#c3c8d1');
        poly(ctx, [[0.41, 0.72], [0.59, 0.72], [0.5, 0.94]], '#ff8c2a');
        poly(ctx, [[0.45, 0.72], [0.55, 0.72], [0.5, 0.87]], '#ffe066');
      }
    },
    {
      id: 'balloon', name: '热气球', cat: 'vehicle',
      draw: function (ctx) {
        bg(ctx, '#d2ebff', '#8fd0ff');
        ell(ctx, 0.17, 0.20, 0.10, 0.05, 0, 'rgba(255,255,255,0.75)');
        ell(ctx, 0.84, 0.32, 0.11, 0.055, 0, 'rgba(255,255,255,0.7)');
        clipped(ctx, function (c) {
          c.ellipse(0.5, 0.40, 0.24, 0.28, 0, 0, TAU);
        }, function (c) {
          c.fillStyle = '#e8443c';
          c.fillRect(0.2, 0.1, 0.6, 0.65);
          c.fillStyle = '#f7f3e8';
          c.fillRect(0.36, 0.1, 0.08, 0.65);
          c.fillRect(0.56, 0.1, 0.08, 0.65);
          c.fillStyle = '#2f7fc4';
          c.fillRect(0.44, 0.1, 0.12, 0.65);
        });
        poly(ctx, [[0.34, 0.60], [0.66, 0.60], [0.57, 0.71], [0.43, 0.71]], '#c9382f');
        line(ctx, [[0.44, 0.70], [0.44, 0.78]], '#6b4423', 0.011);
        line(ctx, [[0.56, 0.70], [0.56, 0.78]], '#6b4423', 0.011);
        box(ctx, 0.42, 0.76, 0.16, 0.12, 0.02, '#9a6534');
        box(ctx, 0.41, 0.755, 0.18, 0.03, 0.012, '#7a4a22');
      }
    },
    {
      id: 'bicycle', name: '自行车', cat: 'vehicle',
      draw: function (ctx) {
        bg(ctx, '#f0fff5', '#c4ecd2');
        circleStroke(ctx, 0.26, 0.66, 0.19, '#2b2b33', 0.034);
        circleStroke(ctx, 0.74, 0.66, 0.19, '#2b2b33', 0.034);
        circleStroke(ctx, 0.26, 0.66, 0.185, '#9aa2ad', 0.008);
        circleStroke(ctx, 0.74, 0.66, 0.185, '#9aa2ad', 0.008);
        line(ctx, [[0.26, 0.66], [0.44, 0.40], [0.63, 0.40], [0.50, 0.66], [0.26, 0.66]], '#e0453a', 0.028);
        line(ctx, [[0.63, 0.40], [0.74, 0.66]], '#e0453a', 0.028);
        line(ctx, [[0.44, 0.40], [0.415, 0.29]], '#e0453a', 0.024);
        box(ctx, 0.34, 0.255, 0.15, 0.045, 0.02, '#2b2b33');
        line(ctx, [[0.63, 0.40], [0.665, 0.28]], '#e0453a', 0.024);
        line(ctx, [[0.60, 0.255], [0.75, 0.255]], '#2b2b33', 0.022);
        circ(ctx, 0.50, 0.66, 0.038, '#2b2b33');
        circ(ctx, 0.50, 0.66, 0.016, '#c9ced8');
        line(ctx, [[0.50, 0.66], [0.56, 0.74]], '#2b2b33', 0.016);
      }
    },

    /* ============ 物件 ============ */
    {
      id: 'umbrella', name: '雨伞', cat: 'object',
      draw: function (ctx) {
        bg(ctx, '#e8f4ff', '#b3daf7');
        var drops = [[0.10, 0.20], [0.86, 0.28], [0.16, 0.62], [0.90, 0.66], [0.06, 0.44]];
        for (var i = 0; i < drops.length; i++) {
          line(ctx, [[drops[i][0], drops[i][1]], [drops[i][0] - 0.02, drops[i][1] + 0.07]], '#6fb8e8', 0.013);
        }
        line(ctx, [[0.50, 0.55], [0.50, 0.80]], '#5a3a1f', 0.026);
        curve(ctx, 0.50, 0.80, 0.50, 0.90, 0.40, 0.87, '#5a3a1f', 0.026);
        var canopy = function (c) {
          c.beginPath();
          c.arc(0.5, 0.55, 0.36, Math.PI, TAU, false);
          var x0 = 0.86;
          for (var k = 0; k < 4; k++) {
            var x1 = x0 - 0.18;
            c.quadraticCurveTo((x0 + x1) / 2, 0.47, x1, 0.55);
            x0 = x1;
          }
          c.closePath();
        };
        ctx.fillStyle = '#e2453d';
        canopy(ctx);
        ctx.fill();
        clipped(ctx, canopy, function (c) {
          c.fillStyle = '#fbfbf6';
          c.fillRect(0.32, 0.15, 0.11, 0.45);
          c.fillRect(0.57, 0.15, 0.11, 0.45);
          c.fillStyle = '#2f7fc4';
          c.fillRect(0.14, 0.15, 0.10, 0.45);
          c.fillRect(0.76, 0.15, 0.10, 0.45);
        });
        line(ctx, [[0.50, 0.19], [0.50, 0.12]], '#5a3a1f', 0.018);
      }
    },
    {
      id: 'bulb', name: '灯泡', cat: 'object',
      draw: function (ctx) {
        bg(ctx, '#232636', '#101220');
        var rays = [[0.5, 0.06], [0.20, 0.18], [0.80, 0.18], [0.11, 0.44], [0.89, 0.44]];
        for (var i = 0; i < rays.length; i++) {
          var dx = rays[i][0] - 0.5, dy = rays[i][1] - 0.44;
          line(ctx, [[0.5 + dx * 0.62, 0.44 + dy * 0.62], [rays[i][0], rays[i][1]]], '#f7d24a', 0.022);
        }
        circ(ctx, 0.5, 0.42, 0.215, '#ffd94a');
        circ(ctx, 0.5, 0.42, 0.175, '#ffe98c');
        ell(ctx, 0.42, 0.34, 0.05, 0.07, -0.5, 'rgba(255,255,255,0.55)');
        line(ctx, [[0.44, 0.50], [0.47, 0.42], [0.50, 0.50], [0.53, 0.42], [0.56, 0.50]], '#d97a1e', 0.014);
        box(ctx, 0.415, 0.58, 0.17, 0.08, 0.015, '#c9ced8');
        box(ctx, 0.425, 0.65, 0.15, 0.15, 0.02, '#98a0ac');
        line(ctx, [[0.425, 0.70], [0.575, 0.70]], '#6f7783', 0.014);
        line(ctx, [[0.425, 0.75], [0.575, 0.75]], '#6f7783', 0.014);
        box(ctx, 0.455, 0.79, 0.09, 0.05, 0.02, '#4c525c');
      }
    },
    {
      id: 'house', name: '房子', cat: 'object',
      draw: function (ctx) {
        bg(ctx, '#e2f1ff', '#a9d7f5');
        ctx.fillStyle = '#6fbf5f';
        ctx.fillRect(0, 0.82, 1, 0.18);
        box(ctx, 0.66, 0.16, 0.09, 0.16, 0.01, '#a6382c');
        poly(ctx, [[0.5, 0.14], [0.90, 0.46], [0.10, 0.46]], '#c0392b');
        poly(ctx, [[0.5, 0.20], [0.83, 0.46], [0.17, 0.46]], '#d2493a');
        box(ctx, 0.19, 0.45, 0.62, 0.38, 0.01, '#f5e6c8');
        box(ctx, 0.43, 0.60, 0.15, 0.23, 0.01, '#8b5a2b');
        circ(ctx, 0.555, 0.72, 0.015, '#ffd94a');
        box(ctx, 0.24, 0.53, 0.14, 0.14, 0.01, '#7ec8f0');
        line(ctx, [[0.31, 0.53], [0.31, 0.67]], '#f5e6c8', 0.014);
        line(ctx, [[0.24, 0.60], [0.38, 0.60]], '#f5e6c8', 0.014);
        box(ctx, 0.62, 0.53, 0.14, 0.14, 0.01, '#7ec8f0');
        line(ctx, [[0.69, 0.53], [0.69, 0.67]], '#f5e6c8', 0.014);
        line(ctx, [[0.62, 0.60], [0.76, 0.60]], '#f5e6c8', 0.014);
      }
    },
    {
      id: 'key', name: '钥匙', cat: 'object',
      draw: function (ctx) {
        bg(ctx, '#2c2740', '#161327');
        ring(ctx, 0.27, 0.50, 0.16, 0.075, '#e8b53a');
        box(ctx, 0.38, 0.455, 0.44, 0.09, 0.035, '#e8b53a');
        box(ctx, 0.60, 0.53, 0.065, 0.13, 0.02, '#e8b53a');
        box(ctx, 0.72, 0.53, 0.065, 0.16, 0.02, '#e8b53a');
        box(ctx, 0.38, 0.468, 0.44, 0.022, 0.01, '#f7d97e');
        circ(ctx, 0.27, 0.50, 0.075, '#161327');
      }
    },
    {
      id: 'guitar', name: '吉他', cat: 'object',
      draw: function (ctx) {
        bg(ctx, '#f9efdb', '#dfc79c');
        box(ctx, 0.455, 0.10, 0.09, 0.42, 0.01, '#5b3a1a');
        box(ctx, 0.425, 0.05, 0.15, 0.10, 0.02, '#3e2712');
        circ(ctx, 0.455, 0.08, 0.016, '#d9d2c2');
        circ(ctx, 0.545, 0.08, 0.016, '#d9d2c2');
        circ(ctx, 0.455, 0.12, 0.016, '#d9d2c2');
        circ(ctx, 0.545, 0.12, 0.016, '#d9d2c2');
        ell(ctx, 0.5, 0.72, 0.235, 0.19, 0, '#b5651d');
        ell(ctx, 0.5, 0.50, 0.175, 0.145, 0, '#b5651d');
        ell(ctx, 0.5, 0.61, 0.145, 0.10, 0, '#b5651d');
        ell(ctx, 0.5, 0.72, 0.195, 0.15, 0, '#c9782c');
        circ(ctx, 0.5, 0.60, 0.075, '#2b1d12');
        circleStroke(ctx, 0.5, 0.60, 0.088, '#8a4f18', 0.012);
        box(ctx, 0.41, 0.79, 0.18, 0.035, 0.012, '#3e2712');
        for (var i = 0; i < 4; i++) {
          var x = 0.464 + i * 0.024;
          line(ctx, [[x, 0.09], [x, 0.79]], '#efe6d2', 0.006);
        }
      }
    },
    {
      id: 'clock', name: '时钟', cat: 'object',
      draw: function (ctx) {
        bg(ctx, '#eef1f8', '#c5d0e6');
        circ(ctx, 0.29, 0.19, 0.10, '#2f3542');
        circ(ctx, 0.71, 0.19, 0.10, '#2f3542');
        line(ctx, [[0.26, 0.86], [0.20, 0.94]], '#2f3542', 0.04);
        line(ctx, [[0.74, 0.86], [0.80, 0.94]], '#2f3542', 0.04);
        circ(ctx, 0.5, 0.52, 0.355, '#2f3542');
        circ(ctx, 0.5, 0.52, 0.30, '#fbfbf6');
        for (var i = 0; i < 12; i++) {
          var a = i * TAU / 12 - Math.PI / 2;
          var big = i % 3 === 0;
          line(ctx, [
            [0.5 + Math.cos(a) * 0.26, 0.52 + Math.sin(a) * 0.26],
            [0.5 + Math.cos(a) * (big ? 0.215 : 0.235), 0.52 + Math.sin(a) * (big ? 0.215 : 0.235)]
          ], '#2f3542', big ? 0.022 : 0.012);
        }
        line(ctx, [[0.5, 0.52], [0.63, 0.40]], '#2f3542', 0.032);
        line(ctx, [[0.5, 0.52], [0.50, 0.29]], '#2f3542', 0.022);
        line(ctx, [[0.5, 0.52], [0.40, 0.66]], '#e2453d', 0.012);
        circ(ctx, 0.5, 0.52, 0.032, '#e2453d');
      }
    },

    /* ============ 自然 ============ */
    {
      id: 'sunflower', name: '向日葵', cat: 'nature',
      draw: function (ctx) {
        bg(ctx, '#dff0ff', '#a5daff');
        ctx.fillStyle = '#6fbf5f';
        ctx.fillRect(0, 0.90, 1, 0.10);
        line(ctx, [[0.5, 0.48], [0.5, 0.92]], '#3f8f43', 0.035);
        ell(ctx, 0.30, 0.68, 0.13, 0.065, -0.35, '#4faf57');
        ell(ctx, 0.70, 0.76, 0.12, 0.06, 0.35, '#4faf57');
        for (var i = 0; i < 12; i++) {
          var a = i * TAU / 12;
          ell(ctx, 0.5 + Math.cos(a) * 0.20, 0.40 + Math.sin(a) * 0.20, 0.105, 0.055, a, '#f4c020');
        }
        circ(ctx, 0.5, 0.40, 0.135, '#6b4423');
        circ(ctx, 0.5, 0.40, 0.105, '#8a5a2c');
        var d = [[0.47, 0.37], [0.53, 0.38], [0.50, 0.43], [0.45, 0.42], [0.55, 0.44]];
        for (var k = 0; k < d.length; k++) circ(ctx, d[k][0], d[k][1], 0.014, '#4f3018');
      }
    },
    {
      id: 'tree', name: '大树', cat: 'nature',
      draw: function (ctx) {
        bg(ctx, '#e2f5ff', '#b2e2f7');
        ctx.fillStyle = '#6fbf5f';
        ctx.fillRect(0, 0.84, 1, 0.16);
        box(ctx, 0.445, 0.50, 0.11, 0.38, 0.02, '#7a4a22');
        line(ctx, [[0.50, 0.62], [0.36, 0.52]], '#7a4a22', 0.03);
        line(ctx, [[0.50, 0.58], [0.64, 0.48]], '#7a4a22', 0.03);
        circ(ctx, 0.34, 0.44, 0.18, '#2f9e50');
        circ(ctx, 0.66, 0.44, 0.18, '#2f9e50');
        circ(ctx, 0.5, 0.29, 0.21, '#37b25c');
        circ(ctx, 0.5, 0.45, 0.19, '#38a856');
        circ(ctx, 0.40, 0.26, 0.08, '#4dc46e');
        circ(ctx, 0.62, 0.36, 0.07, '#4dc46e');
        circ(ctx, 0.30, 0.75, 0.03, '#e2453d');
        circ(ctx, 0.70, 0.79, 0.03, '#e2453d');
      }
    },
    {
      id: 'cactus', name: '仙人掌', cat: 'nature',
      draw: function (ctx) {
        bg(ctx, '#ffecc9', '#ffcd88');
        circ(ctx, 0.80, 0.18, 0.10, '#ffd25e');
        box(ctx, 0.28, 0.53, 0.13, 0.20, 0.05, '#3ea760');
        box(ctx, 0.28, 0.60, 0.20, 0.10, 0.04, '#3ea760');
        box(ctx, 0.59, 0.40, 0.13, 0.16, 0.05, '#3ea760');
        box(ctx, 0.52, 0.46, 0.20, 0.10, 0.04, '#3ea760');
        box(ctx, 0.42, 0.20, 0.16, 0.58, 0.07, '#48b96c');
        for (var i = 0; i < 5; i++) {
          var y = 0.28 + i * 0.11;
          line(ctx, [[0.455, y], [0.425, y - 0.02]], '#e8f7ea', 0.008);
          line(ctx, [[0.545, y], [0.575, y - 0.02]], '#e8f7ea', 0.008);
        }
        circ(ctx, 0.50, 0.18, 0.05, '#ff7aa8');
        circ(ctx, 0.50, 0.18, 0.024, '#ffd25e');
        poly(ctx, [[0.33, 0.74], [0.67, 0.74], [0.62, 0.92], [0.38, 0.92]], '#c8663a');
        box(ctx, 0.30, 0.71, 0.40, 0.07, 0.02, '#e07a48');
      }
    },
    {
      id: 'moon', name: '月亮', cat: 'nature',
      draw: function (ctx) {
        bg(ctx, '#0d1234', '#1d1b4d');
        stars(ctx, NIGHT_STARS, '#f4f2ff');
        // 外圆挖掉一个等大但偏移的圆 → 干净的月牙（lune）
        crescent(ctx, 0.45, 0.48, 0.30, 0.62, 0.39, 0.30, '#ffe08a');
        crescent(ctx, 0.45, 0.48, 0.27, 0.60, 0.40, 0.285, '#fff0bd');
        circ(ctx, 0.25, 0.50, 0.030, '#eccb70');
        circ(ctx, 0.30, 0.34, 0.019, '#eccb70');
        circ(ctx, 0.28, 0.64, 0.016, '#eccb70');
        line(ctx, [[0.78, 0.70], [0.86, 0.70]], '#f4f2ff', 0.012);
        line(ctx, [[0.82, 0.66], [0.82, 0.74]], '#f4f2ff', 0.012);
      }
    }
  ];

  var CAT_NAMES = {
    food: '食物', animal: '动物', vehicle: '交通工具', object: '物件', nature: '自然'
  };

  global.ARTWORK = { SUBJECTS: SUBJECTS, CAT_NAMES: CAT_NAMES };
})(window);
