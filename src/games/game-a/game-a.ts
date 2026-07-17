// Game A ·《掼蛋夜宴》—— 宿主层（S4 玩法关·mount-host helper·零手写 DOM·零判型/结算逻辑）。
//
// 职责（都在 sim 外·outcome-first）：mountHost 搭骨架；SC-1 菜单 ⇄ 牌桌 ⇄ 结算三屏切换；
// 上桌=建 GuandanSession（内嵌 Engine·盘循环在 sim 脚本）→ 投影 world/session 状态进 LayoutNode。
// handler 只做「选牌记账 + 调 session.act/hint/nextRound + 重渲 + 排 AI 步」——判型/压制/结算全在
// guandan-session（capability-plan 例外①②·已过审）。AI 拟人延迟=表现层 setTimeout（不进 sim/hash）。
// UI 全 LayoutNode（mountUI）·随机全在 session 侧种子 PRNG（宿主零随机·延迟计时不是随机）。
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import { GuandanSession, TURN_ORDER, teamOf, FAMILY_CN, type SeatId } from './guandan-session.js';
import { buildMenu, buildTable, buildPlay, buildResult, type SeatView, type PlayView, type ResultView, type TableView } from './hud.js';
import { SEATS, DRESS_TIERS, INITIAL_FUNDS, codeSuit, codeRank } from './rules.js';
import { FIELD_W, FIELD_H, MANOR_BG, WRAPPER_BG } from './theme.js';

const RUN_SEED = 20260717; // 骨架期固定 run 种子；生涯存档随 run 快照=后续接
const AI_DELAY_MS = 700; // 拟人思考延迟（gdd §5·表现层·0.6~1.2s 档内取中）

