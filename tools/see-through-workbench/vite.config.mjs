import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
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
  cacheDir: '.vite-cache',
  // The native hook export is added by our Vite transform; raw esbuild entry scanning cannot see it.
  optimizeDeps: { entries: [] },
  plugins: [{
    name: 'apollo-native-transparent-player', enforce: 'pre',
    transform(source, id) {
      if (id.split('?')[0].endsWith('/components/timeline/TimelinePanel.jsx')) {
        const audioAnchor = 'function useAudioSync(animation, animStore) {';
        if (source.split(audioAnchor).length !== 2) throw new Error('Native audio hook changed: adapter anchor must match exactly once.');
        return source.replace(audioAnchor, `export ${audioAnchor}`);
      }
      if (!id.split('?')[0].endsWith('/components/canvas/CanvasViewport.jsx')) return;
      if (source.split(anchor).length !== 2) throw new Error('Native viewport changed: adapter anchor must match exactly once.');
      return source.replace(anchor, 'sceneRef.current.draw(projectRef.current, editorRef.current, isDarkRef.current, poseOverrides, { exportMode: new URLSearchParams(location.search).get("mode") === "player" });');
    },
  }, react()],
  resolve: { alias: { '@': path.join(vendor, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ ...tailwind, content: [path.join(vendor, 'src/**/*.{js,jsx}'), path.join(root, '*.jsx')] }), autoprefixer()] } },
  server: { port: 5182, strictPort: true, fs: { allow: [path.resolve(root, '../..')] } },
  build: { rollupOptions: { input: { editor: path.join(root, 'index.html'), engine: path.join(root, 'engine.html') } } },
});
