/* SAROS — views, dossier, palette, live refresh */
const App={tab:'cal',tlMode:'ph',calSort:['pd',1],calPage:0,calDense:0,spN:25,fdaF:'nme',fdaPage:0,fdaSort:['d',-1],
  async init(){
    const t0=performance.now();
    try{DATA=await decodePayload();}catch(e){$('#loadmsg').textContent='Snapshot could not be decoded: '+e.message;return;}
    const te=enrich();buildInvestors();App.INV=investorIndex();WL.load();$('#wlcount').textContent=WL.s.size;Tip.el=$('#tip');
    App.buildRail();App.bindUI();applyGloss($('#top'));applyGloss($('#rail'));applyGloss($('#tabs'));applyGloss($('#content'));App.update();
    $('#st-idx').innerHTML=`index <b>${T.length.toLocaleString()}</b> trials · <b>${FDA.length.toLocaleString()}</b> FDA actions · enrich <b>${te.toFixed(0)} ms</b>`;
    $('#st-mem').innerHTML=`payload <b>${(PAYLOAD_B64.length*0.75/1048576).toFixed(2)} MB gz</b> → <b>${(JSON_BYTES/1048576).toFixed(1)} MB</b> json`;
    $('#snapdate').textContent=META.pulled.slice(0,16).replace('T',' ')+'Z';$('#qry').textContent=META.ct_query;
    $('#freshtxt').textContent='snapshot '+META.pulled.slice(0,10);
    $('#st-diff').innerHTML=DIFF.prev_pulled?`Δ vs ${DIFF.prev_pulled.slice(0,10)} <b>${DIFF.slipped}</b> slipped · <b>${DIFF.firmed}</b> firmed · <b>${(DIFF.new||[]).length}</b> new`:'';
    $('#loading').style.display='none';
    if(['#about','#visuals','#sector'].includes(location.hash))Sheet.open(location.hash.slice(1));
    const hm=location.hash.match(/^#(tab|t|s)=(.+)$/);if(hm){const v=decodeURIComponent(hm[2]);if(hm[1]==='tab')App.setTab(v);else if(hm[1]==='t')Dossier.open(v);else if(hm[1]==='s'){F.grp=v;App.update();App.setTab('spon');}}
    console.log('%cSAROS%c boot '+(performance.now()-t0).toFixed(0)+' ms · '+T.length+' trials','font-weight:600;color:#63a9ff','color:#8b93a1');
  },
  buildRail(){
    const w0=$('#win0'),w1=$('#win1');MONTHS.forEach(m=>{w0.add(new Option(fmtM(m),m));w1.add(new Option(fmtM(m),m));});w0.value=F.win[0];w1.value=F.win[1];
    w0.onchange=()=>{F.win[0]=w0.value;if(F.win[1]<F.win[0]){F.win[1]=F.win[0];w1.value=F.win[0];}App.update();};
    w1.onchange=()=>{F.win[1]=w1.value;if(F.win[1]<F.win[0]){F.win[0]=F.win[1];w0.value=F.win[1];}App.update();};
    $('#nmin').oninput=e=>{F.nmin=+e.target.value;$('#nlbl').textContent=F.nmin;App.update();};
    $('#moaq').oninput=e=>{F.moaq=e.target.value.trim().toLowerCase();App.renderMoaList();};
  },
  bindUI(){
    $$('#tabs .tab').forEach(b=>b.onclick=()=>App.setTab(b.dataset.v));
    $$('#tl-mode button').forEach(b=>b.onclick=()=>{App.tlMode=b.dataset.m;$$('#tl-mode button').forEach(x=>x.classList.toggle('on',x===b));App.renderTimeline();});
    $$('#cal-dens button').forEach(b=>b.onclick=()=>{App.calDense=+b.dataset.d;$$('#cal-dens button').forEach(x=>x.classList.toggle('on',x===b));App.renderCal();});
    $$('#sp-n button').forEach(b=>b.onclick=()=>{App.spN=+b.dataset.n;$$('#sp-n button').forEach(x=>x.classList.toggle('on',x===b));App.renderSponsors();});
    $$('#fda-f button').forEach(b=>b.onclick=()=>{App.fdaF=b.dataset.f;App.fdaPage=0;$$('#fda-f button').forEach(x=>x.classList.toggle('on',x===b));App.renderFDA();});
    $('#exportbtn').onclick=()=>exportCSV();$('#refreshbtn').onclick=()=>Live.refresh();
    $('#wlbtn').onclick=()=>{F.wl=!F.wl;$('#wlbtn').classList.toggle('primary',F.wl);App.update();};
    $('#clearall').onclick=()=>F.clearAll();
    $$('#preset button').forEach(b=>b.onclick=()=>App.preset(b.dataset.p));
    $$('#toplinks .toplink').forEach(b=>b.onclick=()=>Sheet.toggle(b.dataset.sheet));
    Pal.init();
    document.addEventListener('keydown',e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();Pal.open();return;}
      if(e.key==='Escape'){if($('#pal').classList.contains('open'))Pal.close();else if(Sheet.cur)Sheet.close();else Dossier.close();return;}
      if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
      if(e.key==='Tab'&&!e.shiftKey&&!$('#pal').classList.contains('open')){e.preventDefault();const vs=$$('#tabs .tab').map(b=>b.dataset.v);App.setTab(vs[(vs.indexOf(App.tab)+1)%vs.length]);}
      if(e.key.toLowerCase()==='w'&&Dossier.cur){WL.toggle(Dossier.cur.id);Dossier.open(Dossier.cur.id);}
      if(e.key==='j'||e.key==='k')Dossier.step(e.key==='j'?1:-1);
    });
    let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>App.renderTimeline(),120);});
  },
  preset(p){$$('#preset button').forEach(x=>x.classList.toggle('on',x.dataset.p===p));F.clearFocus();F.q='';$('#q').value='';F.dsg.clear();
    if(p==='book'){if(!WL.s.size){toast('Add names to the book with ★ first');}F.wl=true;F.win=[MONTHS[0],MONTHS[MONTHS.length-1]];$('#win0').value=F.win[0];$('#win1').value=F.win[1];App.calSort=['pd',1];App.setTab('cal');}
    else if(p==='catalysts'){F.wl=false;F.ph.clear();F.ph.add('P3');F.ph.add('P2/P3');App.calSort=['impact',-1];App.setTab('cal');}
    else if(p==='landscape'){F.wl=false;F.ph.clear();App.calSort=['pd',1];App.setTab('cal');}
    else if(p==='private'){F.wl=false;F.ph.clear();F.dsg.add('Private');App.calSort=['pd',1];App.setTab('lv');}
    $('#wlbtn').classList.toggle('primary',F.wl);$('#wlcount').textContent=WL.s.size;App.update();},
  setTab(v){App.tab=v;$$('#tabs .tab').forEach(b=>b.classList.toggle('on',b.dataset.v===v));$$('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));App.renderView();},
  update(soft){
    const t0=performance.now();applyFilters();App.calPage=0;
    App.renderRail();App.renderKPIs();App.renderTimeline();App.renderView();
    $('#n-cal').textContent=VIEW.length.toLocaleString();$('#n-lv').textContent=VIEW.filter(t=>t.ag||t.lv).length;$('#n-fda').textContent=FDA.filter(f=>f.kind!=='ANDA'&&f.ty==='ORIG'&&f.nme).length;
    $('#st-rec').innerHTML=`<b>${VIEW.length.toLocaleString()}</b> / ${T.length.toLocaleString()} in view`;
    $('#st-render').innerHTML=`render <b>${(performance.now()-t0).toFixed(0)} ms</b>`;
  },
  renderRail(){
    const chips=(id,key,order,lbl,solo)=>{const c=count(T.filter(t=>passes(t,key)),key);const keys=order||[...c.keys()].sort((a,b)=>c.get(b)-c.get(a));
      $('#'+id).innerHTML=keys.filter(k=>c.get(k)).map(k=>`<button class="chip${F[key].has(k)?' on':''}" data-k="${esc(k)}">${esc(lbl?lbl[k]||k:k)}<span class="n">${c.get(k)||0}</span></button>`).join('');
      $$('#'+id+' .chip').forEach(b=>b.onclick=e=>F.toggle(key,b.dataset.k,!e.shiftKey&&solo));};
    chips('f-ph','ph',PH_ORDER);chips('f-st','st',ST_ORDER,ST_LBL);chips('f-tier','tier',TIER_ORDER);
    const list=(id,key,colorFn)=>{const c=count(T.filter(t=>passes(t,key)),key);const keys=[...c.keys()].sort((a,b)=>c.get(b)-c.get(a));const max=Math.max(1,...c.values());
      $('#'+id).innerHTML=keys.map(k=>`<div class="frow${F[key].has(k)?' on':''}" data-k="${esc(k)}"><span class="sw" style="background:${colorFn(k)}"></span><span class="nm">${esc(k)}</span><span class="n">${c.get(k)}</span><span class="bar" style="width:${c.get(k)/max*100}%"></span></div>`).join('');
      $$('#'+id+' .frow').forEach(b=>b.onclick=e=>F.toggle(key,b.dataset.k,!e.shiftKey));};
    list('f-ta','ta',k=>taColor(k));list('f-mo','mo',k=>moColor(k));App.renderMoaList();
    const dsgs=['Randomised','Blinded','Placebo-controlled','Single-arm','Results posted','FDA-regulated','US-listed','Listed ex-US','Private','Regulatory date pending','Specialist-held ≥3','Insider buying','Form D on file','NIH-funded','Aging-adjacent','Longevity-funded','Slipped','Date firmed','New this snapshot'];
    $('#f-dsg').innerHTML=dsgs.map(d=>`<button class="chip${F.dsg.has(d)?' on':''}" data-k="${d}"${DSG_TIP[d]?` data-tip="${esc(DSG_TIP[d])}"`:''}>${d}</button>`).join('');$$('#f-dsg .chip').forEach(b=>b.onclick=()=>F.toggle('dsg',b.dataset.k));bindTips($('#f-dsg'));
    const na=F.active();$('#nfilt').textContent=na?na+' active':'none active';$('#clearall').disabled=!na;
  },
  renderMoaList(){
    const c=new Map();T.forEach(t=>{if(!passes(t,'moa'))return;(t.moa||[]).forEach(m=>c.set(m,(c.get(m)||0)+1));});
    let keys=[...c.keys()];if(F.moaq)keys=keys.filter(k=>k.toLowerCase().includes(F.moaq));keys.sort((a,b)=>(F.moa.has(b)-F.moa.has(a))||c.get(b)-c.get(a));const shown=keys.slice(0,F.moaq?60:30);const max=Math.max(1,...c.values());
    $('#f-moa').innerHTML=shown.map(k=>`<div class="frow${F.moa.has(k)?' on':''}" data-k="${esc(k)}" title="${esc(k)}"><span class="sw" style="background:var(--acc);opacity:.7"></span><span class="nm">${esc(k)}</span><span class="n">${c.get(k)}</span><span class="bar" style="width:${c.get(k)/max*100}%"></span></div>`).join('')+(keys.length>shown.length?`<div class="dim2" style="font-size:10.5px;padding:4px 6px">${keys.length-shown.length} more · narrow with the box above or ⌘K</div>`:'')+(!keys.length?'<div class="dim2" style="font-size:11px;padding:4px 6px">No target matches.</div>':'');
    $$('#f-moa .frow').forEach(b=>b.onclick=e=>F.toggle('moa',b.dataset.k,!e.shiftKey));
  },
  renderKPIs(){
    const v=VIEW,p3=v.filter(t=>t.ph==='P3'),n180=v.filter(t=>t.days>=0&&t.days<=180),actual=v.filter(t=>t.pct==='ACTUAL');
    const enr=sum(v,t=>t.n),big=v.filter(t=>t.tier==='Large pharma'),cn=v.filter(t=>t.tier==='China-domiciled'),hi=p3.filter(t=>t.conf>=75);
    const byM=MONTHS.map(m=>v.filter(t=>t.pm===m).length);
    if(F.wl){const d=x=>v.filter(t=>t.days>=0&&t.days<=x);const kb=[
        ['Catalysts · 7 d',d(7).length,`${d(7).filter(t=>t.impactB==='High').length} high impact`,''],
        ['Catalysts · 30 d',d(30).length,`${d(30).filter(t=>t.ph==='P3').length} Phase 3`,sparkline(byM)],
        ['Catalysts · 90 d',d(90).length,`${d(90).filter(t=>t.rel==='firm').length} firm dates`,''],
        ['Unconfirmed ≤ 30 d',d(30).filter(t=>t.rel==='estimated').length,'estimated dates inside a month',''],
        ['Cash binding',v.filter(t=>t.binding).length,`${v.filter(t=>t.cashm!=null&&t.cashm<12).length} names < 12 mo cash`,''],
        ['Specialist adds',v.filter(t=>t.own&&t.own.new>0).length,`${v.filter(t=>t.ins&&t.ins.buy_usd>=250000).length} with insider buying`,''],
      ];$('#kpis').innerHTML=kb.map(([l,val,dd,sp])=>`<div class="kpi"><div class="lbl">${l}</div><div class="v">${val}</div><div class="d">${dd}</div>${sp}</div>`).join('');return;}
    const acts=[null,()=>{F.ph.clear();F.ph.add('P3');App.update();},()=>App.setTab('risk'),null,null,()=>App.setTab('spon')],keys=['kpi-view','kpi-p3','kpi-hi','kpi-act','kpi-enr','kpi-big'];
    const k=[
      ['Trials in view',v.length.toLocaleString(),`${p3.length.toLocaleString()} Phase 3`,sparkline(byM)],
      ['P3 readouts ≤ 180 d',n180.filter(t=>t.ph==='P3').length.toLocaleString(),`${n180.length.toLocaleString()} all phases`,sparkline(MONTHS.map(m=>p3.filter(t=>t.pm===m).length),60,18,SERIES[0])],
      ['High-conviction P3',hi.length.toLocaleString(),`confidence ≥ 75 · ${p3.length?Math.round(hi.length/p3.length*100):0}% of P3`,''],
      ['Actual completion dates',actual.length.toLocaleString(),`${v.length?Math.round(actual.length/v.length*100):0}% of view reported actual`,''],
      ['Planned enrollment',fmtN(enr),`median ${fmtN(median(v.map(t=>t.n).filter(x=>x!=null)))} / trial`,''],
      ['Large pharma share',v.length?Math.round(big.length/v.length*100)+'%':'—',`China-domiciled ${v.length?Math.round(cn.length/v.length*100):0}%`,''],
    ];
    $('#kpis').innerHTML=k.map(([l,val,d,sp],i)=>`<div class="kpi${acts[i]?' act':''}"${gl(keys[i])}><div class="lbl">${l}</div><div class="v">${val}</div><div class="d">${d}</div>${sp}</div>`).join('');
    $$('#kpis .kpi').forEach((el,i)=>{if(acts[i])el.onclick=acts[i];});bindTips($('#kpis'));
  },
  renderTimeline(){
    const base=BASE.filter(t=>(!F.grp||t.grp===F.grp)&&(!F.cell||(t.ta===F.cell[0]&&t.ph===F.cell[1])));
    let keys,colors,keyOf;
    if(App.tlMode==='ph'){keys=PH_ORDER;colors=keys.map(k=>PH_COLOR[k]);keyOf=t=>t.ph;}
    else if(App.tlMode==='tier'){keys=TIER_ORDER;colors=keys.map(k=>TIER_COLOR[k]);keyOf=t=>t.tier;}
    else{const c=count(base,'ta');keys=[...c.keys()].sort((a,b)=>c.get(b)-c.get(a)).slice(0,7);keys.push('Other areas');colors=keys.map(k=>taColor(k));keyOf=t=>keys.includes(t.ta)?t.ta:'Other areas';}
    const WM=MONTHS.filter(m=>m>=F.win[0]&&m<=F.win[1]);
    const series=keys.map(k=>({name:k,v:WM.map(m=>0)}));
    base.forEach(t=>{const i=WM.indexOf(t.pm);if(i<0)return;const j=keys.indexOf(keyOf(t));if(j>=0)series[j].v[i]++;});
    const ti=WM.indexOf(TODAY.toISOString().slice(0,7));const todayIdx=ti<0?null:ti+(TODAY.getDate()/31);
    $('#moons').innerHTML=WM.map(m=>`<span>${moonSVG(moonPhase(new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1,15))))}</span>`).join('');
    stackedBars($('#timeline'),{cats:WM,labels:WM.map((m,i)=>m.endsWith('-01')||i===0?fmtM(m):MON[+m.slice(5,7)-1]),series,colors,sel:F.month,todayIdx,height:210,onClick:m=>{F.month=F.month===m?null:m;App.update();}});
    const pdm=count(REG.rows.filter(r=>r.kind!=='resubmission'),r=>r.date.slice(0,7));
    $('#pdufa-strip').innerHTML=REG.rows.length?`<span class="lbl" style="margin-right:4px">FDA dates</span>`+MONTHS.filter(m=>pdm.get(m)&&m>=F.win[0]&&m<=F.win[1]).map(m=>`<button class="chip" style="height:20px;border-color:rgba(201,194,182,.45);color:#C9C2B6" onclick="App.pdMonth='${m}';App.setTab('fda')" title="Open regulatory dates for ${fmtM(m)}">${fmtM(m)} <span class="n" style="color:#C9C2B6">${pdm.get(m)}</span></button>`).join('')+`<span class="dim2" style="font-size:10.5px;margin-left:4px">${REG.rows.length} PDUFA / AdCom dates · disclosed in SEC filings</span>`:'';
    $('#tl-legend').innerHTML=keys.map((k,i)=>`<span><i style="background:${colors[i]}"></i>${esc(k)}</span>`).join('')+(F.month||F.grp||F.cell||F.inv?`<span style="margin-left:auto"><button class="btn sm" onclick="F.clearFocus();App.update()">✕ clear focus${F.month?' · '+fmtM(F.month):''}${F.grp?' · '+esc(F.grp):''}${F.cell?' · '+esc(F.cell[0])+' '+F.cell[1]:''}${F.inv?' · '+esc(F.inv):''}</button></span>`:'');
  },
  renderView(){({cal:App.renderCal,spon:App.renderSponsors,lv:App.renderLongevity,map:App.renderMap,mod:App.renderMod,geo:App.renderGeo,fda:App.renderFDA,risk:App.renderRisk,about:App.renderAbout})[App.tab]();},

  /* ---- readout calendar ---- */
  renderCal(){
    const cols=[['★','wl',0,'wl'],['Readout','pd',1,'readout'],['Δ days','days',1,'days'],['Phase','ph',1,'phase'],['Asset / study','t',0],['Sponsor','grp',1,'sponsor'],['Indication','c',0],['Area','ta',1,'ta'],['Modality','mo',1,'mo'],['Status','st',1,'status'],['N','n',1,'n'],['Conf.','conf',1,'conf'],['Prior','pri',1,'prior'],['Impact','impact',1,'impact'],['Action','action',1,'action'],['Float','mcap',1,'mcap']];
    const [sk,sd]=App.calSort;const rows=[...VIEW].sort((a,b)=>cmp(a,b,sk)*sd);
    const per=App.calDense?150:60,pg=App.calPage,slice=rows.slice(pg*per,(pg+1)*per);
    $('#caltbl thead').innerHTML='<tr>'+cols.map(([l,k,s,g])=>`<th class="${['n','conf','pri','days'].includes(k)?'num':''}${sk===k?' sorted':''}" data-k="${k}"${g?gl(g):''}>${l}${sk===k?`<span class="arr">${sd>0?'▲':'▼'}</span>`:''}</th>`).join('')+'</tr>';bindTips($('#caltbl thead'));
    $$('#caltbl th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;App.calSort=[k,App.calSort[0]===k?-App.calSort[1]:(k==='pd'?1:-1)];App.renderCal();});
    $('#caltbl tbody').innerHTML=slice.map(t=>`<tr class="r${Dossier.cur&&Dossier.cur.id===t.id?' sel':''}" data-id="${t.id}" style="${App.calDense?'font-size:11px':''}">
      <td><button class="star${WL.has(t.id)?' on':''}" data-wl="${t.id}" title="Watch">${WL.has(t.id)?'★':'☆'}</button></td>
      <td class="num">${fmtD(t.pcd)}${t.pct==='ACTUAL'?' <span class="badge nme" title="Actual date">A</span>':''}${slipBadge(t)}</td>
      <td class="num"><span class="dtr${t.days<0?' past':t.days<=90?' soon':''}">${t.days>=0?'+':''}${t.days}</span></td>
      <td><span class="tag ${PH_CLS[t.ph]}">${t.ph}</span></td>
      <td class="wrap"><span class="ttl" title="${esc(t.t)}">${esc(t.ac?t.ac+' — ':'')}${esc(t.t)}</span><span class="dim2 mono" style="font-size:10px">${t.id} · ${esc(t.iv.filter(x=>x[0]!=='OTHER').slice(0,2).map(x=>x[1]).join(' + ')||'—')}${t.moa&&t.moa.length?` <span style="color:var(--acc);opacity:.85">· ${esc(t.moa.slice(0,2).join(' · '))}</span>`:''}</span></td>
      <td><span class="sponsor${t.tier==='Large pharma'?' big':''}" title="${esc(t.sp)}">${esc(t.grp)}</span>${t.sec&&t.sec.t!=='private'?` <span class="badge" style="font-size:9.5px">${esc(t.sec.t)}</span>`:''}</td>
      <td class="wrap" style="max-width:220px"><span class="ttl" style="max-width:220px" title="${esc(t.c.join(' · '))}">${esc(t.c[0]||'—')}</span></td>
      <td><span class="dim">${esc(t.ta)}</span></td><td><span class="dim">${esc(t.mo)}</span></td>
      <td><span class="st ${t.st}"><i></i>${ST_LBL[t.st]||t.st}</span></td>
      <td class="num">${fmtN(t.n)}</td>
      <td class="num"><span class="conf ${t.conf>=75?'hi':t.conf>=50?'md':'lo'}"><span class="bar"><i style="width:${t.conf}%"></i></span>${t.conf}</span></td>
      <td class="num dim">${Math.round(t.pri*100)}%</td>
      <td><span class="imp ${t.impactB}" title="impact ${t.impact.toFixed(2)} · ${t.rel}">${t.impactB}</span></td>
      <td><span class="act ${t.action.split(' ')[0].toLowerCase().replace('/','')}" title="${esc(t.actionWhy)}">${esc(t.action)}</span></td>
      <td class="num dim">${t.mcap?fmtUSD(t.mcap):'—'}</td></tr>`).join('')||`<tr><td colspan="16" class="empty">No trials match. Loosen a filter or clear the focus.</td></tr>`;
    bindTips($('#caltbl'));
    $$('#caltbl tbody tr.r').forEach(tr=>{tr.onclick=e=>{if(e.target.dataset.wl)return;Dossier.open(tr.dataset.id);};const t=IDX.get(tr.dataset.id);tr.addEventListener('mouseenter',e=>Tip.show(trialTip(t),e));tr.addEventListener('mousemove',Tip.move);tr.addEventListener('mouseleave',Tip.hide);});
    $$('#caltbl [data-wl]').forEach(b=>b.onclick=e=>{e.stopPropagation();WL.toggle(b.dataset.wl);});
    const np=Math.ceil(rows.length/per);
    $('#calpager').innerHTML=`<span>${rows.length.toLocaleString()} trials · page ${np?pg+1:0}/${np}</span><span class="sp"></span><button class="btn sm" ${pg===0?'disabled':''} onclick="App.calPage--;App.renderCal()">‹ prev</button><button class="btn sm" ${pg>=np-1?'disabled':''} onclick="App.calPage++;App.renderCal()">next ›</button>`;
    $('#cal-title').textContent=(F.month?fmtM(F.month)+' readouts':'Readout calendar')+(F.grp?' · '+F.grp:'')+(F.cell?' · '+F.cell[0]+' '+F.cell[1]:'')+(F.inv?' · held by '+F.inv:'')+(F.moa.size?' · '+[...F.moa].join(' / '):'');
    $('#cal-hint').textContent='Δ days from today · Conf. = readout-confidence heuristic · Prior = literature phase-transition base rate';
  },

  /* ---- sponsors ---- */
  renderSponsors(){
    const base=BASE.filter(t=>(!F.month||t.pm===F.month)&&(!F.cell||(t.ta===F.cell[0]&&t.ph===F.cell[1])));
    const m=new Map();base.forEach(t=>{const r=m.get(t.grp)||{name:t.grp,key:t.grp,parts:PH_ORDER.map(()=>0),total:0,n:0,tier:t.tier,p3:0,ta:new Map(),conf:[]};r.parts[PH_ORDER.indexOf(t.ph)]++;r.total++;r.n+=t.n||0;if(t.ph==='P3')r.p3++;r.ta.set(t.ta,(r.ta.get(t.ta)||0)+1);r.conf.push(t.conf);m.set(t.grp,r);});
    const rows=[...m.values()].sort((a,b)=>b.total-a.total).slice(0,App.spN);
    hbars($('#sponsors'),rows,{colors:PH_ORDER.map(k=>PH_COLOR[k]),sel:F.grp,onClick:r=>{F.grp=F.grp===r.key?null:r.key;App.update();},
      tipFn:r=>`<div class="t">${esc(r.name)}</div><div class="k">${r.tier}</div><hr>${PH_ORDER.map((p,i)=>r.parts[i]?`<div class="row"><span class="k">${p}</span><b>${r.parts[i]}</b></div>`:'').join('')}<div class="row"><span class="k">Enrollment</span><b>${fmtN(r.n)}</b></div><div class="row"><span class="k">Median confidence (P3)</span><b>${median(r.conf)}</b></div><hr><div class="k">${[...r.ta.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]+' '+x[1]).join(' · ')}</div>`});
    $('#sponsors').insertAdjacentHTML('afterbegin',`<div class="legend" style="margin-bottom:8px">${PH_ORDER.map(k=>`<span><i style="background:${PH_COLOR[k]}"></i>${k}</span>`).join('')}</div>`);
    /* concentration */
    const all=[...m.values()].sort((a,b)=>b.total-a.total),tot=base.length||1;
    const top5=all.slice(0,5).reduce((a,r)=>a+r.total,0),top20=all.slice(0,20).reduce((a,r)=>a+r.total,0);
    const hhi=all.reduce((a,r)=>a+Math.pow(r.total/tot*100,2),0);
    const tiers=count(base,'tier');
    const crowd=Object.values(F13.issuers||{}).filter(e=>e.n>=3).sort((a,b)=>b.n-a.n||b.value-a.value).slice(0,14);
    const ibuy=Object.values(INS.byCik||{}).filter(e=>e.buy_n>=2&&e.buy_usd>=250000).sort((a,b)=>b.buy_usd-a.buy_usd).slice(0,10);
    const ibuyHtml=ibuy.length?`<div class="sec" style="margin:0 0 14px"><h4>Insider buy clusters <span class="dim2" style="text-transform:none;letter-spacing:0">· ≥2 open-market buys, ≥$250k · ${(INS.quarters||[]).slice().reverse().join('+').toUpperCase()}</span></h4><div class="related">${ibuy.map(e=>`<button onclick="F.q='${esc(e.tk||e.name.split(' ')[0]).toLowerCase().replace(/'/g,"\\'")}';document.getElementById('q').value=F.q;App.update();App.setTab('cal')"><span class="badge" style="width:52px;text-align:center">${esc(e.tk||'—')}</span><span class="ttl">${esc(e.name.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()))}</span><span class="num" style="color:var(--good)">${fmtUSD(e.buy_usd)}</span><span class="num dim2" style="width:40px;text-align:right">${e.buy_n}×</span></button>`).join('')}</div></div>`:'';
    $('#conc').innerHTML=ibuyHtml+(crowd.length?`<div class="sec" style="margin:0 0 14px"><h4>Specialist crowding <span class="dim2" style="text-transform:none;letter-spacing:0">· issuers held by ≥3 of ${F13.funds.filter(f=>!f.gen).length} specialists · +n = generalists (Point72, Viking, Woodline, Polar, Farallon) · ${(F13.funds[0]||{}).period||''}</span></h4><div class="related">${crowd.map(e=>`<button onclick="F.q='${esc(e.issuer.split(' ')[0].toLowerCase()).replace(/'/g,"\\'")}';document.getElementById('q').value=F.q;App.update();App.setTab('cal')" title="Search trials for this issuer"><span class="num" style="width:22px;color:var(--acc)">${e.n}</span><span class="num dim2" style="width:24px;font-size:10px">${e.ng?'+'+e.ng:''}</span><span class="ttl">${esc(e.issuer.replace(/\b(INC|CORP|LTD|PLC|HOLDINGS?|CO)\b\.?/g,'').trim().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()))}</span><span class="num dim2">${fmtUSD(e.value)}</span><span class="num" style="width:44px;text-align:right;color:${e.new>e.exit?'var(--good)':e.exit>e.new?'var(--crit)':'var(--ink-3)'}">${e.new?'+'+e.new:''}${e.exit?' −'+e.exit:''}</span></button>`).join('')}</div></div>`:'')+`<div class="kv" style="grid-template-columns:1fr auto"><span class="k">Distinct sponsor groups</span><span class="v num">${all.length}</span><span class="k">Top-5 share</span><span class="v num">${Math.round(top5/tot*100)}%</span><span class="k">Top-20 share</span><span class="v num">${Math.round(top20/tot*100)}%</span><span class="k">HHI (trial count)</span><span class="v num">${Math.round(hhi)}</span><span class="k">Single-trial sponsors</span><span class="v num">${all.filter(r=>r.total===1).length}</span></div>
      <div class="sec"><h4>By tier</h4>${TIER_ORDER.map(k=>`<div class="meter"><span class="k dim" style="font-size:11.5px">${k}</span><span></span><div class="tr"><i style="width:${(tiers.get(k)||0)/tot*100}%;background:${TIER_COLOR[k]}"></i></div><span class="v">${tiers.get(k)||0} · ${Math.round((tiers.get(k)||0)/tot*100)}%</span></div>`).join('')}</div>
      <div class="sec"><h4>By listing</h4>${['US-listed','Listed ex-US / OTC','Unlisted / private'].map(k=>{const n=base.filter(t=>t.lst===k).length;return `<div class="meter"><span class="k dim" style="font-size:11.5px">${k}</span><span></span><div class="tr"><i style="width:${n/tot*100}%;background:var(--ink-3)"></i></div><span class="v">${n} · ${Math.round(n/tot*100)}%</span></div>`;}).join('')}</div>
      <div class="sec"><h4>Phase 3 leaders</h4><div class="related">${all.filter(r=>r.p3).sort((a,b)=>b.p3-a.p3).slice(0,8).map(r=>`<button onclick="F.grp='${esc(r.key).replace(/'/g,"\\'")}';App.update()"><span class="ttl">${esc(r.name)}</span><span class="num dim2">${r.p3} P3</span></button>`).join('')}</div></div>`;
    $$('#conc .meter').forEach(el=>{el.style.gridTemplateColumns='120px 0 1fr auto';});
    App.renderProgram();
  },

  /* ---- program profile + peer similarity (sponsor as unit of analysis) ---- */
  vec(rows){const v=new Map();rows.forEach(t=>{[['a',t.ta],['p',t.ph],['m',t.mo],['ap',t.ta+'|'+t.ph]].forEach(([k,x])=>{const key=k+':'+x;v.set(key,(v.get(key)||0)+1);});});return v;},
  cos(a,b){let d=0,na=0,nb=0;a.forEach((x,k)=>{na+=x*x;if(b.has(k))d+=x*b.get(k);});b.forEach(x=>nb+=x*x);return na&&nb?d/Math.sqrt(na*nb):0;},
  renderProgram(){
    const el=$('#prog');if(!F.grp){$('#prog-title').textContent='Program profile';el.innerHTML='<div class="dim2" style="font-size:12px">Click a sponsor in the league table to profile its 2026–28 program: breadth, pivotal share, readout density, and the sponsors whose programs look most like it.</div>';return;}
    const mine=T.filter(t=>t.grp===F.grp&&t.pm>=MONTHS[0]);const p3=mine.filter(t=>t.ph==='P3');const n12=mine.filter(t=>t.days>=0&&t.days<=365);
    const tas=[...count(mine,'ta').entries()].sort((a,b)=>b[1]-a[1]);const mos=[...count(mine,'mo').entries()].sort((a,b)=>b[1]-a[1]);
    const mv=App.vec(mine);const groups=new Map();T.forEach(t=>{if(t.grp!==F.grp){(groups.get(t.grp)||groups.set(t.grp,[]).get(t.grp)).push(t);}});
    const peers=[];groups.forEach((rows,g)=>{if(rows.length>=3)peers.push([g,App.cos(mv,App.vec(rows)),rows.length,rows.filter(t=>t.ph==='P3').length]);});peers.sort((a,b)=>b[1]-a[1]);
    const stopped=mine.filter(t=>['TERMINATED','WITHDRAWN','SUSPENDED'].includes(t.st)).length;
    $('#prog-title').textContent=F.grp;
    el.innerHTML=`<div class="kv" style="grid-template-columns:1fr auto"><span class="k">Trials in window</span><span class="v num">${mine.length}</span><span class="k">Pivotal (P3) share</span><span class="v num">${Math.round(p3.length/mine.length*100)}%</span><span class="k">Readouts next 12 mo</span><span class="v num">${n12.length} <span class="dim2">(${n12.filter(t=>t.ph==='P3').length} P3)</span></span><span class="k">Median P3 confidence</span><span class="v num">${median(p3.map(t=>t.conf))||'—'}</span><span class="k">Stopped in window</span><span class="v num">${stopped} <span class="dim2">${mine.length?Math.round(stopped/mine.length*100)+'%':''}</span></span><span class="k">Enrollment</span><span class="v num">${fmtN(sum(mine,t=>t.n))}</span><span class="k">Breadth</span><span class="v">${tas.length} areas · ${mos.length} modalities</span>${secRow(mine[0]&&mine[0].sec,mine.length)}${mine[0]&&mine[0].own?`<span class="k">Specialist holders</span><span class="v num">${mine[0].own.n} <span class="dim2">· ${fmtUSD(mine[0].own.value)}${mine[0].own.ng?' · +'+mine[0].own.ng+' generalist':''}</span></span>`:''}</div>
      <div class="sec"><h4>Program mix</h4>${tas.slice(0,5).map(([k,n])=>`<div class="meter" style="grid-template-columns:150px 1fr auto"><span class="dim" style="font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</span><div class="tr"><i style="width:${n/mine.length*100}%;background:${taColor(k)}"></i></div><span class="v">${n}</span></div>`).join('')}</div>
      <div class="sec"><h4>Closest scientific peers <span class="dim2" style="text-transform:none;letter-spacing:0">· cosine on area × phase × modality</span></h4><div class="related">${peers.slice(0,8).map(([g,s,n,p])=>`<button onclick="F.grp='${esc(g).replace(/'/g,"\\'")}';App.update()"><span class="num" style="color:var(--acc);width:34px">${(s*100).toFixed(0)}</span><span class="ttl">${esc(g)}</span><span class="num dim2">${n} · ${p} P3</span></button>`).join('')||'<span class="dim2">No peers with ≥3 trials.</span>'}</div></div>
      ${(()=>{const f=mine.find(t=>t.fdi),n=mine.find(t=>t.nihi);return (f||n)?privateSection(f&&f.fdi,n&&n.nihi,F.grp):'';})()}
      <div class="sec"><h4>Next readouts</h4><div class="related">${mine.filter(t=>t.days>=0).sort((a,b)=>a.pd-b.pd).slice(0,6).map(t=>`<button onclick="Dossier.open('${t.id}')"><span class="num dim2">${fmtD(t.pcd)}</span><span class="tag ${PH_CLS[t.ph]}">${t.ph}</span><span class="ttl">${esc(t.ac||t.c[0]||t.t)}</span></button>`).join('')}</div></div>`;
  },

  /* ---- longevity ---- */
  lvF:'clin',
  renderLongevity(){
    const LV=DATA.longevity||[];const has=LV.filter(l=>l.nct.length);const raisedAll=sum(LV,l=>l.raised),raisedClin=sum(has,l=>l.raised);
    const adj=VIEW.filter(t=>t.ag);const active=LV.filter(l=>l.stage==='Active');
    $('#lvkpis').innerHTML=[['Longevity companies',LV.length,`${active.length} active · ${LV.filter(l=>l.stage==='IPO').length} public · ${LV.filter(l=>/Acquired|Shutdown/.test(l.stage)).length} exited/closed`],['Capital raised','$'+(raisedAll/1000).toFixed(1)+'B',`median $${median(LV.map(l=>l.raised))}m per company`],['With a 2026–28 readout',has.length,`${Math.round(has.length/LV.length*100)}% of companies · $${(raisedClin/1000).toFixed(1)}B raised`],['Registered trials',sum(has,l=>l.nct.length),`${has.reduce((a,l)=>a+l.nct.filter(id=>IDX.get(id)?.ph==='P3').length,0)} Phase 3`],['Aging-adjacent, all sponsors',adj.length,`${adj.filter(t=>t.ph==='P3').length} P3 · ${adj.filter(t=>t.tier==='Large pharma').length} large pharma`]].map(([l,v,d])=>`<div class="kpi"><div class="lbl">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
    $$('#lv-f button').forEach(b=>b.onclick=()=>{App.lvF=b.dataset.f;$$('#lv-f button').forEach(x=>x.classList.toggle('on',x===b));App.renderLongevity();});
    const rows=(App.lvF==='clin'?has:LV).slice().sort((a,b)=>b.nct.length-a.nct.length||b.raised-a.raised);
    $('#lvtbl thead').innerHTML='<tr><th>#</th><th>Company</th><th>Focus</th><th class="num">Raised $m</th><th>Last round</th><th>Status</th><th>Lead investors</th><th class="num" data-gl="formd">Form D</th><th class="num" data-gl="nih">NIH</th><th>2026–28 trials</th><th>Next readout</th></tr>';bindTips($('#lvtbl thead'));
    $('#lvtbl tbody').innerHTML=rows.map(l=>{const ts=l.nct.map(id=>IDX.get(id)).filter(Boolean).sort((a,b)=>a.pd-b.pd);const nx=ts.find(t=>t.days>=0)||ts[0];
      return `<tr class="${ts.length?'r':''}" data-id="${nx?nx.id:''}"><td class="num dim2">${l.rank}</td><td><span class="sponsor">${esc(l.co)}</span></td><td class="dim" style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${esc(l.what)}">${esc(l.what)}</td><td class="num">${l.raised?l.raised.toLocaleString():'—'}</td><td class="dim">${esc(l.last||'—')}${l.lastamt?` <span class="num dim2">$${l.lastamt}m</span>`:''}<br><span class="dim2" style="font-size:10.5px">${esc(l.lasttype)}</span></td><td><span class="badge ${l.stage==='Active'?'nme':l.stage==='IPO'?'bla':l.stage==='Shutdown'?'':''}" style="${l.stage==='Shutdown'?'color:var(--crit);border-color:rgba(229,72,77,.4)':''}">${esc(l.stage)}</span></td><td class="dim" style="max-width:230px;overflow:hidden;text-overflow:ellipsis;font-size:11px" title="${esc(l.inv)}">${esc(l.inv)}</td><td class="num">${l.fd&&FD.issuers[l.fd]?`<span title="${esc(FD.issuers[l.fd].n)} Reg D filings, latest ${esc(FD.issuers[l.fd].last)}">${fmtUSD(FD.issuers[l.fd].sold)}</span>`:'<span class="dim2">—</span>'}</td><td class="num">${l.nih&&NIH.orgs[l.nih]?`<span title="${NIH.orgs[l.nih].n} awards FY${NIH.orgs[l.nih].first_fy}–${NIH.orgs[l.nih].last_fy}">${fmtUSD(NIH.orgs[l.nih].total)}</span>`:'<span class="dim2">—</span>'}</td><td>${ts.length?ts.slice(0,4).map(t=>`<span class="tag ${PH_CLS[t.ph]}" title="${esc(t.t)}" onclick="event.stopPropagation();Dossier.open('${t.id}')">${t.ph}</span>`).join(' ')+(ts.length>4?` <span class="dim2 num">+${ts.length-4}</span>`:''):'<span class="dim2">—</span>'}</td><td class="num">${nx?fmtD(nx.pcd)+` <span class="dim2">${esc(nx.c[0]||'')}</span>`:'<span class="dim2">none registered</span>'}</td></tr>`;}).join('');
    $$('#lvtbl tr.r').forEach(tr=>{tr.onclick=()=>tr.dataset.id&&Dossier.open(tr.dataset.id);});
    const stages=['Active','IPO','Acquired','Shutdown'];
    const crow=stages.map(s=>{const g=LV.filter(l=>l.stage===s);return{name:s,key:s,parts:[sum(g.filter(l=>l.nct.length),l=>l.raised),sum(g.filter(l=>!l.nct.length),l=>l.raised)],total:sum(g,l=>l.raised),n:g.length,c:g.filter(l=>l.nct.length).length};});
    hbars($('#lvcap'),crow,{colors:[LIST_COLOR.pub,GREY],fmt:v=>'$'+fmtN(v)+'m',tipFn:r=>`<div class="t">${r.name}</div><div class="row"><span class="k">Companies</span><b>${r.n}</b></div><div class="row"><span class="k">With registered readout</span><b>${r.c}</b></div><div class="row"><span class="k">Raised, in clinic</span><b>$${fmtN(r.parts[0])}m</b></div><div class="row"><span class="k">Raised, no 2026–28 readout</span><b>$${fmtN(r.parts[1])}m</b></div>`});
    $('#lvcap').insertAdjacentHTML('beforeend',`<div class="sec"><h4>Largest raises</h4><div class="related">${LV.slice().sort((a,b)=>b.raised-a.raised).slice(0,10).map(l=>`<button ${l.nct.length?`onclick="Dossier.open('${l.nct[0]}')"`:''} style="${l.nct.length?'':'cursor:default'}"><span class="num" style="width:58px;color:var(--ink-2)">$${l.raised.toLocaleString()}m</span><span class="ttl">${esc(l.co)}</span><span class="dim2" style="font-size:11px">${l.nct.length?l.nct.length+' trial'+(l.nct.length>1?'s':''):esc(l.stage)}</span></button>`).join('')}</div><div class="dim2" style="font-size:11px;margin-top:8px">${Math.round(LV.filter(l=>l.stage==='Active').length/LV.length*100)}% of these companies are private and active; ${has.filter(l=>l.stage==='Active').length} of those have a registered readout in the window. Capital without a registered late-stage program is where diligence should start.</div></div>`);
    $('#lvadj').innerHTML=adj.length?`<table class="t"><thead><tr><th>Readout</th><th>Phase</th><th>Study</th><th>Sponsor</th><th>Area</th></tr></thead><tbody>${adj.sort((a,b)=>a.pd-b.pd).map(t=>`<tr class="r" data-id="${t.id}"><td class="num">${fmtD(t.pcd)}</td><td><span class="tag ${PH_CLS[t.ph]}">${t.ph}</span></td><td class="wrap" style="max-width:300px"><span class="ttl" style="max-width:300px">${esc(t.ac?t.ac+' — ':'')}${esc(t.t)}</span></td><td><span class="sponsor${t.tier==='Large pharma'?' big':''}">${esc(t.grp)}</span></td><td class="dim">${esc(t.ta)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No aging-adjacent trials under the current filters.</div>';
    $$('#lvadj tr.r').forEach(tr=>{tr.onclick=()=>Dossier.open(tr.dataset.id);const t=IDX.get(tr.dataset.id);tr.addEventListener('mouseenter',e=>Tip.show(trialTip(t),e));tr.addEventListener('mousemove',Tip.move);tr.addEventListener('mouseleave',Tip.hide);});
  },

  /* ---- area × phase ---- */
  renderMap(){
    const base=BASE.filter(t=>(!F.month||t.pm===F.month)&&(!F.grp||t.grp===F.grp));
    const tas=[...count(base,'ta').entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
    const cell={};base.forEach(t=>{const k=t.ta+'|'+t.ph;(cell[k]=cell[k]||{n:0,e:0,a:0,c:[]});cell[k].n++;cell[k].e+=t.n||0;if(t.pct==='ACTUAL')cell[k].a++;cell[k].c.push(t.conf);});
    const max=Math.max(1,...Object.values(cell).map(c=>c.n));
    let h=`<div class="heat" style="grid-template-columns:200px repeat(${PH_ORDER.length},1fr) 70px"><div></div>${PH_ORDER.map(p=>`<div class="h">${p}</div>`).join('')}<div class="h">total</div>`;
    tas.forEach(ta=>{h+=`<div class="rl" title="${esc(ta)}">${esc(ta)}</div>`;let tot=0;PH_ORDER.forEach(p=>{const c=cell[ta+'|'+p]||{n:0,e:0,a:0,c:[]};tot+=c.n;const on=F.cell&&F.cell[0]===ta&&F.cell[1]===p;h+=`<div class="c" style="background:${heatColor(c.n,max)};color:${c.n/max>.45?'#fff':'var(--ink-2)'};${on?'outline:2px solid var(--amber)':''}" data-ta="${esc(ta)}" data-ph="${p}" data-tip="<div class='t'>${esc(ta)} · ${p}</div><div class='row'><span class='k'>Trials</span><b>${c.n}</b></div><div class='row'><span class='k'>Enrollment</span><b>${fmtN(c.e)}</b></div><div class='row'><span class='k'>Actual dates</span><b>${c.n?Math.round(c.a/c.n*100):0}%</b></div><div class='row'><span class='k'>Median confidence</span><b>${median(c.c)}</b></div>">${c.n||''}</div>`;});h+=`<div class="c num" style="background:transparent;color:var(--ink-2)">${tot}</div>`;});
    h+='</div>';$('#heatmap').innerHTML=h;bindTips($('#heatmap'));
    $$('#heatmap .c[data-ta]').forEach(el=>el.onclick=()=>{const c=[el.dataset.ta,el.dataset.ph];F.cell=F.cell&&F.cell[0]===c[0]&&F.cell[1]===c[1]?null:c;App.update();});
    /* area by quarter (P3) */
    const qs=[...new Set(MONTHS.map(m=>m.slice(0,4)+' Q'+(Math.floor((+m.slice(5,7)-1)/3)+1)))];
    const p3=base.filter(t=>t.ph==='P3');const top=tas.slice(0,7);const keys=[...top,'Other areas'];
    const series=keys.map(k=>({name:k,v:qs.map(()=>0)}));p3.forEach(t=>{const j=top.includes(t.ta)?top.indexOf(t.ta):7;series[j].v[qs.indexOf(t.pq)]++;});
    $('#taq').innerHTML='<div class="chart"></div><div class="legend"></div>';stackedBars($('#taq .chart'),{cats:qs,series,colors:keys.map(taColor),height:190});
    $('#taq .legend').innerHTML=keys.map(k=>`<span><i style="background:${taColor(k)}"></i>${esc(k)}</span>`).join('');
    const rows=tas.map(ta=>{const r=base.filter(t=>t.ta===ta);return{name:ta,key:ta,parts:PH_ORDER.map(p=>sum(r.filter(t=>t.ph===p),t=>t.n)),total:sum(r,t=>t.n)};}).sort((a,b)=>b.total-a.total);
    hbars($('#tan'),rows,{colors:PH_ORDER.map(k=>PH_COLOR[k]),onClick:r=>{F.ta.clear();F.ta.add(r.key);App.update();},tipFn:r=>`<div class="t">${esc(r.name)}</div>${PH_ORDER.map((p,i)=>`<div class="row"><span class="k">${p}</span><b>${fmtN(r.parts[i])}</b></div>`).join('')}`});
  },

  /* ---- modality ---- */
  renderMod(){
    const base=BASE.filter(t=>(!F.month||t.pm===F.month)&&(!F.grp||t.grp===F.grp)&&(!F.cell||(t.ta===F.cell[0]&&t.ph===F.cell[1])));
    const mos=[...count(base,'mo').entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
    const rows=mos.map(mo=>{const r=base.filter(t=>t.mo===mo);return{name:mo,key:mo,parts:PH_ORDER.map(p=>r.filter(t=>t.ph===p).length),total:r.length,n:sum(r,t=>t.n),big:r.filter(t=>t.tier==='Large pharma').length};});
    hbars($('#modmix'),rows,{colors:PH_ORDER.map(k=>PH_COLOR[k]),sel:F.mo.size===1?[...F.mo][0]:null,onClick:r=>F.toggle('mo',r.key,true),tipFn:r=>`<div class="t">${esc(r.name)}</div>${PH_ORDER.map((p,i)=>r.parts[i]?`<div class="row"><span class="k">${p}</span><b>${r.parts[i]}</b></div>`:'').join('')}<div class="row"><span class="k">Enrollment</span><b>${fmtN(r.n)}</b></div><div class="row"><span class="k">Large-pharma share</span><b>${Math.round(r.big/r.total*100)}%</b></div>`});
    const tas=[...count(base,'ta').entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,8);
    const cell={};base.forEach(t=>{cell[t.mo+'|'+t.ta]=(cell[t.mo+'|'+t.ta]||0)+1;});const max=Math.max(1,...Object.values(cell));
    let h=`<div class="heat" style="grid-template-columns:170px repeat(${tas.length},1fr)"><div></div>${tas.map(p=>`<div class="h" style="font-size:9px">${esc(p.replace(' & ',' / ').split(' ').slice(0,2).join(' '))}</div>`).join('')}`;
    mos.slice(0,12).forEach(mo=>{h+=`<div class="rl">${esc(mo)}</div>`;tas.forEach(ta=>{const n=cell[mo+'|'+ta]||0;h+=`<div class="c" style="background:${heatColor(n,max)};color:${n/max>.45?'#fff':'var(--ink-2)'}" data-tip="<div class='t'>${esc(mo)} × ${esc(ta)}</div><b>${n}</b> trials" data-mo="${esc(mo)}" data-ta="${esc(ta)}">${n||''}</div>`;});});
    h+='</div>';$('#modheat').innerHTML=h;bindTips($('#modheat'));$$('#modheat .c[data-mo]').forEach(el=>el.onclick=()=>{F.mo.clear();F.mo.add(el.dataset.mo);F.ta.clear();F.ta.add(el.dataset.ta);App.update();});
    const qs=[...new Set(MONTHS.map(m=>m.slice(0,4)+' Q'+(Math.floor((+m.slice(5,7)-1)/3)+1)))];const top=mos.slice(0,7),keys=[...top,'Other'];
    const series=keys.map(k=>({name:k,v:qs.map(()=>0)}));base.filter(t=>t.ph==='P3').forEach(t=>{const j=top.includes(t.mo)?top.indexOf(t.mo):7;series[j].v[qs.indexOf(t.pq)]++;});
    stackedBars($('#modcad'),{cats:qs,series,colors:keys.map((k,i)=>i<7?moColor(k):GREY),height:190});$('#modcad-legend').innerHTML=keys.map((k,i)=>`<span><i style="background:${i<7?moColor(k):GREY}"></i>${esc(k)}</span>`).join('');
  },

  /* ---- geography ---- */
  renderGeo(){
    const base=VIEW;const c=new Map();base.forEach(t=>t.tc.forEach(x=>c.set(x,(c.get(x)||0)+1)));
    const rows=[...c.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>({name:k,key:k,parts:[v],total:v}));
    hbars($('#geo'),rows,{colors:[ASH.bone],onClick:r=>{F.q=r.key;$('#q').value=r.key;App.update();},tipFn:r=>`<div class="t">${esc(r.name)}</div><b>${r.total}</b> trials list it among top-4 site countries`});
    $('#geo').insertAdjacentHTML('afterbegin','<div class="dim2" style="font-size:11px;margin-bottom:8px">Counted where the country is among a study\'s four most-used site countries. Multi-country trials count once per country.</div>');
    const d=count(base,'dom');const drows=[...d.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:k,key:k,parts:[v],total:v}));
    hbars($('#dom'),drows,{colors:[ASH.slate],tipFn:r=>`<div class="t">${esc(r.name)}</div><b>${r.total}</b> trials · ${Math.round(r.total/base.length*100)}%`});
    const sites=base.filter(t=>t.ns);$('#dom').insertAdjacentHTML('beforeend',`<div class="kv" style="margin-top:14px;grid-template-columns:1fr auto"><span class="k">Median sites / trial</span><span class="v num">${median(sites.map(t=>t.ns))}</span><span class="k">Median countries / trial</span><span class="v num">${median(sites.map(t=>t.nc))}</span><span class="k">Single-country trials</span><span class="v num">${sites.filter(t=>t.nc===1).length} · ${Math.round(sites.filter(t=>t.nc===1).length/sites.length*100)}%</span><span class="k">≥10-country trials</span><span class="v num">${sites.filter(t=>t.nc>=10).length}</span></div>`);
  },

  /* ---- FDA ---- */
  pdF:'all',pdMonth:null,
  renderPDUFA(){
    const all=REG.rows.map(r=>({...r,d:r.date,pr:!!r.priority}));
    if(!all.length){$('#pdufachart').innerHTML='';$('#pdufatbl').innerHTML='<tbody><tr><td class="empty">No regulatory calendar loaded — run make pull-pdufa and rebuild.</td></tr></tbody>';return;}
    $$('#pd-f button').forEach(b=>b.onclick=()=>{App.pdF=b.dataset.f;App.pdMonth=null;$$('#pd-f button').forEach(x=>x.classList.toggle('on',x===b));App.renderPDUFA();});
    const ms=MONTHS.filter(m=>m>=all[0].d.slice(0,7)&&m<=all[all.length-1].d.slice(0,7));
    const series=[{name:'PDUFA · priority',v:ms.map(m=>all.filter(p=>p.kind==='pdufa'&&p.pr&&p.d.startsWith(m)).length)},{name:'PDUFA · standard',v:ms.map(m=>all.filter(p=>p.kind==='pdufa'&&!p.pr&&p.d.startsWith(m)).length)},{name:'AdCom',v:ms.map(m=>all.filter(p=>p.kind==='adcom'&&p.d.startsWith(m)).length)},{name:'Resubmission',v:ms.map(m=>all.filter(p=>p.kind==='resubmission'&&p.d.startsWith(m)).length)}];
    stackedBars($('#pdufachart'),{cats:ms,labels:ms.map(fmtM),series,colors:[ASH.warmbone,ASH.steel,ASH.slate,ASH.pine],height:140,sel:App.pdMonth,onClick:m=>{App.pdMonth=App.pdMonth===m?null:m;App.renderPDUFA();}});
    let rows=all.filter(p=>App.pdF==='all'||(App.pdF==='prio'?p.pr:App.pdF==='pdufa'?p.kind==='pdufa':App.pdF==='adcom'?p.kind==='adcom':true));if(App.pdMonth)rows=rows.filter(p=>p.d.startsWith(App.pdMonth));
    const q=F.q.toLowerCase();if(q)rows=rows.filter(p=>((p.asset||'')+' '+p.company+' '+(p.ticker||'')+' '+(p.sentence||'')).toLowerCase().includes(q));
    $('#pdufatbl thead').innerHTML='<tr><th>Date</th><th>Δ days</th><th>Kind</th><th>Asset</th><th>Company</th><th>Review</th><th>Confidence</th><th>Filing</th><th>What the filing says</th></tr>';
    $('#pdufatbl tbody').innerHTML=rows.map(p=>{const dd=Math.round((new Date(p.d+'T00:00:00')-TODAY)/864e5);
      return `<tr><td class="num">${fmtD(p.d)}${p.precision!=='day'?' <span class="badge" title="'+esc(p.precision)+'-precision statement; shown at the period end">≈</span>':''}</td><td class="num"><span class="dtr${dd<0?' past':dd<=45?' soon':''}">${dd>=0?'+':''}${dd}</span></td><td><span class="badge ${p.kind==='pdufa'?'pri':p.kind==='adcom'?'bla':''}">${REG_KIND[p.kind]||p.kind}</span></td><td class="wrap" style="max-width:170px;min-width:90px"><span class="ttl" style="max-width:170px" title="${esc(p.asset||'')}">${esc(p.asset||'—')}</span></td><td>${p.ticker?`<span class="badge">${esc(p.ticker)}</span> `:''}<span class="dim">${esc(p.company||'')}</span></td><td>${p.pr?'<span class="badge nme">Priority</span>':'<span class="dim2">—</span>'}</td><td><span class="dim${p.confidence==='firm'?'':'2'}">${esc(p.confidence||'')}</span>${p.history&&p.history.length?` <span class="badge" style="color:var(--amber)" title="earlier statements: ${esc(p.history.map(h=>h.date).join(', '))}">moved</span>`:''}</td><td class="mono" style="font-size:11px"><a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.form||'filing')} ${fmtD(p.filed)} ↗</a></td><td><div class="quote" title="${esc(p.sentence||'')}">${esc(p.sentence||'')}</div></td></tr>`;}).join('')||'<tr><td colspan="9" class="empty">No regulatory dates match.</td></tr>';
    $('#pdufa-hint').textContent=`${rows.length} of ${all.length} dates${App.pdMonth?' · '+fmtM(App.pdMonth):''} · PDUFA, AdCom and resubmission dates as companies disclosed them in 8-K, 6-K, 10-Q and 10-K filings, pulled ${REG.pulled?REG.pulled.slice(0,10):'—'} · ≈ marks month/quarter statements · firm = exact date in a filing under six months old`;
  },
  renderFDA(){
    App.renderPDUFA();
    let rows=FDA.filter(f=>App.fdaF==='nme'?(f.kind!=='ANDA'&&f.ty==='ORIG'&&f.nme):App.fdaF==='eff'?(f.kind!=='ANDA'&&/efficacy/i.test(f.cls)):(f.kind!=='ANDA'&&f.ty==='ORIG'));
    const q=F.q.toLowerCase();if(q)rows=rows.filter(f=>(f.b+' '+f.g+' '+f.sp+' '+f.grp).toLowerCase().includes(q));
    const [sk,sd]=App.fdaSort;rows.sort((a,b)=>cmp(a,b,sk)*sd);
    const ms=[];for(let y=2025;y<=2026;y++)for(let m=1;m<=12;m++){const k=`${y}-${String(m).padStart(2,'0')}`;if(k<=TODAY.toISOString().slice(0,7))ms.push(k);}
    const series=[{name:'BLA',v:ms.map(m=>rows.filter(f=>f.d.startsWith(m)&&f.kind==='BLA').length)},{name:'NDA',v:ms.map(m=>rows.filter(f=>f.d.startsWith(m)&&f.kind==='NDA').length)}];
    stackedBars($('#fdachart'),{cats:ms,labels:ms.map(fmtM),series,colors:[ASH.slate,ASH.bone],height:150});
    const cols=[['Action date','d'],['Brand','b'],['Active ingredient','g'],['Sponsor','grp'],['Application','app'],['Type','ty'],['Class','cls'],['Priority','pr'],['Route','rt']];
    $('#fdatbl thead').innerHTML='<tr>'+cols.map(([l,k])=>`<th data-k="${k}" class="${sk===k?'sorted':''}">${l}${sk===k?`<span class="arr">${sd>0?'▲':'▼'}</span>`:''}</th>`).join('')+'</tr>';
    $$('#fdatbl th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;App.fdaSort=[k,App.fdaSort[0]===k?-App.fdaSort[1]:-1];App.renderFDA();});
    const per=80,pg=App.fdaPage,slice=rows.slice(pg*per,(pg+1)*per);
    $('#fdatbl tbody').innerHTML=slice.map(f=>`<tr class="r fdarow" data-tip="<div class='t'>${esc(f.b)}</div><div class='k'>${esc(f.g)}</div><hr><div class='row'><span class='k'>Sponsor</span><b>${esc(f.sp)}</b></div><div class='row'><span class='k'>Dosage form</span><b>${esc(f.df)}</b></div><div class='row'><span class='k'>Submission</span><b>${esc(f.ty)} · ${esc(f.cls||'—')}</b></div>"><td class="num">${fmtD(f.d)}</td><td class="b">${esc(f.b)}</td><td class="g">${esc(f.g.toLowerCase())}</td><td>${esc(f.grp)}</td><td class="mono" style="font-size:11px"><a href="https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=BasicSearch.process&ApplNo=${f.app.replace(/\D/g,'')}" target="_blank" rel="noopener">${esc(f.app)}</a></td><td><span class="badge ${f.kind==='BLA'?'bla':''}">${f.kind} ${f.ty}</span></td><td>${f.nme?'<span class="badge nme">NME</span> ':''}<span class="dim">${esc(f.cls||'—')}</span></td><td>${f.pr==='PRIORITY'?'<span class="badge pri">Priority</span>':f.pr?'<span class="dim2">Standard</span>':'—'}</td><td class="dim">${esc(f.rt)}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">No approval actions match.</td></tr>';
    bindTips($('#fdatbl'));const np=Math.ceil(rows.length/per);
    $('#fdapager').innerHTML=`<span>${rows.length.toLocaleString()} actions · page ${np?pg+1:0}/${np} · openFDA drugsfda · pulled ${META.pulled.slice(0,10)}</span><span class="sp"></span><button class="btn sm" ${pg===0?'disabled':''} onclick="App.fdaPage--;App.renderFDA()">‹ prev</button><button class="btn sm" ${pg>=np-1?'disabled':''} onclick="App.fdaPage++;App.renderFDA()">next ›</button>`;
  },

  /* ---- risk ---- */
  renderRisk(){
    const p3=VIEW.filter(t=>t.ph==='P3');const bins=Array.from({length:10},(_,i)=>i*10);
    const series=[{name:'Phase 3',v:bins.map(b=>p3.filter(t=>t.conf>=b&&t.conf<b+10||(b===90&&t.conf===100)).length)}];
    stackedBars($('#riskhist'),{cats:bins.map(String),labels:bins.map(b=>b+'–'+(b+9)),series,colors:[ASH.bone],height:180,onClick:b=>{App.riskBin=+b;App.renderRisk();}});
    const sig=[['PCD passed, still estimated',p3.filter(t=>t.days<0&&t.pct!=='ACTUAL').length,'c'],['Registry stale >12 mo',p3.filter(t=>(TODAY-new Date(t.lu+'T00:00:00'))/864e5>365).length,'w'],['Still recruiting <6 mo out',p3.filter(t=>t.st==='RECRUITING'&&t.days>=0&&t.days<180).length,'w'],['Not yet recruiting',p3.filter(t=>t.st==='NOT_YET_RECRUITING').length,'w'],['Stopped (term./withdr./susp.)',p3.filter(t=>['TERMINATED','WITHDRAWN','SUSPENDED'].includes(t.st)).length,'c'],['Enrolling < half peer-median pace',p3.filter(t=>t.velR!=null&&t.velR<0.5&&t.st!=='COMPLETED').length,'w'],['Actual completion reported',p3.filter(t=>t.pct==='ACTUAL').length,'g'],['Results already posted',p3.filter(t=>t.hr).length,'g']];
    $('#risksig').innerHTML=sig.map(([l,n,k])=>`<div class="meter"><span style="font-size:12px" class="dim">${l}</span><span></span><div class="tr"><i style="width:${p3.length?n/p3.length*100:0}%;background:var(--${k==='c'?'crit':k==='w'?'warn':'good'})"></i></div><span class="v">${n} · ${p3.length?Math.round(n/p3.length*100):0}%</span></div>`).join('')+`<div class="dim2" style="font-size:11px;margin-top:10px">Share of ${p3.length.toLocaleString()} Phase 3 trials in view. Stopped studies still carry a registered completion date and stay in the universe so the denominator is honest.</div>`;
    $$('#risksig .meter').forEach(el=>el.style.gridTemplateColumns='200px 0 1fr auto');
    const rows=p3.filter(t=>t.conf>=75&&t.days>=0&&t.days<=180).sort((a,b)=>a.pd-b.pd);
    $('#risktbl thead').innerHTML='<tr><th>Readout</th><th>Δ days</th><th>Asset / study</th><th>Sponsor</th><th>Indication</th><th>Status</th><th class="num">N</th><th class="num">Conf.</th><th>Why</th></tr>';
    $('#risktbl tbody').innerHTML=rows.map(t=>`<tr class="r" data-id="${t.id}"><td class="num">${fmtD(t.pcd)}</td><td class="num">+${t.days}</td><td class="wrap"><span class="ttl">${esc(t.ac?t.ac+' — ':'')}${esc(t.t)}</span><span class="dim2 mono" style="font-size:10px">${t.id}</span></td><td><span class="sponsor${t.tier==='Large pharma'?' big':''}">${esc(t.grp)}</span></td><td class="wrap" style="max-width:200px"><span class="ttl" style="max-width:200px">${esc(t.c[0]||'')}</span></td><td><span class="st ${t.st}"><i></i>${ST_LBL[t.st]}</span></td><td class="num">${fmtN(t.n)}</td><td class="num"><span class="conf hi"><span class="bar"><i style="width:${t.conf}%"></i></span>${t.conf}</span></td><td>${t.why.filter(w=>w[2]==='g').slice(0,2).map(w=>`<span class="flag g">${w[0]}</span>`).join('')}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">Nothing at ≥75 in the next 180 days under the current filters.</td></tr>';
    $$('#risktbl tr.r').forEach(tr=>{tr.onclick=()=>Dossier.open(tr.dataset.id);const t=IDX.get(tr.dataset.id);tr.addEventListener('mouseenter',e=>Tip.show(trialTip(t),e));tr.addEventListener('mousemove',Tip.move);tr.addEventListener('mouseleave',Tip.hide);});
  },
  renderAbout(){
    $('#prov').innerHTML=`<div class="prov">source        ClinicalTrials.gov API v2 · GET /api/v2/studies
query.term    ${esc(META.ct_query)}
pageSize      1000 · paged via nextPageToken
pulled        ${META.pulled}
records       ${META.n_trials.toLocaleString()} studies · ${JSON_BYTES.toLocaleString()} bytes normalised
source        openFDA · GET /drug/drugsfda.json
search        submissions.submission_status_date:[20250101 TO 20271231] AND submissions.submission_status:AP
records       ${META.n_fda.toLocaleString()} approval actions across ${new Set(FDA.map(f=>f.app)).size.toLocaleString()} applications
transport     gzip → base64 in-page payload · DecompressionStream at load
live mode     ${Live.available===false?'blocked by hosted sandbox':'ClinicalTrials.gov v2 delta on LastUpdatePostDate'}
diff          ${DIFF.prev_pulled?`vs snapshot ${DIFF.prev_pulled.slice(0,10)} · ${DIFF.changed} changed · ${DIFF.slipped} slipped · ${DIFF.pulled_in} pulled in · ${DIFF.firmed} firmed · ${DIFF.status} status · ${(DIFF.new||[]).length} new · ${(DIFF.gone||[]).length} gone`:'no previous snapshot'}
source        SEC EDGAR full-text search · 8-K / 6-K / 10-Q / 10-K · ${REG.rows.length} PDUFA / AdCom / resubmission dates · pulled ${esc(REG.pulled||'—')}
source        SEC Form D structured data sets · ${FD.quarters?FD.quarters[0]+' → '+FD.quarters[FD.quarters.length-1]:'—'} · ${FD.n_issuers_total||0} bio/pharma issuers · ${Object.keys(FD.issuers||{}).length} matched to sponsors · pulled ${esc(FD.pulled||'—')}
source        NIH RePORTER v2 · ${NIH.n_queried||0} organisations queried · ${Object.keys(NIH.orgs||{}).length} with awards · pulled ${esc(NIH.pulled||'—')}
source        SEC insider-transactions data sets (Form 4, codes P/S) · ${(INS.quarters||[]).join(', ')} · pulled ${esc(INS.pulled||'—')}\nsource        SEC EDGAR 13F-HR information tables · ${F13.funds.length} funds · pulled ${esc(F13.pulled||'—')}\nbuilt         ${META.built}</div>
    <div class="sec"><h4>Field dictionary</h4><div class="kv"><span class="k">Readout</span><span class="v">primaryCompletionDateStruct.date — last data collection for the primary endpoint</span><span class="k">A badge</span><span class="v">date type ACTUAL rather than ESTIMATED</span><span class="k">Conf.</span><span class="v">readout-confidence heuristic, 0–100 (see Method)</span><span class="k">Prior</span><span class="v">literature phase-transition probability, oncology vs. non-oncology</span><span class="k">Sponsor ●</span><span class="v">large-pharma group (subsidiaries mapped)</span><span class="k">N</span><span class="v">enrollmentInfo.count — planned or actual</span><span class="k">Mechanism tags</span><span class="v">183-pattern target/mechanism lexicon over title, interventions, descriptions, keywords and summary; curated one-line notes for 171 named assets</span><span class="k">Listing / cash / R&D / float</span><span class="v">SEC company_tickers + XBRL frames (us-gaap; latest instant for cash, FY2025 flows, last two quarters for run-rate; dei EntityPublicFloat as the market-cap proxy, EntityCommonStockSharesOutstanding for per-share) — US filers only; ex-US listings carry ticker only. Pulled ${esc(DATA.sec_pulled||'')}</span></div></div>`;
  }
};
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=s.length>>1;return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2);}
function cmp(a,b,k){let x=a[k],y=b[k];if(k==='mcap'){x=a.mcap;y=b.mcap;}if(k==='action'){const o=['Pass','Pass / hedge','Wait','Review flow','Diligence enrollment','Size / diligence endpoints','Diligence endpoints','Monitor'];x=o.indexOf(a.action);y=o.indexOf(b.action);}if(k==='wl'){x=WL.has(a.id)?1:0;y=WL.has(b.id)?1:0;}if(k==='c'){x=a.c[0]||'';y=b.c[0]||'';}if(x==null)return 1;if(y==null)return -1;return x<y?-1:x>y?1:0;}
const TA_SLOT=new Map();function taColor(k){if(k==='Other areas'||k==='Other')return GREY;if(!TA_SLOT.has(k)){const order=['Oncology','Cardiometabolic','Immunology & Inflammation','Neuroscience','Infectious Disease & Vaccines','Rare & Genetic Disease','Ophthalmology'];const i=order.indexOf(k);TA_SLOT.set(k,i>=0?[ASH.bone,ASH.slate,ASH.brass,ASH.teal,ASH.warmbone,ASH.taupe,ASH.stone][i]:GREY);}return TA_SLOT.get(k);}
/* modality: muted, no rainbow — mAb steel · small molecule brass · ADC slate · cell/gene deep slate-teal · other pine */
const MO_COLOR={'Monoclonal antibody':ASH.steel,'Small molecule':ASH.brass,'ADC':ASH.slate,'Cell therapy':ASH.teal,'Gene therapy / editing':ASH.teal,'Bispecific / multispecific':ASH.steel,'mRNA / vaccine':ASH.warmbone,'GLP-1 / incretin':ASH.taupe,'Oligonucleotide (siRNA/ASO)':ASH.stone,'Radiopharmaceutical':ASH.stone,'Peptide / protein / enzyme':ASH.taupe};function moColor(k){return MO_COLOR[k]||GREY;}

/* ---------- dossier ---------- */
const Dossier={cur:null,
  open(id){const t=IDX.get(id);if(!t)return;Tip.hide();Dossier.cur=t;const el=$('#dossier');el.classList.add('open');
    $('#d-eye').innerHTML=`<span class="mono">${t.id}</span> · <span class="tag ${PH_CLS[t.ph]}">${t.ph}</span> · <span class="st ${t.st}"><i></i>${ST_LBL[t.st]||t.st}</span>`;
    $('#d-title').textContent=(t.ac?t.ac+' — ':'')+t.t;
    $('#d-tags').innerHTML=`${inWin(t)?'':`<div class="flag w" style="margin-bottom:6px">Outside current window — primary completion ${fmtD(t.pcd)} · <button class="btn sm" style="height:18px;margin-left:4px" onclick="F.win=[F.win[0]<'${t.pm}'?F.win[0]:'${t.pm}',F.win[1]>'${t.pm}'?F.win[1]:'${t.pm}'];document.getElementById('win0').value=F.win[0];document.getElementById('win1').value=F.win[1];App.update()">widen window</button></div>`}<span class="flag">${esc(t.ta)}</span><span class="flag">${esc(t.mo)}</span><span class="flag">${esc(t.tier)}</span>${t.dsg.map(d=>`<span class="flag">${d}</span>`).join('')}`;
    const stale=Math.round((TODAY-new Date(t.lu+'T00:00:00'))/864e5);
    const rel=T.filter(x=>x.id!==t.id&&x.grp===t.grp&&x.ta===t.ta).sort((a,b)=>a.pd-b.pd).slice(0,6);
    const comp=T.filter(x=>x.id!==t.id&&x.ph===t.ph&&x.c[0]&&t.c[0]&&x.c[0].toLowerCase()===t.c[0].toLowerCase()&&x.grp!==t.grp).sort((a,b)=>a.pd-b.pd).slice(0,6);
    $('#d-body').innerHTML=`
      <div style="display:flex;gap:8px;margin-bottom:6px"><a class="btn sm" href="https://clinicaltrials.gov/study/${t.id}" target="_blank" rel="noopener">Open on ClinicalTrials.gov ↗</a><button class="btn sm" onclick="WL.toggle('${t.id}');Dossier.open('${t.id}')">${WL.has(t.id)?'★ Watching':'☆ Watch'}</button><button class="btn sm" onclick="navigator.clipboard&&navigator.clipboard.writeText('${t.id}').then(()=>toast('${t.id} copied'))">Copy NCT</button><button class="btn sm" onclick="F.q='${esc(t.grp).replace(/'/g,"\\'")}';document.getElementById('q').value=F.q;App.update()">Sponsor's trials</button><button class="btn sm" onclick="Landscape.show('${t.id}')" title="Every registered 2026–28 trial in this indication, start → readout">Indication landscape</button></div>
      <div class="decision ${t.action.split(' ')[0].toLowerCase()}"><div class="lbl" data-gl="decision">Decision line</div><div class="dl"><b>${esc(t.action)}</b> <span class="dim">· ${esc(t.actionWhy)}</span></div><div class="dm"><span>impact <b class="num">${t.impactB}</b></span><span>date <b>${t.rel}</b></span><span>cash-to-event <b>${t.cashm!=null?(t.binding?'binding':'not binding'):(t.tier==='Large pharma'||(t.sec&&((t.sec.ni||0)>0))?'n/a · profitable':'n/a')}</b>${t.cashm!=null?` <span class="dim2 num">${Math.round(t.cashm)} mo vs ${Math.round(t.m2e)} mo</span>`:''}</span>${t.own?`<span>specialists <b class="num">${t.own.n}</b>${t.own.new?` <span style="color:var(--good)">+${t.own.new}</span>`:''}</span>`:''}</div><div class="dim2" style="font-size:10.5px;margin-top:4px">Rules-based, transparent, not advice — see Method → Decision rules.</div></div>
      <div class="sec"><h4>Readout</h4>
        <div class="kv"><span class="k">Primary completion</span><span class="v num">${fmtD(t.pcd)} <span class="dim2">· ${t.pct==='ACTUAL'?'actual':'estimated'} · ${t.days>=0?'in '+t.days+' days':Math.abs(t.days)+' days ago'}</span></span>
        ${t.chg&&t.chg.length?`<span class="k">Since last snapshot</span><span class="v">${t.chg.map(x=>`<span class="flag ${x[0]==='status'&&/TERMINATED|WITHDRAWN|SUSPENDED/.test(x[2])?'c':x[0]==='primary completion'&&!t.frm&&x[2]>x[1]?'w':'g'}">${esc(x[0])}: ${esc(String(x[1]??'—'))} → ${esc(String(x[2]??'—'))}</span>`).join('')}${t.slip?`<span class="dim2" style="font-size:10.5px"> ${t.frm?'firmed':'moved '+(t.slip>0?'out':'in')+' '+Math.abs(t.slip)+' mo'} vs ${DIFF.prev_pulled?DIFF.prev_pulled.slice(0,10):'previous'}</span>`:''}</span>`:''}<span class="k">Study completion</span><span class="v num">${fmtD(t.cd)}</span><span class="k">Start</span><span class="v num">${fmtD(t.sd)}</span>
        <span class="k">Primary endpoint</span><span class="v">${esc(t.po||'—')}${t.pot?` <span class="dim2">[${esc(t.pot)}]</span>`:''}</span></div>
        <div class="meter" data-gl="conf"><div class="tr"><i style="width:${t.conf}%;background:var(--${t.conf>=75?'good':t.conf>=50?'warn':'crit'})"></i></div><span class="v">${t.conf} <span class="dim2">confidence</span></span></div>
        <div style="margin:6px 0 2px">${t.why.map(w=>`<span class="flag ${w[2]}">${w[0]} <b class="num">${w[1]}</b></span>`).join('')||'<span class="dim2">No adjustments from the 55 baseline.</span>'}</div>
        <div class="meter" data-gl="prior"><div class="tr"><i style="width:${t.pri*100}%;background:var(--ink-3)"></i></div><span class="v">${Math.round(t.pri*100)}% <span class="dim2">base-rate prior · ${t.ph}${t.ta==='Oncology'?' oncology':' non-oncology'}</span></span></div></div>
      ${regSection(t)}
      ${ownSection(t)}${insSection(t)}
      <div class="sec"><h4>Design</h4><div class="kv"><span class="k">Enrollment</span><span class="v num">${fmtN(t.n)} <span class="dim2">${t.nt==='ACTUAL'?'actual':'estimated'}</span></span><span class="k">Allocation</span><span class="v">${esc(nice(t.al))}</span><span class="k">Masking</span><span class="v">${esc(nice(t.mk))}</span><span class="k">Model</span><span class="v">${esc(nice(t.im))}</span><span class="k">Purpose</span><span class="v">${esc(nice(t.pp))}</span><span class="k">Footprint</span><span class="v">${t.ns?`${t.ns} sites · ${t.nc} countries · ${esc(t.tc.join(', '))}`:'no sites listed'}</span>
        ${t.vel?`<span class="k">Enrollment pace</span><span class="v num">${t.vel.toFixed(1)} pts/mo <span class="dim2">over ${Math.round(t.mos)} mo</span>${t.velR!=null?` · <span style="color:${t.velR<0.5?'var(--crit)':t.velR<0.8?'var(--warn)':'var(--good)'}">${t.velR.toFixed(2)}×</span> <span class="dim2">${esc(t.ta)} ${t.ph} median ${(BENCH[t.ta+'|'+t.ph]||{}).vel?.toFixed(1)} (n=${(BENCH[t.ta+'|'+t.ph]||{}).n})</span>`:''}</span>`:''}
        ${t.spp?`<span class="k">Site density</span><span class="v num">${t.spp.toFixed(1)} sites / 100 pts${t.sppR!=null?` <span class="dim2">· ${t.sppR.toFixed(2)}× peer median</span>`:''}</span>`:''}</div></div>
      ${rnpvSection(t)}
      <div class="sec"><h4>Mechanism</h4>
        ${t.moa&&t.moa.length?`<div style="margin-bottom:6px">${t.moa.map(m=>`<span class="flag" style="border-color:rgba(99,169,255,.45);color:#8ec0ff;cursor:pointer" onclick="F.toggle('moa','${esc(m).replace(/'/g,"\\'")}',true)" title="Filter the dashboard to this target (click again to clear)">${esc(m)}</span>`).join('')}</div>`:''}
        ${t.mn?`<div class="summ" style="color:var(--ink)">${esc(t.mn)}</div><div class="dim2" style="font-size:10.5px;margin-top:2px">Curated note from public disclosures — verify against the sponsor's own materials.</div>`:''}
        <div class="ivl" style="margin-top:8px">${t.iv.map((i,k)=>`<div><span class="ty">${esc(i[0])}</span><span>${esc(i[1])}${t.ivd&&t.ivd[k]&&t.ivd[k]!==i[1]?`<br><span class="dim" style="font-size:11px">${esc(t.ivd[k])}</span>`:''}</span></div>`).join('')||'—'}</div>
        <div id="moa-ai" style="margin-top:8px"></div></div>
      <div class="sec"><h4>Sponsor</h4><div class="kv"><span class="k">Lead</span><span class="v">${esc(t.sp)}${t.grp!==t.sp?` <span class="dim2">→ ${esc(t.grp)}</span>`:''}</span>${t.co.length?`<span class="k">Collaborators</span><span class="v">${esc(t.co.join(' · '))}</span>`:''}<span class="k">Tier / domicile</span><span class="v">${esc(t.tier)} · ${esc(t.dom)}</span>${secRow(t.sec)}${t.lv?`<span class="k">Longevity company</span><span class="v">${esc(t.lv)} · <button class="btn sm" style="height:20px" onclick="App.setTab('lv')">Longevity tab ↗</button></span>`:''}</div></div>
      ${privateSection(t.fdi,t.nihi,t.sp)}
      <div class="sec"><h4>Conditions &amp; keywords</h4><div class="summ">${esc(t.c.join(' · '))}${t.k.length?`<br><span class="dim2">${esc(t.k.join(' · '))}</span>`:''}</div></div>
      <div class="sec"><h4>Registry</h4><div class="kv"><span class="k">First posted</span><span class="v num">${fmtD(t.fp)}</span><span class="k">Last update</span><span class="v num">${fmtD(t.lu)} <span class="${stale>365?'dim':'dim2'}">· ${stale} d ago</span></span><span class="k">Results posted</span><span class="v">${t.hr?'yes':'no'}</span><span class="k">FDA-regulated drug</span><span class="v">${t.fda?'yes':'not flagged'}</span>${t.ws?`<span class="k">Why stopped</span><span class="v">${esc(t.ws)}</span>`:''}</div></div>
      ${t.sum?`<div class="sec"><h4>Summary</h4><div class="summ">${esc(t.sum)}${t.sum.length>=400?'…':''}</div></div>`:''}
      ${comp.length?`<div class="sec"><h4>Same indication, same phase — other sponsors</h4><div class="related">${comp.map(x=>`<button onclick="Dossier.open('${x.id}')"><span class="num dim2">${fmtD(x.pcd)}</span><span class="ttl">${esc(x.t)}</span><span class="dim2">${esc(x.grp)}</span></button>`).join('')}</div></div>`:''}
      ${rel.length?`<div class="sec"><h4>${esc(t.grp)} · same area</h4><div class="related">${rel.map(x=>`<button onclick="Dossier.open('${x.id}')"><span class="num dim2">${fmtD(x.pcd)}</span><span class="tag ${PH_CLS[x.ph]}">${x.ph}</span><span class="ttl">${esc(x.t)}</span></button>`).join('')}</div></div>`:''}`;
    $$('#caltbl tr.r').forEach(tr=>tr.classList.toggle('sel',tr.dataset.id===id));
    applyGloss($('#d-body'));AI.mount(t);rnpvCalc();
  },
  close(){$('#dossier').classList.remove('open');Dossier.cur=null;$$('#caltbl tr.sel').forEach(x=>x.classList.remove('sel'));},
  step(d){if(!Dossier.cur)return;const rows=$$('#caltbl tr.r').map(x=>x.dataset.id);const i=rows.indexOf(Dossier.cur.id);const n=rows[i+d];if(n){Dossier.open(n);const tr=$(`#caltbl tr[data-id="${n}"]`);tr&&tr.scrollIntoView({block:'nearest'});}}
};
const DSG_TIP={'Randomised':'Patients were assigned to arms at random.','Blinded':'At least one party did not know the assignment.','Placebo-controlled':'A placebo arm is registered among the interventions.','Single-arm':'No comparator arm; harder to interpret.','Results posted':'Results are already on ClinicalTrials.gov.','FDA-regulated':'Sponsor flagged the study as FDA-regulated.','US-listed':'Sponsor trades on a US exchange (SEC ticker join).','Listed ex-US':'Sponsor is listed outside the US or on OTC.','Private':'No listing found for the sponsor.','Regulatory date pending':'The sponsor has disclosed an upcoming PDUFA, AdCom or resubmission date in an SEC filing.','Specialist-held ≥3':'At least three biotech-specialist funds hold the sponsor (13F).','Insider buying':'Officers or directors bought at least $100k in the open market, more than they sold (Form 4).','Form D on file':'The sponsor is a private issuer with Regulation D placements on file at the SEC: amounts raised, dates, officers and directors.','NIH-funded':'The sponsor holds NIH research awards (RePORTER), non-dilutive money with a mechanism abstract behind it.','Aging-adjacent':'Mechanism or indication keywords point at aging biology.','Longevity-funded':'Sponsor is one of the venture-backed longevity companies compiled from public reports.','Slipped':'Primary completion pushed out by a month or more since the previous snapshot.','Date firmed':'A placeholder or estimate became a specific or actual date since the previous snapshot.','New this snapshot':'Entered the universe since the previous snapshot.'};
const nice=s=>s?s.toLowerCase().replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase()):'—';

/* ---------- command palette ---------- */
const Pal={i:0,res:[],init(){const q=$('#palq');q.addEventListener('input',()=>Pal.search(q.value));q.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();Pal.i=Math.min(Pal.res.length-1,Pal.i+1);Pal.paint();}else if(e.key==='ArrowUp'){e.preventDefault();Pal.i=Math.max(0,Pal.i-1);Pal.paint();}else if(e.key==='Enter'){if(e.shiftKey||!Pal.res.length){F.q=q.value.trim();$('#q').value=F.q;F.clearFocus();Pal.close();App.update();App.setTab(App.tab==='fda'?'fda':'cal');}else{const r=Pal.res[Pal.i];Pal.close();if(r.type==='trial'){F.q='';$('#q').value='';Dossier.open(r.id);}else if(r.type==='sponsor'){F.q='';$('#q').value='';F.clearFocus();F.grp=r.key;App.update();App.setTab('cal');}else if(r.type==='investor'){F.q='';$('#q').value='';F.clearFocus();F.inv=r.key;App.update();App.setTab('cal');toast('Filtered to '+r.key+"'s holdings");}else if(r.type==='target'){F.q='';$('#q').value='';F.clearFocus();F.moa.clear();F.moa.add(r.key);App.update();App.setTab('cal');toast('Filtered to target: '+r.key);}else{F.q=r.key;$('#q').value=r.key;F.clearFocus();App.update();App.setTab('cal');}}}});},
  open(){$('#pal').classList.add('open');const q=$('#palq');q.value=F.q;Pal.search(q.value);setTimeout(()=>q.focus(),0);},close(){$('#pal').classList.remove('open');},
  search(v){v=v.trim().toLowerCase();Pal.i=0;if(!v){Pal.res=[];$('#palres').innerHTML='<div class="it dim2">Type to search 10,000+ registered trials (2026–2028 completions), sponsor groups and indications. Results outside the current window are flagged. Shift+Enter applies the text as a filter.</div>';return;}
    const ws=v.split(/\s+/);const hit=t=>ws.every(w=>t.hay.includes(w));
    const trials=[];for(const t of T){if(hit(t)){trials.push(t);if(trials.length>=40)break;}}
    trials.sort((a,b)=>(b.ph==='P3')-(a.ph==='P3')||a.pd-b.pd);
    const sp=new Map();T.forEach(t=>{if(t.grp.toLowerCase().includes(v))sp.set(t.grp,(sp.get(t.grp)||0)+1);});
    const ind=new Map();T.forEach(t=>t.c.forEach(c=>{if(c.toLowerCase().includes(v))ind.set(c,(ind.get(c)||0)+1);}));
    const inv=(App.INV||[]).filter(i=>i.name.toLowerCase().includes(v)).sort((a,b)=>b.trials-a.trials).slice(0,5);
    const tg=new Map();T.forEach(t=>(t.moa||[]).forEach(m=>{if(m.toLowerCase().includes(v))tg.set(m,(tg.get(m)||0)+1);}));
    Pal.res=[...[...tg.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,n])=>({type:'target',key:k,n})),...inv.map(i=>({type:'investor',key:i.name,n:i.trials,kind:i.kind,issuers:i.n})),...[...sp.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,n])=>({type:'sponsor',key:k,n})),...[...ind.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,n])=>({type:'ind',key:k,n})),...trials.slice(0,12).map(t=>({type:'trial',id:t.id,t}))];Pal.paint();},
  paint(){$('#palres').innerHTML=Pal.res.map((r,i)=>r.type==='trial'?`<div class="it${i===Pal.i?' on':''}" data-i="${i}"><span class="tag ${PH_CLS[r.t.ph]}">${r.t.ph}</span><span class="ttl">${esc(r.t.t)}</span><span class="k">${esc(r.t.grp)} · ${fmtD(r.t.pcd)}${inWin(r.t)?'':' · <span style="color:var(--amber)">outside window</span>'}</span></div>`:`<div class="it${i===Pal.i?' on':''}" data-i="${i}"><span class="badge${r.type==='investor'?' bla':r.type==='target'?' nme':''}">${r.type==='sponsor'?'sponsor':r.type==='investor'?'investor':r.type==='target'?'target':'indication'}</span><span class="ttl">${esc(r.key)}${r.type==='investor'?` <span class="dim2">· ${esc(r.kind)}</span>`:''}</span><span class="k">${r.type==='investor'?r.issuers+' cos · ':''}${r.n} trials</span></div>`).join('')||'<div class="it dim2">No matches — Enter applies the text as a free-text filter anyway.</div>';
    $$('#palres .it[data-i]').forEach(el=>el.onclick=()=>{Pal.i=+el.dataset.i;$('#palq').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));});}
};

