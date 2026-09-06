#!/usr/bin/env python3
"""Regulatory calendar (PDUFA / AdCom / resubmission dates) from primary sources: SEC EDGAR full-text search
over 8-K, 6-K, 10-Q and 10-K filings and their press-release exhibits. Every row cites the filing it came from.

    python3 pull_pdufa.py                 # full run: trailing 24 months → pdufa_edgar.json (≈15–30 min, ~1,100 filings)
    python3 pull_pdufa.py --incremental   # trailing 21 days merged into the existing file (what `make refresh` runs)
    python3 pull_pdufa.py --score         # also score against data/pdufa.json if that private file is present

Row shape (pdufa_edgar.json → {pulled, source, window, rows[]}):
  kind        pdufa | adcom | resubmission        classified per date mention, not per filing
  date        ISO date; quarter/month-precision rows carry the period's last day
  precision   day | month | quarter
  priority    priority-review language near the mention
  confidence  firm  = day precision and filed within 180 days · guided = otherwise
  ticker/cik/company  from the filer's CIK via the SEC ticker file (sec_raw.json), regex fallback
  asset       best-effort drug name from the sentence ('' when unclear)
  filed/form/source   the filing; sentence = the text the date came from
  history     earlier statements by the same filer for the same kind/asset that this row supersedes ([{date, filed, source}])

EDGAR full-text search is free and needs only a declared User-Agent. Be polite: ≤ 8 req/s.
"""
import json, os, re, sys, time, urllib.request, urllib.parse, datetime, html, gzip, argparse
CONTACT=__import__("os").environ.get("SAROS_CONTACT","saros@gcarosso.bio")  # SEC and NIH ask for a contact address in the User-Agent

OUT = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "SAROS research dashboard "+CONTACT, "Accept-Encoding": "gzip, deflate"}
FTS = "https://efts.sec.gov/LATEST/search-index"
QUERIES = ['"PDUFA target action date"', '"PDUFA action date"', '"PDUFA date"', '"target action date"',
           '"Prescription Drug User Fee Act"', '"advisory committee meeting"', '"goal date"']
FORMS = ["8-K", "6-K", "10-Q", "10-K"]
MAX_DOC = 12_000_000          # bytes; 10-Ks are big
PAGE_CAP = 1000               # EDGAR FTS pages at 10 hits; we split the window into quarters to stay under it

MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
MON_N = {m.lower(): i + 1 for i, m in enumerate(MONTHS.split("|"))}
DATE_RX = re.compile(r"\b(%s)\s+(\d{1,2}),?\s+(20\d{2})\b" % MONTHS, re.I)
MONTH_RX = re.compile(r"\b(?:in|by|during|of)\s+(%s)\s+(20\d{2})\b" % MONTHS, re.I)
QTR_RX = re.compile(r"\b(first|second|third|fourth|1Q|2Q|3Q|4Q|Q[1-4])\s*(?:quarter\s*(?:of\s*)?)?(?:of\s+)?(20\d{2})\b", re.I)
HALF_RX = re.compile(r"\b(first|second|1H|2H|H[12])\s*(?:half\s*(?:of\s*)?)?(?:of\s+)?(20\d{2})\b", re.I)
PDUFA_RX = re.compile(r"PDUFA|target action date|Prescription Drug User Fee Act|goal date|action date", re.I)
ADCOM_RX = re.compile(r"advisory committee", re.I)
RESUB_RX = re.compile(r"resubmi", re.I)
CRL_RX = re.compile(r"complete response letter|\bCRL\b", re.I)
PRIO_RX = re.compile(r"priority review", re.I)
DRUG_RX = re.compile(r"\b([A-Z][a-z]+(?:mab|nib|tide|ciclib|rasib|lisib|stat|parib|zumab|ximab|tinib|gene|cel|vec|siran|rsen|lutide|glutide|pressin|fovir|navir|previr|buvir|asvir|mycin|cillin|oxacin|azole|tecan|dotin|vedotin)|[A-Z]{2,6}-?\d{2,5}[A-Z]?|[A-Z][A-Za-z]{3,}\s?\((?:[a-z]+-?)+\))\b")
APP_RX = re.compile(r"\b(?:s?NDA|s?BLA|MAA|application|submission)\s+(?:for|of)\s+((?:[A-Za-z0-9®\-]+\s?){1,4})", re.I)
FORM_OK = {"8-K", "6-K", "10-Q", "10-K", "8-K/A", "6-K/A", "10-Q/A", "10-K/A"}


