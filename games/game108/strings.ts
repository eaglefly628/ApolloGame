// game108《拳律 / Rule of Three》文案字典 —— **游戏层 i18n 纯数据**（owner 2026-08-07「英语和中文版本都要做」）。
//
// 口径照抄本库既有两例（`games/game-a/strings.ts` / game-c）：每条用户可见文案 = 一张 `{en, zh}` 数据
// （最弱 LLM 也能照抄改值·非自由代码）；`t(lang, key)` 是固定查表解释器，不做任何逻辑。
//
// ⚠ **本作是第三例**。game-a 的文件头写着「引擎无 i18n 能力 … 本游戏自持字典即可，不下沉引擎
//   （YAGNI·game-c 已是第二例·**第三个游戏要再抽共用能力**）」——那条自定的触发线到今天正好踩到。
//   已按缺口裁决协议开单 `REQ-108-UI-07` 报 Lead 裁（抽不抽、抽成什么），**本轮先照现成模式落地不阻塞交付**。
//
// 红线：只管**表现层显示**。动作词表（`ACT`）、条款号、存档键、日志口径一律不经此层——
// 那些是机读真相，恒定不变。

export type Lang = 'en' | 'zh';
type Entry = Record<Lang, string>;

export const STRINGS = {
  // ── 身份 / 顶栏 ──────────────────────────────────────────────────────
  'side.you': { en: 'You', zh: '你' },
  'top.round': { en: 'Round {n}', zh: '第 {n} 回合' },
  'top.sec': { en: 'sec', zh: '秒' },

  // ── 相位 ────────────────────────────────────────────────────────────
  'phase.charge': { en: 'CHARGE', zh: '蓄力' },
  'phase.throw': { en: 'THROW', zh: '出招' },
  'phase.clash': { en: 'CLASH', zh: '对决' },
  'phase.settle': { en: 'SETTLE', zh: '结算' },
  'phase.p1win': { en: 'YOU WIN', zh: '你赢了' },
  'phase.p2win': { en: 'YOU LOSE', zh: '你输了' },

  // ── 手型（短名 = 键面/判定表用，长名 = 槽内用）────────────────────────
  'hand.rock.short': { en: 'RK', zh: '石' },
  'hand.paper.short': { en: 'PP', zh: '布' },
  'hand.scissors.short': { en: 'SC', zh: '剪' },
  'hand.rock.full': { en: 'Rock', zh: '石头' },
  'hand.paper.full': { en: 'Paper', zh: '布' },
  'hand.scissors.full': { en: 'Scissors', zh: '剪刀' },

  // ── 判定表石板 ───────────────────────────────────────────────────────
  'slab.title': { en: 'BEATS', zh: '判定表' },
  'slab.note': { en: 'Relics re-carve it', zh: '道具可凿裂重刻' },

  // ── 蓄力槽 ──────────────────────────────────────────────────────────
  'slots.mine.a': { en: 'MY', zh: '我的' },
  'slots.mine.b': { en: 'CHARGE', zh: '蓄力' },
  'slots.foe.b': { en: 'CHARGE', zh: '蓄力' },
  'slots.dealsNow': { en: 'Deals {n}', zh: '现在打 {n}' },
  'slots.threat': { en: 'Full charge on {hand} · a hit costs 40% HP', zh: '他攒满了一手{hand} · 被打中要掉四成血' },

  // ── 招式卡 ──────────────────────────────────────────────────────────
  'card.charge': { en: 'CHARGE → {n}', zh: '蓄力 → {n}' },
  'card.full': { en: 'FULL · locked', zh: '已满 · 点不动' },
  'card.throwFor': { en: 'HIT {n}', zh: '打 {n}' },
  'card.locked': { en: 'Locked', zh: '本回合不可点' },
  'card.badgeFull': { en: 'FULL', zh: '满' },
  'card.badgeSent': { en: 'SENT', zh: '已提交' },

  // ── 烟雾 ────────────────────────────────────────────────────────────
  'smoke.name': { en: 'Smoke ×{n}', zh: '烟雾 ×{n}' },
  'smoke.avail': { en: 'Hide my slots · 2 rounds', zh: '遮蔽我方三槽 2 回合' },
  'smoke.active': { en: 'Active · hidden from them', zh: '生效中 · 对手看不见' },
  'smoke.off': { en: 'Locked in clash', zh: '对决中不可用' },
  // 【R-108-21】烟雾期间挂在对手画像旁的标——**这一枚才是信息**：告诉玩家「他这两回合读不到你」。
  'smoke.blind': { en: 'HE IS BLIND', zh: '他看不见了' },

  // ── 结果横幅 ────────────────────────────────────────────────────────
  'result.win': { en: 'You win the round', zh: '你赢了这回合' },
  'result.lose': { en: 'You got hit', zh: '你被打中' },
  'result.tie': { en: 'Tie · neither side takes damage', zh: '平局 · 双方都不掉血' },
  'result.tieShort': { en: 'TIE', zh: '平局' },
  'result.settled': { en: 'Damage applied', zh: '伤害落定' },

  // ── 终局 ────────────────────────────────────────────────────────────
  'end.rounds': { en: 'rounds', zh: '回合' },
  'end.hpLeft': { en: 'HP left', zh: '剩余血量' },
  'end.again': { en: 'Play again', zh: '再来一局' },
  // 【R-108-05】v3 T4 玩家闸门。**与「再来一局」文案必须分得开**——
  // 一个是进下一回合、一个是重开整局，混了玩家会以为结算屏那一点就把这局作废了。
  'end.nextRound': { en: 'NEXT ROUND', zh: '下一轮' },
  // 【REQ-DOKI-APPS】终局屏推荐位（只在宿主真给出可拉起的 App 时出现·空列表整条不画）。
  'end.more': { en: 'Play something else', zh: '换个游戏玩' },

  // ── 罚血读秒（【R-108-04】v3·**文案逐字照设计定稿**）─────────────────────
  // 设计方钉死的口径：写「超时罚血」，**不写「受伤」**——罚血不是战果。
  // 「这不是他打的」那句是稿子里专门用来把罚血与挨打分开的，不许改写。
  'penalty.title': { en: 'OVERTIME', zh: '超时' },
  'penalty.text': { en: 'OVERTIME · −1 HP per second', zh: '超时了 · 每思考 1 秒罚 1 滴血' },
  'penalty.owe': { en: 'OWED', zh: '已欠' },
  'penalty.foot': { en: 'Stops when you strike · not his hit', zh: '出手即停 · 这不是他打的' },

  // ── 开始屏（owner 2026-08-08 要）──────────────────────────────────────
  'start.title': { en: 'RULE OF THREE', zh: '拳律' },
  'start.sub': { en: 'Charge in the open. Then lie about it.', zh: '当着他的面存力 · 然后出别的' },
  'start.go': { en: 'START', zh: '开始' },
  'start.loading': { en: 'LOADING ...', zh: '加载中 ...' },
  'start.anykey': { en: 'PRESS ANY KEY', zh: '按任意键开始' },
  'start.tip': { en: 'Both slots are public — read where his power goes', zh: '六条槽全公开 · 读他的力往哪只手去' },

  // ── T1 放大选牌（设计定稿）────────────────────────────────────────────
  't1.pick': { en: 'Pick one hand · +1 layer per round', zh: '选一手蓄力 · 每回合只能加一层' },
  'card.badgeRisen': { en: 'RAISED', zh: '已升起' },

  // ── 设置菜单（owner 2026-08-07：右上角一个菜单键·里面放音乐和语言）──────
  'menu.title': { en: 'SETTINGS', zh: '设置' },
  'menu.bgm': { en: 'Music', zh: '背景音乐' },
  'menu.sfx': { en: 'Sound FX', zh: '音效' },
  'menu.voice': { en: 'Character voice', zh: '角色配音' },
  'menu.lang': { en: 'Language', zh: '语言' },
  'menu.on': { en: 'ON', zh: '开' },
  'menu.off': { en: 'OFF', zh: '关' },
  'menu.close': { en: 'Close', zh: '关闭' },
  'menu.langZh': { en: '中文', zh: '中文' },
  'menu.langEn': { en: 'English', zh: 'English' },

  // ── 玩法说明（owner 2026-08-08 要·菜单里一项）────────────────────────
  // 口径照 §0 验收铁律：**零记忆零算术**——说明本身也不许要求玩家记东西或心算，
  // 所以写成「四拍各干什么 + 三条规则」，不写公式、不列概率。
  'help.title': { en: 'HOW TO PLAY', zh: '玩法说明' },
  'help.open': { en: 'How to play', zh: '玩法说明' },
  // 首次进入自动弹那一次，底下那枚键的文案（owner 2026-08-15：「玩家可以选跳过，这还是要有的」）。
  // 一枚键说清两件事：读完了也按它、不想读也按它，按下去就开局。
  'help.skip': { en: 'SKIP · START', zh: '跳过 · 开始' },
  'help.beats': { en: 'EACH ROUND', zh: '一个回合' },
  'help.t1': { en: 'CHARGE · pick one hand, +1 layer (once per round)', zh: '蓄力 · 挑一只手 +1 层（一回合只能加一层）' },
  'help.t2': { en: 'STRIKE · throw any hand — not necessarily the one you charged', zh: '出招 · 出任意一手，不必是刚蓄的那只' },
  'help.t3': { en: 'DUEL · both hands revealed at once', zh: '对决 · 双方同时亮拳' },
  'help.t4': { en: 'RESOLVE · press NEXT ROUND when you are ready', zh: '结算 · 看够了再点「下一轮」' },
  'help.rules': { en: 'THREE RULES', zh: '三条规则' },
  'help.r1': { en: 'Rock beats Scissors beats Paper beats Rock', zh: '石 > 剪 > 布 > 石' },
  'help.r2': { en: 'Charge does not decide who wins — only how hard the win lands', zh: '蓄力不决定谁赢，只决定赢了打多重' },
  'help.r3': { en: 'The hand you throw resets to zero — win, lose or tie', zh: '出过的手清零——赢、输、平都一样' },
  'help.tell': { en: 'Both charge racks are public. That is the whole game: read where his power goes, and lie about yours.', zh: '六条槽全公开。这就是整个游戏：读他的力往哪去，再对自己的力说谎。' },
  'help.penalty': { en: 'Stalling past the free time costs 1 HP per second — it stops the moment you strike.', zh: '出招拖过免费时间，每秒扣 1 点血——出手就停。' },

  // ── 心情（卡片角色的 AI 轴）──────────────────────────────────────────
  'mood.stubborn': { en: 'Stubborn', zh: '执拗' },
  'mood.reckless': { en: 'Reckless', zh: '上头' },
  'mood.playful': { en: 'Playful', zh: '玩心' },
  'mood.moody': { en: 'Moody', zh: '阴晴不定' },
  'mood.sharp': { en: 'Sharp', zh: '精明' },
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

/**
 * 拉丁文字的**排版宽度系数**（相对同字号中文的 1 字宽）。
 * 中文一字 ≈ 1 em，英文一字母 ≈ 0.55 em —— 定宽盒里按字数估宽时必须除以它，
 * 否则英文要么撑破盒子、要么留一大片空。**英文排版的坑基本都出在这一条上**
 * （实测溢出：「MY CHARGE」把 56px 的标签列顶到 90px）。
 */
export const CHAR_W: Record<Lang, number> = { zh: 1, en: 0.55 };

/**
 * 英文字号阶梯 —— **设计定稿 v3 §⑦ 的正式解**（此前那套按字宽系数临调是"止血不是设计"，作废）：
 * 「英文一律 Fredoka，中文 ZCOOL KuaiLe，两套字号阶梯：**英文取中文的 0.72×，下限 15px**。」
 * 定宽盒里仍要用 `CHAR_W` 估宽（那管的是"一个字占多宽"），这条管的是"字打多大"，两者各管一半。
 */
export const enSize = (lang: Lang, zhSize: number): number =>
  lang === 'en' ? Math.max(15, Math.round(zhSize * 0.72)) : zhSize;

/** 查表 + `{name}` 占位替换。缺 key 直接返回 key（**不静默变空串**，好在屏上一眼看见漏了哪条）。 */
export function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  const entry = STRINGS[key] as Entry | undefined;
  let out = entry ? entry[lang] : String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** 语言存取（宿主用·同 game-a 口径：localStorage 持久化，读不到回退中文）。 */
export const LANG_KEY = 'g108_lang';
export const loadLang = (): Lang => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'; } catch { return 'zh'; }
};
export const saveLang = (x: Lang): void => {
  try { localStorage.setItem(LANG_KEY, x); } catch { /* 无 localStorage 环境（探针/SSR）→ 不持久化，本次会话仍生效 */ }
};
