// dashboard.js — loads ../profiles.json and draws interactive charts
(function(){
  // compute project base like other site scripts so GitHub Pages project sites work
  const PROJECT_BASE = (window.PROJECT_BASE !== undefined) ? window.PROJECT_BASE : (function(){
    try{ if(location.hostname && location.hostname.endsWith('github.io')){ const parts = location.pathname.split('/').filter(Boolean); if(parts.length>0) return '/' + parts[0] + '/'; } }catch(e){}
    return '/';
  })();

  // resolve profiles.json from several likely locations (local first, then project-root)
  async function resolveProfilesJson(){
    const candidates = ['profiles.json','../profiles.json', PROJECT_BASE + 'profiles.json', PROJECT_BASE + 'site/profiles.json'];
    for(const c of candidates){
      try{ const r = await fetch(c, {cache:'no-store'}); if(r.ok) return c; }catch(e){}
    }
    return null;
  }
  const CHARTS = {};
  let rawProfiles = [];
  let filtered = [];

  function $(id){return document.getElementById(id)}

  // basic tokenizer / stopwords for about_me
  const stop = new Set(['the','and','to','a','of','in','for','is','on','with','i','you','my','me','it','that','this','be','are','have','has']);

  function normWord(w){ return w.replace(/[^\p{L}\d'-]+/gu,'').toLowerCase(); }

  function topWords(texts, n=25){
    const counts = new Map();
    for(const t of texts){ if(!t) continue; const words = t.split(/\s+/); for(const w of words){ const k=normWord(w); if(!k||k.length<2||stop.has(k)) continue; counts.set(k,(counts.get(k)||0)+1); }}
    return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,n);
  }

  function uniq(arr){return Array.from(new Set(arr)).filter(Boolean)}

  // No filters for now — render using entire dataset

  function renderAll(){ renderAge(); renderGender(); renderJoin(); renderRegistrations(); renderInterests(); renderAboutWords(); renderHeightWeight(); renderExtraMetrics(); }

  // helper to get first available field from candidates
  function getField(p, keys){ for(const k of keys){ if(k in p && p[k]!==undefined && p[k]!==null) return p[k]; } return undefined }

  function renderCategorical(keys, elId, label, topN=10){ const counts={}; filtered.forEach(p=>{ const v = getField(p, keys); if(Array.isArray(v)) v.forEach(x=>{ if(x) counts[String(x)]=(counts[String(x)]||0)+1 }); else if(typeof v==='string' || typeof v==='number'){ const s=String(v).trim(); if(s) counts[s]=(counts[s]||0)+1 } else if(typeof v==='boolean'){ counts[v?'Yes':'No']=(counts[v?'Yes':'No']||0)+1 } }); const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,topN); if(!entries.length) return clearChart(elId); drawBar(elId, entries.map(e=>e[0]), entries.map(e=>e[1]), label); }

  function renderBoolean(keys, elId, label){ renderCategorical(keys, elId, label, 2); }

  function renderBucketedNumeric(key, elId, label, buckets){ const vals = filtered.map(p=>{ const v=getField(p,[key]); const n = parseFloat(v); return isNaN(n)?null:n }).filter(Boolean); if(!vals.length) return clearChart(elId); const counts={}; for(const n of vals){ let b='?'; for(const bk of buckets){ if(n>=bk.min && n<bk.max){ b=bk.label; break } } counts[b]=(counts[b]||0)+1 } const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]); drawBar(elId, entries.map(e=>e[0]), entries.map(e=>e[1]), label); }

  function renderTopCountries(){ const counts={}; filtered.forEach(p=>{ const c = getField(p,['country','location_country','country_code','country_name']) || 'Unknown'; counts[c]=(counts[c]||0)+1 }); const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10); if(!entries.length) return clearChart('countriesChart'); drawBar('countriesChart', entries.map(e=>e[0]), entries.map(e=>e[1]), 'Top countries'); }

  // metric wiring: call renderCategorical / boolean / bucketed as appropriate
  function renderExtraMetrics(){
    renderTopCountries();
    renderCategorical(['verified','is_verified','verified_account'],'verifiedChart','Verified');
    renderBoolean(['open_to_polygyny','open_to_polygamy','polygyny'],'openPolygynyChart','Open to polygyny');
    renderBoolean(['has_tattoos','tattoos','tattoo'],'tattoosChart','Has tattoos');
    renderBoolean(['virgin','is_virgin','virginity'],'virginityChart','Virgin');
    renderCategorical(['human_design','human_design_type','human-design','design_type','Human Design Type','Human Design','humanDesign'],'humanDesignChart','Human design');
    renderCategorical(['humanphenotype','human_phenotype','phenotype','phenotype_type','humanphenotypes','humanphenotypes'],'humanPhenotypeChart','Phenotype');
    renderBoolean(['piercings','has_piercings'],'piercingsChart','Piercings');
    renderCategorical(['smoking','smoker','smoking_status'],'smokingChart','Smoking');
    renderCategorical(['eye_color','eyecolor','eyes'],'eyecolorChart','Eye color');
    renderBoolean(['children','Children','has_children','children_have','Children (have)','have_children','have children'],'childrenChart','Has children');
    renderIQ();
    renderCategorical(['accommodation','housing','accomodation'],'accommodationChart','Accommodation');
    renderCategorical(['education','education_level'],'educationChart','Education');
    renderCategorical(['vaccination_stance','vaccine','vaccination','vaccination_status','stance_vaccination'],'vaccinationChart','Vaccination stance');
    renderCategorical(['body_type','build','body'],'bodyTypeChart','Body type');
    renderCategorical(['marital_status','marital'],'maritalChart','Marital status');
    renderCategorical(['income','Income','income_bracket','earnings','annual_income','income_range'],'incomeChart','Income');
    renderCategorical(['pets','Pets','has_pets','pet_types','Pet(s)','Pet Types'],'petsChart','Pets');
    renderCategorical(['best_features','best_feature','best_features_list'],'bestFeaturesChart','Best features');
    renderCategorical(['diet','dietary_preference','eating'],'dietChart','Diet');
    renderCategorical(['astrological_sign','Astrological Sign','zodiac','star_sign','astro','astrosign','astro_sign','signpets'],'astroChart','Astrological sign');
    renderCategorical(['membership','membership_level','member_status'],'membershipChart','Membership');
    renderCategorical(['spirituality','religion','spiritual'],'spiritualityChart','Spirituality');
    renderCategorical(['mbti','MBTI','meyers_briggs','myers_briggs','mbti_type','Myers-Briggs Personality','Myers-Briggs'],'myersBriggsChart','MBTI');
    renderCategorical(['hair','hair_color','hair_type'],'hairChart','Hair');
    renderCategorical(['political_orientation','politics','political'],'politicalChart','Political orientation');
    renderCategorical(['mindset','Mindset','mindest','mindset_tags','mindset_values','outlook'],'mindsetChart','Mindset');
  }

  // Age histogram
  function renderAge(){
    const ages = filtered.map(p=>p.age||p._age).filter(n=>typeof n==='number' && !isNaN(n));
    if(!ages.length) return clearChart('ageChart');
    const min = Math.min(...ages); const max = Math.max(...ages);
    const step = Math.max(5, Math.round((max-min)/10));
    const bins = {};
    for(let v=min; v<=max+step; v+=step) bins[v]=0;
    ages.forEach(a=>{ const key = Math.floor((a-min)/step)*step+min; bins[key] = (bins[key]||0)+1 });
    const labels = Object.keys(bins).map(k=>`${k}-${parseInt(k)+step}`);
    const data = Object.values(bins);
    drawBar('ageChart', labels, data, 'Age ranges');
  }

  function renderGender(){
    const counts = {};
    filtered.forEach(p=>{ const g = (p.gender||p.sex||'Unknown') || 'Unknown'; counts[g]=(counts[g]||0)+1 });
    const labels = Object.keys(counts); const data = labels.map(l=>counts[l]);
    drawPie('genderChart', labels, data, 'Gender');
  }

  function renderJoin(){
    const dates = filtered.map(p=>p.joined || p.joined_date || p.created_at || p.registered).filter(Boolean).map(d=>new Date(d));
    if(!dates.length) return clearChart('joinChart');
    const byMonth = {};
    dates.forEach(dt=>{ const key = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0'); byMonth[key]=(byMonth[key]||0)+1 });
    const labels = Object.keys(byMonth).sort(); const data = labels.map(l=>byMonth[l]);
    drawLine('joinChart', labels, data, 'Join timeline');
  }

  // Registrations over time (robust detection across many possible date fields)
  function renderRegistrations(){
    const dateKeys = ['joined','join_date','joined_date','registration_date','registered','created_at','created','signup_date','date_joined','member_since','registered_on'];
    const dates = [];
    for(const p of filtered){
      let found = null;
      for(const k of dateKeys){ if(k in p && p[k]){ found = p[k]; break } }
      if(!found) continue;
      // try parsing
      try{
        const raw = found;
        let ts = null;
        if(typeof raw === 'number') ts = raw;
        else if(typeof raw === 'string'){
          const s = raw.trim();
          // ignore values that are clearly not dates
          if(!s) continue;
          // try ISO parse
          const parsed = Date.parse(s);
          if(!isNaN(parsed)) ts = parsed;
          else {
            // try extracting yyyy-mm-dd like substring
            const m = s.match(/(20\d{2}|19\d{2})[-\/.](0[1-9]|1[0-2])[-\/.](0[1-9]|[12][0-9]|3[01])/);
            if(m) ts = Date.parse(m[0]);
          }
        }
        if(ts && !isNaN(ts)) dates.push(new Date(ts));
      }catch(e){}
    }
    if(!dates.length) return clearChart('registrationsChart');
    const byMonth = {};
    dates.forEach(dt=>{ const key = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0'); byMonth[key]=(byMonth[key]||0)+1 });
    const labels = Object.keys(byMonth).sort();
    const counts = labels.map(l=>byMonth[l]);
    // cumulative
    const cumulative = []; let s=0; for(const v of counts){ s+=v; cumulative.push(s); }
    drawRegistrations('registrationsChart', labels, counts, cumulative);
  }

  function renderInterests(){
    // expects `interests` array or comma-separated `interests` string
    const counts = {};
    filtered.forEach(p=>{
      let arr = [];
      if(Array.isArray(p.interests)) arr = p.interests;
      else if(Array.isArray(p.tags)) arr = p.tags;
      arr.map(x=>x && x.trim()).filter(Boolean).forEach(i=>{ counts[i]=(counts[i]||0)+1 });
    });
    const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20);
    if(!entries.length) return clearChart('interestsChart');
    drawBar('interestsChart', entries.map(e=>e[0]), entries.map(e=>e[1]), 'Top interests');
  }

  function renderAboutWords(){
    const texts = filtered.map(p=>p.about_me||p.about||p.bio).filter(Boolean);
    const top = topWords(texts.map(t=>t.toString()), 30);
    if(!top.length) return clearChart('aboutWordsChart');
    drawBar('aboutWordsChart', top.map(t=>t[0]), top.map(t=>t[1]), 'Top words in about');
  }

  function renderHeightWeight(){
    const points = filtered.map(p=>{ const h = parseFloat(p.height||p.ht||p.cm||p._height); const w = parseFloat(p.weight||p.wt||p.kg||p._weight); if(!isNaN(h)&&!isNaN(w)) return {x:h,y:w,label:p.username||p.display_name||''}; return null }).filter(Boolean);
    if(!points.length) return clearChart('hwChart');
    drawScatter('hwChart', points.map(pt=>({x:pt.x,y:pt.y})), 'Height (x) vs Weight (y)');
  }

  // Render IQ using multiple candidate keys (handles 'Tested IQ' and 'iq')
  function renderIQ(){
    const candidates = ['iq','IQ','Tested IQ','tested_iq','testedIQ'];
    const vals = filtered.map(p=>{ for(const k of candidates){ if(k in p && p[k]!==undefined && p[k]!==null){ const n = parseFloat(String(p[k]).replace(/[^0-9\.\-]/g,'')); if(!isNaN(n)) return n; // if value like "100-119" parseFloat returns 100
    } } return null }).filter(Boolean);
    if(!vals.length) return clearChart('iqChart');
    const counts={};
    const buckets=[{min:-Infinity,max:80,label:'<80'},{min:80,max:90,label:'80-89'},{min:90,max:100,label:'90-99'},{min:100,max:110,label:'100-109'},{min:110,max:120,label:'110-119'},{min:120,max:Infinity,label:'120+'}];
    for(const n of vals){ let b='?'; for(const bk of buckets){ if(n>=bk.min && n<bk.max){ b=bk.label; break } } counts[b]=(counts[b]||0)+1 }
    const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    drawBar('iqChart', entries.map(e=>e[0]), entries.map(e=>e[1]), 'IQ distribution');
  }

  // (geographic map removed by user request)

  // (renderAll already defined earlier without map) — keep that one and do not call renderMap

  // Chart helpers using Chart.js
  function clearChart(id){ if(CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; } }
  function getCtx(id){ const el = $(id); if(!el) return null; return el.getContext && el.getContext('2d') ? el.getContext('2d') : null; }
  function drawBar(id, labels, data, label){
    clearChart(id);
    const ctx = getCtx(id);
    if(!ctx) return;
    const cfg = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data,
          backgroundColor: labels.map(()=> 'rgba(43,140,196,0.8)'),
          borderColor: 'rgba(20,90,120,0.9)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        animation: {
          onComplete: function(){
            const chart = this;
            const ctx = chart.ctx;
            ctx.save();
            ctx.font = '12px Arial';
            ctx.fillStyle = '#111';
            chart.data.datasets.forEach((ds,di)=>{
              const meta = chart.getDatasetMeta(di);
              meta.data.forEach((bar,i)=>{
                const val = ds.data[i];
                const x = bar.x; const y = bar.y;
                ctx.textAlign = 'center';
                ctx.fillText(String(val), x, y - 6);
              });
            });
            ctx.restore();
          }
        }
      }
    };
    CHARTS[id] = new Chart(ctx, cfg);
  }

  function drawPie(id, labels, data, label){
    clearChart(id);
    const ctx = getCtx(id);
    if(!ctx) return;
    const colors = labels.map((_,i)=> 'hsl(' + ((i*40)%360) + ' 70% 50%)');
    const cfg = {
      type: 'pie',
      data: { labels, datasets: [{ data, backgroundColor: colors }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        animation: {
          onComplete: function(){
            const chart = this;
            const ctx = chart.ctx;
            ctx.save();
            ctx.font = '12px Arial';
            ctx.fillStyle = '#fff';
            const meta = chart.getDatasetMeta(0);
            meta.data.forEach((arc,i)=>{
              const dataVal = chart.data.datasets[0].data[i];
              const angle = (arc.startAngle + arc.endAngle)/2;
              const r = (arc.outerRadius + arc.innerRadius)/2;
              const x = arc.x + Math.cos(angle)*r;
              const y = arc.y + Math.sin(angle)*r;
              ctx.textAlign = 'center';
              ctx.fillText(String(dataVal), x, y);
            });
            ctx.restore();
          }
        }
      }
    };
    CHARTS[id] = new Chart(ctx, cfg);
  }

  function drawLine(id, labels, data, label){
    clearChart(id);
    const ctx = getCtx(id);
    if(!ctx) return;
    const cfg = {
      type: 'line',
      data: { labels, datasets: [{ label, data, borderColor: 'rgba(43,140,196,0.9)', backgroundColor: 'rgba(43,140,196,0.2)', fill: true, pointRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        animation: {
          onComplete: function(){
            const chart = this;
            const ctx = chart.ctx;
            ctx.save(); ctx.font = '12px Arial'; ctx.fillStyle = '#111';
            chart.data.datasets.forEach((ds,di)=>{
              const meta = chart.getDatasetMeta(di);
              meta.data.forEach((pt,i)=>{
                const val = ds.data[i]; const x = pt.x; const y = pt.y;
                ctx.textAlign = 'center'; ctx.fillText(String(val), x, y - 8);
              });
            });
            ctx.restore();
          }
        }
      }
    };
    CHARTS[id] = new Chart(ctx, cfg);
  }

  function drawScatter(id, points, label){
    clearChart(id);
    const ctx = getCtx(id);
    if(!ctx) return;
    const cfg = {
      type: 'scatter',
      data: { datasets: [{ label, data: points, backgroundColor: 'rgba(43,140,196,0.9)', pointRadius: 5 }] },
      options: {
        scales: { x: { title: { display: true, text: 'Height' } }, y: { title: { display: true, text: 'Weight' } } },
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        animation: {
          onComplete: function(){
            const chart = this;
            const ctx = chart.ctx;
            ctx.save(); ctx.font = '12px Arial'; ctx.fillStyle = '#111';
            chart.data.datasets.forEach((ds,di)=>{
              const meta = chart.getDatasetMeta(di);
              meta.data.forEach((pt,i)=>{
                const p = ds.data[i]; const x = pt.x; const y = pt.y;
                const txt = (p && (p.y!==undefined && p.x!==undefined)) ? (p.x + ',' + p.y) : String(p);
                ctx.textAlign = 'center'; ctx.fillText(txt, x, y - 8);
              });
            });
            ctx.restore();
          }
        }
      }
    };
    CHARTS[id] = new Chart(ctx, cfg);
  }

  function drawRegistrations(id, labels, counts, cumulative){
    clearChart(id);
    const ctx = getCtx(id); if(!ctx) return;
    const cfg = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { type: 'bar', label: 'Monthly registrations', data: counts, backgroundColor: 'rgba(43,140,196,0.85)', yAxisID: 'y' },
          { type: 'line', label: 'Cumulative', data: cumulative, borderColor: 'rgba(220,80,80,0.9)', backgroundColor: 'rgba(220,80,80,0.12)', fill: false, yAxisID: 'y1', tension: 0.2 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: {
          y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Monthly' } },
          y1: { beginAtZero: true, position: 'right', grid: { display: false }, title: { display: true, text: 'Cumulative' } }
        },
        animation: { duration: 600 }
      }
    };
    CHARTS[id] = new Chart(ctx, cfg);
  }

  // initial boot
  async function init(){
    const profilesUrl = await resolveProfilesJson();
    if(!profilesUrl){ console.error('profiles.json not found in expected locations'); document.body.insertAdjacentHTML('beforeend','<div style="color:red;padding:12px">profiles.json not found</div>'); return; }
    fetch(profilesUrl).then(r=>r.json()).then(data=>{
      // normalize array
      rawProfiles = Array.isArray(data)?data:(data.profiles||[]);
      // try to normalize some common fields
      rawProfiles.forEach(p=>{
        // derive age from birth_year if missing
        if(!p.age){ if(p.birth_year){ const y=parseInt(p.birth_year); if(!isNaN(y)) p.age = new Date().getFullYear()-y } }
        // coerce numeric-like strings into numbers for common numeric fields
        try{
          if(typeof p.age === 'string' && p.age.trim()!==''){ const n=parseInt(p.age.replace(/[^0-9\-]/g,'')); if(!isNaN(n)) p.age = n }
          ['iq','height','weight','_height','_weight','_age'].forEach(k=>{ if(k in p && typeof p[k] === 'string'){ const n=parseFloat(String(p[k]).replace(/[^0-9\.\-]/g,'')); if(!isNaN(n)) p[k]=n }});
          // Note: profiles are expected to already provide arrays for multi-valued fields.
          // Do not attempt to split CSV-like strings here — the conversion should be done
          // offline by `scripts/fix_csv_fields.py` so the dashboard only consumes arrays.
        }catch(e){}
      });
      filtered = rawProfiles;
      renderAll();
      try{ setupMatrixControls(); }catch(e){console.warn('matrix controls init failed',e)}
    }).catch(err=>{ console.error('Failed to load profiles.json', err); document.body.insertAdjacentHTML('beforeend','<div style="color:red;padding:12px">Failed to load profiles.json</div>') });
  }

  // Matrix controls: populate selects and render cross-tab matrix
  function gatherKeys(){
    const counts = {};
    for(const p of rawProfiles){
      for(const k of Object.keys(p||{})){
        const v = p[k];
        if(v===null||v===undefined) continue;
        // treat strings, booleans, and arrays as categorical
        if(typeof v === 'string' || typeof v === 'boolean' || Array.isArray(v)){
          counts[k] = (counts[k]||0)+1;
        }
      }
    }
    // sort keys by frequency
    return Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  }

  function setupMatrixControls(){
    const xsel = $('matrixX'); const ysel = $('matrixY'); const btn = $('matrixRender'); const info = $('matrixInfo');
    if(!xsel || !ysel || !btn) return;
    const keys = gatherKeys();
    // sort alphabetically for select lists
    keys.sort((a,b)=> a.toString().localeCompare(b.toString(), undefined, {sensitivity: 'base'}));
    // populate selects
    xsel.innerHTML = '<option value="">-- select field --</option>' + keys.map(k=>`<option value="${k}">${k}</option>`).join('');
    ysel.innerHTML = '<option value="">-- select field --</option>' + keys.map(k=>`<option value="${k}">${k}</option>`).join('');
    btn.addEventListener('click', ()=>{
      const x = xsel.value; const y = ysel.value;
      if(!x || !y){ info.textContent = 'Choose both X and Y fields.'; return }
      if(x===y){ info.textContent = 'Pick two different fields.'; return }
      info.textContent = 'Rendering…';
      const table = buildCrossTab(x,y);
      renderMatrixTable(table, x, y);
      info.textContent = `Showing ${rawProfiles.length} profiles (cells show counts)`;
    });
  }

  function toValues(v){
    if(v===null||v===undefined) return [''];
    if(Array.isArray(v)) return v.map(x=>String(x).trim()).filter(Boolean);
    if(typeof v === 'boolean') return [v? 'Yes':'No'];
    return [String(v).trim()];
  }

  function buildCrossTab(xKey, yKey){
    const counts = {};
    // only include non-empty values; build counts[x][y]
    for(const p of rawProfiles){
      const xv = p[xKey]; const yv = p[yKey];
      const xvals = toValues(xv).filter(z=>z && String(z).trim());
      const yvals = toValues(yv).filter(z=>z && String(z).trim());
      if(!xvals.length || !yvals.length) continue; // skip profiles missing either side
      for(const xa of xvals){ for(const ya of yvals){ const xk = String(xa).trim(); const yk = String(ya).trim(); counts[xk] = counts[xk]||{}; counts[xk][yk] = (counts[xk][yk]||0)+1 } }
    }
    // compute totals per row/col to sort
    const xTotals = {}; const yTotals = {};
    for(const [x, row] of Object.entries(counts)){
      let sum = 0;
      for(const [y,val] of Object.entries(row)){ sum += val; yTotals[y] = (yTotals[y]||0)+val }
      xTotals[x] = sum;
    }
    // sort keys by total descending
    const xVals = Object.keys(xTotals).sort((a,b)=>xTotals[b]-xTotals[a]).slice(0,100);
    const yVals = Object.keys(yTotals).sort((a,b)=>yTotals[b]-yTotals[a]);
    return {counts,xVals,yVals, xTotals, yTotals};
  }

  function renderMatrixTable(tableData, xLabel, yLabel){
    const container = $('matrixContainer'); if(!container) return;
    const {counts,xVals,yVals, xTotals, yTotals} = tableData;
    // compute max for coloring (ignore zero cells)
    let max = 0; for(const xr of xVals){ for(const yr of yVals){ const v = (counts[xr] && counts[xr][yr])?counts[xr][yr]:0; if(v>max) max=v }}
    const tbl = document.createElement('table'); tbl.style.borderCollapse='collapse'; tbl.style.width='100%'; tbl.style.margin='8px 0';
    const thead = document.createElement('thead'); const hrow = document.createElement('tr'); hrow.appendChild(document.createElement('th'));
    for(const y of yVals){ if(y === '(empty)') continue; const th = document.createElement('th'); th.textContent = y; th.style.padding='6px'; th.style.border='1px solid #ddd'; th.style.fontSize='12px'; hrow.appendChild(th) }
    thead.appendChild(hrow); tbl.appendChild(thead);
    const tbody = document.createElement('tbody');
    for(const x of xVals){ if(x === '(empty)') continue; const tr = document.createElement('tr'); const th = document.createElement('th'); th.textContent = x; th.style.padding='6px'; th.style.border='1px solid #ddd'; th.style.textAlign='left'; th.style.fontSize='12px'; tr.appendChild(th);
      for(const y of yVals){ if(y === '(empty)') continue; const td = document.createElement('td'); const v = (counts[x] && counts[x][y])?counts[x][y]:0; const colTotal = yTotals[y] || 0; const pct = colTotal ? (v/colTotal*100) : 0; td.textContent = `${v}${colTotal? ' (' + pct.toFixed(1) + '%)':''}`; td.style.padding='6px'; td.style.border='1px solid #eee'; td.style.textAlign='center'; td.style.fontSize='12px'; const intensity = max? (v/max):0; const alpha = 0.18 + 0.72*intensity; td.style.background = `rgba(43,140,196,${alpha})`; td.style.color = intensity>0.45? '#fff':'#111'; tr.appendChild(td) }
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    // replace
    container.innerHTML = '';
    const title = document.createElement('div'); title.style.fontSize='13px'; title.style.color='var(--muted)'; title.style.margin='6px 0'; title.textContent = `Cross-tab: ${xLabel} × ${yLabel}`;
    container.appendChild(title); container.appendChild(tbl);
    // legend
    const legend = document.createElement('div'); legend.style.fontSize='12px'; legend.style.color='var(--muted)'; legend.style.marginTop='6px'; legend.textContent = `Cells colored by count (max = ${max}).`;
    container.appendChild(legend);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
