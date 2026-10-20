// CPU integration uses the real ThreeRenderer sync/geometry/batches with only
// the WebGL presentation boundary replaced. Real browser evidence is separate.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import { hashSnapshot } from '@net/index.js';
import type { Collider3D, Mesh3D, Transform } from '@engine/protocol/components.js';
import { collectRenderables, type Renderable } from './renderable.js';
import { groundMeshPose, groundPose, mesh3dVerticalHalfSize } from './three-projection.js';
import { ThreeRenderer } from './three-renderer.js';
import { buildMesh3D } from './three/geometry.js';
import { ModelPool } from './three/models.js';
import { CameraRig } from './three/camera-rig.js';
import { LightRig } from './three/lights.js';

const transform: Transform = { type: 'Transform', x: 4, y: -3, rotation: .25, scaleX: 2, scaleY: 3 };
const mesh: Mesh3D = { type: 'Mesh3D', shape: 'box', width: 2, height: 4, depth: 2, frontTint: 0xff8844 };
const renderable = { entityId: 'walker', x: 4, y: -3, rotation: .25, scaleX: 2, scaleY: 3, zOrder: 0, groundBaseY: 1.25 } satisfies Renderable;
type FixtureComponent = Component & Record<string, unknown>; // Includes deliberately invalid direct-world compositions below.
function entity(world: World, id: string, components: readonly FixtureComponent[]): void { world.createEntity(id); for (const component of components) world.addComponent(id, component); }
function walker(world: World, id = 'walker', components: readonly FixtureComponent[] = []): void {
  entity(world,id,[{...transform},{type:'GroundWalker3D',surfaceId:'surface'},{type:'Collider3D',shape:'box',halfWidth:1,halfDepth:1,height:4,baseY:1.25},...components]);
}
const cleanups: (() => void)[] = [];
afterEach(() => { for(const cleanup of cleanups.splice(0))cleanup(); vi.restoreAllMocks(); });

function backendFixture() {
  const backend = new ThreeRenderer({width:320,height:240}), scene = new THREE.Scene(), models = new ModelPool(), cameras = new CameraRig(50,320/240);
  const gl = {info:{reset:vi.fn(),render:{calls:0,triangles:0},memory:{geometries:0,textures:0},programs:[]},properties:{get:()=>({})},shadowMap:{needsUpdate:false},render:vi.fn(()=>scene.updateMatrixWorld(true)),dispose:vi.fn(),domElement:{remove:vi.fn()}};
  Object.assign(backend,{scene,models,cameras,gl,lights:new LightRig(scene,256),post:{dispose:vi.fn()}});
  cleanups.push(()=>backend.destroy());
  return {backend,scene,models,gl,cameras};
}
function firstMesh(scene: THREE.Scene): THREE.Mesh { return scene.children.find(child=>(child as THREE.Mesh).isMesh) as THREE.Mesh; }
function instancePosition(scene: THREE.Scene): THREE.Vector3 {
  const m=firstMesh(scene) as THREE.InstancedMesh, matrix=new THREE.Matrix4();expect(m.isInstancedMesh).toBe(true);m.getMatrixAt(0,matrix);return new THREE.Vector3().setFromMatrixPosition(matrix);
}

describe('ThreeRenderer lifecycle boundary',()=>{
  it('allows never-initialized and repeated destruction without double releasing owned resources',()=>{
    const never=new ThreeRenderer();expect(()=>{never.destroy();never.destroy();}).not.toThrow();
    const {backend,gl}=backendFixture();backend.destroy();backend.destroy();expect(gl.dispose).toHaveBeenCalledTimes(1);expect(gl.domElement.remove).toHaveBeenCalledTimes(1);
  });
});

