"""Sanity tests for the parts most likely to drift silently. Run: make test"""
import sys, os, json, re, importlib
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "..", "data"))
moa = importlib.import_module("moa_lexicon")

def test_lexicon_compiles_and_tags_known_assets():
    tags, note = moa.tag("A First-in-human Study of EPI-321 in Facioscapulohumeral Muscular Dystrophy", "EPI-321")
    assert "DUX4 (FSHD)" in tags and "Gene / epigenetic editing" in tags and note.startswith("EPI-321")
    tags, note = moa.tag("Retatrutide in obesity", "retatrutide")
    assert "GLP-1/GIP/glucagon triagonist" in tags

def test_lexicon_does_not_overfire_on_generic_text():
    tags, note = moa.tag("A study of a tablet in healthy volunteers", "Placebo")
    assert tags == [] and note == ""

def test_snapshot_shape_if_present():
    p = os.path.join(HERE, "..", "data", "snapshot.json")
    if not os.path.exists(p): return
    s = json.load(open(p))
    t = s["trials"][0]
    for k in ("id","t","sp","ph","st","pcd","ta","mo","moa","mn","ivd","f13"):
        assert k in t, k
    assert s["meta"]["n_trials"] == len(s["trials"]) > 8000
    assert all(re.match(r"NCT\d{8}", x["id"]) for x in s["trials"][:100])

def test_build_sources_parse():
    import subprocess
    for f in ("src/app1.js", "src/app2.js"):
        subprocess.run(["node", "-e", f"new Function(require('fs').readFileSync('{f}','utf8'))"], check=True, cwd=os.path.join(HERE, ".."))

def _rx(name):
    src = open(os.path.join(HERE, "..", "data", "process.py"), encoding="utf-8").read()
    m = re.search(name + r'=re\.compile\(r"(.*?)",re\.I\)', src); assert m, name
    return re.compile(m.group(1), re.I)

ROOT = os.path.join(HERE, "..")

def _ta():
    src = open(os.path.join(ROOT, "data", "process.py"), encoding="utf-8").read()
    body = src[src.index("TA=["):src.index("\nMOD=[")]
    ns = {}; exec(body, ns); return ns["TA"]

def _classify(text):
    for name, rx in _ta():
        if re.search(rx, text.lower()): return name
    return "Other"

def test_therapy_area_first_match_order():
    assert _classify("Tenapanor in Pediatric Patients With Irritable Bowel Syndrome With Constipation (IBS-C)") == "Gastroenterology & Hepatology"
    assert _classify("Alcohol-associated Hepatitis") == "Gastroenterology & Hepatology", "non-viral hepatitis is not infectious disease"
    assert _classify("Autoimmune Hepatitis") == "Immunology & Inflammation"
    assert _classify("Chronic Hepatitis B") == "Infectious Disease & Vaccines"
    assert _classify("Duchenne Muscular Dystrophy") == "Neuroscience"
    assert _classify("Prader-Willi Syndrome") == "Rare & Genetic Disease"
    assert _classify("Cystic Fibrosis") == "Rare & Genetic Disease"
    assert _classify("Metabolic Syndrome and Obesity") == "Cardiometabolic"

def test_companyfacts_extract_finds_edgewise_style_investments():
    sys.path.insert(0, os.path.join(ROOT, "data")); pf = importlib.import_module("pull_facts")
    def inst(v, end="2026-06-30", filed="2026-08-06"): return {"val": v, "end": end, "filed": filed, "form": "10-Q", "fp": "Q2", "fy": 2026}
    j = {"entityName": "X", "facts": {"us-gaap": {
        "CashAndCashEquivalentsAtCarryingValue": {"units": {"USD": [inst(72.3e6), inst(90e6, "2026-03-31", "2026-05-07")]}},
        "MarketableSecurities": {"units": {"USD": [inst(388.4e6)]}},
        "NetCashProvidedByUsedInOperatingActivities": {"units": {"USD": [
            {"val": -85e6, "start": "2026-01-01", "end": "2026-06-30", "filed": "2026-08-06", "form": "10-Q", "fp": "Q2"},
            {"val": -143.8e6, "start": "2025-01-01", "end": "2025-12-31", "filed": "2026-02-26", "form": "10-K", "fp": "FY"}]}},
        "LongTermDebt": {"units": {"USD": [inst(0.1e6, "2022-09-30", "2022-11-01")]}},
    }, "dei": {}}}
    f = pf.extract(j)
    assert f["cash"] == 72.3e6 and f["cash_per"] == "2026-06-30"
    assert f["inv"] == 388.4e6 and f["inv_tags"] == "MarketableSecurities", "the frames loader missed this tag; companyfacts must not"
    assert f["ocf_months"] == 6 and abs(f["ocf_run"] - (-170e6)) < 1 and f["ocf_fy"] == -143.8e6
    assert f["debt"] is None, "a 2022 debt figure is not the current balance sheet"

