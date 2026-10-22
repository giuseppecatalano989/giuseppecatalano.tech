/* ---------- Simulatore: lo stesso calcolo dello strumento calcola_impatto ----------
   Un ritardo sulla sandbox del fornitore sposta l'integrazione pagamenti e, a cascata, test e go-live.
   Il blocco rilasci del cliente va dal 5 dicembre al 7 gennaio. */
const MILESTONE = [
  { id: 'M3', nome: 'Pagamenti', data: '2026-11-06' },
  { id: 'M4', nome: 'Test', data: '2026-11-20' },
  { id: 'M5', nome: 'Go-live', data: '2026-12-01' },
];
const BLOCCO = { dal: '2026-12-05', al: '2027-01-07' };
const DA = Date.parse('2026-10-29'), A = Date.parse('2027-01-14');
const GIORNO = 86400000;
const piu = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * GIORNO).toISOString().slice(0, 10);
const breve = (s) => new Date(s + 'T12:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const x = (s) => ((Date.parse(s) - DA) / (A - DA)) * 100 + '%';

const $ = (id) => document.getElementById(id);
const freeze = $('freeze');
freeze.style.left = x(BLOCCO.dal);
freeze.style.right = 100 - parseFloat(x(BLOCCO.al)) + '%';
$('ticks').innerHTML = ['2026-11-01', '2026-11-15', '2026-12-01', '2026-12-15', '2027-01-01']
  .map((d) => `<span class="tick" style="left:${x(d)}">${breve(d)}</span>`).join('');
$('ms').innerHTML =
  MILESTONE.map((m) => `<div class="ms ghost" style="left:${x(m.data)}"><i></i></div>`).join('') +
  MILESTONE.map((m, i) => `<div class="ms${i % 2 ? ' su' : ''}" data-id="${m.id}" style="left:${x(m.data)}"><i></i><small></small></div>`).join('');

function aggiorna() {
  const ritardo = Number($('giorni').value);
  const netto = Math.max(0, ritardo - ($('mock').checked ? 4 : 0));
  $('giorni-out').textContent = ritardo === 1 ? '1 giorno' : `${ritardo} giorni`;
  const golive = piu(MILESTONE[2].data, netto);
  const nelBlocco = golive >= BLOCCO.dal && golive <= BLOCCO.al;
  MILESTONE.forEach((m, i) => {
    const el = document.querySelector(`.ms[data-id="${m.id}"]`);
    const d = piu(m.data, netto);
    el.style.left = x(d);
    el.querySelector('small').textContent = `${m.nome} · ${breve(d)}`;
    el.classList.toggle('late', netto > 0 && !(i === 2 && nelBlocco));
    el.classList.toggle('blocked', i === 2 && nelBlocco);
  });
  const margine = Math.round((Date.parse(BLOCCO.dal) - GIORNO - Date.parse(golive)) / GIORNO);
  const v = $('verdict');
  if (nelBlocco) {
    v.className = 'verdict no';
    v.textContent = `Go-live il ${breve(golive)}: cade nel blocco rilasci e slitta all’8 gennaio.`;
  } else if (margine <= 1) {
    v.className = 'verdict stretto';
    v.textContent = `Go-live il ${breve(golive)}: prima del blocco, ma ${margine === 0 ? 'senza margine' : 'con un solo giorno di margine'}.`;
  } else {
    v.className = 'verdict si';
    v.textContent = `Go-live il ${breve(golive)}: ${margine} giorni di margine prima del blocco.`;
  }
}
$('giorni').addEventListener('input', aggiorna);
$('mock').addEventListener('change', aggiorna);
aggiorna();

/* ---------- Video di presentazione nel popup ----------
   Il pulsante compare solo se il video esiste. Al clic si sceglie la versione adatta allo schermo
   (16:9 orizzontale, 4:5 verticale) e la riproduzione parte con l'audio. Alla chiusura si ferma. */
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
