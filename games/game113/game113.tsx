import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { mobileFrameUrl, MOBILE_FRAME_PARAM } from './preview.js';

function AppWithViewSwitch({ onExit }: { onExit?: () => void }) {
  const [mobile, setMobile] = useState(false);
  const [frameUrl, setFrameUrl] = useState('');
  const frameRef = useRef<HTMLIFrameElement>(null);

  const showMobile = () => {
    setFrameUrl(mobileFrameUrl(window.location.href));
    setMobile(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const showWeb = () => {
    try {
      const frameHash = frameRef.current?.contentWindow?.location.hash;
      if (frameHash?.startsWith('#/')) window.location.hash = frameHash;
    } catch { /* Preview remains usable even if the frame URL was changed externally. */ }
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return <div className={`g113-preview-host ${mobile ? 'g113-preview-host--mobile' : ''}`}>
    <div className="g113-view-switch" aria-label="页面预览方式">
      <div><b>雅趣 · 第二人生</b><span>{mobile ? '手机版预览 · 可在手机画面里继续浏览' : '网页版预览 · 也可以看看手机版'}</span></div>
      <button type="button" onClick={mobile ? showWeb : showMobile} aria-label={mobile ? '返回网页版' : '切换手机版'}>{mobile ? '返回网页版' : '切换手机版'} <span aria-hidden="true">{mobile ? '▣' : '▯'}</span></button>
    </div>
    {mobile ? <div className="g113-preview-stage"><div className="g113-phone-frame"><iframe ref={frameRef} title="雅趣：第二人生 手机版预览" src={frameUrl}/></div><p>手机宽度预览 · 内容和操作与真实手机布局一致</p></div> : <App onExit={onExit}/>}
  </div>;
}

export function mount(container: HTMLElement, host?: { exit: () => void }): () => void {
  const root = createRoot(container);
  const insidePreviewFrame = new URLSearchParams(window.location.search).get(MOBILE_FRAME_PARAM) === '1';
  root.render(insidePreviewFrame ? <App/> : <AppWithViewSwitch onExit={host?.exit}/>);
  return () => root.unmount();
}
