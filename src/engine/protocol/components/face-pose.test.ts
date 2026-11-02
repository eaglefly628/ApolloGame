import { describe, it, expect } from 'vitest';
import { validate, type Schema } from '../../core/schema.js';
import { FACE_POSE_SCHEMAS, validateFacePose3D, sampleFaceCurve, type FacePose3D } from './face-pose.js';
const fixture = ():FacePose3D => ({type:'FacePose3D',version:1,channels:{smile:{mesh:'Face',morph:'Smile',weight:.5},jaw:{mesh:'Face',morph:'Jaw',weight:{source:'performance-slot',slot:'upper',points:[{atTick:0,value:0},{atTick:4,value:1}]}}}});
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
describe('FacePose3D closed render-only protocol',()=>{
 it('defines real nested schemas and accepts constant and slot curves',()=>{const c=fixture();expect(validateFacePose3D(c)).toBe(c);const {type:_,...raw}=c;expect(validate(FACE_POSE_SCHEMAS.FacePose3D,raw)).toEqual([]);const walk=(s:Schema):void=>{expect(s.k).not.toBe('any');if(s.k==='obj')Object.values(s.props).forEach(walk);if(s.k==='rec'||s.k==='arr'||s.k==='opt')walk(s.of);if(s.k==='union')s.of.forEach(walk);};walk(FACE_POSE_SCHEMAS.FacePose3D);});
 it.each([
  (x:any)=>x.version=2,(x:any)=>x.channels={},(x:any)=>x.extra=true,(x:any)=>x.channels.smile.mesh='',
  (x:any)=>x.channels.smile.morph='\u0000Smile',(x:any)=>x.channels.smile.weight=-.01,(x:any)=>x.channels.smile.weight=1.01,(x:any)=>x.channels.smile.weight=NaN,
  (x:any)=>x.channels.jaw.weight.source='clock',(x:any)=>x.channels.jaw.weight.slot='*',(x:any)=>x.channels.jaw.weight.points=[],
  (x:any)=>x.channels.jaw.weight.points[1].atTick=0,(x:any)=>x.channels.jaw.weight.points[1].atTick=1.2,(x:any)=>x.channels.jaw.weight.points[1].atTick=10000001,
  (x:any)=>x.channels.jaw.weight.points[1].value=Infinity,(x:any)=>x.channels.jaw.weight.points[1].unused=true,
  (x:any)=>x.channels.jaw.morph='Smile',(x:any)=>x.channels.jaw.weight.points=Array.from({length:129},(_,atTick)=>({atTick,value:0})),
  (x:any)=>x.channels=Object.fromEntries(Array.from({length:65},(_,i)=>['c'+i,{mesh:'Face',morph:'m'+i,weight:0}])),
 ])('rejects bad source data %#',mutate=>{const c=clone(fixture());mutate(c);expect(()=>validateFacePose3D(c)).toThrow();});
 it('refuses getters, hidden serializers and shared points without invoking them',()=>{let calls=0;const getter=()=>{calls++;return .5;};for(const kind of ['getter','hidden','shared','symbol']){const c=fixture() as any;if(kind==='getter')Object.defineProperty(c.channels.smile,'weight',{enumerable:true,get:getter});if(kind==='hidden')Object.defineProperty(c,'toJSON',{value:getter});if(kind==='shared')c.channels.jaw.weight.points[1]=c.channels.jaw.weight.points[0];if(kind==='symbol')c[Symbol('x')]=0;expect(()=>validateFacePose3D(c)).toThrow();}expect(calls).toBe(0);});
 it('linearly samples section-local ticks with endpoint clamping',()=>{const c=fixture().channels.jaw.weight;expect(typeof c).toBe('object');if(typeof c==='number')throw Error();for(const [tick,value] of [[0,0],[1,.25],[2,.5],[3,.75],[4,1],[100,1]])expect(sampleFaceCurve(c,tick)).toBe(value);expect(()=>sampleFaceCurve(c,.5)).toThrow();});
});
