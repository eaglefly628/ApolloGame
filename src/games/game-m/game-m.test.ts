// Game M（内置纯数据换装·暖暖式）·manifest 级走查：穿脱重算属性 → 星级横幅亮/灭 → 确定性。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseManifest } from '../../assembly/manifest.js';
import { World } from '@engine/core/world.js';
import type { Resource, InputQueue, Transform, Visibility, Sprite } from '@engine/protocol/components.js';

const raw = JSON.parse(readFileSync(join(__dirname, '../../../public/games/game-m/manifest.json'), 'utf8'));

function build(): World {
  const bp = parseManifest(raw) as { capabilities: Array<{ systems: unknown[] }>; entities: Record<string, Record<string, object>> };
  const w = new World();
  for (const cap of bp.capabilities) for (const s of cap.systems) w.addSystem(s as never);
  for (const [id, comps] of Object.entries(bp.entities)) {
    w.createEntity(id);
    for (const [cname, cdata] of Object.entries(comps)) w.addComponent(id, { type: cname, ...(JSON.parse(JSON.stringify(cdata)) as object) } as never);
  }
  w.createEntity('input');
  w.addComponent('input', { type: 'InputQueue', actions: [] } as InputQueue);
  return w;
}
function play(): { t0: number[]; afterDress: number[]; afterHair: [number, number, boolean]; afterBack: boolean; wornSkin: string } {
  const w = build();
  const click = (eid: string): void => {
    const t = w.getComponent<Transform>(eid, 'Transform')!;
    w.addComponent('input', { type: 'InputQueue', actions: [{ source: 'pointer', x: t.x, y: t.y, phase: 'down' }] } as InputQueue);
    w.tick();
    w.addComponent('input', { type: 'InputQueue', actions: [] } as InputQueue);
    for (let i = 0; i < 6; i++) w.tick();
  };
  const res = (id: string): number => { for (const [e] of w.query('Resource')) { const r = w.getComponent<Resource>(e, 'Resource')!; if (r.id === id) return r.current; } return -1; };
  const star = (): boolean => w.getComponent<Visibility>('banner-star', 'Visibility')!.visible;
  for (let i = 0; i < 6; i++) w.tick();
  const t0 = [res('elegance'), res('lively'), res('sweet')];
  click('thumb-d1'); // 酒红晚礼服：优雅+4·脱水手裙
  const afterDress = [res('elegance'), res('lively'), res('sweet')];
  click('thumb-h2'); // 粉双马尾：甜美+3 → 优雅4/甜美5 达标
  const afterHair: [number, number, boolean] = [res('elegance'), res('sweet'), star()];
  let wornSkin = '';
  for (const [eid] of w.query('Sprite', 'Tag')) {
    const sp = w.getComponent<Sprite>(eid, 'Sprite')!;
    if (sp.textureKey.startsWith('gen/')) wornSkin = sp.textureKey;
  }
  click('thumb-h0'); // 换回金卷发 → 失标
  return { t0, afterDress, afterHair, afterBack: star(), wornSkin };
}

describe('game-m Wardrobe Voyage（manifest 走查）', () => {
  it('manifest 解析零 error·prefab 模板内美术引用也已钉死', () => {
    const bp = parseManifest(raw) as { errors?: unknown[] };
    expect(bp.errors ?? []).toHaveLength(0);
    expect(JSON.stringify(raw)).not.toContain('"art:');
  });
  it('穿脱=实体生灭·属性=群计数重算·主题达标星亮/失标星灭·上身新衣带钉死资产', () => {
    const r = play();
    expect(r.t0).toEqual([2, 2, 5]); // 默认穿搭
    expect(r.afterDress).toEqual([6, 0, 3]); // 晚礼服替水手裙
    expect(r.afterHair).toEqual([4, 5, true]); // 达标（优雅≥4 且 甜美≥4）
    expect(r.afterBack).toBe(false); // 失标即灭
    expect(r.wornSkin).toMatch(/^gen\//); // prefab 皮肤闭环
  });
  it('确定性：双跑一致', () => {
    expect(play()).toEqual(play());
  });
});
