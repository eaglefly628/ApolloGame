"""Independent native-playback checks: proxy geometry + original skinned-surface samples."""
import json,sys,itertools
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation as Rot
import mujoco
folder=Path(sys.argv[1]);d=json.loads((folder/'input.json').read_text());s=json.loads((folder/'solution.json').read_text());play=json.loads((folder/'playback.json').read_text())
model=mujoco.MjModel.from_xml_path(str(folder/'model.xml'));data=mujoco.MjData(model)
names=d['jointNames'];ni={n:i for i,n in enumerate(names)};verts=d['vertices'];p=np.array([v['p']+[1.] for v in verts]);weights=np.array([v['w'] for v in verts]);ji=np.array([[ni[n] for n in v['j']] for v in verts]);dominant=np.array([v['j'][int(np.argmax(v['w']))] for v in verts]);ibm=np.array(d['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
body_mask=np.isin(dominant,['Hips','Spine','Spine1','Chest','Neck','Head'])
left_mask=np.array([n.startswith('LeftHand') or n=='LeftLowerArm' for n in dominant]);right_mask=np.array([n.startswith('RightHand') or n=='RightLowerArm' for n in dominant]);hand_left=np.array([n.startswith('LeftHand') for n in dominant]);hand_right=np.array([n.startswith('RightHand') for n in dominant]);limb_mask=left_mask|right_mask
fk_position_tolerance=1e-4 if s.get('jointModel')=='elbow-flexion-plus-forearm-twist-v1' else 1e-5
fk_rotation_tolerance=1e-4 if s.get('jointModel')=='elbow-flexion-plus-forearm-twist-v1' else 1e-5
policy={'minElbowBelowShoulderM':.05,'maxElbowAboveWristM':.10,'maxTargetErrorM':.02,**s.get('qualityThresholds',{})}
max_target_error=max(e for check in s['checks'] for e in check['targetErrorsM'].values())
pair_ids=[(model.geom(a).id,model.geom(b).id) for a,b in s['proxySpecs']['pairs']]
min_proxy=1.;min_clearance=1.;inside_count=0;near_count=0;hand_overlap_frames=0;max_fk_error=0.;checked_points=0;max_fk_rotation=0.;max_hinge_limit_violation=0.;elbow_checks=[]

def surface(world):
 matrices=[]
 for n,im in zip(names,ibm):
  b=world[n];m=np.eye(4);m[:3,:3]=Rot.from_quat(b['rotation']).as_matrix()@np.diag(b['worldScale']);m[:3,3]=b['position'];matrices.append(m@im)
 matrices=np.array(matrices);out=np.zeros((len(p),3))
 for k in range(4):out+=weights[:,k,None]*np.einsum('nij,nj->ni',matrices[ji[:,k]],p)[:,:3]
 return out

def distances_to_hull(points,body):
 lo=body.min(axis=0);hi=body.max(axis=0);aabb=np.linalg.norm(np.maximum(np.maximum(lo-points,points-hi),0),axis=1);candidate=aabb<.01
 lower=aabb.copy()
 if np.any(candidate):
  hull=ConvexHull(body);q=points[candidate];values=[]
  for i in range(0,len(q),256):values.extend(np.max(q[i:i+256]@hull.equations[:,:3].T+hull.equations[:,3],axis=1))
  lower[candidate]=values
 return lower

max_wrist_rotation_error=0.
rotation_sides=list(d.get('recipe',{}).get('rotationCurvesRad',{}))
contact=d.get('recipe',{}).get('contactStroke');contact_errors=[];contact_z=[]
props={prop['id']:prop for prop in s.get('props',[])}
def prop_world(world,prop):
 bone=world[prop['bone']];q=Rot.from_quat(bone['rotation']);scale=np.asarray(bone['worldScale'])
 return np.asarray(bone['position'])+q.apply(np.asarray(prop['offset'])*scale),q*Rot.from_euler('XYZ',prop['rot']),np.asarray(prop['size'])*scale
for i,frame in enumerate(play['frames']):
 w=frame['world'];q=model.qpos0.copy()
 if contact and contact['startS']-1e-8<=frame['at']<=contact['endS']+1e-8:
  head,_,head_size=prop_world(w,props['match-head']);box,box_rot,box_size=prop_world(w,props['matchbox']);_,_,strip_size=prop_world(w,props['striker-strip'])
  point=box_rot.inv().apply(head-box);u=(frame['at']-contact['startS'])/(contact['endS']-contact['startS']);u=max(0.,min(1.,u));u=u*u*(3.-2.*u)
  desired=np.array([-box_size[0]/2-strip_size[0]-head_size[0]/2,0.,contact['fromZM']+(contact['toZM']-contact['fromZM'])*u])
  contact_errors.append(float(np.linalg.norm(point-desired)));contact_z.append(float(point[2]))

 if rotation_sides:
  reference=s['frames'][round(frame['at']/s['dt'])]['targetRotations']
  for side in rotation_sides:max_wrist_rotation_error=max(max_wrist_rotation_error,float((Rot.from_quat(w[side+'Hand']['rotation']).inv()*Rot.from_quat(reference[side])).magnitude()))
 handled=set()
 for j in range(model.njnt):
  bid=int(model.jnt_bodyid[j])
  if bid in handled:continue
  handled.add(bid);parent=int(model.body_parentid[bid]);name=model.body(bid).name;pname=model.body(parent).name
  parent_rot=Rot.identity() if parent==0 else Rot.from_quat(w[pname]['rotation']);local=parent_rot.inv()*Rot.from_quat(w[name]['rotation']);rest=Rot.from_quat(np.roll(model.body_quat[bid],-1));delta=rest.inv()*local
  if model.jnt_type[j]==mujoco.mjtJoint.mjJNT_BALL:
   a=int(model.jnt_qposadr[j]);q[a:a+4]=np.roll(delta.as_quat(),1)
  else:
   ids=np.flatnonzero(model.jnt_bodyid==bid);assert len(ids)==2 and all(model.jnt_type[k]==mujoco.mjtJoint.mjJNT_HINGE for k in ids)
   flex,twist=map(int,ids);axis=model.jnt_axis[flex];long_axis=model.jnt_axis[twist];moved=delta.apply(long_axis)
   theta=float(np.arctan2(np.dot(axis,np.cross(long_axis,moved)),np.dot(long_axis,moved)))
   residual=Rot.from_rotvec(axis*theta).inv()*delta;phi=float(np.dot(residual.as_rotvec(),long_axis))
   q[int(model.jnt_qposadr[flex])]=theta;q[int(model.jnt_qposadr[twist])]=phi
   for k in ids:
    value=q[int(model.jnt_qposadr[k])];max_hinge_limit_violation=max(max_hinge_limit_violation,float(max(model.jnt_range[k,0]-value,value-model.jnt_range[k,1],0)))
 data.qpos[:]=q;mujoco.mj_forward(model,data)
 ds=[mujoco.mj_geomDistance(model,data,a,b,1.,None) for a,b in pair_ids];min_proxy=min(min_proxy,min(ds))
 max_fk_error=max(max_fk_error,max(np.linalg.norm(data.xpos[model.body(n).id]-np.array(w[n]['position'])) for n in names))
 max_fk_rotation=max(max_fk_rotation,max((Rot.from_quat(np.roll(data.xquat[model.body(n).id],-1)).inv()*Rot.from_quat(w[n]['rotation'])).magnitude() for n in names))
 for side in ['Left','Right']:
  shoulder=np.array(w[side+'UpperArm']['position']);elbow=np.array(w[side+'LowerArm']['position']);wrist=np.array(w[side+'Hand']['position']);elbow_checks.append({'side':side,'time':frame['at'],'belowShoulderM':float(shoulder[1]-elbow[1]),'aboveWristM':float(elbow[1]-wrist[1])})
 xyz=surface(w);separation=distances_to_hull(xyz[limb_mask],xyz[body_mask]);min_clearance=min(min_clearance,float(separation.min()));inside_count+=int(np.sum(separation<-.0005));near_count+=int(np.sum(separation<.002));checked_points+=len(separation)
 # Conservative hand hull test; no hand-hand contact is exempted.
 a,b=xyz[hand_left],xyz[hand_right]
 overlap=np.all(a.max(axis=0)>=b.min(axis=0)) and np.all(b.max(axis=0)>=a.min(axis=0))
 if overlap:
  sep1=distances_to_hull(a,b);sep2=distances_to_hull(b,a)
  if min(sep1.min(),sep2.min())<-.0005:hand_overlap_frames+=1
 if i%120==0:print('check',i,'proxy',min_proxy,'surface_lower',min_clearance,'inside',inside_count,'hand_overlap',hand_overlap_frames,flush=True)
contact_report={'required':bool(contact),'status':'not-requested'}
if contact:
 max_contact_error=max(contact_errors,default=float('inf'));travel=abs(contact_z[-1]-contact_z[0]) if contact_z else 0.
 contact_report={'required':True,'status':'pass' if contact_errors and max_contact_error<.004 and travel>=abs(contact['toZM']-contact['fromZM'])-.004 else 'fail','sampleCount':len(contact_errors),'maximumAnchorErrorM':max_contact_error,'measuredStripTravelM':travel,'toleranceM':.004,'scope':'native playback match-head centre versus box-local strip target; grasp, mesh contact and friction are not certified'}
result={'version':1,'status':'pass' if contact_report['status']!='fail' and max_wrist_rotation_error<.1 and min_proxy>=.003 and inside_count==0 and hand_overlap_frames==0 and max_fk_error<fk_position_tolerance and max_fk_rotation<fk_rotation_tolerance and max_hinge_limit_violation<1e-5 and (s.get('jointModel')!='elbow-flexion-plus-forearm-twist-v1' or (min(c['belowShoulderM'] for c in elbow_checks)>policy['minElbowBelowShoulderM'] and max(c['aboveWristM'] for c in elbow_checks)<policy['maxElbowAboveWristM'] and max_target_error<policy['maxTargetErrorM'])) else 'fail','playbackFrames':len(play['frames']),'sampleRateHz':round(1/play['dt']),'proxyMinDistanceM':min_proxy,'propContact':contact_report,'wristRotationTracking':{'requiredSides':rotation_sides,'maximumErrorRad':max_wrist_rotation_error,'toleranceRad':.1,'scope':'requested hand orientation versus native playback; not hand anatomy certification'},'qualityThresholds':policy,'maxTargetErrorM':max_target_error,'nativePlaybackFkErrorM':max_fk_error,'nativePlaybackProjectionTolerance':{'positionM':fk_position_tolerance,'rotationRad':fk_rotation_tolerance,'reason':'30 FPS quaternion interpolation can slightly leave the 2-axis elbow manifold'},'nativePlaybackFkRotationErrorRad':max_fk_rotation,'maxHingeLimitViolationRad':max_hinge_limit_violation,'elbowPosture':{'minimumBelowShoulderM':min(c['belowShoulderM'] for c in elbow_checks),'maximumAboveWristM':max(c['aboveWristM'] for c in elbow_checks)},'originalSkinSurface':{'method':'original LBS vertices versus per-frame upper-body convex hull; conservative surface-point test, not exact triangle continuous collision','pointsChecked':checked_points,'minimumCertifiedSeparationM':min_clearance,'insideSamples':inside_count,'nearSamplesBelow2mm':near_count,'handHullOverlapFrames':hand_overlap_frames},'limitations':['upper-arm shoulder adjacency not tested as skin containment','triangle interiors/cloth thickness and continuous unsampled motion not certified','finger grasp and match/box contact not certified']}
report_text=json.dumps(result,indent=2);report_file=folder/'collision-report.json'
if report_file.exists():
 if report_file.read_text()!=report_text:raise RuntimeError('Existing check report differs; preserve it and use a new isolated run')
else:report_file.write_text(report_text)
print(json.dumps(result),flush=True)
if result['status']!='pass':raise SystemExit(1)
