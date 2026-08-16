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
  // Only valid in-page anchors (longer than '#') can drive the active-section underline;
  // cross-page links or '#' are safely ignored.
  const navAnchors = $$('.nav-links a').filter(a => {
    const href = (a.getAttribute('href') || '').trim();
    return href.startsWith('#') && href.length > 1;
  });
  const sections = navAnchors
    .map(a => {
      try {
        const target = a.getAttribute('href');
        return target && target.length > 1 ? document.querySelector(target) : null;
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
  let lastY = window.scrollY;

  function onScroll() {
    const y = window.scrollY;
    const vh = window.innerHeight;
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
        if (sec.getBoundingClientRect().top <= vh * 0.4) current = sec.id;
      });
      navAnchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
    }

    ScrollFX.frame(y, vh);
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });

  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------------------------------------------------------
     SCROLLFX — one scroll-driven motion engine
     ---------------------------------------------------------
     Everything that moves with the scrollbar goes through here, so the page
     reads scroll position once per frame and only ever writes transforms.
     Element geometry is measured up front and re-measured on resize; nothing
     inside the frame loop touches layout, which is what keeps it smooth.

     Opt in from the markup:
       data-fx="drift"   data-fx-speed="0.4"   (vertical depth)
       data-fx="track"                          (horizontal strip)
       data-fx="hero"                           (layered hero)
     --------------------------------------------------------- */
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const bigScreen = window.matchMedia('(min-width: 900px)');

  const ScrollFX = (function () {
    let items = [];
    let progressBar = null;
    let enabled = !reduceMotion && !saveData;

    function measure() {
      const vh = window.innerHeight;
      const wide = bigScreen.matches;

      items.forEach(item => {
        // A track needs its own height set before anything is measured: give it
        // viewport + strip overflow so one screen of scrolling pans one screen
        // sideways. Clearing it lets the mobile fallback lay out normally.
        if (item.kind === 'track' && item.inner) {
          item.el.style.height = '';
          if (wide && enabled) {
            const viewport = item.inner.parentElement;
            const overflow = Math.max(0, item.inner.scrollWidth - viewport.clientWidth);
            if (overflow > 0) item.el.style.height = (vh + overflow) + 'px';
            item.overflow = overflow;
          } else {
            item.overflow = 0;
            item.inner.style.transform = '';
          }
        }
        const r = item.el.getBoundingClientRect();
        item.top = r.top + window.scrollY;
        item.height = r.height;
        // Travel must be budgeted against the element that actually moves. On a
        // pinned section the driver is tall and the media is one screen high;
        // using the driver's height would slide the media clean past its edge.
        item.targetHeight = item.target ? item.target.getBoundingClientRect().height : r.height;
      });
    }

    function register(el) {
      const kind = el.dataset.fx;
      const item = {
        el: el,
        kind: kind,
        speed: parseFloat(el.dataset.fxSpeed || '0.35'),
        // drifting media is scaled up slightly so it has room to move
        // inside its frame without exposing an edge
        scale: parseFloat(el.dataset.fxScale || '1.2'),
        target: el.querySelector('[data-fx-target]') || el,
        counter: el.querySelector('[data-fx-counter]'),
        inner: el.querySelector('[data-fx-inner]'),
        layers: kind === 'hero' ? {
          bgs: Array.prototype.slice.call(el.querySelectorAll('[data-fx-bg]')),
          copy: el.querySelector('[data-fx-copy]'),
          chrome: Array.prototype.slice.call(el.querySelectorAll('[data-fx-chrome]'))
        } : null,
        top: 0, height: 0, overflow: 0
      };
      items.push(item);
    }

    // How far the element has travelled through the viewport: 0 entering, 1 leaving.
    function progressOf(item, scrollY, vh) {
      return (scrollY + vh - item.top) / (vh + item.height);
    }

    function frame(scrollY, vh) {
      if (progressBar) {
        const max = document.documentElement.scrollHeight - vh;
        progressBar.style.transform = 'scaleX(' + (max > 0 ? Math.min(scrollY / max, 1) : 0) + ')';
      }
      if (!enabled) return;

      const wide = bigScreen.matches;

      items.forEach(item => {
        // Skip anything comfortably off-screen.
        if (item.top + item.height < scrollY - vh || item.top > scrollY + vh * 2) return;
        const p = progressOf(item, scrollY, vh);

        if (item.kind === 'drift') {
          // Travel comes from the headroom the zoom creates: a 1.3 scale on a
          // 700px band hides 105px above and below, so the media can move that
          // far and no further. Bigger scale = deeper parallax, never a gap.
          const range = (item.scale - 1) * item.targetHeight * 0.5;
          const clamped = Math.min(Math.max(p, 0), 1);
          const shift = (clamped - 0.5) * 2 * range;
          item.target.style.transform =
            'translate3d(0,' + shift.toFixed(2) + 'px,0) scale(' + item.scale + ')';
          // Copy riding on top drifts the other way, which is what actually
          // sells the depth — two planes separating, not one thing sliding.
          if (item.counter) {
            item.counter.style.transform = 'translate3d(0,' + (-shift * 0.42).toFixed(2) + 'px,0)';
          }

        } else if (item.kind === 'hero') {
          const y = scrollY;
          if (y > vh * 1.4) return;
          const t = y / vh;
          item.layers.bgs.forEach(bg => {
            bg.style.transform = 'translate3d(0,' + (y * 0.5).toFixed(2) + 'px,0) scale(' +
              (1 + t * 0.12).toFixed(4) + ')';
          });
          if (item.layers.copy) {
            item.layers.copy.style.transform = 'translate3d(0,' + (y * 0.28).toFixed(2) + 'px,0)';
            item.layers.copy.style.opacity = String(Math.max(0, 1 - y / (vh * 0.62)));
          }
          if (item.layers.chrome) {
            item.layers.chrome.forEach(c => {
              c.style.opacity = String(Math.max(0, 1 - y / (vh * 0.35)));
            });
          }

        } else if (item.kind === 'track' && item.inner) {
          // Horizontal strip: only on wide screens, and only while pinned.
          if (!wide || !item.overflow) { item.inner.style.transform = ''; return; }
          const travel = item.height - vh;
          if (travel <= 0) return;
          const t = Math.min(Math.max((scrollY - item.top) / travel, 0), 1);
          item.inner.style.transform = 'translate3d(' + (-t * item.overflow).toFixed(2) + 'px,0,0)';
        }
      });
    }

    function init() {
      progressBar = $('#scrollProgress');
      $$('[data-fx]').forEach(register);
      measure();

      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => measure());
        items.forEach(i => ro.observe(i.el));
      }
      window.addEventListener('resize', measure);
      window.addEventListener('load', measure);
      bigScreen.addEventListener('change', () => { measure(); });

      frame(window.scrollY, window.innerHeight);
    }

    return { init: init, frame: frame, measure: measure, isEnabled: () => enabled };
  })();

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
     SERVICES DROPDOWN (Hover grace period + click toggle)
     --------------------------------------------------------- */
  const dropdownContainers = $$('.has-dropdown');
  dropdownContainers.forEach(container => {
    const trigger = container.querySelector(':scope > a') || container.querySelector('a');
    let hideTimer = null;

    if (trigger) {
      trigger.addEventListener('click', (e) => {
        // Toggle dropdown open on direct click or tap
        const wasOpen = container.classList.contains('open');
        dropdownContainers.forEach(c => c.classList.remove('open'));
        if (!wasOpen) container.classList.add('open');
      });
    }

    container.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer);
      container.classList.add('open');
    });

    container.addEventListener('mouseleave', () => {
      hideTimer = setTimeout(() => {
        container.classList.remove('open');
      }, 300);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.has-dropdown')) {
      dropdownContainers.forEach(c => c.classList.remove('open'));
    }
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

  // Works out once which of the candidate files actually exists, and shares that
  // answer with every background video, so the check costs one request total.
  const resolveSource = (function () {
    const cache = {};
    return function (list) {
      const key = list.join('|');
      if (cache[key]) return cache[key];
      cache[key] = (async () => {
        for (const candidate of list) {
          try {
            const probe = await fetch(candidate, { method: 'HEAD' });
            if (probe.ok) return candidate;
          } catch (err) { /* try the next one */ }
        }
        return null;
      })();
      return cache[key];
    };
  })();

  /* ---------------------------------------------------------
     FILMS
     ---------------------------------------------------------
     Each film declares where it lives, so they can be mixed freely:
       { type:'file',    src:'video/name.mp4' }
       { type:'youtube', id:'dQw4w9WgXcQ' }        <- fastest, recommended
       { type:'drive',   id:'<drive file id>' }    <- auto-filled from Drive
     Anything in the Drive "Video" folder is appended automatically once the
     Apps Script is redeployed.
     --------------------------------------------------------- */
  const FILMS = [
    // These two are a hybrid on purpose:
    //   `id`      -> the full film, played from Drive when someone clicks play
    //   `sources` -> a short silent loop committed to the repo, used for the
    //                muted background. Drive cannot autoplay, so the background
    //                has to be a real file; the full film never needs to be.
    {
      key: 'showcase',
      title: 'Gowthami & Samarth',
      label: 'Pre-wedding film',
      type: 'drive',
      id: '19EfXj8FfKqQWbt1k8X5nU8fjyhKhzdD6',
      sources: ['video/hero-web.mp4'],
      poster: 'images/embrace-sky.webp'
    },
    {
      key: 'dubai',
      title: 'Dubai Pre-wedding',
      label: 'Pre-wedding film',
      type: 'drive',
      id: '1i9r8MXDAMif_WN1NYXsmDstZsXc_qw4h',
      sources: ['video/dubai-web.mp4'],
      poster: 'images/dubai-poster.jpg'
    }
  ];

  // Which Drive film a named button should open, when no local file is set.
  // Patterns are tried in order, so the exact film wins over a loose match.
  const KEY_MATCHERS = {
    showcase: [/gowthami[\s\S]*prewed song/i, /prewed song/i, /gowthami|samarth/i],
    dubai: [/dubai/i, /desert/i]
  };

  function filmIndexForKey(key) {
    // a curated entry wins, but only if its file actually exists
    let i = FILMS.findIndex(f => f.key === key && f.ready);
    if (i > -1) return i;
    const patterns = KEY_MATCHERS[key] || [];
    for (const re of patterns) {
      i = FILMS.findIndex(f => f.ready && re.test((f.title || '') + ' ' + (f.label || '')));
      if (i > -1) return i;
    }
    return -1;
  }

  function filmIndexFor(trigger) {
    if (trigger.dataset.filmIndex) return parseInt(trigger.dataset.filmIndex, 10);
    if (trigger.dataset.filmKey) return filmIndexForKey(trigger.dataset.filmKey);
    return parseInt(trigger.dataset.film, 10) || 0;
  }

  /* Drive filenames are working titles — tidy them for display. Doing this
     here rather than in the Apps Script means renaming rules never need
     another deployment. */
  function prettyName(text, fallback) {
    let s = String(text || '').replace(/[._]+/g, ' ');
    s = s.replace(/\b(fbf|fusion bells films|fusion|final|export|copy|cc)\b/gi, ' ');
    s = s.replace(/([A-Za-z])(\d)/g, '$1 $2');        // Reception01 -> Reception 01
    s = s.replace(/\s+/g, ' ').trim();
    if (/^\d+$/.test(s) || !s) return fallback;        // "02" is not a title
    if (s === s.toUpperCase()) {                       // SHOUTY NAMES -> Title Case
      s = s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
           .replace(/\b(And|Of|The)\b/g, m => m.toLowerCase());
    }
    return s;
  }

  function filmPoster(film) {
    if (film.poster) return film.poster;
    if (film.type === 'youtube') return 'https://i.ytimg.com/vi/' + film.id + '/maxresdefault.jpg';
    if (film.type === 'drive') return 'https://drive.google.com/thumbnail?id=' + film.id + '&sz=w1280';
    return 'images/embrace-sky.webp';
  }

  const filmsBlock = $('#filmsBlock');
  const filmsGrid = $('#filmsGrid');

  // A film is only offered once we know it can actually play. Self-hosted
  // files are checked; Drive and YouTube entries carry their own id, so they
  // are taken at face value. This is what stops a play button from opening
  // an empty player.
  async function confirmFilms() {
    await Promise.all(FILMS.map(async (f) => {
      if (f.type === 'file') {
        // whichever of the candidate files exists becomes the one we play
        const found = await resolveSource(f.sources || [f.src]);
        if (found) f.src = found;
        f.ready = !!found;
      } else {
        f.ready = !!f.id;
      }
    }));
    renderFilms();
    // Point every named "play" button at a real film, or hide it outright.
    $$('[data-film-key]').forEach(btn => {
      const idx = filmIndexForKey(btn.dataset.filmKey);
      if (idx > -1) { btn.dataset.filmIndex = String(idx); btn.hidden = false; }
      else { delete btn.dataset.filmIndex; btn.hidden = true; }
    });
  }

  function renderFilms() {
    if (!filmsGrid) return;
    const ready = FILMS.filter(f => f.ready);
    if (!ready.length) { if (filmsBlock) filmsBlock.hidden = true; return; }
    if (filmsBlock) filmsBlock.hidden = false;

    filmsGrid.innerHTML = FILMS.map((f, i) => f.ready ? `
      <button class="film-card" type="button" data-film="${i}" aria-label="Play ${esc(f.title)}">
        <span class="film-poster">
          <img src="${esc(filmPoster(f))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
          <span class="film-play"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>
        </span>
        <span class="film-meta"><b>${esc(f.title)}</b><i>${esc(f.label || 'Wedding film')}</i></span>
      </button>` : '').join('');

    $$('.film-card', filmsGrid).forEach(card => observe(card));
  }

  /* ---------- video modal ---------- */
  const videoModal = $('#videoModal');
  const vmStage = $('#vmStage');
  const vmTitle = $('#vmTitle');
  const vmBlur = $('#vmBlur');

  function openFilm(index) {
    const film = FILMS[index];
    if (!film || !videoModal) return;

    if (vmBlur) vmBlur.style.backgroundImage = 'url("' + filmPoster(film) + '")';
    if (vmTitle) vmTitle.textContent = film.title + (film.label ? ' — ' + film.label : '');

    vmStage.innerHTML = '';
    if (film.type === 'youtube') {
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + film.id +
              '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      f.title = film.title;
      vmStage.appendChild(f);
    } else if (film.type === 'drive') {
      const f = document.createElement('iframe');
      f.src = 'https://drive.google.com/file/d/' + film.id + '/preview';
      f.allow = 'autoplay';
      f.allowFullscreen = true;
      f.title = film.title;
      vmStage.appendChild(f);
    } else {
      const v = document.createElement('video');
      v.src = film.src;
      v.controls = true; v.autoplay = true; v.playsInline = true;
      v.poster = filmPoster(film);
      // A missing file should read as "not uploaded yet", not a black hole.
      v.addEventListener('error', () => {
        vmStage.innerHTML = '<div class="vm-note">This film is still being uploaded &mdash;' +
          ' please check back shortly, or ask us for a private link.</div>';
      });
      vmStage.appendChild(v);
    }

    videoModal.classList.add('open');
    document.body.classList.add('locked');
  }

  function closeFilm() {
    if (!videoModal) return;
    videoModal.classList.remove('open');
    // Tear the player out entirely — pausing an iframe is not possible, and a
    // lingering <video> keeps its audio going behind the page.
    setTimeout(() => { if (vmStage) vmStage.innerHTML = ''; }, 300);
    if (!document.body.classList.contains('menu-open')) document.body.classList.remove('locked');
  }

  if (videoModal) {
    $('#vmClose').addEventListener('click', closeFilm);
    videoModal.addEventListener('click', (e) => { if (e.target === videoModal) closeFilm(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && videoModal.classList.contains('open')) closeFilm();
    });
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-film], [data-film-key]');
      if (trigger) openFilm(filmIndexFor(trigger));
    });
  }

  confirmFilms();

  /* ---------------------------------------------------------
     HERO + SHOWREEL BACKGROUND VIDEO
     --------------------------------------------------------- */
  // Background clips are muted, looping and only fetched once scrolled into
  // view, so they run on phones too — we only skip them when the visitor has
  // asked for less motion, less data, or is on a genuinely slow connection.
  function canPlayBackgroundVideo() {
    const conn = navigator.connection;
    const slow = conn && /(^|-)2g$/.test(String(conn.effectiveType || ''));
    return !reduceMotion && !saveData && !slow;
  }

  // Accepts one src or a list tried in order (mp4 first, webm as a smaller
  // alternative). Returns quietly if none of them exist, leaving the poster
  // imagery in place.
  async function mountBackgroundVideo(video, sources, onPlaying) {
    if (!video || !canPlayBackgroundVideo()) return;
    const list = [].concat(sources).filter(Boolean);
    if (!list.length) return;

    const src = await resolveSource(list);
    if (!src) return;

    video.src = src;
    video.load();
    const start = () => video.play().catch(() => { /* browser refused; poster stays */ });

    video.addEventListener('canplay', () => {
      video.classList.add('is-playing');
      if (onPlaying) onPlaying();
    }, { once: true });
    video.addEventListener('error', () => video.removeAttribute('src'), { once: true });

    // Only run while on screen — background video off-screen is wasted battery.
    new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? start() : video.pause());
    }, { threshold: 0.05 }).observe(video);
  }

  const heroVideo = $('#heroVideo');
  const heroSound = $('#heroSound');
  const heroSoundLabel = $('#heroSoundLabel');

  const filmByKey = (k) => FILMS[FILMS.findIndex(f => f.key === k)] || {};
  const HERO_SOURCES = filmByKey('showcase').sources || [];

  mountBackgroundVideo(heroVideo, HERO_SOURCES, () => {
    clearInterval(heroTimer);           // the photo carousel steps aside
    if (heroSound) heroSound.hidden = false;
  });

  if (heroSound && heroVideo) {
    heroSound.addEventListener('click', () => {
      heroVideo.muted = !heroVideo.muted;
      heroSound.setAttribute('aria-label', heroVideo.muted ? 'Turn sound on' : 'Turn sound off');
      if (heroSoundLabel) heroSoundLabel.textContent = heroVideo.muted ? 'Sound on' : 'Sound off';
    });
  }

  mountBackgroundVideo($('#showreelVideo'), HERO_SOURCES);
  mountBackgroundVideo($('#featureVideo'), filmByKey('dubai').sources || []);

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
    // Films come back in their own array, never mixed into the photo gallery.
    mergeDriveFilms(data.videos);

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

  // Films from the Drive "Video" folder, appended after the curated ones.
  function mergeDriveFilms(list) {
    if (!list || !list.length) return;
    const known = FILMS.map(f => f.id || f.src);
    let added = 0;
    list.forEach(v => {
      if (!v || !v.id || known.indexOf(v.id) !== -1) return;
      FILMS.push(Object.assign({}, v, {
        title: prettyName(v.title, 'Wedding film'),
        label: prettyName(v.label, 'Wedding film')
      }));
      added++;
    });
    if (added) confirmFilms();
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
    if (wrapEl) {
      wrapEl.addEventListener('mouseenter', () => clearInterval(tTimer));
      wrapEl.addEventListener('mouseleave', restartT);
    }
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
     ENQUIRY FORM → Validation & Submit
     --------------------------------------------------------- */
  const form = $('#enquiryForm');
  const formMsg = $('#formMsg');
  const formSubmit = $('#formSubmit');
  const pageLoadedAt = Date.now();

  // Phone input filtering & sanitization
  const phoneInputs = $$('input[name="phone"]');
  phoneInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      // Allow only digits, +, space, hyphen, and parentheses
      let val = e.target.value.replace(/[^\d\s\+\-\(\)]/g, '');
      // Ensure + is only at the beginning
      if (val.indexOf('+') > 0) {
        val = val.charAt(0) + val.slice(1).replace(/\+/g, '');
      }
      if (val.length > 16) val = val.slice(0, 16);
      e.target.value = val;
    });
  });

  // Date picker: enforce upcoming dates (min = today)
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const maxYearStr = `${yyyy + 4}-12-31`;

  $$('input[type="date"]').forEach(inp => {
    inp.min = todayStr;
    inp.max = maxYearStr;
  });

  function whatsappLink(data) {
    const cleanPhone = (data.phone || '').replace(/[^\d\+]/g, '');
    const lines = [
      `Hi Fusion Bells Films! I'm ${data.name || ''} (${cleanPhone}).`,
      `Wedding date: ${data.date || 'flexible'}`,
      `Interested in: ${data.service || ''}`,
      `Venue: ${data.venue || ''}`,
      data.message || ''
    ].filter(Boolean);
    return 'https://wa.me/918970511524?text=' + encodeURIComponent(lines.join('\n'));
  }

  function setMessage(text, isError) {
    if (!formMsg) return;
    formMsg.innerHTML = text;
    formMsg.classList.add('show');
    formMsg.classList.toggle('is-error', !!isError);
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.pageUrl = location.href;
      data._ts = pageLoadedAt;

      // Client-side validations
      const name = (data.name || '').trim();
      const phone = (data.phone || '').trim();
      const email = (data.email || '').trim();
      const phoneDigits = phone.replace(/\D/g, '');

      if (name.length < 2) {
        setMessage('Please enter your full name (at least 2 letters).', true);
        const nameEl = form.querySelector('input[name="name"]');
        if (nameEl) nameEl.focus();
        return;
      }

      if (!phone && !email) {
        setMessage('Please provide either a phone number or email address so we can reach you.', true);
        return;
      }

      if (phone && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
        setMessage('Please enter a valid phone number with 8 to 15 digits (e.g. +91 98765 43210).', true);
        const phoneEl = form.querySelector('input[name="phone"]');
        if (phoneEl) phoneEl.focus();
        return;
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setMessage('Please enter a valid email address (e.g. name@example.com).', true);
        const emailEl = form.querySelector('input[name="email"]');
        if (emailEl) emailEl.focus();
        return;
      }

      // Validate event date (upcoming dates only)
      if (data.date) {
        const parts = String(data.date).split('-');
        if (parts.length === 3) {
          const selected = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (selected < startOfToday) {
            setMessage('Please choose an upcoming date for your event.', true);
            const dateEl = form.querySelector('input[name="date"]');
            if (dateEl) dateEl.focus();
            return;
          }
        }
      }

      const label = formSubmit ? formSubmit.textContent : '';
      if (formSubmit) { formSubmit.disabled = true; formSubmit.textContent = 'Sending…'; }
      setMessage('', false);

      try {
        const res = await fetch('/api/enquiry', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data)
        });
        const out = await res.json().catch(() => ({}));

        if (res.ok && out.ok) {
          form.reset();
          setMessage(out.acknowledged
            ? 'Thank you — your enquiry is with us, and a confirmation email is on its way to your inbox (' + (data.email || '') + '). We reply within 24 hours.'
            : 'Thank you — your enquiry is with us. We reply within 24 hours.');
        } else if (res.status === 404 && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
          // Local preview server note
          setMessage('<b>Local Preview Note:</b> The email auto-reply function (<code>/api/enquiry</code>) runs on Cloudflare Pages with Zoho ZeptoMail API when deployed. ' +
            `<br><br><a href="${whatsappLink(data)}" target="_blank" rel="noopener" class="btn btn-solid btn-sm" style="display:inline-block; margin-top:8px;">Test WhatsApp Message Link &rarr;</a>`, false);
        } else if (out.fallback || res.status >= 500 || res.status === 404) {
          // Service misconfigured or endpoint unavailable
          setMessage('We could not send that right now. ' +
            `<a href="${whatsappLink(data)}" target="_blank" rel="noopener">Message us directly on WhatsApp</a> ` +
            'and we will assist you immediately.', true);
        } else {
          setMessage(out.error || 'Please check your information and try again.', true);
        }
      } catch (err) {
        setMessage('Connection error. ' +
          `<a href="${whatsappLink(data)}" target="_blank" rel="noopener">Message us on WhatsApp</a> ` +
          'or email hello@fusionbellsfilms.com.', true);
      } finally {
        if (formSubmit) { formSubmit.disabled = false; formSubmit.textContent = label; }
      }
    });
  }

  /* ---------------------------------------------------------
     RESIZE
     --------------------------------------------------------- */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { syncT(); ScrollFX.measure(); }, 150);
  });

  ScrollFX.init();
  onScroll();
})();
