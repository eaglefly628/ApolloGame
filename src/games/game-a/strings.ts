// Game A ·《掼蛋夜宴》文案字典（owner 2026-07-20「中英切换·默认中文」）——**游戏层 i18n 纯数据**。
//
// 声明式：每条用户可见文案 = 一张 {en, zh} 数据（最弱 LLM 也能照抄改值·非自由代码）；t(lang,key) 是固定查表解释器。
// 引擎无 i18n 能力（查证：零 locale 服务·无引擎做切换）→ 本游戏自持字典即可，**不下沉引擎**（YAGNI·game-c 已是第二例·
//   第三个游戏要再抽共用能力）。默认语言由宿主（game-a.ts loadLang）定=中文（game-c=英语·本作 owner 钦定中文）。
// 红线：session/acceptance 的中文机读口径（fmtCardCode「♠5/大王🃏」·roundTranscript·playLog·FAMILY_CN 日志串）
//   **不经此层**——那是 GD 域机读真相 + owner 抄给策划的稿，恒中文、恒不变。本层只管**表现层显示**：
//   hud 各屏文案 + 牌型/性格/难度的显示名（按稳定 key 双语·不解析 session 中文串）。

export type Lang = 'en' | 'zh';
type Entry = Record<Lang, string>;

const money = (x: number): string => x.toLocaleString('en-US'); // en-US 千分位（同 game-c）

