from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent/'textures';ROOT.mkdir(exist_ok=True)
colors={'plaster':(.73,.65,.48),'cream':(.83,.75,.60),'sandstone':(.68,.61,.49),'brick':(.57,.25,.13),'wood':(.42,.24,.10),'woodlight':(.59,.37,.17),'wooddark':(.26,.15,.07),'canvas':(.87,.76,.56),'clothGreen':(.42,.51,.31),'clothGold':(.81,.56,.30),'clothBlue':(.39,.52,.61),'terra':(.58,.31,.16),'bark':(.27,.17,.09)}
for i,(key,col) in enumerate(colors.items()):
 rng=np.random.default_rng(6281120+i);n=512;yy,xx=np.mgrid[:n,:n].astype(float)
 noise=rng.random((n,n))-.5
 if 'wood' in key or key=='bark':height=np.sin(xx*.9+np.sin(yy*.07)*2)*.35+noise*.15;variation=height*.055
 elif 'cloth' in key or key=='canvas':height=(np.sin(xx*2.1)+np.sin(yy*2.05))*.25;variation=height*.025+noise*.02
 else:
  height=noise*.35;variation=noise*.03+(np.sin(xx*.08)*np.cos(yy*.09))*.012
  pits=rng.random((n,n))<(.008 if key=='sandstone' else .003);height-=pits*.5;variation-=pits*.13
 srgb=np.clip(np.array(col)[None,None,:]*(1+variation[...,None]),0,1)
 Image.fromarray(np.uint8(np.clip(srgb*255,0,255))).save(ROOT/(key+'-albedo.png'))
 gy,gx=np.gradient(height);normal=np.stack((-gx,-gy,np.ones_like(height)),axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
 Image.fromarray(np.uint8((normal*.5+.5)*255)).save(ROOT/(key+'-normal.png'))
print('SURFACE_TEXTURES_READY',len(colors)*2)
