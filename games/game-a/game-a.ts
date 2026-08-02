// Game A ·《掼蛋夜宴》—— 宿主层（S4 玩法关·mount-host helper·零手写 DOM·零判型/结算逻辑）。
//
// 职责（都在 sim 外·outcome-first）：mountHost 搭骨架；SC-1 菜单 ⇄ 牌桌 ⇄ 结算三屏切换；
// 上桌=建 GuandanSession（内嵌 Engine·盘循环在 sim 脚本）→ 投影 world/session 状态进 LayoutNode。
// handler 只做「选牌记账 + 调 session.act/hint/nextRound + 重渲 + 排 AI 步」——判型/压制/结算全在
// guandan-session（capability-plan 例外①②·已过审）。AI 拟人延迟=表现层 setTimeout（不进 sim/hash）。
// UI 全 LayoutNode（mountUI）·随机全在 session 侧种子 PRNG（宿主零随机·延迟计时不是随机）。
import { mountHost } from '@zerocraft/engine/engine/host/mount-host.js';
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import type { MountHandle, HandlerMap, LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { GuandanSession, TURN_ORDER, teamOf, FAMILY_CN, fmtCardCode, type SeatId } from './guandan-session.js';
import { buildMenu, buildTableSelect, buildPlay, buildResult, type SeatView, type PlayView, type ResultView } from './hud.js';
import { type Lang, t, handName, tierName, fmtComboLabel, fmtTributeResist, fmtTributeLine } from './strings.js';
import { SEATS, DRESS_TIERS, INITIAL_FUNDS, STAKES, LEVEL_START, codeSuit, codeRank, sortHand } from './rules.js';
import { resolveSeatCards, seatPortrait, seatFlavor, buildSessionOut, type GameASessionIn, type SeatOutcome, type SeatSessionOut } from './seat-cards.js';
import { loadArtOverrides, registerArtOverrides } from './art-overrides.js';
import { FIELD_W, FIELD_H, MANOR_BG, WRAPPER_BG, GAME_A_THEME } from './theme.js';
import { mulberry32 } from '@zerocraft/engine/atom-skills/index.js';

// run 种子：时间派生（owner 2026-07-18·每局不同牌）。sim 仍确定性=给定种子可复现；
// 菜单「设置」显种子供报 bug（宿主选种子不违「宿主零随机」——sim 逻辑无裸随机·Date.now 非 Math.random）。
// 拟人思考延迟=范围随机（owner 2026-07-18·700~2000ms 每步独立抖动）。表现层·不进 sim/hash；
// 抖动取自宿主表现层 PRNG（种子派生·与 sim rng 隔离·非裸 Math.random·不扰动确定性回放）。
const AI_DELAY_MIN = 700;
const AI_DELAY_MAX = 2000;

export function mount(container: HTMLElement, host?: { exit?: () => void; sessionIn?: GameASessionIn }): () => void {
  // 角色卡消费（REQ-CHARCARD）：mount 时一次性解出四席规范卡（纯确定性·平台未接线→内置默认卡·显示零变）。
  const seatCards = resolveSeatCards(host?.sessionIn);
  // 席位立绘（owner 2026-07-22 三级链·**每次渲染实时解**·异步载入的默认立绘就绪后 re-render 即命中）：
  //   平台卡传入头像 > 内置默认立绘（SEAT_PORTRAIT_SLOT·工坊/index 注册真图）> 都无=undefined→退首字铭牌（空就不画）。
  const seatAvatarMap = (): Partial<Record<SeatId, string>> => {
    const m: Partial<Record<SeatId, string>> = {};
    for (const s of SEATS) {
      const a = seatPortrait(s.id, seatCards[s.id]);
      if (a) m[s.id] = a;
    }
    return m;
  };
  let lastSessionOut: Record<string, SeatSessionOut> | null = null; // 终局回传（REQ-CHARCARD·经返回句柄 getSessionOut 暴露）
  let dealAnim = false; // 发牌错落入场只在**开局/新盘首帧**播（owner 2026-07-22：别每次点击/提示/出牌都重跑手牌入场·那是过度表现）。

  const skel = mountHost(container, { fieldW: FIELD_W, fieldH: FIELD_H, sceneBackground: MANOR_BG, wrapperBackground: WRAPPER_BG });
  const { overlayHost } = skel;
  overlayHost.style.pointerEvents = 'auto';

  let ui: MountHandle | null = null;
  let session: GuandanSession | null = null;
  let selected: number[] = []; // 选中手牌**下标**（指向显示顺序·非牌码·避同码联动）
  let sortMode: 'rank' | 'family' = 'rank'; // 理牌显示排序（视图·不碰 sim）
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  let aiRng: () => number = mulberry32(1); // 表现层拟人延迟抖动 PRNG（enterTable 按 run 种子重播·非 sim 随机·不进 hash）
  // 无 session 时的屏（menu 门面 / select 选桌）；选桌暂存所选难度底注。
  let screen: 'menu' | 'select' = 'menu';
  let selDifficulty: 'l1' | 'l2' | 'l3' | 'l4' = 'l2';
  let selStake = STAKES[0];
  let wallet = INITIAL_FUNDS; // 生涯钱包（跨桌持久·带出回写；存档=后续）
  let runCount = 0; // 上桌计数（同毫秒开局的种子微扰·避撞）
  let lastSeed = 0; // 上一局 run 种子（菜单「设置」显示·供报 bug 复现）
  let showCounter = false; // 记牌器开合（玩家辅助·只统计明面已出牌·不开天眼·gdd §5）
  let menuOpen = false; // 游戏内菜单（☰·出牌日志/规则说明/设置）开合（避与 showMenu() 屏切换函数撞名）
  let menuTab: 'log' | 'rules' | 'settings' = 'log'; // 菜单当前页（宿主记·AI 重渲不丢页）
  // 界面语言（owner 2026-07-20 中英切换·**默认中文**·game-c 默认英语·本作 owner 钦定中文·localStorage 持久）。
  const LANG_KEY = 'ga_lang';
  const loadLang = (): Lang => { try { return typeof localStorage !== 'undefined' && localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'; } catch { return 'zh'; } };
  const saveLang = (x: Lang): void => { try { localStorage.setItem(LANG_KEY, x); } catch { /* 无 localStorage */ } };
  let lang: Lang = loadLang();

  // 主菜单视图（无 session·1:1 设计稿·wallet 持久·级牌无存档=起始）。
  const menuView = () => ({ lang, wallet, level: LEVEL_START, showMenu: menuOpen, menuTab });
  const seatSpec = (id: SeatId): SeatView['seat'] => SEATS.find((s) => s.id === id)!;
  // 座位显示名：hero='你'/You 经字典本地化；AI 专名取角色卡 name（默认卡===SEATS 原名·透明；平台覆盖时随卡）。
  const displayName = (id: SeatId): string => (id === 'hero' ? t(lang, 'seat.you') : seatCards[id].name);
  const seatView = (id: SeatId): SeatView => ({
    // 席位铭牌名与 displayName 同源=角色卡 name（AI 席；默认卡===SEATS 原名·透明·平台覆盖时铭牌/轮次名一致不裂）。
    // hero 席不走 seatCard（用左侧立绘框）·保留 SEATS「你」——立绘头像首字仍显「你」不受影响。
    seat: id === 'hero' ? seatSpec(id) : { ...seatSpec(id), name: seatCards[id].name },
    cards: session ? session.hands[id].length : 0,
    dress: session ? session.dress[id] : DRESS_TIERS,
    avatar: seatPortrait(id, seatCards[id]), // 立绘三级链（传入>默认>空不画·实时解·见 seat-cards）
    flavor: seatFlavor(seatCards[id]), // 人设问候（闲时气泡·已截断·外部不可信输入）
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
    if (selected.length === 0) return { canCommit: false, why: t(lang, 'play.selectHint') };
    const chk = s.legalCheck('hero', selectedCodes(s));
    // chk.why = session.legalCheck 的中文机读原因（红线·恒中文·EN 模式仍显中文·可接受）；仅宿主兜底默认走字典。
    return { canCommit: chk.ok, why: chk.ok ? '' : (chk.why ?? t(lang, 'play.illegal')) };
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
  // 日志正文=中文机读口径（红线·恒中文·同 game-c 确定性事件流）；仅面板 chrome 双语（见 hud buildGameMenu）。
  const ACT_CN: Record<string, string> = { lead: '领出', follow: '跟', pass: '过' };
  function logRows(s: GuandanSession): { round: number; who: string; act: string; cards: string; fam: string; pass: boolean }[] {
    return s.playLog
      .filter((e) => e.round === s.round)
      .slice(-60)
      .map((e) => ({
        round: e.round,
        who: e.seatName,
        act: ACT_CN[e.action] ?? e.action,
        // 逢人配（红桃级牌🃏）标出·让玩家看懂含百搭的合法牌型（owner 2026-07-18）
        cards: e.action === 'pass' ? '—' : e.cards.map((c) => fmtCardCode(c, s.playLevel)).join(' '),
        fam: e.family ? `${FAMILY_CN[e.family] ?? e.family}${e.wilds > 0 ? `·${e.wilds}🃏` : ''}` : '—',
        pass: e.action === 'pass', // 过牌行置灰用（非中文串比对·hud 用 r.pass）
      }));
  }

  // 本盘进贡/还贡一句话（首盘=null·抗贡/正常各态·玩家知情）。连接词双语；牌码=红线机读口径恒中文（fmtCardCode）。
  function tributeText(s: GuandanSession): string | null {
    if (s.round <= 1) return null;
    if (s.resisted) return fmtTributeResist(lang);
    if (s.tributes.length === 0) return null;
    return s.tributes
      .map((tr) => fmtTributeLine(lang, displayName(tr.from), fmtCardCode(tr.card), displayName(tr.to), tr.returned != null ? fmtCardCode(tr.returned) : null))
      .join(lang === 'zh' ? ' ； ' : ' ; ');
  }

  function playView(s: GuandanSession): PlayView {
    const cs = commitState(s);
    return {
      lang,
      round: s.round,
      stake: s.stake,
      levelPlay: s.playLevel,
      levelOurs: s.levels[0],
      levelTheirs: s.levels[1],
      wallet: s.wallets.hero,
      turn: s.turn,
      turnName: displayName(s.turn), // hero='你'/You 本地化·AI 专名恒中文
      seats: { partner: seatView('partner'), west: seatView('west'), east: seatView('east'), hero: seatView('hero') },
      hand: displayHand(s),
      selected: [...selected],
      sortMode,
      trick: s.currentTrick
        ? {
            name: handName(lang, s.currentTrick.match.family), // 牌型显示名双语（不碰 session FAMILY_CN 日志口径）
            family: s.currentTrick.match.family,
            cards: s.currentTrick.cards,
            holder: s.currentTrick.seat, // 当前墩持有者（暂大·谁出的牌谁大）
            holderName: displayName(s.currentTrick.seat),
            holderTeam: teamOf(s.currentTrick.seat),
            wilds: s.currentTrick.match.wildsUsed, // 本墩用的逢人配张数（含百搭合法牌型明示）
          }
        : null,
      plays: Object.fromEntries(
        TURN_ORDER.filter((seat) => s.seatPlay[seat]).map((seat) => [seat, { cards: s.seatPlay[seat]!.cards, pass: s.seatPlay[seat]!.pass }]),
      ),
      justPlayed: s.lastPlayed, // 座前牌入场动效只播最近落子座（防全桌/上一张一起重播·owner 2026-07-20）
      tributeText: tributeText(s),
      showCounter,
      counter: showCounter ? counterData(s) : [],
      canCommit: cs.canCommit,
      commitWhy: cs.why,
      canPass: s.currentTrick !== null,
      mustPass: s.canOnlyPass('hero'),
      showMenu: menuOpen,
      menuTab,
      logRows: menuOpen ? logRows(s) : [],
      tierName: tierName(lang, s.tier), // 难度显示名双语（设置页用·fmtTierName 再套「难度 X」壳）
      seed: lastSeed,
    };
  }

  function resultView(s: GuandanSession): ResultView {
    const r = s.lastResult!;
    return {
      lang,
      ranking: r.ranking.map((seat) => ({ seat, name: displayName(seat), team: teamOf(seat) })),
      winnersTeam: r.winnersTeam,
      comboLabel: fmtComboLabel(lang, r.combo),
      totalMult: r.totalMult,
      payPerPlayer: r.payPerPlayer,
      levelAfter: r.levelAfter,
      dressOutDoubled: r.dressOutDoubled,
      phase: s.phase === 'run-won' ? 'run-won' : s.phase === 'run-lost' ? 'run-lost' : 'settled',
    };
  }

  // 终局 SessionOut（REQ-CHARCARD·以 card.id 键控·passthrough 原样回带）：本盘名次 → 四席顺位/阵营。
  // 纯确定性（读 lastResult.ranking·无时钟/随机）。暂存 lastSessionOut·经返回句柄 getSessionOut 暴露（game-runner 尚未消费）。
  function computeSessionOut(s: GuandanSession): Record<string, SeatSessionOut> {
    const r = s.lastResult!;
    const outcomes = {} as Record<SeatId, SeatOutcome>;
    r.ranking.forEach((seat, i) => { outcomes[seat] = { rank: i + 1, team: teamOf(seat) }; });
    return buildSessionOut(seatCards, outcomes);
  }

  // ── 渲染路由（无 session=menu/select 门面·有 session=play/result）─────────────────
  // 跨屏切换必须重挂：UI reconciler 从 host 里按**新根 id** 找元素补丁，根 id 变了（牌桌 a-play ⇄ 结算
  // a-result ⇄ 菜单 a-menu ⇄ 选桌 a-select）时找不到→静默 no-op、屏卡在旧树（owner 报「结算不出、菜单点不开」
  // 死机根因·已报 PUI A-012）。故 paint()：同根 id=最小 diff（保焦点/reconcile），根 id 变=teardown 重挂。
  let mountedRootId = '';
  function paint(node: LayoutNode): void {
    if (ui && mountedRootId === node.id) {
      ui.update(node, GAME_A_THEME);
    } else {
      ui?.();
      ui = mountUI(overlayHost, node, handlers, GAME_A_THEME);
    }
    mountedRootId = node.id;
  }
  function render(): void {
    if (!session) {
      paint(screen === 'select' ? buildTableSelect({ lang, difficulty: selDifficulty, stake: selStake, wallet, avatars: seatAvatarMap() }) : buildMenu(menuView()));
      return;
    }
    if (session.phase === 'playing') {
      paint(buildPlay({ ...playView(session), freshDeal: dealAnim })); // freshDeal 只此首帧真→手牌发牌错落；随后置假·任何后续渲染不再重播
      dealAnim = false;
    } else {
      lastSessionOut = computeSessionOut(session); // 盘/局终局：构造 SessionOut（REQ-CHARCARD·纯确定性）
      paint(buildResult(resultView(session)));
    }
  }

  // ── AI 步进（拟人延迟·递归排到 hero 轮或盘终）──────────────────────────────────
  function scheduleAi(): void {
    clearAiTimer();
    if (!session || session.phase !== 'playing' || session.turn === 'hero') return;
    const delay = AI_DELAY_MIN + Math.floor(aiRng() * (AI_DELAY_MAX - AI_DELAY_MIN + 1)); // 每步独立 700~2000ms（拟人）
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (!session || session.phase !== 'playing' || session.turn === 'hero') return;
      try {
        session.aiStep();
        render();
      } catch (e) {
        // 兜底：AI 循环异常绝不静默冻结游戏（owner 多次报死机）——记 console，链继续（下一步再推进）。
        if (typeof console !== 'undefined') console.error('[game-a] AI 步异常', e);
      }
      scheduleAi();
    }, delay);
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
    render(); // paint(buildMenu)·跨屏重挂由 paint 统一处理
  }

  function showTableSelect(): void {
    stopSession();
    screen = 'select';
    render(); // paint(buildTableSelect)
  }

  function enterTable(): void {
    stopSession();
    lastSeed = ((Math.floor(Date.now() / 1000) >>> 0) + runCount++) >>> 0; // 种子=当前时间**到秒**（owner 2026-07-18）+ 同秒连开的 runCount 微扰·每局不同牌（宿主选种·非 sim 随机）
    aiRng = mulberry32((lastSeed ^ 0x9e3779b9) >>> 0); // 拟人延迟专用 PRNG（与 sim 种子隔离·扰动它不影响牌局回放）
    session = new GuandanSession({ seed: lastSeed, stake: selStake, tier: selDifficulty });
    selected = [];
    sortMode = 'rank';
    dealAnim = true; // 开局发牌→手牌错落入场（仅此首帧）
    render(); // paint(buildPlay)
    scheduleAi();
  }

  const handlers: HandlerMap = {
    'menu.start': () => showTableSelect(),
    'table.back': () => showMenu(),
    // 语言切换（EN/中·默认中文·localStorage 持久·mirror game-c set_lang）。
    // paint() 对同根 id 走最小 diff reconcile·可能漏刷深层嵌套文案 → 置 mountedRootId='' 逼下次 render 走
    //   teardown+整树重挂（同「跨屏根 id 变」路径），确保当前屏所有 Label/Button/Tag 文案随语言刷新。
    'set_lang': (arg?: string) => {
      const nl: Lang = arg === 'en' ? 'en' : 'zh';
      if (nl === lang) return;
      lang = nl;
      saveLang(nl);
      mountedRootId = ''; // 强制下次 paint 整树重挂（非最小 diff）
      render();
    },
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
        dealAnim = true; // 新盘发牌→手牌错落入场（仅此首帧）
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
    // 复制本盘完整记录（发牌+过程+结果）→ 剪贴板（F12 console 兜底）·供玩家发作者分析 AI（owner 2026-07-18）。
    // 表现层副作用（读 session 拼串 + 写剪贴板）：不写世界/不进 sim/hash。
    'tools.copylog': () => {
      if (!session) return;
      const text = session.roundTranscript();
      if (typeof console !== 'undefined') console.log('[掼蛋·本盘完整记录]\n' + text); // 剪贴板 + F12 双落（确认可见）
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) void navigator.clipboard.writeText(text);
      } catch { /* 非安全上下文/无权限=靠 F12 或框选复制 */ }
    },
    // 游戏内菜单（☰·出牌日志/规则说明/设置）。
    'menu.open': () => {
      if (!session) return;
      menuOpen = true;
      render();
    },
    // 主菜单「设置 · 规则」→ 开菜单浮层（默认规则页·赛前最有用）。
    'menu.settings': () => {
      menuOpen = true;
      menuTab = 'rules';
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

  // A-023 可消费槽：mount 尾异步拉本地美术索引——工坊按 skinKey 别名写回的真图就绪则热替换上画
  //（无真图/无索引/headless = 内置占位·观感零字节变化）。render-only·不进 sim/hash·确定性零影响。
  void loadArtOverrides('game-a')
    .then((m) => { if (Object.keys(m).length) { registerArtOverrides(m); render(); } })
    .catch(() => { /* 无索引/headless → 保持内置占位 */ });

  const teardown = (): void => {
    stopSession();
    ui?.();
    ui = null;
    skel.teardown();
  };
  // 返回句柄挂 getSessionOut（REQ-CHARCARD·暴露终局回传·game-runner 尚未消费·供未来/测试读）。
  return Object.assign(teardown, { getSessionOut: (): Record<string, SeatSessionOut> | null => lastSessionOut });
}
