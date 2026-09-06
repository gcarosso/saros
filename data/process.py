#!/usr/bin/env python3
"""Build compact snapshot from raw pulls. Output: snapshot.json (+ .gz)"""
import gzip,json,re,collections,datetime,os
OUT=os.path.dirname(os.path.abspath(__file__))
d=json.load(gzip.open(os.path.join(OUT,"ct_raw.json.gz"),"rt"))
TA=[("Oncology",r"cancer|carcinoma|tumou?r|neoplasm|lymphoma|leukemia|leukaemia|myeloma|melanoma|sarcoma|glioma|glioblastoma|nsclc|sclc|metasta|oncolog|mesothelioma|myelodysplastic|myelofibrosis|blastoma|adenocarcinoma"),
("Nephrology & Urology",r"nephropathy|glomerul|\biga\b|igan\b|fsgs|lupus nephritis|nephrotic|alport|polycystic kidney|adpkd|nephro|overactive bladder|incontinence|urolog"),
("Cardiometabolic",r"diabet|obes|weight|cardio|heart failure|atrial|hypertens|coronary|myocardial|lipid|cholesterol|hypercholes|nash|mash|steatohepat|steatotic|kidney disease|ckd|renal|lp\(a\)|atheroscl|stroke|thromb|hypertriglycer"),
("Immunology & Inflammation",r"psoria|arthritis|lupus|crohn|colitis|dermatitis|atopic|asthma|copd|eosinophil|hidradenitis|alopecia|vitiligo|spondyl|sjogren|scleroderma|myasthenia|urticaria|inflammat|pemphig|uveitis|sarcoidosis|immune|autoimmun|celiac|prurigo|lichen"),
("Neuroscience",r"alzheimer|parkinson|schizophren|depress|bipolar|epilep|seizure|migraine|multiple sclerosis|neuropath|huntington|amyotrophic|als\b|dementia|cognitive|autism|adhd|anxiety|insomnia|narcolepsy|pain\b|tourette|ataxia|myotonic|duchenne|spinal muscular|neuro|psychiatr|ptsd|agitation|tardive|essential tremor|rett"),
("Infectious Disease & Vaccines",r"vaccin|infection|influenza|covid|sars-cov|rsv|hiv|hepatitis|bacteri|pneumonia|tubercul|malaria|fung|candid|sepsis|urinary tract|cmv|cytomegalo|virus|viral|immunization|immunisation|pneumococc|meningococ|dengue|herpes|clostrid|gonorr|chlamyd"),
("Rare & Genetic Disease",r"rare|orphan|deficien|syndrome|hemophilia|haemophilia|sickle|thalassemia|fabry|gaucher|pompe|amyloid|cystic fibrosis|dystroph|mucopolysacc|phenylketon|lysosomal|hereditary|congenital|genetic|angioedema|porphyria|achondroplasia|hypophosphat|primary biliary|myositis|pnh|paroxysmal|transthyretin|wilson"),
("Hematology",r"anemia|anaemia|thrombocytop|neutropen|hemat|haemat|von willebrand|itp\b|coagul|bleeding|iron"),
("Ophthalmology",r"macular|retin|glaucoma|ophthalm|ocular|eye|myopia|keratitis|dry eye|uveitis|cornea"),
("Respiratory",r"pulmonary|lung disease|bronchiect|idiopathic pulmonary|ipf\b|respiratory|cough|sleep apnea"),
("Women's & Men's Health",r"endometrio|menopaus|contracep|fertil|ovarian insuff|uterine|pregnan|preterm|vasomotor|erectile|hypogonad|prostat"),
("Gastroenterology & Hepatology",r"gastro|liver|hepat|cirrhosis|bowel|constipat|ibs|eosinophilic esophagitis|pancreat|cholang|gerd|reflux"),
("Dermatology",r"acne|rosacea|wound|scar|hyperhidrosis|skin|dermat|onychomycosis"),
("Musculoskeletal & Pain",r"osteo|fracture|tendon|muscle|gout|back pain|fibromyalgia|arthro|joint"),
("Endocrinology",r"thyroid|growth hormone|cushing|acromegaly|adrenal|hypoparathyroid|endocrin|pubert"),
("Nephrology & Urology",r"nephro|glomerul|iga nephropathy|bladder|incontinence|urolog|dialysis|lupus nephritis|fsgs"),
("Allergy",r"allerg|anaphyla|peanut|food allergy")]
MOD=[("Cell therapy",r"car-t|car t|cart\b|t-cell|t cell|til\b|nk cell|cell therapy|autologous|allogeneic|stem cell|mesenchymal|ipsc|tcr-t|tcr t"),
("Gene therapy / editing",r"gene therapy|aav|adeno-associated|crispr|gene editing|base edit|lentivir|gene transfer|exa-cel|vector"),
("Oligonucleotide (siRNA/ASO)",r"sirna|antisense|oligonucleotide|aso\b|rnai|mrna therap|-rsen$|-siran\b|ersen\b|siran\b"),
("ADC",r"antibody-drug conjugate|antibody drug conjugate|\badc\b|deruxtecan|vedotin|govitecan|tirumotecan|ozogamicin|mafodotin|ejfemtecan|rilvegotecan"),
("Bispecific / multispecific",r"bispecific|trispecific|multispecific|t-cell engager|tce\b|bite\b|xmab|-mig\b|tarlatamab|linvoseltamab|elranatamab|teclistamab|glofitamab|epcoritamab|ivonescimab|amivantamab|odronextamab"),
("Radiopharmaceutical",r"radioligand|lutetium|177lu|lu-177|actinium|225ac|radiopharm|psma-617|pluvicto|dotatate|radionuclide"),
("mRNA / vaccine",r"mrna|vaccine|immunization|immunisation|adjuvant|-vax\b|mrna-"),
("GLP-1 / incretin",r"semaglutide|tirzepatide|retatrutide|orforglipron|cagrilintide|cagrisema|survodutide|mazdutide|maritide|glp-1|glp1|incretin|amylin|danuglipron|ecnoglutide|pemvidutide|efinopegdutide|petrelintide|amycretin|bimagrumab"),
("Monoclonal antibody",r"mab\b|monoclonal|antibody"),
("Peptide / protein / enzyme",r"peptide|insulin|enzyme|-ase\b|fusion protein|hormone|factor viii|factor ix|erythropo|analog"),
("Cell-free / other biologic",r"biolog|exosome|microbiome|fecal|bacteriotherapy|phage"),
("Small molecule",r"inhibitor|tablet|capsule|oral|\bmg\b|-nib\b|-tinib\b|-ciclib\b|-rasib\b|-lisib\b|-stat\b|-degrader|protac|molecular glue|-ant\b|-vir\b|-tide\b|-one\b|-ine\b")]
def classify(text, table, default):
    t=text.lower()
    for name,rx in table:
        if re.search(rx,t): return name
    return default
