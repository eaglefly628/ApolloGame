// Read-only target calibration identity helpers used by native render readiness.
// No simulation writes, asset loading or promotion of declared quality/review status.
export interface ModelSelection { modelKey:string;nodeIndex?:number;excludeNodes?:readonly number[];origin?:readonly number[];scale?:number }
export interface RestBone {name:string;local:readonly number[];world:readonly number[];inverse:readonly number[];ancestors:readonly {name:string;matrix:readonly number[]}[]}
export interface RestIdentity {sha256:string;hipY:number}
export interface TargetObservation { skinSha256:string;model:ModelSelection;effectiveScale:number;rest:RestIdentity }
export interface SourceObservation {asset:string;sha256:string;rest:RestIdentity}
export interface LocomotionCharacter3D {type:'LocomotionCharacter3D';version:1;profileSha256:string;target:{skinSha256:string;selector:{modelKey:string;nodeIndex:number|null;excludeNodes:number[];origin:number[];scale:number};effectiveScale:number;restSha256:string};retarget:{policy:'humanoid-v1';sources:{asset:string;sourceSha256:string;restSha256:string;hipRatio:number}[]};calibration:{artifactSha256:string;status:'unreviewed'|'reviewed';scope:'target-specific-locomotion'}}
const fail=(s:string):never=>{throw new Error('LocomotionCharacter3D: '+s);};
const check=(v:unknown,s:string):void=>{if(!v)fail(s);};
function tree(value:unknown,seen=new Set<object>(),depth=0,budget={n:0}):void {
 check(++budget.n<=100000&&depth<=40,'JSON budget');
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='number'){check(Number.isFinite(value),'finite number');return;}
 if(typeof value==='string'){check(value.length<=100000,'string budget');return;}
 check(typeof value==='object'&&value!==null,'JSON value');const obj=value as object;check(!seen.has(obj),'shared/cyclic reference');seen.add(obj);
 const array=Array.isArray(obj);check(Object.getPrototypeOf(obj)===(array?Array.prototype:Object.prototype),'plain JSON prototype');
 check(Object.getOwnPropertySymbols(obj).length===0,'symbol property');const names=Object.getOwnPropertyNames(obj);
 if(array){const n=(obj as unknown[]).length;check(n<=10000&&names.length===n+1&&names.includes('length'),'dense closed array');for(let i=0;i<n;i++)check(names.includes(String(i)),'dense array');}
 for(const k of names){if(array&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(obj,k)!;check(d.enumerable&&'value'in d,'data-only enumerable property');check(!['__proto__','constructor','prototype'].includes(k),'reserved key');tree(d.value,seen,depth+1,budget);}
}
function fields(o:unknown,required:string[],optional:string[]=[]):asserts o is Record<string,any>{check(!!o&&typeof o==='object'&&!Array.isArray(o),'object expected');const keys=Object.keys(o as object);check(required.every(k=>keys.includes(k))&&keys.every(k=>required.includes(k)||optional.includes(k)),'closed fields');}
function sha(v:unknown):asserts v is string {check(typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),'SHA256 lowercase hex');}
function num(v:unknown,label:string):asserts v is number{check(typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e6,label);}
function canonical(v:any):string{return Array.isArray(v)?'['+v.map(canonical).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);}
/** Read the final renderer scale before binding. V1 refuses nonuniform/mirrored
 * body transforms; no norm or averaged scale can conceal a wrong body profile. */
export function uniformEffectiveScale(input:unknown):number{tree(input);check(Array.isArray(input)&&input.length===3,'effective scale XYZ');const a=input as number[];for(const n of a)num(n,'positive scale');check(a[0]===a[1]&&a[1]===a[2],'uniform effective scale required');return a[0];}
export function normalizeModelSelection(input:unknown):LocomotionCharacter3D['target']['selector']{tree(input);fields(input,['modelKey'],['nodeIndex','excludeNodes','origin','scale']);check(typeof input.modelKey==='string'&&input.modelKey.length>0&&input.modelKey.length<=512,'modelKey');const index=(v:unknown)=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=100000;check(input.nodeIndex===undefined||index(input.nodeIndex),'nodeIndex');const excludes=input.excludeNodes??[];check(Array.isArray(excludes)&&excludes.length<=4096&&excludes.every(index)&&new Set(excludes).size===excludes.length,'excludeNodes');const origin=input.origin??[0,0,0];check(Array.isArray(origin)&&origin.length===3&&origin.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e6),'origin');const scale=input.scale??1;num(scale,'model scale');return {modelKey:input.modelKey,nodeIndex:input.nodeIndex??null,excludeNodes:[...excludes].sort((a,b)=>a-b),origin:[...origin],scale};}
/** Validate the closed declared binding without claiming actual bytes or quality.
 * Actual target/source/profile identities are verified asynchronously at ModelPool. */
export function validateLocomotionCharacter3D(value:unknown):LocomotionCharacter3D {
 tree(value);fields(value,['type','version','profileSha256','target','retarget','calibration']);
 if(value.type!=='LocomotionCharacter3D'||value.version!==1)fail('type/version');sha(value.profileSha256);
 const t=value.target;fields(t,['skinSha256','selector','effectiveScale','restSha256']);sha(t.skinSha256);sha(t.restSha256);num(t.effectiveScale,'effectiveScale');
 const s=t.selector;fields(s,['modelKey','nodeIndex','excludeNodes','origin','scale']);
 const normalized=normalizeModelSelection({modelKey:s.modelKey,...(s.nodeIndex===null?{}:{nodeIndex:s.nodeIndex}),excludeNodes:s.excludeNodes,origin:s.origin,scale:s.scale});
 if(canonical(s)!==canonical(normalized))fail('canonical Model selector');
 fields(value.retarget,['policy','sources']);if(value.retarget.policy!=='humanoid-v1')fail('retarget policy');
 const sources=value.retarget.sources;if(!Array.isArray(sources)||sources.length<1||sources.length>128)fail('source budget');let previous='';
 for(const source of sources){fields(source,['asset','sourceSha256','restSha256','hipRatio']);if(typeof source.asset!=='string'||!source.asset.length||source.asset.length>512||source.asset<=previous)fail('sorted unique source assets');previous=source.asset;sha(source.sourceSha256);sha(source.restSha256);num(source.hipRatio,'hipRatio');}
 fields(value.calibration,['artifactSha256','status','scope']);sha(value.calibration.artifactSha256);if(!['unreviewed','reviewed'].includes(value.calibration.status)||value.calibration.scope!=='target-specific-locomotion')fail('declared calibration metadata');
 return JSON.parse(canonical(value)) as LocomotionCharacter3D;
}
/** Model3D presentation tint is outside skeletal identity; selector/scale are not. */
export function characterModelSelection(model:unknown):ModelSelection {
 tree(model);fields(model,['type','modelKey'],['nodeIndex','excludeNodes','origin','scale','tint']);if(model.type!=='Model3D')fail('Model3D required');
 const selected:Record<string,unknown>={modelKey:model.modelKey};for(const key of ['nodeIndex','excludeNodes','origin','scale'])if(Object.hasOwn(model,key))selected[key]=model[key];
 normalizeModelSelection(selected);return JSON.parse(canonical(selected)) as ModelSelection;
}

export function canonicalCharacterData(value:unknown):string{tree(value);return canonical(value);}

/** @internal Pure identity primitives shared with the host-only SHA/GLB adapter. */
export {tree as validateCharacterTree,fields as characterFields,sha as characterSha,num as characterPositive,canonical as canonicalCharacterValue,check as characterCheck};
