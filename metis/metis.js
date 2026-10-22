/* ---------- Mini piano: lo stesso calendario del motore di Metis ----------
   Giorni lavorativi lun–ven, festivi 8/12, 25–26/12, 1/1, 6/1, chiusura natalizia dal 24/12 al 6/1.
   Tratto finale del piano della demo: arredi → postazioni e Wi-Fi → collaudo → trasloco nel weekend → apertura. */
const GIORNO = 86400000;
const FESTIVI = new Set(['2026-12-08', '2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06']);
const d = (s) => new Date(s + 'T12:00:00Z');
const iso = (x) => x.toISOString().slice(0, 10);
const piu = (s, n) => iso(new Date(d(s).getTime() + n * GIORNO));
const lav = (s) => { const g = d(s).getUTCDay(); return g && g !== 6 && !FESTIVI.has(s) && !(s >= '2026-12-24' && s <= '2027-01-06'); };
const prossimo = (s) => { let x = s; while (!lav(x)) x = piu(x, 1); return x; };
const dopo = (s) => prossimo(piu(s, 1));
const fine = (s, n) => { let x = prossimo(s); for (let i = 1; i < n; i++) x = dopo(x); return x; };
const breve = (s) => d(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const TARGET = '2027-01-11';
const DATE = []; for (let x = '2026-12-07'; DATE.length < 11; x = dopo(x)) DATE.push(prossimo(x));

function piano(S, lotti) {
  const r = [];
  let pronti;
  if (lotti) {
    const l1 = [S, fine(S, 5)], l2 = [dopo(l1[1]), fine(dopo(l1[1]), 3)];
    const post = [dopo(l1[1]), fine(dopo(l1[1]), 3)];
    r.push({ nome: 'Arredi, lotto 1', a: l1, c: 'arredi' }, { nome: 'Arredi, lotto 2', a: l2, c: 'arredi' }, { nome: 'Postazioni', a: post, c: 'team' });
    pronti = l2[1] > post[1] ? l2[1] : post[1];
  } else {
    const arr = [S, fine(S, 8)];
    const post = [dopo(arr[1]), fine(dopo(arr[1]), 3)];
    r.push({ nome: 'Arredi', a: arr, c: 'arredi' }, { nome: 'Postazioni', a: post, c: 'team' });
    pronti = post[1];
  }
  const coll = [dopo(pronti), fine(dopo(pronti), 2)];
  let sab = piu(coll[1], 1); while (d(sab).getUTCDay() !== 6) sab = piu(sab, 1);
  const apertura = prossimo(piu(sab, 2));
  r.push({ nome: 'Collaudo', a: coll, c: 'team' }, { nome: 'Trasloco', a: [sab, piu(sab, 1)], c: 'traslochi' }, { nome: 'Apertura', a: [apertura, apertura], c: 'ms' });
  return { righe: r, apertura };
}

const DA = Date.parse('2026-12-05'), A = Date.parse('2027-01-21');
const x = (s) => ((Date.parse(s) - DA) / (A - DA)) * 100;
const w = (a, b) => ((Date.parse(b) - Date.parse(a) + GIORNO) / (A - DA)) * 100;
const $ = (id) => document.getElementById(id);
// Le righe hanno a sinistra la colonna dei nomi (--nm): fasce, scadenza e asse si allineano alle corsie
const inLane = (p) => `calc(var(--nm) + (100% - var(--nm)) * ${p / 100})`;
$('freeze').style.left = inLane(x('2026-12-24'));
$('freeze').style.width = `calc((100% - var(--nm)) * ${w('2026-12-24', '2027-01-06') / 100})`;
$('deadline').style.left = inLane(x(TARGET));
$('axis').innerHTML = ['2026-12-07', '2026-12-14', '2026-12-21', '2027-01-04', '2027-01-11', '2027-01-18'].map((s) => `<span class="tick" style="left:${inLane(x(s))}">${breve(s)}</span>`).join('');

let prima = null;
function aggiorna() {
  const S = DATE[Number($('data').value)];
  $('data-out').textContent = breve(S);
  const p = piano(S, $('lotti').checked);
  const stessa = prima && prima.length === p.righe.length;
  $('rows').innerHTML = p.righe.map((r, i) => {
    const da = stessa ? prima[i] : r.a;
    return `<div class="row"><span class="nm">${r.nome}</span><div class="lane"><i class="gb ${r.c}" data-l="${x(r.a[0])}" data-w="${w(r.a[0], r.a[1])}" style="left:${x(da[0])}%;width:${r.c === 'ms' ? 0 : w(da[0], da[1])}%"></i></div></div>`;
  }).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('#rows .gb').forEach((b) => {
    b.style.left = b.dataset.l + '%'; if (!b.classList.contains('ms')) b.style.width = b.dataset.w + '%';
  })));
  prima = p.righe.map((r) => r.a);
  $('track').classList.toggle('late', p.apertura > TARGET);
  const v = $('verdict');
  if (p.apertura <= TARGET) {
    let n = 0; for (let y = p.apertura; y < TARGET; y = piu(y, 1)) if (lav(piu(y, 1))) n++;
    v.className = 'verdict ' + (n ? 'si' : 'stretto');
    v.textContent = `Apertura ${breve(p.apertura)}: in tempo${n ? `, ${n} giorni lavorativi di margine` : ', ma senza margine'}.`;
  } else {
    v.className = 'verdict no';
    v.textContent = `Apertura ${breve(p.apertura)}: ${Math.round((d(p.apertura) - d(TARGET)) / GIORNO)} giorni dopo l’11 gennaio. Il lavoro finisce dopo la chiusura natalizia.`;
  }
}
$('data').addEventListener('input', aggiorna);
$('lotti').addEventListener('change', () => { prima = null; aggiorna(); });
aggiorna();

/* ---------- Video di presentazione nel popup ---------- */
const demoBtn = document.querySelector('[data-demo]');
const modal = $('demo-modal');
const video = $('demo-video');
const tall = window.matchMedia('(max-aspect-ratio: 1/1)');
fetch(video.dataset.wide, { method: 'HEAD' }).then((r) => { if (r.ok) demoBtn.hidden = false; }).catch(() => {});
function pickVersion() {
  const kind = tall.matches ? 'tall' : 'wide';
  const src = video.dataset[kind];
  if (video.getAttribute('src') !== src) { video.src = src; video.poster = video.dataset[kind + 'Poster']; }
}
demoBtn.addEventListener('click', () => {
  pickVersion();
  modal.showModal();
  video.currentTime = 0;
  video.muted = false;
  video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
});
modal.querySelector('[data-close]').addEventListener('click', () => modal.close());
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
modal.addEventListener('close', () => video.pause());
