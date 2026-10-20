import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeMockCharacterGlb } from './fixtures/character-pipeline/mock-character.mjs';
import { makeMockMotionFbx } from './fixtures/character-pipeline/mock-fbx.mjs';
import { parseGlb } from './lib/scene-geometry.mjs';
import { encodePng } from './ai-gen.mjs';
import { prepareCharacter, characterSourceBounds, annotateMarkers, proposeMarkers, acceptCharacterReturn, writeMotionList } from './character-pipeline.mjs';
import { CHARACTER_PROFILE, MARKER_IDS, VIEW_ROLES, characterSha, markerDigest, validateMarkerSheet, validateMotionSource } from './lib/character-inputs.mjs';

const dirs=[],fresh=()=>{const d=mkdtempSync(join(tmpdir(),'apollo-character-tools-'));dirs.push(d);return d;};
const write=(p,v)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,typeof v==='object'&&!Buffer.isBuffer(v)?JSON.stringify(v):v);return p;};
function pack(doc,bin) {const j0=Buffer.from(JSON.stringify(doc)),j=Buffer.concat([j0,Buffer.alloc((4-j0.length%4)%4,32)]),b=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]),out=Buffer.alloc(28+j.length+b.length);out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(j.length,12);out.writeUInt32LE(0x4e4f534a,16);j.copy(out,20);out.writeUInt32LE(b.length,20+j.length);out.writeUInt32LE(0x004e4942,24+j.length);b.copy(out,28+j.length);return out;}
function model({staticOnly=false,clipName,real=false}={}) {
  const {json, binary}=parseGlb(makeMockCharacterGlb({clipName})),bin=Buffer.from(binary),p=json.meshes[0].primitives[0];
  const a=json.accessors[p.attributes.POSITION],start=json.bufferViews[a.bufferView].byteOffset??0;
  for(let i=0;i<a.count;i++)bin.writeFloatLE(bin.readFloatLE(start+i*12+8)-.025,start+i*12+8);
  if(staticOnly){delete json.skins;delete json.nodes[17].skin;delete p.attributes.JOINTS_0;delete p.attributes.WEIGHTS_0;json.animations=[];}
  if(real)json.extras.mock=false;
  return pack(json,bin);
}
function markerFixture() {
  const source=model({staticOnly:true}),bounds=[[-.3,0,-.025],[.3,1.8,.025]],views=VIEW_ROLES.map((role,i)=>encodePng(32,48,Buffer.alloc(32*48*3,20+i)));
  const sheet={version:1,characterId:'hero',profile:CHARACTER_PROFILE,modelSha256:characterSha(source),bounds,state:'proposed',method:'bbox-proposal',views:VIEW_ROLES.map((role,i)=>({role,path:`${role}.png`,sha256:characterSha(views[i]),width:32,height:48,camera:{position:[[0,.9,4],[0,.9,-4],[-4,.9,0],[4,.9,0]][i],target:[0,.9,0],fov:45}})),markers:proposeMarkers(bounds)};
  return {source,views,sheet};
}
function motionFixture({source='mock-fixture'}={}) {
  const target=model(),fbx=makeMockMotionFbx(),params={profile:CHARACTER_PROFILE,clipId:'walk',fps:30,frames:31,loop:true,inPlace:true};
  const provenance={version:1,source,clipId:'walk',sourceSha256:characterSha(fbx),targetSha256:characterSha(target),skeleton:CHARACTER_PROFILE,fps:30,frames:31,loop:true,inPlace:true,searchTerm:'Walking',download:{format:'FBX',skin:false},licenseUrl:'https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html'};
  return {target,fbx,params,provenance};
}
afterEach(()=>{for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});

