/* ---------- I cinque ticket della demo e cosa decide Minerva ----------
   Fonti, confidenza, assegnatario e decisione sono quelli della sessione dell'agente. */
const TICKET = [
  { id: 'SD-2041', da: 'Silvia Brambilla', tipo: 'Cliente · portale', ogg: 'VPN non si connette da casa, errore 809',
    fonte: { s: 'Confluence', t: 'VPN: errore 809 su Windows 11', id: 'CF-101' }, conf: 'alta',
    a: 'Luca Riva', cat: 'Rete e VPN', esito: 'auto',
    nota: 'Errore 809: il router di casa blocca L2TP/IPsec. Procedura CF-101 inviata al cliente (profilo VPN-SSL). Da chiudere se conferma.',
    perche: 'Procedura verificata e passi semplici: risposta inviata in automatico.' },
  { id: 'SD-2042', da: 'Roberto Sala', tipo: 'Collega · email', ogg: 'PC e account per una nuova collega',
    fonte: { s: 'Notion', t: 'Onboarding: PC e account per un nuovo dipendente', id: 'NT-07' }, conf: 'alta',
    a: 'Elena Conti', cat: 'Onboarding', esito: 'auto',
    nota: 'Nuova collega in commerciale dal 26/10. Inviata la procedura NT-07: il modulo va compilato entro oggi per rispettare i 2 giorni lavorativi.',
    perche: 'Procedura interna documentata: risposta automatica, con registro informale per un collega.' },
  { id: 'SD-2043', da: 'Marco Ferri', tipo: 'Cliente · portale', ogg: 'Outlook disconnesso su tutti i PC', urg: true,
    fonte: { s: 'Confluence', t: 'Outlook disconnesso o posta che non arriva', id: 'CF-114' }, conf: 'alta',
    a: 'Andrea Galli', cat: 'Posta e Microsoft 365', esito: 'bozza', inc: 'INC-88 · Exchange Online degradato',
    nota: 'Sintomi compatibili con INC-88. Come da CF-114 non ricreare i profili. Soluzione temporanea: Outlook sul web.',
    perche: 'Ticket collegato a un incidente aperto: la risposta richiede approvazione anche con procedura corretta.' },
  { id: 'SD-2044', da: 'Davide Colombo', tipo: 'Cliente · portale', ogg: 'Credenziali da amministratore del server',
    fonte: { s: 'Confluence', t: 'Richieste di accesso privilegiato', id: 'CF-120' }, conf: 'alta',
    a: 'Paolo Neri', cat: 'Sicurezza e accessi', esito: 'bozza',
    nota: 'Le credenziali da amministratore non vanno comunicate (CF-120). Serve il modulo firmato dal responsabile IT del cliente, poi sessione assistita e registrata.',
    perche: 'Categoria sicurezza: invio automatico bloccato, bozza in attesa di approvazione.' },
  { id: 'SD-2045', da: 'Laura Pirovano', tipo: 'Cliente · portale', ogg: 'Stampante del terzo piano: pagine bianche',
    fonte: { s: 'Confluence', t: 'Stampanti: coda di stampa bloccata', id: 'CF-131' }, conf: 'bassa',
    a: 'Marco Sala', cat: 'Postazioni e stampanti', esito: 'tecnico',
    nota: 'Nessuna procedura adatta: CF-131 riguarda la coda bloccata. Pagine bianche dopo il cambio toner: probabile sigillo non rimosso o tamburo.',
    perche: 'La pagina trovata non copre il caso: nessuna risposta automatica, intervento del tecnico.' },
];
const ESITI = {
  auto: ['Risposta inviata in automatico', 'auto'],
  bozza: ['Bozza in attesa di approvazione', 'bozza'],
  tecnico: ['Affidato al tecnico, senza risposta automatica', 'tecnico'],
};
const $ = (id) => document.getElementById(id);
const iniziali = (n) => n.split(' ').map((x) => x[0]).join('');
const BREVE = { auto: 'Automatica', bozza: 'Bozza', tecnico: 'Tecnico' };

$('tickets').innerHTML = TICKET.map((t, i) => `<li><button type="button" role="tab" id="tab-${i}" aria-selected="false" data-i="${i}">
  <span class="tid">${t.id}${t.urg ? ' <em>alta</em>' : ''}</span><b>${t.ogg}</b><small>${t.da} · ${t.tipo}</small>
  <span class="mini ${t.esito}">${BREVE[t.esito]}</span></button></li>`).join('');

function mostra(i) {
  const t = TICKET[i];
  document.querySelectorAll('#tickets button').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.i === i)));
  $('esito').setAttribute('aria-labelledby', 'tab-' + i);
  $('esito').innerHTML = `
    ${t.inc ? `<div class="inc">Incidente aperto · ${t.inc}</div>` : ''}
    <div class="lbl">Dalla knowledge base</div>
    <div class="src"><span class="sys ${t.fonte.s.toLowerCase()}">${t.fonte.s}</span><b>${t.fonte.t}</b><code>${t.fonte.id}</code>
      <span class="conf ${t.conf}"><i></i>confidenza ${t.conf}</span></div>
    <div class="lbl">Nota privata nel ticket</div>
    <div class="nota"><p>${t.nota}</p><span class="ass"><i>${iniziali(t.a)}</i><span>Assegnato a <b>${t.a}</b> · ${t.cat}</span></span></div>
    <div class="dec ${ESITI[t.esito][1]}"><b>${ESITI[t.esito][0]}</b><span>${t.perche}</span></div>`;
  const lista = $('tickets');
  if (lista.scrollWidth > lista.clientWidth) lista.scrollTo({ left: $('tab-' + i).parentElement.offsetLeft - lista.offsetLeft, behavior: 'smooth' });
  const el = $('esito'); el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
}
$('tickets').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) mostra(+b.dataset.i); });
$('tickets').addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const i = +document.activeElement.dataset.i, n = TICKET.length;
  const j = (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : n - 1)) % n;
  e.preventDefault(); $('tab-' + j).focus(); mostra(j);
});
mostra(0);

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
