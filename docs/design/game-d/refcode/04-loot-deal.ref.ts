/* ============================================================================
 * 骰途 · 战利品发牌（3D 卡牌 Mesh 扇形浮现 + 选取） 1:1 参考实现（Three.js r128）
 * ----------------------------------------------------------------------------
 * 效果：三张 3D 卡牌从场地升起、扇形展开浮在竞技场上方、轻轻摆动；
 *       点击一张 → 该张旋转两整圈飞到镜头前放大停稳，另两张缩小飞离消散。
 *
 * 关键点（别脑补）：
 *  ① 卡牌是真 3D 盒：BoxGeometry(2.0, 2.8, 0.1)，六面材质
 *     [edge,edge,edge,edge, 正面(map=front), 背面(map=back)]（+Z 正面, -Z 背面）。
 *     edge 用纯色 MeshBasic #3a2030 做卡侧厚度。
 *  ② 扇形三连位（i=0,1,2）：
 *       x = (i-1)·2.45,  y_base = 3.5,  z = 2.9 - |i-1|·0.25,
 *       rotZ_base = -(i-1)·0.16,  tiltX = -0.92（朝相机后仰）。
 *  ③ 出现：scale 0.01→1 用 eOutBack，dur 0.5s，delay = i·0.13（依次弹出）；
 *     同时 position 从初始 (bx,0.6,1.0) lerp 到扇形位（用同一 eOutBack 的 k）。
 *  ④ 待机摆动：rotY = sin(t·1.6+i)·0.18；y = y_base + sin(t·1.5 + i·1.3)·0.12·appear。
 *  ⑤ 选中(pick)瞬间先【快照】每张当前 pos/rotY/scale（sp/sr/ss），
 *     之后所有插值都基于快照，避免跳变。
 *  ⑥ 选中张：easeInOutCubic，dur 1.25s，飞到 (0,3.0,5.6)，
 *     yaw = sr·(1-e) + 4π·e（两整圈，末尾正面朝前），scale→1.9；
 *     到位后 hold 1.7s，再 out(0.45s) 缩没收场。
 *  ⑦ 未选张：0.4s 内 scale→0 + 横向飞离 + 快速自转。
 *  ⑧ 点击拾取用 Raycaster：屏幕坐标→NDC→setFromCamera→intersectObjects(卡牌)。
 *     卡牌 mesh.userData.loot = i 记录索引。
 * ==========================================================================*/

import * as THREE from 'three'; // r128

/* ---- 颜色工具（与骰子参考一致，独立内联一份便于单文件移植）---- */
function hx(h: string){h=h.replace('#','');return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};}
function hex(o:{r:number;g:number;b:number}){const c=(v:number)=>('0'+Math.max(0,Math.min(255,Math.round(v))).toString(16)).slice(-2);return '#'+c(o.r)+c(o.g)+c(o.b);}
function shade(h:string,a:number){const o=hx(h),t=a<0?0:255,k=Math.abs(a);return hex({r:o.r+(t-o.r)*k,g:o.g+(t-o.g)*k,b:o.b+(t-o.b)*k});}

// 战利品条目：骰子卡 或 能力卡
export interface Offer {
  kind: 'die' | 'ability';
  name: string;
  accent: string;         // 主题色（骰=元素色/万能#caa6ff；能力=#ffd98a）
  pipN?: number;          // 骰卡：正面点数母题 1..6
  icon?: string;          // 能力卡：中心符号，如 ↻ ＋ ✦ ❖
  typeLabel: string;      // “元素骰”/“功能骰”/“能力”
  stars: number;          // 1..5
  effect: string;         // 效果描述（自动换行）
}

/* ---------------------------------------------------------------------------
 * 卡面贴图（420×588 CanvasTexture）
 * ------------------------------------------------------------------------- */
