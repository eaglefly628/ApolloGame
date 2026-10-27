// Execute the renderer's existing gates rather than maintaining another clip validator.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
let engine;
export async function motionEngine() {
  if (!engine) engine = (async () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const result = await build({ stdin: { contents: `export * from './src/renderer/three/skeletal-clips.ts'; export * as THREE from 'three'; export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
  })();
  return engine;
}
export async function engineClip(bytes, descriptor) {
  const api = await motionEngine();
  const snapshot = api.snapshotSkeletalGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const loaded = await new api.GLTFLoader().parseAsync(snapshot, '');
  const result = api.extractSkeletalClip(loaded.scene, loaded.animations, { skeleton:'apollo-humanoid-v1', ...descriptor }, loaded.parser);
  return { ...result, scene: loaded.scene, api };
}
