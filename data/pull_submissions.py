#!/usr/bin/env python3
"""SEC EDGAR submissions for every matched issuer → subs_raw.json (the "Filings" section of the dossier).

Why (Phase 1, 2026-09-10): a balance sheet is dated; what a company filed after that date is the only public
record of a financing or an ownership change since. Radar shows these; SAROS did not. The submissions JSON is
structured (form, date, accession, primary document), so no text extraction is needed.

Input : data/matched_ciks.json (from process.py)
Output: data/subs_raw.json {pulled, subs: {cik: [{f, d, acc, url, desc, items}]}}; per-CIK JSON cached one day
        in data/subs_cache/ (gitignored).
Kept per issuer, newest first: 8-K (12 months, ≤ 12), financing forms 424B* / S-1* / S-3* / F-1* / F-3* (24 months,
≤ 10), ownership SC 13D* / SC 13G* / SCHEDULE 13D* / 13G* (24 months, ≤ 12), DEF 14A (last one), 10-Q / 10-K / 20-F
(last 2). Everything else is left out on purpose; the section answers "what happened since the balance sheet",
not "everything ever filed".
"""
import datetime, json, os, sys, time, urllib.request, gzip

OUT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(OUT, "subs_cache"); os.makedirs(CACHE, exist_ok=True)
UA = "SAROS clinical-trial readout calendar (" + os.environ.get("SAROS_CONTACT", "saros@gcarosso.bio") + ")"
MAX_AGE = 86400

def fetch(cik):
    p = os.path.join(CACHE, "CIK%010d.json" % int(cik))
    if os.path.exists(p) and time.time() - os.path.getmtime(p) < MAX_AGE: return json.load(open(p))
    req = urllib.request.Request("https://data.sec.gov/submissions/CIK%010d.json" % int(cik), headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip": raw = gzip.decompress(raw)
        open(p, "wb").write(raw); time.sleep(0.12); return json.loads(raw)
    except Exception as e:
        print("submissions failed", cik, e, file=sys.stderr); return None

def kind(form):
    f = form.upper()
    if f.startswith("8-K"): return "8k"
    if f.startswith(("424B", "S-1", "S-3", "F-1", "F-3")): return "fin"
    if f.startswith(("SC 13D", "SC 13G", "SCHEDULE 13D", "SCHEDULE 13G")): return "own"
    if f.startswith("DEF 14A"): return "proxy"
    if f.startswith(("10-Q", "10-K", "20-F", "40-F")): return "report"
    return None

LIMIT = {"8k": (365, 12), "fin": (730, 10), "own": (730, 12), "proxy": (730, 1), "report": (730, 2)}

def compact(j, today=None):
    """the kept filings for one issuer, newest first"""
    today = today or datetime.date.today()
    r = j.get("filings", {}).get("recent", {}); cik = int(j.get("cik", 0))
    rows = []
    for form, d, acc, doc, desc, items in zip(r.get("form", []), r.get("filingDate", []), r.get("accessionNumber", []), r.get("primaryDocument", []), r.get("primaryDocDescription", []), r.get("items", [])):
        k = kind(form)
        if not k: continue
        days, cap = LIMIT[k]
        try: age = (today - datetime.date.fromisoformat(d)).days
        except ValueError: continue
        if age > days: continue
        rows.append({"f": form, "d": d, "k": k, "acc": acc, "url": "https://www.sec.gov/Archives/edgar/data/%d/%s/%s" % (cik, acc.replace("-", ""), doc) if doc else "https://www.sec.gov/Archives/edgar/data/%d/%s/" % (cik, acc.replace("-", "")),
                     "desc": (desc or "")[:90], "items": (items or "")[:40]})
    rows.sort(key=lambda x: x["d"], reverse=True)
    out, n = [], {}
    for x in rows:
        n[x["k"]] = n.get(x["k"], 0) + 1
        if n[x["k"]] <= LIMIT[x["k"]][1]: out.append(x)
    return out

def main():
    p = os.path.join(OUT, "matched_ciks.json")
    if not os.path.exists(p): print("no matched_ciks.json yet: run process.py first", file=sys.stderr); return 1
    todo = json.load(open(p)); subs = {}; t0 = time.time()
    for i, m in enumerate(todo):
        j = fetch(m["cik"])
        if j: subs[str(m["cik"])] = compact(j)
        if i % 50 == 0: print(f"  {i}/{len(todo)} · {int(time.time()-t0)} s", file=sys.stderr)
    json.dump({"pulled": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "source": "SEC EDGAR submissions JSON, one document per matched issuer", "subs": subs}, open(os.path.join(OUT, "subs_raw.json"), "w"))
    n = sum(len(v) for v in subs.values()); fin = sum(1 for v in subs.values() for x in v if x["k"] == "fin")
    print(f"submissions {len(subs)} issuers · {n} filings kept · {fin} financing forms")
    return 0

if __name__ == "__main__":
    sys.exit(main())