export function mount(container: HTMLElement): () => void {
  const skel = mountHost(container, { fieldW: FIELD_W, fieldH: FIELD_H, sceneBackground: MANOR_BG, wrapperBackground: WRAPPER_BG });
  const { overlayHost } = skel;
  overlayHost.style.pointerEvents = 'auto';

  let ui: MountHandle | null = null;
  let session: GuandanSession | null = null;
  let selected: number[] = []; // 选中手牌**下标**（非牌码·避同码联动）
  let aiTimer: ReturnType<typeof setTimeout> | null = null;

  const seatSpec = (id: SeatId): SeatView['seat'] => SEATS.find((s) => s.id === id)!;
  const seatView = (id: SeatId): SeatView => ({
    seat: seatSpec(id),
    cards: session ? session.hands[id].length : 0,
    dress: session ? session.dress[id] : DRESS_TIERS,
  });

  function clearAiTimer(): void {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  // 选中下标 → 牌码（去重后按当前手牌取·下标越界丢弃）。
  function selectedCodes(s: GuandanSession): number[] {
    const hand = s.hands.hero;
    return selected.filter((i) => i >= 0 && i < hand.length).map((i) => hand[i]);
  }

  // ── 合法性投影（禁用态/原因·纯读 session·判型在 sim）──────────────────────────
  function commitState(s: GuandanSession): { canCommit: boolean; why: string } {
    if (selected.length === 0) return { canCommit: false, why: '点牌选中 · 出牌或过' };
    const chk = s.legalCheck('hero', selectedCodes(s));
    return { canCommit: chk.ok, why: chk.ok ? '' : (chk.why ?? '不合法') };
  }

  function playView(s: GuandanSession): PlayView {
    const cs = commitState(s);
    return {
      round: s.round,
      stake: s.stake,
      levelPlay: s.playLevel,
      levelOurs: s.levels[0],
      levelTheirs: s.levels[1],
      wallet: s.wallets.hero,
      turn: s.turn,
      turnName: seatSpec(s.turn).name,
      seats: { partner: seatView('partner'), west: seatView('west'), east: seatView('east'), hero: seatView('hero') },
      hand: [...s.hands.hero],
      selected: [...selected],
      trick: s.currentTrick
        ? { name: FAMILY_CN[s.currentTrick.match.family] ?? s.currentTrick.match.family, family: s.currentTrick.match.family, cards: s.currentTrick.cards }
        : null,
      canCommit: cs.canCommit,
      commitWhy: cs.why,
      canPass: s.currentTrick !== null,
    };
  }

  function resultView(s: GuandanSession): ResultView {
    const r = s.lastResult!;
    return {
      ranking: r.ranking.map((seat) => ({ seat, name: seatSpec(seat).name, team: teamOf(seat) })),
      winnersTeam: r.winnersTeam,
      comboLabel: r.combo === 'double' ? '双上 ×3' : r.combo === 'first-third' ? '一三 ×2' : '一四 ×1',
      totalMult: r.totalMult,
      payPerPlayer: r.payPerPlayer,
      levelAfter: r.levelAfter,
      dressOutDoubled: r.dressOutDoubled,
      phase: s.phase === 'run-won' ? 'run-won' : s.phase === 'run-lost' ? 'run-lost' : 'settled',
    };
  }

  // ── 渲染路由（三屏按 session.phase）───────────────────────────────────────────
  function render(): void {
    if (!session) {
      ui?.update(buildMenu());
      return;
    }
    if (session.phase === 'playing') ui?.update(buildPlay(playView(session)));
    else ui?.update(buildResult(resultView(session)));
  }

  // ── AI 步进（拟人延迟·递归排到 hero 轮或盘终）──────────────────────────────────
  function scheduleAi(): void {
    clearAiTimer();
    if (!session || session.phase !== 'playing' || session.turn === 'hero') return;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (!session || session.phase !== 'playing' || session.turn === 'hero') return;
      session.aiStep();
      render();
      scheduleAi();
    }, AI_DELAY_MS);
  }

  // ── 生命周期 ─────────────────────────────────────────────────────────────────
  function stopSession(): void {
    clearAiTimer();
    session?.engine.stop();
    session = null;
    selected = [];
  }

  function showMenu(): void {
    stopSession();
    ui?.();
    ui = mountUI(overlayHost, buildMenu(), handlers);
  }

  function enterTable(): void {
    stopSession();
    session = new GuandanSession({ seed: RUN_SEED, stake: 100, tier: 'l2' });
    selected = [];
    ui?.();
    ui = mountUI(overlayHost, buildPlay(playView(session)), handlers);
    scheduleAi();
  }

  const handlers: HandlerMap = {
    'menu.start': () => enterTable(),
    'table.back': () => showMenu(),
    'hand.toggle': (arg?: string) => {
      if (!session || session.turn !== 'hero') return;
      const idx = Number(arg); // 手牌下标（非牌码·同码牌各占独立下标·不联动）
      if (!Number.isInteger(idx) || idx < 0 || idx >= session.hands.hero.length) return;
      const i = selected.indexOf(idx);
      if (i >= 0) selected.splice(i, 1);
      else selected.push(idx);
      render();
    },
    'play.commit': () => {
      if (!session || session.turn !== 'hero') return;
      const codes = selectedCodes(session);
      if (session.act('hero', codes)) {
        selected = [];
        render();
        scheduleAi();
      }
    },
    'play.pass': () => {
      if (!session || session.turn !== 'hero') return;
      if (session.act('hero', null)) {
        selected = [];
        render();
        scheduleAi();
      }
    },
    'play.hint': () => {
      if (!session || session.turn !== 'hero') return;
      const hintCodes = session.hint('hero');
      // 牌码 → 下标（消耗式映射·同码取不同下标·不重复选同一张）
      selected = [];
      if (hintCodes) {
        const hand = session.hands.hero;
        for (const code of hintCodes) {
          const i = hand.findIndex((c, k) => c === code && !selected.includes(k));
          if (i >= 0) selected.push(i);
        }
      }
      render();
    },
    'round.next': () => {
      if (!session) return;
      if (session.nextRound()) {
        selected = [];
        render();
        scheduleAi();
      }
    },
  };

  showMenu();

  return () => {
    stopSession();
    ui?.();
    ui = null;
    skel.teardown();
  };
}

// 骨架屏（S3 目击件·保留给单测/审计入口引用·launcher 走玩法屏）。
export function buildSkeletonTableView(): TableView {
  const sv = (id: SeatId): SeatView => ({ seat: SEATS.find((s) => s.id === id)!, cards: 0, dress: DRESS_TIERS });
  return {
    wallet: INITIAL_FUNDS, stake: 100, round: 1, levelOurs: 2, levelTheirs: 2,
    flowState: 'table-idle', deckCount: 108,
    partner: sv('partner'), west: sv('west'), east: sv('east'), hero: sv('hero'),
  };
}
