import * as THREE from 'three';
import type { Camera3D } from '@engine/protocol/components.js';
import { orbitCamera, clampPitch, orthoFrustum, fitPerspective, type Bounds2D } from '../three-projection.js';

// ═══════════════════════════════════════════════════════════════
//  three/CameraRig —— 相机解释器（REQ-3D-Camera）。
//  铁律：游戏只填 `Camera3D` 语义参数（yaw/pitch/projection/fov/ortho/near/far/mode...），**渲染器算矩阵**。
//  持透视 + 正交两台相机，按 `Camera3D.projection` 选 active；fov/ortho/near/far 全从数据读（不写死）。
//  本类不读 world——`mode:'follow'` 的 target 实体位由渲染器解析成 center 传入（保持「解释器只算矩阵」纯净）。
// ═══════════════════════════════════════════════════════════════

export class CameraRig {
  private readonly persp: THREE.PerspectiveCamera;
  private readonly ortho: THREE.OrthographicCamera;
  current: THREE.Camera; // 当前激活相机（渲染 + 后处理用）

  constructor(fov: number, aspect: number) {
    this.persp = new THREE.PerspectiveCamera(fov, aspect, 0.1, 10000);
    this.persp.position.set(0, 0, 10);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
    this.current = this.persp;
  }

  // 盒庭模式：据 Camera3D 选投影 + 设 fov/ortho/near/far + 轨道位姿 + lookAt。center 已含 follow 解析。
  // radius=场景半径（正交 orthoSize 缺省据此）；defFov=渲染器构造默认 fov（数据没给时的 fallback）。
  applyOrbit(
    cam3d: Camera3D,
    center: { x: number; y: number; z: number },
    dist: number,
    aspect: number,
    radius: number,
    defFov: number,
    skyRadius: number,
  ): THREE.Camera {
    const near = cam3d.near ?? 1;
    const far = cam3d.far ?? dist + skyRadius + 200; // 缺省：刚好框住天空盒
    let cam: THREE.Camera;
    if ((cam3d.projection ?? 'perspective') === 'ortho') {
      const f = orthoFrustum(cam3d.orthoSize ?? radius * 1.15, aspect);
      this.ortho.left = f.left; this.ortho.right = f.right; this.ortho.top = f.top; this.ortho.bottom = f.bottom;
      this.ortho.near = near; this.ortho.far = far;
      this.ortho.updateProjectionMatrix();
      cam = this.ortho;
    } else {
      this.persp.fov = cam3d.fov ?? defFov;
      this.persp.aspect = aspect;
      this.persp.near = near; this.persp.far = far;
      this.persp.updateProjectionMatrix();
      cam = this.persp;
    }
    const pitch = clampPitch(cam3d.pitch, cam3d.pitchMin, cam3d.pitchMax);
    const p = orbitCamera(center, dist, cam3d.yaw, pitch);
    cam.position.set(p.x, p.y, p.z);
    cam.lookAt(center.x, center.y, center.z);
    this.current = cam;
    return cam;
  }

  // 无 Camera3D：原俯视自适配（透视·框住 2D 包围盒）。向后兼容 three-lab / game-i。
  applyFlat(bounds: Bounds2D, fov: number, aspect: number): THREE.Camera {
    const fit = fitPerspective(bounds, fov, aspect);
    this.persp.fov = fov;
    this.persp.aspect = aspect;
    this.persp.near = 0.1;
    this.persp.far = 10000;
    this.persp.updateProjectionMatrix();
    this.persp.position.set(fit.cx, fit.cy, fit.dist);
    this.persp.lookAt(fit.cx, fit.cy, 0);
    this.current = this.persp;
    return this.persp;
  }
}
