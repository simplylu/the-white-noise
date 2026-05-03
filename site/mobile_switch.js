// mobile_switch.js — redirect between desktop and mobile_* pages based on viewport/UA
(function(){
  try{
    const isMobileView = (()=>{
      try{ if(window.matchMedia) return window.matchMedia('(max-width:720px)').matches; }catch(e){}
      try{ return /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent); }catch(e){}
      return false;
    })();

    const parts = location.pathname.split('/');
    const fname = parts.pop() || 'index.html';
    const dir = parts.join('/') + (parts.length? '/': '');

    function mobileName(n){ return 'mobile_' + n; }

    // If on a mobile_ page but viewport is large, go to desktop page
    if(fname.startsWith('mobile_')){
      if(!isMobileView){
        const desktop = fname.replace(/^mobile_/, '');
        const target = dir + desktop + location.search + location.hash;
        if(target !== location.href) location.replace(target);
      }
      return;
    }

    // If on desktop page and small/mobile device, try to redirect to mobile counterpart
    if(isMobileView){
      const m = mobileName(fname);
      const mobileRel = dir + m;
      // verify existence before redirecting (HEAD request)
      try{
        fetch(mobileRel, {method:'HEAD', cache:'no-store'}).then(r=>{
          if(r.ok){ const target = mobileRel + location.search + location.hash; if(target !== location.href) location.replace(target); }
        }).catch(()=>{
          // try without dir (fallback)
          fetch(m, {method:'HEAD', cache:'no-store'}).then(r2=>{ if(r2.ok){ const t2 = (dir?dir:'') + m + location.search + location.hash; if(t2 !== location.href) location.replace(t2); } }).catch(()=>{});
        });
      }catch(e){}
    }
  }catch(e){}
})();

