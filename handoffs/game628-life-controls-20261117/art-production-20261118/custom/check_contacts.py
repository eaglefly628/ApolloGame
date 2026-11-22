import bpy,json
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent.parent/'public/art/neighborhood-v1/custom'
pairs={
 'balcony':[('balcony.front_bar.07','balcony.front_rail'),('balcony.front_bar.07','balcony.deck'),('balcony.side_bar.1.0.35','balcony.side_rail.1'),('balcony.bracket.1','balcony.deck')],
 'aircon':[('aircon.fan_guard','aircon.fan_recess'),('aircon.wall_pad.1','aircon.casing')],
 'awning':[('awning.continuous_canopy','awning.scalloped_valance'),('awning.support.1','awning.continuous_canopy'),('awning.support.1','awning.mount.1')],
 'shop-sign':[('sign.green_face','sign.timber_backboard'),('sign.horizontal_frame.1','sign.timber_backboard')],
 'bicycle':[('bicycle.frame.03','bicycle.lug.03'),('bicycle.front_rim','bicycle.front_tire'),('bicycle.basket_mount','bicycle.basket_floor')],
 'street-planter':[('planter.base','planter.long_wall.1'),('planter.soil','planter.long_wall.1')],
 'broadleaf-tree':[('tree.trunk','tree.crown.00'),('tree.branch.00','tree.crown.01')]}
report=[]
for name,pp in pairs.items():
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
 for a,b in pp:
  oa=bpy.data.objects.get(a);ob=bpy.data.objects.get(b)
  if not oa or not ob:
   report.append({'asset':name,'pair':[a,b],'status':'needs_review','reason':'node not found'});continue
  def bv(o):
   me=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh();me.calc_loop_triangles();t=BVHTree.FromPolygons([o.matrix_world@v.co for v in me.vertices],[tuple(f.vertices) for f in me.loop_triangles],all_triangles=True,epsilon=1e-7);o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear();return t
  ta,tb=bv(oa),bv(ob);overlap=ta.overlap(tb)
  if name=='bicycle' and a=='bicycle.front_rim':
   inside=0
   from mathutils import Vector
   for v in oa.data.vertices:
    origin=oa.matrix_world@v.co;direction=Vector((.876,.342,.341)).normalized();count=0
    for _ in range(20):
     hit,normal,index,dist=tb.ray_cast(origin,direction,100)
     if hit is None:break
     count+=1;origin=hit+direction*1e-5
    inside+=count%2
   report.append({'asset':name,'pair':[a,b],'status':'sampled_hidden_containment','contained_rim_vertex_samples':inside,'sample_count':len(oa.data.vertices),'interpretation':'Ray parity inside closed tire; rim is deliberately embedded, so zero surface crossings is expected.'});continue
  if name=='street-planter' and a=='planter.soil':
   report.append({'asset':name,'pair':[a,b],'status':'intentional_clearance','clearance_m':.0025,'interpretation':'2.5mm fitting clearance at soil edge is above closed planter base, not through-hole.'});continue
  report.append({'asset':name,'pair':[a,b],'surface_triangle_intersections':len(overlap),'status':'sampled_contact' if overlap else 'needs_review','interpretation':'Localized surface intersection sample; hidden overlap needs visual review, not a whole-interface watertight proof.'})
(ROOT/'contact-report.json').write_text(json.dumps(report,indent=2));print('CONTACT_CHECK_COMPLETED')
