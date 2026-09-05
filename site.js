(function () {
  'use strict';

  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  // Logo/header: visible in the hero, hidden while scrolling down the page,
  // restored near the top or as soon as you scroll back up. Skipped while
  // the mobile menu is open (the open dropdown is positioned off the header).
  let lastScrollY = window.scrollY;
  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle('is-stuck', window.scrollY > 24);
    const menuOpen = document.body.classList.contains('menu-open');
    if (!menuOpen) {
      if (window.scrollY < 80) header.classList.remove('is-hidden');
      else if (window.scrollY > lastScrollY + 6) header.classList.add('is-hidden');
      else if (window.scrollY < lastScrollY - 6) header.classList.remove('is-hidden');
    }
    lastScrollY = window.scrollY;
  };
  updateHeader();
  addEventListener('scroll', updateHeader, { passive: true });

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
      if (open && header) header.classList.remove('is-hidden');
    });
    links.addEventListener('click', () => {
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    });
  }

  // UV99 wordmark: when it already points at the page you're on (the landing
  // page), glide back to the top / hero instead of firing a full reload.
  // On every other page it stays an ordinary link to the landing page.
  const normPath = (p) => p.replace(/\/(?:index\.html)?$/, '') || '/';
  document.querySelectorAll('a.brand').forEach((brand) => {
    brand.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      let dest;
      try { dest = new URL(brand.href); } catch (e) { return; }
      if (dest.origin !== location.origin || normPath(dest.pathname) !== normPath(location.pathname)) return;

      event.preventDefault();
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      // drop any lingering #hash so a later reload lands at the top too
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      links && links.classList.remove('is-open');
    });
  });

  // FAQ list: every answer is shown in sequence by default; each item toggles
  // independently (no auto-collapse of the others).
  document.querySelectorAll('.accordion__button').forEach((button) => {
    button.addEventListener('click', () => {
      const wasOpen = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!wasOpen));
    });
  });

  const seriesTabs = Array.from(document.querySelectorAll('.series-tab'));
  const productCards = Array.from(document.querySelectorAll('[data-product-series]'));
  const chooseSeries = (series) => {
    seriesTabs.forEach((tab) => {
      const selected = tab.dataset.series === series;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    productCards.forEach((card) => { card.hidden = card.dataset.productSeries !== series; });
  };
  seriesTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => chooseSeries(tab.dataset.series));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = seriesTabs[(index + direction + seriesTabs.length) % seriesTabs.length];
      chooseSeries(next.dataset.series);
      next.focus();
    });
  });

  document.querySelectorAll('[data-media-slot]').forEach((slot) => {
    const media = slot.querySelector(':scope > img, :scope > video');
    if (!media) return;
    const showMedia = () => slot.classList.add('has-media');
    const showFallback = () => slot.classList.remove('has-media');
    media.addEventListener(media.tagName === 'VIDEO' ? 'loadeddata' : 'load', showMedia);
    media.addEventListener('error', showFallback);
    if (media.tagName === 'IMG' && media.complete && media.naturalWidth) showMedia();
    if (media.tagName === 'VIDEO' && media.readyState >= 2) showMedia();
  });

  /* ---------- tint simulator: before / after comparison ---------- */
  (() => {
    const panel = document.querySelector('#sim-panel');
    if (!panel) return;

    const compare = document.querySelector('.sim-compare');
    const base = document.querySelector('#sim-clear');
    let activeFilm = document.querySelector('#sim-film-a');
    let idleFilm = document.querySelector('#sim-film-b');
    const range = document.querySelector('#sim-range');
    const tag = document.querySelector('#sim-film-tag');
    const nameEl = document.querySelector('#sim-name');
    const copyEl = document.querySelector('#sim-copy');
    const missing = document.querySelector('#sim-missing');
    const missingList = document.querySelector('#sim-missing-list');
    const buttons = Array.from(document.querySelectorAll('.sim-button'));
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const DIR = '/assets/images/products/';
    const CLEAR_SRC = DIR + 'simulator-clear-glass.webp';

    /* Film data — names and descriptions reused verbatim from the product copy. */
    const films = [
      { id: '70',    name: 'UV99 70',   image: DIR + 'simulator-uv99-70.webp',       description: 'Near-clear appearance · 70% visible light · 30% heat rejection' },
      { id: '50',    name: 'UV99 50',   image: DIR + 'simulator-uv99-50.webp',       description: 'Balanced tint · 47% visible light · 35% heat rejection' },
      { id: 'pro70', name: 'UV PRO 70', image: DIR + 'simulator-uv-pro-70.webp',     description: 'Near-clear, cooler tone · 70% visible light · 42% heat rejection' },
      { id: 'pro50', name: 'UV PRO 50', image: DIR + 'simulator-uv-pro-50.webp',     description: 'Comfort tint · 51% visible light · 50% heat rejection' },
      { id: 'plus',  name: 'UV99 +1',   image: DIR + 'simulator-uv99-plus-one.webp', description: 'Premium clear appearance · 70% visible light · 54% heat rejection' }
    ];
    const byId = Object.fromEntries(films.map((f) => [f.id, f]));

    /* Preload the clear base + every film so switching never flashes. */
    [CLEAR_SRC, ...films.map((f) => f.image)].forEach((src) => { new Image().src = src; });

    /* ---- divider position (range is the single source of truth) ---- */
    const applyPos = () => {
      const p = Math.max(0, Math.min(100, parseFloat(range.value) || 0));
      panel.style.setProperty('--sim-pos', p + '%');
    };
    applyPos();
    range.addEventListener('input', applyPos);

    /* ---- film selection ---- */
    const selectFilm = (id) => {
      const film = byId[id];
      if (!film) return;

      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sim === id)));
      if (tag) tag.textContent = film.name;
      if (nameEl) nameEl.textContent = film.name;
      if (copyEl) copyEl.textContent = film.description;

      idleFilm.alt = `The same car, from the same angle and light, photographed through ${film.name} film`;
      idleFilm.src = film.image;
      idleFilm.removeAttribute('aria-hidden');
      activeFilm.setAttribute('aria-hidden', 'true');

      const swap = () => {
        idleFilm.classList.add('is-active');
        activeFilm.classList.remove('is-active');
        [activeFilm, idleFilm] = [idleFilm, activeFilm];
      };
      if (reduceMotion || idleFilm.complete) {
        swap();
      } else {
        idleFilm.addEventListener('load', swap, { once: true });
        idleFilm.addEventListener('error', swap, { once: true });
      }
    };

    buttons.forEach((btn) => btn.addEventListener('click', () => selectFilm(btn.dataset.sim)));

    /* ---- missing-asset reporting: name the file, never a placeholder illustration ---- */
    const missingFiles = [];
    const reportMissing = (src) => {
      const short = src.replace(DIR, '');
      if (missingFiles.includes(short)) return;
      missingFiles.push(short);
      if (compare) compare.classList.add('is-missing');
      if (missing) {
        missing.hidden = false;
        missingList.textContent = missingFiles.join(', ');
      }
    };
    base.addEventListener('error', () => reportMissing(CLEAR_SRC));
    [activeFilm, idleFilm].forEach((img) => {
      img.addEventListener('error', () => {
        const src = img.getAttribute('src');
        if (src) reportMissing(src);
      });
    });
    if (base.complete && !base.naturalWidth) reportMissing(CLEAR_SRC);
    if (activeFilm.complete && !activeFilm.naturalWidth) reportMissing(films[0].image);
  })();

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealItems = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    revealItems.forEach((item) => observer.observe(item));
  }

  // Hero — cinematic load sequence + subtle scroll parallax.
  // The `hero-anim` class (set inline in <head>) hides the hero bits via CSS;
  // we always remove it once handled so the hero can never stay hidden.
  const hero = document.querySelector('.hero');
  if (hero && document.documentElement.classList.contains('hero-anim')) {
    if (!reduced && window.gsap) {
      const g = window.gsap;
      g.set('.hero [data-hero]', { opacity: 0, y: 26 });
      g.set('.hero__title', { opacity: 1, y: 0 });
      g.set('.hero__title .line', { opacity: 0, y: 26 });
      g.set('.hero__art', { opacity: 0, x: 34, scale: 1.05 });
      g.set('.hero-stat', { opacity: 0, y: 18 });
      g.set('.hero__benefits li', { opacity: 0, y: 16 });
      document.documentElement.classList.remove('hero-anim');

      const E = 'power3.out';
      const tl = g.timeline({ defaults: { ease: E, duration: 0.9 } });
      tl.to('.hero__art', { opacity: 1, scale: 1, x: 0, duration: 1.7 }, 0.1)
        .to('.hero__eyebrow', { opacity: 1, y: 0, duration: 0.7 }, 0.45)
        .to('.hero__title .line', { opacity: 1, y: 0, duration: 0.95, stagger: 0.13 }, 0.55)
        .to('.hero__copy', { opacity: 1, y: 0, duration: 0.8 }, 1.05)
        .to('.actions', { opacity: 1, y: 0, duration: 0.8 }, 1.2)
        .to('.hero__stats', { opacity: 1, y: 0, duration: 0.5 }, 1.35)
        .to('.hero-stat', { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }, 1.4)
        .to('.hero__strip', { opacity: 1, y: 0, duration: 0.9 }, 1.6)
        .to('.hero__benefits li', { opacity: 1, y: 0, duration: 0.55, stagger: 0.07 }, 1.7);

      // failsafe: guarantee the resting (visible) state even if the timeline stalls
      setTimeout(function () {
        if (tl.progress() < 1) tl.progress(1);
        g.set(['.hero [data-hero]', '.hero__title .line', '.hero-stat', '.hero__benefits li'],
          { opacity: 1, y: 0 });
        g.set('.hero__art', { opacity: 1, x: 0, scale: 1 });
      }, 5000);

      if (window.ScrollTrigger) {
        g.registerPlugin(window.ScrollTrigger);
        // Note: the car (.hero__art) is intentionally left static — no scroll
        // parallax drift on it. Only the copy column gets a gentle lift.
        const grid = hero.querySelector('.hero__grid');
        if (grid) g.to(grid, {
          y: -44, autoAlpha: 0.82, ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1 }
        });
      }
    } else {
      document.documentElement.classList.remove('hero-anim');
    }
  }

  // About UV99 — reveal on scroll. CSS drives the reveal so the section is never
  // stuck hidden if JS/GSAP fail; GSAP only adds an optional, crop-safe parallax.
  const aboutSection = document.querySelector('.about-uv99');
  if (aboutSection && !reduced) {
    aboutSection.classList.add('is-armed');
    const reveal = () => aboutSection.classList.add('is-inview');

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => { if (entry.isIntersecting) { reveal(); obs.disconnect(); } });
      }, { threshold: 0.12 });
      io.observe(aboutSection);
      setTimeout(reveal, 3500); // failsafe: never leave content hidden
    } else {
      reveal();
    }

    // feature cards — pointer-tracked spotlight glow
    aboutSection.querySelectorAll('.about-uv99__card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        card.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
      });
    });

    if (window.gsap && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);

      const figure = aboutSection.querySelector('.about-uv99__figure');
      if (figure) {
        window.gsap.fromTo(figure, { y: 12 }, {
          y: -12,
          ease: 'none',
          scrollTrigger: { trigger: aboutSection, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
        });
      }

      // cinematic parallax on the car background
      const bg = aboutSection.querySelector('.about-uv99__bg');
      if (bg) {
        window.gsap.fromTo(bg, { yPercent: -6 }, {
          yPercent: 6,
          ease: 'none',
          scrollTrigger: { trigger: aboutSection, start: 'top bottom', end: 'bottom top', scrub: 1 }
        });
      }
    }
  }

  const form = document.querySelector('#contact-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const phone = String(data.get('phone') || '').replace(/\D/g, '');
      const car = String(data.get('car') || '').trim();
      const status = form.querySelector('.form-status');
      if (!name || phone.length < 10 || !car) {
        status.textContent = 'Please add your name, a valid phone number, and your car model.';
        return;
      }
      const message = `Hello UV99 Glazing, I am ${name}. My phone is ${data.get('phone')}. I drive a ${car}. I am interested in ${data.get('film')}. ${data.get('message') || ''}`;
      status.textContent = 'Your enquiry is ready. Opening WhatsApp…';
      window.open(`https://wa.me/91?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    });
  }

  document.querySelectorAll('[data-year]').forEach((item) => { item.textContent = new Date().getFullYear(); });
})();