def modality(text,types):
    t=text.lower()
    for name,rx in MOD:
        if re.search(rx,t): return name
    ty=set(types)
    if "BIOLOGICAL" in ty: return "Biologic (unspecified)"
    if "DRUG" in ty: return "Small molecule"
    if "DEVICE" in ty: return "Device / combination"
    if "PROCEDURE" in ty or "RADIATION" in ty: return "Procedure / radiation"
    if "BEHAVIORAL" in ty or "DIETARY_SUPPLEMENT" in ty: return "Other"
    return "Other"
rows=[]
for s in d["studies"]:
    p=s["protocolSection"]; id_=p["identificationModule"]; st=p["statusModule"]; sp=p["sponsorCollaboratorsModule"]; dm=p.get("designModule",{}); cm=p.get("conditionsModule",{}); ai=p.get("armsInterventionsModule",{}); cl=p.get("contactsLocationsModule",{}); om=p.get("outcomesModule",{}); ov=p.get("oversightModule",{})
    di=dm.get("designInfo",{}); locs=[l.get("country") for l in cl.get("locations",[]) if l.get("country")]
    cc=collections.Counter(locs); conds=cm.get("conditions",[])[:4]; kws=cm.get("keywords",[])[:5]
    ints=[[i.get("type",""),(i.get("name") or "")[:70]] for i in ai.get("interventions",[])][:4]
    ivd=[(i.get("description") or "")[:320] for i in ai.get("interventions",[])][:3]
    text=" ".join([id_.get("briefTitle",""),id_.get("officialTitle","")," ".join(conds)," ".join(kws)])
    mtext=" ".join([n for _,n in ints]+kws+[id_.get("briefTitle","")])
    po=om.get("primaryOutcomes",[])
    rows.append({"id":id_["nctId"],"t":(id_.get("briefTitle") or "")[:160],"ot":(id_.get("officialTitle") or "")[:220],"ac":id_.get("acronym",""),
      "sp":sp.get("leadSponsor",{}).get("name",""),"co":[c["name"] for c in sp.get("collaborators",[])][:3],
      "ph":"/".join(dm.get("phases",[])).replace("PHASE","P").replace("EARLY_P1","P1"),"st":st.get("overallStatus",""),"ws":(st.get("whyStopped") or "")[:200],
      "sd":st.get("startDateStruct",{}).get("date",""),"pcd":st.get("primaryCompletionDateStruct",{}).get("date",""),"pct":st.get("primaryCompletionDateStruct",{}).get("type",""),
      "cd":st.get("completionDateStruct",{}).get("date",""),"n":dm.get("enrollmentInfo",{}).get("count"),"nt":dm.get("enrollmentInfo",{}).get("type",""),
      "c":conds,"k":kws,"iv":ints,"al":di.get("allocation",""),"mk":di.get("maskingInfo",{}).get("masking",""),"pp":di.get("primaryPurpose",""),"im":di.get("interventionModel",""),
      "po":(po[0].get("measure","")[:160] if po else ""),"pot":(po[0].get("timeFrame","")[:80] if po else ""),
      "fp":st.get("studyFirstPostDateStruct",{}).get("date",""),"lu":st.get("lastUpdatePostDateStruct",{}).get("date",""),"hr":1 if s.get("hasResults") else 0,
      "nc":len(cc),"ns":len(locs),"tc":[c for c,_ in cc.most_common(4)],"fda":1 if ov.get("isFdaRegulatedDrug") else 0,
      "ta":classify(text,TA,"Other"),"mo":modality(mtext,[t for t,_ in ints]),
      "sum":(p.get("descriptionModule",{}).get("briefSummary") or "")[:400],"ivd":ivd})
