// Offline binary FBX motion structure check. This is not an Autodesk SDK importer,
// license check, humanoid mapper or proof of Auto-Rig Pro Remap execution.
// Layout checked against Blender 4.5 io_scene_fbx/{parse_fbx,encode_bin,export_fbx_bin}.py.
import { inflateSync } from 'node:zlib';

const MAGIC=Buffer.from('Kaydara FBX Binary  \0\x1a\0','binary');
const VERSIONS=new Set([7100,7200,7300,7400,7500,7600,7700]);
const LIMITS=Object.freeze({bytes:64*1024*1024,nodes:100000,depth:64,properties:500000,arrayElements:2000000,decodedBytes:128*1024*1024,objects:50000,connections:100000,footerBytes:512});
const WIDTH={Z:1,Y:2,B:1,C:1,I:4,F:4,D:8,L:8,b:1,c:1,i:4,l:8,f:4,d:8};
const ANIMATION=new Set(['AnimationStack','AnimationLayer','AnimationCurveNode','AnimationCurve']);
const TRANSFORMS=new Set(['Lcl Translation','Lcl Rotation','Lcl Scaling']);
const AXES=new Set(['d|X','d|Y','d|Z']);
function check(condition,message) {if(!condition)throw new Error(`Motion FBX: ${message}`);}
const scalar=(property,type,label)=>{check(property?.type===type,`${label} must use ${type}`);return property.value;};
function onlyChild(node,name,required=true) {const matches=node.children.filter(n=>n.name===name);check(required?matches.length===1:matches.length<=1,`${node.name} requires ${required?'exactly':'at most'} one ${name}`);return matches[0];}
function singleArray(node,name,type) {const child=onlyChild(node,name);check(child.properties.length===1&&child.children.length===0,`${name} must contain exactly one array property`);const property=child.properties[0];check(property.type===type,`${name} must use ${type} array`);return property;}
function arrayValue(property,index) {const offset=index*WIDTH[property.type],b=property.bytes;return property.type==='l'?b.readBigInt64LE(offset):property.type==='i'?b.readInt32LE(offset):property.type==='f'?b.readFloatLE(offset):b.readDoubleLE(offset);}

/**
 * Supported subset: binary FBX 7.1..7.7, raw/zlib standard properties,
 * positive unique object IDs, OO/OP connections and sampled XYZ Model transform animation. ASCII, unknown
 * connection modes, unsupported animation bindings and zero-duration playback reject. Fully
 * unbound exporter curve objects are still structurally validated and reported,
 * but do not contribute to the connected motion's samples or duration.
 * A root null record is mandatory; up to 512 trailing footer bytes remain opaque.
 * Returned counts prove bounded structure and connected samples, not DCC playback.
 */
