// Offline authoring only: emit native rig data, never repaint source PNG pixels.
import JSZip from 'jszip';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateNativeProject } from './project-validation.mjs';
const root = new URL('./', import.meta.url);
const dir = new URL('public/art/xuetuan-layered-v1/', root);
const W = 1312, H = 1199;
const identity = (extra = {}) => ({ x:0,y:0,rotation:0,scaleX:1,scaleY:1,pivotX:0,pivotY:0,...extra });
const zip = new JSZip(), textures = [], metadata = [];
const eyelids=[];
const nodes = [
  { id:'root',type:'group',name:'雪团 · 待审分层样片',parent:null,visible:true,opacity:1,transform:identity() },
  { id:'head-root',type:'group',name:'头部连接',parent:'root',visible:true,opacity:1,transform:identity({pivotX:490,pivotY:440}) },
];
const specs = JSON.parse(await readFile(new URL('alignment.json',dir),'utf8'));
for (const spec of specs.parts) {
  const bytes = await readFile(new URL(spec.file,dir));
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const [sx,sy,tx,ty] = spec.affine;
  const vertices=[],uvs=[],triangles=[],cols=24,rows=24;
  const crop=spec.crop ?? [0,0,width,height];
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const ix=crop[0]+(crop[2]-crop[0])*col/cols,iy=crop[1]+(crop[3]-crop[1])*row/rows;
    const x=ix*sx+tx;
    let y=iy*sy+ty;
    // Fold completed neck-stump fur behind the head; all paws remain fixed.
    if(spec.id==='body')y+=Math.max(0,500-y)*.64;
    vertices.push({x,y,restX:x,restY:y});uvs.push(ix/width,iy/height);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const i=row*(cols+1)+col;triangles.push([i,i+1,i+cols+2],[i,i+cols+2,i+cols+1]);
  }
  const id=spec.id;
  nodes.push({id,type:'part',name:spec.name,parent:spec.parent,draw_order:spec.order,visible:true,opacity:id.startsWith('blink-')?0:1,transform:identity(spec.pivot?{pivotX:spec.pivot[0],pivotY:spec.pivot[1]}:{}),imageWidth:width,imageHeight:height,mesh:{vertices,uvs,triangles,edgeIndices:[]},blendShapes:[],blendShapeValues:{}});
  const source='textures/'+spec.file;
  textures.push({id,source});zip.file(source,bytes);
  metadata.push({id,file:spec.file,width,height,sha256:createHash('sha256').update(bytes).digest('hex')});
}
// Reuse the generated closed-head pixels only around the eyelids. Native nested
// mesh discs soften the patch boundary; no pixels are cut or painted offline.
const closedBytes=await readFile(new URL('head-closed.png',dir));
const cw=closedBytes.readUInt32BE(16),ch=closedBytes.readUInt32BE(20);
zip.file('textures/head-closed.png',closedBytes);
for(const [side,cx,cy,rx,ry] of [['left',500,415,100,80],['right',750,492,105,75]]){
  for(const [level,radius,alpha] of [[0,1,.10],[1,.90,.15],[2,.80,.25],[3,.70,.45],[4,.60,1]]){
    const id=`blink-${side}-${level}`,vertices=[],uvs=[],triangles=[];
    const point=(x,y)=>{vertices.push({x:x*.64+115,y:y*.64+23,restX:x*.64+115,restY:y*.64+23});uvs.push(x/cw,y/ch);};
    point(cx,cy);
    for(let i=0;i<48;i++){const angle=i*Math.PI*2/48;point(cx+Math.cos(angle)*rx*radius,cy+Math.sin(angle)*ry*radius);}
    for(let i=0;i<48;i++)triangles.push([0,i+1,(i+1)%48+1]);
    nodes.push({id,type:'part',name:(side==='left'?'左眼睑':'右眼睑')+' · 柔边 '+level,parent:'head-root',draw_order:4+level*.01+(side==='right'?.1:0),visible:true,opacity:0,transform:identity(),imageWidth:cw,imageHeight:ch,mesh:{vertices,uvs,triangles,edgeIndices:[]},blendShapes:[],blendShapeValues:{}});
    textures.push({id,source:'textures/head-closed.png'});eyelids.push({id,side,alpha});
    metadata.push({id,file:'head-closed.png',width:cw,height:ch,sha256:createHash('sha256').update(closedBytes).digest('hex')});
  }
}
const track=(nodeId,property,values)=>({nodeId,property,keyframes:values.map(([time,value])=>({time,value,easing:'ease-both'}))});
const mesh=id=>nodes.find(n=>n.id===id).mesh.vertices;
const pose=(id,amount)=>mesh(id).map(v=>{
  if(id==='body'){
    const weight=Math.max(0,1-Math.abs((v.y-680)/330))*Math.max(0,1-Math.abs((v.x-490)/430));
    return {x:v.x,y:v.y-amount*weight};
  }
  const weight=Math.max(0,Math.min(1,(v.x-865)/340));
  return {x:v.x+amount*weight*.35,y:v.y-amount*weight};
});
const blink=(duration,times)=>{
  const values=[[0,0],...times.flatMap(t=>[[t,0],[t+100,1],[t+190,1],[t+310,0]]),[duration,0]];
  return eyelids.map(({id,alpha})=>track(id,'opacity',values.map(([time,value])=>[time,value*alpha])));
};
const makeClip=(id,name,duration,amount=1)=>({id,name,duration,fps:30,loopKeyframes:true,audioTracks:[],tracks:[
  track('body','mesh_verts',[[0,pose('body',0)],[duration/2,pose('body',5)],[duration,pose('body',0)]]),
  track('tail','mesh_verts',[[0,pose('tail',0)],[duration*.25,pose('tail',26*amount)],[duration*.7,pose('tail',-18*amount)],[duration,pose('tail',0)]]),
  track('ear-left','rotation',[[0,0],[duration*.22,-8*amount],[duration*.32,2],[duration*.44,0],[duration,0]]),
  track('ear-right','rotation',[[0,0],[duration*.6,7*amount],[duration*.7,-2],[duration*.8,0],[duration,0]]),
  ...blink(duration,duration>10000?[1300,5900,10900]:[1400]),
]});
const idle=makeClip('idle','雪团待审 · 呼吸 · 眨眼 · 耳动 · 摆尾',5200,.65);
const notice=makeClip('notice','雪团待审 · 歪头回应',4200,1);
notice.tracks.push(track('head-root','rotation',[[0,0],[1000,-3],[2200,-3],[3400,0],[4200,0]]));
const showcase=makeClip('showcase','雪团待审 · 16秒动作组合',16000,1);
showcase.tracks.push(track('head-root','rotation',[[0,0],[10000,0],[12500,-3],[14500,1.5],[16000,0]]));
const parameters=[],parameterTracks=[];
const bind=(id,name,min,max,def,bindings)=>{
  parameters.push({id,name,min,max,default:def,bindings:bindings.map(t=>({animationId:'parameters',nodeId:t.nodeId,property:t.property}))});
  parameterTracks.push(...bindings);
};
bind('HeadTilt','歪头',-1,1,0,[track('head-root','rotation',[[0,-4],[500,0],[1000,4]])]);
bind('EarLeft','左耳转动',-1,1,0,[track('ear-left','rotation',[[0,-12],[500,0],[1000,12]])]);
bind('EarRight','右耳转动',-1,1,0,[track('ear-right','rotation',[[0,-10],[500,0],[1000,10]])]);
bind('Tail','尾尖摆动',-1,1,0,[track('tail','mesh_verts',[[0,pose('tail',-30)],[500,pose('tail',0)],[1000,pose('tail',30)]])]);
bind('Breath','胸毛呼吸',0,1,0,[track('body','mesh_verts',[[0,pose('body',0)],[1000,pose('body',8)]])]);
for(const side of ['left','right'])bind('EyeOpen-'+side,side==='left'?'左眼开合':'右眼开合',0,1,1,eyelids.filter(p=>p.side===side).map(({id,alpha})=>track(id,'opacity',[[0,alpha],[1000,0]])));
const project={version:'1.0',canvas:{width:W,height:H},textures,nodes,animations:[idle,notice,showcase,{id:'parameters',name:'Parameters',duration:1000,fps:30,tracks:parameterTracks,audioTracks:[]},{id:'controls',name:'手动参数控制 · 待审',duration:2000,fps:30,tracks:[],audioTracks:[]}],parameters,physics_groups:[],physicsRules:[]};
validateNativeProject(project);zip.file('project.json',JSON.stringify(project));
await writeFile(new URL('public/art/xuetuan-layered-v1.stretch',root),await zip.generateAsync({type:'nodebuffer'}));
await writeFile(new URL('rig-manifest.json',dir),JSON.stringify({status:'pending-human-review',game112Installed:false,sourcePixelsModified:false,canvas:project.canvas,parts:metadata,parameters,clips:project.animations.map(a=>({id:a.id,name:a.name,duration:a.duration})),limits:'Reference redraw; no walking, turning, mouth or new viewpoints. Stationary legs remain one body layer.'},null,2)+'\n');
console.log('Saved pending Xuetuan native rig; no game AssetIndex or runtime changed.');