import moa_lexicon
for t in rows:
    txt=" ".join([t["t"],t["ot"]," ".join(t["c"])," ".join(t["k"])," ".join(n for _,n in t["iv"])," ".join(t["ivd"]),t["sum"]])
    t["moa"],t["mn"]=moa_lexicon.tag(txt," ".join(n for _,n in t["iv"])+" "+t["t"])
    mo=set(t["moa"])
    if t["mo"] in ("Biologic (unspecified)","Small molecule","Other","Monoclonal antibody","Peptide / protein / enzyme"):
        if mo&{"Gene / epigenetic editing","AAV gene therapy"}: t["mo"]="Gene therapy / editing"
        elif mo&{"siRNA","Antisense oligonucleotide","SOD1 ASO","FUS ASO","Angiotensinogen siRNA"}: t["mo"]="Oligonucleotide (siRNA/ASO)"
        elif mo&{"CAR-T","TCR-T","TIL cell therapy","NK cell therapy","CD19 CAR-T (autoimmune)"}: t["mo"]="Cell therapy"
        elif any(x.endswith("ADC") for x in mo): t["mo"]="ADC"
        elif any("bispecific" in x.lower() or "×" in x for x in mo): t["mo"]="Bispecific / multispecific"
        elif "mRNA" in mo and t["mo"]!="Monoclonal antibody": t["mo"]="mRNA / vaccine"
        elif any("radioligand" in x.lower() for x in mo): t["mo"]="Radiopharmaceutical"
print("moa tagged",sum(1 for t in rows if t["moa"]),"notes",sum(1 for t in rows if t["mn"]))
# SEC join candidates
def norm(n):
    n=n.lower().replace("&","and")
    n=re.sub(r"[^a-z0-9 ]"," ",n)
    n=re.sub(r"\b(inc|corp|corporation|ltd|limited|plc|llc|co|company|holdings?|the|sa|ag|nv|bv|spa|se|kk|kabushiki kaisha|group|usa|us)\b"," ",n)
    return re.sub(r"\s+"," ",n).strip()
