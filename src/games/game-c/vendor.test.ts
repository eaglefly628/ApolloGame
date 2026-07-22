// Game C ·《六人德州 STORY-POKER V2》—— 本地美术索引对账（vendor 自 PD 货架·mirror game-a §5.1）：
// public/games/game-c/art/index.json 可 parseAssetIndex 校验 + registerAssetIndex 桥接成可加载资产
//（站点绝对路径 baseUrl ''·携 vendoredFrom 溯源）；并逐张对账「Card → 资产 id/URL 映射」与索引一致——
// 52 张牌各引自己那张（无双副）+ 牌背 + 9 枚筹码。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseAssetIndex, registerAssetIndex, AssetManager, StubAssetLoader } from '@assets/index.js';
import { buildDeck } from './holdem-eval.js';
import { cardAssetId, cardAssetUrl, CARD_BACK_ID } from './theme.js';

const RAW = JSON.parse(readFileSync('public/games/game-c/art/index.json', 'utf8'));

// 9 枚筹码面额（vendor 自共享库 chip/*·GDD 筹码色系·未来 3D/HUD 筹码消费）。
const CHIP_IDS = [
  'chip/1-white', 'chip/5-red', 'chip/10-blue', 'chip/25-green', 'chip/50-orange',
  'chip/100-black', 'chip/500-purple', 'chip/1000-yellow', 'chip/5000-gray',
] as const;

describe('Game C · 本地牌资产库（PD vendor·mirror game-a §5.1）', () => {
  it('索引合法：62 条（52 牌 + 牌背 + 9 筹码）·全 filled·携 vendoredFrom 溯源', () => {
    const idx = parseAssetIndex(RAW);
    expect(idx.assets.length).toBe(62);
    const cards = idx.assets.filter((a) => a.id.startsWith('card/'));
    const chips = idx.assets.filter((a) => a.id.startsWith('chip/'));
    expect(cards.length).toBe(53); // 52 + 牌背
    expect(chips.length).toBe(9);
    for (const a of idx.assets) {
      expect(a.status).toBe('filled');
      expect(a.provenance).toMatchObject({ vendoredFrom: a.id }); // 同 id 自货架 vendor（copy 不直引）
    }
  });

  it('registerAssetIndex 可桥接消费（站点绝对路径 baseUrl 空串）', () => {
    const idx = parseAssetIndex(RAW);
    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx);
    expect(m.has(CARD_BACK_ID)).toBe(true);
  });

  it('Card → 资产 id/URL 全量对账：52 张牌各有其索引条目·URL 与索引 path 一致', () => {
    const idx = parseAssetIndex(RAW);
    const byId = new Map(idx.assets.map((a) => [a.id, a]));
    const seen = new Set<string>();
    for (const c of buildDeck()) {
      const id = cardAssetId(c);
      seen.add(id);
      const entry = byId.get(id);
      expect(entry, `Card ${JSON.stringify(c)} → ${id} 应在本地索引`).toBeTruthy();
      expect(cardAssetUrl(id)).toBe(entry!.path);
    }
    expect(seen.size).toBe(52); // 一副去重后恰 52 张
    expect(byId.get(CARD_BACK_ID)?.path).toBe(cardAssetUrl(CARD_BACK_ID));
  });

  it('9 枚筹码资产各在本地索引（未来筹码贴图消费·vendor 溯源一致）', () => {
    const idx = parseAssetIndex(RAW);
    const byId = new Map(idx.assets.map((a) => [a.id, a]));
    for (const id of CHIP_IDS) {
      const entry = byId.get(id);
      expect(entry, `筹码 ${id} 应在本地索引`).toBeTruthy();
      expect(entry!.path).toBe(`/games/game-c/art/chips/${id.slice('chip/'.length)}.svg`);
    }
    // cardAssetUrl 仅解析 card/*·筹码不属其域 → 返 ''（消费端另接筹码 URL·不误命中牌面槽）。
    expect(cardAssetUrl('chip/25-green')).toBe('');
  });
});
