// game-q 美术工坊（重设计版数据透视器）渲染回归：初始态不抛（renderToString 不跑 useEffect→
// 不 mount ThreeRenderer/不 fetch）。守护「加载game-q场景 + 按类型列需求」骨架不白屏。
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { GameQArtCockpit } from './GameQArtCockpit.js';

describe('GameQArtCockpit 渲染回归', () => {
  it('renderToString 不抛异常（渲染窗 + 按类型需求面）', () => {
    const html = renderToString(<GameQArtCockpit onBack={() => {}} />);
    expect(html).toContain('game-q 美术工坊');
    expect(html).toContain('游戏场景'); // 活渲染窗
    expect(html).toContain('需要的美术资源'); // 按类型的需求面
    expect(html).toContain('标杆');
  });
});
