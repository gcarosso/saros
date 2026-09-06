# Private-company data from public sources

Measured against `data/snapshot.json.gz` (10,085 trials, 2026-09-05).

## 1. What we already have but do not surface

| Cut | Sponsors | Trials |
|---|---|---|
| Sponsors matched to an SEC filer (`sec` + `secman`) | 436 | 3,104 |
| Sponsors with **no** equity linkage | 2,624 | 6,981 |
| ...after removing subsidiaries of matched filers (Genentech, Janssen, MSD, ModernaTX...) | 2,503 | 5,883 |
| ...of which China-origin sponsors | 340 | 1,599 |
| **Private-ish sponsors with a P2/P3 primary completion in 2026-27** | **1,163** | **2,166** |
| ...of which run <=5 trials total (true venture-stage tail) | 1,011 | - |

So roughly **1,000 venture-stage companies with a late-stage readout inside our window are already in the dataset and currently render as an unclickable sponsor string.** That is the single largest unexploited asset in the build - no new scraping required, only entity resolution and enrichment.

Counter-finding: of the 87 companies in `longevity_funding_2026-07.csv`, **zero** appear as lead sponsor of an industry interventional trial in the window. That portfolio is pre-IND or files under different legal entities. Any longevity view must be sourced from something other than CT.gov.

## 2. Public sources worth adding, ranked

### Tier 1 - high yield, clean licence, mechanical to build

**SEC Form D (Reg D private placements)** - quarterly structured datasets at `sec.gov/dera/data/form-d.html` (TSV, back to 2008), plus EDGAR filings per CIK.
- Issuer legal name, address, year of incorporation, industry code (Pharmaceuticals / Biotechnology), **total offering amount, amount sold, number of investors**, and related persons - officers, directors, and usually the VC partners taking board seats.
- Related-person names rolled up to firm names give an approximate **investor-company graph** without buying one.
- The closest legal substitute for PitchBook round data. Gives amount and date; does **not** give valuation.

**NIH RePORTER** (`api.reporter.nih.gov/v2/projects/search`) and **SBIR/STTR awards** (`api.www.sbir.gov/public/api/awards`)
- Non-dilutive funding, PI names, abstracts carrying mechanism text, award history per company. Public domain.
- The fix for pre-IND companies invisible to CT.gov - i.e. the longevity gap above.

**USPTO PatentsView** (`search.patentsview.org/api/v1/`) + **assignment recordation** (`assignment-api.uspto.gov`)
- Assignee -> patent families, priority dates, CPC classes, inventor movement between companies.
- Assignment recordation exposes **security interests and collateral assignments** - an underused venture-debt/distress signal - and licence transfers between a private co and a pharma partner.

**FDA designation databases** - Orphan Drug Designations, Fast Track / Breakthrough / RMAT, Rare Pediatric Disease vouchers, plus the Orange and Purple Books. Frequently granted to private companies years before any IPO. Small files, public domain.

**EU CTIS, WHO ICTRP, ISRCTN, jRCT, CTRI, ChiCTR** - trials that never touch CT.gov. Materially expands EU and Japan private coverage. ICTRP publishes weekly exports; CTIS has a JSON backend behind its public portal.

**S-1 / F-1 prospectuses (retrospective)** - every biotech IPO filing contains the complete private financing history: round names, **price per share**, conversion terms, and the pre-IPO 5%-holder table. Harvesting S-1s builds a fully public historical private-round dataset with real prices. Backward-looking by construction, but it is the only public source of private per-share pricing, and it calibrates a comparables model you then apply to still-private peers.

### Tier 2 - real signal, more plumbing

- **Form ADV bulk data** - fund entities, AUM, crossover-fund identification; pairs with the existing 13F layer.
- **DOL H-1B LCA disclosure files** (quarterly, public) - employer, job title, worksite, salary. A credible **headcount and burn proxy** for private companies; a first "Director, Clinical Operations" hire is a pre-IND tell.
- **UK Companies House API** and EU registries (Handelsregister, Danish CVR, Dutch KvK) - for UK/EU-domiciled biotechs these carry filed accounts: cash, headcount, share issuances. Far richer than anything the US requires of a private company.
- **EU CORDIS / Horizon grants**, **Wellcome, CZI, ARPA-H award lists**, **Gates Foundation grants DB** - philanthropic and public funding flows; directly relevant to the philanthropic-LP audience.
- **CMS Open Payments** - manufacturer payments to physicians; useful for mapping the KOL network around a mechanism.
- **PACER / RECAP** - patent and trade-secret litigation, often the first public disclosure of a licensing dispute.
- **FDA Warning Letters, 483s, inspection classifications** - manufacturing risk, including private CDMOs in the supply chain.
- **USAspending / BARDA contracts** - large non-dilutive awards, fully public.

