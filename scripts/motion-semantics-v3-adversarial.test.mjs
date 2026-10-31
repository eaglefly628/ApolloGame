// Independent synthetic source/audit regression tests. No real assets or sidecar router validation.
import {describe,it,expect,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import * as current from './lib/motion-semantics.mjs';
import * as old from './lib/motion-semantics-v2.mjs';
const row=(description,extra={})=>({id:'s',frames:61,source:{mixamoName:'Synthetic motion',description},...extra});
const parse=text=>current.sourceSemantics(row(text));
const claims=(s,facet='action')=>s.claims.filter(c=>c.facet===facet);
const performed=(s,value)=>claims(s).some(c=>c.value===value&&!c.intentOnly);
describe('independent semantic counterexamples, synthetic source only',()=>{
 it('does not perform the purpose open before evidence of execution',()=>expect(performed(parse('Running to open a door'),'open')).toBe(false));
 it('does not perform the purpose reach before evidence of execution',()=>expect(performed(parse('Walking to reach a chair'),'reach')).toBe(false));
 it('does not attribute crowd purpose cheering to the rallying actor',()=>expect(performed(parse('Rallying the crowd to cheer'),'cheer')).toBe(false));
 it('does not attribute the sleeping cat action to the person petting it',()=>expect(performed(parse('Petting a sleeping cat'),'sleep')).toBe(false));
 it('keeps the observed woman as subject across her joined walk and wave',()=>expect(performed(parse('Watching a woman walk and wave'),'wave')).toBe(false));
 it('does not turn another performer posture transition into actor endpoints',()=>{const s=parse('Watching a woman crouching to standing');expect(claims(s,'startPosture')).toEqual([]);expect(claims(s,'endPosture')).toEqual([]);});
 it('does not infer exercising from a nearby kettlebell',()=>expect(performed(parse('Standing beside a kettlebell'),'exercise')).toBe(false));
 it('does not turn photographic shooting into combat shoot',()=>expect(performed(parse('Shooting a photograph'),'shoot')).toBe(false));
 it('does not publish an incorrect final endpoint from a chained to sequence',()=>{const s=parse('Crouching to standing to sitting');expect(s.warnings).toContain('ambiguous-posture-sequence');expect(claims(s,'endPosture')).toEqual([]);});
 it('does not collapse chained from transitions into one asserted event',()=>{const s=parse('Standing from crouching from kneeling');expect(s.warnings).toContain('ambiguous-posture-sequence');expect(claims(s,'startPosture')).toEqual([]);});
 it('retains v2 exactly through every public version selector',()=>{const rows=['Standing angrily','Hadouken','Victory','Crouching to standing','Not running','Walking with a terrified friend','Lunging forward to bite','A quick formal bow','Shooting a photograph'].map(row);for(const r of rows)expect(current.sourceSemantics(r,{dictionaryVersion:old.DICTIONARY_VERSION})).toEqual(old.sourceSemantics(r));expect(current.summarizeSemantics(rows,{dictionaryVersion:old.DICTIONARY_VERSION})).toEqual(old.summarizeSemantics(rows));expect(current.getSourceDictionary(old.DICTIONARY_VERSION)).toEqual(old.getSourceDictionary());});
 it('keeps two-frame pose action as context and its posture title evidence separate',()=>{const text='Leaning forward';const s=current.sourceSemantics(row(text,{frames:2,source:{mixamoName:'Synthetic Sitting Pose',description:text}}));expect(claims(s)).toEqual([]);expect(claims(s,'poseContext').some(c=>c.value==='lean')).toBe(true);expect(claims(s,'posture').find(c=>c.value==='seated').source).toBe('title');for(const c of s.claims){const original=c.source==='title'?'Synthetic Sitting Pose':text;expect(original.slice(c.start,c.end)).toBe(c.quote);}});
 it('records its supported purpose case as intent and later real action independently',()=>{const s=parse('Lunging forward to bite');expect(claims(s).find(c=>c.value==='bite').intentOnly).toBe(true);expect(performed(s,'lunge')).toBe(true);expect(performed(s,'bite')).toBe(false);});
});
describe('additional ordinary variants found during independent re-review',()=>{
 it('retains preparation with an intervening adverb as intent only',()=>expect(performed(parse('Preparing to slowly grab an object'),'grab')).toBe(false));
 it('keeps the watched performer across the watch past-tense form',()=>expect(performed(parse('Watched a woman running'),'run')).toBe(false));
 it('does not assign a small sleeping animal action to the petting person',()=>expect(performed(parse('Petting a small sleeping cat'),'sleep')).toBe(false));
 it('does not assign the cheering crowd action to the walking person',()=>expect(performed(parse('Walking with a cheering crowd'),'cheer')).toBe(false));
 it('does not classify plural photographic shooting as combat shoot',()=>expect(performed(parse('Shooting photographs'),'shoot')).toBe(false));
 it('does not classify arms hanging at sides as full-body hanging',()=>expect(performed(parse('Standing with arms hanging at sides'),'hang')).toBe(false));
 it('does not turn an information lookup into an upward gaze',()=>{const s=parse('Looking up a phone number');expect(claims(s,'gazeDirection')).toEqual([]);});
 it('keeps gaze direction separate from movement direction and validates its source span',()=>{const text='Walking forward while looking left';const s=parse(text);expect(claims(s,'direction').map(c=>c.value)).toEqual(['forward']);expect(claims(s,'gazeDirection').map(c=>c.value)).toEqual(['left']);for(const c of s.claims)expect(current.validateSourceEvidence(row(text),{source:c.source,quote:c.quote,start:c.start,end:c.end}).quote).toBe(c.quote);});
});

let auditText=readFileSync(new URL('./motion-story-match.mjs',import.meta.url),'utf8');
const readAnchor="import {readSemanticDrafts} from './lib/motion-semantic-drafts.mjs';";
const queryAnchor="import {querySemanticDraftBatch} from './lib/motion-semantic-query.mjs';";
if(auditText.split(readAnchor).length!==2||auditText.split(queryAnchor).length!==2)throw Error('audit dependency anchor mismatch');
auditText=auditText.replace(readAnchor,'const readSemanticDrafts=()=>globalThis.__auditSnapshot;').replace(queryAnchor,'const querySemanticDraftBatch=async()=>globalThis.__auditResults;').replace("'./lib/motion-semantics.mjs'",JSON.stringify(new URL('./lib/motion-semantics.mjs',import.meta.url).href));
const audit=await import('data:text/javascript;base64,'+Buffer.from(auditText).toString('base64'));
const snapshot=text=>({catalogSha256:'a'.repeat(64),dictionaryVersion:current.DICTIONARY_VERSION,head:{revision:0,eventSha256:null},clips:[{clipId:'s',sourceScope:'clip-source',source:parse(text),tags:parse(text).claims.map(c=>({...c,status:'draft',flagEventIds:[]})),pendingProposals:[]}]});
describe('independent label audit using controlled snapshot dependency, no version router claim',()=>{
 it('separates informative guard warnings from actual source concerns',()=>{globalThis.__auditSnapshot=snapshot('Blocking an attack while seated');const r=audit.semanticLabelAudit({lib:'/not-read'});expect(r.summary.attentionRows).toBe(0);expect(r.clips[0].informationalWarnings).toContain('opponent-action-not-performed');});
 it('keeps pure purpose rows in source review and execution count zero',()=>{globalThis.__auditSnapshot=snapshot('Getting ready to grab');const r=audit.semanticLabelAudit({lib:'/not-read'});expect(r.summary.executionClaimRows).toBe(0);expect(r.summary.intentOnlyRows).toBe(1);expect(r.summary.attentionRows).toBe(1);});
 it('does not promote the noun-only object into an execution claim or a needless action-review row',()=>{globalThis.__auditSnapshot=snapshot('Standing beside a kettlebell');const r=audit.semanticLabelAudit({lib:'/not-read'});expect(performed(globalThis.__auditSnapshot.clips[0].source,'exercise')).toBe(false);expect(r.summary.executionClaimRows).toBe(0);expect(r.clips[0].contextOnly).toBe(true);});
 it('routes unresolved source roles to needs-source-review without approval',async()=>{globalThis.__auditSnapshot=snapshot('Disarming axe');const s=globalThis.__auditSnapshot;globalThis.__auditResults=[{totalMatches:1,candidates:[{clipId:'s',sourceWarnings:['interaction-role-unresolved'],constraints:[]}],excluded:[],missingRequirements:[]}];const r=await audit.matchSemanticStory({lib:'/not-read',story:{schemaVersion:1,storyId:'synthetic',title:'Synthetic',binding:{catalogSha256:s.catalogSha256,dictionaryVersion:s.dictionaryVersion,head:s.head},beats:[{id:'b',text:'Disarm',kind:'motion',constraints:[{facet:'action',value:'disarm'}],strict:false}]}});expect(r.beats[0].status).toBe('needs-source-review');expect(r.counts.verifiedStoryBeats).toBe(0);});
});

afterEach(()=>{delete globalThis.__auditSnapshot;delete globalThis.__auditResults;});
