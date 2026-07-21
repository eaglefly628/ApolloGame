// Game B ·《雀宴》i18n 纪律钉——双语字典完备性 + 术语正确性（日/中·默认日文）。
import { describe, it, expect } from 'vitest';
import { STRINGS, MELD_VERB, RULES_LINES, t, meldVerb, heroDisplay, fmtHan, fmtWinTile, type Lang, type StringKey } from './strings.js';

describe('game-b i18n（strings·日/中双语·默认日文）', () => {
  it('每条文案 ja/zh 双语齐全且非空', () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect(entry.ja, `${key}.ja`).toBeTruthy();
      expect(entry.zh, `${key}.zh`).toBeTruthy();
    }
  });

  it('t(lang,key) 按语言查表', () => {
    expect(t('ja', 'act.tsumo')).toBe('ツモ');
    expect(t('zh', 'act.tsumo')).toBe('自摸');
    expect(t('ja', 'act.riichi')).toBe('リーチ');
    expect(t('ja', 'act.ron')).toContain('ロン');
    expect(t('ja', 'play.dora')).toBe('ドラ');
    expect(t('zh', 'play.dora')).toBe('宝牌');
  });

  it('全日式片假名术语（ja 侧行动键=片假名）', () => {
    const kata = ['act.tsumo', 'act.riichi', 'act.kan', 'act.pon', 'act.pass'] as StringKey[];
    for (const k of kata) expect(t('ja', k), `${k}`).toMatch(/[ァ-ヴ]/); // 含片假名
  });

  it('鸣牌动词双语 + 规则正文行数一致', () => {
    for (const kind of ['chi', 'pon', 'minkan', 'ankan', 'kakan']) {
      expect(meldVerb('ja', kind)).toBeTruthy();
      expect(meldVerb('zh', kind)).toBeTruthy();
    }
    expect(RULES_LINES.ja.length).toBe(RULES_LINES.zh.length);
  });

  it('主角显示名：ja「主角」→「あなた」·zh 原样·专名不变', () => {
    expect(heroDisplay('ja', '主角')).toBe('あなた');
    expect(heroDisplay('zh', '主角')).toBe('主角');
    expect(heroDisplay('ja', '绫')).toBe('绫'); // AI 专名两语原样
  });

  it('插值：翻/放銃 双语口径', () => {
    expect(fmtHan('ja', 3)).toBe('3 翻');
    expect(fmtHan('zh', 3)).toBe('3 番');
    expect(fmtWinTile('ja', '3萬', '绫')).toContain('放銃');
    expect(fmtWinTile('zh', '3萬', '绫')).toContain('放铳');
  });

  const _lang: Lang = 'ja'; void _lang;
});
