import { collegaAgente, esc } from '/core/agente-client.js';

const $ = (id) => document.getElementById(id);
const feed = $('feed');
const euro = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
const prezzo = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const data = (s) => s.split('-').reverse().join('/');
const ETICHETTE = { attesa: 'Da verificare', verifica: 'In verifica', conforme: 'Conforme', contestare: 'Da contestare', bloccare: 'Da bloccare',
  registrata: 'Registrata', bloccata: 'Pagamento bloccato', contestata: 'Contestata' };
const ANOMALIE = { prezzo: 'Prezzo diverso dall’ordine', quantita: 'Quantità non consegnata', doppione: 'Fattura già registrata', iban: 'IBAN diverso dall’anagrafica', importi: 'Importi incoerenti', ordine_mancante: 'Ordine mancante' };

let fatture = [], testo = null, gruppo = null;
const righe = new Map();
const giu = () => { feed.scrollTop = feed.scrollHeight; };

function stato(id, s) {
  const tr = document.querySelector(`#inv tr[data-id="${id}"]`);
  if (!tr) return;
  tr.querySelector('.badge').className = 'badge ' + s;
  tr.querySelector('.badge').textContent = ETICHETTE[s];
  document.querySelectorAll('#inv tr.attiva').forEach((r) => r.classList.remove('attiva'));
  if (s === 'verifica') tr.classList.add('attiva');
}

function tabella() {
  $('inv').tBodies[0].innerHTML = fatture.map((f) => `<tr data-id="${f.id}">
    <td><b>${esc(f.fornitore)}</b></td><td>${esc(f.numero)}</td><td>${data(f.data)}</td><td class="n">${euro(f.totale)}</td>
    <td><span class="badge attesa">${ETICHETTE.attesa}</span></td></tr>`).join('');
  $('tot').textContent = `${fatture.length} fatture · ${euro(fatture.reduce((s, f) => s + f.totale, 0))}`;
}

/* ---------- Controllo a tre vie ---------- */
function controllo(v) {
  const f = fatture.find((x) => x.id === v.id);
  const tipi = new Set(v.anomalie.map((a) => a.tipo));
  const segna = (cond, txt) => (cond ? `<mark>${txt}</mark>` : txt);
  const rows = v.confronto.map((r) => {
    const pDiv = r.ordine && Math.abs(r.ordine.prezzo - r.fattura.prezzo) > 0.001;
    const qDiv = r.consegnati != null && r.fattura.quantita > r.consegnati;
    return `<tr><td>${esc(r.descrizione)}<small>${esc(r.codice)}</small></td>
      <td>${r.ordine ? `${r.ordine.quantita} × ${prezzo(r.ordine.prezzo)}` : '—'}</td>
      <td>${r.consegnati == null ? 'servizio' : segna(qDiv, r.consegnati)}</td>
      <td>${segna(qDiv, r.fattura.quantita)} × ${segna(pDiv, prezzo(r.fattura.prezzo))}</td></tr>`;
  }).join('');
  const controlli = [
    ['Ordine', !tipi.has('ordine_mancante')], ['Prezzi', !tipi.has('prezzo')], ['Quantità consegnate', !tipi.has('quantita')],
    ['Non duplicata', !tipi.has('doppione')], ['IBAN in anagrafica', !tipi.has('iban')], ['IVA e totale', !tipi.has('importi')],
  ];
  $('detail').innerHTML = `<div class="match">
    <header><b>${esc(v.fornitore)}</b><span>fattura ${esc(v.numero)} · ordine ${esc(f.ordine)}${v.bolle.length ? ' · ' + v.bolle.join(', ') : ''}</span>
      <span class="badge ${v.esito}">${ETICHETTE[v.esito]}</span></header>
    <table class="three"><thead><tr><th>Articolo</th><th>Ordine<small>q.tà × prezzo</small></th><th>Consegnato<small>da DDT</small></th><th>Fattura<small>q.tà × prezzo</small></th></tr></thead>
      <tbody>${rows}</tbody></table>
    <div class="checks">${controlli.map(([n, ok]) => `<span class="check${ok ? '' : ' ko'}">${n}</span>`).join('')}</div>
    ${v.anomalie.length ? `<div class="anom">${v.anomalie.map((a) => `<div class="${a.gravita}"><span><b>${ANOMALIE[a.tipo]}</b> · ${esc(a.descrizione)}
      ${a.tipo === 'iban' ? `<small>fattura ${esc(a.iban_fattura)}<br>anagrafica ${esc(a.iban_anagrafica)}</small>` : ''}</span>
      ${a.importo ? `<em>${euro(a.importo)}</em>` : ''}</div>`).join('')}</div>` : ''}
  </div>`;
}

