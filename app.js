// ============================================================
// FUSION BELLS FILMS — site interactions
// ============================================================
(function () {
  'use strict';

  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     LOADER
     --------------------------------------------------------- */
  const loader = $('#loader');
  if (loader) {
    requestAnimationFrame(() => loader.classList.add('go'));
    const hide = () => {
      loader.classList.add('done');
      document.body.classList.remove('locked');
      setTimeout(() => loader.remove(), 800);
    };
    document.body.classList.add('locked');
    window.addEventListener('load', () => setTimeout(hide, reduceMotion ? 0 : 550));
    setTimeout(hide, 3200); // hard safety net
  }

  /* ---------------------------------------------------------
     SPLIT-WORD HEADLINE REVEAL
     --------------------------------------------------------- */
  function splitNode(node, counter) {
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        if (!child.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        parts.forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const wrap = document.createElement('span');
          wrap.className = 'w';
          const inner = document.createElement('i');
          inner.textContent = part;
          inner.style.transitionDelay = Math.min(counter.i * 0.045, 0.7) + 's';
          counter.i++;
          wrap.appendChild(inner);
          frag.appendChild(wrap);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') {
        splitNode(child, counter);
      }
    });
  }
  $$('.split').forEach(el => splitNode(el, { i: 0 }));

  /* ---------------------------------------------------------
     SCROLL REVEAL
     --------------------------------------------------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -70px 0px' });

  function observe(el) { io.observe(el); }
  $$('.reveal, .split, .frame, .cta-band').forEach(observe);

  /* ---------------------------------------------------------
     ANIMATED COUNTERS
     --------------------------------------------------------- */
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      counterIO.unobserve(el);
      const target = parseInt(el.dataset.to, 10) || 0;
      if (reduceMotion) { el.textContent = target + '+'; return; }
      const start = performance.now();
      const dur = 1400;
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + (p === 1 ? '+' : '');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });
  $$('.count').forEach(el => counterIO.observe(el));

  /* ---------------------------------------------------------
     NAV — scrolled state, auto-hide, active link
     --------------------------------------------------------- */
  const siteNav = $('#siteNav');
  const toTop = $('#toTop');
  // Only in-page anchors can drive the active-section underline; cross-page
  // links like "gallery.html" are not valid selectors.
  const navAnchors = $$('.nav-links a').filter(a => (a.getAttribute('href') || '').charAt(0) === '#');
  const sections = navAnchors
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  let lastY = window.scrollY;

  function onScroll() {
    const y = window.scrollY;
    if (siteNav) {
      siteNav.classList.toggle('scrolled', y > 60);
      const goingDown = y > lastY && y > 400;
      siteNav.classList.toggle('hidden', goingDown && !document.body.classList.contains('menu-open'));
    }
    if (toTop) toTop.classList.toggle('show', y > 900);
    lastY = y;

    // active section
    if (sections.length) {
      let current = null;
      sections.forEach(sec => {
        if (sec.getBoundingClientRect().top <= window.innerHeight * 0.4) current = sec.id;
      });
      navAnchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
    }

    parallax();
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });

  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------------------------------------------------------
     PARALLAX BANDS
     --------------------------------------------------------- */
  const parallaxEls = $$('[data-parallax]');
  function parallax() {
    if (reduceMotion) return;
    const vh = window.innerHeight;
    parallaxEls.forEach(section => {
      const bg = section.querySelector('.cine-bg, .cta-bg');
      if (!bg) return;
      const rect = section.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > vh + 200) return;
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh; // -1 .. 1
      bg.style.transform = 'translate3d(0,' + (progress * -60).toFixed(2) + 'px,0)';
    });
  }
  parallax();

  /* ---------------------------------------------------------
     FULLSCREEN MENU
     --------------------------------------------------------- */
  const navToggle = $('#navToggle');
  const ntLabel = $('#ntLabel');
  const menuOverlay = $('#menuOverlay');

  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    document.body.classList.toggle('locked', open);
    if (ntLabel) ntLabel.textContent = open ? 'Close' : 'Menu';
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
  }
  if (navToggle) navToggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  if (menuOverlay) $$('a', menuOverlay).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false);
  });

  /* ---------------------------------------------------------
     HERO CAROUSEL
     --------------------------------------------------------- */
  const slides = $$('.hero-slide');
  const frameNo = $('#frameNo');
  const heroDots = $('#heroDots');
  let slideIdx = 0;
  let heroTimer = null;

  if (slides.length && heroDots) {
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'hero-dot' + (i === 0 ? ' active' : '');
      b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      b.addEventListener('click', () => { goToSlide(i); restartHero(); });
      heroDots.appendChild(b);
    });
  }

  function goToSlide(i) {
    if (!slides.length) return;
    slides[slideIdx].classList.remove('active');
    slideIdx = (i + slides.length) % slides.length;
    slides[slideIdx].classList.add('active');
    if (frameNo) frameNo.textContent = String(slideIdx + 1).padStart(2, '0');
    $$('.hero-dot', heroDots).forEach((d, n) => d.classList.toggle('active', n === slideIdx));
  }
  function restartHero() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goToSlide(slideIdx + 1), 5600);
  }
  if (slides.length > 1) restartHero();

  /* ---------------------------------------------------------
     FEATURED STORY CAROUSEL
     --------------------------------------------------------- */
  const featTrack = $('#featTrack');
  const featBars = $('#featBars');
  const featSlides = featTrack ? $$('.feat-slide', featTrack) : [];
  let featIdx = 0;
  let featTimer = null;

  if (featSlides.length && featBars) {
    featSlides.forEach((_, i) => {
      const bar = document.createElement('button');
      bar.className = 'feat-bar' + (i === 0 ? ' active' : '');
      bar.setAttribute('aria-label', 'Story ' + (i + 1));
      bar.innerHTML = '<i></i>';
      bar.addEventListener('click', () => { goToFeat(i); restartFeat(); });
      featBars.appendChild(bar);
    });
  }

  function goToFeat(i) {
    if (!featSlides.length) return;
    featIdx = (i + featSlides.length) % featSlides.length;
    featTrack.style.transform = 'translateX(-' + (featIdx * 100) + '%)';
    $$('.feat-bar', featBars).forEach((b, n) => {
      b.classList.remove('active');
      if (n === featIdx) { void b.offsetWidth; b.classList.add('active'); }
    });
  }
  function restartFeat() {
    clearInterval(featTimer);
    featTimer = setInterval(() => goToFeat(featIdx + 1), 6000);
  }
  const featPrev = $('#featPrev');
  const featNext = $('#featNext');
  if (featPrev) featPrev.addEventListener('click', () => { goToFeat(featIdx - 1); restartFeat(); });
  if (featNext) featNext.addEventListener('click', () => { goToFeat(featIdx + 1); restartFeat(); });
  if (featSlides.length > 1) { goToFeat(0); restartFeat(); }

  /* ---------------------------------------------------------
     GALLERY + GOOGLE DRIVE SYNC
     --------------------------------------------------------- */
  const GDRIVE_API_URL = 'https://script.google.com/macros/s/AKfycbzLMnYaQUbAADkPPp2cv0651yJvcfkIKUEYyKqrMp8srUcRZmDKPqUSFgV5CG4ZP_MtfA/exec';

  const galleryEl = $('#gallery');
  const loadMoreBtn = $('#loadMore');
  let frames = $$('.frame');

  // The gallery page pages through its frames; the homepage shows a teaser
  // and sends visitors to gallery.html for the rest.
  const PAGE_SIZE = loadMoreBtn ? 24 : 12;
  let renderLimit = PAGE_SIZE;
  let drivePhotos = null;   // set once the Drive feed takes over

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function frameHTML(p) {
    return `<div class="frame" data-full="${esc(p.full)}" data-full-alt="${esc(p.fullAlt || p.full)}">
        <img src="${esc(p.thumb)}" data-alt-src="${esc(p.thumbAlt || '')}" loading="lazy" decoding="async"
             referrerpolicy="no-referrer" alt="${esc(p.title)}">
        <span class="frame-meta">Frame ${esc(p.frameNo)}</span>
      </div>`;
  }

  // Google's image hosts rate-limit bursts, so frames are added a page at a
  // time and each image keeps a second host in reserve.
  function renderDriveFrames(append) {
    if (!galleryEl || !drivePhotos) return;
    const slice = append
      ? drivePhotos.slice(renderLimit - PAGE_SIZE, renderLimit)
      : drivePhotos.slice(0, renderLimit);
    const html = slice.map(frameHTML).join('');
    if (append) galleryEl.insertAdjacentHTML('beforeend', html);
    else galleryEl.innerHTML = html;

    frames = $$('.frame');
    bindFrames();
    if (loadMoreBtn) loadMoreBtn.hidden = renderLimit >= drivePhotos.length;
    updateGalleryCount();
  }

  // Local fallback frames are already in the DOM — just cap how many show.
  function applyVisibility() {
    let shown = 0;
    frames.forEach(f => {
      shown++;
      f.style.display = shown <= renderLimit ? '' : 'none';
    });
    if (loadMoreBtn) loadMoreBtn.hidden = frames.length <= renderLimit;
    updateGalleryCount();
  }

  function bindFrames() {
    frames.forEach(f => {
      f.onclick = () => openLightbox(visibleFrameSources(), visibleFrames().indexOf(f));
      if (!f.classList.contains('in')) observe(f);
    });
  }

  function bindGallery() {
    frames = $$('.frame');
    bindFrames();
    applyVisibility();
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      renderLimit += PAGE_SIZE;
      if (drivePhotos) renderDriveFrames(true);
      else applyVisibility();
    });
  }

  // One delegated handler retries any Drive image on the backup host.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    const backup = img.dataset.altSrc;
    if (backup && !img.dataset.retried) {
      img.dataset.retried = '1';
      img.src = backup;
    } else if (img.dataset.retried) {
      const frame = img.closest('.frame, .moment');
      if (frame) frame.style.display = 'none';   // drop it rather than show a broken box
    }
  }, true);

  function visibleFrames() { return frames.filter(f => f.style.display !== 'none'); }
  function visibleFrameSources() {
    return visibleFrames().map(f => ({
      src: f.dataset.full || (f.querySelector('img') || {}).src,
      altSrc: f.dataset.fullAlt || '',
      caption: (f.querySelector('.frame-meta') || {}).textContent || '',
      alt: (f.querySelector('img') || {}).alt || 'Fusion Bells Films photograph'
    }));
  }

  // Categories that are Drive housekeeping rather than portfolio work.
  const SKIP_CATEGORIES = ['logo', 'logos', 'branding'];
  // The Drive only takes over the gallery once it holds a full-looking set;
  // below this it would replace the curated frames with a near-empty grid.
  const MIN_DRIVE_PHOTOS = 6;

  function renderGalleryData(data) {
    if (!data) return;

    // The founder portrait lives in its own Drive folder and is never a gallery frame.
    applyFounder(data.founder);

    if (!data.photos || !data.photos.length) return;

    const photos = data.photos.filter(p => SKIP_CATEGORIES.indexOf(String(p.category).toLowerCase()) === -1);
    // Too little usable work came back — keep the curated frames already on the page.
    if (photos.length < MIN_DRIVE_PHOTOS) {
      console.info('Drive gallery has ' + photos.length + ' photo(s); keeping the built-in frames until it reaches ' + MIN_DRIVE_PHOTOS + '.');
      return;
    }

    drivePhotos = photos;
    renderLimit = PAGE_SIZE;
    fillMoments(photos);
    renderDriveFrames(false);
  }

  // --- founder portrait, pulled from the Drive "Founder" folder ---
  function applyFounder(founder) {
    const el = $('#founderPhoto');
    if (!el || !founder || !founder.full) return;
    const swap = (url, fallback) => {
      const probe = new Image();
      probe.referrerPolicy = 'no-referrer';
      probe.onload = () => { el.referrerPolicy = 'no-referrer'; el.src = url; };
      probe.onerror = () => { if (fallback) swap(fallback, null); };
      probe.src = url;            // only swap once it actually loads
    };
    swap(founder.full, founder.fullAlt);
  }

  // --- "Moments in Time" strip on the gallery page ---
  function fillMoments(photos) {
    const track = $('#momentsTrack');
    if (!track || !photos.length) return;
    track.innerHTML = photos.slice(0, 12).map(p =>
      `<figure class="moment" data-full="${esc(p.full)}" data-full-alt="${esc(p.fullAlt || p.full)}">
         <img src="${esc(p.thumb)}" data-alt-src="${esc(p.thumbAlt || '')}" loading="lazy" decoding="async"
              referrerpolicy="no-referrer" alt="${esc(p.title)}">
       </figure>`
    ).join('');
    bindMoments();
  }

  // Thumbnail rail under the big frame; clicking one centres that photo.
  function buildMomentThumbs() {
    const rail = $('#momentsThumbs');
    if (!rail) return;
    const moments = $$('.moment');
    rail.innerHTML = moments.map((m, i) => {
      const img = m.querySelector('img');
      return `<button class="mom-thumb${i === 0 ? ' is-active' : ''}" data-i="${i}" aria-label="Show photo ${i + 1}">
                <img src="${esc(img ? img.getAttribute('src') : '')}" alt="" loading="lazy"
                     referrerpolicy="no-referrer" ${img && img.dataset.altSrc ? `data-alt-src="${esc(img.dataset.altSrc)}"` : ''}>
              </button>`;
    }).join('');
    $$('.mom-thumb', rail).forEach(t => {
      t.addEventListener('click', () => {
        const target = $$('.moment')[parseInt(t.dataset.i, 10)];
        if (target) centreMoment(target);
      });
    });
  }

  function centreMoment(el) {
    const vp = $('#momentsViewport');
    if (!vp || !el) return;
    const vpRect = vp.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = (elRect.left + elRect.width / 2) - (vpRect.left + vpRect.width / 2);
    vp.scrollTo({ left: vp.scrollLeft + delta, behavior: 'smooth' });
  }

  // Mark whichever frame is nearest the centre, and mirror it on the rail.
  function syncActiveMoment() {
    const vp = $('#momentsViewport');
    if (!vp) return;
    const centre = vp.getBoundingClientRect().left + vp.clientWidth / 2;
    const moments = $$('.moment');
    let best = 0, bestDist = Infinity;
    moments.forEach((m, i) => {
      const r = m.getBoundingClientRect();
      const d = Math.abs((r.left + r.width / 2) - centre);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    moments.forEach((m, i) => m.classList.toggle('is-active', i === best));
    $$('.mom-thumb').forEach((t, i) => t.classList.toggle('is-active', i === best));
    const activeThumb = $$('.mom-thumb')[best];
    if (activeThumb && activeThumb.parentElement) {
      const rail = activeThumb.parentElement;
      const tr = activeThumb.getBoundingClientRect();
      const rr = rail.getBoundingClientRect();
      if (tr.left < rr.left || tr.right > rr.right) {
        rail.scrollTo({ left: rail.scrollLeft + (tr.left - rr.left) - rr.width / 2 + tr.width / 2, behavior: 'smooth' });
      }
    }
    return best;
  }

  function bindMoments() {
    buildMomentThumbs();
    syncActiveMoment();
    const moments = $$('.moment');
    moments.forEach((m, i) => {
      m.onclick = () => openLightbox(moments.map(el => ({
        src: el.dataset.full || (el.querySelector('img') || {}).src,
        altSrc: el.dataset.fullAlt || '',
        alt: (el.querySelector('img') || {}).alt || '',
        caption: 'Fusion Bells Films'
      })), i);
    });
  }

  function updateGalleryCount() {
    const label = $('#galleryCount');
    if (!label) return;
    const total = drivePhotos ? drivePhotos.length : $$('.frame').length;
    const shown = Math.min(total, renderLimit);
    label.textContent = total ? 'Showing ' + shown + ' of ' + total + ' frames' : '';
  }

  bindGallery();
  bindMoments();

  /* ---------------------------------------------------------
     MOMENTS CAROUSEL (gallery page)
     --------------------------------------------------------- */
  const momViewport = $('#momentsViewport');
  if (momViewport) {
    const rail = $('#momRail');
    const paint = () => {
      if (!rail) return;
      const max = momViewport.scrollWidth - momViewport.clientWidth;
      const ratio = momViewport.clientWidth / momViewport.scrollWidth;
      const pos = max > 0 ? momViewport.scrollLeft / max : 0;
      rail.style.width = Math.max(ratio * 100, 8) + '%';
      rail.style.left = (pos * (100 - Math.max(ratio * 100, 8))) + '%';
    };
    const prev = $('#momPrev');
    const next = $('#momNext');

    /* --- auto-slide, one frame at a time --- */
    let momTimer = null;
    const goRelative = (dir) => {
      const moments = $$('.moment');
      if (!moments.length) return;
      const current = syncActiveMoment() || 0;
      const target = moments[(current + dir + moments.length) % moments.length];
      centreMoment(target);
    };
    const advance = () => {
      const moments = $$('.moment');
      const current = syncActiveMoment() || 0;
      if (current >= moments.length - 1) centreMoment(moments[0]);
      else goRelative(1);
    };
    const startAuto = () => {
      if (reduceMotion) return;
      clearInterval(momTimer);
      momTimer = setInterval(advance, 3600);
    };
    const stopAuto = () => clearInterval(momTimer);

    // Only run while the strip is actually on screen.
    const momIO = new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? startAuto() : stopAuto());
    }, { threshold: 0.25 });
    momIO.observe(momViewport);

    // Hand control back to the visitor the moment they touch it.
    ['mouseenter', 'pointerdown', 'touchstart', 'focusin'].forEach(ev =>
      momViewport.addEventListener(ev, stopAuto, { passive: true }));
    momViewport.addEventListener('mouseleave', startAuto);
    document.addEventListener('visibilitychange', () => document.hidden ? stopAuto() : startAuto());

    const manual = (dir) => { stopAuto(); goRelative(dir); };
    if (prev) prev.addEventListener('click', () => manual(-1));
    if (next) next.addEventListener('click', () => manual(1));

    momViewport.addEventListener('scroll', () => { paint(); syncActiveMoment(); }, { passive: true });
    window.addEventListener('resize', () => { paint(); syncActiveMoment(); });
    paint();
    syncActiveMoment();
  }

  /* ---------------------------------------------------------
     STUDIO HOURS — live open/closed badge (IST)
     --------------------------------------------------------- */
  const hoursNow = $('#hoursNow');
  if (hoursNow) {
    const OPEN_HOUR = 10, CLOSE_HOUR = 19;   // Mon–Sat, 10am–7pm IST
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(new Date());
    const get = t => (parts.find(p => p.type === t) || {}).value;
    const day = get('weekday');
    const hour = parseInt(get('hour'), 10);
    const isWorkday = day !== 'Sun';
    const isOpen = isWorkday && hour >= OPEN_HOUR && hour < CLOSE_HOUR;

    hoursNow.textContent = isOpen
      ? 'Open today · 10:00 am – 7:00 pm IST'
      : 'Closed now · Mon – Sat, 10:00 am – 7:00 pm IST';
    const dot = $('#openDot');
    if (dot) dot.classList.toggle('open', isOpen);
  }

  try {
    const cached = localStorage.getItem('fbf_gallery_cache');
    if (cached) renderGalleryData(JSON.parse(cached));
  } catch (e) { /* ignore */ }

  (async function loadDriveGallery() {
    if (!GDRIVE_API_URL) return;
    try {
      const res = await fetch(GDRIVE_API_URL);
      const data = await res.json();
      if (data.status === 'success' && data.photos && data.photos.length) {
        try { localStorage.setItem('fbf_gallery_cache', JSON.stringify(data)); } catch (e) {}
        renderGalleryData(data);
      }
    } catch (err) {
      console.warn('Google Drive gallery unavailable, showing local frames.', err);
    }
  })();

  /* ---------------------------------------------------------
     LIGHTBOX (shared by gallery + instagram)
     --------------------------------------------------------- */
  const lightbox = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbBlur = $('#lbBlur');
  const lbSidePrev = $('#lbSidePrev');
  const lbSideNext = $('#lbSideNext');
  const lbCaption = $('#lbCaption');
  let lbItems = [];
  let lbIndex = 0;

  function preload(url) { if (url) { const i = new Image(); i.src = url; } }

  function openLightbox(items, index) {
    if (!items || !items.length) return;
    lbItems = items;
    lbIndex = index > -1 ? index : 0;
    paintLightbox();
    lightbox.classList.add('open');
    document.body.classList.add('locked');
  }
  function paintLightbox() {
    const item = lbItems[lbIndex];
    if (!item) return;
    lbImg.onerror = () => {
      if (item.altSrc && lbImg.src !== item.altSrc) lbImg.src = item.altSrc;
    };
    lbImg.src = item.src;
    lbImg.alt = item.alt || '';
    // the same photo, blown up and blurred, sits behind it
    if (lbBlur) lbBlur.style.backgroundImage = 'url("' + item.src + '")';

    // neighbours peek in from the edges
    const many = lbItems.length > 1;
    const neighbour = (el, idx) => {
      if (!el) return;
      el.hidden = !many;
      if (!many) return;
      const n = lbItems[idx];
      el.onerror = () => { if (n.altSrc && el.src !== n.altSrc) el.src = n.altSrc; };
      el.src = n.src;
    };
    neighbour(lbSidePrev, (lbIndex - 1 + lbItems.length) % lbItems.length);
    neighbour(lbSideNext, (lbIndex + 1) % lbItems.length);
    if (lbCaption) lbCaption.textContent = item.caption || '';
    preload((lbItems[(lbIndex + 1) % lbItems.length] || {}).src);
    preload((lbItems[(lbIndex - 1 + lbItems.length) % lbItems.length] || {}).src);
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
    if (!document.body.classList.contains('menu-open')) document.body.classList.remove('locked');
  }
  function stepLightbox(dir) {
    lbIndex = (lbIndex + dir + lbItems.length) % lbItems.length;
    paintLightbox();
  }

  if (lightbox) {
    $('#lbClose').addEventListener('click', closeLightbox);
    $('#lbPrev').addEventListener('click', () => stepLightbox(-1));
    $('#lbNext').addEventListener('click', () => stepLightbox(1));
    if (lbSidePrev) lbSidePrev.addEventListener('click', () => stepLightbox(-1));
    if (lbSideNext) lbSideNext.addEventListener('click', () => stepLightbox(1));
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') stepLightbox(-1);
      if (e.key === 'ArrowRight') stepLightbox(1);
    });
  }

  const instaItems = $$('.insta-item');
  instaItems.forEach((item, i) => {
    item.addEventListener('click', () => {
      openLightbox(instaItems.map(el => ({
        src: el.dataset.full,
        alt: (el.querySelector('img') || {}).alt || '',
        caption: '@fusionbellsfilms'
      })), i);
    });
  });

  /* ---------------------------------------------------------
     TESTIMONIAL SLIDER
     --------------------------------------------------------- */
  const tTrack = $('#tTrack');
  const tDotsWrap = $('#tDots');
  const tCards = tTrack ? $$('.t-card', tTrack) : [];
  let tIndex = 0;
  let tPerView = 2;
  let tTimer = null;

  function tMax() { return Math.max(tCards.length - tPerView, 0); }

  function buildTDots() {
    if (!tDotsWrap) return;
    tDotsWrap.innerHTML = '';
    for (let i = 0; i <= tMax(); i++) {
      const d = document.createElement('button');
      d.className = 't-dot' + (i === tIndex ? ' active' : '');
      d.setAttribute('aria-label', 'Review group ' + (i + 1));
      d.addEventListener('click', () => { goToT(i); restartT(); });
      tDotsWrap.appendChild(d);
    }
  }
  function goToT(i) {
    if (!tCards.length) return;
    const max = tMax();
    tIndex = i < 0 ? max : (i > max ? 0 : i);
    tTrack.style.transform = 'translateX(-' + (tIndex * (100 / tPerView)) + '%)';
    $$('.t-dot', tDotsWrap).forEach((d, n) => d.classList.toggle('active', n === tIndex));
  }
  function restartT() {
    clearInterval(tTimer);
    tTimer = setInterval(() => goToT(tIndex + 1), 6500);
  }
  function syncT() {
    const next = window.innerWidth <= 860 ? 1 : 2;
    if (next !== tPerView) {
      tPerView = next;
      tIndex = Math.min(tIndex, tMax());
      buildTDots();
    }
    goToT(tIndex);
  }
  if (tCards.length) {
    syncT();
    buildTDots();
    goToT(0);
    restartT();
    const tPrev = $('#tPrev');
    const tNext = $('#tNext');
    if (tPrev) tPrev.addEventListener('click', () => { goToT(tIndex - 1); restartT(); });
    if (tNext) tNext.addEventListener('click', () => { goToT(tIndex + 1); restartT(); });
    const wrapEl = $('.t-track-wrap');
    wrapEl.addEventListener('mouseenter', () => clearInterval(tTimer));
    wrapEl.addEventListener('mouseleave', restartT);
  }

  /* ---------------------------------------------------------
     JOURNAL — expand / collapse
     --------------------------------------------------------- */
  $$('.post-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const post = btn.closest('.post');
      const open = post.classList.toggle('open');
      btn.textContent = open ? 'Read less' : 'Read more';
    });
  });

  /* ---------------------------------------------------------
     COOKIE BANNER
     --------------------------------------------------------- */
  const cookie = $('#cookie');
  if (cookie) {
    let choice = null;
    try { choice = localStorage.getItem('fbf_cookie_choice'); } catch (e) {}
    // Hold the banner back until the visitor has scrolled past the hero,
    // so it never sits on top of the hero call-to-actions.
    if (!choice) {
      const showCookie = () => {
        cookie.classList.add('show');
        document.body.classList.add('cookie-visible');
        window.removeEventListener('scroll', onCookieScroll);
        clearTimeout(cookieFallback);
      };
      const onCookieScroll = () => { if (window.scrollY > window.innerHeight * 0.55) showCookie(); };
      const cookieFallback = setTimeout(showCookie, 20000);
      window.addEventListener('scroll', onCookieScroll, { passive: true });
      onCookieScroll();
    }
    const decide = (value) => {
      try { localStorage.setItem('fbf_cookie_choice', value); } catch (e) {}
      cookie.classList.remove('show');
      document.body.classList.remove('cookie-visible');
    };
    $('#cookieAccept').addEventListener('click', () => decide('accepted'));
    $('#cookieDecline').addEventListener('click', () => decide('declined'));
  }

  /* ---------------------------------------------------------
     ENQUIRY FORM → WhatsApp
     --------------------------------------------------------- */
  const form = $('#enquiryForm');
  const formMsg = $('#formMsg');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const lines = [
        `Hi Fusion Bells Films! I'm ${data.get('name') || ''} (${data.get('phone') || ''}).`,
        `Wedding date: ${data.get('date') || 'flexible'}`,
        `Interested in: ${data.get('service') || ''}`,
        `Venue: ${data.get('venue') || ''}`,
        data.get('message') || ''
      ].filter(Boolean);
      const waUrl = 'https://wa.me/918970511524?text=' + encodeURIComponent(lines.join('\n'));
      if (formMsg) formMsg.classList.add('show');
      form.reset();
      window.open(waUrl, '_blank', 'noopener');
    });
  }

  /* ---------------------------------------------------------
     RESIZE
     --------------------------------------------------------- */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { syncT(); parallax(); }, 150);
  });

  onScroll();
})();