def test_submissions_compact_keeps_the_right_forms():
    import datetime
    ps = importlib.import_module("pull_submissions")
    today = datetime.date(2026, 9, 10)
    rec = {"form": ["8-K", "424B5", "SC 13G/A", "10-Q", "4", "S-3ASR", "8-K", "DEF 14A"], "filingDate": ["2026-08-06", "2026-07-13", "2026-02-10", "2026-08-06", "2026-08-01", "2024-01-01", "2025-05-01", "2026-04-20"],
           "accessionNumber": ["0001-26-1", "0001-26-2", "0001-26-3", "0001-26-4", "0001-26-5", "0001-24-6", "0001-25-7", "0001-26-8"], "primaryDocument": ["a.htm"] * 8, "primaryDocDescription": ["8-K"] * 8, "items": ["2.02"] * 8}
    out = ps.compact({"cik": 1710072, "filings": {"recent": rec}}, today)
    forms = [x["f"] for x in out]
    assert "424B5" in forms and "SC 13G/A" in forms and "10-Q" in forms and "DEF 14A" in forms
    assert "4" not in forms, "Form 4 is the insider layer, not a filing row"
    assert "S-3ASR" not in forms, "older than 24 months"
    assert forms.count("8-K") == 1, "8-Ks older than 12 months are dropped"
    assert out[0]["url"].startswith("https://www.sec.gov/Archives/edgar/data/1710072/")

def test_guidance_extractor_finds_company_dates_and_skips_pdufa_and_boilerplate():
    import datetime
    pg = importlib.import_module("pull_guidance")
    today = datetime.date(2026, 9, 10)
    txt = ("We expect to report topline data from the Phase 3 GRAND CANYON study of EDG-5506 in the second half of 2026. "
           "The FDA has set a PDUFA target action date of March 11, 2027 for Reblozyl. "
           "Enrollment completion is anticipated in 1Q 2027. "
           "Forward-looking statements include statements about topline data expected in 2027 and actual results may differ.")
    rows = pg.extract(txt, today)
    kinds = {(r["milestone"], r["date"], r["precision"]) for r in rows}
    assert ("readout", "2026-12-31", "half") in kinds and ("enrollment", "2027-03-31", "quarter") in kinds
    assert not any(r["date"] == "2027-03-11" for r in rows), "PDUFA sentences belong to the regulatory calendar"
    assert not any("Forward-looking" in r["sentence"] for r in rows), "boilerplate is not guidance"
    assert any(r["asset"] and r["asset"].startswith("EDG-5506") for r in rows)

def test_diff_reports_primary_outcome_text_changes():
    sd = importlib.import_module("diff")
    prev = [{"id": "NCT1", "pcd": "2026-12", "pct": "ESTIMATED", "st": "RECRUITING", "n": 100, "ws": "", "po": "Change in AEs"}]
    cur = [{"id": "NCT1", "pcd": "2026-12", "pct": "ESTIMATED", "st": "RECRUITING", "n": 100, "ws": "", "po": "Change in adverse events"}]
    ch, summ = sd.diff_trials(prev, cur)
    assert ch["NCT1"]["chg"] == [["primary outcome text", "Change in AEs", "Change in adverse events"]] and ch["NCT1"]["slip"] == 0

def test_aging_flag_is_word_bounded():
    ag = _rx("AG")
    assert ag.search("A study of healthy aging and frailty") and ag.search("anti-ageing intervention")
    assert not ag.search("PET imaging of glioma") and not ag.search("clinical staging of NSCLC")

def test_igan_does_not_match_michigan():
    src = open(os.path.join(HERE, "..", "data", "process.py"), encoding="utf-8").read()
    rx = re.compile(re.search(r'\("Nephrology & Urology",r"(.*?)"\)', src).group(1), re.I)
    assert rx.search("IgAN") and rx.search("IgA nephropathy") and not rx.search("University of Michigan intracranial aneurysm")
