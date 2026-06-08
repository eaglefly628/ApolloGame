import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { ArtLibBrowser } from './ArtLibBrowser.js';

// renderToString 不跑 useEffect（不 fetch）→ 渲染加载态，专抓导入/渲染期崩溃（白屏教训）。
describe('ArtLibBrowser 渲染回归', () => {
  it('renderToString 不抛异常（加载态）', () => {
    const html = renderToString(<ArtLibBrowser onBack={() => {}} />);
    expect(html).toContain('美术库');
  });
});
