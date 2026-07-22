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
  // 索引 = 两类合流，分解式对账（REQ-C-111·别只改总数糊过去）：
  //   ① vendor 类 62 条：52 牌 + 牌背 + 9 筹码，均自共享货架 copy·provenance.vendoredFrom === 自身 id；
  //   ② 程序生成类 28 条：夜金 SVG 占位（scene/table/ui/fx/icons），provenance.generator === art-gen 脚本。
  // 两类各自计数 + 溯源字段独立断言，合计 90·全 filled。
  it('索引合法：90 条 = 62 vendor（53 牌 + 9 筹码·vendoredFrom 溯源）+ 28 程序生成（generator 溯源）·全 filled', () => {
    const idx = parseAssetIndex(RAW);
    const isVendor = (id: string) => id.startsWith('card/') || id.startsWith('chip/');
    const vendored = idx.assets.filter((a) => isVendor(a.id));
    const procedural = idx.assets.filter((a) => !isVendor(a.id));

    // —— 合计 + 两类计数 ——
    expect(idx.assets.length).toBe(90);
    expect(vendored.length).toBe(62);
    expect(procedural.length).toBe(28);

    // —— ① vendor 类：52 牌 + 牌背 + 9 筹码 ——
    const cards = vendored.filter((a) => a.id.startsWith('card/'));
    const chips = vendored.filter((a) => a.id.startsWith('chip/'));
    expect(cards.length).toBe(53); // 52 + 牌背
    expect(chips.length).toBe(9);
    for (const a of vendored) {
      expect(a.status).toBe('filled');
      expect(a.provenance).toMatchObject({ vendoredFrom: a.id }); // 同 id 自货架 vendor（copy 不直引）
    }

    // —— ② 程序生成类：夜金 SVG 占位·art-gen 脚本溯源（真图到位同 id 热替换） ——
    for (const a of procedural) {
      expect(a.status).toBe('filled');
      expect(a.provenance).toMatchObject({ generator: 'scripts/game-c-art-gen.mjs' });
      expect(a.id.startsWith('card/') || a.id.startsWith('chip/')).toBe(false);
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