describe('GroundWalker3D render collection',()=>{
  it('adds only finite opt-in Collider3D foot height and never reads a Walker Transform3D',()=>{
    const world=new World();walker(world,'walker',[{type:'Transform3D',x:999,y:999,z:999}]);
    entity(world,'legacy',[{...transform},{type:'Collider3D',shape:'box',baseY:8},{type:'Transform3D',x:8,y:9,z:10}]);
    const read=vi.spyOn(world,'getComponent'),before=hashSnapshot(world.snapshot()),items=collectRenderables(world);
    expect(items.find(r=>r.entityId==='walker')).toMatchObject({x:4,y:-3,groundBaseY:1.25,transform3d:undefined});
    expect(read.mock.calls.some(([id,type])=>id==='walker'&&type==='Transform3D')).toBe(false);
    expect(items.find(r=>r.entityId==='legacy')).toMatchObject({transform3d:{x:8,y:9,z:10}});expect(items.find(r=>r.entityId==='legacy')).not.toHaveProperty('groundBaseY');
    expect(hashSnapshot(world.snapshot())).toBe(before);
  });
  it('uses default baseY=0, omits missing/nonfinite collider height and rejects T3-only Walker fallback',()=>{
    const world=new World();walker(world,'default',[{type:'Collider3D',shape:'box'}]);walker(world,'bad',[{type:'Collider3D',shape:'box',baseY:NaN}]);
    entity(world,'missing',[{...transform},{type:'GroundWalker3D',surfaceId:'surface'}]);entity(world,'t3-only',[{type:'Transform3D',x:1,y:2,z:3},{type:'GroundWalker3D',surfaceId:'surface'}]);
    const items=collectRenderables(world);expect(items.find(r=>r.entityId==='default')?.groundBaseY).toBe(0);expect(items.find(r=>r.entityId==='bad')).not.toHaveProperty('groundBaseY');expect(items.find(r=>r.entityId==='missing')).not.toHaveProperty('groundBaseY');expect(items.some(r=>r.entityId==='t3-only')).toBe(false);
  });
});

describe('grounded mesh actual geometry dimensions',()=>{
  it.each<Mesh3D['shape']>(['box','plane','sphere','cylinder','cone','capsule','torus'])('%s meets the supplied ground with negative/nonuniform visual scale',shape=>{
    const m={...mesh,shape,width:2,height:4,tube:.6},r={...renderable,scaleX:2,scaleY:-3},object=buildMesh3D(m),pose=groundMeshPose(r,m);
    object.position.set(pose.x,pose.y,pose.z);object.rotation.y=pose.ry??0;object.scale.set(pose.sx,pose.sy,pose.sz??1);object.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(object,true);expect(box.min.y).toBeCloseTo(r.groundBaseY,5);expect(pose.y).toBeCloseTo(r.groundBaseY+mesh3dVerticalHalfSize(m)*3,10);
    object.geometry.dispose();for(const material of new Set(Array.isArray(object.material)?object.material:[object.material]))material.dispose();
  });
  it('capsules shorter than their diameter use the actual tiny cylinder; sphere/torus ignore height',()=>{
    expect(mesh3dVerticalHalfSize({...mesh,shape:'capsule',width:4,height:1})).toBeCloseTo(2.00005,10);
    expect(mesh3dVerticalHalfSize({...mesh,shape:'sphere',width:4,height:99})).toBe(2);
    expect(mesh3dVerticalHalfSize({...mesh,shape:'torus',width:4,height:99,tube:.5})).toBe(3);
    const capsule=buildMesh3D({...mesh,shape:'capsule',width:4,height:1});capsule.geometry.computeBoundingBox();expect(mesh3dVerticalHalfSize({...mesh,shape:'capsule',width:4,height:1})).toBeCloseTo(-capsule.geometry.boundingBox!.min.y,5);capsule.geometry.dispose();(capsule.material as THREE.Material).dispose();
  });
  it('models use the normalized foot pivot, while legacy groundPose retains its unscaled half-height',()=>{
    expect(groundPose(renderable,0)).toMatchObject({x:4,y:1.25,z:-3,ry:-.25,sx:2,sy:3,sz:2});
    const {groundBaseY:_ground,...legacy}=renderable;expect(groundPose(legacy,4).y).toBe(2);expect(groundPose({...legacy,groundBaseY:0},4).y).toBe(6);
  });
});

