#!/usr/bin/env python3
"""SEC XBRL companyfacts for every matched issuer → facts_raw.json.

Why this exists (2026-09-09): the frames API asks for one concept at a time, so a filer that tags its
investments as `MarketableSecurities` (Edgewise: $388M) instead of `MarketableSecuritiesCurrent` showed
no investments at all and a six-month runway against a real $460M. companyfacts returns every concept a
filer uses, so the loader can take cash, every investment tag, debt, quarterly operating cash flow and
shares from one document per company, all at the same balance-sheet date.

Input : data/matched_ciks.json, written by process.py (the sponsor → issuer join). First run: process,
        pull-facts, process again (the Makefile's `refresh` does this).
Output: data/facts_raw.json {pulled, n, facts: {cik: {...}}}; per-CIK JSON cached in data/facts_cache/
        for six days so a re-run costs nothing.
Fields per issuer: cash, cash_per (ISO date), inv, inv_tags, debt, debt_tags, ocf_run (operating cash
flow annualized from the latest year-to-date figure), ocf_ytd, ocf_months, ocf_per, ocf_fy, ocf_fy_per,
sh (shares outstanding), flt (public float), filed (latest filing used), name.
Polite: ≤ 10 requests/s, descriptive User-Agent with a contact address (SAROS_CONTACT).
"""
import datetime, json, os, sys, time, urllib.request

OUT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(OUT, "facts_cache"); os.makedirs(CACHE, exist_ok=True)
UA = "SAROS clinical-trial readout calendar (" + os.environ.get("SAROS_CONTACT", "saros@gcarosso.bio") + ")"
FORMS = {"10-Q", "10-K", "10-Q/A", "10-K/A", "20-F", "40-F"}
MAX_AGE = 6 * 86400

