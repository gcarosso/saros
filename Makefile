# Readout Radar — build pipeline. Run on a machine with internet (the Mac).
# .venv (python3 -m venv .venv && .venv/bin/pip install pytest) is used when present; node from Homebrew for the JS parse test
PY ?= $(if $(wildcard .venv/bin/python),$(CURDIR)/.venv/bin/python,python3)
export PATH := /opt/homebrew/bin:$(PATH)
DATA = data
SNAP = $(DATA)/snapshot.json.gz

.PHONY: all pull pull-trials pull-sec pull-13f pull-insiders pull-pdufa pull-pdufa-full pull-formd pull-nih rotate process build test serve clean refresh install-launchd uninstall-launchd

all: process build

pull: pull-trials pull-sec pull-13f pull-insiders pull-pdufa pull-formd pull-nih

pull-trials:      ## ClinicalTrials.gov v2 + openFDA Drugs@FDA (≈2 min)
	cd $(DATA) && $(PY) pull.py
pull-sec:         ## SEC company tickers + XBRL frames (≈1 min)
	cd $(DATA) && $(PY) pull_sec.py
pull-13f:         ## EDGAR 13F-HR info tables for tracked funds (≈3 min)
	cd $(DATA) && $(PY) pull_13f.py
pull-insiders:    ## SEC insider-transactions quarterly zips (≈1 min)
	cd $(DATA) && $(PY) pull_insiders.py
pull-pdufa:       ## regulatory calendar from SEC EDGAR full-text search, trailing 3 weeks merged into pdufa_edgar.json (≈3 min; `make pull-pdufa-full` = 24 months, ≈20 min)
	cd $(DATA) && $(PY) pull_pdufa.py --incremental
pull-pdufa-full:
	cd $(DATA) && $(PY) pull_pdufa.py
pull-formd:       ## SEC Form D quarterly data sets → formd_raw.json (cached per quarter; ≈1 min after the first run)
	cd $(DATA) && $(PY) pull_formd.py
pull-nih:         ## NIH RePORTER awards for venture-tail sponsors + longevity cohort → nih_raw.json (cached per name; new names only)
	cd $(DATA) && $(PY) pull_nih.py

rotate:           ## keep the current snapshot as the diff baseline (prev_snapshot.json.gz); run before process
	@if [ -f $(SNAP) ]; then cp $(SNAP) $(DATA)/prev_snapshot.json.gz && echo "rotated $(SNAP) → prev_snapshot.json.gz"; fi
process:          ## raw pulls (+ pdufa_edgar.json) → snapshot.json.gz
	cd $(DATA) && $(PY) process.py

build: $(SNAP)    ## embed snapshot + src/pages → dist/saros.html (standalone) + dist/artifact.html
	$(PY) build.py $(SNAP)
	cp dist/saros.html saros.html

test:             ## lexicon / mapping / build sanity checks
	$(PY) -m pytest -q tests

serve:            ## open the standalone build locally (live refresh works from here)
	open saros.html

refresh:          ## weekly job: pull → process → build → test (≈8 min); what launchd runs
	@echo "== refresh start $$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	$(MAKE) pull
	$(MAKE) rotate
	$(MAKE) process
	$(MAKE) build
	$(MAKE) test
	$(MAKE) publish
	@echo "== refresh done  $$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# The built dashboard is served from the one-commit repo saros-dist (Cloudflare Pages → saros.gcarosso.bio).
# publish replaces that commit and force-pushes, so the hosting repo never grows.
DIST_REPO ?= $(firstword $(wildcard $(CURDIR)/../saros-dist $(CURDIR)/../../saros-dist))
publish: dist/saros.html
	@test -n "$(DIST_REPO)" || (echo "saros-dist checkout not found next to this repo"; exit 1)
	cp dist/saros.html $(DIST_REPO)/index.html
	cd $(DIST_REPO) && git add -A && git commit -q --amend -m "SAROS build $$(date -u +%Y-%m-%d)" && git push -q --force-with-lease && echo "published $$(date -u +%Y-%m-%d) → saros.gcarosso.bio"

PLIST = com.readoutradar.refresh
install-launchd:  ## schedule `make refresh` Mondays 06:00 local (Pacific on this Mac); no credentials needed
	mkdir -p ~/Library/LaunchAgents
	sed 's|__REPO__|$(CURDIR)|g' launchd/$(PLIST).plist > ~/Library/LaunchAgents/$(PLIST).plist
	launchctl bootout gui/$$(id -u)/$(PLIST) 2>/dev/null || true
	launchctl bootstrap gui/$$(id -u) ~/Library/LaunchAgents/$(PLIST).plist
	launchctl print gui/$$(id -u)/$(PLIST) | grep -E "state|program|run interval|next" || true
uninstall-launchd:
	launchctl bootout gui/$$(id -u)/$(PLIST) 2>/dev/null || true
	rm -f ~/Library/LaunchAgents/$(PLIST).plist

clean:
	rm -rf dist
