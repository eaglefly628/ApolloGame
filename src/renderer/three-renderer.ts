import * as THREE from 'three';
import type { IWorld, RendererBackend } from '@engine/core/types.js';
import type { Mesh3D, Sky3D } from '@engine/protocol/components.js';
import type { AssetManager } from '@assets/index.js';
import { isImageHandle } from '@assets/index.js';
import { getCamera3D, getSky3D } from '@engine/protocol/camera-view.js';
import { collectRenderables, chooseRenderMode, type Renderable } from './renderable.js';
import {
  renderablePose, poseBounds, fitPerspective, flipEuler, mesh3dDepth, type Pose3D,
  transform3dPose, groundPose, poseBounds3D, bounds3DCenter, bounds3DExtent, fitDistance3D, orbitCamera,
} from './three-projection.js';

// ═══════════════════════════════════════════════════════════════
//  ThreeRenderer —— 通用 3D 渲染后端（RendererBackend 的 Three.js 实现）。
//  与 Canvas/Ascii 后端**读同一份 `collectRenderables`**：Shape→平面几何、Sprite→贴图面、
//  Color→材质、Text→画布纹理面，Transform+zOrder→空间位姿，相机自适配包围盒。
//  即「同一份数据、换渲染方法」的 3D 一等后端——任何产出 Renderable 的游戏都能直接 3D 化。
//
//  **纯表现**：只读 world、只写 three 对象，不写 sim、不进 hash。WebGL 仅 init/sync 触碰（浏览器）；
//  纯投影几何已抽到 ./three-projection（node 可测）。**刻意不进 `./index` barrel**（静态 import three，
//  避免 2D 消费者连带打包）——需要 3D 的入口直接 import 本文件，进各自的 3D code-split chunk。
//
//  注：game-g 的卡牌渲染器（Card3D + 牌面纹理 + 抛飞编排）是其**游戏专属**表现，不在本通用后端内；
//  它可在需要时改为在本后端之上叠加自己的皮与编排（rule-of-three：单一编排不强抽）。
// ═══════════════════════════════════════════════════════════════

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
  private camera!: THREE.PerspectiveCamera;
  private key!: THREE.DirectionalLight; // 主方向光（盒庭模式投柔和阴影 + 每帧随场景定位）
  private sky: THREE.Mesh | null = null; // 天空盒（Sky3D 在场时建·内面大球）
  private skySig = ''; // 天空盒参数签名（变了才重建纹理）
  private frame = 0; // 帧计数（render-only·云飘等表现动画用·不进 hash）
  private gl!: THREE.WebGLRenderer;
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly modeOf = new Map<string, string>(); // 当前几何模式（变了才重建几何）
  private readonly texCache = new Map<string, THREE.Texture>();
  private readonly textSig = new Map<string, string>(); // 文本实体上次内容签名（变了才重画纹理）
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
    this.camera = new THREE.PerspectiveCamera(this.fov, this.width / this.height, 0.1, 10000);
    this.camera.position.set(0, 0, 10);
    // 暖白主光 + 冷蓝补光（暖冷对比·盒庭通透感）；主光投柔和阴影（盒庭模式每帧随场景重定位）。
    const key = new THREE.DirectionalLight(0xfff1d6, 1.25);
    key.position.set(2, 4, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    this.scene.add(key.target);
    this.key = key;
    this.scene.add(new THREE.AmbientLight(0xbfd2ff, 0.6));
    this.gl = new THREE.WebGLRenderer({ antialias: true });
    this.gl.setSize(this.width, this.height);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和接触阴影（Captain Toad 招牌软影）
    container.appendChild(this.gl.domElement);
  }

  sync(world: IWorld): void {
    const seen = new Set<string>();
    const poses: Pose3D[] = [];
    this.frame++;
    const cam3d = getCamera3D(world); // 盒庭模式开关（在场=轨道相机 + 2D 实体落地面 + 柔和阴影）
    this.syncSky(getSky3D(world)); // 天空盒（Sky3D 在场建、不在场拆）

    for (const r of collectRenderables(world)) {
      // 3D 物件（Mesh3D）：渲成有体积/双面的 box（或薄片 plane）。与 2D 同场混排。
      // 两条位姿路：① 有 Transform3D → 真三维位姿（盒庭：地面 XZ + Y 高度，三轴欧拉）；
      // ② 否则 → 2D 投影 + Transform.rotation 当翻面角（原 three-lab 路径，向后兼容）。
      if (r.mesh3d) {
        const mesh = this.ensureMesh3D(r, r.mesh3d);
        let pose: Pose3D;
        if (r.transform3d || cam3d) {
          // 真三维位姿（Transform3D）或盒庭模式下的 2D 实体落地面（groundPose）——都用三轴欧拉摆位。
          pose = r.transform3d ? transform3dPose(r.transform3d) : groundPose(r, r.mesh3d.height);
          mesh.position.set(pose.x, pose.y, pose.z);
          mesh.rotation.set(pose.rx ?? 0, pose.ry ?? 0, pose.rotZ);
          mesh.scale.set(pose.sx, pose.sy, pose.sz ?? 1);
        } else {
          pose = renderablePose(r, this.zStep);
          mesh.position.set(pose.x, pose.y, pose.z);
          const fe = flipEuler(r.rotation, r.mesh3d.flipAxis);
          mesh.rotation.set(fe.x, fe.y, 0);
          mesh.scale.set(pose.sx, pose.sy, 1);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true; // 盒庭里地台/方块互投软影
        this.paintMesh3D(mesh, r.mesh3d, r.color?.alpha ?? 1);
        seen.add(r.entityId);
        poses.push(pose);
        continue;
      }
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
    }

    // 相机：① 有 Camera3D → 盒庭轨道相机（按 yaw/pitch 环绕注视点 + 柔和阴影随场景定位）；
    //       ② 否则 → 原俯视自适配，框住 2D 包围盒（向后兼容·three-lab 不变）。
    if (cam3d) {
      const b = poseBounds3D(poses);
      const c = bounds3DCenter(b);
      const center = {
        x: cam3d.pivotX ?? c.x,
        y: cam3d.pivotY ?? c.y,
        z: cam3d.pivotZ ?? c.z,
      };
      const radius = Math.max(bounds3DExtent(b), 1);
      const dist = cam3d.distance ?? fitDistance3D(radius, this.fov);
      const p = orbitCamera(center, dist, cam3d.yaw, cam3d.pitch);
      this.camera.position.set(p.x, p.y, p.z);
      this.camera.lookAt(center.x, center.y, center.z);
      this.placeShadow(center, radius);
    } else {
      const fit = fitPerspective(poseBounds(poses), this.fov, this.width / this.height);
      this.camera.position.set(fit.cx, fit.cy, fit.dist);
      this.camera.lookAt(fit.cx, fit.cy, 0);
    }

    // 消失实体 → 释放 GPU 资源。
    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        disposeMesh(mesh);
        this.meshes.delete(id);
        this.modeOf.delete(id);
        this.textSig.delete(id);
      }
    }
    this.gl.render(this.scene, this.camera);
  }

  destroy(): void {
    if (this.sky) { this.scene.remove(this.sky); (this.sky.material as THREE.MeshBasicMaterial).map?.dispose(); disposeMesh(this.sky); this.sky = null; }
    for (const [, m] of this.meshes) {
      this.scene.remove(m);
      disposeMesh(m);
    }
    this.meshes.clear();
    for (const [, t] of this.texCache) t.dispose();
    this.texCache.clear();
    this.gl.dispose();
    this.gl.domElement.remove();
  }

  // 天空盒（Sky3D）：内面朝里的大球裹住盒庭，纹理=天顶→地平线渐变 + 程序化云。参数变才重建纹理；scroll 时云缓慢飘。
  private syncSky(sky: Sky3D | null): void {
    if (!sky) {
      if (this.sky) { this.scene.remove(this.sky); (this.sky.material as THREE.MeshBasicMaterial).map?.dispose(); disposeMesh(this.sky); this.sky = null; this.skySig = ''; }
      return;
    }
    const sig = `${sky.top}|${sky.bottom}|${sky.clouds ? 1 : 0}|${sky.cloudTint ?? 0xffffff}`;
    if (!this.sky || this.skySig !== sig) {
      if (this.sky) { this.scene.remove(this.sky); (this.sky.material as THREE.MeshBasicMaterial).map?.dispose(); disposeMesh(this.sky); }
      const mat = new THREE.MeshBasicMaterial({ map: buildSkyTexture(sky), side: THREE.BackSide, depthWrite: false, fog: false });
      this.sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), mat);
      this.scene.add(this.sky);
      this.skySig = sig;
    }
    if (sky.scroll) this.sky.rotation.y = this.frame * sky.scroll * 0.0004; // 云飘（render-only）
  }

  // 盒庭模式：把主方向光摆到场景右上前方（暖调侧光），阴影正交相机框住整个盒庭（半径 radius）。
  // 每帧据场景中心/半径重定位 → 几个到几十个物件都自动覆盖阴影，不漏不糊。
  private placeShadow(center: { x: number; y: number; z: number }, radius: number): void {
    const d = radius * 3;
    this.key.position.set(center.x + d * 0.55, center.y + d, center.z + d * 0.45);
    this.key.target.position.set(center.x, center.y, center.z);
    this.key.target.updateMatrixWorld();
    const cam = this.key.shadow.camera as THREE.OrthographicCamera;
    const r = radius * 1.7;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 0.1; cam.far = d * 3;
    cam.updateProjectionMatrix();
  }

  // 建/复用 mesh：模式不变则复用；模式变了（几何形态变）重建。
  private ensureMesh(r: Renderable, mode: string): THREE.Mesh {
    const prev = this.meshes.get(r.entityId);
    if (prev && this.modeOf.get(r.entityId) === mode) return prev;
    if (prev) {
      this.scene.remove(prev);
      disposeMesh(prev);
    }
    const mesh = new THREE.Mesh(buildGeometry(r, mode), new THREE.MeshStandardMaterial({ transparent: true }));
    this.meshes.set(r.entityId, mesh);
    this.modeOf.set(r.entityId, mode);
    this.scene.add(mesh);
    return mesh;
  }

  // 上色/贴图：sprite/text → 纹理；shape/placeholder → Color.tint 纯色；alpha → 透明度。
  private paint(mesh: THREE.Mesh, r: Renderable, mode: string): void {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.opacity = r.color?.alpha ?? 1;
    if (mode === 'sprite' && r.sprite) {
      mat.map = this.spriteTexture(r.sprite.textureKey, r.frame?.index);
      mat.color.setHex(0xffffff);
    } else if (mode === 'text' && r.text) {
      mat.map = this.textTexture(r);
      mat.color.setHex(0xffffff);
    } else {
      mat.map = null;
      mat.color.setHex((r.color?.tint ?? 0xcccccc) & 0xffffff);
    }
    mat.needsUpdate = true;
  }

  // 建/复用 3D 物件 mesh：几何形态（box/plane）不变则复用，变了重建。与 flat 路径共用 meshes/modeOf。
  private ensureMesh3D(r: Renderable, m: Mesh3D): THREE.Mesh {
    const mode = `m3:${m.shape}`;
    const prev = this.meshes.get(r.entityId);
    if (prev && this.modeOf.get(r.entityId) === mode) return prev;
    if (prev) {
      this.scene.remove(prev);
      disposeMesh(prev);
    }
    const mesh = buildMesh3D(m);
    this.meshes.set(r.entityId, mesh);
    this.modeOf.set(r.entityId, mode);
    this.scene.add(mesh);
    return mesh;
  }

  // 上色：box → 正面(+z)/反面(-z)/四边 各自取色；plane → 单面取正面色。alpha 透传到全部材质。每帧设（tint 变即反映）。
  private paintMesh3D(mesh: THREE.Mesh, m: Mesh3D, alpha: number): void {
    const mats = mesh.material;
    if (Array.isArray(mats)) {
      const a = mats as THREE.MeshStandardMaterial[]; // BoxGeometry 面序 px,nx,py,ny,pz(正),nz(反)
      a[4].color.setHex(m.frontTint & 0xffffff);
      a[5].color.setHex((m.backTint ?? m.frontTint) & 0xffffff);
      a[0].color.setHex((m.edgeTint ?? 0x1f2937) & 0xffffff); // 四边共用同一材质实例
      for (const mat of a) {
        mat.opacity = alpha;
        mat.needsUpdate = true;
      }
    } else {
      const mat = mats as THREE.MeshStandardMaterial;
      mat.color.setHex(m.frontTint & 0xffffff);
      mat.opacity = alpha;
      mat.needsUpdate = true;
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

  // 文本 → 画布纹理面（单行居中，v1 基础版；多行/换行是 Canvas 后端的活）。内容变才重画。
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

// Mesh3D → three Mesh：box=有厚度盒（面序 px,nx,py,ny,pz=正,nz=反，四边共用一材质）；plane=双面薄片。
// 材质先建空白，颜色每帧由 paintMesh3D 设（避免建/绘两处重复颜色逻辑）。
// Sky3D → 画布纹理：天顶→地平线竖直渐变 + 可选程序化云团（固定位置·可复现·无图片资产）。
function buildSkyTexture(sky: Sky3D): THREE.CanvasTexture {
  const W = 512, H = 256;
  const hexstr = (n: number): string => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
  const rgba = (n: number, a: number): string => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, hexstr(sky.top));
  grad.addColorStop(1, hexstr(sky.bottom));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  if (sky.clouds) {
    const c = sky.cloudTint ?? 0xffffff;
    // 固定云团（x,y,半径）：上半部一排柔和白团 → 半透明径向渐变堆出蓬松感。
    const puffs: Array<[number, number, number]> = [
      [60, 70, 38], [110, 58, 28], [150, 84, 32], [250, 64, 40], [300, 56, 26],
      [338, 80, 32], [430, 70, 36], [474, 58, 26], [200, 104, 30], [392, 108, 28],
    ];
    for (const [x, y, r] of puffs) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba(c, 0.9));
      rg.addColorStop(0.6, rgba(c, 0.45));
      rg.addColorStop(1, rgba(c, 0));
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function buildMesh3D(m: Mesh3D): THREE.Mesh {
  // 哑光质感（roughness 高·metalness 0）= 盒庭圆润不反光的可爱面（Captain Toad 风）。
  const matte = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.92, metalness: 0 });
  if (m.shape === 'plane') {
    const mat = matte();
    mat.side = THREE.DoubleSide;
    return new THREE.Mesh(new THREE.PlaneGeometry(m.width, m.height), mat);
  }
  const depth = mesh3dDepth(m.shape, m.width, m.height, m.depth);
  const edge = matte();
  const front = matte();
  const back = matte();
  return new THREE.Mesh(new THREE.BoxGeometry(m.width, m.height, depth), [edge, edge, edge, edge, front, back]);
}

// 几何由渲染模式决定：shape→对应平面几何；sprite/text/placeholder→单位面（贴图/占位）。
function buildGeometry(r: Renderable, mode: string): THREE.BufferGeometry {
  if (mode === 'shape' && r.shape) {
    const s = r.shape;
    if (s.kind === 'circle') return new THREE.CircleGeometry(s.radius ?? 4, 24);
    if (s.kind === 'polygon' && s.vertices && s.vertices.length >= 6) {
      const shape = new THREE.Shape();
      shape.moveTo(s.vertices[0], -s.vertices[1]); // 同 pose 的 y 翻转
      for (let i = 2; i + 1 < s.vertices.length; i += 2) shape.lineTo(s.vertices[i], -s.vertices[i + 1]);
      return new THREE.ShapeGeometry(shape);
    }
    return new THREE.PlaneGeometry(s.width ?? 8, s.height ?? 8); // box
  }
  if (mode === 'text') return new THREE.PlaneGeometry(64, 32);
  return new THREE.PlaneGeometry(16, 16); // sprite / placeholder
}

function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const m = mesh.material;
  (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
}
