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

// ── Per-game manifest metadata + character→SessionIn mapper ──────────────────────
// Owner decision "多角色没有就先空着": DokiWorld sends ONE character but our SessionIn is
// per-opponent-seat, so seat injection is left BLANK for now (games run on default cards).
// The mapper is the single hook to fill later (also gated on adult-confirmation — see CL).
const BLANK_MAPPER =
`// Seat injection from the DokiWorld character is intentionally left blank for now
// (owner: "多角色没有就先空着"; also pending the adult-confirmation gate — see CL). The
// validated character is available here; when enabled, build SessionIn from it and
// return { sessionIn } (game-c: { session }). Until then games use built-in default cards.
function mapCharacter(character?: DokiWorldCharacter): Record<string, never> {
  void character;
  return {};
}`;

const GAME_META = {
  'game-a': {
    locales: {
      en: { name: 'Guandan Night Banquet', description: 'A 4-player Guandan (tribute card game) match against three AI rivals — ranked tricks, tribute, and escalating levels.' },
      'zh-cn': { name: '掼蛋夜宴', description: '四人两副牌·升级同盟·逢局必争——对阵三名 AI 对手的掼蛋对局。' },
    },
    selection: { tags: ['cards', 'strategic', 'guandan'], promptHint: {
      en: 'Pick this when the scene calls for a tense, strategic card duel among close rivals.',
      'zh-cn': '当情节需要一场紧张、讲策略的牌桌博弈时选择该游戏。' } },
    mapperTs: BLANK_MAPPER,
  },
  'game-b': {
    locales: {
      en: { name: 'Sparrow Feast · Riichi Mahjong', description: 'A 4-player East-round Riichi mahjong table against AI opponents — calls, riichi, and real scoring.' },
      'zh-cn': { name: '雀宴 · 立直麻将', description: '四人东风战·立直麻将·暖夜和室——对阵 AI 的真算分麻将。' },
    },
    selection: { tags: ['mahjong', 'tiles', 'strategic'], promptHint: {
      en: 'Pick this for a refined, patient tile-game scene of reading and misdirection.',
      'zh-cn': '当情节适合一场含蓄、比耐心与读牌的麻将时选择该游戏。' } },
    mapperTs: BLANK_MAPPER,
  },
  'game-c': {
    locales: {
      en: { name: 'Six-Seat Hold’em', description: 'A 6-seat no-limit Texas Hold’em cash game against five AI rivals — blinds, betting, showdowns.' },
      'zh-cn': { name: '六人德州', description: '单人对阵五名 AI 的六人桌标准德州扑克现金局——盲注·下注·摊牌。' },
    },
    selection: { tags: ['poker', 'cards', 'bluffing'], promptHint: {
      en: 'Pick this for a high-stakes bluffing scene of nerve and reading opponents.',
      'zh-cn': '当情节需要一场高注、比胆识与读人的德州扑克时选择该游戏。' } },
    mapperTs: BLANK_MAPPER,
  },
};

