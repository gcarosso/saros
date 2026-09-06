# SAROS (formerly Readout Radar; renamed 2026-09-05, file names unchanged) — project instructions

Single-file interactive dashboard of the 2026–2028 industry clinical-trial readout landscape, built for
specialist biotech investors (VCs, healthcare hedge funds, LPs, large philanthropies) — never say so in the UI;
it should be inferable from content. Owner: Gio. Built in Cowork through v7.2 (Sept 2026),
handed to Claude Code for the build/data pipeline from here on. v8 (also Cowork, 2026-09-05) added the decision layer: `decide()` in app1.js (reliability firm/guided/estimated/stopped, cash-to-event binding, impact score, next action), persona presets (Book / Catalysts / Landscape / Private) in the top bar, book-mode KPI strip, rNPV tornado.

## Non-negotiables (from Gio)
- High signal-to-noise and information density without overwhelming: progressive disclosure (KPI → chart → table → dossier).
- Black background, TradingView-crisp: IBM Plex Sans UI, IBM Plex Mono for every number; palette and tokens live in `src/head.html`. Do not introduce a light theme.
- Tone and interpretation follow the Verdad "Biotech Investing" white paper (in this folder): trials are coordinates, not oracles; the sponsor's research program is the unit; specialist consensus (13F), insiders (Form 4) and short interest are the quality signals; spending-anchored value; long AND short side; honest denominators.
- Prioritise longevity companies from `longevity_funding_2026-07.csv` when choosing focus content.
- Every click should reveal more (hover cards, dossier drawer, click-to-filter). Clicking a drug asset must show mechanism of action (lexicon tags + curated note + on-demand AI explainer).
- Paid-only data (Evaluate consensus, DealForma terms, IQVIA, expert networks, AlphaSense) is explicitly out of scope; say so in Method rather than faking it.

## Layout of this repo
```
src/head.html      <title> + all CSS (design tokens at top)
src/body.html      markup: top links (About / Visuals sheets), rail (Clear all at top), KPIs, timeline, tabs (calendar, programs&peers, longevity, area×phase, modality, geography, FDA, risk, method), dossier, palette, About sheet text
src/pages/         editable page copy: about.html, sector.html, visuals.html (HTML fragments stitched into body.html at <!--PAGE:x--> by build.py) and glossary.txt (hover tooltips, `key: text`) — edit these, then `make build`
src/app1.js        data model + GLOSS (plain-language hover glossary; add a key there and data-gl="key" in markup or gl('key') in templates), chart primitives (vbars, dumbbell, dotplot, rangeplot, beeswarm); payload decode, enrichment (sponsor→group/tier, confidence heuristic, priors, SEC/BPC/13F/insider joins, trial-health benchmarks), filters, SVG primitives
src/app2.js        views, Sheet (About/Sector/Visuals overlays, #about/#sector/#visuals hash), Viz (overview charts over all of T: composition bars, dumbbell, dot plot, histogram, range plot, heat), Sector (VERDAD constants = figures redrawn from the white paper), dossier (incl. rNPV sketch, Street view, ownership, insiders), command palette (⌘K, incl. investor search), CSV export, live refresh + change log, landscape Gantt
build.py           src/* + gzip/base64 snapshot → dist/saros.html (standalone, live refresh works) and dist/artifact.html (no doctype; for the claude.ai Artifact publish)
data/pull.py           ClinicalTrials.gov v2 (industry, interventional, P1–P3, PCD 2026-01-01..2028-12-31) + openFDA drugsfda approvals since 2025
data/pull_sec.py       SEC company_tickers(+exchange) + XBRL frames (cash, STI, R&D, NI, revenue; last quarters)
data/pull_13f.py       EDGAR 13F-HR info tables, latest 2 filings, for the fund list in KNOWN/FUNDS
data/pull_insiders.py  SEC insider-transactions quarterly zips (Form 4 codes P/S), last 2 published quarters
data/pull_pdufa.py     SEC EDGAR full-text search → pdufa_edgar.json (regulatory calendar; see section below)
data/pull_formd.py     SEC Form D quarterly data sets (bio/pharma issuers) → formd_raw.json; formd_cache/ keeps the zips
data/pull_nih.py       NIH RePORTER awards by organisation for venture-tail sponsors + longevity cohort → nih_raw.json (cached per name)
data/diff.py           snapshot-to-snapshot diff (slips, firmed dates, status) — used by process.py; results in snapshot `diff` + per-trial chg/slip/frm/new; per-build files in data/history/
data/process.py        joins everything → data/snapshot.json(.gz). Uses moa_lexicon.py, ../longevity_funding_2026-07.csv, sec_raw.json, f13_raw.json, insiders_raw.json, pdufa_edgar.json, formd_raw.json, nih_raw.json (private-company layer: snapshot `formd` / `nih`, per-trial `fd` / `nih`; see docs/private-data-sources.md)
data/moa_lexicon.py    TARGETS (regex → mechanism tag) and ASSETS (regex → curated one-line MOA note). Extend here; it is the main lever for "what does this drug do".
tests/                 pytest sanity checks (lexicon, snapshot shape, JS parses)
Makefile               pull / process / build / test / serve
```
The published artifact URL is owned by Gio's claude.ai account: https://claude.ai/code/artifact/45159ebf-6703-4cf5-a5d7-4295c4f4c54d (capabilities: downloads, sample). Republish with the Artifact tool using `dist/artifact.html` and that URL.

