/* ============================================================================
   UV99 QR — shared i18n / geolocation / language-control module.
   Used by BOTH experiences:
     • /QR              (base "/QR")            — regional pages ready
     • /uv99+1/QR       (base "/uv99+1/QR")     — regional pages: coming soon
   One implementation, one behaviour. Each page declares only its own
   identity before loading this file:

     <script>window.__QR_I18N__ = { base:'/QR', lang:'en' };</script>
     <script src="/assets/js/qr-i18n.js"></script>

   Rules
   -----
   • Browser geolocation only (navigator.geolocation) — no IP guessing, no
     fake "Allow location" popup. The browser's own permission prompt is it.
   • State → language map (India only). Anything unmapped, any other state,
     any country, any failure  →  English.
       Madhya Pradesh   → Hindi        Tamil Nadu      → Tamil
       Karnataka        → Kannada      Kerala          → Malayalam
       Odisha / Orissa  → Odia         Maharashtra     → ENGLISH (never Marathi)
       Telangana        → Telugu       any other       → ENGLISH
       Andhra Pradesh   → Telugu       outside India   → ENGLISH
     Marathi is a MANUAL selection only — it is never auto-selected by GPS.
   • Priority:  explicit language URL  →  previously selected language
                →  first-visit geolocation  →  English.
     Geolocation runs once per browser session, and only when the visitor
     has no stored manual choice. It never re-prompts on refresh.
   • The "Translate" control routes to the real hand-written language pages.
     Google machine translation is never invoked — UV99 ships its own
     multilingual content.
   ============================================================================ */
