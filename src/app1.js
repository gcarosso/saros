/* SAROS (formerly Readout Radar) — core: payload, enrichment, filters, primitives */
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const TODAY=new Date(); TODAY.setHours(0,0,0,0);
const MONTHS=[];for(let y=2026;y<=2028;y++)for(let m=1;m<=12;m++)MONTHS.push(`${y}-${String(m).padStart(2,'0')}`);
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtM=m=>MON[+m.slice(5,7)-1]+" '"+m.slice(2,4);
const fmtUSD=n=>n==null?'—':(Math.abs(n)>=1e9?'$'+(n/1e9).toFixed(1)+'B':Math.abs(n)>=1e6?'$'+(n/1e6).toFixed(0)+'M':'$'+Math.round(n/1e3)+'k');
const fmtN=n=>n==null?'—':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e4?(n/1e3).toFixed(1)+'k':n.toLocaleString('en-US');
const fmtD=s=>{if(!s)return'—';if(s.length===7)return fmtM(s);const d=new Date(s+'T00:00:00');return d.getDate()+' '+MON[d.getMonth()]+" '"+String(d.getFullYear()).slice(2)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/* ENTITY / PLACE / TYPE — ash. Orange is reserved for phase, moons and today; everything else is metal and ash. */
const ASH={bone:'#B8C0C8',slate:'#6A8494',brass:'#A89070',pine:'#3E4944',warmbone:'#C9C2B6',taupe:'#7A756C',teal:'#4F6F7A',stone:'#5C534C',steel:'#8A97A3'};
const SERIES=[ASH.bone,ASH.slate,ASH.brass,ASH.teal,ASH.warmbone,ASH.taupe,ASH.steel,ASH.stone];
const GREY=ASH.pine;
const PH_ORDER=['P3','P2/P3','P2','P1/P2','P1'];
/* phase palette 'Corona heat': latest = hottest, P1 is volume without scream; stack order stays P3 (bottom) → P1 (top) */
const PH_COLOR={'P3':'#FF6A1A','P2/P3':'#E4591A','P2':'#C44A12','P1/P2':'#6E3B28','P1':'#2A221E'};
const TODAY_MARK='#FFB347';
const PH_CLS={'P3':'p3','P2/P3':'p23','P2':'p2','P1/P2':'p12','P1':'p1'};
const ST_ORDER=['RECRUITING','ACTIVE_NOT_RECRUITING','NOT_YET_RECRUITING','COMPLETED','ENROLLING_BY_INVITATION','TERMINATED','SUSPENDED','WITHDRAWN','UNKNOWN'];
const ST_LBL={RECRUITING:'Recruiting',ACTIVE_NOT_RECRUITING:'Active, not recruiting',NOT_YET_RECRUITING:'Not yet recruiting',COMPLETED:'Completed',ENROLLING_BY_INVITATION:'Enrolling by invitation',TERMINATED:'Terminated',SUSPENDED:'Suspended',WITHDRAWN:'Withdrawn',UNKNOWN:'Unknown'};
const TIER_ORDER=['Large pharma','China-domiciled','Japan / Korea','Other biopharma'];
const TIER_COLOR={'Large pharma':ASH.bone,'China-domiciled':ASH.slate,'Japan / Korea':ASH.brass,'Other biopharma':ASH.pine};
const LIST_COLOR={pub:ASH.warmbone,priv:ASH.taupe};

/* sponsor normalisation → group + tier */
const GROUPS=[
 [/astrazeneca|medimmune|alexion/i,'AstraZeneca',1],[/eli lilly|loxo/i,'Lilly',1],[/hoffmann-la roche|genentech|chugai|roche/i,'Roche',1],[/abbvie|allergan/i,'AbbVie',1],
 [/^novartis/i,'Novartis',1],[/sanofi|genzyme/i,'Sanofi',1],[/^pfizer|seagen|arena pharm/i,'Pfizer',1],[/merck sharp|^msd|merck & co|organon/i,'Merck & Co.',1],
 [/^amgen|horizon therapeutics/i,'Amgen',1],[/janssen|johnson & johnson|actelion/i,'Johnson & Johnson',1],[/glaxosmithkline|^gsk|viiv/i,'GSK',1],[/novo nordisk/i,'Novo Nordisk',1],
 [/^takeda|shire/i,'Takeda',1],[/bristol-myers|celgene|mirati|karuna/i,'Bristol Myers Squibb',1],[/gilead|kite pharma/i,'Gilead',1],[/boehringer/i,'Boehringer Ingelheim',1],
 [/^bayer/i,'Bayer',1],[/regeneron/i,'Regeneron',1],[/vertex/i,'Vertex',1],[/^biogen/i,'Biogen',1],[/astellas/i,'Astellas',1],[/daiichi/i,'Daiichi Sankyo',1],
 [/^eisai/i,'Eisai',1],[/merck kgaa|emd serono|merck healthcare/i,'Merck KGaA',1],[/^ucb/i,'UCB',1],[/moderna/i,'Moderna',0],[/biontech/i,'BioNTech',0],[/otsuka/i,'Otsuka',0],
 [/^teva/i,'Teva',0],[/alnylam/i,'Alnylam',0],[/servier/i,'Servier',0],[/ipsen/i,'Ipsen',0],[/jazz pharm/i,'Jazz',0],[/incyte/i,'Incyte',0],[/argenx/i,'argenx',0],[/lundbeck/i,'Lundbeck',0],
 [/beigene|beone/i,'BeiGene / BeOne',0],[/hengrui/i,'Hengrui',0],[/^qilu/i,'Qilu',0],[/innovent/i,'Innovent',0],[/akeso/i,'Akeso',0],[/hansoh/i,'Hansoh',0],[/chia tai tianqing|cttq/i,'CTTQ',0],
 [/sichuan baili|baili-bio|systimmune/i,'Baili / SystImmune',0],[/junshi/i,'Junshi',0],[/zai lab/i,'Zai Lab',0],[/kelun/i,'Kelun',0],[/hutchmed|hutchison/i,'HUTCHMED',0],[/cspc/i,'CSPC',0],
 [/sino biopharm/i,'Sino Biopharm',0],[/remegen/i,'RemeGen',0],[/henlius/i,'Henlius',0],[/duality/i,'Duality Bio',0],[/gan & lee/i,'Gan & Lee',0],[/celltrion/i,'Celltrion',0],[/samsung bioepis/i,'Samsung Bioepis',0],
 [/hanmi/i,'Hanmi',0],[/shionogi/i,'Shionogi',0],[/kyowa kirin/i,'Kyowa Kirin',0],[/sumitomo/i,'Sumitomo Pharma',0],[/^ono pharm/i,'Ono',0],[/mitsubishi tanabe/i,'Mitsubishi Tanabe',0],
 [/ascendis/i,'Ascendis',0],[/neurocrine/i,'Neurocrine',0],[/ionis/i,'Ionis',0],[/sarepta/i,'Sarepta',0],[/biomarin/i,'BioMarin',0],[/insmed/i,'Insmed',0],[/madrigal/i,'Madrigal',0],
 [/viking therap/i,'Viking',0],[/structure therap/i,'Structure',0],[/revolution medicines/i,'Revolution Medicines',0],[/summit therap/i,'Summit',0],[/immunocore/i,'Immunocore',0],[/roivant|immunovant|priovant/i,'Roivant',0],
 [/intra-cellular/i,'Intra-Cellular',0],[/apellis/i,'Apellis',0],[/cytokinetics/i,'Cytokinetics',0],[/nuvalent/i,'Nuvalent',0],[/arvinas/i,'Arvinas',0],[/iovance/i,'Iovance',0],[/legend biotech/i,'Legend',0],
 [/crispr therap/i,'CRISPR Tx',0],[/intellia/i,'Intellia',0],[/beam therap/i,'Beam',0],[/verve/i,'Verve',0],[/abbott/i,'Abbott',0],[/colgate/i,'Colgate-Palmolive',0],[/procter/i,'P&G',0],
];
const CN_RX=/\bco\.?,? ?ltd|jiangsu|shanghai|beijing|suzhou|hangzhou|guangzhou|shenzhen|chengdu|sichuan|nanjing|wuhan|zhejiang|tianjin|chongqing|hainan|shandong|guangdong|hubei|hunan|anhui|xiamen|hong kong|taiwan|taipei|china|sino|hengrui|qilu|akeso|innovent|beigene|beone|hansoh|cspc|chia tai|hutchmed|junshi|kelun|zai lab|simcere|luye|betta|ascentage|henlius|alphamab|biokin|baili|remegen|fosun|duality|kintor|genor|everest|harbour bio|jacobio|allist|haisco|hisun|huadong|kanion|yangtze|livzon|gan & lee|chipscreen|hutchison|salubris|dizal|inno|keymed|lepu|mabwell|transcenta|gloria|tonghua|jemincare|abbisko|kangfang|zelgen|elpiscience|antengene|cinda|frontier|brii|yuhan/i;
const JK_RX=/japan|tokyo|osaka|k\.k\.|kabushiki|daiichi|astellas|eisai|otsuka|shionogi|kyowa|sumitomo|ono pharm|mitsubishi tanabe|kissei|kowa|takeda|chugai|taiho|santen|meiji|nippon|kaken|maruho|mochida|zeria|torii|kyorin|senju|korea|seoul|celltrion|hanmi|samsung|daewoong|yuhan|chong kun|hk inno|gc biopharma|sk biopharm|lg chem|boryung|dong-a|jw pharm|ildong|huons|hlb|alteogen|abl bio|legochem|genexine/i;
function spGroup(name){for(const [rx,g] of GROUPS)if(rx.test(name))return g;return name.replace(/,? ?(inc\.?|llc|ltd\.?|limited|corp\.?|corporation|co\.|gmbh|s\.?a\.?|a\/s|plc|ag|b\.?v\.?|pty|srl|s\.p\.a\.?|n\.?v\.?)\s*$/i,'').replace(/\s*\(.*?\)\s*$/,'').trim();}
function spTier(name,group){const g=GROUPS.find(x=>x[1]===group);if(g&&g[2])return'Large pharma';if(JK_RX.test(name))return'Japan / Korea';if(CN_RX.test(name))return'China-domiciled';return'Other biopharma';}
function spDom(name,tier){if(tier==='China-domiciled')return'China / HK / TW';if(tier==='Japan / Korea')return'Japan / Korea';if(/\b(inc\.?|llc|corp)\b/i.test(name)||/(pharmaceuticals|therapeutics|biosciences|bio)\b/i.test(name)&&!/\b(gmbh|ag|s\.a\.|a\/s|plc|b\.v\.|ltd|limited|srl|s\.p\.a)\b/i.test(name))return'United States (inferred)';if(/\b(gmbh|ag)\b|germany|berlin/i.test(name))return'Germany / Switzerland';if(/\b(plc|ltd|limited)\b|uk\b|london|cambridge/i.test(name))return'UK / Ireland';if(/\b(s\.a\.|sas|s\.a\.s\.)\b|france|paris/i.test(name))return'France';if(/\b(a\/s|ab|oy|asa)\b|denmark|sweden|norway|finland/i.test(name))return'Nordics';if(/\b(b\.v\.|n\.v\.)\b|netherlands|belgium|srl/i.test(name))return'Benelux / Italy';if(/israel|ltd/i.test(name))return'Israel';if(/australia|pty/i.test(name))return'Australia';if(/india|pvt/i.test(name))return'India';return'Other / unclassified';}

/* base-rate priors (Wong, Siah & Lo 2019; approximate, phase-transition) */
const PRIOR={onc:{P1:.576,P2:.327,P3:.355,'P1/P2':.45,'P2/P3':.34},non:{P1:.735,P2:.60,P3:.68,'P1/P2':.66,'P2/P3':.64}};
function prior(t){const k=t.ta==='Oncology'?'onc':'non';return PRIOR[k][t.ph]??.5;}

/* readout-confidence heuristic */
function confidence(t){
  let s=55,why=[];
  if(t.pct==='ACTUAL'){s+=25;why.push(['Completion date reported as actual','+25','g']);}
  if(t.st==='COMPLETED'){s+=15;why.push(['Study completed','+15','g']);}
  else if(t.st==='ACTIVE_NOT_RECRUITING'){s+=12;why.push(['Enrollment closed, in follow-up','+12','g']);}
  else if(t.st==='RECRUITING'||t.st==='ENROLLING_BY_INVITATION'){if(t.days<180){s-=12;why.push(['Still recruiting <6 mo from PCD','−12','w']);}}
  else if(t.st==='NOT_YET_RECRUITING'){s-=22;why.push(['Not yet recruiting','−22','w']);}
  else if(['TERMINATED','WITHDRAWN','SUSPENDED'].includes(t.st)){s=8;why.push(['Study stopped','→ 8','c']);}
  if(t.nt==='ACTUAL'){s+=6;why.push(['Enrollment count is actual','+6','g']);}
  const stale=(TODAY-new Date(t.lu+'T00:00:00'))/864e5;
  if(stale>730){s-=22;why.push(['Registry record >24 mo stale','−22','c']);}else if(stale>365){s-=12;why.push(['Registry record >12 mo stale','−12','w']);}
  if(t.days<0&&t.pct!=='ACTUAL'){s-=15;why.push(['PCD passed, still estimated','−15','c']);}
  if(t.al==='RANDOMIZED'&&t.ph==='P3'){s+=3;why.push(['Randomised Phase 3','+3','g']);}
  if(t.n&&t.n<40&&t.ph==='P3'){s-=6;why.push(['Very small Phase 3 (n<40)','−6','w']);}
  return{score:clamp(Math.round(s),0,100),why};
}
function designTags(t){const d=[];if(t.reg&&t.reg.length)d.push('Regulatory date pending');if(t.own&&t.own.n>=3)d.push('Specialist-held ≥3');if(t.ins&&t.ins.buy_usd>=100000&&t.ins.buy_usd>t.ins.sell_usd)d.push('Insider buying');if(t.lst==='US-listed')d.push('US-listed');else if(t.lst==='Listed ex-US / OTC')d.push('Listed ex-US');else d.push('Private');if(t.ag)d.push('Aging-adjacent');if(t.lv)d.push('Longevity-funded');if(t.al==='RANDOMIZED')d.push('Randomised');if(t.mk&&t.mk!=='NONE')d.push('Blinded');const iv=t.iv.map(x=>x[1].toLowerCase()).join(' ');if(/placebo/.test(iv))d.push('Placebo-controlled');if(t.im==='SINGLE_GROUP')d.push('Single-arm');if(t.hr)d.push('Results posted');if(t.fda)d.push('FDA-regulated');if(t.fdi)d.push('Form D on file');if(t.nihi)d.push('NIH-funded');if(t.slip>=1&&!t.frm)d.push('Slipped');if(t.frm)d.push('Date firmed');if(t.new)d.push('New this snapshot');return d;}
function slipBadge(t){if(t.slip&&!t.frm)return ` <span class="badge" style="color:${t.slip>0?'var(--crit)':'var(--good)'};border-color:${t.slip>0?'rgba(229,72,77,.4)':'rgba(47,191,113,.4)'}" data-tip="Primary completion moved ${t.slip>0?'out':'in'} by ${Math.abs(t.slip)} month${Math.abs(t.slip)>1?'s':''} since the previous snapshot">${t.slip>0?'+':''}${t.slip} mo</span>`;if(t.frm)return ' <span class="badge nme" data-tip="Date firmed since the previous snapshot: a placeholder or estimate became a specific or actual date">firmed</span>';return '';}

let BENCH={}, F13={funds:[],issuers:{},pulled:''}, INS={byTk:{},byCik:{},pulled:'',quarters:[],short:{}};
let DATA=null, T=[], FDA=[], META={}, IDX=new Map(), REG={rows:[],byTk:{},pulled:'',source:''}, DIFF={}, FD={issuers:{}}, NIH={orgs:{}};
function normName(n){n=n.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9 ]/g,' ').replace(/\b(inc|corp|corporation|ltd|limited|plc|llc|co|company|holdings?|the|sa|ag|nv|bv|spa|se|kk|kabushiki kaisha|group|usa|us)\b/g,' ');return n.replace(/\s+/g,' ').trim();}
function secFor(t){const a=DATA.sec&&DATA.sec[normName(t.sp)];if(a)return a;const m=DATA.secman&&DATA.secman[t.grp];return m||null;}
function listing(sec){if(!sec)return'Unlisted / private';if(sec.t==='private')return'Unlisted / private';return['Nasdaq','NYSE','NYSE American','NYSE Arca','CBOE'].includes(sec.ex)?'US-listed':'Listed ex-US / OTC';}
function runway(sec){if(!sec||sec.cash==null)return null;const cash=(sec.cash||0)+(sec.sti||0);const q=(sec.niq||[]).filter(x=>x!=null);let burn=null;if(q.length)burn=-q.reduce((a,b)=>a+b,0)/q.length*4;else if(sec.ni!=null)burn=-sec.ni;if(burn==null||burn<=0)return{cash,burn,yrs:Infinity};return{cash,burn,yrs:cash/burn};}
function enrich(){
  const t0=performance.now();
  if(DATA.f13){F13=DATA.f13;}
  if(DATA.ins){INS=DATA.ins;}
  DIFF=DATA.diff||{};FD=DATA.formd||{issuers:{}};NIH=DATA.nih||{orgs:{}};
  if(DATA.reg){REG.rows=(DATA.reg.rows||[]).slice().sort((a,b)=>a.date<b.date?-1:1);REG.pulled=DATA.reg.pulled||'';REG.source=DATA.reg.source||'';REG.byTk={};REG.rows.forEach(r=>{if(r.ticker)(REG.byTk[r.ticker]=REG.byTk[r.ticker]||[]).push(r);});}
  T=DATA.trials.map(t=>{
    const full=t.pcd.length===7?t.pcd+'-15':t.pcd;
    const d=new Date(full+'T00:00:00');
    t.pd=d;t.pm=t.pcd.slice(0,7);t.pq=t.pm.slice(0,4)+' Q'+(Math.floor((+t.pm.slice(5,7)-1)/3)+1);
    t.days=Math.round((d-TODAY)/864e5);
    t.grp=spGroup(t.sp);t.tier=spTier(t.sp,t.grp);t.dom=spDom(t.sp,t.tier);t.sec=secFor(t);t.lst=listing(t.sec);
    t.own=t.f13&&F13.issuers[t.f13]?F13.issuers[t.f13]:null;t.ins=(t.sec&&t.sec.cik&&INS.byCik[String(t.sec.cik)])||(t.sec&&t.sec.t!=='private'&&INS.byTk[t.sec.t])||null;t.reg=(t.sec&&t.sec.t!=='private'&&REG.byTk[t.sec.t])||null;t.mcap=(t.sec&&t.sec.flt)||null;t.fdi=(t.fd&&FD.issuers[t.fd])||null;t.nihi=(t.nih&&NIH.orgs[t.nih])||null;
    const c=confidence(t);t.conf=c.score;t.why=c.why;t.pri=prior(t);t.dsg=designTags(t);
    t.hay=(t.id+' '+t.t+' '+t.ot+' '+t.ac+' '+t.sp+' '+t.grp+' '+t.c.join(' ')+' '+t.k.join(' ')+' '+t.iv.map(x=>x[1]).join(' ')+' '+(t.moa||[]).join(' ')+' '+(t.sec&&t.sec.t!=='private'?t.sec.t:'')).toLowerCase();
    IDX.set(t.id,t);return t;
  });
  /* trial-health benchmarks: enrollment velocity + site density vs area×phase median */
  T.forEach(t=>{const sd=t.sd?new Date((t.sd.length===7?t.sd+'-15':t.sd)+'T00:00:00'):null;const mo=sd?(t.pd-sd)/2629800000:null;t.mos=mo&&mo>1?mo:null;t.vel=t.mos&&t.n?t.n/t.mos:null;t.spp=t.n&&t.ns?t.ns/t.n*100:null;});
  const grp={};T.forEach(t=>{const k=t.ta+'|'+t.ph;(grp[k]=grp[k]||{v:[],s:[]});if(t.vel)grp[k].v.push(t.vel);if(t.spp)grp[k].s.push(t.spp);});
  const med=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b[b.length>>1];};
  BENCH={};Object.entries(grp).forEach(([k,g])=>BENCH[k]={vel:med(g.v),spp:med(g.s),n:g.v.length});
  T.forEach(t=>{const b=BENCH[t.ta+'|'+t.ph]||{};t.velR=t.vel&&b.vel?t.vel/b.vel:null;t.sppR=t.spp&&b.spp?t.spp/b.spp:null;if(t.velR!=null&&t.velR<0.5&&t.st!=='COMPLETED'&&t.pct!=='ACTUAL'){t.conf=clamp(t.conf-6,0,100);t.why.push(['Enrolling below half the peer median pace','−6','w']);}decide(t);});
  FDA=DATA.fda.map(f=>{f.kind=f.app.startsWith('ANDA')?'ANDA':f.app.startsWith('BLA')?'BLA':'NDA';f.nme=/type 1|type 2/i.test(f.cls);f.grp=spGroup(f.sp);return f;});
  META=DATA.meta;
  return performance.now()-t0;
}

