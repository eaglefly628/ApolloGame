// Optional real offline T7 acceptance: BLENDER_BIN=<pinned LTS> node scripts/blender-job.integration.mjs
// The normal no-network suite uses mock/fake processes instead. This runner never silently skips.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBlenderJob } from './blender-job.mjs';
import { Euler, Quaternion } from 'three';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
if(!process.env.BLENDER_BIN)throw new Error('请设置固定LTS的BLENDER_BIN；真实验收不能以mock替代');
const dir=mkdtempSync(join(tmpdir(),'apollo-blender-real-'));
try {
  const row=(id,route)=>({id,scene:'courtyard',bbox:[0,0,32,32],route,skinKey:`fixture/${id}`,prompt:`fixture ${id}`,refs:['keyart/courtyard.png'],state:'approved'});
  writeFileSync(join(dir,'asset-split.json'),JSON.stringify([row('floor','build'),row('prop','generate')]));
  copyFileSync(join(root,'assets/meshes/cube.glb'),join(dir,'prop.glb'));
  const pose={position:[0,0,0],rotation:[0,0,0],scale:1};
  const build={op:'build-scene',inputs:['asset-split.json','prop.glb'],params:{scene:'courtyard',objects:[
    {...pose,name:'col_floor',splitId:'floor',source:{primitive:'box',size:[4,0.2,4]},position:[0,-0.1,0],color:[0.35,0.45,0.25,1]},
    {...pose,name:'nav_floor',splitId:'floor',source:{primitive:'plane',size:[4,0,4]},position:[0,0.001,0]},
    {...pose,name:'pick_prop',splitId:'prop',source:{input:1},position:[1,0.5,0],rotation:[0.1,0.3,0.2]},
    {...pose,name:'spawn_hero',source:{primitive:'empty'},position:[-1,0,1]},
  ]},outputs:['out/courtyard.glb']};
  const buildPath=join(dir,'build.json');writeFileSync(buildPath,JSON.stringify(build));
  const a=runBlenderJob(buildPath),b=runBlenderJob(buildPath);
  assert.equal(a.outputs[0].sha256,b.outputs[0].sha256,'同build job两跑GLB必须同hash');
  const bytes=readFileSync(a.outputs[0].path);const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  const names=gltf.nodes.map(n=>n.name);for(const name of ['col_floor','nav_floor','pick_prop','spawn_hero'])assert(names.includes(name),`E5节点丢失 ${name}`);
  const close=(a,b,label)=>assert(a.length===b.length&&a.every((x,i)=>Math.abs(x-b[i])<0.00001),label);
  close(gltf.nodes.find(n=>n.name==='spawn_hero').translation,[-1,0,1],'出生点必须保留引擎Y-up坐标');
  const prop=gltf.nodes.find(n=>n.name==='pick_prop');close(prop.translation,[1,0.5,0],'模型锚点米制Y-up不漂移');
  const expected=new Quaternion().setFromEuler(new Euler(0.1,0.3,0.2,'XYZ'));
  const actual=new Quaternion(...prop.rotation);assert(Math.abs(Math.abs(expected.dot(actual))-1)<0.00001,'三轴旋转须保留Three XYZ语义');
  const floor=gltf.nodes.find(n=>n.name==='col_floor');const primitive=gltf.meshes[floor.mesh].primitives[0];const bounds=gltf.accessors[primitive.attributes.POSITION];
  close(bounds.max.map((x,i)=>x-bounds.min[i]),[4,0.2,4],'地板尺寸不得交换Y/Z或猜厚度');
  const views=[{id:'front',position:[4,3,6],target:[0,0.4,0],fov:45,width:96,height:64},{id:'side',position:[-4,2,3],target:[0,0.4,0],fov:50,width:64,height:64}];
  const render={op:'render-views',inputs:['out/courtyard.glb'],params:{views},outputs:['out/front.png','out/side.png']};
  const renderPath=join(dir,'render.json');writeFileSync(renderPath,JSON.stringify(render));
  const c=runBlenderJob(renderPath),d=runBlenderJob(renderPath);
  assert.deepEqual(c.outputs.map(o=>o.sha256),d.outputs.map(o=>o.sha256),'同render job两跑PNG必须同hash');
  assert.notEqual(c.outputs[0].sha256,c.outputs[1].sha256,'不同机位应给出不同证据');
  for(let i=0;i<views.length;i++){const p=readFileSync(c.outputs[i].path);assert.equal(p.readUInt32BE(16),views[i].width);assert.equal(p.readUInt32BE(20),views[i].height);}
  for(const op of ['normalize','rig-arp','retarget-arp']) {
    const job={op,inputs:op==='retarget-arp'?['prop.glb','prop.glb']:['prop.glb'],params:{},outputs:[`out/${op}.glb`]};
    // Duplicate input paths are rejected by schema; make a distinct fixture for retarget.
    if(op==='retarget-arp'){copyFileSync(join(dir,'prop.glb'),join(dir,'motion.glb'));job.inputs[1]='motion.glb';}
    const p=join(dir,`${op}.json`);writeFileSync(p,JSON.stringify(job));
    assert.throws(()=>runBlenderJob(p),e=>{
      assert.match(e.message,/Blender退出码/);assert(e.logPath,'失败必须有作业日志');
      const log=readFileSync(e.logPath,'utf8');
      assert.match(log,op==='normalize'?/normalize executor not ready.*T4/:/Auto-Rig Pro plugin missing|T5 executor not ready/,'必须命中下游拒收原因，崩溃不能冒充通过');
      return true;
    },`${op} 下游未就绪必须明确失败`);assert(!existsSync(join(dir,job.outputs[0])));
  }
  console.log(JSON.stringify({ok:true,buildHash:a.outputs[0].sha256,views:c.outputs.map(o=>({sha256:o.sha256,bytes:o.bytes})),nodeNames:names,artifactDir:dir}));
  console.log('BLENDER-REAL: 同job两跑GLB/PNG哈希一致；四类E5节点保留；T4/T5未就绪明确拒收');
} finally {
  if(process.env.BLENDER_KEEP_EVIDENCE==='1')console.error(`[blender-real] evidence retained: ${dir}`);
  else rmSync(dir,{recursive:true,force:true});
}
