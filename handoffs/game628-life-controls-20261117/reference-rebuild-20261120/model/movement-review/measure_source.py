import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent;MODEL=ROOT.parent;SOURCE=MODEL/'cat-animation-fix/reference-street-source-v4.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.view_layer.update()
# Measure just entrance/foreground objects intersecting avatar's low-body vertical slab.
low,high=-.02,1.85
rows=[]
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 n=o.name
 if not any(k in n for k in ['.bollard.','.board.','.street.planter','.empty.crate','.side.crate','.cabbage','.blue.producebox','.baguette.basket','.stool.']):continue
 pts=[o.matrix_world@v.co for v in o.data.vertices];yp=[p.z for p in pts]
 if min(yp)>high or max(yp)<low:continue
 pp=[[p.x,p.z,-p.y] for p in pts]
 rows.append({'name':n,'min':[min(p[k] for p in pp) for k in range(3)],'max':[max(p[k] for p in pp) for k in range(3)],'vertices':pp})
(ROOT/'source-entrance-measurements.json').write_text(json.dumps({'source':str(SOURCE),'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'vertical_slice':[low,high],'objects':rows},separators=(',',':')));print('ENTRANCE_MEASUREMENTS_READY',len(rows),flush=True)