/* ---------- filters ---------- */
const CURM=TODAY.toISOString().slice(0,7);
const DEF_WIN=[MONTHS.includes(CURM)?CURM:MONTHS[0],'2028-12'];
const F={win:[...DEF_WIN],ph:new Set(),st:new Set(),tier:new Set(),ta:new Set(),mo:new Set(),moa:new Set(),dsg:new Set(),nmin:0,moaq:'',q:'',month:null,grp:null,cell:null,wl:false,
  reset(k){if(k==='win'){F.win=[...DEF_WIN];$('#win0').value=F.win[0];$('#win1').value=F.win[1];}else F[k].clear();App.update();},
  toggle(k,v,solo){const s=F[k];if(solo){if(s.size===1&&s.has(v))s.clear();else{s.clear();s.add(v);}}else{s.has(v)?s.delete(v):s.add(v);}App.update();},
  clearFocus(){F.month=null;F.grp=null;F.cell=null;F.inv=null;},
  active(){return ['ph','st','tier','ta','mo','moa','dsg'].reduce((a,k)=>a+F[k].size,0)+(F.win[0]!==DEF_WIN[0]||F.win[1]!==DEF_WIN[1]?1:0)+(F.nmin>0?1:0)+(F.q?1:0)+(F.month||F.grp||F.cell||F.inv?1:0)+(F.wl?1:0);},
  clearAll(){F.win=[...DEF_WIN];$('#win0').value=F.win[0];$('#win1').value=F.win[1];['ph','st','tier','ta','mo','moa','dsg'].forEach(k=>F[k].clear());F.moaq='';$('#moaq').value='';F.nmin=0;$('#nmin').value=0;$('#nlbl').textContent='0';F.q='';$('#q').value='';F.clearFocus();F.wl=false;$('#wlbtn').classList.remove('primary');App.update();toast('Filters cleared');}
};
function passes(t,skip){
  if(skip!=='win'&&(t.pm<F.win[0]||t.pm>F.win[1]))return false;
  if(skip!=='ph'&&F.ph.size&&!F.ph.has(t.ph))return false;
  if(skip!=='st'&&F.st.size&&!F.st.has(t.st))return false;
  if(skip!=='tier'&&F.tier.size&&!F.tier.has(t.tier))return false;
  if(skip!=='ta'&&F.ta.size&&!F.ta.has(t.ta))return false;
  if(skip!=='mo'&&F.mo.size&&!F.mo.has(t.mo))return false;
  if(skip!=='moa'&&F.moa.size){const m=t.moa||[];if(!m.some(x=>F.moa.has(x)))return false;}
  if(skip!=='dsg'&&F.dsg.size){for(const d of F.dsg)if(!t.dsg.includes(d))return false;}
  if(t.n!=null&&t.n<F.nmin&&F.nmin>0)return false; if(t.n==null&&F.nmin>0)return false;
  if(F.q){const qs=F.q.toLowerCase().split(/\s+/).filter(Boolean);for(const w of qs)if(!t.hay.includes(w))return false;}
  if(F.wl&&!WL.has(t.id))return false;
  if(F.inv&&!heldBy(t,F.inv))return false;
  return true;
}
let BASE=[],VIEW=[];
function applyFilters(){
  BASE=T.filter(t=>passes(t));
  VIEW=BASE.filter(t=>(!F.month||t.pm===F.month)&&(!F.grp||t.grp===F.grp)&&(!F.cell||(t.ta===F.cell[0]&&t.ph===F.cell[1])));
}
const count=(arr,key)=>{const m=new Map();for(const t of arr){const k=typeof key==='function'?key(t):t[key];m.set(k,(m.get(k)||0)+1);}return m;};
const sum=(arr,f)=>arr.reduce((a,t)=>a+(f(t)||0),0);

