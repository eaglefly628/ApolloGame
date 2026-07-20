// Game A ·《掼蛋夜宴》—— 中英 i18n 走查（owner 2026-07-20·mirror game-c·**默认中文**）。
// ①字典完整性（每条 en+zh 非空·牌型/性格/难度键集齐备·规则表中英等长）；
// ②冒烟：各屏 buildMenu/buildTableSelect/buildPlay/buildResult 在 lang:'en'/'zh' 下文案真随语言变 + 语言段控在树。
import { describe, it, expect } from 'vitest';
import {
  STRINGS, HAND_NAMES, TRAIT_NAMES, TIER_NAMES, PATTERN_GUIDE, RULES_LINES, handName, type Lang,
} from './strings.js';
import { buildMenu, buildTableSelect, buildPlay, buildResult, type PlayView, type SeatView } from './hud.js';
import { SEATS, DRESS_TIERS, INITIAL_FUNDS, cardCode } from './rules.js';

const LANGS: readonly Lang[] = ['en', 'zh'];

// 收集树里所有可见文案（label/text/title/sub + spans + Segmented/Tabs options + Table columns）。
// 节点结构松散读取（LayoutNode.props=闭集 union·无 string 索引·故经 unknown 逐字段取）。
type LooseNode = { id?: string; props?: Record<string, unknown>; children?: unknown[] };
function collectText(node: unknown): string[] {
  const out: string[] = [];
  const walk = (raw: unknown): void => {
    if (!raw || typeof raw !== 'object') return;
    const n = raw as LooseNode;
    const p = (n.props ?? {}) as Record<string, unknown>;
    for (const k of ['label', 'text', 'title', 'sub']) if (typeof p[k] === 'string') out.push(p[k] as string);
    if (Array.isArray(p.spans)) for (const s of p.spans as { text?: string }[]) if (typeof s?.text === 'string') out.push(s.text);
    for (const key of ['options', 'tabs']) if (Array.isArray(p[key])) for (const o of p[key] as { label?: string }[]) if (typeof o?.label === 'string') out.push(o.label);
    if (Array.isArray(p.columns)) for (const c of p.columns as { label?: string }[]) if (typeof c?.label === 'string') out.push(c.label);
    for (const c of n.children ?? []) walk(c);
  };
  walk(node);
  return out;
}
function idsOf(node: unknown): Set<string> {
  const ids = new Set<string>();
  const walk = (raw: unknown): void => {
    if (!raw || typeof raw !== 'object') return;
    const n = raw as LooseNode;
    if (n.id) ids.add(n.id);
    for (const c of n.children ?? []) walk(c);
  };
  walk(node);
  return ids;
}

function playV(lang: Lang): PlayView {
  const sv = (id: SeatView['seat']['id']): SeatView => ({ seat: SEATS.find((s) => s.id === id)!, cards: 27, dress: DRESS_TIERS });
  return {
    lang, round: 1, stake: 100, levelPlay: 2, levelOurs: 2, levelTheirs: 2, wallet: INITIAL_FUNDS,
    turn: 'hero', turnName: lang === 'en' ? 'You' : '你',
    seats: { partner: sv('partner'), west: sv('west'), east: sv('east'), hero: sv('hero') },
    hand: [cardCode(0, 3), cardCode(1, 3)], selected: [], sortMode: 'rank',
    trick: null, plays: {}, tributeText: null, showCounter: false, counter: [],
    canCommit: false, commitWhy: '', canPass: false, mustPass: false,
    showMenu: false, menuTab: 'log', logRows: [], tierName: lang === 'en' ? 'Regular' : '常客', seed: 20260718,
  };
}

