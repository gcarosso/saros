#!/usr/bin/env python3
"""Non-dilutive funding from NIH RePORTER (api.reporter.nih.gov, public domain) for the sponsors that have no equity
linkage — the venture-stage tail of the trial universe — and for the longevity cohort, which is largely pre-IND and
invisible to ClinicalTrials.gov.

    python3 pull_nih.py            # queries every unmatched sponsor with ≤5 trials + the longevity companies; cached per name
    python3 pull_nih.py --refresh  # ignore the cache

Output nih_raw.json: {pulled, orgs: {query name: {n, total, last_fy, first_fy, agencies:[..], top:[{num, fy, amount, title}]}}}
Rate: ~1 request/s (RePORTER asks for ≤1/s on the projects endpoint). ~1,100 names ≈ 20 min on a full run.
SBIR.gov's award API refuses scripted access (403), so SBIR/STTR awards are covered only as far as NIH administers them.
"""
import json, os, re, sys, time, urllib.request, datetime
CONTACT=__import__("os").environ.get("SAROS_CONTACT","saros@gcarosso.bio")  # SEC and NIH ask for a contact address in the User-Agent

OUT = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "SAROS research dashboard "+CONTACT, "Content-Type": "application/json", "Accept": "application/json"}
API = "https://api.reporter.nih.gov/v2/projects/search"
STOP = re.compile(r"\b(inc|corp|corporation|ltd|limited|plc|llc|co|company|holdings?|the|sa|ag|nv|bv|spa|se|kk|group|usa|us|pharmaceuticals?|pharma|therapeutics|biosciences?|bio|biotechnology|biotherapeutics|medicines?|research|development|and)\b")


def log(*a): print(*a, file=sys.stderr, flush=True)


def norm(n):
    n = n.lower().replace("&", "and"); n = re.sub(r"[^a-z0-9 ]", " ", n)
    n = re.sub(r"\b(inc|corp|corporation|ltd|limited|plc|llc|co|company|holdings?|the|sa|ag|nv|bv|spa|se|kk|kabushiki kaisha|group|usa|us)\b", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def query_name(n):
    """RePORTER org_names is a contains-match on the org name; strip corporate suffixes so 'Longeveron, LLC' matches 'Longeveron'."""
    q = re.sub(r"[^A-Za-z0-9 \-]", " ", n)
    q = STOP.sub(" ", q.lower())
    q = re.sub(r"\s+", " ", q).strip()
    return q if len(q) >= 4 else ""


def search(q, tries=3):
    body = json.dumps({"criteria": {"org_names": [q]}, "limit": 50, "offset": 0, "sort_field": "award_amount", "sort_order": "desc",
                       "include_fields": ["ProjectNum", "FiscalYear", "AwardAmount", "Organization", "ProjectTitle", "AgencyIcAdmin", "ActivityCode"]}).encode()
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(API, data=body, headers=UA), timeout=60) as r:
                return json.loads(r.read())
        except Exception as e:
            log("  retry", i, q, e); time.sleep(3 * (i + 1))
    return None


def targets():
    """Venture-tail sponsors (≤5 trials, no SEC issuer of the same name) + the longevity companies.
    Works on a fresh clone: falls back to the raw pulls when snapshot.json has not been built yet."""
    import gzip, csv
    snap_p = os.path.join(OUT, "snapshot.json")
    if os.path.exists(snap_p):
        snap = json.load(open(snap_p))
        sec = set(snap["sec"]); counts = {}
        for t in snap["trials"]: counts[t["sp"]] = counts.get(t["sp"], 0) + 1
        lv = [l["co"] for l in snap.get("longevity", [])]
    else:
        ct = json.load(gzip.open(os.path.join(OUT, "ct_raw.json.gz"), "rt")); counts = {}
        for s in ct["studies"]:
            sp = s["protocolSection"]["sponsorCollaboratorsModule"].get("leadSponsor", {}).get("name", "")
            if sp: counts[sp] = counts.get(sp, 0) + 1
        sec_p = os.path.join(OUT, "sec_raw.json")
        sec = {norm(t["n"]) for t in json.load(open(sec_p))["tickers"]} if os.path.exists(sec_p) else set()
        lv_p = os.path.join(OUT, "..", "longevity_funding_2026-07.csv")
        lv = [r["company"] for r in csv.DictReader(open(lv_p, encoding="utf-8-sig"))] if os.path.exists(lv_p) else []
    names = [sp for sp, c in counts.items() if c <= 5 and norm(sp) not in sec]
    return sorted(set(names)), lv


def main():
    refresh = "--refresh" in sys.argv
    path = os.path.join(OUT, "nih_raw.json")
    old = json.load(open(path)) if os.path.exists(path) and not refresh else {"orgs": {}}
    orgs = old.get("orgs", {})
    sponsors, lv = targets()
    todo = [n for n in sponsors + lv if n not in orgs]
    log(f"{len(sponsors)} venture-tail sponsors + {len(lv)} longevity companies · {len(todo)} to query · {len(orgs)} cached")
    t0 = time.time()
    for i, name in enumerate(todo):
        q = query_name(name)
        if not q: orgs[name] = {"n": 0, "q": q}; continue
        j = search(q)
        if j is None: continue
        res = j.get("results", [])
        # keep only hits whose org name actually contains the query (RePORTER is generous with partial tokens)
        res = [x for x in res if q.split()[0] in (x.get("organization", {}).get("org_name") or "").lower()]
        tot = sum((x.get("award_amount") or 0) for x in res)
        fys = [x.get("fiscal_year") for x in res if x.get("fiscal_year")]
        orgs[name] = {"q": q, "n": len(res), "total": tot, "first_fy": min(fys) if fys else None, "last_fy": max(fys) if fys else None,
                      "org": res[0]["organization"]["org_name"] if res else "",
                      "agencies": sorted({x.get("agency_ic_admin", {}).get("abbreviation", "") for x in res if x.get("agency_ic_admin")})[:6],
                      "top": [{"num": x.get("project_num"), "fy": x.get("fiscal_year"), "amount": x.get("award_amount"), "title": (x.get("project_title") or "")[:140], "act": x.get("activity_code")} for x in res[:5]]}
        if i % 25 == 0:
            log(f"  {i}/{len(todo)} · {int(time.time()-t0)} s · hits so far {sum(1 for v in orgs.values() if v.get('n'))}")
            json.dump({"pulled": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z", "source": "NIH RePORTER v2 projects/search by organisation name", "orgs": orgs}, open(path, "w"))
        time.sleep(1.05)
    json.dump({"pulled": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z", "source": "NIH RePORTER v2 projects/search by organisation name", "orgs": orgs}, open(path, "w"))
    hits = {k: v for k, v in orgs.items() if v.get("n")}
    print(f"wrote nih_raw.json · {len(orgs)} organisations queried · {len(hits)} with NIH awards · ${sum(v['total'] for v in hits.values())/1e6:.0f}M across their listed projects")


if __name__ == "__main__":
    main()
