/* ---------- Smistamento degli otto messaggi della demo ----------
   Per ogni messaggio: canale, dove lo mette Comitas e perché, secondo le regole dell'agente. */
const CANALI = { chat: 'Chat', email: 'Email', ig: 'Instagram · commento', igdm: 'Instagram · DM', fb: 'Facebook · commento' };
const MESSAGGI = [
  { n: 'Chiara', c: '#6A4BE8', k: 'chat', t: 'Il mio ordine doveva arrivare ieri, dov’è?', col: 'auto', perche: 'Tracking verificato, nuova data di consegna comunicata' },
  { n: 'Davide', c: '#1E8E5A', k: 'email', t: 'Il piumone è arrivato con una macchia, allego foto.', col: 'ok', perche: 'Sostituzione da 129 € con ritiro gratuito' },
  { n: '@laura.pozzi', c: '#C2416B', k: 'ig', t: 'Vanno bene per un materasso 140x200 alto 25 cm? 😍', col: 'auto', perche: 'Risposta pubblica con le specifiche di prodotto' },
  { n: 'Giorgio', c: '#A86A10', k: 'email', t: 'È la terza volta che scrivo, il tavolino è arrivato rotto…', col: 'umano', perche: 'Terzo sollecito: caso a un operatore, con sintesi e proposta' },
  { n: '@sofi.galli', c: '#2E6FD8', k: 'igdm', t: 'Ho sbagliato il civico nell’ordine di stamattina.', col: 'ok', perche: 'Modifica dell’indirizzo, ordine non ancora spedito' },
  { n: 'Giorgio F.', c: '#A86A10', k: 'fb', t: 'Arrivato rotto e nessuno risponde. Non comprate qui.', col: 'ok', perche: 'Stesso cliente dell’email: risposta pubblica approvata, caso unificato' },
  { n: '@soldi.facili', c: '#8A8396', k: 'ig', t: '🔥 Guadagna 500€ al giorno da casa! 🔥', col: 'nasconde', perche: 'Spam: commento nascosto' },
  { n: '@annavilla.home', c: '#1E8E5A', k: 'ig', t: 'Arrivato ieri, è ancora più bello dal vivo! 💚', col: 'auto', perche: 'Risposta pubblica di ringraziamento' },
];
const $ = (id) => document.getElementById(id);
const carta = (m) => `<div class="msg"><i style="background:${m.c}">${m.n.replace('@', '')[0].toUpperCase()}</i><b>${m.n}<em class="ch ${m.k}">${CANALI[m.k]}</em></b><p>${m.t}</p><small>${m.perche}</small></div>`;
const ridotto = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

function reset() {
  $('incoming').innerHTML = MESSAGGI.map((m, i) => carta(m).replace('class="msg"', `class="msg" style="animation-delay:${i * 90}ms"`)).join('');
  document.querySelectorAll('.drop').forEach((d) => { d.innerHTML = ''; });
  $('incoming').querySelectorAll('small').forEach((s) => { s.hidden = true; });
}
reset();

$('sort').addEventListener('click', () => {
  const fatto = !$('incoming').children.length;
  if (fatto) { reset(); $('sort').textContent = 'Avvia lo smistamento'; return; }
  $('sort').disabled = true;
  [...$('incoming').children].forEach((el, i) => {
    setTimeout(() => {
      const m = MESSAGGI[i];
      el.style.visibility = 'hidden';
      document.querySelector(`.col[data-col="${m.col}"] .drop`).insertAdjacentHTML('beforeend', carta(m));
      if (i === MESSAGGI.length - 1) {
        $('incoming').innerHTML = '';
        $('sort').disabled = false;
        $('sort').textContent = 'Ripeti la simulazione';
      }
    }, ridotto ? 0 : 300 * i);
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
