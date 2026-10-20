// mountManifestGame —— 内置「纯数据游戏」通用薄宿主（源起 2026-07-10 官方示例先例·该两款 2026-07-16 已删·
// 曾消费者含 game-q（已随 REQ-RETRO 引擎大扫除 2026-08-03 删除），现消费者=game-103/game102 等内置数据游戏）。
//
// 一个内置数据游戏 = public/games/<slug>/manifest.json（tracked·纯 JSON）+ 本地美术 index + 本宿主。
// 职责（全在 sim 外·零玩法逻辑·同已删 game-q 曾用的 host 纪律）：
//   fetch manifest →（残留 art: 引用则经素材库解析）→ parseManifest → Engine + CanvasRenderer(+AssetManager)
//   + 画布指针逆投影入队。世界坐标=画布逻辑坐标（manifest 自带居中相机·1:1）。
// 美术管线：台账/生成/替换走美术平台 library 线（manifestFile 已回退到 public/games/<slug>/manifest.json）。
import { Engine } from '../runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { QueuedInputSource, canvasPointerToScreen } from '@net/host/index.js';
import { parseManifest } from '../assembly/manifest.js';
import { resolveArtRefs } from '../assembly/resolve-art-refs.js';
import { AssetManager, loadGameArtInto, artlibRecords } from '@assets/index.js';
import { createManifestAssets, loadManifestSceneCatalog } from './scene-game-assets.js';
import type { RendererBackend } from '@engine/core/types.js';

const W = 640;
const H = 400;

export function mountManifestGame(slug: string) {
  return function mount(container: HTMLElement): () => void {
    let dead = false;
    let engine: Engine | null = null;
    let onDown: ((e: PointerEvent) => void) | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let ownedAssets: AssetManager | null = null;
    let mountedRenderer: RendererBackend | null = null;
    const artAbort = new AbortController();
    const destroyRenderer = (): void => {
      const renderer = mountedRenderer; mountedRenderer = null;
      try { renderer?.destroy(); }
      catch (error) { console.error('[manifest-game] renderer cleanup failed', error); }
    };

    void (async () => {
      // 1) manifest（tracked 纯数据=游戏本体）
      let raw: unknown;
      try {
        const r = await fetch(`/games/${slug}/manifest.json`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        raw = await r.json();
      } catch (e) {
        container.textContent = `加载失败：/games/${slug}/manifest.json（${String(e)}）`;
        return;
      }
      // 2) 残留 art: 引用 → 免费素材库解析（已钉死的引用原样通过；索引缺失不阻塞）
      try {
        const idx = await fetch('/assets/FreeArtLib/index.json').then((r) => (r.ok ? r.json() : null));
        if (idx) raw = resolveArtRefs(raw, artlibRecords(idx)).manifest;
      } catch { /* 无素材索引 → Shape 回退观感 */ }
      if (dead) { console.info('[manifest-game] skip: startup cancelled'); return; }
      // 3) 皮肤资产：本地 index（gen/ 生成物 + 上传物）——就绪即换装，缺失=Shape 回退（观感承诺同已删 game-q 先例）
      const assets = createManifestAssets();
      ownedAssets = assets;
      // The shared data loader honors optional groups/initialGroup, retaining
      // legacy eager loading for indexes without a scene grouping declaration.
      const sceneImports = await loadManifestSceneCatalog(assets, raw, slug, artAbort.signal);
      if (dead) return;
      const bp = parseManifest(raw, { sceneImports });
      if (!sceneImports) void loadGameArtInto(assets, slug, { indexSignal: artAbort.signal });
      if (dead) return;
      // 4) 引擎 + 渲染 + 指针
      const input = new QueuedInputSource(slug);
      engine = new Engine({ input });
      engine.load(bp);
      // 渲染后端选择：缺省 CanvasRenderer；`?renderer=webgl2` → WebGL2 实例化批渲原型（REQ-3D-RENDER-EFFICIENCY
      //   增量②·上千同类实体 draw 坍缩）。动态 import 让 GL 代码只在 opt-in 时进包（不拖累缺省 canvas 消费者）。
      const wantWebgl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('renderer') === 'webgl2';
      let renderer: RendererBackend & { pick?: (x: number, y: number) => { signal: string; arg: string } | null };
      if (sceneImports) {
        const { ThreeRenderer } = await import('@renderer/three-renderer.js');
        if (dead) return;
        renderer = new ThreeRenderer({ width: W, height: H, assets });
      } else if (wantWebgl) {
        try {
          const { WebGLRenderer } = await import('@renderer/webgl/webgl-renderer.js');
          if (dead) return;
          renderer = new WebGLRenderer({ width: W, height: H, background: 'transparent', assets });
        } catch (e) {
          console.warn('[manifest-game] WebGL2 后端不可用·退回 CanvasRenderer：', e); // 无 WebGL2 环境优雅退化
          renderer = new CanvasRenderer({ width: W, height: H, background: 'transparent', assets });
        }
      } else {
        renderer = new CanvasRenderer({ width: W, height: H, background: 'transparent', assets });
      }
      mountedRenderer = renderer;
      engine.attachRenderer(renderer, container);
      canvas = container.querySelector('canvas');
      if (canvas) {
        onDown = (e: PointerEvent) => {
          if (renderer.pick) {
            const hit = renderer.pick(e.clientX, e.clientY);
            if (hit) input.enqueueAction(hit.signal, { arg: hit.arg });
            else console.info('[manifest-game] skip: pointer hit no pickable model');
            return;
          }
          const c = canvas!;
          const rect = c.getBoundingClientRect();
          const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
          const p = canvasPointerToScreen(e.clientX, e.clientY, rect, c.width / dpr, c.height / dpr);
          input.enqueue({ source: slug, x: p.x, y: p.y, phase: 'down' });
        };
        canvas.addEventListener('pointerdown', onDown);
      }
      engine.start();
    })().catch(error => {
      ownedAssets?.clear();
      destroyRenderer();
      engine?.stop();
      if (dead || artAbort.signal.aborted) { console.info('[manifest-game] skip: startup cancelled'); return; }
      console.error('[manifest-game] reject: startup failed', error);
      container.textContent = '场景资源未就绪，请检查资源记录。';
    });

    return () => {
      dead = true;
      artAbort.abort();
      ownedAssets?.clear();
      if (canvas && onDown) canvas.removeEventListener('pointerdown', onDown);
      engine?.stop();
      destroyRenderer();
      container.innerHTML = '';
    };
  };
}
