/* ============================================================================
   UV99 QR — shared i18n / geolocation / language-control module.
   Used by BOTH experiences:
     • /QR              (base "/QR")            — regional pages ready
     • /uv99+1/QR       (base "/uv99+1/QR")     — regional pages ready
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
     Marathi is a MANUAL selection only on /QR — it is never auto-selected by
     GPS. /uv99+1/QR has no Marathi at all (not even manual).
   • Priority:  explicit language URL  →  previously selected language
                →  first-visit geolocation  →  English.
     Geolocation runs once per browser session, and only when the visitor
     has no stored manual choice. It never re-prompts on refresh.
   • BOTH /QR and /uv99+1/QR run real geo-fencing on their base URL
     (re-enabled 2026-09-12): each independently calls
     navigator.geolocation.getCurrentPosition() as soon as the script runs —
     no button, no custom permission UI, the browser's own native prompt is
     the only thing the visitor ever sees. On success it redirects
     (location.replace) to the matching regional URL when the detected state
     is mapped; otherwise (Maharashtra, any other state, outside India,
     denied, timed out, or a reverse-geocode failure) it stays on the base
     URL in English — the page is never blocked or hidden while this runs.
     A regional URL visited directly never redirects and never re-asks.
     Every step of the detection/decision is logged to the console with a
     "[UV99 QR geo]" / "[UV99+1 QR geo]" prefix.
   • Maharashtra currently maps to English on both experiences — there is no
     Marathi page yet for either /QR or /uv99+1/QR (this is a deliberate,
     temporary choice pending that translation being written; Marathi is
     otherwise still offered as a manual-only pick on plain /QR).
   • When a state is actually detected (success — never on denial/failure/
     timeout), a small "Detected Location: <State>" pill appears fixed to
     the bottom-right of the page, regardless of whether the state changed
     the language.
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
  var NAMES = IS_P1
    ? { en:'English', hindi:'हिंदी', kannada:'ಕನ್ನಡ',
        odia:'ଓଡ଼ିଆ', telugu:'తెలుగు', tamil:'தமிழ்', malayalam:'മലയാളം' }
    : { en:'English', hindi:'हिंदी', marathi:'मराठी', kannada:'ಕನ್ನಡ',
        odia:'ଓଡ଼ିଆ', telugu:'తెలుగు', tamil:'தமிழ்', malayalam:'മലയാളം' };
  var LATIN = IS_P1
    ? { en:'English', hindi:'Hindi', kannada:'Kannada',
        odia:'Odia', telugu:'Telugu', tamil:'Tamil', malayalam:'Malayalam' }
    : { en:'English', hindi:'Hindi', marathi:'Marathi', kannada:'Kannada',
        odia:'Odia', telugu:'Telugu', tamil:'Tamil', malayalam:'Malayalam' };

  /* State → language. Maharashtra and Marathi are deliberately absent so both
     resolve to English via the default. Identical for both experiences —
     /uv99+1/QR simply has no Marathi page to ever route to regardless. */
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
     page for now) but are never chosen automatically by GPS.
     /uv99+1/QR: all six regional pages are live, no Marathi at all.
     /QR: unchanged — six live, Marathi manual-only (never ready). */
  var REGIONAL_READY = IS_P1
    ? { hindi:true, kannada:true, odia:true, telugu:true, tamil:true, malayalam:true }
    : { hindi:true, marathi:false, kannada:true, odia:true, telugu:true, tamil:true, malayalam:true };

  /* Real URL for each language. English is the base URL. Regional URLs that
     have no page yet are still real routes — the server serves the English
     document there until the translation ships. */
  var URLS = (function () {
    var root = IS_P1 ? '/uv99+1/QR' : '/QR/';
    var sub  = IS_P1 ? '/uv99+1/QR/' : '/QR/';
    var u = { en: root };
    var langs = IS_P1
      ? ['hindi','kannada','odia','telugu','tamil','malayalam']
      : ['hindi','marathi','kannada','odia','telugu','tamil','malayalam'];
    langs.forEach(function (l) {
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

  /* ========================================================================
     1. REDIRECT / GEOLOCATION  (re-enabled on both experiences, 2026-09-12)
        Opening the bare base URL (/QR or /uv99+1/QR) calls
        navigator.geolocation.getCurrentPosition() immediately — no button,
        no custom UI, just the browser's own native permission prompt — and
        on success location.replace()s to the matching regional URL when the
        detected state is one of the seven mapped states; otherwise
        (Maharashtra, any other state, outside India, denied, timeout, or a
        reverse-geocode failure) it stays on the base URL in English. A
        previously detected/selected language is remembered (localStorage)
        and wins over a fresh GPS check on later visits. Priority order:
        explicit URL → stored choice → first-visit geolocation → English.
        Visiting a regional URL directly (e.g. /QR/tamil, /uv99+1/QR/tamil)
        never redirects and never re-asks — that IS the choice. Every step
        is logged with the "[UV99 QR geo]" / "[UV99+1 QR geo]" prefix so the
        decision is fully inspectable in DevTools.
     ======================================================================== */
  var LOG_PREFIX = IS_P1 ? '[UV99+1 QR geo]' : '[UV99 QR geo]';
  function glog(){
    try { console.log.apply(console, [LOG_PREFIX].concat(Array.prototype.slice.call(arguments))); } catch (e) {}
  }
  function go(lang, reason){
    glog('redirecting to', URLS[lang], '— reason:', reason);
    if (URLS[lang]) location.replace(URLS[lang]);
  }

  /* ---- "Detected Location: <State>" pill ------------------------------------
     Shown only when geolocation actually succeeded this session (never on
     denial/failure/timeout, never a guessed/default value) — bottom-right,
     safe-area aware, out of the way of buttons/content on mobile. Shown
     regardless of whether the state changed the language (e.g. Maharashtra
     still shows "Detected Location: Maharashtra" even though it stays
     English), so a visitor can see detection genuinely ran. */
  function locatedLabel(){
    return ({
      hindi:'पहचाना गया स्थान', marathi:'ओळखलेले स्थान', kannada:'ಪತ್ತೆಯಾದ ಸ್ಥಳ',
      odia:'ଚିହ୍ନଟ ହୋଇଥିବା ସ୍ଥାନ', telugu:'గుర్తించిన ప్రాంతం', tamil:'கண்டறியப்பட்ட இடம்',
      malayalam:'കണ്ടെത്തിയ സ്ഥലം'
    }[LANG]) || 'Detected Location';
  }
  function renderLocationBadge(state){
    if (!state) return;
    function paint(){
      if (document.querySelector('.qr-loc-badge')) return; // already shown
      var pill = document.createElement('div');
      pill.className = 'qr-loc qr-loc-badge is-visible';
      pill.style.cssText =
        'position:fixed;z-index:139;bottom:calc(10px + env(safe-area-inset-bottom,0px));right:10px;';
      pill.innerHTML =
        '<span class="qr-loc__dot" aria-hidden="true"></span>' +
        '<span class="qr-loc__txt">' + locatedLabel() + ': ' + state + '</span>';
      document.body.appendChild(pill);
    }
    if (document.body) paint();
    else document.addEventListener('DOMContentLoaded', paint);
  }

  function redirect(){
    var storedLang  = lsGet(K_LANG);
    var storedState = ssGet(K_STATE);
    glog('pathname=' + location.pathname, 'urlLang=' + LANG, 'storedLang=' + (storedLang || '(none)'), 'storedState=' + (storedState || '(none)'));

    if (LANG !== 'en') {
      /* On an explicit regional URL: that IS the choice — persist it so a
         refresh keeps it and GPS never overrides it. This never redirects —
         the correct page is already being shown. */
      lsSet(K_LANG, LANG);
      glog('explicit regional URL — no redirect needed, persisted choice=' + LANG);
      return;
    }

    /* From here on we are on a bare base URL (/QR or /uv99+1/QR). */

    if (/[?&]stay\b/i.test(location.search)) {
      ssSet(K_GEO, 'en');
      glog('?stay present — geolocation skipped, staying on', location.pathname);
      return;
    }

    /* By strict requirement, a previously stored language choice must NEVER
       redirect the bare base URL — only a fresh, successful geolocation
       result may do that. storedLang above is logged for visibility only;
       it is deliberately not read again past this point. The "Translate"
       control (when enabled) is the only thing a stored choice ever
       affects — pre-selecting its menu, never navigating anything itself. */

    /* Test escape hatch: /QR/?forcegeo (or /uv99+1/QR/?forcegeo) clears this
       session's cached geo result before the check below, so you can force
       a fresh navigator.geolocation.getCurrentPosition() call — and a fresh
       native permission prompt if the browser's permission state allows a
       re-prompt — without hand-editing storage in DevTools every time. */
    if (/[?&]forcegeo\b/i.test(location.search)) {
      console.log('[QR GEO] ?forcegeo present — clearing this session\'s cached geo result');
      try { sessionStorage.removeItem(K_GEO); sessionStorage.removeItem(K_STATE); } catch (e) {}
    }

    if (ssGet(K_GEO)) {
      console.log('[QR GEO] SKIPPED — a geo result is already cached for this browser session (sessionStorage["' + K_GEO + '"] = "' + ssGet(K_GEO) + '"). ' +
        'This is why the native permission prompt does not appear again on reload — it already ran once this session. ' +
        'To force it again: reload with "?forcegeo" appended to the URL, or run sessionStorage.removeItem("' + K_GEO + '") in the console and reload.');
      glog('geolocation already attempted this session — not re-running, staying on', location.pathname);
      return;
    }
    if (!('geolocation' in navigator) || window.isSecureContext === false) {
      console.log('[QR GEO] SKIPPED — geolocation unavailable (in navigator: ' + ('geolocation' in navigator) + ', secure context: ' + window.isSecureContext + ')');
      ssSet(K_GEO, 'en');
      glog('geolocation unavailable/insecure context — staying English on', location.pathname);
      return;
    }

    var settled = false;
    function settle(reason){
      if (settled) return;
      settled = true;
      ssSet(K_GEO, 'en');
      glog('final decision: English (no redirect) — reason:', reason, '— URL stays', location.pathname);
    }
    var cap = setTimeout(function(){ settle('timeout waiting for position'); }, 12000);

    /* Diagnostic only — logs the browser's current permission state before
       asking, when the Permissions API is available. Does not gate or skip
       the actual getCurrentPosition() call below either way. */
    try {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(function (status) {
          console.log('[QR GEO] navigator.permissions state for geolocation:', status.state); // 'granted' | 'denied' | 'prompt'
        }).catch(function (e) { console.log('[QR GEO] permissions.query failed:', e && e.message); });
      } else {
        console.log('[QR GEO] navigator.permissions API not available in this browser');
      }
    } catch (e) {}

    console.log('[QR GEO] requesting browser location');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      console.log('[QR GEO] success — lat=' + lat + ' lon=' + lon + ' accuracy=' + pos.coords.accuracy);
      glog('geolocation resolved: lat=' + lat + ' lon=' + lon);
      var api = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' +
                encodeURIComponent(lat) + '&longitude=' +
                encodeURIComponent(lon) + '&localityLanguage=en';
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var fc = setTimeout(function(){ if (ctrl) ctrl.abort(); clearTimeout(cap); settle('reverse-geocode request timed out'); }, 6000);
      fetch(api, ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (r){ return r.json(); })
        .then(function (d){
          clearTimeout(fc); clearTimeout(cap);
          if (settled) return;
          var cc    = (d && d.countryCode ? String(d.countryCode) : '').trim().toUpperCase();
          var state = (d && d.principalSubdivision ? String(d.principalSubdivision) : '').trim();
          var mapped = (cc === 'IN') ? (STATE_LANG[state.toLowerCase()] || 'en') : 'en';
          /* A language is only ever a candidate if its page actually exists
             (REGIONAL_READY) — there is no hardcoded fallback language here;
             anything not explicitly mapped and ready resolves to 'en'. */
          var lang = (mapped !== 'en' && REGIONAL_READY[mapped]) ? mapped : 'en';
          glog('country=' + (cc || '(none)'), 'detectedState=' + (state || '(none)'), 'mappedLang=' + mapped, 'finalLang=' + lang);
          settled = true;
          ssSet(K_GEO, lang);
          if (state) { ssSet(K_STATE, state); renderLocationBadge(state); }
          if (lang === 'en') {
            glog('final decision: English (no redirect) — state not mapped or page not ready — URL stays', location.pathname);
            return;
          }
          lsSet(K_LANG, lang);
          go(lang, 'first-visit geolocation matched ' + state);
        })
        .catch(function (){ clearTimeout(fc); clearTimeout(cap); settle('reverse-geocode request failed'); });
    }, function (err){
      clearTimeout(cap);
      /* err.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT */
      console.log('[QR GEO] error — code=' + (err && err.code) + ' message=' + (err && err.message));
      settle('geolocation error/denied: code=' + (err && err.code) + ' ' + (err && err.message ? err.message : String(err)));
    }, { enableHighAccuracy:true, timeout:10000, maximumAge:0 });
  }
  redirect();

  /* Covers page loads where redirect() above didn't run a fresh geolocation
     check this call (an explicit regional URL reached via redirect, or a
     repeat visit that already resolved this session) but a real detected
     state is already on record for this session — the badge should still
     show rather than only appearing on the exact call that detected it. */
  renderLocationBadge(ssGet(K_STATE));

  /* ========================================================================
     2. "Translate" CONTROL  — small premium pill, top of page, mobile + desktop.
        Routes to the real language pages; no machine translation.
     ======================================================================== */
  function buildControl(){
    if (document.querySelector('.qrtx')) return;

    var style = document.createElement('style');
    style.textContent = [
      '.qrtx{position:fixed;z-index:140;top:64px;right:14px;font-family:"JetBrains Mono",ui-monospace,monospace;}',
      '@media (max-width:560px){.qrtx{top:calc(8px + env(safe-area-inset-top,0px));right:10px;}}',
      '.qrtx__btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;',
        'background:rgba(16,9,24,0.82);color:#fff;border:1px solid rgba(226,180,255,0.30);',
        'border-radius:20px;padding:7px 13px;font:inherit;font-size:11px;letter-spacing:0.06em;',
        'line-height:1;text-transform:uppercase;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
        'box-shadow:0 10px 30px -12px rgba(0,0,0,0.6);transition:border-color .18s ease, background .18s ease;}',
      '.qrtx__btn:hover{border-color:rgba(226,180,255,0.5);}',
      '.qrtx__btn:focus-visible{outline:2px solid #E14FFF;outline-offset:2px;}',
      '.qrtx__icon{font-size:12px;line-height:1;opacity:0.85;filter:grayscale(1) brightness(1.6);}',
      '.qrtx__btn svg{width:9px;height:6px;transition:transform .2s cubic-bezier(.16,1,.3,1);flex:none;}',
      '.qrtx.is-open .qrtx__btn svg{transform:rotate(180deg);}',
      '.qrtx__menu{position:absolute;top:calc(100% + 8px);right:0;min-width:176px;',
        'background:rgba(16,9,24,0.94);border:1px solid rgba(226,180,255,0.26);border-radius:14px;',
        'padding:6px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);',
        'box-shadow:0 24px 60px -20px rgba(0,0,0,0.7);',
        'opacity:0;visibility:hidden;transform:translateY(-6px) scale(.97);transform-origin:top right;',
        'transition:opacity .16s ease, transform .2s cubic-bezier(.16,1,.3,1), visibility .16s;}',
      '@media (max-width:560px){.qrtx__menu{right:0;transform-origin:top right;}}',
      '.qrtx.is-open .qrtx__menu{opacity:1;visibility:visible;transform:translateY(0) scale(1);}',
      '.qrtx__head{padding:7px 10px 8px;margin-bottom:2px;border-bottom:1px solid rgba(226,180,255,0.14);',
        'color:rgba(235,214,255,0.5);font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;}',
      '.qrtx__opt{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;cursor:pointer;',
        'background:transparent;border:0;border-radius:9px;padding:9px 10px;color:#EBD6FF;',
        'font:inherit;font-size:12px;letter-spacing:0.02em;transition:background .15s ease;}',
      '.qrtx__opt:hover{background:rgba(226,180,255,0.12);color:#fff;}',
      '.qrtx__opt[aria-current="true"]{background:rgba(226,180,255,0.16);color:#fff;font-weight:700;cursor:default;}',
      '.qrtx__opt[aria-current="true"]:hover{background:rgba(226,180,255,0.16);}',
      '.qrtx__opt[aria-current="true"]::after{content:"\\2713";margin-left:auto;padding-left:6px;color:#E14FFF;font-weight:700;}',
      '.qrtx__opt small{color:rgba(235,214,255,0.55);font-size:10px;letter-spacing:0.04em;text-transform:uppercase;}',
      '.qrtx__flag{font-size:13px;line-height:1;flex:none;}',
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
    btn.innerHTML = '<span class="qrtx__icon" aria-hidden="true">🌐</span><span>Translate</span>' +
      '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="#E2B4FF" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var menu = document.createElement('div');
    menu.className = 'qrtx__menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-hidden', 'true');

    var head = document.createElement('div');
    head.className = 'qrtx__head';
    head.textContent = 'Translate';
    menu.appendChild(head);

    var FLAGS = { en: '🇬🇧', hindi: '🇮🇳' };

    /* Only the two "useful" languages are ever offered, always both,
       Hindi on top / English below — the current page's language is kept
       in the list (marked current + non-clickable) rather than hidden, so
       the control always shows exactly 2 rows. */
    var order = ['hindi', 'en'];
    order.forEach(function (l) {
      if (!NAMES[l]) return;
      var isCurrent = (l === LANG);
      var o = document.createElement('button');
      o.type = 'button';
      o.className = 'qrtx__opt';
      o.setAttribute('role', 'menuitem');
      if (isCurrent) { o.setAttribute('aria-current', 'true'); o.disabled = true; }
      o.innerHTML = '<span class="qrtx__flag" aria-hidden="true">' + (FLAGS[l] || '') + '</span><span>' + NAMES[l] + '</span>' +
                    (l === 'en' ? '' : '<small>' + LATIN[l] + '</small>');
      o.addEventListener('click', function () {
        close();
        if (isCurrent) return;
        lsSet(K_LANG, l);
        if (URLS[l]) location.href = URLS[l];
      });
      menu.appendChild(o);
    });

    var isOpen = false;
    function open(){ isOpen = true; wrap.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); menu.setAttribute('aria-hidden', 'false'); }
    function close(){ isOpen = false; wrap.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-hidden', 'true'); }
    function toggle(){ isOpen ? close() : open(); }

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

  /* The on-page "Translate" control (§2) — small premium pill offering
     English + Hindi, routing to the real language pages for both /QR and
     /uv99+1/QR. Deferred to DOMContentLoaded since this script normally
     loads in <head>, before document.body exists. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildControl);
  } else {
    buildControl();
  }
})();
