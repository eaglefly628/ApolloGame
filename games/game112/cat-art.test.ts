import { describe, expect, it } from 'vitest';
import { catArt, mapSkin, sceneSkin, setSkinOverrides } from './cat-art.js';

describe('game112 主厅皮肤槽', () => {
  it('本地美术索引注入主厅与馆图真图，清空时回退', () => {
    setSkinOverrides({
      'game112/scene/hall': '/games/game112/art/scene/star-tail-main-hall-bg-v2.png',
      'game112/map/hall': '/games/game112/art/map.png',
      'game112/cat/xuetuan-rest': '/games/game112/art/cat/xuetuan-rest-v1.png',
      'game112/cat/xuetuan-notice': '/games/game112/art/cat/xuetuan-notice-v1.png',
      'game112/cat/xuetuan-walk': '/games/game112/art/cat/xuetuan-walk-right-v2.png',
      'game112/cat/xuetuan-walk-left': '/games/game112/art/cat/xuetuan-walk-left-v2.png',
      'game112/cat/xuetuan-turn': '/games/game112/art/cat/xuetuan-turn-v2.png',
    });
    expect(sceneSkin('hall')).toBe('/games/game112/art/scene/star-tail-main-hall-bg-v2.png');
    expect(mapSkin()).toBe('/games/game112/art/map.png');
    expect(catArt('xuetuan', 'rest')).toBe('/games/game112/art/cat/xuetuan-rest-v1.png');
    expect(catArt('xuetuan', 'notice')).toBe('/games/game112/art/cat/xuetuan-notice-v1.png');
    expect(catArt('xuetuan', 'walk')).toBe('/games/game112/art/cat/xuetuan-walk-right-v2.png');
    expect(catArt('xuetuan', 'walk-left')).toBe('/games/game112/art/cat/xuetuan-walk-left-v2.png');
    expect(catArt('xuetuan', 'turn')).toBe('/games/game112/art/cat/xuetuan-turn-v2.png');
    setSkinOverrides({});
    expect(sceneSkin('hall')).toBeUndefined();
    expect(mapSkin()).toBeUndefined();
  });
});