/* ---------- export ---------- */
function exportCSV(){
  const rows=App.tab==='fda'?null:VIEW;
  const head=['nct_id','acronym','title','phase','status','lead_sponsor','sponsor_group','tier','therapeutic_area','modality','mechanism_tags','conditions','interventions','start','primary_completion','pcd_type','completion','enrollment','enrollment_type','allocation','masking','primary_outcome','sites','countries','top_countries','readout_confidence','base_rate_prior','last_update','url'];
  const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
  const lines=[head.join(',')].concat(rows.map(t=>[t.id,t.ac,t.t,t.ph,t.st,t.sp,t.grp,t.tier,t.ta,t.mo,(t.moa||[]).join('; '),t.c.join('; '),t.iv.map(x=>x[1]).join('; '),t.sd,t.pcd,t.pct,t.cd,t.n,t.nt,t.al,t.mk,t.po,t.ns,t.nc,t.tc.join('; '),t.conf,t.pri,t.lu,'https://clinicaltrials.gov/study/'+t.id].map(q).join(',')));
  const csv=lines.join('\n');const name=`saros_${new Date().toISOString().slice(0,10)}_${rows.length}.csv`;
  (async()=>{
    const dl=window.claude&&typeof claude.use==='function'?await claude.use('downloads').catch(()=>null):null;
    if(dl){try{await dl.save({filename:name,data:csv});toast(`Saved ${rows.length} rows`);}catch(e){if(e&&e.code==='declined')toast('Export cancelled');else fallback();}return;}
    fallback();
    function fallback(){try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();a.remove();}catch(e){}
      if(navigator.clipboard)navigator.clipboard.writeText(csv).then(()=>toast(`${rows.length} rows exported · also copied as CSV`)).catch(()=>toast(`Exported ${rows.length} rows`));}
  })();
}

