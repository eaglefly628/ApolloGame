import type * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { GLTFLoader, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';

const cancelled = (): Error => new Error('ModelPool: decoder generation disposed');
const vendorRoot = `${import.meta.env?.BASE_URL ?? '/'}__vendor/three-r184/`;

// r184 DRACOLoader.js: _initDecoder creates the Blob URL asynchronously, and
// _getWorker allocates workers after that promise. Native dispose alone cannot
// prevent either continuation. These two methods are missing from @types/three.
interface DracoInternals {
  _initDecoder(): Promise<void>;
  _getWorker(taskID: number, taskCost: number): Promise<Worker>;
}
const dracoMethods = DRACOLoader.prototype as unknown as DracoInternals;

class GenerationDracoLoader extends DRACOLoader {
  private closed = false;
  private initialization?: Promise<void>;

  _initDecoder(): Promise<void> {
    if (this.closed) return Promise.reject(cancelled());
    return this.initialization ??= dracoMethods._initDecoder.call(this).then(() => {
      if (this.closed) { super.dispose(); throw cancelled(); }
    });
  }

  _getWorker(taskID: number, taskCost: number): Promise<Worker> {
    if (this.closed) return Promise.reject(cancelled());
    return dracoMethods._getWorker.call(this, taskID, taskCost).then((worker) => {
      if (this.closed) { super.dispose(); throw cancelled(); }
      return worker;
    });
  }

  preload(): this {
    // GLTFLoader's Draco extension preloads without observing the promise.
    // Actual decode still observes the same rejection through _getWorker.
    void this._initDecoder().catch(() => {});
    return this;
  }

  dispose(): this {
    if (this.closed) return this;
    this.closed = true;
    super.dispose();
    return this;
  }
}

class GenerationKTX2Loader extends KTX2Loader {
  private closed = false;
  private released = false;

  init(): Promise<void> {
    if (this.closed) return Promise.reject(cancelled());
    return super.init().then(() => {
      if (this.closed) { this.release(); throw cancelled(); }
    });
  }

  parse(buffer: ArrayBuffer, onLoad?: (texture: THREE.CompressedTexture) => void, onError?: (error: unknown) => void): void {
    if (this.closed) { onError?.(cancelled()); return; }
    super.parse(buffer, (texture) => {
      if (this.closed) { texture.dispose(); onError?.(cancelled()); }
      else onLoad?.(texture);
    }, onError);
  }

  private release(): void {
    if (this.released) return;
    this.released = true;
    super.dispose();
  }

  dispose(): this {
    if (this.closed) return this;
    this.closed = true;
    this.workerPool.dispose(); // stop live workers immediately
    // r184 increments _activeLoaders only in init(). Never decrement an unused
    // loader, and defer Blob URL cleanup until a pending init has settled.
    if (this.transcoderPending) void this.transcoderPending.then(() => this.release(), () => this.release());
    return this;
  }
}

/** One lazy, reusable codec set per ModelPool cleanup generation. */
export class ModelCodecs {
  private readonly draco = new GenerationDracoLoader();
  private ktx2?: GenerationKTX2Loader;
  private loader?: GLTFLoader;

  constructor(private readonly renderer?: THREE.WebGLRenderer) {
    this.draco.setDecoderPath(`${vendorRoot}draco/`);
  }

  connect(loader: GLTFLoader): void {
    this.loader = loader;
    loader.setDRACOLoader(this.draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
  }

  prepare(parser: GLTFParser): void {
    const json = parser.json;
    const usesKTX2 = json.extensionsUsed?.includes('KHR_texture_basisu')
      || json.extensionsRequired?.includes('KHR_texture_basisu')
      || json.textures?.some((texture: { extensions?: Record<string, unknown> }) => texture.extensions?.['KHR_texture_basisu']);
    if (!usesKTX2) return;
    if (!this.renderer) throw new Error('ModelPool: KTX2 requires a WebGLRenderer for detectSupport');
    if (!this.ktx2) {
      const loader = new GenerationKTX2Loader();
      loader.setTranscoderPath(`${vendorRoot}basis/`);
      try { loader.detectSupport(this.renderer); }
      catch (error) { loader.dispose(); throw error; }
      this.ktx2 = loader;
    }
    this.loader?.setKTX2Loader(this.ktx2);
    parser.options.ktx2Loader = this.ktx2;
  }

  dispose(): void {
    this.draco.dispose();
    this.ktx2?.dispose();
  }
}
