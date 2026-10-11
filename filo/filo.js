const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Il filo: una linea luminosa che attraversa la pagina e si disegna scorrendo ----------
   Scende nei margini e passa da un lato all'altro tra le sezioni con grandi curve a S,
   con un leggero bagliore e l'ago luminoso in punta. */
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
  const sinistra = mr.l + parseFloat(cs.paddingLeft) / 2 - 4;                        // corsia nel margine sinistro
  const destra = (mr.r - parseFloat(cs.paddingRight) + Math.min(W, mr.r)) / 2 + 6;   // e in quello destro
  const sezioni = [...document.querySelectorAll('[data-knot]')].map((label) => {
    const sec = label.closest('section');
    return { label: rect(label), fondo: rect(sec.lastElementChild) };
  });
  if (!sezioni.length) return;
  // Onda armoniosa: il filo scende in un margine ondeggiando appena e, nello spazio vuoto tra
  // una sezione e l'altra, attraversa la pagina con una grande S fino al margine opposto.
  // Ogni tratto arriva e riparte in verticale: nessun cambio di direzione brusco.
  // Testi da non attraversare
  const testi = [...document.querySelectorAll('main p, main h1, main h2, main h3, figcaption, .btn, .genres, .states, .notif')].map(rect);
  const corsie = [sinistra, destra];
  let lato = 0;
  const tappe = [[corsie[0], -40]];
  const scendi = (fino) => {
    // discesa nel margine con un'oscillazione leggera e regolare
    const da = tappe[tappe.length - 1][1], n = Math.max(1, Math.round((fino - da) / 380));
    for (let k = 1; k <= n; k++) tappe.push([corsie[lato] + (k === n ? 0 : (k % 2 ? 9 : -9) * (lato ? -1 : 1)), da + (fino - da) * k / n]);
  };
  sezioni.forEach((s, i) => {
    const prossima = sezioni[i + 1];
    if (!prossima) return;
    // la S comincia già accanto alla fine della sezione e finisce all'altezza dell'etichetta successiva:
    // più spazio in verticale, curva più distesa
    // Si sceglie la partenza più alta che non fa passare il filo sopra nessun testo
    const basso = prossima.label.t + (W < 700 ? 20 : 40);
    const da = corsie[lato], a = corsie[1 - lato];
    const libera = (y0) => {
      for (let k = 0; k <= 60; k++) {
        const t = k / 60, u = 1 - t, dy = basso - y0;
        const x = u * u * u * da + 3 * u * u * t * da + 3 * u * t * t * a + t * t * t * a;
        const y = u * u * u * y0 + 3 * u * u * t * (y0 + dy / 2) + 3 * u * t * t * (basso - dy / 2) + t * t * t * basso;
        if (testi.some((r) => x > r.l - 8 && x < r.r + 8 && y > r.t - 8 && y < r.b + 8)) return false;
      }
      return true;
    };
    const alto = [-170, -120, -70, -20, 16].map((o) => s.fondo.b + o).find(libera) ?? s.fondo.b + 16;
    if (basso - alto < 160) return;
    scendi(alto);
    lato = 1 - lato;
    tappe.push([corsie[lato], basso]);
  });
  scendi(box.height - 30);
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