## Pipeline
Tooling (set up 2026-09-05 in Claude Code): `.venv/` (python3 -m venv .venv && .venv/bin/pip install pytest) — the Makefile
uses it when present; node comes from Homebrew (`brew install node`, needed by the JS parse test); the render test uses the
installed Google Chrome headless. `make refresh` = pull → rotate (snapshot → prev_snapshot.json.gz) → process → build → test; `make install-launchd` schedules it
Mondays 06:00 local (plist in `launchd/`). No credentials are needed anywhere.
`make pull && make process && make build` (≈8 min total). `make test` before publishing. `saros.html` at the folder root is the deliverable copy (renamed from readout-radar.html on 2026-09-05); open it locally for "Refresh live" (fetches CT.gov deltas and shows a change log).
SEC and NIH endpoints require a descriptive User-Agent with a contact address: the pullers read SAROS_CONTACT (default saros@gcarosso.bio). Be polite: ≤10 req/s.

## Regulatory calendar (SEC EDGAR; replaced the subscription calendar on 2026-09-05)
`data/pull_pdufa.py` reads PDUFA / AdCom / resubmission dates from companies' own filings via EDGAR full-text search
(8-K, 6-K, 10-Q, 10-K and exhibits; trailing 24 months on a full run, trailing 3 weeks merged on `make pull-pdufa`).
Each row cites its filing, is classified from its own sentence, carries day/month/quarter precision, a firm/guided
confidence and a `history` of earlier statements (supersession by filer + kind + asset). Ticker from CIK via
`sec_raw.json`. Output `data/pdufa_edgar.json` (tracked; regenerable) → snapshot `reg` → FDA tab, dossier
"Regulatory dates", timeline strip, `Regulatory date pending` flag. Market cap is proxied by SEC `dei:EntityPublicFloat`
(`sec.flt`) and per-share values use `dei:EntityCommonStockSharesOutstanding` (`sec.sh`); LoA is the literature prior only.
Nothing subscription-derived remains in the build; the old subscription data was moved out of the repo.
Scope, measured scores and limits: `docs/pdufa-rebuild-scope.md`.

## Known gotchas
- 13F XML uses namespace prefixes on both tags and attributes; strip both before parsing (done in pull_13f.py). Generalist managers (Point72, Viking, Woodline, Polar, Farallon) are tracked but counted separately (`gen` flag) so they don't dilute the specialist count.
- Form 4: 10%-owners and corporate reporters (e.g. Genmab's tender purchases of Merus) must be excluded from the insider-buy signal; they are tallied as `own10_*`.
- Issuer↔sponsor join is by normalised name (`norm()` in process.py / `normName()` in app1.js); a CUSIP/ticker join would be better — openFIGI is the free route.
- SEC XBRL R&D frame is missing for some large caps (tag variants); fall back to quarterly run-rate is implemented.
- Sponsor→group/tier mapping (`GROUPS`, `CN_RX`, `JK_RX` in app1.js) and TA/modality regexes (process.py) are heuristics; expect a few % misclassification. Fix by adding patterns, not by hand-editing data.
- Registry "primary completion" lags real readouts, especially open-label P1/1b; hence the 2028 universe; the default window is current month → Dec 2028 (changed from Dec 2027 on 2026-09-05 at Gio's request).
- December/June PCD spikes are sponsor placeholder dates; the UI says so.
- Artifact CSP blocks fetch, so the hosted copy is snapshot-only; only the local file can live-refresh. CSV export uses the `downloads` capability when hosted, blob/clipboard fallback locally.

## Style for code changes
Keep it single-file at build time, no framework, no bundler. Prefer extending existing primitives (`stackedBars`, `hbars`, `heat`, `kv`, `flag`) over new CSS. Every new number needs a source line in Method → Data provenance. Every new heuristic needs a one-paragraph Method note. Run the headless Chromium screenshot check (see `tests/` for the pattern; playwright is fine) before publishing.

## Backlog (in priority order, as of 2026-09-05)
See `docs/atlas-spec-triage.md` for the product-shape backlog derived from the Grok 'Atlas' spec (activity rail from snapshot diffs, decision line, book mode, impact score, asset object, deep links). Data-plumbing items below come first.
1. Weekly `make refresh` via launchd is live (Mondays 06:00 Pacific).
1a. Regulatory calendar from EDGAR: done 2026-09-05 (see section above); remaining accuracy work is in `docs/pdufa-rebuild-scope.md`.
1b. Snapshot diff → activity rail + `slipped` reliability (keep `data/prev_snapshot.json.gz`; process.py emits `changes[]`). Then asset object + hash deep links, saved rNPV sets / screens, NL→filter via sample.json. Details in `docs/atlas-spec-triage.md`.
2. Ticker/CUSIP join for 13F and insiders via openFIGI; drop name-matching.
3. Short interest (FINRA API needs a key; or Nasdaq/NYSE bi-monthly files).
4. Form 4 current-quarter via EDGAR full-text search (the quarterly data set lags a quarter).
5. Financing tape from press releases (BCIQ-lite).
6. Peer-similarity view as its own tab (currently inside Program profile).
