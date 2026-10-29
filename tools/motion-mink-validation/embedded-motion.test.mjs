import {describe,it,expect} from 'vitest';
import {makeMockCharacterGlb} from '../../scripts/fixtures/character-pipeline/mock-character.mjs';
import {buildEmbeddedPreview} from './embedded-motion.mjs';
import {unpackGlb} from '../../scripts/lib/motion-compose-glb.mjs';
import {composeEngine} from '../../scripts/lib/motion-compose-engine.mjs';
describe('single-parse paused preview preparation',()=>{
 it('preserves source geometry and binary, embeds a directly playable native animation without changing source',async()=>{const skin=makeMockCharacterGlb(),before=Buffer.from(skin),motion=makeMockCharacterGlb({clipName:'walk'}),result=await buildEmbeddedPreview(skin,motion,{id:'walk',fps:30,frames:31});expect(skin.equals(before)).toBe(true);const a=unpackGlb(skin),b=unpackGlb(result);expect(b.binary.subarray(0,a.binary.length).equals(a.binary)).toBe(true);expect(b.doc.meshes).toEqual(a.doc.meshes);expect(b.doc.animations.some(a=>a.name==='walk')).toBe(true);const api=await composeEngine(),loaded=await new api.GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength),'');expect(loaded.animations.find(c=>c.name==='walk')?.tracks.length).toBeGreaterThan(0);});
});
