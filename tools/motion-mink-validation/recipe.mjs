// Closed data for the local, fixed-torso upper-limb candidate backend.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const check=(ok,message)=>{if(!ok)throw new Error('motion recipe: '+message);};
const object=(o,keys,name)=>{check(o&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype,'invalid '+name);check(Object.keys(o).every(k=>keys.includes(k)),'unknown '+name+' field');};
const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
const vector=(v,a,b)=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n,a,b));
export function validateMotionRecipe(input){
 object(input,['version','kind','mode','label','source','durationS','fps','handTargetsM','handOrientations','curvesM','elbowBias','elbowWeight','qualityThresholds'],'recipe');
 check(input.version===1&&input.kind==='simple-hand-action','unsupported version/kind');check(['match-strike','hand-targets'].includes(input.mode),'unsupported mode');
 check(typeof input.label==='string'&&input.label.trim()&&input.label.length<=120,'invalid label');
 object(input.source,['skinId','baseClipId','atS'],'source');check(typeof input.source.skinId==='string'&&/^[a-z0-9][a-z0-9-]{0,119}$/.test(input.source.skinId),'invalid skin ID');check(typeof input.source.baseClipId==='string'&&/^[a-z0-9][a-z0-9-]{0,119}$/.test(input.source.baseClipId),'invalid base ID');check(finite(input.source.atS,0,1200),'invalid source time');
 check(finite(input.durationS,.5,8)&&Math.abs(input.durationS*30-Math.round(input.durationS*30))<1e-8,'duration must align to 30 FPS');check(input.fps===30,'only 30 FPS supported');
 if(input.handTargetsM!==undefined){object(input.handTargetsM,['Left','Right'],'targets');for(const side of ['Left','Right']){const p=input.handTargetsM[side];check(vector(p,-.65,.65)&&finite(p[1],-.2,.6)&&finite(p[2],.15,.65),'invalid '+side+' target');}}
 if(input.mode==='hand-targets')check(input.handTargetsM&&input.handOrientations,'hand-targets requires both targets and orientations');
 if(input.handOrientations!==undefined){object(input.handOrientations,['Left','Right'],'orientations');for(const side of ['Left','Right']){const p=input.handOrientations[side];object(p,['fingers','normal'],'orientation');check(vector(p.fingers,-1,1)&&vector(p.normal,-1,1),'invalid orientation vectors');const [a,b]=[p.fingers,p.normal],cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];check(Math.hypot(...cross)>.05,'parallel orientation vectors');}}
 if(input.curvesM!==undefined){object(input.curvesM,['Left','Right'],'curves');for(const [side,curve] of Object.entries(input.curvesM)){check(Array.isArray(curve)&&curve.length>=2&&curve.length<=64,'curve point budget');check(curve[0][0]===0&&curve.at(-1)[0]===input.durationS,'curve must span duration');let last=-1;for(const key of curve){check(Array.isArray(key)&&key.length===4&&finite(key[0],0,input.durationS)&&key[0]>last&&key.slice(1).every(n=>finite(n,-.3,.3)),'invalid curve key');last=key[0];}const origin=input.handTargetsM?.[side];if(origin)for(const key of curve)check(finite(origin[2]+key[3],.15,.65),'curve leaves front working region');}}
 if(input.elbowBias!==undefined)check(finite(input.elbowBias,0,1.5),'invalid elbow bias');if(input.elbowWeight!==undefined)check(finite(input.elbowWeight,.1,10),'invalid elbow weight');
 if(input.qualityThresholds!==undefined){object(input.qualityThresholds,['minElbowBelowShoulderM','maxElbowAboveWristM','maxTargetErrorM'],'quality thresholds');for(const [key,a,b] of [['minElbowBelowShoulderM',.03,.3],['maxElbowAboveWristM',-.2,.1],['maxTargetErrorM',.002,.03]])if(input.qualityThresholds[key]!==undefined)check(finite(input.qualityThresholds[key],a,b),'invalid '+key);}
 return JSON.parse(JSON.stringify(input));
}
export function loadMotionRecipe(path){const bytes=readFileSync(path);check(bytes.length<=32768,'recipe byte budget');return validateMotionRecipe(JSON.parse(bytes));}
export const motionRecipeSha=recipe=>createHash('sha256').update(JSON.stringify(validateMotionRecipe(recipe))).digest('hex');
