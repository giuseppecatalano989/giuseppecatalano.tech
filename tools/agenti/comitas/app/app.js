import { collegaAgente, esc } from '/core/agente-client.js';

const $ = (id) => document.getElementById(id);
const feed = $('feed');
const COLORI = ['#6A4BE8', '#1E8E5A', '#C2416B', '#A86A10', '#2E6FD8', '#7B4B94', '#5B5560', '#0E8A8A'];
const CANALE = { email: 'Email', chat: 'Chat', instagram: 'Instagram', instagram_dm: 'DM Instagram', facebook: 'Facebook' };
const STATI = { nuovo: 'Nuovo', lavora: 'In lavorazione', risposto: 'Risposto', attesa: 'In attesa della tua approvazione', approvato: 'Approvato', risolto: 'Risolto', operatore: 'Passato a Marta', nascosto: 'Nascosto: spam' };
const euro = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const iniziali = (n) => n.replace('@', '').split(/[ ._]/).filter(Boolean).map((x) => x[0].toUpperCase()).join('').slice(0, 2);

let messaggi = [], attivo = null, testo = null, gruppo = null;
const caso = {};
const righe = new Map();
const giu = () => { feed.scrollTop = feed.scrollHeight; };
const badge = (m) => `<span class="can ${m.canale}${m.pubblico ? ' pub' : ''}">${CANALE[m.canale]}</span>`;

function lista() {
  $('lista').innerHTML = messaggi.map((m, i) => {
    const c = caso[m.id];
    return `<li data-id="${m.id}" class="${attivo === m.id ? 'attivo' : ''} ${c.stato === 'nascosto' ? 'nascosto' : ''}">
      <span class="av" style="background:${COLORI[i % COLORI.length]}">${iniziali(m.cliente)}</span>
      <b>${esc(m.cliente)}</b><time>${m.ora}</time>
      <p>${esc(m.oggetto ? m.oggetto + ' — ' : '')}${esc(m.testo)}</p>
      <span class="meta">${badge(m)}<span class="chip ${c.stato}">${STATI[c.stato].replace(' della tua approvazione', '')}</span></span></li>`;
  }).join('');
  const aperti = messaggi.filter((m) => ['nuovo', 'lavora', 'attesa'].includes(caso[m.id].stato)).length;
  $('aperti').textContent = aperti ? `${aperti} aperti` : 'tutti gestiti';
}

function scheda(voce, d) {
  if (voce === 'ordine') return `<div class="card"><h4>Ordine</h4><b>${esc(d.numero)}</b> · ${esc(d.stato)}<div class="m">${d.articoli.map((a) => esc(a.nome) + ' · ' + euro(a.prezzo)).join('<br>')}</div><div class="m">${esc(d.indirizzo)}</div></div>`;
  if (voce === 'spedizione') return `<div class="card"><h4>Tracciamento · ${esc(d.corriere)}</h4><ol>${d.eventi.map((e) => `<li><span>${e.data.slice(8, 10)}/${e.data.slice(5, 7)} ${e.data.slice(11)}</span><span>${esc(e.luogo)} · ${esc(e.evento)}</span></li>`).join('')}</ol></div>`;
  if (voce === 'conoscenza') return `<div class="card"><h4>Base di conoscenza · ${esc(d.id)}</h4><b>${esc(d.titolo)}</b><div>${esc(d.testo)}</div></div>`;
  if (voce === 'storico') {
    const senza = d.contatti.filter((c) => c.esito === 'nessuna risposta').length;
    return `<div class="card${senza ? ' warn' : ''}"><h4>Storico del cliente</h4><b>${d.ordini_totali} ordini · ${euro(d.spesa_totale)}</b>
      ${d.contatti.length ? `<ol>${d.contatti.map((c) => `<li><span>${c.data.slice(8)}/${c.data.slice(5, 7)}</span><span>${esc(c.canale)} · ${esc(c.esito)}</span></li>`).join('')}</ol>` : '<div class="m">Nessun contatto precedente</div>'}
      ${d.collegati?.length > 1 ? `<div class="collegati">Oggi anche su: ${d.collegati.slice(1).map((x) => `<span class="can">${esc(x.canale)}</span>`).join('')}</div>` : ''}</div>`;
  }
  return '';
}

