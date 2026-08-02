// Game B ·《雀宴》文案字典（owner 2026-07-21「日语版·默认日文·日/中切换」）——**游戏层 i18n 纯数据**。
//
// 声明式：每条用户可见文案 = 一张 {ja, zh} 数据（最弱 LLM 也能照抄改值·非自由代码）；t(lang,key) 是固定查表解释器。
// 引擎无 i18n 能力（game-a/game-c 已两例自持字典·第三例仍不下沉·YAGNI）→ 本游戏自持字典即可。默认 = 日文（宿主 game-b.ts）。
// 红线：牌局**日志正文**（m.log 各条）恒中文机读口径（同 game-a）——**不经此层**；役种名/scoreLabel 由算分核出（多为共通汉字·
//   暂原样·要片假名役名再动核）。本层只管**表现层 chrome**：三屏文案 + 麻将术语显示名（全日式片假名 ツモ/リーチ/ドラ…）。
export type Lang = 'ja' | 'zh';
type Entry = Record<Lang, string>;

// ── 静态文案（无插值）─────────────────────────────────────────────────────────
export const STRINGS = {
  // 主菜单 SC-1
  'menu.sub': { ja: '四人東風戦 · リーチ麻雀 · 和室の夜雀荘', zh: '四人东风战 · 立直麻将 · 暖夜和室雀庄' },
  'menu.tip': { ja: 'ディーラー着席 · どうぞご着席を ▾', zh: '荷官已就位，请上桌 ▾' },
  'menu.start': { ja: '対局開始', zh: '开始上桌' },
  'menu.continue': { ja: '続きから', zh: '继续上局' },
  'menu.settings': { ja: '設定', zh: '设置' },
  'menu.heroLabel': { ja: '主役立ち絵', zh: '主角立绘' },
  'menu.heroPrompt': { ja: '女性向け · 和風の夜宴 · 和室 · 透過立ち絵', zh: '女性向二次元 · 和风夜宴 · 暖夜和室 · 真 alpha 立绘' },
  'menu.ver': { ja: 'v0.3.1 · 内部テスト', zh: 'v0.3.1 · 内部测试' },

  // 设置 SC-2
  'set.title': { ja: '設定', zh: '设置' },
  'set.speed': { ja: 'AI の打牌速度', zh: 'AI 出牌速度' },
  'set.fast': { ja: '速い', zh: '快' },
  'set.normal': { ja: '普通', zh: '普通' },
  'set.slow': { ja: '遅い', zh: '慢' },
  'set.log': { ja: '開局時にログを開く（デバッグ用）', zh: '开局默认展开日志（查 bug）' },
  'set.on': { ja: 'オン', zh: '开' },
  'set.off': { ja: 'オフ', zh: '关' },
  'set.note': { ja: '難易度 / 音量 / 脱衣演出などは順次開放。', zh: '难度 / 音量 / 脱衣演出等随玩法完善逐步开放。' },
  'set.back': { ja: '戻る', zh: '返回' },

  // 牌桌 SC-play · 场况 / 牌区
  'play.dora': { ja: 'ドラ', zh: '宝牌' },
  'play.dead': { ja: '王牌', zh: '报牌区' },
  'play.riverYou': { ja: '自分 · 河', zh: '你 · 河' },
  'play.riverAcross': { ja: '対面 · 河', zh: '对家 · 河' },
  'play.river': { ja: '河', zh: '河' },
  'play.playing': { ja: '打牌中', zh: '打牌中' },
  'play.riichiTag': { ja: '● リーチ', zh: '● 立直' },
  // 行动键 / 鸣牌（全日式片假名）
  'act.tsumo': { ja: 'ツモ', zh: '自摸' },
  'act.riichi': { ja: 'リーチ', zh: '立直' },
  'act.kan': { ja: 'カン', zh: '杠' },
  'act.pon': { ja: 'ポン', zh: '碰' },
  'act.ron': { ja: '🀄 ロン', zh: '🀄 荣和' },
  'act.robkan': { ja: '🀄 槍槓', zh: '🀄 抢杠' },
  'act.pass': { ja: 'パス', zh: '过' },
  // 控制 / 回合
  'ui.log': { ja: 'ログ', zh: '日志' },
  'ui.menu': { ja: 'メニュー', zh: '菜单' },
  'turn.youCall': { ja: '⚡ あなたの番 · 鳴き', zh: '⚡ 轮到你 · 鸣牌' },
  'turn.youPlay': { ja: '▶ あなたの番 · 打牌', zh: '▶ 轮到你 · 出牌' },
  'turn.opening': { ja: '開局', zh: '开局' },

  // 游戏内菜单浮层
  'gm.title': { ja: 'メニュー · 雀宴', zh: '菜单 · 雀宴' },
  'gm.rules': { ja: 'ルール · 点数', zh: '规则说明 · 番数' },
  'gm.view': { ja: '見る', zh: '查看' },
  'gm.sound': { ja: '音', zh: '声音' },
  'gm.soundOn': { ja: '🔊 オン', zh: '🔊 开' },
  'gm.soundOff': { ja: '🔇 オフ', zh: '🔇 关' },
  'gm.language': { ja: '言語 / 语言', zh: '语言 / 言語' },
  'gm.home': { ja: 'タイトルへ', zh: '返回主菜单' },
  'gm.back': { ja: '戻る', zh: '返回' },

  // 规则速览浮层
  'rules.title': { ja: 'ルール · 点数早見', zh: '规则说明 · 番数速览' },

  // 日志面板 chrome
  'log.close': { ja: '✕ 閉じる', zh: '✕ 关闭' },
  'log.copied': { ja: '✓ コピー済み —— 貼り付けて', zh: '✓ 已复制 —— 粘贴给我' },

  // 结算浮层
  'res.draw': { ja: '流局', zh: '荒牌流局' },
  'res.concealed': { ja: '手牌', zh: '暗手' },
  'res.melds': { ja: '副露（チー/ポン/カン · 出所）', zh: '副露（吃/碰/杠 · 来源）' },
  'res.total': { ja: '合計', zh: '合计' },
  'res.yakuman': { ja: '役満', zh: '役満' },
  'res.settle': { ja: '局清算', zh: '本局结算' },
  'res.final': { ja: '終局', zh: '终局' },
  'res.next': { ja: '次局へ ▸', zh: '下一局 ▸' },
  'res.home': { ja: 'タイトルへ', zh: '返回主菜单' },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;
/** 静态查表：t(lang, key) → 该语言文案。 */
export const t = (lang: Lang, key: StringKey): string => STRINGS[key][lang];

// ── 鸣牌动词显示名（副露/结算标源·双语·键=meld kind）──
export const MELD_VERB: Record<Lang, Record<string, string>> = {
  ja: { chi: 'チー', pon: 'ポン', minkan: 'カン', ankan: '暗カン', kakan: '加カン' },
  zh: { chi: '吃', pon: '碰', minkan: '杠', ankan: '暗杠', kakan: '加杠' },
};
export const meldVerb = (lang: Lang, kind: string): string => MELD_VERB[lang][kind] ?? kind;

// ── 规则速览正文（双语·b=加粗；牌面/数字/役名原样·片假名术语全日式）──
export const RULES_LINES: Record<Lang, { t: string; b: boolean }[]> = {
  ja: [
    { t: '雀宴 · 全日式リーチ麻雀（東風戦一周 · 四人）', b: true },
    { t: '基本：手牌 13 枚 · ツモ切りで 4 面子 + 雀頭を揃えて和了。門前でリーチ可（1000 点 · 裏ドラ有）。', b: false },
    { t: '役（主なもの）：リーチ / 断幺九 / 平和 / 一盃口 / 役牌 = 1 翻；三色 / 一気通貫 / 七対子 = 2 翻（喰い下がり -1）。', b: false },
    { t: '符：底 20 符 + 面子/雀頭/待ち/ツモ/門前ロンで加符；連風雀頭 = 4 符（天鳳準拠）。', b: false },
    { t: '点数：満貫 5 翻 8000 · 跳満 6-7 翻 12000 · 倍満 8-10 翻 16000 · 三倍満 11-12 翻 24000 · 役満 13 翻+ 32000。', b: false },
    { t: '鳴き：ポン（誰からでも）/ チー（上家）/ カン（明・暗・加）· カン後は嶺上ツモ + 新ドラ · 槍槓でロン可。', b: false },
  ],
  zh: [
    { t: '雀宴 · 全日式立直麻将（東風戦一圈 · 四人）', b: true },
    { t: '基本：13 张起手 · 摸一打一凑 4 面子 + 1 雀头和了。门前清可立直（1000 点 · 翻宝牌里）。', b: false },
    { t: '役（常用）：立直 / 断幺九 / 平和 / 一盃口 / 役牌 = 1 番；三色 / 一気通贯 / 七対子 = 2 番（副露降 1）。', b: false },
    { t: '符：底 20 符 + 面子/雀头/待ち/自摸/门清荣加符；連風雀頭 = 4 符（天鳳準拠）。', b: false },
    { t: '点数：满贯 5 番 8000 · 跳满 6-7 番 12000 · 倍满 8-10 番 16000 · 三倍满 11-12 番 24000 · 役満 13 番+ 32000。', b: false },
    { t: '鸣牌：碰（任家）/ 吃（上家）/ 杠（明·暗·加）· 杠后岭上摸 + 翻新宝牌 · 抢杠可荣。', b: false },
  ],
};

// ── 插值文案（名字/数字/牌·宿主传本地化 name；AI 名=专名双语数据·hero「主角」→あなた）──
const money = (x: number): string => x.toLocaleString('en-US');
export const fmtMoney = money;
/** 主角显示名：日文版「主角」→「あなた」（专名 AI 名原样）。 */
export const heroDisplay = (lang: Lang, name: string): string => (name === '主角' && lang === 'ja' ? 'あなた' : name);

export const fmtRound = (lang: Lang, kanjiRound: string, kanjiSeat: string): string =>
  (lang === 'ja' ? `${kanjiRound}場 · ${kanjiSeat}家` : `${kanjiRound}場 · ${kanjiSeat}家`); // 場/家 共通汉字
export const fmtWall = (lang: Lang, wall: number, honba: number, kyotaku: number): string =>
  (lang === 'ja' ? `残り ${wall} · ${honba}本場 · 供託 ${kyotaku}` : `余牌 ${wall} · ${honba}本場 · 供托 ${kyotaku}`);
export const fmtTurnOpp = (lang: Lang, arrow: string, name: string): string =>
  (lang === 'ja' ? `${arrow} ${name} 打牌中` : `${arrow} ${name} 出牌中`);
export const fmtLastDiscard = (lang: Lang, name: string, tile: string): string =>
  (lang === 'ja' ? `直前：${name} が【${tile}】` : `刚打：${name} 打【${tile}】`);
export const fmtCallHint = (lang: Lang, name: string, tile: string): string =>
  (lang === 'ja' ? `${name} が【${tile}】` : `${name} 打【${tile}】`);
export const fmtChi = (lang: Lang, tiles: string): string => (lang === 'ja' ? `チー ${tiles}` : `吃 ${tiles}`);
export const fmtLogTitle = (lang: Lang, seed: number): string =>
  (lang === 'ja' ? `ゲームログ · 通算 · シード ${seed}` : `游戏日志 · 跨局累计 · 种子 ${seed}`);
export const fmtLogCopy = (lang: Lang, n: number): string => (lang === 'ja' ? `📋 ログをコピー（${n} 件）` : `📋 复制完整日志（${n} 条）`);
export const fmtResultTitle = (lang: Lang, kind: 'draw' | 'tsumo' | 'ron', name: string): string => {
  if (kind === 'draw') return t(lang, 'res.draw');
  if (kind === 'tsumo') return lang === 'ja' ? `${name} ツモ和了` : `${name} 自摸和了`;
  return lang === 'ja' ? `${name} ロン和了` : `${name} 荣和`;
};
export const fmtWinTile = (lang: Lang, tile: string, loserName: string | null): string => {
  if (loserName === null) return lang === 'ja' ? `和了牌 ${tile}（ツモ）` : `和了牌 ${tile}（自摸）`;
  return lang === 'ja' ? `和了牌 ${tile}（放銃 ${loserName}）` : `和了牌 ${tile}（放铳 ${loserName}）`;
};
export const fmtHan = (lang: Lang, han: number): string => (lang === 'ja' ? `${han} 翻` : `${han} 番`);
export const fmtYakuman = (lang: Lang, mult: number): string =>
  (mult > 1 ? `${mult} 倍${t(lang, 'res.yakuman')}` : t(lang, 'res.yakuman'));
export const fmtStrip = (lang: Lang, name: string, n: number, left: number, total: number): string =>
  (lang === 'ja' ? `${name} 脱衣${n}（残 ${left}/${total}）` : `${name} 脱${n}（余 ${left}/${total}）`);
export const fmtStripHead = (lang: Lang): string => (lang === 'ja' ? '直撃で脱衣 · ' : '直击脱衣 · ');
export const fmtDelta = (lang: Lang, name: string, d: number, total: number): string =>
  `${name}　${d >= 0 ? '+' : ''}${d}　→ ${money(total)}`;
