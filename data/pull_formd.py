#!/usr/bin/env python3
"""SEC Form D (Regulation D private placements) → funding history for private biotech / pharma issuers.

Source: the SEC's quarterly Form D structured data sets (public domain; TSV inside a zip per quarter),
https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets. Quarters are cached in formd_cache/ and only
missing quarters are downloaded, so the weekly run is one small download.

    python3 pull_formd.py              # 2019Q1 → current quarter
    python3 pull_formd.py --since 2023

Output formd_raw.json: {pulled, quarters:[..], issuers: {cik: {cik, name, prev:[..], state, country, inc, entity,
  filings:[{acc, filed, sale, amend, offering, sold, remaining, investors, equity, debt, exemptions, related:[[name, role], ..]}]}}}
Only issuers whose offering industry group is Biotechnology or Pharmaceuticals are kept (plus Other Health Care when the
issuer name looks biotech). Amounts are as filed; "Indefinite" offerings carry offering=None.
"""
import json, os, sys, csv, io, zipfile, time, datetime, urllib.request, re, argparse
CONTACT=__import__("os").environ.get("SAROS_CONTACT","saros@gcarosso.bio")  # SEC and NIH ask for a contact address in the User-Agent

OUT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(OUT, "formd_cache")
UA = {"User-Agent": "SAROS research dashboard "+CONTACT}
URLS = ["https://www.sec.gov/files/structureddata/data/form-d-data-sets/{q}_d.zip",
        "https://www.sec.gov/files/datastandardsinnovation/data/form-d-data-sets/{q}_d.zip",
        "https://www.sec.gov/files/dera/data/form-d-data-sets/{q}_d.zip"]
BIO_RX = re.compile(r"bio|pharm|therap|genom|oncolog|medic|immun|vaccin|cell|gene|rna|antibod|neuro|diagnos", re.I)


def log(*a): print(*a, file=sys.stderr, flush=True)


def quarters(since):
    today = datetime.date.today(); out = []
    y, q = since, 1
    while (y, q) <= (today.year, (today.month - 1) // 3 + 1):
        out.append(f"{y}q{q}"); q += 1
        if q == 5: q = 1; y += 1
    return out


def fetch(q):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, q + ".zip")
    if os.path.exists(p) and os.path.getsize(p) > 100000: return p
    for u in URLS:
        try:
            with urllib.request.urlopen(urllib.request.Request(u.format(q=q), headers=UA), timeout=120) as r:
                b = r.read()
            if b[:2] == b"PK":
                open(p, "wb").write(b); time.sleep(0.3); return p
        except Exception as e:
            pass
    log("  no dataset for", q); return None


def read_tsv(z, name):
    n = next((x for x in z.namelist() if x.upper().endswith("/" + name) or x.upper() == name), None)
    if not n: return []
    return list(csv.DictReader(io.TextIOWrapper(z.open(n), encoding="utf-8", errors="replace"), delimiter="\t"))


