import * as THREE from 'three';
import type { RendererBackend, IWorld } from '@engine/core/types.js';
import type { Transform, Card3D } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  ThreeRenderer —— 3D 表现层后端（Game G 骨架）。RendererBackend 的 Three.js 实现：
//  读 render-only 组件 Card3D + Transform，把每张牌画成 3D 薄盒，按 Transform.rotation 绕 X 轴翻转
//  （0=正面朝镜头、π=反面）。**纯表现，不写 sim、不进 hash**——和 CanvasRenderer 同地位，只是画 3D。
//
//  与纲领的关系：渲染后端 = 固定的"解释器"（manifesto §2 允许的引擎码）；3D 物体 = 数据（Card3D 组件）。
//  WebGL 仅在 init() 创建（浏览器）——本模块只被浏览器入口(game-g.tsx)引用，node 测试不加载（无 WebGL 安全）。
//  L0：翻面 = tween Transform.rotation 到既定面（胜负先定）。L1（可选未来）：换非确定性 3D 物理库做真实翻滚。
// ═══════════════════════════════════════════════════════════════

export interface ThreeRendererOptions {
  width: number;
  height: number;
  background?: number; // 0xRRGGBB
  pixelsPerUnit?: number; // 2D 像素 → 3D 单位换算（缺省 100）
}

export class ThreeRenderer implements RendererBackend {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly opts: Required<ThreeRendererOptions>;

  constructor(opts: ThreeRendererOptions) {
    this.opts = {
      background: 0x0a0a14,
      pixelsPerUnit: 100,
      ...opts,
    };
  }

  init(container: HTMLElement): void {
    const { width, height, background } = this.opts;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 6);
    this.camera.lookAt(0, 0, 0);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 3, 4);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);
  }

  sync(world: IWorld): void {
    const ppu = this.opts.pixelsPerUnit;
    const seen = new Set<string>();
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
      mesh.position.set(t.x / ppu, -t.y / ppu, 0); // 2D y 向下 → 3D y 向上
      mesh.rotation.x = t.rotation; // 翻面角：0=正面朝镜头(+z)，π=反面
    }
    // 实体消失 → 移除并释放 GPU 资源（防泄漏）
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

  // 一张薄盒卡牌：+z 面=正面、-z 面=反面、四边深色。BoxGeometry 材质序：px,nx,py,ny,pz,nz。
  private makeCard(c: Card3D, ppu: number): THREE.Mesh {
    const geo = new THREE.BoxGeometry(c.width / ppu, c.height / ppu, 0.03);
    const edge = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
    const front = new THREE.MeshStandardMaterial({ color: c.frontTint });
    const back = new THREE.MeshStandardMaterial({ color: c.backTint });
    return new THREE.Mesh(geo, [edge, edge, edge, edge, front, back]);
  }
}

function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const m = mesh.material;
  (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
}
