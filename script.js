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

/* ---------- Una tavola per pagina ----------
   Ogni sezione si apre da sola, come una pagina: il menu, i pulsanti e gli indirizzi #tav-0X la mostrano
   e tornano in cima; il tasto indietro del browser riporta alla tavola precedente.
   In fondo a ogni tavola ci sono la precedente e la successiva. */
const tavole = [...document.querySelectorAll('section.tav')];
tavole.forEach((t, i) => {
  const prima = tavole[i - 1], dopo = tavole[i + 1];
  const voce = (x, dir) => x
    ? `<a class="pager-${dir}" href="#${x.id}"><small>${dir === 'prev' ? '← Tavola precedente' : 'Tavola successiva →'}</small><b>${x.dataset.tav} · ${x.dataset.name}</b></a>`
    : '<span></span>';
  t.insertAdjacentHTML('beforeend', `<nav class="pager" aria-label="Tavole">${voce(prima, 'prev')}${voce(dopo, 'next')}</nav>`);
});
const tavolaDa = (hash) => tavole.find((t) => '#' + t.id === hash) || tavole[0];

/* Disegni: ogni tratto rosso o d'inchiostro si traccia, in sequenza; i gruppi blu (l'AI) compaiono dopo.
   Le animazioni CSS ripartono da sole ogni volta che una tavola torna visibile. */
if (!reduce) {
  document.querySelectorAll('.tav svg.schema').forEach((svg) => {
    let i = 0;
    svg.querySelectorAll('path, rect, circle, ellipse').forEach((el) => {
      if (el.closest('.s-blue') || el.classList.contains('pkt')) return;
      el.setAttribute('pathLength', '1');
      el.classList.add('dr');
      el.style.setProperty('--d', `${Math.min(i++ * 0.06, 1.2)}s`);
    });
    svg.querySelectorAll('.s-blue').forEach((g, k) => { g.classList.add('fade'); g.style.setProperty('--d', `${0.5 + k * 0.15}s`); });
  });
}

/* Numeri che contano da zero quando la tavola si apre */
function conta(tav) {
  tav.querySelectorAll('[data-count]').forEach((el) => {
    const fine = Number(el.dataset.count);
    if (reduce) { el.textContent = fine; return; }
    const t0 = performance.now(), dur = 900;
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(fine * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}

/* Testina del plotter che scende a ogni cambio di tavola */
const plotter = document.createElement('div');
plotter.className = 'plotter'; plotter.setAttribute('aria-hidden', 'true');
document.body.append(plotter);
function passaggio(tav) {
  if (reduce) return;
  [plotter, tav].forEach((el) => { el.classList.remove(el === plotter ? 'via' : 'entra'); void el.offsetWidth; });
  plotter.classList.add('via'); tav.classList.add('entra');
}

/* Elenco progetti: filtri per tipo */
document.querySelectorAll('.filters button').forEach((b) => b.addEventListener('click', () => {
  const f = b.dataset.f;
  document.querySelectorAll('.filters button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  document.querySelectorAll('.reg-row').forEach((r, i) => {
    const via = f !== 'tutti' && r.dataset.cat !== f;
    r.classList.toggle('fuori', via);
    r.classList.remove('entra');
    if (!via && !reduce) { void r.offsetWidth; r.style.animationDelay = `${i * 40}ms`; r.classList.add('entra'); }
  });
}));
function mostraTavola(hash, inCima) {
  const att = tavolaDa(hash);
  tavole.forEach((t) => t.classList.toggle('attiva', t === att));
  document.querySelectorAll('.topbar nav a').forEach((a) => {
    if (a.getAttribute('href') === '#' + att.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  cTav.textContent = att.dataset.tav; cName.textContent = att.dataset.name;
  document.title = att.id === 'tav-01' ? titoloBase : `${att.dataset.name} · ${titoloBase}`;
  att.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  allineaElenco();
  conta(att);
  passaggio(att);
  if (inCima) window.scrollTo({ top: 0, behavior: 'instant' });
}
const titoloBase = document.title;
document.body.classList.add('paged');
mostraTavola(location.hash, false);
// Un link a una tavola cambia pagina invece di scorrere
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#tav-"]');
  if (!a) return;
  e.preventDefault();
  if (location.hash !== a.getAttribute('href')) history.pushState(null, '', a.getAttribute('href'));
  mostraTavola(a.getAttribute('href'), true);
});
addEventListener('popstate', () => mostraTavola(location.hash, true));
