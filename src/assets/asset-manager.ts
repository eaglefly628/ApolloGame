import { parseSceneImportData, verifySceneImportBytes, type SceneImportCatalog } from './scene-import-data.js';
import type {
  AssetDescriptor,
  AssetEviction,
  AssetGroupProgress,
  AssetGroups,
  AnimationDescriptor,
  AssetHandle,
  AssetLoader,
  AssetManifest,
  FrameRef,
  LoadedAsset,
  ResolvedFrame,
} from './asset-types.js';
import { parseAssetGroups } from './asset-groups.js';

// AssetManager —— 表现层资产注册/加载/缓存/解析。
//
// 职责边界(重要)：只按 string key 工作，绝不接触 world / snapshot / hash。
// sim 产出 textureKey(字符串)，这里把 key 解析成「已加载资产 + 子矩形」交给渲染后端。
// 因此整个资产层可随意异步加载/缓存而不影响确定性与 lockstep。
//
// 解析统一抽象：无论 texture / atlas / sprite-sheet / prerendered-sequence，
// 最终都归约为「一张源图 + 一个源矩形(sx,sy,sw,sh)」。这层统一正是 3D→2D 离线
// 序列能当「又一种 kind」无缝接入的原因。

/** 无 I/O 的假加载器：headless / Node / 测试用。句柄是占位对象，尺寸取描述符声明或默认值。 */
export class StubAssetLoader implements AssetLoader {
  async load(descriptor: AssetDescriptor): Promise<{ handle: AssetHandle; width: number; height: number }> {
    const { width, height } = intrinsicSize(descriptor);
    return { handle: { stub: true, key: descriptor.key, kind: descriptor.kind }, width, height };
  }
}

/** 描述符的内在像素尺寸(不依赖真实图像) —— 供 stub 与整图帧解析。 */
function intrinsicSize(descriptor: AssetDescriptor): { width: number; height: number } {
  switch (descriptor.kind) {
    case 'texture':
      return { width: descriptor.width ?? 0, height: descriptor.height ?? 0 };
    case 'atlas': {
      // 取所有命名帧的包围尺寸作为整图近似(仅供 fallback；atlas 一般按帧名取)。
      let w = 0;
      let h = 0;
      for (const r of Object.values(descriptor.frames)) {
        w = Math.max(w, r.x + r.w);
        h = Math.max(h, r.y + r.h);
      }
      return { width: w, height: h };
    }
    case 'sprite-sheet':
    case 'prerendered-sequence': {
      const cols = Math.max(1, descriptor.columns);
      const rows = Math.ceil(descriptor.count / cols);
      return { width: cols * descriptor.frameWidth, height: rows * descriptor.frameHeight };
    }
    case 'model':
      return { width: 0, height: 0 }; // 模型无 2D 像素尺寸（句柄=字节，渲染线自解析包围盒）
  }
}

interface GroupAttempt {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (reason: unknown) => void;
}

interface GroupState {
  readonly keys: readonly string[];
  status: AssetGroupProgress['status'];
  holding: boolean;
  readonly successes: Set<string>;
  readonly errors: Map<string, string>;
  attempt?: GroupAttempt;
}

function assetErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function abortAssetGroup(id: string): Error {
  const error = new Error(`AssetManager: group "${id}" was released`);
  error.name = 'AbortError';
  return error;
}

export class AssetManager {
  private readonly descriptors = new Map<string, AssetDescriptor>();
  private readonly loaded = new Map<string, LoadedAsset>();
  private readonly inflight = new Map<string, { promise: Promise<LoadedAsset> }>();
  private readonly pins = new Set<string>();
  private readonly groups = new Map<string, GroupState>();
  private readonly groupRefs = new Map<string, number>();
  private readonly groupListeners = new Set<(progress: AssetGroupProgress) => void>();
  private readonly evictionListeners = new Set<(event: AssetEviction) => void>();
  // 命名动画剪辑（R9 增益 B）：逻辑分组、无物理图，故与描述符分开存；resolve 委托底层 atlas。
  private readonly animations = new Map<string, AnimationDescriptor>();

