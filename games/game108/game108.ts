// game108《拳律》—— 卡带宿主层（mount/host·契约明许·零玩法逻辑）。
// 职责都在 sim 外：建 Engine + 运行环、把 world 投影成 DuelView、把 UI action 入队成引擎输入、cleanup。
// 玩法规则一律在 blueprint.ts 的数据 + 引擎能力里。
import { mountUI, resolveBindings } from '@zerocraft/engine/ui/components/index.js';
import type { MountHandle, LayoutNode, UIDataSource } from '@zerocraft/engine/ui/components/index.js';
import { mountHost } from '@zerocraft/engine/engine/host/mount-host.js';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { QueuedInputSource } from '@zerocraft/engine/net/index.js';
import type { Resource, GameFlow, StringVar } from '@zerocraft/engine/engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildDuelScreen, emptyView, type DuelView, type Phase } from './duel-screen.js';
import { DUEL_THEME, VIEW_W, VIEW_H, HANDS, SIDES, HP_MAX, HP_RES, chargeEntity, lastThrowVar, PHASE_TICKS, TPS, type Hand, type Side } from './theme.js';
import { DEFAULT_CARD, MOOD_AI, type CardCharacter } from './card-character.js';
import { UI_ACT, ACT } from './theme.js';
import { loadLang, saveLang, type Lang } from './strings.js';
import { createAudio, loadAudioFlags, type Sfx } from './audio.js';
import { createVoice, voiceLine, type VoiceEvent } from './voice.js';

// 舞台外框（画布之外那圈·稿子里是 `#171310` 深木底衬着 1920×1080 的对局屏）。
const STAGE_BG = '#171310';

/**
 * 卡片角色（约会对象）—— owner 2026-08-07：「对手是我们传进来的卡片角色……卡片的心情就是它的 AI」。
 *
 * **不能挂在 `mount` 的第二个参数上**：`mount(el, host?)` 的第二位已被 launcher 的宿主契约占用
 * （`src/launcher/game-runner.tsx`·`{exit}`），改签名会把卡带装载面整条打红（tsc 实测）。
 * 故走「装载前先 `setCard`」这条：宿主拿到卡片 → `setCard(card)` → `mount(el)`。
 * 没设 = 内置兜底卡片（探针与本机试玩走这条），屏上一切照常。
 * DokiWorld 真 schema 到手后，在这里加一个适配函数即可，`mount` 一行不动。
 */
let currentCard: CardCharacter = DEFAULT_CARD;
export function setCard(card: CardCharacter): void { currentCard = card; }

