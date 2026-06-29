// Game I · 3D 能力展台（消费 P3D 的 3D 渲染线·纯 game-i 蓝图·不改 three-renderer/game-z）
//
// 每个蓝图都是纯数据：放 Camera3D / Light3D / Sky3D / Post3D / Mesh3D / Transform3D / Collider3D /
// NavMesh / NavAgent 这些 **render-only + 3D 能力组件**，挂 ThreeRenderer 即活。逐个展 P3D 新能力：
//   光照阴影(Light3D) · 景深泛光(Post3D) · 3D 寻路(navmesh 自动烘焙) · 3D 碰撞(Collider3D/Overlap3D) · 3D 粒子(prefab→Mesh3D)。
// 边界：只消费 3D 数据接口，渲染器/组件/game-z 一概不碰（P3D 域）。缺口→记 requests-3d.md，不 hack。
// 注：蓝图组件值是无 `type` 判别符的字段对象（键=组件名·同 three-lab.ts 体例）。

import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import {
  transformCapability, velocityCapability, timerCapability, destroyCapability,
} from '@atom-skills/index.js';
import { tweenCapability, motionApplyCapability, lifetimeCapability } from '@skills/tier1/index.js';
import { eventWhenCapability, pathfindCapability } from '@skills/tier2/index.js';
import { casterCapability, prefabCapability } from '@skills/tier3/index.js';
import { overlapDetect3dCapability, navmeshBakeCapability } from '@skills/atoms/index.js';

type Ent = WorldBlueprint['entities'][string];
const TWO_PI = 6.28318;

// 静态盒（Transform3D 真 3D 定位 + Mesh3D 体）：x 右 / y 高(中心) / z 深。
function box(x: number, y: number, z: number, w: number, h: number, d: number, front: number, edge: number): Ent {
  return {
    Transform3D: { x, y, z },
    Mesh3D: { shape: 'box', width: w, height: h, depth: d, frontTint: front, backTint: front, edgeTint: edge },
  };
}

// 公共场景底：轨道相机 + 主光(投影)+ 环境光 + 天空 + 草地台。各蓝图在此之上加自己的演示物。
function sceneBase(): Record<string, Ent> {
  return {
    cam: { Camera3D: { yaw: 0.72, pitch: 0.62, distance: 96, pivotX: 0, pivotY: 4, pivotZ: 0, fov: 40, pitchMin: 0.12, pitchMax: 1.45 } },
    sun: { Light3D: { kind: 'directional', color: 0xfff1d6, intensity: 1.55, castShadow: true } },
    fill: { Light3D: { kind: 'ambient', color: 0xbfd2ff, intensity: 0.42 } },
    sky: { Sky3D: { top: 0x4a90d9, bottom: 0xcfe9f7, clouds: true, cloudTint: 0xffffff, scroll: 0.6 } },
    // 草地台：Mesh3D 的 edgeTint=「边+顶」色 → 顶面草绿、front=四周泥土侧（盒庭草坡观感）。
    ground: box(0, -2.5, 0, 78, 5, 78, 0x6d4c41, 0x7cb342),
  };
}

// ── ① 数据化光照 Light3D：定向主光投影 + 环境补光，盒阵 + 一只缓转金盒（各面随光明暗·光照是数据）。
export function light3dBlueprint(): WorldBlueprint {
  return {
    capabilities: [transformCapability, tweenCapability],
    entities: {
      ...sceneBase(),
      'pillar-a': box(-18, 6, -6, 8, 16, 8, 0x8d6e63, 0x5d4037),
      'pillar-b': box(16, 4, 8, 10, 12, 10, 0xa1887f, 0x6d4c41),
      'slab': box(0, 1, 18, 22, 2, 8, 0xb0bec5, 0x78909c),
      spinner: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Transform3D: { x: 0, y: 7, z: 0, rotY: 0 },
        Mesh3D: { shape: 'box', width: 12, height: 12, depth: 12, frontTint: 0xe7c96a, backTint: 0xe7c96a, edgeTint: 0xb8932f, flipAxis: 'y' },
        Tween: { target: 'Transform.rotation', from: 0, to: TWO_PI, elapsed: 0, duration: 200, easing: 'linear', done: false, loop: 'restart' },
      },
    },
  };
}

