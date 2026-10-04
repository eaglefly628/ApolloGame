// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { validateLayoutNode, type LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { CAT_BREEDS, CAT_GALLERY, CATALOG_PAGE_SIZE, catalogPage, EMPTY_CATALOG_BROWSE, sourceOf } from './cat-gallery.js';
import { buildCatalog, buildScreen } from './ui.js';
import { HallSession } from './session.js';
import { routeAction } from './game112.js';
import { mount } from './game112.js';
import { MemorySavePort } from '@zerocraft/engine/services/save/index.js';

function walk(node: LayoutNode): LayoutNode[] {
  return [node, ...(node.children ?? []).flatMap(walk)];
}

describe('game112 Gallery 文字库 v1', () => {
  it('目录条目 ID 唯一、来源有文档、变体指向已存在的基础条目；没有提前生成图片', () => {
    expect(CAT_BREEDS.length).toBe(91);
    expect(new Set(CAT_BREEDS.map((b) => b.id)).size).toBe(CAT_BREEDS.length);
    expect(CAT_GALLERY.imageRecords).toEqual([]);
    for (const b of CAT_BREEDS) {
      expect(b.zh.trim(), b.id).not.toBe('');
      expect(b.en.trim(), b.id).not.toBe('');
      expect(CAT_GALLERY.sources[b.source], b.id).toMatch(/^https:\/\//);
      if (b.variantOf) expect(CAT_BREEDS.some((parent) => parent.id === b.variantOf && !parent.variantOf), b.id).toBe(true);
    }
    expect(CAT_BREEDS.filter((b) => b.nonPedigree).map((b) => b.id)).toEqual(['household-longhair', 'household-shorthair']);
  });

  it('年龄、体型、性别和外观轴独立存在；分页与双语搜索只查询文字记录', () => {
    expect(CAT_GALLERY.dimensions.ageStage).toContain('未记录');
    expect(CAT_GALLERY.dimensions.bodySize).toContain('未记录');
    expect(CAT_GALLERY.dimensions.sex).toContain('未记录');
    for (const entries of Object.values(CAT_GALLERY.dimensions.appearance)) expect(entries.length).toBeGreaterThan(1);
    expect(catalogPage(EMPTY_CATALOG_BROWSE)).toMatchObject({ total: 91, page: 0 });
    expect(catalogPage(EMPTY_CATALOG_BROWSE).entries).toHaveLength(CATALOG_PAGE_SIZE);
    expect(catalogPage({ query: '布偶', source: 'all', page: 0 }).entries.map((b) => b.id)).toEqual(['ragdoll']);
    expect(catalogPage({ query: 'ragdoll', source: 'all', page: 0 }).entries.map((b) => b.id)).toEqual(['ragdoll']);
    expect(catalogPage({ query: '', source: 'FIFe', page: 999 }).entries.length).toBeGreaterThan(0);
    expect(sourceOf('garbage')).toBeUndefined();
  });

  it('Gallery 是当前房间上的独立抽屉，画内有入口；闭集 UI 零 issue', () => {
    const drawer = buildCatalog();
    expect(validateLayoutNode(drawer)).toEqual([]);
    const scene = buildScreen({ screen: 'catalog', view: new HallSession(112).hall(), room: 'gallery' });
    expect(validateLayoutNode(scene)).toEqual([]);
    const ids = new Set(walk(scene).map((n) => n.id));
    expect(ids.has('catalog-drawer')).toBe(true);
    expect(ids.has('hall-stage')).toBe(true);
    expect(ids.has('hall-catalog')).toBe(true);
    expect(routeAction('catalog.open')).toEqual({ screen: 'catalog' });
  });

  it('真实宿主点击链：进馆 → 跳过登记 → 点击画内 Gallery → 抽屉可见', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('{"assets":[]}', { status: 200 });
    const stop = mount(host, undefined, { save: new MemorySavePort(), seed: 112, now: () => 1 });
    try {
      host.querySelector<HTMLElement>('#starter-act-0')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(host.querySelector('#reception-screen')).not.toBeNull();
      host.querySelector<HTMLElement>('#reception-skip')?.click();
      expect(host.querySelector('#hall-stage')).not.toBeNull();
      host.querySelector<HTMLElement>('#hall-catalog')?.click();
      expect(host.querySelector('#catalog-drawer')).not.toBeNull();
    } finally {
      stop();
      host.remove();
      globalThis.fetch = originalFetch;
    }
  });
});
