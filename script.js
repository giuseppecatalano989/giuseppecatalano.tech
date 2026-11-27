/* Portfolio di Giuseppe Catalano: tema, menu, disegni, filtri dei progetti.
   Senza questo file la pagina resta completa e leggibile: qui si aggiunge solo il movimento. */
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const hasIO = 'IntersectionObserver' in window;
if (!reduce && hasIO) root.classList.add('anima');

/* ---------- Tema: scuro di partenza, chiaro a scelta ---------- */
const themeMeta = document.querySelector('meta[name="theme-color"]');
const themeBtns = document.querySelectorAll('[data-set-theme]');
function setTheme(t, salva) {
  root.dataset.theme = t;
  themeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
  if (themeMeta) themeMeta.content = t === 'light' ? '#f2efe7' : '#0e2649';
  if (salva) { try { localStorage.setItem('gc-theme', t); } catch (e) { /* archiviazione non disponibile */ } }
}
setTheme(root.dataset.theme === 'light' ? 'light' : 'dark', false);
themeBtns.forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.setTheme, true)));

/* ---------- Menu: segna la sezione che si sta leggendo ---------- */
const navLinks = [...document.querySelectorAll('.topbar nav a[href^="#"]')];
const sezioni = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
function segna(id) {
  navLinks.forEach((a) => {
    if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}
if (hasIO && sezioni.length) {
  const visibili = new Set();
  const so = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visibili.add(e.target) : visibili.delete(e.target)));
    const attuale = sezioni.find((s) => visibili.has(s));
    segna(attuale ? attuale.id : '');
  }, { rootMargin: '-40% 0px -55% 0px' });
  sezioni.forEach((s) => so.observe(s));
}

/* ---------- Comparse allo scorrimento ---------- */
const reveals = document.querySelectorAll('.reveal');
if (!root.classList.contains('anima')) {
  reveals.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  reveals.forEach((el) => io.observe(el));
}

/* ---------- Disegni ----------
   Il tratto rosso e quello d'inchiostro si tracciano in sequenza, i gruppi blu (l'AI) compaiono dopo.
   I puntini che scorrono (SMIL) si fermano fuori dallo schermo, con il pulsante o se il movimento è ridotto. */
const schemi = document.querySelectorAll('svg.schema');
schemi.forEach((svg) => {
  const toggle = svg.parentElement.querySelector('.anim-toggle');
  const haPkt = !!svg.querySelector('.pkt');
  if (toggle && (!haPkt || reduce)) toggle.hidden = true;
  if (reduce) { if (svg.pauseAnimations) svg.pauseAnimations(); return; }

  if (hasIO) {
    let i = 0;
    svg.querySelectorAll('path, rect, circle, ellipse').forEach((el) => {
      if (el.closest('.s-blue') || el.classList.contains('pkt')) return;
      el.setAttribute('pathLength', '1');
      el.classList.add('dr');
      el.style.setProperty('--d', `${Math.min(i++ * 0.06, 1.2)}s`);
    });
    svg.querySelectorAll('.s-blue').forEach((g, k) => {
      g.classList.add('fade');
      g.style.setProperty('--d', `${0.5 + k * 0.15}s`);
    });
    svg.classList.add('anim');
  }

  let fermatoDaUtente = false, inVista = !hasIO;
  const aggiorna = () => {
    if (!svg.pauseAnimations) return;
    if (inVista && !fermatoDaUtente) svg.unpauseAnimations(); else svg.pauseAnimations();
  };
  if (hasIO) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        inVista = e.isIntersecting;
        if (inVista) svg.classList.add('vista');
        aggiorna();
      });
    }, { threshold: 0.2 }).observe(svg);
  }
  aggiorna();

  if (toggle && !toggle.hidden) {
    toggle.addEventListener('click', () => {
      fermatoDaUtente = !fermatoDaUtente;
      toggle.setAttribute('aria-pressed', String(fermatoDaUtente));
      toggle.textContent = fermatoDaUtente ? "Riprendi l'animazione" : "Ferma l'animazione";
      aggiorna();
    });
  }
});

/* ---------- Progetti: anteprima vicino al puntatore (o alla riga, con la tastiera) ---------- */
const previews = document.querySelector('.previews');
if (previews && fine) {
  let px = 0, py = 0, inAttesa = false;
  const muovi = () => {
    inAttesa = false;
    previews.style.setProperty('--px', `${px}px`);
    previews.style.setProperty('--py', `${py}px`);
  };
  document.querySelectorAll('.reg-row').forEach((row) => {
    const pv = previews.querySelector(`[data-pv="${row.dataset.preview}"]`);
    if (!pv) return;
    row.addEventListener('pointermove', (e) => {
      px = e.clientX; py = e.clientY;
      if (!inAttesa) { inAttesa = true; requestAnimationFrame(muovi); }
    }, { passive: true });
    row.addEventListener('pointerenter', (e) => { px = e.clientX; py = e.clientY; muovi(); pv.classList.add('on'); });
    row.addEventListener('pointerleave', () => pv.classList.remove('on'));
    row.addEventListener('focus', () => {
      if (!row.matches(':focus-visible')) return;
      const r = row.getBoundingClientRect();
      px = Math.min(r.right - 320, r.left + r.width * 0.55); py = r.top + r.height / 2; muovi();
      pv.classList.add('on');
    });
    row.addEventListener('blur', () => pv.classList.remove('on'));
  });
  addEventListener('scroll', () => previews.querySelectorAll('.pv.on').forEach((p) => {
    if (!document.querySelector('.reg-row:hover, .reg-row:focus-visible')) p.classList.remove('on');
  }), { passive: true });
}

/* ---------- Progetti: filtri per tipo (l'indirizzo ricorda la scelta con ?f=) ---------- */
const filtri = [...document.querySelectorAll('.filters button[data-f]')];
const voci = [...document.querySelectorAll('.register li[data-cat]')];
const conteggio = document.getElementById('reg-count');
function filtra(f, anima) {
  if (!filtri.some((b) => b.dataset.f === f)) f = 'tutti';
  filtri.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
  let n = 0, k = 0;
  voci.forEach((li) => {
    const via = f !== 'tutti' && li.dataset.cat !== f;
    li.classList.toggle('fuori', via);
    li.classList.remove('entra');
    if (via) return;
    n++;
    if (anima && !reduce) {
      void li.offsetWidth;
      li.style.animationDelay = `${k++ * 40}ms`;
      li.classList.add('entra');
    }
  });
  if (conteggio) conteggio.textContent = n === 1 ? '1 progetto' : `${n} progetti`;
  return f;
}
if (filtri.length) {
  filtri.forEach((b) => b.addEventListener('click', () => {
    const f = filtra(b.dataset.f, true);
    const url = new URL(location.href);
    if (f === 'tutti') url.searchParams.delete('f'); else url.searchParams.set('f', f);
    history.replaceState(history.state, '', url);
  }));
  const iniziale = new URLSearchParams(location.search).get('f');
  if (iniziale) filtra(iniziale, false);
}
