"""Snapshot-to-snapshot diff for Readout Radar / SAROS.

Compares the trial rows of the previous snapshot with the current one and reports, per trial, what moved:
primary-completion date (with the size of the move in months), date type (estimated → actual), overall status,
enrollment and why-stopped text.  Placeholder dates (sponsor estimates parked on 30 Jun / 31 Dec, or a bare
June/December month) are treated specially: a move *off* a placeholder onto a specific date is a "firming",
not a slip, because the registry is replacing a guess with a plan.

Used by process.py (which writes the results into snapshot.json) and by tests/test_diff.py.
"""

STOPPED = ("TERMINATED", "WITHDRAWN", "SUSPENDED")
FIELDS = (("pcd", "primary completion"), ("pct", "date type"), ("st", "status"), ("n", "enrollment"), ("ws", "why stopped"))


def is_placeholder(pcd, pct):
    """A sponsor placeholder: estimated date sitting on a June/December month end (or bare June/December month)."""
    if not pcd or pct == "ACTUAL": return False
    m = pcd[5:7]
    if m not in ("06", "12"): return False
    return len(pcd) == 7 or pcd[8:10] in ("30", "31")


def months_between(a, b):
    """Whole months from date a to date b (YYYY-MM or YYYY-MM-DD); positive when b is later."""
    if not a or not b: return 0
    return (int(b[:4]) - int(a[:4])) * 12 + (int(b[5:7]) - int(a[5:7]))


def diff_trials(prev_rows, cur_rows):
    """Return (changes_by_id, summary).

    changes_by_id[id] = {"chg": [[field label, old, new], ...], "slip": months (+ = pushed out), "firmed": 0/1}
    summary = counts plus the lists of new ids and gone rows (id, title, sponsor, phase, pcd).
    """
    prev = {t["id"]: t for t in prev_rows}
    cur_ids = {t["id"] for t in cur_rows}
    changes = {}
    summ = {"n_prev": len(prev), "n_cur": len(cur_rows), "changed": 0, "slipped": 0, "pulled_in": 0, "firmed": 0,
            "status": 0, "stopped": 0, "completed": 0, "enrollment": 0}
    for t in cur_rows:
        p = prev.get(t["id"])
        if not p: continue
        chg = [[label, p.get(k), t.get(k)] for k, label in FIELDS if p.get(k) != t.get(k)]
        if not chg: continue
        slip = months_between(p.get("pcd"), t.get("pcd")) if p.get("pcd") != t.get("pcd") else 0
        firmed = 1 if ((p.get("pct") != "ACTUAL" and t.get("pct") == "ACTUAL") or
                       (is_placeholder(p.get("pcd"), p.get("pct")) and not is_placeholder(t.get("pcd"), t.get("pct")))) else 0
        changes[t["id"]] = {"chg": chg, "slip": slip, "firmed": firmed}
        summ["changed"] += 1
        if firmed: summ["firmed"] += 1
        elif slip >= 1: summ["slipped"] += 1
        elif slip <= -1: summ["pulled_in"] += 1
        if p.get("st") != t.get("st"):
            summ["status"] += 1
            if t.get("st") in STOPPED and p.get("st") not in STOPPED: summ["stopped"] += 1
            if t.get("st") == "COMPLETED": summ["completed"] += 1
        if p.get("n") != t.get("n"): summ["enrollment"] += 1
    summ["new"] = sorted(cur_ids - set(prev))
    summ["gone"] = [{"id": p["id"], "t": p.get("t", ""), "sp": p.get("sp", ""), "ph": p.get("ph", ""), "pcd": p.get("pcd", "")}
                    for pid, p in prev.items() if pid not in cur_ids]
    return changes, summ
