import { collegaAgente, esc } from '/core/agente-client.js';

const $ = (id) => document.getElementById(id);
const feed = $('feed');
const euro = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
const prezzo = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const data = (s) => s.split('-').reverse().join('/');
const ETICHETTE = { attesa: 'Da verificare', verifica: 'In verifica', conforme: 'Conforme', contestare: 'Da contestare', bloccare: 'Da bloccare',
  registrata: 'Registrata', bloccata: 'Pagamento bloccato', contestata: 'Contestata' };
const ANOMALIE = { prezzo: 'Prezzo diverso dall’ordine', quantita: 'Quantità non consegnata', doppione: 'Fattura già registrata', iban: 'IBAN diverso dall’anagrafica', importi: 'Importi incoerenti', ordine_mancante: 'Ordine mancante' };

let fatture = [], attivo = null, testo = null, gruppo = null;

/* ---------- Viste: ciclo passivo, ciclo attivo, riepilogo ---------- */
function vista(v) {
  document.querySelectorAll('#viste button').forEach((b) => { b.classList.toggle('on', b.dataset.vista === v); if (b.dataset.vista === v) b.disabled = false; });
  document.querySelectorAll('section.left').forEach((x) => { x.hidden = x.dataset.vista !== v; });
}
$('viste').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) vista(b.dataset.vista); });
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

