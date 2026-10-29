// Experimental candidate-only runner. Source data and generated output remain local.
import {readFileSync,writeFileSync,existsSync,mkdirSync,realpathSync,copyFileSync} from 'node:fs';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadMotionRecipe,motionRecipeSha} from './recipe.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../..');
const PIPELINE_TOOLS=['run.mjs','recipe.mjs','export.mjs','solve.py','bake.mjs','check.py','review-assets.mjs'];
const PREVIEW_TOOLS=['preview.mjs','preview.ts'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(ok,message)=>{if(!ok)throw new Error('motion candidate: '+message);};
export function validateCandidateOutput(path){const out=resolve(path);let ancestor=out;while(!existsSync(ancestor))ancestor=dirname(ancestor);const physical=resolve(realpathSync(ancestor),relative(ancestor,out));check(out===physical,'output aliases are not allowed');for(let dir=ancestor;;dir=dirname(dir)){check(!existsSync(join(dir,'.git')),'output must remain outside every Git repository');if(dirname(dir)===dir)break;}const rel=relative(ROOT,out);check(isAbsolute(rel)||rel==='..'||rel.startsWith('../'),'output cannot be in project');check(!existsSync(out),'output must be a new isolated directory');return out;}
export function parseMotionRunArgs(args){const options={};for(let i=0;i<args.length;i++){const key=args[i];check(['--recipe','--out','--lib','--python'].includes(key)&&i+1<args.length&&!Object.hasOwn(options,key),'unknown, duplicate or missing option');options[key]=args[++i];}check(options['--recipe']&&options['--out'],'--recipe and --out are required');return options;}
export function runMotionCandidate(options){
 const recipe=loadMotionRecipe(options['--recipe']),recipeSha256=motionRecipeSha(recipe),out=validateCandidateOutput(options['--out']);const lib=resolve(options['--lib']||process.env.APOLLO_MOTION_LIB||join(homedir(),'ApolloAssets/motion-lib-full-frames')),python=options['--python']||join(homedir(),'ApolloAssets/tools/mink-validation/.venv/bin/python');
 check(existsSync(join(lib,'catalog.json')),'source catalog not found');mkdirSync(out);mkdirSync(join(out,'.workflow'));mkdirSync(join(out,'.workflow/source'));
 const versions={};for(const name of [...PIPELINE_TOOLS,...PREVIEW_TOOLS]){const bytes=readFileSync(join(HERE,name));versions[name]=hash(bytes);copyFileSync(join(HERE,name),join(out,'.workflow/source',name));}
 const recipeFile=join(out,'recipe.json');writeFileSync(recipeFile,JSON.stringify(recipe,null,2)+'\n',{flag:'wx'});const candidateId='generated-'+recipeSha256.slice(0,20),stages=[];
 const persist=status=>writeFileSync(join(out,'.workflow/run.json'),JSON.stringify({version:1,status,recipeSha256,candidateId,sourceLibrary:lib,toolSha256:versions,sourceGuardScope:PIPELINE_TOOLS,engineDependencyScope:'Existing project engine dependencies are not transitively frozen by this prototype',stages},null,2)+'\n');
 function sourceStable(){for(const name of PIPELINE_TOOLS)check(hash(readFileSync(join(HERE,name)))===versions[name],'tool source changed during run: '+name);}
 function step(name,cmd,args){sourceStable();console.log('[motion-candidate]',name);const result=spawnSync(cmd,args,{cwd:ROOT,env:{...process.env,APOLLO_MOTION_LIB:lib},stdio:'inherit',timeout:480000});stages.push({name,exitCode:result.status,error:result.error?.message??null});persist('in-progress');sourceStable();return result.status===0&&!result.error;}
 try{
  check(step('calibrate',process.execPath,[join(HERE,'export.mjs'),out,recipeFile]),'calibration failed');
  check(step('solve',python,[join(HERE,'solve.py'),out]),'solver failed');
  check(step('bake',process.execPath,[join(HERE,'bake.mjs'),out,candidateId]),'bake/native playback failed');
  const passed=step('independent-check',python,[join(HERE,'check.py'),out]);
  const report=JSON.parse(readFileSync(join(out,'report.json')));report.experimentId=recipe.label+' / '+candidateId;report.recipeSha256=recipeSha256;report.summary.backend='Mink / MuJoCo';report.collision=existsSync(join(out,'collision-report.json'))?JSON.parse(readFileSync(join(out,'collision-report.json'))):{status:'incomplete'};report.meshCheck=passed?'pass':'fail';report.visualReview={status:'pending',referenceImagesUsed:false,automatedPoseEstimator:false};report.fingerReview={status:'not-calibrated',scope:'Current solver does not certify each finger local axis, anatomical flexion or prop contact.'};report.status=passed?'candidate-needs-visual-review':'candidate-rejected-technical';report.capabilityScope='Fixed torso/legs; simple upper-limb targets; finger anatomy and cross-skin contact are not certified.';
  writeFileSync(join(out,'validation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});persist(report.status);
  return {ok:passed,status:report.status,out,candidateId,recipeSha256,validation:join(out,'validation.json'),previewCommand:['node',join(HERE,'preview.mjs'),'--lib',join(out,'review'),'--report',join(out,'validation.json')]};
 }catch(error){persist('failed');throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=runMotionCandidate(parseMotionRunArgs(process.argv.slice(2)));console.log(JSON.stringify(result));process.exitCode=result.ok?0:2;}catch(error){console.error(String(error));process.exitCode=1;}
}
