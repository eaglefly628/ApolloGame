import {validateBoneSockets3D,type BoneSockets3D} from '@engine/protocol/components/bone-sockets.js';
import {validateAttach3D} from '@engine/protocol/components/attach3d.js';
import {validateIK3D,type IKTarget} from '@engine/protocol/components/ik3d.js';
import {validateDriverTree} from '@engine/protocol/components/animation-driver.js';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const value=(v:unknown,key:string):unknown=>record(v)?Object.getOwnPropertyDescriptor(v,key)?.value:undefined;
const own=(v:unknown,key:string):boolean=>record(v)&&Object.hasOwn(v,key);
/** Reference validation only. Missing dynamic parents/targets retain E3/E4's
 * unresolved-runtime behavior; a present parent with a missing socket rejects.
 * Hand anatomy and selected skeleton compatibility are native renderer gates. */
export function validateBoneSocketReferences(entities:Record<string,unknown>):void {
 const entries=Object.entries(Object.getOwnPropertyDescriptors(entities));
 const involved=entries.some(([,d])=>{
  if(!('value'in d)||!record(d.value))return false;const row=d.value;
  if(own(row,'BoneSockets3D')||own(value(row,'Attach3D'),'socket'))return true;
  const ik=value(row,'IK3D'),chains=value(ik,'chains');
  return own(value(value(ik,'lookAt'),'target'),'socket')||Array.isArray(chains)&&Object.getOwnPropertyNames(chains).some(k=>{if(k==='length')return false;const chain=Object.getOwnPropertyDescriptor(chains,k)?.value;return own(chain,'effectorSocket')||own(value(chain,'target'),'socket');});
 });
 if(!involved)return;validateDriverTree(entities);const sockets=new Map<string,BoneSockets3D>();
 for(const[id,d]of entries){const row=d.value;if(!record(row)||!own(row,'BoneSockets3D'))continue;
  const defs=validateBoneSockets3D(row.BoneSockets3D),model=row.Model3D;
  if(!record(model)||typeof model.modelKey!=='string'||!model.modelKey.trim())throw Error(`bone-sockets: ${id}: Model3D required`);
  sockets.set(id,defs);
 }
 const referenced=(actor:string,socket:string)=>{
  if(!Object.hasOwn(entities,actor))return;
  const definitions=sockets.get(actor)?.sockets;
  if(!definitions||!Object.hasOwn(definitions,socket))throw Error(`bone-sockets: ${actor}: missing socket ${socket}`);
 };
 const target=(t:IKTarget)=>{if(t.socket)referenced(t.entity,t.socket);};
 for(const[id,d]of entries){const row=d.value;if(!record(row))continue;
  if(own(row,'Attach3D')){const a=validateAttach3D(row.Attach3D);if(a.socket)referenced(a.parentId,a.socket);}
  if(own(row,'IK3D')){const ik=validateIK3D(row.IK3D);for(const c of ik.chains){target(c.target);if(c.effectorSocket){referenced(id,c.effectorSocket);if(sockets.get(id)?.sockets[c.effectorSocket].bone!==c.end)throw Error(`bone-sockets: ${id}: effector socket must belong to chain end ${c.end}`);}}if(ik.lookAt)target(ik.lookAt.target);}
 }
}
