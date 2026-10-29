import {describe,it,expect} from 'vitest';
import {buildMatchGirlPlan} from './story-plan.mjs';
const sha='a'.repeat(64);
const clip=(id,description,title='Unrelated title')=>({id,sha256:sha,source:{mixamoName:title,...(description===undefined?{}:{description})}});
const find=(plan,id)=>plan.requirements.find(r=>r.id===id);
describe('story draft proposal',()=>{
 it('preserves 7 design items and separates expression confirmation from story completion',()=>{
  const p=buildMatchGirlPlan({clips:[]});expect(p.status).toBe('draft');expect(p.counts.designChecklistItems).toBe(7);
  expect(p.requirements.filter(r=>r.origin==='design-seven')).toHaveLength(7);
  expect(p.counts.verifiedExpressionExamples).toBe(1);expect(p.counts.verifiedStoryRequirements).toBe(0);
  expect(p.counts.unverifiedCompleteRequirements).toBe(p.requirements.length);
  expect(find(p,'strike-match').verification.scope).toBe('user-confirmed-single-example-expression');
  expect(find(p,'strike-match').verification.reference).toMatchObject({candidateId:'generated-4d41f703a6db6b750801',version:'v022',skin:'Claire'});
  expect(p.counts.notVisuallyVerifiedRequirements).toBe(18);expect(p.counts.withoutExpressionConfirmation).toBe(17);
 });
 it('uses Description before title or old category, leaving title-only evidence explicit',()=>{
  const p=buildMatchGirlPlan({clips:[{...clip('wrong','Walking Forward','Reaching Out Gesture'),category:'interaction'},clip('right','Reaching Out Gesture'),clip('fallback',undefined,'Reaching Out Gesture')]});
  const r=find(p,'grandma-reach');expect(r.candidates.map(c=>c.id)).toEqual(['right','fallback']);
  expect(r.candidates[0]).toMatchObject({sha256:sha,evidenceQuote:'Reaching Out Gesture',basis:'description',scope:'clip-source'});
  expect(r.candidates[1].basis).toBe('title-fallback');expect(r.missingStatus).toBe('candidate-only');
 });
 it('accepts only exact legacy source envelope, retaining original quote',()=>{
  const row=clip('legacy',undefined,'Kneel');row.descEn='Source title: Kneel. Source description: Kneeling Warming Hands Over Campfire. Draft from source text; playback not visually confirmed.';
  const c=find(buildMatchGirlPlan({clips:[row]}),'warm-hands').candidates[0];
  expect(c.description).toBe('Kneeling Warming Hands Over Campfire');expect(c.evidenceQuote.slice(c.rationale.start,c.rationale.end)).toBe(c.rationale.matchedQuote);
 });
 it('bounds references to 3, sorts IDs deterministically, never mutates source',()=>{
  const rows=['z','c','a','b'].map(id=>clip(id,'Reaching Out Gesture'));const before=JSON.stringify(rows);
  const p=buildMatchGirlPlan({clips:rows});expect(find(p,'grandma-reach').candidates.map(c=>c.id)).toEqual(['a','b','c']);
  expect(JSON.stringify(rows)).toBe(before);p.sources[0].path='changed';expect(buildMatchGirlPlan({clips:[]}).sources[0].path).not.toBe('changed');
 });
 it('keeps derived source as base reference, never new action fact',()=>{
  const row={...clip('derived','Reaching Out Gesture'),derivedFrom:{clipId:'base'}};
  expect(find(buildMatchGirlPlan({clips:[row]}),'grandma-reach').candidates[0].scope).toBe('base-reference');
 });
 it('does not turn no retrieval hit, warming up sport, or dance freeze into missing-library claims',()=>{
  const p=buildMatchGirlPlan({clips:[clip('sport','Baseball Batter Warming Up On Deck'),clip('dance','Breakdance Single Handstand Freeze')]});
  expect(find(p,'warm-hands').candidates).toEqual([]);expect(find(p,'girl-shiver').candidates).toEqual([]);
  expect(find(p,'warm-hands').retrievalStatus).toBe('no-reference-found-by-this-query');
 });
 it('keeps goose nonhumanoid and grandmother carrying outside current backend',()=>{
  const p=buildMatchGirlPlan({clips:[clip('hug','Hugging A Child')]});
  expect(find(p,'grandma-lift')).toMatchObject({category:'multi-character',method:'out-of-scope'});
  expect(find(p,'ascent').method).toBe('out-of-scope');expect(find(p,'roast-goose')).toMatchObject({label:'插着刀叉的烤鹅走来',category:'scene',method:'needs-authoring',candidates:[]});
  expect(find(p,'whole-hand-matches').verification.expressionConfirmed).toBe(false);
 });
 it('does not confuse aiming while sitting or reaching hands at toes with desired actions',()=>{
  const p=buildMatchGirlPlan({clips:[clip('gun','Aim Pistol While Sitting'),clip('toes','Reaching Hands Towards Toes')]});
  expect(find(p,'girl-shiver').candidates).toEqual([]);expect(find(p,'feet-stove').candidates).toEqual([]);
 });
 it('rejects invalid or duplicated identity rather than inventing clip identity',()=>{
  expect(()=>buildMatchGirlPlan({})).toThrow();expect(()=>buildMatchGirlPlan({clips:[{id:'x'}]})).toThrow();
  expect(()=>buildMatchGirlPlan({clips:[clip('same','x'),clip('same','y')]})).toThrow();
 });
});