def fetch(cik):
    p = os.path.join(CACHE, "CIK%010d.json" % int(cik))
    if os.path.exists(p) and time.time() - os.path.getmtime(p) < MAX_AGE:
        return json.load(open(p))
    req = urllib.request.Request("https://data.sec.gov/api/xbrl/companyfacts/CIK%010d.json" % int(cik), headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                import gzip; raw = gzip.decompress(raw)
        open(p, "wb").write(raw); time.sleep(0.12)
        return json.loads(raw)
    except Exception as e:
        print("companyfacts failed", cik, e, file=sys.stderr); return None

def series(g, concept, unit="USD"):
    return [x for x in g.get(concept, {}).get("units", {}).get(unit, []) if x.get("form") in FORMS and x.get("end")]

def latest_instant(g, concepts):
    """(value, end, filed) of the most recent balance-sheet figure across the given concepts"""
    best = None
    for c in concepts:
        for x in series(g, c):
            if "start" in x: continue
            k = (x["end"], x.get("filed", ""))
            if best is None or k > best[0]: best = (k, x["val"], c)
    return (best[1], best[0][0], best[0][1], best[2]) if best else (None, None, None, None)

def at(g, concept, end):
    """value of an instant concept at a given balance-sheet date (latest filing that reports it)"""
    xs = [x for x in series(g, concept) if x.get("end") == end and "start" not in x]
    if not xs: return None
    return sorted(xs, key=lambda x: x.get("filed", ""))[-1]["val"]

POOLS = {   # alternative tag families for the same pool of investments; the largest family wins, families are not summed
    "MarketableSecurities": [["MarketableSecurities"], ["MarketableSecuritiesCurrent", "MarketableSecuritiesNoncurrent"]],
    "AvailableForSaleSecurities": [["AvailableForSaleSecuritiesDebtSecurities"], ["AvailableForSaleSecuritiesDebtSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesNoncurrent"],
                                   ["AvailableForSaleSecurities"], ["AvailableForSaleSecuritiesCurrent", "AvailableForSaleSecuritiesNoncurrent"]],
    "HeldToMaturitySecurities": [["HeldToMaturitySecurities"], ["HeldToMaturitySecuritiesCurrent", "HeldToMaturitySecuritiesNoncurrent"]],
    "Investments": [["ShortTermInvestments", "LongTermInvestments"], ["ShortTermInvestments"], ["OtherShortTermInvestments", "OtherLongTermInvestments"]],
}
DEBT = [["LongTermDebt"], ["LongTermDebtNoncurrent", "LongTermDebtCurrent"], ["ConvertibleNotesPayable"], ["ConvertibleNotesPayableNoncurrent", "ConvertibleNotesPayableCurrent"],
        ["ConvertibleDebtNoncurrent", "ConvertibleDebtCurrent"], ["NotesPayable"], ["SeniorNotes"], ["LoansPayable"], ["DebtCurrent", "LongTermDebtNoncurrent"]]

def pool_value(g, families, end):
    """max over tag families of the sum of tags present at `end`; (value, 'tag+tag') or (None, None)"""
    best = (None, None)
    for fam in families:
        vals = [(t, at(g, t, end)) for t in fam]
        vals = [(t, v) for t, v in vals if v is not None]
        if not vals: continue
        s = sum(v for _, v in vals)
        if best[0] is None or s > best[0]: best = (s, "+".join(t for t, _ in vals))
    return best

def extract(j):
    g = j.get("facts", {}).get("us-gaap", {}); dei = j.get("facts", {}).get("dei", {})
    out = {"name": j.get("entityName", "")}
    cash, end, filed, ctag = latest_instant(g, ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "Cash"])
    out.update(cash=cash, cash_per=end, cash_tag=ctag, filed=filed)
    if end:
        # investments: AFS + HTM are distinct pools; MarketableSecurities and Investments usually restate one of them
        afs, afs_t = pool_value(g, POOLS["AvailableForSaleSecurities"], end)
        htm, htm_t = pool_value(g, POOLS["HeldToMaturitySecurities"], end)
        mkt, mkt_t = pool_value(g, POOLS["MarketableSecurities"], end)
        inv_, inv_t = pool_value(g, POOLS["Investments"], end)
        cands = [((afs or 0) + (htm or 0), "+".join(t for t in (afs_t, htm_t) if t)), (mkt or 0, mkt_t), (inv_ or 0, inv_t)]
        v, t = max(cands, key=lambda c: c[0])
        total = at(g, "CashCashEquivalentsAndMarketableSecurities", end)
        if total is not None and total - (cash or 0) > v: v, t = total - (cash or 0), "CashCashEquivalentsAndMarketableSecurities−cash"
        out.update(inv=v if t else None, inv_tags=t or None)
        d, dt = pool_value(g, DEBT, end)
        out.update(debt=d, debt_tags=dt)
    # operating cash flow: latest year-to-date figure, annualized; FY figure kept separately
    ocf = [x for x in series(g, "NetCashProvidedByUsedInOperatingActivities") if "start" in x]
    if ocf:
        last_end = max(x["end"] for x in ocf)
        cands = [x for x in ocf if x["end"] == last_end]
        def months(x):
            a = datetime.date.fromisoformat(x["start"]); b = datetime.date.fromisoformat(x["end"]); return max(1, round((b - a).days / 30.4))
        x = max(cands, key=lambda x: (months(x), x.get("filed", "")))   # the YTD span, not a single quarter, is the stable one
        m = months(x)
        out.update(ocf_ytd=x["val"], ocf_months=m, ocf_per=x["start"] + ".." + x["end"], ocf_run=x["val"] / m * 12)
        fy = [x for x in ocf if x.get("fp") == "FY" and months(x) >= 11]
        if fy:
            f = sorted(fy, key=lambda x: (x["end"], x.get("filed", "")))[-1]; out.update(ocf_fy=f["val"], ocf_fy_per=f["end"])
    sh = [x for x in dei.get("EntityCommonStockSharesOutstanding", {}).get("units", {}).get("shares", []) if x.get("end")]
    if sh: out["sh"] = sorted(sh, key=lambda x: (x["end"], x.get("filed", "")))[-1]["val"]
    fl = [x for x in dei.get("EntityPublicFloat", {}).get("units", {}).get("USD", []) if x.get("end")]
    if fl: f = sorted(fl, key=lambda x: (x["end"], x.get("filed", "")))[-1]; out.update(flt=f["val"], flt_per=f["end"])
    return out

def main():
    p = os.path.join(OUT, "matched_ciks.json")
    if not os.path.exists(p): print("no matched_ciks.json yet: run process.py first", file=sys.stderr); return 1
    todo = json.load(open(p)); facts = {}; t0 = time.time()
    for i, m in enumerate(todo):
        j = fetch(m["cik"])
        if j: facts[str(m["cik"])] = extract(j)
        if i % 50 == 0: print(f"  {i}/{len(todo)} · {int(time.time()-t0)} s", file=sys.stderr)
    json.dump({"pulled": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "source": "SEC XBRL companyfacts, one document per matched issuer", "n": len(facts), "facts": facts},
              open(os.path.join(OUT, "facts_raw.json"), "w"))
    inv = sum(1 for f in facts.values() if f.get("inv")); print(f"facts {len(facts)} issuers · {inv} with investments · {sum(1 for f in facts.values() if f.get('ocf_run') is not None)} with OCF")
    return 0

if __name__ == "__main__":
    sys.exit(main())
