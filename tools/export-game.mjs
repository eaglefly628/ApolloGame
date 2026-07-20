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
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (closure.has(file) || isTest(file)) continue;
    closure.add(file);
    let code;
    try { code = await fs.readFile(file, 'utf8'); } catch { continue; }
    for (const spec of specifiers(code)) {
      if (!VALID_SPEC.test(spec)) continue; // regex false-positive from a comment/string
      if (isBare(spec)) { externals.add(spec); continue; }
      const r = await resolve(spec, file);
      if (r && !closure.has(r)) queue.push(r);
      else if (!r && spec.startsWith('node:')) externals.add(spec);
    }
  }
  return { closure, externals };
}

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
      '@types/react': '^18.3.3', '@types/react-dom': '^18.3.0', '@types/three': '^0.184.1',
      '@vitejs/plugin-react': '^4.3.1', typescript: '^5.5.3', vite: '^5.4.2',
    },
  }, null, 2) + '\n',
  'tsconfig.json': () => JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true,
      esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true, resolveJsonModule: true,
      isolatedModules: true, noEmit: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['three'], baseUrl: '.',
      paths: Object.fromEntries(Object.entries(ALIASES).map(([a, t]) => [a + '*', [`./src/game/${t}*`]])),
    },
    include: ['src'], exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n',
  'vite.config.ts': () =>
    `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nimport { resolve } from 'path';\n\n` +
    `export default defineConfig({\n  plugins: [react()],\n  resolve: {\n    alias: {\n` +
    Object.entries(ALIASES).map(([a, t]) => `      '${a.slice(0, -1)}': resolve(__dirname, 'src/game/${t.slice(0, -1)}'),`).join('\n') +
    `\n    },\n  },\n  build: { outDir: 'dist', emptyOutDir: true },\n});\n`,
  'index.html': () =>
    `<!DOCTYPE html>\n<html lang="zh">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover" />\n  <title>${gameId}</title>\n  <style>*{margin:0;padding:0;box-sizing:border-box}html,body,#root{width:100%;height:100%;overflow:hidden;background:#000}</style>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`,
  'src/main.tsx': () =>
    `import { createRoot } from 'react-dom/client';\nimport { ${COMP} } from './${COMP}.js';\n\nconst root = document.getElementById('root');\nif (!root) throw new Error('#root not found');\ncreateRoot(root).render(\n  <div style={{ position: 'fixed', inset: 0, background: '#000' }}>\n    <${COMP} onExit={() => console.log('[dev] exit')} />\n  </div>,\n);\n`,
  [`src/${COMP}.tsx`]: () =>
    `import { useEffect, useRef } from 'react';\nimport { mount } from './game/games/${gameId}/index.js';\n\nexport interface ${COMP}Props {\n  onExit?: () => void;\n  style?: React.CSSProperties;\n  className?: string;\n}\n\nexport function ${COMP}({ onExit, style, className }: ${COMP}Props): React.ReactElement {\n  const ref = useRef<HTMLDivElement>(null);\n  const onExitRef = useRef(onExit);\n  onExitRef.current = onExit;\n  useEffect(() => {\n    const el = ref.current;\n    if (!el) return;\n    const cleanup = mount(el, { exit: () => onExitRef.current?.() });\n    return () => cleanup();\n  }, []);\n  return <div ref={ref} className={className} style={{ width: '100%', height: '100%', position: 'relative', ...style }} />;\n}\n\nexport default ${COMP};\n`,
  '.gitignore': () => 'node_modules/\ndist/\n*.log\n.DS_Store\n',
};

// Known runtime deps; extend the map if a game pulls others.
const RUNTIME_DEP_VERSIONS = { three: '^0.184.0', 'cannon-es': '^0.20.0' };

async function main() {
  const entry = path.join(SRC, 'games', gameId, 'index.ts');
  try { await fs.stat(entry); } catch { console.error(`✗ entry not found: ${path.relative(REPO, entry)}`); process.exit(1); }

  console.log(`▶ tracing closure from ${path.relative(REPO, entry)} …`);
  const { closure, externals } = await trace(entry);
  console.log(`  ${closure.size} source files, ${externals.size} external specifiers`);

  await fs.rm(OUT, { recursive: true, force: true });
  await copyClosure(closure);

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
    await fs.writeFile(dest, make({ runtime }));
  }

  console.log(`✔ wrote ${path.relative(REPO, OUT)}`);
  console.log(`  next: cd ${path.relative(REPO, OUT)} && npm install && npm run typecheck && npm run dev`);
  console.log(`  external deps detected: ${[...externals].map(pkgName).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '(none)'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
