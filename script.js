const root = document.documentElement;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Tema: light (carta) / dark (cianografia) ---------- */
const themeBtn = document.getElementById('theme');
const themeLabel = document.getElementById('theme-label');
const switchBtns = document.querySelectorAll('[data-set-theme]');
const isDark = () => root.dataset.theme
  ? root.dataset.theme === 'dark'
  : window.matchMedia('(prefers-color-scheme: dark)').matches;
function syncTheme() {
  const dark = isDark();
  themeLabel.textContent = dark ? 'Dark' : 'Light';
  switchBtns.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.setTheme === 'dark') === dark)));
}
function setTheme(t) {
  root.dataset.theme = t;
  try { localStorage.setItem('gc-theme', t); } catch (e) {}
  syncTheme();
}
syncTheme();
themeBtn.addEventListener('click', () => setTheme(isDark() ? 'light' : 'dark'));
switchBtns.forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.setTheme)));
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

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

/* ---------- Elenco progetti: la colonna del nome parte sempre su una linea della griglia ---------- */
// I quadretti dello sfondo sono di 24 px: la colonna del numero si allarga quanto basta
// (da 56 px in su) perché il nome del progetto cominci sulla linea successiva.
const regHead = document.querySelector('.reg-head');
function allineaElenco() {
  if (!regHead) return;
  const x = regHead.getBoundingClientRect().left + scrollX, gap = 16;
  const inizioNome = Math.ceil((x + 56 + gap) / 24) * 24;
  regHead.parentElement.style.setProperty('--reg-num', `${inizioNome - x - gap}px`);
}
allineaElenco();
addEventListener('resize', allineaElenco);

/* ---------- Su telefono: una tavola per pagina ----------
   Sotto i 640 px ogni sezione si apre da sola, come una pagina: il menu, i pulsanti e gli indirizzi #tav-0X
   la mostrano e tornano in cima; in fondo a ogni tavola ci sono la precedente e la successiva.
   Su schermi più larghi il sito resta un'unica tavola continua. */
const tavole = [...document.querySelectorAll('section.tav')];
const telefono = window.matchMedia('(max-width: 640px)');
tavole.forEach((t, i) => {
  const prima = tavole[i - 1], dopo = tavole[i + 1];
  const voce = (x, dir) => x
    ? `<a class="pager-${dir}" href="#${x.id}"><small>${dir === 'prev' ? '← Tavola precedente' : 'Tavola successiva →'}</small><b>${x.dataset.tav} · ${x.dataset.name}</b></a>`
    : '<span></span>';
  t.insertAdjacentHTML('beforeend', `<nav class="pager" aria-label="Tavole">${voce(prima, 'prev')}${voce(dopo, 'next')}</nav>`);
});
const tavolaDa = (hash) => tavole.find((t) => '#' + t.id === hash) || tavole[0];
function mostraTavola(hash, inCima) {
  const att = tavolaDa(hash);
  tavole.forEach((t) => t.classList.toggle('attiva', t === att));
  document.querySelectorAll('.topbar nav a').forEach((a) => {
    if (a.getAttribute('href') === '#' + att.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  att.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  allineaElenco();
  if (inCima) window.scrollTo({ top: 0, behavior: 'instant' });
}
function modoPagine() {
  document.body.classList.toggle('paged', telefono.matches);
  if (telefono.matches) mostraTavola(location.hash, false);
  else document.querySelectorAll('.topbar nav a').forEach((a) => a.removeAttribute('aria-current'));
}
modoPagine();
telefono.addEventListener('change', () => {
  const att = tavole.find((t) => t.classList.contains('attiva'));
  modoPagine();
  if (!telefono.matches && att) att.scrollIntoView();
});
// Con le pagine attive, un link a una tavola cambia pagina invece di scorrere
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#tav-"]');
  if (!a || !telefono.matches) return;
  e.preventDefault();
  if (location.hash !== a.getAttribute('href')) history.pushState(null, '', a.getAttribute('href'));
  mostraTavola(a.getAttribute('href'), true);
});
addEventListener('popstate', () => { if (telefono.matches) mostraTavola(location.hash, true); });
