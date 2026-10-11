const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Il filo: una linea che attraversa la pagina e si disegna scorrendo ---------- */
const wrap = document.querySelector('.thread-wrap');
const svg = document.querySelector('.thread');
const path = document.getElementById('thread-path');
let length = 0;

function buildThread() {
  const box = wrap.getBoundingClientRect();
  const w = box.width;
  svg.setAttribute('viewBox', `0 0 ${w} ${box.height}`);
  // Il filo scende lungo il margine sinistro e "cuce" ogni etichetta data-knot
  // Le sezioni entrano salendo dal basso: si misura la posizione finale, senza lo spostamento temporaneo
  const shiftY = (el) => {
    let t = 0;
    for (let e = el; e && e !== wrap; e = e.parentElement) {
      const m = getComputedStyle(e).transform;
      if (m && m !== 'none') t += new DOMMatrix(m).m42;
    }
    return t;
  };
  const knots = [...document.querySelectorAll('[data-knot]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - box.left - 24, y: r.top - box.top + r.height / 2 - shiftY(el) };
  });
  if (!knots.length) return;
  const m = Math.max(8, Math.min(...knots.map((k) => k.x)) - 26);
  // Il filo scende lungo il margine ondeggiando appena; all'altezza di ogni etichetta
  // si avvicina con una curva ampia, la sfiora e torna al margine. Niente riccioli né spigoli.
  const pts = [[m, -40]];
  knots.forEach((k, i) => {
    const prev = pts[pts.length - 1];
    // resta nel margine anche quando l'etichetta è centrata (sezione finale)
    const tocco = Math.min(m + 34, Math.max(m + 18, k.x + 6));
    const largo = Math.min(220, Math.max(120, (k.y - prev[1]) * 0.4));
    if (k.y - largo - prev[1] > 260) pts.push([m + (i % 2 ? 7 : -5), (prev[1] + k.y - largo) / 2]);
    pts.push([m + 2, k.y - largo], [tocco, k.y], [m - 2, k.y + largo]);
  });
  pts.push([m, pts[pts.length - 1][1] + 120]);
  // Curva morbida che passa per tutti i punti (Catmull-Rom convertita in Bézier)
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  path.setAttribute('d', d);
  length = path.getTotalLength();
  path.style.strokeDasharray = length;
  drawThread();
}

function drawThread() {
  if (reduce) { path.style.strokeDashoffset = 0; return; }
  const box = wrap.getBoundingClientRect();
  const raw = (innerHeight * 0.75 - box.top) / box.height;
  // Quanto vale lo stesso calcolo con la pagina scorsa fino in fondo: lì il filo deve essere completo
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const rawAtEnd = (innerHeight * 0.75 - (box.top + scrollY - maxScroll)) / box.height;
  const progress = Math.min(1, Math.max(0, raw / Math.min(1, rawAtEnd)));
  path.style.strokeDashoffset = length * (1 - progress);
}

let raf = 0;
addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawThread(); }); }, { passive: true });
addEventListener('resize', buildThread);
// Le schermate si caricano in differita e allungano la pagina: il filo segue l'altezza reale
if ('ResizeObserver' in window) new ResizeObserver(() => buildThread()).observe(wrap);
addEventListener('load', buildThread);
if (document.fonts) document.fonts.ready.then(buildThread);
buildThread();

/* ---------- Comparse ---------- */
const targets = document.querySelectorAll('.sec-head, .shot, .f, .final > *');
targets.forEach((el) => el.classList.add('rv'));
if (reduce || !('IntersectionObserver' in window)) {
  targets.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  targets.forEach((el) => io.observe(el));
}

/* ---------- Video di presentazione nel popup ----------
   Il pulsante compare solo se il video esiste. Al clic si sceglie la versione
   adatta allo schermo (16:9 orizzontale, 4:5 verticale) e la riproduzione parte
   con l'audio: il clic del visitatore lo consente. Alla chiusura si ferma. */
const demoBtn = document.querySelector('[data-demo]');
const modal = document.getElementById('demo-modal');
const video = document.getElementById('demo-video');
const tall = window.matchMedia('(max-aspect-ratio: 1/1)');

fetch(video.dataset.wide, { method: 'HEAD' })
  .then((r) => { if (r.ok) demoBtn.hidden = false; })
  .catch(() => {});

function pickVersion() {
  const kind = tall.matches ? 'tall' : 'wide';
  const src = video.dataset[kind];
  if (video.getAttribute('src') !== src) {
    video.src = src;
    video.poster = video.dataset[kind + 'Poster'];
  }
}

demoBtn.addEventListener('click', () => {
  pickVersion();
  modal.showModal();
  video.currentTime = 0;
  video.muted = false;
  // Se il browser rifiuta l'audio, parte comunque senza: il volume resta nei comandi
  video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
});
const closeDemo = () => modal.close();
modal.querySelector('[data-close]').addEventListener('click', closeDemo);
modal.addEventListener('click', (e) => { if (e.target === modal) closeDemo(); });
modal.addEventListener('close', () => video.pause());
