import {it,expect} from 'vitest';
import {facePoseCapability} from './face-pose.js';
it('provides only a render-only closed FacePose schema with no system or World write',()=>{const c=facePoseCapability,def=c.components.provides.FacePose3D;expect(def.sim).toBe(false);expect(c.systems).toEqual([]);expect(c.components.writes).toEqual([]);expect(def.schema?.k).toBe('obj');expect(def.refine!({version:1,channels:{smile:{mesh:'Face',morph:'Smile',weight:.5}}})).toEqual([]);expect(def.refine!({version:1,channels:{smile:{mesh:'Face',morph:'Smile',weight:2}}})).toMatchObject([{severity:'error'}]);});
