/** Convert accepted distance into a gait group's reference distance using the
 * weight-averaged measured stride. Q=10000/m. Fractional reference-Q carry has
 * a fixed 1e6 denominator, so changing weights never reinterprets a remainder.
 * Each inexact division discards strictly less than one micro reference-Q;
 * discardedDivisionSteps is a conservative cumulative loss bound, not a score.
 */
import {validateGaitPhaseGroup} from './gait-phase.js';
import type {GaitPhaseGroupV1} from './gait-phase.js';
const MICRO=1000000;
export interface WeightedGaitDistanceState {
 readonly version:1;readonly configCanonical:string;readonly referenceRemainderMicroQ:number;
 readonly discardedDivisionSteps:number;readonly tick:number;
}
function fail(message:string):never{throw new Error('WeightedGaitDistance: '+message);}
function int(v:unknown,min:number,max:number):asserts v is number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)fail('integer range');}
function object(v:unknown,keys?:string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('plain object');
 if(Object.getOwnPropertySymbols(v).length||Object.getOwnPropertyNames(v).length!==Object.keys(v).length)fail('enumerable fields');
 const ds=Object.getOwnPropertyDescriptors(v);for(const d of Object.values(ds))if(!('value'in d))fail('accessor');
 const k=Object.keys(v);if(keys&&(k.length!==keys.length||k.some(x=>!keys.includes(x))))fail('closed fields');return v as Record<string,unknown>;
}
function canonical(v:unknown):string{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';}
export function createWeightedGaitDistance(group:GaitPhaseGroupV1):WeightedGaitDistanceState{
 validateGaitPhaseGroup(group);return{version:1,configCanonical:canonical(group),referenceRemainderMicroQ:0,discardedDivisionSteps:0,tick:0};
}
export function stepWeightedGaitDistance(group:GaitPhaseGroupV1,state:WeightedGaitDistanceState,weights:Readonly<Record<string,number>>,acceptedDistanceQ:number):{state:WeightedGaitDistanceState;referenceDistanceQ:number;active:boolean}{
 validateGaitPhaseGroup(group);object(state,['version','configCanonical','referenceRemainderMicroQ','discardedDivisionSteps','tick']);
 if(state.version!==1||state.configCanonical!==canonical(group))fail('state identity');int(state.referenceRemainderMicroQ,0,MICRO-1);int(state.discardedDivisionSteps,0,Number.MAX_SAFE_INTEGER-1);int(state.tick,0,Number.MAX_SAFE_INTEGER-1);
 object(weights);if(Object.keys(weights).length>128)fail('weight budget');int(acceptedDistanceQ,0,1000000000);
 let total=0n,weightedStride=0n;
 for(const alias of Object.keys(weights).sort()){
  if(!Object.hasOwn(group.members,alias))fail('unknown member');const weight=weights[alias];int(weight,0,1000000);
  total+=BigInt(weight);weightedStride+=BigInt(weight)*BigInt(group.members[alias].strideDistanceQ);
 }
 const next={...state,tick:state.tick+1};if(total===0n)return{state:next,referenceDistanceQ:0,active:false};
 const numerator=BigInt(acceptedDistanceQ)*BigInt(group.referenceStrideDistanceQ)*total*BigInt(MICRO),micro=numerator/weightedStride;
 if(numerator%weightedStride!==0n)next.discardedDivisionSteps++;
 const accumulated=micro+BigInt(state.referenceRemainderMicroQ),distance=accumulated/BigInt(MICRO);
 if(distance>1000000000n)fail('reference distance budget');next.referenceRemainderMicroQ=Number(accumulated%BigInt(MICRO));
 return{state:next,referenceDistanceQ:Number(distance),active:true};
}
