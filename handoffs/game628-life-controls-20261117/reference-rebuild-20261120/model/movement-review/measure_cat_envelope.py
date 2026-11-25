from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent;original=ROOT.parent/'cat-animation-fix/audit_idle_cats.py';src=original.read_text().split("if __name__=='__main__':")[0]
src=src.replace('base,_=evaluate(0);maxpaw=0;', 'base,_=evaluate(0);envelope_min=np.full(3,np.inf);envelope_max=np.full(3,-np.inf);maxpaw=0;')
src=src.replace('pose,piv=evaluate(float(t))', 'pose,piv=evaluate(float(t));allpoints=np.concatenate(list(pose.values()));envelope_min=np.minimum(envelope_min,allpoints.min(axis=0));envelope_max=np.maximum(envelope_max,allpoints.max(axis=0))')
src=src.replace("'duration':T,'sample_hz'", "'duration':T,'actual_animated_bounds':{'min':envelope_min.tolist(),'max':envelope_max.tolist()},'sample_hz'")
ns={'__file__':str(original),'__name__':'movement_envelope_audit'};exec(compile(src,str(original),'exec'),ns);ns['ROOT']=ROOT
info=next(x for x in json.loads((original.parent/'cat-entities-contract.json').read_text()) if x['id']=='cat-floor-idle');report=ns['audit'](info);(ROOT/'animated-floor-cat-envelope.json').write_text(json.dumps(report,indent=2));print(report['actual_animated_bounds'])