SEC={}
try:
    sec=json.load(open(os.path.join(OUT,"sec_raw.json")))
    spn={norm(t["sp"]) for t in rows}
    fin=sec["fin"]
    for tk in sec["tickers"]:
        nn=norm(tk["n"])
        if nn in spn and (nn not in SEC or tk["ex"] in ("Nasdaq","NYSE")):
            f=fin.get(str(tk["cik"]),{})
            SEC[nn]={"t":tk["t"],"ex":tk["ex"],"cik":tk["cik"],"cash":f.get("cash"),"sti":f.get("sti"),"per":f.get("cash_per",""),"rd":f.get("rd"),"ni":f.get("ni"),"rev":f.get("rev"),"rdq":[f.get("rd_q1"),f.get("rd_q2")],"niq":[f.get("ni_q1"),f.get("ni_q2")],"flt":f.get("float"),"fltper":f.get("float_per",""),"sh":f.get("sh")}
    # manual map for groups (ticker, exchange, cik or None)
    MAN={"AstraZeneca":("AZN","Nasdaq"),"Lilly":("LLY","NYSE"),"Roche":("RHHBY","OTC"),"AbbVie":("ABBV","NYSE"),"Novartis":("NVS","NYSE"),"Sanofi":("SNY","Nasdaq"),"Pfizer":("PFE","NYSE"),"Merck & Co.":("MRK","NYSE"),"Amgen":("AMGN","Nasdaq"),"Johnson & Johnson":("JNJ","NYSE"),"GSK":("GSK","NYSE"),"Novo Nordisk":("NVO","NYSE"),"Takeda":("TAK","NYSE"),"Bristol Myers Squibb":("BMY","NYSE"),"Gilead":("GILD","Nasdaq"),"Boehringer Ingelheim":("private",""),"Bayer":("BAYRY","OTC"),"Regeneron":("REGN","Nasdaq"),"Vertex":("VRTX","Nasdaq"),"Biogen":("BIIB","Nasdaq"),"Astellas":("ALPMY","OTC"),"Daiichi Sankyo":("DSNKY","OTC"),"Eisai":("ESALY","OTC"),"Merck KGaA":("MKKGY","OTC"),"UCB":("UCBJY","OTC"),"Moderna":("MRNA","Nasdaq"),"BioNTech":("BNTX","Nasdaq"),"Otsuka":("OTSKY","OTC"),"Teva":("TEVA","NYSE"),"Alnylam":("ALNY","Nasdaq"),"Servier":("private",""),"Ipsen":("IPSEY","OTC"),"Jazz":("JAZZ","Nasdaq"),"Incyte":("INCY","Nasdaq"),"argenx":("ARGX","Nasdaq"),"Lundbeck":("HLUYY","OTC"),"BeiGene / BeOne":("ONC","Nasdaq"),"Hengrui":("600276","SSE"),"Qilu":("private",""),"Innovent":("1801","HKEX"),"Akeso":("9926","HKEX"),"Hansoh":("3692","HKEX"),"CTTQ":("1177","HKEX"),"Baili / SystImmune":("688506","SSE"),"Junshi":("1877","HKEX"),"Zai Lab":("ZLAB","Nasdaq"),"Kelun":("6990","HKEX"),"HUTCHMED":("HCM","Nasdaq"),"CSPC":("1093","HKEX"),"Sino Biopharm":("1177","HKEX"),"RemeGen":("9995","HKEX"),"Henlius":("2696","HKEX"),"Duality Bio":("9606","HKEX"),"Gan & Lee":("603087","SSE"),"Celltrion":("068270","KRX"),"Samsung Bioepis":("private",""),"Hanmi":("128940","KRX"),"Shionogi":("SGIOY","OTC"),"Kyowa Kirin":("KYKOF","OTC"),"Sumitomo Pharma":("DSPHF","OTC"),"Ono":("OPHLY","OTC"),"Mitsubishi Tanabe":("private",""),"Ascendis":("ASND","Nasdaq"),"Neurocrine":("NBIX","Nasdaq"),"Ionis":("IONS","Nasdaq"),"Sarepta":("SRPT","Nasdaq"),"BioMarin":("BMRN","Nasdaq"),"Insmed":("INSM","Nasdaq"),"Madrigal":("MDGL","Nasdaq"),"Viking":("VKTX","Nasdaq"),"Structure":("GPCR","Nasdaq"),"Revolution Medicines":("RVMD","Nasdaq"),"Summit":("SMMT","Nasdaq"),"Immunocore":("IMCR","Nasdaq"),"Roivant":("ROIV","Nasdaq"),"Intra-Cellular":("JNJ","NYSE"),"Apellis":("APLS","Nasdaq"),"Cytokinetics":("CYTK","Nasdaq"),"Nuvalent":("NUVL","Nasdaq"),"Arvinas":("ARVN","Nasdaq"),"Iovance":("IOVA","Nasdaq"),"Legend":("LEGN","Nasdaq"),"CRISPR Tx":("CRSP","Nasdaq"),"Intellia":("NTLA","Nasdaq"),"Beam":("BEAM","Nasdaq"),"Verve":("LLY","NYSE"),"Abbott":("ABT","NYSE"),"Colgate-Palmolive":("CL","NYSE"),"P&G":("PG","NYSE")}
    tkidx={tk["t"]:tk for tk in sec["tickers"]}
    MANOUT={}
    for g,(t,ex) in MAN.items():
        tk=tkidx.get(t); f=fin.get(str(tk["cik"]),{}) if tk else {}
        MANOUT[g]={"t":t,"ex":ex or (tk["ex"] if tk else ""),"cik":tk["cik"] if tk else None,"cash":f.get("cash"),"sti":f.get("sti"),"per":f.get("cash_per",""),"rd":f.get("rd"),"ni":f.get("ni"),"rev":f.get("rev"),"rdq":[f.get("rd_q1"),f.get("rd_q2")],"niq":[f.get("ni_q1"),f.get("ni_q2")],"flt":f.get("float"),"fltper":f.get("float_per",""),"sh":f.get("sh")}
    print("sec matched sponsors",len(SEC),"manual",len(MANOUT),"pulled",sec["pulled"])
