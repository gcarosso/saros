"""Regulatory-calendar extractor (data/pull_pdufa.py) and a headless-Chrome render check of the build. Run: make test"""
import sys, os, re, json, html, subprocess, shutil, base64, gzip, importlib
import pytest
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, ".."); sys.path.insert(0, os.path.join(ROOT, "data"))
pp = importlib.import_module("pull_pdufa")

TXT = ("NDA for zidesamtinib in TKI pre-treated advanced ROS1-positive NSCLC under FDA review with PDUFA target action date of September 18, 2026 and priority review. "
       "The FDA has scheduled an advisory committee meeting for November 5, 2026 to discuss the BLA for Xolremdi (mavorixafor). "
       "We expect to resubmit the NDA in the first quarter of 2027. A CRL was received on April 28, 2025. The PDUFA goal date is in 4Q 2026 for UX111. The Company expects data in 2027.")

def test_extract_classifies_per_sentence():
    c = pp.extract(TXT)
    kinds = [(x["kind"], x["date"], x["precision"]) for x in c]
    assert ("pdufa", "2026-09-18", "day") in kinds and ("adcom", "2026-11-05", "day") in kinds
    assert ("resubmission", "2027-03-31", "quarter") in kinds and ("pdufa", "2026-12-31", "quarter") in kinds
    assert not any(x["date"] == "2025-04-28" for x in c), "a CRL date is not a regulatory calendar entry"
    assert not any(x["date"].startswith("2027-12") for x in c), "a bare year is not a date"
    first = next(x for x in c if x["date"] == "2026-09-18"); assert first["priority"] and first["asset"].startswith("zidesamtinib")
    assert next(x for x in c if x["kind"] == "adcom")["asset"].startswith("Xolremdi")

def test_supersede_keeps_history():
    rows = [dict(kind="pdufa", date="2026-06-30", precision="day", filed="2026-01-10", source="a", cik=1, asset="X"),
            dict(kind="pdufa", date="2026-09-30", precision="day", filed="2026-05-01", source="b", cik=1, asset="X")]
    out = pp.supersede(rows); assert len(out) == 1 and out[0]["date"] == "2026-09-30" and out[0]["history"][0]["date"] == "2026-06-30"

def test_snapshot_has_regulatory_block():
    p = os.path.join(ROOT, "data", "snapshot.json")
    if not os.path.exists(p): return
    s = json.load(open(p)); assert "reg" in s and "bpc" not in s
    if s["reg"]["rows"]: assert {"kind", "date", "precision", "confidence", "ticker", "source"} <= set(s["reg"]["rows"][0])

def test_no_bpc_references_in_sources():
    for f in ("src/app1.js", "src/app2.js", "src/body.html", "src/pages/about.html", "src/pages/glossary.txt", "data/process.py", "Makefile"):
        t = open(os.path.join(ROOT, f), encoding="utf-8").read().lower()
        assert "biopharmcatalyst" not in t and "bpc" not in t, f

CHROME = next((p for p in ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", shutil.which("chromium"), shutil.which("google-chrome")) if p and os.path.exists(p)), None)

@pytest.mark.skipif(not os.path.exists(os.path.join(ROOT, "saros.html")) or not CHROME, reason="needs built saros.html and a local Chrome")
def test_rendered_status_bar_matches_snapshot():
    p = os.path.join(ROOT, "saros.html"); src = open(p, encoding="utf-8").read()
    n = json.loads(gzip.decompress(base64.b64decode(re.search(r'PAYLOAD_B64="([^"]+)"', src).group(1))))["meta"]["n_trials"]
    dom = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=30000", "--dump-dom", "file://" + os.path.abspath(p)], capture_output=True, text=True, timeout=180).stdout
    assert len(dom) > 1_000_000, "empty DOM dump"
    idx = re.search(r'id="st-idx"[^>]*>(.*?)</', dom, re.S)
    assert idx and f"{n:,}" in html.unescape(re.sub(r"<[^>]+>", "", idx.group(1))), "status bar trial count != snapshot n_trials"
    assert re.search(r'id="loading"[^>]*display:\s*none', dom), "loader still visible — app did not finish rendering"
    for k in ("book", "catalysts", "landscape", "private"):
        assert re.search(r'<button data-p="%s"' % k, dom), "preset missing: " + k
