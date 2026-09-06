"""Snapshot diff rules (data/diff.py). Run: make test"""
import sys, os, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "..", "data"))
d = importlib.import_module("diff")

def row(id, pcd="2027-03-15", pct="ESTIMATED", st="RECRUITING", n=100, ws=""):
    return {"id": id, "t": "T " + id, "sp": "S", "ph": "P3", "pcd": pcd, "pct": pct, "st": st, "n": n, "ws": ws}

def test_placeholder_rule():
    assert d.is_placeholder("2026-12-31", "ESTIMATED") and d.is_placeholder("2027-06", "ESTIMATED") and d.is_placeholder("2027-06-30", "ESTIMATED")
    assert not d.is_placeholder("2026-12-31", "ACTUAL") and not d.is_placeholder("2026-12-15", "ESTIMATED") and not d.is_placeholder("2027-03", "ESTIMATED")

def test_months_between():
    assert d.months_between("2026-03-15", "2026-09-01") == 6 and d.months_between("2027-01", "2026-11") == -2 and d.months_between("", "2026-01") == 0

def test_slip_firming_status_new_gone():
    prev = [row("A", "2026-09-15"), row("B", "2026-12-31"), row("C", "2027-01-10"), row("D"), row("E", st="RECRUITING"), row("G")]
    cur  = [row("A", "2027-01-15"),                     # pushed out 4 months → slipped
            row("B", "2027-03-10"),                     # off a Dec-31 placeholder → firmed, not a slip
            row("C", "2027-01-10", pct="ACTUAL"),       # estimated → actual → firmed
            row("D", n=140),                            # enrollment only
            row("E", st="TERMINATED", ws="Business decision"),
            row("N")]                                   # new; G is gone
    ch, s = d.diff_trials(prev, cur)
    assert ch["A"]["slip"] == 4 and ch["A"]["firmed"] == 0 and ch["A"]["chg"][0][0] == "primary completion"
    assert ch["B"]["firmed"] == 1 and ch["B"]["slip"] == 3
    assert ch["C"]["firmed"] == 1 and ch["C"]["slip"] == 0
    assert ch["D"]["chg"] == [["enrollment", 100, 140]]
    assert ch["E"]["chg"][0] == ["status", "RECRUITING", "TERMINATED"]
    assert s["slipped"] == 1 and s["firmed"] == 2 and s["pulled_in"] == 0 and s["status"] == 1 and s["stopped"] == 1 and s["enrollment"] == 1
    assert s["changed"] == 5 and s["new"] == ["N"] and [g["id"] for g in s["gone"]] == ["G"] and s["n_prev"] == 6 and s["n_cur"] == 6
