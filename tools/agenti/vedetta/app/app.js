import { collegaAgente, esc } from '/core/agente-client.js';

const $ = (id) => document.getElementById(id);
const feed = $('feed');
const breve = (s) => new Date(s + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const ICONE = { leggi_email: 'email', cerca_ticket: 'ticket', leggi_note_riunioni: 'riunioni', leggi_piano: 'piano', calcola_impatto: 'calc', scrivi_report: 'report' };

let t0 = 0, voce = null, testo = null, gruppo = null, piano = null;
const righe = new Map();

const orologio = () => {
  const s = Math.max(0, Math.round((Date.now() - t0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const giu = () => { feed.scrollTop = feed.scrollHeight; };

function nuovaVoce() {
  $('empty')?.remove();
  voce = document.createElement('div');
  voce.className = 'entry';
  voce.innerHTML = `<time>${orologio()}</time><div class="body"></div>`;
  feed.append(voce);
  testo = null; gruppo = null;
  return voce.querySelector('.body');
}
const corpoVoce = () => (voce ? voce.querySelector('.body') : nuovaVoce());

/* ---------- Piano nella colonna sinistra ---------- */
function disegnaPiano(stime) {
  const per = Object.fromEntries((stime || []).map((m) => [m.id, m]));
  $('plan').innerHTML = piano.milestone.map((m) => {
    const s = per[m.id];
    const sposta = s && s.data_stimata !== m.data;
    const cls = [m.stato === 'Completata' ? 'done' : '', sposta ? (s.blocco ? 'slitta blocco' : 'slitta') : ''].join(' ');
    return `<li class="${cls}"><span>${esc(m.nome)}</span><time>${sposta ? `<s>${breve(m.data)}</s><b>${breve(s.data_stimata)}</b>` : breve(m.data)}</time></li>`;
  }).join('');
}

/* ---------- Cascata: milestone che scivolano sulla linea del tempo ---------- */
function cascata(v) {
  const da = Date.parse('2026-10-28'), a = Date.parse('2027-01-12');
  const x = (d) => `${((Date.parse(d) - da) / (a - da)) * 100}%`;
  const ms = v.milestone.filter((m) => m.id >= 'M3');
  const ok = !v.go_live.nel_blocco_rilasci;
  const el = document.createElement('div');
  el.className = 'cascade';
  const verdetto = ok
    ? `Go-live il ${breve(v.go_live.data_stimata)}, prima del blocco`
    : `Go-live nel blocco rilasci: slitta al ${breve(v.go_live.prima_data_utile)}`;
  el.innerHTML = `
    <header><b>${esc(v.scenario || 'Impatto')}</b><span>ritardo ${v.ritardo_giorni} gg${v.recupero_giorni ? ` · recuperati ${v.recupero_giorni}` : ''}</span>
      <em class="verdict ${ok ? 'si' : 'no'}">${verdetto}</em></header>
    <div class="track">
      <div class="freeze" style="left:${x(v.vincolo.dal)};right:${100 - parseFloat(x(v.vincolo.al))}%"><small>Blocco rilasci</small></div>
      <div class="axis"></div>
      ${['2026-11-01', '2026-11-15', '2026-12-01', '2026-12-15', '2027-01-01'].map((d) => `<span class="tick" style="left:${x(d)}">${breve(d)}</span>`).join('')}
      ${ms.map((m) => `<div class="ms ghost" style="left:${x(m.data_originale)};top:30px"><i></i></div>`).join('')}
      ${ms.map((m, i) => `<div class="ms${i % 2 ? ' up' : ''}" data-to="${x(m.data_stimata)}" data-late="${m.slittamento_giorni > 0}" style="left:${x(m.data_originale)};top:30px"><i></i><small>${m.id} · ${breve(m.data_stimata)}</small></div>`).join('')}
    </div>`;
  // Le milestone partono dalla data di piano e scivolano verso la nuova data
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.querySelectorAll('.ms[data-to]').forEach((m, i) => {
      setTimeout(() => {
        m.style.left = m.dataset.to;
        if (m.dataset.late === 'true') m.classList.add(i === ms.length - 1 && !ok ? 'blocked' : 'late');
      }, 250 + i * 180);
    });
  }));
  return el;
}

/* ---------- Approvazione ---------- */
function cartaApprovazione(ev) {
  const p = ev.anteprima || {};
  const el = document.createElement('div');
  el.className = 'approve';
  el.id = 'ap-' + ev.id;
  const corpo = p.tipo === 'email'
    ? `<div class="meta">A: <b>${esc(p.a)}</b></div><div class="subj">${esc(p.oggetto)}</div><pre>${esc(p.testo)}</pre>`
    : `<div class="subj">${esc(p.id)} · ${esc(p.titolo || '')}</div><dl>
        ${p.assegnatario ? `<dt>Assegnatario</dt><dd>${esc(p.assegnatario)}</dd>` : ''}
        ${p.priorita ? `<dt>Priorità</dt><dd>${esc(p.priorita)}</dd>` : ''}
        ${p.scadenza ? `<dt>Scadenza</dt><dd>${breve(p.scadenza)}</dd>` : ''}
        ${p.nota ? `<dt>Nota</dt><dd>${esc(p.nota)}</dd>` : ''}</dl>`;
  el.innerHTML = `<header><span>${p.tipo === 'email' ? 'Email da inviare' : 'Modifica al ticket'} · in attesa della tua approvazione</span></header>
    <div class="body">${corpo}</div>
    <div class="actions"><button class="btn yes" type="button" data-ok>Approva</button><button class="btn" type="button" data-no>Rifiuta</button></div>`;
  el.querySelector('[data-ok]').onclick = () => agente.approva(ev.id, true);
  el.querySelector('[data-no]').onclick = () => agente.approva(ev.id, false);
  return el;
}

/* ---------- Report ---------- */
function disegnaReport(r) {
  $('report-empty').hidden = true;
  const etichetta = { verde: 'In linea', giallo: 'Attenzione', rosso: 'Critico' }[r.stato];
  $('rep').hidden = false;
  $('rep').innerHTML = `
    <h3>${esc(r.titolo)}</h3><p class="period">${esc(r.periodo)}</p>
    <span class="status ${r.stato}"><i></i>${etichetta}</span>
    <p class="sum">${esc(r.sintesi)}</p>
    <h4>Milestone · piano e stima</h4>
    <table class="mtab">${r.milestone.map((m) => `<tr><td>${esc(m.nome)}</td><td>${breve(m.data_piano)}</td>
      <td class="${m.data_stimata !== m.data_piano ? 'late' : ''}">${breve(m.data_stimata)}</td></tr>`).join('')}</table>
    <h4>Rischi</h4>
    ${r.rischi.map((k) => `<div class="risk ${k.livello}"><i></i><div><b>${esc(k.titolo)}</b><p>${esc(k.descrizione)}</p><p class="act">${esc(k.azione)}</p></div></div>`).join('')}
    ${r.decisioni_richieste?.length ? `<h4>Decisioni richieste al cliente</h4><ul>${r.decisioni_richieste.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    ${r.fatti_della_settimana?.length ? `<h4>Fatti della settimana</h4><ul>${r.fatti_della_settimana.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}`;
}

/* ---------- Eventi dell'agente ---------- */
const agente = collegaAgente({
  avvio: () => {
    t0 = Date.now(); feed.innerHTML = ''; voce = null; righe.clear();
    document.querySelectorAll('#fonti li').forEach((li) => { li.className = ''; li.querySelector('[data-n]').textContent = ''; });
    $('rep').hidden = true; $('report-empty').hidden = false;
    disegnaPiano();
    $('run').disabled = true; $('run').textContent = 'Vedetta è al lavoro…';
  },
  testo: ({ delta }) => {
    if (!testo) { const b = nuovaVoce(); testo = document.createElement('p'); testo.className = 'say scrive'; b.append(testo); }
    testo.textContent += delta; giu();
  },
  testo_fine: () => { testo?.classList.remove('scrive'); testo = null; },
  strumento: (ev) => {
    if (ev.approvazione) return;
    const b = corpoVoce();
    if (!gruppo) { gruppo = document.createElement('div'); gruppo.className = 'tools'; b.append(gruppo); }
    const r = document.createElement('div');
    r.className = 'tool';
    r.innerHTML = `<i class="ic ic-${ICONE[ev.nome] || 'calc'}"></i><span class="lbl">${esc(ev.etichetta)}</span><span class="spin"></span>`;
    gruppo.append(r); righe.set(ev.id, r);
    const f = { leggi_email: 'email', cerca_ticket: 'ticket', leggi_note_riunioni: 'riunioni', leggi_piano: 'piano' }[ev.nome];
    if (f) document.querySelector(`#fonti li[data-fonte="${f}"]`).classList.add('leggendo');
    giu();
  },
  risultato: (ev) => {
    const r = righe.get(ev.id);
    if (r) { r.classList.add('ok'); r.querySelector('.spin').outerHTML = `<span class="res">${esc(ev.sintesi)}</span>`; }
    const v = ev.vista;
    if (v?.fonte) {
      const li = document.querySelector(`#fonti li[data-fonte="${v.fonte}"]`);
      li.classList.remove('leggendo'); li.classList.add('letta'); li.querySelector('[data-n]').textContent = v.n;
    }
    if (v?.tipo === 'cascata') {
      corpoVoce().append(cascata(v));
      disegnaPiano(v.milestone.map((m) => ({ ...m, blocco: m.id === 'M5' && v.go_live.nel_blocco_rilasci })));
    }
    giu();
  },
  approvazione: (ev) => { corpoVoce().append(cartaApprovazione(ev)); giu(); },
  approvato: ({ id }) => { const c = $('ap-' + id); c.classList.add('fatto'); c.querySelector('header span').textContent = 'Approvata da te · eseguita'; },
  rifiutato: ({ id }) => { const c = $('ap-' + id); c.classList.add('no'); c.querySelector('header span').textContent = 'Rifiutata · non eseguita'; },
  output: (ev) => { if (ev.tipo === 'report') disegnaReport(ev.contenuto); },
  fine: (ev) => {
    const b = nuovaVoce();
    b.innerHTML = `<span class="riepilogo">${ev.strumenti} strumenti · ${ev.approvazioni} azioni approvate · ${ev.secondi} s</span>`;
    $('run').disabled = false; $('run').textContent = 'Prepara di nuovo';
    giu();
  },
  errore: (ev) => { corpoVoce().insertAdjacentHTML('beforeend', `<p class="say">Errore: ${esc(ev.messaggio)}</p>`); $('run').disabled = false; },
});

const info = await agente.info();
$('progetto').textContent = info.progetto; $('cliente').textContent = info.cliente;
$('mode').hidden = info.modalita !== 'demo';
piano = await agente.fonte('piano');
disegnaPiano();
const v = piano.vincoli[0];
$('vincolo').innerHTML = `<b>Blocco rilasci</b> dal ${breve(v.dal)} al ${breve(v.al)}: nessun go-live in quel periodo.`;
$('run').onclick = () => agente.avvia();
