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
  const knots = [...document.querySelectorAll('[data-knot]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - box.left - 14, y: r.top - box.top + r.height / 2 };
  });
  if (!knots.length) return;
  const m = Math.max(8, Math.min(...knots.map((k) => k.x)) - 26);
  let d = `M ${m} -40`;
  let prevY = -40;
  knots.forEach((k, i) => {
    const sway = i % 2 ? 10 : -6;
    const last = i === knots.length - 1;
    d += ` C ${m + sway} ${prevY + (k.y - prevY) * 0.4}, ${m - sway} ${k.y - 90}, ${m} ${k.y - 34}`;
    d += ` C ${m} ${k.y - 6}, ${k.x - 26} ${k.y}, ${k.x} ${k.y}`;
    if (!last) {
      // piccolo occhiello e ritorno al margine
      d += ` C ${k.x + 10} ${k.y}, ${k.x + 6} ${k.y + 22}, ${k.x - 10} ${k.y + 18}`;
      d += ` C ${k.x - 30} ${k.y + 12}, ${m} ${k.y + 16}, ${m} ${k.y + 64}`;
      prevY = k.y + 64;
    }
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
