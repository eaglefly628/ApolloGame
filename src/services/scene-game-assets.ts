import { AssetManager, ImageAssetLoader, ModelAssetLoader, loadGameArtInto } from '@assets/index.js';
import type { SceneImportCatalog } from '@assets/scene-import-data.js';
import { sceneImportKeys } from '../assembly/scene-import.js';

/** Shared manifest host: models follow the existing byte loader, images the image loader. */
export function createManifestAssets(): AssetManager {
  const models = new ModelAssetLoader(), images = new ImageAssetLoader();
  return new AssetManager({ load: d => d.kind === 'model' ? models.load(d) : images.load(d) });
}

/** Required scene data is a startup dependency, never an optional visual fallback. */
export async function loadManifestSceneCatalog(
  assets: AssetManager, raw: unknown, slug: string, signal?: AbortSignal,
): Promise<SceneImportCatalog | undefined> {
  const keys = sceneImportKeys(raw);
  if (!keys.length) {
    console.info('[scene-game-assets] skip: no scene imports; retain legacy art startup');
    return undefined;
  }
  const cancelled = (): void => {
    if (signal?.aborted) {
      console.info('[scene-game-assets] skip: startup cancelled');
      throw new DOMException('Scene startup cancelled', 'AbortError');
    }
  };
  cancelled();
  if (!await loadGameArtInto(assets, slug, { indexSignal: signal })) {
    console.warn('[scene-game-assets] reject: required scene asset index/load unavailable');
    throw new Error('Scene asset index is unavailable; startup aborted');
  }
  cancelled();
  await Promise.all(keys.map(key => assets.load(key)));
  cancelled();
  return assets.sceneImportCatalog(keys);
}