export default {
  id: 'dokiworld',
  label: 'DokiWorld 卡带',
  supportedGames: Object.keys(GAME_PATCHES),

  files(ctx) {
    const { gameId, COMP, entryImport } = ctx;
    const meta = GAME_META[gameId];
    return {
      // game.json — DokiWorld registration manifest (spec §2). Deployed at the game dir root.
      'public/game.json': JSON.stringify({
        schemaVersion: 1,
        id: gameId,
        status: 'active',
        entry: 'index.html',
        protocolVersion: 1,
        // Owner decision: character context is mapped into an opponent seat, so the card
        // scopes are declared required. NOTE: activation is gated on the adult-confirmation
        // decision (these titles are adult-themed; the card service requires adultConfirmed).
        contextScopes: { required: ['character.identity', 'character.avatar', 'character.card'], optional: [] },
        locales: meta.locales,
        selection: meta.selection,
      }, null, 2) + '\n',

      // Protocol bridge (DokiWorld Game Protocol v1 — spec §6). protocolVersion is the
      // NUMBER 1. Runs over an iframe with sandbox="allow-scripts" (opaque origin): validate
      // source + origin + identity + context schema on every message; never trust storage.
      'src/dokiworldBridge.ts':
`const PROTOCOL_VERSION = 1 as const;

export type GameContextScope = 'character.identity' | 'character.avatar' | 'character.card';

export type DokiWorldCharacter = {
  id?: string;
  displayName?: string;
  avatar?: { url: string; alt: string };
  card?: { description: string; tags: string[] };
};

export type DokiWorldGameInit = {
  type: 'dokiworld-game-init';
  protocolVersion: 1;
  gameId: string;
  runId: string;
  locale: string;
  grantedScopes: GameContextScope[];
  context: { schemaVersion: 1; character?: DokiWorldCharacter };
};

export type DokiWorldGameResult = {
  normalizedScore: number;
  outcome: 'win' | 'loss' | 'draw' | 'completed';
  metrics?: Record<string, string | number | boolean>;
};

const ALLOWED_SCOPES = new Set<GameContextScope>(['character.identity', 'character.avatar', 'character.card']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v));
}
function parentOriginFromReferrer(): string | null {
  if (!document.referrer) return null;
  try { return new URL(document.referrer).origin; } catch { return null; }
}
function isGameInit(value: unknown, expectedGameId: string): value is DokiWorldGameInit {
  if (!isRecord(value)) return false;
  const m = value;
  if (m.type !== 'dokiworld-game-init' || m.protocolVersion !== PROTOCOL_VERSION
    || m.gameId !== expectedGameId || typeof m.runId !== 'string' || !m.runId
    || !Array.isArray(m.grantedScopes)) return false;
  if (!m.grantedScopes.every((s) => ALLOWED_SCOPES.has(s as GameContextScope))) return false;
  if (new Set(m.grantedScopes).size !== m.grantedScopes.length) return false;
  if (!isRecord(m.context) || m.context.schemaVersion !== 1) return false;
  const c = m.context.character;
  if (c !== undefined && !isRecord(c)) return false;
  if (m.grantedScopes.includes('character.identity')) {
    if (!isRecord(c) || typeof c.id !== 'string' || !c.id) return false;
    if (typeof c.displayName !== 'string' || !c.displayName) return false;
  }
  if (m.grantedScopes.includes('character.avatar')) {
    if (!isRecord(c) || !isRecord(c.avatar)) return false;
    if (typeof c.avatar.url !== 'string' || !c.avatar.url) return false;
    if (typeof c.avatar.alt !== 'string') return false;
  }
  if (m.grantedScopes.includes('character.card')) {
    if (!isRecord(c) || !isRecord(c.card)) return false;
    if (typeof c.card.description !== 'string') return false;
    if (!Array.isArray(c.card.tags) || !c.card.tags.every((t) => typeof t === 'string')) return false;
  }
  return true;
}

export function createDokiWorldBridge(gameId: string) {
  let runId: string | null = null;
  let parentOrigin = parentOriginFromReferrer();
  let resolveInit!: (init: DokiWorldGameInit) => void;
  const initialized = new Promise<DokiWorldGameInit>((resolve) => { resolveInit = resolve; });

  const post = (payload: Record<string, unknown>): void => {
    if (window.parent === window) return;                          // standalone: no host, stay inert
    window.parent.postMessage({ protocolVersion: PROTOCOL_VERSION, gameId, runId, ...payload }, parentOrigin ?? '*');
  };

  const onMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent) return;                    // only the host frame
    if (parentOrigin && event.origin !== parentOrigin) return;     // pin origin once known
    if (!isGameInit(event.data, gameId)) return;
    if (runId && runId !== event.data.runId) return;               // ignore other runs
    parentOrigin = event.origin;
    const first = runId === null;
    runId = event.data.runId;
    if (first) resolveInit(event.data);                            // resolve once; init is idempotent
    post({ type: 'dokiworld-game-initialized' });
  };

  window.addEventListener('message', onMessage);
  queueMicrotask(() => post({ type: 'dokiworld-game-ready' }));

  return {
    initialized,
    complete(result: DokiWorldGameResult) {
      if (!runId || !Number.isFinite(result.normalizedScore)) return;
      const normalizedScore = Math.round(Math.min(100, Math.max(0, result.normalizedScore)));
      post({ type: 'dokiworld-game-result', result: { ...result, normalizedScore } });
    },
    resize(height: number) {
      if (!runId || !Number.isFinite(height)) return;
      post({ type: 'dokiworld-game-resize', height: Math.round(height) });
    },
    close() { if (runId) post({ type: 'dokiworld-game-close' }); },
    dispose() { window.removeEventListener('message', onMessage); },
  };
}
`,
      // React entry (spec §6): render immediately (menu shows before init), wire result/close.
      // The validated character context (bridge.initialized) is forwarded to the wrapper;
      // whether it is injected into a seat is decided there (see mapCharacter — adult-gate).
      'src/main.tsx':
`import { createRoot } from 'react-dom/client';
import { ${COMP} } from './${COMP}.js';
import { createDokiWorldBridge, type DokiWorldCharacter } from './dokiworldBridge.js';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

const bridge = createDokiWorldBridge('${gameId}');
let character: DokiWorldCharacter | undefined;

const render = (): void => {
  createRoot(root).render(
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <${COMP} character={character} onExit={bridge.close} onComplete={bridge.complete} />
    </div>,
  );
};

// Standalone (no host frame): render straight away. Under DokiWorld: apply the validated
// character context from init, then render. (Init arrives promptly after our ready.)
if (window.parent === window) {
  render();
} else {
  void bridge.initialized.then((init) => { character = init.context.character; render(); });
}
window.addEventListener('pagehide', bridge.dispose, { once: true });
`,
      // Wrapper: maps the (validated) DokiWorld character into this game's SessionIn and
      // threads host caps to mount(). See mapCharacter for the adult-gate seat injection.
      [`src/${COMP}.tsx`]:
`import { useEffect, useRef } from 'react';
import { mount } from '${entryImport}';
import type { DokiWorldGameResult, DokiWorldCharacter } from './dokiworldBridge.js';

export interface ${COMP}Props {
  character?: DokiWorldCharacter;
  onExit?: () => void;
  onComplete?: (result: DokiWorldGameResult) => void;
  style?: React.CSSProperties;
  className?: string;
}

${meta.mapperTs}

export function ${COMP}({ character, onExit, onComplete, style, className }: ${COMP}Props): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const onExitRef = useRef(onExit); onExitRef.current = onExit;
  const onCompleteRef = useRef(onComplete); onCompleteRef.current = onComplete;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanup = mount(el, {
      ...mapCharacter(character),
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
