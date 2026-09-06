# Scope: rebuild the PDUFA / AdCom calendar from primary sources

**Why.** `pdufa.json` is BioPharmCatalyst-derived and cannot ship in anything public or commercial.
It is the only BPC field with no free substitute already in the build (cash, market cap and
financials come from SEC; LoA is a separate rebuild). This replaces it with company-disclosed dates,
each citing the filing it came from — better provenance than an aggregator, and ours to publish.

**Status: shipped 2026-09-05.** `data/pull_pdufa.py` is wired into `process.py` (snapshot `reg`), the FDA tab, the dossier and the weekly `make refresh` (`--incremental`, trailing 3 weeks). The BPC path, files and scripts are gone from the repo (private copies moved to `~/Desktop/g-claude/bpc_private/`).

## Measured first pass (2026-09-05)
8-K only, 18-month window, 6 query phrases, crude regex, 530 filings parsed:

| metric | result |
|---|---|
| dated future events extracted | 60 (47 exact day, 13 quarter-precision) |
| tickers matched vs private BPC ground truth | **33 / 54** |
| exact date matches | **32 / 67** |
| priority-review flag detected | 13 |
| false ticker extraction | 3 rows |

Spot-checked correct: NUVL 2026-09-18, RARE 2026-09-19, MRK 2026-09-21, IONS 2026-09-22,
MIRM 2026-09-26, PRAX 2026-09-27 — all agree with the BPC list, each with an SEC URL and the
sentence it came from.

## Diagnosed gaps, with evidence
Missed tickers were `ABEO ALVO AZN BAYRY BFRI BLTE BMY GSK INCY JNJ PFE PHAR PHVS PYPD RHHBY SRPT SVRA TEVA`.
That is not random — it is three fixable causes:

1. **Foreign private issuers file 6-K, not 8-K.** Confirmed: a `"PDUFA"` search on 6-K returns 60
   filings including AZN, GSK, BLTE, ARGX, ASND, GMAB — i.e. ~8 of the 18 misses. *Fix: add 6-K.*
2. **Large caps disclose in periodic reports, not a dedicated 8-K.** Confirmed: 10-Q returns 295
   filings including BMY; 10-K returns 374 including ABEO. *Fix: add 10-Q and 10-K.*
3. **AdCom classification never fires** (0 rows) because the rule requires a segment with no PDUFA
   mention. *Fix: classify per date-mention, not per segment; allow both kinds from one filing.*

Corpus grows 414 → ~1,143 filings once 6-K/10-Q/10-K are added.

## Remaining work (est. 2–3 focused days)
- Add 6-K, 10-Q, 10-K; widen window to 24 months; paginate past the current 300-hit cap.
- Ticker resolution from CIK via `company_tickers.json` instead of regex on the display name
  (kills the 3 bad rows and the `None`s).
- Per-mention kind classification (pdufa / adcom / crl / resubmission) and a `superseded_by` chain so a
  date that moves keeps its history — this is what makes the `slipped` reliability state real for
  regulatory events, the way `diff.py` already does for trial dates.
- Quarter-precision rows: keep as `precision: "quarter"`, render with the ≈ badge already in the UI.
- Confidence field: exact date + priority-review language + recent filing = firm; quarter language or
  a >6-month-old filing = guided.
- Score again against the private BPC set; target ≥45/54 tickers. Do not expect 100% — some companies
  only ever say the date on an earnings call or a JPM slide, which is not in EDGAR.
- Wire into `process.py` beside the existing loader, then delete the BPC path.

## Ongoing operation
EDGAR full-text search is free, needs only a declared User-Agent, and covers 2001+. Fold into the
weekly `make refresh`; incremental runs only need the trailing 2 weeks. No credentials, no
subscription, no cookie — unlike every BPC path.

## Honest limits
Coverage will trail a paid calendar for small caps that disclose loosely, and EDGAR full-text search
indexes filing *documents*, so a date mentioned only in a slide deck exhibit image is invisible.
Quarter-precision rows should never be drawn as if they were day-precision.

## Second pass, measured (2026-09-05, shipped)
8-K + 6-K + 10-Q + 10-K, 24-month window, 7 query phrases, window split into quarters (no page cap hit),
CIK → ticker via `sec_raw.json`, per-sentence classification, supersession with history, offline `--refinalize`:

| metric | first pass | second pass |
|---|---|---|
| filings parsed | 530 | 2,271 |
| dated future events | 60 | 112 unique filer/kind/date rows after supersession and dedupe · 84 day-precision · 27 with a moved-date history · 75 with an asset name |
| tickers matched vs the private ground truth | 33 / 54 | **42 / 54** |
| exact date matches | 32 / 67 | **43 / 67** |
| source forms | 8-K only | 10-Q 49 · 8-K 40 · 10-K 15 · 6-K 8 |

Still missed: `ALVO AZN BAYRY BFRI BMY INCY JNJ PFE RHHBY SRPT TEVA UTHR` — mostly large caps whose 10-Q/10-K
name the date without any of the seven query phrases nearby (e.g. "goal date" inside a table), plus foreign issuers
whose 6-K is a PDF exhibit. Next accuracy steps, in order: (1) a per-CIK targeted search for the sponsors already in the
universe, (2) parse PDF exhibits for 6-K filers, (3) AdCom recall — only one AdCom survived per-sentence classification,
so the cue set for advisory-committee dates needs widening ("advisory committee ... scheduled for", "ODAC").
The ≥45/54 target was not reached on this pass; the honest gap is large-cap 10-K phrasing, not the method.
