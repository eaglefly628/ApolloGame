import {describe,it,expect} from 'vitest';
import {validateMotionRecipe,motionRecipeSha} from './recipe.mjs';
const recipe=()=>({version:1,kind:'simple-hand-action',mode:'hand-targets',label:'Synthetic reach',source:{skinId:'skin',baseClipId:'base',atS:0},durationS:2,fps:30,handTargetsM:{Left:[.18,.18,.28],Right:[-.18,.18,.28]},handOrientations:{Left:{fingers:[0,0,1],normal:[0,-1,0]},Right:{fingers:[0,0,1],normal:[0,-1,0]}},curvesM:{Right:[[0,0,0,0],[1,0,.06,.04],[2,0,0,0]]}});
describe('closed upper-limb recipe',()=>{
 it('round-trips detached data and hashes target/quality changes',()=>{const r=recipe(),copy=validateMotionRecipe(r);expect(copy).toEqual(r);expect(copy).not.toBe(r);expect(motionRecipeSha(r)).toBe(motionRecipeSha(copy));copy.handTargetsM.Left[1]+=.01;expect(motionRecipeSha(copy)).not.toBe(motionRecipeSha(r));copy.qualityThresholds={maxTargetErrorM:.02};expect(motionRecipeSha(copy)).not.toBe(motionRecipeSha(r));});
 it.each([r=>delete r.handOrientations,r=>r.freeCode='x',r=>r.fps=60,r=>r.durationS=100,r=>r.source.baseClipId='../x',r=>r.source.atS=-1,r=>r.handTargetsM.Left[2]=-.2,r=>r.handOrientations.Left.normal=[0,0,1],r=>r.curvesM.Right[1][0]=3,r=>r.curvesM.Right[0][0]=.1,r=>r.qualityThresholds={maxTargetErrorM:10}])('rejects unsafe or unsupported data',change=>{const r=recipe();change(r);expect(()=>validateMotionRecipe(r)).toThrow();});
});

describe('wrist-led world rotation curves',()=>{
 it('binds a detached wrist sweep to the recipe hash',()=>{const r=recipe(),before=motionRecipeSha(r);r.rotationCurvesRad={Right:[[0,0,0,0],[1,0,.3,0],[2,0,0,0]]};const copy=validateMotionRecipe(r);expect(copy.rotationCurvesRad).toEqual(r.rotationCurvesRad);expect(copy.rotationCurvesRad).not.toBe(r.rotationCurvesRad);expect(motionRecipeSha(copy)).not.toBe(before);});
 it.each([r=>r.rotationCurvesRad.Right[1][2]=NaN,r=>r.rotationCurvesRad.Right[1]=[1,.7,.7,0],r=>r.rotationCurvesRad.Right[1][0]=0,r=>r.rotationCurvesRad.Right[0][1]=.2,r=>r.rotationCurvesRad.Right.at(-1)[0]=1.9,r=>r.rotationCurvesRad.Head=r.rotationCurvesRad.Right])('rejects invalid or unbounded wrist trajectories',change=>{const r=recipe();r.rotationCurvesRad={Right:[[0,0,0,0],[1,0,.3,0],[2,0,0,0]]};change(r);expect(()=>validateMotionRecipe(r)).toThrow();});
});

describe('prop anchors and light head follow',()=>{
 const match=()=>({...recipe(),mode:'match-strike',contactStroke:{startS:.5,endS:1.5,fromZM:-.012,toZM:.012,clearanceM:.025},headFollowWeight:.12});
 it('keeps anchor timing and head weight in candidate identity',()=>{const a=match(),b=validateMotionRecipe(a);expect(b).toEqual(a);b.headFollowWeight=.1;expect(motionRecipeSha(b)).not.toBe(motionRecipeSha(a));});
 it.each([r=>r.mode='hand-targets',r=>r.contactStroke.endS=.6,r=>r.contactStroke.fromZM=.1,r=>r.contactStroke.toZM=r.contactStroke.fromZM,r=>r.contactStroke.clearanceM=0,r=>r.contactStroke.code='x',r=>r.headFollowWeight=.5])('rejects unsupported or unsafe contact data',change=>{const r=match();change(r);expect(()=>validateMotionRecipe(r)).toThrow();});
});
