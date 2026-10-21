import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { readFileSync } from 'node:fs';
import { adaptNativeRaster, adaptNativeTexture } from './render-quality.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.join(root, 'vendor/stretchystudio');
const require = createRequire(import.meta.url);
// Upstream uses CommonJS syntax in this one config despite type:module.
const tailwind = require('./tailwind.native.cjs');
// Keep upstream files byte-for-byte. Only the player backdrop differs; character
// deformation, blending, draw order and clipping remain the native pipeline.
const anchor = 'sceneRef.current.draw(projectRef.current, editorRef.current, isDarkRef.current, poseOverrides);';
export default defineConfig({
  root,
  base: '/native-character/',
  publicDir: false, // Never copy an author's public/art candidate directory.
  cacheDir: path.join(root, '../../art-local/game112/native-character/vite-cache'),
  // The audio bridge export is supplied by the pre-transform above. Vite's
  // HTML scanner does not execute that transform; discover deps on request.
  optimizeDeps: { entries: [] },
  plugins: [{
    name: 'apollo-native-transparent-player', enforce: 'pre',
    transform(source, id) {
      if (id.split('?')[0].endsWith('/renderer/scenePass.js')) return adaptNativeRaster(source);
      if (id.split('?')[0].endsWith('/renderer/partRenderer.js')) return adaptNativeTexture(source);
      if (id.split('?')[0].endsWith('/components/timeline/TimelinePanel.jsx')) {
        const audioAnchor = 'function useAudioSync(animation, animStore) {';
        if (source.split(audioAnchor).length !== 2) throw new Error('Native audio hook changed: adapter anchor must match exactly once.');
        return source.replace(audioAnchor, `export ${audioAnchor}`);
      }
      if (!id.split('?')[0].endsWith('/components/canvas/CanvasViewport.jsx')) return;
      if (source.split(anchor).length !== 2) throw new Error('Native viewport changed: adapter anchor must match exactly once.');
      const contextAnchor = "{ alpha: true, premultipliedAlpha: false, stencil: true, preserveDrawingBuffer: true }";
      if (source.split(contextAnchor).length !== 2) throw new Error('Native WebGL context changed: adapter anchor must match exactly once.');
      return source.replace(contextAnchor, '{ alpha: true, antialias: true, premultipliedAlpha: false, stencil: true, preserveDrawingBuffer: true }')
        .replace(anchor, 'sceneRef.current.draw(projectRef.current, editorRef.current, isDarkRef.current, poseOverrides, { exportMode: new URLSearchParams(location.search).get("mode") === "player" });');
    },
  }, {
    name: 'native-player-license',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'LICENSE-STRETCHYSTUDIO.txt', source: readFileSync(path.join(vendor, 'LICENSE'), 'utf8') });
    },
  }, react()],
  resolve: { alias: { '@': path.join(vendor, 'src'), '@zerocraft/engine': path.resolve(root, '../../src'), 'onnxruntime-web': path.join(root, 'no-inference.mjs') } },
  css: { postcss: { plugins: [tailwindcss({ ...tailwind, content: [path.join(vendor, 'src/**/*.{js,jsx}'), path.join(root, '*.jsx')] }), autoprefixer()] } },
  server: { port: 5182, strictPort: true, fs: { allow: [path.resolve(root, '../..')] } },
  // This exact directory is generated output, never authoring art. Clear stale
  // chunks so an earlier editor build cannot ship unused inference WASM.
  build: { outDir: '../../public/native-character', emptyOutDir: true, rollupOptions: { input: path.join(root, 'index.html') } },
});
