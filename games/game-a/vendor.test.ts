// Game A ·《掼蛋夜宴》—— 本地美术索引对账（vendor 自 PD 货架·ui-scene-design §5.1 接法铁律）：
// public/games/game-a/art/index.json 可 parseAssetIndex 校验 + registerAssetIndex 桥接成可加载资产
//（站点绝对路径 baseUrl ''·携 vendoredFrom 溯源）；并逐张对账「牌码 → 资产 id/URL 映射」与索引一致——
// 两副 108 张=同 54 素材引两次（§5.1）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseAssetIndex, registerAssetIndex, AssetManager, StubAssetLoader } from '@assets/index.js';
import { buildDeck108 } from './rules.js';
import { cardAssetId, cardAssetUrl, CARD_BACK_ID } from './theme.js';

const RAW = JSON.parse(readFileSync('public/games/game-a/art/index.json', 'utf8'));

describe('Game A · 本地牌资产库（PD vendor·§5.1）', () => {
  // 分解式对账（别只改总数糊过去·A-025）：① 55 vendor 牌资产（52+双王+牌背·vendoredFrom===自身 id）
  //   + ② owner 生成美术 2 条（工坊真调 seedream·gen/art-02 + game-a/bg/table 桌背 skinKey·generator 溯源）。
  //   合计 57·全 filled·**无 mock**（gen/mock/* gitignored·mock 永不入册·owner 2026-07-23 巡检清）。
  it('索引合法：57 条 = 55 vendor 牌资产（vendoredFrom 溯源）+ 2 owner 生成美术（generator 溯源）·全 filled·无 mock', () => {
    const idx = parseAssetIndex(RAW);
    const vendored = idx.assets.filter((a) => a.provenance?.vendoredFrom === a.id);
    const generated = idx.assets.filter((a) => a.provenance?.vendoredFrom !== a.id);

    expect(idx.assets.length).toBe(57);
    expect(vendored.length).toBe(55);
    expect(generated.length).toBe(2);
    expect(idx.assets.filter((a) => a.provenance?.mock === true).length).toBe(0);

    for (const a of idx.assets) expect(a.status).toBe('filled');
    // ① vendor 牌资产：同 id 自货架 vendor（copy 不直引）
    for (const a of vendored) expect(a.provenance).toMatchObject({ vendoredFrom: a.id });
    // ② owner 生成美术：真图（非 mock）·带 generator 溯源
    for (const a of generated) {
      expect(a.provenance?.mock).not.toBe(true);
      expect(typeof a.provenance?.generator).toBe('string');
    }
  });

  it('registerAssetIndex 可桥接消费（站点绝对路径 baseUrl 空串）', () => {
    const idx = parseAssetIndex(RAW);
    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx);
    expect(m.has(CARD_BACK_ID)).toBe(true);
  });

  it('牌码 → 资产 id/URL 全量对账：108 张牌码各有其索引条目·URL 与索引 path 一致', () => {
    const idx = parseAssetIndex(RAW);
    const byId = new Map(idx.assets.map((a) => [a.id, a]));
    const seen = new Set<string>();
    for (const code of buildDeck108()) {
      const id = cardAssetId(code);
      seen.add(id);
      const entry = byId.get(id);
      expect(entry, `牌码 ${code} → ${id} 应在本地索引`).toBeTruthy();
      expect(cardAssetUrl(id)).toBe(entry!.path);
    }
    expect(seen.size).toBe(54); // 两副去重后恰 54 素材
    expect(byId.get(CARD_BACK_ID)?.path).toBe(cardAssetUrl(CARD_BACK_ID));
  });
});
