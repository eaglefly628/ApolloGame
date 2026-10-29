"""Experimental local-only Mink validation. No engine changes or library publication."""
import json, sys, math, itertools
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as Rot, Slerp
from scipy.spatial import ConvexHull
import mujoco, mink
from importlib.metadata import version

folder=Path(sys.argv[1]); doc=json.loads((folder/'input.json').read_text())
recipe=doc.get('recipe',{});mode=recipe.get('mode','match-strike')
bones=doc['initialPose']; by={b['name']:b for b in bones}; rest={b['name']:b for b in doc['restPose']}
P=lambda name:np.array(by[name]['position'])
R=lambda name:Rot.from_quat(by[name]['rotation'])
def vec(v):return ' '.join(f'{float(x):.12g}' for x in v)
def wquat(rotation):
 q=rotation.as_quat(); return vec([q[3],*q[:3]])
def local(name,p):return R(name).inv().apply(np.asarray(p)-P(name))
def mat(b):
 m=np.eye(4);m[:3,:3]=Rot.from_quat(b['rotation']).as_matrix()@np.diag(b['worldScale']);m[:3,3]=b['position'];return m
ibm={n:np.array(a).reshape(4,4,order='F') for n,a in zip(doc['jointNames'],doc['inverseBindMatrices'])}
rest_error=max(np.max(np.abs(mat(rest[n])@ibm[n]-np.eye(4))) for n in rest)
# Original skinned surface in the source pose, in model metres.
vertices=doc['vertices']; vp=np.array([v['p'] for v in vertices]); weights=np.array([v['w'] for v in vertices]); names=list(rest); ni={n:i for i,n in enumerate(names)}; ji=np.array([[ni[n] for n in v['j']] for v in vertices])
def skin_positions(poses):
 matrices=np.array([mat(poses[n])@ibm[n] for n in names]);p=np.concatenate([vp,np.ones((len(vp),1))],axis=1);out=np.zeros((len(vp),3))
 for j in range(4):out+=weights[:,j,None]*np.einsum('nij,nj->ni',matrices[ji[:,j]],p)[:,:3]
 return out
initial_vertices=skin_positions(by); dominant=np.array([v['j'][int(np.argmax(v['w']))] for v in vertices])
# The torso stays fixed in this first validation. Its geoms are fit in metre space.
body_geoms=[]
for label,group in [('pelvis',['Hips']),('abdomen',['Spine']),('chest',['Spine1','Chest']),('head',['Head'])]:
 pts=initial_vertices[np.isin(dominant,group)];lo=pts.min(axis=0);hi=pts.max(axis=0);center=(lo+hi)/2;rad=(hi-lo)/2
 # Conservative axis padding; independent skinned-surface validation follows.
 rad+=np.array([.008,.012,.008]);body_geoms.append((label,center,rad))
world_geoms=[f'<geom name="body_{n}" type="ellipsoid" pos="{vec(c)}" size="{vec(r)}" contype="1" conaffinity="1"/>' for n,c,r in body_geoms]
active={side+part for side in ['Left','Right'] for part in ['Shoulder','UpperArm','LowerArm','Hand'] if side+part in by}
active.update('RightHand'+finger+str(i) for finger in ['Thumb','Index'] for i in [1,2,3])
children={b['name']:[] for b in bones};roots=[]
for b in bones:
 (children[b['parent']] if b['parent'] in by else roots).append(b['name'])
arm_geom_names={};geom_specs={};hand_meshes={};mesh_assets=[]
for side in ['Left','Right']:
 pts=initial_vertices[dominant==side+'Hand'];pts=R(side+'Hand').inv().apply(pts-P(side+'Hand'));center=pts.mean(axis=0);radial=pts-center;pts+=radial/np.maximum(np.linalg.norm(radial,axis=1,keepdims=True),1e-8)*.003
 hull=ConvexHull(pts);hand_meshes[side+'Hand']=side+'_handHull';mesh_assets.append(f'<mesh name="{side}_handHull" vertex="{vec(pts[hull.vertices].reshape(-1))}"/>')
