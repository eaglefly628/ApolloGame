import {describe,it,expect} from 'vitest';
import {sourceDescription,sourceSemantics,summarizeSemantics} from './lib/motion-semantics.mjs';
const clip=(description,extra={})=>({id:'synthetic-action',frames:61,category:'pose',emotion:['neutral'],source:{mixamoName:'Synthetic action',description},...extra});
const values=(a,facet)=>a.claims.filter(c=>c.facet===facet).map(c=>c.value);
describe('Description-derived motion proposals',()=>{
 it('uses Description over a contradictory title and does not trust legacy category/emotion',()=>{
  const a=sourceSemantics(clip('Walking forward with a rifle',{source:{mixamoName:'Running dance',description:'Walking forward with a rifle'}}));
  expect(a.groups).toEqual(['locomotion']);expect(values(a,'action')).toEqual(['walk']);expect(values(a,'emotion')).toEqual([]);expect(values(a,'propMention')).toEqual(['rifle']);expect(values(a,'direction')).toEqual(['forward']);expect(a.unknownFacets).toContain('contact');expect(a.status).toBe('draft');
 });
 it('classifies dances as dances, not the old pose default',()=>{const a=sourceSemantics(clip('Dancing slowly with both hands raised'));expect(a.groups).toContain('dance');expect(a.groups).not.toContain('pose');expect(values(a,'style')).toEqual(['slow']);expect(values(a,'bodyPart')).toEqual(['both-hands']);});
 it('never treats a two-frame static pose as moving exercise',()=>{const a=sourceSemantics(clip('Push Up',{frames:2,source:{mixamoName:'Synthetic Pose',description:'Push Up'}}));expect(a.groups).toEqual(['pose']);expect(values(a,'action')).toEqual([]);expect(values(a,'poseContext')).toEqual(['exercise']);});
 it('keeps exact evidence spans, including Unicode context',()=>{const d='测试：Walking backwards, right hand raised.';const a=sourceSemantics(clip(d));for(const c of a.claims)expect(d.slice(c.start,c.end)).toBe(c.quote);expect(values(a,'direction')).toEqual(['backward']);expect(values(a,'bodyPart')).toEqual(['right-hand']);expect(values(a,'direction')).not.toContain('right');});
 it('skips negated claims and keeps omitted facts unknown',()=>{const a=sourceSemantics(clip('Standing, not walking, without a rifle.'));expect(values(a,'action')).not.toContain('walk');expect(values(a,'propMention')).not.toContain('rifle');expect(a.warnings).toContain('negated-mention-skipped');expect(a.unknownFacets).toContain('emotion');});
 it('keeps sports shots out of weapon shooting and push-ups out of pushing',()=>{const golf=sourceSemantics(clip('Golf shot'));expect(golf.groups).toEqual(['daily']);expect(values(golf,'action')).not.toContain('shoot');const soccer=sourceSemantics(clip('Kicking a soccer ball'));expect(soccer.groups).toEqual(['daily']);expect(soccer.claims.find(c=>c.value==='kick').label).toBe('踢球');expect(values(sourceSemantics(clip('Push Up')),'action')).not.toContain('push');});
 it('exposes known posture without inventing a movement or neutral emotion',()=>{const a=sourceSemantics(clip('Standing'));expect(a.groups).toEqual(['posture']);expect(a.unknownFacets).toContain('action');expect(a.unknownFacets).toContain('emotion');});
 it('extracts only the exact legacy source envelope and preserves internal punctuation',()=>{
  const row={id:'synthetic',source:{mixamoName:'Synthetic. Title'},descEn:'Source title: Synthetic. Title. Source description: A chat. Then a wave. Draft from source text; playback not visually confirmed.'};
  expect(sourceDescription(row)).toBe('A chat. Then a wave');expect(sourceDescription({...row,descEn:'Invented annotation, not original source'})).toBeNull();
 });
 it('reports title fallback and unknown coverage instead of inventing labels',()=>{
  const rows=[clip('Unspecified motion'),{id:'mystery',source:{mixamoName:'Walking'}}];const s=summarizeSemantics(rows);
  expect(s.total).toBe(2);expect(s.descriptions).toBe(1);expect(s.titleFallback).toBe(1);expect(s.unclassified).toBe(1);expect(sourceSemantics(rows[1]).basis).toBe('title');
 });
 it('distinguishes a recipient or dodger from the performer of an attack',()=>{const hit=sourceSemantics(clip('Receiving a light hit from a punch'));expect(values(hit,'action')).not.toContain('punch');expect(values(hit,'role')).toContain('recipient');const shot=sourceSemantics(clip('Being shot with a rifle'));expect(values(shot,'action')).not.toContain('shoot');expect(shot.groups).toContain('reaction');const dodge=sourceSemantics(clip('Dodging a punch'));expect(values(dodge,'action')).toContain('dodge');expect(values(dodge,'action')).not.toContain('punch');});
 it('uses a title to supplement absent behavior but not an explicit negation',()=>{const a=sourceSemantics(clip('Arms raised',{source:{mixamoName:'Synthetic Dance',description:'Arms raised'}}));expect(a.groups).toContain('dance');expect(a.claims.find(c=>c.value==='dance').source).toBe('title');expect(a.basis).toBe('description');const b=sourceSemantics(clip('Not walking',{source:{mixamoName:'Walking',description:'Not walking'}}));expect(values(b,'action')).not.toContain('walk');});
 it('is deterministic, immutable and retains multiple behavior facets',()=>{
  const row=clip('Talking while seated and holding a phone');const before=JSON.stringify(row),a=sourceSemantics(row);
  expect(a.groups).toEqual(['gesture','interaction']);expect(values(a,'posture')).toEqual(['seated']);expect(a).toEqual(sourceSemantics(row));expect(JSON.stringify(row)).toBe(before);
 });
});

describe('independent review counterexamples',()=>{
 it('keeps affirmative clauses after a negation',()=>{const a=sourceSemantics(clip('Not walking but running'));expect(values(a,'action')).toEqual(['run']);});
 it('does not mistake noun modifiers or local joint rotation for travel',()=>{expect(values(sourceSemantics(clip('Holding a walking stick')),'action')).toEqual(['hold']);expect(values(sourceSemantics(clip('Rolling shoulders while standing still')),'action')).not.toContain('roll');});
 it('finds performed attacks after an opponent attack in another clause',()=>{const a=sourceSemantics(clip('Dodging a punch then punching back'));expect(values(a,'action')).toEqual(['dodge','punch']);});
 it('recognizes explicit archery without treating sports shots as gunfire',()=>{expect(values(sourceSemantics(clip('Standing with a bow and shooting an arrow')),'action')).toContain('shoot');});
});

describe('subject and object ambiguity',()=>{
 it('does not mistake page turning for body travel',()=>{expect(values(sourceSemantics(clip('Turning the pages of a book')),'action')).not.toContain('turn');});
 it('does not assign an explicitly accompanying person emotion to the performer',()=>{expect(values(sourceSemantics(clip('Walking with an angry man')),'emotion')).toEqual([]);});
});
