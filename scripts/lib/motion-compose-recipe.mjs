import { check, motionId, validateAnnotations } from './motion-catalog.mjs';
export function canonical(value) { return JSON.stringify(value, (_key,v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v); }
function plain(value, depth=0, ancestors=new Set()) {
  check(depth<=16,'recipe exceeds depth budget');
  if(!value||typeof value!=='object'){check(['string','number','boolean'].includes(typeof value)||value===null,'recipe must be JSON data');if(typeof value==='number')check(Number.isFinite(value),'recipe contains nonfinite number');return;}
  check(!ancestors.has(value),'recipe contains cycle');ancestors.add(value);
  check(Array.isArray(value)?Object.getPrototypeOf(value)===Array.prototype:[Object.prototype,null].includes(Object.getPrototypeOf(value)),'recipe must contain plain data');
  check(Reflect.ownKeys(value).length<=36002,'recipe object budget');
  if(Array.isArray(value)){check(Object.keys(value).length===value.length,'recipe array must be dense');for(const key of Reflect.ownKeys(value))check(key==='length'||typeof key==='string'&&/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<value.length,'unknown recipe array field');}
  for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);check(typeof key==='string'&&Object.hasOwn(d,'value'),'recipe accessors are forbidden');plain(d.value,depth+1,ancestors);}
  ancestors.delete(value);
}
export function record(value, keys, label) {check(value&&typeof value==='object'&&!Array.isArray(value),`${label} must be object`);for(const key of Object.keys(value))check(keys.includes(key),`${label}: unknown field ${key}`);return value;}
function number(n,min,max,label){check(typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max,`${label} must be ${min}..${max}`);}
function tuple(v,label){check(Array.isArray(v)&&v.length===3,`${label} requires 3 numbers`);v.forEach(n=>number(n,-1000,1000,label));}
function named(name){check(typeof name==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,119}$/.test(name),'invalid recipe identifier');}
function value(v){check(typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1,'parameter value must be boolean or 0..1');}
/** Static bounds and native schema validation; target bone existence is checked after loading. */
export async function validateRecipe(recipe, api) {
  plain(recipe);check(Buffer.byteLength(canonical(recipe))<=1024*1024,'recipe byte budget exceeded');
  record(recipe,['version','id','base','skin','fps','durationS','anchors','ik','params','flags','cues','annotations'],'recipe');
  check(recipe.version===1,'recipe version must be 1');for(const key of ['id','base','skin'])motionId(recipe[key]);
  check(recipe.id!==recipe.base,'derived id must differ from base');
  check(Number.isInteger(recipe.fps)&&recipe.fps>=1&&recipe.fps<=120,'fps must be integer 1..120');number(recipe.durationS,1/120,300,'durationS');
  check(Math.abs(recipe.durationS*recipe.fps-Math.round(recipe.durationS*recipe.fps))<1e-7,'duration must end at a sample boundary');
  check(Array.isArray(recipe.anchors)&&recipe.anchors.length<=64,'anchors budget 0..64');const ids=new Set(['actor']);
  for(const anchor of recipe.anchors){record(anchor,['id','kind','position','rot','attach','trajectory'],'anchor');named(anchor.id);check(!ids.has(anchor.id),'duplicate anchor id');ids.add(anchor.id);check(['prop','point'].includes(anchor.kind),'anchor kind must be prop or point');
    if(anchor.attach){api.validateAttach3D(anchor.attach);check(anchor.attach.parentId==='actor','attachment parent must be actor');check(anchor.position===undefined&&anchor.rot===undefined,'attached anchor uses attach offset/rot');tuple(anchor.attach.offset,'attach.offset');tuple(anchor.attach.rot,'attach.rot');}
    else {tuple(anchor.position,'anchor.position');tuple(anchor.rot,'anchor.rot');}
    if(anchor.trajectory!==undefined){check(Array.isArray(anchor.trajectory)&&anchor.trajectory.length>=2&&anchor.trajectory.length<=2048,'trajectory requires 2..2048 keys');let previous=-1;for(const key of anchor.trajectory){record(key,['at','position','rot'],'trajectory key');number(key.at,0,recipe.durationS,'trajectory at');check(key.at>previous,'trajectory times must increase');previous=key.at;tuple(key.position,'trajectory position');if(key.rot!==undefined)tuple(key.rot,'trajectory rot');}check(anchor.trajectory[0].at===0&&anchor.trajectory.at(-1).at===recipe.durationS,'trajectory must cover entire duration');}
  }
  record(recipe.params, Object.keys(recipe.params||{}),'params');record(recipe.flags,Object.keys(recipe.flags||{}),'flags');check(Object.keys(recipe.params).length<=64&&Object.keys(recipe.flags).length<=64,'parameter/flag budget');
  for(const [name,v] of Object.entries(recipe.flags)){named(name);check(typeof v==='boolean','flag must be boolean');}
  for(const [name,v] of Object.entries(recipe.params)){named(name);if(v&&typeof v==='object'){record(v,['flag'],'parameter binding');named(v.flag);check(Object.hasOwn(recipe.flags,v.flag),'flag binding missing initial flag');}else value(v);}
  check(Array.isArray(recipe.cues)&&recipe.cues.length<=2048,'cues budget 0..2048');let previous=-1;const cueKeys=new Set();
  for(const cue of recipe.cues){record(cue,['at','kind','name','value'],'cue');number(cue.at,0,recipe.durationS,'cue at');check(cue.at>=previous,'cues must be time ordered');previous=cue.at;check(['flag','parameter'].includes(cue.kind),'cue kind must be flag or parameter');named(cue.name);const key=`${cue.at}:${cue.kind}:${cue.name}`;check(!cueKeys.has(key),'duplicate cue at same time');cueKeys.add(key);if(cue.kind==='flag')check(Object.hasOwn(recipe.flags,cue.name)&&typeof cue.value==='boolean','unknown/nonboolean flag cue');else{check(Object.hasOwn(recipe.params,cue.name)&&typeof recipe.params[cue.name]!=='object','parameter cue must name direct initial parameter');value(cue.value);}}
  api.validateIK3D(recipe.ik);const constraints=[...recipe.ik.chains,...(recipe.ik.lookAt?[recipe.ik.lookAt]:[])];
  for(const c of constraints){check(ids.has(c.target.entity),'unknown target entity');tuple(c.target.offset,'target offset');if(c.pole)tuple(c.pole,'pole');if(typeof c.weight==='object')check(Object.hasOwn(recipe.params,c.weight.param),'missing IK parameter');}
  validateAnnotations(recipe.annotations);check(Object.keys(recipe.annotations).length===7,'annotations has unknown fields');return recipe;
}