/* ---------- decision layer: reliability, cash-to-event, impact, next action (rules, transparent) ---------- */
const PH_W={'P3':1,'P2/P3':.8,'P2':.55,'P1/P2':.35,'P1':.2};
function decide(t){
  const stopped=['TERMINATED','WITHDRAWN','SUSPENDED'].includes(t.st);
  t.rel=stopped?'stopped':t.pct==='ACTUAL'?'firm':(t.slip>=1&&!t.frm)?'slipped':'estimated';
  t.m2e=t.days>0?t.days/30.4:0;
  const profitable=t.tier==='Large pharma'||(t.sec&&((t.sec.ni||0)>0||(t.sec.rev||0)>1e9));
  t.cashm=profitable?null:(t.sec?((r=>r&&isFinite(r.yrs)?r.yrs*12:null)(runway(t.sec))):null);
  t.binding=t.cashm!=null&&t.days>0&&t.cashm<t.m2e;
  const loa=t.pri;const mc=t.mcap;
  const size=mc?0.55+0.45*clamp(Math.log10(mc/1e8)/2.5,0,1):0.6;
  const firm={firm:1,estimated:.7,slipped:.6,stopped:0}[t.rel];
  const crowd=t.own&&t.own.n>=5?.85:1;
  t.impact=PH_W[t.ph]*(0.5+loa)*size*firm*crowd;t.impactB=t.impact>=.62?'High':t.impact>=.35?'Med':'Low';
  let a,why;
  if(stopped){a='Pass';why='study stopped';}
  else if(t.binding){a='Pass / hedge';why=`cash ${Math.round(t.cashm)} mo < ${Math.round(t.m2e)} mo to readout`;}
  else if(t.days<0&&t.pct!=='ACTUAL'){a='Wait';why='completion date passed, still estimated';}
  else if(t.rel==='estimated'&&t.days<=90){a='Wait';why='date unconfirmed inside 90 d';}
  else if(t.rel==='slipped'){a='Wait';why=`date slipped ${t.slip} mo since last snapshot`;}
  else if(t.own&&t.own.new>=2&&t.days<=180){a='Review flow';why=`${t.own.new} specialists new last quarter`;}
  else if(t.ins&&t.ins.buy_usd>=250000&&t.ins.buy_n>=2&&t.days<=180){a='Review flow';why='insider buy cluster';}
  else if(t.velR!=null&&t.velR<0.5&&t.st==='RECRUITING'){a='Diligence enrollment';why=`pace ${t.velR.toFixed(1)}× peer median`;}
  else if(t.conf>=75&&t.rel==='firm'&&t.ph==='P3'){a='Size / diligence endpoints';why='firm date, high confidence';}
  else if(t.ph==='P3'&&t.days<=180){a='Diligence endpoints';why='pivotal readout inside 6 mo';}
  else {a='Monitor';why=t.days>365?'readout > 12 mo out':'no flag';}
  t.action=a;t.actionWhy=why;
}
/* ---------- investor lookup ---------- */
let LVINV={};function buildInvestors(){LVINV={};(DATA.longevity||[]).forEach(l=>{(l.inv||'').split(';').map(x=>x.trim()).filter(x=>x&&!/not disclosed|undisclosed|investors$/i.test(x)).forEach(v=>{(LVINV[v]=LVINV[v]||new Set()).add(l.co);});});}
function heldBy(t,inv){if(t.own&&t.own.funds.some(f=>f.f===inv))return true;if(t.lv&&LVINV[inv]&&LVINV[inv].has(t.lv))return true;return false;}
function investorIndex(){const out=[];const seen=new Set();F13.funds.forEach(f=>{const n=f.name.title?f.name:f.name;const key=(f.name||'').title?f.name:f.name;});
  const byFund={};T.forEach(t=>{if(t.own)t.own.funds.forEach(f=>{const e=byFund[f.f]=byFund[f.f]||{name:f.f,kind:f.g?'generalist 13F':'specialist 13F',trials:0,issuers:new Set()};e.trials++;e.issuers.add(t.f13);});});
  Object.values(byFund).forEach(e=>out.push({name:e.name,kind:e.kind,trials:e.trials,n:e.issuers.size}));
  Object.entries(LVINV).forEach(([v,cos])=>{const tr=T.filter(t=>t.lv&&cos.has(t.lv)).length;out.push({name:v,kind:'longevity VC',trials:tr,n:cos.size});});
  return out;}
