import { collegaAgente, esc } from '/core/agente-client.js';

const $ = (id) => document.getElementById(id);
const feed = $('feed');
const STATI = { nuovo: ['Nuovo', ''], analisi: ['In analisi', 'analisi'], assegnato: ['Assegnato', 'assegnato'], auto: ['Risposta automatica', 'auto'], bozza: ['Bozza in attesa', 'bozza'], approvata: ['Risposta approvata', 'approvata'] };
const iniziali = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);

let coda = [], attivo = null, testo = null, gruppo = null;
const tk = {};
const righe = new Map();
const giu = () => { feed.scrollTop = feed.scrollHeight; };

function listaCoda() {
  $('coda').innerHTML = coda.map((t) => {
    const s = tk[t.id];
    return `<li class="${attivo === t.id ? 'attivo' : ''}">
      <span class="id">${t.id} · ${t.canale}</span><span class="pr ${t.priorita}">${t.priorita}</span>
      <b>${esc(t.oggetto)}</b><span class="who">${esc(t.richiedente)} · ${esc(t.azienda)}</span>
      <span class="st"><span class="badge ${STATI[s.stato][1]}">${STATI[s.stato][0]}</span>${s.assegnatario ? `<span class="ass"><i>${iniziali(s.assegnatario)}</i>${esc(s.assegnatario.split(' ')[0])}</span>` : ''}</span></li>`;
  }).join('');
  const aperti = coda.filter((t) => ['nuovo', 'analisi', 'bozza'].includes(tk[t.id].stato)).length;
  $('aperti').textContent = aperti ? `${aperti} da gestire` : 'tutto gestito';
}

