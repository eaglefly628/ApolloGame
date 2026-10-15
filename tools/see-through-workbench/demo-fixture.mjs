// Original vector illustration used only to validate the native animation port.
// This fixture is NOT an output of See-through inference.
import JSZip from 'jszip';
const W = 600, H = 760;
const svg = content => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="hair" x2="0.8" y2="1"><stop stop-color="#6671b8"/><stop offset=".4" stop-color="#353858"/><stop offset="1" stop-color="#222640"/></linearGradient><linearGradient id="cloth" x2=".8" y2="1"><stop stop-color="#f3efe9"/><stop offset="1" stop-color="#cbcbe0"/></linearGradient><radialGradient id="eye"><stop stop-color="#bdedf2"/><stop offset=".65" stop-color="#78a5d6"/><stop offset="1" stop-color="#324c7a"/></radialGradient></defs>${content}</svg>`;
const layers = [
  ['back hair', '<path d="M158 300Q137 176 295 161Q464 157 461 323L495 642Q435 690 399 638L370 573L231 575L197 660Q121 678 115 630Z" fill="url(#hair)" stroke="#20243c" stroke-width="5"/><path d="M155 336Q178 456 150 601M428 332Q412 464 457 608" fill="none" stroke="#8791c0" stroke-width="8" opacity=".4"/>'],
  ['topwear', '<path d="M240 424L360 424L400 470Q442 490 451 654L479 760H122L155 637Q165 489 209 470Z" fill="url(#cloth)" stroke="#43465b" stroke-width="5"/><path d="M220 476L266 449L300 509L335 449L384 477L360 760H242Z" fill="#414969"/><path d="M264 531L300 512L339 531L322 561L335 655L300 678L272 650L282 560Z" fill="#83b8be" stroke="#436276" stroke-width="3"/><path d="M182 538L210 760M416 539L390 760" stroke="#b6b6ca" stroke-width="5"/><circle cx="357" cy="603" r="5" fill="#e8c686"/><circle cx="359" cy="670" r="5" fill="#e8c686"/>'],
  ['neck', '<path d="M265 396L261 452Q299 482 337 449L333 395Z" fill="#efd6cb" stroke="#7e5963" stroke-width="3"/><path d="M268 402Q295 449 331 416L331 404Z" fill="#d9b6ae"/>'],
  ['face', '<ellipse cx="209" cy="329" rx="14" ry="23" fill="#efcfc5"/><ellipse cx="391" cy="329" rx="14" ry="23" fill="#efcfc5"/><path d="M204 262Q221 200 300 202Q380 203 396 265L383 346Q369 405 300 438Q225 408 214 349Z" fill="#f8e6dc" stroke="#805968" stroke-width="3"/><ellipse cx="247" cy="364" rx="25" ry="9" fill="#efa9b1" opacity=".36"/><ellipse cx="357" cy="364" rx="25" ry="9" fill="#efa9b1" opacity=".36"/><path d="M300 341L297 355L305 358" fill="none" stroke="#cf9693" stroke-width="2"/>'],
  ['eyewhite-l', '<path d="M227 305Q253 292 278 309Q268 335 243 329Q230 324 227 305Z" fill="#fffcf6"/>'],
  ['eyewhite-r', '<path d="M324 308Q347 292 373 306Q371 327 355 331Q332 334 324 308Z" fill="#fffcf6"/>'],
  ['irides-l', '<ellipse cx="254" cy="311" rx="14" ry="21" fill="url(#eye)"/><ellipse cx="254" cy="311" rx="5" ry="12" fill="#202742"/><ellipse cx="249" cy="300" rx="5" ry="6" fill="#fff"/><circle cx="260" cy="319" r="3" fill="#d9f9ff"/>'],
  ['irides-r', '<ellipse cx="347" cy="311" rx="14" ry="21" fill="url(#eye)"/><ellipse cx="347" cy="311" rx="5" ry="12" fill="#202742"/><ellipse cx="342" cy="300" rx="5" ry="6" fill="#fff"/><circle cx="354" cy="319" r="3" fill="#d9f9ff"/>'],
  ['eyelash-l', '<path d="M223 300L231 307Q249 291 279 308" fill="none" stroke="#302b42" stroke-width="6" stroke-linecap="round"/><path d="M238 329Q255 337 272 328" fill="none" stroke="#805c72" stroke-width="2"/>'],
  ['eyelash-r', '<path d="M325 307Q351 291 371 306L379 299" fill="none" stroke="#302b42" stroke-width="6" stroke-linecap="round"/><path d="M330 329Q347 337 364 328" fill="none" stroke="#805c72" stroke-width="2"/>'],
  ['eyebrow', '<path d="M231 281Q252 273 275 282M329 281Q349 273 370 281" fill="none" stroke="#57506c" stroke-width="4" stroke-linecap="round"/>'],
  ['mouth', '<path d="M284 384Q301 394 318 383" fill="none" stroke="#aa6577" stroke-width="3" stroke-linecap="round"/><path d="M294 399Q300 402 307 399" fill="none" stroke="#e4b7b3" stroke-width="2"/>'],
  ['front hair', '<path d="M177 300Q160 182 282 164Q425 143 443 272L409 367L383 329L375 250Q347 283 311 287L323 241Q288 278 253 287L259 256L220 307L207 359L184 333Z" fill="url(#hair)" stroke="#20243c" stroke-width="5"/><path d="M213 218Q257 176 296 177M348 178Q391 191 410 227M229 245L251 214" fill="none" stroke="#9ba6d5" stroke-width="6" opacity=".4"/><path d="M366 225Q385 244 390 294" fill="none" stroke="#6879ae" stroke-width="4"/>'],
  ['headwear', '<path d="M391 222L408 201L412 227L437 234L411 243L406 267L398 242L373 239Z" fill="#ebd198" stroke="#a58c64" stroke-width="2"/><circle cx="407" cy="235" r="6" fill="#a9dce0"/>'],
];
const transform = (extra = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...extra });
function mesh() {
  const vertices = [], uvs = [], triangles = [];
  for (let y = 0; y <= 12; y++) for (let x = 0; x <= 8; x++) {
    vertices.push({ x: W*x/8, y: H*y/12, restX: W*x/8, restY: H*y/12 }); uvs.push(x/8, y/12);
  }
  for (let y = 0; y < 12; y++) for (let x = 0; x < 8; x++) {
    const i = y*9+x; triangles.push([i,i+1,i+10],[i,i+10,i+9]);
  }
  return { vertices, uvs, triangles, edgeIndices: [] };
}
const keys = pairs => pairs.map(([time,value]) => ({ time, value, easing: 'ease-both' }));
async function rasterize(content) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(content))}`;
  await image.decode();
  const canvas = document.createElement('canvas'); canvas.width=W; canvas.height=H;
  canvas.getContext('2d').drawImage(image,0,0);
  return new Promise(resolve => canvas.toBlob(resolve,'image/png'));
}
export async function makeDemoBundle() {
  const zip = new JSZip();
  const nodes = [
    { id:'body', type:'group', name:'Body', parent:null, visible:true, opacity:1, transform:transform({pivotX:300,pivotY:650}) },
    { id:'head', type:'group', name:'Head', parent:'body', visible:true, opacity:1, transform:transform({pivotX:300,pivotY:432}) },
    { id:'eye-l', type:'group', name:'Left eye', parent:'head', visible:true, opacity:1, transform:transform({pivotX:253,pivotY:311}) },
    { id:'eye-r', type:'group', name:'Right eye', parent:'head', visible:true, opacity:1, transform:transform({pivotX:349,pivotY:311}) },
  ];
  const textures = [];
  for (let i=0;i<layers.length;i++) {
    const [name,content]=layers[i],id=`part-${i}`;
    zip.file(`textures/${id}.png`,await rasterize(content));
    textures.push({id,source:`textures/${id}.png`});
    const parent=name==='topwear'?'body':name.endsWith('-l')?'eye-l':name.endsWith('-r')?'eye-r':'head';
    nodes.push({id,type:'part',name,parent,draw_order:i,opacity:1,visible:true,transform:transform(),imageWidth:W,imageHeight:H,mesh:mesh(),blendShapes:[],blendShapeValues:{}});
  }
  const hair=nodes.find(n=>n.name==='back hair');
  const bend=amount=>hair.mesh.vertices.map(v=>({x:v.x+amount*Math.max(0,(v.y-180)/580)**2,y:v.y}));
  const idle = { id:'idle',name:'呼吸 · 眨眼 · 发丝摆动',duration:4000,fps:30,loopKeyframes:true,tracks:[
    {nodeId:'body',property:'scaleY',keyframes:keys([[0,1],[2000,1.015],[4000,1]])},
    {nodeId:'head',property:'rotation',keyframes:keys([[0,-1.8],[2000,1.8],[4000,-1.8]])},
    ...['eye-l','eye-r'].map(nodeId=>({nodeId,property:'scaleY',keyframes:keys([[0,1],[1250,1],[1380,0.08],[1530,1],[4000,1]])})),
    {nodeId:hair.id,property:'mesh_verts',keyframes:keys([[0,bend(-8)],[2000,bend(8)],[4000,bend(-8)]])},
  ] };
  const turn = { id:'turn',name:'转头',duration:2400,fps:30,tracks:[{nodeId:'head',property:'rotation',keyframes:keys([[0,-6],[1200,6],[2400,-6]])}] };
  const gaze = {id:'gaze',name:'视线参数',duration:1000,fps:30,tracks: nodes.filter(n=>n.name.startsWith('irides')).map(n=>({nodeId:n.id,property:'x',keyframes:keys([[0,-7],[1000,7]])}))};
  const track = (nodeId, property, values) => ({nodeId, property, keyframes:keys(values)});
  const clip = (id, name, duration, tracks) => ({id,name,duration,fps:30,loopKeyframes:true,tracks});
  const blink = (duration, times, eyes=['eye-l','eye-r']) => eyes.map(id => track(id,'scaleY',[[0,1],...times.flatMap(t=>[[t,1],[t+100,.08],[t+250,1]]),[duration,1]]));
  const sway = duration => track(hair.id,'mesh_verts',[[0,bend(-8)],[duration/4,bend(12)],[duration/2,bend(-12)],[duration*3/4,bend(8)],[duration,bend(-8)]]);
  const breath = duration => track('body','scaleY',[[0,1],[duration/2,1.015],[duration,1]]);
  const nod = clip('nod','点头回应 · 双眨眼',3200,[
    track('head','y',[[0,0],[600,12],[1100,0],[1600,9],[2100,0],[3200,0]]),
    track('head','scaleY',[[0,1],[600,.96],[1100,1],[1600,.97],[2100,1],[3200,1]]),
    ...blink(3200,[450,1500]),breath(3200),sway(3200),
  ]);
  const shake = clip('shake','轻摇头 · 发丝跟随',3600,[
    track('head','rotation',[[0,0],[600,-7],[1200,7],[1800,-6],[2400,6],[3000,0],[3600,0]]),
    track('head','x',[[0,0],[600,-6],[1200,6],[1800,-5],[2400,5],[3000,0],[3600,0]]),
    ...blink(3600,[2650]),breath(3600),sway(3600),
  ]);
  const curious = clip('curious','好奇歪头 · 左右观察',4800,[
    track('head','rotation',[[0,0],[1000,-9],[2000,-9],[3200,8],[4000,8],[4800,0]]),
    track('head','x',[[0,0],[1000,-8],[2000,-8],[3200,8],[4000,8],[4800,0]]),
    ...['eye-l','eye-r'].map(id=>track(id,'x',[[0,0],[900,-4],[2100,-4],[3100,4],[4100,4],[4800,0]])),
    ...blink(4800,[2200]),breath(4800),sway(4800),
  ]);
  const wink = clip('wink','俏皮眨眼 · 轻轻侧身',3200,[
    ...blink(3200,[850],['eye-l']),
    track('head','rotation',[[0,0],[1000,-6],[1800,-6],[3200,0]]),
    track('body','rotation',[[0,0],[1000,2],[1800,2],[3200,0]]),sway(3200),breath(3200),
  ]);
  const greeting = clip('greeting','轻鞠躬 · 问候',4400,[
    track('body','y',[[0,0],[1500,12],[2400,12],[4000,0],[4400,0]]),
    track('body','scaleY',[[0,1],[1500,.975],[2400,.975],[4000,1],[4400,1]]),
    track('head','y',[[0,0],[1500,15],[2400,15],[4000,0],[4400,0]]),
    track('head','scaleY',[[0,1],[1500,.96],[2400,.96],[4000,1],[4400,1]]),
    ...blink(4400,[1400,3600]),sway(4400),
  ]);
  const showcase = clip('showcase','组合展示 · 呼吸 → 观察 → 点头 → 眨眼 → 问候',20000,[
    track('body','scaleY',[[0,1],[2000,1.015],[4000,1],[6000,1.015],[8000,1],[10000,1.015],[12000,1],[14500,1],[16500,.975],[18000,.975],[19500,1],[20000,1]]),
    track('body','rotation',[[0,0],[10000,0],[11500,2],[13000,0],[20000,0]]),
    track('body','y',[[0,0],[14500,0],[16500,12],[18000,12],[19500,0],[20000,0]]),
    track('head','rotation',[[0,0],[2000,2],[4000,-8],[5500,-8],[7000,8],[8500,8],[10000,0],[11500,-6],[13000,0],[14500,0],[20000,0]]),
    track('head','x',[[0,0],[3000,0],[4000,-8],[5500,-8],[7000,8],[8500,8],[10000,0],[20000,0]]),
    track('head','y',[[0,0],[8500,0],[9100,12],[9600,0],[10100,9],[10600,0],[14500,0],[16500,15],[18000,15],[19500,0],[20000,0]]),
    track('head','scaleY',[[0,1],[8500,1],[9100,.96],[9600,1],[10100,.97],[10600,1],[14500,1],[16500,.96],[18000,.96],[19500,1],[20000,1]]),
    ...['eye-l','eye-r'].map(id=>track(id,'x',[[0,0],[3000,0],[4000,-4],[5500,-4],[7000,4],[8500,4],[10000,0],[20000,0]])),
    ...blink(20000,[1250,5750,8900,14300,16500,18800],['eye-r']),
    ...blink(20000,[1250,5750,8900,11400,14300,16500,18800],['eye-l']),
    sway(20000),
  ]);
  const project={version:'0.1',canvas:{width:W,height:H,x:0,y:0,bgEnabled:false,bgColor:'#ffffff'},nodes,textures,animations:[showcase,idle,curious,nod,shake,wink,greeting,turn,gaze],parameters:[{id:'gaze-x',name:'视线',min:-1,max:1,default:0,bindings:gaze.tracks.map(t=>({animationId:'gaze',nodeId:t.nodeId,property:'x'}))}],physics_groups:[],physicsRules:[]};
  zip.file('project.json',JSON.stringify(project));
  return zip.generateAsync({type:'uint8array'});
}