// ── 静态文案（无插值）─────────────────────────────────────────────────────────
export const STRINGS = {
  // 主菜单 SC-1
  'menu.portraitTitle': { en: 'Hero Portrait', zh: '主角立绘' },
  'menu.portraitSize': { en: 'Size 300 × 440 · Portrait', zh: '尺寸 300 × 440 · 竖幅' },
  'menu.portraitAnchor': { en: 'Style · Anime / Soft-light / Warm-night', zh: '风格锚 · 二次元 / 柔光 / 暖夜' },
  'menu.levelLabel': { en: 'Your Level', zh: '本家级牌' },
  'menu.levelBadge': { en: 'Lv', zh: '级' },
  'menu.titleA': { en: 'GUANDAN', zh: '掼蛋' },
  'menu.titleB': { en: 'NIGHTS', zh: '夜宴' },
  'menu.subtitle': { en: 'Four Players · Two Decks · Climb & Ally · Fight Every Round', zh: '四人两副牌 · 升级同盟 · 逢局必争' },
  'menu.tip': { en: 'Daily First Game · +88 Bonus', zh: '每日首局 +88 红包' },
  'menu.start': { en: 'Sit Down', zh: '开始上桌' },
  'menu.resume': { en: 'Continue', zh: '继续上局' },
  'menu.settings': { en: 'Settings · Rules', zh: '设置 · 规则' },
  'menu.version': { en: 'v0.1.0 · Boxyard', zh: 'v0.1.0 · 盒庭线' },

  // 选桌 SC-2
  'sel.title': { en: 'Choose Table', zh: '选桌' },
  'sel.difficulty': { en: 'Difficulty', zh: '难度' },
  'sel.stake': { en: 'Stake', zh: '底注' },
  'sel.buyin': { en: 'Buy-in', zh: '带入' },
  'sel.back': { en: 'Back', zh: '返回' },
  'sel.seat': { en: 'Sit & Start', zh: '入座开局' },
  'sel.seatPoor': { en: 'Low funds · buy in with balance', zh: '荷包不足·按结余入座' },

  // 阵营 tag（选桌预览 + 席位卡 + hero 自称·共用）
  'seat.foe': { en: 'Opp', zh: '对手' },
  'seat.ally': { en: 'Teammate', zh: '队友' },
  'seat.you': { en: 'You', zh: '你' },

  // 牌桌 SC-3（固定短语·名字插值走 fmt*）
  'play.yourRespond': { en: 'Your move · beat the top play below, or pass', zh: '待你应对 · 压过下方最大牌或过' },
  'play.yourLead': { en: 'Your turn to lead', zh: '轮到你领出' },
  'play.biggest': { en: 'Top', zh: '最大' },
  'play.hint': { en: 'Hint', zh: '提示' },
  'play.pass': { en: 'Pass', zh: '过' },
  'play.passSkip': { en: 'Pass · Skip round', zh: '过 · 跳过本轮' },
  'play.commit': { en: 'Play', zh: '出牌' },
  'play.sortRank': { en: 'By Rank', zh: '按点数' },
  'play.sortFamily': { en: 'By Type', zh: '按牌型' },
  'play.counterShow': { en: '▤ Counter', zh: '▤ 记牌器' },
  'play.counterHide': { en: '▤ Hide', zh: '▤ 收起' },
  'play.mustPass': { en: "Can't beat the next player's top card · tap Pass to skip this round", zh: '压不过下家最大牌 · 点「过」跳过本轮' },
  'play.selectHint': { en: 'Tap cards to select · play or pass', zh: '点牌选中 · 出牌或过' },
  'play.illegal': { en: 'Illegal hand', zh: '不合法' },
  'play.menu': { en: '☰ Menu', zh: '☰ 菜单' },

  // 记牌器 modal
  'counter.title': { en: 'Card Counter · Cards Played (face-up only)', zh: '记牌器 · 明面已出牌（不开天眼）' },
  'counter.hint': { en: 'Played / total per rank · the remainder tells who still holds big cards', zh: '各点数 已出 / 共 · 剩余可推断谁手里还有大牌' },
  'counter.rank': { en: 'Rank', zh: '点数' },
  'counter.played': { en: 'Played', zh: '已出' },
  'counter.left': { en: 'Left', zh: '剩余' },

  // 游戏内菜单 ☰（chrome·日志正文恒中文=红线）
  'gm.title': { en: 'Menu · Guandan Nights', zh: '菜单 · 掼蛋夜宴' },
  'gm.tabLog': { en: 'Play Log', zh: '出牌日志' },
  'gm.tabRules': { en: 'Rules', zh: '规则说明' },
  'gm.tabSettings': { en: 'Settings', zh: '设置' },
  'gm.logHint': { en: "This round's play stream (select to copy) · full deal via F12 → Console", zh: '本局出牌流水（可框选复制）· 完整含发牌 F12 → Console' },
  'gm.copyLog': { en: '📋 Copy Round Log', zh: '📋 复制本盘记录' },
  'gm.logEmpty': { en: '(no plays yet this round)', zh: '（本盘还没有出牌记录）' },
  'gm.colRound': { en: 'Rd', zh: '盘' },
  'gm.colWho': { en: 'Player', zh: '玩家' },
  'gm.colAct': { en: 'Action', zh: '动作' },
  'gm.colCards': { en: 'Cards', zh: '出的牌' },
  'gm.colType': { en: 'Type', zh: '牌型' },
  'gm.colEg': { en: 'Example', zh: '例子' },
  'gm.colNote': { en: 'Notes', zh: '说明' },
  'gm.rulesH1': { en: 'Hand Types (low → high)', zh: '牌型（从小到大）' },
  'gm.rulesH2': { en: 'Basic Rules', zh: '基本规则' },
  'gm.setH': { en: 'This Game', zh: '本局' },
  'gm.language': { en: 'Language', zh: '语言' },
  'gm.setMore': { en: 'Sound / animation speed / counter and more settings coming soon.', zh: '音效 / 动画速度 / 记牌器等更多设置陆续加入。' },

  // 结算 SC-4
  'res.titleWon': { en: 'Passed A · Cleared!', zh: '过 A · 通关！' },
  'res.titleLost': { en: 'They Passed A · Game Over', zh: '对方过 A · 游戏结束' },
  'res.titleSettled': { en: 'Round Settled', zh: '本盘结算' },
  'res.colNo': { en: 'Rank', zh: '名次' },
  'res.colSeat': { en: 'Seat', zh: '座' },
  'res.colSide': { en: 'Side', zh: '阵营' },
  'side.us': { en: 'Us', zh: '我方' },
  'side.them': { en: 'Them', zh: '对方' },
  'res.dressDoubled': { en: 'A lady is at her last tier · cash penalty ×2', zh: '有姨太已至底线档 · 金钱罚 ×2' },
  'res.dressNormal': { en: 'Losing ladies each shed one garment', zh: '输方姨太各褪一件' },
  'res.home': { en: 'Main Menu', zh: '回主菜单' },
  'res.next': { en: 'Next Round', zh: '下一盘' },
  'res.copyLogSub': { en: 'Deal + play · send to author to tune AI', zh: '发牌+过程·发作者调 AI' },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;
/** 静态查表：t(lang, key) → 该语言文案。 */
export const t = (lang: Lang, key: StringKey): string => STRINGS[key][lang];

// ── 牌型显示名（双语·按 family key·zh 对齐 FAMILY_CN·**独立于 session 中文串**·不碰机读口径）──
export const HAND_NAMES: Record<Lang, Record<string, string>> = {
  en: {
    single: 'Single', pair: 'Pair', triple: 'Trips', full: 'Full House', straight: 'Straight',
    tube: 'Tube', plate: 'Plate', bomb: 'Bomb', 'straight-flush': 'Straight Flush', sky: 'Four Kings',
  },
  zh: {
    single: '单张', pair: '对子', triple: '三同张', full: '三带二', straight: '顺子',
    tube: '三连对', plate: '钢板', bomb: '炸弹', 'straight-flush': '同花顺', sky: '四大天王',
  },
};
export const handName = (lang: Lang, key: string): string => HAND_NAMES[lang][key] ?? key;

// ── 性格标签显示名（双语·键=rules 原始 trait·席位卡/选桌预览用·zh 对齐旧 TRAIT_CN 显示值）──
export const TRAIT_NAMES: Record<Lang, Record<string, string>> = {
  en: { 沉稳: 'Steady', 护家: 'Guardian', 锋利: 'Sharp', 好胜: 'Competitive', 跳脱: 'Erratic', 爱起哄: 'Rowdy' },
  zh: { 沉稳: '稳健', 护家: '护家', 锋利: '锋利', 好胜: '好胜', 跳脱: '多变', 爱起哄: '起哄' },
};
export const traitName = (lang: Lang, key: string): string => TRAIT_NAMES[lang][key] ?? key;

// ── AI 难度名（双语·键=tier id·选桌/设置用·zh 对齐 AI_TIERS.name）──
export const TIER_NAMES: Record<Lang, Record<string, string>> = {
  en: { l1: 'Novice', l2: 'Regular', l3: 'Veteran', l4: 'Master' },
  zh: { l1: '雏鸟', l2: '常客', l3: '老手', l4: '宗师' },
};
export const tierName = (lang: Lang, id: string): string => TIER_NAMES[lang][id] ?? id;

const MEMORY_LABEL: Record<Lang, Record<string, string>> = {
  en: { full: 'full memory', 'big-cards': 'tracks big cards', none: 'no memory' },
  zh: { full: '全量记牌', 'big-cards': '记大牌', none: '不记牌' },
};

// ── 牌型说明表（规则页·双语·静态说明数据·非规则逻辑；牌面符号/机读口径原样保留）──
export const PATTERN_GUIDE: Record<Lang, { name: string; eg: string; note: string }[]> = {
  zh: [
    { name: '单张', eg: '♠5', note: '比点数；级牌 > A，大王最大' },
    { name: '对子', eg: '♠5 ♥5', note: '两张同点' },
    { name: '三同张', eg: '♠5 ♥5 ♦5', note: '三张同点' },
    { name: '三带二', eg: '888 + 99', note: '三张带一对，比三张那部分' },
    { name: '顺子', eg: '3-4-5-6-7', note: '五张连续单牌（A 可当 1）' },
    { name: '三连对（木板）', eg: '33 44 55', note: '三副连续的对子' },
    { name: '钢板（二连三）', eg: '888-999', note: '两副连续的三同张（点数必须相邻）' },
    { name: '炸弹', eg: '5555 起', note: '四张及以上同点；先比张数再比点' },
    { name: '同花顺', eg: '♥3-4-5-6-7', note: '同花色顺子，压 5 张炸弹' },
    { name: '四大天王', eg: '双大王+双小王', note: '最大，压一切' },
  ],
  en: [
    { name: 'Single', eg: '♠5', note: 'Compare rank; level card > A, big joker highest' },
    { name: 'Pair', eg: '♠5 ♥5', note: 'Two of the same rank' },
    { name: 'Trips', eg: '♠5 ♥5 ♦5', note: 'Three of the same rank' },
    { name: 'Full House', eg: '888 + 99', note: 'Trips + a pair; compare the trips' },
    { name: 'Straight', eg: '3-4-5-6-7', note: 'Five consecutive singles (A can be 1)' },
    { name: 'Tube (3 pairs)', eg: '33 44 55', note: 'Three consecutive pairs' },
    { name: 'Plate (2 trips)', eg: '888-999', note: 'Two consecutive trips (ranks must be adjacent)' },
    { name: 'Bomb', eg: '5555+', note: 'Four or more of a kind; compare length then rank' },
    { name: 'Straight Flush', eg: '♥3-4-5-6-7', note: 'Suited straight; beats a 5-card bomb' },
    { name: 'Four Kings', eg: '2 big + 2 small jokers', note: 'The nuts — beats everything' },
  ],
};

// ── 基本规则文本（规则页·双语；b=加粗；牌面符号/🃏 原样保留）──
export const RULES_LINES: Record<Lang, { t: string; b: boolean }[]> = {
  zh: [
    { t: '目标：四人两副牌（108 张），2v2 对家；本队两人先出光手牌即胜，爬级打过 A 通关。', b: true },
    { t: '出牌：领出任意合法牌型 → 下家出同型更大的、或用炸弹跨型压 → 压不过就「过」；一圈都过则收墩，收墩者重新领出。', b: false },
    { t: '压制序：四大天王 ＞ 大炸弹 ＞ 同花顺 ＞ 小炸弹 ＞ 普通牌型（同型比大小）。', b: false },
    { t: '级牌 / 逢人配：本盘「级牌」抬到 A 之上、小王之下；红桃级牌 = 逢人配（百搭，可当除王外任意牌）。牌桌/日志里标 🃏 的就是逢人配——所以「2🃏-6-7-8-9」是把 ♥2 当 5 的顺子、「QQQ+KK+2🃏」是 ♥2 当 K 的钢板，都合法。', b: false },
    { t: '进贡 / 还贡：次盘末游向头游进最大牌，头游还一张 ≤10；应贡方手握双大王可「抗贡」免进。', b: false },
    { t: '升级：头游队按 双上 +3 / 一三 +2 / 一四 +1 升级；输队褪一件服饰，到底线转金钱罚。', b: false },
  ],
  en: [
    { t: 'Goal: 4 players, two decks (108 cards), 2v2 partners; your team wins by emptying both hands first — climb ranks and pass A to clear the run.', b: true },
    { t: 'Play: lead any legal hand → the next player plays a bigger hand of the same type, or bombs across types → if you can\'t beat it, "Pass"; a full circle of passes wins the trick, and the trick winner leads again.', b: false },
    { t: 'Beat order: Four Kings ＞ big bomb ＞ straight flush ＞ small bomb ＞ normal hands (same type compares rank).', b: false },
    { t: 'Level card / wild: this round\'s "level card" ranks just above A and below the small joker; the heart level card = wild (stands in for any card but jokers). The 🃏 mark on the table/log flags a wild — so "2🃏-6-7-8-9" is a straight using ♥2 as 5, and "QQQ+KK+2🃏" is a plate using ♥2 as K, both legal.', b: false },
    { t: 'Tribute / return: from the 2nd round on, the loser tributes their biggest card to the winner, who returns one ≤10; a tributor holding both big jokers may "resist" and skip it.', b: false },
    { t: 'Ranking up: the winning team climbs by Double +3 / 1st+3rd +2 / 1st+4th +1; the losing team sheds a garment, then a cash penalty once at the last tier.', b: false },
  ],
};

// ── 插值文案（名字/数字拼接·en-US 千分位·宿主传本地化 name：AI 名=专名恒中文·hero=t(seat.you)）──
export const fmtTurnLead = (l: Lang, name: string): string => (l === 'zh' ? `${name} 领出中…` : `${name} is leading…`);
export const fmtTurnWonLead = (l: Lang, name: string): string => (l === 'zh' ? `${name} 收墩领出中…` : `${name} won the trick, leading…`);
export const fmtTurnRespond = (l: Lang, name: string): string => (l === 'zh' ? `${name} 应对中…` : `${name} is responding…`);
export const fmtActing = (l: Lang, name: string): string => (l === 'zh' ? `${name} 行动中…` : `${name} is acting…`);
export const fmtHolder = (l: Lang, name: string): string => (l === 'zh' ? `🏆 ${name} 暂大` : `🏆 ${name} leads`);
export const fmtWildTag = (l: Lang, wilds: number): string => (l === 'zh' ? `含${wilds}🃏逢人配` : `${wilds}🃏 wild`);

export const fmtCardsLeft = (l: Lang, cards: number): string => (l === 'zh' ? `余牌 ${cards}` : `${cards} left`);
export const fmtLevelTag = (l: Lang, lv: number): string => (l === 'zh' ? `级牌 ${lv}` : `Level ${lv}`);
export const fmtLevels = (l: Lang, ours: number, theirs: number): string => (l === 'zh' ? `我方 ${ours} · 对方 ${theirs}` : `Us ${ours} · Them ${theirs}`);
export const fmtStake = (l: Lang, stake: number): string => (l === 'zh' ? `底注 ${stake}` : `Stake ${stake}`);
export const fmtRound = (l: Lang, round: number): string => (l === 'zh' ? `第 ${round} 盘` : `Round ${round}`);
export const fmtDress = (l: Lang, dress: number, tiers: number): string => (l === 'zh' ? `服饰 ${dress}/${tiers}` : `Outfit ${dress}/${tiers}`);
export const fmtBuyinNote = (l: Lang, stake: number, wallet: number): string =>
  (l === 'zh' ? `底注 ${stake} × 20 · 荷包 ${money(wallet)}` : `Stake ${stake} × 20 · Purse ${money(wallet)}`);
export const fmtTierName = (l: Lang, name: string): string => (l === 'zh' ? `难度 ${name}` : `Difficulty ${name}`); // 设置页·name=已本地化难度名（宿主传 tierName(lang,id)）
export const fmtPeekHint = (l: Lang, tier: string, peek: number): string =>
  (l === 'zh'
    ? `⚠ ${tierName(l, tier)}会读牌（开局偷看每对手 ${peek} 张·公平告知）`
    : `⚠ ${tierName(l, tier)} reads cards (peeks ${peek} per opponent at deal · fair notice)`);
export const fmtMemHint = (l: Lang, tier: string, memory: string): string => `${tierName(l, tier)} · ${MEMORY_LABEL[l][memory] ?? memory}`;
export const fmtSortSetting = (l: Lang, mode: 'rank' | 'family'): string =>
  (l === 'zh'
    ? `理牌方式：${mode === 'rank' ? '按点数' : '按牌型'}（牌桌右下角可切换）`
    : `Sort: ${mode === 'rank' ? 'By Rank' : 'By Type'} (toggle at the table's bottom-right)`);
export const fmtSeed = (l: Lang, seed: number): string =>
  (l === 'zh'
    ? `本局种子：${seed}（报 bug 时贴上·同种子可复现这副牌与走向）`
    : `Seed: ${seed} (paste when reporting bugs · same seed replays this deal and flow)`);
export const fmtLevelsAfter = (l: Lang, ours: number, theirs: number): string => (l === 'zh' ? `级数 我 ${ours} · 敌 ${theirs}` : `Level: Us ${ours} · Them ${theirs}`);
export const fmtComboLabel = (l: Lang, combo: 'double' | 'first-third' | 'first-fourth'): string => {
  const zh: Record<string, string> = { double: '双上 ×3', 'first-third': '一三 ×2', 'first-fourth': '一四 ×1' };
  const en: Record<string, string> = { double: 'Double ×3', 'first-third': '1st+3rd ×2', 'first-fourth': '1st+4th ×1' };
  return (l === 'zh' ? zh : en)[combo] ?? combo;
};

// ── 进贡横幅（宿主拼·card 串=红线机读口径恒中文·仅连接词本地化）──
export const fmtTributeResist = (l: Lang): string => (l === 'zh' ? '抗贡成功 · 双大王免进贡 · 头游先出' : 'Resist! Double big jokers — no tribute · winner leads');
export const fmtTributeLine = (l: Lang, from: string, card: string, to: string, returned?: string | null): string => {
  const base = l === 'zh' ? `${from} 进 ${card} → ${to}` : `${from} tributes ${card} → ${to}`;
  if (returned == null) return base;
  return l === 'zh' ? `${base}（还 ${returned}）` : `${base} (returns ${returned})`;
};
