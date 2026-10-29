import {describe,it,expect} from 'vitest';
import {validateMotionRecipe,motionRecipeSha} from './recipe.mjs';
const recipe=()=>({version:1,kind:'simple-hand-action',mode:'hand-targets',label:'Synthetic reach',source:{skinId:'skin',baseClipId:'base',atS:0},durationS:2,fps:30,handTargetsM:{Left:[.18,.18,.28],Right:[-.18,.18,.28]},handOrientations:{Left:{fingers:[0,0,1],normal:[0,-1,0]},Right:{fingers:[0,0,1],normal:[0,-1,0]}},curvesM:{Right:[[0,0,0,0],[1,0,.06,.04],[2,0,0,0]]}});
describe('closed upper-limb recipe',()=>{
 it('round-trips detached data and hashes target/quality changes',()=>{const r=recipe(),copy=validateMotionRecipe(r);expect(copy).toEqual(r);expect(copy).not.toBe(r);expect(motionRecipeSha(r)).toBe(motionRecipeSha(copy));copy.handTargetsM.Left[1]+=.01;expect(motionRecipeSha(copy)).not.toBe(motionRecipeSha(r));copy.qualityThresholds={maxTargetErrorM:.02};expect(motionRecipeSha(copy)).not.toBe(motionRecipeSha(r));});
 it.each([r=>delete r.handOrientations,r=>r.freeCode='x',r=>r.fps=60,r=>r.durationS=100,r=>r.source.baseClipId='../x',r=>r.source.atS=-1,r=>r.handTargetsM.Left[2]=-.2,r=>r.handOrientations.Left.normal=[0,0,1],r=>r.curvesM.Right[1][0]=3,r=>r.curvesM.Right[0][0]=.1,r=>r.qualityThresholds={maxTargetErrorM:10}])('rejects unsafe or unsupported data',change=>{const r=recipe();change(r);expect(()=>validateMotionRecipe(r)).toThrow();});
});
