// Game C ·《六人德州 STORY-POKER V2》—— 本地美术索引对账（vendor 自 PD 货架 + 程序生成占位）：
// public/games/game-c/art/index.json 可 parseAssetIndex 校验 + registerAssetIndex 桥接成可加载资产
//（站点绝对路径 baseUrl ''）。
// owner 2026-07-22：**扑克牌移出美术台账**——52 牌面 + 牌背既不入 index.json 也不入 art-ledger.json，
//   PlayingCard 组件自绘牌面/牌背（vendored 全牌 SVG 自带角标叠组件角标=「双重」重影·且牌无美术修饰需求）。
//   故本索引只剩 ① 9 枚筹码（vendored·未来 3D/HUD 消费）② 28 条夜金 SVG 程序占位（scene/table/ui/fx/icons）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseAssetIndex, registerAssetIndex, AssetManager, StubAssetLoader } from '@assets/index.js';

const RAW = JSON.parse(readFileSync('public/games/game-c/art/index.json', 'utf8'));

// 9 枚筹码面额（vendor 自共享库 chip/*·GDD 筹码色系·未来 3D/HUD 筹码消费）。
const CHIP_IDS = [
  'chip/1-white', 'chip/5-red', 'chip/10-blue', 'chip/25-green', 'chip/50-orange',
  'chip/100-black', 'chip/500-purple', 'chip/1000-yellow', 'chip/5000-gray',
] as const;

describe('Game C · 本地美术索引（筹码 vendor + 夜金程序占位·扑克牌已移出台账）', () => {
  // 索引 = 两类合流，分解式对账（别只改总数糊过去）：
  //   ① vendor 类 9 条：筹码 chip/*，自共享货架 copy·provenance.vendoredFrom === 自身 id；
  //   ② 程序生成类 28 条：夜金 SVG 占位（scene/table/ui/fx/icons），provenance.generator === art-gen 脚本。
  // 两类各自计数 + 溯源字段独立断言，合计 37·全 filled。**无 card/* 条目**（扑克牌=引擎原语·不入账）。
  it('索引合法：37 条 = 9 vendor 筹码（vendoredFrom 溯源）+ 28 程序生成（generator 溯源）·全 filled·无扑克牌', () => {
    const idx = parseAssetIndex(RAW);
    const vendored = idx.assets.filter((a) => a.id.startsWith('chip/'));
    const procedural = idx.assets.filter((a) => !a.id.startsWith('chip/'));

    // —— 合计 + 两类计数 ——
    expect(idx.assets.length).toBe(37);
    expect(vendored.length).toBe(9);
    expect(procedural.length).toBe(28);

    // —— 扑克牌已移出台账：索引里零 card/* 条目 ——
    expect(idx.assets.filter((a) => a.id.startsWith('card/')).length).toBe(0);

    // —— ① vendor 类：9 枚筹码·同 id 自货架 vendor ——
    for (const a of vendored) {
      expect(a.status).toBe('filled');
      expect(a.provenance).toMatchObject({ vendoredFrom: a.id });
    }

    // —— ② 程序生成类：夜金 SVG 占位·art-gen 脚本溯源（真图到位同 id 热替换） ——
    for (const a of procedural) {
      expect(a.status).toBe('filled');
      expect(a.provenance).toMatchObject({ generator: 'scripts/game-c-art-gen.mjs' });
      expect(a.id.startsWith('card/') || a.id.startsWith('chip/')).toBe(false);
    }
  });

  it('registerAssetIndex 可桥接消费（站点绝对路径 baseUrl 空串·筹码 id 可加载）', () => {
    const idx = parseAssetIndex(RAW);
    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx);
    expect(m.has('chip/1000-yellow')).toBe(true);
  });

  it('9 枚筹码资产各在本地索引（未来筹码贴图消费·vendor 溯源一致）', () => {
    const idx = parseAssetIndex(RAW);
    const byId = new Map(idx.assets.map((a) => [a.id, a]));
    for (const id of CHIP_IDS) {
      const entry = byId.get(id);
      expect(entry, `筹码 ${id} 应在本地索引`).toBeTruthy();
      expect(entry!.path).toBe(`/games/game-c/art/chips/${id.slice('chip/'.length)}.svg`);
    }
  });
});
