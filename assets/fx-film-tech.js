/* ============================================================
   fx-film-tech.js — drives <section id="film-tech">
   ------------------------------------------------------------
   >>> PASTE YOUR REAL PUBLISHED FIGURES IN  FILM_TECH_CONFIG.films  <<<
   Nothing else in this file needs editing. Changing only the two
   temperature constants re-scales the whole section.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1 · SINGLE SOURCE OF TRUTH
     --------------------------------------------------------- */
  var FILM_TECH_CONFIG = {

    /* Cabin-temperature model — illustrative, NOT a lab claim.
       temperature = BASE_TEMPERATURE - heat * TEMPERATURE_FACTOR      */
    BASE_TEMPERATURE: 48,      // °C modelled behind bare glass
    TEMPERATURE_FACTOR: 0.2,   // °C removed per 1% of heat rejection

    /* Base scene photo. "" -> the built-in SVG windscreen is used.
       If you swap the photo: update the <svg viewBox> AND re-trace the
       #fx-windshield <polygon> in the section markup to the new image's
       natural pixel size (see the comment beside the polygon).        */
    sceneImage: 'assets/DEGREE.png',

    /* key -> product.  ORDER here = pill order.  First key = default.
       vlt  = visible light transmission %
       uv   = UV rejected %
       heat = total solar heat rejection %   (feeds the temperature model)
       ir   = infrared rejection %           (omit if not published;
                                              its spec row + tile then hide) */
    films: {
      film70: { label: '70',     vlt: 70, uv: 99,  heat: 30,         accent: '#8f4a9e', tag: 'Maximum clarity',         blurb: 'Clear protection that keeps the character of your factory glass.' },
      film50: { label: '-50',    vlt: 47, uv: 99,  heat: 35,         accent: '#8f4a9e', tag: 'Balanced protection',     blurb: 'More glare control while everyday visibility stays easy.' },
      pro70:  { label: 'PRO 70', vlt: 70, uv: 99,  heat: 42,         accent: '#d84f9a', tag: 'Clear heat comfort',      blurb: 'A clear appearance with meaningful heat relief for hot, bright drives.' },
      pro50:  { label: 'PRO 50', vlt: 51, uv: 99,  heat: 50,         accent: '#d84f9a', tag: 'Comfort + glare control', blurb: 'A cooler, calmer cabin with balanced daylight visibility.' },
      plus1:  { label: '+1',     vlt: 70, uv: 100, heat: 54, ir: 89, accent: '#e69418', tag: 'Advanced protection',     blurb: 'Full-band UV protection with the strongest cooling in the range.' }
    }
  };

  /* ---------------------------------------------------------
     2 · SETUP
     --------------------------------------------------------- */
  var root = document.getElementById('film-tech');
  if (!root) return;

  var C = FILM_TECH_CONFIG;
  var keys = Object.keys(C.films);
  if (!keys.length) return;

  var heatVals = keys.map(function (k) { return C.films[k].heat; });
  var minHeat = Math.min.apply(null, heatVals);
  var maxHeat = Math.max.apply(null, heatVals);

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var pills    = Array.prototype.slice.call(root.querySelectorAll('.fx-pill'));
  var pillBox  = root.querySelector('.fx-pills');
  var canvas   = root.querySelector('.fx-scene-canvas');
  var srLive   = root.querySelector('.fx-sr');
  var sparkPoly = root.querySelector('.fx-spark-line polyline');
  var sparkDot  = root.querySelector('.fx-spark-dot');

  var current = null;
  var firstReveal = true;
  var inView = false;

  /* ---------------------------------------------------------
     3 · MODEL  (one formula, one place)
     --------------------------------------------------------- */
  function tempFor(f)  { return C.BASE_TEMPERATURE - f.heat * C.TEMPERATURE_FACTOR; }
  function tintFor(f)  { return ((100 - f.vlt) / 100) * 0.42 + 0.06; }
  function blockFor(f) { return maxHeat === minHeat ? 0 : (f.heat - minHeat) / (maxHeat - minHeat); }
  function warmFor(t)  { return Math.min(Math.max((t - 36) / 6, 0), 1); }

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  /* ---------------------------------------------------------
     4 · COUNT-UP  (rAF, easeOutCubic, guarded per element)
     --------------------------------------------------------- */
  function tween(el, to, opts) {
    opts = opts || {};
    var dec = opts.dec || 0;
    var dur = opts.dur == null ? 900 : opts.dur;
    var from = opts.from == null ? (parseFloat(el.textContent) || 0) : opts.from;

    el._fxTok = (el._fxTok || 0) + 1;          // rapid re-selects supersede
    var tok = el._fxTok;

    if (mqReduce.matches || dur <= 0 || from === to) {
      el.textContent = to.toFixed(dec);
      return;
    }
    var t0 = performance.now();
    (function frame(now) {
      if (el._fxTok !== tok) return;
      var p = Math.min((now - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = (from + (to - from) * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = to.toFixed(dec);
    })(t0);
  }
  function tweenAll(sel, to, from, dec, dur) {
    var list = root.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) {
      tween(list[i], to, { from: from, dec: dec || 0, dur: dur });
    }
  }
  function setText(sel, txt) {
    var l = root.querySelectorAll(sel);
    for (var i = 0; i < l.length; i++) l[i].textContent = txt;
  }
  function setMeter(name, val) {
    var l = root.querySelectorAll('[data-fx-meter="' + name + '"]');
    for (var i = 0; i < l.length; i++) l[i].style.setProperty('--v', (val / 100).toFixed(3));
  }

  /* ---------------------------------------------------------
     5 · SPARKLINE  (derived from the same temperature model)
     --------------------------------------------------------- */
  var sparkPts = [];
  (function buildSpark() {
    if (!sparkPoly) return;
    var temps = keys.map(function (k) { return tempFor(C.films[k]); });
    var tMax = Math.max.apply(null, temps);
    var tMin = Math.min.apply(null, temps);
    var span = (tMax - tMin) || 1;
    var step = keys.length > 1 ? (88 / (keys.length - 1)) : 0;
    sparkPts = temps.map(function (t, i) {
      return [6 + i * step, 24 - ((t - tMin) / span) * 20];
    });
    sparkPoly.setAttribute('points', sparkPts.map(function (p) {
      return p[0].toFixed(1) + ',' + p[1].toFixed(1);
    }).join(' '));
  })();

  /* ---------------------------------------------------------
     6 · RENDER ONE FILM  (no re-mount, no image swap)
     --------------------------------------------------------- */
  function select(key, opt) {
    opt = opt || {};
    var f = C.films[key];
    if (!f) return;
    current = key;

    var t = tempFor(f);
    var fromZero = !!opt.fromZero;
    var user = !!opt.user;
    var base = fromZero ? 0 : null;

    /* --- state custom properties: CSS renders the visuals --- */
    root.style.setProperty('--fx-accent', f.accent);
    root.style.setProperty('--fx-accent-rgb', hexToRgb(f.accent));
    root.style.setProperty('--fx-heat', (f.heat / 100).toFixed(3));
    root.style.setProperty('--fx-block', blockFor(f).toFixed(3));
    root.style.setProperty('--fx-tint-a', tintFor(f).toFixed(3));
    root.style.setProperty('--fx-warm', warmFor(t).toFixed(3));

    /* --- pills --- */
    pills.forEach(function (p) {
      var on = p.dataset.film === key;
      p.setAttribute('aria-pressed', on ? 'true' : 'false');
      p.classList.toggle('is-active', on);
    });

    /* --- product card copy --- */
    setText('[data-fx="label"]', f.label);
    setText('[data-fx="tag"]', f.tag);
    setText('[data-fx="blurb"]', f.blurb);

    /* --- infrared spec row + stat tile --- */
    var hasIr = typeof f.ir === 'number';
    root.classList.toggle('has-ir', hasIr);
    var irEls = root.querySelectorAll('[data-fx-ir]');
    for (var i = 0; i < irEls.length; i++) irEls[i].hidden = !hasIr;

    /* --- numbers --- */
    var dur = mqReduce.matches ? 0 : 900;
    tweenAll('[data-fx-count="vlt"]',  f.vlt,  base, 0, dur);
    tweenAll('[data-fx-count="uv"]',   f.uv,   base, 0, dur);
    tweenAll('[data-fx-count="heat"]', f.heat, base, 0, dur);
    if (hasIr) tweenAll('[data-fx-count="ir"]', f.ir, base, 0, dur);
    tweenAll('[data-fx-temp]', t, fromZero ? 0 : null, 1, mqReduce.matches ? 0 : 1000);

    /* --- meter bars (transform: scaleX via --v) --- */
    setMeter('heat', f.heat);
    setMeter('uv', f.uv);
    setMeter('vlt', f.vlt);
    if (hasIr) setMeter('ir', f.ir);

    /* --- sparkline dot --- */
    if (sparkDot && sparkPts.length) {
      var pt = sparkPts[keys.indexOf(key)] || sparkPts[0];
      sparkDot.setAttribute('cx', pt[0].toFixed(1));
      sparkDot.setAttribute('cy', pt[1].toFixed(1));
    }

    /* --- replay scene; never stacks (remove / reflow / re-add) --- */
    root.classList.remove('is-live');
    void root.offsetWidth;
    root.classList.add('is-live');
    if (user && !mqReduce.matches) {
      root.classList.remove('is-scanning');
      void root.offsetWidth;
      root.classList.add('is-scanning');
    }

    /* --- a11y: running sentence + scene label --- */
    var irPart = hasIr ? (', ' + f.ir + '% infrared rejection') : '';
    if (srLive) {
      srLive.textContent = f.label + ': ' + f.uv + '% UV blocked, ' + f.heat +
        '% heat rejected' + irPart + ', ' + f.vlt + '% visible light. ' +
        'Modelled cabin temperature ' + t.toFixed(1) + ' °C.';
    }
    if (canvas) {
      canvas.setAttribute('aria-label',
        'Windscreen visualization for the ' + f.label + ' film. Warm heat rays and ' +
        'violet UV rays weaken and reflect away at the glass; modelled cabin ' +
        'temperature ' + t.toFixed(1) + ' degrees Celsius.');
    }
  }

  /* ---------------------------------------------------------
     7 · SELECTOR INTERACTION  (mouse + full keyboard)
     --------------------------------------------------------- */
  function pick(k, focus) {
    select(k, { user: true });
    if (focus) {
      for (var i = 0; i < pills.length; i++) {
        if (pills[i].dataset.film === k) { pills[i].focus(); break; }
      }
    }
  }
  function move(delta) {
    var i = keys.indexOf(current);
    if (i < 0) i = 0;
    pick(keys[(i + delta + keys.length) % keys.length], true);
  }

  pills.forEach(function (p) {
    p.addEventListener('click', function () { pick(p.dataset.film, false); });
  });
  if (pillBox) {
    pillBox.addEventListener('keydown', function (e) {
      var done = true;
      switch (e.key) {
        case 'ArrowLeft':  case 'ArrowUp':   move(-1); break;
        case 'ArrowRight': case 'ArrowDown': move(1);  break;
        case 'Home': pick(keys[0], true); break;
        case 'End':  pick(keys[keys.length - 1], true); break;
        default: done = false;
      }
      if (done) e.preventDefault();
    });
  }

  /* ---------------------------------------------------------
     8 · BASE PHOTO  (one image, never swapped)
     The markup already ships <img class="fx-scene-img"> so the photo
     shows without JS. Here we only reconcile it with C.sceneImage.
     --------------------------------------------------------- */
  if (canvas) {
    var existingImg = canvas.querySelector('.fx-scene-img');
    if (C.sceneImage) {
      if (existingImg) {
        if (existingImg.getAttribute('src') !== C.sceneImage) existingImg.src = C.sceneImage;
      } else {
        var img = new Image();
        img.className = 'fx-scene-img';
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.decoding = 'async';
        img.loading = 'lazy';
        img.src = C.sceneImage;
        canvas.insertBefore(img, canvas.firstChild);
      }
      root.classList.add('fx-has-photo');
    } else {
      if (existingImg) existingImg.parentNode.removeChild(existingImg);
      root.classList.remove('fx-has-photo');
    }
  }

  /* ---------------------------------------------------------
     9 · RUN GATE  +  FIRST-VIEW COUNT-UP FROM ZERO
     --------------------------------------------------------- */
  function updateRun() {
    var run = inView && !document.hidden && !mqReduce.matches;
    root.classList.toggle('is-paused', !run);
  }
  document.addEventListener('visibilitychange', updateRun);

  function onReduceChange() {
    updateRun();
    if (current) select(current, { user: false });
  }
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduceChange);
  else if (mqReduce.addListener) mqReduce.addListener(onReduceChange);

  /* baseline state right away so the keyboard works before scroll */
  select(keys[0], { user: false });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        inView = en.isIntersecting;
        updateRun();
        if (en.isIntersecting && firstReveal) {
          firstReveal = false;
          select(keys[0], { user: false, fromZero: !mqReduce.matches });
        }
      });
    }, { threshold: 0.2 });
    io.observe(root);
  } else {
    inView = true;
    firstReveal = false;
    updateRun();
  }
})();