function rr(x: CanvasRenderingContext2D, a:number,b:number,w:number,h:number,r:number){
  x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath();
}
export function makeLootCardTexture(o: Offer): THREE.CanvasTexture {
  const accent = o.accent;
  const c = document.createElement('canvas'); c.width = 420; c.height = 588;
  const x = c.getContext('2d')!; const W = 420, H = 588;

  const bg = x.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#2a1838'); bg.addColorStop(1,'#170c20');
  x.fillStyle = bg; rr(x,0,0,W,H,40); x.fill();

  const ig = x.createRadialGradient(W/2,H*0.36,20,W/2,H*0.36,W*0.7);
  ig.addColorStop(0,accent); ig.addColorStop(1,'rgba(0,0,0,0)');
  x.globalAlpha = 0.28; x.fillStyle = ig; rr(x,14,14,W-28,H-28,32); x.fill(); x.globalAlpha = 1;

  x.strokeStyle = '#f5c969'; x.lineWidth = 6; rr(x,16,16,W-32,H-32,32); x.stroke();
  x.strokeStyle = shade(accent,-0.1); x.lineWidth = 2; rr(x,26,26,W-52,H-52,26); x.stroke();

  // 徽章盘
  const cx = W/2, cy = H*0.36, rad = 110;
  const dg = x.createLinearGradient(cx-rad,cy-rad,cx+rad,cy+rad);
  dg.addColorStop(0,shade(accent,0.26)); dg.addColorStop(1,shade(accent,-0.16));
  x.fillStyle = dg; rr(x,cx-rad,cy-rad,rad*2,rad*2,40); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; rr(x,cx-rad+8,cy-rad+8,rad*2-16,rad*2-16,32); x.stroke();

  if (o.kind === 'die' && o.pipN) {
    const P: Record<number, number[][]> = {
      1:[[.5,.5]],2:[[.28,.28],[.72,.72]],3:[[.28,.28],[.5,.5],[.72,.72]],
      4:[[.3,.3],[.7,.3],[.3,.7],[.7,.7]],5:[[.3,.3],[.7,.3],[.5,.5],[.3,.7],[.7,.7]],
      6:[[.3,.28],[.3,.5],[.3,.72],[.7,.28],[.7,.5],[.7,.72]],
    };
    const pr = rad*0.13;
    for (const [px,py] of P[o.pipN]) {
      const gx = cx-rad+px*rad*2, gy = cy-rad+py*rad*2;
      const rg = x.createRadialGradient(gx-pr*0.3,gy-pr*0.3,1,gx,gy,pr);
      rg.addColorStop(0,'#fff'); rg.addColorStop(1,'#dde4ec');
      x.fillStyle = rg; x.beginPath(); x.arc(gx,gy,pr,0,Math.PI*2); x.fill();
    }
  } else {
    x.fillStyle = '#3a2406'; x.font = '900 120px "Noto Serif SC",serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(o.icon || '✦', cx, cy+6);
  }

  x.fillStyle = '#fff4e4'; x.font = '900 40px "Noto Serif SC",serif';
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillText(o.name, W/2, H*0.66);

  x.fillStyle = accent; x.font = '600 22px "Noto Sans SC",sans-serif';
  x.fillText(o.typeLabel, W/2, H*0.71);

  x.fillStyle = '#f5c969'; x.font = '24px serif';
  x.fillText('★'.repeat(o.stars) + '☆'.repeat(5 - o.stars), W/2, H*0.755);

  // 效果文本（逐字换行）
  x.fillStyle = '#cbb6d6'; x.font = '22px "Noto Sans SC",sans-serif';
  let line = '', ly = H*0.83;
  for (const ch of o.effect) {
    if (x.measureText(line+ch).width > W-90) { x.fillText(line, W/2, ly); line = ch; ly += 30; }
    else line += ch;
  }
  x.fillText(line, W/2, ly);

  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  (t as any).encoding = THREE.sRGBEncoding;
  return t;
}

export function makeCardBackTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 420; c.height = 588;
  const x = c.getContext('2d')!;
  const bg = x.createLinearGradient(0,0,420,588); bg.addColorStop(0,'#5e2740'); bg.addColorStop(1,'#2a1430');
  x.fillStyle = bg; rr(x,0,0,420,588,40); x.fill();
  x.strokeStyle = '#f5c969'; x.lineWidth = 6; rr(x,16,16,388,556,32); x.stroke();
  x.fillStyle = 'rgba(245,201,105,.9)'; x.font = '900 150px "Noto Serif SC",serif';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 210, 300);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  (t as any).encoding = THREE.sRGBEncoding;
  return t;
}

/* ---------------------------------------------------------------------------
 * 发牌状态机
 * ------------------------------------------------------------------------- */
interface LootCard {
  m: THREE.Mesh; idx: number;
  bx: number; by: number; bz: number;      // 扇形目标位
  baseRotZ: number; tiltX: number;
  appear: number; delay: number;
  pk?: number; out?: number;               // 选中/淘汰进度
  sp?: THREE.Vector3; sr?: number; ss?: number; // pick 时快照
}
export interface Loot {
  cards: LootCard[]; t: number; chosen: number; done: boolean; hold?: number;
}

const back = /*懒加载*/ (() => { let b: THREE.CanvasTexture | null = null; return () => (b ||= makeCardBackTexture()); })();

