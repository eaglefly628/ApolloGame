// Game C ·《缝纫物语》(Stitch & Style) —— 女孩换装三消 + 缝纫店养成 + 爱诗(AIGP)展示。
// 负责人：PC（Game Creator）。本目录是「游戏数据沙盒」：只装配现成引擎能力 + 内容数据，
// 不写游戏专属系统。引擎缺口（三消棋盘等）走 docs/workflow/requests.md 提需求。
export { buildGameCBlueprint, GIRL_ENTITY, MATERIAL_IDS } from './blueprint.js';
export {
  MATERIALS,
  GARMENTS,
  COIN_ID,
  COIN_NAME,
  BASE_LOOK,
  LOOK_FSM,
  LOOK_PROMPTS,
  AWARD_PER_TILE,
  COIN_PER_TILE,
  garmentFlagId,
  garmentSignal,
  composeAishePrompt,
} from './theme.js';
export type { Material, Garment } from './theme.js';
