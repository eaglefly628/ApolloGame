import type {Component}from'../../core/types.js';import{validateDriverTree}from'./animation-driver.js';import{t}from'../../core/schema.js';
export interface BoneSocketDefinition {readonly bone:string;readonly frame:'bone-local'|'humanoid-hand-v1';readonly side?:'left'|'right';readonly offset:readonly[number,number,number];readonly rotation:readonly[number,number,number]}
/** Render-only immutable-rest authored anchors. hand-v1 offsets are palm-width
 * normalized; the resulting frame and all consumer offsets are model metres. */
export interface BoneSockets3D extends Component {readonly type:'BoneSockets3D';readonly version:1;readonly sockets:Readonly<Record<string,BoneSocketDefinition>>}
export function validateBoneSockets3D(raw:unknown):BoneSockets3D{
 validateDriverTree(raw);const fail=(m:string):never=>{throw Error('BoneSockets3D: '+m);};const fields=(v:any,allowed:string[],required=allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(v,k)))fail('closed schema');};
 fields(raw,['type','version','sockets'],['version','sockets']);const c=raw as BoneSockets3D;if(c.type!==undefined&&c.type!=='BoneSockets3D'||c.version!==1)fail('type/version');fields(c.sockets,Object.keys(c.sockets??{}));const ids=Object.keys(c.sockets);if(!ids.length||ids.length>64)fail('socket budget1..64');
 for(const id of ids){if(!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(id))fail('stable socket id');const s=c.sockets[id];fields(s,['bone','frame','side','offset','rotation'],['bone','frame','offset','rotation']);if(typeof s.bone!=='string'||!s.bone.trim()||s.bone.length>256)fail('bone');if(!['bone-local','humanoid-hand-v1'].includes(s.frame))fail('frame');
  for(const a of [s.offset,s.rotation])if(!Array.isArray(a)||a.length!==3||a.some(n=>!Number.isFinite(n)||Math.abs(n)>1000))fail('finite tuple3 budget');
  if(s.frame==='humanoid-hand-v1'){if(!['left','right'].includes(s.side as string)||s.bone!==(s.side==='left'?'LeftHand':'RightHand'))fail('hand-v1 side and canonical Hand required');}else if(s.side!==undefined)fail('bone-local side is not used');
 }return c;
}
export const BONE_SOCKET_SCHEMAS={BoneSockets3D:t.obj({version:t.lit(1),sockets:t.rec(t.obj({bone:t.str(),frame:t.enum(['bone-local','humanoid-hand-v1']),side:t.opt(t.enum(['left','right'])),offset:t.arr(t.num()),rotation:t.arr(t.num())}))})}as const;