(function () {
  'use strict';

  var CFG  = window.__QR_I18N__ || {};
  var BASE = CFG.base === '/uv99+1/QR' ? '/uv99+1/QR' : '/QR';
  var LANG = String(CFG.lang || 'en').toLowerCase();
  var IS_P1 = BASE === '/uv99+1/QR';

  /* ---- language tables ------------------------------------------------------ */
  /* Languages offered in the "Translate" control. Kept to English + Hindi by
     request; the current page's language is always prepended if it is not one
     of these (so a regional visitor can still switch back). */
  var ORDER = ['en', 'hindi'];
  var NAMES = {
    en:'English', hindi:'हिंदी', marathi:'मराठी', kannada:'ಕನ್ನಡ',
    odia:'ଓଡ଼ିଆ', telugu:'తెలుగు', tamil:'தமிழ்', malayalam:'മലയാളം'
  };
  var LATIN = {
    en:'English', hindi:'Hindi', marathi:'Marathi', kannada:'Kannada',
    odia:'Odia', telugu:'Telugu', tamil:'Tamil', malayalam:'Malayalam'
  };

  /* State → language. Maharashtra and Marathi are deliberately absent so both
     resolve to English via the default. */
  var STATE_LANG = {
    'madhya pradesh':'hindi',
    'karnataka':'kannada',
    'odisha':'odia', 'orissa':'odia',
    'telangana':'telugu', 'andhra pradesh':'telugu',
    'tamil nadu':'tamil',
    'kerala':'malayalam'
  };

  /* Which regional pages actually exist yet for this experience. Unready
     languages are still offered in the control (they route to the English
     page for now) but are never chosen automatically by GPS. */
  var REGIONAL_READY = IS_P1
    ? { hindi:false, marathi:false, kannada:false, odia:false, telugu:false, tamil:false, malayalam:false }
    : { hindi:true,  marathi:false, kannada:true,  odia:true,  telugu:true,  tamil:true,  malayalam:true };

  /* Real URL for each language. English is the base URL. Regional URLs that
     have no page yet are still real routes — the server serves the English
     document there until the translation ships. */
  var URLS = (function () {
    var root = IS_P1 ? '/uv99+1/QR' : '/QR/';
    var sub  = IS_P1 ? '/uv99+1/QR/' : '/QR/';
    var u = { en: root };
    ['hindi','marathi','kannada','odia','telugu','tamil','malayalam'].forEach(function (l) {
      u[l] = sub + l;
    });
    return u;
  })();

  /* ---- storage keys (independent per experience) -------------------------- */
  var NS       = IS_P1 ? 'uv99p1' : 'uv99';
  var K_LANG   = 'uv99_qr_lang_'  + NS;   // localStorage — durable manual choice
  var K_GEO    = 'uv99_qr_geo_'   + NS;   // sessionStorage — geolocation attempted
  var K_STATE  = 'uv99_qr_state_' + NS;   // sessionStorage — detected state label

  function lsGet(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k,v){ try { localStorage.setItem(k,v); } catch (e) {} }
  function ssGet(k){ try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k,v){ try { sessionStorage.setItem(k,v); } catch (e) {} }

  function go(lang){
    if (URLS[lang]) location.replace(URLS[lang]);
  }

  /* ========================================================================
     1. REDIRECT / GEOLOCATION  — runs immediately, English base pages only.
     ======================================================================== */
  (function redirect(){
    if (LANG !== 'en') {
      /* On an explicit regional URL: that IS the choice — persist it so a
         refresh keeps it and GPS never overrides it. */
      lsSet(K_LANG, LANG);
      return;
    }
    if (/[?&]stay\b/i.test(location.search)) { ssSet(K_GEO, 'en'); return; }

    var stored = lsGet(K_LANG);
    if (stored) {
      /* A previous manual choice wins over geolocation on every later visit. */
      if (stored !== 'en' && REGIONAL_READY[stored] && URLS[stored]) go(stored);
      return;                       // stored === 'en' (or not-ready): stay English, no GPS
    }

    if (ssGet(K_GEO)) return;       // already tried once this session — never re-prompt
    if (!('geolocation' in navigator) || window.isSecureContext === false) {
      ssSet(K_GEO, 'en'); return;
    }

    var settled = false;
    function english(){ if (!settled) { settled = true; ssSet(K_GEO, 'en'); } }
    var cap = setTimeout(english, 12000);

    navigator.geolocation.getCurrentPosition(function (pos) {
      var api = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' +
                encodeURIComponent(pos.coords.latitude) + '&longitude=' +
                encodeURIComponent(pos.coords.longitude) + '&localityLanguage=en';
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var fc = setTimeout(function(){ if (ctrl) ctrl.abort(); clearTimeout(cap); english(); }, 6000);
      fetch(api, ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (r){ return r.json(); })
        .then(function (d){
          clearTimeout(fc); clearTimeout(cap);
          if (settled) return;
          var cc    = (d && d.countryCode ? String(d.countryCode) : '').trim().toUpperCase();
          var state = (d && d.principalSubdivision ? String(d.principalSubdivision) : '').trim();
          var mapped = (cc === 'IN') ? (STATE_LANG[state.toLowerCase()] || 'en') : 'en';
          /* Only redirect to a language whose page is actually ready. */
          var lang = (mapped !== 'en' && REGIONAL_READY[mapped]) ? mapped : 'en';
          try { console.log('[UV99 QR geo] ' + (cc||'(none)') + ' / ' + (state||'(none)') + ' -> ' + lang); } catch (e) {}
          settled = true;
          ssSet(K_GEO, lang);
          if (state) ssSet(K_STATE, state);
          if (lang !== 'en') { lsSet(K_LANG, lang); go(lang); }
        })
        .catch(function (){ clearTimeout(fc); clearTimeout(cap); english(); });
    }, function (){
      clearTimeout(cap); english();
    }, { enableHighAccuracy:false, timeout:10000, maximumAge:600000 });
  })();

  /* ========================================================================
     2. "Translate" CONTROL  — small premium pill, top of page, mobile + desktop.
        Routes to the real language pages; no machine translation.
     ======================================================================== */
  function buildControl(){
    if (document.querySelector('.qrtx')) return;

    var style = document.createElement('style');
    style.textContent = [
      '.qrtx{position:fixed;z-index:140;top:64px;right:14px;font-family:"JetBrains Mono",ui-monospace,monospace;}',
      '@media (max-width:560px){.qrtx{top:calc(8px + env(safe-area-inset-top,0px));right:auto;left:50%;transform:translateX(-50%);}}',
      '.qrtx__btn{display:inline-flex;align-items:center;gap:7px;cursor:pointer;',
        'background:rgba(16,9,24,0.82);color:#fff;border:1px solid rgba(226,180,255,0.30);',
        'border-radius:20px;padding:7px 14px;font:inherit;font-size:11px;letter-spacing:0.06em;',
        'line-height:1;text-transform:uppercase;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
        'box-shadow:0 10px 30px -12px rgba(0,0,0,0.6);}',
      '.qrtx__btn:focus-visible{outline:2px solid #E14FFF;outline-offset:2px;}',
      '.qrtx__btn svg{width:9px;height:6px;transition:transform .18s ease;}',
      '.qrtx.is-open .qrtx__btn svg{transform:rotate(180deg);}',
      '.qrtx__menu{position:absolute;top:calc(100% + 8px);right:0;min-width:190px;',
        'background:rgba(16,9,24,0.94);border:1px solid rgba(226,180,255,0.26);border-radius:14px;',
        'padding:6px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);',
        'box-shadow:0 24px 60px -20px rgba(0,0,0,0.7);}',
      '@media (max-width:560px){.qrtx__menu{right:50%;transform:translateX(50%);}}',
      '.qrtx__opt{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;cursor:pointer;',
        'background:transparent;border:0;border-radius:9px;padding:9px 12px;color:#EBD6FF;',
        'font:inherit;font-size:12px;letter-spacing:0.02em;}',
      '.qrtx__opt:hover{background:rgba(226,180,255,0.12);color:#fff;}',
      '.qrtx__opt[aria-current="true"]{background:rgba(226,180,255,0.16);color:#fff;font-weight:700;}',
      '.qrtx__opt small{color:rgba(235,214,255,0.55);font-size:10px;letter-spacing:0.04em;text-transform:uppercase;}',
      '@media print{.qrtx{display:none;}}',
      '.qr-loc{display:inline-flex;align-items:center;gap:6px;max-width:72vw;',
        'background:rgba(16,9,24,0.82);color:#EBD6FF;border:1px solid rgba(226,180,255,0.24);',
        'border-radius:20px;padding:6px 12px;font-family:"JetBrains Mono",ui-monospace,monospace;',
        'font-size:9px;letter-spacing:0.06em;text-transform:uppercase;line-height:1.2;',
        '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 10px 30px -12px rgba(0,0,0,0.6);}',
      '.qr-loc__dot{width:5px;height:5px;border-radius:50%;flex:none;background:#E14FFF;box-shadow:0 0 8px 1px #E14FFF;}',
      '@media print{.qr-loc{display:none;}}'
    ].join('');
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'qrtx';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qrtx__btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span>Translate</span>' +
      '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="#E2B4FF" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var menu = document.createElement('div');
    menu.className = 'qrtx__menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    var order = [LANG].concat(ORDER.filter(function (l){ return l !== LANG; }));
    order.forEach(function (l) {
      if (!NAMES[l]) return;
      var o = document.createElement('button');
      o.type = 'button';
      o.className = 'qrtx__opt';
      o.setAttribute('role', 'menuitem');
      if (l === LANG) o.setAttribute('aria-current', 'true');
      o.innerHTML = '<span>' + NAMES[l] + '</span>' +
                    (l === 'en' ? '' : '<small>' + LATIN[l] + '</small>');
      o.addEventListener('click', function () {
        close();
        if (l === LANG) return;
        lsSet(K_LANG, l);
        if (URLS[l]) location.href = URLS[l];
      });
      menu.appendChild(o);
    });

    function open(){ wrap.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); menu.hidden = false; }
    function close(){ wrap.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); menu.hidden = true; }
    function toggle(){ menu.hidden ? open() : close(); }

    btn.addEventListener('click', function (e){ e.stopPropagation(); toggle(); });
    document.addEventListener('click', function (e){ if (!wrap.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e){ if (e.key === 'Escape') close(); });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    document.body.appendChild(wrap);

    /* Detected-location pill (only if GPS resolved an Indian state this
       session) — reuses the existing .qr-loc styling shipped in each page. */
    var st = ssGet(K_STATE);
    if (st) {
      var pill = document.createElement('div');
      pill.className = 'qr-loc is-visible';
      pill.style.cssText = 'position:fixed;z-index:139;bottom:calc(10px + env(safe-area-inset-bottom,0px));right:10px;';
      pill.innerHTML = '<span class="qr-loc__dot" aria-hidden="true"></span>' +
                       '<span class="qr-loc__txt">' + (LLOC()) + ': ' + st + '</span>';
      document.body.appendChild(pill);
    }
    function LLOC(){
      return ({ hindi:'पहचाना गया स्थान', marathi:'ओळखलेले स्थान', kannada:'ಪತ್ತೆಯಾದ ಸ್ಥಳ',
        odia:'ଚିହ୍ନଟ ହୋଇଥିବା ସ୍ଥାନ', telugu:'గుర్తించిన ప్రాంతం', tamil:'கண்டறியப்பட்ட இடம்',
        malayalam:'കണ്ടെത്തിയ സ്ഥലം' }[LANG]) || 'Detected location';
    }
  }

  /* ========================================================================
     3. GOOGLE-TRANSLATE → ENGLISH VIDEO FALLBACK
        Google Translate (browser feature) only rewrites HTML text — it can
        never translate a YouTube embed. So when a visitor machine-translates
        a regional QR page INTO English, the page reads English but the
        embedded videos are still the regional-language cuts.
        Fix: whenever Google Translate is active with English as the target,
        point every video on the page back at the English / default cut.
        This does nothing on the real English pages (their videos are already
        the defaults) and nothing when Translate is off or targeting another
        language — regional per-language video switching is a separate, later
        piece of work.
     ======================================================================== */
  (function englishVideoFallback(){
    /* English / default YouTube IDs, in the same order the videos appear on
       every QR page: 1) Problems  2) Solution  3) Series  4) UV99+1 demo. */
    var EN_VIDEOS = ['yDkafywKRus', 'iABkMOM-ETA', 'Cztjbxj07Lk', 'OhsYymfl7x4'];

    if (LANG === 'en') return;          // real English page — videos already correct

    function cookie(name){
      var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    }

    /* True only when the browser's Google Translate is showing this page in
       English. Covers Chrome's built-in full-page translate (adds
       translated-ltr/translated-rtl on <html>, sets a googtrans cookie
       "/src/dest") and the legacy Google Translate Element (.goog-te-*, same
       cookie). */
    function translatedToEnglish(){
      var de = document.documentElement;
      var translating =
        de.classList.contains('translated-ltr') ||
        de.classList.contains('translated-rtl') ||
        !!document.querySelector('.goog-te-combo, .skiptranslate, #goog-gt-tt') ||
        (de.getAttribute('lang') || '').toLowerCase().slice(0, 2) === 'en';
      if (!translating) return false;
      var g = cookie('googtrans') || cookie('_googtrans');
      if (g) return /\/en(?:-[a-z]+)?$/i.test(g.replace(/\/+$/, ''));
      /* No cookie (some builds): fall back to the <html lang> the translator
         stamps on. */
      return (de.getAttribute('lang') || '').toLowerCase().slice(0, 2) === 'en';
    }

    function embedSrc(id, prev){
      var q = prev && prev.indexOf('?') > -1 ? prev.slice(prev.indexOf('?')) : '';
      return 'https://www.youtube.com/embed/' + id + q;
    }

    function syncVideos(){
      if (!translatedToEnglish()) return;
      var ws = document.querySelectorAll('.video-wrapper[data-yt], [data-yt]');
      var i = 0;
      Array.prototype.forEach.call(ws, function (w) {
        if (!w.hasAttribute('data-yt')) return;
        var want = EN_VIDEOS[i++];
        if (!want || w.getAttribute('data-yt') === want) return;
        w.setAttribute('data-yt', want);
        var img = w.querySelector('img');
        if (img) img.src = 'https://i.ytimg.com/vi/' + want + '/hqdefault.jpg';
        var f = w.querySelector('iframe');
        if (f) f.src = embedSrc(want, f.getAttribute('src') || '');
      });
    }

    function boot(){
      syncVideos();
      /* Google Translate usually activates AFTER load, and can re-run when the
         visitor toggles languages — watch <html> for the class/lang flip and
         re-check a few times. */
      try {
        new MutationObserver(syncVideos).observe(document.documentElement, {
          attributes: true, attributeFilter: ['class', 'lang']
        });
      } catch (e) {}
      var n = 0, t = setInterval(function () { syncVideos(); if (++n > 20) clearInterval(t); }, 500);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  })();

  /* The on-page "Translate" pill is disabled by request. Geolocation-based
     language routing (§1) and the English-video fallback (§3) still run.
     Re-enable by restoring the buildControl() call below. */
  void buildControl;
})();
