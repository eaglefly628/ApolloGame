// Game C ·《六人德州》—— 宿主层（S5 UI 素坯·mount-host helper·零手写 DOM·零玩法逻辑）。
//
// 职责（都在 sim 外）：mountHost 搭容器骨架 → 用 M1 逻辑核（holdem-eval + betting-engine）跑一手牌到
// 「翻牌圈·轮到主角行动」的确定性定格 → 牌局状态纯读投影进 LayoutNode 屏（mountUI·夜宴主题皮）。
// 两屏：主菜单(SC-1) ⇄ 牌桌屏；牌桌屏叠衣柜面板 + 游戏日志面板（owner 2026-07-17 查 bug 需求·确定性事件流）。
// UI 全 LayoutNode（UI 铁律）；随机全在 M1 sim 侧种子 PRNG（宿主零 Math.random）。
//
// 渲染（owner 2026-07-18 定稿·2D 视角 + 3D 物理筹码）：scene 层 = 3D 牌桌(陡俯视=2D 平面观感·椭圆呢面 + 一圈
// 物理围栏墙)+ 3D 物理筹码（下注抛入池·速度力量随机·围栏挡住不滚出·主角堆越赢越高·build3d/chip3d·ThreeRenderer 消费）；
// overlayHost 层 = 2D LayoutNode HUD（座位卡/公共牌/底池数/行动条·透明区透出 3D 桌）。无椅子。
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle, HandlerMap } from '@ui/components/index.js';
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { FIELD_W, FIELD_H, ROOM_BG, WRAPPER_BG, GAME_C_THEME, OPPONENT_ANCHORS } from './theme.js';
import { backdropUri, registerTextureOverrides, loadArtOverrides, loadSkinIndex, makeSkinAssets, buttonSkinsForTheme } from './art-overrides.js';
import { type Lang, t, handName } from './strings.js';
import { buildTable, buildMenu, type TableView, type SeatView, type WardrobeView, type MenuView } from './hud.js';
import { CLOTHING_ITEMS } from './wardrobe.js';
import { bestOf7, HOLDEM_TYPE_ORDER } from './holdem-eval.js';
import type { BettingConfig } from './betting-engine.js';
import type { Card } from '@engine/protocol/components.js';
import { resolveSeatCharacters, buildSessionOut, personaFlavor, type GameCSessionIn, type GameCSessionOut, type SeatCharacter } from './characters.js';
import { HoldemSession } from './game-session.js';
import { build3DTableBlueprint } from './build3d.js';
import { Chip3D } from './chip3d.js';
import { gcAudio } from './sound.js';

const CFG: BettingConfig = { smallBlind: 25, bigBlind: 50 }; // GDD §11.5-1 现金局默认盲注
const HERO = 0; // 主角=座位 0（正南底带·§5.2）
// 每局种子 = **当前时间到秒**（owner 2026-07-20「每一局种子用当前时间到秒做种」）：宿主选种·非 sim 随机
// （Date.now≠Math.random·sim 逻辑仍纯种子 PRNG·同 game-a 先例）。+runCount 防同秒连开重复。
let runCount = 0;
const timeSeed = (): number => (Math.floor(Date.now() / 1000) + runCount++) >>> 0;
const STARTING_STACK = 1000; // GDD §3 默认起始筹码
// 玩家档案占位（REQ-C-104 角色卡通道落地前的兜底·PST 通道接入即换真档案）。
const PLAYER = { name: '夜阑君', chips: 12860 };

