/* ---------- Controllo a tre vie dimostrativo ----------
   Quattro fatture della demo con il loro ordine e la merce consegnata. Il confronto è calcolato qui,
   con le stesse regole dello strumento verifica_fattura dell'agente. */
const FATTURE = [
  { id: 'MN-2318', etichetta: 'Metalnova 2318', fornitore: 'Metalnova S.p.A.', numero: '2318', ordine: 'OA-1107',
    righe: [
      { art: 'Staffa in acciaio zincato 40 mm', cod: 'ST-40', ord: [500, 3.80], cons: 500, fatt: [500, 3.80] },
      { art: 'Bullone M8x30 classe 8.8', cod: 'BU-M8', ord: [200, 0.42], cons: 200, fatt: [200, 0.42] } ] },
  { id: 'PF-7731', etichetta: 'Plastiform 7731', fornitore: 'Plastiform S.r.l.', numero: '7731', ordine: 'OA-1109',
    righe: [ { art: 'Tappo in polipropilene 32 mm', cod: 'TP-32', ord: [4000, 2.30], cons: 4000, fatt: [4000, 2.45] } ] },
  { id: 'EB-5520', etichetta: 'Elettrica Brianza 5520', fornitore: 'Elettrica Brianza S.n.c.', numero: '5520', ordine: 'OA-1110',
    righe: [ { art: 'Sensore di prossimità induttivo M12', cod: 'SN-IR', ord: [120, 14.50], cons: 100, fatt: [120, 14.50] } ] },
  { id: 'IS-0412', etichetta: 'Imballaggi Seveso 0412', fornitore: 'Imballaggi Seveso S.r.l.', numero: '0412', ordine: 'OA-1111', ibanDiverso: true, totale: 1573.80,
    righe: [ { art: 'Scatola in cartone doppia onda', cod: 'SC-40', ord: [1500, 0.86], cons: 1500, fatt: [1500, 0.86] } ] },
];
const euro = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
const p2 = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $ = (id) => document.getElementById(id);

function verifica(f) {
  let prezzo = 0, quantita = 0;
  f.righe.forEach((r) => {
    if (r.fatt[1] !== r.ord[1]) prezzo += (r.fatt[1] - r.ord[1]) * r.fatt[0];
    if (r.fatt[0] > r.cons) quantita += (r.fatt[0] - r.cons) * r.fatt[1];
  });
  const esito = f.ibanDiverso ? 'bloccare' : prezzo || quantita ? 'contestare' : 'conforme';
  let azione;
  if (f.ibanDiverso) azione = ['IBAN diverso dall’anagrafica: pagamento da bloccare e verifica telefonica al numero già noto.', euro(f.totale)];
  else if (prezzo) azione = ['Prezzo sopra l’ordine: email al fornitore per una nota di credito, IVA compresa.', euro(prezzo * 1.22)];
  else if (quantita) azione = ['Merce non ancora consegnata: email per la consegna mancante o una nota di credito, IVA compresa.', euro(quantita * 1.22)];
  else azione = ['Tutto torna: Quadra la registra da sola in contabilità e nello scadenzario.', ''];
  return { esito, prezzo, quantita, azione };
}

function mostra(id) {
  const f = FATTURE.find((x) => x.id === id);
  const v = verifica(f);
  document.querySelectorAll('#picker button').forEach((b) => b.setAttribute('aria-selected', b.dataset.id === id));
  const segna = (c, t) => (c ? `<mark>${t}</mark>` : t);
  $('sheet').innerHTML = `
    <header><b>${f.fornitore}</b><span>fattura ${f.numero} · ordine ${f.ordine}</span>
      <span class="esito ${v.esito}">${{ conforme: 'Conforme', contestare: 'Da contestare', bloccare: 'Da bloccare' }[v.esito]}</span></header>
    <table class="three"><thead><tr><th>Articolo</th><th>Ordine</th><th>Consegnato</th><th>Fattura</th></tr></thead><tbody>
      ${f.righe.map((r) => {
        const pd = r.fatt[1] !== r.ord[1], qd = r.fatt[0] > r.cons;
        return `<tr><td>${r.art}<small>${r.cod}</small></td><td>${r.ord[0]} × ${p2(r.ord[1])}</td><td>${segna(qd, r.cons)}</td><td>${segna(qd, r.fatt[0])} × ${segna(pd, p2(r.fatt[1]))}</td></tr>`;
      }).join('')}
    </tbody></table>
    <div class="checks">
      <span>Ordine</span><span class="${v.prezzo ? 'ko' : ''}">Prezzi</span><span class="${v.quantita ? 'ko' : ''}">Quantità</span>
      <span>Non duplicata</span><span class="${f.ibanDiverso ? 'ko' : ''}">IBAN in anagrafica</span><span>IVA e totale</span>
    </div>
    <p class="azione"><span>${v.azione[0]}</span>${v.azione[1] ? `<em>${v.azione[1]}</em>` : ''}</p>`;
}

$('picker').innerHTML = FATTURE.map((f) => {
  const e = verifica(f).esito;
  const col = { conforme: 'var(--conforme)', contestare: 'var(--ambra)', bloccare: 'var(--anomalia)' }[e];
  return `<button type="button" role="tab" data-id="${f.id}"><i style="background:${col}"></i>${f.etichetta}</button>`;
}).join('');
$('picker').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) mostra(b.dataset.id); });
mostra('PF-7731');

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
