// Client-side app: load profiles and provide search + detail view
(async function(){
  try{
  const el = (sel, ctx=document) => ctx.querySelector(sel);
  const liTpl = el('#listItemTpl').content;
  const listEl = el('#list');
  const searchInput = el('#search');
  const clearBtn = el('#clear');
  const showAllBtn = el('#showAll');
  const resultsCount = el('#resultsCount');

  // try normalized file first
  const profilesUrl = await (async ()=>{
    // try local, parent, and root locations so server can be started from repo root
    const candidates = [
      'profiles.json',
      '../profiles.json',
      '/profiles.json'
    ];
    for(const c of candidates){
      try{ let r = await fetch(c,{cache:'no-store'}); if(r.ok) return c;}catch(e){}
    }
    return null;
  })();
  if(!profilesUrl){
    listEl.innerHTML = '<li>No profiles JSON found (profiles.json)</li>';
    return;
  }
  const resp = await fetch(profilesUrl);
  const data = await resp.json();
  const profiles = data.profiles || [];

  // assign stable index and hash id for each profile
  function makeHashId(p, idx, used){
    // prefer explicit username-like fields, then url basename, then display name
    let base = '';
    const tryFields = ['username','handle','user','screen_name','profile_name','id'];
    for(const k of tryFields){ if(p[k] && String(p[k]).trim()){ base = String(p[k]).trim(); break; } }
    if(!base){ const url = p.url || p.profile_url || p.profile || ''; if(url && String(url).trim()){ try{ const u = new URL(String(url)); const segs = u.pathname.split('/').filter(Boolean); if(segs.length) base = segs[segs.length-1]; else base = u.hostname.replace(/^www\./,''); }catch(e){ base = String(url); } } }
    if(!base) base = p.display_name || p.name || 'profile';
    base = String(base);
    // strip extensions and trailing numeric ids
    base = base.replace(/\.[a-z0-9]{1,5}$/i,'').replace(/[^a-z0-9-_]+/ig,'-').replace(/(^-|-$)/g,'');
    let slug = base.toLowerCase();
    if(!slug) slug = 'profile';
    // if slug already used, append short deterministic hash fragment
    if(used && used.has(slug)){
      // simple deterministic hash from url or name
      const seed = String(p.url || p.profile_url || p.id || p.display_name || p.name || idx);
      let h = 5381; for(let i=0;i<seed.length;i++) h = ((h<<5)+h) + seed.charCodeAt(i);
      const frag = (Math.abs(h)%0x1000000).toString(36);
      slug = `${slug}-${frag}`;
    }
    return slug;
  }
  const _usedSlugs = new Set();
  profiles.forEach((p,i)=>{ p._idx = i; p._hashId = makeHashId(p,i,_usedSlugs); _usedSlugs.add(p._hashId); });

  function getHandle(p){
    const keys = ['username','handle','user','screen_name','profile_name'];
    for(const k of keys){ if(p[k] && String(p[k]).trim()) return String(p[k]).trim(); }
    // try extract from url if looks like /@handle or /user/handle
    const url = p.url || p.profile_url || p.profile || '';
    try{
      if(url){ const u = new URL(String(url)); const segs = u.pathname.split('/').filter(Boolean); if(segs.length){ const last = segs[segs.length-1]; if(last && !/page|profile|index|\.html?$/.test(last)) return last.replace(/^@/,''); } }
    }catch(e){}
    return '';
  }

  // build searchable text from all string values in the profile
  // Exclude certain keys from the index (e.g. url, image, and groups.link)
  function collectText(v, parentKey=''){
    if(!v && v !== 0) return '';
    if(typeof v === 'string') return v;
    if(typeof v === 'number') return String(v);
    if(Array.isArray(v)) return v.map(item=> collectText(item, parentKey)).join(' ');
    if(typeof v === 'object'){
      // include both keys and values so searches match strings present as property names
      const parts = [];
      for(const [k,val] of Object.entries(v)){
        const kl = String(k).toLowerCase();
        // exclude top-level url/image keys
        if(kl === 'url' || kl === 'image') continue;
        // exclude group links specifically
        if(parentKey === 'groups' && kl === 'link') continue;
        // include the key name (so searching for field names works)
        parts.push(String(k));
        parts.push(collectText(val, k));
      }
      return parts.join(' ');
    }
    return '';
  }
  function profileText(p){ return collectText(p).toLowerCase(); }
  // precompute searchable text
  for(const p of profiles){ p._search = profileText(p); }

  function firstAboutText(p){
    const priority = ['about_me','summary','bio','about','About me'];
    for(const k of priority){ if(p[k] && String(p[k]).trim()) return String(p[k]); }
    for(const k of Object.keys(p)){
      if(/about|summary|bio/i.test(k) && p[k] && String(p[k]).trim()) return String(p[k]);
    }
    return '';
  }

  // normalize image urls so they point to repository-root /images/ when needed
  function normalizeImageUrl(u){
    if(!u) return null;
    try{
      const s = String(u).trim();
      // allow data URIs and absolute-root local paths and local images/ folder
      if(s.startsWith('data:')) return s;
      if(s.startsWith('/')){
        // only allow local /images or other app-local paths
        if(s.startsWith('/images/') || s.startsWith('/site/') || s.startsWith('/profiles') || s.startsWith('/media')){
          // normalize extension to .jpeg for local images so renamed files are found
          const m = s.match(/^(.*?)([?#].*)?$/);
          const path = m ? m[1] : s;
          const tail = (m && m[2]) ? m[2] : '';
          const newPath = path.replace(/\.(?:jpe?g|png|gif|webp)$/i, '.jpeg');
          return newPath + tail;
        }
        return null;
      }
      if(s.startsWith('images/') || s.startsWith('./images/') ){
        const cleaned = s.replace(/^\.\//,'');
        const m2 = cleaned.match(/^(.*?)([?#].*)?$/);
        const path = m2 ? m2[1] : cleaned;
        const tail = (m2 && m2[2]) ? m2[2] : '';
        const newPath = path.replace(/\.(?:jpe?g|png|gif|webp)$/i, '.jpeg');
        return '/' + newPath + tail;
      }
      // explicitly block remote hosts (wp-content, http, https)
      if(s.startsWith('http:')||s.startsWith('https:')||/wp-content|https?:\/\//i.test(s)) return null;
      // preserve query and fragment when normalizing extension
      const m = s.match(/^(.*?)([?#].*)?$/);
      const path = m ? m[1] : s;
      const tail = (m && m[2]) ? m[2] : '';
      const cleaned = path.replace(/^\.\/?|^site\//,'').replace(/^\/+/, '');
      const normalized = cleaned.replace(/\.(?:jpe?g|png|gif|webp)$/i, '.jpeg');
      return '/' + normalized + tail;
    }catch(e){ return null; }
  }

  // Try to derive a full-size image URL from a thumbnail path
  function deriveFullUrl(u){
    if(!u) return null;
    try{
      let s = String(u);
      // remove common "small" folder segment
      s = s.replace(/\/small\//i, '/');
      // remove filename prefixes like small123 or small-
      s = s.replace(/small[_-]?/i,'');
      // remove -<WxH> suffix before extension, e.g. -200x300.jpg
      s = s.replace(/-\d+x\d+(?=\.[a-zA-Z]{2,4}$)/, '');
      return s;
    }catch(e){return u}
  }

  // Image modal helpers
  const imgModal = el('#imgModal');
  const imgModalImg = el('#imgModalImg');
  const imgModalCaption = el('#imgModalCaption');
  function openImageModal(src, caption){
    if(!imgModal || !imgModalImg) return;
    imgModalImg.src = src || '';
    imgModalImg.alt = caption || '';
    imgModalCaption.textContent = caption || '';
    imgModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeImageModal(){
    if(!imgModal || !imgModalImg) return;
    imgModal.setAttribute('aria-hidden', 'true');
    imgModalImg.src = '';
    imgModalCaption.textContent = '';
    document.body.style.overflow = '';
  }
  // wire modal close buttons / backdrop
  if(imgModal){
    imgModal.addEventListener('click', (ev)=>{
      const act = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-action');
      if(act === 'close' || ev.target.classList.contains('img-modal-close')){ closeImageModal(); return; }
      // clicking backdrop closes
      if(ev.target.classList && ev.target.classList.contains('img-modal-backdrop')){ closeImageModal(); }
    });
    // close on ESC
    window.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape') closeImageModal(); });
  }

  function renderList(items){
    listEl.innerHTML = '';
    resultsCount.textContent = `${items.length} profiles`;
    const q = searchInput.value.trim();
    for(const p of items){
      const node = liTpl.cloneNode(true);
      const li = node.querySelector('li');
      // attach hash id for linking
      li.setAttribute('data-hash-id', p._hashId || '');
      const img = node.querySelector('.thumb');
      const title = node.querySelector('.title');
      const sub = node.querySelector('.sub');
      const rawImg = (p.image && String(p.image).trim()) ? p.image : 'images/profile.png';
      img.src = normalizeImageUrl(rawImg) || '/images/profile.png';
      const handle = getHandle(p);
      const display = p.display_name || p.name || '';
      if(handle){
        title.innerHTML = `<span class="handle">@${escapeHtml(handle)}</span>, ${highlightHtml(display, q)}`;
      } else {
        title.innerHTML = highlightHtml(display, q);
      }
      const subtxt = [];
      if(p.age) subtxt.push(p.age);
      if(p.city) subtxt.push(p.city);
      if(p.country) subtxt.push(p.country);
      if(p.membership) subtxt.push(p.membership);
      sub.innerHTML = highlightHtml(subtxt.join(' • '), q);
      li.addEventListener('click', ()=>{ location.hash = p._hashId; showDetail(p); });
      // clicking thumbnail should open modal without navigating
      img.addEventListener('click', (ev)=>{ ev.stopPropagation(); const src = img.src || ''; openImageModal(src, p.display_name || p.name || ''); });
      // mark selected if matches current hash
      try{
        const cur = (location.hash || '').replace(/^#/,'');
        if(cur && p._hashId === decodeURIComponent(cur)) li.classList.add('selected');
      }catch(e){}
      listEl.appendChild(node);
    }
  }

  function matchQuery(p, q){
    if(!q) return true;
    return p._search.indexOf(q) !== -1;
  }

  function doSearch(){
    const q = searchInput.value.trim().toLowerCase();
    const res = profiles.filter(p=> matchQuery(p,q) && matchFilters(p));
    renderList(res);
    // if the URL hash references a profile, prefer that; otherwise show first result
    const cur = (location.hash || '').replace(/^#/,'');
    if(cur){ const target = profiles.find(p=> p._hashId === decodeURIComponent(cur)); if(target) return showDetail(target); }
    if(res.length>0) showDetail(res[0]);
  }

  function showDetail(p){
    // Hero area (big image + summary)
    const q = searchInput.value.trim();
    const aboutText = firstAboutText(p) || '';
    // normalize and dedupe media images; only keep local images
    const mediaNorm = (p.media_images||[]).map(normalizeImageUrl).filter(x=>x);
    const media = Array.from(new Set(mediaNorm));
    const heroImg = media.length ? media[0] : (normalizeImageUrl(p.image) || '/images/profile.png');
    const handle = getHandle(p);
    const display = p.display_name || p.name || '';
    const handleHtml = handle ? `<span class="handle">@${escapeHtml(handle)}</span>, ` : '';
    const heroHtml = `
      <div class="profile-hero">
        <div class="hero-img-wrap"><img id="heroMainImg" class="hero-img" src="${escapeHtml(heroImg)}" alt="${escapeHtml(display)}"></div>
        <div class="hero-info">
          <h2>${handleHtml}${highlightHtml(display, q)} <span class="muted">${escapeHtml(p.age||'')}</span></h2>
          <div class="meta-line">${highlightHtml((p.city||'') + (p.city && p.country ? ' • ' : '') + (p.country||''), q)}</div>
          <div class="about">${highlightHtml(aboutText, q)}</div>
        </div>
      </div>`;
    el('#detailHeader').innerHTML = heroHtml;
    // gallery: show hero + prev/next controls (no thumbnails)
    const gallery = el('#gallery'); gallery.innerHTML = '';
    if(media.length){
      // build list of {full,thumb} from original raw media entries
      const rawMedia = (p.media_images||[]).map(String).filter(x=>x.trim());
      const items = rawMedia.map(raw => {
        const candidateFull = deriveFullUrl(raw) || raw;
        const full = normalizeImageUrl(candidateFull) || normalizeImageUrl(raw) || null;
        const thumb = normalizeImageUrl(raw) || full || '/images/profile.png';
        return {full,thumb, raw};
      }).filter(it => it.full || it.thumb);
      const controls = document.createElement('div'); controls.className='gallery-controls centered';
      const prev = document.createElement('button'); prev.className='gbtn'; prev.textContent='◀';
      const counter = document.createElement('div'); counter.className='gcount'; counter.textContent = `1 / ${items.length}`;
      const next = document.createElement('button'); next.className='gbtn'; next.textContent='▶';
      let idx = 0;
      function setIndex(i){ idx = (i+items.length)%items.length; const hero = el('#heroMainImg'); if(hero) hero.src = items[idx].full || items[idx].thumb || '/images/profile.png'; counter.textContent = `${idx+1} / ${items.length}`; }
      prev.addEventListener('click', ()=> setIndex(idx-1)); next.addEventListener('click', ()=> setIndex(idx+1));
      controls.appendChild(prev); controls.appendChild(counter); controls.appendChild(next);
      // insert controls directly under the hero image so they're visually attached to it
      const heroWrap = el('.hero-img-wrap');
      if(heroWrap){
        // remove previous controls if present
        const old = heroWrap.querySelector('.gallery-controls'); if(old) old.remove();
        heroWrap.appendChild(controls);
      } else {
        gallery.appendChild(controls);
      }
      setIndex(0);
    } else {
      gallery.innerHTML = '';
    }
    // wire hero image click to open modal
    const heroImgEl = el('#heroMainImg'); if(heroImgEl){ heroImgEl.addEventListener('click', (ev)=>{ ev.stopPropagation(); openImageModal(heroImgEl.src, p.display_name || p.name || ''); }); }
    // fields (non-media)
    const fields = el('#fields'); fields.innerHTML = '';
    for(const k of Object.keys(p).sort()){
      if(['url','image','name','display_name','media_images','groups','groups_count','media_count','_search','about_me','summary','bio','about','_idx','_hashId'].includes(k)) continue;
      const v = p[k];
      // skip empty values
      if(v === undefined || v === null) continue;
      if(typeof v === 'string' && v.trim() === '') continue;
      if(Array.isArray(v) && v.length === 0) continue;
      if(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      const f = document.createElement('div'); f.className='field';
      // compact style for short/numeric fields
      const shortKeyRe = /(age|height|weight|response_rate|cm|kg|bust|waist|hips|eyecolor|hair|eye color|eye_color|hair_color)/i;
      const isShort = (typeof v === 'number') || (typeof v === 'string' && String(v).trim().length <= 6) || shortKeyRe.test(k);
      if(isShort) f.classList.add('field-short');
      let valHtml = '';
      if(Array.isArray(v)){
        valHtml = highlightHtml(v.join(', '), q);
      } else if(typeof v === 'object'){
        // render simple key: value pairs (highlight values)
        valHtml = Object.entries(v).map(([kk,vv])=>`${escapeHtml(String(kk))}: ${highlightHtml(String(vv), q)}`).join('<br/>');
      } else {
        valHtml = highlightHtml(String(v), q);
      }
      f.innerHTML = `<div class='k'>${escapeHtml(k)}</div><div class='v'>${valHtml}</div>`;
      fields.appendChild(f);
    }
    // groups (show names only, no external links)
    const groups = el('#groups'); groups.innerHTML = '';
    if(p.groups && p.groups.length){
      const h = document.createElement('h3'); h.textContent = 'Groups'; groups.appendChild(h);
      for(const g of p.groups){
        // g may be a string or an object with a name property
        const name = (typeof g === 'string') ? g : (g && (g.name || g.title || g.text) ? (g.name || g.title || g.text) : '');
        const slug = String(name || '').replace(/[^a-z0-9\-]+/ig,'-').toLowerCase();
        const a = document.createElement('a');
        a.className = 'group-pill';
        a.href = 'groups.html#' + encodeURIComponent(slug);
        a.textContent = name || (g && g) || 'group';
        a.target = '_self';
        // ensure navigation works even if surrounding handlers intercept clicks
        a.addEventListener('click', (ev)=>{ ev.stopPropagation(); ev.preventDefault(); location.href = 'groups.html#' + encodeURIComponent(slug); });
        groups.appendChild(a);
      }
    }

    // mark selected item in the list (and scroll into view)
    try{
      const esc = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') ? CSS.escape(p._hashId) : safeEscapeIdentifier(p._hashId);
      const prev = listEl.querySelector('.selected'); if(prev) prev.classList.remove('selected');
      const node = listEl.querySelector(`li[data-hash-id="${esc}"]`);
      if(node){ node.classList.add('selected'); try{ node.scrollIntoView({behavior:'smooth',block:'nearest'}); }catch(e){} }
    }catch(e){}
  }

  function escapeHtml(s){ s = (s === undefined || s === null) ? '' : String(s); return s.replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  // highlight occurrences of `q` in the original text `s` (case-insensitive)
  function highlightHtml(s, q){
    s = (s === undefined || s === null) ? '' : String(s);
    q = (q === undefined || q === null) ? '' : String(q).trim();
    if(!q) return escapeHtml(s);
    try{
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
      let last = 0;
      const parts = [];
      let m;
      while((m = re.exec(s)) !== null){
        const idx = m.index;
        if(idx > last) parts.push(escapeHtml(s.slice(last, idx)));
        parts.push('<mark class="highlight">' + escapeHtml(m[0]) + '</mark>');
        last = idx + m[0].length;
      }
      if(last < s.length) parts.push(escapeHtml(s.slice(last)));
      return parts.join('');
    }catch(e){ return escapeHtml(s); }
  }

  // CSS.escape fallback for environments missing it
  function safeEscapeIdentifier(id){
    if(typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id);
    return String(id).replace(/(["'\\])/g,'\\$1').replace(/\s+/g,' ');
  }

  // wire events
  searchInput.addEventListener('input', ()=> doSearch());
  clearBtn.addEventListener('click', ()=>{ searchInput.value=''; doSearch(); });
  showAllBtn.addEventListener('click', ()=>{ searchInput.value=''; renderList(profiles); if(profiles.length) showDetail(profiles[0]); });

  // respond to back/forward or direct hash navigation
  window.addEventListener('hashchange', ()=>{
    const cur = (location.hash||'').replace(/^#/,'');
    if(!cur) return;
    const target = profiles.find(p=> p._hashId === decodeURIComponent(cur));
    if(target) showDetail(target);
  });

  // --- filters (load key_options.json if present) ---
  const filtersEl = el('#filters');
  let keyOptions = {};
  // filters toolbar: clear button and active chips
  const filtersToolbar = document.createElement('div'); filtersToolbar.className = 'filters-toolbar';
  const clearFiltersBtn = document.createElement('button'); clearFiltersBtn.className='clear-filters'; clearFiltersBtn.textContent = 'Clear filters';
  const activeWrap = document.createElement('div'); activeWrap.className = 'active-filters';
  clearFiltersBtn.addEventListener('click', ()=>{
    // clear activeFilters and uncheck checkboxes
    for(const k of Object.keys(activeFilters)) delete activeFilters[k];
    for(const cb of filtersEl.querySelectorAll('input[type=checkbox]')) cb.checked = false;
    updateActiveChips(); doSearch();
  });
  filtersToolbar.appendChild(clearFiltersBtn); filtersToolbar.appendChild(activeWrap); filtersEl.appendChild(filtersToolbar);
  function updateActiveChips(){
    activeWrap.innerHTML = '';
    for(const key of Object.keys(activeFilters)){
      const val = activeFilters[key];
      if(val instanceof Set){
        for(const v of val){ const chip = document.createElement('button'); chip.className='chip'; chip.textContent = `${key}: ${v}`; chip.dataset.key=key; chip.dataset.val=v; chip.addEventListener('click', ()=>{ // remove
            activeFilters[key].delete(v); if(activeFilters[key].size===0) delete activeFilters[key];
                  const cb = filtersEl.querySelector(`input[data-key="${safeEscapeIdentifier(key)}"][data-val="${safeEscapeIdentifier(v)}"]`); if(cb) cb.checked=false; updateActiveChips(); doSearch(); }); activeWrap.appendChild(chip); }
      } else {
        const chip = document.createElement('button'); chip.className='chip'; chip.textContent = `${key}: ${val}`; chip.dataset.key=key; chip.dataset.val=val; chip.addEventListener('click', ()=>{ delete activeFilters[key]; const cb = filtersEl.querySelector(`input[data-key="${safeEscapeIdentifier(key)}"][data-val="${safeEscapeIdentifier(val)}"]`); if(cb) cb.checked=false; updateActiveChips(); doSearch(); }); activeWrap.appendChild(chip);
      }
    }
  }
  async function findJson(candidates){
    for(const c of candidates){ try{ let r = await fetch(c,{cache:'no-store'}); if(r.ok) return c;}catch(e){} }
    return null;
  }
  const keyCandidates = ['key_options.json','../key_options.json','/key_options.json'];
  const keyUrl = await findJson(keyCandidates);
  const activeFilters = {};

  function matchFilters(p){
    for(const k of Object.keys(activeFilters)){
      const v = activeFilters[k]; if(!v) continue;
      const pv = p[k];
      if(pv === undefined || pv === null) return false;
      // if v is a Set -> any match allowed
      if(v instanceof Set){
        const wanted = Array.from(v).map(x=>String(x).toLowerCase());
        if(Array.isArray(pv)){
          const pvnorm = pv.map(x=>String(x).toLowerCase());
          if(!wanted.some(w=>pvnorm.includes(w))) return false;
        } else {
          if(!wanted.includes(String(pv).toLowerCase())) return false;
        }
      } else {
        if(Array.isArray(pv)){
          if(!pv.map(x=>String(x).toLowerCase()).includes(String(v).toLowerCase())) return false;
        } else {
          if(String(pv).toLowerCase() !== String(v).toLowerCase()) return false;
        }
      }
    }
    return true;
  }

  if(keyUrl){
    try{
      const r = await fetch(keyUrl); keyOptions = await r.json();
      // pick top keys to show by choosing keys with fewer options (more useful filters)
      const excludeKeys = new Set(['media_images','groups','groups_count','media_count','image','url','_search','name','display_name']);
      const keys = Object.keys(keyOptions).filter(k=> !excludeKeys.has(k) && (keyOptions[k]||[]).length>1).sort((a,b)=> (keyOptions[a].length||0) - (keyOptions[b].length||0));
      for(const k of keys){
        const opts = (keyOptions[k] || []).filter(x=>x!==null && x!==undefined).map(x=>String(x));
        const group = document.createElement('div'); group.className = 'filter-group';
        const header = document.createElement('div'); header.className='filter-header'; header.textContent = k + ` (${opts.length})`;
        const optionsWrap = document.createElement('div'); optionsWrap.className='filter-options';
        header.addEventListener('click', ()=>{ optionsWrap.classList.toggle('collapsed'); });

        if(opts.length <= 30){
          for(const opt of opts){
            const label = document.createElement('label'); label.className='filter-option';
            const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.key = k; cb.dataset.val = opt;
            cb.addEventListener('change', (ev)=>{
              const key = ev.target.dataset.key; const val = ev.target.dataset.val;
              if(!activeFilters[key]) activeFilters[key] = new Set();
              if(ev.target.checked) activeFilters[key].add(val); else { activeFilters[key].delete(val); if(activeFilters[key].size===0) delete activeFilters[key]; }
              updateActiveChips(); doSearch();
            });
            label.appendChild(cb); label.appendChild(document.createTextNode(' ' + opt)); optionsWrap.appendChild(label);
          }
        } else {
          // large option sets: show a search box and render matches from the full
          // options list (initially show top 20). Matches are limited to 200.
          const searchBox = document.createElement('input'); searchBox.placeholder = 'Filter options…'; searchBox.className='opt-filter';
          optionsWrap.appendChild(searchBox);
          const listContainer = document.createElement('div'); listContainer.style.display = 'flex'; listContainer.style.flexWrap = 'wrap'; listContainer.style.gap = '6px';
          optionsWrap.appendChild(listContainer);

          function createOptionLabel(opt){
            const label = document.createElement('label'); label.className='filter-option';
            const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.key = k; cb.dataset.val = opt;
            // restore checked state if already active
            if(activeFilters[k] && activeFilters[k].has(opt)) cb.checked = true;
            cb.addEventListener('change', (ev)=>{
              const key = ev.target.dataset.key; const val = ev.target.dataset.val;
              if(!activeFilters[key]) activeFilters[key] = new Set();
              if(ev.target.checked) activeFilters[key].add(val); else { activeFilters[key].delete(val); if(activeFilters[key].size===0) delete activeFilters[key]; }
              updateActiveChips(); doSearch();
            });
            label.appendChild(cb); label.appendChild(document.createTextNode(' ' + opt));
            return label;
          }

          function renderOptions(filter){
            listContainer.innerHTML = '';
            const q = (filter || '').trim().toLowerCase();
            const limit = q ? 200 : 20;
            const matches = opts.filter(x => x.toLowerCase().includes(q)).slice(0, limit);
            for(const opt of matches){ listContainer.appendChild(createOptionLabel(opt)); }
            // more-note
            // remove existing more-note if any
            const oldNote = optionsWrap.querySelector('.more-note'); if(oldNote) oldNote.remove();
            if(!q && opts.length > 20){ const moreNote = document.createElement('div'); moreNote.className='more-note'; moreNote.textContent = 'Showing top 20 options — refine search to see more.'; optionsWrap.appendChild(moreNote); }
            if(q && opts.filter(x=>x.toLowerCase().includes(q)).length > limit){ const moreNote = document.createElement('div'); moreNote.className='more-note'; moreNote.textContent = `Showing first ${limit} matches — refine search to see more.`; optionsWrap.appendChild(moreNote); }
          }

          searchBox.addEventListener('input', ()=> renderOptions(searchBox.value));
          // initial render (top 20)
          renderOptions('');
        }

        group.appendChild(header); group.appendChild(optionsWrap); filtersEl.appendChild(group);
      }
    }catch(e){console.warn('key_options load failed',e)}
  }

  // initial render: show all profiles
  renderList(profiles);
  // prefer opening profile referenced by URL hash on initial load
  (function openFromHash(){
    const cur = (location.hash || '').replace(/^#/,'');
    if(cur){
      try{
        const target = profiles.find(p=> p._hashId === decodeURIComponent(cur));
        if(target){ showDetail(target); return; }
      }catch(e){}
    }
    if(profiles.length) showDetail(profiles[0]);
  })();

  }catch(err){
    // show visible error message in page for debugging
    console.error(err);
    document.body.innerHTML = `<div style="padding:24px;font-family:Inter, system-ui, Arial;">`+
      `<h2 style='color:#b3003a'>App error</h2><pre style='white-space:pre-wrap;color:#333'>${escapeHtml(String(err && err.stack ? err.stack : err))}</pre>`+
      `<p>Please check console for details.</p></div>`;
  }
})();