  constructor(private readonly loader: AssetLoader) {}

  /** 注册单个描述符(覆盖同 key)。注册不触发加载。 */
  register(descriptor: AssetDescriptor): void {
    const owned = descriptor.kind === 'model' && descriptor.scene ? { ...descriptor, scene: parseSceneImportData(descriptor.scene) } : descriptor;
    this.descriptors.set(descriptor.key, owned);
  }

  /** 注册一份清单(数据驱动，可来自 JSON)。 */
  registerManifest(manifest: AssetManifest): void {
    for (const d of manifest) this.register(d);
  }

  /** 注册命名动画剪辑（按 key；frames 引用底层 atlas 的命名帧）。无需加载（无自有图）。 */
  registerAnimation(anim: AnimationDescriptor): void {
    this.animations.set(anim.key, anim);
  }

  /** 是否已注册（描述符或动画剪辑）。 */
  has(key: string): boolean {
    return this.descriptors.has(key) || this.animations.has(key);
  }

  /** 是否已加载完成。 */
  isLoaded(key: string): boolean {
    return this.loaded.has(key);
  }

  /** 加载单个 key：旧 API 建立常驻 pin，直至 unload 或 clear。 */
  load(key: string): Promise<LoadedAsset> {
    if (!this.descriptors.has(key)) {
      console.warn(`AssetManager: reject load of unregistered physical asset ${JSON.stringify(key)}`);
      return Promise.reject(new Error(`AssetManager: 未注册的资产 key "${key}"`));
    }
    this.pins.add(key);
    return this.loadPhysical(key);
  }

  /** 组内装载不建立旧 API 的常驻 pin。request identity 隔离已失效 I/O。 */
  private loadPhysical(key: string): Promise<LoadedAsset> {
    const cached = this.loaded.get(key);
    if (cached) return Promise.resolve(cached);
    const existing = this.inflight.get(key);
    if (existing) return existing.promise;
    const descriptor = this.descriptors.get(key)!;
    let accept!: (result: { handle: AssetHandle; width: number; height: number }) => void;
    let fail!: (reason: unknown) => void;
    const io = new Promise<{ handle: AssetHandle; width: number; height: number }>((yes, no) => {
      accept = yes;
      fail = no;
    });
    const request = {} as { promise: Promise<LoadedAsset> };
    const acceptAsset = (asset: LoadedAsset): LoadedAsset => {
      if (this.inflight.get(key) === request) {
        this.loaded.set(key, asset);
        this.inflight.delete(key);
      } else {
        console.info(`AssetManager: discard stale asset result ${JSON.stringify(key)}`);
        this.releaseAsset(asset);
      }
      return asset;
    };
    const failAsset = (error: unknown): never => {
      if (this.inflight.get(key) === request) this.inflight.delete(key);
      else console.info(`AssetManager: discard stale asset failure ${JSON.stringify(key)}`);
      throw error;
    };
    const promise = io
      .then(({ handle, width, height }) => {
        const asset: LoadedAsset = { descriptor, handle, width, height };
        if (descriptor.kind === 'model' && descriptor.scene) {
          return verifySceneImportBytes(descriptor.scene, handle).then(
            scene => acceptAsset({ ...asset, scene }),
            error => { this.releaseAsset(asset); return failAsset(error); },
          );
        }
        return acceptAsset(asset);
      }, failAsset);
    request.promise = promise;
    this.inflight.set(key, request);
    // 保留旧 API 同步启动 I/O 的行为，同时把 loader 同步抛错归一成 Promise 拒绝。
    try { Promise.resolve(this.loader.load(descriptor)).then(accept, fail); }
    catch (error) { fail(error); }
    return promise;
  }

