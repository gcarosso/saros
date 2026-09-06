#!/usr/bin/env python3
"""Pull SEC company tickers + XBRL frames (cash, R&D, net loss, revenue) for the ticker/financials join. Run on a machine with internet."""
import json,urllib.request,time,sys,os,gzip
CONTACT=__import__("os").environ.get("SAROS_CONTACT","saros@gcarosso.bio")  # SEC and NIH ask for a contact address in the User-Agent
OUT=os.path.dirname(os.path.abspath(__file__))
UA={"User-Agent":"SAROS research dashboard "+CONTACT,"Accept-Encoding":"gzip"}
def get(url):
    for i in range(4):
        try:
            r=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=60); b=r.read()
            if r.headers.get("Content-Encoding")=="gzip": b=gzip.decompress(b)
            return json.loads(b)
        except Exception as e: print("retry",i,url,e,file=sys.stderr); time.sleep(1.5*(i+1))
    return None
tick=get("https://www.sec.gov/files/company_tickers.json")
tickers=[{"cik":v["cik_str"],"t":v["ticker"],"n":v["title"]} for v in tick.values()]
print("tickers",len(tickers),file=sys.stderr)
ex=get("https://www.sec.gov/files/company_tickers_exchange.json")
exmap={}
if ex:
    f=ex["fields"]; ic,it,iex=f.index("cik"),f.index("ticker"),f.index("exchange")
    for row in ex["data"]: exmap[row[it]]=row[iex]
for t in tickers: t["ex"]=exmap.get(t["t"],"")
FR={}
def frame(concept,period,key,tax="us-gaap",unit="USD"):
    j=get(f"https://data.sec.gov/api/xbrl/frames/{tax}/{concept}/{unit}/{period}.json"); time.sleep(0.15)
    if not j: return
    for d in j.get("data",[]):
        FR.setdefault(d["cik"],{}).setdefault(key,d["val"])
# cash & equivalents (+ short-term investments), latest instant; try Q2 2026 then Q1 2026 then FY2025
for per in ["CY2026Q2I","CY2026Q1I","CY2025Q4I"]:
    for c in ["CashAndCashEquivalentsAtCarryingValue","CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"]: frame(c,per,"cash")
    for c in ["MarketableSecuritiesCurrent","AvailableForSaleSecuritiesDebtSecuritiesCurrent","ShortTermInvestments"]: frame(c,per,"sti")
    frame("Assets",per,"assets")
    for k in ["cash","sti","assets"]:
        for cik,v in FR.items():
            if k in v and (k+"_per") not in v: v[k+"_per"]=per
# annual FY2025 flows
for c in ["ResearchAndDevelopmentExpense"]: frame(c,"CY2025","rd")
for c in ["NetIncomeLoss"]: frame(c,"CY2025","ni")
for c in ["Revenues","RevenueFromContractWithCustomerExcludingAssessedTax"]: frame(c,"CY2025","rev")
# last two quarters R&D for run-rate
for per,k in [("CY2026Q2","rd_q2"),("CY2026Q1","rd_q1")]: frame("ResearchAndDevelopmentExpense",per,k)
for per,k in [("CY2026Q2","ni_q2"),("CY2026Q1","ni_q1")]: frame("NetIncomeLoss",per,k)
# market-cap proxy: public float (dei, reported once a year as of the last day of Q2) and shares outstanding (latest cover page)
for per in ["CY2026Q2I","CY2025Q4I","CY2025Q2I"]:
    frame("EntityPublicFloat",per,"float",tax="dei")
    for cik,v in FR.items():
        if "float" in v and "float_per" not in v: v["float_per"]=per
for per in ["CY2026Q3I","CY2026Q2I","CY2026Q1I","CY2025Q4I"]:
    frame("EntityCommonStockSharesOutstanding",per,"sh",tax="dei",unit="shares")
    for cik,v in FR.items():
        if "sh" in v and "sh_per" not in v: v["sh_per"]=per
json.dump({"pulled":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"tickers":tickers,"fin":FR},open(os.path.join(OUT,"sec_raw.json"),"w"))
print("done",len(tickers),len(FR))
