#!/usr/bin/env python3
"""Last close per matched US-listed ticker → prices_raw.json. Market cap = close × shares outstanding (companyfacts).

Sources (Phase 1 decision, 2026-09-10): Yahoo's chart endpoint first, Nasdaq's quote API as fallback. Neither is an
official API; both answer without a key; Katogen Radar credits the same. Every price carries its date and source, and
the dashboard says "unofficial quote" beside it. The SEC public float stays as the fallback for market cap.
Cached for the calendar day in prices_raw.json, so a rebuild on the same day makes no requests.
"""
import datetime, json, os, sys, time, urllib.request

OUT = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "Mozilla/5.0 (Macintosh) SAROS/1.0 (" + os.environ.get("SAROS_CONTACT", "saros@gcarosso.bio") + ")", "Accept": "application/json"}
US = {"Nasdaq", "NYSE", "NYSE American", "NYSE Arca", "CBOE", "OTC"}

def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.loads(r.read())

def yahoo(tk):
    j = get("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=5d&interval=1d" % urllib.request.quote(tk))
    res = j["chart"]["result"][0]; m = res["meta"]
    closes = res.get("indicators", {}).get("quote", [{}])[0].get("close") or []
    ts = res.get("timestamp") or []
    px, d = None, None
    for t, c in reversed(list(zip(ts, closes))):
        if c is not None: px, d = c, datetime.datetime.utcfromtimestamp(t).date().isoformat(); break
    if px is None and m.get("regularMarketPrice"): px, d = m["regularMarketPrice"], datetime.datetime.utcfromtimestamp(m.get("regularMarketTime", time.time())).date().isoformat()
    if px is None: raise ValueError("no close")
    return {"px": round(float(px), 4), "d": d, "src": "yahoo"}

def nasdaq(tk):
    j = get("https://api.nasdaq.com/api/quote/%s/info?assetclass=stocks" % urllib.request.quote(tk))
    p = j["data"]["primaryData"]["lastSalePrice"].replace("$", "").replace(",", "")
    d = j["data"]["primaryData"].get("lastTradeTimestamp", "")
    try: d = datetime.datetime.strptime(d.split(" - ")[0].replace(",", ""), "%b %d %Y").date().isoformat()
    except Exception: d = datetime.date.today().isoformat()
    return {"px": round(float(p), 4), "d": d, "src": "nasdaq"}

def main():
    p = os.path.join(OUT, "matched_ciks.json")
    if not os.path.exists(p): print("no matched_ciks.json yet: run process.py first", file=sys.stderr); return 1
    out_p = os.path.join(OUT, "prices_raw.json"); today = datetime.date.today().isoformat()
    if os.path.exists(out_p):
        old = json.load(open(out_p))
        if old.get("pulled", "")[:10] == today: print("prices already pulled today:", len(old.get("px", {}))); return 0
    tick = {}
    try:
        sec = json.load(open(os.path.join(OUT, "sec_raw.json"))); tick = {t["t"]: t.get("ex", "") for t in sec["tickers"]}
    except Exception: pass
    todo = sorted({m["t"] for m in json.load(open(p)) if m.get("t") and m["t"] != "private" and tick.get(m["t"], "Nasdaq") in US})
    px, fail = {}, []; t0 = time.time()
    for i, tk in enumerate(todo):
        for fn in (yahoo, nasdaq):
            try: px[tk] = fn(tk); break
            except Exception: continue
        else: fail.append(tk)
        time.sleep(0.15)
        if i % 50 == 0: print(f"  {i}/{len(todo)} · {int(time.time()-t0)} s", file=sys.stderr)
    json.dump({"pulled": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "source": "last close: Yahoo chart endpoint, Nasdaq quote API as fallback (unofficial)", "px": px, "failed": fail}, open(out_p, "w"))
    print(f"prices {len(px)} of {len(todo)} tickers · failed {len(fail)}: {fail[:12]}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