### Tier 3 - texture, not structure
Conference abstract books (AACR/ASCO/ASH/JPM presenter lists), university tech-transfer licence announcements, Delaware entity search, job boards. Useful for entity resolution; not datasets.

## 3. What is genuinely missing, and cannot be sourced publicly

No combination of the above yields:

1. **Private-round valuations** (pre/post-money) and price per share. Form D gives amount raised only; the only public prices are historical, inside S-1s.
2. **Cap tables, liquidation preferences, participation, ratchets.** Absent until an S-1.
3. **Board composition and investor board seats** - partially inferable from Form D related persons, never complete.
4. **Private burn, runway, cash balance.** Not filed for US private companies. UK/EU registries are the exception.
5. **Licensing and partnership economics** - upfront, milestones, royalty tiers. Disclosed only when a public counterparty materialises it in a 10-K, and usually only the upfront.
6. **Fund-level VC performance** - with one real exception: US public-pension LPs (CalPERS, CalSTRS, state systems) publish fund-level IRR/DPI/TVPI under FOIA. That is a legitimate, legal source and deserves its own pull.
7. **Pre-IND private companies generally** - the longevity cohort leaves almost no trace beyond patents, grants, and Form D.

Items 1, 2, 4 and 5 are precisely what PitchBook, DealForma, Cortellis and Evaluate sell. The honest positioning is not "we replicate them" but "we own the layer they under-serve - mechanism, readout timing, and public-market consequence - and we state plainly which private facts are unknowable."

## 4. Recommended build order

1. **Entity-resolve the 2,503 unmatched sponsors** (parent/subsidiary rollup via ROR/GRID + EDGAR company search + Companies House). This alone turns ~1,000 sponsor strings into clickable private-company entities.
2. **Form D quarterly datasets** -> funding history per resolved private sponsor.
3. **PatentsView + FDA designations** -> IP depth and mechanism corroboration for those entities.
4. **NIH RePORTER + SBIR** -> the pre-IND companies missing from CT.gov, incl. longevity.
5. **S-1 harvest** -> historical private pricing for a comparables model.
6. **CTIS / ICTRP** -> non-US trial coverage.

Every one of these is public domain or explicitly redistributable, which also makes them the clean-room replacement path for the remaining licensed dependencies.

## Status (2026-09-05): steps 1, 2 and 4 shipped in the build

| Step | Implementation | Measured |
|---|---|---|
| 1 + 2 Entity resolution + Form D | `data/pull_formd.py` (SEC Form D quarterly data sets 2019Q1→, industry group Biotechnology / Pharmaceuticals, cached per quarter); `process.py` resolves every non-SEC sponsor and the longevity file by current and previous legal name | 4,427 issuers, 8,621 placements, $134.6B sold in the source; **343 sponsors / 548 trials resolved** (230 P2/P3), 30 of 87 longevity companies; $29.0B sold by the matched issuers |
| 4 NIH RePORTER | `data/pull_nih.py`, one organisation-name query per venture-tail sponsor (≤5 trials, no SEC link) and per longevity company, cached per name | first pass running at 1 req/s over 2,513 names; ~13% of names queried so far hold NIH awards |
| UI | dossier + program profile "Private placements" (amounts, dates, investor counts, officers/directors) and "Non-dilutive funding" (awards, FY range, agencies, top projects); Longevity tab Form D / NIH columns; `Form D on file` and `NIH-funded` flags | — |

Not attempted yet: 3 (PatentsView needs a registered API key; FDA designation lists have no bulk export), 5 (S-1 harvest), 6 (CTIS / ICTRP). SBIR.gov's award API returns 403 to scripted clients, so SBIR/STTR appear only through NIH RePORTER.
Name resolution is still string-based (see CLAUDE.md gotchas); a CIK-based join through EDGAR company search is the next accuracy step.
