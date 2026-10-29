import {describe,it,expect} from 'vitest';
import {composeSocketFrames,handPoseForContact} from './socket-frames.mjs';
const identity=position=>({position,rotation:[0,0,0,1]});
const yaw=(angle,position)=>({position,rotation:[0,Math.sin(angle/2),0,Math.cos(angle/2)]});
const same=(a,b)=>{for(let k=0;k<3;k++)expect(a.position[k]).toBeCloseTo(b.position[k],9);expect(Math.abs(a.rotation.reduce((s,v,i)=>s+v*b.rotation[i],0))).toBeCloseTo(1,9);};
describe('paired grip/contact Socket authoring',()=>{
 it('aligns the actual prop endpoint across rotated nested hand/socket frames',()=>{for(const angle of [-1.2,-.3,0,.7,1.4]){const desired=composeSocketFrames([yaw(angle,[.2,1.1,.4]),identity([.02,.01,.06]),yaw(.5,[0,0,0]),identity([-.03,0,.012])]),handToGrip=yaw(-.4,[.03,.08,.02]),gripToProp=yaw(.8,[.02,0,0]),propToContact=identity([.04,0,0]),hand=handPoseForContact({desiredContactWorld:desired,handToGrip,gripToProp,propToContact});same(composeSocketFrames([hand,handToGrip,gripToProp,propToContact]),desired);}});
 it('changes the hand goal for a different Skin grip without moving the contact',()=>{const desired=identity([0,1,.4]),gripToProp=identity([0,0,0]),propToContact=identity([.04,0,0]);const goals=[.06,.12].map(length=>{const handToGrip=identity([0,length,0]),goal=handPoseForContact({desiredContactWorld:desired,handToGrip,gripToProp,propToContact});same(composeSocketFrames([goal,handToGrip,gripToProp,propToContact]),desired);return goal;});expect(Math.abs(goals[0].position[1]-goals[1].position[1])).toBeCloseTo(.06,9);});
 it('refuses uncalibrated scale fields, invalid poses and unbounded chains',()=>{for(const f of [{...identity([0,0,0]),scale:.01},identity([NaN,0,0]),{position:[0,0,0],rotation:[0,0,0,0]}])expect(()=>composeSocketFrames([f])).toThrow();expect(()=>composeSocketFrames([])).toThrow();expect(()=>composeSocketFrames(Array(9).fill(identity([0,0,0])))).toThrow();});
});
