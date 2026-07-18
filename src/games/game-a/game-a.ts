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
import { GuandanSession, TURN_ORDER, teamOf, FAMILY_CN, fmtCardCode, type SeatId } from './guandan-session.js';
import { buildMenu, buildTableSelect, buildPlay, buildResult, type SeatView, type PlayView, type ResultView } from './hud.js';
import { SEATS, DRESS_TIERS, INITIAL_FUNDS, STAKES, AI_TIERS, codeSuit, codeRank, sortHand } from './rules.js';
import { FIELD_W, FIELD_H, MANOR_BG, WRAPPER_BG, GAME_A_THEME } from './theme.js';

const RUN_SEED = 20260717; // 骨架期固定 run 种子；生涯存档随 run 快照=后续接
const AI_DELAY_MS = 700; // 拟人思考延迟（gdd §5·表现层·0.6~1.2s 档内取中）

export function mount(container: HTMLElement): () => void {
  const skel = mountHost(container, { fieldW: FIELD_W, fieldH: FIELD_H, sceneBackground: MANOR_BG, wrapperBackground: WRAPPER_BG });
  const { overlayHost } = skel;
  overlayHost.style.pointerEvents = 'auto';

  let ui: MountHandle | null = null;
  let session: GuandanSession | null = null;
  let selected: number[] = []; // 选中手牌**下标**（指向显示顺序·非牌码·避同码联动）
  let sortMode: 'rank' | 'family' = 'rank'; // 理牌显示排序（视图·不碰 sim）
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  // 无 session 时的屏（menu 门面 / select 选桌）；选桌暂存所选难度底注。
  let screen: 'menu' | 'select' = 'menu';
  let selDifficulty: 'l1' | 'l2' | 'l3' | 'l4' = 'l2';
  let selStake = STAKES[0];
  let wallet = INITIAL_FUNDS; // 生涯钱包（跨桌持久·带出回写；存档=后续）
  let runCount = 0; // 上桌计数（seed 递增·每局不同牌·确定性可复现）
  let showCounter = false; // 记牌器开合（玩家辅助·只统计明面已出牌·不开天眼·gdd §5）
  let menuOpen = false; // 游戏内菜单（☰·出牌日志/规则说明/设置）开合（避与 showMenu() 屏切换函数撞名）
  let menuTab: 'log' | 'rules' | 'settings' = 'log'; // 菜单当前页（宿主记·AI 重渲不丢页）

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

  // 理牌显示顺序（视图·selected 下标以此为准；sim 手牌不动）。
  function displayHand(s: GuandanSession): number[] {
    return sortHand(s.hands.hero, sortMode, s.playLevel);
  }
  // 选中下标 → 牌码（按**显示顺序**取·下标越界丢弃）。
  function selectedCodes(s: GuandanSession): number[] {
    const hand = displayHand(s);
    return selected.filter((i) => i >= 0 && i < hand.length).map((i) => hand[i]);
  }

  // ── 合法性投影（禁用态/原因·纯读 session·判型在 sim）──────────────────────────
  function commitState(s: GuandanSession): { canCommit: boolean; why: string } {
    if (selected.length === 0) return { canCommit: false, why: '点牌选中 · 出牌或过' };
    const chk = s.legalCheck('hero', selectedCodes(s));
    return { canCommit: chk.ok, why: chk.ok ? '' : (chk.why ?? '不合法') };
  }

  // 记牌器（明面已出牌计数·从 playLog 本盘聚合·不开天眼）。总数：2-A 各 8 张(两副×4花色)·王各 2 张。
  const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '小王', 16: '大王' };
  function counterData(s: GuandanSession): { rank: string; played: number; total: number }[] {
    const counts = new Map<number, number>();
    for (const e of s.playLog) {
      if (e.round !== s.round) continue;
      for (const c of e.cards) counts.set(codeRank(c), (counts.get(codeRank(c)) ?? 0) + 1);
    }
    const rows: { rank: string; played: number; total: number }[] = [];
    for (let r = 2; r <= 14; r++) rows.push({ rank: RANK_LABEL[r] ?? String(r), played: counts.get(r) ?? 0, total: 8 });
    rows.push({ rank: '小王', played: counts.get(15) ?? 0, total: 2 });
    rows.push({ rank: '大王', played: counts.get(16) ?? 0, total: 2 });
    return rows;
  }

  // 出牌日志行（本盘·newest last·供游戏内菜单「出牌日志」页·玩家可复制贴作者排查 freeze/牌型）。
  const ACT_CN: Record<string, string> = { lead: '领出', follow: '跟', pass: '过' };
  function logRows(s: GuandanSession): { round: number; who: string; act: string; cards: string; fam: string }[] {
    return s.playLog
      .filter((e) => e.round === s.round)
      .slice(-60)
      .map((e) => ({
        round: e.round,
        who: e.seatName,
        act: ACT_CN[e.action] ?? e.action,
        cards: e.action === 'pass' ? '—' : e.cards.map(fmtCardCode).join(' '),
        fam: e.family ? (FAMILY_CN[e.family] ?? e.family) : '—',
      }));
  }

  // 本盘进贡/还贡一句话（首盘=null·抗贡/正常各态·玩家知情）。
  function tributeText(s: GuandanSession): string | null {
    if (s.round <= 1) return null;
    if (s.resisted) return '抗贡成功 · 双大王免进贡 · 头游先出';
    if (s.tributes.length === 0) return null;
    return s.tributes
      .map((t) => {
        const base = `${seatSpec(t.from).name} 进 ${fmtCardCode(t.card)} → ${seatSpec(t.to).name}`;
        return t.returned != null ? `${base}（还 ${fmtCardCode(t.returned)}）` : base;
      })
      .join(' ； ');
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
      hand: displayHand(s),
      selected: [...selected],
      sortMode,
      trick: s.currentTrick
        ? {
            name: FAMILY_CN[s.currentTrick.match.family] ?? s.currentTrick.match.family,
            family: s.currentTrick.match.family,
            cards: s.currentTrick.cards,
            holder: s.currentTrick.seat, // 当前墩持有者（暂大·谁出的牌谁大）
            holderName: seatSpec(s.currentTrick.seat).name,
            holderTeam: teamOf(s.currentTrick.seat),
          }
        : null,
      tributeText: tributeText(s),
      showCounter,
      counter: showCounter ? counterData(s) : [],
      canCommit: cs.canCommit,
      commitWhy: cs.why,
      canPass: s.currentTrick !== null,
      showMenu: menuOpen,
      menuTab,
      logRows: menuOpen ? logRows(s) : [],
      tierName: AI_TIERS.find((t) => t.id === s.tier)?.name ?? s.tier,
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

  // ── 渲染路由（无 session=menu/select 门面·有 session=play/result）─────────────────
  function render(): void {
    if (!session) {
      ui?.update(screen === 'select' ? buildTableSelect({ difficulty: selDifficulty, stake: selStake, wallet }) : buildMenu(), GAME_A_THEME);
      return;
    }
    if (session.phase === 'playing') ui?.update(buildPlay(playView(session)), GAME_A_THEME);
    else ui?.update(buildResult(resultView(session)), GAME_A_THEME);
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
    screen = 'menu';
    ui?.();
    ui = mountUI(overlayHost, buildMenu(), handlers, GAME_A_THEME);
  }

  function showTableSelect(): void {
    stopSession();
    screen = 'select';
    ui?.();
    ui = mountUI(overlayHost, buildTableSelect({ difficulty: selDifficulty, stake: selStake, wallet }), handlers, GAME_A_THEME);
  }

  function enterTable(): void {
    stopSession();
    session = new GuandanSession({ seed: RUN_SEED + runCount++, stake: selStake, tier: selDifficulty });
    selected = [];
    sortMode = 'rank';
    ui?.();
    ui = mountUI(overlayHost, buildPlay(playView(session)), handlers, GAME_A_THEME);
    scheduleAi();
  }

  const handlers: HandlerMap = {
    'menu.start': () => showTableSelect(),
    'table.back': () => showMenu(),
    // 选桌 SC-2
    'select.difficulty': (arg?: string) => {
      if (arg === 'l1' || arg === 'l2' || arg === 'l3' || arg === 'l4') selDifficulty = arg;
      render();
    },
    'select.stake': (arg?: string) => {
      const s = Number(arg);
      if (STAKES.includes(s)) selStake = s;
      render();
    },
    'select.back': () => showMenu(),
    'select.seat': () => enterTable(),
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
      // 牌码 → **显示顺序**下标（消耗式映射·同码取不同下标）——必须用 displayHand（与 selected/出牌同基准），
      // 否则理牌排序（sortMode）下高亮错位、提示的牌点出去被判非法（owner 2026-07-18 报「提示给错牌」根因）。
      selected = [];
      if (hintCodes) {
        const hand = displayHand(session);
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
    // 理牌切换（按点数/按牌型）：纯视图排序（不碰 sim）；切换清选（idx 基准变）。
    'hand.sort': (arg?: string) => {
      if (!session) return;
      sortMode = arg === 'family' ? 'family' : 'rank';
      selected = [];
      render();
    },
    // 记牌器开合（明面已出牌·辅助）。
    'tools.counter': () => {
      if (!session) return;
      showCounter = !showCounter;
      render();
    },
    // 游戏内菜单（☰·出牌日志/规则说明/设置）。
    'menu.open': () => {
      if (!session) return;
      menuOpen = true;
      render();
    },
    'menu.close': () => {
      menuOpen = false;
      render();
    },
    'menu.tab': (arg?: string) => {
      if (arg === 'log' || arg === 'rules' || arg === 'settings') menuTab = arg;
      render();
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
