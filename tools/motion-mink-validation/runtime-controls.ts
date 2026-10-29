import type {AnimGraph3D,IK3D} from '../../src/engine/protocol/components.js';
import {validateIK3D} from '../../src/engine/protocol/components/ik3d.js';
export interface RuntimeSocketProfile {
 validationStatus?:string;statusLabel?:string;clipId:string;effectorBone:string;targetBone:string;
 rightChain:IK3D['chains'][number];leftMoverChain:IK3D['chains'][number];
 initialLeftHandWorldM:[number,number,number];embeddedSkinSha256:string;
 props:unknown[];coordinateSpace:string;skinBounds:[[number,number,number],[number,number,number]];
}
export function runtimeSocketProfile(report:unknown,skin:{id:string;sha256:string}):RuntimeSocketProfile|undefined{
 const map=(report as {runtimeSockets?:{version:number;bySkin?:Record<string,RuntimeSocketProfile>}})?.runtimeSockets;
 if(!map)return undefined;
 if(map.version!==1)throw new Error('运行时 Socket 版本不支持');
 const p=map.bySkin?.[skin.id];if(!p){if((map as unknown as {unsupportedBySkin?:Record<string,unknown>}).unsupportedBySkin?.[skin.id])return undefined;throw new Error('此角色尚无运行时 Socket 适配');}
 if(p.embeddedSkinSha256!==skin.sha256||p.coordinateSpace!=='model-space metres before optional display normalization')throw new Error('Socket 标定与当前角色不一致');
 if(!Array.isArray(p.initialLeftHandWorldM)||p.initialLeftHandWorldM.length!==3||!p.initialLeftHandWorldM.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=10))throw new Error('Socket 手部基准无效');
 if(!Array.isArray(p.skinBounds)||p.skinBounds.length!==2||!p.skinBounds.every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)))||p.skinBounds[1][1]<=p.skinBounds[0][1])throw new Error('Socket 角色边界无效');
 validateIK3D({chains:[p.leftMoverChain,p.rightChain]});
 if(p.rightChain.end!==p.effectorBone||p.rightChain.target.entity!=='actor'||p.rightChain.target.bone!==p.targetBone||p.leftMoverChain.target.entity!=='SocketLeftHandMover')throw new Error('Socket 交互链不匹配');
 return p;
}
export function socketControlData(profile:RuntimeSocketProfile,scale:number,shift:readonly number[],enabled:boolean,headWeight:number,active=true):{target:{type:'Transform3D';x:number;y:number;z:number};ik:IK3D}{
 if(!Number.isFinite(headWeight)||headWeight<0||headWeight>.25)throw new Error('头部跟随强度超出范围');
 if(!Number.isFinite(scale)||scale<=0||!Array.isArray(shift)||shift.length!==3||!shift.every(n=>Number.isFinite(n)&&Math.abs(n)<=.1))throw new Error('Socket 交互控制超出范围');
 const moved=shift.some(n=>Math.abs(n)>1e-8),point=profile.initialLeftHandWorldM.map((n,i)=>n*scale+shift[i]);
 const ik:IK3D={type:'IK3D',chains:[{...structuredClone(profile.leftMoverChain),weight:moved&&active?1:0},{...structuredClone(profile.rightChain),weight:enabled&&active?1:0}],lookAt:{bone:'Head',target:{entity:'actor',bone:profile.targetBone,offset:[0,0,0]},weight:active?headWeight:0}};
 validateIK3D(ik);return{target:{type:'Transform3D',x:point[0],y:point[1],z:point[2]},ik};
}

/** Existing native graph and Flag binding; no interaction solver in UI handlers. */
export function socketAnimationGraph(clipId:string):AnimGraph3D {
 return {type:'AnimGraph3D',clips:{idle:{clip:clipId,speed:0,loop:true},motion:{clip:clipId,speed:0,loop:true}},states:{idle:{clip:'idle'},interact:{clip:'motion'}},params:{interaction:'flag:socket-interacting'},transitions:[{from:'idle',to:'interact',whenParam:'interaction',cmp:'eq',value:true,fade:.15},{from:'interact',to:'idle',whenParam:'interaction',cmp:'eq',value:false,fade:.15}]};
}