  /** 增量登记；整份配置先验证，失败不登记任何组，也不产生 I/O。 */
  registerGroups(raw: AssetGroups): void {
    const definitions = parseAssetGroups(raw);
    for (const [id, keys] of Object.entries(definitions)) {
      for (const key of keys) {
        if (!this.descriptors.has(key)) {
          console.warn(`AssetManager: reject group "${id}": unregistered physical asset ${JSON.stringify(key)}`);
          throw new Error(`AssetManager: group "${id}" references unregistered physical asset "${key}"`);
        }
      }
      const current = this.groups.get(id);
      if (current && !this.sameKeys(current.keys, keys) && current.holding) {
        console.warn(`AssetManager: reject modification of held group "${id}"`);
        throw new Error(`AssetManager: release group "${id}" before changing its definition`);
      }
    }
    const changed: string[] = [];
    for (const [id, keys] of Object.entries(definitions)) {
      const current = this.groups.get(id);
      if (current && this.sameKeys(current.keys, keys)) {
        console.info(`AssetManager: skip unchanged group "${id}"`);
        continue;
      }
      this.groups.set(id, {
        keys, status: 'unloaded', holding: false, successes: new Set(), errors: new Map(),
      });
      changed.push(id);
    }
    for (const id of changed) this.emitGroup(id);
  }

  /** 预载活跃组幂等；失败重试复用成功项，不重复增加组引用。 */
  preloadGroup(id: string): Promise<void> {
    const state = this.groups.get(id);
    if (!state) {
      console.warn(`AssetManager: reject preload of unknown group "${id.replace(/[\r\n]/g, ' ')}"`);
      return Promise.reject(new Error(`AssetManager: unknown group "${id}"`));
    }
    if (state.status === 'loading' || state.status === 'ready') {
      console.info(`AssetManager: skip preload of ${state.status} group "${id}"`);
      return state.attempt!.promise;
    }
    let resolve!: () => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const attempt: GroupAttempt = { promise, resolve, reject };
    state.attempt = attempt;
    state.status = 'loading';
    state.errors.clear();
    state.successes.clear();
    if (!state.holding) {
      state.holding = true;
      for (const key of state.keys) this.groupRefs.set(key, (this.groupRefs.get(key) ?? 0) + 1);
    }
    for (const key of state.keys) if (this.loaded.has(key)) state.successes.add(key);
    this.emitGroup(id);
    if (state.attempt !== attempt) return promise; // observer 已同步释放/clear。
    if (state.keys.length === 0) {
      console.info(`AssetManager: skip I/O for empty group "${id}"`);
      state.status = 'ready';
      attempt.resolve();
      this.emitGroup(id);
      return promise;
    }
    const tasks = state.keys.map((key) => {
      if (state.attempt !== attempt) return Promise.resolve();
      return this.loadPhysical(key).then(
        () => {
          if (state.attempt !== attempt) return;
          state.successes.add(key);
          this.emitGroup(id);
        },
        (reason: unknown) => {
          if (state.attempt !== attempt) return;
          state.errors.set(key, assetErrorMessage(reason));
          console.warn(`AssetManager: group "${id}" asset ${JSON.stringify(key)} load failed`);
          this.emitGroup(id);
        },
      );
    });
    void Promise.all(tasks).then(() => {
      if (state.attempt !== attempt) return;
      if (state.errors.size) {
        state.status = 'failed';
        const errors = state.keys.filter((key) => state.errors.has(key))
          .map((key) => new Error(`${key}: ${state.errors.get(key)}`));
        attempt.reject(new AggregateError(errors, `AssetManager: group "${id}" failed`));
      } else {
        state.status = 'ready';
        attempt.resolve();
      }
      this.emitGroup(id);
    });
    return promise;
  }