/* ---------- live refresh ---------- */
const Live={available:null,changes:[],
  showChanges(){const c=Live.changes;if(!c.length)return;let el=$('#changes');if(!el){el=document.createElement('section');el.className='panel';el.id='changes';$('#v-cal').prepend(el);}
    const rows=c.slice().sort((a,b)=>(b.wl-a.wl)||(PH_ORDER.indexOf(a.ph)-PH_ORDER.indexOf(b.ph)));
    el.innerHTML=`<div class="ph"><h2>Changes since snapshot</h2><span class="hint">${c.length} trials changed status, date or enrollment · watchlist first</span><div class="tools"><button class="btn sm" onclick="document.getElementById('changes').remove()">✕ close</button></div></div><div class="pb" style="max-height:40vh;overflow:auto"><table class="t"><thead><tr><th>Trial</th><th>Sponsor</th><th>Change</th></tr></thead><tbody>${rows.slice(0,300).map(r=>`<tr class="r" onclick="Dossier.open('${r.id}')"><td class="wrap">${r.wl?'<span class="star on">★</span> ':''}<span class="tag ${PH_CLS[r.ph]}">${r.ph}</span> <span class="ttl" style="display:inline;max-width:none">${esc(r.t)}</span></td><td>${esc(r.grp)}</td><td>${r.ch.map(x=>`<span class="flag ${x[0]==='status'&&/TERMINATED|WITHDRAWN|SUSPENDED/.test(x[2])?'c':x[0]==='primary completion'&&x[2]>x[1]?'w':'g'}">${x[0]}: ${esc(String(x[1]??'—'))} → ${esc(String(x[2]??'—'))}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>`;
    App.setTab('cal');},
  async refresh(){const b=$('#refreshbtn');b.disabled=true;b.textContent='↻ fetching…';
    try{const since=META.pulled.slice(0,10);const q=`${META.ct_query} AND AREA[LastUpdatePostDate]RANGE[${since},MAX]`;
      const fields='NCTId,BriefTitle,Acronym,LeadSponsorName,Phase,OverallStatus,WhyStopped,StartDate,PrimaryCompletionDate,PrimaryCompletionDateType,CompletionDate,EnrollmentCount,EnrollmentType,Condition,Keyword,InterventionName,InterventionType,LastUpdatePostDate,HasResults';
      let tok=null,n=0,upd=0,add=0;
      do{const u=new URL('https://clinicaltrials.gov/api/v2/studies');u.searchParams.set('query.term',q);u.searchParams.set('fields',fields);u.searchParams.set('pageSize','1000');if(tok)u.searchParams.set('pageToken',tok);
        const r=await fetch(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();
        for(const s of j.studies){const p=s.protocolSection,id=p.identificationModule.nctId,st=p.statusModule,dm=p.designModule||{},cm=p.conditionsModule||{},ai=p.armsInterventionsModule||{};
          let t=IDX.get(id);const fresh=!t;const before=t?{st:t.st,pcd:t.pcd,n:t.n,lu:t.lu}:null;if(fresh){t={id,ot:'',co:[],ws:'',al:'',mk:'',pp:'',im:'',po:'',pot:'',fp:st.studyFirstPostDateStruct?.date||'',nc:0,ns:0,tc:[],fda:0,sum:'',ta:'Other',mo:'Small molecule',moa:[],mn:'',ivd:[],ag:0,lv:''};}
          Object.assign(t,{t:(p.identificationModule.briefTitle||'').slice(0,160),ac:p.identificationModule.acronym||'',sp:p.sponsorCollaboratorsModule?.leadSponsor?.name||t.sp,ph:(dm.phases||[]).join('/').replace(/PHASE/g,'P'),st:st.overallStatus,ws:st.whyStopped||t.ws,sd:st.startDateStruct?.date||'',pcd:st.primaryCompletionDateStruct?.date||t.pcd,pct:st.primaryCompletionDateStruct?.type||'',cd:st.completionDateStruct?.date||'',n:dm.enrollmentInfo?.count,nt:dm.enrollmentInfo?.type||'',c:(cm.conditions||[]).slice(0,4),k:(cm.keywords||[]).slice(0,5),iv:(ai.interventions||[]).slice(0,4).map(i=>[i.type,(i.name||'').slice(0,70)]),lu:st.lastUpdatePostDateStruct?.date||'',hr:s.hasResults?1:0});
          if(fresh){T.push(t);IDX.set(id,t);add++;}else{upd++;const ch=[];if(before.st!==t.st)ch.push(['status',before.st,t.st]);if(before.pcd!==t.pcd)ch.push(['primary completion',before.pcd,t.pcd]);if(before.n!==t.n)ch.push(['enrollment',before.n,t.n]);if(ch.length)Live.changes.push({id,t:t.t,grp:t.grp,ph:t.ph,ch,wl:WL.has(id)});}}
        tok=j.nextPageToken;n++;}while(tok&&n<10);
      DATA.trials=T;enrich();App.update();Live.available=true;Live.showChanges();
      $('#freshpill').innerHTML=`<span class="dot"></span><span id="freshtxt">live · ${new Date().toISOString().slice(11,16)}Z</span>`;toast(`Merged ${upd} updated + ${add} new records · ${Live.changes.length} material changes`);
    }catch(e){Live.available=false;toast('Live refresh blocked here (sandbox or network). Open the local copy for live mode.');console.warn('live refresh failed',e);}
    b.disabled=false;b.textContent='↻ Refresh live';}
};

/* ---------- rNPV mini-model ---------- */
function rnpvSection(t){
  const pos=Math.round(t.pri*100);
  const launch=+t.pcd.slice(0,4)+(t.ph==='P3'||t.ph==='P2/P3'?1:t.ph==='P2'?3:5);
  const sh=(t.sec&&t.sec.sh)||null;
  return `<div class="sec"><h4 data-gl="rnpv">rNPV sketch <span class="dim2" style="text-transform:none;letter-spacing:0">· your inputs, nothing here is a forecast</span></h4>
    <div class="kv" style="grid-template-columns:130px 1fr;row-gap:4px" id="rnpv-form">
      <span class="k">Peak sales, $M</span><span class="v"><input data-k="peak" type="number" value="1000" step="50" style="width:90px"></span>
      <span class="k">Launch year</span><span class="v"><input data-k="launch" type="number" value="${launch}" step="1" style="width:90px"> <span class="dim2">registered PCD + typical filing/review lag</span></span>
      <span class="k">Years to peak</span><span class="v"><input data-k="ramp" type="number" value="5" step="1" style="width:90px"></span>
      <span class="k">Exclusivity, yrs</span><span class="v"><input data-k="excl" type="number" value="10" step="1" style="width:90px"> <span class="dim2">then 80% erosion over 3 yrs</span></span>
      <span class="k">Contribution margin</span><span class="v"><input data-k="margin" type="number" value="55" step="5" style="width:90px"> %</span>
      <span class="k">PoS to approval</span><span class="v"><input data-k="pos" type="number" value="${pos}" step="5" style="width:90px"> % <span class="dim2">pre-filled from the literature prior</span></span>
      <span class="k">Discount rate</span><span class="v"><input data-k="r" type="number" value="10" step="1" style="width:90px"> %</span>
      <span class="k">Cost to complete, $M</span><span class="v"><input data-k="cost" type="number" value="${t.ph==='P3'?150:t.ph==='P2'?250:350}" step="25" style="width:90px"> <span class="dim2">unrisked, spent before launch</span></span>
    </div>
    <div id="rnpv-out" class="kv" style="grid-template-columns:130px 1fr;background:var(--g2);border:1px solid var(--line);border-radius:6px;padding:8px 10px"></div>
    <div id="rnpv-torn" style="margin-top:6px"></div>
    <div class="dim2" style="font-size:10.5px">Linear ramp to peak, flat through exclusivity, 80% erosion over three years after. Discounted to ${new Date().getFullYear()}. ${sh?'Per-share uses '+fmtN(sh)+' shares outstanding from the SEC cover page.':'No share count available for per-share value.'}</div></div>`;
}
function rnpvModel(v){const y0=new Date().getFullYear();let pv=0;
  for(let y=v.launch;y<v.launch+v.excl+3;y++){const k=y-v.launch+1;let sales=k<=v.ramp?v.peak*k/v.ramp:v.peak;if(y>=v.launch+v.excl){const e=y-(v.launch+v.excl)+1;sales=v.peak*(1-0.8*Math.min(1,e/3));}
    const cf=sales*v.margin/100;const d=Math.pow(1+v.r/100,y-y0);pv+=cf/d;}
  const costPV=v.cost/Math.pow(1+v.r/100,Math.max(0.5,(v.launch-y0)/2));return{pv,costPV,unrisked:pv-v.cost,risked:v.pos/100*pv-costPV};}
function rnpvCalc(){
  const f=$('#rnpv-form');if(!f)return;const v={};$$('input',f).forEach(i=>v[i.dataset.k]=+i.value);
  const m=rnpvModel(v);const pv=m.pv,costPV=m.costPV,unrisked=m.unrisked,risked=m.risked;
  const t=Dossier.cur;const sh=(t&&t.sec&&t.sec.sh)||null;const mc=t&&t.mcap;
  /* tornado: one input moves, rest held */
  const per=x=>sh?x*1e6/sh:x;const unit=sh?'$/sh':'$M';const fmt=x=>sh?'$'+x.toFixed(2):'$'+fmtN(Math.round(x))+'M';
  const base=per(risked);const rows=[
    ['PoS '+Math.max(0,v.pos-15)+' → '+Math.min(100,v.pos+15)+'%',per(rnpvModel({...v,pos:Math.max(0,v.pos-15)}).risked),per(rnpvModel({...v,pos:Math.min(100,v.pos+15)}).risked)],
    ['Peak $'+fmtN(Math.round(v.peak*0.7))+' → $'+fmtN(Math.round(v.peak*1.3))+'M',per(rnpvModel({...v,peak:v.peak*0.7}).risked),per(rnpvModel({...v,peak:v.peak*1.3}).risked)],
    ['Discount '+(v.r+2.5)+' → '+(v.r-2.5)+'%',per(rnpvModel({...v,r:v.r+2.5}).risked),per(rnpvModel({...v,r:v.r-2.5}).risked)],
    ['Launch +1 yr → −1 yr',per(rnpvModel({...v,launch:v.launch+1}).risked),per(rnpvModel({...v,launch:v.launch-1}).risked)],
  ];if(sh)rows.push(['Dilution +15% shares',risked*1e6/(sh*1.15),base]);
  const lo=Math.min(base,...rows.map(r=>Math.min(r[1],r[2]))),hi=Math.max(base,...rows.map(r=>Math.max(r[1],r[2])));const span=Math.max(1e-9,hi-lo);
  $('#rnpv-torn').innerHTML=`<div class="lbl" style="margin-bottom:4px">Sensitivity <span style="text-transform:none;letter-spacing:0">· one input moves, rest held · ${unit}</span></div>`+rows.map(([l,a,b])=>{const L=Math.min(a,b),H=Math.max(a,b);return `<div class="torn"><span class="tl">${esc(l)}</span><div class="tt"><i class="tb" style="left:${(L-lo)/span*100}%;width:${(H-L)/span*100}%"></i><i class="tm" style="left:${(base-lo)/span*100}%"></i><span class="tv" style="left:0">${fmt(L)}</span><span class="tv" style="right:0;text-align:right">${fmt(H)}</span></div></div>`;}).join('');
  $('#rnpv-out').innerHTML=`<span class="k">Unrisked NPV</span><span class="v num">$${fmtN(Math.round(unrisked))}M</span><span class="k">Risk-adjusted NPV</span><span class="v num" style="font-size:14px;color:var(--acc)">$${fmtN(Math.round(risked))}M <span class="dim2" style="font-size:11px">at ${v.pos}% PoS</span></span>${sh?`<span class="k">Per share</span><span class="v num">$${(risked*1e6/sh).toFixed(2)}${mc?` <span class="dim2">· ${(risked*1e6/mc*100).toFixed(0)}% of market cap</span>`:''}</span>`:''}<span class="k">Breakeven PoS</span><span class="v num">${pv>0?Math.max(0,Math.min(100,costPV/pv*100)).toFixed(0):'—'}%</span>`;
}
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('#rnpv-form'))rnpvCalc();});

