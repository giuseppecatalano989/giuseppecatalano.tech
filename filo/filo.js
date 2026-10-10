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
  let d = `M ${m} -40`;
  let prevY = -40;
  // A ogni sezione il filo fa un ricciolo verso destra, come la "l" corsiva:
  // scende, gira su se stesso incrociandosi e prosegue dritto verso il basso.
  const R = 13;                 // raggio del ricciolo
  const c = 0.5523 * R;         // costante per approssimare il cerchio con curve di Bézier
  knots.forEach((k, i) => {
    const sway = i % 2 ? 10 : -6;
    const last = i === knots.length - 1;
    const y = k.y;              // il centro del ricciolo è all'altezza dell'etichetta
    const cx = m + R;           // centro del ricciolo, a destra del filo
    // discesa lungo il margine fino a poco sopra il ricciolo
    d += ` C ${m + sway} ${prevY + (y - R * 2 - prevY) * 0.4}, ${m - sway} ${y - 80}, ${m} ${y - R * 2}`;
    // il filo scivola in basso a destra, verso il fondo del ricciolo
    d += ` C ${m} ${y - R * 0.5}, ${cx - c * 1.7} ${y + R}, ${cx} ${y + R}`;
    // giro completo: destra, alto, poi giù a sinistra attraversando il filo (l'incrocio a "X")
    d += ` C ${cx + c} ${y + R}, ${cx + R} ${y + c}, ${cx + R} ${y}`;
    d += ` C ${cx + R} ${y - c}, ${cx + c} ${y - R}, ${cx} ${y - R}`;
    d += ` C ${cx - c * 1.4} ${y - R}, ${m - R * 0.7} ${y - c * 0.6}, ${m - R * 0.4} ${y + R * 0.45}`;
    // ripresa della discesa verso il basso
    const tail = last ? 46 : 70;
    d += ` C ${m - R * 0.2} ${y + R * 1.1}, ${m} ${y + R + 12}, ${m} ${y + tail}`;
    prevY = y + tail;
  });
  path.setAttribute('d', d);
  length = path.getTotalLength();
  path.style.strokeDasharray = length;
  drawThread();
}

function drawThread() {
  if (reduce) { path.style.strokeDashoffset = 0; return; }
  const box = wrap.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, (innerHeight * 0.75 - box.top) / box.height));
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
