"""Independent v4 checks; never writes producer outputs."""
import contextlib,io,json,runpy,shutil,tempfile,hashlib,struct,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT.parent/'public/art/reference-rebuild-20261120/scene'
# Producer is rerun in an isolated directory, so the shared working tree stays untouched.
with tempfile.TemporaryDirectory(prefix='game628-review-') as td:
 script=Path(td)/'create_variation_plan.py';shutil.copyfile(ROOT/'model/cat-animation-fix/create_variation_plan.py',script)
 with contextlib.redirect_stdout(io.StringIO()):runpy.run_path(str(script))
 generated=json.loads((Path(td)/'variation-plan.json').read_text())
 persisted=json.loads((PUBLIC/'variation-plan-v4.json').read_text())
 assert generated==persisted,'variation plan producer cannot reproduce persisted data'
with contextlib.redirect_stdout(io.StringIO()) as output:
 geom=runpy.run_path(str(ROOT/'review-scene-model.py'))
contract=geom['contract'];g=geom['g'];hits=geom['hits']
# Re-exported static scene must have no exact preserved original cat triangle.
parts=json.loads((ROOT/'model/cat-animation-fix/cat-source-parts.json').read_text())
def key(vertices):return tuple(sorted(tuple(round(x,5) for x in v) for v in vertices))
static={key(t[1:]) for t in geom['triangles']}
original=set()
for cat in parts:
 for part in cat['parts']:
  vs=[tuple(p[i]+cat['source_root'][i] for i in range(3)) for p in part['positions']]
  ids=part['indices']
  for i in range(0,len(ids),3):original.add(key([vs[j] for j in ids[i:i+3]]))
assert len(original)>100,'cat source triangle anchor not hit'
assert not static.intersection(original),'original static cat geometry remains'
# Inject one known original triangle into an in-memory scene set: the same invariant must reject it.
bad=static|{next(iter(original))};assert len(bad.intersection(original))==1,'sabotage anchor not hit'
try:assert not bad.intersection(original),'original static cat geometry remains'
except AssertionError as e:assert 'original static cat geometry remains' in str(e)
else:raise AssertionError('sabotage escaped the static-cat guard')
catchecks=[]
for cat in contract['catEntities']:
 x,y,z=cat['position'];support=hits((x,y+.05,z),(0,-1,0),.10)
 assert support,('cat root has no actual support',cat['id'])
 error=y-support[0]['point'][1];assert abs(error)<.003,(cat['id'],error)
 catchecks.append({'id':cat['id'],'supportErrorMetres':error,'mesh':support[0]['mesh']})
runtime=json.loads(subprocess.check_output(['node',str(ROOT/'review-cat-runtime.mjs')],text=True))
for cat in runtime['cats']:
 errors=[]
 for x,y,z in cat['pawBottomPoints']:
  support=hits((x,y+.05,z),(0,-1,0),.1)
  assert support,('cat actual paw unsupported',cat['id'],x,y,z)
  errors.append(y-support[0]['point'][1])
 assert errors and max(abs(e) for e in errors)<1e-5,(cat['id'],'paw support error',errors)
 cat['pawSupportErrorRangeMetres']=[min(errors),max(errors)]
 cat.pop('pawBottomPoints')
planters=[]
for h in persisted['houses']:
 for slot in h['slots']:
  x,y,z=slot['root'];support=hits((x,y+.00001,z),(0,-1,0),.003)
  assert support,('planter missing actual support',h['id'],slot['id'])
  planters.append({'house':h['id'],'slot':slot['id'],'supportErrorMetres':y-support[0]['point'][1]})
print(json.dumps({'status':'pass','sceneSha256':contract['sha256'],'planReproduced':True,'staticCatSourceTrianglesChecked':len(original),'staticCatTrianglesRemaining':0,'staticCatSabotageRejected':True,'catRootProbesOnly':catchecks,'actualRuntimePaws':runtime['cats'],'planterSupportCount':len(planters),'maxPlanterSupportErrorMetres':max(abs(x['supportErrorMetres']) for x in planters),'geometry':json.loads(output.getvalue())},indent=2))
