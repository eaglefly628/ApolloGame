// TA Phase 2：动态 point/spot 局部光（预算 cap + 可移动 + 池清理）。three Scene/Light 为纯 JS·无需 GL。
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { LightRig } from './lights.js';
import { World } from '@engine/core/world.js';
import { getLights3D } from '@engine/protocol/camera-view.js';
import type { Light3D, Transform } from '@engine/protocol/components.js';

const pointCount = (s: THREE.Scene): number => s.children.filter((c) => c instanceof THREE.PointLight).length;
const point = (i: number, extra: Partial<Light3D>): Light3D => ({ type: 'Light3D', kind: 'point', color: 0xffffff, intensity: 50, range: 20, ...extra }) as Light3D;

describe('LightRig · 动态局部光（TA Phase 2）', () => {
  it('预算 cap：摆 6 盏 point → 只生效 4 盏（MAX_DYNAMIC=4）', () => {
    const scene = new THREE.Scene();
    const rig = new LightRig(scene);
    const w = new World();
    for (let i = 0; i < 6; i++) { w.createEntity(`p${i}`); w.addComponent(`p${i}`, point(i, { x: i, y: 5, z: 0 })); }
    rig.sync(scene, getLights3D(w), w);
    expect(pointCount(scene)).toBe(4); // 第 5/6 盏被预算丢弃
  });

  it('可移动：挂带 Transform 的实体 → 光读其 2D Transform(x→X,y→Z)+baseY，实体移动则光随之走', () => {
    const scene = new THREE.Scene();
    const rig = new LightRig(scene);
    const w = new World();
    w.createEntity('mover');
    w.addComponent('mover', { type: 'Transform', x: 10, y: -4, rotation: 0, scaleX: 1, scaleY: 1 } as Transform);
    w.addComponent('mover', point(0, { baseY: 6 })); // 无显式 xyz → 读 Transform
    rig.sync(scene, getLights3D(w), w);
    let l = scene.children.find((c) => c instanceof THREE.PointLight) as THREE.PointLight;
    expect([l.position.x, l.position.y, l.position.z]).toEqual([10, 6, -4]); // x→X, baseY→Y, y→Z
    // 移动实体 → 再 sync → 光跟随。
    w.getComponent<Transform>('mover', 'Transform')!.x = 25;
    rig.sync(scene, getLights3D(w), w);
    l = scene.children.find((c) => c instanceof THREE.PointLight) as THREE.PointLight;
    expect(l.position.x).toBe(25);
  });

  it('局部光阴影（REQ-3D-LOCAL-SHADOW）：spot castShadow → 灯投影·阴影视锥远面=range', () => {
    const scene = new THREE.Scene();
    const rig = new LightRig(scene);
    const w = new World();
    w.createEntity('s');
    w.addComponent<Light3D>('s', { type: 'Light3D', kind: 'spot', color: 0xffffff, intensity: 800, range: 55, angle: 0.6, castShadow: true, x: 0, y: 20, z: 0, dirY: -1 } as Light3D);
    rig.sync(scene, getLights3D(w), w);
    const s = scene.children.find((c) => c instanceof THREE.SpotLight) as THREE.SpotLight;
    expect(s.castShadow).toBe(true);
    expect(s.shadow.mapSize.x).toBe(1024);
    expect((s.shadow.camera as THREE.PerspectiveCamera).far).toBe(55); // 远面=range
    // 关掉 castShadow → 再 sync → 投影回收
    w.getComponent<Light3D>('s', 'Light3D')!.castShadow = false;
    rig.sync(scene, getLights3D(w), w);
    expect((scene.children.find((c) => c instanceof THREE.SpotLight) as THREE.SpotLight).castShadow).toBe(false);
  });

  it('投影预算：3 盏 spot 都 castShadow → 只前 2 盏真投影（MAX_SHADOW_LOCAL=2）', () => {
    const scene = new THREE.Scene();
    const rig = new LightRig(scene);
    const w = new World();
    for (let i = 0; i < 3; i++) {
      w.createEntity(`s${i}`);
      w.addComponent<Light3D>(`s${i}`, { type: 'Light3D', kind: 'spot', color: 0xffffff, intensity: 500, range: 40, castShadow: true, x: i * 5, y: 20, z: 0, dirY: -1 } as Light3D);
    }
    rig.sync(scene, getLights3D(w), w);
    const shadowCasters = scene.children.filter((c) => c instanceof THREE.SpotLight && c.castShadow).length;
    expect(shadowCasters).toBe(2); // 第 3 盏在灯预算内但超投影预算 → 不投影
  });

  it('池清理：撤掉 Light3D → 局部光从场景移除', () => {
    const scene = new THREE.Scene();
    const rig = new LightRig(scene);
    const w = new World();
    w.createEntity('p'); w.addComponent('p', point(0, { x: 0, y: 5, z: 0 }));
    rig.sync(scene, getLights3D(w), w);
    expect(pointCount(scene)).toBe(1);
    w.removeComponent('p', 'Light3D');
    rig.sync(scene, getLights3D(w), w);
    expect(pointCount(scene)).toBe(0);
  });
});

