import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import type { Post3D } from '@engine/protocol/components.js';

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
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.gtao = gtao; this.hTilt = h; this.vTilt = v; this.bloom = bloom;
  }

  dispose(): void {
    this.composer?.dispose();
    this.composer = undefined;
  }
}