for side in ['Left','Right']:
 specs=[]
 for part,end in [('UpperArm','LowerArm'),('LowerArm','Hand'),('Hand','HandMiddle1')]:
  n=side+part; e=side+end;a=np.zeros(3);b=local(n,P(e));
  if part=='UpperArm':a=b*.5
  if part=='Hand':b*=1.12
  pts=initial_vertices[dominant==n];pa=P(n);pb=P(e);axis=pb-pa;u=np.clip((pts-pa)@axis/(axis@axis),0,1);dist=np.linalg.norm(pts-(pa+u[:,None]*axis),axis=1)
  radius=float(np.clip(np.percentile(dist,95)+.004,.025,.065)) if len(dist) else .04
  if part=='Hand':radius=.037
  g=f'{side}_{part}';specs.append(g);geom_specs[n]=(g,a,b,radius)
 for finger in ['Thumb','Index','Middle','Ring','Pinky']:
  for i in [1,2,3]:
   n=side+'Hand'+finger+str(i);end=side+'Hand'+finger+str(i+1);a=np.zeros(3);b=local(n,P(end));pts=initial_vertices[dominant==n];axis=P(end)-P(n);u=np.clip((pts-P(n))@axis/(axis@axis),0,1);dist=np.linalg.norm(pts-(P(n)+u[:,None]*axis),axis=1)
   radius=float(np.clip(np.percentile(dist,95)+.002,.006,.016)) if len(dist) else .01
   g=side+'_'+finger+str(i);specs.append(g);geom_specs[n]=(g,a,b,radius)
 arm_geom_names[side]=specs

def body_xml(n,parent=None):
 p=P(n) if parent is None else local(parent,P(n));q=R(n) if parent is None else R(parent).inv()*R(n)
 out=f'<body name="{n}" pos="{vec(p)}" quat="{wquat(q)}">'
 if n in active:
  if n.endswith('LowerArm'):
   side=n.removesuffix('LowerArm');u=P(side+'Hand')-P(n);u/=np.linalg.norm(u);axis=np.cross(u,np.array([0.,0.,1.]));axis/=np.linalg.norm(axis)
   flex=R(n).inv().apply(axis);twist=R(n).inv().apply(u)
   out+=f'<joint name="j_{n}Flex" type="hinge" axis="{vec(flex)}" limited="true" range="0 2.65" damping="1"/><joint name="j_{n}Twist" type="hinge" axis="{vec(twist)}" limited="true" range="-1.4 1.4" damping="1"/>'
  else:
   limit={'Shoulder':.20,'UpperArm':2.5,'Hand':2.0}.get(n.removeprefix('Left').removeprefix('Right'),1.7)
   out+=f'<joint name="j_{n}" type="ball" limited="true" range="0 {limit}" damping="1"/>'
  out+='<inertial pos="0 0 0" mass=".1" diaginertia=".001 .001 .001"/>'
 if n in geom_specs:
  g,a,b,r=geom_specs[n]
  if n in hand_meshes:out+=f'<geom name="{g}" type="mesh" mesh="{hand_meshes[n]}" contype="1" conaffinity="1"/>'
  else:out+=f'<geom name="{g}" type="capsule" fromto="{vec(a)} {vec(b)}" size="{r}" contype="1" conaffinity="1"/>'
 if n in ['LeftLowerArm','RightLowerArm','LeftHand','RightHand','RightHandIndex4','RightHandThumb4']:out+=f'<site name="{n}_site" size=".01"/>'
 for c in children[n]:out+=body_xml(c,n)
 return out+'</body>'
xml='<mujoco><compiler angle="radian"/><option gravity="0 0 0"/><asset>'+''.join(mesh_assets)+'</asset><worldbody>'+''.join(world_geoms)+''.join(body_xml(n) for n in roots)+'</worldbody></mujoco>'
model_file=folder/'model.xml'
if model_file.exists():
 if model_file.read_text()!=xml:raise RuntimeError('Existing model differs; use a new isolated run')
else:model_file.write_text(xml)
model=mujoco.MjModel.from_xml_string(xml);configuration=mink.Configuration(model)
pairs=[(g,'body_'+n) for side in arm_geom_names.values() for g in side for n,_,_ in body_geoms]
pairs += list(itertools.product(arm_geom_names['Left'],arm_geom_names['Right']))
pairs += [('Left_Hand','Left_UpperArm'),('Right_Hand','Right_UpperArm')]
pair_ids=[(model.geom(a).id,model.geom(b).id) for a,b in pairs]