describe('Game A · i18n 中英字典', () => {
  it('每条 STRINGS 都有非空 en 与 zh', () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect(entry.en, `${key}.en`).toBeTruthy();
      expect(entry.zh, `${key}.zh`).toBeTruthy();
    }
  });

  it('牌型/性格/难度显示名双语键集齐备（en 键 = zh 键·值非空）', () => {
    for (const map of [HAND_NAMES, TRAIT_NAMES, TIER_NAMES]) {
      expect(Object.keys(map.en).sort()).toEqual(Object.keys(map.zh).sort());
      for (const k of Object.keys(map.en)) { expect(map.en[k]).toBeTruthy(); expect(map.zh[k]).toBeTruthy(); }
    }
    // 牌型 zh 显示名须对齐 session FAMILY_CN 口径（不漂移·抽查代表键）。
    expect(handName('zh', 'sky')).toBe('四大天王');
    expect(handName('zh', 'bomb')).toBe('炸弹');
    expect(handName('en', 'sky')).toBe('Four Kings');
    expect(handName('en', 'x-unknown')).toBe('x-unknown'); // 未知键兜底=原样
  });

  it('规则表 PATTERN_GUIDE / RULES_LINES 中英等长且值非空', () => {
    expect(PATTERN_GUIDE.en.length).toBe(PATTERN_GUIDE.zh.length);
    expect(PATTERN_GUIDE.zh.length).toBe(10);
    expect(RULES_LINES.en.length).toBe(RULES_LINES.zh.length);
    for (const l of LANGS) {
      for (const p of PATTERN_GUIDE[l]) { expect(p.name).toBeTruthy(); expect(p.note).toBeTruthy(); }
      for (const r of RULES_LINES[l]) expect(r.t).toBeTruthy();
    }
  });

  it('主菜单：EN 出英文按钮 / ZH 出中文按钮 + 语言段控在两语言树', () => {
    const en = buildMenu({ lang: 'en', wallet: 12860, level: 2, showMenu: false, menuTab: 'log' });
    const zh = buildMenu({ lang: 'zh', wallet: 12860, level: 2, showMenu: false, menuTab: 'log' });
    expect(collectText(en)).toContain('Sit Down'); // menu.start EN
    expect(collectText(en)).not.toContain('开始上桌');
    expect(collectText(zh)).toContain('开始上桌'); // menu.start ZH
    for (const node of [en, zh]) for (const id of ['a-menu-lang-seg-en', 'a-menu-lang-seg-zh']) expect(idsOf(node).has(id)).toBe(true);
  });

  it('选桌：难度名随语言（EN=Master / ZH=宗师）', () => {
    const en = buildTableSelect({ lang: 'en', difficulty: 'l4', stake: 100, wallet: 10000 });
    const zh = buildTableSelect({ lang: 'zh', difficulty: 'l4', stake: 100, wallet: 10000 });
    expect(collectText(en)).toContain('Master');
    expect(collectText(en)).toContain('Choose Table'); // sel.title EN
    expect(collectText(zh)).toContain('宗师');
    expect(collectText(zh)).toContain('选桌');
  });

  it('牌桌屏：EN 出英文操作键 / ZH 出中文 + 顶栏语言段控在树 + EN 无残留中文 chrome', () => {
    const en = buildPlay(playV('en'));
    const zh = buildPlay(playV('zh'));
    const enText = collectText(en);
    expect(enText).toContain('Play'); // play.commit EN（出牌）
    expect(enText).toContain('Hint'); // play.hint EN
    expect(enText).toContain('Your turn to lead'); // play.yourLead EN
    expect(collectText(zh)).toContain('出牌');
    expect(collectText(zh)).toContain('提示');
    // EN chrome 不得残留中文原文（专名沈玉薇等=数据·不在 chrome 断言内）。
    for (const zhChrome of ['出牌', '提示', '轮到你领出', '菜单']) expect(enText).not.toContain(zhChrome);
    for (const node of [en, zh]) for (const id of ['a-p-lang-en', 'a-p-lang-zh']) expect(idsOf(node).has(id)).toBe(true);
  });

  it('结算屏：过 A 通关标题随语言（EN/ZH）', () => {
    const mk = (lang: Lang) => buildResult({
      lang,
      ranking: [
        { seat: 'hero', name: lang === 'en' ? 'You' : '你', team: 0 }, { seat: 'partner', name: '沈玉薇', team: 0 },
        { seat: 'west', name: '林曼笙', team: 1 }, { seat: 'east', name: '顾念念', team: 1 },
      ],
      winnersTeam: 0, comboLabel: lang === 'en' ? 'Double ×3' : '双上 ×3', totalMult: 3, payPerPlayer: 300,
      levelAfter: [5, 2], dressOutDoubled: false, phase: 'run-won',
    });
    expect(collectText(mk('en'))).toContain('Passed A · Cleared!'); // res.titleWon EN
    expect(collectText(mk('zh'))).toContain('过 A · 通关！');
  });
});
