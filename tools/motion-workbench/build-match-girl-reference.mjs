/** Assemble an external, explicitly unapproved story reference using native M1/D6.
 * This makes data and provenance, never publishes catalog records or calls a vendor. */
import {readFile, writeFile, mkdir, realpath, stat} from 'node:fs/promises';
import {resolve, join, dirname, basename, relative, isAbsolute, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {motionEngine, engineClip} from '../../scripts/lib/motion-engine.mjs';
import {writeComposedGlb, unpackGlb} from '../../scripts/lib/motion-compose-glb.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, message) => { if (!ok) throw Error(message); };
export const MATCH_GIRL_SHOTS = Object.freeze([
  {id:'snow', title:'01 · 雪夜街角', seconds:7, pose:'walk', delivery:'animation', narration:'除夕的雪夜，她沿着街道寻找愿意买火柴的人。', prompt:'Blue snowy nineteenth-century street, a barefoot child walking slowly, distant warm windows. Preserve the supplied blocking and screen direction.'},
  {id:'corner', title:'02 · 两栋房子之间', seconds:7, pose:'floor', delivery:'animation', narration:'她缩进墙角，把脚收在身下。没有卖出火柴，她不敢回家。', prompt:'The same girl sits curled in a sheltered corner, cold and exhausted. Add subtle shivering; do not turn the adult proxy into the final character design.'},
  {id:'strike', title:'03 · 一点火光', seconds:6, pose:'strike', delivery:'video-planned', narration:'她点亮一根火柴。微小的火光，把寒夜照暖了一瞬。', prompt:'Close shot of the girl striking a match. Match head must contact the striker, then separate and ignite. Stable left hand, wrist-led right-hand stroke. Correct interpenetration in this technically rejected blocking reference.'},
  {id:'stove', title:'04 · 铁火炉', seconds:8, pose:'warm', delivery:'video-planned', narration:'火光里，一座温暖的铁火炉出现了。她伸手取暖，火焰却熄灭了。', prompt:'Warm iron stove with brass details appears as a tender vision. Hands reach toward warmth, then the flame dies and the cold wall returns.'},
  {id:'feast', title:'05 · 烤鹅的幻象', seconds:8, pose:'floor', delivery:'video-planned', narration:'又一根火柴亮起。墙后是丰盛的餐桌，烤鹅仿佛朝她走来。', prompt:'A wall becomes translucent, revealing a white cloth and a steaming roast goose stuffed with apples and prunes. Dreamlike goose approaches, then fades. Goose, never duck.'},
  {id:'tree', title:'06 · 圣诞树', seconds:8, pose:'floor', delivery:'video-planned', narration:'第三根火柴照出一棵圣诞树。她望向烛光，想让这美丽多停留一会儿。', prompt:'A magnificent candlelit Christmas tree fills the vision. Child looks upward; candles rise toward the night sky as the vision dissolves.'},
  {id:'star', title:'07 · 流星', seconds:6, pose:'floor', delivery:'video-planned', narration:'一颗星划过天空。她想起奶奶说过的话，抬头望着那道光。', prompt:'Single shooting star across a winter night. Subtle upward gaze and a quiet pause, continuous character and cool-to-warm lighting language.'},
  {id:'grandmother', title:'08 · 光里的奶奶', seconds:9, pose:'floor', delivery:'video-planned', narration:'光里，奶奶出现了。她恳求奶奶留下，连忙点亮余下的火柴。', prompt:'Kind grandmother appears in a soft luminous vision. The same child pleads for her to stay. Keep their eyelines and positions consistent with the supplied two-person blocking.'},
  {id:'ascent', title:'09 · 整把火柴', seconds:9, pose:'floor', delivery:'video-planned', narration:'整把火柴燃亮。奶奶把她抱起，带她去往没有寒冷和饥饿的地方。', prompt:'Grandmother gently lifts and embraces the child; both rise through warm light. Generate proper supported contact and anatomy. The reference has no validated paired lift: do not copy its separated standing proxies as the final embrace.'},
  {id:'dawn', title:'10 · 新年的清晨', seconds:7, pose:'still', delivery:'video-planned', narration:'清晨，人们在墙角发现了她。她已经离世，没有人知道她曾看见什么。', prompt:'Quiet New Year dawn. Respectful distant shot of the child still in the corner, spent matches nearby. No rescue ending, graphic imagery or joyous waking. End on the contrast between the cold street and remembered warmth.'},
]);

async function outsideRepository(path) {
  let p = await realpath(path);
  for (;;) {
    try { await stat(join(p,'.git')); throw Error('output must stay outside every repository'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(p); if (parent === p) break; p = parent;
  }
}

export async function buildMatchGirlReference({lib, calibratedReview, strike, out}) {
  for (const p of [lib,calibratedReview,strike,out]) assert(typeof p === 'string' && p.length, 'four explicit paths required');
  out = resolve(out); const outputParent=await realpath(dirname(out));
  const canonicalOutput=join(outputParent,basename(out));
  for(const source of [lib,strike,dirname(calibratedReview)]) {
    const root=await realpath(source), rel=relative(root,canonicalOutput);
    assert(rel && (rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)), 'output overlaps source library');
  }
  await outsideRepository(outputParent);
  // mkdir without recursive refuses every existing candidate, including aliases.
  await mkdir(out); await mkdir(join(out,'assets'));
  const watched = new Map(), provenance = [];
  const input = async (path, expected) => {
    const bytes = await readFile(path), hash = sha(bytes);
    assert(!expected || hash === expected, 'source SHA mismatch: '+path);
    watched.set(path, hash); return bytes;
  };
  const catalog = JSON.parse(await input(join(lib,'catalog.json')));
  const calibration = JSON.parse(await input(calibratedReview));
  const claire = calibration.profiles.find(p=>p.id==='claire'), granny = calibration.profiles.find(p=>p.id==='sporty-granny');
  assert(claire && granny, 'reviewed identity fixture needs Claire and Granny');
  const assets = new Map();
  async function copyAsset(row, root, key) {
    const bytes = await input(join(root,row.file),row.sha256), file='assets/'+key.replaceAll('/','-')+'.glb';
    await writeFile(join(out,file), bytes, {flag:'wx'});
    const result={key,kind:row.kind??(row.frames?'skeletal-animation':'model'),file,sha256:row.sha256,...(row.frames?{fps:row.fps,frames:row.frames,loop:row.loop}: {})}; assets.set(key,result); return {bytes,row:result};
  }
  const root=dirname(calibratedReview), model=await copyAsset(claire.assets[0],root,'girl/model');
  const idle=await copyAsset(claire.assets.find(a=>a.key.endsWith('/idle')),root,'girl/idle');
  const walk=await copyAsset(claire.assets.find(a=>a.key.endsWith('/walk')),root,'girl/walk');
  const grandmother=await copyAsset(granny.assets[0],root,'grandmother/model');
  const grannyIdle=await copyAsset(granny.assets.find(a=>a.key.endsWith('/idle')),root,'grandmother/idle');
  const api=await motionEngine(), {THREE}=api;
  const parse=bytes=>new api.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const carrier=writeComposedGlb(model.bytes), modelDoc=unpackGlb(model.bytes).doc;
  const boneNames=modelDoc.skins[0].joints.map(i=>modelDoc.nodes[i].name);
  async function bake(id, sourceId, freeze=false) {
    const row=catalog.clips.find(c=>c.id===sourceId);assert(row,'source clip missing '+sourceId);
    const bytes=await input(join(lib,row.file),row.sha256), source=await engineClip(bytes,{fps:row.fps,frames:row.frames,loop:row.loop});
    const target=await parse(carrier), rest=api.captureSkeletonRest(target.scene,target.parser);
    const bound=api.bindSkeletalClip(source,source.clip.name,target.scene,rest,'humanoid');
    const mixer=new THREE.AnimationMixer(target.scene),action=mixer.clipAction(bound);
    action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    const frames=freeze?2:row.frames, samples=[];
    for(let f=0;f<frames;f++) {
      mixer.setTime(freeze?Math.min(1,(row.frames-1)/row.fps):f/row.fps);target.scene.updateMatrixWorld(true);
      samples.push(Object.fromEntries(boneNames.map(n=>{const b=target.scene.getObjectByName(n);return[n,{translation:b.position.toArray(),rotation:b.quaternion.toArray(),scale:b.scale.toArray()}];})));
    }
    mixer.stopAllAction();mixer.uncacheRoot(target.scene);
    const clipName='girl-'+id+'-exact', baked=writeComposedGlb(model.bytes,{id:clipName,fps:30,frames,samples,THREE});
    const key='girl/'+id, file='assets/girl-'+id+'.glb';await writeFile(join(out,file),baked,{flag:'wx'});
    const result={key,kind:'skeletal-animation',file,sha256:sha(baked),fps:30,frames,loop:!freeze};assets.set(key,result);
    provenance.push({key,sourceId,sourceSha256:row.sha256,sourceDescription:row.descEn??row.source.description??null,method:freeze?'single-pose-two-samples':'native-M1-humanoid-then-target-exact',status:'draft-visual-and-contact-unreviewed'});
    return {row:result,clipName};
  }
  const floor=await bake('floor','sitting-idle-124240901'), warm=await bake('warm','kneel-107830901'), still=await bake('still','sitting-idle-124240901',true);
  const strikeCatalog=JSON.parse(await input(join(strike,'review/catalog.json'))), strikeValidation=JSON.parse(await input(join(strike,'validation.json')));
  const strikeClip=await copyAsset(strikeCatalog.clips[0],join(strike,'review'),'girl/strike');
  const descriptor=row=>({fps:row.fps,frames:row.frames,loop:row.loop});
  const loadedStrike=await engineClip(strikeClip.bytes,descriptor(strikeClip.row));
  const loadedIdle=await engineClip(idle.bytes,descriptor(idle.row)), loadedWalk=await engineClip(walk.bytes,descriptor(walk.row)), loadedGranny=await engineClip(grannyIdle.bytes,descriptor(grannyIdle.row));
  const clips={idle:{...idle,clipName:loadedIdle.clip.name},walk:{...walk,clipName:loadedWalk.clip.name},floor,warm,still,strike:{...strikeClip,clipName:loadedStrike.clip.name}};
  const profiles=[];
    const mesh=(x,y,z,width,height,depth,color)=>({Transform3D:{x,y,z},Mesh3D:{shape:'box',width,height,depth,frontTint:color,backTint:color,edgeTint:color}});
  for(const shot of MATCH_GIRL_SHOTS) {
    const motion=clips[shot.pose],used=[model.row,motion.row];
    const actor={Transform3D:{x:0,y:0,z:0},Model3D:{modelKey:model.row.key,scale:1},AnimationDriver3D:{version:1,tickRate:30,initialState:'action',graph:{type:'AnimGraph3D',clips:{action:{asset:motion.row.key,clip:motion.clipName,loop:shot.pose!=='still'}},states:{action:{clip:'action'}},transitions:[],params:{speed:'speed'}},clips:{action:{durationTicks:motion.row.frames-1}}}};
    const entities={actor,camera:{Camera3D:{yaw:.68,pitch:.18,distance:shot.pose==='strike'?2.45:4.3,pivotX:0,pivotY:shot.pose==='strike'?1.1:.8,pivotZ:0,fov:48,near:.03,far:40}},ground:mesh(0,-.06,0,8,.12,8,0xbccfdd),back:mesh(0,1.5,-1.3,7,3,.18,0x314458),side:mesh(-2,1.5,0,.18,3,3,0x41526b),keyLight:{Light3D:{kind:'directional',color:shot.id==='dawn'?0xffecd4:0xb5cff5,intensity:2,dirX:-3,dirY:-5,dirZ:-2}},fillLight:{Light3D:{kind:'ambient',color:0xbfd5ef,intensity:1.1}}};
    for(let n=0;n<4;n++)entities['window-'+n]=mesh(-1.4+n*.85,1.8,-1.18,.38,.55,.025,0xeeb96b);
    if(shot.pose==='walk') {
      delete actor.Transform3D;
      const original=claire.manifest.entities.actor;actor.CharacterMotor3D=structuredClone(original.CharacterMotor3D);actor.RootMotion3D=structuredClone(original.RootMotion3D);actor.RootMotionSource3D={version:1,driver:{kind:'animation-driver',clip:'action'}};
      entities.floor={Transform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1},Collider3D:{kind:'box',halfX:8,halfY:.1,halfZ:10,baseY:-.2}};
      entities.camera.Camera3D={...claire.manifest.entities.camera.Camera3D};
    }
    if(['stove','feast','tree','grandmother','ascent'].includes(shot.id))entities.warmLight={Light3D:{kind:'point',color:0xffa04b,intensity:4,x:.4,y:1,z:1,range:6}};
    if(shot.id==='stove') {entities.stove=mesh(.85,.4,.7,.65,.8,.55,0x242c35);entities.fire=mesh(.85,.35,1,.3,.25,.02,0xffa336);}
    if(shot.id==='feast')entities.table=mesh(.7,.62,.55,1.4,.1,.8,0xf1dfc3);
    if(shot.id==='tree')for(let i=0;i<3;i++)entities['branch-'+i]={Transform3D:{x:.8,y:.6+i*.4,z:.2},Mesh3D:{shape:'cone',width:(.55-i*.12)*2,height:.9,frontTint:0x317650}};
    if(['tree','star'].includes(shot.id)) {entities.gaze={Transform3D:{x:.4,y:2.2,z:.7}};actor.IK3D={chains:[],lookAt:{bone:'Head',target:{entity:'gaze',offset:[0,0,0]},weight:.22}};}
    if(['grandmother','ascent'].includes(shot.id)) {
      used.push(grandmother.row,grannyIdle.row);
      entities.grandmother={Transform3D:{x:1.15,y:0,z:.2},Model3D:{modelKey:grandmother.row.key,scale:1},AnimationDriver3D:{version:1,tickRate:30,initialState:'idle',graph:{type:'AnimGraph3D',clips:{idle:{asset:grannyIdle.row.key,clip:loadedGranny.clip.name,loop:true}},states:{idle:{clip:'idle'}},transitions:[],params:{speed:'speed'}},clips:{idle:{durationTicks:grannyIdle.row.frames-1}}}};
    }
    if(shot.pose==='strike')for(const p of strikeValidation.props??[])entities[p.id]={...mesh(0,0,0,...p.size,p.color),Attach3D:{parentId:'actor',bone:p.bone,offset:p.offset,rot:p.rot}};
    for(const row of Object.values(entities))if(row.Model3D===undefined)delete row.Model3D;
    const caps=['t2-animation-driver',...(actor.CharacterMotor3D?['t2-character-motor','t2-root-motion']:[])];
    profiles.push({id:shot.id,label:shot.title,description:shot.pose==='strike'?'原型参考：v022曾获表意认可，但碰撞硬门失败，仍为拒收候选。':'故事动作参考，Claire为成人占位角色；场景为白模，非正式小女孩美术。'+(shot.delivery==='video-planned'?'本章最终表演或幻象待Seedance生成。':''),status:'numeric-candidate',manifest:{meta:{tickRate:30},capabilities:caps,entities},program:{version:1,tickRate:30,durationFrames:shot.seconds*30,maxSeekSteps:shot.seconds*30+1,cues:[]},assets:used});
  }
  const story={title:'卖火柴的小女孩 · 动画与视频预演',chapters:MATCH_GIRL_SHOTS.map(({id,title,narration,delivery})=>({profileId:id,title,narration,delivery}))};
  await writeFile(join(out,'review.json'),JSON.stringify({version:1,profiles,story},null,2),{flag:'wx'});
  const jobs=MATCH_GIRL_SHOTS.filter(s=>s.delivery==='video-planned').map(s=>({id:s.id,provider:'seedance',status:'awaiting-generation',durationSeconds:s.seconds,prompt:s.prompt,referenceFrames:[],referenceVideo:null,continuity:{character:'Final child turnaround required; Claire is blocking proxy only',style:'handcrafted low-poly fairy tale, blue snow and warm orange fire',ending:'Andersen original, no rescue'},output:null}));
  await writeFile(join(out,'seedance-jobs.json'),JSON.stringify({version:1,title:story.title,submissionStatus:'not-submitted',jobs},null,2),{flag:'wx'});
  for(const [path,hash] of watched)assert(sha(await readFile(path))===hash,'input changed '+path);
  const report={status:'story-blocking-draft',sourceUnchanged:true,totalSeconds:MATCH_GIRL_SHOTS.reduce((n,s)=>n+s.seconds,0),chapters:profiles.length,inputs:[...watched].map(([path,sha256])=>({path,sha256})),assets:[...assets.values()],motions:provenance,strikeTechnicalStatus:strikeValidation.status,limitations:['Claire is adult blocking proxy, not final child','Cold shivering and transitions are not solved','Roast goose, paired lift and ascent await generated video','v022 collision rejection retained','No video generated, submitted or paid for','Not a finished game or final cinematic']};
  await writeFile(join(out,'provenance.json'),JSON.stringify(report,null,2),{flag:'wx'});
  return {out,chapters:report.chapters,totalSeconds:report.totalSeconds,status:report.status};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),options={};
  assert(args.length===8,'usage: --lib LIB --calibrated-review FILE --strike DIR --out NEW_DIR');
  const names={'--lib':'lib','--calibrated-review':'calibratedReview','--strike':'strike','--out':'out'};
  for(let i=0;i<args.length;i+=2){assert(names[args[i]]&&!Object.hasOwn(options,names[args[i]]),'unknown/duplicate option');options[names[args[i]]]=resolve(args[i+1]);}
  console.log(JSON.stringify(await buildMatchGirlReference(options)));
}
