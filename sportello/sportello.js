/* ---------- Smistamento dei cinque messaggi della demo ----------
   Per ogni messaggio: dove lo mette Sportello e perché, secondo le regole dell'agente. */
const MESSAGGI = [
  { n: 'Chiara', c: '#6A4BE8', t: 'Il mio ordine doveva arrivare ieri, dov’è?', col: 'auto', perche: 'Tracciamento verificato, risposta con la nuova data' },
  { n: 'Davide', c: '#1E8E5A', t: 'Il piumone è arrivato con una macchia, allego foto.', col: 'ok', perche: 'Sostituzione da 129 € con ritiro gratuito' },
  { n: 'Laura', c: '#C2416B', t: 'Le lenzuola 140x200 vanno bene per un materasso alto 25 cm?', col: 'auto', perche: 'Misure dalla base di conoscenza' },
  { n: 'Giorgio', c: '#A86A10', t: 'È la terza volta che scrivo, il tavolino è arrivato rotto…', col: 'umano', perche: 'Terzo sollecito: a Marta con riepilogo e proposta' },
  { n: 'Sofia', c: '#2E6FD8', t: 'Ho sbagliato il civico nell’ordine di stamattina.', col: 'ok', perche: 'Modifica dell’ordine, non ancora spedito' },
];
const $ = (id) => document.getElementById(id);
const carta = (m) => `<div class="msg"><i style="background:${m.c}">${m.n[0]}</i><b>${m.n}</b><p>${m.t}</p><small>${m.perche}</small></div>`;
const ridotto = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

function reset() {
  $('incoming').innerHTML = MESSAGGI.map((m, i) => carta(m).replace('class="msg"', `class="msg" style="animation-delay:${i * 90}ms"`)).join('');
  document.querySelectorAll('.drop').forEach((d) => { d.innerHTML = ''; });
  $('incoming').querySelectorAll('small').forEach((s) => { s.hidden = true; });
}
reset();

$('sort').addEventListener('click', () => {
  const fatto = !$('incoming').children.length;
  if (fatto) { reset(); $('sort').textContent = 'Smista come Sportello'; return; }
  $('sort').disabled = true;
  [...$('incoming').children].forEach((el, i) => {
    setTimeout(() => {
      const m = MESSAGGI[i];
      el.style.visibility = 'hidden';
      document.querySelector(`.col[data-col="${m.col}"] .drop`).insertAdjacentHTML('beforeend', carta(m));
      if (i === MESSAGGI.length - 1) {
        $('incoming').innerHTML = '';
        $('sort').disabled = false;
        $('sort').textContent = 'Ricomincia';
      }
    }, ridotto ? 0 : 380 * i);
  });
});

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
