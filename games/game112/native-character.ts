// Presentation data only. The shared UI owns HTTP, WebGL and lifecycle.
import { parseAssetIndex } from '@zerocraft/engine/assets/index.js';
import localIndex from '../../public/games/game112/art/index.json';

export const XUETUAN_NATIVE_KEY = 'game112/character/xuetuan-native-v2';
export const GAME112_NATIVE_CHARACTERS = {
  index: parseAssetIndex(localIndex),
  baseUrl: '/',
  runtimeUrl: '/native-character/index.html',
  timeoutMs: 30000,
};
