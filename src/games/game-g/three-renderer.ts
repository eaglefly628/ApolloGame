import * as THREE from 'three';
import type { RendererBackend, IWorld } from '@engine/core/types.js';
import type { Transform, Card3D, Tween } from '@engine/protocol/components.js';
import { clamp01, hangWarp, revealGlow, faceUpVisible, laneRevealProgress, easeOutCubic, ALIVE_GLOW, DEAD_DIM } from './feel.js'; // design/15/16 手感曲线（纯表现、不进 hash）
import { cardScreenPos, SCENE_W, SCENE_H, LANE_Y, HOME_AX, HOME_BX, TOWERS, CARD_SCALE, SCENE_CH } from './scene.js'; // VIS-2 三路战场布局（与 render-frame 共用单一真相）

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

const APEX = 0.7; // 抛飞顶点高度（3D 单位，单牌 demo 退路用）
const Z_POP = 0.5; // apex 处朝镜头弹出的深度（增强"跃出"感）
const FOV = 50;

export class ThreeRenderer implements RendererBackend {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly markers = new Map<string, { group: THREE.Group; zhan: THREE.Sprite }>(); // 主将♔王冠 + 阵亡红斩（VIS-4 可读性，design/16 §十）
  private readonly scenery: THREE.Object3D[] = []; // VIS-2 静态战场 mesh（路/老家/哨塔/地面）
  private readonly texCache = new Map<string, THREE.Texture>(); // 牌面/背面纹理缓存（按 rank|suit|色 复用）
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

