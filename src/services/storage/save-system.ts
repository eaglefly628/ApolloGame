import type { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/index.js';
// 复用信封那套「坏档报错不静默」的异常类型：上层只需 catch 一种错就能覆盖两条存档路径。
// 直接引模块而非 barrel，避免 services 内部 barrel 相互引用成环（envelope 只依赖 save-port 类型）。
import { CorruptSaveError } from '../save/envelope.js';
import type { StoragePort, SaveGame, SaveMeta } from './storage-port.js';

// SaveSystem —— 存档系统（基础设施服务，sim 之外）。把 world.snapshot()/restore() 与 StoragePort 接起来：
// save = 快照 + 元数据(tick/hash/时间) → 端口；load = 端口取回 → world.restore()。具名槽位 + 列表 + 删除。
// 确定性：hash 用与 lockstep 守卫同一套；存档体是纯 POD。墙钟 timestamp 仅元数据、不进 sim。
export class SaveSystem {
  constructor(private readonly port: StoragePort) {}

  async save(slot: string, world: World, label?: string): Promise<SaveMeta> {
    const snapshot = world.snapshot();
    const meta: SaveMeta = {
      slot,
      tick: world.getVersion(),
      hash: hashSnapshot(snapshot),
      timestamp: Date.now(),
      label,
    };
    await this.port.save(slot, { meta, snapshot });
    return meta;
  }

  // 读档：恢复世界状态。成功返回元数据；槽位不存在返回 null；**hash 不符抛 CorruptSaveError**。
  //
  // 校验必须做、且必须在 restore 之前（engine-review-2026-08-04 §3.3 · P1）：
  // 旧实现存档时算了 hash 却从不校验（fail-open）——被 DevTools 篡改或落盘损坏的快照会**静默灌进
  // world**，与 storage-port 自述的「确定性指纹（校验/防篡改）」直接矛盾，且后果极隐蔽（世界带着
  // 坏状态继续跑，若是 lockstep 局则表现为莫名 desync）。放在 restore 前 = fail-closed：
  // 坏档一律不进 world，上层据异常提示「存档损坏」（同 envelope 的 owner 铁律：坏档报错不静默）。
  async load(slot: string, world: World): Promise<SaveMeta | null> {
    const data: SaveGame | null = await this.port.load(slot);
    if (!data) return null;
    const actual = hashSnapshot(data.snapshot);
    if (actual !== data.meta.hash) {
      throw new CorruptSaveError(
        `存档校验失败：槽位 "${slot}" 快照指纹不符（期望 ${data.meta.hash}，实为 ${actual}）——数据已损坏或被篡改`,
      );
    }
    world.restore(data.snapshot);
    return data.meta;
  }

  list(): Promise<SaveMeta[]> {
    return this.port.list();
  }

  delete(slot: string): Promise<void> {
    return this.port.delete(slot);
  }
}