export function validateMotionFbx(bytes) {
 check(bytes instanceof Uint8Array||bytes instanceof ArrayBuffer,'bytes must be Uint8Array or ArrayBuffer');
 const data=Buffer.from(bytes instanceof ArrayBuffer?bytes:bytes.buffer,bytes instanceof ArrayBuffer?0:bytes.byteOffset,bytes.byteLength);
 check(data.length>=27&&data.length<=LIMITS.bytes,'file size outside 27..64MiB budget');
 check(data.subarray(0,23).equals(MAGIC),'binary Kaydara signature required; export binary FBX from a DCC (ASCII FBX is unsupported)');
 const version=data.readUInt32LE(23);check(VERSIONS.has(version),'supported binary versions are 7100..7700 in steps of 100');
 const wide=version>=7500,recordBytes=wide?25:13;
 let nodes=0,properties=0,decodedBytes=0;
 const within=(offset,length,end,label)=>{check(Number.isSafeInteger(length)&&length>=0&&offset>=0&&offset+length<=end&&offset+length<=data.length,`${label} truncated or exceeds declared scope`);};
 function word(offset) {if(!wide)return data.readUInt32LE(offset);const value=data.readBigUInt64LE(offset);check(value<=BigInt(Number.MAX_SAFE_INTEGER),'64-bit record field exceeds safe/bounded range');return Number(value);}
 function property(cursor,end) {
  within(cursor,1,end,'property type');const type=String.fromCharCode(data[cursor++]);
  if(type==='S'||type==='R') {
   within(cursor,4,end,'string/raw length');const length=data.readUInt32LE(cursor);cursor+=4;within(cursor,length,end,'string/raw property');
   const value=type==='S'?data.toString('utf8',cursor,cursor+length):data.subarray(cursor,cursor+length);return [{type,value},cursor+length];
  }
  const width=WIDTH[type];check(width,`unsupported property type ${JSON.stringify(type)}`);
  if(type===type.toLowerCase()) {
   within(cursor,12,end,'array header');const count=data.readUInt32LE(cursor),encoding=data.readUInt32LE(cursor+4),stored=data.readUInt32LE(cursor+8);cursor+=12;
   check(count<=LIMITS.arrayElements,'array element budget exceeded');const length=count*width;decodedBytes+=length;check(decodedBytes<=LIMITS.decodedBytes,'decoded array byte budget exceeded');
   check(encoding===0||encoding===1,'array encoding must be raw 0 or zlib 1');within(cursor,stored,end,'array payload');let payload=data.subarray(cursor,cursor+stored);
   if(encoding===0)check(stored===length,'raw array byte length/count mismatch');
   else {try {const result=inflateSync(payload,{maxOutputLength:Math.max(1,length),info:true});check(result.engine.bytesWritten===stored,'zlib array has trailing/concatenated bytes');payload=result.buffer;}catch(e){throw new Error(`Motion FBX: invalid/over-budget zlib array: ${e.message}`);}check(payload.length===length,'decoded array byte length/count mismatch');}
   if(type==='f'||type==='d')for(let i=0;i<count;i++)check(Number.isFinite(type==='f'?payload.readFloatLE(i*width):payload.readDoubleLE(i*width)),'non-finite array float');
   return [{type,count,bytes:payload},cursor+stored];
  }
  within(cursor,width,end,'scalar property');let value;
  if(type==='L')value=data.readBigInt64LE(cursor);
  else if(type==='I')value=data.readInt32LE(cursor);
  else if(type==='Y')value=data.readInt16LE(cursor);
  else if(type==='Z')value=data.readInt8(cursor);
  else if(type==='F'||type==='D'){value=type==='F'?data.readFloatLE(cursor):data.readDoubleLE(cursor);check(Number.isFinite(value),'non-finite scalar float');}
  else {value=data[cursor];if(type==='B')check(value<=1,'invalid bool property');}
  return [{type,value},cursor+width];
 }
 function record(start,parentEnd,depth) {
  check(depth<=LIMITS.depth,'node hierarchy depth budget exceeded');within(start,recordBytes,parentEnd,'record header');
  const end=word(start),count=word(start+(wide?8:4)),length=word(start+(wide?16:8)),nameLength=data[start+recordBytes-1];
  if(end===0){check(data.subarray(start,start+recordBytes).every(v=>v===0),'malformed null record');return [null,start+recordBytes];}
  nodes++;properties+=count;check(nodes<=LIMITS.nodes&&properties<=LIMITS.properties,'node/property count budget exceeded');
  check(end>start+recordBytes&&end<=parentEnd&&end<=data.length,'absolute end offset outside parent/file or not forward');
  check(nameLength>0,'record name must not be empty');within(start+recordBytes,nameLength,end,'record name');
  const nameBytes=data.subarray(start+recordBytes,start+recordBytes+nameLength);check(nameBytes.every(v=>v>=32&&v<=126),'record name must be printable ASCII');
  const name=nameBytes.toString('ascii');let cursor=start+recordBytes+nameLength;within(cursor,length,end,'property list');const propertyEnd=cursor+length;
  check(count<=length,'property count exceeds declared byte length');const props=[];
  for(let i=0;i<count;i++){const [prop,next]=property(cursor,propertyEnd);props.push(prop);cursor=next;}
  check(cursor===propertyEnd,'property list byte length/count mismatch');const children=[];
  if(cursor<end) {
   check(cursor+recordBytes<=end,'children lack a complete null terminator');const childrenEnd=end-recordBytes;
   while(cursor<childrenEnd){const [child,next]=record(cursor,childrenEnd,depth+1);check(child!==null,'early/unexpected child terminator');children.push(child);cursor=next;}
   check(cursor===childrenEnd,'child record crosses sibling/parent boundary');check(data.subarray(cursor,end).every(v=>v===0),'children null terminator must be all zero');cursor=end;
  }
  check(cursor===end,'record end offset not reached exactly');return [{name,properties:props,children},end];
 }
 const roots=[];let cursor=27,terminated=false;
 while(cursor<data.length){const [node,next]=record(cursor,data.length,0);cursor=next;if(node===null){terminated=true;break;}roots.push(node);}
 check(terminated,'missing root null terminator');check(data.length-cursor<=LIMITS.footerBytes,'opaque footer exceeds 512 byte budget');
 const root={name:'root',children:roots},objects=onlyChild(root,'Objects'),connections=onlyChild(root,'Connections');
 check(objects.properties.length===0&&connections.properties.length===0,'Objects/Connections must be property-free containers');
 check(objects.children.length>0&&objects.children.length<=LIMITS.objects,'object count outside budget');
 const byId=new Map(),byType=new Map();
 for(const object of objects.children) {
  check(object.properties.length===3,'object declarations require ID, name and subtype');const id=scalar(object.properties[0],'L','object ID');
  check(id>0n&&!byId.has(id),'object IDs must be positive and unique');scalar(object.properties[1],'S','object name');scalar(object.properties[2],'S','object subtype');object.id=id;byId.set(id,object);
  if(!byType.has(object.name))byType.set(object.name,[]);byType.get(object.name).push(object);
 }
 for(const type of ANIMATION)check(byType.get(type)?.length>0,`Objects lacks ${type}`);
 check(connections.children.length>0&&connections.children.length<=LIMITS.connections,'connection count outside budget');
 const outgoing=new Map(),incoming=new Map(),seen=new Set(),constantDefaultAxes=new Map();let constantDefaultConnections=0;
 function declaredConstantAxis(node,axis) {
  const properties=onlyChild(node,'Properties70',false);if(!properties)return false;
  const defaults=properties.children.filter(p=>p.name==='P'&&p.properties[0]?.type==='S'&&p.properties[0].value===axis);
  if(defaults.length!==1)return false;const props=defaults[0].properties;
  return props.length===5&&!defaults[0].children.length&&props[1]?.type==='S'&&props[1].value==='Number'&&props[2]?.type==='S'&&props[3]?.type==='S'&&['D','F','I'].includes(props[4]?.type)&&Number.isFinite(props[4].value);
 }
 for(const connection of connections.children) {
  check(connection.name==='C'&&!connection.children.length,'Connections only supports leaf C records');
  const props=connection.properties,mode=scalar(props[0],'S','connection mode');check((mode==='OO'&&props.length===3)||(mode==='OP'&&props.length===4),'only exact OO/OP connection layouts are supported');
  const from=scalar(props[1],'L','connection source'),to=scalar(props[2],'L','connection target');
  const field=mode==='OP'?scalar(props[3],'S','connection property'):'';check(mode!=='OP'||field.length>0,'OP property must be nonempty');
  const target=byId.get(to);
  if(!byId.has(from)&&from>0n&&from!==to&&mode==='OP'&&target?.name==='AnimationCurveNode'&&AXES.has(field)&&declaredConstantAxis(target,field)) {
   const key=`${mode}:${from}:${to}:${field}`;check(!seen.has(key),'duplicate connection');seen.add(key);
   if(!constantDefaultAxes.has(to))constantDefaultAxes.set(to,new Set());const axes=constantDefaultAxes.get(to);check(!axes.has(field),'duplicate constant default axis');axes.add(field);constantDefaultConnections++;continue;
  }
  check(byId.has(from)&&(to===0n||byId.has(to))&&from!==to,'connection references missing/self object');
  const sourceType=byId.get(from).name,targetType=target?.name;
  if(ANIMATION.has(targetType))check(ANIMATION.has(sourceType),'unsupported non-animation link into animation hierarchy');
  const key=`${mode}:${from}:${to}:${field}`;check(!seen.has(key),'duplicate connection');seen.add(key);
  const item={mode,from,to,field};if(!outgoing.has(from))outgoing.set(from,[]);outgoing.get(from).push(item);if(!incoming.has(to))incoming.set(to,[]);incoming.get(to).push(item);
 }
 // Model parent chains are distinct from the binary record tree and must also be acyclic.
 const modelParents=new Map();
 for(const model of byType.get('Model')||[]) {
  const parents=(outgoing.get(model.id)||[]).filter(c=>c.mode==='OO');
  check(parents.length<=1&&parents.every(c=>c.to===0n||byId.get(c.to)?.name==='Model'),'Model requires at most one Model/root parent');
  if(parents.length)modelParents.set(model.id,parents[0].to);
 }
 for(const id of modelParents.keys()) {const visited=new Set();let current=id;while(current!==0n&&modelParents.has(current)){check(!visited.has(current)&&visited.size<256,'Model parent hierarchy cycle/depth budget exceeded');visited.add(current);current=modelParents.get(current);}}
 const links=(id,mode,type)=>(outgoing.get(id)||[]).filter(c=>c.mode===mode&&byId.get(c.to)?.name===type);
 const unboundNodes=new Set(byType.get('AnimationCurveNode').filter(node=>!(outgoing.get(node.id)||[]).length).map(node=>node.id));
 let samples=0,minTime,maxTime,unboundCurves=0,constantKeyCurves=0;
 for(const curve of byType.get('AnimationCurve')) {
  const times=singleArray(curve,'KeyTime','l'),values=singleArray(curve,'KeyValueFloat','f');check(times.count>=1&&times.count===values.count,'KeyTime/KeyValueFloat require equal counts with at least one sample');if(times.count===1)constantKeyCurves++;
  let previous;for(let i=0;i<times.count;i++){const time=arrayValue(times,i);check(previous===undefined||time>previous,'KeyTime must be strictly increasing');previous=time;}
  const first=arrayValue(times,0),last=arrayValue(times,times.count-1);
  const attrs=['KeyAttrFlags','KeyAttrDataFloat','KeyAttrRefCount'].map(name=>onlyChild(curve,name,false));
  if(attrs.some(Boolean)) {
   check(attrs.every(Boolean),'curve key attributes must include Flags, DataFloat and RefCount together');
   const flags=singleArray(curve,'KeyAttrFlags','i'),dataFloat=singleArray(curve,'KeyAttrDataFloat','f'),refs=singleArray(curve,'KeyAttrRefCount','i');
   check(flags.count>0&&refs.count===flags.count&&dataFloat.count===flags.count*4,'key attribute array counts mismatch');
   let total=0;for(let i=0;i<refs.count;i++){const count=arrayValue(refs,i);check(count>0,'KeyAttrRefCount entries must be positive');total+=count;}check(total===times.count,'KeyAttrRefCount sum must equal sample count');
  }
  const destinations=outgoing.get(curve.id)||[];
  if(destinations.length===0 && !(incoming.get(curve.id)||[]).length) {unboundCurves++;continue;}
  check(destinations.length===1&&links(curve.id,'OP','AnimationCurveNode').length===1&&AXES.has(destinations[0].field),'AnimationCurve must connect once to curve node XYZ property');
  if(unboundNodes.has(destinations[0].to)){unboundCurves++;continue;}
  minTime=minTime===undefined||first<minTime?first:minTime;maxTime=maxTime===undefined||last>maxTime?last:maxTime;samples+=times.count;
 }
 for(const node of byType.get('AnimationCurveNode')) {
  const destinations=outgoing.get(node.id)||[],layers=links(node.id,'OO','AnimationLayer'),models=links(node.id,'OP','Model');
  check(unboundNodes.has(node.id)||destinations.length===2&&layers.length===1&&models.length===1&&TRANSFORMS.has(models[0].field),'AnimationCurveNode requires one layer and one Model transform property');
  const incomingLinks=incoming.get(node.id)||[],axes=incomingLinks.filter(c=>byId.get(c.from)?.name==='AnimationCurve');check(axes.length===incomingLinks.length&&(axes.length>0||constantDefaultAxes.get(node.id)?.size>0)&&new Set(axes.map(c=>c.field)).size===axes.length&&axes.every(c=>!constantDefaultAxes.get(node.id)?.has(c.field)),'curve node requires unique animated axes');
 }
 for(const layer of byType.get('AnimationLayer')) {
  check((outgoing.get(layer.id)||[]).length===1&&links(layer.id,'OO','AnimationStack').length===1,'AnimationLayer must connect once to AnimationStack');
  check((incoming.get(layer.id)||[]).some(c=>c.mode==='OO'&&byId.get(c.from)?.name==='AnimationCurveNode'),'AnimationLayer has no curve nodes');
 }
 for(const stack of byType.get('AnimationStack')) {
  check(!(outgoing.get(stack.id)||[]).length,'AnimationStack outgoing bindings unsupported');
  check((incoming.get(stack.id)||[]).some(c=>c.mode==='OO'&&byId.get(c.from)?.name==='AnimationLayer'),'AnimationStack has no layers');
 }
 check(samples>0&&minTime!==undefined&&maxTime>minTime,'connected animation needs at least two samples over positive duration');
 const animatedModels=new Set(byType.get('AnimationCurveNode').flatMap(node=>links(node.id,'OP','Model').map(c=>c.to)));
 const limbModels=(byType.get('Model')||[]).filter(model=>scalar(model.properties[2],'S','Model subtype')==='LimbNode');
 check(limbModels.length>0,'motion requires at least one declared LimbNode Model');
 check(limbModels.some(model=>{let id=model.id;while(id!==undefined&&id!==0n){if(animatedModels.has(id))return true;id=modelParents.get(id);}return false;}),'animation must affect a LimbNode or its Model ancestor');
 return {format:'binary-fbx',version,objects:byId.size,connections:seen.size,stacks:byType.get('AnimationStack').length,layers:byType.get('AnimationLayer').length,curveNodes:byType.get('AnimationCurveNode').length,curves:byType.get('AnimationCurve').length,...(unboundCurves?{connectedCurves:byType.get('AnimationCurve').length-unboundCurves,unboundCurves,unboundCurveNodes:unboundNodes.size}:{}),...(constantKeyCurves?{constantKeyCurves}:{}),...(constantDefaultConnections?{constantDefaultConnections}:{}),samples,durationSeconds:Number(maxTime-minTime)/46186158000,structureOnly:true};
}
