// Game Z 盒庭蓝图：纯数据（Transform3D + Mesh3D 体块 + 一个 Camera3D 单例），零专属 system。
// 验证「蓝图装进真 ECS → 收集成 renderable」的逻辑面；WebGL 看相由 ThreeRenderer 在浏览器做。
import { describe, it, expect } from 'vitest';
import { Engine } from '@runtime/engine.js';
import { dioramaBlueprint } from './diorama.js';
import { collectRenderables } from '@renderer/renderable.js';
import { getCamera3D, getSky3D, getLights3D, getPost3D } from '@engine/protocol/camera-view.js';
import type { Transform, Transform3D, Velocity, Mesh3D, Collider3D, Material3D } from '@engine/protocol/components.js';

describe('Game Z · 3D 盒庭蓝图（纯数据 · 仅现成 motion-apply 能力）', () => {
  it('只用现成能力（motion-apply + overlap-detect-3d + navmesh-bake + 主程 pathfind·无专属 system）', () => {
    const caps = dioramaBlueprint().capabilities;
    const names = caps.map((c) => c.describe.name).sort();
    expect(names).toEqual(['collision-resolve-3d', 'motion-apply', 'navmesh-bake', 'overlap-detect-3d', 'pathfind']);
  });

  it('追逐关卡：鸭子胶囊碰撞体 + 追兵(NavAgent·target=hero) + 障碍 box 碰撞体', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    expect(e.world.getComponent<Collider3D>('hero', 'Collider3D')!.kind).toBe('capsule');
    // 追兵循寻路追鸭子：NavAgent + Relation(target=hero)。
    expect(e.world.getComponent('seeker', 'NavAgent')).toBeTruthy();
    expect((e.world.getComponent('seeker', 'Relation') as { targetId?: string } | undefined)?.targetId).toBe('hero');
    // 障碍 box 碰撞体（碰撞 + 寻路双用·navmesh-bake 栅格化）。
    expect(e.world.getComponent<Collider3D>('rock-1', 'Collider3D')!.kind).toBe('box');
  });

  it('每个物件 = Transform3D + Mesh3D（盒庭体块即数据）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const t3 = e.world.getComponent<Transform3D>('ground', 'Transform3D')!;
    const m = e.world.getComponent<Mesh3D>('ground', 'Mesh3D')!;
    expect(m.shape).toBe('box');
    expect(typeof t3.y).toBe('number');
  });

  it('一个 Camera3D 单例 → 盒庭模式（轨道相机·俯角）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const cam = getCamera3D(e.world);
    expect(cam).not.toBeNull();
    expect(cam!.pitch).toBeGreaterThan(0);
    expect(cam!.distance).toBeGreaterThan(0);
  });

  it('collectRenderables 收齐盒庭体块（≥10 个带 transform3d+mesh3d；相机/天空盒不作体块）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const rs = collectRenderables(e.world);
    const blocks = rs.filter((r) => r.transform3d && r.mesh3d);
    expect(blocks.length).toBeGreaterThanOrEqual(10);
    expect(rs.find((r) => r.entityId === 'cam')).toBeUndefined(); // 相机无 Mesh3D/Transform → 不渲染为体块
    expect(rs.find((r) => r.entityId === 'sky')).toBeUndefined(); // 天空盒同理
  });

  it('天空盒 Sky3D 在场（带云）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    expect(getSky3D(e.world)?.clouds).toBe(true);
  });

  it('数据化光照：sun(directional·投影·曝光收敛) + fill(ambient) + 动态点光×2（TA Phase 2·预算内）；Post3D 暂移除', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const lights = getLights3D(e.world);
    expect(lights.map(([, l]) => l.kind).sort()).toEqual(['ambient', 'directional', 'point', 'point']);
    const sun = lights.find(([, l]) => l.kind === 'directional')?.[1];
    expect(sun?.castShadow).toBe(true);
    expect(sun?.intensity).toBeLessThanOrEqual(1.2); // 曝光收敛：太阳不过亮（owner「太亮·过曝」）
    expect(lights.filter(([, l]) => l.kind === 'point').length).toBeLessThanOrEqual(2); // 预算：≤2 盏动态局部光
    const post = getPost3D(e.world);
    expect(post?.ao).toBeTruthy(); // AO 环境光遮蔽（TA Phase 4）已开
    expect(post?.grade).toBeTruthy(); // 色彩分级（TA Phase 4）已开
    expect(post?.aa).toBe(true); // SMAA 抗锯齿（TA Phase 4）已开
    expect(post?.tiltShift).toBeFalsy(); // 移轴景深仍移除（owner「景深奇怪·先移掉」）
  });

  it('可控角色 hero：2D Transform + Velocity + Model3D 小黄鸭（无 transform3d·盒庭模式落地面）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const rs = collectRenderables(e.world);
    const hero = rs.find((r) => r.entityId === 'hero')!;
    expect(hero.model3d?.modelKey).toBe('fox'); // 骨骼动画狐狸（替原静态鸭·跑酷主角）
    expect(hero.transform3d).toBeUndefined(); // 走 2D Transform → groundPose 落地面
  });

  it('追逐关卡：三只追兵都 target=hero + 中心信标金属材质（gold PBR）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    for (const id of ['seeker', 'seeker-2', 'seeker-3']) {
      expect((e.world.getComponent(id, 'Relation') as { targetId?: string } | undefined)?.targetId).toBe('hero');
    }
    expect(e.world.getComponent<Material3D>('beacon', 'Material3D')!.preset).toBe('gold');
  });

  it('角色按 Velocity 走动（motion-apply 驱动·纯数据 sim）', () => {
    const e = new Engine();
    e.load(dioramaBlueprint());
    const v = e.world.getComponent<Velocity>('hero', 'Velocity')!;
    v.vx = 0.5; v.vy = 0.5; // 模拟键盘设速
    const x0 = e.world.getComponent<Transform>('hero', 'Transform')!.x;
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(e.world.getComponent<Transform>('hero', 'Transform')!.x).toBeGreaterThan(x0);
  });
});
