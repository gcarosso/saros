#!/usr/bin/env python3
"""Pull latest two 13F-HR info tables for a list of biotech specialist funds from SEC EDGAR. Run on a machine with internet.
Output: f13_raw.json {funds:[{name,cik,filings:[{period,filed,acc,holdings:[{issuer,cusip,value,shares}]}]}]}"""
import json,urllib.request,urllib.parse,re,time,sys,os,gzip,xml.etree.ElementTree as ET
CONTACT=__import__("os").environ.get("SAROS_CONTACT","saros@gcarosso.bio")  # SEC and NIH ask for a contact address in the User-Agent
OUT=os.path.dirname(os.path.abspath(__file__))
UA={"User-Agent":"SAROS research dashboard "+CONTACT,"Accept-Encoding":"gzip"}
def get(url,binary=False):
    for i in range(4):
        try:
            r=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=60);b=r.read()
            if r.headers.get("Content-Encoding")=="gzip": b=gzip.decompress(b)
            time.sleep(0.12); return b if binary else b.decode("utf-8","replace")
        except Exception as e: print("retry",i,url,e,file=sys.stderr); time.sleep(1.5*(i+1))
    return None
KNOWN={"Baker Bros. Advisors":1263508,"Perceptive Advisors":1224962,"RA Capital Management":1346824,"OrbiMed Advisors":1055951,"Deerfield Management":1009258,"Redmile Group":1425738,"Avoro Capital Advisors":1633313,"EcoR1 Capital":1587114,"Logos Global Management":1792126,"Cormorant Asset Management":1583977,"Vivo Capital":1674712,"Frazier Life Sciences Management":1892134,"Rock Springs Capital":1595725,"Farallon Capital Management":909661,"Point72 Asset Management":1603466,"Braidwell":1920938,"Commodore Capital":1831942,"Darwin Global Management":1839209,"Paradigm Biocapital":1855655,"Woodline Partners":1784547,"Viking Global Investors":1103804,"Bain Capital Life Sciences":1703031,"Vestal Point Capital":1974915,"Samsara BioCapital":1744967,"TCG Crossover":1839948,"Ally Bridge Group":1822947,"Great Point Partners":1349965,"Sofinnova Investments":1631134,"Sectoral Asset Management":1274413,"Driehaus Capital Management":1134560,"Tang Capital Management":1232621,"Polar Capital":1837309,"Foresite Capital Management":1581219}
FUNDS=["Baker Bros. Advisors","Perceptive Advisors","RA Capital Management","OrbiMed Advisors","Deerfield Management","Redmile Group","Avoro Capital Advisors","EcoR1 Capital","Logos Global Management","Cormorant Asset Management","Boxer Capital","Vivo Capital","Frazier Life Sciences Management","Rock Springs Capital","Farallon Capital Management","Point72 Asset Management","Braidwell","Commodore Capital","Darwin Global Management","Paradigm Biocapital","Woodline Partners","Viking Global Investors","Great Point Partners","Ally Bridge Group","Sofinnova Investments","BVF Inc","Bain Capital Life Sciences","Vestal Point Capital","Tang Capital Management","Nantahala Capital Management","Samsara BioCapital","Foresite Capital Management","Sectoral Asset Management","TCG Crossover","Driehaus Capital Management","Polar Capital"]
def resolve(name):
    u="https://www.sec.gov/cgi-bin/browse-edgar?"+urllib.parse.urlencode({"action":"getcompany","company":name,"type":"13F-HR","output":"atom","count":"1"})
    t=get(u)
    if not t: return None
    m=re.search(r"<cik>(\d+)</cik>",t); n=re.search(r"<conformed-name>([^<]+)</conformed-name>",t)
    if not m:  # maybe a list page
        m=re.search(r"CIK=(\d{10})",t); 
    return (int(m.group(1)),n.group(1) if n else name) if m else None
out=[]
for f in FUNDS:
    r=(KNOWN[f],f) if f in KNOWN else resolve(f)
    if not r: print("UNRESOLVED",f,file=sys.stderr); continue
    cik,cname=r
    sub=json.loads(get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json") or "{}")
    rec=sub.get("filings",{}).get("recent",{})
    fl=[(rec["form"][i],rec["accessionNumber"][i],rec["filingDate"][i],rec.get("reportDate",[""]*len(rec["form"]))[i]) for i in range(len(rec.get("form",[])))]
    fl=[x for x in fl if x[0] in ("13F-HR","13F-HR/A") and x[3]>="2025-12-31"][:3]
    cname=sub.get("name",cname)
    filings=[]
    seen=set()
    for form,acc,fd,rd in fl:
        if rd in seen: continue
        accn=acc.replace("-","")
        idx=json.loads(get(f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn}/index.json") or "{}")
        files=[it["name"] for it in idx.get("directory",{}).get("item",[]) if it["name"].lower().endswith(".xml")]
        table=[x for x in files if "primary_doc" not in x.lower()]
        if not table: continue
        x=get(f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn}/{table[0]}")
        if not x: continue
        x=re.sub(r'xmlns(:\w+)?="[^"]+"','',x); x=re.sub(r'<(/?)[\w.-]+:',r'<\1',x); x=re.sub(r'\s[\w.-]+:[\w.-]+="[^"]*"','',x)
        try: root=ET.fromstring(x)
        except Exception as e: print("xml fail",cname,acc,e,file=sys.stderr); continue
        H=[]
        for it in root.iter("infoTable"):
            g=lambda k:(it.findtext(k) or "").strip()
            sh=it.find("shrsOrPrnAmt"); shares=(sh.findtext("sshPrnamt") if sh is not None else "") or "0"
            H.append({"issuer":g("nameOfIssuer"),"cls":g("titleOfClass"),"cusip":g("cusip"),"value":float(g("value") or 0),"shares":float(shares or 0),"put":g("putCall")})
        filings.append({"period":rd,"filed":fd,"acc":acc,"form":form,"n":len(H),"holdings":H}); seen.add(rd)
        if len(filings)>=2: break
    print(cname,cik,[(f["period"],f["n"]) for f in filings],file=sys.stderr)
    out.append({"name":cname,"query":f,"cik":cik,"filings":filings})
json.dump({"pulled":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"funds":out},open(os.path.join(OUT,"f13_raw.json"),"w"))
print("done",len(out))
