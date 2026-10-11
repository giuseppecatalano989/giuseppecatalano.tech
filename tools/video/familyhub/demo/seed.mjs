// Popola l'istanza dimostrativa con la famiglia Bianchi (dati inventati).
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'http://127.0.0.1:3000/api';
const credFile = path.join(HERE, 'credenziali.json');
const cred = existsSync(credFile) ? JSON.parse(readFileSync(credFile, 'utf8')) : {
  giulia: { name: 'Giulia', email: 'giulia@famiglia-bianchi.test', password: randomBytes(12).toString('base64url') },
  marco: { name: 'Marco', email: 'marco@famiglia-bianchi.test', password: randomBytes(12).toString('base64url') },
};
writeFileSync(credFile, JSON.stringify(cred, null, 2));

async function call(s, method, route, body) {
  const res = await fetch(API + route, { method, redirect: 'manual', headers: { 'content-type': 'application/json', 'x-requested-with': 'Casa', ...(s ? { cookie: s.cookie, 'x-csrf-token': s.csrf } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (res.status >= 400) throw new Error(`${method} ${route} → ${res.status} ${text}`);
  const cookie = res.headers.get('set-cookie');
  const data = text ? JSON.parse(text) : {};
  return { data, cookie: cookie && cookie.split(';')[0], location: res.headers.get('location') };
}
async function session(who, extra) {
  const u = cred[who];
  let r;
  try { r = await call(null, 'POST', '/auth/login', { email: u.email, password: u.password }); }
  catch { r = await call(null, 'POST', '/auth/register', { name: u.name, email: u.email, password: u.password, ...extra() }); }
  return { cookie: r.cookie, csrf: r.data.csrf };
}

const G = await session('giulia', () => ({ householdName: 'Casa Bianchi' }));
const state = (s, month = '2026-10') => call(s, 'GET', `/state?month=${month}`).then(r => r.data);
let st = await state(G);
if (st.transactions.length || st.goals?.length) { console.log('già popolata'); process.exit(0); }

const inv = await call(G, 'POST', '/invitation');
const M = await session('marco', () => ({ inviteCode: inv.data.code }));

const cat = Object.fromEntries(st.categories.map((c, i) => [['casa', 'alimentari', 'trasporti', 'salute', 'svago', 'risparmio'][i], c.id]));
const eur = v => Math.round(v * 100);

// Entrate e uscite ricorrenti
await call(G, 'POST', '/recurring', { kind: 'income', startMonth: '2026-05', name: 'Stipendio Giulia', amount: eur(2150), day: 27, enabled: true });
await call(M, 'POST', '/recurring', { kind: 'income', startMonth: '2026-05', name: 'Stipendio Marco', amount: eur(1950), day: 10, enabled: true });
await call(G, 'POST', '/recurring', { kind: 'expense', startMonth: '2026-05', name: 'Rata del mutuo', amount: eur(720), categoryId: cat.casa, day: 5, enabled: true });
await call(G, 'POST', '/recurring', { kind: 'expense', startMonth: '2026-05', name: 'Internet fibra', amount: eur(29.9), categoryId: cat.casa, day: 15, enabled: true });
await call(M, 'POST', '/recurring', { kind: 'expense', startMonth: '2026-05', name: 'Accantonamento mensile', amount: eur(350), categoryId: cat.risparmio, day: 28, enabled: true });

// Spese registrate a mano prima del collegamento bancario (maggio-luglio)
const manual = [
  ['alimentari', 'Spesa settimanale', [92.4, 88.1, 101.6, 79.3]], ['alimentari', 'Mercato rionale', [34.5]],
  ['trasporti', 'Carburante', [64, 58.7]], ['salute', 'Farmacia', [21.4]], ['svago', 'Cena fuori', [52]], ['svago', 'Cinema', [19.9]],
];
for (const [m, k] of [['2026-05', 1.04], ['2026-06', 0.97], ['2026-07', 1.12]])
  for (const [c, desc, amounts] of manual)
    for (const [i, a] of amounts.entries())
      await call(i % 2 ? M : G, 'POST', '/transactions', { kind: 'expense', amount: eur(a * k), categoryId: cat[c], description: desc, date: `${m}-${String(3 + i * 7).padStart(2, '0')}` });
await call(G, 'POST', '/transactions', { kind: 'expense', amount: eur(310), categoryId: cat.svago, description: 'Weekend al lago', date: '2026-07-19' });
await call(M, 'POST', '/transactions', { kind: 'income', amount: eur(120), description: 'Vendita bici usata', date: '2026-09-14' });

// Scadenze
const dl = async (s, body) => (await call(s, 'POST', '/deadlines', { reminderDays: 7, ...body })).data.id;
const luce = await dl(G, { name: 'Bolletta luce e gas', startDate: '2026-05-18', dueDay: 18, frequency: 'monthly', requiresPayment: true, amount: eur(112), categoryId: cat.casa });
await dl(G, { name: 'TARI, seconda rata', startDate: '2026-10-16', frequency: 'once', requiresPayment: true, amount: eur(148), categoryId: cat.casa });
await dl(M, { name: 'Bollo auto', startDate: '2026-10-31', frequency: 'yearly', requiresPayment: true, amount: eur(186), categoryId: cat.trasporti });
await dl(G, { name: 'Assicurazione casa', startDate: '2026-11-08', frequency: 'yearly', requiresPayment: true, amount: eur(240), categoryId: cat.casa });
await dl(M, { name: 'Revisione caldaia', startDate: '2026-10-28', frequency: 'yearly', requiresPayment: true, amount: eur(95), categoryId: cat.casa });
await dl(G, { name: 'Colloquio con le maestre', startDate: '2026-10-22', frequency: 'once', requiresPayment: false, reminderDays: 2 });
for (const m of ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
  await call(G, 'POST', `/deadlines/${luce}/manage`, { month: m, handledDate: `${m}-17` });

// Obiettivi
const goal = async (body) => (await call(G, 'POST', '/goals', body)).data.id;
const vac = await goal({ title: 'Vacanze in Puglia', horizon: 'short', target: eur(2500), saved: eur(900), dueDate: '2027-07-10', monthly: eur(150), primary: true });
const auto = await goal({ title: 'Auto nuova', horizon: 'medium', target: eur(12000), saved: eur(3800), dueDate: '2029-03-31', monthly: eur(150) });
const fondo = await goal({ title: 'Fondo emergenze', horizon: 'long', target: eur(10000), saved: eur(6100), monthly: eur(50) });
for (const [id, amounts] of [[vac, [150, 150, 150]], [auto, [150, 150, 200]], [fondo, [100, 50]]])
  for (const [i, a] of amounts.entries()) await call(G, 'POST', `/goals/${id}/contributions`, { amount: eur(a), date: `2026-0${7 + i}-28` });

// Lista della spesa
const shop = [['Latte parzialmente scremato', '2 l', 'Frigo e freschi'], ['Yogurt bianco', '4', 'Frigo e freschi'], ['Mozzarella', '2', 'Frigo e freschi'],
  ['Mele', '1 kg', 'Frutta e verdura'], ['Zucchine', '500 g', 'Frutta e verdura'], ['Insalata', '1 cespo', 'Frutta e verdura'], ['Banane', '6', 'Frutta e verdura'],
  ['Pasta integrale', '2 pacchi', 'Dispensa'], ['Passata di pomodoro', '3', 'Dispensa'], ['Caffè', '1', 'Dispensa'], ['Biscotti per la colazione', '1', 'Dispensa'],
  ['Detersivo lavatrice', '1', 'Casa e igiene'], ['Carta da cucina', '4 rotoli', 'Casa e igiene'], ['Candeline per la torta', '', 'Altro']];
for (const [i, [name, quantity, section]] of shop.entries()) await call(i % 3 ? G : M, 'POST', '/shopping', { name, quantity, section });
st = await state(G);
for (const s of st.shopping.filter(s => ['Caffè', 'Mele', 'Yogurt bianco'].includes(s.name))) await call(G, 'PATCH', `/shopping/${s.id}`, { checked: true });

// Menu: settimana in corso e successiva
const ing = (name, quantity, section) => ({ name, quantity, section });
const plan = {
  0: [['Pasta al pomodoro e basilico', [ing('Pasta', '320 g', 'Dispensa'), ing('Passata di pomodoro', '1', 'Dispensa')]], ['Frittata di zucchine', [ing('Uova', '6', 'Frigo e freschi'), ing('Zucchine', '3', 'Frutta e verdura')]]],
  1: [['Riso con piselli', [ing('Riso', '300 g', 'Dispensa'), ing('Piselli', '1 confezione', 'Dispensa')]], ['Petto di pollo e insalata', [ing('Petto di pollo', '600 g', 'Frigo e freschi')]]],
  2: [['Insalata di farro', [ing('Farro', '300 g', 'Dispensa'), ing('Pomodorini', '250 g', 'Frutta e verdura')]], ['Minestrone di verdure', [ing('Verdure per minestrone', '1 kg', 'Frutta e verdura')]]],
  3: [['Pasta e ceci', [ing('Ceci', '2 barattoli', 'Dispensa')]], ['Pesce al forno con patate', [ing('Filetti di merluzzo', '4', 'Frigo e freschi'), ing('Patate', '1 kg', 'Frutta e verdura')]]],
  4: [['Gnocchi al pomodoro', [ing('Gnocchi', '1 kg', 'Frigo e freschi')]], ['Pizza fatta in casa', [ing('Farina', '1 kg', 'Dispensa'), ing('Mozzarella', '2', 'Frigo e freschi')]]],
  5: [['Lasagne', [ing('Sfoglia per lasagne', '1', 'Frigo e freschi'), ing('Ragù', '1 barattolo', 'Dispensa')]], ['Torta salata e verdure', [ing('Pasta sfoglia', '1', 'Frigo e freschi')]]],
  6: [['Arrosto con patate', [ing('Arrosto di vitello', '1 kg', 'Frigo e freschi')]], ['Vellutata di zucca', [ing('Zucca', '1', 'Frutta e verdura')]]],
};
for (const monday of ['2026-10-05', '2026-10-12'])
  for (const [i, [lunch, dinner]] of Object.entries(plan)) {
    const day = new Date(`${monday}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + Number(i));
    const date = day.toISOString().slice(0, 10);
    const shift = monday === '2026-10-12' ? 3 : 0;
    const [l, dn] = [plan[(Number(i) + shift) % 7][0], plan[(Number(i) + shift + 1) % 7][1]];
    await call(G, 'POST', '/meals', { date, slot: 'lunch', title: l[0], servings: 4, ingredients: l[1], notes: '' });
    await call(M, 'POST', '/meals', { date, slot: 'dinner', title: dn[0], servings: 4, ingredients: dn[1], notes: '' });
  }

// Conferimento rifiuti (0 = lunedì)
const waste = [['Organico', [0, 2, 4], '#74816b', 'Sacchetto compostabile nel bidone marrone.'], ['Carta e cartone', [1], '#8099b0', 'Scatole piegate, senza nastro adesivo.'],
  ['Plastica e metalli', [3], '#e3a95c', 'Bottiglie schiacciate e lattine sciacquate.'], ['Vetro', [5], '#176854', 'Senza tappi, nel contenitore verde.'], ['Indifferenziato', [6], '#be879b', 'Solo ciò che non si ricicla.']];
for (const [name, days, color, notes] of waste) await call(G, 'POST', '/waste', { name, days, color, timeWindow: 'Dalle 20:00 alle 24:00', notes });

// Lavagna
const notes = [
  ['Colloquio con le maestre', 'Giovedì 22 alle 17:30. Portare il quaderno di matematica di Sofia.', 'amber', true],
  ['Compleanno di nonna Anna', 'Sabato 24. Idee regalo: sciarpa di lana, cornice con le foto dell\'estate.', 'rose', true],
  ['Wi-Fi per gli ospiti', 'Rete: CasaBianchi-Ospiti. La password è sul retro del router.', 'blue', false],
  ['Turni della settimana', 'Lavatrice: Marco. Spesa grande: Giulia. Piante: Sofia.', 'mint', false],
  ['Da sistemare', 'Lampadina del bagno, maniglia della finestra in cucina.', 'neutral', false],
];
for (const [i, [title, content, color, pinned]] of notes.entries()) await call(i % 2 ? M : G, 'POST', '/notes', { title, content, color, pinned });

// Conti bancari simulati: famiglia condiviso, Marco solo saldo
async function link(s, who, visibility) {
  await fetch(`http://127.0.0.1:3000/demo/next-bank/${who}`, { method: 'POST' });
  const r = await call(s, 'POST', '/bank/connections', { bank: 'Banca Aurora', visibility });
  const u = new URL(r.data.url);
  const cb = await fetch(`http://127.0.0.1:3000${u.pathname}${u.search}`, { redirect: 'manual', headers: { cookie: s.cookie } });
  console.log('collegamento', who, cb.status, cb.headers.get('location'));
}
await link(G, 'giulia', 'shared');
await link(M, 'marco', 'balance');
// I mesi passati risultano già classificati; restano da classificare solo le spese di ottobre
for (const m of ['2026-08', '2026-09'])
  for (const t of (await state(G, m)).transactions.filter(t => t.kind === 'expense' && !t.category_id && !t.private_owner))
    await call(G, 'PUT', `/transactions/${t.id}`, { kind: 'expense', amount: t.amount, categoryId: cat.svago, description: t.description, date: t.date });

// Panoramica con i pulsanti rapidi; consulente attivo
await call(G, 'PUT', '/preferences/dashboard', { quickActions: true, order: st.preferences.dashboard.order, hidden: st.preferences.dashboard.hidden.filter(h => h !== 'advice') });
await call(G, 'PUT', '/preferences', { showBankBalance: true });
await call(G, 'PUT', '/advisor/settings', { enabled: true });
console.log('ok');
