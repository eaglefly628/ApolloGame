// Synthetic binary FBX structure fixture. Not a Mixamo download or ARP evidence.
import { deflateSync } from 'node:zlib';
const MAGIC=Buffer.from('Kaydara FBX Binary  \0\x1a\0','binary');
const p=(type,value)=>({type,value});
const node=(name,properties=[],children=[])=>({name,properties,children});
/** Tiny one-bone, one-stack/layer/XYZ-curve structure for parser tests only. */
export function makeMockMotionFbx({version=7400,compressed=false,times=[0n,46186158000n],values=[0,0.1],withAnimation=true,referenceCounts=[times.length],detachedLimb=false}={}) {
 const wide=version>=7500,width=wide?25:13;
 function property({type,value}) {
  if(type==='S'){const bytes=Buffer.from(value);const out=Buffer.alloc(5+bytes.length);out.write(type);out.writeUInt32LE(bytes.length,1);bytes.copy(out,5);return out;}
  if(type==='L'){const out=Buffer.alloc(9);out.write(type);out.writeBigInt64LE(BigInt(value),1);return out;}
  const stride=type==='l'?8:4,raw=Buffer.alloc(value.length*stride);
  value.forEach((v,i)=>type==='l'?raw.writeBigInt64LE(BigInt(v),i*stride):type==='f'?raw.writeFloatLE(v,i*stride):raw.writeInt32LE(v,i*stride));
  const bytes=compressed?deflateSync(raw):raw,out=Buffer.alloc(13+bytes.length);out.write(type);out.writeUInt32LE(value.length,1);out.writeUInt32LE(compressed?1:0,5);out.writeUInt32LE(bytes.length,9);bytes.copy(out,13);return out;
 }
 function encode(item,start) {
  const name=Buffer.from(item.name),props=Buffer.concat(item.properties.map(property)),parts=[];let offset=start+width+name.length+props.length;
  for(const child of item.children){const bytes=encode(child,offset);parts.push(bytes);offset+=bytes.length;}
  if(parts.length){parts.push(Buffer.alloc(width));offset+=width;}
  const header=Buffer.alloc(width);if(wide){header.writeBigUInt64LE(BigInt(offset));header.writeBigUInt64LE(BigInt(item.properties.length),8);header.writeBigUInt64LE(BigInt(props.length),16);}else {header.writeUInt32LE(offset);header.writeUInt32LE(item.properties.length,4);header.writeUInt32LE(props.length,8);}header[width-1]=name.length;
  return Buffer.concat([header,name,props,...parts]);
 }
 const object=(type,id,name,subtype='',children=[])=>node(type,[p('L',id),p('S',name),p('S',subtype)],children);
 const objects=[object('Model',1,'MockHips\0\x01Model',detachedLimb?'Null':'LimbNode')],connections=[node('C',[p('S','OO'),p('L',1),p('L',0)])];
 if(detachedLimb){objects.push(object('Model',6,'DetachedBone\0\x01Model','LimbNode'));connections.push(node('C',[p('S','OO'),p('L',6),p('L',0)]));}
 if(withAnimation) {
  objects.push(object('AnimationStack',2,'MockTake\0\x01AnimStack'),object('AnimationLayer',3,'MockLayer\0\x01AnimLayer'),object('AnimationCurveNode',4,'T\0\x01AnimCurveNode'),object('AnimationCurve',5,'\0\x01AnimCurve','',[
   node('KeyTime',[p('l',times)]),node('KeyValueFloat',[p('f',values)]),node('KeyAttrFlags',[p('i',[24836])]),node('KeyAttrDataFloat',[p('f',[0,0,0,0])]),node('KeyAttrRefCount',[p('i',referenceCounts)]),
  ]));
  connections.push(node('C',[p('S','OO'),p('L',3),p('L',2)]),node('C',[p('S','OO'),p('L',4),p('L',3)]),node('C',[p('S','OP'),p('L',4),p('L',1),p('S','Lcl Translation')]),node('C',[p('S','OP'),p('L',5),p('L',4),p('S','d|X')]));
 }
 const header=Buffer.alloc(27);MAGIC.copy(header);header.writeUInt32LE(version,23);
 const roots=[node('Objects',[],objects),node('Connections',[],connections)],parts=[header];let offset=27;
 for(const item of roots){const bytes=encode(item,offset);parts.push(bytes);offset+=bytes.length;}
 parts.push(Buffer.alloc(width));return Buffer.concat(parts);
}
