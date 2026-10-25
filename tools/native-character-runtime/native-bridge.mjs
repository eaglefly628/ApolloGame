import JSZip from 'jszip';
import { loadProject } from '@/io/projectFile';
import { useProjectStore } from '@/store/projectStore';
import { useAnimationStore } from '@/store/animationStore';
import { useEditorStore } from '@/store/editorStore';
import { useParameterStore } from '@/store/parameterStore';
import { validateNativeProject } from './project-validation.mjs';
import { previewFit } from './preview-fit.mjs';
import { observeNativeFit } from './fit-observer.mjs';
const channel = 'apollo-native-character-v1';
const settleFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const ownedUrls = new Set();
let releaseFit = () => {};

function status() {
  const project = useProjectStore.getState().project;
  const anim = useAnimationStore.getState();
  return { clips: project.animations.map(a => ({ id: a.id, name: a.name, duration: a.duration })), parameters: (project.parameters ?? []).map(p => ({ id: p.id, name: p.name, min: p.min, max: p.max, default: p.default })), clipId: anim.activeAnimationId, timeMs: anim.currentTime, playing: anim.isPlaying };
}
function disposeUrls() { for (const url of ownedUrls) URL.revokeObjectURL(url); ownedUrls.clear(); }

async function load(bytes, loadRef) {
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > 100 * 1024 * 1024) throw new Error('Invalid native animation bundle');
  const zip = await JSZip.loadAsync(bytes);
  const json = zip.file('project.json');
  if (!json) throw new Error('Native animation bundle is missing project.json');
  const raw = validateNativeProject(JSON.parse(await json.async('string')));
  for (const texture of raw.textures) {
    if (!/^textures\/[A-Za-z0-9._-]+\.png$/.test(texture.source) || !zip.file(texture.source)) throw new Error(`Missing bundled texture ${texture.id}`);
    // Upstream logs image-decode errors without rejecting and may leak the URL
    // created for a broken PNG. Decode before invoking that unchanged loader.
    const bitmap = await createImageBitmap(await zip.file(texture.source).async('blob'));
    if (bitmap.width > 16384 || bitmap.height > 16384) { bitmap.close(); throw new Error('Native texture dimensions exceed limit'); }
    bitmap.close();
  }
  for (const animation of raw.animations) for (const track of animation.audioTracks ?? []) {
    if (!track.source || !/^audios\/[A-Za-z0-9._-]+$/.test(track.source) || !zip.file(track.source)) throw new Error(`Missing bundled audio ${track.id}`);
  }
  const result = await loadProject(new File([bytes], 'character.stretch'));
  for (const texture of result.project.textures) {
    if (!result.images.has(texture.id)) throw new Error(`Could not decode texture ${texture.id}`);
  }
  // The native loader creates blob URLs. All those URLs are owned by this frame.
  disposeUrls();
  for (const texture of result.project.textures) if (texture.source.startsWith('blob:')) ownedUrls.add(texture.source);
  for (const anim of result.project.animations) for (const track of anim.audioTracks ?? []) if (track.sourceUrl?.startsWith('blob:')) ownedUrls.add(track.sourceUrl);
  useAnimationStore.getState().resetPlayback?.();
  useParameterStore.getState().resetToDefaults(result.project.parameters);
  // Player uses the original viewport loader (including native GPU upload).
  // Editor uses its original store/texture synchronisation, preserving all tools.
  if (loadRef?.current) {
    // Pass the ORIGINAL bytes; converting/exporting would risk losing native
    // fields that an upstream serializer doesn't yet include (e.g. physicsRules).
    const file = new File([bytes], 'character.stretch');
    await loadRef.current(file);
    // The viewport owns this second set of native loader URLs too.
    disposeUrls();
    const current = useProjectStore.getState().project;
    for (const texture of current.textures) if (texture.source.startsWith('blob:')) ownedUrls.add(texture.source);
    for (const anim of current.animations) for (const track of anim.audioTracks ?? []) if (track.sourceUrl?.startsWith('blob:')) ownedUrls.add(track.sourceUrl);
  } else useProjectStore.getState().loadProject(result.project);
  useEditorStore.getState().setSelection([]);
  useEditorStore.getState().setShowSkeleton(false);
  useEditorStore.getState().setEditorMode('animation');
  await settleFrame();
  const canvas = document.querySelector('canvas');
  const dimensions = useProjectStore.getState().project.canvas;
  useEditorStore.getState().setView(previewFit(canvas.clientWidth, canvas.clientHeight, dimensions));
  releaseFit();
  releaseFit = observeNativeFit(canvas,
    () => useProjectStore.getState().project.canvas,
    view => useEditorStore.getState().setView(view));
  await settleFrame();
  return status();
}

