import * as THREE from 'three';
import type { IWorld } from '@engine/core/types.js';
import type { Material3D } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  three/dissolve —— 溶解消散材质效果（Material3D.dissolve·render-only·REQ-3D-DISSOLVE）。
//  给已建材质注入一段 shader（onBeforeCompile·同 outline 先例）：**屏幕空间**算距离场（图案/形状按数据变体在
//  build 期烤进 GLSL），按 progress 阈值 discard 溶解，溶解前沿飘一条**发光条带**。voronoi 图案 = 动画种子点 →
//  边缘星星点点「光点消散」（shader 算·省真粒子·文章 mp.weixin 移植）。自由 GLSL 只活在此引擎解释器·游戏只填数据。
//  `DissolveSystem` 每帧推进 progress/time uniform（同 UvAnimSystem 时间驱动先例·live>0 令渲染器持续重渲）。
// ═══════════════════════════════════════════════════════════════

type Dissolve = NonNullable<Material3D['dissolve']>;

// 距离度量表达式（按 shape 在 build 期烤进·避免运行时分支/dynamic pow）。d=种子点→片元向量。
const DIST_EXPR: Record<NonNullable<Dissolve['shape']>, string> = {
  euclid: 'length(d)',
  manhattan: 'abs(d.x)+abs(d.y)',
  chebyshev: 'max(abs(d.x),abs(d.y))',
  star: 'lStar(d,5.0,0.5)',
};

// build 期确定的 shader 变体签名（进 pbrSig·变则重建材质）。progress/time 是 uniform·不进签名（每帧活更新）。
export function dissolveSig(d: Dissolve): string {
  return `${d.pattern ?? 'voronoi'}|${d.shape ?? 'euclid'}`;
}

// GLSL 头（hash/星形多边形/距离场函数·屏幕空间 voronoi 或平滑噪声）。pattern/shape 烤进。
function dissolveGLSL(d: Dissolve): string {
  const pattern = d.pattern ?? 'voronoi';
  const distExpr = DIST_EXPR[d.shape ?? 'euclid'];
  const star = (d.shape ?? 'euclid') === 'star';
  return /* glsl */ `
    uniform float uDisProgress; uniform float uDisTime; uniform float uDisScale;
    uniform float uDisSpeed; uniform float uDisEdge; uniform vec3 uDisEdgeColor; uniform float uDisGlow;
    float dHash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    ${star ? /* glsl */ `
    float lPoly(vec2 p,float n){ float a=atan(p.x,p.y)+3.14159265; float r=6.2831853/n; return cos(floor(0.5+a/r)*r-a)*length(p); }
    float lStar(vec2 p,float n,float o){ float c=cos(3.14159265/n),s=sin(3.14159265/n); mat2 R=mat2(c,-s,s,c); return (lPoly(p,n)-lPoly(R*p,n)*o)/(1.0-o); }` : ''}
    ${pattern === 'noise' ? /* glsl */ `
    float dField(vec2 uv){ vec2 i=floor(uv),f=fract(uv); f=f*f*(3.0-2.0*f);
      float a=dHash21(i),b=dHash21(i+vec2(1,0)),c=dHash21(i+vec2(0,1)),e=dHash21(i+vec2(1,1));
      return mix(mix(a,b,f.x),mix(c,e,f.x),f.y); }` : /* glsl */ `
    float dField(vec2 uv){ vec2 g=floor(uv); float md=1e9;
      for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
        vec2 nc=g+vec2(float(x),float(y)); float r1=dHash21(nc), r2=dHash21(nc+0.1);
        vec2 seed=nc+0.5+vec2(cos(r1*6.2831853+uDisTime*uDisSpeed),sin(r1*6.2831853+uDisTime*uDisSpeed))*0.5*sqrt(r2);
        vec2 d=seed-uv; md=min(md, ${distExpr}); }
      return 1.0-clamp(md,0.0,1.0); }`}
  `;
}

