/** Host-only immutable GLB snapshots and asynchronous SHA-256 binding checks.
 * Core configuration validation stays DOM-free in animation/locomotion-character.
 * No simulation clock, World mutation or asset-quality promotion happens here. */
import {compileLocomotionDriver3D} from '../animation/locomotion-driver.js';
import {validateCharacterTree as tree,characterFields as fields,characterSha as sha,characterPositive as num,canonicalCharacterValue as canonical,characterCheck as check,normalizeModelSelection} from '../animation/locomotion-character.js';
import type {LocomotionCharacter3D,RestBone,RestIdentity,TargetObservation,SourceObservation} from '../animation/locomotion-character.js';
// Deterministic SHA-256 of immutable asset bytes; asynchronous render readiness only, never random or a simulation clock.
async function hash(v:unknown):Promise<string>{tree(v);check(!!globalThis.crypto?.subtle,'SHA256 unavailable');const bytes=new TextEncoder().encode(canonical(v));const out=await globalThis.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(out),b=>b.toString(16).padStart(2,'0')).join('');}
/** New opt-in target path uses these SAME bytes for digest and decode. No codec
 * policy is changed for old ModelPool callers. External buffers/images are refused. */
export async function snapshotTargetGlb(input:ArrayBuffer):Promise<{bytes:ArrayBuffer;sha256:string}>{
 check(input instanceof ArrayBuffer&&Object.getPrototypeOf(input)===ArrayBuffer.prototype&&Object.getOwnPropertyNames(input).length===0&&Object.getOwnPropertySymbols(input).length===0,'ordinary closed ArrayBuffer');
 check(input.byteLength>=28&&input.byteLength<=64*1024*1024,'target GLB budget');const bytes=ArrayBuffer.prototype.slice.call(input,0) as ArrayBuffer,view=new DataView(bytes);
 check(view.getUint32(0,true)===0x46546c67&&view.getUint32(4,true)===2&&view.getUint32(8,true)===bytes.byteLength,'GLB2 header');const length=view.getUint32(12,true),bin=20+length;
 check(length<=4*1024*1024&&length%4===0&&view.getUint32(16,true)===0x4e4f534a&&bin+8<=bytes.byteLength,'GLB JSON range');
 check(view.getUint32(bin+4,true)===0x004e4942&&view.getUint32(bin,true)%4===0&&bin+8+view.getUint32(bin,true)===bytes.byteLength,'GLB binary range');
 const json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes,20,length)));tree(json);check(json.asset?.version==='2.0','GLTF2');
 check(Array.isArray(json.buffers)&&json.buffers.length===1&&json.buffers[0].uri===undefined,'one local BIN buffer');
 const pending=[json];while(pending.length){const v=pending.pop();for(const[k,child]of Object.entries(v)){if(k==='uri')check(typeof child==='string'&&child.startsWith('data:'),'external GLB dependency');if(child&&typeof child==='object')pending.push(child);}}
// Deterministic SHA-256 over the frozen GLB parse snapshot; only native render binding awaits this digest.
 check(!!globalThis.crypto?.subtle,'SHA256 unavailable');const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return{bytes,sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};
}
export async function profileIdentity(config:unknown):Promise<string>{tree(config);return hash(compileLocomotionDriver3D(config).configuration);}

export async function restIdentity(input:unknown):Promise<RestIdentity>{tree(input);check(Array.isArray(input)&&input.length>=17&&input.length<=512,'rest bone budget');const names=new Set<string>();for(const bone of input as RestBone[]){fields(bone,['name','local','world','inverse','ancestors']);check(typeof bone.name==='string'&&bone.name.length>0&&!names.has(bone.name),'unique bone name');names.add(bone.name);for(const k of ['local','world','inverse']as const)check(bone[k].length===16&&bone[k].every(Number.isFinite),'matrix16');check(bone.ancestors.length<=128,'ancestor budget');for(const ancestor of bone.ancestors){fields(ancestor,['name','matrix']);check(typeof ancestor.name==='string'&&ancestor.matrix.length===16&&ancestor.matrix.every(Number.isFinite),'ancestor matrix');}}
 const bones=[...input as RestBone[]].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);const hip=bones.find(b=>b.name==='Hips');num(hip?.world[13],'Hips world Y');const hipY=hip!.world[13];return{sha256:await hash(bones),hipY};}
