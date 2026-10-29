import {describe,it,expect} from 'vitest';
import {DICTIONARY_VERSION,getSourceDictionary,getSourceTagDefinition,sourceSemantics,validateSourceEvidence} from './lib/motion-semantics.mjs';
const row=description=>({id:'synthetic',frames:61,source:{mixamoName:'Synthetic title',description}});
describe('shared source taxonomy boundary',()=>{
 it('publishes versioned, deeply immutable metadata',()=>{
  const d=getSourceDictionary();expect(d.schemaVersion).toBe(1);expect(d.dictionaryVersion).toBe(DICTIONARY_VERSION);expect(getSourceDictionary()).toBe(d);
  expect(()=>d.facets.push({})).toThrow();expect(()=>d.facets[0].values[0].defaultLabel='changed').toThrow();expect(()=>d.groups[0].label='changed').toThrow();
  expect(new Set(d.facets.map(f=>f.id)).size).toBe(d.facets.length);
  for(const f of d.facets)expect(new Set(f.values.map(v=>v.value)).size).toBe(f.values.length);
 });
 it('derives static context and all normal proposal values from the same source rules',()=>{
  for(const item of [row('Walking then running with a rifle'),row('Receiving a strong kick'),row('Standing happily'),{...row('Push Up'),frames:2,source:{mixamoName:'Synthetic Pose',description:'Push Up'}}]){
   for(const c of sourceSemantics(item).claims){expect(getSourceTagDefinition(c.facet,c.value)).not.toBeNull();expect(validateSourceEvidence(item,{source:c.source,quote:c.quote,start:c.start,end:c.end})).toEqual({source:c.source,quote:c.quote,start:c.start,end:c.end});}
  }
  expect(getSourceTagDefinition('poseContext','exercise').defaultGroup).toBeNull();
 });
 it('keeps unknown values and reserved facets outside effective known tags',()=>{
  for(const [f,v] of [['action','synthetic-missing-motion'],['contact','right-hand'],['not-a-facet','walk'],['__proto__','constructor']])expect(getSourceTagDefinition(f,v)).toBeNull();
  for(const args of [[null,'walk'],['action',3],['x'.repeat(65),'walk']])expect(()=>getSourceTagDefinition(...args)).toThrow();
 });
 it('validates exact UTF-16 source spans without treating the quote as semantic proof',()=>{
  const input=row('🙂 Walking then dancing');const evidence={source:'description',quote:'Walking',start:3,end:10};expect(validateSourceEvidence(input,evidence)).toEqual(evidence);
  evidence.quote='changed';expect(validateSourceEvidence(input,{source:'description',quote:'dancing',start:16,end:23})).toEqual({source:'description',quote:'dancing',start:16,end:23});
 });
 it.each([
  {source:'description',quote:'Running',start:0,end:7},
  {source:'description',quote:'Walking',start:-1,end:6},
  {source:'description',quote:'Walking',start:0.5,end:7},
  {source:'description',quote:'Walking',start:0,end:8},
  {source:'visual',quote:'Walking',start:0,end:7},
  {source:'description',quote:'Walking',start:0,end:7,approved:true},
 ])('rejects malformed or forged evidence %j',e=>expect(()=>validateSourceEvidence(row('Walking'),e)).toThrow());
 it('validates title fallback consistently, and returns a detached copy',()=>{
  const input={id:'Walking'},claim=sourceSemantics(input).claims[0];const e={source:claim.source,quote:claim.quote,start:claim.start,end:claim.end};const result=validateSourceEvidence(input,e);expect(result).toEqual(e);expect(result).not.toBe(e);
  expect(()=>validateSourceEvidence(row('Walking'),{source:'title',quote:'Walking',start:0,end:7})).toThrow();
 });
});


it('keeps dictionary defaults distinct from contextual labels and grouping',()=>{
 const result=sourceSemantics(row('Kicking a soccer ball'));expect(result.groups).toEqual(['daily']);expect(result.claims.find(c=>c.value==='kick').label).toBe('踢球');
 const definition=getSourceTagDefinition('action','kick');expect(definition.defaultGroup).toBe('combat');expect(definition.defaultLabel).toBe('踢击');expect(definition).not.toHaveProperty('group');expect(definition).not.toHaveProperty('label');
});
