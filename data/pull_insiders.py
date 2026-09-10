#!/usr/bin/env python3
"""SEC Insider Transactions Data Sets (Form 3/4/5 quarterly TSV zips) → open-market buys/sells by issuer, last two quarters.
Also tries FINRA consolidated short interest (public Query API). Run on a machine with internet."""
import json,urllib.request,zipfile,io,csv,sys,os,time,datetime,re
CONTACT=__import__("os").environ.get("SAROS_CONTACT","saros@gcarosso.bio")  # SEC and NIH ask for a contact address in the User-Agent
OUT=os.path.dirname(os.path.abspath(__file__))
UA={"User-Agent":"SAROS research dashboard "+CONTACT}
def get(url,timeout=180):
    r=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=timeout);return r.read()
today=datetime.date.today()
qs=[]
y,q=today.year,(today.month-1)//3+1
for _ in range(3):
    q-=1
    if q==0: q=4;y-=1
    qs.append(f"{y}q{q}")
iss={}
got=[]
for tag in qs:
    url=f"https://www.sec.gov/files/structureddata/data/insider-transactions-data-sets/{tag}_form345.zip"
    try: b=get(url)
    except Exception as e: print("miss",tag,e,file=sys.stderr); continue
    z=zipfile.ZipFile(io.BytesIO(b)); names={n.upper():n for n in z.namelist()}
    def rd(n):
        return list(csv.DictReader(io.TextIOWrapper(z.open(names[n]),encoding="utf-8",errors="replace"),delimiter="\t"))
    sub={r["ACCESSION_NUMBER"]:r for r in rd("SUBMISSION.TSV")}
    own={}
    for r in rd("REPORTINGOWNER.TSV"): own.setdefault(r["ACCESSION_NUMBER"],[]).append(r)
    n=0
    for r in rd("NONDERIV_TRANS.TSV"):
        code=r.get("TRANS_CODE","");
        if code not in ("P","S"): continue
        s=sub.get(r["ACCESSION_NUMBER"]); 
        if not s or s.get("DOCUMENT_TYPE","").strip() not in ("4","4/A"): continue
        try: sh=float(r.get("TRANS_SHARES") or 0); px=float(r.get("TRANS_PRICEPERSHARE") or 0)
        except: continue
        if sh<=0 or px<=0: continue
        k=s["ISSUERCIK"]; e=iss.setdefault(k,{"cik":k,"name":s["ISSUERNAME"],"tk":(s.get("ISSUERTRADINGSYMBOL") or "").strip().upper(),"buy_n":0,"buy_usd":0,"sell_n":0,"sell_usd":0,"buyers":set(),"last_buy":"","last_sell":"","own10_buy_usd":0,"own10_sell_usd":0})
        who=own.get(r["ACCESSION_NUMBER"],[{}])[0]; role=("CEO" if "CEO" in (who.get("RPTOWNER_TITLE") or "").upper() else "CFO" if "CFO" in (who.get("RPTOWNER_TITLE") or "").upper() else "Dir" if who.get("RPTOWNER_RELATIONSHIP","")=="Director" or who.get("ISDIRECTOR")=="1" else "10%" if who.get("ISTENPERCENTOWNER")=="1" else "Off")
        rel=(who.get("RPTOWNER_RELATIONSHIP") or "")
        nm=(who.get("RPTOWNERNAME") or "")
        if "TenPercent" in rel or "10%" in rel or re.search(r"\b(A/S|AG|N\.?V\.?|INC\.?|LLC|L\.?P\.?|LTD|PLC|FUND|CAPITAL|PARTNERS|HOLDINGS|VENTURES|MANAGEMENT|ADVISORS|TRUST|GMBH|S\.?A\.?|PHARMA|THERAPEUTICS|BIOSCIENCES)\b",nm.upper()): role="10%"
        d=r.get("TRANS_DATE","")
        if role=="10%":
            e["own10_buy_usd" if code=="P" else "own10_sell_usd"]+=sh*px; n+=1; continue
        if code=="P": e["buy_n"]+=1;e["buy_usd"]+=sh*px;e["buyers"].add((who.get("RPTOWNERNAME") or "")[:30]+" ("+role+")");e["last_buy"]=max(e["last_buy"],d)
        else: e["sell_n"]+=1;e["sell_usd"]+=sh*px;e["last_sell"]=max(e["last_sell"],d)
        n+=1
    got.append(tag); print(tag,"trans",n,file=sys.stderr)
for e in iss.values(): e["buyers"]=sorted(e["buyers"])[:6]
def fmtd(d):
    try: return datetime.datetime.strptime(d,"%d-%b-%Y").strftime("%Y-%m-%d")
    except: return d
for e in iss.values(): e["last_buy"]=fmtd(e["last_buy"]); e["last_sell"]=fmtd(e["last_sell"])
si={}
# FINRA Query API: GET returns CSV from 2020 onward; a POST with a settlement-date range returns JSON. Page the last 45 days
# (about three settlements for every symbol) and keep the latest settlement per symbol; process.py picks the tickers it needs.
try:
    import urllib.request
    end=datetime.date.today(); start=end-datetime.timedelta(days=45); off=0; n=0
    while True:
        body=json.dumps({"limit":5000,"offset":off,"dateRangeFilters":[{"fieldName":"settlementDate","startDate":start.isoformat(),"endDate":end.isoformat()}]}).encode()
        req=urllib.request.Request("https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest",data=body,headers={"Content-Type":"application/json","Accept":"application/json",**UA})
        with urllib.request.urlopen(req,timeout=60) as r: rows=json.loads(r.read()); total=int(r.headers.get("record-total") or 0)
        for r in rows:
            k=r.get("symbolCode","")
            if k and (k not in si or (r.get("settlementDate","")>si[k].get("settlementDate",""))): si[k]=r
        n+=len(rows); off+=5000
        if not rows or off>=total: break
        time.sleep(0.2)
    print("finra rows",n,"symbols",len(si),"window",start,end,file=sys.stderr)
except Exception as e: print("finra short interest unavailable:",e,file=sys.stderr)
json.dump({"pulled":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"quarters":got,"issuers":list(iss.values()),"short":si},open(os.path.join(OUT,"insiders_raw.json"),"w"))
print("done",len(iss),got,len(si))