// ── ② 移轴景深 + 泛光 Post3D：同场景叠 EffectComposer——中段清晰、上下虚化(微缩盒庭感) + 亮处泛光。
export function post3dBlueprint(): WorldBlueprint {
  return {
    capabilities: [transformCapability, tweenCapability],
    entities: {
      ...sceneBase(),
      post: { Post3D: { tiltShift: { focus: 0.52, intensity: 3.6 }, bloom: { strength: 0.7, radius: 0.5, threshold: 0.72 } } },
      'c1': box(-22, 3, 4, 8, 8, 8, 0xff7043, 0xe64a19),
      'c2': box(-8, 5, -8, 8, 12, 8, 0x42a5f5, 0x1e88e5),
      'c3': box(8, 4, 6, 8, 10, 8, 0x66bb6a, 0x43a047),
      'c4': box(22, 6, -4, 8, 14, 8, 0xffca28, 0xffa000),
      glow: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Transform3D: { x: 0, y: 12, z: 0 },
        Mesh3D: { shape: 'box', width: 6, height: 6, depth: 6, frontTint: 0xfff6c0, backTint: 0xfff6c0, edgeTint: 0xffffff },
        Tween: { target: 'Transform3D.y', from: 10, to: 16, elapsed: 0, duration: 70, easing: 'easeInOut', done: false, loop: 'pingpong' },
      },
    },
  };
}

