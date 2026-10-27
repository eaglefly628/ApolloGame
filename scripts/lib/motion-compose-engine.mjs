import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
let pending;
/** One bundle owns THREE, mixers, validation, attachments and the native IK controller. */
export function composeEngine() {
  if (!pending) pending = (async () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const result = await build({ stdin: { resolveDir: root, contents: `
      export * as THREE from 'three';
      export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
      export * from './src/renderer/three/skeletal-clips.ts';
      export { InverseKinematics } from './src/renderer/three/inverse-kinematics.ts';
      export { SkeletalAttachments } from './src/renderer/three/skeletal-attachments.ts';
      export { createIKTargetResolver } from './src/renderer/three/ik-targets.ts';
      export { readAnimGraphParams } from './src/renderer/three/animation-graph-params.ts';
      export { validateIK3D } from './src/engine/protocol/components/ik3d.ts';
      export { validateAttach3D } from './src/engine/protocol/components/attach3d.ts';
      export { World } from './src/engine/core/world.ts';
    ` }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
  })();
  return pending;
}
