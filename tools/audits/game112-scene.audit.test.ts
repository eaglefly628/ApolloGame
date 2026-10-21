// @vitest-environment happy-dom
// PUI proof: the audit fixture consumes the same visibleWhen projection as the game host.
import { describe, expect, it, vi } from 'vitest';
import { mountUI, type LayoutNode } from '../../src/ui/components/index.js';
import { HallSession } from '../../games/game112/session.js';
import { buildScene } from '../../games/game112/ui.js';
import { STAGE_HIDE_KEY, STAGE_SHOW_KEY } from '../../games/game112/world-data.js';
import { buildGame112SceneAudit } from './game112-scene.audit.js';

vi.mock('../../src/ui/components/index.js', async original => ({ ...(await original<object>()), mountUI: vi.fn() }));
const ids = (node: LayoutNode): string[] => [node.id, ...(node.children ?? []).flatMap(ids)];

describe('Game112 scene audit is the actual world-projected UI, not mutually-exclusive raw controls', () => {
  it('raw builder includes both exclusive controls; the fixture actually mounted only ordinary mode', () => {
    const raw = ids(buildScene(new HallSession(112).hall(), 'hall'));
    expect(raw).toContain('hall-cat-caption'); expect(raw).toContain('hall-stage-show');
    expect(mountUI).toHaveBeenCalledTimes(1);
    const actual = ids(vi.mocked(mountUI).mock.calls[0]![1]);
    expect(actual).toContain('hall-cat-caption'); expect(actual).not.toContain('hall-stage-show');
  });
  it('real ui.hide/show actions change the fixture projection; caption/show never coexist and projection does not mutate world', () => {
    const session = new HallSession(112);
    const check = (immersive: boolean): void => {
      const before = session.hash();
      const tree = ids(buildGame112SceneAudit(session));
      expect(tree.includes('hall-cat-caption')).toBe(!immersive);
      expect(tree.includes('hall-stage-show')).toBe(immersive);
      expect(session.hash()).toBe(before);
    };
    check(false); session.act(STAGE_HIDE_KEY); check(true); session.act(STAGE_SHOW_KEY); check(false);
  });
});
