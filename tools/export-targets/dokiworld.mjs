// DokiWorld export target — one plugin among many. Turns a plain standalone export
// into a DokiWorld iframe "cartridge": adds the postMessage protocol bridge, wires the
// React entry to it, flattens public assets for /games/<id>/ hosting, and injects a
// one-shot `complete()` score report onto each game's EXISTING game-over seam.
//
// Design guarantees (per owner):
//  - Inject-only-at-export: the engine's canonical game source is never modified.
//  - The character-card interface (SessionIn / onSessionOut / buildSessionOut, REQ-CHARCARD)
//    is authoritative. This plugin NEVER touches it — `complete()` is hooked onto the SAME
//    terminal once-guard as the card-out path, running alongside it, not replacing it.
//
// Plugin contract (consumed by export-game.mjs):
//   id, label            — identity
//   supportedGames        — games with a known outcome mapping; others throw with guidance
//   files(ctx)            — files to add/override (bridge, main.tsx, wrapper, vite.config)
//   patchGame(ctx)        — anchored edits into the exported game core (adds `complete`)
//
// ctx = { gameId, COMP, entryImport }.  Each patch is { file, find, replace } and MUST
// match exactly once — a missing anchor throws, so source drift fails loudly (never silent).

const RESULT_TYPE =
  `{ normalizedScore: number; outcome: 'win' | 'loss' | 'draw' | 'completed'; metrics?: Record<string, string | number | boolean> }`;

// ── Per-game outcome mapping (engine-agnostic knowledge; a future target can reuse this) ──
// Each entry: how to add `complete?` to mount's host, and where/how to emit it once at
// game-over, reusing the game's own terminal guard so it can't double-fire.
const GAME_PATCHES = {
  'game-a': () => [
    {
      file: 'src/game/games/game-a/game-a.ts',
      find: `host?: { exit?: () => void; sessionIn?: GameASessionIn }`,
      replace: `host?: { exit?: () => void; sessionIn?: GameASessionIn; complete?: (r: ${RESULT_TYPE}) => void }`,
    },
    {
      file: 'src/game/games/game-a/game-a.ts',
      find: `  let session: GuandanSession | null = null;`,
      replace: `  let session: GuandanSession | null = null;\n  let completedRun = false; // DokiWorld 终局一次性回传闸（与卡片 SessionOut 并存·不替换）`,
    },
    {
      file: 'src/game/games/game-a/game-a.ts',
      find: `    session = new GuandanSession({ seed: lastSeed, stake: selStake, tier: selDifficulty });`,
      replace: `    session = new GuandanSession({ seed: lastSeed, stake: selStake, tier: selDifficulty });\n    completedRun = false;`,
    },
    {
      file: 'src/game/games/game-a/game-a.ts',
      find: `      lastSessionOut = computeSessionOut(session); // 盘/局终局：构造 SessionOut（REQ-CHARCARD·纯确定性）`,
      replace: `      lastSessionOut = computeSessionOut(session); // 盘/局终局：构造 SessionOut（REQ-CHARCARD·纯确定性）\n      if (!completedRun && (session.phase === 'run-won' || session.phase === 'run-lost')) {\n        completedRun = true;\n        host?.complete?.({ normalizedScore: session.phase === 'run-won' ? 100 : 0, outcome: session.phase === 'run-won' ? 'win' : 'loss', metrics: { rounds: session.round, wallet: session.wallets.hero } });\n      }`,
    },
  ],
  'game-b': () => [
    {
      file: 'src/game/games/game-b/game-b.ts',
      find: `host?: { exit?: () => void; sessionIn?: GameBSessionIn }`,
      replace: `host?: { exit?: () => void; sessionIn?: GameBSessionIn; complete?: (r: ${RESULT_TYPE}) => void }`,
    },
    {
      file: 'src/game/games/game-b/game-b.ts',
      find: `    const match = resume ?? startMatch(seed, seatNames); // 席名走角色卡桥（REQ-CHARCARD）`,
      replace: `    const match = resume ?? startMatch(seed, seatNames); // 席名走角色卡桥（REQ-CHARCARD）\n    let completedMatch = false; // DokiWorld 终局一次性回传闸（与卡片 SessionOut 并存·不替换）`,
    },
    {
      file: 'src/game/games/game-b/game-b.ts',
      find: `      if (match.over) lastSessionOut = computeSessionOut(match); // 终局回传就绪（REQ-CHARCARD·纯确定性·平台尚未消费）`,
      replace: `      if (match.over) lastSessionOut = computeSessionOut(match); // 终局回传就绪（REQ-CHARCARD·纯确定性·平台尚未消费）\n      if (match.over && !completedMatch) {\n        completedMatch = true;\n        const heroScore = match.scores[0] ?? 0;\n        const rank = [...match.scores].sort((a, b) => b - a).findIndex((s) => s === heroScore) + 1;\n        const normalizedScore = Math.round(100 * (match.scores.length - rank) / Math.max(1, match.scores.length - 1));\n        host?.complete?.({ normalizedScore, outcome: rank === 1 ? 'win' : 'loss', metrics: { rank, score: heroScore, round: match.roundNo } });\n      }`,
    },
  ],
  'game-c': () => [
    {
      file: 'src/game/games/game-c/game-c.ts',
      find: `  host?: { exit?: () => void; session?: GameCSessionIn; onSessionOut?: (out: GameCSessionOut) => void },`,
      replace: `  host?: { exit?: () => void; session?: GameCSessionIn; onSessionOut?: (out: GameCSessionOut) => void; complete?: (r: ${RESULT_TYPE}) => void },`,
    },
    {
      file: 'src/game/games/game-c/game-c.ts',
      find: `    sessionOutSent = true;\n    if (!host?.onSessionOut) return;`,
      replace: `    sessionOutSent = true;\n    host?.complete?.({ normalizedScore: session.winnerSide === 'hero' ? 100 : 0, outcome: session.winnerSide === 'hero' ? 'win' : 'loss', metrics: session.stats() });\n    if (!host?.onSessionOut) return;`,
    },
    {
      file: 'src/game/games/game-c/game-c.ts',
      find: `    back_to_story: () => { clearAiTimer(); screen = 'menu'; openWardrobe = null; showLog = false; stop3D(); gcAudio.leaveTable(); remount(); },`,
      replace: `    back_to_story: () => { clearAiTimer(); if (host?.complete) { host?.exit?.(); /* 3D/audio teardown delegated to mount() cleanup when the host unmounts the iframe */ } else { screen = 'menu'; openWardrobe = null; showLog = false; stop3D(); gcAudio.leaveTable(); remount(); } },`,
    },
  ],
};

