import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { mobileFrameUrl, MOBILE_FRAME_PARAM } from './preview.js';

function DesktopPhonePreview() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let frameWindow: Window | null = null;

    const syncParentRoute = () => {
      try {
        const hash = frameWindow?.location.hash;
        if (!hash?.startsWith('#/') || hash === window.location.hash) return;
        const url = new URL(window.location.href);
        url.hash = hash;
        window.history.replaceState(window.history.state, '', url);
      } catch { /* The preview must remain usable if its frame leaves this origin. */ }
    };
    const syncFrameRoute = () => {
      try {
        if (frameWindow && frameWindow.location.hash !== window.location.hash) {
          frameWindow.location.hash = window.location.hash || '#/home';
        }
      } catch { /* A cross-origin frame cannot be controlled by the preview. */ }
    };
    const frameLoaded = () => {
      frameWindow?.removeEventListener('hashchange', syncParentRoute);
      frameWindow = frame.contentWindow;
      if (!frameWindow) return;
      syncFrameRoute();
      frameWindow.addEventListener('hashchange', syncParentRoute);
    };

    frame.addEventListener('load', frameLoaded);
    window.addEventListener('hashchange', syncFrameRoute);
    window.addEventListener('popstate', syncFrameRoute);
    if (frame.contentDocument?.readyState === 'complete') frameLoaded();
    return () => {
      frame.removeEventListener('load', frameLoaded);
      window.removeEventListener('hashchange', syncFrameRoute);
      window.removeEventListener('popstate', syncFrameRoute);
      frameWindow?.removeEventListener('hashchange', syncParentRoute);
    };
  }, []);

  return <div className="g113-preview-host">
    <div className="g113-preview-stage">
      <div className="g113-phone-frame">
        <iframe ref={frameRef} title="雅趣：第二人生 手机版" src={mobileFrameUrl(window.location.href)}/>
      </div>
      <p>雅趣 · 第二人生｜手机版预览</p>
    </div>
  </div>;
}

function MobilePresentation({ onExit }: { onExit?: () => void }) {
  const isFrame = new URLSearchParams(window.location.search).get(MOBILE_FRAME_PARAM) === '1';
  const [isPhone, setIsPhone] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const changed = () => setIsPhone(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);

  if (isFrame || isPhone) return <App onExit={onExit}/>;

  return <DesktopPhonePreview/>;
}

export function mount(container: HTMLElement, host?: { exit: () => void }): () => void {
  const root = createRoot(container);
  root.render(<MobilePresentation onExit={host?.exit}/>);
  return () => root.unmount();
}
