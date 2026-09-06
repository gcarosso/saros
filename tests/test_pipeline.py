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