export default {
  id: 'dokiworld',
  label: 'DokiWorld 卡带',
  supportedGames: Object.keys(GAME_PATCHES),

  files(ctx) {
    const { gameId, COMP, entryImport } = ctx;
    return {
      // Protocol bridge (DokiWorld Game Protocol v1).
      'src/dokiworldBridge.ts':
`// DokiWorld Game Protocol v1 bridge — postMessage handshake + score report over an
// iframe with sandbox="allow-scripts" (no allow-same-origin). Storage/cookies must not
// be assumed; persist via the host if needed.
export type DokiWorldGameOutcome = 'win' | 'loss' | 'draw' | 'completed';
export type DokiWorldGameResult = {
  normalizedScore: number;
  outcome: DokiWorldGameOutcome;
  metrics?: Record<string, string | number | boolean>;
};
export type DokiWorldGameHost = {
  exit: () => void;
  complete: (result: DokiWorldGameResult) => void;
};

const PROTOCOL_VERSION = 'v1';

export function createDokiWorldBridge(gameId: string): DokiWorldGameHost & { dispose: () => void } {
  let runId: string | null = null;
  let parentOrigin = '*';
  try { if (document.referrer) parentOrigin = new URL(document.referrer).origin; } catch { /* keep '*' */ }

  const post = (type: string, payload: Record<string, unknown> = {}): void => {
    window.parent?.postMessage({ type, gameId, runId, ...payload }, parentOrigin);
  };

  const onMessage = (e: MessageEvent): void => {
    if (e.source !== window.parent) return;                 // only the host frame
    const d = e.data as { type?: string; protocolVersion?: string; gameId?: string; runId?: string } | null;
    if (!d || d.type !== 'dokiworld-game-init') return;
    if (d.protocolVersion !== PROTOCOL_VERSION || d.gameId !== gameId || !d.runId) return;
    runId = d.runId;
    // Pin to the host's real origin from the init event (opaque-origin iframes strip
    // document.referrer, so this is the reliable source). Only '*' before init.
    if (e.origin && e.origin !== 'null') parentOrigin = e.origin;
    post('dokiworld-game-initialized');
  };

  window.addEventListener('message', onMessage);
  post('dokiworld-game-ready');

  return {
    exit: () => post('dokiworld-game-close'),
    complete: (result: DokiWorldGameResult) => {
      const normalizedScore = Math.max(0, Math.min(100, Math.round(result.normalizedScore)));
      post('dokiworld-game-result', { result: { ...result, normalizedScore } });
    },
    dispose: () => window.removeEventListener('message', onMessage),
  };
}
`,
      // React entry wired to the bridge.
      'src/main.tsx':
`import { createRoot } from 'react-dom/client';
import { ${COMP} } from './${COMP}.js';
import { createDokiWorldBridge } from './dokiworldBridge.js';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

const bridge = createDokiWorldBridge('${gameId}');
createRoot(root).render(
  <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
    <${COMP} onExit={bridge.exit} onComplete={bridge.complete} />
  </div>,
);
window.addEventListener('pagehide', bridge.dispose, { once: true });
`,
      // Wrapper with onComplete, threading host caps to mount() via refs.
      [`src/${COMP}.tsx`]:
`import { useEffect, useRef } from 'react';
import { mount } from '${entryImport}';
import type { DokiWorldGameResult } from './dokiworldBridge.js';

export interface ${COMP}Props {
  onExit?: () => void;
  onComplete?: (result: DokiWorldGameResult) => void;
  style?: React.CSSProperties;
  className?: string;
}

export function ${COMP}({ onExit, onComplete, style, className }: ${COMP}Props): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const onExitRef = useRef(onExit); onExitRef.current = onExit;
  const onCompleteRef = useRef(onComplete); onCompleteRef.current = onComplete;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanup = mount(el, {
      exit: () => onExitRef.current?.(),
      complete: (result) => onCompleteRef.current?.(result),
    });
    return () => cleanup?.();
  }, []);
  return <div ref={ref} className={className} style={{ width: '100%', height: '100%', position: 'relative', ...style }} />;
}

export default ${COMP};
`,
      // Vite config: relative base + flatten public/games/<id>/* → dist/* for /games/<id>/ hosting.
      'vite.config.ts':
`import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { existsSync, cpSync, rmSync } from 'fs';

// DokiWorld mounts each cartridge's dist at /games/${gameId}/, so entry JS + chunks use a
// relative base, and public/games/${gameId}/* must be flattened to dist/* (else assets land
// at /games/${gameId}/games/${gameId}/...). See the external source change list §9.
function flattenPublicGames() {
  return {
    name: 'dokiworld-flatten-public',
    closeBundle() {
      const nested = resolve(__dirname, 'dist/games/${gameId}');
      if (existsSync(nested)) {
        cpSync(nested, resolve(__dirname, 'dist'), { recursive: true });
        rmSync(resolve(__dirname, 'dist/games'), { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), flattenPublicGames()],
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/game/engine'),
      '@skills': resolve(__dirname, 'src/game/skills'),
      '@atom-skills': resolve(__dirname, 'src/game/skills/atoms'),
      '@assets': resolve(__dirname, 'src/game/assets'),
      '@services': resolve(__dirname, 'src/game/services'),
      '@renderer': resolve(__dirname, 'src/game/renderer'),
      '@ui': resolve(__dirname, 'src/game/ui'),
      '@net': resolve(__dirname, 'src/game/net'),
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
`,
    };
  },

  patchGame(ctx) {
    const make = GAME_PATCHES[ctx.gameId];
    if (!make) {
      throw new Error(
        `DokiWorld 导出暂不支持 ${ctx.gameId}：缺少该游戏的终局计分映射（需在 tools/export-targets/dokiworld.mjs 的 GAME_PATCHES 里补一条·对齐其卡片 SessionOut 终局闸）。当前支持：${Object.keys(GAME_PATCHES).join(', ')}`);
    }
    return make();
  },
};
