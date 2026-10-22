// Server locale di un agente: interfaccia web, eventi in streaming (SSE) e approvazioni.
// Uso:  node core/server.js <agente> [--demo | --live | --registra] [--porta 4300] [--ritmo 1]
//   --demo      (predefinita) riproduce scenario.json, strumenti reali sui dati di prova
//   --live      decisioni dalle API di Claude (serve ANTHROPIC_API_KEY)
//   --registra  come --live, e salva le decisioni in scenario.json
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { eseguiAgente } from './agente.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const nome = args.find((a) => !a.startsWith('--') && !/^\d/.test(a)) || 'vedetta';
const modalita = args.includes('--live') ? 'live' : args.includes('--registra') ? 'registra' : 'demo';
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORTA = Number(opt('--porta', process.env.PORT || 4300));
const RITMO = Number(opt('--ritmo', 1));

if (modalita !== 'demo' && !process.env.ANTHROPIC_API_KEY) {
  console.error('Per le modalità --live e --registra serve la variabile ANTHROPIC_API_KEY.');
  process.exit(1);
}

const dirAgente = path.join(ROOT, nome);
const { creaConfig } = await import(pathToFileURL(path.join(dirAgente, 'agente.config.js')).href);
const config = creaConfig(dirAgente);

const TIPI = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff' };

const clienti = new Set();
const storico = [];
const inAttesa = new Map();
let inCorso = false;

function emetti(ev) {
  ev.t = Date.now();
  storico.push(ev);
  const riga = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clienti) c.write(riga);
}

function file(res, p) {
  fs.readFile(p, (err, buf) => {
    if (err) { res.writeHead(404).end('Non trovato'); return; }
    res.writeHead(200, { 'Content-Type': TIPI[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(buf);
  });
}

function corpo(req) {
  return new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  if (p === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ...config.info, compito: config.compito, modalita, inCorso }));
    return;
  }
  if (p.startsWith('/api/fonte/')) {
    const f = config.fonti?.[p.slice(11)];
    res.writeHead(f ? 200 : 404, { 'Content-Type': 'application/json' }).end(JSON.stringify(f ? f() : { errore: 'fonte sconosciuta' }));
    return;
  }
  if (p === '/api/eventi') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': ok\n\n');
    clienti.add(res);
    req.on('close', () => clienti.delete(res));
    return;
  }
  if (p === '/api/avvia' && req.method === 'POST') {
    if (inCorso) { res.writeHead(409).end('{}'); return; }
    inCorso = true;
    storico.length = 0;
    res.writeHead(202, { 'Content-Type': 'application/json' }).end('{}');
    eseguiAgente({
      config, modalita, emetti, ritmo: RITMO,
      attendiApprovazione: (id) => new Promise((r) => inAttesa.set(id, r)),
    }).catch((e) => emetti({ type: 'errore', messaggio: e.message })).finally(() => { inCorso = false; });
    return;
  }
  if (p === '/api/approva' && req.method === 'POST') {
    const { id, ok } = await corpo(req);
    const r = inAttesa.get(id);
    if (r) { inAttesa.delete(id); r(ok !== false); }
    res.writeHead(r ? 200 : 404, { 'Content-Type': 'application/json' }).end('{}');
    return;
  }

  // File statici: /core/* (componenti comuni), /fonts/* (caratteri locali), il resto dall'app dell'agente
  if (p.startsWith('/core/')) return file(res, path.join(ROOT, 'core', 'ui', path.normalize(p.slice(6))));
  if (p.startsWith('/fonts/')) return file(res, path.join(ROOT, 'node_modules', '@fontsource', path.normalize(p.slice(7))));
  const rel = p === '/' ? 'index.html' : path.normalize(p.slice(1));
  if (rel.startsWith('..')) { res.writeHead(400).end(); return; }
  file(res, path.join(dirAgente, 'app', rel));
});

server.listen(PORTA, () => console.log(`${config.info.nome}: http://localhost:${PORTA}  (modalità ${modalita})`));
