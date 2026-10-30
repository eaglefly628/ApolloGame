// Draft migration only. The POSIX helper holds both directory locks for validation and publication.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {types} from 'node:util';
export const SEMANTIC_MIGRATION_STAGING='.semantic-review.migration-staging';
const helper=fileURLToPath(new URL('./motion-semantic-migrate-fs.py',import.meta.url));
// Descriptor-only JSON input copying: never read a getter or invoke caller toJSON hooks.
function fields(value,allowed,required,name){
 if(!value||typeof value!=='object'||types.isProxy(value)||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error('semantic migration: invalid '+name);
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.some(key=>typeof key!=='string'||!allowed.includes(key)||!descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value'))||required.some(key=>!Object.hasOwn(descriptors,key)))throw new Error('semantic migration: invalid '+name+' fields');
 const copy=Object.create(null);for(const key of keys)copy[key]=descriptors[key].value;return copy;
}
function bindingData(value){
 const copy=fields(value,['sourceCatalogSha256','sourceHead','targetCatalogSha256','dictionaryVersion','sourceHistorySha256'],['sourceCatalogSha256','sourceHead','targetCatalogSha256','dictionaryVersion'],'expected binding');
 copy.sourceHead=fields(copy.sourceHead,['revision','eventSha256'],['revision','eventSha256'],'expected source head');
 const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 if(Object.hasOwn(copy,'sourceHistorySha256')&&!sha(copy.sourceHistorySha256))throw new Error('semantic migration: invalid expected history SHA');
 if(!sha(copy.sourceCatalogSha256)||!sha(copy.targetCatalogSha256)||typeof copy.dictionaryVersion!=='string'||!copy.dictionaryVersion||copy.dictionaryVersion.length>128||!Number.isSafeInteger(copy.sourceHead.revision)||copy.sourceHead.revision<0||!(copy.sourceHead.eventSha256===null||sha(copy.sourceHead.eventSha256)))throw new Error('semantic migration: invalid expected binding data');
 return copy;
}
/** Default dry-run. Apply requires the complete binding returned by a prior plan. No approval operations. */
export function migrateSemanticDrafts(options){
 if(process.platform==='win32')throw new Error('semantic migration: local POSIX Python 3 dir_fd/flock required');
 const data=fields(options,['sourceLib','targetLib','apply','expected'],['sourceLib','targetLib'],'options');
 const {sourceLib,targetLib,apply=false}=data;
 if(typeof sourceLib!=='string'||!sourceLib||typeof targetLib!=='string'||!targetLib||typeof apply!=='boolean')throw new Error('semantic migration: explicit sourceLib/targetLib and boolean apply required');
 if(apply&&(!data.expected||typeof data.expected!=='object'))throw new Error('semantic migration: apply requires expected binding');
 const expected=data.expected===undefined||data.expected===null?null:bindingData(data.expected);
 const input=JSON.stringify(Object.assign(Object.create(null),{protocolVersion:1,sourceLib:resolve(sourceLib),targetLib:resolve(targetLib),nodeExecutable:process.execPath,apply,expected}));
 if(Buffer.byteLength(input)>32768)throw new Error('semantic migration: request byte budget');
 const result=spawnSync('python3',[helper],{input,encoding:'utf8',maxBuffer:32*1024*1024,timeout:120000});
 if(result.error)throw new Error('semantic migration: local transaction unavailable: '+result.error.message);
 if(result.status!==0)throw new Error((result.stderr||'semantic migration: filesystem transaction failed').trim());
 return JSON.parse(result.stdout);
}
