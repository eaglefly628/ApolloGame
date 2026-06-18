import * as THREE from 'three';
import type { IWorld, RendererBackend } from '@engine/core/types.js';
import type { Mesh3D } from '@engine/protocol/components.js';
import type { AssetManager } from '@assets/index.js';
import { isImageHandle } from '@assets/index.js';
import { collectRenderables, chooseRenderMode, type Renderable } from './renderable.js';
import { renderablePose, poseBounds, fitPerspective, flipEuler, mesh3dDepth, type Pose3D } from './three-projection.js';

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
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 4, 6);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    this.gl = new THREE.WebGLRenderer({ antialias: true });
    this.gl.setSize(this.width, this.height);
    container.appendChild(this.gl.domElement);
  }

  sync(world: IWorld): void {
    const seen = new Set<string>();
    const poses: Pose3D[] = [];

    for (const r of collectRenderables(world)) {
      // 3D 物件（Mesh3D）：渲成有体积/双面的 box（或薄片 plane），Transform.rotation 驱动翻面。与 2D 同场混排。
      if (r.mesh3d) {
        const mesh = this.ensureMesh3D(r, r.mesh3d);
        const pose = renderablePose(r, this.zStep);
        mesh.position.set(pose.x, pose.y, pose.z);
        const fe = flipEuler(r.rotation, r.mesh3d.flipAxis);
        mesh.rotation.set(fe.x, fe.y, 0);
        mesh.scale.set(pose.sx, pose.sy, 1);
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

    // 相机自适配：框住全场包围盒（几个到几百个实体都自动取景）。
    const fit = fitPerspective(poseBounds(poses), this.fov, this.width / this.height);
    this.camera.position.set(fit.cx, fit.cy, fit.dist);
    this.camera.lookAt(fit.cx, fit.cy, 0);

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
function buildMesh3D(m: Mesh3D): THREE.Mesh {
  if (m.shape === 'plane') {
    const mat = new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide });
    return new THREE.Mesh(new THREE.PlaneGeometry(m.width, m.height), mat);
  }
  const depth = mesh3dDepth(m.shape, m.width, m.height, m.depth);
  const edge = new THREE.MeshStandardMaterial({ transparent: true });
  const front = new THREE.MeshStandardMaterial({ transparent: true });
  const back = new THREE.MeshStandardMaterial({ transparent: true });
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
