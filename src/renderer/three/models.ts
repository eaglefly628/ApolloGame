import * as THREE from 'three';
import { GLTFLoader, type GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { Model3D, AnimState3D, AnimGraph3D } from '@engine/protocol/components.js';
import type { AssetManager } from '@assets/index.js';
import { isModelHandle } from '@assets/index.js';
import { ModelCodecs } from './model-codecs.js';
import { AnimationGraphController } from './animation-graph.js';
import { bindSkeletalClip, captureSkeletonRest, extractSkeletalClip, snapshotSkeletalGlb, type SkeletalClip, type SkeletonRest } from './skeletal-clips.js';
import { validateAnimGraph3D } from '@engine/protocol/components/anim-graph.js';

// ═══════════════════════════════════════════════════════════════
//  three/ModelPool —— 导入式 glTF 模型 + **骨骼动画** 子系统。
//  按 modelKey 取 ArrayBuffer 字节（AssetManager）→ GLTFLoader.parse 一次入模板缓存（含动画 clip）→ 多实例
//  **SkeletonUtils.clone**（正确克隆骨架/蒙皮·每实例独立动画）。挂 AnimState3D 的实体建 AnimationMixer 播指定 clip。
//  未就绪本帧不画（向后兼容·同 sprite 先例）。纯表现·不写 sim/hash。
// ═══════════════════════════════════════════════════════════════

interface Tpl { scene: THREE.Object3D; clips: THREE.AnimationClip[]; resources: ModelResources; nodes: ReadonlyMap<number, THREE.Object3D>; rest: SkeletonRest; } // 模板：场景图 + glTF 动画
interface GraphAnim { signature: string; graph: AnimGraph3D; params: Readonly<Record<string, number | string | boolean | undefined>>; dependencies: ReadonlySet<string>; controller?: AnimationGraphController; failed?: boolean; }
interface Anim { mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[]; clip?: string; action?: THREE.AnimationAction; }

// Instance identity is separate from modelKey resource ownership (R4).
export function modelSelectorSig(model: Model3D): string {
  return JSON.stringify([model.modelKey, model.nodeIndex ?? null, model.excludeNodes ?? [], model.origin ?? []]);
}

function skeletonsOf(object: THREE.Object3D): Set<THREE.Skeleton> {
  const skeletons = new Set<THREE.Skeleton>();
  object.traverse(node => { const skeleton = (node as THREE.SkinnedMesh).skeleton; if (skeleton) skeletons.add(skeleton); });
  return skeletons;
}

function cloneSelection(tpl: Tpl, model: Model3D): THREE.Object3D {
  // Clone the full tree first so SkeletonUtils can resolve all bone references.
  const cloned = cloneSkinned(tpl.scene);
  const clones = new Map<THREE.Object3D, THREE.Object3D>();
  const pair = (source: THREE.Object3D, copy: THREE.Object3D): void => {
    clones.set(source, copy);
    source.children.forEach((child, i) => pair(child, copy.children[i]));
  };
  pair(tpl.scene, cloned);
  const skeletons = skeletonsOf(cloned);
  const node = (index: number): THREE.Object3D => {
    const source = tpl.nodes.get(index), result = source && clones.get(source);
    if (!result) {
      for (const skeleton of skeletons) skeleton.dispose();
      throw new Error(`ModelPool: model "${model.modelKey}" has no glTF node ${index} in its selected scene`);
    }
    return result;
  };
  const selected = model.nodeIndex === undefined ? cloned : node(model.nodeIndex);
  // Resolve exclusions before pruning, since a selected node can itself be excluded.
  const excluded = (model.excludeNodes ?? []).map(node);
  let object = cloned;
  if (model.nodeIndex !== undefined || model.origin !== undefined) {
    object = new THREE.Group(); // Renderer applies entity pose only to this outer object.
    const offset = new THREE.Group();
    offset.position.set(-(model.origin?.[0] ?? 0), -(model.origin?.[1] ?? 0), -(model.origin?.[2] ?? 0));
    object.add(offset);
    if (model.nodeIndex !== undefined) {
      const source = tpl.nodes.get(model.nodeIndex)!;
      tpl.scene.updateWorldMatrix(true, true);
      // Parent rotation + nonuniform scale may produce shear. Keep the complete
      // matrix rather than decomposing it into lossy Euler/scale components.
      const ancestors = new THREE.Group();
      ancestors.matrixAutoUpdate = false;
      if (source.parent) ancestors.matrix.copy(source.parent.matrixWorld);
      offset.add(ancestors);
      ancestors.add(selected);
    } else offset.add(cloned);
  }
  for (const removed of excluded) {
    // Excluding an ancestor of a selected node must also exclude that selection,
    // even though it has now been detached from its cloned ancestor hierarchy.
    const source = tpl.nodes.get(model.nodeIndex ?? -1);
    let excludesSelection = false;
    for (let ancestor = source; ancestor; ancestor = ancestor.parent ?? undefined) {
      if (clones.get(ancestor) === removed) { excludesSelection = true; break; }
    }
    if (excludesSelection) selected.removeFromParent();
    else removed.removeFromParent();
  }
  const retained = skeletonsOf(object);
  for (const skeleton of skeletons) if (!retained.has(skeleton)) skeleton.dispose();
  return object;
}

// Own parser resources before the full scene is ready: a failed/cancelled parse
// may already have decoded geometry or textures while another dependency waits.
class ModelResources {
  private closed = false;
  private readonly resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.Skeleton>();
  private readonly released = new WeakSet<object>();
  private readonly images = new WeakSet<object>();
  private readonly imageURLs = new Set<string>();

  private revokeImageURL(url: string): void {
    if (this.imageURLs.delete(url)) URL.revokeObjectURL(url);
  }

  private remember(resource: THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.Skeleton): void {
    if (this.closed) this.release(resource);
    else this.resources.add(resource);
  }

  private material(material: THREE.Material): void {
    for (const value of Object.values(material)) if (value?.isTexture) this.remember(value as THREE.Texture);
    this.remember(material);
  }

  capture(object: THREE.Object3D): void {
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) this.remember(mesh.geometry);
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) this.material(material);
      const skeleton = (node as THREE.SkinnedMesh).skeleton;
      if (skeleton) this.remember(skeleton);
    });
  }

  observe(parser: GLTFParser): void {
    const geometries = parser.loadGeometries.bind(parser);
    parser.loadGeometries = (...args) => geometries(...args).then((result) => {
      for (const geometry of result) this.remember(geometry);
      return result;
    });
    const material = parser.loadMaterial.bind(parser);
    parser.loadMaterial = (...args) => material(...args).then((result) => { this.material(result); return result; });
    const image = parser.loadImageSource.bind(parser);
    parser.loadImageSource = (sourceIndex, loader) => {
      const source = parser.json.images[sourceIndex];
      const pending: Promise<THREE.Texture> = source.bufferView === undefined
        ? image(sourceIndex, loader)
        : parser.getDependency('bufferView', source.bufferView).then((buffer: ArrayBuffer) => {
          if (this.closed) throw new Error('ModelPool: image parse generation disposed');
          // r184 loadImageSource only revokes its embedded Blob URL on success.
          // Own the URL here so failure and a terminated worker's never-settled
          // promise are both covered. Its sourceDef is read synchronously; use a
          // parser-local copy and restore the original before any async work.
          const url = URL.createObjectURL(new Blob([buffer], { type: source.mimeType }));
          this.imageURLs.add(url);
          parser.json.images[sourceIndex] = { ...source, bufferView: undefined, uri: url };
          let result: Promise<THREE.Texture>;
          try { result = image(sourceIndex, loader); }
          catch (error) { this.revokeImageURL(url); throw error; }
          finally { parser.json.images[sourceIndex] = source; }
          return result.finally(() => this.revokeImageURL(url));
        });
      return pending.then((result) => { this.remember(result); return result; });
    };
    const dependency = parser.getDependency.bind(parser);
    parser.getDependency = (...args) => dependency(...args).then((result) => {
      if (result?.isObject3D) this.capture(result as THREE.Object3D);
      if (result?.isTexture) this.remember(result as THREE.Texture);
      return result;
    });
    const texture = parser.loadTextureImage.bind(parser);
    parser.loadTextureImage = (...args) => texture(...args).then((result) => {
      // r184's loadTextureImage catches decoder errors and returns null. BasisU
      // must fail the model, rather than silently display an untextured mesh.
      if (!result && parser.json.textures?.[args[0]]?.extensions?.['KHR_texture_basisu']) {
        throw new Error('ModelPool: KTX2 texture failed to load or transcode');
      }
      if (result) this.remember(result);
      return result;
    });
  }

  private release(resource: THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.Skeleton): void {
    if (this.released.has(resource)) return;
    this.released.add(resource);
    resource.dispose();
    if ((resource as THREE.Texture).isTexture) {
      const image: unknown = (resource as THREE.Texture).source?.data;
      if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap && !this.images.has(image)) {
        this.images.add(image);
        image.close();
      }
    }
  }

  dispose(): void {
    this.closed = true;
    for (const url of this.imageURLs) this.revokeImageURL(url);
    for (const resource of this.resources) this.release(resource);
    this.resources.clear();
  }
}

