import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Model3D } from '@engine/protocol/components.js';
import type { AssetManager } from '@assets/index.js';
import { isModelHandle } from '@assets/index.js';
import { disposeObject } from './geometry.js';

// ═══════════════════════════════════════════════════════════════
//  three/ModelPool —— 导入式 glTF 模型子系统。
//  按 modelKey 取 ArrayBuffer 字节（AssetManager）→ GLTFLoader.parse 一次入模板缓存 → 多实例 clone
//  （共享几何省显存·每实例 clone 材质供染色/独立释放）。未就绪本帧不画（向后兼容·同 sprite 先例）。
// ═══════════════════════════════════════════════════════════════

export class ModelPool {
  private gltf?: GLTFLoader; // 懒建
  private readonly instances = new Map<string, THREE.Object3D>(); // 每实体已放置的实例（template 的 clone）
  private readonly mats = new Map<string, THREE.Material[]>(); // 每实例自有材质（clone 出·供染色/独立释放）
  private readonly keyOf = new Map<string, string>(); // 实体当前 modelKey（变了才重建实例）
  private readonly cache = new Map<string, THREE.Object3D>(); // 按 modelKey 的已解析模板（解析一次·多实例 clone）
  private readonly state = new Map<string, 'pending' | 'failed'>(); // 解析中/失败（避免每帧重复 parse）

  constructor(private readonly assets?: AssetManager) {}

  get count(): number {
    return this.instances.size;
  }

  // 建/复用实例：modelKey 不变则复用；变了拆旧建新。模板未就绪 → null（本帧不画）。tint 每帧由调用方设。
  ensure(scene: THREE.Scene, entityId: string, m: Model3D): THREE.Object3D | null {
    const prev = this.instances.get(entityId);
    if (prev && this.keyOf.get(entityId) === m.modelKey) return prev;
    if (prev) {
      scene.remove(prev);
      for (const mm of this.mats.get(entityId) ?? []) mm.dispose();
      this.instances.delete(entityId);
      this.mats.delete(entityId);
    }
    const template = this.template(m.modelKey);
    if (!template) return null;
    const obj = template.clone(true);
    const mats: THREE.Material[] = [];
    const cloneMat = (src: THREE.Material): THREE.Material => { const c = src.clone(); mats.push(c); return c; };
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true; // 盒庭里模型与地台互投软影
      const src = mesh.material;
      mesh.material = Array.isArray(src) ? src.map(cloneMat) : cloneMat(src);
    });
    this.instances.set(entityId, obj);
    this.mats.set(entityId, mats);
    this.keyOf.set(entityId, m.modelKey);
    scene.add(obj);
    return obj;
  }

  // 整体染色（每帧·tint 变即反映）：把实例自有材质的 color 设成 hex。
  tint(entityId: string, hex: number): void {
    for (const mm of this.mats.get(entityId) ?? []) (mm as THREE.MeshStandardMaterial).color?.setHex(hex & 0xffffff);
  }

  // 移除本帧未见（消失）的实例：移出场景 + 释放实例自有材质（几何与模板共享·dispose 时随模板释放）。
  sweep(scene: THREE.Scene, seen: ReadonlySet<string>): void {
    for (const [id, obj] of this.instances) {
      if (seen.has(id)) continue;
      scene.remove(obj);
      for (const mm of this.mats.get(id) ?? []) mm.dispose();
      this.instances.delete(id);
      this.mats.delete(id);
      this.keyOf.delete(id);
    }
  }

  dispose(scene: THREE.Scene): void {
    for (const [id, obj] of this.instances) {
      scene.remove(obj);
      for (const mm of this.mats.get(id) ?? []) mm.dispose();
    }
    this.instances.clear();
    this.mats.clear();
    this.keyOf.clear();
    for (const [, tpl] of this.cache) disposeObject(tpl); // 模板：释放共享几何 + 模板自带材质
    this.cache.clear();
    this.state.clear();
  }

  // 按 modelKey 取已解析模板。首见且字节(ArrayBuffer)备好 → 异步 parse 一次（标 pending 防每帧重复）。
  // 未就绪/解析中/失败 → null。资产层尚未加载到字节时不标 pending，下帧重试。
  private template(key: string): THREE.Object3D | null {
    const ready = this.cache.get(key);
    if (ready) return ready;
    if (this.state.get(key)) return null; // pending / failed
    const handle = this.assets?.get(key)?.handle;
    if (!isModelHandle(handle)) return null;
    this.state.set(key, 'pending');
    (this.gltf ??= new GLTFLoader()).parse(
      handle,
      '',
      (gltf) => { this.cache.set(key, gltf.scene); this.state.delete(key); },
      () => { this.state.set(key, 'failed'); },
    );
    return null;
  }
}