def log(*a): print(*a, file=sys.stderr, flush=True)


def get(url, tries=3, as_json=True):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                b = r.read(MAX_DOC)
                if r.headers.get("Content-Encoding") == "gzip":
                    try: b = gzip.decompress(b)
                    except Exception: pass
                return json.loads(b.decode()) if as_json else b.decode("utf-8", "replace")
        except Exception as e:
            if i == tries - 1:
                log("  fail", url[:90], e); return None
            time.sleep(1.5 * (i + 1))


def search(q, form, start, end, frm=0):
    url = f"{FTS}?q={urllib.parse.quote(q)}&forms={form}&dateRange=custom&startdt={start}&enddt={end}&from={frm}"
    return get(url)


def quarters(start, end):
    """Split [start, end] into ≤ 92-day slices so no single query exceeds the FTS page cap."""
    out, a = [], start
    while a <= end:
        b = min(end, a + datetime.timedelta(days=91)); out.append((a, b)); a = b + datetime.timedelta(days=1)
    return out


def collect_hits(start, end):
    seen, hits = set(), []
    for form in FORMS:
        for q in QUERIES:
            for a, b in quarters(start, end):
                frm = 0
                while frm < PAGE_CAP:
                    j = search(q, form, a.isoformat(), b.isoformat(), frm)
                    hh = (j or {}).get("hits", {}).get("hits", [])
                    if not hh: break
                    for h in hh:
                        if h["_id"] not in seen: seen.add(h["_id"]); hits.append(h)
                    tot = j["hits"]["total"]["value"]; frm += len(hh)
                    if frm >= tot: break
                    time.sleep(0.13)
            log(f"  {form} {q}: {len(hits)} unique filings so far")
    return hits


def doc_url(hit):
    acc, fn = hit["_id"].split(":", 1)
    cik = re.search(r"CIK (\d+)", hit["_source"]["display_names"][0]).group(1)
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/{fn}", int(cik)


def text_of(url):
    raw = get(url, as_json=False)
    if not raw: return ""
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t))


def last_day(y, m):
    return [31, 29 if y % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]


SENT_RX = re.compile(r"(?<=[.!?;])\s+(?=[A-Z(“\"])")
STOP_RX = re.compile(r"\s+(in|for|to|as|with|under|and|or|that|which|is|was|has|have|had|of|on|at|by|from)\b.*$", re.I)


def classify(sent):
    """Kind for one date mention from its own sentence; None when it is not a regulatory date."""
    if CRL_RX.search(sent) and not PDUFA_RX.search(sent) and not RESUB_RX.search(sent): return None
    if ADCOM_RX.search(sent) and not PDUFA_RX.search(sent): return "adcom"
    if PDUFA_RX.search(sent): return "pdufa"
    if RESUB_RX.search(sent): return "resubmission"
    return None


def asset_of(sent):
    m = APP_RX.search(sent)
    if m:
        a = STOP_RX.sub("", m.group(1).strip()).strip(" ,.;")
        if len(a) > 2 and not re.match(r"^(the|its|our|a|an|treatment|patients|this|that)\b", a, re.I): return a[:60]
    m = re.search(r"\b(?:for|of)\s+([A-Z][A-Za-z0-9®\-]{2,}(?:\s\([a-z][a-z\-]+\))?)", sent)
    if m and not re.match(r"^(%s|The|FDA|NDA|BLA|PDUFA|Priority|Prescription|Advisory|Committee|Company|Phase|Fast|Breakthrough|Orphan|Drug|User|Fee|Act|Q[1-4]|First|Second|Third|Fourth|Health|Human|Services|Food|Administration|Standard|Review)$" % MONTHS, m.group(1)): return m.group(1)[:60]
    for m in DRUG_RX.finditer(sent):
        if not re.match(r"^(EX|ITEM|FORM|NASDAQ|NYSE|CIK|SEC|FDA|CFR|USC)-?\d*$", m.group(1), re.I): return m.group(1)[:60]
    return ""


