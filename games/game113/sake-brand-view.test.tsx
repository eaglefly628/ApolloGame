// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SakeBrandView } from './sake-brand-view.js';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('sake brand atlas', () => {
  it('shows the full catalogue, opens one brand, and keeps a local personal shelf', async () => {
    await act(async () => root.render(<SakeBrandView/>));
    expect(host.querySelectorAll('.g113-brand-atlas-row')).toHaveLength(28);
    expect(host.querySelector('.g113-brand-atlas-detail article')).toBeNull();

    const jikon = [...host.querySelectorAll<HTMLButtonElement>('.g113-brand-atlas-open')].find((button) => button.textContent?.includes('而今'))!;
    await act(async () => jikon.click());
    expect(host.querySelector('.g113-brand-atlas-detail h3')?.textContent).toContain('而今');
    expect(host.textContent).toContain('木屋正酒造');

    await act(async () => (host.querySelector('.g113-brand-atlas-detail-foot button') as HTMLButtonElement).click());
    expect(JSON.parse(window.localStorage.getItem('game113-sake-brand-shelf-v1')!)).toEqual(['jikon']);
    await act(async () => (host.querySelector('.g113-brand-atlas-tools>button') as HTMLButtonElement).click());
    expect(host.querySelectorAll('.g113-brand-atlas-row')).toHaveLength(1);

    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(<SakeBrandView/>));
    expect(host.textContent).toContain('我的品牌书架 1');
  });
});
