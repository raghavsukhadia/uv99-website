/* =====================================================================
   UV99+1 — interaction & motion
   ---------------------------------------------------------------------
   - Works without GSAP: the page renders fully; only motion is skipped.
   - Respects prefers-reduced-motion (everything shown, counters at final).
   - GSAP + ScrollTrigger loaded from CDN in uv99-plus-one.html (defer).

   Hero entrance: a single cinematic GSAP timeline, retriggered by an
   IntersectionObserver whenever the hero genuinely re-enters the viewport.
   Number counters: plain requestAnimationFrame with an easeOutCubic curve
   (no library tween), shared progress, exact integer targets.
   ===================================================================== */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  var animate = hasGSAP && !reduced;

  /* ---------- year ---------- */
  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- mobile menu ---------- */
  var menuBtn = document.querySelector('.upo-rail__menu');
  var railNav = document.querySelector('.upo-rail__nav');
  if (menuBtn && railNav) {
    var setMenu = function (open) {
      document.body.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    };
    menuBtn.addEventListener('click', function () {
      setMenu(!document.body.classList.contains('menu-open'));
    });
    railNav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  /* ---------- smooth active-nav highlighting (no GSAP needed) ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { navIO.observe(s); });
  }

  /* =================================================================
     NUMBER COUNTERS
     -----------------------------------------------------------------
     requestAnimationFrame only — no setInterval, no library tween.
     Every value in a group shares one normalised progress, is eased
     with easeOutCubic, rendered as a whole integer, clamped so it can
     never exceed its target, and snapped to the exact target on the
     final frame. The "%" (data-suffix) is always preserved.
     ================================================================= */
  var COUNTER_MS = 1500;
  var easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };

  function targetOf(el) {
    return parseFloat(el.getAttribute('data-count') || el.textContent) || 0;
  }
  function suffixOf(el) { return el.getAttribute('data-suffix') || ''; }

  /* Build a controller for a set of counter elements. */
  function makeCounterGroup(els, duration) {
    var nodes = Array.prototype.slice.call(els);
    var targets = nodes.map(targetOf);
    var suffixes = nodes.map(suffixOf);
    var rafId = 0;
    var startStamp = 0;

    function paint(progress) {
      var e = easeOutCubic(progress);
      for (var i = 0; i < nodes.length; i++) {
        var value = Math.min(targets[i], Math.round(targets[i] * e));
        nodes[i].textContent = value + suffixes[i];
      }
    }
    function snapFinal() {
      for (var i = 0; i < nodes.length; i++) nodes[i].textContent = targets[i] + suffixes[i];
    }
    function step(now) {
      if (!startStamp) startStamp = now;
      var progress = Math.min(1, (now - startStamp) / duration);
      if (progress < 1) {
        paint(progress);
        rafId = requestAnimationFrame(step);
      } else {
        rafId = 0;
        snapFinal();
      }
    }

    return {
      /* run from 0 -> target */
      start: function () {
        this.cancel();
        startStamp = 0;
        paint(0);
        rafId = requestAnimationFrame(step);
      },
      /* stop any pending frame (cleanup / reset) */
      cancel: function () {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      },
      /* park at zero, ready to replay */
      reset: function () {
        this.cancel();
        startStamp = 0;
        paint(0);
      },
      /* jump straight to the exact targets */
      finish: function () {
        this.cancel();
        snapFinal();
      }
    };
  }

  var heroStatEls = document.querySelectorAll('.upo-stats .upo-stat__value');
  var heroCounters = heroStatEls.length ? makeCounterGroup(heroStatEls, COUNTER_MS) : null;

  /* ---------- hero ambient motion: run only while visible ----------
     Pause every continuous hero animation when the section scrolls out of
     view or the tab is hidden (CSS gates on .upo-hero.is-paused). Runs
     regardless of GSAP so the CSS-only motion path is covered too. */
  (function () {
    var heroEl = document.querySelector('.upo-hero');
    if (!heroEl || !('IntersectionObserver' in window)) return;
    var onScreen = true;
    var sync = function () {
      heroEl.classList.toggle('is-paused', !onScreen || document.hidden);
    };
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.06 }).observe(heroEl);
    document.addEventListener('visibilitychange', sync);
  })();

  /* ---------- subtle pointer parallax on the product (fine pointers only) ---------- */
  (function () {
    if (reduced) return;
    var heroEl = document.querySelector('.upo-hero');
    var par = document.querySelector('.upo-product__par');
    if (!heroEl || !par) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var pending = false, nx = 0, ny = 0;
    heroEl.addEventListener('pointermove', function (ev) {
      var r = heroEl.getBoundingClientRect();
      nx = (ev.clientX - r.left) / r.width - 0.5;
      ny = (ev.clientY - r.top) / r.height - 0.5;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        par.style.transform =
          'rotateX(' + (ny * -5).toFixed(2) + 'deg) rotateY(' + (nx * 7).toFixed(2) + 'deg)';
      });
    });
    heroEl.addEventListener('pointerleave', function () { par.style.transform = ''; });
  })();

  /* ---------- NO-MOTION PATH ---------- */
  if (!animate) {
    docEl.classList.remove('upo-anim');           // reveal everything the gate hid
    document.querySelectorAll('[data-count]').forEach(function (el) {
      el.textContent = (parseFloat(el.getAttribute('data-count')) || 0) + (el.getAttribute('data-suffix') || '');
    });
    return;
  }

  /* =================================================================
     MOTION PATH  (GSAP + ScrollTrigger)
     ================================================================= */
  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  /* premium ease — cubic-bezier(0.16, 1, 0.3, 1) resolved without a plugin */
  var PREMIUM = cubicBezier(0.16, 1, 0.3, 1);
  function cubicBezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    var sampleX = function (t) { return ((ax * t + bx) * t + cx) * t; };
    var sampleY = function (t) { return ((ay * t + by) * t + cy) * t; };
    var slopeX = function (t) { return (3 * ax * t + 2 * bx) * t + cx; };
    return function (p) {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      var t = p, i, x, d;
      for (i = 0; i < 8; i++) {
        x = sampleX(t) - p;
        if (Math.abs(x) < 1e-5) return sampleY(t);
        d = slopeX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= x / d;
      }
      var lo = 0, hi = 1;
      t = p;
      while (lo < hi) {
        x = sampleX(t);
        if (Math.abs(x - p) < 1e-5) break;
        if (p > x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sampleY(t);
    };
  }

  var hero = document.querySelector('.upo-hero');
  var headlineSpans = gsap.utils.toArray('.upo-hero__headline .line > span');
  var railNavLinks = gsap.utils.toArray('.upo-rail__nav a');
  var platformBits = gsap.utils.toArray(['.upo-stage__glow', '.upo-stage__turntable', '.upo-stage__spark']);
  var statItems = gsap.utils.toArray('.upo-stats .upo-stat');

  /* one-time: pin the below-the-fold reveal items, then drop the CSS gate */
  gsap.set('[data-animate]', { opacity: 0 });
  gsap.set('[data-reveal]', { opacity: 0, y: 34 });
  setHeroStart();
  docEl.classList.remove('upo-anim');

  /* Hero-only pre-animation state — safe to call again for every replay. */
  function setHeroStart() {
    gsap.set('.upo-stage__scene', { opacity: 0, scale: 0.94, transformOrigin: '50% 58%' });
    gsap.set(platformBits, { opacity: 0 });
    gsap.set('.upo-product', { opacity: 0, y: 52 });
    gsap.set(headlineSpans, { opacity: 0, yPercent: 100 });
    gsap.set('.upo-rail__logo', { opacity: 0, y: -8 });
    gsap.set(railNavLinks, { opacity: 0, x: -14 });
    gsap.set(['.upo-rail__menu', '.upo-rail__note'], { opacity: 0, y: 8 });
    gsap.set('.upo-watermark', { opacity: 0 });
    gsap.set('.upo-hero__lede', { opacity: 0, y: 18 });
    gsap.set('.upo-hero__actions', { opacity: 0, y: 16 });
    gsap.set('.upo-stats', { opacity: 0 });
    gsap.set(statItems, { opacity: 0, y: 16 });
  }

  /* Build the cinematic entrance. Timings (seconds) follow the brief:
       background artwork    0.00 – 1.00
       platform / glass      0.25 – 1.15   (staggered)
       product rises 52px    0.50 – 1.35
       headline line reveal  0.80 – 1.55   (from overflow mask)
       description           1.10 – 1.65
       buttons               1.25 – 1.75
       statistic containers  1.45 – 1.95   (staggered)
       number counting       1.55 – 3.05   (rAF, 1500ms)                    */
  function buildIntro() {
    var tl = gsap.timeline({
      defaults: { ease: PREMIUM, duration: 0.8 },
      onComplete: function () { playing = false; }
    });

    /* 1 + 2 — section ground is already visible; background artwork fades
       in and eases from 0.94 -> 1 */
    tl.to('.upo-stage__scene', { opacity: 1, scale: 1, duration: 1.0 }, 0);

    /* left rail chrome — quiet, early, never competing with the hero */
    tl.to('.upo-rail__logo', { opacity: 1, y: 0, duration: 0.6 }, 0.08)
      .to(railNavLinks, { opacity: 1, x: 0, duration: 0.5, stagger: 0.06 }, 0.18)
      .to(['.upo-rail__menu', '.upo-rail__note'], { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 }, 0.24)
      .to('.upo-watermark', { opacity: 1, duration: 1.0 }, 0.12);

    /* 3 — platform light, turntable sheen and embers settle in */
    tl.to('.upo-stage__glow', { opacity: 1, duration: 0.9, clearProps: 'opacity' }, 0.25)
      .to('.upo-stage__turntable', { opacity: 0.5, duration: 0.9, clearProps: 'opacity' }, 0.35)
      .to('.upo-stage__spark', { opacity: 0.9, duration: 0.9, clearProps: 'opacity' }, 0.45);

    /* 4 — central product rises ~52px into position while fading in */
    tl.to('.upo-product', { opacity: 1, y: 0, duration: 0.85 }, 0.5);

    /* 5 — headline reveals line by line out of its overflow-hidden mask */
    tl.to(headlineSpans, { opacity: 1, yPercent: 0, duration: 0.6, stagger: 0.09 }, 0.8);

    /* 6 — description fades upward */
    tl.to('.upo-hero__lede', { opacity: 1, y: 0, duration: 0.55 }, 1.1);

    /* 7 — buttons + secondary link */
    tl.to('.upo-hero__actions', { opacity: 1, y: 0, duration: 0.5 }, 1.25);

    /* 8 — statistics reveal last, then the numbers count up */
    tl.to('.upo-stats', { opacity: 1, duration: 0.45 }, 1.45)
      .to(statItems, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, 1.45)
      .call(function () { if (heroCounters) heroCounters.start(); }, null, 1.55);

    return tl;
  }

  var introTl = null;
  var playing = false;
  var armed = true;          // ready for the next genuine entry
  var playStamp = 0;

  /* Snap every hero element to its final resting state (used by the
     watchdog if the rAF ticker ever stalls mid-timeline). */
  function settleHero() {
    if (introTl) { introTl.progress(1, true); }   // true = suppress the counter .call()
    gsap.set('.upo-stage__scene', { opacity: 1, scale: 1 });
    gsap.set(platformBits, { clearProps: 'opacity' });
    gsap.set(['.upo-product', '.upo-hero__lede', '.upo-hero__actions'], { opacity: 1, y: 0 });
    gsap.set(headlineSpans, { opacity: 1, yPercent: 0 });
    gsap.set(['.upo-rail__logo', '.upo-rail__menu', '.upo-rail__note'], { opacity: 1, y: 0 });
    gsap.set(railNavLinks, { opacity: 1, x: 0 });
    gsap.set('.upo-watermark', { opacity: 1 });
    gsap.set(['.upo-stats'].concat(statItems), { opacity: 1, y: 0 });
    if (heroCounters) heroCounters.finish();
    playing = false;
  }

  function playIntro() {
    if (playing) return;      // guard re-renders / rapid threshold flapping
    playing = true;
    playStamp = (window.performance && performance.now()) || Date.now();
    if (introTl) introTl.kill();
    if (heroCounters) heroCounters.cancel();
    setHeroStart();
    introTl = buildIntro();
  }

  function resetIntro() {
    if (introTl) { introTl.kill(); introTl = null; }
    if (heroCounters) heroCounters.reset();
    playing = false;
    setHeroStart();
  }

  /* ---------- entrance trigger ----------
     Play once when >= ~38% of the hero is in view; only re-arm after the
     hero has fully left the viewport again. Guarded so React-style double
     mounts / Strict-Mode re-runs cannot double-fire. */
  function heroInView() {
    var r = hero.getBoundingClientRect();
    var vh = window.innerHeight || docEl.clientHeight || 0;
    if (r.height <= 0 || vh <= 0) return false;
    var shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    return shown / Math.min(r.height, vh) >= 0.38;
  }

  if (hero && !hero.dataset.introBound) {
    hero.dataset.introBound = '1';

    if ('IntersectionObserver' in window) {
      var introIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var ratio = entry.intersectionRatio;
          if (armed && entry.isIntersecting && ratio >= 0.38) {
            armed = false;
            playIntro();
          } else if (!armed && !playing && !entry.isIntersecting && ratio === 0) {
            armed = true;               // only a full exit re-arms the replay
            resetIntro();
          }
        });
      }, { threshold: [0, 0.38, 0.75] });
      introIO.observe(hero);
    }

    /* Don't wait on the observer's first async callback for the initial,
       above-the-fold paint — if the hero is already open, start now. */
    if (armed && heroInView()) {
      armed = false;
      playIntro();
    }
  }

  /* cancel any in-flight counter frame when the page is being torn down */
  window.addEventListener('pagehide', function () {
    if (heroCounters) heroCounters.cancel();
  });

  /* ---------- scroll reveals for lower sections ---------- */
  gsap.utils.toArray('[data-reveal]').forEach(function (el) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: .9, ease: PREMIUM,
      scrollTrigger: { trigger: el, start: 'top 82%', once: true }
    });
  });

  /* ---------- performance count-ups + bars ---------- */
  ScrollTrigger.create({
    trigger: '.upo-perf',
    start: 'top 78%',
    once: true,
    onEnter: function () {
      var perfEls = document.querySelectorAll('.upo-perf__num');
      if (perfEls.length) makeCounterGroup(perfEls, COUNTER_MS).start();
      gsap.from('.upo-perf__bar i', {
        scaleX: 0, transformOrigin: 'left', duration: 1.3, ease: 'power2.out', stagger: .12
      });
    }
  });

  /* ---------- technology spec list — same entrance as the hero stats:
     container reveal (its own [data-reveal]) + per-item stagger, then the
     numbers count up from zero (identical timing to .upo-stats). ---------- */
  (function () {
    var specList = document.querySelector('.upo-specs');
    if (!specList) return;
    var specItems = gsap.utils.toArray('.upo-specs li');
    var specNums = specList.querySelectorAll('[data-count]');
    gsap.set(specItems, { opacity: 0, y: 16 });
    ScrollTrigger.create({
      trigger: specList,
      start: 'top 82%',
      once: true,
      onEnter: function () {
        gsap.to(specItems, { opacity: 1, y: 0, duration: 0.5, ease: PREMIUM, stagger: 0.1 });
        if (specNums.length) {
          gsap.delayedCall(0.1, function () { makeCounterGroup(specNums, COUNTER_MS).start(); });
        }
      }
    });
  })();

  /* ---------- slight parallax on the render while the hero is in view ---------- */
  gsap.to('.upo-stage__scene', {
    yPercent: -6, ease: 'none',
    scrollTrigger: { trigger: '.upo-hero', start: 'top top', end: 'bottom top', scrub: .8 }
  });

  /* ---------- cinematic hero exit (scrub) ---------- */
  gsap.to('.upo-stage', {
    yPercent: -8, scale: 1.05, opacity: .35, ease: 'none',
    scrollTrigger: { trigger: '.upo-hero', start: 'bottom bottom', end: 'bottom top', scrub: .6 }
  });
  gsap.to('.upo-watermark', {
    yPercent: -30, ease: 'none',
    scrollTrigger: { trigger: '.upo-hero', start: 'top top', end: 'bottom top', scrub: .8 }
  });

  /* ---------- keep positions correct after fonts/layout settle ---------- */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  /* ---------- failsafes: never leave content hidden ----------
     Independent of GSAP's ticker. If the rAF loop stalls (background tab,
     throttling) and leaves the hero part-revealed while it is on screen,
     snap it to the finished state. Also rescue any on-screen reveal item. */
  setInterval(function () {
    var now = (window.performance && performance.now()) || Date.now();
    if (playing && playStamp && now - playStamp > 3600 && hero && heroInView()) {
      var stats = document.querySelector('.upo-stats');
      if (!stats || parseFloat(getComputedStyle(stats).opacity) < 0.99) settleHero();
    }
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      var r = el.getBoundingClientRect();
      var onscreen = r.top < window.innerHeight * 0.95 && r.bottom > 0;
      if (onscreen && parseFloat(getComputedStyle(el).opacity) < 0.05) {
        gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
      }
    });
  }, 1200);
})();
