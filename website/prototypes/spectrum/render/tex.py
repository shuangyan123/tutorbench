import math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
random.seed(7)
CAV='fonts/caveat.ttf'; MONO='fonts/geistmono.ttf'
PAPER=(246,247,249); LINE=(150,175,215); MARGIN=(225,120,120); GRAPH=(70,72,80)

def ruled(w,h,step,margin=None):
    im=Image.new('RGB',(w,h),PAPER); d=ImageDraw.Draw(im)
    for y in range(step//2,h,step): d.line([(0,y),(w,y)],fill=LINE,width=max(2,w//700))
    if margin: d.line([(margin,0),(margin,h)],fill=MARGIN,width=max(2,w//600))
    # paper grain
    n=Image.effect_noise((w,h),18).convert('L')
    im=Image.blend(im, Image.merge('RGB',(n,n,n)).point(lambda v: 200+v*0.2), 0.08)
    return im

def pencil(im, xy, text, size, rot=0):
    f=ImageFont.truetype(CAV,size)
    layer=Image.new('L',im.size,0); d=ImageDraw.Draw(layer)
    d.text(xy,text,font=f,fill=235)
    if rot: layer=layer.rotate(rot,center=xy,resample=Image.BICUBIC)
    # graphite: grainy, slightly uneven
    g=Image.effect_noise(im.size,60).convert('L').point(lambda v: 255 if v>70 else 150)
    from PIL import ImageChops
    mask=ImageChops.multiply(layer,g).filter(ImageFilter.GaussianBlur(0.8))
    ink=Image.new('RGB',im.size,GRAPH)
    im.paste(ink,(0,0),mask)
    return im

def torn(im):
    w,h=im.size; m=Image.new('L',(w,h),0); d=ImageDraw.Draw(m)
    pts=[]; inset=w*0.04
    def edge(a,b,n):
        out=[]
        for i in range(n):
            t=i/n; x=a[0]+(b[0]-a[0])*t; y=a[1]+(b[1]-a[1])*t
            out.append((x+random.uniform(-inset*.5,inset*.5), y+random.uniform(-inset*.5,inset*.5)))
        return out
    c=[(inset,inset),(w-inset,inset*1.6),(w-inset*1.2,h-inset),(inset*1.4,h-inset*1.3)]
    for i in range(4): pts+=edge(c[i],c[(i+1)%4],40)
    d.polygon(pts,fill=255)
    m=m.filter(ImageFilter.GaussianBlur(1.2))
    im=im.convert('RGBA'); im.putalpha(m); return im

for name,text in [('scrap27','2/7'),('scrap14','1/4'),('scrap13','1/3 +')]:
    im=ruled(1024,720,120)
    pencil(im,(170 if len(text)<4 else 90,120),text,430 if len(text)<4 else 330, rot=random.uniform(-6,6))
    torn(im).save(f'tex/{name}.png')

nb=ruled(2400,1600,92,margin=300)
pencil(nb,(520,560),'1/3 + 1/4 = 2/7',300,rot=4)
nb.save('tex/notebook.png')

# engraved ring on the eyepiece cap
S=2048; ring=Image.new('L',(S,S),0); d=ImageDraw.Draw(ring)
f=ImageFont.truetype(MONO,58)
txt='TEACHOMETRY  ·  KALEIDOSCOPE  No. 01  ·  THREE MIRRORS  ·  λ1 – λ5  ·  TUTORBENCH  ·  '
R=0.40*S; cx=cy=S/2
total=sum(d.textlength(ch,font=f) for ch in txt); scale=(2*math.pi*R*0.98)/total
a=-math.pi/2
for ch in txt:
    cw=d.textlength(ch,font=f)*scale
    a+=cw/(2*R)
    g=Image.new('L',(120,120),0); ImageDraw.Draw(g).text((60,60),ch,font=f,fill=255,anchor='mm')
    g=g.rotate(-math.degrees(a)-90,resample=Image.BICUBIC)
    x=cx+R*math.cos(a); y=cy+R*math.sin(a)
    ring.paste(255,(int(x-60),int(y-60)),g)
    a+=cw/(2*R)
# fine tick ring
for i in range(180):
    t=i/180*2*math.pi; r1=0.455*S; r2=r1+(26 if i%15==0 else 12)
    d.line([(cx+r1*math.cos(t),cy+r1*math.sin(t)),(cx+r2*math.cos(t),cy+r2*math.sin(t))],fill=255,width=4)
ring.save('tex/capring.png')
print('ok')
