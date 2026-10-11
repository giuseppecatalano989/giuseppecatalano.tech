const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Il filo: una linea luminosa che scende nel margine sinistro e si disegna scorrendo ----------
   Onda morbida a ritmo regolare, più ampia accanto alle etichette delle sezioni;
   leggero bagliore e ago luminoso in punta. */
const wrap = document.querySelector('.thread-wrap');
const svg = document.querySelector('.thread');
const path = document.getElementById('thread-path');
const glow = document.getElementById('thread-glow');
const ago = document.getElementById('thread-ago');
let length = 0, tabella = [];

function buildThread() {
  const box = wrap.getBoundingClientRect();
  const W = box.width;
  svg.setAttribute('viewBox', `0 0 ${W} ${box.height}`);
  // Le sezioni entrano salendo dal basso: si misura la posizione finale, senza lo spostamento temporaneo
  const shiftY = (el) => {
    let t = 0;
    for (let e = el; e && e !== wrap; e = e.parentElement) {
      const m = getComputedStyle(e).transform;
      if (m && m !== 'none') t += new DOMMatrix(m).m42;
    }
    return t;
  };
  const rect = (el) => { const r = el.getBoundingClientRect(), dy = shiftY(el); return { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top - dy, b: r.bottom - box.top - dy }; };
  const main = document.querySelector('main'), cs = getComputedStyle(main), mr = rect(main);
  const sezioni = [...document.querySelectorAll('[data-knot]')].map((label) => {
    return { label: rect(label) };
  });
  if (!sezioni.length) return;
  // Onda nel margine sinistro: creste arrotondate a ritmo regolare (tangenti sempre verticali),
  // più ampie all'altezza di ogni etichetta, con la cresta rivolta verso la parola,
  // più quiete tra una sezione e l'altra. Il filo non esce mai dal margine.
  const centro = mr.l + parseFloat(cs.paddingLeft) / 2 - 2;
  const A = Math.max(6, parseFloat(cs.paddingLeft) / 2 - 10);   // ampiezza massima
  const mezzaOnda = 170;                                          // distanza tra due creste
  const ys = sezioni.map((s) => (s.label.t + s.label.b) / 2);
  const ampiezza = (y) => {
    const vicino = Math.min(...ys.map((l) => Math.abs(l - y)));
    return A * (0.3 + 0.7 * Math.exp(-((vicino / 210) ** 2)));
  };
  const tappe = [[centro, -40]];
  // tra due tappe di cresta a destra (le etichette) un numero pari di mezze onde, alternate
  const tratto = (y0, y1, finale) => {
    let n = Math.max(2, Math.round((y1 - y0) / mezzaOnda));
    if (!finale && n % 2) n += 1;
    for (let k = 1; k <= n; k++) {
      const y = y0 + (y1 - y0) * k / n;
      const lato = (n - k) % 2 ? -1 : 1;                           // all'arrivo la cresta è a destra
      tappe.push([centro + lato * (finale && k === n ? 0 : ampiezza(y)), y]);
    }
  };
  ys.forEach((y) => tratto(tappe[tappe.length - 1][1], y, false));
  tratto(ys[ys.length - 1], box.height - 30, true);
  let d = `M ${tappe[0][0]} ${tappe[0][1]}`;
  for (let i = 1; i < tappe.length; i++) {
    const [x0, y0] = tappe[i - 1], [x1, y1] = tappe[i], dy = y1 - y0;
    d += ` C ${x0} ${y0 + dy * 0.5}, ${x1} ${y1 - dy * 0.5}, ${x1} ${y1}`;
  }
  path.setAttribute('d', d); glow.setAttribute('d', d);
  length = path.getTotalLength();
  [path, glow].forEach((p) => { p.style.strokeDasharray = length; });
  // Tabella lunghezza -> altezza, per far avanzare la punta con lo scorrimento della pagina
  tabella = []; let maxY = -Infinity;
  for (let l = 0; l <= length; l += 6) { maxY = Math.max(maxY, path.getPointAtLength(l).y); tabella.push([l, maxY]); }
  drawThread();
}

function drawThread() {
  if (!length) return;
  let lung = length;
  if (!reduce) {
    const box = wrap.getBoundingClientRect();
    const raw = (innerHeight * 0.75 - box.top) / box.height;
    // Quanto vale lo stesso calcolo con la pagina scorsa fino in fondo: lì il filo deve essere completo
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    const rawAtEnd = (innerHeight * 0.75 - (box.top + scrollY - maxScroll)) / box.height;
    const progress = Math.min(1, Math.max(0, raw / Math.min(1, rawAtEnd)));
    if (progress < 1) {
      // la punta arriva all'altezza corrispondente allo scorrimento
      const yT = progress * tabella[tabella.length - 1][1];
      lung = (tabella.find((r) => r[1] >= yT) || tabella[tabella.length - 1])[0];
    }
  }
  [path, glow].forEach((p) => { p.style.strokeDashoffset = length - lung; });
  const pt = path.getPointAtLength(lung);
  ago.setAttribute('cx', pt.x); ago.setAttribute('cy', pt.y);
  ago.style.opacity = !reduce && lung > 4 && lung < length - 4 ? 1 : 0;
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
