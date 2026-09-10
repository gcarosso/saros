#!/usr/bin/env python3
"""Company-guided milestones from 8-K / 6-K filings → guidance_raw.json.

What it finds (Phase 2, 2026-09-10): sentences in which a company tells the market when to expect something —
"topline data in the second half of 2026", "expect to report interim results in 1Q 2027", "enrollment completion
expected in Q4" — each with a period (day, month, quarter or half), the asset named in the sentence, and the filing.
These are the company's own dates, the thing a registry primary-completion date is not; the dashboard shows them as
"company-guided", never as readouts that happened.

Built on pull_pdufa.py: the same EDGAR full-text search, document fetch, sentence split, period regexes and asset
extraction. Trailing 120 days, 8-K and 6-K only, capped at MAX_DOCS filings newest first.
Output: guidance_raw.json {pulled, window, rows: [{kind, milestone, date, precision, asset, sentence, ticker, cik, company, filed, form, source}]}.
"""
import datetime, json, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pull_pdufa as pp

OUT = os.path.dirname(os.path.abspath(__file__))
MAX_DOCS = 700
QUERIES = ['"topline data"', '"top-line data"', '"topline results"', '"data readout"', '"expect to report"', '"interim analysis"', '"initial data"', '"complete enrollment"']
GUIDE_RX = re.compile(r"top-?line|read-?out|interim (?:data|analysis|results)|initial data|(?:data|results) (?:are |is )?(?:expected|anticipated)|expect(?:s|ed)? to (?:report|announce|present|share|complete|initiate|dose|begin|start)|(?:complete|completion of) enrollment|enrollment completion|enroll(?:ment)?\b[^.]{0,24}?(?:expected|anticipated)|first patient|last patient", re.I)
KIND = [("readout", re.compile(r"top-?line|read-?out|interim|initial data|results|data", re.I)),
        ("enrollment", re.compile(r"enroll|first patient|last patient", re.I)),
        ("start", re.compile(r"initiate|dose|begin|start", re.I))]
BOILER = re.compile(r"forward-looking|safe harbor|risk factors|actual results|no obligation", re.I)

def milestone_kind(sent):
    for k, rx in KIND:
        if rx.search(sent): return k
    return "milestone"

def period(sent, today):
    """(date, precision) for the first future period in the sentence, using the PDUFA extractor's regexes"""
    for d in pp.DATE_RX.finditer(sent):
        try: dt = datetime.date(int(d.group(3)), pp.MON_N[d.group(1).lower()], int(d.group(2)))
        except ValueError: continue
        if dt >= today: return dt.isoformat(), "day"
    for q in pp.QTR_RX.finditer(sent):
        qn = {"first": 1, "1q": 1, "q1": 1, "second": 2, "2q": 2, "q2": 2, "third": 3, "3q": 3, "q3": 3, "fourth": 4, "4q": 4, "q4": 4}[q.group(1).lower()]
        y = int(q.group(2)); d = f"{y}-{qn*3:02d}-{pp.last_day(y, qn*3)}"
        if d >= today.isoformat(): return d, "quarter"
    for h in pp.HALF_RX.finditer(sent):
        hn = 1 if h.group(1).lower() in ("first", "1h", "h1") else 2
        y = int(h.group(2)); d = f"{y}-{hn*6:02d}-{pp.last_day(y, hn*6)}"
        if d >= today.isoformat(): return d, "half"
    for m in pp.MONTH_RX.finditer(sent):
        y = int(m.group(2)); mo = pp.MON_N[m.group(1).lower()]; d = f"{y}-{mo:02d}-{pp.last_day(y, mo)}"
        if d >= today.isoformat(): return d, "month"
    m = re.search(r"\b(?:in|by|during|later in|end of)\s+(20\d\d)\b", sent)
    if m and int(m.group(1)) >= today.year: return f"{m.group(1)}-12-31", "year"
    return None, None

def extract(text, today):
    out = []
    for sent in pp.SENT_RX.split(text):
        s = sent.strip()
        if len(s) > 700 or len(s) < 40 or not GUIDE_RX.search(s) or pp.PDUFA_RX.search(s) or BOILER.search(s): continue
        d, prec = period(s, today)
        if not d: continue
        out.append({"kind": "guidance", "milestone": milestone_kind(s), "date": d, "precision": prec, "asset": pp.asset_of(s), "sentence": s[:420]})
    return out

def main():
    today = datetime.date.today(); start = today - datetime.timedelta(days=120)
    pp.QUERIES = QUERIES; pp.FORMS = ["8-K", "6-K"]
    tick = pp.load_tickers()
    hits = pp.collect_hits(start, today)
    hits.sort(key=lambda h: h["_source"].get("file_date", ""), reverse=True); hits = hits[:MAX_DOCS]
    pp.log(f"{len(hits)} filings, {start} → {today}")
    rows, t0 = [], time.time()
    for i, h in enumerate(hits):
        s = h["_source"]; url, cik = pp.doc_url(h); t = tick.get(cik)
        name = s["display_names"][0]
        company = (t["n"].title() if t else re.sub(r"\s*\(.*", "", name).strip())
        for c in extract(pp.text_of(url), today):
            rows.append({**c, "ticker": t["t"] if t else None, "cik": cik, "company": company, "filed": s.get("file_date", ""), "form": (s.get("root_form") or s.get("form") or "").upper() or None, "source": url})
        if i % 50 == 0: pp.log(f"  parsed {i}/{len(hits)} · {len(rows)} guided milestones · {int(time.time()-t0)} s")
        time.sleep(0.12)
    # one row per (filer, milestone kind, date, asset); keep the newest filing
    seen = {}
    for r in sorted(rows, key=lambda r: r["filed"]):
        seen[(r["cik"], r["milestone"], r["date"], (r["asset"] or "").lower())] = r
    rows = sorted(seen.values(), key=lambda r: (r["date"], r["ticker"] or ""))
    json.dump({"pulled": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z", "window": [start.isoformat(), today.isoformat()],
               "source": "SEC EDGAR full-text search over 8-K / 6-K and exhibits — company-guided milestone sentences, one filing cited per row", "rows": rows}, open(os.path.join(OUT, "guidance_raw.json"), "w"), indent=1)
    kinds = {k: sum(1 for r in rows if r["milestone"] == k) for k in ("readout", "enrollment", "start", "milestone")}
    print(f"guidance {len(rows)} rows {kinds} · {sum(1 for r in rows if r['ticker'])} with tickers")
    return 0

if __name__ == "__main__":
    sys.exit(main())
