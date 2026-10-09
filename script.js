const root = document.documentElement;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Tema: carta / cianografia ---------- */
const themeBtn = document.getElementById('theme');
const themeLabel = document.getElementById('theme-label');
const isDark = () => root.dataset.theme
  ? root.dataset.theme === 'dark'
  : window.matchMedia('(prefers-color-scheme: dark)').matches;
const syncLabel = () => { themeLabel.textContent = isDark() ? 'Ciano' : 'Carta'; };
syncLabel();
themeBtn.addEventListener('click', () => {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try { localStorage.setItem('gc-theme', root.dataset.theme); } catch (e) {}
  syncLabel();
});

/* ---------- Mirino e coordinate ---------- */
const cross = document.querySelector('.crosshair');
const cx = document.getElementById('cx');
const cy = document.getElementById('cy');
const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, '0');
let mx = 0, my = 0, ticking = false;

function paintPointer() {
  ticking = false;
  cross.style.setProperty('--x', mx + 'px');
  cross.style.setProperty('--y', my + 'px');
  cx.textContent = pad(mx);
  cy.textContent = pad(my + window.scrollY);
  previews.style.setProperty('--px', mx + 'px');
  previews.style.setProperty('--py', my + 'px');
}
const previews = document.querySelector('.previews');

if (fine) {
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    cross.classList.add('on');
    if (!ticking) { ticking = true; requestAnimationFrame(paintPointer); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => cross.classList.remove('on'));
}

/* ---------- Anteprime dei progetti ---------- */
if (fine) {
  document.querySelectorAll('.reg-row').forEach((row) => {
    const pv = previews.querySelector(`[data-pv="${row.dataset.preview}"]`);
    row.addEventListener('pointerenter', () => { pv.classList.add('on'); cross.style.opacity = '0'; });
    row.addEventListener('pointerleave', () => { pv.classList.remove('on'); cross.style.opacity = ''; });
  });
}

/* ---------- Cartiglio: tavola corrente ---------- */
const cTav = document.getElementById('c-tav');
const cName = document.getElementById('c-name');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { cTav.textContent = e.target.dataset.tav; cName.textContent = e.target.dataset.name; }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('.tav').forEach((s) => sectionObserver.observe(s));

/* ---------- Comparse allo scroll ---------- */
const els = document.querySelectorAll('.reveal');
if (reduce || !('IntersectionObserver' in window)) {
  els.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  els.forEach((el) => io.observe(el));
}