export function installNativeBridge(loadRef) {
  const local = new URL(location.href);
  const web = local.protocol === 'http:' || local.protocol === 'https:';
  const app = local.protocol === 'apollo:' && local.hostname === 'app' && !local.port;
  const credentials = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*@/i.test(location.href);
  if (credentials || local.username || local.password || !(web || app) || (app && location.origin !== 'null' && location.origin !== 'apollo://app')) {
    console.warn('[native-character] reject: invalid local host origin');
    throw new Error('Native character bridge must use the local host origin');
  }
  // Registered WKWebView schemes use apollo://app; opaque implementations need
  // '*'. This exception is confined to the validated fixed application host.
  const messageOrigin = app ? location.origin : local.origin;
  const targetOrigin = messageOrigin === 'null' ? '*' : messageOrigin;
  let destroyed = false;
  let queue = Promise.resolve();
  async function execute(command) {
    if (destroyed) throw new Error('Native character bridge destroyed');
    const animation = useAnimationStore.getState();
    const project = useProjectStore.getState().project;
    switch (command?.type) {
      case 'load': return load(command.bytes, loadRef);
      case 'play': {
        const clip = project.animations.find(a => a.id === command.clipId);
        if (!clip) throw new Error(`Unknown animation ${command.clipId}`);
        if (command.speed !== undefined && (!Number.isFinite(command.speed) || command.speed < 0 || command.speed > 4)) throw new Error('Invalid playback speed');
        animation.stop();
        animation.setActiveAnimationId(clip.id);
        animation.setFps(clip.fps ?? 24);
        animation.setStartFrame(0);
        animation.setEndFrame(Math.max(1, Math.round(clip.duration * (clip.fps ?? 24) / 1000)));
        animation.setLoop(command.loop ?? true);
        animation.setLoopKeyframes(clip.loopKeyframes ?? true);
        animation.setSpeed(command.speed ?? 1);
        useEditorStore.getState().setEditorMode('animation');
        animation.play();
        break;
      }
      case 'pause': animation.pause(); break;
      case 'seek': {
        const clip = project.animations.find(a => a.id === animation.activeAnimationId);
        if (!clip || !Number.isFinite(command.timeMs) || command.timeMs < 0 || command.timeMs > clip.duration) throw new Error('Invalid animation seek');
        animation.seekTime(command.timeMs);
        break;
      }
      case 'parameters': {
        if (!command.values || typeof command.values !== 'object' || Array.isArray(command.values)) throw new Error('Invalid parameter values');
        for (const [id, value] of Object.entries(command.values)) {
          const parameter = project.parameters?.find(p => p.id === id);
          if (!parameter || !Number.isFinite(value) || value < parameter.min || value > parameter.max) throw new Error(`Invalid parameter ${id}`);
        }
        for (const [id, value] of Object.entries(command.values)) useParameterStore.getState().setParameterValue(id, value);
        break;
      }
      case 'status': break;
      case 'capture': {
        await settleFrame();
        const canvas = document.querySelector('canvas');
        if (!canvas) throw new Error('Native canvas unavailable');
        return canvas.toDataURL('image/png');
      }
      default: throw new Error('Unknown native character command');
    }
    await settleFrame();
    return status();
  }
  function receive(event) {
    if (!event.source || event.source !== window.parent || event.origin !== messageOrigin || event.data?.channel !== channel || event.data?.type !== 'command' || !Number.isSafeInteger(event.data.id)) return;
    const { id, command } = event.data;
    queue = queue.then(async () => {
      try {
        const value = await execute(command);
        if (!destroyed) event.source.postMessage({ channel, type: 'reply', id, ok: true, value }, targetOrigin);
      } catch (error) {
        if (!destroyed) event.source.postMessage({ channel, type: 'reply', id, ok: false, error: error.message }, targetOrigin);
      }
    });
  }
  window.addEventListener('message', receive);
  settleFrame().then(() => {
    if (destroyed) return;
    const gl = document.querySelector('canvas')?.getContext('webgl2');
    if (!gl) { console.error('[native-character] WebGL2 unavailable'); return; }
    const antialias = gl.getContextAttributes()?.antialias ?? false;
    document.querySelector('canvas').dataset.nativeAntialias = String(antialias);
    console.info(`[native-character] decision: screen density ${globalThis.devicePixelRatio}; raster capped at2x; WebGL antialias=${antialias}`);
    window.parent.postMessage({ channel, type: 'ready' }, targetOrigin);
    if (new URLSearchParams(location.search).get('demo') === '1') {
      queue = queue.then(async () => {
        const assetName = new URLSearchParams(location.search).get('asset') ?? 'native-character-demo';
        if (!/^[a-z0-9-]+$/.test(assetName)) throw new Error('Invalid local demo asset name');
        const response = await fetch(new URL(`./art/${assetName}.stretch`, location.href));
        if (!response.ok) throw new Error('Demo asset unavailable');
        await execute({ type: 'load', bytes: await response.arrayBuffer() });
        const selection = new URLSearchParams(location.search);
        await execute({ type: 'play', clipId: selection.get('clip') ?? 'showcase' });
        if (selection.get('autoplay') === '0') await execute({ type: 'pause' });
      }).catch(error => console.error('[native-character] demo load failed', error));
    }
  });
  return () => { destroyed = true; window.removeEventListener('message', receive); releaseFit(); releaseFit = () => {}; disposeUrls(); };
}
