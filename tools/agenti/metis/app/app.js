import { collegaAgente, esc } from '/core/agente-client.js';

const $ = (id) => document.getElementById(id);
const feed = $('feed');
const breve = (s) => new Date(s + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const euro = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' }) + ' €';
const COLORI = { proprietario: '#0F2E33', edil: '#B5651D', cablanet: '#2E6FD8', fibrauno: '#7B4B94', arredi: '#8A9A3B', vigilanza: '#5B7076', traslochi: '#C2432C', team: '#1F7F7A', cliente: '#0F2E33' };
const ICONE = { leggi_brief: 'brief', leggi_offerte_fornitori: 'forn', leggi_attivita_team: 'team' };
const FONTI = { leggi_brief: 'brief', leggi_offerte_fornitori: 'fornitori', leggi_attivita_team: 'team' };

let info, testo = null, gruppo = null, parti = [];
const righe = new Map();
const giu = () => { feed.scrollTop = feed.scrollHeight; };

function scheda(tab, nuovo = true) {
  document.querySelectorAll('.tabs button').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', on);
    if (on) { b.disabled = false; b.classList.remove('nuovo'); }
  });
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
  void nuovo;
}
document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) scheda(b.dataset.tab, false); });

/* ---------- Gantt ---------- */
const DA = Date.parse('2026-10-30'), A = Date.parse('2027-01-20');
const x = (s) => ((Date.parse(s) - DA) / (A - DA)) * 100;
const larg = (a, b) => ((Date.parse(b) - Date.parse(a) + 86400000) / (A - DA)) * 100;
const ord = (a, b) => a.id.localeCompare(b.id, 'it', { numeric: true });

function gantt(v) {
  const att = [...v.attivita].sort(ord);
  const prima = v.prima || {};
  const esito = v.in_tempo ? `<span class="esito ok">Apertura ${breve(v.apertura)} · in tempo</span>` : `<span class="esito ko">Apertura ${breve(v.apertura)} · ${v.ritardo_giorni} giorni di ritardo</span>`;
  $('p-piano').innerHTML = `
    <div class="ghead"><b>${esc(v.nome)}</b><span>${att.length} step · percorso critico ${v.critico.length - 1} passaggi</span>${esito}</div>
    <div class="gantt">
      <div class="axis">${['2026-11-02', '2026-11-16', '2026-12-01', '2026-12-14', '2027-01-04', '2027-01-18'].map((d) => `<span style="left:${x(d)}%">${breve(d)}</span>`).join('')}</div>
      <div class="rows" id="rows">${att.map((a) => {
        const p = prima[a.id] || a;
        const nuova = v.prima && !prima[a.id];
        return `<div class="grow${a.critica ? ' crit' : ''}${nuova ? ' nuova' : ''}"><span class="nm">${esc(a.nome)}</span><div class="lane">
          <span class="bar${a.milestone ? ' ms' : ''}${a.critica ? ' crit' : ''}" data-l="${x(a.inizio)}" data-w="${larg(a.inizio, a.fine)}"
            style="left:${x(p.inizio)}%;width:${larg(p.inizio, p.fine)}%;background:${COLORI[a.chi] || '#9AABAE'}" title="${breve(a.inizio)} – ${breve(a.fine)}"></span></div></div>`;
      }).join('')}</div>
      <div class="band chiusura" style="left:calc(220px + (100% - 220px) * ${x(info.chiusura[0]) / 100});width:calc((100% - 220px) * ${larg(info.chiusura[0], info.chiusura[1]) / 100})"><small>Chiusura natalizia</small></div>
      <div class="band scadenza" style="left:calc(220px + (100% - 220px) * ${x(info.apertura) / 100})"><small>Apertura ${breve(info.apertura)}</small></div>
    </div>
    <div class="legend"><span><i></i>Percorso critico: decide la data di apertura</span></div>`;
  // Le barre scivolano dalla posizione precedente a quella nuova
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('#rows .bar').forEach((b) => { b.style.left = b.dataset.l + '%'; if (!b.classList.contains('ms')) b.style.width = b.dataset.w + '%'; });
  }));
  $('target').className = 'target ' + (v.in_tempo ? 'ok' : 'ko');
  $('target').textContent = v.in_tempo ? `Apertura ${breve(v.apertura)} · in tempo` : `Apertura ${breve(v.apertura)} · obiettivo ${breve(info.apertura)}`;
}