describe('LightRig shadow target ownership', () => {
  it('disposes main/local map and mapPass once, removes owned lights, and retains unrelated scene assets', () => {
    const scene=new THREE.Scene(),rig=new LightRig(scene),world=new World();
    world.createEntity('spot');world.addComponent<Light3D>('spot',{type:'Light3D',kind:'spot',color:0xffffff,intensity:20,castShadow:true});rig.sync(scene,getLights3D(world),world);
    const spot=scene.children.find(child=>child instanceof THREE.SpotLight) as THREE.SpotLight;
    const owned=[rig.key,spot].flatMap(light=>{light.shadow.map=new THREE.WebGLRenderTarget(16,16);light.shadow.map.depthTexture=new THREE.DepthTexture(16,16);light.shadow.mapPass=new THREE.WebGLRenderTarget(16,16);return [light.shadow.map,light.shadow.mapPass];});
    const released=owned.map(target=>vi.spyOn(target,'dispose'));
    const external=new THREE.DirectionalLight(),externalTarget=new THREE.WebGLRenderTarget(16,16);external.shadow.map=externalTarget;scene.add(external);
    const material=new THREE.MeshStandardMaterial({map:new THREE.Texture()}),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);scene.add(mesh);
    const kept=[vi.spyOn(externalTarget,'dispose'),vi.spyOn(material,'dispose'),vi.spyOn(material.map!,'dispose'),vi.spyOn(mesh.geometry,'dispose')];
    rig.dispose(scene);rig.dispose(scene);
    for(const dispose of released)expect(dispose).toHaveBeenCalledOnce();for(const dispose of kept)expect(dispose).not.toHaveBeenCalled();
    expect(rig.key.shadow.map).toBeNull();expect(rig.key.shadow.mapPass).toBeNull();expect(spot.shadow.map).toBeNull();expect(spot.shadow.mapPass).toBeNull();expect(rig.key.parent).toBeNull();expect(rig.key.target.parent).toBeNull();expect(spot.parent).toBeNull();expect(external.parent).toBe(scene);expect(mesh.parent).toBe(scene);
    externalTarget.dispose();mesh.geometry.dispose();material.map!.dispose();material.dispose();vi.restoreAllMocks();
  });

  it('reclaims both main shadow targets on resize, preserves casting and does not release an aliased target twice', () => {
    const scene=new THREE.Scene(),rig=new LightRig(scene,256),target=new THREE.WebGLRenderTarget(16,16),dispose=vi.spyOn(target,'dispose');
    rig.key.shadow.map=target;rig.key.shadow.mapPass=target;
    rig.setShadowMapSize(512);rig.setShadowMapSize(512);rig.dispose(scene);
    expect(dispose).toHaveBeenCalledOnce();expect(rig.key.castShadow).toBe(true);expect(rig.key.shadow.mapSize.x).toBe(512);expect(rig.key.shadow.map).toBeNull();expect(rig.key.shadow.mapPass).toBeNull();vi.restoreAllMocks();
  });

  it('releases a local mapPass when disabling its shadow and leaves the still-live light intact', () => {
    const scene=new THREE.Scene(),rig=new LightRig(scene),world=new World();world.createEntity('spot');world.addComponent<Light3D>('spot',{type:'Light3D',kind:'spot',color:0xffffff,intensity:20,castShadow:true});rig.sync(scene,getLights3D(world),world);
    const spot=scene.children.find(child=>child instanceof THREE.SpotLight) as THREE.SpotLight,map=new THREE.WebGLRenderTarget(16,16),pass=new THREE.WebGLRenderTarget(16,16),a=vi.spyOn(map,'dispose'),b=vi.spyOn(pass,'dispose');spot.shadow.map=map;spot.shadow.mapPass=pass;
    world.getComponent<Light3D>('spot','Light3D')!.castShadow=false;rig.sync(scene,getLights3D(world),world);rig.sync(scene,getLights3D(world),world);expect(a).toHaveBeenCalledOnce();expect(b).toHaveBeenCalledOnce();expect(spot.parent).toBe(scene);expect(spot.castShadow).toBe(false);rig.dispose(scene);vi.restoreAllMocks();
  });
});