// 片元段：屏幕空间算 field → 阈值 discard + 发光前沿条带（改 gl_FragColor）。keep if field>progress。
const DISSOLVE_FRAG = /* glsl */ `
  #include <dithering_fragment>
  {
    float field = dField(gl_FragCoord.xy / max(uDisScale, 1.0));
    float ew = max(uDisEdge, 0.001);
    float a = smoothstep(uDisProgress - ew, uDisProgress + ew, field); // >progress → 1(留)·<progress → 0(溶)
    if (a <= 0.003) discard;                                            // 已溶解 → 丢弃片元
    float front = pow(1.0 - a, 2.0);                                    // 溶解前沿越近越亮
    gl_FragColor.rgb += uDisEdgeColor * (uDisGlow * front);            // 发光条带（加性）
  }
`;

// 给材质注入溶解 shader + 把 uniform 存到 userData（供 DissolveSystem 每帧更新 progress/time）。
export function injectDissolve(mat: THREE.Material, d: Dissolve): void {
  const u = {
    uDisProgress: { value: Math.max(0, Math.min(1, d.progress ?? 0)) },
    uDisTime: { value: 0 },
    uDisScale: { value: d.scale ?? 44 },
    uDisSpeed: { value: d.speed ?? 1 },
    uDisEdge: { value: d.edge ?? 0.1 },
    uDisEdgeColor: { value: new THREE.Color((d.edgeColor ?? 0xffa030) & 0xffffff) },
    uDisGlow: { value: d.glow ?? 1.6 },
  };
  mat.userData['dissolveUniforms'] = u;
  const glsl = dissolveGLSL(d);
  const prevOBC = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prevOBC?.(shader, renderer); // 叠加于既有注入（如 outline·别覆盖）
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = glsl + shader.fragmentShader.replace('#include <dithering_fragment>', DISSOLVE_FRAG);
  };
  mat.needsUpdate = true;
}

interface DState { t0: number; lastTrigger?: number; }

export class DissolveSystem {
  private readonly regs = new Map<string, DState>();

  // 逐帧推进 dissolve 的 progress/time uniform（须在 mesh 建好后·renderSig 前）。返回**活跃 dissolve 实体数**
  // （>0 → 渲染器持续重渲·溶解动画/光点浮动在跑）。trigger 驱动=引擎自播 0→1（out）/1→0（in）；否则用显式 progress。
  sync(world: IWorld, meshes: ReadonlyMap<string, THREE.Mesh>, nowMs: number): number {
    const seen = new Set<string>();
    let live = 0;
    for (const [id] of world.query('Material3D')) {
      const mat3 = world.getComponent<Material3D>(id, 'Material3D');
      const d = mat3?.dissolve;
      if (!d) continue;
      const mesh = meshes.get(id);
      const u = (mesh?.material as THREE.Material | undefined)?.userData?.['dissolveUniforms'] as
        | { uDisProgress: { value: number }; uDisTime: { value: number } } | undefined;
      if (!u) continue; // 材质未建/未注入（如首帧编译前）→ 跳过
      seen.add(id);
      let reg = this.regs.get(id);
      if (!reg) { reg = { t0: nowMs }; this.regs.set(id, reg); }
      // 触发驱动：trigger 变（bump）→ 重置起点自播（首见=基线不自播·同 flash/impulse 先例）。
      if (d.trigger !== undefined && d.trigger !== reg.lastTrigger) {
        if (reg.lastTrigger !== undefined) reg.t0 = nowMs; // 非首见 → 重新起播
        reg.lastTrigger = d.trigger;
      }
      let progress: number;
      let animating = false;
      if (d.trigger !== undefined && reg.lastTrigger !== undefined) {
        const dur = Math.max(0.05, d.dur ?? 1.2);
        const p = Math.min(1, (nowMs - reg.t0) / 1000 / dur);
        progress = d.direction === 'in' ? 1 - p : p; // out=0→1(缺省)·in=1→0
        animating = p < 1;
      } else {
        progress = Math.max(0, Math.min(1, d.progress ?? 0));
      }
      u.uDisProgress.value = progress;
      u.uDisTime.value = (nowMs - reg.t0) / 1000;
      // 活跃：正在自播动画，或 voronoi 光点在浮动（0<progress<1 有可见前沿在动）。
      if (animating || (progress > 0.001 && progress < 0.999)) live++;
    }
    for (const [id] of this.regs) if (!seen.has(id)) this.regs.delete(id);
    return live;
  }

  dispose(): void { this.regs.clear(); }
}
