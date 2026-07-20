#!/usr/bin/env node
// export-game.mjs — extract ONE Apollo game into a standalone, runnable package.
//
// Run from the Apollo engine repo root:
//     node tools/export-game.mjs game-c
//     node tools/export-game.mjs game-c --out ../handoff/game-c
//
// What it does:
//   1. BFS-traces the exact transitive import closure of src/games/<id>/index.ts
//      (resolving @-aliases and .js->.ts/.tsx, skipping *.test.ts / *.spec.ts and
//      node:*/bare npm specifiers).
//   2. Copies just those files into <out>/src/game/** preserving layout.
//   3. Scaffolds package.json / tsconfig.json / vite.config.ts / index.html /
//      src/main.tsx / src/<Comp>.tsx (React wrapper) so it runs on its own.
//
// It is deliberately dependency-free (Node builtins only) and regex-based — the same
// method used to cut the game-c pilot. Verify the result with `npm i && npm run
// typecheck && npm run dev` and prune any stragglers the regex over-collects.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const gameId = argv.find((a) => !a.startsWith('--')) ?? 'game-c';
const outFlag = argv.indexOf('--out');
const REPO = process.cwd();
const SRC = path.join(REPO, 'src');
const OUT = path.resolve(outFlag >= 0 ? argv[outFlag + 1] : `export/${gameId}`);
const GAME_SRC_OUT = path.join(OUT, 'src', 'game');

// Alias table (mirror of tsconfig paths). Extend if your repo adds aliases.
const ALIASES = {
  '@engine/': 'engine/',
  '@skills/': 'skills/',
  '@atom-skills/': 'skills/atoms/',
  '@assets/': 'assets/',
  '@services/': 'services/',
  '@renderer/': 'renderer/',
  '@ui/': 'ui/',
  '@net/': 'net/',
};

const isTest = (p) => /\.(test|spec)\.[tj]sx?$/.test(p);
// A plausible module specifier: relative, node:, or a real package id (no spaces/CJK/punctuation).
const VALID_SPEC = /^(\.|node:|(@[\w.-]+\/)?[\w.-]+(\/[\w.-]+)*)$/;
const isBare = (spec) =>
  !spec.startsWith('.') && !spec.startsWith('/') &&
  !Object.keys(ALIASES).some((a) => spec.startsWith(a));

// Extract every module specifier from a source file (static + dynamic + export-from).
function specifiers(code) {
  const out = new Set();
  const re =
    /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(code))) out.add(m[1] || m[2] || m[3]);
  return [...out];
}

// spec (from file `fromAbs`) -> absolute .ts/.tsx path under SRC, or null if external.
async function resolve(spec, fromAbs) {
  let rel = null;
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (spec.startsWith(alias)) { rel = path.join(SRC, target + spec.slice(alias.length)); break; }
  }
  if (rel === null) {
    if (spec.startsWith('.')) rel = path.resolve(path.dirname(fromAbs), spec);
    else return null; // bare npm / node: builtin
  }
  const base = rel.replace(/\.js$/, '');
  const candidates = [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx'), rel];
  for (const c of candidates) {
    try { if ((await fs.stat(c)).isFile()) return c; } catch { /* keep trying */ }
  }
  return null;
}

async function trace(entry) {
  const closure = new Set();
  const externals = new Set();
  const assets = []; // { importerAbs, spec }  — asset files imported relatively/by alias
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (closure.has(file) || isTest(file)) continue;
    closure.add(file);
    let code;
    try { code = await fs.readFile(file, 'utf8'); } catch { continue; }
    for (const spec of specifiers(code)) {
      if (!isBare(spec) && isAssetSpec(spec)) {
        // Only a real asset if the file exists — skips lookalike specs inside comments/strings.
        const abs = spec.startsWith('.')
          ? path.resolve(path.dirname(file), spec.split('?')[0])
          : null;
        if (abs) { try { if ((await fs.stat(abs)).isFile()) assets.push({ importerAbs: file, spec }); } catch { /* comment/example */ } }
        continue;
      }
      if (!VALID_SPEC.test(spec)) continue; // regex false-positive from a comment/string
      if (isBare(spec)) { externals.add(spec); continue; }
      const r = await resolve(spec, file);
      if (r && !closure.has(r)) queue.push(r);
      else if (!r && spec.startsWith('node:')) externals.add(spec);
    }
  }
  return { closure, externals, assets };
}

// Map an in-SRC absolute path to its copied location under <out>/src/game/.
const mapToOut = (abs) => path.join(GAME_SRC_OUT, path.relative(SRC, abs));

// Copy each imported asset so its ORIGINAL relative specifier still resolves from the
// copied importer — works even when the asset lived above src/ (e.g. ../../../docs/x?raw).
async function copyAssets(assets) {
  const warnings = [];
  for (const { importerAbs, spec } of assets) {
    const rel = spec.split('?')[0];
    const srcAbs = path.resolve(path.dirname(importerAbs), rel);
    const destAbs = path.resolve(path.dirname(mapToOut(importerAbs)), rel);
    try {
      await fs.mkdir(path.dirname(destAbs), { recursive: true });
      await fs.copyFile(srcAbs, destAbs);
    } catch {
      warnings.push(`${path.relative(REPO, srcAbs)} (imported by ${path.relative(SRC, importerAbs)})`);
    }
  }
  return warnings;
}

