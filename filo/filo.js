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
addEventListener('load', buildThread);
if (document.fonts) document.fonts.ready.then(buildThread);
buildThread();

/* ---------- Demo: episodi della stagione ---------- */
const N = 10;
const state = Array(N).fill('todo'); // todo | seen | re
const grid = document.getElementById('ep-grid');
const ask = document.getElementById('ep-ask');
const askText = document.getElementById('ep-ask-text');
let pending = -1;

for (let i = 0; i < N; i++) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ep';
  b.textContent = 'E' + (i + 1);
  b.addEventListener('click', () => tap(i));
  li.append(b);
  grid.append(li);
}
const buttons = [...grid.querySelectorAll('.ep')];

function tap(i) {
  if (state[i] === 'seen') { state[i] = 're'; return render([i]); }
  if (state[i] === 're') { state[i] = 'seen'; return render([i]); }
  const missing = state.slice(0, i).filter((s) => s === 'todo').length;
  if (missing > 0) {
    pending = i;
    askText.textContent = `Vuoi segnare come visti anche ${missing === 1 ? "l'episodio precedente" : `i ${missing} episodi precedenti`}?`;
    ask.hidden = false;
    document.getElementById('ep-yes').focus();
    return;
  }
  state[i] = 'seen';
  render([i]);
}

document.getElementById('ep-yes').addEventListener('click', () => {
  const changed = [];
  for (let j = 0; j <= pending; j++) if (state[j] === 'todo') { state[j] = 'seen'; changed.push(j); }
  close(changed);
});
document.getElementById('ep-no').addEventListener('click', () => { state[pending] = 'seen'; close([pending]); });
document.getElementById('ep-reset').addEventListener('click', () => { state.fill('todo'); ask.hidden = true; render([]); });

function close(changed) { ask.hidden = true; buttons[pending].focus(); pending = -1; render(changed); }

function render(changed) {
  buttons.forEach((b, i) => {
    b.classList.toggle('seen', state[i] === 'seen');
    b.classList.toggle('re', state[i] === 're');
    const label = state[i] === 'seen' ? 'visto' : state[i] === 're' ? 'rivisto' : 'da vedere';
    b.setAttribute('aria-label', `Episodio ${i + 1}, ${label}`);
  });
  changed.forEach((i, k) => {
    const b = buttons[i];
    b.classList.remove('pulse');
    setTimeout(() => b.classList.add('pulse'), k * 45);
  });
  const done = state.filter((s) => s !== 'todo').length;
  document.getElementById('ep-count').textContent = `${done}/${N}`;
  document.getElementById('ep-bar').style.width = (done / N) * 100 + '%';
  document.getElementById('ep-state').textContent =
    done === 0 ? 'Da iniziare' : done === N ? (state.includes('re') ? 'Completata · con revisioni' : 'Completata') : 'In corso';
}
render([]);

/* ---------- Comparse ---------- */
const targets = document.querySelectorAll('.sec-head, .ep-card, .f, .final > *');
targets.forEach((el) => el.classList.add('rv'));
if (reduce || !('IntersectionObserver' in window)) {
  targets.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  targets.forEach((el) => io.observe(el));
}