describe('ThreeRenderer grounded sync routes',()=>{
  it.each(['plain','pbr'] as const)('different tube tori retain separate %s instance geometry and both meet the ground',route=>{
    const {backend,scene}=backendFixture(),world=new World();
    for(const [i,tube] of [.1,.6].entries())walker(world,`torus-${i}`,[{...transform,x:i*5},{...mesh,shape:'torus',tube},...(route==='pbr'?[{type:'Material3D',preset:'stone'}]:[])]);
    backend.sync(world);const batches=scene.children.filter(child=>(child as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    expect(batches).toHaveLength(2);
    for(const batch of batches){const matrix=new THREE.Matrix4();batch.getMatrixAt(0,matrix);const points=batch.geometry.getAttribute('position');let minY=Infinity;for(let i=0;i<points.count;i++)minY=Math.min(minY,new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(matrix).y);expect(minY).toBeCloseTo(1.25,5);}
  });
  it.each(['batch','pbr-batch','ordinary','pbr-ordinary','model'] as const)('%s reads foot height, redraws stationary height changes, and leaves sim/hash intact',route=>{
    const {backend,scene,models,gl}=backendFixture(),world=new World(),modelObject=new THREE.Group();
    const components: FixtureComponent[]=route==='model'?[{type:'Model3D',modelKey:'foot-pivot'}]:[{...mesh}];
    if(route==='ordinary'||route==='pbr-ordinary')components.push({type:'Color',tint:0xffffff,alpha:.5});
    if(route.startsWith('pbr-'))components.push({type:'Material3D',preset:'stone'});
    walker(world,'walker',components);
    if(route==='model')vi.spyOn(models,'ensure').mockImplementation((target)=>{if(!modelObject.parent)target.add(modelObject);return modelObject;});
    const before=hashSnapshot(world.snapshot());backend.sync(world);expect(hashSnapshot(world.snapshot())).toBe(before);expect(gl.render).toHaveBeenCalledTimes(1);
    const position=()=>route==='model'?modelObject.position:route.includes('batch')?instancePosition(scene):firstMesh(scene).position;
    expect(position().toArray()).toEqual([4,route==='model'?1.25:7.25,-3]);backend.sync(world);expect(backend.readStats().rendered).toBe(false);
    world.getComponent<Collider3D>('walker','Collider3D')!.baseY=2.5;const elevatedHash=hashSnapshot(world.snapshot());backend.sync(world);
    expect(backend.readStats().rendered).toBe(true);expect(position().y).toBe(route==='model'?2.5:8.5);expect(hashSnapshot(world.snapshot())).toBe(elevatedHash);
    backend.sync(world);expect(backend.readStats().rendered).toBe(false);
    // hashPoses quantizes to millimetres; one valid sim Q is 0.1mm. The ground
    // signature must still invalidate this stationary sub-millimetre elevation.
    world.getComponent<Collider3D>('walker','Collider3D')!.baseY=2.5001;backend.sync(world);expect(backend.readStats().rendered).toBe(true);expect(position().y).toBeCloseTo(route==='model'?2.5001:8.5001,5);
  });
  it('ignores conflicting Walker T3/Pivot poses, warns once, and keeps Model FaceDir following',()=>{
    const {backend,scene,models}=backendFixture(),world=new World(),object=new THREE.Group(),warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
    walker(world,'walker',[{type:'Model3D',modelKey:'foot-pivot'},{type:'FaceDir',x:1,y:0},{type:'Transform3D',x:999,y:999,z:999,scale:90}]);
    entity(world,'pivot',[{type:'Transform3D',x:30,y:40,z:50,scale:5},{type:'Pivot3D',children:['walker']}]);
    vi.spyOn(models,'ensure').mockImplementation(()=>{if(!object.parent)scene.add(object);return object;});const before=hashSnapshot(world.snapshot()),read=vi.spyOn(world,'getComponent');
    backend.sync(world);backend.sync(world);expect(object.position.toArray()).toEqual([4,1.25,-3]);expect(object.scale.toArray()).toEqual([2,3,2]);expect(object.rotation.y).toBeCloseTo(Math.PI/2,10);expect(warning).toHaveBeenCalledTimes(1);expect(hashSnapshot(world.snapshot())).toBe(before);expect(read.mock.calls.some(([id,type])=>id==='walker'&&type==='Transform3D')).toBe(false);
  });
  it('retains non-Walker T3 and legacy Camera3D ground paths',()=>{
    const {backend,scene}=backendFixture(),world=new World();entity(world,'legacy',[{...transform},{...mesh},{type:'Transform3D',x:8,y:9,z:10}]);backend.sync(world);expect(instancePosition(scene).toArray()).toEqual([8,9,10]);
    world.removeComponent('legacy','Transform3D');entity(world,'camera',[{type:'Camera3D',yaw:0,pitch:.5,distance:10}]);backend.sync(world);expect(instancePosition(scene).toArray()).toEqual([4,2,-3]);
  });
});
