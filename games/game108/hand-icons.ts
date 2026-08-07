// game108 手型图标 —— 设计定稿随件交付的三张透明 PNG（`design/hands/`）。
//
// 落点：`public/games/game108/art/`，并在 `art-ledger.json` 逐张记账（无账 = 黑户，推送门会拦）。
// 来源写在台账 `provenance` 里：稿子 README「Assets · Shipped in this bundle」写明这三张
// cut from the owner's own reference art —— 即 owner 自有素材，非第三方商业美术。
//
// 稿子三处复用同一张图：招式卡 96×104 · 我方蓄力槽 56×62 · 对手蓄力条 28×34。
import type { Hand } from './theme.js';

/** 站点路径（`public/` 即站点根）。将来接 `resolveAsset` 时只改这一处。 */
export const HAND_ICON_SRC: Record<Hand, string> = {
  rock: '/games/game108/art/icon_rock.png',
  paper: '/games/game108/art/icon_paper.png',
  scissors: '/games/game108/art/icon_scissors.png',
};