function mostraCaso(id) {
  attivo = id;
  const m = messaggi.find((x) => x.id === id), i = messaggi.indexOf(m), c = caso[id];
  $('conv').innerHTML = `<div class="caso">
    <header><span class="av" style="background:${COLORI[i % COLORI.length]}">${iniziali(m.cliente)}</span>
      <div><b>${esc(m.cliente)}</b><br><span>${badge(m)} · ${m.ora}${m.oggetto ? ' · ' + esc(m.oggetto) : ''}</span></div>
      <span class="chip ${c.stato}">${STATI[c.stato]}</span></header>
    ${m.post ? `<div class="post"><span class="img"></span><div><small>Post di Casa Ortensia</small><b>${esc(m.post)}</b></div></div>` : ''}
    <div class="bolla cli${c.stato === 'nascosto' ? ' nascosto' : ''}">${m.profilo && m.pubblico ? `<span class="who">${esc(m.profilo)}</span>` : ''}${esc(m.testo)}${m.allegati ? `<br><span class="att">📎 ${esc(m.allegati.join(', '))}</span>` : ''}</div>
    ${c.stato === 'nascosto' ? `<span class="tag-nascosto">Commento nascosto · ${esc(c.motivo || 'spam')}</span>` : ''}
    <div class="ctx">${c.schede.join('')}</div>
    ${c.passaggio ? `<div class="passaggio"><header>Passato a ${esc(c.passaggio.operatore)}${c.passaggio.priorita === 'alta' ? ' · priorità alta' : ''}${c.passaggio.messaggi.length > 1 ? ` · ${c.passaggio.messaggi.length} canali collegati` : ''}</header>
      <div><p><b>Il caso.</b> ${esc(c.passaggio.riepilogo)}</p><p><b>Proposta.</b> ${esc(c.passaggio.proposta)}</p></div></div>` : ''}
    ${c.risposte.map((r) => `<div class="bolla agente${r.pubblica ? ' pub' : ''}"><small>${r.pubblica ? 'Risposta pubblica di Casa Ortensia' : 'Comitas · inviata'}</small>${esc(r.testo)}</div>`).join('')}
  </div>`;
  lista();
}
const aggiorna = (id) => (attivo === id ? mostraCaso(id) : lista());

function cartaApprovazione(ev) {
  const p = ev.anteprima || {};
  const el = document.createElement('div');
  el.className = 'approve'; el.id = 'ap-' + ev.id;
  let titolo, corpo;
  if (p.tipo === 'sostituzione') {
    titolo = 'Sostituzione con ritiro';
    corpo = `<dl><dt>Cliente</dt><dd>${esc(p.cliente)}</dd><dt>Ordine</dt><dd>${esc(p.ordine)}</dd><dt>Articolo</dt><dd>${esc(p.articolo)}</dd><dt>Valore</dt><dd>${euro(p.importo)} · ritiro gratuito</dd></dl>`;
  } else if (p.tipo === 'indirizzo') {
    titolo = 'Modifica dell’ordine';
    corpo = `<dl><dt>Ordine</dt><dd>${esc(p.ordine)} · ${esc(p.stato_ordine)}</dd><dt>Prima</dt><dd><s>${esc(p.prima)}</s></dd><dt>Dopo</dt><dd>${esc(p.indirizzo)}</dd></dl>`;
  } else {
    titolo = `Risposta pubblica su ${p.canale === 'facebook' ? 'Facebook' : 'Instagram'}`;
    corpo = `<div class="com">${esc(p.profilo)}: «${esc(p.commento)}»</div><div>${esc(p.testo)}</div>`;
  }
  el.innerHTML = `<header>${titolo} · serve la tua approvazione</header><div class="body">${corpo}</div>
    <div class="actions"><button class="btn yes" type="button" data-ok>Approva</button><button class="btn" type="button" data-no>Rifiuta</button></div>`;
  el.querySelector('[data-ok]').onclick = () => agente.approva(ev.id, true);
  el.querySelector('[data-no]').onclick = () => agente.approva(ev.id, false);
  return el;
}