function mostra(id) {
  attivo = id;
  const t = coda.find((x) => x.id === id), s = tk[id];
  $('det').innerHTML = `<div class="tk">
    <header><span class="id">${t.id}</span><b>${esc(t.oggetto)}</b><small>${esc(t.richiedente)} · ${esc(t.azienda)} · ${t.tipo === 'collega' ? 'collega, via email' : 'cliente, dal portale'} · ${t.ora}</small></header>
    <div class="req">${esc(t.testo)}</div>
    ${s.incidente ? `<div class="inc"><b>${esc(s.incidente.id)}</b><span>${esc(s.incidente.servizio)} · ${esc(s.incidente.descrizione)}</span></div>` : ''}
    ${s.risultati ? `<div class="sec">Dalla knowledge base</div><div class="kb">${s.risultati.map((r) => `<div class="res"><span class="src ${r.fonte}">${r.fonte}</span>
      <div><b>${esc(r.titolo)}</b><small>${r.id} · ${esc(r.spazio)} · aggiornata il ${r.aggiornata.split('-').reverse().join('/')}</small></div>
      <span class="conf ${r.confidenza}">confidenza ${r.confidenza}<i><u></u></i></span></div>`).join('')}</div>` : ''}
    ${s.pagina ? `<div class="pg"><h4>${esc(s.pagina.titolo)}<span>${s.pagina.fonte} · ${esc(s.pagina.autore)}</span></h4><div>${esc(s.pagina.testo)}</div>
      ${s.pagina.passi ? `<ol>${s.pagina.passi.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}</div>` : ''}
    ${s.nota ? `<div class="nota"><header>🔒 Nota privata · visibile solo al team<span class="ass"><i>${iniziali(s.assegnatario)}</i>${esc(s.assegnatario)} · ${esc(s.categoria)}</span></header>
      <div>${esc(s.nota)}</div>${s.fonti?.length ? `<div class="f">Fonti: ${s.fonti.map((f) => `<code>${esc(f)}</code>`).join('')}</div>` : '<div class="f">Nessuna fonte adatta: intervento del tecnico</div>'}</div>` : ''}
    ${s.risposta ? `<div class="reply${s.risposta.auto ? ' auto' : ''}"><small>${s.risposta.auto ? 'Inviata in automatico' : 'Inviata dopo la tua approvazione'} · fonti ${s.risposta.fonti.join(', ')}</small>${esc(s.risposta.testo)}</div>` : ''}
  </div>`;
  listaCoda();
}

function carta(ev) {
  const p = ev.anteprima || {};
  const el = document.createElement('div');
  el.className = 'approve'; el.id = 'ap-' + ev.id;
  el.innerHTML = `<header>Bozza per ${esc(p.richiedente)} · ${esc(p.motivo || '')} · serve la tua approvazione</header>
    <div class="body"><div class="meta"><b>${esc(p.ticket)}</b> · ${esc(p.oggetto)}</div><pre>${esc(p.testo)}</pre></div>
    <div class="actions"><button class="btn yes" type="button" data-ok>Approva e invia</button><button class="btn" type="button" data-no>Rifiuta</button></div>`;
  el.querySelector('[data-ok]').onclick = () => agente.approva(ev.id, true);
  el.querySelector('[data-no]').onclick = () => agente.approva(ev.id, false);
  return el;
}

function riepilogo(r) {
  attivo = null; listaCoda();
  $('det').innerHTML = `<div class="sum"><h3>Riepilogo della coda · ${esc(r.azienda)}</h3>
    <div class="kpis">
      <div class="kpi a"><b>${r.risposte_automatiche}</b><span>risposte automatiche, procedura verificata</span></div>
      <div class="kpi b"><b>${r.bozze_approvate}</b><span>bozze approvate da te</span></div>
      <div class="kpi c"><b>${r.a_un_tecnico}</b><span>affidati a un tecnico</span></div>
      <div class="kpi"><b>${r.pagine_citate.length}</b><span>pagine della knowledge base citate</span></div>
    </div>
    <p>${esc(r.sintesi)}</p>
    <ul>${r.tecnici.map((x) => { const t = coda.find((c) => c.id === x.ticket); return `<li><code>${x.ticket}</code><span>${esc(t.oggetto)}</span><span class="ass"><i>${iniziali(x.assegnatario)}</i>${esc(x.assegnatario)}</span></li>`; }).join('')}</ul></div>`;
}

const nuovo = () => ({ stato: 'nuovo' });
const agente = collegaAgente({
  avvio: () => {
    feed.innerHTML = ''; righe.clear(); attivo = null;
    coda.forEach((t) => { tk[t.id] = nuovo(); });
    listaCoda(); $('det').innerHTML = '';
    $('run').disabled = true; $('run').textContent = 'Minerva al lavoro…';
  },
  testo: ({ delta }) => {
    if (!testo) { testo = document.createElement('p'); testo.className = 'say scrive'; feed.append(testo); gruppo = null; }
    testo.textContent += delta; giu();
  },
  testo_fine: () => { testo?.classList.remove('scrive'); testo = null; },
  strumento: (ev) => {
    if (ev.approvazione) return;
    if (!gruppo) { gruppo = document.createElement('div'); feed.append(gruppo); }
    const r = document.createElement('div');
    r.className = 'tool';
    r.innerHTML = `<span class="lbl">${esc(ev.etichetta)}</span><span class="spin"></span>`;
    gruppo.append(r); righe.set(ev.id, r);
    giu();
  },
  risultato: (ev) => {
    const r = righe.get(ev.id);
    if (r) { r.classList.add('ok'); r.querySelector('.spin').outerHTML = `<span class="res2">${esc(ev.sintesi)}</span>`; }
    const v = ev.vista;
    if (v?.tipo === 'coda') listaCoda();
    if (v?.tipo === 'fonti') { const s = tk[v.ticket]; s.risultati = v.risultati; if (s.stato === 'nuovo') s.stato = 'analisi'; mostra(v.ticket); }
    if (v?.tipo === 'servizi' && v.incidenti.length) {
      // L'incidente si mostra sui ticket che parlano di posta
      coda.filter((t) => /outlook|email|posta/i.test(t.oggetto)).forEach((t) => { tk[t.id].incidente = v.incidenti[0]; });
      const t = coda.find((x) => tk[x.id].incidente);
      if (t) mostra(t.id);
    }
    if (v?.tipo === 'pagina') { tk[v.ticket].pagina = v.pagina; mostra(v.ticket); }
    if (v?.tipo === 'nota') { Object.assign(tk[v.ticket], { nota: v.nota, assegnatario: v.assegnatario, categoria: v.categoria, fonti: v.fonti, stato: 'assegnato' }); mostra(v.ticket); }
    if (v?.tipo === 'risposta') { Object.assign(tk[v.ticket], { risposta: v, stato: v.auto ? 'auto' : 'approvata' }); mostra(v.ticket); }
    giu();
  },
  approvazione: (ev) => { const s = tk[ev.input.ticket]; s.stato = 'bozza'; mostra(ev.input.ticket); feed.append(carta(ev)); gruppo = null; giu(); },
  approvato: ({ id }) => { const c = $('ap-' + id); c.classList.add('fatto'); c.querySelector('header').textContent = 'Approvata da te · inviata'; },
  rifiutato: ({ id }) => { const c = $('ap-' + id); c.classList.add('no'); c.querySelector('header').textContent = 'Rifiutata · non inviata'; },
  output: (ev) => { if (ev.tipo === 'riepilogo') riepilogo(ev.contenuto); },
  fine: (ev) => {
    feed.insertAdjacentHTML('beforeend', `<span class="riepilogo">${ev.strumenti} strumenti · ${ev.approvazioni} bozze approvate · ${ev.secondi} s</span>`);
    $('run').disabled = false; $('run').textContent = 'Gestisci di nuovo'; giu();
  },
  errore: (ev) => { feed.insertAdjacentHTML('beforeend', `<p class="say">Errore: ${esc(ev.messaggio)}</p>`); $('run').disabled = false; },
});

const info = await agente.info();
$('azienda').textContent = `${info.azienda} · Service desk`;
$('conn').innerHTML = info.fonti.map((f) => `<span>${esc(f.nome)}</span>`).join('');
$('mode').hidden = info.modalita !== 'demo';
coda = await agente.fonte('coda');
coda.forEach((t) => { tk[t.id] = nuovo(); });
listaCoda();
$('run').onclick = () => agente.avvia();
