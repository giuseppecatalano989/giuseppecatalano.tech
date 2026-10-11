// Istanza dimostrativa locale di Family Hub per il video: stessa app, con un
// fornitore bancario e un consulente simulati che restituiscono dati inventati.
import path from 'node:path';
import http from 'node:http';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPO = 'C:/Users/giuse/Documents/repos-source/family-hub';
const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const DATA = process.env.DATA_DIR || path.join(HERE, '..', 'fh-data');
const imp = p => import(pathToFileURL(path.join(REPO, p)).href);
const { createApp } = await imp('server/app.mjs');
const { createServer } = await imp('node_modules/vite/dist/node/index.js');

const IBAN = { giulia: 'IT40S0542811101000000654321', marco: 'IT72K0306909606100000012345' };
const d = n => { const x = new Date(); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
let seq = 0;
const tx = (amount, daysAgo, name, credit = false) => ({ entry_reference: `demo-${++seq}`, transaction_amount: { amount: amount.toFixed(2), currency: 'EUR' }, credit_debit_indicator: credit ? 'CRDT' : 'DBIT', status: 'BOOK', booking_date: d(daysAgo), [credit ? 'debtor' : 'creditor']: { name } });

// Spese con carta degli ultimi tre mesi, ripetute con piccole variazioni
const family = [];
for (let w = 0; w < 13; w++) {
  const o = w * 7;
  family.push(tx([86.4, 92.15, 78.9, 104.3][w % 4], o + 2, 'Supermercato Il Borgo'));
  family.push(tx([24.6, 31.2, 18.75][w % 3], o + 5, 'Panificio Santa Lucia'));
  if (w % 2 === 0) family.push(tx([62, 58.5, 65][w % 3], o + 3, 'Distributore carburante'));
  if (w % 3 === 1) family.push(tx([38, 46.5][w % 2], o + 6, 'Pizzeria Da Mario'));
  if (w % 4 === 2) family.push(tx([14.9, 22.4][w % 2], o + 4, 'Farmacia Centrale'));
  if (w % 5 === 3) family.push(tx(19.9, o + 1, 'Cinema Odeon'));
}
family.push(tx(12.99, 9, 'Abbonamento musica'), tx(12.99, 39, 'Abbonamento musica'), tx(12.99, 70, 'Abbonamento musica'));
family.push(tx(48.6, 1, 'Ferramenta Rossi'), tx(36.9, 3, 'Libreria Mondo Carta'), tx(27.5, 4, 'Negozio Sport Piu'));
const marco = [];
for (let w = 0; w < 13; w++) {
  marco.push(tx([4.8, 6.2, 3.5][w % 3], w * 7 + 1, 'Bar Centrale'));
  if (w % 2 === 1) marco.push(tx(45, w * 7 + 2, 'Palestra Fit Point'));
}

const bankProvider = {
  secret: Buffer.alloc(32, 9),
  async banks() { return [{ name: 'Banca Aurora', country: 'IT', maxConsentSeconds: 15552000 }, { name: 'Cassa Rurale del Lago', country: 'IT', maxConsentSeconds: 15552000 }, { name: 'Banca Popolare del Golfo', country: 'IT', maxConsentSeconds: 15552000 }]; },
  async startAuthorization(o) { return `${o.redirectUrl}?code=${o.psuType === 'business' ? 'x' : 'auth'}&state=${o.state}`; },
  async createSession() {
    const who = bankProvider.next || 'giulia';
    return { sessionId: `sess-${who}`, validUntil: new Date(Date.now() + 170 * 86400000).toISOString(),
      accounts: [{ uid: `uid-${who}`, iban: IBAN[who], name: who === 'giulia' ? 'Conto famiglia' : 'Conto personale', currency: 'EUR' }] };
  },
  async balances(uid) { const v = uid === 'uid-giulia' ? '4218.40' : '1326.75'; return [{ balance_type: 'CLBD', balance_amount: { amount: v, currency: 'EUR' } }]; },
  async transactions(uid, from, psu, status) { if (status) return []; return (uid === 'uid-giulia' ? family : marco).filter(t => t.booking_date >= from); },
  async endSession() {},
};

// Consulente simulato: legge gli stessi numeri che il server manda a Claude e
// compone un report con quei valori, senza inventare cifre.
const advisorModel = {
  model: 'demo',
  async advise({ input }) {
    const f = JSON.parse(input);
    appendFileSync(path.join(HERE, 'advisor-input.log'), input + '\n');
    const cats = f.categorie;
    const variable = cats.filter(c => !c.risparmio && /alimentari|trasporti|tempo/i.test(c.nome));
    const top = [...variable].sort((a, b) => (b.speso / (b.massimale || 1)) - (a.speso / (a.massimale || 1)))[0];
    const eur = v => { const [i, dec] = Number(v).toFixed(2).split('.'); return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`; };
    const day = s => s.split('-').reverse().slice(0, 2).join('/');
    const weekly = f.tipo_report === 'settimanale';
    const tips = [];
    const sub = f.abbonamenti_e_pagamenti_ripetuti?.find(s => /abbonamento musica/i.test(s.descrizione));
    if (sub) tips.push({ kind: 'avoid', title: `${sub.descrizione}: ${eur(sub.all_anno)} all'anno`, detail: `Sono ${eur(sub.al_mese)} al mese. Se lo ascoltate in pochi, il piano famiglia costa meno di due abbonamenti separati.` });
    const out = f.abbonamenti_e_pagamenti_ripetuti?.find(s => /cena fuori/i.test(s.descrizione));
    if (out) tips.push({ kind: 'avoid', title: `Cene fuori in aumento`, detail: `In media ${eur(out.al_mese)} al mese, l'ultima ${eur(out.ultimo)}. Una pizza in casa ogni tanto rimette in pari il Tempo libero.` });
    if (top) tips.push({ kind: 'adjust', title: `${top.nome}: ${eur(top.speso)} su ${eur(top.massimale)}`, detail: weekly ? `Siete in linea: restano ${eur(top.massimale - top.speso)} fino a fine mese.` : `È la voce variabile più vicina al limite: partite con una lista e un tetto chiaro.` });
    const g = f.obiettivi?.find(o => o.necessario_al_mese && o.necessario_al_mese > o.quota_mensile) || f.obiettivi?.find(o => o.necessario_al_mese);
    if (g) tips.push({ kind: 'goal', title: `${g.nome}: servono ${eur(g.necessario_al_mese)} al mese`, detail: g.necessario_al_mese > g.quota_mensile ? `Oggi accantonate ${eur(g.quota_mensile)}: alzate la quota per arrivarci entro la data prevista.` : `Avete messo da parte ${eur(g.risparmiato)} su ${eur(g.obiettivo)}: con la quota attuale ci arrivate in tempo.` });
    const next = f.scadenze_in_arrivo?.[0];
    if (next) tips.push({ kind: 'info', title: `In arrivo il ${day(next.data)}: ${next.nome}`, detail: `${eur(next.importo)}, già considerati nel budget di ${next.categoria || 'questo mese'}.` });
    const hints = [];
    const byName = n => cats.find(c => c.nome.toLowerCase().startsWith(n))?.id;
    for (const u of f.uscite_da_classificare || []) {
      const id = /ferramenta/i.test(u.descrizione) ? byName('casa') : /libreria|sport|musica/i.test(u.descrizione) ? byName('tempo') : null;
      if (id) hints.push({ transaction_id: u.id, category_id: id });
    }
    return {
      headline: weekly ? 'Una settimana nel budget, con qualche spesa da classificare' : 'Un mese in equilibrio, con margine per i vostri obiettivi',
      summary: weekly
        ? `Le uscite del mese sono a ${eur(f.uscite_del_mese)} su ${eur(f.entrate_del_mese)} di entrate e tutte le categorie restano nel massimale. Ho proposto la categoria per le spese nuove arrivate dalla banca.`
        : `Entrate per ${eur(f.entrate_del_mese)} e uscite per ${eur(f.uscite_del_mese)}: tutte le categorie sono rimaste nel massimale e il risparmio procede come previsto.`,
      tips: tips.slice(0, 4),
      adjustment: { propose: false, month: f.mese_corrente, reason: '', percentages: [] },
      categories: hints,
    };
  },
};

const instance = createApp({ dataDir: DATA, distDir: path.join(REPO, 'dist'), automaticBackups: false, bankProvider, bankRedirectUrl: 'http://localhost:5173/api/bank/callback', appUrl: 'http://localhost:5173', advisorModel });
globalThis.demoBank = bankProvider;
instance.app.post('/demo/next-bank/:who', (req, res) => { bankProvider.next = req.params.who; res.json({ ok: true }); });
// Il proxy di Vite riscrive l'host: lo riallineo all'origine del browser locale
http.createServer((req, res) => { if (req.headers.origin) req.headers.host = new URL(req.headers.origin).host; instance.app(req, res); })
  .listen(3000, '127.0.0.1', () => console.log('API demo su 3000'));

process.env.PORT = '3000'; // il proxy di Vite punta all'API
process.chdir(REPO);
const vite = await createServer({ root: REPO, configFile: path.join(REPO, 'vite.config.ts'), server: { port: 5173, strictPort: true } });
await vite.listen();
vite.printUrls();