/** 生成三张卡并加入场景。offers.length 应为 3。返回 Loot 状态。 */
export function showLoot(scene: THREE.Scene, offers: Offer[]): Loot {
  const cards: LootCard[] = [];
  const backTex = back();
  offers.forEach((o, i) => {
    const front = makeLootCardTexture(o);
    const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color('#3a2030') });
    const mats = [edge, edge, edge, edge,
      new THREE.MeshBasicMaterial({ map: front }),   // +Z 正面
      new THREE.MeshBasicMaterial({ map: backTex }), // -Z 背面
    ];
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.1), mats);
    m.userData.loot = i;
    const bx = (i - 1) * 2.45, by = 3.5, bz = 2.9 + Math.abs(i - 1) * -0.25;
    m.position.set(bx, 0.6, 1.0);   // 初始低位
    m.scale.setScalar(0.01);
    scene.add(m);
    cards.push({ m, idx: i, bx, by, bz, baseRotZ: -(i - 1) * 0.16, tiltX: -0.92, appear: 0, delay: i * 0.13 });
  });
  return { cards, t: 0, chosen: -1, done: false };
}

function eOutBack(p: number){ const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }

/** 每帧推进；收场后 return true（此时可清理 Loot）。dt 建议先 Math.min(0.05, realDt)。 */
export function updateLoot(scene: THREE.Scene, L: Loot, dt: number): boolean {
  L.t += dt;
  for (const c of L.cards) {
    const m = c.m;
    if (L.chosen < 0) {
      // 出现 + 待机摆动
      if (L.t > c.delay) {
        c.appear = Math.min(1, c.appear + dt / 0.5);
        const k = eOutBack(c.appear);
        m.scale.setScalar(Math.max(0.01, k));
        m.position.x = 0 + (c.bx - 0) * k;
        m.position.y = 0.6 + (c.by - 0.6) * k;
        m.position.z = 1.0 + (c.bz - 1.0) * k;
      }
      const wob = Math.sin(L.t * 1.6 + c.idx) * 0.18;
      m.rotation.set(c.tiltX, wob, c.baseRotZ + Math.sin(L.t * 1.2 + c.idx) * 0.04);
      m.position.y = c.by + Math.sin(L.t * 1.5 + c.idx * 1.3) * 0.12 * c.appear;
    } else {
      const chosen = c.idx === L.chosen;
      if (chosen) {
        c.pk = Math.min(1, (c.pk || 0) + dt / 1.25);
        const e = c.pk < 0.5 ? 4 * c.pk ** 3 : 1 - Math.pow(-2 * c.pk + 2, 3) / 2; // easeInOutCubic
        const tx = 0, ty = 3.0, tz = 5.6;
        m.position.set(
          c.sp!.x + (tx - c.sp!.x) * e,
          c.sp!.y + (ty - c.sp!.y) * e,
          c.sp!.z + (tz - c.sp!.z) * e,
        );
        const yaw = c.sr! * (1 - e) + (Math.PI * 4) * e; // 两整圈，末尾正面朝前
        m.rotation.set(c.tiltX + (-0.62 - c.tiltX) * e, yaw, 0);
        m.scale.setScalar(c.ss! + (1.9 - c.ss!) * e);
        if (c.pk >= 1) m.position.y = ty + Math.sin(L.t * 1.6) * 0.07; // 到位后轻浮
      } else {
        c.pk = Math.min(1, (c.pk || 0) + dt / 0.4);
        m.scale.setScalar(Math.max(0.001, 1 - c.pk));
        m.position.x += (m.position.x >= 0 ? 1 : -1) * dt * 3.5;
        m.position.y -= dt * 2.4;
        m.rotation.y += dt * 5;
      }
    }
  }
  // 选中张到位 → hold 1.7s → 淡出收场
  if (L.chosen >= 0) {
    const ch = L.cards[L.chosen];
    if ((ch.pk || 0) >= 1) {
      L.hold = (L.hold || 0) + dt;
      if (L.hold > 1.7) {
        ch.out = Math.min(1, (ch.out || 0) + dt / 0.45);
        ch.m.scale.setScalar(Math.max(0.001, 1.9 * (1 - ch.out)));
        ch.m.position.y += dt * 1.6;
        if (ch.out >= 1 && !L.done) {
          L.done = true;
          L.cards.forEach(c => scene.remove(c.m));
          return true;
        }
      }
    }
  }
  return false;
}

/** 选定第 i 张：先快照所有卡当前姿态，再设 chosen。 */
export function pickLoot(L: Loot, i: number) {
  if (L.chosen >= 0) return;
  for (const c of L.cards) { c.sp = c.m.position.clone(); c.sr = c.m.rotation.y; c.ss = c.m.scale.x; }
  L.chosen = i;
}

/** 画布点击 → 命中卡牌则拾取。canvas 为渲染 canvas，cam 为该场景相机。 */
export function handleLootClick(e: MouseEvent, canvas: HTMLCanvasElement, cam: THREE.Camera, L: Loot | null) {
  if (!L || L.chosen >= 0) return;
  const r = canvas.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
  const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(nx, ny), cam);
  const hits = ray.intersectObjects(L.cards.map(c => c.m));
  if (hits.length) pickLoot(L, (hits[0].object as THREE.Mesh).userData.loot);
}