MONS={m:i+1 for i,m in enumerate("JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split())}
def iso(v):
    """Dates arrive as YYYY-MM-DD in recent quarters and DD-MON-YYYY in older ones."""
    v=(v or "").strip()
    m=re.match(r"^(\d{2})-([A-Z]{3})-(\d{4})",v.upper())
    if m and m.group(2) in MONS: return f"{m.group(3)}-{MONS[m.group(2)]:02d}-{m.group(1)}"
    return v[:10]


def num(v):
    try: return float(v) if v not in ("", None, "Indefinite") else None
    except ValueError: return None


def parse(path, issuers):
    z = zipfile.ZipFile(path)
    sub = {r["ACCESSIONNUMBER"]: r for r in read_tsv(z, "FORMDSUBMISSION.TSV")}
    off = {r["ACCESSIONNUMBER"]: r for r in read_tsv(z, "OFFERING.TSV")}
    rel = {}
    for r in read_tsv(z, "RELATEDPERSONS.TSV"):
        nm = " ".join(x for x in (r.get("FIRSTNAME"), r.get("MIDDLENAME"), r.get("LASTNAME")) if x).strip()
        roles = [r.get(k) for k in ("RELATIONSHIP_1", "RELATIONSHIP_2", "RELATIONSHIP_3") if r.get(k)]
        rel.setdefault(r["ACCESSIONNUMBER"], []).append([nm.title(), "/".join(x.replace("Executive Officer", "Officer") for x in roles)])
    n = 0
    for r in read_tsv(z, "ISSUERS.TSV"):
        if (r.get("IS_PRIMARYISSUER_FLAG") or "YES").upper() not in ("YES", "TRUE", "1", "Y"): continue
        acc = r["ACCESSIONNUMBER"]; o = off.get(acc); s = sub.get(acc)
        if not o: continue
        ig = o.get("INDUSTRYGROUPTYPE", "")
        if ig not in ("Biotechnology", "Pharmaceuticals") and not (ig == "Other Health Care" and BIO_RX.search(r.get("ENTITYNAME", ""))): continue
        cik = str(int(r["CIK"])) if r.get("CIK", "").strip().isdigit() else r.get("CIK", "")
        e = issuers.setdefault(cik, {"cik": cik, "name": r.get("ENTITYNAME", ""), "prev": [], "state": r.get("STATEORCOUNTRY", ""), "country": r.get("STATEORCOUNTRYDESCRIPTION", ""),
                                     "inc": r.get("YEAROFINC_VALUE_ENTERED", "") or r.get("YEAROFINC_TIMESPAN_CHOICE", ""), "entity": r.get("ENTITYTYPE", ""), "industry": ig, "filings": []})
        e["name"] = r.get("ENTITYNAME", "") or e["name"]
        for k in ("ISSUER_PREVIOUSNAME_1", "ISSUER_PREVIOUSNAME_2", "ISSUER_PREVIOUSNAME_3", "EDGAR_PREVIOUSNAME_1", "EDGAR_PREVIOUSNAME_2", "EDGAR_PREVIOUSNAME_3"):
            v = (r.get(k) or "").strip()
            if v and v.upper() != "NONE" and v not in e["prev"]: e["prev"].append(v)
        e["filings"].append({"acc": acc, "filed": iso((s or {}).get("FILING_DATE")), "sale": iso(o.get("SALE_DATE")), "amend": o.get("ISAMENDMENT") == "true",
                             "offering": num(o.get("TOTALOFFERINGAMOUNT")), "sold": num(o.get("TOTALAMOUNTSOLD")), "remaining": num(o.get("TOTALREMAINING")),
                             "investors": int(o["TOTALNUMBERALREADYINVESTED"]) if (o.get("TOTALNUMBERALREADYINVESTED") or "").isdigit() else None,
                             "equity": o.get("ISEQUITYTYPE") == "true", "debt": o.get("ISDEBTTYPE") == "true", "exemptions": o.get("FEDERALEXEMPTIONS_ITEMS_LIST", ""),
                             "related": rel.get(acc, [])[:12]})
        n += 1
    return n


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--since", type=int, default=2019); a = ap.parse_args()
    issuers, done = {}, []
    for q in quarters(a.since):
        p = fetch(q)
        if not p: continue
        try: n = parse(p, issuers)
        except zipfile.BadZipFile: log("  bad zip", q); continue
        done.append(q); log(f"  {q}: +{n} bio/pharma filings · {len(issuers)} issuers")
    # order filings, dedupe amendments to the latest statement per (issuer, sale date)
    for e in issuers.values():
        e["filings"].sort(key=lambda f: (f["filed"], f["amend"]))
        latest = {}
        for f in e["filings"]: latest[f["sale"] or f["filed"]] = f
        e["filings"] = sorted(latest.values(), key=lambda f: f["filed"])
        e["n"] = len(e["filings"]); e["sold"] = sum(f["sold"] or 0 for f in e["filings"])
        e["last"] = e["filings"][-1]["filed"] if e["filings"] else ""
    json.dump({"pulled": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z", "source": "SEC Form D structured data sets (quarterly TSV), industry group Biotechnology / Pharmaceuticals",
               "quarters": done, "issuers": issuers}, open(os.path.join(OUT, "formd_raw.json"), "w"))
    print(f"wrote formd_raw.json · {len(done)} quarters · {len(issuers)} issuers · {sum(e['n'] for e in issuers.values())} filings · ${sum(e['sold'] for e in issuers.values())/1e9:.1f}B sold")


if __name__ == "__main__":
    main()