/* ---------- watchlist ---------- */
const WL={s:new Set(),load(){try{const v=JSON.parse(localStorage.getItem('rr.wl')||'[]');v.forEach(x=>WL.s.add(x));}catch(e){}},save(){try{localStorage.setItem('rr.wl',JSON.stringify([...WL.s]));}catch(e){}},
  has:id=>WL.s.has(id),toggle(id){WL.s.has(id)?WL.s.delete(id):WL.s.add(id);WL.save();$('#wlcount').textContent=WL.s.size;toast(WL.s.has(id)?'Added to watchlist':'Removed from watchlist');App.update(true);}};

/* ---------- tooltip ---------- */
const Tip={el:null,show(html,e){Tip.el.innerHTML=html;Tip.el.style.display='block';Tip.move(e);},move(e){const w=Tip.el.offsetWidth,h=Tip.el.offsetHeight;let x=e.clientX+14,y=e.clientY+14;if(x+w>innerWidth-8)x=e.clientX-w-14;if(y+h>innerHeight-8)y=e.clientY-h-14;Tip.el.style.left=x+'px';Tip.el.style.top=y+'px';},hide(){Tip.el.style.display='none';}};
function bindTips(root){$$('[data-tip]',root).forEach(el=>{if(el._tip)return;el._tip=1;el.addEventListener('mouseenter',e=>Tip.show(el.dataset.tip,e));el.addEventListener('mousemove',Tip.move);el.addEventListener('mouseleave',Tip.hide);});}
/* ---------- plain-language glossary for hover explanations (data-gl="key" or gl('key')) ---------- */
/* GLOSS (hover glossary) is generated by build.py from src/pages/glossary.txt */
const gl=k=>GLOSS[k]?` data-tip="${esc(GLOSS[k])}"`:'';
function applyGloss(root){$$('[data-gl]',root).forEach(el=>{if(GLOSS[el.dataset.gl]&&!el.dataset.tip)el.dataset.tip=esc(GLOSS[el.dataset.gl]);});bindTips(root);}