/* ---------- Documenti ---------- */
function raci(c) {
  const sig = { Esegue: ['E', 'r-e'], Consultato: ['C', 'r-c'], Informato: ['I', 'r-i'] };
  $('p-raci').innerHTML = `<table class="raci"><thead><tr><th>Attività</th>${c.parti.map((p) => `<th>${esc(p.nome)}</th>`).join('')}<th>Approva</th></tr></thead><tbody>
    ${c.righe.map((r) => `<tr><td>${esc(r.nome)}</td>${c.parti.map((p) => { const s = sig[r.ruoli[p.chi]]; return `<td>${s ? `<span class="${s[1]}">${s[0]}</span>` : ''}</td>`; }).join('')}<td><span class="r-a">PM</span></td></tr>`).join('')}
    </tbody></table><div class="legend" style="gap:14px"><span><b>E</b> esegue</span><span><b>C</b> consultato</span><span><b>I</b> informato</span><span>Approva sempre il PM</span></div>`;
}
function sal(c) {
  const max = Math.max(...Object.values(c.mesi));
  const nomeMese = (k) => new Date(k + '-15T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  $('p-sal').innerHTML = `<div class="salgrid"><table class="sal"><thead><tr><th>Data</th><th>Fornitore</th><th>Tappa</th><th>%</th><th style="text-align:right">Importo</th></tr></thead><tbody>
    ${c.righe.map((r) => `<tr><td>${breve(r.data)}</td><td>${esc(r.fornitore)}</td><td>${esc(r.tappa)}</td><td>${r.percentuale}%</td><td class="n">${euro(r.importo)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="4">Totale contratti</td><td class="n">${euro(c.totale)}</td></tr></tfoot></table>
    <div class="mesi"><h4>Pagamenti previsti per mese</h4>${Object.entries(c.mesi).map(([k, v], i) => `<div class="mese"><span>${nomeMese(k)}<b>${euro(v)}</b></span><div style="width:${(v / max) * 100}%;animation-delay:${i * 120}ms"></div></div>`).join('')}</div></div>`;
}
function report(r) {
  $('p-report').innerHTML = `<article class="rep"><h3>${esc(r.titolo)}</h3>
    <span class="badge ok">Apertura ${breve(r.apertura)} · ${r.in_tempo ? 'in tempo' : 'in ritardo'}${r.in_tempo ? `, margine ${r.margine} gg` : ''}</span>
    <p class="s">${esc(r.sintesi)}</p>
    <h4>Date chiave sul percorso critico</h4><div class="k">${r.date_chiave.map((d) => `<span>${esc(d.nome)} · ${esc(d.chi)}</span><span>${breve(d.inizio)}</span><span>${breve(d.fine)}</span>`).join('')}</div>
    ${r.rischi?.length ? `<h4>Rischi</h4>${r.rischi.map((k) => `<div class="risk ${k.livello}"><i></i><div><b>${esc(k.titolo)}</b><p>${esc(k.azione)}</p></div></div>`).join('')}` : ''}
    ${r.decisioni?.length ? `<h4>Decisioni richieste al cliente</h4><ul>${r.decisioni.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}</article>`;
}

function carta(ev) {
  const p = ev.anteprima || {};
  const el = document.createElement('div');
  el.className = 'approve'; el.id = 'ap-' + ev.id;
  el.innerHTML = `<header>Email da inviare · in attesa della tua approvazione</header>
    <div class="body"><div class="meta">A: <b>${esc(p.a)}</b></div><div class="subj">${esc(p.oggetto)}</div><pre>${esc(p.testo)}</pre></div>
    <div class="actions"><button class="btn yes" type="button" data-ok>Approva</button><button class="btn" type="button" data-no>Rifiuta</button></div>`;
  el.querySelector('[data-ok]').onclick = () => agente.approva(ev.id, true);
  el.querySelector('[data-no]').onclick = () => agente.approva(ev.id, false);
  return el;
}

const agente = collegaAgente({
  avvio: () => {
    feed.innerHTML = ''; righe.clear();
    document.querySelectorAll('#fonti li').forEach((li) => { li.className = ''; li.querySelector('[data-n]').textContent = ''; });
    document.querySelectorAll('.tabs button').forEach((b) => { if (b.dataset.tab !== 'piano') b.disabled = true; });
    scheda('piano');
    $('p-piano').innerHTML = '<div class="empty">Metis costruirà qui il piano a step: fornitori, team, dipendenze e calendario reale.</div>';
    $('run').disabled = true; $('run').textContent = 'Metis sta pianificando…';
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
    if (FONTI[ev.nome]) document.querySelector(`#fonti li[data-fonte="${FONTI[ev.nome]}"]`).classList.add('leggendo');
    giu();
  },
  risultato: (ev) => {
    const r = righe.get(ev.id);
    const v = ev.vista;
    if (r) { r.classList.add(v?.tipo === 'gantt' && !v.in_tempo ? 'ko' : 'ok'); r.querySelector('.spin').outerHTML = `<span class="res">${esc(ev.sintesi)}</span>`; }
    if (v?.fonte) { const li = document.querySelector(`#fonti li[data-fonte="${v.fonte}"]`); li.classList.remove('leggendo'); li.classList.add('letta'); li.querySelector('[data-n]').textContent = '✓'; }
    if (v?.tipo === 'gantt') { scheda('piano'); gantt(v); }
    giu();
  },
  output: (ev) => {
    if (ev.tipo === 'raci') { raci(ev.contenuto); scheda('raci'); }
    if (ev.tipo === 'sal') { sal(ev.contenuto); scheda('sal'); }
    if (ev.tipo === 'report') { report(ev.contenuto); scheda('report'); }
  },
  approvazione: (ev) => { feed.append(carta(ev)); gruppo = null; giu(); },
  approvato: ({ id }) => { const c = $('ap-' + id); c.classList.add('fatto'); c.querySelector('header').textContent = 'Approvata da te · inviata'; },
  rifiutato: ({ id }) => { const c = $('ap-' + id); c.classList.add('no'); c.querySelector('header').textContent = 'Rifiutata · non inviata'; },
  fine: (ev) => {
    feed.insertAdjacentHTML('beforeend', `<span class="riepilogo">${ev.strumenti} strumenti · ${ev.approvazioni} azioni approvate · ${ev.secondi} s</span>`);
    $('run').disabled = false; $('run').textContent = 'Pianifica di nuovo'; giu();
  },
  errore: (ev) => { feed.insertAdjacentHTML('beforeend', `<p class="say">Errore: ${esc(ev.messaggio)}</p>`); $('run').disabled = false; },
});

info = await agente.info();
$('progetto').textContent = info.progetto; $('cliente').textContent = info.cliente;
$('mode').hidden = info.modalita !== 'demo';
$('target').textContent = `Apertura vincolante: ${breve(info.apertura)}`;
const brief = await agente.fonte('brief');
parti = brief.parti.filter((p) => !['proprietario', 'cliente'].includes(p.chi));
$('parti').innerHTML = parti.map((p) => `<li><i style="background:${COLORI[p.chi]}"></i>${esc(p.nome)}</li>`).join('');
$('run').onclick = () => agente.avvia();