// ── ③ 3D 寻路 navmesh（REQ-3D-Nav 自动烘焙）：NavMesh 罩草地，障碍自动栅格化织图，追兵 NavAgent 绕障逼近巡逻目标。
//      相机 follow 目标（Camera3D follow 模式）。开 debug nav 看青图/黄路径。
export function nav3dBlueprint(): WorldBlueprint {
  const obstacle = (x: number, z: number, w: number, d: number, front: number, edge: number): Ent => ({
    Transform: { x, y: z, rotation: 0, scaleX: 1, scaleY: 1 }, // 2D：碰撞/烘焙 planar（x→X、y→Z）
    Transform3D: { x, y: 5, z },
    Mesh3D: { shape: 'box', width: w, height: 10, depth: d, frontTint: front, backTint: front, edgeTint: edge },
    Collider3D: { kind: 'box', halfX: w / 2, halfY: 5, halfZ: d / 2, baseY: 5 },
  });
  return {
    capabilities: [transformCapability, velocityCapability, tweenCapability, motionApplyCapability, navmeshBakeCapability, pathfindCapability],
    entities: {
      ...sceneBase(),
      cam: { Camera3D: { yaw: 0.7, pitch: 0.62, distance: 104, pivotY: 3, fov: 42, mode: 'follow', target: 'hero', pitchMin: 0.12, pitchMax: 1.45 } },
      nav: { NavMesh: { minX: -34, minZ: -34, maxX: 34, maxZ: 34, cellSize: 3, agentRadius: 2.6 } },
      'rock-1': obstacle(-12, -10, 6, 14, 0x9e9e9e, 0x616161),
      'rock-2': obstacle(2, 8, 16, 6, 0x9e9e9e, 0x616161),
      'rock-3': obstacle(16, -6, 6, 12, 0x9e9e9e, 0x616161),
      hero: {
        Transform: { x: -26, y: 24, rotation: 0, scaleX: 1, scaleY: 1 },
        Transform3D: { x: -26, y: 3, z: 24 },
        Mesh3D: { shape: 'box', width: 5, height: 6, depth: 5, frontTint: 0x26c6da, backTint: 0x26c6da, edgeTint: 0x00838f },
        Tween: { target: 'Transform.x', from: -26, to: 26, elapsed: 0, duration: 260, easing: 'easeInOut', done: false, loop: 'pingpong' },
      },
      'seeker-1': {
        Transform: { x: -28, y: -28, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Mesh3D: { shape: 'box', width: 4, height: 4, depth: 4, frontTint: 0xff7043, backTint: 0xff7043, edgeTint: 0xffab91 },
        NavAgent: { speed: 0.5, arriveRange: 7 },
        Relation: { kind: 'target', targetId: 'hero' },
      },
      'seeker-2': {
        Transform: { x: 28, y: -28, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Mesh3D: { shape: 'box', width: 4, height: 4, depth: 4, frontTint: 0xef5350, backTint: 0xef5350, edgeTint: 0xb71c1c },
        NavAgent: { speed: 0.42, arriveRange: 7 },
        Relation: { kind: 'target', targetId: 'hero' },
      },
    },
  };
}

// ── ④ 3D 碰撞 Collider3D/Overlap3D（REQ-3D-Collision）：两盒来回穿过中央触发区，overlap-detect-3d 每帧判交、产 Overlap3D。
//      开 debug colliders 看线框（实心黄 / 触发绿）。
export function collide3dBlueprint(): WorldBlueprint {
  return {
    capabilities: [transformCapability, velocityCapability, tweenCapability, motionApplyCapability, overlapDetect3dCapability],
    entities: {
      ...sceneBase(),
      zone: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Transform3D: { x: 0, y: 4, z: 0 },
        Mesh3D: { shape: 'box', width: 18, height: 8, depth: 18, frontTint: 0x33d17a, backTint: 0x33d17a, edgeTint: 0x2ec27e },
        Color: { tint: 0x33d17a, alpha: 0.35 },
        Collider3D: { kind: 'box', halfX: 9, halfY: 4, halfZ: 9, baseY: 4, trigger: true },
      },
      'mover-x': {
        Transform: { x: -30, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Transform3D: { x: -30, y: 4, z: 0 },
        Mesh3D: { shape: 'box', width: 6, height: 6, depth: 6, frontTint: 0xffa726, backTint: 0xffa726, edgeTint: 0xf57c00 },
        Collider3D: { kind: 'sphere', radius: 3.4, baseY: 4 },
        Tween: { target: 'Transform.x', from: -30, to: 30, elapsed: 0, duration: 150, easing: 'easeInOut', done: false, loop: 'pingpong' },
      },
      'mover-z': {
        Transform: { x: 0, y: -30, rotation: 0, scaleX: 1, scaleY: 1 },
        Transform3D: { x: 0, y: 4, z: -30 },
        Mesh3D: { shape: 'box', width: 6, height: 6, depth: 6, frontTint: 0x42a5f5, backTint: 0x42a5f5, edgeTint: 0x1565c0 },
        Collider3D: { kind: 'box', halfX: 3, halfY: 3, halfZ: 3, baseY: 4 },
        Tween: { target: 'Transform.y', from: -30, to: 30, elapsed: 0, duration: 190, easing: 'easeInOut', done: false, loop: 'pingpong' },
      },
    },
  };
}

// ── ⑤ 3D 粒子（prefab→Mesh3D·复用 2D 库B 套路·ThreeRenderer 渲染）：定时引爆一圈小盒火花，平面放射 + 寿命自毁；叠泛光发光。
//      说明：粒子走 2D motion-apply（planar）渲成 3D 小盒；体积运动(升空/重力)是 P3D 后续（设计取舍·非缺口）。
export function particle3dBlueprint(): WorldBlueprint {
  const RING = 10, LIFE = 52, SPEED = 0.55;
  const burst = (tint: number) => {
    const entities: Record<string, Ent> = {};
    for (let i = 0; i < RING; i++) {
      const a = (i / RING) * TWO_PI;
      entities[`p${i}`] = {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, angular: 0 },
        Transform3D: { x: 0, y: 5, z: 0 },
        Mesh3D: { shape: 'box', width: 2.2, height: 2.2, depth: 2.2, frontTint: tint, backTint: tint, edgeTint: 0xffffff },
        Timer: { id: 'life', elapsed: 0, duration: LIFE, loop: false },
      };
    }
    return { entities };
  };
  const detonator = (x: number, z: number, template: string, period: number, phase: number): Ent => {
    const sig = `boom_${template}`;
    return {
      Transform: { x, y: z, rotation: 0, scaleX: 1, scaleY: 1 },
      Timer: { id: 'boom', elapsed: phase, duration: period, loop: true },
      EventWhen: { signal: sig, when: { kind: 'timer', id: 'boom', cmp: 'gte', value: period - 1 }, mode: 'edge', armed: false },
      Caster: { onSignal: sig, template, at: 'self' },
    };
  };
  return {
    capabilities: [
      transformCapability, velocityCapability, timerCapability, destroyCapability, tweenCapability,
      eventWhenCapability, casterCapability, prefabCapability, motionApplyCapability, lifetimeCapability,
    ],
    entities: {
      ...sceneBase(),
      post: { Post3D: { bloom: { strength: 0.9, radius: 0.55, threshold: 0.6 } } },
      library: { PrefabLibrary: { templates: { 'boom-gold': burst(0xffd86b), 'boom-jade': burst(0x9cf0d0), 'boom-rose': burst(0xff9bb0) }, seq: 0 } },
      'det-l': detonator(-18, 0, 'boom-jade', 40, 0),
      'det-m': detonator(0, -4, 'boom-gold', 40, 13),
      'det-r': detonator(18, 0, 'boom-rose', 40, 26),
    },
  };
}