    this.buildScenery(); // VIS-2 三路战场：路/老家牌王座/哨塔/地面（静态 mesh，一次建）
    const ppu = this.opts.pixelsPerUnit; // 相机固定框 scene 包围盒（布局尺寸恒定）
    this.fitCamera(-SCENE_W / 2 / ppu, SCENE_W / 2 / ppu, -SCENE_H / 2 / ppu, SCENE_H / 2 / ppu);
  }

  // VIS-2 三路战场场景（design/16 §三，approved）：古风地面 + 三路分区带 + 左右老家牌王座♔ + 哨塔。纯表现、静态。
  private buildScenery(): void {
    const ppu = this.opts.pixelsPerUnit;
    const X = (sx: number): number => (sx - SCENE_W / 2) / ppu;
    const Y = (sy: number): number => -(sy - SCENE_H / 2) / ppu;
    const add = (m: THREE.Object3D): void => { this.scene.add(m); this.scenery.push(m); };
    // 古风地面（深色，卡之后）。
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(SCENE_W / ppu * 1.1, SCENE_H / ppu * 1.1), new THREE.MeshBasicMaterial({ color: 0x0c1410 }));
    ground.position.z = -0.4;
    add(ground);
    // 三路分区带（横轨）。
    for (let L = 0; L < 3; L++) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry((HOME_BX - HOME_AX - 80) / ppu, (SCENE_CH + 120) / ppu), new THREE.MeshBasicMaterial({ color: L === 1 ? 0x13201a : 0x141a26, transparent: true, opacity: 0.72 }));
      band.position.set(X((HOME_AX + HOME_BX) / 2), Y(LANE_Y[L]), -0.3);
      add(band);
    }
    // 哨塔（每路 A/B 各一）。
    for (const tw of TOWERS) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), new THREE.MeshStandardMaterial({ color: tw.side === 'a' ? 0xa16207 : 0x0e7490 }));
      tower.position.set(X(tw.x), Y(tw.y), -0.15);
      add(tower);
    }
    // 左右老家牌王座 ♔（我军金 / 敌军青）：底座 + ♔ 贴图面。
    for (const [hx, color, who] of [[HOME_AX, 0xeab308, '我军'], [HOME_BX, 0x38bdf8, '敌军']] as const) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x10151f }));
      base.position.set(X(hx), 0, -0.2);
      add(base);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.1), new THREE.MeshBasicMaterial({ map: this.glyphTexture('♔', color), transparent: true }));
      plate.position.set(X(hx), 0.2, 0.02);
      add(plate);
      void who;
    }
  }

  // ♔ 等字形 → 画布纹理（老家牌王座面用）。
  private glyphTexture(glyph: string, color: number): THREE.Texture {
    const key = `g:${glyph}:${color}`;
    const hit = this.texCache.get(key);
    if (hit) return hit;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 160;
    const g = cv.getContext('2d')!;
    g.fillStyle = hex(color);
    g.font = 'bold 96px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(glyph, 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.texCache.set(key, tex);
    return tex;
  }

  // 主将标识（Sprite 永远朝镜头、不随牌翻）：♔ 王冠在牌上方 + 红「斩」阵亡时显在牌面。
  private generalMarker(id: string, side: 'a' | 'b'): { group: THREE.Group; zhan: THREE.Sprite } {
    const hit = this.markers.get(id);
    if (hit) return hit;
    const color = side === 'a' ? 0xeab308 : 0x38bdf8;
    const halfH = SCENE_CH / this.opts.pixelsPerUnit / 2; // SCENE_CH 已含 CARD_SCALE
    const crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glyphTexture('♔', color), transparent: true }));
    crown.scale.set(0.4, 0.5, 1);
    crown.position.y = halfH + 0.3;
    const zhan = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glyphTexture('斩', 0xef4444), transparent: true }));
    zhan.scale.set(0.55, 0.68, 1);
    zhan.position.z = 0.12;
    zhan.visible = false;
    const group = new THREE.Group();
    group.add(crown);
    group.add(zhan);
    this.scene.add(group);
    const m = { group, zhan };
    this.markers.set(id, m);
    return m;
  }

  sync(world: IWorld): void {
    const ppu = this.opts.pixelsPerUnit;
    const seen = new Set<string>();
    // 屏 px（scene.ts 单一真相）→ 3D：场景居中、y 翻转。
    const toX = (sx: number): number => (sx - SCENE_W / 2) / ppu;
    const toY = (sy: number): number => -(sy - SCENE_H / 2) / ppu;

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
      const tw = world.getComponent<Tween>(id, 'Tween');
      const prog = tw && tw.duration > 0 ? clamp01(tw.elapsed / tw.duration) : 1; // 抛飞/翻面进度
      const faceUp = faceUpVisible(tw ? tw.to : t.rotation); // 既定面（落定目标 tw.to）
      if (c.pairKey !== undefined && c.side) {
        // VIS-2 三路战场 + VIS-4 逐路揭晓：上→中→下 错开（lp）；按 scene.ts 摆位、抛飞/翻面/金石揭晓 都吃 lp。
        const lane = Math.floor(c.pairKey / 100);
        const lp = laneRevealProgress(prog, lane);
        const arc = Math.sin(Math.PI * hangWarp(lp));
        const p = cardScreenPos(lane, c.side === 'a' ? 'a' : 'b', c.pairKey % 100, arc);
        mesh.position.set(toX(p.x), toY(p.y), Z_POP * arc);
        mesh.scale.set(CARD_SCALE, CARD_SCALE, 1);
        mesh.rotation.x = tw ? tw.from + (tw.to - tw.from) * easeOutCubic(lp) : t.rotation; // 翻面按路错开（重导自 Tween，不读 sim 角）
        this.applyReveal(mesh, faceUp, c.frontTint, revealGlow(lp));
        if (c.pairKey % 100 === 0) { // idx0=本路主将 → ♔王冠（不随牌翻）+ 阵亡红斩（牵动/擒贼擒王可读）
          const m = this.generalMarker(id, c.side === 'a' ? 'a' : 'b');
          m.group.position.set(toX(p.x), toY(p.y), Z_POP * arc + 0.05);
          m.zhan.visible = !faceUp && revealGlow(lp) > 0.4;
        }
      } else {
        // 退路（单牌/对决 demo，无 pairKey）：旧布局 + 抛飞弧。
        const arc = Math.sin(Math.PI * hangWarp(prog));
        mesh.position.set(t.x / ppu, -t.y / ppu + APEX * arc, Z_POP * arc);
        mesh.rotation.x = t.rotation;
        this.applyReveal(mesh, faceUp, c.frontTint, revealGlow(prog));
      }
    }

    // ── 实体消失 → 释放 GPU 资源。
    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        disposeMesh(mesh);
        this.meshes.delete(id);
      }
    }
    for (const [id, m] of this.markers) {
      if (!seen.has(id)) { this.scene.remove(m.group); disposeGroup(m.group); this.markers.delete(id); }
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    for (const [, mesh] of this.meshes) {
      this.scene.remove(mesh);
      disposeMesh(mesh);
    }
    this.meshes.clear();
    for (const [, m] of this.markers) { this.scene.remove(m.group); disposeGroup(m.group); }
    this.markers.clear();
    for (const o of this.scenery) { this.scene.remove(o); if (o instanceof THREE.Mesh) disposeMesh(o); }
    this.scenery.length = 0;
    for (const [, tex] of this.texCache) tex.dispose(); // 释放牌面/背面纹理
    this.texCache.clear();
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

  // 一张薄盒卡牌：+z 面=正面(扑克牌面)、-z 面=反面(花纹)、四边深色。BoxGeometry 材质序：px,nx,py,ny,pz,nz。
  private makeCard(c: Card3D, ppu: number): THREE.Mesh {
    const geo = new THREE.BoxGeometry(c.width / ppu, c.height / ppu, 0.03);
    const edge = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
    // 有 rank/suit → 画真扑克牌面（点数+花色，红黑分色，队伍色描边）；否则退化纯色。
    const front =
      c.rank && c.suit
        ? new THREE.MeshStandardMaterial({ map: this.faceTexture(c.rank, c.suit, c.frontTint) })
        : new THREE.MeshStandardMaterial({ color: c.frontTint });
    const back = new THREE.MeshStandardMaterial({ map: this.backTexture(c.backTint) });
    return new THREE.Mesh(geo, [edge, edge, edge, edge, front, back]);
  }

  // 落定金石对比（design/15 命门 · 纯表现）：正面(活)=自队色 emissive 随落定渐亮(立绘亮/金光)；
  // 反面(死)=背面石板随落定压暗(沉灰/石裂)。每帧据 rev∈[0,1] 设，两支各自复位对方的改动→无残留。
  private applyReveal(mesh: THREE.Mesh, faceUp: boolean, tint: number, rev: number): void {
    const mats = mesh.material as THREE.MeshStandardMaterial[];
    const front = mats[4];
    const back = mats[5];
    if (faceUp) {
      front.emissive.setHex(tint & 0xffffff);
      front.emissiveIntensity = rev * ALIVE_GLOW; // 活：自色辉光随落定渐起
      back.color.setScalar(1);
    } else {
      front.emissiveIntensity = 0;
      back.color.setScalar(1 - rev * DEAD_DIM); // 死：背面石板随落定压暗
    }
  }

  // 正面：奶白底 + 队伍色描边 + 角标(点数+花色)/中心大花色；红(♥♦)/黑(♠♣)分色。按 rank|suit|描边色缓存复用。
  private faceTexture(rank: string, suit: string, borderTint: number): THREE.Texture {
    const key = `f:${rank}:${suit}:${borderTint}`;
    const hit = this.texCache.get(key);
    if (hit) return hit;
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 358;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#f7f5ee'; // 奶白底
    roundRect(g, 6, 6, 244, 346, 22);
    g.fill();
    g.lineWidth = 16; // 队伍色描边（区分敌我）
    g.strokeStyle = hex(borderTint);
    roundRect(g, 14, 14, 228, 330, 18);
    g.stroke();
    const sym = SUIT_SYMBOL[suit] ?? '?';
    const red = suit === 'H' || suit === 'D';
    g.fillStyle = red ? '#c0392b' : '#161616';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 150px Georgia, serif'; // 中心大花色
    g.fillText(sym, 128, 188);
    g.font = 'bold 46px Georgia, serif'; // 左上角标：点数 + 花色
    g.textAlign = 'left';
    g.fillText(rank, 30, 52);
    g.font = 'bold 40px Georgia, serif';
    g.fillText(sym, 32, 96);
    g.save(); // 右下角标（旋转 180°）
    g.translate(226, 306);
    g.rotate(Math.PI);
    g.font = 'bold 46px Georgia, serif';
    g.fillText(rank, 0, 0);
    g.font = 'bold 40px Georgia, serif';
    g.fillText(sym, 2, 44);
    g.restore();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.texCache.set(key, tex);
    return tex;
  }

  // 反面：深色底 + 斜向菱格花纹 + 描边。按底色缓存复用。
  private backTexture(tint: number): THREE.Texture {
    const key = `b:${tint}`;
    const hit = this.texCache.get(key);
    if (hit) return hit;
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 358;
    const g = cv.getContext('2d')!;
    g.fillStyle = hex(tint);
    roundRect(g, 6, 6, 244, 346, 22);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.16)'; // 菱格
    g.lineWidth = 3;
    for (let d = -358; d < 256; d += 26) {
      g.beginPath();
      g.moveTo(d, 0);
      g.lineTo(d + 358, 358);
      g.stroke();
      g.beginPath();
      g.moveTo(d + 358, 0);
      g.lineTo(d, 358);
      g.stroke();
    }
    g.lineWidth = 14;
    g.strokeStyle = 'rgba(255,255,255,0.30)';
    roundRect(g, 16, 16, 224, 326, 16);
    g.stroke();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.texCache.set(key, tex);
    return tex;
  }
}

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
function hex(tint: number): string {
  return '#' + (tint & 0xffffff).toString(16).padStart(6, '0');
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const m = mesh.material;
  (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
}

// 主将标识组（♔/斩 Sprite）：只 dispose 材质，纹理走 texCache 共用（destroy 统一释放）。
function disposeGroup(group: THREE.Group): void {
  group.traverse((o) => { if (o instanceof THREE.Sprite) o.material.dispose(); });
}
