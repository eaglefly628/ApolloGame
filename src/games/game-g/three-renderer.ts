import * as THREE from 'three';
import type { RendererBackend, IWorld } from '@engine/core/types.js';
import type { Transform, Card3D, Tween } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  ThreeRenderer —— 3D 表现层后端（Game G）。RendererBackend 的 Three.js 实现：读 render-only 组件
//  Card3D + Transform，把每张牌画成 3D 薄盒，并编排"抛飞 → 相撞 → 坠落翻面"的对战观感（纯表现）：
//    · 翻面：Transform.rotation（tween 驱动到既定面，0=正面朝镜头 / π=反面）→ mesh.rotation.x。
//    · 抛飞：按各牌 Tween 进度 t∈[0,1] 加一条抛物线弧（apex 处最高），落定回原位。
//    · 相撞：同 pairKey 的 a/b 两牌在 apex 处朝对子中心相互靠拢（clash），再分开落定。
//    · 牌阵：相机按全场牌的包围盒自适配，体量从几张到 52v52 都自动取景。
//  **纯表现，不写 sim、不进 hash**——胜负早由规则定（blueprint.decideFaceUp），这里只把它演出来。
//
//  与纲领的关系：渲染后端 = 固定的"解释器"（manifesto §2 允许的引擎码）；3D 物体 = 数据（Card3D 组件）。
//  WebGL 仅在 init() 创建（浏览器）——本模块只被浏览器入口(game-g.tsx)引用，node 测试不加载（无 WebGL 安全）。
// ═══════════════════════════════════════════════════════════════

export interface ThreeRendererOptions {
  width: number;
  height: number;
  background?: number; // 0xRRGGBB
  pixelsPerUnit?: number; // 2D 像素 → 3D 单位换算（缺省 100）
}

const APEX = 0.7; // 抛飞顶点高度（3D 单位）
const COLLIDE = 0.82; // apex 处朝对子中心靠拢的比例（撞击观感）
const Z_POP = 0.5; // apex 处朝镜头弹出的深度（增强"跃出"感）
const FOV = 50;

export class ThreeRenderer implements RendererBackend {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly opts: Required<ThreeRendererOptions>;

  constructor(opts: ThreeRendererOptions) {
    this.opts = { background: 0x0a0a14, pixelsPerUnit: 100, ...opts };
  }

  init(container: HTMLElement): void {
    const { width, height, background } = this.opts;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);

    this.camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 6);
    this.camera.lookAt(0, 0, 0);

    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(2, 4, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88bbff, 0.5);
    rim.position.set(-3, -2, 2);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);
  }

  sync(world: IWorld): void {
    const ppu = this.opts.pixelsPerUnit;
    const seen = new Set<string>();

    // ── 一遍扫描：建/更新 mesh，收集 rest 位置 + 包围盒 + 对子中心（按 pairKey）。
    const pairSumX = new Map<number, number>();
    const pairCount = new Map<number, number>();
    interface CardView { id: string; rx: number; ry: number; rot: number; t: number; pairKey?: number }
    const views: CardView[] = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, halfW = 0, halfH = 0;

    for (const [id] of world.query('Card3D', 'Transform')) {
      seen.add(id);
      const c = world.getComponent<Card3D>(id, 'Card3D')!;
      const t = world.getComponent<Transform>(id, 'Transform')!;
      let mesh = this.meshes.get(id);
      if (!mesh) {
        mesh = this.makeCard(c, ppu);
        this.meshes.set(id, mesh);
        this.scene.add(mesh);
      }
      const rx = t.x / ppu;
      const ry = -t.y / ppu; // 2D y 向下 → 3D y 向上
      views.push({ id, rx, ry, rot: t.rotation, t: tweenProgress(world, id), pairKey: c.pairKey });
      minX = Math.min(minX, rx); maxX = Math.max(maxX, rx);
      minY = Math.min(minY, ry); maxY = Math.max(maxY, ry);
      halfW = Math.max(halfW, c.width / ppu / 2);
      halfH = Math.max(halfH, c.height / ppu / 2);
      if (c.pairKey !== undefined) {
        pairSumX.set(c.pairKey, (pairSumX.get(c.pairKey) ?? 0) + rx);
        pairCount.set(c.pairKey, (pairCount.get(c.pairKey) ?? 0) + 1);
      }
    }

    // ── 相机自适配：取景包围盒（含牌尺寸 + 抛飞顶点余量），从几张到 52v52 都自动框住。
    if (views.length > 0) this.fitCamera(minX - halfW, maxX + halfW, minY - halfH, maxY + halfH + APEX);

    // ── 二遍：编排每张牌位姿（抛飞弧 + 相撞靠拢 + 翻面），纯表现。
    for (const v of views) {
      const mesh = this.meshes.get(v.id)!;
      const arc = Math.sin(Math.PI * v.t); // 0→1→0：起落
      const leap = APEX * arc;
      let nudgeX = 0;
      if (v.pairKey !== undefined) {
        const n = pairCount.get(v.pairKey) ?? 1;
        const centerX = (pairSumX.get(v.pairKey) ?? v.rx) / n; // 对子中心 x
        nudgeX = (centerX - v.rx) * COLLIDE * arc; // apex 处朝中心靠拢 → 与对手相撞
      }
      mesh.position.set(v.rx + nudgeX, v.ry + leap, Z_POP * arc);
      mesh.rotation.x = v.rot; // 翻面（tween 驱动到既定面）
    }

    // ── 实体消失 → 释放 GPU 资源。
    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        disposeMesh(mesh);
        this.meshes.delete(id);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    for (const [, mesh] of this.meshes) {
      this.scene.remove(mesh);
      disposeMesh(mesh);
    }
    this.meshes.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // 相机沿 +z 拉远到正好框住 [minX,maxX]×[minY,maxY]（含余量）。透视：按垂直 FOV + 宽高比取 max 距离。
  private fitCamera(minX: number, maxX: number, minY: number, maxY: number): void {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const halfW = Math.max(0.5, (maxX - minX) / 2);
    const halfH = Math.max(0.5, (maxY - minY) / 2);
    const aspect = this.opts.width / this.opts.height;
    const tanV = Math.tan((FOV * Math.PI) / 180 / 2);
    const dist = Math.max(halfH / tanV, halfW / (tanV * aspect)) * 1.12 + 1;
    this.camera.position.set(cx, cy, dist);
    this.camera.lookAt(cx, cy, 0);
  }

  // 一张薄盒卡牌：+z 面=正面、-z 面=反面、四边深色。BoxGeometry 材质序：px,nx,py,ny,pz,nz。
  private makeCard(c: Card3D, ppu: number): THREE.Mesh {
    const geo = new THREE.BoxGeometry(c.width / ppu, c.height / ppu, 0.03);
    const edge = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
    const front = new THREE.MeshStandardMaterial({ color: c.frontTint });
    const back = new THREE.MeshStandardMaterial({ color: c.backTint });
    return new THREE.Mesh(geo, [edge, edge, edge, edge, front, back]);
  }
}

// 牌的抛飞进度 t∈[0,1]：有 Tween 取 elapsed/duration，无（已落定/移除）= 1（停在原位）。
function tweenProgress(world: IWorld, id: string): number {
  const tw = world.getComponent<Tween>(id, 'Tween');
  if (!tw || tw.duration <= 0) return 1;
  const r = tw.elapsed / tw.duration;
  return r < 0 ? 0 : r > 1 ? 1 : r;
}

function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const m = mesh.material;
  (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
}