// 真正在播动画的模型数（RENDERHYG fix②）：有 clip 但 action 未播 / 已 clampWhenFinished 停 → **不算**——
// 修「带 clip 的静态模型令 `animLive>0` 永久失效脏标跳渲 + 每帧刷阴影」。`isRunning()` 精确：循环恒 true
// （一直算 live·不会冻结正在播的）·一次性 clip 播完 paused → false（脏标可歇）。纯函数（无 GL·可单测）。
export function countRunningAnims(anims: Iterable<{ action?: { isRunning(): boolean } }>): number {
  let n = 0;
  for (const an of anims) if (an.action?.isRunning()) n++;
  return n;
}

export class ModelPool {
  private gltf?: GLTFLoader; // 懒建
  private codecs?: ModelCodecs;
  private unsubscribeEviction?: () => void;
  // Resource owner identity is also the parse token. A released key can start a
  // new parse while an old callback is still waiting on its decoder.
  private readonly parsing = new Map<string, ModelResources>();
  private readonly instances = new Map<string, THREE.Object3D>(); // 每实体已放置的实例（template 的 clone）
  private readonly mats = new Map<string, THREE.Material[]>(); // 每实例自有材质（clone 出·供染色/独立释放）
  private readonly keyOf = new Map<string, string>(); // 实体当前 modelKey（变了才重建实例）
  private readonly selectorOf = new Map<string, string>(); // selector 改变也须重建，不改变模板按 key 的归属
  private readonly cache = new Map<string, Tpl>(); // 按 modelKey 的已解析模板（解析一次·多实例 clone）
  private readonly state = new Map<string, 'pending' | 'failed'>(); // 解析中/失败（避免每帧重复 parse）
  private readonly anims = new Map<string, Anim>(); // 每实体骨骼动画混合器（模型有 clip 时）
  private readonly graphs = new Map<string, GraphAnim>();
  private readonly rejectedGraphs = new Map<string, unknown>();
  private readonly motions = new Map<string, SkeletalClip>();
  private readonly motionParsing = new Map<string, ModelResources>();
  private readonly motionState = new Map<string, 'pending' | 'failed'>();
  private readonly missingMotions = new Set<string>();
  private dirty = false; // Last pose, async readiness and binding removal invalidate once.
  private lastMs = 0; // 上次推进的壁钟（算 mixer delta）