def distances():
 return [mujoco.mj_geomDistance(model,configuration.data,a,b,1.0,None) for a,b in pair_ids]
zero_pos=max(np.linalg.norm(configuration.data.xpos[model.body(n).id]-P(n)) for n in names)
zero_rot=max((Rot.from_quat(np.roll(configuration.data.xquat[model.body(n).id],-1)).inv()*R(n)).magnitude() for n in names)
calibration={'units':'metres','restInverseBindError':float(rest_error),'zeroPositionErrorM':float(zero_pos),'zeroRotationErrorRad':float(zero_rot),'sourceBoneScale':by['Hips']['worldScale'],'initialProxyMinDistanceM':float(min(distances()))}
print('calibration',json.dumps(calibration),flush=True)
print('initial_pairs',sorted(zip(distances(),pairs))[:6],flush=True)
print('body_geoms',[(n,c.tolist(),r.tolist()) for n,c,r in body_geoms],flush=True)
assert zero_pos<1e-8 and zero_rot<1e-8 and rest_error<1e-5
# Verify explicitly that a world-space 10cm offset stays 10cm (no bone scale).
calibration['world10cmProbeM']=float(np.linalg.norm((P('Hips')+np.array([0,0,.1]))-P('Hips')))
assert abs(calibration['world10cmProbeM']-.1)<1e-10

def hand_goal(side):
 finger=R(side+'Hand').inv().apply(P(side+'HandMiddle1')-P(side+'Hand'));finger/=np.linalg.norm(finger)
 across=R(side+'Hand').inv().apply(P(side+'HandIndex1')-P(side+'HandPinky1'));normal=np.cross(finger,across);normal/=np.linalg.norm(normal);across=np.cross(normal,finger)
 # Fingers point forward, palms oppose vertically; orientation is explicit, not inferred from position.
 orientation=recipe.get('handOrientations',{}).get(side);f=np.asarray(orientation['fingers'],dtype=float) if orientation else (np.array([0.,0.,1.]) if side=='Left' else np.array([1.,0.,0.]));norm=np.asarray(orientation['normal'],dtype=float) if orientation else np.array([0.,1.,0.]);f/=np.linalg.norm(f);norm-=f*np.dot(norm,f);norm/=np.linalg.norm(norm);a=np.cross(norm,f)
 return Rot.from_matrix(np.column_stack([f,a,norm])@np.column_stack([finger,across,normal]).T)
hip=P('Hips');goal_rot={side:hand_goal(side) for side in ['Left','Right']};work={'Left':hip+np.array(recipe.get('handTargetsM',{}).get('Left',[.11,.25,.34]))}
pinch_local=np.array([.04,.115,.04])
box_center=None;box_size=np.array([.055,.014,.036])
if mode=='match-strike':
 left_points=initial_vertices[np.array([str(n).startswith('LeftHand') for n in dominant])];left_local=R('LeftHand').inv().apply(left_points-P('LeftHand'));left_projected=goal_rot['Left'].apply(left_local)+work['Left'];box_center=work['Left']+np.array([0.,0.,.10]);region=(np.abs(left_projected[:,0]-box_center[0])<box_size[0]/2)&(np.abs(left_projected[:,2]-box_center[2])<box_size[2]/2)
 assert region.any();box_center[1]=left_projected[region,1].max()+.001+box_size[1]/2
 pinch_world=box_center+np.array([-box_size[0]/2-.002-.04,0.,-.012]);work['Right']=hip+np.asarray(recipe['handTargetsM']['Right']) if 'handTargetsM' in recipe else pinch_world-goal_rot['Right'].apply(pinch_local)
