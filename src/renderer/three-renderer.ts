import * as THREE from 'three';
import type { IWorld, RendererBackend } from '@engine/core/types.js';
import type { Mesh3D, Sky3D, Camera3D } from '@engine/protocol/components.js';
import type { AssetManager } from '@assets/index.js';
import { isImageHandle } from '@assets/index.js';
import { getCamera3D, getSky3D, getLights3D, getPost3D } from '@engine/protocol/camera-view.js';
import { collectRenderables, chooseRenderMode, type Renderable } from './renderable.js';
import {
  renderablePose, poseBounds, mesh3dBatchKey, type Pose3D,
  transform3dPose, groundPose, poseBounds3D, bounds3DCenter, bounds3DExtent, fitDistance3D,
} from './three-projection.js';
import { mesh3dPose, applyPose, buildMesh3D, buildGeometry, buildSkyTexture, disposeMesh } from './three/geometry.js';
import { hashPoses, camSig, postSig } from './three/stats.js';
import { LightRig } from './three/lights.js';
import { PostPipeline } from './three/post.js';
import { ModelPool } from './three/models.js';
import { InstancedBatches, type InstGroups } from './three/batches.js';
import { CameraRig } from './three/camera-rig.js';
import { ColliderDebug } from './three/collider-debug.js';
import { NavDebug } from './three/nav-debug.js';

export type { RenderStats } from './three/stats.js';
import type { RenderStats } from './three/stats.js';

// ═══════════════════════════════════════════════════════════════
//  ThreeRenderer —— 通用 3D 渲染后端（RendererBackend 的 Three.js 实现）的**编排核心**。
//  与 Canvas/Ascii 后端读同一份 `collectRenderables`：同一份数据、换渲染方法的 3D 一等后端。
//  本文件只做编排 + 2D-in-3D 扁平层；各子系统拆到 `./three/*`：
//    geometry（几何/材质/位姿工厂）· stats（profiler + 脏标签名）· lights（LightRig）·
//    post（PostPipeline）· models（ModelPool·glTF）· batches（InstancedBatches·W1-A 实例化）。
//
//  纯表现：只读 world、只写 three 对象，不写 sim、不进 hash。**刻意不进 `./index` barrel**（静态 import three，
//  避免 2D 消费者连带打包）——需要 3D 的入口直接 import 本文件，进各自的 3D code-split chunk。
// ═══════════════════════════════════════════════════════════════

const SKY_RADIUS = 2000; // 天空盒大球半径（相机 far 据此收紧）

export interface ThreeRendererOptions {
  width?: number;
  height?: number;
  background?: number; // 0xRRGGBB
  fov?: number;
  zStep?: number; // zOrder → z 深度步长
  assets?: AssetManager; // 提供则 sprite 画真实贴图，否则占位
}

export class ThreeRenderer implements RendererBackend {
  private scene!: THREE.Scene;
  private gl!: THREE.WebGLRenderer;
  private frame = 0; // 帧计数（render-only·云飘等表现动画用·不进 hash）
  // 子系统
  private cameras!: CameraRig; // 相机解释器（透视/正交·REQ-3D-Camera）
  private lights!: LightRig;
  private post!: PostPipeline;
  private models!: ModelPool;
  private readonly batches = new InstancedBatches();
  private readonly colliderDebug = new ColliderDebug(); // 碰撞体线框（debug·开关见 setDebugColliders）
  private debugColliders = false;
  private readonly navDebug = new NavDebug(); // 导航图/路径（debug·开关见 setDebugNav）
  private debugNav = false;
  // 天空盒
  private sky: THREE.Mesh | null = null;
  private skySig = '';
  // 2D-in-3D 扁平层（sprite/text/shape + 透明 Mesh3D fallback）
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly modeOf = new Map<string, string>();
  private readonly texCache = new Map<string, THREE.Texture>();
  private readonly textSig = new Map<string, string>();
  // W1-C 脏标跳渲 + profiler
  private cpuMs = 0;
  private rendered = false;
  private lastRenderSig = '';
  private lastShadowSig = '';
  private readonly width: number;
  private readonly height: number;
  private readonly background: number;
  private readonly fov: number;
  private readonly zStep: number;
  private readonly assets?: AssetManager;

