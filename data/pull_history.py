#!/usr/bin/env python3
"""ClinicalTrials.gov version history for every trial whose record changed since the previous snapshot → history_raw.json.

Why (Phase 2, 2026-09-10): the weekly diff says a field moved; the registry's own version list says which modules the
sponsor edited and when, so a wording edit in the outcome module can be told apart from a date or status change, and
the dossier can show "3 registry versions since the last snapshot" with their dates.

Input : data/snapshot.json (current rows) and data/prev_snapshot.json.gz (baseline), diffed with diff.py; plus any
        NCT ids listed in data/history_extra.json (optional, for trials worth watching regardless).
Output: data/history_raw.json {pulled, since, hist: {nct: [{v, d, st, mods}, ...]}} — versions dated after the baseline
        pull, newest last, at most 8 per trial. Cached per NCT + lastUpdate in data/history_cache/ (gitignored).
Endpoint: https://clinicaltrials.gov/api/int/studies/{nct}/history (the registry's internal API; no key, ≤ 5 req/s here).
"""
import gzip, json, os, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import diff as snapdiff

OUT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(OUT, "history_cache"); os.makedirs(CACHE, exist_ok=True)
UA = "SAROS clinical-trial readout calendar (" + os.environ.get("SAROS_CONTACT", "saros@gcarosso.bio") + ")"

def fetch(nct, lu):
    p = os.path.join(CACHE, f"{nct}_{lu}.json")
    if os.path.exists(p): return json.load(open(p))
    req = urllib.request.Request(f"https://clinicaltrials.gov/api/int/studies/{nct}/history", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: raw = r.read()
        open(p, "wb").write(raw); time.sleep(0.2); return json.loads(raw)
    except Exception as e:
        print("history failed", nct, e, file=sys.stderr); return None

def versions_since(j, since):
    out = []
    for c in j.get("changes", []):
        if c.get("date", "") >= since:
            out.append({"v": c.get("version"), "d": c.get("date"), "st": c.get("status"), "mods": c.get("moduleLabels") or []})
    return out[-8:]

def main():
    cur_p = os.path.join(OUT, "snapshot.json"); prev_p = os.path.join(OUT, "prev_snapshot.json.gz")
    if not (os.path.exists(cur_p) and os.path.exists(prev_p)): print("need snapshot.json and prev_snapshot.json.gz", file=sys.stderr); return 1
    cur = json.load(open(cur_p)); prev = json.load(gzip.open(prev_p, "rt"))
    changes, summ = snapdiff.diff_trials(prev["trials"], cur["trials"])
    since = (prev["meta"].get("pulled") or "")[:10]
    ids = set(changes) | set(summ.get("new", []))
    xp = os.path.join(OUT, "history_extra.json")
    if os.path.exists(xp): ids |= set(json.load(open(xp)))
    lu = {t["id"]: t.get("lu", "") for t in cur["trials"]}
    hist = {}; t0 = time.time()
    for i, nct in enumerate(sorted(ids)):
        j = fetch(nct, lu.get(nct, ""))
        if j: hist[nct] = versions_since(j, since)
        if i % 25 == 0: print(f"  {i}/{len(ids)} · {int(time.time()-t0)} s", file=sys.stderr)
    json.dump({"pulled": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "since": since, "source": "ClinicalTrials.gov version history (api/int/studies/{nct}/history)", "hist": hist}, open(os.path.join(OUT, "history_raw.json"), "w"))
    print(f"history {len(hist)} trials with versions since {since} · {sum(len(v) for v in hist.values())} versions")
    return 0

if __name__ == "__main__":
    sys.exit(main())
