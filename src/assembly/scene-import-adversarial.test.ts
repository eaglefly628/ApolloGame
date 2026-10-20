import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
// @ts-expect-error Node-only CPU baker is an intentionally untyped .mjs tool.
import { bakeSceneImport } from '../../scripts/scene-import.mjs';
// @ts-expect-error Binary GLB fixture builder is shared with Node .mjs tests.
import { glb } from '../../scripts/fixtures/scene-import/glb-fixtures.mjs';
import { AssetManager } from '../assets/asset-manager.js';
import { expandSceneImports } from './scene-import.js';
import { contact3d } from '../engine/spatial/contact3d.js';
import type { Collider3D, Transform } from '../engine/protocol/components.js';
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const imports={yard:{SceneImport3D:{modelKey:'yard',rules:'default'}}};
function rect(index:number,x0:number,z0:number,x1:number,z1:number) {return {index,path:[index],name:'nav_floor',kind:'navigation',worldMatrix:I,positions:[x0,0,z0,x1,0,z0,x1,0,z1,x0,0,z1],indices:[0,1,2,0,2,3],bounds:{min:[x0,0,z0],max:[x1,0,z1]}};}
function data(nodes:any[]){return {version:1,sourceSha256:'a'.repeat(64),nodes};}
function tetraGlb(parent = false) {
 const pos=new Float32Array([0,0,0,2,0,0,0,2,0,0,0,2]),ind=new Uint16Array([0,2,1,0,1,3,0,3,2,1,2,3]);
 const binary=Buffer.concat([Buffer.from(pos.buffer),Buffer.from(ind.buffer)]);
 const nodes=parent ? [{name:'parent',matrix:[2,0,0,0,0,3,0,0,0,0,.5,0,10,3,-4,1],children:[1]},{name:'col_tetra',mesh:0}] : [{name:'col_tetra',mesh:0}];
 return glb({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes,meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],buffers:[{byteLength:binary.length}],bufferViews:[{buffer:0,byteLength:pos.byteLength},{buffer:0,byteOffset:pos.byteLength,byteLength:ind.byteLength}],accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3'},{bufferView:1,componentType:5123,count:12,type:'SCALAR'}]},binary);
}
async function realTetra(parent = false) {
 const bytes=tetraGlb(parent),scene=await bakeSceneImport(bytes);
 expect(scene.sourceSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
 const manager=new AssetManager({load:async()=>({handle:Uint8Array.from(bytes).buffer,width:0,height:0})});
 manager.register({kind:'model',key:'yard',src:'/tetra.glb',scene});await manager.load('yard');
 const out:any=expandSceneImports(imports,manager.sceneImportCatalog(['yard']));
 const entity=out[parent?'yard/node-0-1':'yard/node-0'];
 expect(entity.Collider3D.kind).toBe('hull');
 return {t:{...entity.Transform,type:'Transform'} as Transform,c:{...entity.Collider3D,type:'Collider3D'} as Collider3D};
}
const at=(x:number,z:number):Transform=>({type:'Transform',x,y:z,rotation:0,scaleX:1,scaleY:1});
describe('E5 independent real seams',()=>{
 it('does not create an artificial blocked stripe inside overlapping horizontal nav union',()=>{
  const out:any=expandSceneImports(imports,{yard:data([rect(0,0,0,3.1,4),rect(1,2,0,8,4)])} as any);
  const g=out.yard.NavigationGrid;
  const cell=g.blocked[Math.floor((1.25-g.originY)/g.cellSize)*g.cols+Math.floor((3.25-g.originX)/g.cellSize)];
  expect(cell).toBe(0);
 });
 it('actual CPU baked convex tetrahedron does not collide with a separated sphere near a real edge',async()=>{
  const tetra=await realTetra();
  const center=[1.1,1.1,-.1],radius=.12,distance=Math.sqrt(.03);
  expect(distance).toBeGreaterThan(radius); // closest point to all 4 faces is on x+y=2,z=0 edge
  const hit=contact3d(tetra.t,tetra.c,at(center[0]!,center[2]!),{type:'Collider3D',kind:'sphere',radius,baseY:center[1]!-radius});
  expect(hit).toBeNull();
 });
 it('actual CPU baked tetra and AABB are separated along a real edge cross edge axis',async()=>{
  const tetra=await realTetra();
  // Every box point has x+y>=2.02; every tetra point has x+y<=2.
  const b:Collider3D={type:'Collider3D',kind:'box',halfX:.09,halfY:.09,halfZ:.1,baseY:1.01};
  expect(contact3d(tetra.t,tetra.c,at(1.1,-.04),b)).toBeNull();
  expect(contact3d(at(1.1,-.04),b,tetra.t,tetra.c)).toBeNull();
 });
 it('actual character capsule bottom cap contacts the sloped tetra face',async()=>{
  const tetra=await realTetra(),c:Collider3D={type:'Collider3D',kind:'capsule',radius:.15,height:1.8,baseY:0};
  // Bottom center (1.8,.15,.1) lies .05/sqrt(3) outside the real face.
  const hit=contact3d(tetra.t,tetra.c,at(1.8,.1),c),reverse=contact3d(at(1.8,.1),c,tetra.t,tetra.c);
  expect(hit).not.toBeNull();expect(reverse).not.toBeNull();
  expect(hit!.depth).toBeCloseTo(.15-.05/Math.sqrt(3),10);
  for(const k of ['nx','ny','nz'] as const) {expect(hit![k]).toBeCloseTo(1/Math.sqrt(3),10);expect(reverse![k]).toBeCloseTo(-hit![k],10);}
 });
 it('parent translation and nonuniform scale keep true world edges for sphere and capsule',async()=>{
  const tetra=await realTetra(true);
  const sphere:Collider3D={type:'Collider3D',kind:'sphere',radius:.12,baseY:6+.2/Math.sqrt(13)-.12};
  expect(contact3d(tetra.t,tetra.c,at(12+.3/Math.sqrt(13),-4.1),sphere)).toBeNull();
  const c:Collider3D={type:'Collider3D',kind:'capsule',radius:.2,height:1.4,baseY:3};
  const hit=contact3d(tetra.t,tetra.c,at(9.9,-4.1),c);
  expect(hit).not.toBeNull();
  expect(hit!.depth).toBeCloseTo(.2-Math.sqrt(.02),10);
  expect(hit!.nx).toBeCloseTo(-1/Math.sqrt(2),10);expect(hit!.ny).toBeCloseTo(0,10);expect(hit!.nz).toBeCloseTo(-1/Math.sqrt(2),10);
 });
});
