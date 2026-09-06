"""Private-company layer: Form D parsing helpers and snapshot wiring. Run: make test"""
import sys, os, json, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, ".."); sys.path.insert(0, os.path.join(ROOT, "data"))
fd = importlib.import_module("pull_formd"); nih = importlib.import_module("pull_nih")

def test_formd_dates_and_numbers():
    assert fd.iso("31-JAN-2023") == "2023-01-31" and fd.iso("2026-03-16") == "2026-03-16" and fd.iso("") == ""
    assert fd.num("Indefinite") is None and fd.num("") is None and fd.num("1500000") == 1500000.0

def test_nih_query_name_strips_suffixes():
    assert nih.query_name("Longeveron, LLC") == "longeveron" and nih.query_name("Insilico Medicine Inc.") == "insilico" and nih.query_name("AB") == ""

def test_snapshot_private_layer_if_present():
    p = os.path.join(ROOT, "data", "snapshot.json")
    if not os.path.exists(p): return
    s = json.load(open(p)); assert "formd" in s and "nih" in s
    iss = s["formd"]["issuers"]
    if iss:
        e = next(iter(iss.values())); assert {"name", "cik", "n", "sold", "fil", "rel"} <= set(e)
        assert any(t.get("fd") in iss for t in s["trials"]), "no trial resolved to a Form D issuer"
