// Authoring helper only. Frames are rigid transforms in calibrated metres.
// It does not calibrate a Skin or install a runtime Socket/IK component.
import {Matrix4,Quaternion,Vector3} from 'three';
const check=(ok,message)=>{if(!ok)throw new Error('socket frame: '+message);};
function matrix(frame){
 check(frame&&Object.getPrototypeOf(frame)===Object.prototype&&Object.keys(frame).length===2&&Object.keys(frame).every(k=>['position','rotation'].includes(k)),'expected position/rotation only');
 check(Array.isArray(frame.position)&&frame.position.length===3&&frame.position.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=10),'invalid metre position');
 check(Array.isArray(frame.rotation)&&frame.rotation.length===4&&frame.rotation.every(x=>typeof x==='number'&&Number.isFinite(x))&&Math.abs(Math.hypot(...frame.rotation)-1)<1e-6,'expected unit quaternion');
 return new Matrix4().compose(new Vector3(...frame.position),new Quaternion(...frame.rotation),new Vector3(1,1,1));
}
function frame(m){const p=new Vector3(),q=new Quaternion(),s=new Vector3();m.decompose(p,q,s);return{position:p.toArray(),rotation:q.toArray()};}
export function composeSocketFrames(frames){check(Array.isArray(frames)&&frames.length>0&&frames.length<=8,'frame chain budget 1..8');const m=new Matrix4();for(const f of frames)m.multiply(matrix(f));return frame(m);}
/** Desired hand = desired prop-contact world frame * inverse(hand->grip->prop->contact).
 * Every target Skin supplies its own handToGrip. Do not reuse another Skin's values.
 */
export function handPoseForContact({desiredContactWorld,handToGrip,gripToProp,propToContact}){
 const local=matrix(handToGrip).multiply(matrix(gripToProp)).multiply(matrix(propToContact));
 return frame(matrix(desiredContactWorld).multiply(local.invert()));
}
