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

/* ---------- Tavole: una per pagina ----------
   Le tavole chiuse restano nel documento con hidden="until-found": Ctrl+F le trova e il browser
   le apre (evento beforematch). In stampa escono tutte. Senza JavaScript restano una sotto l'altra. */
const tavole = [...document.querySelectorAll('main .tav[id]')];
const navLinks = [...document.querySelectorAll('.topbar nav a[href^="#"]')];
const titoloBase = document.title;
const cTav = document.getElementById('c-tav');
const cName = document.getElementById('c-name');
const vecchie = { 'tav-01': 'inizio', 'tav-02': 'cosa-faccio', 'tav-03': 'metodo', 'tav-04': 'progetti', 'tav-05': 'contatti' };
let attiva = null;

function tavolaDa(hash) {
  let id = decodeURIComponent((hash || '').replace(/^#/, ''));
  if (vecchie[id]) id = vecchie[id];
  if (!id) return null;
  const el = document.getElementById(id);
  return el ? el.closest('main .tav[id]') : null;
}

/* Pulsanti "precedente / successiva" in fondo alla tavola aperta */
const pager = document.createElement('nav');
pager.className = 'pager';
pager.setAttribute('aria-label', 'Tavola precedente e successiva');
function vocePager(tav, classe, etichetta) {
  const a = document.createElement('a');
  a.className = classe;
  a.href = '#' + tav.id;
  const small = document.createElement('small');
  small.textContent = `${etichetta} · Tav. ${tav.dataset.tav}`;
  const b = document.createElement('b');
  b.textContent = tav.dataset.name;
  a.append(small, b);
  return a;
}
function aggiornaPager(i) {
  pager.replaceChildren();
  if (i > 0) pager.append(vocePager(tavole[i - 1], 'pager-prev', 'Precedente'));
  if (i < tavole.length - 1) pager.append(vocePager(tavole[i + 1], 'pager-next', 'Successiva'));
  tavole[i].append(pager);
}

/* Contatori: da 0 al valore finale */
function conta(tav) {
  tav.querySelectorAll('[data-count]').forEach((el) => {
    const fine = Number(el.dataset.count);
    if (reduce || !Number.isFinite(fine)) { el.textContent = String(fine); return; }
    const t0 = performance.now();
    const passo = (t) => {
      const k = Math.min((t - t0) / 900, 1);
      el.textContent = String(Math.round(fine * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(passo);
    };
    el.textContent = '0';
    requestAnimationFrame(passo);
  });
}

/* La testina del plotter scende sul foglio nuovo */
const plotter = document.createElement('div');
plotter.className = 'plotter';
plotter.setAttribute('aria-hidden', 'true');
document.body.append(plotter);
function passaggio(tav) {
  if (reduce) return;
  [plotter, tav].forEach((el) => el.classList.remove(el === plotter ? 'via' : 'entra'));
  void plotter.offsetWidth;
  plotter.classList.add('via');
  tav.classList.add('entra');
}

function mostraTavola(tav, opzioni = {}) {
  if (!tav) tav = tavole[0];
  const cambia = tav !== attiva;
  tavole.forEach((t) => {
    const on = t === tav;
    t.classList.toggle('attiva', on);
    if (on) t.removeAttribute('hidden'); else t.setAttribute('hidden', 'until-found');
  });
  navLinks.forEach((a) => {
    if (tavolaDa(a.getAttribute('href')) === tav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const i = tavole.indexOf(tav);
  if (cTav) cTav.textContent = tav.dataset.tav;
  if (cName) cName.textContent = tav.dataset.name;
  document.title = i === 0 ? titoloBase : `${tav.dataset.name} · ${titoloBase}`;
  aggiornaPager(i);
  attiva = tav;
  if (cambia) {
    conta(tav);
    if (opzioni.anima) passaggio(tav);
  }
  if (opzioni.inCima) window.scrollTo({ top: 0, behavior: 'instant' });
}

if (tavole.length) {
  document.body.classList.add('paged');
  // ?f= senza un'ancora apre l'elenco dei progetti
  const iniziale = location.hash || (new URLSearchParams(location.search).has('f') ? '#progetti' : '');
  const prima = tavolaDa(iniziale);
  mostraTavola(prima);
  // un'ancora interna (non la tavola stessa) va mostrata dopo l'apertura
  const dentro = iniziale && document.getElementById(decodeURIComponent(iniziale.slice(1)));
  if (dentro && prima && dentro !== prima) requestAnimationFrame(() => dentro.scrollIntoView());
  else window.scrollTo(0, 0);
  if (vecchie[iniziale.slice(1)]) history.replaceState(history.state, '', '#' + prima.id);

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === '#main') return; // il collegamento "Salta al contenuto" fa il suo lavoro
    const tav = tavolaDa(href);
    if (!tav) return;
    e.preventDefault();
    const url = new URL(location.href);
    url.hash = href;
    if (url.href !== location.href) history.pushState(null, '', url);
    const bersaglio = document.getElementById(href.slice(1));
    mostraTavola(tav, { anima: true, inCima: bersaglio === tav });
    if (bersaglio !== tav) bersaglio.scrollIntoView();
    // il fuoco va al titolo della tavola, così chi usa la tastiera o un lettore di schermo riparte da lì
    const titolo = tav.querySelector('h1, h2');
    if (titolo && bersaglio === tav) { titolo.setAttribute('tabindex', '-1'); titolo.focus({ preventScroll: true }); }
  });

  addEventListener('popstate', () => mostraTavola(tavolaDa(location.hash), { anima: true, inCima: true }));
  addEventListener('hashchange', () => { const t = tavolaDa(location.hash); if (t && t !== attiva) mostraTavola(t, { inCima: true }); });

  // Ctrl+F ha trovato del testo in una tavola chiusa: la si apre lì, senza saltare in cima
  tavole.forEach((t) => t.addEventListener('beforematch', () => {
    mostraTavola(t);
    history.replaceState(history.state, '', '#' + t.id);
  }));
}

/* Mirino e coordinate nel cartiglio, solo con mouse e senza movimento ridotto */
const crosshair = document.querySelector('.crosshair');
const cx = document.getElementById('cx');
const cy = document.getElementById('cy');
if (crosshair && fine && !reduce) {
  const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, '0');
  let mx = 0, my = 0, inAttesaMirino = false;
  const disegna = () => {
    inAttesaMirino = false;
    crosshair.style.setProperty('--x', `${mx}px`);
    crosshair.style.setProperty('--y', `${my}px`);
    if (cx) cx.textContent = pad(mx);
    if (cy) cy.textContent = pad(my + scrollY);
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    crosshair.classList.add('on');
    if (!inAttesaMirino) { inAttesaMirino = true; requestAnimationFrame(disegna); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => crosshair.classList.remove('on'));
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