else:work['Right']=hip+np.asarray(recipe['handTargetsM']['Right'])
assert all(p[2]-hip[2]>=.15-1e-8 for p in work.values()),'Hand target must be in front of the body in world metres'
finger_tasks=[]
closing=R('RightHand').inv().apply(P('RightHandIndex4')-P('RightHandThumb4'));closing/=np.linalg.norm(closing)
for finger,sign in ([('Index',1),('Thumb',-1)] if mode=='match-strike' else []):
 task=mink.RelativeFrameTask(frame_name='RightHand'+finger+'4_site',frame_type='site',root_name='RightHand',root_type='body',position_cost=5.,orientation_cost=0.,lm_damping=1e-5)
 task.set_target(mink.SE3.from_translation(pinch_local+sign*.002*closing));finger_tasks.append(task)
props=[]
def prop(ident,side,point,rot,size,color):
 scale=float(by[side+'Hand']['worldScale'][0]);props.append({'id':ident,'bone':side+'Hand','offset':(point/scale).tolist(),'rot':rot.as_euler('XYZ').tolist(),'size':(np.asarray(size)/scale).tolist(),'color':color})
if mode=='match-strike':
 prop('matchbox','Left',goal_rot['Left'].inv().apply(box_center-work['Left']),goal_rot['Left'].inv(),box_size,0xe8d1a0)
 prop('striker-strip','Left',goal_rot['Left'].inv().apply(box_center+np.array([-box_size[0]/2-.0006,0,0])-work['Left']),goal_rot['Left'].inv(),[.0012,.010,.033],0x684432)
 prop('matchstick','Right',pinch_local+goal_rot['Right'].inv().apply([.02,0,0]),goal_rot['Right'].inv(),[.04,.002,.002],0xd5ad72)
 prop('match-head','Right',pinch_local+goal_rot['Right'].inv().apply([.039,0,0]),goal_rot['Right'].inv(),[.0035,.0035,.0035],0xc94b40)
print('working_targets',{side:p.tolist() for side,p in work.items()},'box',box_center.tolist() if box_center is not None else None,flush=True)
tasks={s:mink.FrameTask(frame_name=s+'Hand_site',frame_type='site',position_cost=10.,orientation_cost=.5,lm_damping=1e-4) for s in work}
elbow_tasks={}
elbow_guides={}
for side in work:
 shoulder=P(side+'UpperArm');wrist=work[side];upper=np.linalg.norm(P(side+'LowerArm')-shoulder);lower=np.linalg.norm(P(side+'Hand')-P(side+'LowerArm'));distance=np.linalg.norm(wrist-shoulder);direction=(wrist-shoulder)/distance
 along=(upper*upper-lower*lower+distance*distance)/(2*distance);bias=np.array([recipe.get('elbowBias',.3)*(1 if side=='Left' else -1),-1.,0.]);bend=bias-direction*np.dot(bias,direction);bend/=np.linalg.norm(bend)
 elbow_guides[side]=shoulder+along*direction+np.sqrt(max(0,upper*upper-along*along))*bend
 task=mink.FrameTask(frame_name=side+'LowerArm_site',frame_type='site',position_cost=recipe.get('elbowWeight',2.),orientation_cost=0.,lm_damping=1e-4);task.set_target(mink.SE3.from_translation(elbow_guides[side]));elbow_tasks[side]=task
print('elbow_guides', {k:v.tolist() for k,v in elbow_guides.items()},flush=True)
posture=mink.PostureTask(model,cost=.002);posture.set_target(configuration.q.copy());damping=mink.DampingTask(model,cost=.01)
limits=[mink.ConfigurationLimit(model),mink.VelocityLimit(model,{model.joint(i).name:([.8,.8,.8] if model.jnt_type[i]==mujoco.mjtJoint.mjJNT_BALL else .8) for i in range(model.njnt)}),mink.CollisionAvoidanceLimit(model,geom_pairs=[([a],[b]) for a,b in pairs],gain=.1,minimum_distance_from_collisions=.010,collision_detection_distance=.20,broadphase=False)]
configured={tuple(sorted(pair)) for pair in limits[-1].geom_id_pairs};requested={tuple(sorted(pair)) for pair in pair_ids}
assert configured==requested, f'Collision pairs silently filtered: {requested-configured}'
print('collision_constraints',len(configured),flush=True)
DT=1/240;DURATION=float(recipe.get('durationS',4.));frames=[];checks=[]
# Numerical warm-up is separated from the delivered clip. All retained frames must pass.
for i in range(1800):
 for side in work:
  tasks[side].set_target(mink.SE3.from_rotation_and_translation(mink.SO3(np.roll(goal_rot[side].as_quat(),1)),work[side]))
 vel=mink.solve_ik(configuration,list(tasks.values())+list(elbow_tasks.values())+finger_tasks+[posture,damping],DT,solver='daqp',limits=limits)
 configuration.integrate_inplace(vel,DT)
 if min(distances())<.003:raise RuntimeError(f'Unsafe warm-up proxy clearance frame={i} distance={min(distances())} pair={pairs[int(np.argmin(distances()))]}')
 if i%120==0:print('warmup',i,min(distances()),flush=True)
