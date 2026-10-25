// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { TouchInputSource } from './touch-input.js';
it('leases and restores only its own touch-action override, including priority and empty style', () => {
  const target = document.createElement('div'); target.style.setProperty('touch-action', 'pan-x', 'important');
  const source = new TouchInputSource('p', target, { mode: 'drag' }, window);
  expect(target.style.getPropertyValue('touch-action')).toBe('none'); source.dispose(); source.dispose();
  expect(target.style.getPropertyValue('touch-action')).toBe('pan-x'); expect(target.style.getPropertyPriority('touch-action')).toBe('important');
  const changed = new TouchInputSource('p', target, { mode: 'drag' }, window); target.style.setProperty('touch-action', 'pan-y'); changed.dispose();
  expect(target.style.getPropertyValue('touch-action')).toBe('pan-y');
  const empty = document.createElement('div'); const clean = new TouchInputSource('p', empty, { mode: 'drag' }, window); clean.dispose();
  expect(empty.style.getPropertyValue('touch-action')).toBe('');
});
