// ============================================================
// FUSION BELLS FILMS — site interactions
// ============================================================
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- NAV ---------- */
const siteNav = document.getElementById('siteNav');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  siteNav.classList.toggle('scrolled', window.scrollY > 40);
  document.getElementById('toTop').classList.toggle('show', window.scrollY > 900);
}, { passive: true });

navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

document.getElementById('toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ---------- HERO SLIDESHOW ---------- */
const slides = document.querySelectorAll('.hero-slide');
const frameNo = document.getElementById('frameNo');
let slideIdx = 0;
setInterval(() => {
  slides[slideIdx].classList.remove('active');
  slideIdx = (slideIdx + 1) % slides.length;
  slides[slideIdx].classList.add('active');
  frameNo.textContent = String(slideIdx + 1).padStart(2, '0');
}, 5200);

/* ---------- SCROLL REVEAL ---------- */
const revealEls = document.querySelectorAll('.reveal, .frame');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
revealEls.forEach(el => io.observe(el));

/* ---------- GALLERY & GOOGLE DRIVE INTEGRATION ---------- */
// Paste your deployed Google Apps Script Web App URL below:
const GDRIVE_API_URL = 'https://script.google.com/macros/s/AKfycbzLMnYaQUbAADkPPp2cv0651yJvcfkIKUEYyKqrMp8srUcRZmDKPqUSFgV5CG4ZP_MtfA/exec'; 

let frames = document.querySelectorAll('.frame');
let gfButtons = document.querySelectorAll('.gf-btn');
const galleryEl = document.getElementById('gallery');
const filterContainer = document.querySelector('.gallery-filters');

function initGalleryListeners() {
  frames = document.querySelectorAll('.frame');
  gfButtons = document.querySelectorAll('.gf-btn');

  // Filter Buttons
  gfButtons.forEach(btn => {
    btn.onclick = () => {
      gfButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      frames.forEach(f => {
        const show = filter === 'all' || f.dataset.cat === filter;
        f.style.display = show ? '' : 'none';
      });
    };
  });

  // Lightbox click trigger
  frames.forEach(f => {
    f.onclick = () => openLightbox(f);
  });
}

// Render dynamic gallery data to DOM
function renderGalleryData(data) {
  if (!data || !data.photos || data.photos.length === 0) return;

  // 1. Render dynamic category buttons
  if (data.categories && data.categories.length > 0 && filterContainer) {
    filterContainer.innerHTML = '<button class="gf-btn active" data-filter="all">All</button>' +
      data.categories.map(c => `<button class="gf-btn" data-filter="${c.id}">${c.name}</button>`).join('');
  }

  // 2. Render dynamic photo frames
  if (galleryEl) {
    galleryEl.innerHTML = data.photos.map(p => `
      <div class="frame in" data-cat="${p.category}" data-full="${p.full}">
        <img src="${p.thumb}" loading="lazy" alt="${p.title}">
        <span class="frame-meta">Frame ${p.frameNo} — ${p.categoryName}</span>
      </div>
    `).join('');
  }

  // 3. Re-bind listeners for new frames
  initGalleryListeners();
}

// Initial binding for local fallback frames
initGalleryListeners();

// Instant cache restore
try {
  const cachedData = localStorage.getItem('fbf_gallery_cache');
  if (cachedData) {
    renderGalleryData(JSON.parse(cachedData));
  }
} catch (e) {}

// Dynamic Google Drive Fetch (with background cache update)
async function loadGoogleDriveGallery() {
  if (!GDRIVE_API_URL) return;

  try {
    const res = await fetch(GDRIVE_API_URL);
    const data = await res.json();

    if (data.status === 'success' && data.photos && data.photos.length > 0) {
      localStorage.setItem('fbf_gallery_cache', JSON.stringify(data));
      renderGalleryData(data);
    }
  } catch (err) {
    console.warn('Google Drive Gallery API fallback:', err);
  }
}

loadGoogleDriveGallery();

/* ---------- LIGHTBOX ---------- */
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbClose = document.getElementById('lbClose');
const lbPrev = document.getElementById('lbPrev');
const lbNext = document.getElementById('lbNext');
let visibleFrames = [];
let lbIndex = 0;

function preloadImage(url) {
  if (!url) return;
  const img = new Image();
  img.src = url;
}

function openLightbox(frame) {
  visibleFrames = Array.from(frames).filter(f => f.style.display !== 'none');
  lbIndex = visibleFrames.indexOf(frame);
  if (lbIndex === -1) lbIndex = 0;
  updateLbImg();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updateLbImg() {
  const f = visibleFrames[lbIndex];
  if (!f) return;
  lbImg.src = f.dataset.full;
  const imgEl = f.querySelector('img');
  lbImg.alt = imgEl ? imgEl.alt : 'Fusion Bells Films Photo';

  // Preload next and previous images for instant navigation
  const nextFrame = visibleFrames[(lbIndex + 1) % visibleFrames.length];
  const prevFrame = visibleFrames[(lbIndex - 1 + visibleFrames.length) % visibleFrames.length];
  if (nextFrame) preloadImage(nextFrame.dataset.full);
  if (prevFrame) preloadImage(prevFrame.dataset.full);
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}
lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
lbPrev.addEventListener('click', () => { lbIndex = (lbIndex - 1 + visibleFrames.length) % visibleFrames.length; updateLbImg(); });
lbNext.addEventListener('click', () => { lbIndex = (lbIndex + 1) % visibleFrames.length; updateLbImg(); });
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lbPrev.click();
  if (e.key === 'ArrowRight') lbNext.click();
});

/* ---------- TESTIMONIAL SLIDER ---------- */
const tTrack = document.getElementById('tTrack');
const tCards = document.querySelectorAll('.t-card');
const tDots = document.querySelectorAll('.t-dot');
let tIndex = 0;
function goToTestimonial(i) {
  tIndex = (i + tCards.length) % tCards.length;
  tTrack.style.transform = `translateX(-${tIndex * 100}%)`;
  tDots.forEach((d, idx) => d.classList.toggle('active', idx === tIndex));
}
tTrack.style.transition = 'transform .6s cubic-bezier(.22,.7,.2,1)';
document.getElementById('tPrev').addEventListener('click', () => goToTestimonial(tIndex - 1));
document.getElementById('tNext').addEventListener('click', () => goToTestimonial(tIndex + 1));
tDots.forEach(d => d.addEventListener('click', () => goToTestimonial(parseInt(d.dataset.i))));
let tAuto = setInterval(() => goToTestimonial(tIndex + 1), 6500);
document.querySelector('.t-track-wrap').addEventListener('mouseenter', () => clearInterval(tAuto));
document.querySelector('.t-track-wrap').addEventListener('mouseleave', () => { tAuto = setInterval(() => goToTestimonial(tIndex + 1), 6500); });

/* ---------- CONTACT FORM ---------- */
const form = document.getElementById('enquiryForm');
const formMsg = document.getElementById('formMsg');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = data.get('name') || '';
  const phone = data.get('phone') || '';
  const date = data.get('date') || 'flexible';
  const service = data.get('service') || '';
  const venue = data.get('venue') || '';
  const message = data.get('message') || '';

  // Primary path: open a pre-filled WhatsApp chat so the studio receives it instantly.
  const text = `Hi Fusion Bells Films! I'm ${name} (${phone}).%0AWedding date: ${date}%0AInterested in: ${service}%0AVenue: ${venue}%0A${message}`;
  const waUrl = `https://wa.me/918970511524?text=${text}`;

  formMsg.classList.add('show');
  form.reset();
  window.open(waUrl, '_blank');
});