except Exception as e:
    print("SEC join skipped:",e); MANOUT={}
# Regulatory calendar: company-disclosed PDUFA / AdCom / resubmission dates from SEC EDGAR full-text search (pull_pdufa.py)
REG={"pulled":"","source":"","window":[],"rows":[]}
try:
    pp=os.path.join(OUT,"pdufa_edgar.json")
    if os.path.exists(pp):
        j=json.load(open(pp)); REG={"pulled":j.get("pulled",""),"source":j.get("source",""),"window":j.get("window",[]),
            "rows":[{k:r.get(k) for k in ("kind","date","precision","priority","confidence","ticker","cik","company","asset","filed","form","source","sentence","history")} for r in j.get("rows",[])]}
        for r in REG["rows"]: r["sentence"]=(r.get("sentence") or "")[:300]
    print("regulatory dates",len(REG["rows"]),"pulled",REG["pulled"][:10])
except Exception as e: print("regulatory calendar skipped:",e)
# 13F specialist ownership (SEC EDGAR)
F13={"pulled":"","funds":[],"issuers":{}}
try:
    if os.path.exists(os.path.join(OUT,"f13_raw.json")):
        j=json.load(open(os.path.join(OUT,"f13_raw.json")))
        F13["pulled"]=j["pulled"]
        iss={}
        GEN=("Point72","Woodline","VIKING","Polar","FARALLON")  # multi-strategy / generalist: tracked but counted separately
        for f in j["funds"]:
            fl=f["filings"]
            if not fl: continue
            gen=any(x.lower() in f["name"].lower() for x in GEN)
            cur=fl[0]; prev=fl[1] if len(fl)>1 else None
            F13["funds"].append({"name":f["name"],"cik":f["cik"],"period":cur["period"],"n":cur["n"],"value":sum(h["value"] for h in cur["holdings"]),"gen":gen})
            def agg(fil):
                m={}
                for h in fil["holdings"]:
                    if h.get("put"): continue
                    k=norm(h["issuer"]); m.setdefault(k,{"issuer":h["issuer"],"value":0,"shares":0})
                    m[k]["value"]+=h["value"]; m[k]["shares"]+=h["shares"]
                return m
            c=agg(cur); p=agg(prev) if prev else {}
            for k,v in c.items():
                e=iss.setdefault(k,{"issuer":v["issuer"],"funds":[],"value":0,"value_prev":0,"n":0,"n_prev":0,"new":0,"exit":0,"ng":0,"vg":0})
                pv=p.get(k,{"value":0,"shares":0})
                e["funds"].append({"f":re.sub(r"\b(Lp|Llc|Inc|Ltd|L\.p\.|L\.l\.c\.)\b",lambda m:m.group(0).upper(),f["name"].title())[:32].rstrip(" ,"),"v":v["value"],"s":v["shares"],"ds":v["shares"]-pv["shares"],"new":k not in p,"g":gen})
                if gen: e["ng"]+=1; e["vg"]+=v["value"]; continue
                e["value"]+=v["value"]; e["value_prev"]+=pv["value"]; e["n"]+=1
                if k in p: e["n_prev"]+=1
                else: e["new"]+=1
            if not gen:
              for k,v in p.items():
                if k not in c:
                    e=iss.setdefault(k,{"issuer":v["issuer"],"funds":[],"value":0,"value_prev":0,"n":0,"n_prev":0,"new":0,"exit":0,"ng":0,"vg":0})
                    e["value_prev"]+=v["value"]; e["n_prev"]+=1; e["exit"]+=1
        for e in iss.values(): e["funds"].sort(key=lambda x:-x["v"])
        F13["issuers"]=iss
        # link trials by sponsor name / group / SEC title normalisation
        n=0
        for t in rows:
            k=norm(t["sp"])
            hit=k if k in iss else None
            if not hit:
                # try first two words of sponsor (e.g. "madrigal pharmaceuticals" vs "madrigal pharmaceuticals inc")
                w=k.split(" ")
                for cand in (" ".join(w[:2])," ".join(w[:1])):
                    if len(cand)>=6 and cand in iss: hit=cand; break
            t["f13"]=hit or ""
            if hit: n+=1
        print("13f funds",len(F13["funds"]),"issuers",len(iss),"trials linked",n)
