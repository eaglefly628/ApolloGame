import json,struct,itertools,math
from pathlib import Path
root=Path('/Users/junbaili/Documents/GitHub/ApolloGame/handoffs/game628-life-controls-20261117')
c=json.loads((root/'public/scenes/art-street.json').read_text());assets={a['key']:a for a in c['assets']}
def mul(a,b):return [[sum(a[i][k]*b[k][j]for k in range(4))for j in range(4)]for i in range(4)]
I=[[int(i==j)for j in range(4)]for i in range(4)]
def mat(n):
 if 'matrix'in n:return [[n['matrix'][j*4+i]for j in range(4)]for i in range(4)]
 x,y,z,w=n.get('rotation',[0,0,0,1]);sx,sy,sz=n.get('scale',[1,1,1]);tx,ty,tz=n.get('translation',[0,0,0])
 return [[(1-2*y*y-2*z*z)*sx,(2*x*y-2*z*w)*sy,(2*x*z+2*y*w)*sz,tx],[(2*x*y+2*z*w)*sx,(1-2*x*x-2*z*z)*sy,(2*y*z-2*x*w)*sz,ty],[(2*x*z-2*y*w)*sx,(2*y*z+2*x*w)*sy,(1-2*x*x-2*y*y)*sz,tz],[0,0,0,1]]
def bbox(key):
 b=(root/'public'/assets[key]['src'].lstrip('/')).read_bytes();L=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+L]);out=[]
 def walk(i,parent):
  n=g['nodes'][i];M=mul(parent,mat(n))
  if 'mesh'in n:
   for p in g['meshes'][n['mesh']]['primitives']:
    a=g['accessors'][p['attributes']['POSITION']]
    for v in itertools.product(*zip(a['min'],a['max'])):out.append([sum(M[i][j]*([*v,1][j])for j in range(4))for i in range(3)])
  for j in n.get('children',[]):walk(j,M)
 for i in g['scenes'][g.get('scene',0)]['nodes']:walk(i,I)
 return [min(v[i]for v in out)for i in range(3)],[max(v[i]for v in out)for i in range(3)]
for key in ['custom-balcony','custom-aircon','custom-awning','custom-bicycle','custom-broadleaf-tree']:
 lo,hi=bbox(key);print(key,'local min/max',lo,hi)
 for id,e in c['manifest']['entities'].items():
  if e.get('Model3D',{}).get('modelKey')!=key:continue
  t=e['Transform3D'];scale=[t.get(k,t.get('scale',1))for k in ['scaleX','scaleY','scaleZ']];p=[t['x'],t['y'],t['z']]
  wlo=[lo[i]*scale[i]+p[i]for i in range(3)];whi=[hi[i]*scale[i]+p[i]for i in range(3)];print(' ',id,'world', [round(x,3)for x in wlo],[round(x,3)for x in whi])