function trialTip(t){return `<div class="t">${esc(t.t)}</div><div class="k">${esc(t.id)} · ${esc(t.grp)}</div><hr><div class="row"><span class="k">Phase</span><b>${esc(t.ph)}</b></div><div class="row"><span class="k">Status</span><b>${esc(ST_LBL[t.st]||t.st)}</b></div><div class="row"><span class="k">Primary completion</span><b>${fmtD(t.pcd)} ${t.pct==='ACTUAL'?'· actual':'· est.'}</b></div><div class="row"><span class="k">Enrollment</span><b>${fmtN(t.n)} ${t.nt==='ACTUAL'?'actual':'est.'}</b></div><div class="row"><span class="k">Readout confidence</span><b>${t.conf}</b></div><div class="row"><span class="k">Area / modality</span><b>${esc(t.ta)} · ${esc(t.mo)}</b></div><hr><div class="k">${esc(t.c.slice(0,3).join(' · '))}</div>`;}
let toastT;function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),1800);}

/* ---------- SVG primitives ---------- */
function stackedBars(el,{cats,series,colors,labels,onClick,sel,todayIdx,height=200,tipFn}){
  const W=el.clientWidth||900,H=height,pad={l:40,r:8,t:10,b:26};
  const totals=cats.map((_,i)=>series.reduce((a,s)=>a+(s.v[i]||0),0));const max=Math.max(1,...totals);
  const iw=(W-pad.l-pad.r)/cats.length,bw=Math.max(2,iw*0.72);
  const y=v=>pad.t+(H-pad.t-pad.b)*(1-v/max);
  const ticks=niceTicks(max,4);
  let s=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">`;
  s+='<g class="grid">'+ticks.map(v=>`<line x1="${pad.l}" x2="${W-pad.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${pad.l-6}" y="${y(v)+3}" text-anchor="end">${v}</text>`).join('')+'</g>';
  cats.forEach((c,i)=>{let acc=0;const x=pad.l+i*iw+(iw-bw)/2;
    series.forEach((sr,j)=>{const v=sr.v[i]||0;if(!v)return;const y1=y(acc+v),y0=y(acc);acc+=v;const dim=sel&&sel!==c;
      s+=`<rect class="bar${dim?' dim':''}${sel===c?' sel':''}" x="${x}" y="${y1}" width="${bw}" height="${Math.max(0,y0-y1-1)}" fill="${colors[j]}" data-i="${i}" data-j="${j}" rx="1"/>`;});
    if(cats.length<=26||i%3===0)s+=`<text x="${x+bw/2}" y="${H-8}" text-anchor="middle">${labels?labels[i]:c}</text>`;
    if(totals[i]&&iw>22)s+=`<text x="${x+bw/2}" y="${y(totals[i])-4}" text-anchor="middle" style="fill:var(--ink-2)">${totals[i]}</text>`;
  });
  if(todayIdx!=null&&todayIdx>=0){const tx=pad.l+todayIdx*iw;s+=`<line class="today" x1="${tx}" x2="${tx}" y1="${pad.t}" y2="${H-pad.b}"/><text x="${tx+4}" y="${pad.t+9}" style="fill:${TODAY_MARK}">today</text>`;}
  s+='</svg>';el.innerHTML=s;
  $$('rect.bar',el).forEach(r=>{const i=+r.dataset.i,j=+r.dataset.j;
    r.addEventListener('mouseenter',e=>Tip.show(tipFn?tipFn(i,j):`<div class="t">${labels?labels[i]:cats[i]}</div>`+series.map((sr,k)=>`<div class="row"><span class="k">${esc(sr.name)}</span><b>${sr.v[i]||0}</b></div>`).join('')+`<hr><div class="row"><span class="k">Total</span><b>${totals[i]}</b></div>`,e));
    r.addEventListener('mousemove',Tip.move);r.addEventListener('mouseleave',Tip.hide);if(onClick)r.addEventListener('click',()=>onClick(cats[i],series[j]));});
}
function niceTicks(max,n){if(max<=5)return [...Array(Math.floor(max)+1).keys()];const raw=max/n,p=Math.pow(10,Math.floor(Math.log10(raw)));const f=raw/p;const step=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p;const out=[];for(let v=0;v<=max;v+=step)out.push(Math.round(v*100)/100);return out;}
function hbars(el,rows,{colors,onClick,sel,fmt=fmtN,tipFn,vfn,max:maxIn}){ /* rows: [{name,parts:[..],total,key}] */
  const max=maxIn||Math.max(1,...rows.map(r=>r.total));
  el.innerHTML=rows.map(r=>`<div class="hbar${onClick?' act':''}${sel===r.key?' on':''}" data-key="${esc(r.key)}"><span class="nm" title="${esc(r.name)}">${esc(r.name)}</span><div class="tr">${r.parts.map((p,j)=>p?`<i style="width:${p/max*100}%;background:${colors[j]}"></i>`:'').join('')}</div><span class="v">${vfn?vfn(r):fmt(r.total)}</span></div>`).join('');
  $$('.hbar',el).forEach((h,i)=>{const r=rows[i];if(onClick)h.addEventListener('click',()=>onClick(r));if(tipFn){h.addEventListener('mouseenter',e=>Tip.show(tipFn(r),e));h.addEventListener('mousemove',Tip.move);h.addEventListener('mouseleave',Tip.hide);}});
}
function sparkline(vals,w=60,h=18,color='var(--acc)'){const max=Math.max(1,...vals);const pts=vals.map((v,i)=>`${(i/(vals.length-1))*w},${h-(v/max)*(h-2)-1}`).join(' ');return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="${w}" cy="${h-(vals[vals.length-1]/max)*(h-2)-1}" r="2" fill="${color}"/></svg>`;}
function heatColor(v,max){const t=max?Math.sqrt(v/max):0;const steps=['#171c21','#22303a','#2d4250','#3a5566','#4a697c','#5a7c90','#6f91a4','#8aa8ba'];return v===0?'var(--g2)':steps[Math.min(7,Math.floor(t*7.99))];}

const inWin=t=>t.pm>=F.win[0]&&t.pm<=F.win[1];
/* moon phase for a date (synodic month from the 2000-01-06 18:14 UTC new moon); returns 0..1, 0 = new, .5 = full */
function moonPhase(d){const days=(d-Date.UTC(2000,0,6,18,14))/864e5;return ((days/29.530588853)%1+1)%1;}
function moonSVG(p,r=6){
  /* flat moon in the mark's orange: only the lit part is drawn, no outline, no shading; lit side on the right while waxing */
  const k=Math.cos(2*Math.PI*p);const waxing=p<.5;const lit='#FF6A1A',dark='var(--g1)';
  const half=waxing?`M0,-${r}A${r},${r} 0 0 1 0,${r}Z`:`M0,-${r}A${r},${r} 0 0 0 0,${r}Z`;
  const gib=(waxing&&k<0)||(!waxing&&k>0);
  return `<svg viewBox="-${r+1} -${r+1} ${2*r+2} ${2*r+2}" shape-rendering="geometricPrecision"><path d="${half}" fill="${lit}"/><ellipse rx="${(Math.abs(k)*r).toFixed(2)}" ry="${r}" fill="${gib?lit:dark}"/></svg>`;}
function moonName(p){return p<.03||p>.97?'New moon':p<.22?'Waxing crescent':p<.28?'First quarter':p<.47?'Waxing gibbous':p<.53?'Full moon':p<.72?'Waning gibbous':p<.78?'Last quarter':'Waning crescent';}
function moonEvents(y,m){ /* day of the new and full moon inside a calendar month (UTC) */
  const out={};let prev=null;
  for(let d=1;d<=31;d++){const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCMonth()!==m-1)break;const p=moonPhase(dt);
    if(prev!=null){if(prev>.9&&p<.1)out.nm=d;if(prev<.5&&p>=.5)out.fm=d;}prev=p;}
  return out;}
/* vbars: small vertical bar chart with a zero baseline (negatives allowed), grouped series, direct value labels */
function vbars(el,{cats,series,height=150,fmt=v=>v,hi,ylab}){
  const vals=series.flatMap(s=>s.v);const max=Math.max(0,...vals),min=Math.min(0,...vals);const span=(max-min)||1;
  const W=el.clientWidth||420,H=height,pad={l:8,r:8,t:18,b:min<0?36:22};
  const y=v=>pad.t+(H-pad.t-pad.b)*(max-v)/span;const gw=(W-pad.l-pad.r)/cats.length,n=series.length,bw=Math.min(34,gw*0.72/n);
  let s=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px"><line class="zero" x1="${pad.l}" x2="${W-pad.r}" y1="${y(0)}" y2="${y(0)}"/>`;
  cats.forEach((c,i)=>{const gx=pad.l+i*gw+(gw-bw*n-(n-1)*3)/2;
    series.forEach((sr,j)=>{const v=sr.v[i];if(v==null)return;const x=gx+j*(bw+3),y0=y(0),y1=y(v);const col=hi&&hi(i,j)!=null?hi(i,j):sr.color;
      s+=`<rect class="bar" x="${x}" y="${Math.min(y0,y1)}" width="${bw}" height="${Math.max(1,Math.abs(y0-y1))}" fill="${col}" rx="1.5" data-tip="${esc(sr.name?sr.name+' · ':'')}${esc(String(c))}: ${esc(fmt(v))}"/><text class="vlab" x="${x+bw/2}" y="${v>=0?y1-4:y1+11}" text-anchor="middle">${esc(fmt(v))}</text>`;});
    s+=`<text x="${pad.l+i*gw+gw/2}" y="${H-7}" text-anchor="middle">${esc(String(c))}</text>`;});
  s+='</svg>';el.innerHTML=s;bindTips(el);
}
/* dumbbell: two values per row joined by a line (e.g. all trials vs Phase 3) */
function dumbbell(el,{rows,colors,fmt=fmtN,labels,tipFn,onClick,labelW=150,rowH=24}){
  const W=el.clientWidth||520,pad={l:labelW,r:44,t:6,b:20},H=pad.t+pad.b+rows.length*rowH;const max=Math.max(1,...rows.map(r=>Math.max(r.a,r.b)));
  const x=v=>pad.l+v/max*(W-pad.l-pad.r);const ticks=niceTicks(max,4);
  let s=`<svg viewBox="0 0 ${W} ${H}" style="height:${H}px"><g class="grid">${ticks.map(v=>`<line x1="${x(v)}" x2="${x(v)}" y1="${pad.t}" y2="${H-pad.b}"/><text x="${x(v)}" y="${H-6}" text-anchor="middle">${v}</text>`).join('')}</g>`;
  rows.forEach((r,i)=>{const cy=pad.t+i*rowH+rowH/2;s+=`<g class="${onClick?'act':''}" data-i="${i}" style="cursor:${onClick?'pointer':'default'}"><rect x="0" y="${cy-rowH/2}" width="${W}" height="${rowH}" fill="transparent"/><text class="rowlbl" x="${pad.l-8}" y="${cy+4}" text-anchor="end">${esc(r.name)}</text><line x1="${x(r.b)}" x2="${x(r.a)}" y1="${cy}" y2="${cy}" stroke="var(--line-2)" stroke-width="2"/><circle cx="${x(r.b)}" cy="${cy}" r="4.5" fill="${colors[1]}" stroke="var(--g1)" stroke-width="1"/><circle cx="${x(r.a)}" cy="${cy}" r="4.5" fill="${colors[0]}" stroke="var(--g1)" stroke-width="1"/><text class="vlab" x="${x(r.a)+8}" y="${cy+4}">${esc(fmt(r.a))}</text></g>`;});
  s+='</svg>';el.innerHTML=s;const svg=el.firstChild;
  $$('g[data-i]',svg).forEach(g=>{const r=rows[+g.dataset.i];if(tipFn){g.addEventListener('mouseenter',e=>Tip.show(tipFn(r),e));g.addEventListener('mousemove',Tip.move);g.addEventListener('mouseleave',Tip.hide);}if(onClick)g.addEventListener('click',()=>onClick(r));});
}
/* dotplot: one dot per row on a (log) x axis, dot area ∝ size; value label beside */
function dotplot(el,{rows,dom,ticks,tickFmt=v=>v,color,size,fmt=v=>v,tipFn,labelW=170,rowH=22}){
  const W=el.clientWidth||520,pad={l:labelW,r:60,t:6,b:20},H=pad.t+pad.b+rows.length*rowH;
  const x=v=>pad.l+(v-dom[0])/(dom[1]-dom[0])*(W-pad.l-pad.r);const smax=Math.max(1,...rows.map(size||(()=>1)));
  let s=`<svg viewBox="0 0 ${W} ${H}" style="height:${H}px"><g class="grid">${ticks.map(v=>`<line x1="${x(v)}" x2="${x(v)}" y1="${pad.t}" y2="${H-pad.b}"/><text x="${x(v)}" y="${H-6}" text-anchor="middle">${esc(tickFmt(v))}</text>`).join('')}</g>`;
  rows.forEach((r,i)=>{const cy=pad.t+i*rowH+rowH/2,rr=size?3+7*Math.sqrt(size(r)/smax):5;s+=`<g data-i="${i}"><rect x="0" y="${cy-rowH/2}" width="${W}" height="${rowH}" fill="transparent"/><text class="rowlbl" x="${pad.l-8}" y="${cy+4}" text-anchor="end">${esc(r.name)}</text><line x1="${pad.l}" x2="${x(r.x)}" y1="${cy}" y2="${cy}" stroke="var(--line)" stroke-dasharray="2 3"/><circle cx="${x(r.x)}" cy="${cy}" r="${rr.toFixed(1)}" fill="${color(r)}" fill-opacity=".9" stroke="var(--g1)" stroke-width="1"/><text class="vlab" x="${x(r.x)+rr+6}" y="${cy+4}">${esc(fmt(r))}</text></g>`;});
  s+='</svg>';el.innerHTML=s;$$('g[data-i]',el).forEach(g=>{const r=rows[+g.dataset.i];if(tipFn){g.addEventListener('mouseenter',e=>Tip.show(tipFn(r),e));g.addEventListener('mousemove',Tip.move);g.addEventListener('mouseleave',Tip.hide);}});
}
/* rangeplot: distribution summary per row on a (log) x axis — p10–p90 whisker, p25–p75 bar, median tick, n */
function rangeplot(el,{rows,dom,ticks,tickFmt=v=>v,color,fmt=v=>v,labelW=90,rowH=34}){
  const W=el.clientWidth||520,pad={l:labelW,r:56,t:8,b:20},H=pad.t+pad.b+rows.length*rowH;
  const x=v=>clamp(pad.l+(v-dom[0])/(dom[1]-dom[0])*(W-pad.l-pad.r),pad.l,W-pad.r);
  let s=`<svg viewBox="0 0 ${W} ${H}" style="height:${H}px"><g class="grid">${ticks.map(v=>`<line x1="${x(v)}" x2="${x(v)}" y1="${pad.t}" y2="${H-pad.b}"/><text x="${x(v)}" y="${H-6}" text-anchor="middle">${esc(tickFmt(v))}</text>`).join('')}</g>`;
  rows.forEach((r,i)=>{const cy=pad.t+i*rowH+rowH/2,q=r.q,c=color(r);s+=`<g data-tip="${esc(`<div class='t'>${r.name}</div><div class='row'><span class='k'>n</span><b>${r.n.toLocaleString()}</b></div><div class='row'><span class='k'>p10 · p25</span><b>${fmt(q[0])} · ${fmt(q[1])}</b></div><div class='row'><span class='k'>median</span><b>${fmt(q[2])}</b></div><div class='row'><span class='k'>p75 · p90</span><b>${fmt(q[3])} · ${fmt(q[4])}</b></div>`)}"><rect x="0" y="${cy-rowH/2}" width="${W}" height="${rowH}" fill="transparent"/><text class="rowlbl" x="${pad.l-8}" y="${cy+4}" text-anchor="end">${esc(r.name)}</text><line x1="${x(q[0])}" x2="${x(q[4])}" y1="${cy}" y2="${cy}" stroke="${c}" stroke-width="1.5" stroke-opacity=".7"/><rect x="${x(q[1])}" y="${cy-6}" width="${Math.max(2,x(q[3])-x(q[1]))}" height="12" rx="2" fill="${c}" fill-opacity=".75"/><line x1="${x(q[2])}" x2="${x(q[2])}" y1="${cy-9}" y2="${cy+9}" stroke="var(--ink)" stroke-width="2"/><text class="vlab" x="${x(q[4])+8}" y="${cy+4}">${esc(fmt(q[2]))}</text></g>`;});
  s+='</svg>';el.innerHTML=s;bindTips(el);
}
function quantiles(a,ps){const s=[...a].sort((x,y)=>x-y);return ps.map(p=>s[Math.min(s.length-1,Math.floor(p*(s.length-1)))]);}
/* beeswarm: rows of dots along a shared x axis, greedy vertical packing so overlapping marks spread instead of stacking */
function beeswarm(el,{rows,dom,ticks,tickFmt=v=>v,r=2.2,rowH=46,color,tipFn,onClick,todayX,labelW=150}){
  const W=el.clientWidth||1100,pad={l:labelW,r:14,t:8,b:22},H=pad.t+pad.b+rows.length*rowH;
  const x=v=>clamp(pad.l+r+(v-dom[0])/(dom[1]-dom[0])*(W-pad.l-pad.r-2*r),pad.l+r,W-pad.r-r);
  let s=`<svg viewBox="0 0 ${W} ${H}" style="height:${H}px">`;
  s+='<g class="grid">'+ticks.map(v=>`<line x1="${x(v)}" x2="${x(v)}" y1="${pad.t}" y2="${H-pad.b}"/><text x="${x(v)}" y="${H-7}" text-anchor="middle">${esc(tickFmt(v))}</text>`).join('')+'</g>';
  if(todayX!=null)s+=`<line class="today" x1="${x(todayX)}" x2="${x(todayX)}" y1="${pad.t}" y2="${H-pad.b}"/>`;
  const all=[];
  rows.forEach((row,ri)=>{const cy=pad.t+ri*rowH+rowH/2,maxDy=rowH/2-r-1;
    s+=`<line class="rowline" x1="${pad.l}" x2="${W-pad.r}" y1="${cy}" y2="${cy}"/><text class="rowlbl" x="${pad.l-8}" y="${cy+4}" text-anchor="end">${esc(row.name)} <tspan style="fill:var(--ink-4);font-family:var(--mono);font-size:10px">${row.pts.length.toLocaleString()}</tspan></text>`;
    const pts=row.pts.map(p=>({p,px:x(p.x)})).sort((a,b)=>a.px-b.px);const placed=[];const step=2*r+0.6;
    pts.forEach(q=>{let best=null;
      for(let k=0;best===null&&k*step<=maxDy+0.01;k++){for(const sign of (k?[1,-1]:[0])){const dy=sign*k*step;let ok=true;
          for(let i=placed.length-1;i>=0&&q.px-placed[i].px<2*r;i--){const dx=q.px-placed[i].px,ddy=dy-placed[i].dy;if(dx*dx+ddy*ddy<(2*r)*(2*r)*0.98){ok=false;break;}}
          if(ok){best=dy;break;}}}
      if(best===null)best=(placed.length%2?1:-1)*maxDy;placed.push({px:q.px,dy:best});all.push(q.p);
      s+=`<circle class="pt" cx="${q.px.toFixed(1)}" cy="${(cy+best).toFixed(1)}" r="${r}" fill="${color(q.p)}" stroke="var(--g1)" stroke-width=".7" data-i="${all.length-1}"/>`;});
  });
  s+='</svg>';el.innerHTML=s;const svg=el.firstChild;
  svg.addEventListener('mouseover',e=>{const i=e.target.dataset&&e.target.dataset.i;if(i!=null&&tipFn){e.target.setAttribute('r',r*1.8);Tip.show(tipFn(all[i]),e);}});
  svg.addEventListener('mousemove',e=>{if(e.target.dataset&&e.target.dataset.i!=null)Tip.move(e);});
  svg.addEventListener('mouseout',e=>{if(e.target.dataset&&e.target.dataset.i!=null){e.target.setAttribute('r',r);Tip.hide();}});
  if(onClick)svg.addEventListener('click',e=>{const i=e.target.dataset&&e.target.dataset.i;if(i!=null)onClick(all[i]);});
}