except Exception as e:
    print("13F skipped:",e)
# Form 4 insider activity (SEC insider-transactions data sets)
INSD={"byTk":{},"byCik":{},"pulled":"","quarters":[],"short":{}}
try:
    if os.path.exists(os.path.join(OUT,"insiders_raw.json")):
        j=json.load(open(os.path.join(OUT,"insiders_raw.json")))
        INSD["pulled"]=j["pulled"]; INSD["quarters"]=j["quarters"]; INSD["short"]=j.get("short",{})
        need_cik={str(v["cik"]) for v in list(SEC.values())+list(MANOUT.values()) if v.get("cik")}
        need_tk={v["t"] for v in list(SEC.values())+list(MANOUT.values())}|{r["ticker"] for r in REG["rows"] if r.get("ticker")}
        for e in j["issuers"]:
            e={k:e.get(k) for k in ("cik","name","tk","buy_n","buy_usd","sell_n","sell_usd","buyers","last_buy","last_sell","own10_buy_usd","own10_sell_usd")}
            e["buy_usd"]=round(e["buy_usd"]); e["sell_usd"]=round(e["sell_usd"])
            if e["cik"] in need_cik or e["tk"] in need_tk:
                INSD["byCik"][e["cik"]]=e
                if e["tk"]: INSD["byTk"][e["tk"]]=e
        print("insiders kept",len(INSD["byCik"]),"quarters",INSD["quarters"])
except Exception as e: print("insiders skipped:",e)
# FDA
f=json.load(gzip.open(os.path.join(OUT,"fda_raw.json.gz"),"rt"))
fda=[]
for r in f["results"]:
    prods=r.get("products",[]); 
    if not prods: continue
    brand=prods[0].get("brand_name",""); gen=prods[0].get("active_ingredients",[{}])[0].get("name","") if prods[0].get("active_ingredients") else ""
    route=prods[0].get("route",""); df=prods[0].get("dosage_form","")
    for sub in r.get("submissions",[]):
        dt=sub.get("submission_status_date","")
        if sub.get("submission_status")!="AP" or dt<"20250101": continue
        fda.append({"app":r.get("application_number",""),"b":brand,"g":gen[:80],"sp":r.get("sponsor_name",""),"ty":sub.get("submission_type",""),"cls":sub.get("submission_class_code_description",""),"d":dt[:4]+"-"+dt[4:6]+"-"+dt[6:],"pr":sub.get("review_priority",""),"rt":route,"df":df})
