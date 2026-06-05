import { defineCapability } from '@engine/core/define-capability.js';
import type { Transform, Shape, Sprite, Signal, Camera, InputQueue, Clickable } from '@engine/protocol/components.js';
import { getCameraView, screenToWorld } from '@engine/protocol/camera-view.js';

// clickable —— 通用「可点击实体」：指针命中 → 配置好的 Signal（REQ-C-002，三游戏共需的输入→逻辑桥）。
//
// 每个想被点的实体挂 Clickable{action, phase?} + Transform + Shape。系统每 tick：
//   ① 读单例 InputQueue 的指针事件（屏幕坐标，由 runtime 按 tick 确定性注入）。
//   ② screenToWorld 逆投影（复用渲染器同一套相机参数；无相机则屏幕=世界）。
//   ③ 对所有 Clickable 实体做 AABB 命中，取**最上层**（zOrder 最大，并列取 id 最小→确定性）。
//   ④ 在命中实体上产出 Signal{name:action, source:命中实体}。
//
// 这样「点缝制按钮→Signal→craft-recipe 扣料」「点格子→Signal→match3 选中/交换」「点选项→Signal→对话推进」
// 全是纯数据接线，没有任何游戏写命中测试代码。下游照常 query('Signal') 按名消费。
//
// 信号生命周期：本系统每 tick 先清掉挂在 Clickable 实体上的旧 Signal，再按本帧命中重标（自包含、幂等）。
// 与 event-when 协作：event-when（Update 早段）会全局先清后标自己的 Signal，故 clickable 用 runsAfter
// 排在它之后，避免本帧新命中的 Signal 被 event-when 的全局清扫误删；effect-apply（Commit）随后一并消费。
//
// 确定性：只读 InputQueue + 几何比较（+/-/* 与大小比较），不碰浮点超越函数 → 单端录放一致。
// 相机是纯表现（排除出 hash），跨端指针一致性是已知待验证项（SESSION-HANDOFF §4），见 camera-view.ts。
export const clickableCapability = defineCapability({
  id: 't2-clickable',
  version: '1.0.0',

  describe: {
    name: 'clickable',
    summary: '指针命中挂 Clickable+Transform+Shape 的实体 → 在该实体上产出配置好的 Signal（命中→信号，AABB 取最上层）。',
    semantic: ['tier2', 'input', 'event'],
    whenToUse:
      '想让「点某个世界实体」产生一个信号而不写命中测试代码时。挂 Clickable{action,phase?}；下游 query Signal 按名消费（接 effect-apply / craft-recipe / match3 / 对话选项）。',
    examples: [
      '缝制按钮：Clickable{ action:"craft_apron" } → 点中发 Signal"craft_apron" → craft-recipe 扣料',
      '三消格子：Clickable{ action:"cell" } → 点中发 Signal"cell"（source=该格实体）→ match3 选中/交换',
      '抬起触发：Clickable{ action:"release", phase:"up" } → 仅指针抬起命中时发',
    ],
  },

  components: {
    provides: {
      Clickable: {
        category: 'config',
        describe: '声明「指针命中本实体 Shape 时产出 Signal{name:action}」。phase 指定触发相位（缺省 down）。',
        fields: {
          action: { type: 'string', describe: '命中时产出的 Signal.name' },
          phase: { type: 'string', describe: "触发的指针相位 'down'|'up'（缺省 'down'）" },
        },
      },
    },
    reads: ['Clickable', 'Transform', 'Shape', 'Sprite', 'InputQueue', 'Camera'],
    writes: ['Signal'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'clickable',
      // 与 event-when 同在 Update：排其后，使本帧命中的 Signal 不被 event-when 的全局清扫误删。
      runsAfter: ['event-when'],
      reads: ['Clickable', 'Transform', 'Shape', 'Sprite', 'InputQueue', 'Camera'],
      writes: ['Signal'],
      consumes: [],
      execute(world) {
        // ① 清掉上一帧挂在 Clickable 实体上的 Signal（自包含；event-when 在场时本步幂等）。
        for (const [eid] of world.query('Clickable', 'Signal')) world.removeComponent(eid, 'Signal');

        // ② 取单例 InputQueue。
        let queue: InputQueue | undefined;
        for (const [e] of world.query('InputQueue')) {
          queue = world.getComponent<InputQueue>(e, 'InputQueue');
          break;
        }
        if (!queue || queue.actions.length === 0) return;

        // ③ 相机逆投影参数（无相机则屏幕=世界）。视口尺寸取自 Camera 组件。
        const cam = getCameraView(world);
        let viewportW = 0;
        let viewportH = 0;
        for (const [e] of world.query('Camera')) {
          const c = world.getComponent<Camera>(e, 'Camera');
          if (c) {
            viewportW = c.viewportW;
            viewportH = c.viewportH;
          }
          break;
        }

        // ④ 预收集可点击实体（带 Transform + Shape）。
        const targets: Array<{ eid: string; t: Transform; s: Shape; z: number; click: Clickable }> = [];
        for (const [eid] of world.query('Clickable', 'Transform', 'Shape')) {
          const click = world.getComponent<Clickable>(eid, 'Clickable')!;
          const t = world.getComponent<Transform>(eid, 'Transform')!;
          const s = world.getComponent<Shape>(eid, 'Shape')!;
          const spr = world.getComponent<Sprite>(eid, 'Sprite');
          targets.push({ eid, t, s, z: spr?.zOrder ?? 0, click });
        }

        // ⑤ 逐个指针事件：逆投影 → 命中最上层 → 发 Signal。
        for (const ev of queue.actions) {
          if (ev.x === undefined || ev.y === undefined) continue;
          const phase = ev.phase ?? 'down';
          const wp = screenToWorld(ev.x, ev.y, cam, viewportW, viewportH);

          let best: (typeof targets)[number] | undefined;
          for (const tg of targets) {
            if (phase !== (tg.click.phase ?? 'down')) continue;
            const { hw, hh } = halfExtents(tg.t, tg.s);
            if (Math.abs(wp.x - tg.t.x) <= hw && Math.abs(wp.y - tg.t.y) <= hh) {
              if (!best || tg.z > best.z || (tg.z === best.z && tg.eid < best.eid)) best = tg;
            }
          }
          if (best) {
            world.addComponent(best.eid, { type: 'Signal', name: best.click.action, source: best.eid } as Signal);
          }
        }
      },
    },
  ],
});

// AABB 半宽/半高（含缩放）。box=width/height；circle=radius（轴对齐近似）；polygon=顶点包围盒。
function halfExtents(t: Transform, s: Shape): { hw: number; hh: number } {
  let hw = 0;
  let hh = 0;
  if (s.kind === 'box') {
    hw = (s.width ?? 0) / 2;
    hh = (s.height ?? 0) / 2;
  } else if (s.kind === 'circle') {
    hw = s.radius ?? 0;
    hh = hw;
  } else if (s.kind === 'polygon' && s.vertices) {
    for (let i = 0; i + 1 < s.vertices.length; i += 2) {
      hw = Math.max(hw, Math.abs(s.vertices[i]));
      hh = Math.max(hh, Math.abs(s.vertices[i + 1]));
    }
  }
  return { hw: hw * Math.abs(t.scaleX), hh: hh * Math.abs(t.scaleY) };
}