describe('T5 marker proposal and immutable confirmation',()=>{
  it('measures actual static source vertices and refuses animated/skinned sources',async()=>{
    const b=await characterSourceBounds(model({staticOnly:true}));expect(b[0]).toEqual([-.3,0,-.025]);expect(b[1]).toEqual([.3,1.8,.025]);
    await expect(characterSourceBounds(model())).rejects.toThrow(/静态/);
    await expect(characterSourceBounds(model({clipName:'walk'}))).rejects.toThrow(/静态/);
  });
  it('does not trust accessor metadata bounds',async()=>{
    const {json,binary}=parseGlb(model({staticOnly:true}));json.accessors[0].min=[-999,-999,-999];json.accessors[0].max=[999,999,999];
    const bounds=await characterSourceBounds(pack(json,binary));expect(bounds[1][1]).toBe(1.8);
  });
  it('produces repeatable numbered overlays, preserving model, reference and proposal bytes',async()=>{
    const dir=fresh(),source=write(join(dir,'source.glb'),model({staticOnly:true}));
    const a=await prepareCharacter(source,join(dir,'a'),{characterId:'hero',mock:true}),b=await prepareCharacter(source,join(dir,'b'),{characterId:'hero',mock:true});
    const sa=JSON.parse(readFileSync(a.markersPath)),sb=JSON.parse(readFileSync(b.markersPath));
    expect(sa).toEqual(sb);expect(sa.state).toBe('proposed');expect(sa.confirmation).toBeUndefined();expect(sa.markers.map(m=>m.id)).toEqual(MARKER_IDS);
    expect(a.markersSha256).toBe(b.markersSha256);expect(a.realArpValidated).toBe(false);expect(a.humanConfirmation).toBe(false);
    for(let i=0;i<4;i++){
      expect(readFileSync(a.annotations[i])).toEqual(readFileSync(b.annotations[i]));
      const raw=readFileSync(join(a.workspace,sa.views[i].path));expect(characterSha(raw)).toBe(sa.views[i].sha256);
      expect(readFileSync(a.annotations[i])).not.toEqual(raw);
      expect(annotateMarkers(raw,sa,sa.views[i])).toEqual(readFileSync(a.annotations[i]));
    }
    expect(readFileSync(source)).toEqual(readFileSync(join(a.workspace,'source.glb')));
    expect(JSON.parse(readFileSync(a.rigJobPath)).inputs).toHaveLength(6);
  });
  it('refuses an existing proposal directory without overwriting files',async()=>{
    const d=fresh(),p=write(join(d,'source.glb'),model({staticOnly:true})),w=join(d,'occupied');mkdirSync(w);write(join(w,'owner.txt'),'keep');
    await expect(prepareCharacter(p,w,{characterId:'hero',mock:true})).rejects.toThrow(/EEXIST/);expect(readFileSync(join(w,'owner.txt'),'utf8')).toBe('keep');
  });
  it('rejects symlink view/annotation output escape through workspace reuse',async()=>{
    const d=fresh(),p=write(join(d,'source.glb'),model({staticOnly:true})),w=join(d,'linked'),out=join(d,'outside');mkdirSync(out);symlinkSync(out,w);
    await expect(prepareCharacter(p,w,{characterId:'hero',mock:true})).rejects.toThrow(/EEXIST/);expect(existsSync(join(out,'source.glb'))).toBe(false);
  });
  it('proposed markers are valid only for explicit Mock and never become confirmed',()=>{
    const f=markerFixture();expect(validateMarkerSheet(f.sheet,{model:f.source,views:f.views,mock:true})).toBe(f.sheet);
    expect(()=>validateMarkerSheet(f.sheet,{model:f.source,views:f.views})).toThrow(/真人确认/);expect(f.sheet.state).toBe('proposed');
  });
  it('consumes existing confirmation only from the human whitelist and invalidates edits',()=>{
    const f=markerFixture(),root=fresh();write(join(root,'docs/roles/humans.json'),{humans:['Test Operator']});f.sheet.state='confirmed';f.sheet.confirmation={by:'Test Operator',markersSha256:markerDigest(f.sheet)};
    expect(validateMarkerSheet(f.sheet,{model:f.source,views:f.views,root})).toBe(f.sheet);
    f.sheet.markers[0].position[1]-=.01;expect(()=>validateMarkerSheet(f.sheet,{model:f.source,views:f.views,root})).toThrow(/旧确认SHA失效/);
    f.sheet.confirmation.markersSha256=markerDigest(f.sheet);write(join(root,'docs/roles/humans.json'),{humans:[]});expect(()=>validateMarkerSheet(f.sheet,{model:f.source,views:f.views,root})).toThrow(/请 owner 填/);
  });
  it.each([
    ['model SHA',f=>{f.sheet.modelSha256='0'.repeat(64);},/modelSha256/],
    ['view SHA',f=>{f.views[0]=Buffer.from('changed');},/SHA/],
    ['view dimensions',f=>{f.sheet.views[0].width++;},/尺寸/],
    ['view role',f=>{f.sheet.views[0].role='side';},/role/],
    ['marker missing',f=>{f.sheet.markers.pop();},/标记点/],
    ['marker outside',f=>{f.sheet.markers[0].position[0]=999;},/包围盒外/],
    ['marker id',f=>{f.sheet.markers[0].id='free-op';},/闭集/],
    ['unknown code',f=>{f.sheet.python='bad';},/未知字段/],
    ['nonfinite bounds',f=>{f.sheet.bounds[1][0]=Infinity;},/有限/],
    ['false foot origin',f=>{f.sheet.bounds[0][1]=.1;},/规范化/],
    ['proposed signature',f=>{f.sheet.confirmation={by:'Agent'};},/不能携带/],
  ])('rejects %s',(_name,mutate,pattern)=>{const f=markerFixture();mutate(f);expect(()=>validateMarkerSheet(f.sheet,{model:f.source,views:f.views,mock:true})).toThrow(pattern);});
});