// Asset-file imports (fonts/images/raw html/etc) — copied verbatim, never recursed into.
const ASSET_EXT = /\.(woff2?|ttf|otf|eot|png|jpe?g|webp|gif|svg|glb|gltf|hdr|exr|mp3|wav|ogg|m4a|mp4|webm|html|txt|csv)$/i;
const isAssetSpec = (spec) => {
  const [p, q] = spec.split('?');
  return (q && /^(raw|url|inline)/.test(q)) || ASSET_EXT.test(p);
};

// bare 'three/addons/x' -> 'three'; '@scope/pkg/sub' -> '@scope/pkg'
const pkgName = (s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]);

async function copyClosure(closure) {
  for (const abs of closure) {
    const rel = path.relative(SRC, abs);
    const dest = path.join(GAME_SRC_OUT, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(abs, dest);
  }
}

// ── scaffolding ──────────────────────────────────────────────────────────────
const COMP = gameId.replace(/[^a-z0-9]/gi, ' ').replace(/(?:^|\s)(\w)/g, (_, c) => c.toUpperCase()).replace(/\s/g, '');
const files = {
  'package.json': (deps) => JSON.stringify({
    name: `@apollo/${gameId}`, version: '0.1.0', type: 'module', private: true,
    scripts: { dev: 'vite', build: 'tsc --noEmit && vite build', preview: 'vite preview', typecheck: 'tsc --noEmit' },
    dependencies: deps.runtime, peerDependencies: { react: '^18.0.0 || ^19.0.0', 'react-dom': '^18.0.0 || ^19.0.0' },
    devDependencies: {
      '@types/node': '^20.0.0', '@types/react': '^18.3.3', '@types/react-dom': '^18.3.0', '@types/three': '^0.184.1',
      '@vitejs/plugin-react': '^4.3.1', typescript: '^5.5.3', vite: '^5.4.2',
    },
  }, null, 2) + '\n',
  'tsconfig.json': () => JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true,
      esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true, resolveJsonModule: true,
      isolatedModules: true, noEmit: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['three', 'node'], baseUrl: '.',
      paths: Object.fromEntries(Object.entries(ALIASES).map(([a, t]) => [a + '*', [`./src/game/${t}*`]])),
    },
    include: ['src'], exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n',
  // Ambient declarations so `tsc` accepts asset imports (fonts / images / ?raw / ?url).
  'src/game/_shims.d.ts': () =>
    `declare module '*?raw' { const s: string; export default s; }\n` +
    `declare module '*?url' { const s: string; export default s; }\n` +
    `declare module '*?inline' { const s: string; export default s; }\n` +
    ['woff2', 'woff', 'ttf', 'otf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'glb', 'gltf', 'hdr', 'mp3', 'wav', 'ogg', 'mp4', 'webm']
      .map((e) => `declare module '*.${e}' { const s: string; export default s; }`).join('\n') + '\n',
  'vite.config.ts': () =>
    `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nimport { resolve } from 'path';\n\n` +
    `export default defineConfig({\n  plugins: [react()],\n  resolve: {\n    alias: {\n` +
    Object.entries(ALIASES).map(([a, t]) => `      '${a.slice(0, -1)}': resolve(__dirname, 'src/game/${t.slice(0, -1)}'),`).join('\n') +
    `\n    },\n  },\n  build: { outDir: 'dist', emptyOutDir: true },\n});\n`,
  'index.html': () =>
    `<!DOCTYPE html>\n<html lang="zh">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover" />\n  <title>${gameId}</title>\n  <style>*{margin:0;padding:0;box-sizing:border-box}html,body,#root{width:100%;height:100%;overflow:hidden;background:#000}</style>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`,
  'src/main.tsx': () =>
    `import { createRoot } from 'react-dom/client';\nimport { ${COMP} } from './${COMP}.js';\n\nconst root = document.getElementById('root');\nif (!root) throw new Error('#root not found');\ncreateRoot(root).render(\n  <div style={{ position: 'fixed', inset: 0, background: '#000' }}>\n    <${COMP} onExit={() => console.log('[dev] exit')} />\n  </div>,\n);\n`,
  [`src/${COMP}.tsx`]: (d) =>
    `import { useEffect, useRef } from 'react';\nimport { mount } from '${d.entryImport}';\n\nexport interface ${COMP}Props {\n  onExit?: () => void;\n  style?: React.CSSProperties;\n  className?: string;\n}\n\nexport function ${COMP}({ onExit, style, className }: ${COMP}Props): React.ReactElement {\n  const ref = useRef<HTMLDivElement>(null);\n  const onExitRef = useRef(onExit);\n  onExitRef.current = onExit;\n  useEffect(() => {\n    const el = ref.current;\n    if (!el) return;\n    const cleanup = ${d.mountTakesHost ? 'mount(el, { exit: () => onExitRef.current?.() })' : 'mount(el)'};\n    return () => cleanup?.();\n  }, []);\n  return <div ref={ref} className={className} style={{ width: '100%', height: '100%', position: 'relative', ...style }} />;\n}\n\nexport default ${COMP};\n`,
  '.gitignore': () => 'node_modules/\ndist/\n*.log\n.DS_Store\n',
  'README.md': (d) =>
    `# ${gameId} — Standalone Game Module\n\n` +
    `Self-contained, runnable extraction of Apollo ${gameId} with **zero platform dependency**\n` +
    `(no launcher / studio / account / lobby / Steam / Electron). TypeScript + Vite, with a thin\n` +
    `React wrapper as the only integration surface. Auto-generated by \`tools/export-game.mjs\`.\n\n` +
    `## Run standalone\n\n\`\`\`bash\nnpm install\nnpm run dev        # play it on its own\nnpm run typecheck  # tsc --noEmit\nnpm run build      # production bundle → dist/\n\`\`\`\n\n` +
    `## Embed into a React app\n\n\`\`\`tsx\nimport { ${COMP} } from './src/${COMP}';\n\n<${COMP} onExit={() => history.back()} />   // fills its parent; tears down on unmount\n\`\`\`\n\n` +
    `\`${COMP}\` is the only React-aware file — it wraps the game's framework-agnostic\n` +
    `\`mount(container${d.mountTakesHost ? ', { exit })' : ''})\` entry (see \`${d.entryImport}\`).\n\n` +
    `## Notes\n\n` +
    `- Deps: \`three\` (+ lazy \`cannon-es\` for physics) where used; \`react\`/\`react-dom\` are peers\n` +
    `  used only by the wrapper. \`src/game/**\` is the exact import closure of the game entry.\n` +
    `- \`src/main.tsx\` + \`index.html\` are the standalone harness — delete them when embedding.\n`,
};

// Known runtime deps; extend the map if a game pulls others.
const RUNTIME_DEP_VERSIONS = { three: '^0.184.0', 'cannon-es': '^0.20.0' };

// Auto-detect the file that exports `mount(container)` for this game.
async function findEntry() {
  const candidates = [
    path.join(SRC, 'games', gameId, 'index.ts'),
    path.join(SRC, 'games', gameId, `${gameId}.tsx`),
    path.join(SRC, 'games', gameId, `${gameId}.ts`),
    path.join(SRC, `${gameId}.tsx`),
    path.join(SRC, `${gameId}.ts`),
  ];
  for (const c of candidates) {
    let code;
    try { code = await fs.readFile(c, 'utf8'); } catch { continue; }
    if (/export\s+(?:function\s+mount|\{[^}]*\bmount\b|const\s+mount)/.test(code)) return c;
  }
  return null;
}

async function main() {
  const entry = await findEntry();
  if (!entry) { console.error(`✗ no mount entry found for ${gameId} (looked in src/games/${gameId}/ and src/${gameId}.*)`); process.exit(1); }
  // Wrapper import path = entry relative to SRC, under ./game/, with .js extension.
  const entryImport = './game/' + path.relative(SRC, entry).replace(/\.tsx?$/, '.js');

  // Does mount() accept a 2nd (host) argument? Drives the wrapper's call shape.
  const entryCode = await fs.readFile(entry, 'utf8');
  const mountTakesHost = /export\s+function\s+mount\s*\(\s*[^,)]+,[^)]/.test(entryCode);

  console.log(`▶ entry: ${path.relative(REPO, entry)}  (mount ${mountTakesHost ? 'takes host' : '1-arg'})`);
  console.log(`▶ tracing closure from ${path.relative(REPO, entry)} …`);
  const { closure, externals, assets } = await trace(entry);
  console.log(`  ${closure.size} source files, ${assets.length} asset imports, ${externals.size} external specifiers`);

  await fs.rm(OUT, { recursive: true, force: true });
  await copyClosure(closure);
  const assetWarnings = await copyAssets(assets);
  for (const w of assetWarnings) console.warn(`  ⚠ asset not found (declared but missing): ${w}`);

  const runtime = {};
  for (const spec of externals) {
    if (spec.startsWith('node:')) { console.warn(`  ⚠ node builtin imported: ${spec} (Node-only file — likely prune it)`); continue; }
    const p = pkgName(spec);
    if (p === 'react' || p === 'react-dom') continue; // peer
    if (RUNTIME_DEP_VERSIONS[p]) runtime[p] = RUNTIME_DEP_VERSIONS[p];
    else console.warn(`  ⚠ unknown runtime dep '${p}' — add a version to package.json manually`);
  }

  for (const [rel, make] of Object.entries(files)) {
    const dest = path.join(OUT, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, make({ runtime, entryImport, mountTakesHost }));
  }

  console.log(`✔ wrote ${path.relative(REPO, OUT)}`);
  console.log(`  next: cd ${path.relative(REPO, OUT)} && npm install && npm run typecheck && npm run dev`);
  console.log(`  external deps detected: ${[...externals].map(pkgName).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '(none)'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