function rest(r:unknown):asserts r is RestIdentity{fields(r,['sha256','hipY']);sha(r.sha256);num(r.hipY,'rest hipY');}
function target(o:unknown):asserts o is TargetObservation {fields(o,['skinSha256','model','effectiveScale','rest']);sha(o.skinSha256);normalizeModelSelection(o.model);num(o.effectiveScale,'effectiveScale');rest(o.rest);}
function sources(obs:unknown):asserts obs is SourceObservation[]{check(Array.isArray(obs)&&obs.length>0&&obs.length<=128,'sources budget');const ids=new Set();for(const o of obs as SourceObservation[]){fields(o,['asset','sha256','rest']);check(typeof o.asset==='string'&&o.asset.length>0&&!ids.has(o.asset),'source asset');ids.add(o.asset);sha(o.sha256);rest(o.rest);}}
export async function createCharacterBinding(config:unknown,observed:TargetObservation,sourceObservations:readonly SourceObservation[],calibration:LocomotionCharacter3D['calibration']):Promise<LocomotionCharacter3D>{
 // Caller observations must be produced from the exact decode snapshot, not asset metadata.
 tree(config);tree(observed);tree(sourceObservations);tree(calibration);config=JSON.parse(canonical(config));observed=JSON.parse(canonical(observed));sourceObservations=JSON.parse(canonical(sourceObservations));calibration=JSON.parse(canonical(calibration));target(observed);sources(sourceObservations);fields(calibration,['artifactSha256','status','scope']);sha(calibration.artifactSha256);check(['unreviewed','reviewed'].includes(calibration.status)&&calibration.scope==='target-specific-locomotion','calibration status/scope');
 const profileSha256=await profileIdentity(config),clips=(config as any).clips;const assets=[...new Set(Object.values(clips).map((c:any)=>c.asset))].sort();check(assets.length===sourceObservations.length&&assets.every(a=>sourceObservations.some(s=>s.asset===a)),'exact profile source set');
 const bound=assets.map(asset=>{const s=sourceObservations.find(s=>s.asset===asset)!;for(const c of Object.values(clips)as any[])if(c.asset===asset)check(c.sourceSha256===s.sha256,'profile source SHA mismatch');return{asset,sourceSha256:s.sha256,restSha256:s.rest.sha256,hipRatio:observed.rest.hipY/s.rest.hipY};});
 return {type:'LocomotionCharacter3D',version:1,profileSha256,target:{skinSha256:observed.skinSha256,selector:normalizeModelSelection(observed.model),effectiveScale:observed.effectiveScale,restSha256:observed.rest.sha256},retarget:{policy:'humanoid-v1',sources:bound},calibration:{...calibration}};
}
export async function verifyCharacterBinding(binding:unknown,config:unknown,observed:TargetObservation,sourceObservations:readonly SourceObservation[],options:{requireReviewed:boolean}={requireReviewed:true}):Promise<void>{
 tree(binding);binding=JSON.parse(canonical(binding));fields(binding,['type','version','profileSha256','target','retarget','calibration']);check(binding.type==='LocomotionCharacter3D'&&binding.version===1,'binding version/type');tree(options);options=JSON.parse(canonical(options));fields(options,['requireReviewed']);check(typeof options.requireReviewed==='boolean','review option');
 // Rebuild the whole closed contract from observations. Never trust a matching id alone.
 const rebuilt=await createCharacterBinding(config,observed,sourceObservations,binding.calibration);check(canonical(binding)===canonical(rebuilt),'target/profile/selector/scale/rest/retarget binding mismatch');check(!options.requireReviewed||binding.calibration.status==='reviewed','calibration not reviewed');
}