function riepilogo(r) {
  attivo = null; lista();
  $('conv').innerHTML = `<div class="sum">
    <h3>Riepilogo del turno · ${esc(r.negozio)}</h3>
    <div class="kpis">
      <div class="kpi a"><b>${r.risposti_in_autonomia}</b><span>risposte in autonomia</span></div>
      <div class="kpi b"><b>${r.con_approvazione}</b><span>azioni approvate da te</span></div>
      <div class="kpi d"><b>${r.nascosti}</b><span>spam nascosto</span></div>
      <div class="kpi c"><b>${r.a_operatore}</b><span>casi passati a una persona</span></div>
    </div>
    <p>${esc(r.sintesi)}</p>
    ${r.operatore.map((o) => `<div class="op"><b>${esc(o.cliente)} → ${esc(o.operatore)}.</b> ${esc(o.proposta)}</div>`).join('')}
  </div>`;
}

const nuovo = () => ({ stato: 'nuovo', schede: [], risposte: [], passaggio: null });
const agente = collegaAgente({
  avvio: () => {
    feed.innerHTML = ''; righe.clear(); attivo = null;
    messaggi.forEach((m) => { caso[m.id] = nuovo(); });
    lista(); $('conv').innerHTML = '';
    $('run').disabled = true; $('run').textContent = 'Comitas al lavoro…';
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
    if (r) { r.classList.add('ok'); r.querySelector('.spin').outerHTML = `<span class="res">${esc(ev.sintesi)}</span>`; }
    const v = ev.vista;
    if (v?.tipo === 'arrivo') lista();
    if (v?.tipo === 'contesto' && v.messaggio) {
      const c = caso[v.messaggio];
      if (c.stato === 'nuovo') c.stato = 'lavora';
      c.schede.push(scheda(v.voce, v.dati));
      mostraCaso(v.messaggio);
    }
    if (v?.tipo === 'operatore') {
      v.messaggi.forEach((id) => { caso[id].stato = 'operatore'; caso[id].passaggio = v; });
      mostraCaso(v.messaggio);
    }
    if (v?.tipo === 'risposta') {
      const c = caso[v.messaggio];
      if (c.stato !== 'operatore') c.stato = v.stato;
      c.risposte.push({ testo: v.testo, pubblica: v.pubblica });
      mostraCaso(v.messaggio);
    }
    if (v?.tipo === 'stato') { caso[v.messaggio].stato = v.stato; caso[v.messaggio].motivo = v.motivo; mostraCaso(v.messaggio); }
    giu();
  },
  approvazione: (ev) => {
    const id = ev.input.messaggio || messaggi.find((x) => ev.input.ordine && x.testo.includes(ev.input.ordine))?.id;
    if (id) { if (caso[id].stato !== 'operatore') caso[id].stato = 'attesa'; mostraCaso(id); }
    feed.append(cartaApprovazione(ev)); gruppo = null; giu();
  },
  approvato: ({ id }) => { const c = $('ap-' + id); c.classList.add('fatto'); c.querySelector('header').textContent = 'Approvata da te · eseguita'; },
  rifiutato: ({ id }) => { const c = $('ap-' + id); c.classList.add('no'); c.querySelector('header').textContent = 'Rifiutata · non eseguita'; },
  output: (ev) => { if (ev.tipo === 'riepilogo') riepilogo(ev.contenuto); },
  fine: (ev) => {
    feed.insertAdjacentHTML('beforeend', `<span class="riepilogo">${ev.strumenti} strumenti · ${ev.approvazioni} azioni approvate · ${ev.secondi} s</span>`);
    $('run').disabled = false; $('run').textContent = 'Gestisci di nuovo'; giu();
  },
  errore: (ev) => { feed.insertAdjacentHTML('beforeend', `<p class="say">Errore: ${esc(ev.messaggio)}</p>`); $('run').disabled = false; },
});

const info = await agente.info();
$('negozio').textContent = `${info.negozio} · Clienti e social`;
$('team').innerHTML = info.operatori.map((o, i) => `<i style="background:${['#C2416B', '#2E6FD8'][i % 2]}" title="${esc(o)}">${iniziali(o)}</i>`).join('');
$('mode').hidden = info.modalita !== 'demo';
messaggi = await agente.fonte('messaggi');
messaggi.forEach((m) => { caso[m.id] = nuovo(); });
lista();
$('run').onclick = () => agente.avvia();