describe('T5 manual motion and ARP return',()=>{
  it('validates FBX/target hashes and records manual source separately from real execution',()=>{
    const f=motionFixture();expect(validateMotionSource(f.provenance,{params:f.params},[f.target,f.fbx],{mock:true})).toBe(f.provenance);
    expect(()=>validateMotionSource(f.provenance,{params:f.params},[f.target,f.fbx])).toThrow(/仅限/);
    f.provenance.source='mixamo-manual';expect(validateMotionSource(f.provenance,{params:f.params},[f.target,f.fbx])).toBe(f.provenance);
    expect(()=>validateMotionSource(f.provenance,{params:f.params},[f.target,Buffer.from('other')])).toThrow(/SHA/);
  });
  it('rejects matching-SHA text masquerading as real FBX, while explicit Mock logs the skip',()=>{
    const f=motionFixture({source:'mixamo-manual'}),text=Buffer.from('not an FBX, but same filename');f.provenance.sourceSha256=characterSha(text);
    expect(()=>validateMotionSource(f.provenance,{params:f.params},[f.target,text])).toThrow(/FBX/);
    expect(validateMotionSource(f.provenance,{params:f.params},[f.target,text],{mock:true})).toBe(f.provenance);
  });
  it.each([
    ['missing loop',f=>{delete f.provenance.loop;}],['invalid fps',f=>{f.provenance.fps=0;}],['wrong interval',f=>{f.provenance.frames=32;}],['With Skin',f=>{f.provenance.download.skin=true;}],['external terms',f=>{f.provenance.licenseUrl='https://invalid';}],['invented op',f=>{f.provenance.script='code';}],
  ])('rejects invalid %s',(_name,mutate)=>{const f=motionFixture();mutate(f);expect(()=>validateMotionSource(f.provenance,{params:f.params},[f.target,f.fbx],{mock:true})).toThrow();});
  function returnedAnimation({mockSource=true,realOutput=false}={}) {
    const d=fresh(),f=motionFixture({source:mockSource?'mock-fixture':'mixamo-manual'}),out=model({clipName:'walk',real:realOutput});
    if(!mockSource){f.target=model({real:true});f.provenance.targetSha256=characterSha(f.target);}
    write(join(d,'rig.glb'),f.target);write(join(d,'walk.fbx'),f.fbx);write(join(d,'walk.glb'),out);
    write(join(d,'motion.json'),{fbx:'walk.fbx',provenance:f.provenance});
    const record={version:1,source:mockSource?'mock-fixture':'arp-manual',sourceSha256:characterSha(f.fbx),targetSha256:characterSha(f.target),outputSha256:characterSha(out),blenderVersion:'4.5.14',arpVersion:'test-fixture-version-not-real'};
    write(join(d,'provenance.json'),record);
    const manifest={version:1,kind:'animation',id:'motion/walk',servedPath:'motions/walk.glb',sourceModel:'rig.glb',result:'walk.glb',motion:'motion.json',provenance:'provenance.json'};
    return {d,f,out,record,manifest,file:write(join(d,'return.json'),manifest)};
  }
  it('keeps Mock artifacts isolated, snapshots exact inputs and creates no official candidate',async()=>{
    const f=returnedAnimation(),w=join(f.d,'returned'),r=await acceptCharacterReturn(f.file,w,{mock:true});
    expect(r.mock).toBe(true);expect(r.candidate).toBeNull();expect(r.realArpValidated).toBe(false);expect(r.realMixamoValidated).toBe(false);
    expect(r.resultPath).toBe(join(w,'mock/animation.glb'));expect(readFileSync(r.resultPath)).toEqual(f.out);expect(r.inputs).toHaveLength(5);
    for(const s of r.inputs)expect(characterSha(readFileSync(s.snapshotPath))).toBe(s.sha256);
    expect(existsSync(join(w,'mock/asset-index-candidate.json'))).toBe(false);
  });
  it('produces only a pending user-supplied candidate for nonmock manual data, preserving motion origin',async()=>{
    const f=returnedAnimation({mockSource:false,realOutput:true}),w=join(f.d,'returned'),r=await acceptCharacterReturn(f.file,w);
    expect(r.candidate).toMatchObject({id:'motion/walk',type:'animation',spec:{skeleton:CHARACTER_PROFILE,fps:30,frames:31,loop:true}});
    expect(r.candidate.provenance.rigging.motion.source).toBe('mixamo-manual');expect(r.sourceEvidence).toBe('user-supplied-arp-export');expect(r.realArpValidated).toBe(false);
    expect(existsSync(join(w,'candidate/asset-index-candidate.json'))).toBe(true);expect(existsSync(join(f.d,'assets/index.json'))).toBe(false);
  });
  it('does not let Mock output become a real candidate',async()=>{
    const f=returnedAnimation({mockSource:false});await expect(acceptCharacterReturn(f.file,join(f.d,'rejected'))).rejects.toThrow(/Mock GLB/);expect(existsSync(join(f.d,'rejected'))).toBe(false);
  });
  it('rejects changed returned bytes before creating output directories',async()=>{
    const f=returnedAnimation();write(join(f.d,'walk.glb'),Buffer.from('changed'));await expect(acceptCharacterReturn(f.file,join(f.d,'rejected'),{mock:true})).rejects.toThrow(/输出SHA/);expect(existsSync(join(f.d,'rejected'))).toBe(false);
  });
  it('rejects another rest skeleton even with matching bone names',async()=>{
    const f=returnedAnimation(),{json,binary}=parseGlb(f.out);json.nodes[0].translation[1]+=.1;const different=pack(json,binary);write(join(f.d,'walk.glb'),different);f.record.outputSha256=characterSha(different);write(join(f.d,'provenance.json'),f.record);
    await expect(acceptCharacterReturn(f.file,join(f.d,'rejected'),{mock:true})).rejects.toThrow(/bind骨架/);
  });
  it('rejects extra clips in manual animation return before first-clip consumers see them',async()=>{
    const f=returnedAnimation(),{json,binary}=parseGlb(f.out);json.animations.unshift({...json.animations[0],name:'idle'});const multiple=pack(json,binary);write(join(f.d,'walk.glb'),multiple);f.record.outputSha256=characterSha(multiple);write(join(f.d,'provenance.json'),f.record);
    await expect(acceptCharacterReturn(f.file,join(f.d,'rejected'),{mock:true})).rejects.toThrow(/恰好一个clip/);expect(existsSync(join(f.d,'rejected'))).toBe(false);
  });
  function returnedRig() {
    const d=fresh(),f=markerFixture(),out=model();
    write(join(d,'source.glb'),f.source);write(join(d,'rig.glb'),out);
    for(let i=0;i<4;i++)write(join(d,f.sheet.views[i].path),f.views[i]);
    write(join(d,'markers.json'),f.sheet);
    const record={version:1,source:'mock-fixture',sourceSha256:characterSha(f.source),outputSha256:characterSha(out),markersSha256:markerDigest(f.sheet)};
    write(join(d,'provenance.json'),record);
    const manifest={version:1,kind:'rig',id:'model/hero',servedPath:'models/hero.glb',sourceModel:'source.glb',result:'rig.glb',markers:'markers.json',provenance:'provenance.json'};
    return {d,f,record,manifest,file:write(join(d,'return.json'),manifest)};
  }
  it('round-trips a Mock rig without confirming proposals or registering an asset',async()=>{
    const f=returnedRig(),r=await acceptCharacterReturn(f.file,join(f.d,'returned'),{mock:true});expect(r.candidate).toBeNull();expect(r.inspection.animations).toHaveLength(0);expect(r.inputs).toHaveLength(8);expect(JSON.parse(readFileSync(join(f.d,'markers.json'))).state).toBe('proposed');
  });
  it('rejects proposed markers on real manual rig return even if the record claims ARP',async()=>{
    const f=returnedRig();f.record.source='arp-manual';f.record.blenderVersion='4.5.14';f.record.arpVersion='manual-test-not-installed';const source=model({staticOnly:true,real:true});f.f.source=source;f.f.sheet.modelSha256=characterSha(source);write(join(f.d,'source.glb'),source);write(join(f.d,'markers.json'),f.f.sheet);f.record.sourceSha256=characterSha(source);f.record.markersSha256=markerDigest(f.f.sheet);write(join(f.d,'provenance.json'),f.record);
    await expect(acceptCharacterReturn(f.file,join(f.d,'rejected'))).rejects.toThrow(/真人确认/);expect(existsSync(join(f.d,'rejected'))).toBe(false);
  });
  it('rejects marker bounds that differ from the actual hashed source geometry',async()=>{
    const f=returnedRig();f.f.sheet.bounds[0][0]=-.31;f.f.sheet.bounds[1][0]=.31;write(join(f.d,'markers.json'),f.f.sheet);f.record.markersSha256=markerDigest(f.f.sheet);write(join(f.d,'provenance.json'),f.record);
    await expect(acceptCharacterReturn(f.file,join(f.d,'rejected'),{mock:true})).rejects.toThrow(/实际几何/);
  });
  it('will not overwrite a prior manual return',async()=>{
    const f=returnedAnimation(),w=join(f.d,'returned');await acceptCharacterReturn(f.file,w,{mock:true});const bytes=readFileSync(join(w,'mock/animation.glb'));await expect(acceptCharacterReturn(f.file,w,{mock:true})).rejects.toThrow(/EEXIST/);expect(readFileSync(join(w,'mock/animation.glb'))).toEqual(bytes);
  });
  it('writes motion search/IK data once, without pretending actions have been downloaded',()=>{
    const d=fresh(),p=join(d,'motion-list.md');writeMotionList(p);const s=readFileSync(p,'utf8');expect(s).toContain('Picking Up');expect(s).toContain('需IK修正');expect(s).toContain('FBX Without Skin');expect(()=>writeMotionList(p)).toThrow(/EEXIST/);
  });
  it('CLI stdout is one report JSON; unknown command/flags fail clearly',()=>{
    const d=fresh(),file=join(d,'motion-list.md'),cli=fileURLToPath(new URL('./character-pipeline.mjs',import.meta.url));
    const good=spawnSync(process.execPath,[cli,'motion-list',file],{encoding:'utf8'});expect(good.status).toBe(0);expect(good.stdout.trim().split('\n')).toHaveLength(1);expect(JSON.parse(good.stdout).ok).toBe(true);
    const bad=spawnSync(process.execPath,[cli,'unknown','--run-python','bad'],{encoding:'utf8'});expect(bad.status).toBe(1);expect(bad.stderr).toContain('未知参数');
  });
});
