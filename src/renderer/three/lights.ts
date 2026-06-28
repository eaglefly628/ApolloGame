import * as THREE from 'three';
import type { Light3D } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  three/LightRig —— 数据化光照子系统。持主阴影灯 + 环境补光 + 池管理的额外平行光。
//  Light3D 在场 → 数据全权定义；不在场 → 引擎默认暖主光 + 冷补光（向后兼容）。
//  红线：纯表现·不进 hash。lightSig 供渲染器脏标（灯变才需重渲/重算阴影）。
// ═══════════════════════════════════════════════════════════════

export class LightRig {
  readonly key: THREE.DirectionalLight; // 主方向光（盒庭投柔和阴影 + 每帧随场景定位）
  private readonly ambient: THREE.AmbientLight; // 环境补光
  private readonly extraLights = new Map<string, THREE.DirectionalLight>(); // 数据驱动的额外平行光（非阴影·池管理）
  shadowDir?: { x: number; y: number; z: number }; // 主阴影灯朝向提示（Light3D 给·缺省盒庭暖侧光向）
  lightSig = 'default'; // 灯光签名（供脏标）

  constructor(scene: THREE.Scene) {
    // 暖白主光（投柔和阴影·盒庭模式每帧随场景重定位）。
    this.key = new THREE.DirectionalLight(0xfff1d6, 1.5);
    this.key.position.set(2, 4, 6);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    scene.add(this.key);
    scene.add(this.key.target);
    // 环境补光压低（0.4）→ 让接触阴影看得见、对比出体积；过高会把影子洗掉。Light3D 在场时由数据覆盖。
    this.ambient = new THREE.AmbientLight(0xbfd2ff, 0.4);
    scene.add(this.ambient);
  }

  // 据 Light3D 数据驱动灯（首盏 castShadow 平行光=主阴影灯；其余平行光池管理；ambient 补亮）。无 → 引擎默认暖冷光。
  // dir 是「光的去向」→ 取反作主光位置方向（喂 placeShadow）。同时维护 lightSig。
  sync(scene: THREE.Scene, lights: ReadonlyArray<readonly [string, Light3D]>): void {
    this.lightSig = lights.length === 0 ? 'default'
      : lights.map(([id, l]) => `${id}:${l.kind}:${l.color}:${l.intensity}:${l.dirX ?? ''}:${l.dirY ?? ''}:${l.dirZ ?? ''}:${l.castShadow ?? ''}`).join('|');
    if (lights.length === 0) {
      this.key.color.setHex(0xfff1d6); this.key.intensity = 1.5;
      this.ambient.color.setHex(0xbfd2ff); this.ambient.intensity = 0.4;
      this.shadowDir = undefined; // 用盒庭默认侧光向
      for (const [id, l] of this.extraLights) { scene.remove(l); scene.remove(l.target); this.extraLights.delete(id); }
      return;
    }
    this.ambient.intensity = 0; // 数据驱动：默认无环境光（除非 data 给 ambient）
    this.shadowDir = undefined;
    let shadowAssigned = false;
    const live = new Set<string>();
    for (const [id, lt] of lights) {
      if (lt.kind === 'ambient') {
        this.ambient.color.setHex(lt.color & 0xffffff);
        this.ambient.intensity = lt.intensity;
        continue;
      }
      const go = (lt.dirX !== undefined || lt.dirY !== undefined || lt.dirZ !== undefined)
        ? { x: lt.dirX ?? -0.78, y: lt.dirY ?? -0.62, z: lt.dirZ ?? -0.5 }
        : { x: -0.78, y: -0.62, z: -0.5 };
      if (!shadowAssigned && (lt.castShadow ?? true)) {
        this.key.color.setHex(lt.color & 0xffffff);
        this.key.intensity = lt.intensity;
        this.shadowDir = { x: -go.x, y: -go.y, z: -go.z }; // 位置方向 = 去向取反
        shadowAssigned = true;
      } else {
        let l = this.extraLights.get(id);
        if (!l) { l = new THREE.DirectionalLight(); scene.add(l); scene.add(l.target); this.extraLights.set(id, l); }
        l.color.setHex(lt.color & 0xffffff);
        l.intensity = lt.intensity;
        l.position.set(-go.x * 100, -go.y * 100, -go.z * 100); // 沿去向反方向远置，照向原点
        l.target.position.set(0, 0, 0); l.target.updateMatrixWorld();
        live.add(id);
      }
    }
    for (const [id, l] of this.extraLights) if (!live.has(id)) { scene.remove(l); scene.remove(l.target); this.extraLights.delete(id); }
  }

  // 盒庭模式：主光摆到场景右上前方（暖侧光·按 shadowDir 或默认），阴影正交相机框住整个盒庭（半径 radius）。
  // 较低仰角（~34°）→ 接触阴影拉长、看得见体积（太高顶光阴影藏物体底下）。
  placeShadow(center: { x: number; y: number; z: number }, radius: number): void {
    const d = radius * 3.2;
    const u = this.shadowDir ?? { x: 0.78, y: 0.62, z: 0.5 };
    this.key.position.set(center.x + d * u.x, center.y + d * u.y, center.z + d * u.z);
    this.key.target.position.set(center.x, center.y, center.z);
    this.key.target.updateMatrixWorld();
    const cam = this.key.shadow.camera as THREE.OrthographicCamera;
    const r = radius * 2.6; // 视锥放宽到覆盖拉长的影子 + 更多地台
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 0.1; cam.far = d * 3.5;
    cam.updateProjectionMatrix();
  }

  dispose(scene: THREE.Scene): void {
    for (const [, l] of this.extraLights) { scene.remove(l); scene.remove(l.target); }
    this.extraLights.clear();
  }
}
