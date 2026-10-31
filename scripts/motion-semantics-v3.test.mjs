import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceSemantics,getSourceDictionary,getSourceTagDefinition,validateSourceEvidence} from './lib/motion-semantics.mjs';
const row=(description,extra={})=>({id:'synthetic',frames:61,source:{mixamoName:'Synthetic motion',description},...extra});
const values=(s,facet='action')=>s.claims.filter(c=>c.facet===facet).map(c=>c.value);
const parse=text=>sourceSemantics(row(text));

describe('source v3 evidence refinement',()=>{
 it.each([
  ['Cheering gently','cheer'],['Yelling while seated','shout'],['Sneaking past an object','sneak'],
  ['Leaning beside a wall','lean'],['Shivering in a corner','shiver'],['Warming hands by a campfire','warm-hands'],
  ['Smiling at someone','smile'],['A quick formal bow','bow'],['Nodding in agreement','nod'],['Shrugging','shrug'],
  ['Grabbing a small item','grab'],['Putting down an object','put-down'],['Putting the rifle away','put-away'],
  ['Reloading a rifle','reload'],['Playing a guitar','play-instrument'],['Petting a cat','pet'],['Digging a trench','dig'],
  ['Dealing cards slowly','deal-cards'],['Rubbing an arm','rub'],['Making a fist pump','fist-pump'],
  ['Giving a thumbs up','thumbs-up'],['Entering an access code','type-input'],['Rallying a group to make them cheer','rally'],
 ])('recognizes explicit source behavior: %s',(text,value)=>{
  const s=parse(text);expect(values(s)).toContain(value);expect(s.status).toBe('draft');
  for(const c of s.claims)expect(validateSourceEvidence(row(text),{source:c.source,quote:c.quote,start:c.start,end:c.end}).quote).toBe(c.quote);
 });
 it.each([
  ['Entering a password','enter'],['Picking low hanging fruit','hang'],['Rallying a crowd to make them cheer','cheer'],
  ['Being gently placed on a sofa','place'],['Being kissed by a friend','kiss'],['Walking with a pet','pet'],
  ['Staying in one place','place'],['Pitching an idea','pitch'],['Holding a light torch','light-fire'],
  ['Shooting a basketball','shoot'],['A soccer match','match'],['Blowing a kiss','kiss'],
 ])('rejects another meaning or performer: %s',(text,value)=>expect(values(parse(text))).not.toContain(value));
 it('keeps a real placed-object performer distinct from a recipient',()=>{
  expect(values(parse('Gently placing an object on a desk'))).toContain('place');
  const passive=parse('Being gently placed on a sofa');expect(values(passive)).toContain('placement-reaction');expect(values(passive,'role')).toContain('recipient');
  expect(values(parse('Blowing a kiss'))).toContain('blow-kiss');
 });
 it('does not confuse a back touch with a body posture or a bow with a weapon',()=>{
  expect(values(parse('Patting on the back'),'posture')).not.toContain('lying');
  expect(values(parse('An informal bow'),'propMention')).not.toContain('bow');
  expect(values(parse('Holding a bow'),'propMention')).toContain('bow');
  expect(values(parse('Lying on the back'),'posture')).toContain('lying');
 });
 it('keeps static poses as context and can read their explicit posture title',()=>{
  const s=sourceSemantics(row('Leaning forward with arms crossed',{frames:2,source:{mixamoName:'Synthetic Sitting Pose',description:'Leaning forward with arms crossed'}}));
  expect(values(s)).toEqual([]);expect(values(s,'poseContext')).toContain('lean');expect(values(s,'posture')).toContain('seated');expect(s.groups).toEqual(['pose']);
 });
 it('separates a stated start and end without assigning timing or contact',()=>{
  const s=parse('Crouching to standing');expect(values(s,'startPosture')).toEqual(['crouched']);expect(values(s,'endPosture')).toEqual(['standing']);
  expect(values(s,'contact')).toEqual([]);expect(values(s,'phases')).toEqual([]);
  for(const c of s.claims)expect('Crouching to standing'.slice(c.start,c.end)).toBe(c.quote);
  const reverse=parse('Standing from a lying prone');expect(values(reverse,'startPosture')).toEqual(['prone']);expect(values(reverse,'endPosture')).toEqual(['standing']);
 });
 it('keeps same standing cover/ready states out of lower-body posture change',()=>{
  const s=parse('Standing cover to standing ready');expect(values(s)).not.toContain('posture-transition');expect(values(s)).toContain('state-transition');
  expect(values(s,'startPosture')).toEqual(['standing']);expect(values(s,'endPosture')).toEqual(['standing']);
 });
 it('does not invent endpoints for preparation, negation or multiple state changes',()=>{
  for(const text of ['Not crouching to standing','Getting ready to sit to stand','Standing to sitting then crouching to kneeling']){
   const s=parse(text);expect(values(s,'startPosture')).toEqual([]);expect(values(s,'endPosture')).toEqual([]);
  }
 });
 it('preserves purpose labels as intent-only with visible source scope',()=>{
  const s=parse('Lunging forward to bite');expect(values(s)).toContain('lunge');
  expect(s.claims.find(c=>c.value==='bite')).toMatchObject({intentOnly:true,quote:'to bite'});
  expect(s.claims.find(c=>c.value==='lunge').intentOnly).toBeUndefined();
  const prep=parse('Getting ready to kick');expect(prep.claims.find(c=>c.value==='kick').intentOnly).toBe(true);expect(values(prep,'role')).not.toContain('recipient');
 });
 it('prefers a later performed claim over a preceding intention of the same action',()=>{
  const s=parse('Preparing to grab then grabbing an object');const c=s.claims.find(c=>c.value==='grab');expect(c.intentOnly).toBeUndefined();expect(c.quote.toLowerCase()).toBe('grabbing');
 });
 it('adds explicit emotion inflections without assigning default or other-person emotion',()=>{
  expect(values(parse('Standing angrily'),'emotion')).toEqual(['angry']);expect(values(parse('Seated happily'),'emotion')).toEqual(['happy']);
  expect(values(parse('Walking with a terrified friend'),'emotion')).toEqual([]);expect(values(parse('Standing'),'emotion')).toEqual([]);
 });
 it('keeps a versioned immutable taxonomy and exact frozen v2 results',()=>{
  const legacy=sourceSemantics(row('Standing angrily'),{dictionaryVersion:'source-description-v2'});expect(values(legacy,'emotion')).toEqual([]);
  expect(getSourceDictionary('source-description-v2').dictionaryVersion).toBe('source-description-v2');expect(getSourceTagDefinition('action','warm-hands','source-description-v2')).toBeNull();
  expect(getSourceTagDefinition('action','warm-hands')).not.toBeNull();expect(getSourceTagDefinition('startPosture','standing')).not.toBeNull();
  expect(()=>getSourceDictionary('invented')).toThrow(/version/);expect(()=>getSourceDictionary().facets[0].values.push({})).toThrow();
  const bytes=readFileSync(new URL('./lib/motion-semantics-v2.mjs',import.meta.url));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('681170ef5556323b0c69cee05fbc17020ad8b5cbefb076450009bd5f56c10a66');
 });
});
