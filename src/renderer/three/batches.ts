import * as THREE from 'three';
import type { Mesh3D } from '@engine/protocol/components.js';
import type { Renderable } from '../renderable.js';
import type { Pose3D } from '../three-projection.js';
import { applyPose, buildInstancedMesh3DGeometry } from './geometry.js';

// ═══════════════════════════════════════════════════════════════
//  three/InstancedBatches —— W1-A 实例化绘制子系统。
//  同视觉签名（mesh3dBatchKey）的多个 Mesh3D → 一个 InstancedMesh（1 draw call）。逐面色已烤进几何
//  vertexColors（同签名共享几何/材质）。每帧只写 instanceMatrix（一次 buffer 上传·复用 dummy 合矩阵·不 new）。
// ═══════════════════════════════════════════════════════════════

export type InstGroups = Map<string, { r: Renderable; pose: Pose3D }[]>;

export class InstancedBatches {
  private readonly batches = new Map<string, { mesh: THREE.InstancedMesh; cap: number }>();
  private readonly dummy = new THREE.Object3D(); // 复用的位姿合成临时对象（别每帧每实体 new）

  get count(): number {
    return this.batches.size;
  }

  get instances(): number {
    let n = 0;
    for (const [, b] of this.batches) n += b.mesh.count;
    return n;
  }

  // 脏帧写所有批的 instanceMatrix + 移除空批。每批：ensure（首建/扩容）→ 逐实例合矩阵 setMatrixAt → 设 count + needsUpdate。
  sync(scene: THREE.Scene, groups: InstGroups): void {
    for (const [key, list] of groups) {
      const batch = this.ensure(scene, key, list[0]!.r.mesh3d!, list.length);
      for (let i = 0; i < list.length; i++) {
        applyPose(this.dummy, list[i]!.pose);
        this.dummy.updateMatrix();
        batch.mesh.setMatrixAt(i, this.dummy.matrix);
      }
      batch.mesh.count = list.length;
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const [key, b] of this.batches) {
      if (!groups.has(key)) {
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.batches.delete(key);
      }
    }
  }

  dispose(scene: THREE.Scene): void {
    for (const [, b] of this.batches) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    this.batches.clear();
  }

  // 建/复用批：签名编码几何+逐面色（烤进 vertexColors），同签名共享一个 InstancedMesh。超容量 ×2 扩容重建（摊还）。
  // frustumCulled=false——实例散布全场，按单实例包围盒剔会误剔整批。
  private ensure(scene: THREE.Scene, key: string, sample: Mesh3D, needed: number): { mesh: THREE.InstancedMesh; cap: number } {
    const existing = this.batches.get(key);
    if (existing && needed <= existing.cap) return existing;
    if (existing) { scene.remove(existing.mesh); existing.mesh.geometry.dispose(); (existing.mesh.material as THREE.Material).dispose(); }
    const cap = Math.max(needed, existing ? existing.cap * 2 : 8);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }); // 不透明·哑光
    if (sample.shape === 'plane') mat.side = THREE.DoubleSide;
    const mesh = new THREE.InstancedMesh(buildInstancedMesh3DGeometry(sample), mat, cap);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const batch = { mesh, cap };
    this.batches.set(key, batch);
    scene.add(mesh);
    return batch;
  }
}
