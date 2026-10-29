"""Box-local contact trajectory; metres, seconds, no actor-space offsets."""
def smooth(x):
 x=max(0.,min(1.,x));return x*x*(3.-2.*x)

def stroke_point(t,duration,stroke,box_half_width,strip_thickness,head_radius):
 start,end=stroke['startS'],stroke['endS'];z0,z1=stroke['fromZM'],stroke['toZM'];clearance=stroke['clearanceM']
 x=-box_half_width-strip_thickness-head_radius
 if t<start:return [x-clearance*(1.-smooth(t/start)),0.,z0]
 if t<=end:return [x,0.,z0+(z1-z0)*smooth((t-start)/(end-start))]
 u=(t-end)/(duration-end)
 # Withdraw normal to the strip before returning along its length.
 return [x-clearance*smooth(u*3.),0.,z1+(z0-z1)*smooth((u-.4)/.6)]