  /** 释放组立即拒绝其 facade；最后一个引用消失且无 pin 才驱逐物理资产。 */
  releaseGroup(id: string): void {
    const state = this.groups.get(id);
    if (!state) {
      console.warn(`AssetManager: reject release of unknown group "${id.replace(/[\r\n]/g, ' ')}"`);
      throw new Error(`AssetManager: unknown group "${id}"`);
    }
    if (!state.holding) {
      console.info(`AssetManager: skip release of unloaded group "${id}"`);
      return;
    }
    const attempt = state.attempt;
    state.attempt = undefined;
    const wasLoading = state.status === 'loading';
    state.status = 'unloaded';
    state.holding = false;
    state.successes.clear();
    state.errors.clear();
    if (wasLoading) {
      console.info(`AssetManager: cancel group "${id}"`);
      attempt?.reject(abortAssetGroup(id));
    }
    // 在通知 observer 前完成全部引用计数，允许 observer 安全启动下一代。
    for (const key of state.keys) {
      const count = (this.groupRefs.get(key) ?? 1) - 1;
      if (count > 0) this.groupRefs.set(key, count);
      else this.groupRefs.delete(key);
    }
    for (const key of state.keys) this.evictIfUnowned(key);
    this.emitGroup(id);
  }

  /** 未登记返回 undefined；返回的快照及 errors 不暴露可变内部状态。 */
  groupProgress(id: string): AssetGroupProgress | undefined {
    const state = this.groups.get(id);
    if (!state) return undefined;
    return Object.freeze({
      group: id, status: state.status, loaded: state.successes.size, failed: state.errors.size,
      total: state.keys.length,
      errors: Object.freeze(state.keys.filter((key) => state.errors.has(key))
        .map((key) => Object.freeze({ key, message: state.errors.get(key)! }))),
    });
  }

  subscribeGroups(listener: (progress: AssetGroupProgress) => void): () => void {
    this.groupListeners.add(listener);
    return () => { this.groupListeners.delete(listener); };
  }

  onEvict(listener: (event: AssetEviction) => void): () => void {
    this.evictionListeners.add(listener);
    return () => { this.evictionListeners.delete(listener); };
  }

  /** 清除常驻 pin；活跃组仍引用的资产继续保留。 */
  unload(key: string): void {
    this.pins.delete(key);
    if (this.groupRefs.has(key)) {
      console.info(`AssetManager: retain group-owned asset ${JSON.stringify(key)} after unpin`);
      return;
    }
    this.evictIfUnowned(key);
  }

  private sameKeys(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((key, index) => key === b[index]);
  }

  private emitGroup(id: string): void {
    const snapshot = this.groupProgress(id);
    if (!snapshot) return;
    for (const listener of [...this.groupListeners]) {
      try { listener(snapshot); }
      catch (error) { console.error(`AssetManager: group observer failed: ${JSON.stringify(assetErrorMessage(error))}`); }
    }
  }

  private releaseAsset(asset: LoadedAsset): void {
    try { this.loader.release?.(asset); }
    catch (error) { console.error(`AssetManager: loader release failed: ${JSON.stringify(assetErrorMessage(error))}`); }
  }

  private evictIfUnowned(key: string): void {
    if (this.pins.has(key) || this.groupRefs.has(key)) return;
    const asset = this.loaded.get(key);
    const pending = this.inflight.has(key);
    if (!asset && !pending) {
      console.info(`AssetManager: skip eviction of absent asset ${JSON.stringify(key)}`);
      return;
    }
    this.loaded.delete(key);
    this.inflight.delete(key);
    this.emitEviction(key, asset);
  }

  private emitEviction(key: string, asset: LoadedAsset | undefined): void {
    const event: AssetEviction = Object.freeze(asset ? { key, asset } : { key });
    for (const listener of [...this.evictionListeners]) {
      try { listener(event); }
      catch (error) { console.error(`AssetManager: eviction observer failed: ${JSON.stringify(assetErrorMessage(error))}`); }
    }
    if (asset) this.releaseAsset(asset);
  }

  /** Only verified, currently loaded scene models may become assembly input. */
  sceneImportCatalog(requiredKeys?: readonly string[]): SceneImportCatalog {
    const result: Record<string, NonNullable<LoadedAsset['scene']>> = Object.create(null) as Record<string, NonNullable<LoadedAsset['scene']>>;
    const keys = requiredKeys ?? [...this.loaded.keys()].filter(key => this.loaded.get(key)?.scene);
    for (const key of keys) {
      const asset = this.loaded.get(key), descriptor = this.descriptors.get(key);
      if (!asset?.scene || descriptor?.kind !== 'model' || !descriptor.scene
        || JSON.stringify(descriptor.scene) !== JSON.stringify(asset.scene)) {
        console.warn(`AssetManager: reject unverified or stale scene ${JSON.stringify(key)}`);
        throw new Error(`AssetManager: scene ${JSON.stringify(key)} must be loaded and SHA256 verified before assembly`);
      }
      result[key] = asset.scene;
    }
    return Object.freeze(result);
  }

