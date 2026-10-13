"""Original periodic textures; Python standard library only, no external services."""
import math, struct, zlib, pathlib
out=pathlib.Path(__file__).parent/'public/textures';out.mkdir(exist_ok=True)
N=512

def png(name,fn):
    raw=bytearray()
    for y in range(N):
        raw.append(0)
        for x in range(N):raw.extend(max(0,min(255,round(v))) for v in fn(x,y))
    def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',N,N,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
    (out/name).write_bytes(data)

def grain(x,y):
    u=x/N*math.tau;v=y/N*math.tau
    wav=math.sin(u*33+1.6*math.sin(v)+.5*math.sin(3*v))
    fine=math.sin(u*81+2*math.sin(v*2))
    knot=math.sin(12*math.sqrt((math.sin(u/2)*1.6)**2+(math.sin(v/2)*.9)**2))
    seam=-32 if x%128<3 else 0
    a=219+11*wav+4*fine+5*knot+seam
    return (a,a-2,a-6)

def noise(x,y,cells):
    gx=x/N*cells;gy=y/N*cells
    ix=int(gx);iy=int(gy);tx=gx-ix;ty=gy-iy
    tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty)
    def h(a,b):
        n=((a%cells)*374761393+(b%cells)*668265263+cells*1274126177)&0xffffffff
        n=((n^(n>>13))*1274126177)&0xffffffff
        return ((n^(n>>16))&65535)/65535-.5
    return (h(ix,iy)*(1-tx)+h(ix+1,iy)*tx)*(1-ty)+(h(ix,iy+1)*(1-tx)+h(ix+1,iy+1)*tx)*ty

def grass(x,y):
    variation=5*noise(x,y,4)+4*noise(x,y,13)+3*noise(x,y,47)
    fine=noise(x,y,173)*2
    return (137+variation+fine,159+variation+fine,95+variation*.7+fine)
png('wood-grain.png',grain);png('grass.png',grass)
print('Generated original 512x512 wood and grass PNG textures.')
