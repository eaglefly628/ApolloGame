import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import type { AssetManifest } from '@assets/index.js';
import { transformCapability, spriteCapability, frameCapability, textCapability } from '@atom-skills/index.js';
import { buildGameEBlueprint } from './blueprint.js';
import { jokerArtKey, JOKER_ART_MANIFEST } from './assets.js';
import { CARDS_SHEET_KEY, CARDS_SHEET_MANIFEST, cardIndexOf, COLS, ROWS } from './cards-atlas.js';
import type { Card as DataCard, Suit, Rank } from './deck.js';

// ════════════════════════════════════════════════════════════════════════
//  Game E · 桌面视图（纯数据：小丑排 + 出牌区 + 计分 HUD = Sprite/Text 实体）
//  「卡面布局是数据」（manifesto：手写 UI 消解为"实体+组件"）：每张小丑/牌/读数 = 一个实体，
//  挂 Transform + Sprite(小丑=单图 texture / 牌=cards sprite-sheet 第 N 帧) / Text。
//  通用 CanvasRenderer 据 collectRenderables 画；本文件不写任何渲染代码。
// ════════════════════════════════════════════════════════════════════════

export const VIEW_W = 960;
export const VIEW_H = 600;

const xf = (x: number, y: number) => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const sprite = (textureKey: string, zOrder: number) => ({ textureKey, anchorX: 0.5, anchorY: 0.5, zOrder });
const frame = (index: number) => ({ index, total: COLS * ROWS });
const text = (content: string, fontSize: number, zOrder = 50) => ({ content, fontSize, fontFamily: 'monospace', anchor: 'center', lineSpacing: 1.2, zOrder });

/** 小丑排：起手集中**有美术**的前 5 张，横排（每张 = 单图 texture，无需 frame）。 */
export const VIEW_JOKERS: readonly string[] = ['joker', 'jolly_joker', 'cavendish', 'the_duo', 'golden_joker'];

/** 出牌区示例手牌（黑桃皇家同花顺：跨左右两半验 UV）。 */
export const VIEW_HAND: readonly DataCard[] = [
  { suit: 'spades' as Suit, rank: '10' as Rank },
  { suit: 'spades' as Suit, rank: 'J' as Rank },
  { suit: 'spades' as Suit, rank: 'Q' as Rank },
  { suit: 'spades' as Suit, rank: 'K' as Rank },
  { suit: 'spades' as Suit, rank: 'A' as Rank },
];

/** 视图实体（仅表现：Transform+Sprite/Text）。与计分蓝图合并到同一 World。 */
export function buildViewEntities(): Record<string, EntityBlueprint> {
  const entities: Record<string, EntityBlueprint> = {};

  // 小丑排（顶部）：5 张横排，间距 165。
  VIEW_JOKERS.forEach((id, i) => {
    entities[`view_joker_${id}`] = {
      Transform: xf(140 + i * 165, 110),
      Sprite: sprite(jokerArtKey(id), 20),
    } as unknown as EntityBlueprint;
  });

  // 出牌区（中部）：5 张牌横排，cards sprite-sheet 第 cardIndexOf 帧。
  VIEW_HAND.forEach((c, i) => {
    entities[`view_card_${i}`] = {
      Transform: xf(220 + i * 110, 350),
      Sprite: sprite(CARDS_SHEET_KEY, 30),
      Frame: frame(cardIndexOf(c)),
    } as unknown as EntityBlueprint;
  });

  // 计分 HUD（底部）：标签 + 读数位（真值由渲染/预览读 Resource 填）。
  entities['view_hud_label'] = { Transform: xf(VIEW_W / 2, 500), Text: text('CHIPS  ×  MULT  =  SCORE', 22, 50) } as unknown as EntityBlueprint;
  entities['view_hud_jokers'] = { Transform: xf(VIEW_W / 2, 60), Text: text('— JOKERS —', 18, 50) } as unknown as EntityBlueprint;
  entities['view_hud_hand'] = { Transform: xf(VIEW_W / 2, 290), Text: text('— PLAYED HAND —', 18, 50) } as unknown as EntityBlueprint;

  return entities;
}

/** 用到的资产清单（小丑单图 + cards sprite-sheet）。 */
export const GAME_E_VIEW_ASSETS: AssetManifest = [...JOKER_ART_MANIFEST, ...CARDS_SHEET_MANIFEST];

/** 计分蓝图 + 视图实体 + 视觉原子能力 → 一份可渲染的完整 World。 */
export function buildGameEView(): WorldBlueprint {
  const base = buildGameEBlueprint();
  return {
    capabilities: [...base.capabilities, transformCapability, spriteCapability, frameCapability, textCapability],
    entities: { ...base.entities, ...buildViewEntities() },
  };
}