def extract(text):
    """Every future regulatory date mentioned in a document: one candidate per date mention, classified from its own sentence."""
    out = []
    for sent in SENT_RX.split(text):
        if len(sent) > 1200 or not re.search(r"20\d{2}", sent): continue
        kind = classify(sent)
        if not kind: continue
        s = sent.strip()[:420]; pr = bool(PRIO_RX.search(sent)); asset = asset_of(sent)
        found = False
        for d in DATE_RX.finditer(sent):
            try: dt = datetime.date(int(d.group(3)), MON_N[d.group(1).lower()], int(d.group(2)))
            except ValueError: continue
            out.append({"kind": kind, "date": dt.isoformat(), "precision": "day", "priority": pr, "asset": asset, "sentence": s}); found = True
        if found: continue
        for q in QTR_RX.finditer(sent):
            qn = {"first": 1, "1q": 1, "q1": 1, "second": 2, "2q": 2, "q2": 2, "third": 3, "3q": 3, "q3": 3, "fourth": 4, "4q": 4, "q4": 4}[q.group(1).lower()]
            y = int(q.group(2)); out.append({"kind": kind, "date": f"{y}-{qn*3:02d}-{last_day(y, qn*3)}", "precision": "quarter", "priority": pr, "asset": asset, "sentence": s}); found = True
        if found: continue
        for hm in HALF_RX.finditer(sent):
            hn = 1 if hm.group(1).lower() in ("first", "1h", "h1") else 2
            y = int(hm.group(2)); out.append({"kind": kind, "date": f"{y}-{hn*6:02d}-{last_day(y, hn*6)}", "precision": "quarter", "priority": pr, "asset": asset, "sentence": s}); found = True
        if found: continue
        for mm in MONTH_RX.finditer(sent):
            y = int(mm.group(2)); mo = MON_N[mm.group(1).lower()]
            out.append({"kind": kind, "date": f"{y}-{mo:02d}-{last_day(y, mo)}", "precision": "month", "priority": pr, "asset": asset, "sentence": s})
    return out


def load_tickers():
    p = os.path.join(OUT, "sec_raw.json")
    if not os.path.exists(p): return {}
    j = json.load(open(p)); m = {}
    for t in j["tickers"]:
        if t["cik"] not in m or t["ex"] in ("Nasdaq", "NYSE"): m[t["cik"]] = t
    return m


def supersede(rows):
    """Within a filer + kind (+ asset when both sides name one), the latest filing wins; older statements of a
    different date become that row's history, so a moved date keeps its trail."""
    groups = {}
    for r in rows:
        groups.setdefault((r["cik"], r["kind"], (r.get("asset") or "").lower()[:12]), []).append(r)
    out = []
    for g in groups.values():
        g.sort(key=lambda r: (r["filed"], r["precision"] == "day"))
        latest = g[-1]
        # the same filing may state the date several times; a *later* filing with a different date supersedes
        hist, seen = [], set()
        for r in g[:-1]:
            if r["date"] != latest["date"] and (r["date"], r["filed"]) not in seen:
                seen.add((r["date"], r["filed"])); hist.append({"date": r["date"], "precision": r["precision"], "filed": r["filed"], "source": r["source"]})
        latest = dict(latest); latest["history"] = hist
        # keep any *other* distinct future date from the latest filing too (two assets, one filer, no name caught)
        out.append(latest)
        for r in g[:-1]:
            if r["filed"] == latest["filed"] and r["date"] != latest["date"] and r["precision"] == "day":
                rr = dict(r); rr["history"] = []; out.append(rr)
    return out


