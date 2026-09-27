import { describe, expect, it } from 'vitest';
import { sceneSkin, setSkinOverrides } from './cat-art.js';

describe('game112 主厅皮肤槽', () => {
  it('本地美术索引注入主厅真图，清空时回退', () => {
    setSkinOverrides({ 'game112/scene/hall': '/games/game112/art/scene/star-tail-main-hall-bg-v2.png' });
    expect(sceneSkin('hall')).toBe('/games/game112/art/scene/star-tail-main-hall-bg-v2.png');
    setSkinOverrides({});
    expect(sceneSkin('hall')).toBeUndefined();
  });
});
