const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Tema light / dark (stessa preferenza del portfolio) ---------- */
const root = document.documentElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const switchBtns = document.querySelectorAll('[data-set-theme]');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : darkQuery.matches);
const syncTheme = () => switchBtns.forEach((b) =>
  b.setAttribute('aria-pressed', String((b.dataset.setTheme === 'dark') === isDark())));
switchBtns.forEach((b) => b.addEventListener('click', () => {
  root.dataset.theme = b.dataset.setTheme;
  try { localStorage.setItem('gc-theme', b.dataset.setTheme); } catch (e) {}
  syncTheme();
}));
darkQuery.addEventListener('change', syncTheme);
syncTheme();

/* ---------- Frigo: biglietti trascinabili ---------- */
const fridge = document.getElementById('fridge');
let zTop = 1;

fridge.querySelectorAll('.note').forEach((note) => {
  let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;

  note.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input, label')) return; // la lista della spesa resta cliccabile
    note.setPointerCapture(e.pointerId);
    note.classList.add('dragging');
    note.style.zIndex = ++zTop;
    sx = e.clientX; sy = e.clientY;
    ox = note.offsetLeft; oy = note.offsetTop;
    moved = false;
  });

  note.addEventListener('pointermove', (e) => {
    if (!note.classList.contains('dragging')) return;
    const maxX = fridge.clientWidth - note.offsetWidth;
    const maxY = fridge.clientHeight - note.offsetHeight;
    const x = Math.min(maxX, Math.max(0, ox + e.clientX - sx));
    const y = Math.min(maxY, Math.max(0, oy + e.clientY - sy));
    note.style.left = x + 'px';
    note.style.top = y + 'px';
    moved = true;
  });

  const drop = () => {
    if (!note.classList.contains('dragging')) return;
    note.classList.remove('dragging');
    // ricade con una nuova leggera inclinazione, come un biglietto vero
    if (moved) note.style.setProperty('--r', (Math.random() * 8 - 4).toFixed(1) + 'deg');
  };
  note.addEventListener('pointerup', drop);
  note.addEventListener('pointercancel', drop);
});

// Le posizioni iniziali sono in percentuale: sugli schermi stretti tengo i biglietti dentro il frigo
function fitNotes() {
  fridge.querySelectorAll('.note').forEach((note) => {
    const maxX = fridge.clientWidth - note.offsetWidth - 8;
    if (note.offsetLeft > maxX) note.style.left = Math.max(0, maxX) + 'px';
  });
}
fitNotes();
addEventListener('resize', fitNotes);

/* ---------- Ripartizione budget (schemi reali di Family Hub) ---------- */
const CATS = [
  { name: 'Casa e bollette', color: '#176854' },
  { name: 'Alimentari', color: '#e3a13a' },
  { name: 'Trasporti', color: '#6f8fb8' },
  { name: 'Salute e famiglia', color: '#bb514b' },
  { name: 'Svago', color: '#9d88c4' },
  { name: 'Risparmio', color: '#7cc0a2' },
];
const SCHEMES = {
  conservativa: [30, 15, 10, 5, 5, 35],
  prudente: [35, 20, 10, 10, 10, 15],
  equilibrata: [35, 15, 10, 5, 15, 20],
  svago: [30, 15, 10, 5, 30, 10],
};
// 'always' forza il punto delle migliaia anche su 4 cifre (2.800 invece di 2800)
const eur = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });
const income = document.getElementById('income');
const incomeOut = document.getElementById('income-out');
const stack = document.getElementById('stack');
const cats = document.getElementById('cats');

stack.innerHTML = CATS.map((c) => `<i style="background:${c.color}"></i>`).join('');
cats.innerHTML = CATS.map((c) =>
  `<li><span class="sw" style="background:${c.color}"></span><span>${c.name}</span><span class="eur"></span><span class="pc"></span></li>`
).join('');
const segs = [...stack.children];
const rows = [...cats.children];

function update() {
  const scheme = SCHEMES[document.querySelector('input[name="scheme"]:checked').value];
  const total = Number(income.value);
  incomeOut.textContent = eur.format(total) + ' €';
  scheme.forEach((p, i) => {
    segs[i].style.flexGrow = p;
    rows[i].querySelector('.eur').textContent = eur.format((total * p) / 100) + ' €';
    rows[i].querySelector('.pc').textContent = p + '% · massimale';
  });
}
income.addEventListener('input', update);
document.querySelectorAll('input[name="scheme"]').forEach((r) => r.addEventListener('change', update));
update();

/* ---------- Comparse ---------- */
const targets = document.querySelectorAll('.sec-head, .planner, .tile, .money-card, .safe-list li, .final > *');
targets.forEach((el) => el.classList.add('rv'));
if (reduce || !('IntersectionObserver' in window)) {
  targets.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  targets.forEach((el) => io.observe(el));
}