export function mount(
  container: HTMLElement,
  host?: { exit?: () => void; session?: GameCSessionIn; onSessionOut?: (out: GameCSessionOut) => void },
): () => void {
  // 渲染分层（owner 2026-07-18 定稿）：scene 层 = 3D 牌桌 + 物理筹码（陡俯视=2D 平面观感·筹码真 3D 物理）；
  //   overlayHost 层 = 2D LayoutNode HUD（座位卡/公共牌/底池数/行动条·透明区透出 3D 桌）。
  const skel = mountHost(container, {
    fieldW: FIELD_W, fieldH: FIELD_H, sceneBackground: ROOM_BG, wrapperBackground: WRAPPER_BG,
  });
  const { scene, overlayHost } = skel;
  overlayHost.style.pointerEvents = 'auto';

  // ── 3D 牌桌 + 物理围栏（build3d·render-only·ThreeRenderer 消费·P3D 渲染线本体归 P3D 我只接线）─────
  const engine = new Engine();
  engine.load(build3DTableBlueprint());
  // REQ-C-112 接槽：皮肤 AssetManager（3D 呢面/木栏 Material3D.map 按 key 解析·随后 loadSkinIndex 异步填充·就绪自动重建）。
  const skinAssets = makeSkinAssets();
  const renderer = new ThreeRenderer({ width: FIELD_W, height: FIELD_H, background: 0x140d16, antialias: true, dprCap: 1.5, shadowMapSize: 1024, assets: skinAssets });
  engine.attachRenderer(renderer, scene);
  // 夜景电影化背幕（STORY-POKER V2 稿·落地窗+城市散景·3D 呢面桌背后·render-only）。
  //   REQ-C-112（owner 2026-07-22）：背幕=可换皮消费槽 game-c/scene/backdrop——先上程序化 STORY_BACKDROP（观感零变），
  //   mount 尾异步拉本地美术索引，若工坊已按 skinKey 别名生成真背幕图则热替换上画（无真图=留程序化）。render-only·不进 sim。
  let disposed = false;
  renderer.setBackgroundTexture(backdropUri());
  let running = false;
  const start3D = (): void => { if (!running) { engine.start(); running = true; } };
  const stop3D = (): void => { if (running) { engine.stop(); running = false; } };

  // ── 3D 物理筹码（owner 2026-07-18「下注就往池里扔真 3D 物理筹码·速度力量随机·围栏挡住」+ 主角堆越赢越高）─────
  const chip3d = new Chip3D(engine, timeSeed()); // 物理散落种子（render-only·每局不同）
  let chipHandNo = 0;
  const prevTotal: Record<number, number> = {};
  // 声音事件追踪（表现层·render-only）：手号/公共牌张数/阶段 变化 → 触发对应 SFX（声音=数据·经 gcAudio 端口）。
  let prevBoardLen = 0;
  let prevPhase: TableView['phase'] = 'betting'; // 新一手起始阶段（session 稍后声明·此处用字面量避免前引用）
  const syncChips = (): void => {
    if (!running || screen !== 'table') return;
    if (session.handNo !== chipHandNo) {
      chip3d.clear(); for (const k of Object.keys(prevTotal)) delete prevTotal[Number(k)]; chipHandNo = session.handNo;
      prevBoardLen = 0; gcAudio.play('deal'); // 新一手·发牌声
    }
    for (let seat = 0; seat < playerCount; seat++) {
      const cur = session.totalOf(seat), prev = prevTotal[seat] ?? 0;
      if (cur > prev) { chip3d.throwBet(seat, Math.ceil((cur - prev) / 50)); prevTotal[seat] = cur; gcAudio.play('chip'); } // 每 50 一枚·物理抛向底池 + 筹码落桌声
      chip3d.setStack(seat, session.stackOf(seat)); // 各座位筹码堆靠自己桌边·越赢越高（在场各座一堆）
    }
    // 翻街（公共牌张数增）→ 揭示声。
    const boardLen = session.community.length;
    if (boardLen > prevBoardLen) { if (prevBoardLen > 0) gcAudio.play('flip'); prevBoardLen = boardLen; }
    // 阶段跃迁 → 摊牌揭盅 / 局终胜负号角。
    if (session.phase !== prevPhase) {
      if (session.phase === 'showdown') gcAudio.play('reveal');
      else if (session.phase === 'gameover') gcAudio.play(session.winnerSide === 'hero' ? 'win' : 'lose');
      prevPhase = session.phase;
    }
  };

  // ── 玩法会话（真交互闭环：发牌→下注→AI→摊牌→结算→轮转→淘汰→局终·§4-d 线性编排）────
  let session = new HoldemSession(timeSeed(), CFG, STARTING_STACK); // 每局时间种子·每次开局牌面不同

  // ── 宿主本地态（UI 生命周期·非 sim）─────────────────────────────────────────
  let screen: 'menu' | 'table' = 'menu';
  let muted = false;
  let openWardrobe: number | null = null;
  let showLog = false;
  // 界面语言（owner 2026-07-20 中英切换·**默认英语**·localStorage 持久）。
  const LANG_KEY = 'gc_lang';
  const loadLang = (): Lang => { try { return typeof localStorage !== 'undefined' && localStorage.getItem(LANG_KEY) === 'zh' ? 'zh' : 'en'; } catch { return 'en'; } };
  const saveLang = (x: Lang): void => { try { localStorage.setItem(LANG_KEY, x); } catch { /* 无 localStorage */ } };
  let lang: Lang = loadLang();
  // 入局人数 2~6（owner 2026-07-20·**默认 6**·localStorage 持久·菜单选·start_game/restart 生效）。
  const PLAYERS_KEY = 'gc_players';
  const clampPlayers = (n: number): number => Math.max(2, Math.min(6, Math.round(n) || 4));
  const loadPlayers = (): number => { try { return typeof localStorage !== 'undefined' ? clampPlayers(Number(localStorage.getItem(PLAYERS_KEY)) || 4) : 4; } catch { return 4; } };
  const savePlayers = (n: number): void => { try { localStorage.setItem(PLAYERS_KEY, String(n)); } catch { /* 无 localStorage */ } };
  let playerCount = loadPlayers();
  // ── 平台角色卡桥（REQ-CHARCARD·手册 §⑤）：SessionIn 对手席草稿 → 规范卡（requireAdult 必开·姨太题材）→ 席位显示 + persona 台词/风味 ──
  const sessionIn = host?.session;
  let seatChars: SeatCharacter[] = [];
  const reportedIssues = new Set<string>();
  const resolveChars = (): void => {
    seatChars = resolveSeatCharacters(playerCount, sessionIn);
    for (const ch of seatChars) {
      for (const iss of ch.issues) {
        const key = `${ch.seat}:${iss.level}:${iss.field}:${iss.msg}`;
        if (reportedIssues.has(key)) continue;
        reportedIssues.add(key);
        const tail = ch.fromDraft ? '' : ' → 退内置默认卡';
        (iss.level === 'error' ? console.warn : console.info)(`[game-c charcard] 座${ch.seat} ${iss.level}(${iss.field || '卡级'}): ${iss.msg}${tail}`);
      }
    }
  };
  resolveChars();
  const charOf = (seat: number): SeatCharacter | undefined => seatChars.find((c) => c.seat === seat);
  let sessionOutSent = false; // 终局 SessionOut 一次性回传闸（每局重置）
  let raiseValue = session.legalForHero()?.raise?.min ?? CFG.bigBlind;
  // 新开一局：全新时间种子会话（牌面每局不同）+ 按当前入局人数建座 + 重置筹码/声音追踪（防跨局残留）。
  const newGame = (): void => {
    session = new HoldemSession(timeSeed(), CFG, STARTING_STACK, playerCount);
    resolveChars(); sessionOutSent = false; // 按当前入局人数重解角色卡 + 重置终局回传闸
    raiseValue = session.legalForHero()?.raise?.min ?? CFG.bigBlind;
    chip3d.setPlayers(playerCount); // 座位环均布 + 剪掉多余座位残留堆
    chip3d.clear(); chipHandNo = -1; for (const k of Object.keys(prevTotal)) delete prevTotal[Number(k)]; prevBoardLen = 0; prevPhase = 'betting';
  };

  const seatName = (seat: number): string => {
    if (seat === HERO) return t(lang, 'name.hero');
    const a = OPPONENT_ANCHORS.find((x) => x.seat === seat);
    return (lang === 'en' ? a?.nameEn : a?.name) ?? `#${seat}`;
  };

  function seatView(seat: number): SeatView {
    const ss = session.seats[seat];
    const stt = session.seatState(seat);
    // 平台角色卡投影（仅对手·座 1..N-1）：fromDraft 时用卡名/头像覆盖显示 + persona 台词（长度已截断）。
    const ch = seat === HERO ? undefined : charOf(seat);
    const flavor = ch?.fromDraft ? personaFlavor(ch.card) : undefined;
    return {
      seat, name: seatName(seat),
      chips: session.stackOf(seat), committed: session.committedOf(seat), clothes: session.wardrobeLeft(seat),
      folded: stt.folded, allIn: stt.allIn, out: ss.eliminated,
      isActor: session.hand?.actor === seat && session.phase === 'betting',
      isHero: seat === HERO, isButton: session.buttonSeat === seat,
      lastMove: session.lastMove[seat], // 结构化上一动作（UI 层本地化气泡·中文 lastAction 仅供 acceptance 机读）
      ...(ch?.fromDraft ? { cardName: ch.seatCard.name } : {}), // 平台卡名覆盖席位显示名（内置默认仍走 def 双语）
      ...(ch?.seatCard.avatar ? { avatarUrl: ch.seatCard.avatar } : {}), // 卡头像媒体（仅显示·不进 sim hash）
      ...(flavor ? { flavor } : {}), // persona 台词/风味（展示层·已截断）
    };
  }
  function wardrobeView(seat: number): WardrobeView {
    const pawned = session.seats[seat].pawned;
    return {
      seat, name: seatName(seat), isHero: seat === HERO,
      rows: CLOTHING_ITEMS.map((it) => ({ id: it.id, name: lang === 'en' ? it.nameEn : it.name, value: it.value, pawned: pawned.has(it.id) })),
    };
  }
  function heroHandName(): string {
    const hole = session.holeOf(HERO), comm = session.community;
    if (hole.length < 2 || comm.length < 3) return '';
    return handName(lang, HOLDEM_TYPE_ORDER[bestOf7([...hole, ...comm]).value[0]]);
  }
  // 主角最优五张组合（owner 2026-07-21：不显牌型名·把这五张在底牌/公共牌上金边高亮圈出）。未到翻牌=空。
  function heroBest(): Card[] {
    const hole = session.holeOf(HERO), comm = session.community;
    if (hole.length < 2 || comm.length < 3) return [];
    return bestOf7([...hole, ...comm]).best;
  }
  function tableView(): TableView {
    const la = session.legalForHero();
    if (la?.raise && (raiseValue < la.raise.min || raiseValue > la.raise.max)) raiseValue = la.raise.min;
    const sd = session.showdown;
    const st = session.hand?.street;
    const street: TableView['street'] = st === 'flop' || st === 'turn' || st === 'river' || st === 'showdown' ? st : 'preflop';
    return {
      lang, playerCount, street,
      blindLabel: `${CFG.smallBlind} / ${CFG.bigBlind}`, handNo: session.handNo,
      pot: session.pot(), board: session.community, heroHole: session.holeOf(HERO), heroHandName: heroHandName(), heroBest: heroBest(),
      seats: Array.from({ length: playerCount }, (_, i) => i).map(seatView),
      toCall: la?.call ?? 0, canRaise: !!la?.raise, minRaise: la?.raise?.min ?? CFG.bigBlind,
      maxRaise: la?.raise?.max ?? STARTING_STACK, raiseValue, muted,
      openWardrobe, wardrobe: openWardrobe !== null ? wardrobeView(openWardrobe) : undefined,
      showLog, log: session.events,
      phase: session.phase, isHeroTurn: session.isHeroTurn,
      showdown: sd ? {
        // 牌型显示名按 type index 本地化（不碰 session 中文 r.type=机读口径）；无摊(best 空)不显牌型。
        rows: sd.rows.map((r) => ({ name: seatName(r.seat), type: r.best.length ? handName(lang, HOLDEM_TYPE_ORDER[r.value[0]]) : '', best: r.best, hole: r.hole, won: r.won, isWinner: sd.winners.includes(r.seat) })),
        potTotal: sd.potTotal,
      } : undefined,
      finale: session.phase === 'gameover' ? { win: session.winnerSide === 'hero', ...session.stats() } : undefined,
    };
  }
  const menuView = (): MenuView => ({ lang, playerCount, playerName: PLAYER.name, playerChips: PLAYER.chips, blindLabel: `${CFG.smallBlind} / ${CFG.bigBlind}` });

  let ui: MountHandle | null = null;
  const tree = (): ReturnType<typeof buildMenu> => (screen === 'menu' ? buildMenu(menuView()) : buildTable(tableView()));
  // 终局一次性回传 SessionOut（手册④·以 card.id 键控·passthrough 原样带回）：顺位=最终筹码降序名次。
  const maybeEmitSessionOut = (): void => {
    if (sessionOutSent || session.phase !== 'gameover') return;
    sessionOutSent = true;
    if (!host?.onSessionOut) return;
    const ranked = Array.from({ length: playerCount }, (_, i) => i).sort((a, b) => session.stackOf(b) - session.stackOf(a));
    const placeOf = new Map<number, number>(ranked.map((s, i) => [s, i + 1]));
    host.onSessionOut(buildSessionOut(seatChars, (seat) => ({
      placement: placeOf.get(seat) ?? playerCount, chips: session.stackOf(seat), eliminated: session.seats[seat].eliminated,
    })));
  };
  const rerender = (): void => { ui?.update(tree()); syncChips(); maybeEmitSessionOut(); };
  // REQ-C-112 接槽：主题带按钮皮（kind→真图·台账 game-c/ui/btn-hero|primary|ghost）——无真图返 undefined=原 kind 底（零变化）。
  const gcTheme = (): typeof GAME_C_THEME => { const bs = buttonSkinsForTheme(); return bs ? { ...GAME_C_THEME, buttonSkins: bs } : GAME_C_THEME; };
  const remount = (): void => { ui?.(); ui = mountUI(overlayHost, tree(), handlers, gcTheme()); syncChips(); };

  // ── AI 逐步演出（宿主 timer·每拍推进一个 AI·可观察「轮到谁思考/行动」·标准德州节奏·owner 2026-07-18）──
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  const AI_DELAY = 850; // 每个 AI 行动间隔 ms（看清轮到谁·不拖沓）
  const clearAiTimer = (): void => { if (aiTimer !== null) { clearTimeout(aiTimer); aiTimer = null; } };
  const runAITurns = (): void => {
    clearAiTimer();
    if (screen !== 'table' || !session.pendingAI) return; // 主角轮 / 摊牌 / 局终 → 停，等玩家
    aiTimer = setTimeout(() => { session.stepAI(); rerender(); runAITurns(); }, AI_DELAY);
  };
  // 主角行动 → 重渲 → 启动 AI 逐步节奏。
  const heroAct = (a: Parameters<HoldemSession['heroAct']>[0]): void => {
    if (!session.isHeroTurn) return;
    session.heroAct(a); rerender(); runAITurns();
  };
  const raiseTo = (arg?: string): number => {
    const la = session.legalForHero();
    if (!la?.raise) return 0;
    const pot = session.pot();
    const to = arg === 'half' ? session.hand!.currentBet + Math.round(pot * 0.5)
      : arg === 'twoThird' ? session.hand!.currentBet + Math.round(pot * 0.667)
        : arg === 'pot' ? session.hand!.currentBet + pot
          : arg === 'allin' ? la.raise.max
            : raiseValue; // 'slider'
    return Math.max(la.raise.min, Math.min(la.raise.max, to));
  };

  const handlers: HandlerMap = {
    // 屏切换（进桌启动 AI 逐步节奏 + 起 BGM·回菜单停 timer + 停 BGM）
    // 开始上桌 = 全新一局（时间种子·牌面每局不同）；继续上局 = 沿用当前会话不重开。
    start_game: () => { newGame(); screen = 'table'; start3D(); gcAudio.enterTable(); remount(); runAITurns(); },
    continue_game: () => { screen = 'table'; start3D(); gcAudio.enterTable(); remount(); runAITurns(); },
    back_menu: () => { clearAiTimer(); screen = 'menu'; openWardrobe = null; showLog = false; stop3D(); gcAudio.leaveTable(); remount(); },
    menu_open: () => { clearAiTimer(); screen = 'menu'; openWardrobe = null; showLog = false; stop3D(); gcAudio.leaveTable(); remount(); },
    // 语言切换（EN/中·默认英语·持久化·整树重挂应用新文案）
    set_lang: (arg) => { const nl: Lang = arg === 'zh' ? 'zh' : 'en'; if (nl !== lang) { lang = nl; saveLang(nl); gcAudio.play('click'); remount(); } },
    // 入局人数选择（2~6·默认 6·持久化·菜单选·下次开始上桌/再来一局生效）
    set_players: (arg) => { const n = clampPlayers(Number(arg)); if (n !== playerCount) { playerCount = n; savePlayers(n); gcAudio.play('click'); rerender(); } },
    // UI 开关（♪ 键真静音音乐+音效）
    sound_toggle: () => { muted = !muted; gcAudio.setMuted(muted); rerender(); },
    toggle_log: () => { showLog = !showLog; gcAudio.play('click'); rerender(); },
    seat_view: (arg) => { openWardrobe = Number(arg); gcAudio.play('click'); rerender(); },
    panel_close: () => { openWardrobe = null; gcAudio.play('click'); rerender(); },
    // 典当续命（真接 session·主角衣柜可点·扣衣加筹）
    pawn_item: (arg) => { if (openWardrobe !== null && arg) { session.pawn(openWardrobe, arg); gcAudio.play('pawn'); rerender(); } },
    // 加注滑杆：数值=set_raise N；剧情条 −/+ 步进（一个大盲）。
    set_raise: (arg) => {
      const la = session.legalForHero(); const step = CFG.bigBlind;
      if (arg === 'dec') raiseValue = Math.max(la?.raise?.min ?? raiseValue, raiseValue - step);
      else if (arg === 'inc') raiseValue = Math.min(la?.raise?.max ?? raiseValue, raiseValue + step);
      else raiseValue = Number(arg) || raiseValue;
      rerender();
    },
    // 返回剧情（剧情局顶带·剧情系统未接前=回主菜单）
    back_to_story: () => { clearAiTimer(); screen = 'menu'; openWardrobe = null; showLog = false; stop3D(); gcAudio.leaveTable(); remount(); },
    // 下注交互（真接 betting-engine·经 session；弃牌/过牌本地声，跟注/加注的筹码声由 syncChips 抛注触发）
    act_fold: () => { gcAudio.play('fold'); heroAct({ kind: 'fold' }); },
    act_check_call: () => { const la = session.legalForHero(); if (la?.check) gcAudio.play('check'); heroAct(la?.check ? { kind: 'check' } : { kind: 'call' }); },
    act_raise: (arg) => { const to = raiseTo(arg); if (to > 0) { if (arg === 'allin' || to >= (session.legalForHero()?.raise?.max ?? Infinity)) gcAudio.play('allin'); heroAct({ kind: 'raise', to }); } },
    // 摊牌「继续」→ 下一手（发牌+启动 AI 节奏）；局终「再来一局」→ 新会话。
    continue_showdown: () => { session.nextHand(); rerender(); runAITurns(); },
    restart: () => { newGame(); rerender(); runAITurns(); }, // 再来一局 = 全新时间种子会话
  };
  void host; // launcher 壳退出钩子（游戏内经 ⚙ 回主菜单；壳级退出由 launcher overlay 菜单接）

  ui = mountUI(overlayHost, buildMenu(menuView()), handlers, gcTheme());

  // REQ-C-112 接槽·异步拉本地美术索引（mount 尾·handlers/remount 已就位）：
  //   ① loadSkinIndex → 填 skinAssets（3D 呢面/木栏 Material3D.map 按 key·就绪 renderer 下帧自动重建·无真图=回退色）；
  //   ② loadArtOverrides → URL 覆盖表（背幕/按钮皮/衣柜图标）·有真图才 remount 拾取（背幕热替换）·无真图=零改动。
  void loadSkinIndex(skinAssets, 'game-c');
  void loadArtOverrides('game-c').then((tex) => {
    if (disposed || Object.keys(tex).length === 0) return; // 无真图覆盖 → 观感逐字节不变
    registerTextureOverrides(tex);
    renderer.setBackgroundTexture(backdropUri()); // 背幕真图热替换
    remount(); // 按钮皮(主题)+衣柜图标(树) 拾取真图
  });

  return () => { disposed = true; clearAiTimer(); stop3D(); chip3d.dispose(); gcAudio.dispose(); ui?.(); skel.teardown(); };
}
