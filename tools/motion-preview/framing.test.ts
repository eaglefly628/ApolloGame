import {describe,it,expect} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {orbitCamera} from '../../src/renderer/three-projection.js';
import {frameSkin,type SkinBounds} from './framing.js';
describe('preview rest mesh camera framing',()=>{
 it.each([
  [[[-1,0,-.2],[1,4,.2]],1,.4],
  [[[-.1,-1,-.1],[.1,9,.1]],.5,2],
  [[[-4,2,-1],[3,3,1]],2,.7],
 ] as [SkinBounds,number,number][])('contains every normalized bounds corner for any mesh proportions', (bounds,scale,aspect)=>{
  const frame=frameSkin(bounds,scale,aspect),camera=new PerspectiveCamera(frame.fov,aspect,frame.near,frame.far);
  const pivot={x:frame.pivotX,y:frame.pivotY,z:frame.pivotZ};
  const eye=orbitCamera(pivot,frame.distance,frame.yaw,frame.pitch);
  camera.position.set(eye.x,eye.y,eye.z);camera.lookAt(pivot.x,pivot.y,pivot.z);camera.updateMatrixWorld(true);
  for(const x of [bounds[0][0],bounds[1][0]])for(const y of [bounds[0][1],bounds[1][1]])for(const z of [bounds[0][2],bounds[1][2]]){
   const p=new Vector3(x*scale,y*scale,z*scale).project(camera);expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1);expect(Math.abs(p.z)).toBeLessThan(1);
  }
 });
 it('centers all axes and scales distance with the same hip normalization',()=>{const a=frameSkin([[1,0,-2],[3,4,0]],1,1),b=frameSkin([[1,0,-2],[3,4,0]],2,1);expect([a.pivotX,a.pivotY,a.pivotZ]).toEqual([2,2,-1]);expect(b.distance).toBeCloseTo(a.distance*2);expect(frameSkin([[1,0,-2],[3,4,0]],1,.4).distance).toBeGreaterThan(a.distance);});
 it.each([null,[],[[0,0,0],[0,0,0]],[[1,0,0],[0,1,1]],[[NaN,0,0],[1,1,1]],[[0,0,0],[1,Infinity,1]],[[0,0],[1,1]]])('rejects malformed/degenerate bounds %j',bounds=>expect(()=>frameSkin(bounds,1,1)).toThrow());
 it.each([[0,1],[1,0],[Infinity,1],[1,NaN],[-1,1]])('rejects invalid scale/aspect', (scale,aspect)=>expect(()=>frameSkin([[0,0,0],[1,1,1]],scale,aspect)).toThrow());
});