  constructor(private readonly assets?: AssetManager, private readonly renderer?: THREE.WebGLRenderer) {}

  get count(): number {
    return this.instances.size;
  }

  /** Renderer-only lookup; never loads or pins an asset. */
  instance(entityId: string): THREE.Object3D | undefined { return this.instances.get(entityId); }

  // 建/复用实例：modelKey 不变则复用；变了拆旧建新。模板未就绪 → null（本帧不画）。tint 每帧由调用方设。
  ensure(scene: THREE.Scene, entityId: string, m: Model3D): THREE.Object3D | null {
    this.subscribeEviction();
    const prev = this.instances.get(entityId);
    const selector = modelSelectorSig(m);
    if (prev && this.selectorOf.get(entityId) === selector) return prev;
    if (prev) this.removeInstance(scene, entityId);
    const tpl = this.template(m.modelKey);
    if (!tpl) return null;
    const obj = cloneSelection(tpl, m);
    const mats: THREE.Material[] = [];
    const cloneMat = (src: THREE.Material): THREE.Material => { const c = src.clone(); mats.push(c); return c; };
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true; // 盒庭里模型与地台互投软影
      // r184 reuses a shared shadow material whose null-map transition can keep
      // a disposed template texture in its uniforms. Own shadow variants per
      // instance, just like the visible clone materials. Multi-material meshes
      // may still switch feature flags between groups, so invalidate that variant
      // only when those shader flags change.
      const depth = new THREE.MeshDepthMaterial(), distance = new THREE.MeshDistanceMaterial();
      mesh.customDepthMaterial = depth; mesh.customDistanceMaterial = distance;
      mats.push(depth, distance);
      const signatures = new WeakMap<THREE.Material, string>();
      const before = mesh.onBeforeShadow;
      mesh.onBeforeShadow = function (...args) {
        before.apply(this, args);
        const shadow = args[5] as THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial;
        const signature = JSON.stringify([!!shadow.map, !!shadow.alphaMap, !!shadow.displacementMap, shadow.alphaTest > 0, shadow.side, ('wireframe' in shadow ? shadow.wireframe : false), shadow.clippingPlanes?.length ?? 0, shadow.clipIntersection]);
        if (signatures.get(shadow) !== signature) {
          shadow.needsUpdate = true;
          signatures.set(shadow, signature);
        }
      };
      const src = mesh.material;
      mesh.material = Array.isArray(src) ? src.map(cloneMat) : cloneMat(src);
    });
    this.instances.set(entityId, obj);
    this.mats.set(entityId, mats);
    this.keyOf.set(entityId, m.modelKey);
    this.selectorOf.set(entityId, selector);
    if (tpl.clips.length > 0) this.anims.set(entityId, { mixer: new THREE.AnimationMixer(obj), clips: tpl.clips });
    scene.add(obj);
    return obj;
  }

  // 应用骨骼动画状态：clip 名变 → 淡入切新动作（旧的淡出·idle↔run 平滑过渡）；每帧设倍速/循环。模型无 clip 则 no-op。
  applyAnim(entityId: string, a: AnimState3D): void {
    this.clearGraph(entityId);
    const an = this.anims.get(entityId);
    if (!an) return;
    if (an.clip !== a.clip) {
      const clip = THREE.AnimationClip.findByName(an.clips, a.clip) ?? an.clips[0];
      if (!clip) return;
      const next = an.mixer.clipAction(clip);
      next.reset();
      next.setLoop(a.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = a.loop === false;
      next.fadeIn(0.25);
      next.play();
      if (an.action && an.action !== next) an.action.fadeOut(0.25);
      an.action = next;
      an.clip = a.clip;
    }
    if (an.action) an.action.timeScale = a.speed ?? 1;
  }

  applyGraph(entityId: string, graph: AnimGraph3D, params: Readonly<Record<string, number | string | boolean | undefined>>): void {
    if (!this.instances.has(entityId)) return;
    let signature: string, dependencies: ReadonlySet<string>;
    try {
      validateAnimGraph3D(graph);
      signature = JSON.stringify(graph);
      dependencies = new Set(Object.values(graph.clips).flatMap(c => c.asset ? [c.asset] : []));
      this.rejectedGraphs.delete(entityId);
    } catch (error) {
      this.clearGraph(entityId);
      let rejection: unknown = graph;
      try { rejection = JSON.stringify(graph); } catch { /* Cyclic invalid input retains identity. */ }
      if (!this.rejectedGraphs.has(entityId) || this.rejectedGraphs.get(entityId) !== rejection) {
        this.rejectedGraphs.set(entityId, rejection);
        console.warn(`[ModelPool] Rejected animation graph for "${entityId}"`, error);
      }
      return;
    }
    let entry = this.graphs.get(entityId);
    if (entry?.signature !== signature) {
      this.clearGraph(entityId);
      const legacy = this.anims.get(entityId);
      legacy?.mixer.stopAllAction();
      if (legacy) { legacy.action = undefined; legacy.clip = undefined; }
      entry = { signature, graph, params, dependencies };
      this.graphs.set(entityId, entry);
    }
    entry.params = params;
    this.buildGraph(entityId, entry);
  }

  clearGraph(entityId: string): void {
    const entry = this.graphs.get(entityId);
    if (!entry) return;
    entry.controller?.dispose();
    this.graphs.delete(entityId);
    this.dirty = true;
    for (const key of entry.dependencies) if (![...this.graphs.values()].some(other => other.dependencies.has(key))) this.missingMotions.delete(key);
  }

  private buildGraph(entityId: string, entry: GraphAnim): void {
    if (entry.controller || entry.failed) return;
    const object = this.instances.get(entityId), template = this.cache.get(this.keyOf.get(entityId) ?? '');
    if (!object || !template) return;
    try {
      validateAnimGraph3D(entry.graph);
      const clips = new Map<string, { clip: THREE.AnimationClip; loop: boolean }>();
      const external = new Map<string, SkeletalClip>();
      let waiting = false;
      for (const [alias, spec] of Object.entries(entry.graph.clips)) {
        if (spec.asset) {
          const source = this.motion(spec.asset);
          if (!source) {
            if (this.motionState.get(spec.asset) === 'failed') throw new Error(`external clip asset "${spec.asset}" was rejected`);
            waiting = true; continue;
          }
          external.set(alias, source);
        } else {
          const clip = template.clips.find(c => c.name === spec.clip);
          if (!clip) throw new Error(`model clip "${spec.clip}" was not found`);
          clips.set(alias, { clip, loop: true });
        }
      }
      if (waiting) return;
      for (const [alias, source] of external) clips.set(alias, { clip: bindSkeletalClip(source, entry.graph.clips[alias].clip, object, template.rest), loop: source.loop });
      entry.controller = new AnimationGraphController(object, entry.graph, clips);
      this.dirty = true;
    } catch (error) {
      entry.failed = true;
      console.warn(`[ModelPool] Rejected animation graph for "${entityId}"`, error);
    }
  }

  // Native legacy mixer behavior stays intact; graphs additionally report the
  // final changed pose so the renderer can stop only after drawing that pose.
  update(nowMs: number): number {
    const dt = this.lastMs ? Math.min(0.1, (nowMs - this.lastMs) / 1000) : 0;
    this.lastMs = nowMs;
    for (const [, an] of this.anims) an.mixer.update(dt);
    let active = countRunningAnims(this.anims.values());
    for (const [id, entry] of this.graphs) {
      this.buildGraph(id, entry);
      const result = entry.controller?.update(Math.max(0, Number.isFinite(dt) ? dt : 0), entry.params);
      if (result?.live || result?.changed) active++;
    }
    if (this.dirty) { active++; this.dirty = false; }
    return active;
  }

  // 整体染色（每帧·tint 变即反映）：把实例自有材质的 color 设成 hex。
  tint(entityId: string, hex: number): void {
    for (const mm of this.mats.get(entityId) ?? []) (mm as THREE.MeshStandardMaterial).color?.setHex(hex & 0xffffff);
  }

  // 移除本帧未见（消失）的实例。
  sweep(scene: THREE.Scene, seen: ReadonlySet<string>): void {
    for (const id of [...this.instances.keys()]) {
      if (!seen.has(id)) this.removeInstance(scene, id);
    }
  }

  private removeInstance(scene: THREE.Object3D | undefined, id: string): void {
    this.clearGraph(id);
    const obj = this.instances.get(id);
    if (obj) (obj.parent ?? scene)?.remove(obj);
    const mixer = this.anims.get(id)?.mixer;
    mixer?.stopAllAction();
    if (obj) {
      mixer?.uncacheRoot(obj);
      // SkeletonUtils clones skeletons, while geometry and material textures
      // remain template-owned. Bone textures belong to each cloned skeleton.
      for (const skeleton of skeletonsOf(obj)) skeleton.dispose();
    }
    for (const mm of this.mats.get(id) ?? []) mm.dispose();
    this.instances.delete(id);
    this.mats.delete(id);
    this.keyOf.delete(id);
    this.selectorOf.delete(id);
    this.anims.delete(id);
    this.rejectedGraphs.delete(id);
  }

  dispose(scene: THREE.Scene): void {
    this.unsubscribeEviction?.();
    this.unsubscribeEviction = undefined;
    for (const [id] of [...this.instances]) this.removeInstance(scene, id);
    for (const [, tpl] of this.cache) tpl.resources.dispose();
    for (const resources of this.parsing.values()) resources.dispose();
    this.parsing.clear();
    for (const resources of this.motionParsing.values()) resources.dispose();
    this.motionParsing.clear();
    this.motionState.clear();
    this.missingMotions.clear();
    this.motions.clear();
    this.graphs.clear();
    this.rejectedGraphs.clear();
    this.cache.clear();
    this.state.clear();
    this.codecs?.dispose();
    this.codecs = undefined;
    this.gltf = undefined;
    this.lastMs = 0;
    this.dirty = false;
  }

  private subscribeEviction(): void {
    // Older headless consumers expose only get(); disposal still works there.
    if (!this.unsubscribeEviction) this.unsubscribeEviction = this.assets?.onEvict?.(({ key }) => {
      for (const [id, modelKey] of this.keyOf) if (modelKey === key) this.removeInstance(undefined, id);
      this.cache.get(key)?.resources.dispose();
      this.cache.delete(key);
      this.parsing.get(key)?.dispose();
      this.parsing.delete(key);
      this.state.delete(key);
      this.motionParsing.get(key)?.dispose();
      this.motionParsing.delete(key);
      this.motionState.delete(key);
      this.missingMotions.delete(key);
      this.motions.delete(key);
      for (const entry of this.graphs.values()) if (entry.dependencies.has(key)) {
        entry.controller?.dispose(); entry.controller = undefined; entry.failed = false; this.dirty = true;
      }
    });
  }

  private motion(key: string): SkeletalClip | null {
    const ready = this.motions.get(key);
    if (ready) return ready;
    if (this.motionState.has(key)) return null;
    const asset = this.assets?.get(key);
    if (!asset) {
      if (!this.missingMotions.has(key)) { this.missingMotions.add(key); console.warn(`[ModelPool] Skipped skeletal-animation "${key}": asset is not loaded`); }
      return null;
    }
    this.missingMotions.delete(key);
    if (asset.descriptor?.kind !== 'skeletal-animation' || !isModelHandle(asset.handle)) {
      this.motionState.set(key, 'failed');
      console.warn(`[ModelPool] Rejected skeletal-animation "${key}": expected typed GLB bytes`);
      return null;
    }
    const descriptor = { ...asset.descriptor };
    const resources = new ModelResources();
    this.motionParsing.set(key, resources);
    this.motionState.set(key, 'pending');
    const failed = (error: unknown): void => {
      resources.dispose();
      if (this.motionParsing.get(key) !== resources) return;
      this.motionParsing.delete(key);
      this.motionState.set(key, 'failed');
      console.warn(`[ModelPool] Rejected skeletal-animation "${key}"`, error);
    };
    try {
      const bytes = snapshotSkeletalGlb(asset.handle);
      const codecs = this.codecs ??= new ModelCodecs(this.renderer);
      if (!this.gltf) { this.gltf = new GLTFLoader(); codecs.connect(this.gltf); }
      const loader = this.gltf;
      const plugin = (parser: GLTFParser) => {
        resources.observe(parser);
        return { name: 'APOLLO_motion_resources', beforeRoot: () => { codecs.prepare(parser); return null; } };
      };
      loader.register(plugin);
      try {
        loader.parse(bytes, '', gltf => {
          for (const scene of gltf.scenes ?? [gltf.scene]) resources.capture(scene);
          if (this.motionParsing.get(key) !== resources) { resources.dispose(); return; }
          try {
            const motion = extractSkeletalClip(gltf.scene, gltf.animations ?? [], descriptor, gltf.parser);
            resources.dispose();
            this.motionParsing.delete(key);
            this.motionState.delete(key);
            this.motions.set(key, motion);
            this.dirty = true;
          } catch (error) { failed(error); }
        }, failed);
      } finally { loader.unregister(plugin); }
    } catch (error) { failed(error); }
    return null;
  }

  // 按 modelKey 取已解析模板（含动画 clip）。首见且字节备好 → 异步 parse 一次（标 pending 防每帧重复）。
  private template(key: string): Tpl | null {
    const ready = this.cache.get(key);
    if (ready) return ready;
    if (this.state.get(key)) return null; // pending / failed
    const asset = this.assets?.get(key);
    if (asset?.descriptor && asset.descriptor.kind !== 'model') {
      this.state.set(key, 'failed');
      console.warn(`[ModelPool] Rejected model "${key}": asset kind is ${asset.descriptor.kind}`);
      return null;
    }
    const handle = asset?.handle;
    if (!isModelHandle(handle)) return null;
    this.state.set(key, 'pending');
    const resources = new ModelResources();
    this.parsing.set(key, resources);
    const failed = (error: unknown): void => {
      resources.dispose();
      if (this.parsing.get(key) !== resources) return;
      this.parsing.delete(key);
      this.state.set(key, 'failed');
      console.error(`[ModelPool] Failed to load model "${key}"`, error);
    };
    try {
      const codecs = this.codecs ??= new ModelCodecs(this.renderer);
      if (!this.gltf) { this.gltf = new GLTFLoader(); codecs.connect(this.gltf); }
      const loader = this.gltf;
      const plugin = (parser: GLTFParser) => {
        resources.observe(parser);
        return { name: 'APOLLO_model_resources', beforeRoot: () => { codecs.prepare(parser); return null; } };
      };
      loader.register(plugin);
      try {
        loader.parse(handle, '', (gltf) => {
          for (const scene of gltf.scenes ?? [gltf.scene]) resources.capture(scene);
          if (this.parsing.get(key) !== resources) { resources.dispose(); return; }
          this.parsing.delete(key);
          const nodes = new Map<number, THREE.Object3D>();
          gltf.scene.traverse(object => {
            const index = gltf.parser?.associations?.get(object)?.nodes;
            if (index !== undefined) nodes.set(index, object);
          });
          this.cache.set(key, { scene: gltf.scene, clips: gltf.animations ?? [], resources, nodes, rest: captureSkeletonRest(gltf.scene, gltf.parser) });
          this.state.delete(key);
        }, failed);
      } finally { loader.unregister(plugin); }
    } catch (error) { failed(error); }
    return null;
  }
}