def finalize(rows, today):
    """Recompute assets from the kept sentence, collapse duplicate (filer, kind, date) rows, set confidence, sort."""
    for r in rows:
        r["sentences"] = [x for x in dict.fromkeys((r.get("sentences") or []) + ([r["sentence"]] if r.get("sentence") else [])) if x][:4]
    merged = {}
    for r in rows:
        k = (r.get("cik") or r.get("ticker"), r["kind"], r["date"])
        if k not in merged: merged[k] = r; continue
        m = merged[k]
        keep, drop = (r, m) if r.get("filed", "") > m.get("filed", "") else (m, r)
        keep["sentences"] = [x for x in dict.fromkeys(keep["sentences"] + drop["sentences"])][:4]
        keep["history"] = (keep.get("history") or []) + [h for h in (drop.get("history") or []) if h not in (keep.get("history") or [])]
        merged[k] = keep
    rows = list(merged.values())
    for r in rows:   # the asset is whichever of the kept sentences names one
        r["asset"] = next((a for a in (asset_of(x) for x in r["sentences"]) if a), "")
        r["sentence"] = next((x for x in r["sentences"] if asset_of(x)), r["sentences"][0] if r["sentences"] else "")
    for r in rows:
        age = (today - datetime.date.fromisoformat(r["filed"])).days if r.get("filed") else 999
        r["confidence"] = "firm" if (r["precision"] == "day" and age <= 180) else "guided"
        r["history"] = sorted({(h["date"], h.get("filed", "")): h for h in (r.get("history") or [])}.values(), key=lambda h: h.get("filed", ""))
    rows = [r for r in rows if r["date"] >= today.isoformat()]
    rows.sort(key=lambda r: (r["date"], r["ticker"] or ""))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--incremental", action="store_true"); ap.add_argument("--score", action="store_true"); ap.add_argument("--days", type=int)
    ap.add_argument("--refinalize", action="store_true", help="re-run asset extraction, dedupe and confidence on the existing file, no network")
    ap.add_argument("--truth", help="path to a private ground-truth pdufa list for --score (default data/pdufa.json)")
    a = ap.parse_args()
    today = datetime.date.today()
    if a.refinalize:
        p = os.path.join(OUT, "pdufa_edgar.json"); j = json.load(open(p)); j["rows"] = finalize(j["rows"], today)
        json.dump(j, open(p, "w"), indent=1); print(f"refinalized · {len(j['rows'])} rows"); return
    days = a.days or (21 if a.incremental else 730)
    start = today - datetime.timedelta(days=days)
    path = os.path.join(OUT, "pdufa_edgar.json")
    old = json.load(open(path)) if a.incremental and os.path.exists(path) else None
    tick = load_tickers()
    hits = collect_hits(start, today)
    log(f"{len(hits)} unique filings, {start} → {today}")
    rows, t0 = [], time.time()
    for i, h in enumerate(hits):
        s = h["_source"]; form = (s.get("root_form") or s.get("form") or "").upper()
        url, cik = doc_url(h)
        name = s["display_names"][0]; tkm = re.search(r"\(([A-Z.\-]{1,6})\)", name)
        t = tick.get(cik)
        ticker = (t["t"] if t else (tkm.group(1) if tkm else None))
        company = (t["n"] if t else re.sub(r"\s*\(.*", "", name).strip()).title() if t else re.sub(r"\s*\(.*", "", name).strip()
        cands = [c for c in extract(text_of(url)) if c["date"] >= today.isoformat()]
        filed = s.get("file_date", "")
        for c in cands:
            rows.append({**c, "ticker": ticker, "cik": cik, "company": company, "filed": filed, "form": form or None, "source": url})
        if i % 25 == 0: log(f"  parsed {i}/{len(hits)} · {len(rows)} future mentions · {int(time.time()-t0)} s")
        time.sleep(0.12)
    if old:
        keep = [r for r in old["rows"] if r.get("cik") not in {r2["cik"] for r2 in rows}]
        for r in old["rows"]:
            if r.get("cik") in {r2["cik"] for r2 in rows}: rows.append(r)   # re-supersede against the fresh filings
        rows += keep
    rows = finalize(supersede(rows), today)
    json.dump({"pulled": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
               "source": "SEC EDGAR full-text search over 8-K / 6-K / 10-Q / 10-K and exhibits — company-disclosed dates, one filing cited per row",
               "window": [start.isoformat(), today.isoformat()], "rows": rows}, open(path, "w"), indent=1)
    kinds = {k: sum(1 for r in rows if r["kind"] == k) for k in ("pdufa", "adcom", "resubmission")}
    print(f"wrote pdufa_edgar.json · {len(rows)} dated events {kinds} · {sum(1 for r in rows if r['precision']=='day')} day-precision · {sum(1 for r in rows if r['history'])} with history")
    if a.score and os.path.exists(a.truth or os.path.join(OUT, "pdufa.json")):
        truth = json.load(open(a.truth or os.path.join(OUT, "pdufa.json")))["rows"]
        tset = {(t["tk"], (t.get("pdufa") or t.get("prio") or "")[:10]) for t in truth if t.get("tk")}
        mine = {(r["ticker"], r["date"]) for r in rows}
        tk_t, tk_m = {t for t, _ in tset}, {t for t, _ in mine}
        print(f"vs private ground truth ({len(tset)} dates, {len(tk_t)} tickers): tickers found {len(tk_t & tk_m)}/{len(tk_t)} · exact dates {len(tset & mine)}/{len(tset)} · missed {sorted(tk_t - tk_m)}")


if __name__ == "__main__":
    main()
