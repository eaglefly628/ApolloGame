// Game C ·《六人德州 STORY-POKER V2》—— 本地美术索引对账（vendor 自 PD 货架 + 程序生成占位）：
// public/games/game-c/art/index.json 可 parseAssetIndex 校验 + registerAssetIndex 桥接成可加载资产
//（站点绝对路径 baseUrl ''）。
// owner 2026-07-22：**扑克牌移出美术台账**——52 牌面 + 牌背既不入 index.json 也不入 art-ledger.json，
//   PlayingCard 组件自绘牌面/牌背（vendored 全牌 SVG 自带角标叠组件角标=「双重」重影·且牌无美术修饰需求）。
//   故本索引只剩 ① 9 枚筹码（vendored·未来 3D/HUD 消费）② 28 条夜金 SVG 程序占位（scene/table/ui/fx/icons）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseAssetIndex, registerAssetIndex, AssetManager, StubAssetLoader } from '@zerocraft/engine/assets/index.js';

const RAW = JSON.parse(readFileSync('public/games/game-c/art/index.json', 'utf8'));

// 9 枚筹码面额（vendor 自共享库 chip/*·GDD 筹码色系·未来 3D/HUD 筹码消费）。
const CHIP_IDS = [
  'chip/1-white', 'chip/5-red', 'chip/10-blue', 'chip/25-green', 'chip/50-orange',
  'chip/100-black', 'chip/500-purple', 'chip/1000-yellow', 'chip/5000-gray',
] as const;

describe('Game C · 本地美术索引（筹码 vendor + 夜金程序占位·扑克牌已移出台账）', () => {
  // 索引 = 四类合流，分解式对账（别只改总数糊过去·REQ-C-116）：
  //   ① vendor 类 8 条：筹码 chip/*，自共享货架 copy·provenance.vendoredFrom === 自身 id；
  //   ② 程序生成类 28 条：夜金 SVG 占位（scene/table/ui/fx/icons），provenance.generator === art-gen 脚本；
  //   ③ owner 生成/上传类 6 条：工坊真图上传（scene/table/ui + gen/art-NN-up），provenance.generator === 'upload'；
  //   ④ AI 生成类 2 条（2026-08-19 owner 直传批 19a8ddd2 起）：chip/1-white 经工坊 Seedream 重皮
  //     （换肤槽机制正常工作·带完整 provenance+商用 license）+ 其生成件 gen/art-006 同源登记。
  // 四类各自计数 + 溯源字段独立断言，合计 44·全 filled·**无 card/***（扑克牌=引擎原语·不入账）·
  // **无 mock**（gen/mock/* 文件 gitignored·mock 永不入册·owner 2026-07-23 巡检清）。
  it('索引合法：44 条 = 8 vendor 筹码 + 28 程序生成 + 6 owner 上传 + 2 AI 生成·各带溯源·全 filled·无扑克牌·无 mock', () => {
    const idx = parseAssetIndex(RAW);
    const aiGen = idx.assets.filter((a) => a.provenance?.generator === 'seedream');
    const vendored = idx.assets.filter((a) => a.id.startsWith('chip/') && a.provenance?.generator !== 'seedream');
    const procedural = idx.assets.filter((a) => a.provenance?.generator === 'scripts/game-c-art-gen.mjs');
    const uploaded = idx.assets.filter((a) => a.provenance?.generator === 'upload');

    // —— 合计 + 四类计数（四类无缝覆盖全体·别只改总数糊过去） ——
    expect(idx.assets.length).toBe(44);
    expect(vendored.length).toBe(8);
    expect(procedural.length).toBe(28);
    expect(uploaded.length).toBe(6);
    expect(aiGen.length).toBe(2);
    expect(vendored.length + procedural.length + uploaded.length + aiGen.length).toBe(idx.assets.length);

    // —— 扑克牌已移出台账 + mock 永不入册 ——
    expect(idx.assets.filter((a) => a.id.startsWith('card/')).length).toBe(0);
    expect(idx.assets.filter((a) => a.provenance?.mock === true).length).toBe(0);

    // —— 全体 filled ——
    for (const a of idx.assets) expect(a.status).toBe('filled');

    // —— ① vendor 类：8 枚筹码·同 id 自货架 vendor ——
    for (const a of vendored) expect(a.provenance).toMatchObject({ vendoredFrom: a.id });

    // —— ② 程序生成类：夜金 SVG 占位·art-gen 脚本溯源（真图到位同 id 热替换） ——
    for (const a of procedural) expect(a.id.startsWith('card/') || a.id.startsWith('chip/')).toBe(false);

    // —— ③ owner 上传类：工坊真图·非 mock（真图上画面·mock 挡在册外） ——
    for (const a of uploaded) expect(a.provenance?.mock).not.toBe(true);

    // —— ④ AI 生成类：换肤/生成件必须带提示词溯源 + 授权 license（黑户判据②同口径） ——
    for (const a of aiGen) {
      expect(a.provenance?.prompt, `${a.id} 缺 prompt 溯源`).toBeTruthy();
      expect((a as { license?: string }).license, `${a.id} 缺 license`).toBeTruthy();
    }
  });

  it('registerAssetIndex 可桥接消费（站点绝对路径 baseUrl 空串·筹码 id 可加载）', () => {
    const idx = parseAssetIndex(RAW);
    const m = new AssetManager(new StubAssetLoader());
    registerAssetIndex(m, idx);
    expect(m.has('chip/1000-yellow')).toBe(true);
  });

  it('9 枚筹码资产各在本地索引（8 vendor 原皮 + 1-white Seedream 重皮·各按其源指路）', () => {
    const idx = parseAssetIndex(RAW);
    const byId = new Map(idx.assets.map((a) => [a.id, a]));
    for (const id of CHIP_IDS) {
      const entry = byId.get(id);
      expect(entry, `筹码 ${id} 应在本地索引`).toBeTruthy();
      if (entry!.provenance?.generator === 'seedream') {
        // 重皮筹码：路径指生成件·溯源在上一用例四类账里已独立断言
        expect((entry!.path ?? '').startsWith('/games/game-c/art/gen/')).toBe(true);
      } else {
        expect(entry!.path).toBe(`/games/game-c/art/chips/${id.slice('chip/'.length)}.svg`);
      }
    }
  });
});
