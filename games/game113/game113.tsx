import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';

export function mount(container: HTMLElement, host?: { exit: () => void }): () => void {
  const root = createRoot(container);
  root.render(<App onExit={host?.exit}/>);
  return () => root.unmount();
}