  constructor(opts: ThreeRendererOptions = {}) {
    this.width = opts.width ?? 640;
    this.height = opts.height ?? 400;
    this.background = opts.background ?? 0x0a0a14;
    this.fov = opts.fov ?? 50;
    this.zStep = opts.zStep ?? 0.01;
    this.assets = opts.assets;
  }

  init(container: HTMLElement): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.background);
    this.cameras = new CameraRig(this.fov, this.width / this.height); // 透视 + 正交两台·按 Camera3D 选
    this.lights = new LightRig(this.scene); // 暖白主光（投软影）+ 冷蓝补光（Light3D 在场则数据驱动）
    this.gl = new THREE.WebGLRenderer({ antialias: true });
    this.gl.setSize(this.width, this.height);
    this.gl.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2)); // W1-D：retina 不糊·上限 2 防超采样
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; // W1-D：PBR 通透不削顶（天空盒材质 toneMapped:false 保色）
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap; // 软阴影（PCFSoft 在本 three 版已弃用→回退此档）
    this.gl.shadowMap.autoUpdate = false; // W1-C：阴影按需重算（仅投影体/灯变时置 needsUpdate）
    this.gl.info.autoReset = false; // W1-C/profiler：手动重置 → draw 计数跨全 pass 累加
    this.post = new PostPipeline(this.gl, this.width, this.height);
    this.models = new ModelPool(this.assets);
    container.appendChild(this.gl.domElement);
  }

  sync(world: IWorld): void {
    const t0 = performance.now();
    this.gl.info.reset(); // 手动重置 → calls/triangles 跨 scene+post 全 pass 累加（真·每帧 draw 数）
    const seen = new Set<string>();
    const poses: Pose3D[] = [];
    const instGroups: InstGroups = new Map(); // W1-A：不透明 Mesh3D 按视觉签名分批
    this.frame++;
    const cam3d = getCamera3D(world); // 盒庭模式开关（在场=轨道相机 + 2D 实体落地面 + 柔和阴影）
    const followTarget = cam3d?.mode === 'follow' ? cam3d.target : undefined; // mode:'follow' 注视的实体
    let followPose: Pose3D | undefined; // 收集期捕获 target 的位姿（= 相机注视点）
    const sky = getSky3D(world);
    this.syncSky(sky);
    this.lights.sync(this.scene, getLights3D(world)); // 数据化光照（维护 lightSig 供脏标）

    for (const r of collectRenderables(world)) {
      // 导入式 glTF 模型（Model3D）：圆润真模型。位姿与 Mesh3D 同套路。未就绪本帧不画（向后兼容）。
      if (r.model3d) {
        const obj = this.models.ensure(this.scene, r.entityId, r.model3d);
        if (obj) {
          const ms = r.model3d.scale ?? 1;
          let pose: Pose3D;
          if (r.transform3d || cam3d) {
            pose = r.transform3d ? transform3dPose(r.transform3d) : groundPose(r, 0);
            obj.position.set(pose.x, pose.y, pose.z);
            obj.rotation.set(pose.rx ?? 0, pose.ry ?? 0, pose.rotZ);
            obj.scale.set(pose.sx * ms, pose.sy * ms, (pose.sz ?? 1) * ms);
          } else {
            pose = renderablePose(r, this.zStep);
            obj.position.set(pose.x, pose.y, pose.z);
            obj.rotation.set(0, 0, pose.rotZ);
            obj.scale.set(pose.sx * ms, pose.sy * ms, ms);
          }
          if (r.model3d.tint !== undefined) this.models.tint(r.entityId, r.model3d.tint);
          seen.add(r.entityId);
          poses.push(pose);
          if (r.entityId === followTarget) followPose = pose;
        }
        continue;
      }
      // 3D 物件（Mesh3D）：不透明按视觉签名归批（W1-A 实例化）；透明(alpha<1)走单 mesh fallback。
      if (r.mesh3d) {
        const pose = mesh3dPose(r, r.mesh3d, cam3d, this.zStep);
        poses.push(pose);
        seen.add(r.entityId);
        if (r.entityId === followTarget) followPose = pose;
        if ((r.color?.alpha ?? 1) >= 1) {
          const key = mesh3dBatchKey(r.mesh3d);
          let g = instGroups.get(key);
          if (!g) { g = []; instGroups.set(key, g); }
          g.push({ r, pose });
        } else {
          const mesh = this.ensureMesh3D(r, r.mesh3d);
          applyPose(mesh, pose);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.paintMesh3D(mesh, r.mesh3d, r.color?.alpha ?? 1);
        }
        continue;
      }
      // 2D 扁平层（sprite/text/shape）。
      const ready = !!(r.sprite && this.assets && this.spriteReady(r.sprite.textureKey, r.frame?.index));
      const mode = chooseRenderMode(r, ready);
      if (mode === 'none') continue;
      seen.add(r.entityId);
      const mesh = this.ensureMesh(r, mode);
      const pose = renderablePose(r, this.zStep);
      mesh.position.set(pose.x, pose.y, pose.z);
      mesh.rotation.z = pose.rotZ;
      mesh.scale.set(pose.sx, pose.sy, 1);
      this.paint(mesh, r, mode);
      poses.push(pose);
      if (r.entityId === followTarget) followPose = pose;
    }

    // W1-C 脏标跳渲：渲染签名（投影体姿 + 相机 + 灯 + 后处理 + 天空云飘帧）。与上帧一致 → 跳过
    // instanceMatrix 上传 + 阴影 + render（画面不变·省 CPU/GPU/带宽）——「低开销」最大单点。
    const post = getPost3D(world);
    const ph = hashPoses(poses);
    const renderSig = `${ph}|${camSig(cam3d)}|${this.lights.lightSig}|${postSig(post)}|${sky?.scroll ? this.frame : (sky ? `${sky.top}.${sky.bottom}` : '')}|${this.debugColliders ? 'd' : ''}|${this.debugNav ? 'n' : ''}`;
    const shadowSig = `${ph}|${this.lights.lightSig}`; // 阴影只随投影体姿/灯变（相机/云飘/后处理不触发）
    if (renderSig === this.lastRenderSig) {
      this.rendered = false;
      this.cpuMs = this.cpuMs * 0.9 + (performance.now() - t0) * 0.1;
      return;
    }
    this.lastRenderSig = renderSig;

    this.batches.sync(this.scene, instGroups); // W1-A：脏帧才写 instanceMatrix（一次 buffer 上传）+ 移空批

    // 相机解释（REQ-3D-Camera）：① Camera3D → 盒庭轨道/跟随（投影/fov/ortho/near-far 全从数据·CameraRig 算矩阵）；
    //   ② 否则原俯视自适配（向后兼容）。follow 模式注视点 = target 实体位（收集期捕获的 followPose）。
    const aspect = this.width / this.height;
    if (cam3d) {
      const b = poseBounds3D(poses);
      const bc = bounds3DCenter(b);
      const center = followPose
        ? { x: followPose.x, y: followPose.y, z: followPose.z }
        : { x: cam3d.pivotX ?? bc.x, y: cam3d.pivotY ?? bc.y, z: cam3d.pivotZ ?? bc.z };
      const radius = Math.max(bounds3DExtent(b), 1);
      const dist = cam3d.distance ?? fitDistance3D(radius, cam3d.fov ?? this.fov);
      this.cameras.applyOrbit(cam3d, center, dist, aspect, radius, this.fov, SKY_RADIUS);
      this.lights.placeShadow(center, radius);
    } else {
      this.cameras.applyFlat(poseBounds(poses), this.fov, aspect);
    }

    // W1-C 阴影门：autoUpdate=false → 仅投影体/灯变才重算阴影贴图（相机/云飘不触发·大省）。
    this.gl.shadowMap.needsUpdate = shadowSig !== this.lastShadowSig;
    this.lastShadowSig = shadowSig;

    // 消失实体释放（2D 扁平层 + 模型实例）。
    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        disposeMesh(mesh);
        this.meshes.delete(id);
        this.modeOf.delete(id);
        this.textSig.delete(id);
      }
    }
    this.models.sweep(this.scene, seen);

    this.colliderDebug.sync(this.scene, world, this.debugColliders); // 碰撞体线框（debug·开则画·关则清）
    this.navDebug.sync(this.scene, world, this.debugNav); // 导航图/路径（debug·开则画·关则清）

    // 渲染：有 Post3D → EffectComposer 管线；否则直渲（向后兼容）。用 CameraRig 当前激活相机（透视/正交）。
    const cam = this.cameras.current;
    if (post) this.post.render(this.scene, cam, post);
    else this.gl.render(this.scene, cam);
    this.rendered = true;
    this.cpuMs = this.cpuMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  // 性能剖析快照（profiler·游戏层读 → LayoutNode HUD·像虚幻 stat）。drawCalls/triangles 跨全 pass 累加；
  // 跳渲帧 calls=0（画面复用上帧）。
  // 开关碰撞体调试线框（游戏层菜单调·render-only）。立即失效脏标 → 下帧重渲反映。
  setDebugColliders(on: boolean): void {
    this.debugColliders = on;
    this.lastRenderSig = ''; // 强制下帧重渲（开/关线框）
  }

  // 开关导航可视化（NavGraph 航点/连边 + 路径线·render-only）。立即失效脏标 → 下帧重渲反映。
  setDebugNav(on: boolean): void {
    this.debugNav = on;
    this.lastRenderSig = '';
  }

  readStats(): RenderStats {
    const info = this.gl.info;
    return {
      rendered: this.rendered,
      cpuMs: this.cpuMs,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      batches: this.batches.count,
      instances: this.batches.instances,
      fallbackMeshes: this.meshes.size,
      models: this.models.count,
    };
  }

  destroy(): void {
    if (this.sky) { this.scene.remove(this.sky); (this.sky.material as THREE.MeshBasicMaterial).map?.dispose(); disposeMesh(this.sky); this.sky = null; }
    for (const [, m] of this.meshes) { this.scene.remove(m); disposeMesh(m); }
    this.meshes.clear();
    for (const [, t] of this.texCache) t.dispose();
    this.texCache.clear();
    this.batches.dispose(this.scene);
    this.colliderDebug.dispose(this.scene);
    this.navDebug.dispose(this.scene);
    this.models.dispose(this.scene);
    this.lights.dispose(this.scene);
    this.post.dispose();
    this.gl.dispose();
    this.gl.domElement.remove();
  }

  // 天空盒（Sky3D）：内面朝里的大球裹住盒庭，画布纹理。参数变才重建纹理；scroll 时云缓慢飘（render-only）。
  private syncSky(sky: Sky3D | null): void {
    if (!sky) {
      if (this.sky) { this.scene.remove(this.sky); (this.sky.material as THREE.MeshBasicMaterial).map?.dispose(); disposeMesh(this.sky); this.sky = null; this.skySig = ''; }
      return;
    }
    const sig = `${sky.top}|${sky.bottom}|${sky.clouds ? 1 : 0}|${sky.cloudTint ?? 0xffffff}`;
    if (!this.sky || this.skySig !== sig) {
      if (this.sky) { this.scene.remove(this.sky); (this.sky.material as THREE.MeshBasicMaterial).map?.dispose(); disposeMesh(this.sky); }
      const mat = new THREE.MeshBasicMaterial({ map: buildSkyTexture(sky), side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
      this.sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), mat);
      this.scene.add(this.sky);
      this.skySig = sig;
    }
    if (sky.scroll) this.sky.rotation.y = this.frame * sky.scroll * 0.0004; // 云飘（render-only）
  }

  // ── 2D-in-3D 扁平层（sprite/text/shape + 透明 Mesh3D fallback）──────────────────────

  // 建/复用 mesh：模式不变则复用；模式变了（几何形态变）重建。
  private ensureMesh(r: Renderable, mode: string): THREE.Mesh {
    const prev = this.meshes.get(r.entityId);
    if (prev && this.modeOf.get(r.entityId) === mode) return prev;
    if (prev) { this.scene.remove(prev); disposeMesh(prev); }
    const mesh = new THREE.Mesh(buildGeometry(r, mode), new THREE.MeshStandardMaterial({ transparent: true }));
    this.meshes.set(r.entityId, mesh);
    this.modeOf.set(r.entityId, mode);
    this.scene.add(mesh);
    return mesh;
  }

  // 上色/贴图：sprite/text → 纹理；shape/placeholder → Color.tint 纯色；alpha → 透明度。
  // W1-B：仅当贴图引用变（USE_MAP define 翻转）才 needsUpdate；颜色/alpha 是 uniform 不需重编。
  private paint(mesh: THREE.Mesh, r: Renderable, mode: string): void {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.opacity = r.color?.alpha ?? 1;
    let map: THREE.Texture | null = null;
    let color = (r.color?.tint ?? 0xcccccc) & 0xffffff;
    if (mode === 'sprite' && r.sprite) { map = this.spriteTexture(r.sprite.textureKey, r.frame?.index); color = 0xffffff; }
    else if (mode === 'text' && r.text) { map = this.textTexture(r); color = 0xffffff; }
    if (mat.map !== map) { mat.map = map; mat.needsUpdate = true; }
    mat.color.setHex(color);
  }

  // 建/复用透明 Mesh3D 单 mesh（实例批不便逐实例 alpha → 少量走老路）。与扁平层共用 meshes/modeOf。
  private ensureMesh3D(r: Renderable, m: Mesh3D): THREE.Mesh {
    const mode = `m3:${m.shape}`;
    const prev = this.meshes.get(r.entityId);
    if (prev && this.modeOf.get(r.entityId) === mode) return prev;
    if (prev) { this.scene.remove(prev); disposeMesh(prev); }
    const mesh = buildMesh3D(m);
    this.meshes.set(r.entityId, mesh);
    this.modeOf.set(r.entityId, mode);
    this.scene.add(mesh);
    return mesh;
  }

  // 上色：box → 正/反/四边 各自取色；plane → 单面取正面色。W1-B：颜色/alpha 是 uniform·**不设 needsUpdate**。
  private paintMesh3D(mesh: THREE.Mesh, m: Mesh3D, alpha: number): void {
    const mats = mesh.material;
    if (Array.isArray(mats)) {
      const a = mats as THREE.MeshStandardMaterial[]; // BoxGeometry 面序 px,nx,py,ny,pz(正),nz(反)
      a[4]!.color.setHex(m.frontTint & 0xffffff);
      a[5]!.color.setHex((m.backTint ?? m.frontTint) & 0xffffff);
      a[0]!.color.setHex((m.edgeTint ?? 0x1f2937) & 0xffffff); // 四边共用同一材质实例
      for (const mat of a) mat.opacity = alpha;
    } else {
      const mat = mats as THREE.MeshStandardMaterial;
      mat.color.setHex(m.frontTint & 0xffffff);
      mat.opacity = alpha;
    }
  }

  private spriteReady(key: string, frame?: number): boolean {
    const res = this.assets?.resolve(key, frame);
    return !!res && isImageHandle(res.asset.handle);
  }

  // 帧子矩形经 UV offset/repeat 裁剪（atlas 友好）。按 key#frame 缓存。
  private spriteTexture(key: string, frame?: number): THREE.Texture | null {
    const res = this.assets?.resolve(key, frame);
    if (!res || !isImageHandle(res.asset.handle)) return null;
    const ck = `s:${key}#${frame ?? 0}`;
    const hit = this.texCache.get(ck);
    if (hit) return hit;
    const img = res.asset.handle.image as HTMLImageElement | ImageBitmap;
    const tex = new THREE.Texture(img as TexImageSource);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(res.sw / img.width, res.sh / img.height);
    tex.offset.set(res.sx / img.width, 1 - (res.sy + res.sh) / img.height);
    tex.needsUpdate = true;
    this.texCache.set(ck, tex);
    return tex;
  }

  // 文本 → 画布纹理面（单行居中，v1 基础版）。内容变才重画。
  private textTexture(r: Renderable): THREE.Texture | null {
    const tx = r.text!;
    const tint = (r.color?.tint ?? 0xffffff) & 0xffffff;
    const sig = `${tx.content}|${tx.fontSize}|${tx.fontFamily}|${tint}`;
    const ck = `t:${r.entityId}`;
    if (this.textSig.get(r.entityId) === sig) return this.texCache.get(ck) ?? null;
    this.texCache.get(ck)?.dispose();
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = `#${tint.toString(16).padStart(6, '0')}`;
    g.font = `bold ${Math.min(96, tx.fontSize * 2)}px ${tx.fontFamily}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(tx.content, 128, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.texCache.set(ck, tex);
    this.textSig.set(r.entityId, sig);
    return tex;
  }
}
