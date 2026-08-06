// 游戏美术资料库的磁盘根（JS 侧单一真相·REQ-CARTART 2026-08-06）。
// Python 侧同源实现 = `main_entry/paths.py::art_root`——两边规则必须一字不差，否则
// 「上传写 A·生成写 B」= split-brain。改一边必须同步改另一边（冒烟 scripts/cartridge-art-smoke.py 卡住这条）。
//
//   · 创作台卡带（`library/<slug>/` 存在）→ `library/<slug>/art`：随卡带自己的 git 仓版本化，不入引擎仓。
//   · 内置游戏 → `public/games/<slug>/art`：tracked 出货内容，照旧。
//
// URL 契约 `/games/<slug>/art/**` 两者共用——引擎侧只认 URL，存储在哪由伺服层回退决定，
// 故台账/索引里的 servedPath 一字不用改。
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** 该游戏美术资料库的磁盘根（卡带 → library/<slug>/art·内置 → public/games/<slug>/art）。 */
export function artRoot(root, slug) {
  if (existsSync(join(root, 'library', slug))) return join(root, 'library', slug, 'art');
  return join(root, 'public', 'games', slug, 'art');
}

/** 该 slug 是不是创作台卡带（= 美术落 library 侧·不入引擎仓）。 */
export function isCartridge(root, slug) {
  return existsSync(join(root, 'library', slug));
}
