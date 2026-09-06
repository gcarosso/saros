#!/usr/bin/env python3
"""Assemble SAROS: src/head.html + src/body.html (with src/pages/* stitched in) + glossary + gzip/base64 snapshot
→ dist/saros.html (standalone) and dist/artifact.html (no skeleton, for the claude.ai Artifact publish)."""
import base64, os, sys, json, re
here=os.path.dirname(os.path.abspath(__file__))
snap=sys.argv[1] if len(sys.argv)>1 else os.path.join(here,'data','snapshot.json.gz')
b64=base64.b64encode(open(snap,'rb').read()).decode()
rd=lambda *p:open(os.path.join(here,'src',*p),encoding='utf-8').read()
head,body,a1,a2=rd('head.html'),rd('body.html'),rd('app1.js'),rd('app2.js')
for page in re.findall(r'<!--PAGE:([a-z]+)-->',body):
    body=body.replace(f'<!--PAGE:{page}-->',rd('pages',page+'.html'))
# one logo, two uses: inline mark in the brand and the tab icon (same SVG as a data URI)
import urllib.parse
mark512=os.path.join(here,'public','brand','saros-mark-512.png'); mark64=os.path.join(here,'public','brand','saros-mark-64.png')
if os.path.exists(mark512):   # the master mark is the photograph in public/brand (see the brand spec); never redrawn
    d=lambda p:'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
    src=d(mark512); ico=d(mark64) if os.path.exists(mark64) else src
    body=body.replace('<!--LOGO:hero-->',f'<img class="logo-hero" src="{src}" alt="SAROS mark">').replace('<!--LOGO-->',f'<img class="mark" src="{src}" alt="">')
    head=head.replace('<!--FAVICON-->',f'<link rel="icon" type="image/png" href="{ico}">')
else:
    logo=rd('pages','logo.svg').strip()
    body=body.replace('<!--LOGO:hero-->',logo.replace('<svg ','<svg class="logo-hero" ',1)).replace('<!--LOGO-->',logo.replace('<svg ','<svg class="mark" ',1))
    head=head.replace('<!--FAVICON-->','<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,'+urllib.parse.quote(logo,safe='')+'">')
gloss={}
for line in rd('pages','glossary.txt').splitlines():
    if not line.strip() or line.startswith('#'): continue
    k,_,v=line.partition(':'); gloss[k.strip()]=v.strip()
inner=head+"\n"+body+f'\n<script>const PAYLOAD_B64="{b64}";</script>\n<script>const GLOSS={json.dumps(gloss,ensure_ascii=False)};</script>\n<script>\n{a1}\n{a2}\n</script>\n'
os.makedirs(os.path.join(here,'dist'),exist_ok=True)
open(os.path.join(here,'dist','artifact.html'),'w',encoding='utf-8').write(inner)
full='<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n'+head+'\n</head>\n<body>\n'+inner[len(head):]+'</body>\n</html>\n'
open(os.path.join(here,'dist','saros.html'),'w',encoding='utf-8').write(full)
print('artifact.html',len(inner)//1024,'KB · saros.html',len(full)//1024,'KB ·',len(gloss),'glossary entries')