  /** 加载所有已注册资产。 */
  async loadAll(): Promise<void> {
    await Promise.all([...this.descriptors.keys()].map((k) => this.load(k)));
  }

  /** 取已加载资产(未加载返回 undefined)。 */
  get(key: string): LoadedAsset | undefined {
    return this.loaded.get(key);
  }

  /**
   * 把 (key, frame) 解析成可绘制帧：源图 + 子矩形。
   * - texture：忽略 frame，整图为帧
   * - atlas：frame = 帧名(string)
   * - sprite-sheet / prerendered-sequence：frame = 索引(number，默认 0)，按 columns 折行
   * 未加载或越界返回 undefined(渲染层据此退化为占位)。
   */
  resolve(key: string, frame?: FrameRef): ResolvedFrame | undefined {
    // 命名动画剪辑（R9 增益 B）：index → 有序帧名 → 委托底层 atlas 取矩形（返回 atlas 的已加载资产）。
    const anim = this.animations.get(key);
    if (anim) {
      const idx = typeof frame === 'number' ? frame : 0;
      const name = anim.frames[idx];
      return name === undefined ? undefined : this.resolve(anim.atlas, name);
    }
    const asset = this.loaded.get(key);
    if (!asset) return undefined;
    const d = asset.descriptor;

    switch (d.kind) {
      case 'texture':
        return { asset, sx: 0, sy: 0, sw: asset.width, sh: asset.height };

      case 'atlas': {
        if (typeof frame !== 'string') return undefined;
        const r = d.frames[frame];
        if (!r) return undefined;
        return { asset, sx: r.x, sy: r.y, sw: r.w, sh: r.h };
      }

      case 'sprite-sheet':
      case 'prerendered-sequence': {
        const index = typeof frame === 'number' ? frame : 0;
        if (index < 0 || index >= d.count) return undefined;
        const cols = Math.max(1, d.columns);
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
          asset,
          sx: col * d.frameWidth,
          sy: row * d.frameHeight,
          sw: d.frameWidth,
          sh: d.frameHeight,
        };
      }

      case 'model':
        return undefined; // 模型不解析成 2D 帧（渲染线直接消费字节句柄）
    }
  }

  /** 清空所有组/常驻 pin/注册，旧请求结果只回收、不重新进入缓存。 */
  clear(): void {
    const ids = [...this.groups.keys()];
    for (const id of ids) {
      const state = this.groups.get(id)!;
      if (state.status === 'loading') {
        console.info(`AssetManager: cancel group "${id}" during clear`);
        state.attempt?.reject(abortAssetGroup(id));
      }
      state.attempt = undefined;
      state.holding = false;
      state.status = 'unloaded';
      state.successes.clear();
      state.errors.clear();
    }
    const snapshots = ids.map((id) => this.groupProgress(id)!);
    const assets = new Map(this.loaded);
    const keys = new Set([...assets.keys(), ...this.inflight.keys()]);
    // 先断开旧世代，再通知外部；observer 可以安全登记/启动新世代。
    this.pins.clear();
    this.groupRefs.clear();
    this.descriptors.clear();
    this.animations.clear();
    this.groups.clear();
    this.loaded.clear();
    this.inflight.clear();
    for (const key of keys) this.emitEviction(key, assets.get(key));
    for (const snapshot of snapshots) {
      for (const listener of [...this.groupListeners]) {
        try { listener(snapshot); }
        catch (error) { console.error(`AssetManager: group observer failed: ${JSON.stringify(assetErrorMessage(error))}`); }
      }
    }
  }
}
