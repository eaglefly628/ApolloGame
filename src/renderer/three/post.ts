import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import type { Post3D } from '@engine/protocol/components.js';

// 色彩分级 shader（绘本调色板·TA Phase 4）：曝光×→亮度+→对比(绕中灰)→饱和(向亮度 mix)→染色×。
const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    exposure: { value: 1 }, contrast: { value: 1 }, saturation: { value: 1 }, brightness: { value: 0 },
    tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float exposure, contrast, saturation, brightness; uniform vec3 tint;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * exposure + brightness;
      col = (col - 0.5) * contrast + 0.5;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation) * tint;
      gl_FragColor = vec4(col, c.a);
    }`,
};

// ═══════════════════════════════════════════════════════════════
//  three/PostPipeline —— 后处理子系统（EffectComposer·懒建）。
//  RenderPass → GTAO(环境光遮蔽) → 水平+垂直移轴 ShaderPass(tilt-shift) → UnrealBloom → OutputPass。
//  各 pass 的开关/参数每帧据 Post3D 数据设（不重建·只改 uniform/enabled）。无 Post3D 时整条管线不建。
// ═══════════════════════════════════════════════════════════════

export class PostPipeline {
  private composer?: EffectComposer;
  private renderPass?: RenderPass;
  private gtao?: GTAOPass;
  private hTilt?: ShaderPass;
  private vTilt?: ShaderPass;
  private bloom?: UnrealBloomPass;
  private grade?: ShaderPass;
  private smaa?: SMAAPass;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly width: number,
    private readonly height: number,
  ) {}

  // 据 Post3D 渲染一帧（懒建管线 + 设参数 + composer.render）。camera 可能在透视/正交间切换 → 每帧更新 RenderPass。
  render(scene: THREE.Scene, camera: THREE.Camera, post: Post3D): void {
    this.ensure(scene, camera);
    this.renderPass!.camera = camera;
    // 环境光遮蔽（GTAO·接触阴影/缝隙压暗）。相机可能透视/正交切换 → 每帧更新。
    const ao = post.ao;
    this.gtao!.enabled = !!ao;
    if (ao) {
      this.gtao!.camera = camera;
      this.gtao!.blendIntensity = ao.intensity ?? 1;
      this.gtao!.updateGtaoMaterial({ radius: ao.radius ?? 4, scale: ao.scale ?? 1 });
    }
    const ts = post.tiltShift;
    const tsOn = !!ts;
    this.hTilt!.enabled = tsOn;
    this.vTilt!.enabled = tsOn;
    if (ts) {
      const focus = ts.focus ?? 0.5;
      const intensity = ts.intensity ?? 3;
      this.hTilt!.uniforms['r']!.value = focus;
      this.hTilt!.uniforms['h']!.value = intensity / this.width;
      this.vTilt!.uniforms['r']!.value = focus;
      this.vTilt!.uniforms['v']!.value = intensity / this.height;
    }
    const bl = post.bloom;
    this.bloom!.enabled = !!bl;
    if (bl) {
      this.bloom!.strength = bl.strength ?? 0.6;
      this.bloom!.radius = bl.radius ?? 0.4;
      this.bloom!.threshold = bl.threshold ?? 0.85;
    }
    // 色彩分级（绘本调色板）。
    const gr = post.grade;
    this.grade!.enabled = !!gr;
    if (gr) {
      const u = this.grade!.uniforms;
      u['exposure']!.value = gr.exposure ?? 1;
      u['contrast']!.value = gr.contrast ?? 1;
      u['saturation']!.value = gr.saturation ?? 1;
      u['brightness']!.value = gr.brightness ?? 0;
      (u['tint']!.value as THREE.Color).setHex((gr.tint ?? 0xffffff) & 0xffffff);
    }
    // 抗锯齿（SMAA·清 toon 硬边）。
    this.smaa!.enabled = !!post.aa;
    this.composer!.render();
  }

  private ensure(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.composer) {
      // 场景/相机对象在 init 后稳定，RenderPass 持引用即可（盒庭单场景单相机）。
      return;
    }
    const composer = new EffectComposer(this.gl);
    composer.setSize(this.width, this.height);
    this.renderPass = new RenderPass(scene, camera);
    composer.addPass(this.renderPass);
    // GTAO：在 beauty 之后算 AO 并叠加压暗（output=Default·blendIntensity 控强度）。
    const gtao = new GTAOPass(scene, camera, this.width, this.height);
    gtao.output = GTAOPass.OUTPUT.Default;
    composer.addPass(gtao);
    const h = new ShaderPass(HorizontalTiltShiftShader);
    const v = new ShaderPass(VerticalTiltShiftShader);
    composer.addPass(h);
    composer.addPass(v);
    const bloom = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 0.6, 0.4, 0.85);
    composer.addPass(bloom);
    const grade = new ShaderPass(ColorGradeShader);
    composer.addPass(grade);
    composer.addPass(new OutputPass());
    const smaa = new SMAAPass(); // 末端抗锯齿（作用于 LDR 输出）
    composer.addPass(smaa);
    this.composer = composer;
    this.gtao = gtao; this.hTilt = h; this.vTilt = v; this.bloom = bloom; this.grade = grade; this.smaa = smaa;
  }

  dispose(): void {
    this.composer?.dispose();
    this.composer = undefined;
  }
}
