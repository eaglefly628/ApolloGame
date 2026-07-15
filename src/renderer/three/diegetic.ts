import * as THREE from 'three';
import type { IWorld } from '@engine/core/types.js';
import type { Diegetic3D } from '@engine/protocol/components.js';
import { mountUI, ensureUiKeyframes, type MountHandle } from '@ui/components/index.js';

// ═══════════════════════════════════════════════════════════════
//  three/DiegeticSystem —— UI 贴 3D 面（Diegetic3D·render-only·不进 hash·消费方=contents 展示台）。
//  把一棵 LayoutNode 经**引擎 UI 库**渲成离屏 DOM → 栅格成 CanvasTexture → 挂到同实体 Mesh3D 的材质 map + 自发光
//  （屏自亮·任意光照可读）。区别 WorldUI3D（屏幕叠层 billboard）——diegetic 真贴在 3D 面·随物体转/被遮挡/进透视。
//  栅格器可注入（默认 DOM→SVG foreignObject→Image·浏览器）；node 用内联样式 + 同源/data-URI 资源（foreignObject 约束）。
// ═══════════════════════════════════════════════════════════════

export type Rasterizer = (host: HTMLElement, w: number, h: number) => Promise<CanvasImageSource>;

// 默认栅格器：DOM → SVG foreignObject → Image。约束：内联样式（本 UI 库满足）；外部字体/图需同源或 data-URI（否则字体回退/污染）。
export function defaultRasterizer(host: HTMLElement, w: number, h: number): Promise<CanvasImageSource> {
  const xml = new XMLSerializer().serializeToString(host);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return new Promise((resolve, reject) => {
    const img = new Image(w, h);
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

type ScreenMat = THREE.Material & { map?: THREE.Texture | null; emissiveMap?: THREE.Texture | null; emissive?: THREE.Color; emissiveIntensity?: number; needsUpdate: boolean };
interface DState { host: HTMLElement; ui: MountHandle; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; sig: string; rendering: boolean; pendingRedraw: boolean; }

export class DiegeticSystem {
  private doc: Document | null = null;
  private overlay: HTMLElement | null = null; // 离屏宿主（渲染 DOM 用·移出视口）
  private readonly items = new Map<string, DState>();
  private readonly rasterize: Rasterizer;

  constructor(rasterize: Rasterizer = defaultRasterizer) { this.rasterize = rasterize; }

  init(container: HTMLElement): void {
    this.doc = container.ownerDocument;
    const o = this.doc.createElement('div');
    o.style.cssText = 'position:absolute;left:-99999px;top:0;pointer-events:none';
    (this.doc.body ?? container).appendChild(o);
    this.overlay = o;
    ensureUiKeyframes(this.doc);
  }

  // 逐帧：node 变 → 重挂 UI + 重栅格；栅格好把 CanvasTexture 挂 mesh 材质。返回**需持续重渲**的数（node 变 / 栅格在途 / 栅格刚完成）。
  sync(world: IWorld, meshes: ReadonlyMap<string, THREE.Mesh>): number {
    if (!this.doc || !this.overlay) return 0;
    const seen = new Set<string>();
    let live = 0;
    for (const [id] of world.query('Diegetic3D')) {
      const d = world.getComponent<Diegetic3D>(id, 'Diegetic3D');
      const mesh = meshes.get(id);
      if (!d || !mesh) continue;
      seen.add(id);
      const w = d.pxWidth ?? 512, h = d.pxHeight ?? 512;
      const sig = `${w}x${h}|${d.bg ?? ''}|${JSON.stringify(d.node)}`;
      let st = this.items.get(id);
      if (!st) { st = this.make(w, h); this.items.set(id, st); }
      if (st.sig !== sig) {
        st.host.style.cssText = `width:${w}px;height:${h}px;overflow:hidden;background:${d.bg ?? 'transparent'}`;
        st.ui.update(d.node);
        if (st.canvas.width !== w || st.canvas.height !== h) { st.canvas.width = w; st.canvas.height = h; }
        st.sig = sig;
        this.rasterizeInto(st, w, h);
      }
      this.assign(mesh, st.tex); // mesh 可能重建（材质换新）→ 每帧确保 tex 挂着
      if (st.rendering) live++;
      if (st.pendingRedraw) { st.pendingRedraw = false; live++; } // 栅格刚完成 → 这帧重渲上传新贴图
    }
    for (const [id, st] of this.items) if (!seen.has(id)) { st.ui(); st.host.remove(); st.tex.dispose(); this.items.delete(id); live++; }
    return live;
  }

  private make(w: number, h: number): DState {
    const host = this.doc!.createElement('div');
    host.style.cssText = `width:${w}px;height:${h}px;overflow:hidden`;
    this.overlay!.appendChild(host);
    const ui = mountUI(host, { type: 'Panel', id: 'diegetic-root', props: {} });
    const canvas = this.doc!.createElement('canvas'); canvas.width = w; canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { host, ui, canvas, tex, sig: '', rendering: false, pendingRedraw: false };
  }

  private rasterizeInto(st: DState, w: number, h: number): void {
    if (st.rendering) return; // 上一次还在栅格 → 让它完成（sig 已更新·下次 sync 会再触发到最新）
    st.rendering = true;
    this.rasterize(st.host, w, h).then((img) => {
      const ctx = st.canvas.getContext('2d');
      if (ctx) { ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h); st.tex.needsUpdate = true; st.pendingRedraw = true; }
    }).catch(() => { /* 栅格失败（如外源污染）→ 保留上次贴图 */ }).finally(() => { st.rendering = false; });
  }

  private assign(mesh: THREE.Mesh, tex: THREE.CanvasTexture): void {
    const mat = mesh.material as ScreenMat;
    if (mat.map === tex) return;
    mat.map = tex;
    if ('emissiveMap' in mat) { mat.emissiveMap = tex; mat.emissive?.setHex(0xffffff); mat.emissiveIntensity = 1; } // 屏自亮·任意光照可读
    mat.needsUpdate = true;
  }

  dispose(): void {
    for (const [, st] of this.items) { st.ui(); st.host.remove(); st.tex.dispose(); }
    this.items.clear();
    this.overlay?.remove();
    this.overlay = null;
  }
}
