import {describe,it,expect} from 'vitest';
import {validateFacePoses} from './face-poses.js';
import {parseManifest} from './manifest.js';
import {parseManifestAsync} from './manifest-async.js';
import {expandSceneImports} from './scene-import.js';
import {Engine} from '@runtime/engine.js';
const scene=():any=>({actor:{Model3D:{modelKey:'skin'},FacePose3D:{version:1,channels:{smile:{mesh:'Face',morph:'Smile',weight:.4}}}}});
describe('Face assembly references',()=>{
 it('accepts constant morph declarations without inventing native morph availability',()=>{const s=scene();const before=JSON.stringify(s);validateFacePoses(s);expect(JSON.stringify(s)).toBe(before);});
 it.each([undefined,{}, {modelKey:''}])('requires a model %s',model=>{const s=scene();s.actor.Model3D=model;expect(()=>validateFacePoses(s)).toThrow();});
 it('requires a declared performance slot for driven morph curves',()=>{const s=scene();s.actor.FacePose3D.channels.smile.weight={source:'performance-slot',slot:'upper',points:[{atTick:0,value:0}]};expect(()=>validateFacePoses(s)).toThrow();});
 it('rejects getters before reading any component value',()=>{const s=scene();let calls=0;Object.defineProperty(s.actor,'FacePose3D',{enumerable:true,get(){calls++;return {};}});expect(()=>expandSceneImports(s)).toThrow(/accessor/);expect(calls).toBe(0);});
 it('shares sync/async manifest and direct Engine validation',async()=>{const s=scene(),a=parseManifest({entities:s}),b=await parseManifestAsync({entities:s});expect(a.entities).toEqual(b.entities);expect(a.capabilities.some(c=>c.id==='t2-face-pose')).toBe(true);const e=new Engine();expect(()=>e.load(a)).not.toThrow();});
});
