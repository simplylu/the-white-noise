// groups.js — loads groups_with_messages.json and renders searchable groups list + detail
(async function(){
  // determine project base so absolute app-local paths work on GitHub Pages project sites
  const PROJECT_BASE = (window.PROJECT_BASE !== undefined) ? window.PROJECT_BASE : (function(){
    try{ if(location.hostname && location.hostname.endsWith('github.io')){ const parts = location.pathname.split('/').filter(Boolean); if(parts.length>0) return '/' + parts[0] + '/'; } }catch(e){}
    return '/';
  })();
  const el = (s,ctx=document) => ctx.querySelector(s);
  const listEl = el('#list'); const liTpl = el('#listItemTpl').content;
  const searchInput = el('#search'); const clearBtn = el('#clear'); const resultsCount = el('#resultsCount');
  // capture initial query param so we can run it after initialization
  const initialQ = (new URLSearchParams(location.search)).get('q') || '';

  function escapeHtml(s){ if(s===undefined||s===null) return ''; return String(s).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  // find groups_with_messages.json in several possible locations
  async function findJson(){ const cand = ['groups.json','../groups.json', PROJECT_BASE + 'groups.json', PROJECT_BASE + 'site/groups.json']; for(const c of cand){ try{ const r = await fetch(c,{cache:'no-store'}); if(r.ok) return c;}catch(e){} } return null; }
  const jsonUrl = await findJson(); if(!jsonUrl){ listEl.innerHTML = '<li>No groups JSON found (groups.json)</li>'; return; }
  const resp = await fetch(jsonUrl); const groups = await resp.json();

  // build searchable text for each group (search everywhere in JSON)
  function collectText(v){ if(v===null||v===undefined) return ''; if(typeof v === 'string') return v; if(typeof v === 'number') return String(v); if(Array.isArray(v)) return v.map(collectText).join(' '); if(typeof v === 'object'){ let parts=[]; for(const [k,val] of Object.entries(v)){ parts.push(k); parts.push(collectText(val)); } return parts.join(' ');} return '' }
  groups.forEach((g,i)=>{ g._idx = i; g._search = collectText(g).toLowerCase(); g._hashId = (g.name||'group-'+i).toString().replace(/[^a-z0-9\-]+/ig,'-').toLowerCase(); });

  function resolveImgUrl(raw){
    if(!raw) return '';
    raw = String(raw).trim();
    if(raw.startsWith('//')) return 'https:' + raw;
    if(raw.startsWith('/')){
      // local app paths need PROJECT_BASE prefix
      if(raw.startsWith('/images/') || raw.startsWith('/site/') || raw.startsWith('/profiles') || raw.startsWith('/media')){
        return PROJECT_BASE + raw.replace(/^\/+/, '');
      }
      return '';
    }
    return raw;
  }

  // profiles cache and loader (used to find members of a group)
  let profilesCache = null;
  async function loadProfiles(){
    if(profilesCache) return profilesCache;
    const candidates = ['profiles.json','../profiles.json', PROJECT_BASE + 'profiles.json', PROJECT_BASE + 'site/profiles.json'];
    for(const c of candidates){
      try{ const r = await fetch(c,{cache:'no-store'}); if(r.ok){ const data = await r.json(); const profiles = data.profiles || data || []; profilesCache = Array.isArray(profiles) ? profiles : []; return profilesCache; } }catch(e){}
    }
    profilesCache = [];
    return profilesCache;
  }

  function slugifyName(s){ if(!s) return ''; return String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,'-'); }

  // create a profile slug similar to app.js makeHashId (simple deterministic slug)
  function makeProfileSlug(p, idx){
    let base = '';
    const tryFields = ['username','handle','user','screen_name','profile_name','id'];
    for(const k of tryFields){ if(p[k] && String(p[k]).trim()){ base = String(p[k]).trim(); break; } }
    if(!base){ const url = p.url || p.profile_url || p.profile || ''; if(url && String(url).trim()){ try{ const u = new URL(String(url)); const segs = u.pathname.split('/').filter(Boolean); if(segs.length) base = segs[segs.length-1]; else base = u.hostname.replace(/^www\./,''); }catch(e){ base = String(url); } } }
    if(!base) base = p.display_name || p.name || 'profile';
    base = String(base);
    base = base.replace(/\.[a-z0-9]{1,5}$/i,'').replace(/[^a-z0-9-_]+/ig,'-').replace(/(^-|-$)/g,'');
    let slug = base.toLowerCase(); if(!slug) slug = 'profile-' + String(idx||0);
    return slug;
  }

  function chooseGroupImage(g){
    // prefer local `img` or `image` or `avatar`, then `header`
    const candidates = [g.img, g.image, g.avatar, g.header];
    for(const c of candidates){ if(c && String(c).trim()) return resolveImgUrl(c); }
    return PROJECT_BASE + 'images/group.png';
  }

  function renderList(items){ listEl.innerHTML=''; resultsCount.textContent = `${items.length} groups`; for(const g of items){ const node = liTpl.cloneNode(true); const li = node.querySelector('li'); const img = node.querySelector('.thumb'); const title = node.querySelector('.title'); const sub = node.querySelector('.sub'); const rawImg = chooseGroupImage(g);
      img.src = rawImg;
      li.dataset.hashId = g._hashId;
      title.innerHTML = `<strong>${escapeHtml(g.name||'Untitled')}</strong>`;
      const parts = [];
      if(g.members) parts.push((g.members+' members'));
      if(g.privacy) parts.push(g.privacy);
      if(g.last_activity) parts.push('Last: '+g.last_activity);
      parts.push((g.topics? g.topics.length : 0) + ' topics');
      sub.innerHTML = escapeHtml(parts.filter(Boolean).join(' • '));
        li.addEventListener('click', ()=>{ location.hash = g._hashId; showDetail(g); });
      listEl.appendChild(node);
  } }

  // Create a list item DOM node for a topic match
  function createTopicListItem(group, topic, groupIdx, topicIdx, q){
    const node = liTpl.cloneNode(true);
    const li = node.querySelector('li'); const img = node.querySelector('.thumb'); const title = node.querySelector('.title'); const sub = node.querySelector('.sub');
    img.src = chooseGroupImage(group);
    li.dataset.hashId = group._hashId;
    // title shows group → topic
    const topicTitle = topic.title || '(no title)';
    title.innerHTML = `<strong>${escapeHtml(group.name||'Group')}</strong> → ${escapeHtml(topicTitle)}`;
    const metaParts = [];
    if(topic.started_by) metaParts.push(topic.started_by);
    if(topic.replies!==undefined) metaParts.push((topic.replies||0) + ' replies');
    if(topic.last_post_text) metaParts.push(topic.last_post_text);
    sub.innerHTML = escapeHtml(metaParts.filter(Boolean).join(' • '));
    // clicking a topic should open the topic page directly and pass the query for highlighting
    li.addEventListener('click', ()=>{ const qp = q ? '&q=' + encodeURIComponent(q) : ''; location.href = `topic.html?groupIdx=${groupIdx}&topicIdx=${topicIdx}${qp}`; });
    return node;
  }

  function matchQuery(g, q){ if(!q) return true; return g._search.indexOf(q)!==-1; }

  function renderSearchResults(q){
    listEl.innerHTML = '';
    // Groups where name or description match
    const groupsByName = groups.filter(g=>{
      const name = (g.name||'').toLowerCase();
      const desc = (g.description||g.header_text||'').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
    // Topics where title or messages match
    const topicMatches = [];
    groups.forEach((g,gi)=>{
      const topics = g.topics || [];
      topics.forEach((t,ti)=>{
        const title = (t.title||'').toLowerCase();
        if(title.includes(q)) { topicMatches.push({group:g,groupIdx:gi,topic:t,topicIdx:ti}); return; }
        // check messages array for match
        if(Array.isArray(t.messages)){
          for(const m of t.messages){
            const msg = (m.message||'').toLowerCase(); if(msg.includes(q)){ topicMatches.push({group:g,groupIdx:gi,topic:t,topicIdx:ti}); break; }
          }
        }
      });
    });

    // render groups header + items
    if(groupsByName.length){ const h = document.createElement('div'); h.style.fontSize='13px'; h.style.fontWeight='600'; h.style.margin='6px 8px'; h.textContent = `Groups matching name/description (${groupsByName.length})`; listEl.appendChild(h); }
    for(const g of groupsByName){ const node = liTpl.cloneNode(true); const li = node.querySelector('li'); const img = node.querySelector('.thumb'); const title = node.querySelector('.title'); const sub = node.querySelector('.sub'); img.src = chooseGroupImage(g); title.innerHTML = `<strong>${escapeHtml(g.name||'Untitled')}</strong>`; const parts = []; if(g.members) parts.push((g.members+' members')); if(g.privacy) parts.push(g.privacy); if(g.last_activity) parts.push('Last: '+g.last_activity); parts.push((g.topics? g.topics.length : 0) + ' topics'); sub.innerHTML = escapeHtml(parts.filter(Boolean).join(' • ')); li.addEventListener('click', ()=>{ location.hash = g._hashId; showDetail(g); }); listEl.appendChild(node); }

    // render topic matches
    if(topicMatches.length){ const h2 = document.createElement('div'); h2.style.fontSize='13px'; h2.style.fontWeight='600'; h2.style.margin='10px 8px 6px'; h2.textContent = `Topics matching query (${topicMatches.length})`; listEl.appendChild(h2); }
    for(const item of topicMatches){ const node = createTopicListItem(item.group, item.topic, item.groupIdx, item.topicIdx, q); listEl.appendChild(node); }

    resultsCount.textContent = `${groupsByName.length} groups, ${topicMatches.length} topics`;
    // show first matching group's detail if any, otherwise show first group
    if(groupsByName.length) showDetail(groupsByName[0]); else if(groups.length) showDetail(groups[0]);
  }

  function doSearch(){ const q = (searchInput.value||'').trim().toLowerCase(); if(!q){ renderList(groups); if(groups.length) showDetail(groups[0]); return; } renderSearchResults(q); }

  async function showDetail(g){ const q = (searchInput.value||'').trim(); el('#detailName').textContent = g.name || 'Group'; const meta = []; if(g.members) meta.push(g.members + ' members'); if(g.privacy) meta.push(g.privacy); if(g.last_activity) meta.push('Last activity: ' + g.last_activity); meta.push((g.topics? g.topics.length : 0) + ' topics'); el('#detailMeta').textContent = meta.join(' • ');
    // image + header: banner + avatar
    const headerWrap = el('#groupImage'); headerWrap.innerHTML = '';
    const bannerUrl = resolveImgUrl(g.header) || '';
    const avatarUrl = resolveImgUrl(g.img || g.image || g.avatar) || bannerUrl || (PROJECT_BASE + 'images/group.png');
    const banner = document.createElement('img'); banner.className = 'banner-img'; banner.src = bannerUrl || (PROJECT_BASE + 'images/group-header.png');
    const avatar = document.createElement('img'); avatar.className = 'thumb-large'; avatar.src = avatarUrl;
    headerWrap.appendChild(banner);
    headerWrap.appendChild(avatar);
    el('#groupHeader').innerHTML = g.description_html || g.description || g.header_text || g.header_html || '';
    // group info fields
    const info = el('#groupInfo'); info.innerHTML = '';
    const infoHtml = `<div><strong>Visibility:</strong> ${escapeHtml(g.privacy||g.status||'unknown')}</div><div><strong>Members:</strong> ${escapeHtml(String(g.members||''))}</div><div><strong>Last activity:</strong> ${escapeHtml(g.last_activity||'')}</div>`;
    info.innerHTML = infoHtml;
    // topics
    const topicsWrap = el('#topics'); topicsWrap.innerHTML = '';
    const topics = (g.topics||[]);
    topics.forEach((t,ti)=>{
      const d = document.createElement('div'); d.className='topic-item';
      const a = document.createElement('a'); a.href = `topic.html?groupIdx=${g._idx}&topicIdx=${ti}`; a.target = '_self'; a.textContent = t.title || '(no title)';
      d.appendChild(a);
      const meta = document.createElement('div'); meta.className='meta-line'; meta.textContent = `${t.started_by || ''} • ${t.replies||0} replies • ${t.last_post_text || ''}`;
      d.appendChild(meta);
      topicsWrap.appendChild(d);
    });
    // Members: find profiles that reference this group
    const membersWrap = el('#groupMembers'); if(membersWrap){ membersWrap.innerHTML = ''; const profiles = await loadProfiles(); if(profiles.length){ const gName = (g.name||'').toString(); const gSlug = slugifyName(gName);
        const matches = [];
        for(let i=0;i<profiles.length;i++){
          const p = profiles[i]; if(!p) continue;
          const groupsField = p.groups || p.group || p.memberships || [];
          let found = false;
          if(typeof groupsField === 'string'){ if(slugifyName(groupsField) === gSlug) found = true; }
          else if(Array.isArray(groupsField)){
            for(const gi of groupsField){
              let cand = '';
              if(typeof gi === 'string') cand = gi;
              else if(gi && (gi.name||gi.title||gi.text)) cand = gi.name||gi.title||gi.text;
              if(cand && slugifyName(cand) === gSlug){ found = true; break; }
            }
          } else if(typeof groupsField === 'object'){
            const cand = groupsField.name || groupsField.title || groupsField.text || '';
            if(cand && slugifyName(cand) === gSlug) found = true;
          }
          if(found) matches.push({p,i});
          if(matches.length >= 200) break; // avoid huge lists
        }
        if(matches.length===0){ membersWrap.innerHTML = '<div style="color:var(--muted);font-size:13px">No members found in profiles.json.</div>'; }
        else {
          const list = document.createElement('div'); list.style.display='flex'; list.style.flexWrap='wrap'; list.style.gap='8px';
          matches.forEach(({p,i})=>{
            const name = p.display_name || p.name || p.username || p.handle || ('profile ' + (i+1));
            const slug = makeProfileSlug(p,i);
            const a = document.createElement('a'); a.href = 'profiles.html#' + encodeURIComponent(slug); a.textContent = name; a.className = 'group-pill'; a.style.display='inline-block'; a.style.margin='2px';
            list.appendChild(a);
          });
          membersWrap.appendChild(list);
        }
      } else { membersWrap.innerHTML = '<div style="color:var(--muted);font-size:13px">No profiles.json found or it is empty.</div>'; } }
    // highlight selected in list
    const prev = listEl.querySelector('.selected'); if(prev) prev.classList.remove('selected'); try{ const esc = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(g._hashId) : g._hashId; const node = listEl.querySelector(`li[data-hash-id="${esc}"]`); if(node) node.classList.add('selected'); }catch(e){}
  }

  // initialize
  renderList(groups);
  searchInput.addEventListener('input', ()=> doSearch()); clearBtn.addEventListener('click', ()=>{ searchInput.value=''; doSearch(); });
  // if a query param was provided, restore it and run the search so user returns to same state
  if(initialQ && searchInput){ searchInput.value = initialQ; doSearch(); }

  // open from hash if present (use group name hash)
  window.addEventListener('hashchange', ()=>{ const cur = (location.hash||'').replace(/^#/,''); if(!cur) return; const target = groups.find(g=> g._hashId === decodeURIComponent(cur)); if(target) showDetail(target); });
  (function openFromHash(){ const cur = (location.hash||'').replace(/^#/,''); if(cur){ const target = groups.find(g=> g._hashId === decodeURIComponent(cur)); if(target){ showDetail(target); return; } }
    if(groups.length) showDetail(groups[0]); })();

})();
