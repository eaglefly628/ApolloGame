import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { AssetLibrary } from './AssetLibrary.js';
import { AssetImportWizard } from './AssetImportWizard.js';
import { AssetGenPanel } from './AssetGenPanel.js';

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

describe('AssetGenPanel 渲染回归（美术库直达的 AI 生成入口）', () => {
  it('renderToString 不抛异常（两适配器 + prompt + 落点）', () => {
    const html = renderToString(<AssetGenPanel onClose={() => {}} onCommitted={() => {}} />);
    expect(html).toContain('AI 生成资产');
    expect(html).toContain('Tripo');
    expect(html).toContain('千问万相');
    expect(html).toContain('描述你要的资产');
    expect(html).toContain('生成并落库');
  });

  it('库工具栏挂出「AI 生成」按钮（从美术库可直达）', () => {
    const html = renderToString(<AssetLibrary onBack={() => {}} />);
    expect(html).toContain('AI 生成');
  });
});