print('warmup_errors',{side:float(np.linalg.norm(configuration.data.site_xpos[model.site(side+'Hand_site').id]-work[side])) for side in work},flush=True)
def smooth(x):return x*x*(3-2*x)
def targets(t):
 out={side:(p.copy(),goal_rot[side]) for side,p in work.items()}
 curves=recipe.get('curvesM')
 if curves is None and mode=='match-strike':curves={'Right':[[0.,0,0,0],[DURATION*.15,0,0,0],[DURATION*.275,0,0,.024],[DURATION*.375,0,0,0],[DURATION*.50,0,0,.024],[DURATION*.60,0,0,0],[DURATION*.80,0,0,-.005],[DURATION,0,0,0]]}
 for side,keys in (curves or {}).items():
  for a,b in zip(keys,keys[1:]):
   if a[0]<=t<=b[0]:out[side][0][:]+=np.asarray(a[1:])+(np.asarray(b[1:])-np.asarray(a[1:]))*smooth((t-a[0])/(b[0]-a[0]));break
 return out
for frame in range(round(DURATION/DT)+1):
 t=frame*DT;desired=targets(t)
 for s,(p,q) in desired.items():tasks[s].set_target(mink.SE3.from_rotation_and_translation(mink.SO3(np.roll(q.as_quat(),1)),p))
 if frame:
  velocity=mink.solve_ik(configuration,list(tasks.values())+list(elbow_tasks.values())+finger_tasks+[posture,damping],DT,solver='daqp',limits=limits)
  configuration.integrate_inplace(velocity,DT)
 ds=distances();min_d=min(ds)
 if min_d<.003:raise RuntimeError(f'Proxy clearance failed {t}: {min_d} pair={pairs[int(np.argmin(ds))]}')
 pose={n:{'position':configuration.data.xpos[model.body(n).id].tolist(),'rotation':np.roll(configuration.data.xquat[model.body(n).id],-1).tolist()} for n in names}
 err={s:float(np.linalg.norm(np.asarray(pose[s+'Hand']['position'])-p)) for s,(p,q) in desired.items()}
 checks.append({'time':t,'minDistanceM':float(min_d),'pair':pairs[int(np.argmin(ds))],'targetErrorsM':err})
 frames.append({'at':t,'world':pose,'targets':{s:p.tolist() for s,(p,q) in desired.items()}})
 if frame%120==0:print('solve',round(t,2),'distance',round(min_d,4),'errors',err,flush=True)
result={'version':1,'backend':{name:version(name) for name in ['mink','mujoco','numpy','scipy','daqp']},'dt':DT,'fps':30,'durationS':DURATION,'calibration':calibration,'proxySpecs':{'body':[{'name':n,'position':p.tolist(),'radii':r.tolist()} for n,p,r in body_geoms],'pairs':pairs},'frames':frames,'checks':checks,'props':props,'boxCenter':box_center.tolist() if box_center is not None else None,'pinchLocalM':pinch_local.tolist(),'elbowGuides':{k:v.tolist() for k,v in elbow_guides.items()},'jointModel':'elbow-flexion-plus-forearm-twist-v1','recipeSha256':doc.get('recipeSha256'),'qualityThresholds':recipe.get('qualityThresholds',{})}
result_text=json.dumps(result);result_file=folder/'solution.json'
if result_file.exists():
 if result_file.read_text()!=result_text:raise RuntimeError('Existing solution differs; use a new isolated run')
else:result_file.write_text(result_text)
print('saved',result_file,flush=True)
