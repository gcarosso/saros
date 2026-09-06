#!/usr/bin/env python3
"""Pull public trial + FDA data for the 2026-2027 landscape dashboard.
Sources: ClinicalTrials.gov API v2, openFDA Drugs@FDA. Run on a machine with internet."""
import json, gzip, urllib.request, urllib.parse, time, sys, os, datetime
OUT = os.path.dirname(os.path.abspath(__file__))
def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"landscape-dashboard/1.0"}), timeout=90) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            print("retry", i, e, file=sys.stderr); time.sleep(2*(i+1))
    raise SystemExit("failed "+url)

FIELDS = ",".join("""NCTId BriefTitle OfficialTitle Acronym LeadSponsorName LeadSponsorClass CollaboratorName CollaboratorClass Phase OverallStatus WhyStopped
StartDate StartDateType PrimaryCompletionDate PrimaryCompletionDateType CompletionDate CompletionDateType EnrollmentCount EnrollmentType
Condition Keyword InterventionName InterventionType InterventionDescription ArmGroupLabel ArmGroupType DesignAllocation DesignMasking DesignPrimaryPurpose DesignInterventionModel
PrimaryOutcomeMeasure PrimaryOutcomeTimeFrame StudyFirstPostDate LastUpdatePostDate HasResults ResultsFirstPostDate LocationCountry LocationFacility
IsFDARegulatedDrug OrgStudyId SecondaryId StudyType BriefSummary""".split())
Q = "AREA[PrimaryCompletionDate]RANGE[2026-01-01,2028-12-31] AND AREA[Phase](PHASE3 OR PHASE2 OR PHASE1) AND AREA[LeadSponsorClass]INDUSTRY AND AREA[StudyType]INTERVENTIONAL"
studies=[]; tok=None
while True:
    p={"query.term":Q,"fields":FIELDS,"pageSize":"1000","countTotal":"true"}
    if tok: p["pageToken"]=tok
    j=get("https://clinicaltrials.gov/api/v2/studies?"+urllib.parse.urlencode(p))
    studies+=j.get("studies",[]); tok=j.get("nextPageToken")
    print("ct.gov", len(studies), "/", j.get("totalCount"), file=sys.stderr)
    if not tok: break
with gzip.open(os.path.join(OUT,"ct_raw.json.gz"),"wt") as f: json.dump({"pulled":datetime.datetime.utcnow().isoformat()+"Z","query":Q,"studies":studies},f)

# openFDA Drugs@FDA: approvals with submission status dates in 2025-2027
fda=[]; skip=0
while True:
    j=get("https://api.fda.gov/drug/drugsfda.json?search=submissions.submission_status_date:[20250101+TO+20271231]+AND+submissions.submission_status:AP&limit=1000&skip=%d"%skip)
    fda+=j.get("results",[]); tot=j["meta"]["results"]["total"]; skip+=1000
    print("openfda", len(fda), "/", tot, file=sys.stderr)
    if skip>=tot or skip>=25000: break
with gzip.open(os.path.join(OUT,"fda_raw.json.gz"),"wt") as f: json.dump({"pulled":datetime.datetime.utcnow().isoformat()+"Z","results":fda},f)
print("done")