/* ---------- indication landscape (start → readout) ---------- */
const Landscape={
  show(id){const t=IDX.get(id);if(!t||!t.c[0])return;const key=t.c[0].toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const rows=T.filter(x=>x.c.some(c=>c.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()===key)).sort((a,b)=>PH_ORDER.indexOf(a.ph)-PH_ORDER.indexOf(b.ph)||a.pd-b.pd).slice(0,80);
    Dossier.close();App.setTab('cal');
    let el=$('#landscape');if(!el){el=document.createElement('section');el.className='panel';el.id='landscape';$('#v-cal').prepend(el);}
    const y0=2021,y1=2029,W=100;const x=d=>clamp((d.getFullYear()+d.getMonth()/12-y0)/(y1-y0)*W,0,W);
    const today=x(TODAY);
    el.innerHTML=`<div class="ph"><h2>Indication landscape · ${esc(t.c[0])}</h2><span class="hint">${rows.length} registered 2026–28 trials · bar = start → primary completion · ${PH_ORDER.map(p=>`<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${PH_COLOR[p]};margin:0 3px 0 8px"></i>${p}`).join('')}</span><div class="tools"><button class="btn sm" onclick="F.q='${esc(t.c[0]).replace(/'/g,"\\'")}';document.getElementById('q').value=F.q;F.clearFocus();App.update()">Filter calendar to this</button><button class="btn sm" onclick="document.getElementById('landscape').remove()">✕ close</button></div></div>
      <div class="pb" style="max-height:52vh;overflow:auto">
        <div style="position:relative;margin-left:300px;height:18px;font-family:var(--mono);font-size:10px;color:var(--ink-3)">${Array.from({length:y1-y0},(_,i)=>`<span style="position:absolute;left:${i/(y1-y0)*100}%">${y0+i}</span>`).join('')}</div>
        ${rows.map(r=>{const sd=r.sd?new Date((r.sd.length===7?r.sd+'-15':r.sd)+'T00:00:00'):r.pd;const a=x(sd),b=x(r.pd);return `<div class="hbar" style="grid-template-columns:300px 1fr;height:24px" onclick="Dossier.open('${r.id}')" data-tip="${esc(trialTip(r)).replace(/"/g,'&quot;')}"><span class="nm" style="font-size:11.5px;${r.id===id?'color:var(--amber)':''}"><span class="tag ${PH_CLS[r.ph]}" style="margin-right:6px">${r.ph}</span>${esc(r.grp)} <span class="dim2">· ${esc(r.ac||r.iv[0]?.[1]||'')}</span></span><div style="position:relative;height:12px"><div style="position:absolute;left:${today}%;top:-2px;bottom:-2px;border-left:1px dashed var(--amber);opacity:.6"></div><i style="position:absolute;left:${a}%;width:${Math.max(0.6,b-a)}%;height:100%;border-radius:2px;background:${PH_COLOR[r.ph]};opacity:${r.id===id?1:.75}"></i>${r.pct==='ACTUAL'?`<span style="position:absolute;left:${b}%;top:-3px;color:var(--good);font-size:10px">◆</span>`:''}</div></div>`;}).join('')}
      </div>`;
    bindTips(el);el.scrollIntoView({block:'start'});
  }
};

/* ---------- Regulatory calendar for the sponsor (SEC filings) ---------- */
const REG_KIND={pdufa:'PDUFA',adcom:'AdCom',resubmission:'Resubmission'};
function regRow(r){const dd=Math.round((new Date(r.date+'T00:00:00')-TODAY)/864e5);return `<div class="kv" style="grid-template-columns:110px 1fr;margin:4px 0 8px"><span class="k"><span class="num">${fmtD(r.date)}</span>${r.precision!=='day'?' <span class="badge" title="'+esc(r.precision)+'-precision statement; shown at the period end">≈</span>':''}</span><span class="v"><span class="badge ${r.kind==='pdufa'?'pri':r.kind==='adcom'?'bla':''}">${REG_KIND[r.kind]||r.kind}</span> ${r.priority?'<span class="badge nme">Priority</span> ':''}<span class="dtr${dd<0?' past':dd<=45?' soon':''}">${dd>=0?'+':''}${dd} d</span> · <span class="dim">${r.confidence}</span>${r.asset?` · ${esc(r.asset)}`:''}<br><span class="dim2" style="font-size:11px">${esc(r.form||'filing')} filed ${fmtD(r.filed)} · <a href="${esc(r.source)}" target="_blank" rel="noopener">source ↗</a>${r.history&&r.history.length?` · previously ${r.history.map(h=>fmtD(h.date)).join(', ')}`:''}</span><br><span class="summ" style="font-size:11px">${esc(r.sentence||'')}</span></span></div>`;}
function regSection(t){
  if(!t.reg||!t.reg.length)return '';
  return `<div class="sec"><h4 data-gl="reg">Regulatory dates <span class="dim2" style="text-transform:none;letter-spacing:0">· ${esc(t.sec.t)} · disclosed in SEC filings${REG.pulled?' · pulled '+REG.pulled.slice(0,10):''}</span></h4>${t.reg.slice(0,6).map(regRow).join('')}${t.reg.length>6?`<div class="dim2" style="font-size:11px">${t.reg.length-6} more in the FDA tab.</div>`:''}</div>`;
}
/* ---------- private-company layer: SEC Form D placements + NIH RePORTER awards ---------- */
function privateSection(fd,nih,name){
  if(!fd&&!nih)return '';let h='';
  if(fd){const last=fd.fil[fd.fil.length-1]||{};
    h+=`<div class="sec"><h4 data-gl="formd">Private placements <span class="dim2" style="text-transform:none;letter-spacing:0">· SEC Form D · ${esc(fd.name)}${fd.prev&&fd.prev.length?' (formerly '+esc(fd.prev[0])+')':''}</span></h4>
      <div class="kv"><span class="k">Raised (Reg D)</span><span class="v num">${fmtUSD(fd.sold)} <span class="dim2">across ${fd.n} filing${fd.n>1?'s':''} since ${fmtD(fd.first)}</span></span>
      <span class="k">Latest placement</span><span class="v num">${fmtD(last.s||last.d)} · ${last.sold!=null?fmtUSD(last.sold):'—'}${last.off?` <span class="dim2">of ${fmtUSD(last.off)} offered</span>`:''}${last.inv?` <span class="dim2">· ${last.inv} investors</span>`:''}${last.debt&&!last.eq?' <span class="badge">debt</span>':''}</span>
      <span class="k">Domicile</span><span class="v">${esc(fd.country||fd.state||'—')}${fd.inc?` <span class="dim2">· incorporated ${esc(String(fd.inc).replace('overFiveYears','5+ years ago').replace('withinFiveYears','within 5 years'))}</span>`:''}</span></div>
      ${fd.fil.length>1?`<div class="related">${fd.fil.slice().reverse().map(f=>`<button style="cursor:default"><span class="num dim2" style="width:84px">${fmtD(f.s||f.d)}</span><span class="ttl">${f.sold!=null?fmtUSD(f.sold):'—'}${f.off?` <span class="dim2">/ ${fmtUSD(f.off)}</span>`:''}</span><span class="num dim2">${f.inv?f.inv+' inv.':''}</span></button>`).join('')}</div>`:''}
      ${fd.rel&&fd.rel.length?`<div style="margin-top:6px">${fd.rel.map(([n,r])=>`<span class="flag" title="${esc(r)}">${esc(n)} <span class="dim2">${esc(r.replace('Officer','off.').replace('Director','dir.').replace('Promoter','prom.'))}</span></span>`).join('')}</div>`:''}
      <div class="dim2" style="font-size:11px;margin-top:4px">Amounts as filed on Form D (amount sold per notice); no valuations or terms are public. Related persons are as listed on the latest filings.</div></div>`;}
  if(nih){h+=`<div class="sec"><h4 data-gl="nih">Non-dilutive funding <span class="dim2" style="text-transform:none;letter-spacing:0">· NIH RePORTER · ${esc(nih.org||name)}</span></h4>
      <div class="kv"><span class="k">NIH awards</span><span class="v num">${nih.n}${nih.n>=50?'+':''} <span class="dim2">· ${fmtUSD(nih.total)} listed · FY${nih.first_fy}–${nih.last_fy}${nih.agencies&&nih.agencies.length?' · '+esc(nih.agencies.join(', ')):''}</span></span></div>
      <div class="related">${(nih.top||[]).map(p=>`<button style="cursor:default"><span class="num dim2" style="width:40px">FY${String(p.fy).slice(2)}</span><span class="ttl" title="${esc(p.title)}">${esc(p.title)}</span><span class="num dim2">${p.act||''} ${fmtUSD(p.amount)}</span></button>`).join('')}</div></div>`;}
  return h;
}
/* ---------- 13F specialist ownership ---------- */
function ownSection(t){
  const o=t.own;if(!o)return '';const d=o.value-o.value_prev;const nsp=F13.funds.filter(f=>!f.gen).length;
  return `<div class="sec"><h4 data-gl="f13">Specialist ownership <span class="dim2" style="text-transform:none;letter-spacing:0">· 13F-HR, ${nsp} biotech specialists + ${F13.funds.length-nsp} generalists tracked · ${(F13.funds[0]||{}).period||''}</span></h4>
    <div class="kv"><span class="k">Holders</span><span class="v num">${o.n} <span class="dim2">of ${nsp} specialists</span>${o.ng?` <span class="dim2">· +${o.ng} generalist${o.ng>1?'s':''} ${fmtUSD(o.vg)}</span>`:''} ${o.new?`<span class="badge nme">+${o.new} new</span>`:''}${o.exit?` <span class="badge" style="color:var(--crit)">−${o.exit} exited</span>`:''}</span>
    <span class="k">Specialist $ held</span><span class="v num">${fmtUSD(o.value)} <span style="color:${d>=0?'var(--good)':'var(--crit)'}">${d>=0?'+':''}${fmtUSD(d)}</span> <span class="dim2">QoQ, incl. price</span></span></div>
    <div class="related">${o.funds.slice(0,10).map(f=>`<button style="cursor:default;${f.g?'opacity:.55':''}"><span class="ttl">${esc(f.f)}${f.g?' <span class="dim2">· generalist</span>':''}</span><span class="num dim2">${fmtUSD(f.v)}</span><span class="num" style="width:70px;text-align:right;color:${f.new?'var(--good)':f.ds>0?'var(--good)':f.ds<0?'var(--crit)':'var(--ink-3)'}">${f.new?'new':f.ds>0?'+'+fmtN(f.ds):f.ds<0?'−'+fmtN(-f.ds):'flat'}</span></button>`).join('')}</div>
    <div class="dim2" style="font-size:10.5px;margin-top:4px">Positions as filed; 13F lags quarter-end by 45 days and excludes shorts, swaps and non-US listings.</div></div>`;
}
/* ---------- Form 4 insider activity ---------- */
function insSection(t){
  const i=t.ins;if(!i||(!i.buy_n&&!i.sell_n))return '';const net=i.buy_usd-i.sell_usd;
  const si=t.sec&&INS.short&&INS.short[t.sec.t];
  return `<div class="sec"><h4 data-gl="form4">Insider activity <span class="dim2" style="text-transform:none;letter-spacing:0">· Form 4 open-market trades, ${(INS.quarters||[]).slice().reverse().join(' + ').toUpperCase()}</span></h4>
    <div class="kv"><span class="k">Open-market buys</span><span class="v num">${i.buy_n} <span class="dim2">·</span> ${fmtUSD(i.buy_usd)}${i.last_buy?` <span class="dim2">· last ${fmtD(i.last_buy)}</span>`:''}</span>
    <span class="k">Sells</span><span class="v num">${i.sell_n} <span class="dim2">·</span> ${fmtUSD(i.sell_usd)}${i.last_sell?` <span class="dim2">· last ${fmtD(i.last_sell)}</span>`:''}</span>
    <span class="k">Net</span><span class="v num" style="color:${net>0?'var(--good)':net<0?'var(--crit)':'var(--ink-2)'}">${net>=0?'+':'−'}${fmtUSD(Math.abs(net))}</span>
    ${(i.own10_buy_usd||i.own10_sell_usd)?`<span class="k">10% owners (excl.)</span><span class="v num dim">${i.own10_buy_usd?'bought '+fmtUSD(i.own10_buy_usd):''}${i.own10_buy_usd&&i.own10_sell_usd?' · ':''}${i.own10_sell_usd?'sold '+fmtUSD(i.own10_sell_usd):''}</span>`:''}
    ${i.buyers&&i.buyers.length?`<span class="k">Buyers</span><span class="v" style="font-size:11.5px">${esc(i.buyers.join(' · '))}</span>`:''}
    ${si?`<span class="k">Short interest</span><span class="v num">${fmtN(+si.currentShortPositionQuantity||0)} sh <span class="dim2">· ${si.daysToCoverQuantity?(+si.daysToCoverQuantity).toFixed(1)+' days to cover · ':''}${esc(si.settlementDate||'')}</span></span>`:''}</div>
    <div class="dim2" style="font-size:10.5px">Code P/S non-derivative transactions by officers and directors; 10%-owner trades (tenders, fund top-ups) are shown separately and excluded from the buy signal. Excludes option exercises, grants and 10b5-1 context. Sells by insiders are routine; clustered buys are the signal.</div></div>`;
}
/* ---------- SEC financial row ---------- */
function secRow(sec,nTrials){
  if(!sec||sec.t==='private')return `<span class="k">Listing</span><span class="v dim">unlisted / private</span>`;
  const rw=runway(sec);let out=`<span class="k">Listing</span><span class="v"><span class="badge">${esc(sec.t)}</span> <span class="dim2">${esc(sec.ex||'')}</span></span>`;
  if(rw&&rw.cash){out+=`<span class="k">Cash + ST inv.</span><span class="v num">${fmtUSD(rw.cash)} <span class="dim2">${sec.per?sec.per.replace('CY','').replace('I',''):''}</span></span>`;
    if(rw.burn>0)out+=`<span class="k">Burn-implied runway</span><span class="v num">${rw.yrs>=10?'>10':rw.yrs.toFixed(1)} yrs <span class="dim2">at ${fmtUSD(rw.burn)}/yr net loss</span></span>`;
    else if(sec.ni!=null)out+=`<span class="k">Net income FY25</span><span class="v num">${fmtUSD(sec.ni)}</span>`;}
  if(sec.rd!=null){out+=`<span class="k">R&D FY25</span><span class="v num">${fmtUSD(sec.rd)}${nTrials?` <span class="dim2">· ${fmtUSD(sec.rd/nTrials)} per trial in window</span>`:''}</span>`;}
  else if(sec.rdq&&sec.rdq.some(x=>x!=null)){const q=sec.rdq.filter(x=>x!=null);const rr=q.reduce((a,b)=>a+b,0)/q.length*4;out+=`<span class="k">R&D run-rate</span><span class="v num">${fmtUSD(rr)}/yr${nTrials?` <span class="dim2">· ${fmtUSD(rr/nTrials)} per trial</span>`:''}</span>`;}
  if(sec.rev!=null&&sec.rev>0)out+=`<span class="k">Revenue FY25</span><span class="v num">${fmtUSD(sec.rev)}</span>`;
  return out;
}
/* ---------- on-demand mechanism explainer (viewer's Claude) ---------- */
const AI={fn:undefined,ctl:null,
  async get(){if(AI.fn!==undefined)return AI.fn;try{AI.fn=window.claude&&typeof claude.use==='function'?await claude.use('sample'):null;}catch(e){AI.fn=null;}return AI.fn;},
  async mount(t){const el=$('#moa-ai');if(!el)return;const fn=await AI.get();if(!fn||!$('#moa-ai'))return;
    el.innerHTML=`<button class="btn sm" id="moa-btn">✦ Explain mechanism &amp; what the readout tests</button><span class="dim2" style="font-size:10.5px;margin-left:8px">uses your Claude usage · not cached in the file</span><div id="moa-out" class="summ" style="margin-top:6px;white-space:pre-wrap"></div>`;
    $('#moa-btn').onclick=()=>AI.explain(t);},
  async explain(t){const fn=AI.fn,out=$('#moa-out'),btn=$('#moa-btn');if(!fn)return;
    if(AI.ctl){AI.ctl.abort();AI.ctl=null;btn.textContent='✦ Explain mechanism & what the readout tests';return;}
    AI.ctl=new AbortController();btn.textContent='■ Stop';out.textContent='Thinking…';
    const rec=`NCT: ${t.id}\nTitle: ${t.t}\nOfficial title: ${t.ot}\nSponsor: ${t.sp}\nPhase: ${t.ph} · Status: ${t.st}\nConditions: ${t.c.join('; ')}\nKeywords: ${t.k.join('; ')}\nInterventions: ${t.iv.map((i,k)=>i[0]+': '+i[1]+(t.ivd&&t.ivd[k]?' — '+t.ivd[k]:'')).join(' | ')}\nPrimary outcome: ${t.po} [${t.pot}]\nDesign: ${t.al} / ${t.mk} / ${t.im}\nEnrollment: ${t.n}\nSummary: ${t.sum}${t.mn?'\nCurated note: '+t.mn:''}`;
    const prompt=`You are a biopharma analyst writing for fund managers. Using the registry record below plus your own knowledge of the asset, write at most 130 words in plain prose (no headers, no bullets): (1) the asset's target and mechanism of action and modality, naming the gene/pathway; (2) what this specific trial's primary endpoint would establish and the key competitive comparator; (3) one sentence on the main scientific or regulatory risk. If the mechanism is not derivable from the record and you are not confident, say so explicitly rather than guessing. Do not restate the title.\n\n${rec}`;
    try{const r=await fn(prompt,{modelTier:'default',signal:AI.ctl.signal,onText:({text})=>{out.textContent=text;}});out.textContent=r.text;}
    catch(e){if(e&&e.code==='cancelled')out.textContent=e.text||'';else if(e&&(e.code==='not_granted'||e.code==='unavailable')){out.textContent='';$('#moa-ai').innerHTML='';}else out.textContent=(e&&e.text)||('Could not get an answer ('+(e&&e.code||'error')+').');}
    AI.ctl=null;if($('#moa-btn'))$('#moa-btn').textContent='✦ Explain mechanism & what the readout tests';}
};


/* ---------- About / Visuals sheets ---------- */
const Sheet={cur:null,
  open(n){if(n==='dash')return Sheet.close();Sheet.cur=n;$$('.sheet').forEach(s=>s.classList.toggle('open',s.id==='sheet-'+n));$$('#toplinks .toplink').forEach(b=>b.classList.toggle('on',b.dataset.sheet===n));Dossier.close();Tip.hide();if(n==='visuals')Viz.render();if(n==='sector')Sector.render();if(history.replaceState)history.replaceState(null,'','#'+n);},
  close(){Sheet.cur=null;$$('.sheet').forEach(s=>s.classList.remove('open'));$$('#toplinks .toplink').forEach(b=>b.classList.toggle('on',b.dataset.sheet==='dash'));Tip.hide();if(history.replaceState)history.replaceState(null,'',location.pathname);},
  toggle(n){Sheet.open(n);}
};
function fundName(n){let s=n.split(',')[0].replace(/\b(L\.?P\.?|L\.?L\.?C\.?|INC\.?|LTD\.?|PLC|HOLDINGS?|CO\.?|\/IL|\/DE)\b/gi,'').replace(/[.,\/]+\s*$/,'').trim();s=s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());return s.replace(/\bBvf\b/,'BVF').replace(/\bRa Capital\b/,'RA Capital').replace(/\bTcg\b/,'TCG').replace(/\bEcor1\b/,'EcoR1').replace(/\bOrbimed\b/,'OrbiMed');}
const Viz={
  render(){
    const all=T.filter(t=>t.pm>=MONTHS[0]&&t.pm<=MONTHS[MONTHS.length-1]);
    const PHC=PH_ORDER.map(k=>PH_COLOR[k]);const lgPh=PH_ORDER.map(k=>`<span><i style="background:${PH_COLOR[k]}"></i>${k}</span>`).join('');
    /* 1. modality phase mix (composition) */
    const mos=[...count(all,'mo').entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,12);
    hbars($('#vz-mod'),mos.map(mo=>{const r=all.filter(t=>t.mo===mo);return{name:mo,key:mo,parts:PH_ORDER.map(p=>r.filter(t=>t.ph===p).length/r.length*100),total:100,n:r.length,p3:r.filter(t=>t.ph==='P3').length};}),{colors:PHC,max:100,vfn:r=>r.n.toLocaleString(),onClick:r=>{Sheet.close();F.mo.clear();F.mo.add(r.key);App.update();},tipFn:r=>`<div class="t">${esc(r.name)}</div><div class="k">${r.n.toLocaleString()} trials</div><hr>${PH_ORDER.map((p,i)=>r.parts[i]?`<div class="row"><span class="k">${p}</span><b>${Math.round(r.parts[i])}%</b></div>`:'').join('')}<hr><div class="k">click to filter the dashboard</div>`});
    $('#vz-mod-lg').innerHTML=lgPh+'<span class="dim2" style="margin-left:auto">bar = 100% of the modality</span>';
    /* 2. TA stacked */
    const tas=[...count(all,'ta').entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
    hbars($('#vz-ta'),tas.map(ta=>{const r=all.filter(t=>t.ta===ta);return{name:ta,key:ta,parts:PH_ORDER.map(p=>r.filter(t=>t.ph===p).length),total:r.length};}),{colors:PHC,onClick:r=>{Sheet.close();F.ta.clear();F.ta.add(r.key);App.update();},tipFn:r=>`<div class="t">${esc(r.name)}</div>${PH_ORDER.map((p,i)=>r.parts[i]?`<div class="row"><span class="k">${p}</span><b>${r.parts[i]}</b></div>`:'').join('')}<hr><div class="k">click to filter the dashboard</div>`});
    $('#vz-ta-lg').innerHTML=lgPh;
    /* 3. sponsors dumbbell: all vs P3 */
    const sm=new Map();all.forEach(t=>{const r=sm.get(t.grp)||{name:t.grp,key:t.grp,a:0,b:0,tier:t.tier};r.a++;if(t.ph==='P3')r.b++;sm.set(t.grp,r);});
    const srows=[...sm.values()].sort((a,b)=>b.a-a.a).slice(0,18);
    dumbbell($('#vz-spon'),{rows:srows,colors:[ASH.steel,PH_COLOR.P3],labelW:150,rowH:23,onClick:r=>{Sheet.close();F.grp=r.key;App.update();App.setTab('spon');},tipFn:r=>`<div class="t">${esc(r.name)}</div><div class="k">${r.tier}</div><hr><div class="row"><span class="k">All 2026–28 trials</span><b>${r.a}</b></div><div class="row"><span class="k">Phase 3</span><b>${r.b}</b></div><div class="row"><span class="k">Pivotal share</span><b>${Math.round(r.b/r.a*100)}%</b></div><hr><div class="k">click to open the program profile</div>`});
    $('#vz-spon-lg').innerHTML=`<span><i style="background:${ASH.steel}"></i>all trials</span><span><i style="background:${PH_COLOR.P3}"></i>Phase 3</span>`;
    /* 4. fund books dot plot (log $) */
    const funds=(F13.funds||[]).filter(f=>f.value>0).sort((a,b)=>b.value-a.value).slice(0,24).map(f=>({name:fundName(f.name),x:Math.log10(f.value),v:f.value,n:f.n,gen:f.gen,period:f.period}));
    dotplot($('#vz-f13'),{rows:funds,dom:[9,11.2],ticks:[9,10,11],tickFmt:v=>v===9?'$1B':v===10?'$10B':'$100B',color:r=>r.gen?ASH.taupe:ASH.bone,size:r=>r.n,fmt:r=>fmtUSD(r.v)+' · '+r.n,labelW:190,rowH:21,tipFn:r=>`<div class="t">${esc(r.name)}</div><div class="k">${r.gen?'generalist / multi-strategy — counted separately':'biotech specialist'} · ${esc(r.period||'')}</div><hr><div class="row"><span class="k">Reported long value</span><b>${fmtUSD(r.v)}</b></div><div class="row"><span class="k">Holdings</span><b>${r.n}</b></div>`});
    $('#vz-f13-lg').innerHTML=`<span><i style="background:${ASH.bone}"></i>specialist</span><span><i style="background:${ASH.taupe}"></i>generalist</span><span class="dim2" style="margin-left:auto">${(F13.funds[0]||{}).period||''} · 13F long positions only · label = value · holdings</span>`;
    /* 5. longevity histogram by raised bucket */
    const LV=(DATA.longevity||[]).filter(l=>l.raised>0);const bins=[['< $25m',0,25],['$25–50m',25,50],['$50–100m',50,100],['$100–250m',100,250],['$250–500m',250,500],['$500m+',500,1e9]];
    const ser=[{name:'has a registered 2026–28 trial',v:bins.map(([n,a,b])=>LV.filter(l=>l.raised>=a&&l.raised<b&&l.nct.length).length)},{name:'none registered',v:bins.map(([n,a,b])=>LV.filter(l=>l.raised>=a&&l.raised<b&&!l.nct.length).length)}];
    stackedBars($('#vz-lv'),{cats:bins.map(b=>b[0]),series:ser,colors:[LIST_COLOR.pub,LIST_COLOR.priv],height:190,tipFn:i=>{const [n,a,b]=bins[i];const g=LV.filter(l=>l.raised>=a&&l.raised<b);return `<div class="t">${n}</div><div class="row"><span class="k">Companies</span><b>${g.length}</b></div><div class="row"><span class="k">With a registered trial</span><b>${g.filter(l=>l.nct.length).length}</b></div><div class="row"><span class="k">Capital in bucket</span><b>$${fmtN(Math.round(sum(g,l=>l.raised)))}m</b></div><hr><div class="k">${esc(g.slice().sort((x,y)=>y.raised-x.raised).slice(0,4).map(l=>l.co).join(' · '))}</div>`;}});
    $('#vz-lv-lg').innerHTML=`<span><i style="background:${LIST_COLOR.pub}"></i>has a registered 2026–28 trial</span><span><i style="background:${LIST_COLOR.priv}"></i>none registered</span><span class="dim2" style="margin-left:auto">${LV.length} companies · $${(sum(LV,l=>l.raised)/1000).toFixed(1)}B raised · public reports, July 2026</span>`;
    /* 6. tier by quarter (P3) */
    const qs=[...new Set(MONTHS.map(m=>m.slice(0,4)+' Q'+(Math.floor((+m.slice(5,7)-1)/3)+1)))];
    const tser=TIER_ORDER.map(k=>({name:k,v:qs.map(()=>0)}));all.filter(t=>t.ph==='P3').forEach(t=>{tser[TIER_ORDER.indexOf(t.tier)].v[qs.indexOf(t.pq)]++;});
    stackedBars($('#vz-tier'),{cats:qs,series:tser,colors:TIER_ORDER.map(k=>TIER_COLOR[k]),height:190,onClick:q=>{Sheet.close();F.ph.clear();F.ph.add('P3');const ms=MONTHS.filter(m=>m.slice(0,4)+' Q'+(Math.floor((+m.slice(5,7)-1)/3)+1)===q);F.win=[ms[0],ms[ms.length-1]];$('#win0').value=F.win[0];$('#win1').value=F.win[1];App.update();}});
    $('#vz-tier-lg').innerHTML=TIER_ORDER.map(k=>`<span><i style="background:${TIER_COLOR[k]}"></i>${k}</span>`).join('');
    /* 7. enrollment range plot by phase */
    const erows=PH_ORDER.map(p=>{const v=all.filter(t=>t.ph===p&&t.n>0).map(t=>Math.log10(t.n));return{name:p,n:v.length,q:quantiles(v,[.1,.25,.5,.75,.9])};});
    rangeplot($('#vz-enr'),{rows:erows,dom:[0.7,4.2],ticks:[1,2,3,4],tickFmt:v=>fmtN(Math.pow(10,v)),color:r=>PH_COLOR[r.name],fmt:v=>fmtN(Math.round(Math.pow(10,v))),labelW:70,rowH:34});
    $('#vz-enr-lg').innerHTML='<span class="dim2">trials with a registered enrollment count · label = median</span>';
    /* 8. area × modality heat */
    const tas8=tas.slice(0,8),mos10=mos.slice(0,10);const cell={};all.forEach(t=>{cell[t.ta+'|'+t.mo]=(cell[t.ta+'|'+t.mo]||0)+1;});const cmax=Math.max(1,...Object.values(cell));
    let h=`<div class="heat" style="grid-template-columns:200px repeat(${mos10.length},1fr)"><div></div>${mos10.map(m=>`<div class="h" style="font-size:9.5px">${esc(m.replace(' / ','/').split(' ').slice(0,2).join(' '))}</div>`).join('')}`;
    tas8.forEach(ta=>{h+=`<div class="rl" title="${esc(ta)}">${esc(ta)}</div>`;mos10.forEach(mo=>{const n=cell[ta+'|'+mo]||0;h+=`<div class="c" style="background:${heatColor(n,cmax)};color:${n/cmax>.45?'#fff':'var(--ink-2)'}" data-ta="${esc(ta)}" data-mo="${esc(mo)}" data-tip="<div class='t'>${esc(ta)} × ${esc(mo)}</div><b>${n}</b> trials · click to filter">${n||''}</div>`;});});
    $('#vz-heat').innerHTML=h+'</div>';bindTips($('#vz-heat'));$$('#vz-heat .c[data-ta]').forEach(c=>c.onclick=()=>{Sheet.close();F.ta.clear();F.ta.add(c.dataset.ta);F.mo.clear();F.mo.add(c.dataset.mo);App.update();});
    $('#vz-heat-lg').innerHTML='<span class="dim2">colour = square-root scale of trial count</span>';
  }
};
/* ---------- Sector sheet: Verdad white paper, redrawn ---------- */
const VERDAD={period:'Sept 2013 – Oct 2025',
  corrAcross:[['Biotechnology',.32],['Utilities',.35],['Materials',.37],['Energy',.44],['Information Technology',.51],['Consumer Staples',.51],['Health Care',.54],['Real Estate',.54],['Communication Services',.56],['Consumer Discretionary',.59],['Financials',.60],['Industrials',.65]],
  corrWithin:[['Consumer Staples',.23],['Biotechnology',.25],['Communication Services',.26],['Health Care',.28],['Consumer Discretionary',.31],['Information Technology',.33],['Materials',.38],['Industrials',.38],['Financials',.42],['Energy',.46],['Utilities',.51],['Real Estate',.51]],
  share:[['Largest 500',2],['501–1000',3],['1001–1500',6],['1501–2000',8],['2001–2500',11],['2501–3000',15],['3001–3500',21],['Smallest 376',23]],
  spec:[-2,5,15,11,20],insider:[0,7,9,15,7],shortInt:[-19,-8,9,10,16],
  peerMom:[-1,8,5,8,12],tradMom:[6,10,8,3,3],cheapPeers:[-2,9,4,7,13],tradVal:[14,1,0,4,7],modVal:[-6,3,4,5,19],blend:[-17,1,9,13,21],
  grid:[['Expensive',-3,-3,7],['Fair',7,6,9],['Cheap',5,7,13]],
  vix:{lv:['Low','Medium','High'],spec:[3.5,1.8,1.2],xbi:[0.3,1.8,1.1]},
  backtest:[['Long/short backtest',19.1,18.9,1.01,-32],['XBI',3.7,33.2,0.11,-64],['S&P 500',13.3,18.1,0.74,-34]],
  drawdowns:[['Aug 1989',-76,37,163,125],['May 1995',-77,55,20,-23],['Jun 2007',-79,30,38,31],['Feb 2011',-62,18,33,113],['Dec 2025',-117,null,null,null],['Average',null,35,63,61]],
  approvals:[[2015,45],[2016,22],[2017,46],[2018,46],[2019,59],[2020,48],[2021,53],[2022,50],[2023,37],[2024,55],[2025,50]]};
const Sector={done:false,
  render(){if(Sector.done)return;Sector.done=true;const el=$('#sheet-sector');const V=VERDAD;const pct=v=>(v>0?'+':'')+v+'%';const q=['1','2','3','4','5'];
    const A=ASH.bone,G=ASH.stone,C=ASH.brass;   /* highlight bone, rest stone, negatives brass (the one warm entity colour) */
    vbars($('#sc-ret'),{cats:['S&P Biotech','Russell 2000','S&P 500'],series:[{name:'annualised, 2000–2019',v:[9.3,7.6,6.1],color:G}],fmt:v=>v+'%',height:130,hi:(i)=>i===0?A:G});
    const corr=(id,rows,hl)=>hbars($('#'+id),rows.map(([n,v])=>({name:n,key:n,parts:n===hl?[0,v]:[v,0],total:v})),{colors:[G,A],fmt:v=>v.toFixed(2),tipFn:r=>`<div class="t">${esc(r.name)}</div><b>${r.total.toFixed(2)}</b> average pairwise correlation`});
    corr('sc-across',V.corrAcross,'Biotechnology');corr('sc-within',V.corrWithin,'Biotechnology');
    vbars($('#sc-share'),{cats:V.share.map(x=>x[0]),series:[{name:'biotech share of index group',v:V.share.map(x=>x[1]),color:A}],fmt:v=>v+'%',height:150});
    const quint=(id,v,col)=>vbars($('#'+id),{cats:q,series:[{name:'quintile',v,color:col||A}],fmt:pct,height:140,hi:(i,j)=>v[i]<0?C:(col||A)});
    quint('sc-spec',V.spec);quint('sc-ins',V.insider);quint('sc-si',V.shortInt);
    vbars($('#sc-mom'),{cats:q,series:[{name:'traditional (own trailing return)',v:V.tradMom,color:G},{name:'peer-based (closest scientific peers)',v:V.peerMom,color:A}],fmt:pct,height:150});
    vbars($('#sc-val'),{cats:q,series:[{name:'traditional (profit / EV)',v:V.tradVal,color:G},{name:'spending-anchored',v:V.modVal,color:A}],fmt:pct,height:150});
    $('#sc-mom').insertAdjacentHTML('afterend',`<div class="legend"><span><i style="background:${G}"></i>traditional</span><span><i style="background:${A}"></i>peer-based · quintile 5 = strongest</span></div>`);
    $('#sc-val').insertAdjacentHTML('afterend',`<div class="legend"><span><i style="background:${G}"></i>profit-anchored</span><span><i style="background:${A}"></i>spending-anchored · quintile 5 = cheapest</span></div>`);
    quint('sc-blend',V.blend);
    vbars($('#sc-cycle'),{cats:V.approvals.map(x=>x[0]),series:[{name:'CDER novel approvals',v:V.approvals.map(x=>x[1]),color:A}],fmt:v=>v,height:130});
    hbars($('#sc-loss'),[{name:'Lost money · 67%',key:'l',parts:[33.5,6.7,26.8],total:67},{name:'Made money · 33%',key:'w',parts:[0,0,0,18.2,14.8],total:33}],{colors:[ASH.brass,ASH.taupe,ASH.pine,ASH.slate,ASH.bone],fmt:v=>v+'%',tipFn:r=>r.key==='l'?'<div class="t">Of the 67% that lost money</div><div class="row"><span class="k">acquired at a loss</span><b>50%</b></div><div class="row"><span class="k">delisted</span><b>10%</b></div><div class="row"><span class="k">still listed (many below cash)</span><b>40%</b></div>':'<div class="t">Of the 33% that made money</div><div class="row"><span class="k">acquired</span><b>55%</b></div><div class="row"><span class="k">still public</span><b>45%</b></div>'});
    $('#sc-loss').insertAdjacentHTML('afterend',`<div class="legend"><span><i style="background:${ASH.brass}"></i>acquired at a loss</span><span><i style="background:${ASH.taupe}"></i>delisted</span><span><i style="background:${ASH.pine}"></i>still listed, stranded</span><span><i style="background:${ASH.slate}"></i>acquired</span><span><i style="background:${ASH.bone}"></i>still public</span></div><div class="fig">companies that reached $200M market cap, 1996–2025</div>`);
    vbars($('#sc-vix'),{cats:V.vix.lv,series:[{name:'specialist strategy',v:V.vix.spec,color:A},{name:'XBI',v:V.vix.xbi,color:G}],fmt:v=>v.toFixed(1)+'%',height:140});
    $('#sc-vix').insertAdjacentHTML('afterend',`<div class="legend"><span><i style="background:${A}"></i>specialist strategy</span><span><i style="background:${G}"></i>XBI</span><span class="dim2">· one-month-ahead returns at each VIX level</span></div>`);
    vbars($('#sc-inv'),{cats:q,series:[{name:'traditional value quintile',v:V.tradVal,color:G}],fmt:pct,height:130,hi:(i)=>i===0?C:G});
    vbars($('#sc-dd'),{cats:['S&P Biotech','S&P 500'],series:[{name:'annualised since Dec 2019',v:[4.5,15.1],color:G}],fmt:v=>v+'%',height:120,hi:(i)=>i===0?C:G});
    bindTips(el);
  }
};

/* ---------- payload ---------- */
let JSON_BYTES=0;
async function decodePayload(){
  const bin=atob(PAYLOAD_B64);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  if(!('DecompressionStream' in window))throw new Error('DecompressionStream unsupported in this browser');
  const ds=new DecompressionStream('gzip');const w=ds.writable.getWriter();w.write(u8);w.close();
  const buf=await new Response(ds.readable).arrayBuffer();JSON_BYTES=buf.byteLength;
  return JSON.parse(new TextDecoder().decode(buf));
}
App.init();