fda.sort(key=lambda x:x["d"],reverse=True)
# longevity companies (VC funding file) → match to sponsors + aging-adjacent flag
import csv
LV=[]
for r in csv.DictReader(open(os.path.join(OUT,"..","longevity_funding_2026-07.csv"),encoding="utf-8-sig")):
    LV.append({"rank":int(r["rank"]),"co":r["company"],"what":r["what_they_do"],"raised":float(r["total_raised_usd_m"] or 0),"rounds":r["total_rounds"],"last":r["last_round_date"],"lastamt":r["last_round_amount_usd_m"],"lasttype":r["last_round_type"],"inv":r["key_investors"],"stage":r["current_stage"],"conf":r["confidence"],"nct":[]})
def stem(n): return re.sub(r"\b(labs?|biosciences?|bio|biotechnology|biotechnologies|therapeutics|pharmaceuticals?|medicine|life sciences|health|sciences?|inc\.?|ltd\.?)\b","",n.lower()).strip()
AG=re.compile(r"aging|ageing|senolytic|senescen|longevity|healthspan|lifespan|sarcopenia|frailty|rapamycin|mtor|nad\+|nicotinamide|klotho|gdf11|telomer|epigenetic reprogram|partial reprogram|geroprotect|geroscience|age-related|autophagy|mitochondrial dysfunction|progeria|werner|plasma exchange|young plasma|metformin",re.I)
for t in rows:
    t["ag"]=1 if AG.search(t["t"]+" "+t["ot"]+" "+" ".join(t["c"])+" "+" ".join(t["k"])+" "+t["sum"]) else 0
    t["lv"]=""
    sp=t["sp"].lower()
    for l in LV:
        st=stem(l["co"])
        if re.search(r"(?<![a-z])"+re.escape(l["co"].lower())+r"(?![a-z])",sp) or (len(st)>=4 and re.search(r"(?<![a-z])"+re.escape(st)+r"(?![a-z])",sp) and st not in ("life","gero","turn","unity","generation")):
            t["lv"]=l["co"]; l["nct"].append(t["id"]); break
print("longevity matches", sum(1 for t in rows if t["lv"]), "aging-adjacent", sum(1 for t in rows if t["ag"]))
print([(l["co"],len(l["nct"])) for l in LV if l["nct"]])
# Private-company enrichment from public sources: SEC Form D placements + NIH RePORTER awards (docs/private-data-sources.md)
FD={"pulled":"","source":"","issuers":{}}; NIH={"pulled":"","source":"","orgs":{}}
def _fd_compact(e):
    rel={}
    for f in e["filings"]:
        for nm,role in f.get("related",[]):
            if nm and nm not in rel: rel[nm]=role
    fil=[{"d":f["filed"],"s":f.get("sale") or "","sold":f.get("sold"),"off":f.get("offering"),"inv":f.get("investors"),"eq":bool(f.get("equity")),"debt":bool(f.get("debt"))} for f in e["filings"][-8:]]
    return {"name":e["name"],"cik":e["cik"],"prev":e.get("prev",[])[:3],"state":e.get("state",""),"country":e.get("country",""),"inc":e.get("inc",""),"n":e["n"],"sold":e["sold"],"first":e["filings"][0]["filed"] if e["filings"] else "","last":e.get("last",""),"fil":fil,"rel":[[k,v] for k,v in list(rel.items())[:10]]}
try:
    fp=os.path.join(OUT,"formd_raw.json")
    if os.path.exists(fp):
        j=json.load(open(fp)); iss=j["issuers"]; idx={}
        for cik,e in iss.items():
            for nm in [e["name"]]+e.get("prev",[]):
                k=norm(nm)
                if len(k)>=4 and k not in idx: idx[k]=cik
        def fd_match(name):
            k=norm(name)
            if k in idx: return idx[k]
            w=k.split()
            for cand in (" ".join(w[:3])," ".join(w[:2])):
                if len(cand)>=8 and cand in idx and len(w)>len(cand.split()): return idx[cand]
            return None
        used=set()
        for t in rows:
            if norm(t["sp"]) in SEC: continue
            cik=fd_match(t["sp"])
            if cik: t["fd"]=cik; used.add(cik)
        for l in LV:
            cik=fd_match(l["co"])
            if cik: l["fd"]=cik; used.add(cik)
        FD={"pulled":j.get("pulled",""),"source":j.get("source",""),"quarters":j.get("quarters",[]),"n_issuers_total":len(iss),"issuers":{c:_fd_compact(iss[c]) for c in used}}
        print("form d issuers",len(iss),"matched sponsors",sum(1 for t in rows if t.get("fd")),"trials ·",sum(1 for l in LV if l.get("fd")),"longevity companies")
