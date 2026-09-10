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

def test_aging_flag_is_word_bounded():
    ag = _rx("AG")
    assert ag.search("A study of healthy aging and frailty") and ag.search("anti-ageing intervention")
    assert not ag.search("PET imaging of glioma") and not ag.search("clinical staging of NSCLC")

def test_igan_does_not_match_michigan():
    src = open(os.path.join(HERE, "..", "data", "process.py"), encoding="utf-8").read()
    rx = re.compile(re.search(r'\("Nephrology & Urology",r"(.*?)"\)', src).group(1), re.I)
    assert rx.search("IgAN") and rx.search("IgA nephropathy") and not rx.search("University of Michigan intracranial aneurysm")