export function mount(container: HTMLElement): () => void {
  const card = currentCard;
  const { scene, teardown } = mountHost(container, {
    fieldW: VIEW_W, fieldH: VIEW_H, sceneBackground: STAGE_BG, wrapperBackground: '#171310',
  });

  // UI action → 引擎输入：QueuedInputSource 同时是 Engine 的输入源与 mountUI 的 ActionSink
  // （同 game101 口径）——屏上的 `action` 入队成 InputQueue 动作，再由 t2-keybind 转成 Signal。
  const queue = new QueuedInputSource('p1');
  /**
   * 起一台引擎并装载世界。**每局一台**——`Engine.load()` 是「往现有世界里加」不是「换一个世界」
   * （`src/runtime/engine.ts`：逐个 `addSystem` / `createEntity`），
   * 对同一台引擎二次 `load` 会把 system 加两遍、实体重建一遍，**是脏局不是新局**。
   * 所以「再来一局」= 停掉旧的、起一台新的（见 `restart()`）。
   * 心情 → 出招规律是一张查表（`card-character.ts MOOD_AI`），换心情不写一行代码。
   */
  const boot = (): Engine => {
    const e = new Engine({ input: queue });
    e.load(buildBlueprint(MOOD_AI[card.mood]));
    return e;
  };
  let engine = boot();
  let lang: Lang = loadLang();
  let menuOpen = false;
  // 音频门面（声音=数据·端口在引擎）。无 AudioContext（探针/测试）→ 端口内建静默 no-op。
  const audio = createAudio(loadAudioFlags());
  // 角色配音：TTS 链；发不出声（headless / 没装音色）时 `say` 返回 false → 走字幕兜底。
  const voice = createVoice(card.id, card.mood, lang);
  let subtitle = '';
  let subtitleUntil = 0;          // 用**回合数**计时，不用墙钟——同一条纪律：表现层也别引入第二个时钟
  /** 角色说一句：能出声就出声，出不了声就把台词打成字幕（手册的兜底③）。 */
  const say = (ev: VoiceEvent): void => {
    if (!audio.flags.voice) return;
    voice.say(ev, lang);          // 返回 false 也照打字幕：听得见的人两样都有，听不见的至少看得见
    subtitle = voiceLine(ev, lang);
    subtitleUntil = shownRound + 1;
  };

  const num = (eid: string): number => engine.world.getComponent<Resource>(eid, 'Resource')?.current ?? 0;
  const str = (eid: string): string => engine.world.getComponent<StringVar>(eid, 'StringVar')?.value ?? '';

  /** world → 视图（**纯读**·outcome-first；不在这里做任何规则计算）。 */
  function readView(): DuelView {
    const flow = engine.world.getComponent<GameFlow>('flow', 'GameFlow');
    const raw = flow?.current ?? 'charge';
    // 【R-108-04】v3：世界里的 `throwPenalty` / `throwPenaltyHit` 是 T2 的读秒尾巴，**不是第五拍**——
    // 屏上仍写「出招」，只是倒计时环换成"你已经欠了多少"。故投影时折回 `throw`。
    const inPenalty = raw === 'throwPenalty' || raw === 'throwPenaltyHit';
    const phase = (inPenalty ? 'throw' : raw) as Phase;
    const elapsed = flow?.elapsed ?? 0;
    // T4（`settle: 0`）与罚血读秒都**没有倒计时**：前者是玩家闸门，后者已经超时了。
    // 不能 `?? PHASE_TICKS.charge` 兜底——那会在结算屏画出一圈 2.5 秒的环，玩家以为不点也会自动过。
    const total = inPenalty ? 0 : PHASE_TICKS[phase as keyof typeof PHASE_TICKS] ?? 0;
    const charge = Object.fromEntries(SIDES.map((s) => [
      s, Object.fromEntries(HANDS.map((h) => [h, num(chargeEntity(s, h))])) as Record<Hand, number>,
    ])) as Record<Side, Record<Hand, number>>;
    const shown = Object.fromEntries(SIDES.map((s) => [s, str(`var:${s}`) as Hand | ''])) as Record<Side, Hand | ''>;
    const hp = { p1: num('p1'), p2: num('p2') };

    // ── 表现层派生（**不是规则**·不写世界·不进 hash）───────────────────────
    // ① 本回合我提交了什么：读世界里我这侧的 DuelIntent（接缝挂上去的那份）。
    const intent = engine.world.getComponent('p1', 'DuelIntent') as { throw: Hand } | undefined;
    // ② 上一次结算「谁赢了、打了多少」：**比对上一帧的血量**。为什么这么做——
    //    `DuelOutcome` 在 Commit 被 announce 消费掉、跨不到宿主；而"谁掉了多少血"本身就是
    //    玩家看得见的事实，用它反推展示是**投影不是判定**（规则仍只在引擎里）。
    for (const s of SIDES) {
      if (prevHp[s] > hp[s]) lastOutcome = { winner: s === 'p1' ? 'p2' : 'p1', damage: prevHp[s] - hp[s] };
    }
    const round = num('round') || 1;
    // **本回合结算落地了没有**（真渲染目击到的坑）：亮手读的是 `lastThrow`、结果读的是血量差，
    // 而这两样都要等结算那一拍才更新——结算比「进对决」晚一拍。不判这个，进对决的头一小段
    // 屏上摆的是**上一回合**的手和伤害：我明明出了布，屏上写「你 ✌️剪 · 被打中 -20」。
    // 判据用回合数：结算会把 `round` +1，所以 `round > roundAtClash` ⇔ 本回合已结算。
    if (phase === 'clash' && prevPhase !== 'clash') {
      roundAtClash = round; lastOutcome = undefined; tieThisRound = true;
      // 【R-108-06/09】开打前的快照：血槽双段条与蓄力回撤都拿它当参照系（见 DuelView.before）。
      before = { hp: { ...hp }, charge: { p1: { ...charge.p1 }, p2: { ...charge.p2 } } };
    }
    // 【R-108-07】T1 注水的起点：看见我方总层数涨了就记一笔（哪只手 + 此刻在 T1 里的毫秒数）。
    if (phase === 'charge' && prevPhase !== 'charge') charged = undefined;
    const settled = round > roundAtClash;
    if (lastOutcome && lastOutcome.damage > 0) tieThisRound = false;
    // ── 音画同步（**纯表现**·读世界之后触发·绝不回写）───────────────────
    // 手册红线：音频/语音是表现层旁路，不进 sim/hash/录放。所以全部挂在"世界已经变成这样"之后。
    shownRound = round;
    if (subtitleUntil && round > subtitleUntil) subtitle = '';
    const myCharge = HANDS.reduce((n, h) => n + charge.p1[h], 0);
    if (myCharge > prevCharge) {
      audio.play(HANDS.some((h) => charge.p1[h] >= 3) ? 'full' : 'charge');
      // 【R-108-07】哪只手涨了 = 这一回合注水的那张卡；起点毫秒数直接由相位时钟换算。
      const grew = HANDS.find((h) => charge.p1[h] > (prevChargeByHand[h] ?? 0));
      if (grew && phase === 'charge') charged = { hand: grew, atMs: (elapsed / TPS) * 1000 };
    }
    prevCharge = myCharge;
    prevChargeByHand = { ...charge.p1 };
    const foeFull = HANDS.some((h) => charge.p2[h] >= 3);
    if (foeFull && !prevFoeFull) { audio.play('full'); say('foeFull'); }
    prevFoeFull = foeFull;
    const sub = intent?.throw ?? '';
    if (sub && sub !== prevSubmitted) audio.play('throw');
    prevSubmitted = phase === 'charge' ? '' : sub;
    if (phase === 'clash' && prevPhase !== 'clash') { audio.play('reveal'); say('clash'); }
    if (phase === 'charge' && prevPhase === 'settle') say('roundStart');
    for (const s of SIDES) {
      if (prevHp[s] > hp[s]) { audio.play(s === 'p1' ? 'taken' : 'hit'); say(s === 'p1' ? 'foeWin' : 'youWin'); }
    }
    if (phase === 'p1win' && prevPhase !== 'p1win') { audio.play('win'); say('gameWin'); }
    if (phase === 'p2win' && prevPhase !== 'p2win') { audio.play('lose'); say('gameLose'); }

    prevHp = { ...hp }; prevPhase = phase;

    return {
      phase,
      phaseLeft: total > 0 ? Math.max(0, 1 - elapsed / total) : 0,
      // 环心读数（稿子的「N.N 秒」）：剩余 tick / TPS。
      phaseSec: total > 0 ? Math.max(0, (total - elapsed) / TPS) : 0,
      elapsedMs: (elapsed / TPS) * 1000,
      foeName: card.name,
      ...(card.portrait ? { portrait: { p2: card.portrait } } : {}),
      lang,
      menuOpen,
      audio: audio.flags,
      ...(subtitle ? { subtitle } : {}),
      round,
      hp,
      charge,
      penalty: { active: inPenalty, debt: num('debt:p1') },
      ...(phase === 'settle' ? { awaitNext: true } : {}),
      ...(charged ? { charged } : {}),
      ...(before ? { before } : {}),
      smoke: { uses: num('smoke:uses:p1'), hidden: !!(engine.world.getComponent('smoke:res:p1', 'Flag') as { active: boolean } | undefined)?.active },
      ...(intent ? { submitted: intent.throw } : {}),
      // 只有本回合真结算了才亮手/出结果——否则揭晓期摆的是上一回合的数据（见上面 settled 注释）。
      ...(settled && (phase === 'clash' || phase === 'settle') ? { shown } : {}),
      ...(settled && lastOutcome ? { outcome: lastOutcome }
        : settled && tieThisRound && (phase === 'clash' || phase === 'settle') && shown.p1 && shown.p2
          ? { outcome: { winner: 'tie' as const, damage: 0 } } : {}),
    };
  }

  // 表现层记忆（render-only·不进 sim/hash）：用于「上一次结算掉了多少血」的横幅 + 音画同步。
  let shownRound = 1;
  let prevCharge = 0;             // 我方三槽总层数——涨了就是"又蓄了一层"
  let prevChargeByHand: Record<Hand, number> = { rock: 0, paper: 0, scissors: 0 };  // 逐手上一帧值（认出"涨的是哪只手"）
  let prevFoeFull = false;        // 对手是否已有满蓄的一手（由无到有 = 一记提醒）
  let prevSubmitted: Hand | '' = '';

  /**
   * 表现层记忆归零。**新局必须连它一起清**——否则上一局的血量/回合/结果会跟着进新局：
   * 血量记忆停在 0 会让新局第一帧就判"掉血"，把上一局的伤害横幅和挨打音再放一遍。
   */
  const resetPresentation = (): void => {
    prevHp = { p1: HP_MAX, p2: HP_MAX };
    prevPhase = 'charge'; tieThisRound = false; roundAtClash = 0; lastOutcome = undefined;
    shownRound = 1; prevCharge = 0; prevChargeByHand = { rock: 0, paper: 0, scissors: 0 }; prevFoeFull = false; prevSubmitted = '';
    subtitle = ''; subtitleUntil = 0;
    charged = undefined; before = undefined;
  };
  /** 【R-108-07】本回合蓄了哪只手 + 蓄下去那一刻在 T1 里的毫秒数（注水动画的起点）。 */
  let charged: { hand: Hand; atMs: number } | undefined;
  /** 【R-108-06/09】进 T3 那一拍抓的快照（血槽双段条 / 蓄力回撤的参照系）。 */
  let before: { hp: Record<Side, number>; charge: Record<Side, Record<Hand, number>> } | undefined;
  let prevHp: Record<Side, number> = { p1: HP_MAX, p2: HP_MAX };
  let prevPhase: Phase = 'charge';
  let tieThisRound = false;
  let roundAtClash = 0;
  let lastOutcome: { winner: Side | 'tie'; damage: number } | undefined;

  /**
   * 世界数据源（引擎的 DI 接缝）：`LayoutNode` 里的 `props.bind` **不会自己生效**——
   * `mountUI` 没有数据源入口，得游戏在交树之前自己跑一遍 `resolveBindings(tree, ds)`。
   * 不跑 = `bind` 是个哑弹：条永远画在 0，**不报错**（2026-08-07 点击探针截图目击：
   * 石槽文字已 3/3、条却是空的）。
   * 只读（显示）；写世界一律走 action 信号——两端分明是这条接缝的红线。
   */
  const dataSource: UIDataSource = {
    resource: (id) => {
      for (const [e] of engine.world.query('Resource')) {
        const r = engine.world.getComponent<Resource>(e, 'Resource');
        if (r && r.id === id) return { current: r.current, ...(r.max !== undefined ? { max: r.max } : {}) };
      }
      return undefined;
    },
  };
  const screen = (v: DuelView): LayoutNode => resolveBindings(buildDuelScreen(v), dataSource);

  // handlers **只挂表现层本地动作**（`ui.*`）：换语言是纯显示设置，不该进世界
  //（进了就会进 hash / 录放 / lockstep，两端语言不同就判不一致——那是灾难）。
  // 写世界的动作一律不挂 handler，走 `ActionSink` 入队成 Signal（信号铁律不变）。
  const redraw = (): void => { ui.update(screen(readView()), DUEL_THEME); };

  /**
   * 「再来一局」（`duel.next`）——**局的生命周期归宿主**，不是世界里的一次状态跳转。
   *
   * 为什么不做成 flow 转移：终局态 `p1win/p2win` 要回到开局，得把**双方**的血、六条槽、
   * 回合数、上一手全部复位；而判定表那套按侧寻址在「全局 id 路由」上一直吃瘪（本仓第 5 例）。
   * 与其在世界里堆一串复位规则，不如**重新装载同一份蓝图**——那本来就是"新局"的定义，
   * 且和 mount 时走的是同一条路（同一个 `boot()`），不会出现"只有重开局才有的状态"。
   *
   * 信号铁律不破：`duel.next` 仍是**词表里的世界动作名**，只是它的消费者是宿主的局生命周期，
   * 不是某个 sim 能力——同 `ui.*` 那条分界，只不过这条不是显示设置而是"换一个世界"。
   */
  const restart = (): void => {
    engine.stop();
    engine = boot();
    resetPresentation();
    engine.subscribe(redraw);
    engine.start();
    audio.play('ui');
    redraw();
  };
  /**
   * `duel.next` **v3 起是一键两用**，落点由当前相位定：
   *   T4 结算 → 世界里的【R-108-05】玩家闸门（进下一回合）⇒ **入队走信号**，规则归引擎；
   *   终局屏 → 换一个世界（上面的 `restart`）⇒ 局的生命周期归宿主。
   * handler 挂着就**不会**自动进 ActionSink（本地 handler 优先），所以闸门那一路要**自己 enqueue**。
   * 忘了这一句 = 结算屏那枚键点了没反应、且不报错——正是 2026-08-07「再来一局是死键」那个病的形状。
   */
  const nextOrRestart = (): void => {
    audio.start();
    const cur = engine.world.getComponent<GameFlow>('flow', 'GameFlow')?.current ?? 'charge';
    if (cur === 'p1win' || cur === 'p2win') { restart(); return; }
    queue.enqueueAction(ACT.next);
    audio.play('ui');
  };
  const ui: MountHandle = mountUI(scene, screen(emptyView()), {
    // 每个本地动作都先「起一次 BGM」：浏览器的自动播放策略要求**真实用户手势之后**才准出声，
    // 而设置菜单这几个键正好都是真手势（`audio.start()` 幂等）。
    [ACT.next]: nextOrRestart,
    [UI_ACT.menu]: (): void => { menuOpen = !menuOpen; audio.start(); audio.play('ui'); redraw(); },
    [UI_ACT.lang]: (): void => { lang = lang === 'zh' ? 'en' : 'zh'; saveLang(lang); voice.setLang(lang); audio.play('ui'); redraw(); },
    [UI_ACT.bgm]: (): void => { audio.toggle('bgm'); audio.start(); audio.play('ui'); redraw(); },
    [UI_ACT.sfx]: (): void => { audio.toggle('sfx'); audio.play('ui'); redraw(); },
    [UI_ACT.voice]: (): void => { const f = audio.toggle('voice'); if (!f.voice) voice.stop(); audio.play('ui'); redraw(); },
  }, DUEL_THEME, queue);

  // 运行环走**引擎自己的** `start()`（房屋口径·同 game101）——不许自己搓 rAF 圈直接调
  // `world.tick()`：`Engine.step()` 在 tick 之前那一句 `applyCommands(world, input.commandsForTick(...))`
  // 才是把 UI 入队的动作注进世界的**唯一**接缝，绕过它 = 队列一直填、永远没人取
  // ⇒ 点了没反应，而且**不报错**（2026-08-07 点击探针实测抓到，单测与渲染探针都照绿）。
  // 另有固定步长时钟（真实流逝时间 → 整数模拟步），自搓的圈还会让相位时长随帧率漂。
  engine.subscribe(redraw);
  engine.start();

  return () => { engine.stop(); audio.stop(); voice.dispose(); ui(); teardown(); };
}

export { lastThrowVar, HP_RES };