except Exception as e: print("Form D skipped:",e)
try:
    npth=os.path.join(OUT,"nih_raw.json")
    if os.path.exists(npth):
        j=json.load(open(npth)); orgs={k:v for k,v in j.get("orgs",{}).items() if v.get("n")}
        for t in rows:
            if t["sp"] in orgs: t["nih"]=t["sp"]
        for l in LV:
            if l["co"] in orgs: l["nih"]=l["co"]
        NIH={"pulled":j.get("pulled",""),"source":j.get("source",""),"n_queried":len(j.get("orgs",{})),"orgs":{k:{"n":v["n"],"total":v["total"],"first_fy":v.get("first_fy"),"last_fy":v.get("last_fy"),"org":v.get("org",""),"agencies":v.get("agencies",[]),"top":v.get("top",[])[:3]} for k,v in orgs.items()}}
        print("nih orgs with awards",len(orgs),"of",len(j.get("orgs",{})),"queried · trials tagged",sum(1 for t in rows if t.get("nih")),"· longevity",sum(1 for l in LV if l.get("nih")))
except Exception as e: print("NIH skipped:",e)
# snapshot-to-snapshot diff (slips, firmed dates, status changes) against prev_snapshot.json.gz, rotated by `make rotate`
import diff as snapdiff
DIFF={}
pp=os.path.join(OUT,"prev_snapshot.json.gz")
if os.path.exists(pp):
    prev=json.load(gzip.open(pp,"rt"))
    ch,summ=snapdiff.diff_trials(prev["trials"],rows)
    newset=set(summ["new"])
    for t in rows:
        c=ch.get(t["id"])
        if c:
            t["chg"]=c["chg"]
            if c["slip"]: t["slip"]=c["slip"]
            if c["firmed"]: t["frm"]=1
        if t["id"] in newset: t["new"]=1
    DIFF={"prev_built":prev["meta"].get("built",""),"prev_pulled":prev["meta"].get("pulled",""),**summ}
    hist=os.path.join(OUT,"history"); os.makedirs(hist,exist_ok=True)
    hp=os.path.join(hist,"diff_"+d["pulled"][:10]+".json")
    json.dump({"pulled":d["pulled"],"prev_pulled":DIFF["prev_pulled"],"summary":{k:v for k,v in summ.items() if k not in("new","gone")},"new":summ["new"],"gone":summ["gone"],
               "changed":[{"id":i,**c} for i,c in ch.items()]},open(hp,"w"),separators=(",",":"))
    print("diff vs",DIFF["prev_pulled"][:10],{k:v for k,v in summ.items() if k not in("new","gone")},"new",len(summ["new"]),"gone",len(summ["gone"]),"→",os.path.basename(hp))
else: print("no prev_snapshot.json.gz — diff skipped")
snap={"meta":{"pulled":d["pulled"],"ct_query":d["query"],"n_trials":len(rows),"n_fda":len(fda),"built":datetime.datetime.utcnow().isoformat()+"Z"},"trials":rows,"fda":fda,"longevity":LV,"sec":SEC,"secman":MANOUT,"reg":REG,"f13":F13,"ins":INSD,"formd":FD,"nih":NIH,"diff":DIFF,"sec_pulled":sec.get("pulled","") if SEC else ""}
js=json.dumps(snap,separators=(",",":"),ensure_ascii=False)
open(os.path.join(OUT,"snapshot.json"),"w").write(js)
with gzip.open(os.path.join(OUT,"snapshot.json.gz"),"wb",compresslevel=9) as g: g.write(js.encode())
print(len(rows),len(fda),len(js),os.path.getsize(os.path.join(OUT,"snapshot.json.gz")))
print(collections.Counter(r["ta"] for r in rows).most_common())
print(collections.Counter(r["mo"] for r in rows).most_common())