/* ---------- Ciclo attivo ---------- */
const STATI_A = { da_fatturare: 'Da fatturare', pronta: 'Bozza pronta', da_completare: 'Da completare', inviata: 'Inviata allo SDI' };
function tabellaDdt() {
  $('ddt').tBodies[0].innerHTML = attivo.ddt.map((d) => `<tr data-ddt="${esc(d.numero)}">
    <td><b>${esc(d.cliente)}</b></td><td>${esc(d.numero.replace('DDT ', ''))}</td><td>${esc(d.ordine)}</td><td class="n">—</td>
    <td><span class="badge attesa">${STATI_A.da_fatturare}</span></td></tr>`).join('');
  $('tot-a').textContent = `${attivo.ddt.length} consegne · ${attivo.aperte.length} fatture aperte · ${attivo.movimenti.length} movimenti`;
}
function statoDdt(ddt, st, numero, totale) {
  const tr = document.querySelector(`#ddt tr[data-ddt="${ddt}"]`); if (!tr) return;
  const cls = { pronta: 'conforme', da_completare: 'contestare', inviata: 'registrata' }[st] || 'attesa';
  tr.querySelector('.badge').className = 'badge ' + cls;
  tr.querySelector('.badge').textContent = STATI_A[st] + (numero && st !== 'da_completare' ? ` · ${numero.split('/')[1]}` : '');
  if (totale != null) tr.querySelector('.n').textContent = euro(totale);
  document.querySelectorAll('#ddt tr.attiva').forEach((r) => r.classList.remove('attiva')); tr.classList.add('attiva');
}
function bozza(b) {
  $('detail-a').innerHTML = `<div class="match fv">
    <header><b>${esc(b.cliente)}</b><span>${b.numero ? esc(b.numero) : 'bozza'} · ${esc(b.ddt)} · ordine ${esc(b.ordine)}</span>
      <span class="badge ${b.esito === 'pronta' ? 'conforme' : 'contestare'}">${STATI_A[b.esito]}</span></header>
    <table class="three"><thead><tr><th>Articolo</th><th>Quantità<small>da DDT</small></th><th>Prezzo<small>da ordine cliente</small></th><th>Importo</th></tr></thead>
      <tbody>${b.righe.map((r) => `<tr><td>${esc(r.descrizione)}<small>${esc(r.codice)}</small></td><td>${r.quantita}</td><td>${prezzo(r.prezzo)}</td><td>${euro(r.importo)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Imponibile · IVA 22%</td><td></td><td>${euro(b.imponibile)}</td><td>${euro(b.iva)}</td></tr>
        <tr class="tt"><td>Totale · scadenza ${data(b.scadenza)} <small>${esc(b.pagamento)}</small></td><td></td><td></td><td>${euro(b.totale)}</td></tr></tfoot></table>
    <div class="checks">${b.controlli.map((c) => `<span class="check${c.ok ? '' : ' ko'}">${esc(c.nome)}</span>`).join('')}</div>
    ${b.mancanti.length ? `<div class="anom"><div class="alta"><span><b>Anagrafica incompleta</b> · ${b.nuovo_cliente ? 'cliente nuovo, ' : ''}manca il ${esc(b.mancanti.join(', '))}: la fattura non può essere inviata allo SDI</span></div></div>` : ''}
  </div>`;
}
function incassi(v) {
  const per = Object.fromEntries(v.abbinati.map((a) => [a.fattura, a]));
  const sc = Object.fromEntries(v.scadute.map((f) => [f.numero, f]));
  $('detail-a').innerHTML = `<div class="match inc">
    <header><b>Riconciliazione incassi</b><span>${v.abbinati.length} movimenti abbinati · ${euro(v.totale)}</span></header>
    <table class="three"><thead><tr><th>Fattura</th><th>Scadenza</th><th>Totale</th><th>Esito</th></tr></thead><tbody>
      ${v.aperte.map((f) => { const a = per[f.numero], s = sc[f.numero];
        return `<tr data-fv="${esc(f.numero)}"><td>${esc(f.cliente)}<small>${esc(f.numero)}</small></td><td>${data(f.scadenza)}</td><td>${euro(f.totale)}</td>
        <td>${a ? `<span class="pill ok">Incassata · ${esc(a.movimento)}</span><small>${esc(a.metodo)}</small>` : s ? `<span class="pill ko">Scaduta da ${s.giorni_ritardo} giorni</span>` : '<span class="pill">Non ancora scaduta</span>'}</td></tr>`; }).join('')}
    </tbody></table>
    ${v.non_abbinati.length ? `<div class="anom">${v.non_abbinati.map((m) => `<div><span><b>${esc(m.id)} · ${esc(m.ordinante)}</b> · ${esc(m.causale)}<small>${esc(m.motivo)}: lasciato all’amministrazione</small></span><em>${euro(m.importo)}</em></div>`).join('')}</div>` : ''}
  </div>`;
}

/* ---------- Riepilogo ---------- */
function riepilogo(r) {
  const a = r.attivo;
  $('riep').innerHTML = `<div class="sum">
    <h2>Riepilogo per l’amministrazione · ${data(r.data)}</h2>
    <h3>Ciclo passivo</h3>
    <div class="kpis">
      <div class="kpi"><small>Registrato</small><b>${euro(r.registrato.importo)}</b><span>${r.registrato.n} fatture</span></div>
      <div class="kpi"><small>Pagamenti bloccati</small><b>${euro(r.bloccato.importo)}</b><span>${r.bloccato.n} fatture</span></div>
      <div class="kpi"><small>Contestato</small><b>${euro(r.contestato.importo)}</b><span>${r.contestato.n} fatture</span></div>
      <div class="kpi prot"><small>Importo protetto</small><b>${euro(r.importo_a_rischio)}</b><span>non pagato per errore</span></div>
    </div>
    ${a ? `<h3>Ciclo attivo</h3><div class="kpis">
      <div class="kpi"><small>Fatture inviate allo SDI</small><b>${euro(a.emesse.importo)}</b><span>${a.emesse.n} fatture</span></div>
      <div class="kpi"><small>Incassi abbinati</small><b>${euro(a.incassato.importo)}</b><span>${a.incassato.n} movimenti</span></div>
      <div class="kpi"><small>Scaduto sollecitato</small><b>${euro(a.scaduto.importo)}</b><span>${a.solleciti} sollecito</span></div>
      <div class="kpi"><small>Da completare</small><b>${a.da_completare.length} bozza</b><span>${a.movimenti_da_verificare} movimento da verificare</span></div>
    </div>` : ''}
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
    : p.tipo === 'sdi'
      ? p.fatture.map((x) => `<div class="row"><code>${esc(x.numero)}</code><span>${esc(x.cliente)}</span><em>${euro(x.totale)}</em><small>scadenza ${data(x.scadenza)}</small></div>`).join('')
      : `<div class="meta">A: <b>${esc(p.a)}</b></div><div class="subj">${esc(p.oggetto)}</div><pre>${esc(p.testo)}</pre>`;
  const titolo = { blocco: 'Blocco dei pagamenti', sdi: 'Invio delle fatture allo SDI', sollecito: 'Sollecito al cliente' }[p.tipo] || 'Email al fornitore';
  el.innerHTML = `<header>${titolo} · serve la tua approvazione</header>
    <div class="body">${corpo}</div>
    <div class="actions"><button class="btn yes" type="button" data-ok>Approva</button><button class="btn" type="button" data-no>Rifiuta</button></div>`;
  el.querySelector('[data-ok]').onclick = () => agente.approva(ev.id, true);
  el.querySelector('[data-no]').onclick = () => agente.approva(ev.id, false);
  return el;
}

const agente = collegaAgente({
  avvio: () => {
    feed.innerHTML = ''; righe.clear(); tabella(); vista('passivo'); attivo = null;
    document.querySelector('#viste [data-vista="riepilogo"]').disabled = true;
    $('ddt').tBodies[0].innerHTML = ''; $('tot-a').textContent = '';
    $('detail-a').innerHTML = '<div class="placeholder">Le fatture ai clienti e la riconciliazione degli incassi compariranno qui.</div>';
    $('detail').innerHTML = `<div class="placeholder">Il controllo a tre vie di ogni fattura comparirà qui: ordine, merce consegnata e fattura a confronto.</div>`;
    $('run').disabled = true; $('run').textContent = 'Quadra al lavoro…';
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
    if (v?.tipo === 'arrivo') vista('passivo');
    if (v?.tipo === 'attivo') { attivo = v; tabellaDdt(); vista('attivo'); }
    if (v?.tipo === 'bozza') { statoDdt(v.ddt, v.esito, v.numero, v.totale); bozza(v); }
    if (v?.tipo === 'emesse') v.numeri.forEach((n) => { const d = attivo.ddt.find((x) => document.querySelector(`#ddt tr[data-ddt="${x.numero}"] .badge`)?.textContent.endsWith(n.split('/')[1])); if (d) statoDdt(d.numero, 'inviata', n); });
    if (v?.tipo === 'incassi') incassi(v);
    if (v?.tipo === 'sollecitate') v.numeri.forEach((n) => { const p = document.querySelector(`tr[data-fv="${n}"] .pill`); if (p) p.textContent += ' · sollecitata'; });
    if (v?.tipo === 'verifica') { stato(v.id, v.esito); controllo(v); }
    if (v?.tipo === 'stato') stato(v.id, v.stato);
    if (v?.tipo === 'stati') v.ids.forEach((id) => stato(id, v.stato));
    giu();
  },
  approvazione: (ev) => { feed.append(carta(ev)); gruppo = null; giu(); },
  approvato: ({ id }) => { const c = $('ap-' + id); c.classList.add('fatto'); c.querySelector('header').textContent = 'Approvata da te · eseguita'; },
  rifiutato: ({ id }) => { const c = $('ap-' + id); c.classList.add('no'); c.querySelector('header').textContent = 'Rifiutata · non eseguita'; },
  output: (ev) => { if (ev.tipo === 'riepilogo') { riepilogo(ev.contenuto); vista('riepilogo'); } },
  fine: (ev) => {
    feed.insertAdjacentHTML('beforeend', `<span class="riepilogo">${ev.strumenti} strumenti · ${ev.approvazioni} azioni approvate · ${ev.secondi} s</span>`);
    $('run').disabled = false; $('run').textContent = 'Avvia di nuovo'; giu();
  },
  errore: (ev) => { feed.insertAdjacentHTML('beforeend', `<p class="say">Errore: ${esc(ev.messaggio)}</p>`); $('run').disabled = false; },
});

const info = await agente.info();
$('azienda').textContent = info.azienda;
$('mode').hidden = info.modalita !== 'demo';
fatture = await agente.fonte('fatture');
tabella();
$('run').onclick = () => agente.avvia();
