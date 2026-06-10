import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { AssetLibrary } from './AssetLibrary.js';
import { AssetImportWizard } from './AssetImportWizard.js';

// renderToString 不跑 useEffect（不 fetch/不碰 canvas）→ 渲染初始态，专抓导入/渲染期崩溃（白屏教训）。
describe('AssetLibrary 渲染回归', () => {
  it('renderToString 不抛异常（三栏初始态）', () => {
    const html = renderToString(<AssetLibrary onBack={() => {}} />);
    expect(html).toContain('资源库');
    expect(html).toContain('导入资产');
    expect(html).toContain('来源');
  });

  it('目录树常驻全部七类（空类型也建目录）', () => {
    const html = renderToString(<AssetLibrary onBack={() => {}} />);
    for (const label of ['贴图', '音频', '动画', '视频', '材质', '网格', '字体']) {
      expect(html).toContain(label);
    }
  });
});

describe('AssetImportWizard 渲染回归', () => {
  it('renderToString 不抛异常（步骤① 拖放区）', () => {
    const html = renderToString(
      <AssetImportWizard existingIds={new Set()} onClose={() => {}} onCommitted={() => {}} />,
    );
    expect(html).toContain('放入文件');
    expect(html).toContain('拖到这里');
  });
});
