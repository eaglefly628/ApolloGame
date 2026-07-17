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
  it('索引合法：55 条（52+双王+牌背）·全 filled·携 vendoredFrom 溯源', () => {
    const idx = parseAssetIndex(RAW);
    expect(idx.assets.length).toBe(55);
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
