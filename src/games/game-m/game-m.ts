// Game M · Wardrobe Voyage —— 内置纯数据换装（暖暖式）（游戏本体=public/games/game-m/manifest.json·零游戏层玩法代码）。
// 宿主=通用 mountManifestGame（services）·美术=美术平台 library 线（台账 public/games/game-m/art/）。
import { mountManifestGame } from '../../services/manifest-game.js';

export const mount = mountManifestGame('game-m');