/* ---------- Riepilogo ---------- */
function riepilogo(r) {
  $('detail').innerHTML = `<div class="sum">
    <h2>Riepilogo del controllo · ${data(r.data)}</h2>
    <div class="kpis">
      <div class="kpi"><small>Registrato</small><b>${euro(r.registrato.importo)}</b><span>${r.registrato.n} fatture</span></div>
      <div class="kpi"><small>Pagamenti bloccati</small><b>${euro(r.bloccato.importo)}</b><span>${r.bloccato.n} fatture</span></div>
      <div class="kpi"><small>Contestato</small><b>${euro(r.contestato.importo)}</b><span>${r.contestato.n} fatture</span></div>
      <div class="kpi prot"><small>Importo protetto</small><b>${euro(r.importo_a_rischio)}</b><span>non pagato per errore</span></div>
    </div>
    <p class="s">${esc(r.sintesi)}</p>
    ${r.note?.length ? `<h3>Note per l’amministrazione</h3><ul>${r.note.map((n) => `<li><code>${esc(n.fattura)}</code><span>${esc(n.testo)}</span></li>`).join('')}</ul>` : ''}
  </div>`;
}

/* ---------- Approvazioni ---------- */
function carta(ev) {
  const p = ev.anteprima || {};
  const el = document.createElement('div');
  el.className = 'approve'; el.id = 'ap-' + ev.id;
  const corpo = p.tipo === 'blocco'
    ? p.fatture.map((x) => `<div class="row"><code>${esc(x.id)}</code><span>${esc(x.fornitore)}</span><em>${euro(x.totale)}</em><small>${esc(x.motivo)}</small></div>`).join('')
    : `<div class="meta">A: <b>${esc(p.a)}</b></div><div class="subj">${esc(p.oggetto)}</div><pre>${esc(p.testo)}</pre>`;
  el.innerHTML = `<header>${p.tipo === 'blocco' ? 'Blocco dei pagamenti' : 'Email al fornitore'} · serve la tua approvazione</header>
    <div class="body">${corpo}</div>
    <div class="actions"><button class="btn yes" type="button" data-ok>Approva</button><button class="btn" type="button" data-no>Rifiuta</button></div>`;
  el.querySelector('[data-ok]').onclick = () => agente.approva(ev.id, true);
  el.querySelector('[data-no]').onclick = () => agente.approva(ev.id, false);
  return el;
}

const agente = collegaAgente({
  avvio: () => {
    feed.innerHTML = ''; righe.clear(); tabella();
    $('detail').innerHTML = `<div class="placeholder">Il controllo a tre vie di ogni fattura comparirà qui: ordine, merce consegnata e fattura a confronto.</div>`;
    $('run').disabled = true; $('run').textContent = 'Controllo in corso…';
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
    // Le verifiche compaiono una alla volta, quando la precedente è finita
    const inCoda = [...righe.values()].some((y) => y.ev.nome === 'verifica_fattura' && !y.r.classList.contains('fatta'));
    r.hidden = ev.nome === 'verifica_fattura' && inCoda;
    if (ev.nome === 'verifica_fattura' && !inCoda) stato(ev.input.id, 'verifica');
    gruppo.append(r); righe.set(ev.id, { r, ev });
    giu();
  },
  risultato: (ev) => {
    const x = righe.get(ev.id);
    const v = ev.vista;
    if (x) {
      const esito = v?.tipo === 'verifica' ? v.esito : null;
      x.r.hidden = false;
      x.r.classList.add('fatta');
      x.r.classList.add(esito === 'bloccare' ? 'ko' : esito === 'contestare' ? 'warn' : 'ok');
      x.r.querySelector('.spin').outerHTML = `<span class="res">${esc(ev.sintesi)}</span>`;
      // La prossima verifica in coda diventa visibile e la sua fattura passa "in verifica"
      const prossima = [...righe.values()].find((y) => y.r.hidden && y.ev.nome === 'verifica_fattura');
      if (prossima) { prossima.r.hidden = false; stato(prossima.ev.input.id, 'verifica'); }
    }
    if (v?.tipo === 'arrivo') { /* la tabella è già piena */ }
    if (v?.tipo === 'verifica') { stato(v.id, v.esito); controllo(v); }
    if (v?.tipo === 'stato') stato(v.id, v.stato);
    if (v?.tipo === 'stati') v.ids.forEach((id) => stato(id, v.stato));
    giu();
  },
  approvazione: (ev) => { feed.append(carta(ev)); gruppo = null; giu(); },
  approvato: ({ id }) => { const c = $('ap-' + id); c.classList.add('fatto'); c.querySelector('header').textContent = 'Approvata da te · eseguita'; },
  rifiutato: ({ id }) => { const c = $('ap-' + id); c.classList.add('no'); c.querySelector('header').textContent = 'Rifiutata · non eseguita'; },
  output: (ev) => { if (ev.tipo === 'riepilogo') riepilogo(ev.contenuto); },
  fine: (ev) => {
    feed.insertAdjacentHTML('beforeend', `<span class="riepilogo">${ev.strumenti} strumenti · ${ev.approvazioni} azioni approvate · ${ev.secondi} s</span>`);
    $('run').disabled = false; $('run').textContent = 'Controlla di nuovo'; giu();
  },
  errore: (ev) => { feed.insertAdjacentHTML('beforeend', `<p class="say">Errore: ${esc(ev.messaggio)}</p>`); $('run').disabled = false; },
});

const info = await agente.info();
$('azienda').textContent = info.azienda;
$('mode').hidden = info.modalita !== 'demo';
fatture = await agente.fonte('fatture');
tabella();
$('run').onclick = () => agente.avvia();
