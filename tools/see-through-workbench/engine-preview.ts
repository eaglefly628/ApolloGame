import { mountHost } from '../../src/engine/host/mount-host.js';
import { mountNativeCharacter } from '../../src/engine/host/native-character.js';
import { parseAssetIndex } from '../../src/assets/asset-index.js';

const host = mountHost(document.getElementById('root')!, {
  fieldW: 600, fieldH: 760,
  sceneBackground: 'radial-gradient(ellipse at 50% 35%, #34425f, #131a2d 75%)',
  wrapperBackground: '#131a2d',
});
const port = mountNativeCharacter(host.scene, { runtimeUrl: new URL('./index.html', location.href).href });
const selection = new URLSearchParams(location.search);
const ready = fetch(new URL('./art/index.json', location.href))
  .then(response => {
    if (!response.ok) throw new Error(`Animation index unavailable (${response.status})`);
    return response.json();
  })
  .then(localIndex => port.loadAsset(parseAssetIndex(localIndex), `anim/${selection.get('asset') ?? 'native-character-demo'}`, new URL('./', location.href).href))
  .then(() => port.command({ type: 'play', clipId: selection.get('clip') ?? 'idle' }));
// Host integration surface for audit and game authors; no native store leaks.
Object.assign(window, { apolloCharacter: port, apolloCharacterReady: ready });
void ready.catch(error => {
  console.error('[native-character] preview failed', error);
  document.getElementById('root')!.textContent = `动画加载失败：${error.message}`;
});
window.addEventListener('pagehide', () => { port.destroy(); host.teardown(); }, { once: true });
