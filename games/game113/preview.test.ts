import { describe, expect, it } from 'vitest';
import { mobileFrameUrl } from './preview.js';

describe('game113 mobile preview URL', () => {
  it('keeps the current page and existing launch parameters', () => {
    const url = new URL(mobileFrameUrl('http://localhost:5175/?game=game113#/community'));
    expect(url.searchParams.get('game')).toBe('game113');
    expect(url.searchParams.get('g113MobileFrame')).toBe('1');
    expect(url.hash).toBe('#/community');
  });

  it('sets the preview flag once', () => {
    const url = new URL(mobileFrameUrl('http://localhost:5175/?game=game113&g113MobileFrame=1#/item/watch-01'));
    expect(url.searchParams.getAll('g113MobileFrame')).toEqual(['1']);
    expect(url.hash).toBe('#/item/watch-01');
  });
});
