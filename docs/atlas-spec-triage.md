# Grok "Atlas" spec vs Readout Radar v7.2 — triage (2026-09-05)

Source: `grok-spec-dashboard` (prompt, style board, persona vignettes) and 5 mock frames.

## What is structurally different
| Dimension | Atlas (Grok) | Readout Radar (ours) | Verdict |
|---|---|---|---|
| Data | Typed **mock** graph (~40 cos, 90 catalysts) that "looks operational" | **Real**: 10,085 trials, 8,158 FDA actions, 1,096 BPC catalysts, 32 funds' 13F, Form 4, SEC XBRL | Keep ours. Never trade real for pretty. |
| Home surface | Book Pulse: *watchlist-first*, KPI strip, activity rail, inspector | Universe-first: landscape timeline → calendar → dossier | Adopt: **Book mode** when a watchlist exists (same objects, different default sort/first question). |
| Change detection | Activity rail 24h: slips, 13F adds, Form 4 clusters, cash beats | Only on manual live refresh (change log) | Adopt: **snapshot-to-snapshot diff** at process time → persistent Activity rail. Highest-value gap (associate + PM vignettes). |
| Date semantics | firm / guided / estimated / **slipped**, slip history never overwritten | ACTUAL / ESTIMATED + BPC note text | Adopt the vocabulary; slip history falls out of the diff above. |
| Next action | Rules-based, always visible, dismissible (`pass — insolvency before readout`, `wait — date unconfirmed`) | Confidence score + reasons; no explicit action line | Adopt: **decision line** at top of dossier + a column in calendar. Cheap, transparent rules. |
| Cash-to-event | First-class: runway months vs days to catalyst → binding / not binding | Both numbers exist (BPC months, SEC runway) but never compared | Adopt: compute `binding` flag; drives next action and a rail chip. |
| Impact score | f(phase, indication weight, LoA, mcap, crowding, firmness) | none (LoA + prior + confidence shown separately) | Adopt as labelled heuristic; sort agenda by it. |
| rNPV | Workshop with tornado, saved assumption sets (Base vs Bear) | Sketch in dossier, no persistence, no tornado | Adopt tornado (4 bars) + saved sets in localStorage / artifact `db`. |
| Objects | Company ↔ Asset ↔ Trial ↔ Catalyst ↔ Deal ↔ Holder, deep links | Trial dossier, sponsor profile, investor filter; no Asset object, no URLs | Adopt **Asset view** (group trials by intervention) + hash deep links (`#t/NCT…`, `#s/Sponsor`, `#i/Fund`). Skip Deal object (no data). |
| Command bar | NL → compiled filters + explanation | ⌘K entity search + free-text filter | Adopt via `sample.json`: "PDUFA next 60d, LoA>60, cash>18mo, <2 specialists" → filter JSON, shown back as chips. |
| Public / Private book | Toggle changes columns & default metrics | Listing filter; private columns only for longevity CSV | Partial: a "Private" preset (hide price/mcap, promote last round/syndicate for the 87 longevity cos). No PitchBook → don't fake the rest. |
| Screener | Saved dynamic screens, compare 2–6 | Filters, no save, no compare | Adopt saved screens (URL hash). Compare later. |
| Thesis / alerts | Notes, bull/base/bear, alert rules | Watchlist only | Notes per object (localStorage/db); alert *rules* need a running process → Claude Code weekly job emits a digest instead. |
| Deals, epi/commercial, news, transcripts | Stubs on mock data | Explicitly out of scope | Keep out. Say so in Method. |
| Stack | React/TS/Vite/Tailwind/TanStack/Recharts | Single file, zero deps, gzip payload | Keep ours until a second developer or a backend appears. |
| Style | Canvas #0B0D10, teal accent, Inter, 26px chips, left icon rail, no shadows | Canvas #07080a, blue accent, IBM Plex, chips, rail of filters, one shadow (dossier) | Tokens are ~equivalent. Do **not** re-skin. Borrow: teal-only-for-selection discipline, "missing LoA = em dash never 0%", muted timestamp + amber dot for stale. |

## Adopt, in order (each is a day or less in Claude Code)
1. **Snapshot diff → Activity rail.** Keep `data/prev_snapshot.json.gz`; process.py emits `changes[]` (PCD moved ±, status flip, enrollment change, 13F new/exit, Form 4 new buy, BPC LoA move, runway drop). Rail on home; feeds slip history and "slipped" reliability.
2. **Decision line + cash-to-event.** Rules (transparent, listed in Method): stopped → *Pass*; PCD est. & ≤90d → *Wait — date unconfirmed*; months_cash < months_to_event → *Pass/hedge — cash binding*; specialists new ≥2 & PCD ≤180d → *Review flow*; conf ≥75 & firm → *Size / diligence endpoints*. Shown at top of dossier and as a calendar column.
3. **Book mode.** If watchlist non-empty, home = watchlist rows with KPI strip re-cut (7/30/90d catalysts, slips, cash<12mo, specialist adds), activity rail, inspector = dossier. Persona presets: Book · Catalysts · Landscape · Private.
4. **Impact score + agenda sort.** `impact = phase_w × loa_or_prior × log(mcap) × firmness × (1 − crowding_discount)`, bucketed High/Med/Low; label as heuristic.
5. **Asset object + deep links.** Group by normalised intervention name; hash routes so a dossier can be shared.
6. **rNPV tornado + saved assumption sets.**
7. **NL command → filters** via `sample.json` (hosted) with the compiled filter echoed as chips.
8. Saved screens; per-object notes; weekly digest from the Claude Code job.

## Do not adopt
Mock data of any kind; React rewrite; deal-comps / commercial / epidemiology / news / transcript views without a real feed; ticker tape; 10-icon rail; toast-free "calm alerts" as a feature claim without a process behind it.
